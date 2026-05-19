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

    const retailer = await prisma.retailer.findUnique({
      where: { id },
      include: {
        slab: true,
        submission: { include: { gift: true } },
        draft: true,
      },
    });

    if (!retailer) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ retailer });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminPayload = await requireAdmin(request);
    const { id } = await params;

    const before = await prisma.retailer.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const body = await request.json();

    const retailer = await prisma.retailer.update({
      where: { id },
      data: {
        name: body.name,
        ownerName: body.ownerName,
        mobile: body.mobile,
        slabId: body.slabId,
        ndaCode: body.ndaCode,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        gstNumber: body.gstNumber,
        status: body.status,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: adminPayload.adminId,
        adminEmail: adminPayload.email,
        action: 'UPDATE_RETAILER',
        entityType: 'Retailer',
        entityId: id,
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify(retailer),
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    });

    return NextResponse.json({ retailer });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminPayload = await requireAdmin(request);
    const { id } = await params;

    const retailer = await prisma.retailer.update({
      where: { id },
      data: { status: 'deleted' },
    });

    await prisma.auditLog.create({
      data: {
        adminId: adminPayload.adminId,
        adminEmail: adminPayload.email,
        action: 'DELETE_RETAILER',
        entityType: 'Retailer',
        entityId: id,
        afterValue: JSON.stringify({ status: 'deleted' }),
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    });

    return NextResponse.json({ success: true, retailer });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
