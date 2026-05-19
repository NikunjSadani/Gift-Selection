import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRetailerToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifyRetailerToken(token);
    const retailer = await prisma.retailer.findUnique({
      where: { id: payload.retailerId },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const mappings = await prisma.giftSlabMapping.findMany({
      where: { slabId: retailer.slabId },
      orderBy: { displaySequence: 'asc' },
      include: {
        gift: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            mrp: true,
            showMrp: true,
            status: true,
          },
        },
      },
    });

    const gifts = mappings
      .filter((m) => m.gift.status === 'active')
      .map((m) => m.gift);

    return NextResponse.json({ gifts });
  } catch (err) {
    console.error('[gifts]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
