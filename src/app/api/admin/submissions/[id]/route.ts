import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken, requireSuperAdmin } from '@/lib/auth';
import { getSubmissionById } from '@/lib/firestore';

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) throw new Error('unauthorized');
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const submission = await getSubmissionById(id);
    if (!submission) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ submission });
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

    const before = await getSubmissionById(id);
    if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const body = await request.json();
    const {
      storeName,
      ownerName,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      gstNumber,
      landmark,
      alternateMobile,
      giftId,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (storeName !== undefined) updateData.storeName = storeName;
    if (ownerName !== undefined) updateData.ownerName = ownerName;
    if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
    if (landmark !== undefined) updateData.landmark = landmark;
    if (alternateMobile !== undefined) updateData.alternateMobile = alternateMobile;
    if (giftId !== undefined) {
      updateData.giftId = giftId;
      // Update denormalized gift info if giftId changed
      if (giftId !== before.giftId) {
        const giftSnap = await db.collection('gifts').doc(giftId).get();
        if (giftSnap.exists) {
          const giftData = giftSnap.data() as Record<string, unknown>;
          updateData.giftName = giftData.name as string;
          updateData.giftImageUrl = (giftData.imageUrl as string | null) ?? null;
        }
      }
    }

    await db.collection('submissions').doc(id).update(updateData);

    const submission = await getSubmissionById(id);

    await db.collection('auditLogs').add({
      adminId: adminPayload.adminId,
      adminEmail: adminPayload.email,
      action: 'UPDATE_SUBMISSION',
      entityType: 'Submission',
      entityId: id,
      beforeValue: JSON.stringify(before),
      afterValue: JSON.stringify(submission),
      ipAddress: request.headers.get('x-forwarded-for') || '',
      createdAt: new Date(),
    });

    return NextResponse.json({ submission });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    console.error('[admin/submissions PUT]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// Hard-delete a submission — superadmin only
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminPayload = await requireAdmin(request);
    requireSuperAdmin(adminPayload);
    const { id } = await params;

    const before = await getSubmissionById(id);
    if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    await db.collection('submissions').doc(id).delete();

    await db.collection('auditLogs').add({
      adminId: adminPayload.adminId,
      adminEmail: adminPayload.email,
      action: 'DELETE_SUBMISSION',
      entityType: 'Submission',
      entityId: id,
      beforeValue: JSON.stringify(before),
      ipAddress: request.headers.get('x-forwarded-for') || '',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.message === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    console.error('[admin/submissions DELETE]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
