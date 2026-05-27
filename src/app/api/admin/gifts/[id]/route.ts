import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
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

    const giftSnap = await db.collection('gifts').doc(id).get();
    if (!giftSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const giftData = giftSnap.data() as Record<string, unknown>;

    // Get slab mappings for this gift
    const mappingsSnap = await db.collection('giftSlabMappings').where('giftId', '==', id).get();
    const slabMappings = await Promise.all(
      mappingsSnap.docs.map(async (d) => {
        const data = d.data() as Record<string, unknown>;
        const slabSnap = await db.collection('slabs').doc(data.slabId as string).get();
        return {
          ...data,
          slab: slabSnap.exists ? { id: slabSnap.id, ...(slabSnap.data() as Record<string, unknown>) } : null,
        };
      }),
    );

    // Count submissions for this giftId
    const submissionsSnap = await db.collection('submissions').where('giftId', '==', id).get();
    const submissionCount = submissionsSnap.size;

    const gift = {
      id,
      ...giftData,
      slabMappings,
      _count: { submissions: submissionCount },
    };

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
      // Delete existing mappings
      const existingSnap = await db.collection('giftSlabMappings').where('giftId', '==', id).get();
      const batch = db.batch();
      existingSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      // Create new mappings
      for (let idx = 0; idx < slabIds.length; idx++) {
        await db.collection('giftSlabMappings').add({
          giftId: id,
          slabId: slabIds[idx],
          displaySequence: idx,
        });
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sku !== undefined) updateData.sku = sku;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (mrp !== undefined) updateData.mrp = parseFloat(mrp);
    if (showMrp !== undefined) updateData.showMrp = showMrp;
    if (status !== undefined) updateData.status = status;

    await db.collection('gifts').doc(id).update(updateData);

    // Return updated gift with slab mappings
    const giftSnap = await db.collection('gifts').doc(id).get();
    const giftData = giftSnap.data() as Record<string, unknown>;

    const mappingsSnap = await db.collection('giftSlabMappings').where('giftId', '==', id).get();
    const slabMappings = await Promise.all(
      mappingsSnap.docs.map(async (d) => {
        const data = d.data() as Record<string, unknown>;
        const slabSnap = await db.collection('slabs').doc(data.slabId as string).get();
        return {
          ...data,
          slab: slabSnap.exists ? { id: slabSnap.id, ...(slabSnap.data() as Record<string, unknown>) } : null,
        };
      }),
    );

    const gift = { id, ...giftData, slabMappings };
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
    await db.collection('gifts').doc(id).update({ status: 'inactive', updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
