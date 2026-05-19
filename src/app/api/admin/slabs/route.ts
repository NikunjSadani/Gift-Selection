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
    const slabs = await prisma.slab.findMany({
      include: {
        _count: { select: { retailers: true, giftMappings: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });
    return NextResponse.json({ slabs });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { name, internalCode, displayOrder } = body;

    if (!name || !internalCode) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    const slab = await prisma.slab.create({
      data: { name, internalCode, displayOrder: displayOrder || 0 },
    });

    return NextResponse.json({ slab }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/slabs POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
