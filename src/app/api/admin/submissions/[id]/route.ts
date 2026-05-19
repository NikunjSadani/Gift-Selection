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

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        retailer: { include: { slab: true } },
        gift: true,
      },
    });

    if (!submission) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ submission });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminPayload = await requireAdmin(request);
    const { id } = await params;

    const before = await prisma.submission.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const body = await request.json();
    const {
      storeName,
      ownerName,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      gstNumber,
      landmark,
      alternateMobile,
      giftId,
    } = body;

    const submission = await prisma.submission.update({
      where: { id },
      data: {
        storeName,
        ownerName,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        gstNumber,
        landmark,
        alternateMobile,
        giftId,
      },
      include: { retailer: true, gift: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: adminPayload.adminId,
        adminEmail: adminPayload.email,
        action: 'UPDATE_SUBMISSION',
        entityType: 'Submission',
        entityId: id,
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify(submission),
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    });

    return NextResponse.json({ submission });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/submissions PUT]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
