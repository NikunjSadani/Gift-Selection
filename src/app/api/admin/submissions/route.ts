import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const { searchParams } = new URL(request.url);
    const slabId = searchParams.get('slabId') || '';
    const city = searchParams.get('city') || '';
    const state = searchParams.get('state') || '';
    const giftId = searchParams.get('giftId') || '';
    const detailsEdited = searchParams.get('detailsEdited');
    const whatsappSent = searchParams.get('whatsappSent');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (city) where.city = { contains: city };
    if (state) where.state = { contains: state };
    if (giftId) where.giftId = giftId;
    if (detailsEdited !== null && detailsEdited !== '') where.detailsEdited = detailsEdited === 'true';
    if (whatsappSent !== null && whatsappSent !== '') where.whatsappSent = whatsappSent === 'true';
    if (dateFrom || dateTo) {
      where.submittedAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const retailerWhere: Record<string, unknown> = {};
    if (slabId) retailerWhere.slabId = slabId;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where: {
          ...where,
          ...(slabId ? { retailer: { slabId } } : {}),
        },
        include: {
          retailer: { include: { slab: true } },
          gift: true,
        },
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.submission.count({
        where: {
          ...where,
          ...(slabId ? { retailer: { slabId } } : {}),
        },
      }),
    ]);

    return NextResponse.json({ submissions, total, page, limit });
  } catch (err) {
    console.error('[admin/submissions GET]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
