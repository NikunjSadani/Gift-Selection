import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  await verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    // All drafts with a gift selected
    const draftsSnap = await db.collection('drafts').get();
    type FDoc = Record<string, unknown>;
    const allDraftsWithGift = (draftsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() })) as FDoc[])
      .filter((d) => d.giftId != null);

    // Get all submitted retailer IDs
    const submissionsSnap = await db.collection('submissions').get();
    const submittedRetailerIds = new Set(
      submissionsSnap.docs.map((d) => (d.data() as Record<string, unknown>).retailerId as string),
    );

    // Filter to those without a submission
    const drafts = allDraftsWithGift.filter((d) => !submittedRetailerIds.has(d.retailerId as string));

    // Sort by updatedAt desc
    drafts.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() :
        (a.updatedAt && typeof (a.updatedAt as { toDate?: unknown }).toDate === 'function')
          ? (a.updatedAt as { toDate: () => Date }).toDate().getTime()
          : 0;
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() :
        (b.updatedAt && typeof (b.updatedAt as { toDate?: unknown }).toDate === 'function')
          ? (b.updatedAt as { toDate: () => Date }).toDate().getTime()
          : 0;
      return bTime - aTime;
    });

    // Collect unique gift IDs
    const giftIds = [...new Set(drafts.map((d) => d.giftId as string).filter(Boolean))];

    // Fetch gift names
    const giftMap = new Map<string, string>();
    for (const giftId of giftIds) {
      const giftSnap = await db.collection('gifts').doc(giftId).get();
      if (giftSnap.exists) {
        const giftData = giftSnap.data() as Record<string, unknown>;
        giftMap.set(giftId, giftData.name as string);
      }
    }

    // Enrich with retailer data
    const result = await Promise.all(
      drafts.map(async (d) => {
        const retailerId = d.retailerId as string;
        const retailerSnap = await db.collection('retailers').doc(retailerId).get();
        const retailer = retailerSnap.exists
          ? (retailerSnap.data() as Record<string, unknown>)
          : null;

        let slabName = '—';
        if (retailer?.slabId) {
          const slabSnap = await db.collection('slabs').doc(retailer.slabId as string).get();
          if (slabSnap.exists) {
            slabName = (slabSnap.data() as Record<string, unknown>).name as string;
          }
        }

        const giftId = d.giftId as string | null;
        return {
          id: d.id,
          retailerId: retailer?.retailerId ?? retailerId,
          name: retailer?.name ?? '',
          mobile: retailer?.mobile ?? '',
          slab: slabName,
          giftId,
          giftSelected: giftId ? (giftMap.get(giftId) ?? 'Unknown') : '—',
          giftConfirmed: d.giftConfirmed,
          giftSelectedAt: d.giftSelectedAt,
          step: d.step,
          lastActivity: d.updatedAt,
        };
      }),
    );

    return NextResponse.json({ inProgress: result, total: result.length });
  } catch (err) {
    if ((err as Error).message === 'unauthorized')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/in-progress GET]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// Admin: reset a retailer's gift confirmation (and optionally clear gift selection)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });

    await db.collection('drafts').doc(draftId).update({
      giftId: null,
      giftConfirmed: false,
      giftSelectedAt: null,
      step: 'gift',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if ((err as Error).message === 'unauthorized')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[admin/in-progress DELETE]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
