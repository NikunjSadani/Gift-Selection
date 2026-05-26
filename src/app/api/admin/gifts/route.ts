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

    const [giftsSnap, mappingsSnap, submissionsSnap] = await Promise.all([
      db.collection('gifts').get(),
      db.collection('giftSlabMappings').get(),
      db.collection('submissions').get(),
    ]);

    const gifts = giftsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown>>;

    // Group mappings by giftId
    const mappingsByGift = new Map<string, Array<{ slabId: string; displaySequence: number }>>();
    for (const doc of mappingsSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const gid = data.giftId as string;
      if (!mappingsByGift.has(gid)) mappingsByGift.set(gid, []);
      mappingsByGift.get(gid)!.push({
        slabId: data.slabId as string,
        displaySequence: (data.displaySequence as number) ?? 0,
      });
    }

    // Count submissions per giftId
    const submissionCountByGift = new Map<string, number>();
    for (const doc of submissionsSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const gid = data.giftId as string;
      if (gid) submissionCountByGift.set(gid, (submissionCountByGift.get(gid) || 0) + 1);
    }

    // Fetch slab details for mappings
    const slabIds = [...new Set(mappingsSnap.docs.map((d) => (d.data() as Record<string, unknown>).slabId as string))];
    const slabMap = new Map<string, Record<string, unknown>>();
    for (const slabId of slabIds) {
      const slabSnap = await db.collection('slabs').doc(slabId).get();
      if (slabSnap.exists) {
        slabMap.set(slabId, { id: slabSnap.id, ...(slabSnap.data() as Record<string, unknown>) });
      }
    }

    // Sort by createdAt desc
    gifts.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() :
        (a.createdAt && typeof (a.createdAt as { toDate?: unknown }).toDate === 'function')
          ? (a.createdAt as { toDate: () => Date }).toDate().getTime()
          : 0;
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() :
        (b.createdAt && typeof (b.createdAt as { toDate?: unknown }).toDate === 'function')
          ? (b.createdAt as { toDate: () => Date }).toDate().getTime()
          : 0;
      return bTime - aTime;
    });

    const enriched = gifts.map((g) => {
      const gid = g.id as string;
      const giftMappings = (mappingsByGift.get(gid) || []).map((m) => ({
        ...m,
        slab: slabMap.get(m.slabId) || null,
      }));
      return {
        ...g,
        slabMappings: giftMappings,
        _count: { submissions: submissionCountByGift.get(gid) || 0 },
      };
    });

    return NextResponse.json({ gifts: enriched });
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

    const now = new Date();
    const giftData = {
      name,
      description,
      sku: sku || null,
      imageUrl: imageUrl || '/gifts/gift-placeholder.jpg',
      mrp: mrp ? parseFloat(mrp) : null,
      showMrp: !!showMrp,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const giftRef = await db.collection('gifts').add(giftData);
    const giftId = giftRef.id;

    const slabMappings: Array<{ slabId: string; displaySequence: number; slab: Record<string, unknown> | null }> = [];

    if (slabIds?.length) {
      for (let idx = 0; idx < slabIds.length; idx++) {
        const slabId = slabIds[idx];
        await db.collection('giftSlabMappings').add({
          giftId,
          slabId,
          displaySequence: idx,
        });
        const slabSnap = await db.collection('slabs').doc(slabId).get();
        slabMappings.push({
          slabId,
          displaySequence: idx,
          slab: slabSnap.exists ? { id: slabSnap.id, ...(slabSnap.data() as Record<string, unknown>) } : null,
        });
      }
    }

    const gift = { id: giftId, ...giftData, slabMappings };

    return NextResponse.json({ gift }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/gifts POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
