import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const slabsSnap = await db.collection('slabs').orderBy('displayOrder').get();
    const slabs = slabsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

    // Count retailers per slab and gift mappings per slab in parallel
    const [retailersSnap, mappingsSnap] = await Promise.all([
      db.collection('retailers').get(),
      db.collection('giftSlabMappings').get(),
    ]);

    const retailerCountBySlab: Record<string, number> = {};
    for (const doc of retailersSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const sid = data.slabId as string;
      if (sid) retailerCountBySlab[sid] = (retailerCountBySlab[sid] || 0) + 1;
    }

    const mappingCountBySlab: Record<string, number> = {};
    for (const doc of mappingsSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const sid = data.slabId as string;
      if (sid) mappingCountBySlab[sid] = (mappingCountBySlab[sid] || 0) + 1;
    }

    const enriched = slabs.map((s) => ({
      ...s,
      _count: {
        retailers: retailerCountBySlab[s.id] || 0,
        giftMappings: mappingCountBySlab[s.id] || 0,
      },
    }));

    return NextResponse.json({ slabs: enriched });
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

    const now = new Date();
    const slabData = {
      name,
      internalCode,
      displayOrder: displayOrder || 0,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection('slabs').add(slabData);
    const slab = { id: ref.id, ...slabData };

    return NextResponse.json({ slab }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/slabs POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
