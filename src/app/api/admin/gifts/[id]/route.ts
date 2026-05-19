import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const gift = await prisma.gift.findUnique({
      where: { id },
      include: { slabMappings: { include: { slab: true } }, _count: { select: { submissions: true } } },
    });
    if (!gift) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ gift });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const { name, description, sku, imageUrl, mrp, showMrp, status, slabIds } = body;

    // Update slab mappings if provided
    if (slabIds !== undefined) {
      await prisma.giftSlabMapping.deleteMany({ where: { giftId: id } });
      if (slabIds.length > 0) {
        await prisma.giftSlabMapping.createMany({
          data: slabIds.map((slabId: string, idx: number) => ({
            giftId: id,
            slabId,
            displaySequence: idx,
          })),
        });
      }
    }

    const gift = await prisma.gift.update({
      where: { id },
      data: {
        name,
        description,
        sku,
        imageUrl,
        mrp: mrp !== undefined ? parseFloat(mrp) : undefined,
        showMrp,
        status,
      },
      include: { slabMappings: { include: { slab: true } } },
    });

    return NextResponse.json({ gift });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await prisma.gift.update({ where: { id }, data: { status: 'inactive' } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
