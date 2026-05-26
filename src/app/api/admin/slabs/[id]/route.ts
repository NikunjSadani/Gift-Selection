import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.internalCode !== undefined) updateData.internalCode = body.internalCode;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

    await db.collection('slabs').doc(id).update(updateData);

    const snap = await db.collection('slabs').doc(id).get();
    const slab = snap.exists ? { id: snap.id, ...(snap.data() as Record<string, unknown>) } : null;

    return NextResponse.json({ slab });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const retailersSnap = await db.collection('retailers').where('slabId', '==', id).get();
    const retailerCount = retailersSnap.size;
    if (retailerCount > 0) {
      return NextResponse.json({ error: 'slab_has_retailers', count: retailerCount }, { status: 409 });
    }

    await db.collection('slabs').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
