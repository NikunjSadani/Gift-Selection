import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';
import { deriveRetailerProgress } from '@/lib/retailer-progress';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    // Fetch everything the export needs in parallel, then join in memory
    // (a per-retailer query would be thousands of round-trips).
    const [retailersSnap, submissionsSnap, draftsSnap, giftsSnap] = await Promise.all([
      db.collection('retailers').get(),
      db.collection('submissions').get(),
      db.collection('drafts').get(),
      db.collection('gifts').get(),
    ]);

    // giftId → gift name (for resolving in-progress draft picks)
    const giftNameById = new Map<string, string>();
    giftsSnap.forEach((d) => giftNameById.set(d.id, ((d.data() as Record<string, unknown>).name as string) ?? ''));

    // retailer docId → submission (existence = submitted)
    const submissionByRetailer = new Map<string, { giftName: string }>();
    submissionsSnap.forEach((d) => {
      const s = d.data() as Record<string, unknown>;
      const rid = s.retailerId as string;
      if (rid) submissionByRetailer.set(rid, { giftName: (s.giftName as string) ?? '' });
    });

    // draft doc id = retailer docId → { giftId, whether any form data was entered }
    const draftByRetailer = new Map<string, { giftId: string | null; hasFormData: boolean }>();
    draftsSnap.forEach((d) => {
      const dr = d.data() as Record<string, unknown>;
      const fd = dr.formData;
      let hasFormData = false;
      if (fd != null) {
        if (typeof fd === 'string') { const t = fd.trim(); hasFormData = t.length > 0 && t !== '{}'; }
        else if (typeof fd === 'object') hasFormData = Object.keys(fd as object).length > 0;
        else hasFormData = true;
      }
      draftByRetailer.set(d.id, { giftId: (dr.giftId as string) ?? null, hasFormData });
    });

    const retailers = retailersSnap.docs
      .map((d) => {
        const r = d.data() as Record<string, unknown>;
        const progress = deriveRetailerProgress({
          submission: submissionByRetailer.get(d.id) ?? null,
          draft: draftByRetailer.get(d.id) ?? null,
          giftNameById,
        });
        return {
          'Retailer ID':          (r.retailerId as string) ?? '',
          'Retailer Name':        (r.name as string) ?? '',
          'Owner Name':           (r.ownerName as string) || '',
          'Phone Number':         (r.mobile as string) ?? '',
          'Address Line 1':       (r.addressLine1 as string) || '',
          'Address Line 2':       (r.addressLine2 as string) || '',
          'State':                (r.state as string) || '',
          'City':                 (r.city as string) || '',
          'Pin Code':             (r.pincode as string) || '',
          'Landmark':             (r.landmark as string) || '',
          'CSO':                  (r.cso as string) || '',
          'CSO Phone Number':     (r.csoPhone as string) || '',
          'Slab Winner':          (r.slabName as string) || '',
          'Status':               (r.status as string) || '',
          'Gift Selected':        progress.giftSelected,
          'Form Submitted Status': progress.status,
        };
      })
      .sort((a, b) => a['Retailer ID'].localeCompare(b['Retailer ID']));

    return NextResponse.json({ retailers, total: retailers.length });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[admin/retailers/export]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
