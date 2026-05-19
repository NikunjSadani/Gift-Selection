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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const slabId = searchParams.get('slab') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { mobile: { contains: search } },
        { retailerId: { contains: search } },
      ];
    }
    if (slabId) where.slabId = slabId;
    if (status) where.status = status;

    const [retailers, total] = await Promise.all([
      prisma.retailer.findMany({
        where,
        include: { slab: true, submission: { select: { referenceId: true, submittedAt: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.retailer.count({ where }),
    ]);

    return NextResponse.json({ retailers, total, page, limit });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[admin/retailers GET]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { retailerId, name, ownerName, mobile, slabId, ndaCode, addressLine1, addressLine2, city, state, pincode, gstNumber } = body;

    if (!retailerId || !name || !mobile || !slabId) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    const retailer = await prisma.retailer.create({
      data: { retailerId, name, ownerName, mobile, slabId, ndaCode, addressLine1, addressLine2, city, state, pincode, gstNumber },
    });

    return NextResponse.json({ retailer }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[admin/retailers POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
