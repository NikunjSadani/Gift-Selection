import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signRetailerToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile, otp } = body;

    if (!mobile || !otp) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const record = await prisma.otpRecord.findFirst({
      where: {
        mobile,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.otp !== otp) {
      return NextResponse.json({ error: 'invalid_otp' }, { status: 400 });
    }

    await prisma.otpRecord.update({ where: { id: record.id }, data: { used: true } });

    const retailer = await prisma.retailer.findUnique({
      where: { mobile },
      include: { submission: true },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'not_registered' }, { status: 404 });
    }

    const token = await signRetailerToken(retailer.id, mobile);

    const response = NextResponse.json({
      success: true,
      hasSubmission: !!retailer.submission,
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
