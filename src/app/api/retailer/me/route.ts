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
      include: {
        slab: true,
        submission: {
          include: { gift: true },
        },
        draft: true,
      },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ retailer });
  } catch (err) {
    console.error('[retailer/me]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
