import { NextRequest, NextResponse } from 'next/server';
import { getCampaignStatus } from '@/lib/campaign';
import { getRetailersByMobile } from '@/lib/firestore';
import { generateOtp, sendOtp } from '@/lib/otp';
import { createOtpRecord, deleteOtpsByMobile } from '@/lib/otp-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile } = body;

    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return NextResponse.json({ error: 'invalid_mobile' }, { status: 400 });
    }

    const { status, setting } = await getCampaignStatus();
    if (status !== 'active') {
      return NextResponse.json({ error: 'campaign_inactive', status }, { status: 403 });
    }

    // Support multi-outlet: any active retailer on this mobile is enough to send OTP
    const retailers = await getRetailersByMobile(mobile);
    if (retailers.length === 0) {
      return NextResponse.json({ error: 'not_registered' }, { status: 404 });
    }

    // Remove old OTPs and issue a fresh one
    await deleteOtpsByMobile(mobile);

    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + setting.otpExpiryMinutes * 60 * 1000);

    await createOtpRecord(mobile, otp, expiresAt);
    await sendOtp(mobile, otp);

    return NextResponse.json({
      success: true,
      resendAfter: setting.otpResendSeconds,
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (err) {
    console.error('[request-otp]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
