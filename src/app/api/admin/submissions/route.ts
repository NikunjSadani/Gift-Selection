import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const { searchParams } = new URL(request.url);
    const slabId = searchParams.get('slabId') || '';
    const city = searchParams.get('city') || '';
    const state = searchParams.get('state') || '';
    const giftId = searchParams.get('giftId') || '';
    const detailsEdited = searchParams.get('detailsEdited');
    const whatsappSent = searchParams.get('whatsappSent');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const snap = await db.collection('submissions').get();
    let submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown>>;

    // Filter in memory (submissions are denormalized — no joins needed)
    if (city) {
      const lower = city.toLowerCase();
      submissions = submissions.filter((s) => (s.city as string)?.toLowerCase().includes(lower));
    }
    if (state) {
      const lower = state.toLowerCase();
      submissions = submissions.filter((s) => (s.state as string)?.toLowerCase().includes(lower));
    }
    if (giftId) submissions = submissions.filter((s) => s.giftId === giftId);
    if (detailsEdited !== null && detailsEdited !== '') {
      submissions = submissions.filter((s) => s.detailsEdited === (detailsEdited === 'true'));
    }
    if (whatsappSent !== null && whatsappSent !== '') {
      submissions = submissions.filter((s) => s.whatsappSent === (whatsappSent === 'true'));
    }
    if (slabId) {
      // submissions have denormalized slabName; match by slabId requires retailer lookup
      // We'll fetch the slab name first and filter by slabName
      const slabSnap = await db.collection('slabs').doc(slabId).get();
      if (slabSnap.exists) {
        const slabName = (slabSnap.data() as Record<string, unknown>).name as string;
        submissions = submissions.filter((s) => s.slabName === slabName);
      } else {
        submissions = [];
      }
    }
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : null;
      const to = dateTo ? new Date(dateTo).getTime() : null;
      submissions = submissions.filter((s) => {
        const submittedAt = s.submittedAt instanceof Date
          ? s.submittedAt.getTime()
          : typeof (s.submittedAt as { toDate?: unknown })?.toDate === 'function'
            ? (s.submittedAt as { toDate: () => Date }).toDate().getTime()
            : null;
        if (submittedAt === null) return false;
        if (from && submittedAt < from) return false;
        if (to && submittedAt > to) return false;
        return true;
      });
    }

    // Sort by submittedAt desc
    submissions.sort((a, b) => {
      const aTime = a.submittedAt instanceof Date ? a.submittedAt.getTime() :
        (a.submittedAt && typeof (a.submittedAt as { toDate?: unknown }).toDate === 'function')
          ? (a.submittedAt as { toDate: () => Date }).toDate().getTime()
          : 0;
      const bTime = b.submittedAt instanceof Date ? b.submittedAt.getTime() :
        (b.submittedAt && typeof (b.submittedAt as { toDate?: unknown }).toDate === 'function')
          ? (b.submittedAt as { toDate: () => Date }).toDate().getTime()
          : 0;
      return bTime - aTime;
    });

    const total = submissions.length;
    const skip = (page - 1) * limit;
    const paged = submissions.slice(skip, skip + limit);

    // Batch-fetch retailer docs for this page so we can include human-readable fields
    const retailerIds = [...new Set(paged.map((s) => s.retailerId as string).filter(Boolean))];
    const retailerMap: Record<string, Record<string, unknown>> = {};
    if (retailerIds.length > 0) {
      const retailerSnaps = await Promise.all(
        retailerIds.map((id) => db.collection('retailers').doc(id).get()),
      );
      retailerSnaps.forEach((snap) => {
        if (snap.exists) retailerMap[snap.id] = snap.data() as Record<string, unknown>;
      });
    }

    // For submissions with missing slabName, fetch slab names from retailer docs
    const slabNameCache = new Map<string, string>();
    const missingSlabNames = paged.filter(
      (s) => !(s.slabName as string),
    );
    if (missingSlabNames.length > 0) {
      await Promise.all(
        missingSlabNames.map(async (s) => {
          const r = retailerMap[s.retailerId as string];
          const slabId = r?.slabId as string | undefined;
          if (slabId && !slabNameCache.has(slabId)) {
            const slabSnap = await db.collection('slabs').doc(slabId).get();
            slabNameCache.set(
              slabId,
              slabSnap.exists ? ((slabSnap.data() as Record<string, unknown>).name as string) : '',
            );
          }
        }),
      );
    }

    // Reshape: add nested `retailer` and `gift` objects expected by the UI
    const shaped = paged.map((s) => {
      const r = retailerMap[s.retailerId as string] ?? {};
      // Prefer denormalized slabName on submission; fall back to slab lookup
      const resolvedSlabName =
        (s.slabName as string) ||
        slabNameCache.get(r.slabId as string) ||
        '';
      return {
        ...s,
        slabName: resolvedSlabName,
        submittedAt: s.submittedAt instanceof Date
          ? s.submittedAt.toISOString()
          : typeof (s.submittedAt as { toDate?: unknown })?.toDate === 'function'
            ? (s.submittedAt as { toDate: () => Date }).toDate().toISOString()
            : s.submittedAt,
        whatsappSentAt: s.whatsappSentAt instanceof Date
          ? s.whatsappSentAt.toISOString()
          : typeof (s.whatsappSentAt as { toDate?: unknown })?.toDate === 'function'
            ? (s.whatsappSentAt as { toDate: () => Date }).toDate().toISOString()
            : s.whatsappSentAt,
        gift: {
          id: s.giftId as string,
          name: s.giftName as string,
        },
        retailer: {
          retailerId: (r.retailerId as string) ?? (s.retailerId as string),
          mobile: (s.retailerMobile as string) ?? (r.mobile as string) ?? '',
          ownerName: (r.ownerName as string | null) ?? null,
          cso: (r.cso as string | null) ?? null,
          csoPhone: (r.csoPhone as string | null) ?? null,
          slab: { name: resolvedSlabName },
        },
      };
    });

    return NextResponse.json({ submissions: shaped, total, page, limit });
  } catch (err) {
    console.error('[admin/submissions GET]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
