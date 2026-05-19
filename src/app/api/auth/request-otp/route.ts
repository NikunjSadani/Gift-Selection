import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCampaignStatus } from '@/lib/campaign';
import { generateOtp, sendOtp } from '@/lib/otp';

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

    const retailer = await prisma.retailer.findUnique({ where: { mobile } });
    if (!retailer) {
      return NextResponse.json({ error: 'not_registered' }, { status: 404 });
    }
    if (retailer.status !== 'active') {
      return NextResponse.json({ error: 'inactive' }, { status: 403 });
    }

    // Delete old OTPs for this mobile
    await prisma.otpRecord.deleteMany({ where: { mobile } });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + setting.otpExpiryMinutes * 60 * 1000);

    await prisma.otpRecord.create({
      data: { mobile, otp, expiresAt },
    });

    await sendOtp(mobile, otp);

    return NextResponse.json({ success: true, resendAfter: setting.otpResendSeconds });
  } catch (err) {
    console.error('[request-otp]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
