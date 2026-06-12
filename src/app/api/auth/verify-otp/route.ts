import { NextRequest, NextResponse } from 'next/server';
import { findValidOtp, markOtpUsed } from '@/lib/otp-store';
import { getRetailersByMobile, getSubmissionByRetailerId } from '@/lib/firestore';
import { signRetailerToken, signOutletSelectionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile, otp } = body;

    if (!mobile || !otp) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const record = await findValidOtp(mobile);
    if (!record || record.otp !== otp) {
      return NextResponse.json({ error: 'invalid_otp' }, { status: 400 });
    }

    await markOtpUsed(record.id);

    const retailers = await getRetailersByMobile(mobile);
    if (retailers.length === 0) {
      return NextResponse.json({ error: 'not_registered' }, { status: 404 });
    }

    // ── Single outlet: existing behaviour ──────────────────────────────────────
    if (retailers.length === 1) {
      const retailer = retailers[0];
      const submission = await getSubmissionByRetailerId(retailer.id);
      const token = await signRetailerToken(retailer.id, mobile);

      const response = NextResponse.json({ success: true, hasSubmission: !!submission });
      response.cookies.set('retailer_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 150 * 60 * 60,
        path: '/',
        sameSite: 'lax',
      });
      return response;
    }

    // ── Multiple outlets: return list for picker, set short-lived selection token ─
    const outletSelectionToken = await signOutletSelectionToken(mobile);

    // Fetch submission status for each outlet in parallel
    const submissions = await Promise.all(
      retailers.map((r) => getSubmissionByRetailerId(r.id)),
    );

    const outlets = retailers.map((r, i) => ({
      id: r.id,
      retailerId: r.retailerId,
      slabName: r.slabName,
      hasSubmission: !!submissions[i],
    }));

    const response = NextResponse.json({
      success: true,
      multipleOutlets: true,
      outlets,
    });

    response.cookies.set('outlet_selection_token', outletSelectionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60, // 15 minutes — enough to pick an outlet
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
