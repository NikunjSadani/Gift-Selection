import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const [
      totalRetailers,
      totalSubmissions,
      draftsCount,
      slabs,
      gifts,
      submissions,
    ] = await Promise.all([
      prisma.retailer.count({ where: { status: 'active' } }),
      prisma.submission.count(),
      prisma.draft.count(),
      prisma.slab.findMany({
        include: {
          retailers: { where: { status: 'active' } },
          _count: true,
        },
      }),
      prisma.gift.findMany({
        include: {
          _count: { select: { submissions: true } },
        },
      }),
      prisma.submission.findMany({
        select: { whatsappSent: true },
      }),
    ]);

    const totalLogins = draftsCount + totalSubmissions;
    const pendingCount = draftsCount;
    const notStarted = totalRetailers - totalLogins;

    // Slab wise
    const slabWise = slabs.map((s) => ({
      name: s.name,
      totalRetailers: s.retailers.length,
      submissions: 0, // will compute below
    }));

    const subsByRetailer = await prisma.submission.findMany({
      include: { retailer: { select: { slabId: true } } },
    });

    const slabSubmissionCount: Record<string, number> = {};
    for (const sub of subsByRetailer) {
      const sid = sub.retailer.slabId;
      slabSubmissionCount[sid] = (slabSubmissionCount[sid] || 0) + 1;
    }

    const slabWiseFull = slabs.map((s) => ({
      id: s.id,
      name: s.name,
      totalRetailers: s.retailers.length,
      submissions: slabSubmissionCount[s.id] || 0,
    }));

    const giftWise = gifts.map((g) => ({
      id: g.id,
      name: g.name,
      count: g._count.submissions,
    }));

    const whatsappSent = submissions.filter((s) => s.whatsappSent).length;
    const whatsappSuccessRate = totalSubmissions > 0 ? Math.round((whatsappSent / totalSubmissions) * 100) : 0;

    return NextResponse.json({
      totalRetailers,
      totalLogins,
      totalSubmissions,
      pendingCount,
      notStarted: Math.max(0, notStarted),
      slabWise: slabWiseFull,
      giftWise,
      whatsappSuccessRate,
    });
  } catch (err) {
    console.error('[admin/dashboard]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
