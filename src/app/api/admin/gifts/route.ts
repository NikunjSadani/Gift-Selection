import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const gifts = await prisma.gift.findMany({
      include: {
        slabMappings: { include: { slab: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ gifts });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { name, description, sku, imageUrl, mrp, showMrp, slabIds } = body;

    if (!name || !description) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    const gift = await prisma.gift.create({
      data: {
        name,
        description,
        sku: sku || null,
        imageUrl: imageUrl || '/gifts/gift-placeholder.jpg',
        mrp: mrp ? parseFloat(mrp) : null,
        showMrp: !!showMrp,
        slabMappings: slabIds?.length
          ? {
              create: slabIds.map((slabId: string, idx: number) => ({
                slabId,
                displaySequence: idx,
              })),
            }
          : undefined,
      },
      include: { slabMappings: { include: { slab: true } } },
    });

    return NextResponse.json({ gift }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/gifts POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
