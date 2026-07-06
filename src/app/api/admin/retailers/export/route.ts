import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const snap = await db.collection('retailers').get();
    const retailers = snap.docs
      .map((d) => {
        const r = d.data() as Record<string, unknown>;
        return {
          'Retailer ID':      (r.retailerId as string) ?? '',
          'Retailer Name':    (r.name as string) ?? '',
          'Owner Name':       (r.ownerName as string) || '',
          'Phone Number':     (r.mobile as string) ?? '',
          'Address Line 1':   (r.addressLine1 as string) || '',
          'Address Line 2':   (r.addressLine2 as string) || '',
          'State':            (r.state as string) || '',
          'City':             (r.city as string) || '',
          'Pin Code':         (r.pincode as string) || '',
          'Landmark':         (r.landmark as string) || '',
          'CSO':              (r.cso as string) || '',
          'CSO Phone Number': (r.csoPhone as string) || '',
          'Slab Winner':      (r.slabName as string) || '',
          'Status':           (r.status as string) || '',
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
