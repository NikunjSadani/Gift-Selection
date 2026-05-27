import { NextRequest, NextResponse } from 'next/server';
import { findValidOtp, markOtpUsed } from '@/lib/otp-store';
import { getRetailerByMobile, getSubmissionByRetailerId } from '@/lib/firestore';
import { signRetailerToken } from '@/lib/auth';

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

    const retailer = await getRetailerByMobile(mobile);
    if (!retailer) {
      return NextResponse.json({ error: 'not_registered' }, { status: 404 });
    }

    const submission = await getSubmissionByRetailerId(retailer.id);
    const token      = await signRetailerToken(retailer.id, mobile);

    const response = NextResponse.json({
      success: true,
      hasSubmission: !!submission,
    });

    response.cookies.set('retailer_token', token, {
      httpOnly: true,
      maxAge: 60 * 60,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
