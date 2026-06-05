import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken, requireSuperAdmin } from '@/lib/auth';
import {
  getRetailerById,
  getSubmissionByRetailerId,
  getDraftByRetailerId,
  getSlabById,
} from '@/lib/firestore';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const retailer = await getRetailerById(id);
    if (!retailer) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const [submission, draft, slab] = await Promise.all([
      getSubmissionByRetailerId(id),
      getDraftByRetailerId(id),
      getSlabById(retailer.slabId),
    ]);

    return NextResponse.json({ retailer: { ...retailer, slab, submission, draft } });
  } catch (err) {
    if ((err as Error).message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminPayload = await requireAdmin(request);
    requireSuperAdmin(adminPayload);
    const { id } = await params;

    const before = await getRetailerById(id);
    if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.ownerName !== undefined) updateData.ownerName = body.ownerName;
    if (body.mobile !== undefined) {
      // Enforce mobile uniqueness — exclude this retailer's own record
      if (body.mobile !== before.mobile) {
        const mobileExists = await db.collection('retailers').where('mobile', '==', body.mobile).get();
        const conflict = mobileExists.docs.find((d) => d.id !== id);
        if (conflict) {
          const owner = (conflict.data() as Record<string, unknown>).retailerId as string;
          return NextResponse.json(
            { error: 'duplicate_mobile', message: `Phone number ${body.mobile} is already registered to Retailer ID "${owner}"` },
            { status: 409 },
          );
        }
      }
      updateData.mobile = body.mobile;
    }
    if (body.slabId !== undefined) {
      updateData.slabId = body.slabId;
      // Keep denormalized slabName in sync
      const slabSnap = await db.collection('slabs').doc(body.slabId).get();
      updateData.slabName = slabSnap.exists
        ? ((slabSnap.data() as Record<string, unknown>).name as string)
        : '';
    }
    if (body.ndaCode !== undefined) updateData.ndaCode = body.ndaCode;
    if (body.addressLine1 !== undefined) updateData.addressLine1 = body.addressLine1;
    if (body.addressLine2 !== undefined) updateData.addressLine2 = body.addressLine2;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.pincode !== undefined) updateData.pincode = body.pincode;
    if (body.landmark !== undefined) updateData.landmark = body.landmark;
    if (body.cso !== undefined) updateData.cso = body.cso;
    if (body.csoPhone !== undefined) updateData.csoPhone = body.csoPhone;
    if (body.gstNumber !== undefined) updateData.gstNumber = body.gstNumber;
    if (body.status !== undefined) updateData.status = body.status;

    await db.collection('retailers').doc(id).update(updateData);

    const retailer = await getRetailerById(id);

    await db.collection('auditLogs').add({
      adminId: adminPayload.adminId,
      adminEmail: adminPayload.email,
      action: 'UPDATE_RETAILER',
      entityType: 'Retailer',
      entityId: id,
      beforeValue: JSON.stringify(before),
      afterValue: JSON.stringify(retailer),
      ipAddress: request.headers.get('x-forwarded-for') || '',
      createdAt: new Date(),
    });

    return NextResponse.json({ retailer });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminPayload = await requireAdmin(request);
    const { id } = await params;
    const hard = new URL(request.url).searchParams.get('hard') === 'true';

    // Hard delete requires superadmin
    if (hard) requireSuperAdmin(adminPayload);

    const before = await getRetailerById(id);
    if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (hard) {
      // Cascade: delete submission, draft, then retailer
      const subSnap = await db.collection('submissions').where('retailerId', '==', id).get();
      const batch = db.batch();
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(db.collection('drafts').doc(id));
      batch.delete(db.collection('retailers').doc(id));
      await batch.commit();

      await db.collection('auditLogs').add({
        adminId: adminPayload.adminId,
        adminEmail: adminPayload.email,
        action: 'HARD_DELETE_RETAILER',
        entityType: 'Retailer',
        entityId: id,
        beforeValue: JSON.stringify(before),
        ipAddress: request.headers.get('x-forwarded-for') || '',
        createdAt: new Date(),
      });

      return NextResponse.json({ success: true, deleted: true });
    } else {
      await db.collection('retailers').doc(id).update({ status: 'deleted', updatedAt: new Date() });
      const retailer = await getRetailerById(id);

      await db.collection('auditLogs').add({
        adminId: adminPayload.adminId,
        adminEmail: adminPayload.email,
        action: 'DELETE_RETAILER',
        entityType: 'Retailer',
        entityId: id,
        afterValue: JSON.stringify({ status: 'deleted' }),
        ipAddress: request.headers.get('x-forwarded-for') || '',
        createdAt: new Date(),
      });

      return NextResponse.json({ success: true, retailer });
    }
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
