import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const [retailersSnap, submissionsSnap, draftsSnap, giftsSnap, slabsSnap] = await Promise.all([
      db.collection('retailers').get(),
      db.collection('submissions').get(),
      db.collection('drafts').get(),
      db.collection('gifts').get(),
      db.collection('slabs').orderBy('displayOrder').get(),
    ]);

    type FDoc = Record<string, unknown>;
    const allRetailers  = retailersSnap.docs.map((d)  => ({ id: d.id, ...d.data() }))  as FDoc[];
    const allSubmissions = submissionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FDoc[];
    const allDrafts     = draftsSnap.docs.map((d)     => ({ id: d.id, ...d.data() }))  as FDoc[];
    const allGifts      = giftsSnap.docs.map((d)      => ({ id: d.id, ...d.data() }))  as FDoc[];
    const allSlabs      = slabsSnap.docs.map((d)      => ({ id: d.id, ...d.data() }))  as FDoc[];

    const totalRetailers = allRetailers.filter((r) => r.status === 'active').length;
    const totalSubmissions = allSubmissions.length;

    // Exclude drafts that belong to retailers who have already submitted
    const submittedRetailerIds = new Set(allSubmissions.map((s) => s.retailerId as string).filter(Boolean));

    const inProgressDrafts = allDrafts.filter(
      (d) => d.giftId != null && !submittedRetailerIds.has(d.retailerId as string),
    );

    const pendingCount = inProgressDrafts.length;
    const totalLogins = pendingCount + totalSubmissions;
    const notStarted = Math.max(0, totalRetailers - totalLogins);

    // ── Slab-wise ──────────────────────────────────────────────────────────
    const slabRetailerCount: Record<string, number> = {};
    for (const r of allRetailers) {
      if (r.status === 'active' && r.slabId) {
        const sid = r.slabId as string;
        slabRetailerCount[sid] = (slabRetailerCount[sid] || 0) + 1;
      }
    }

    const slabSubmissionCount: Record<string, number> = {};
    for (const sub of allSubmissions) {
      const slabName = sub.slabName as string | undefined;
      if (slabName) {
        slabSubmissionCount[slabName] = (slabSubmissionCount[slabName] || 0) + 1;
      }
    }

    const slabWiseFull = allSlabs.map((s) => {
      const sid  = s.id as string;
      const name = s.name as string;
      return {
        id:             sid,
        name,
        totalRetailers: slabRetailerCount[sid] || 0,
        submissions:    slabSubmissionCount[name] || 0,
      };
    });

    // ── Gift-wise (submitted + in-progress) ────────────────────────────────
    const submissionCountByGift: Record<string, number> = {};
    for (const sub of allSubmissions) {
      const gid = sub.giftId as string | undefined;
      if (gid) submissionCountByGift[gid] = (submissionCountByGift[gid] || 0) + 1;
    }

    const draftCountByGift: Record<string, number> = {};
    for (const d of inProgressDrafts) {
      const gid = d.giftId as string | undefined;
      if (gid) draftCountByGift[gid] = (draftCountByGift[gid] || 0) + 1;
    }

    const giftWise = allGifts.map((g) => {
      const gid = g.id as string;
      return {
        id:         gid,
        name:       g.name as string,
        submitted:  submissionCountByGift[gid] || 0,
        inProgress: draftCountByGift[gid] || 0,
        total:      (submissionCountByGift[gid] || 0) + (draftCountByGift[gid] || 0),
      };
    });

    // ── WhatsApp rate ──────────────────────────────────────────────────────
    const whatsappSent = allSubmissions.filter((s) => s.whatsappSent === true).length;
    const whatsappSuccessRate =
      totalSubmissions > 0 ? Math.round((whatsappSent / totalSubmissions) * 100) : 0;

    return NextResponse.json({
      totalRetailers,
      totalLogins,
      totalSubmissions,
      pendingCount,
      notStarted,
      slabWise: slabWiseFull,
      giftWise,
      whatsappSuccessRate,
    });
  } catch (err) {
    console.error('[admin/dashboard]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
