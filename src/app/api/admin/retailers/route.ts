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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const slabId = searchParams.get('slab') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const snap = await db.collection('retailers').get();
    let retailers = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown>>;

    // Filter
    if (search) {
      const lower = search.toLowerCase();
      retailers = retailers.filter(
        (r) =>
          (r.name as string)?.toLowerCase().includes(lower) ||
          (r.mobile as string)?.toLowerCase().includes(lower) ||
          (r.retailerId as string)?.toLowerCase().includes(lower),
      );
    }
    if (slabId) retailers = retailers.filter((r) => r.slabId === slabId);
    if (status) retailers = retailers.filter((r) => r.status === status);

    // Sort by createdAt desc
    retailers.sort((a, b) => {
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

    const total = retailers.length;
    const skip = (page - 1) * limit;
    const paged = retailers.slice(skip, skip + limit);

    // Enrich with slab + submission
    const enriched = await Promise.all(
      paged.map(async (r) => {
        const [slabSnap, subSnap] = await Promise.all([
          r.slabId ? db.collection('slabs').doc(r.slabId as string).get() : Promise.resolve(null),
          db.collection('submissions').where('retailerId', '==', r.id).get(),
        ]);
        const slab = slabSnap?.exists ? { id: slabSnap.id, ...(slabSnap.data() as Record<string, unknown>) } : null;
        const submission = subSnap.empty
          ? null
          : (() => {
              const sd = subSnap.docs[0].data() as Record<string, unknown>;
              return { referenceId: sd.referenceId, submittedAt: sd.submittedAt };
            })();
        return { ...r, slab, submission };
      }),
    );

    return NextResponse.json({ retailers: enriched, total, page, limit });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[admin/retailers GET]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { retailerId, name, ownerName, mobile, slabId, ndaCode, addressLine1, addressLine2, city, state, pincode, landmark, cso, csoPhone, gstNumber } = body;

    if (!retailerId || !name || !mobile || !slabId) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    // Format validation
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json({ error: 'invalid_mobile', message: 'Phone number must be exactly 10 digits' }, { status: 400 });
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return NextResponse.json({ error: 'invalid_pincode', message: 'Pin code must be exactly 6 digits' }, { status: 400 });
    }

    // Enforce retailer ID uniqueness
    const existing = await db.collection('retailers').where('retailerId', '==', retailerId).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'duplicate_retailer_id', message: `Retailer ID "${retailerId}" already exists` }, { status: 409 });
    }

    // Enforce mobile uniqueness
    const mobileExists = await db.collection('retailers').where('mobile', '==', mobile).get();
    if (!mobileExists.empty) {
      const owner = (mobileExists.docs[0].data() as Record<string, unknown>).retailerId as string;
      return NextResponse.json({ error: 'duplicate_mobile', message: `Phone number ${mobile} is already registered to Retailer ID "${owner}"` }, { status: 409 });
    }

    // Resolve slab name so it can be denormalized on the retailer and later on submissions
    const slabSnap = await db.collection('slabs').doc(slabId).get();
    if (!slabSnap.exists) {
      return NextResponse.json({ error: 'invalid_slab', message: `Slab "${slabId}" not found` }, { status: 400 });
    }
    const slabName = (slabSnap.data() as Record<string, unknown>).name as string;

    const now = new Date();
    const retailerData = {
      retailerId,
      name,
      ownerName: ownerName || null,
      mobile,
      slabId,
      slabName,
      ndaCode: ndaCode || null,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      landmark: landmark || null,
      cso: cso || null,
      csoPhone: csoPhone || null,
      gstNumber: gstNumber || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection('retailers').add(retailerData);
    const retailer = { id: ref.id, ...retailerData };

    return NextResponse.json({ retailer }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[admin/retailers POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
