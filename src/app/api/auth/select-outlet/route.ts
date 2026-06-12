import { NextRequest, NextResponse } from 'next/server';
import { verifyOutletSelectionToken, verifyRetailerToken, signRetailerToken } from '@/lib/auth';
import { getRetailersByMobile, getSubmissionByRetailerId } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { retailerId } = body;
    if (!retailerId) {
      return NextResponse.json({ error: 'retailerId_required' }, { status: 400 });
    }

    // Accept either outlet_selection_token (post-OTP) or retailer_token (switching from confirmation)
    const outletToken   = request.cookies.get('outlet_selection_token')?.value;
    const retailerToken = request.cookies.get('retailer_token')?.value;

    let mobile: string;
    if (outletToken) {
      try {
        const payload = await verifyOutletSelectionToken(outletToken);
        mobile = payload.mobile;
      } catch {
        return NextResponse.json({ error: 'session_expired', message: 'Selection session expired — please log in again.' }, { status: 401 });
      }
    } else if (retailerToken) {
      try {
        const payload = await verifyRetailerToken(retailerToken);
        mobile = payload.mobile;
      } catch {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Verify the chosen outlet belongs to this mobile
    const retailers = await getRetailersByMobile(mobile);
    const chosen = retailers.find((r) => r.id === retailerId);
    if (!chosen) {
      return NextResponse.json({ error: 'invalid_outlet' }, { status: 403 });
    }

    const submission = await getSubmissionByRetailerId(chosen.id);
    const token = await signRetailerToken(chosen.id, mobile);

    const response = NextResponse.json({ success: true, hasSubmission: !!submission });

    response.cookies.set('retailer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 150 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    });
    // Clear the short-lived selection token if it was used
    response.cookies.set('outlet_selection_token', '', {
      maxAge: 0,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err) {
    console.error('[select-outlet]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
