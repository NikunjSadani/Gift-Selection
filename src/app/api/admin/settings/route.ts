import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { getOrCreateCampaignSetting } from '@/lib/campaign';
import { prisma } from '@/lib/prisma';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const setting = await getOrCreateCampaignSetting();
    return NextResponse.json({ setting });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const setting = await getOrCreateCampaignSetting();

    const updated = await prisma.campaignSetting.update({
      where: { id: setting.id },
      data: {
        campaignName: body.campaignName,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        forceStatus: body.forceStatus || null,
        supportWhatsapp: body.supportWhatsapp || '',
        otpExpiryMinutes: body.otpExpiryMinutes ? parseInt(body.otpExpiryMinutes) : undefined,
        otpResendSeconds: body.otpResendSeconds ? parseInt(body.otpResendSeconds) : undefined,
        maxDocSizeMb: body.maxDocSizeMb ? parseInt(body.maxDocSizeMb) : undefined,
        whatsappEnabled: body.whatsappEnabled !== undefined ? body.whatsappEnabled : undefined,
      },
    });

    return NextResponse.json({ setting: updated });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/settings PUT]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
