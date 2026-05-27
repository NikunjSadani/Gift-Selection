import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { getOrCreateCampaignSetting } from '@/lib/campaign';
import { db } from '@/lib/firebase-admin';

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
    await getOrCreateCampaignSetting();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.campaignName !== undefined) updateData.campaignName = body.campaignName;
    updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    updateData.forceStatus = body.forceStatus || null;
    updateData.supportWhatsapp = body.supportWhatsapp || '';
    if (body.otpExpiryMinutes !== undefined) updateData.otpExpiryMinutes = parseInt(body.otpExpiryMinutes);
    if (body.otpResendSeconds !== undefined) updateData.otpResendSeconds = parseInt(body.otpResendSeconds);
    if (body.maxDocSizeMb !== undefined) updateData.maxDocSizeMb = parseInt(body.maxDocSizeMb);
    if (body.whatsappEnabled !== undefined) updateData.whatsappEnabled = body.whatsappEnabled;

    await db.collection('settings').doc('campaign').update(updateData);

    const updated = await getOrCreateCampaignSetting();
    return NextResponse.json({ setting: updated });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/settings PUT]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
