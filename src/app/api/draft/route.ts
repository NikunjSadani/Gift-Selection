import { NextRequest, NextResponse } from 'next/server';
import { verifyRetailerToken } from '@/lib/auth';
import { getDraftByRetailerId } from '@/lib/firestore';
import { db } from '@/lib/firebase-admin';

async function getRetailerId(request: NextRequest) {
  const token = request.cookies.get('retailer_token')?.value;
  if (!token) return null;
  try {
    const payload = await verifyRetailerToken(token);
    return payload.retailerId;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const retailerId = await getRetailerId(request);
  if (!retailerId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const draft = await getDraftByRetailerId(retailerId);
  return NextResponse.json({ draft });
}

export async function POST(request: NextRequest) {
  const retailerId = await getRetailerId(request);
  if (!retailerId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { step, giftId, giftConfirmed, formData } = body;

    // Single read — used for both the giftSelectedAt guard and the create-vs-update check
    const docRef = db.collection('drafts').doc(retailerId);
    const existingSnap = await docRef.get();
    const existingData = existingSnap.exists
      ? (existingSnap.data() as Record<string, unknown>)
      : null;

    // giftSelectedAt is the 24-hour clock start — stamped exactly once:
    // when giftConfirmed first flips to true ("Confirm My Gift Selection" click).
    // Subsequent gift changes or saves must NOT overwrite it.
    let confirmedAt: Date | undefined;
    if (giftConfirmed === true && !existingData?.giftConfirmed && !existingData?.giftSelectedAt) {
      confirmedAt = new Date();
    }

    if (!existingSnap.exists) {
      // Create
      const createData = {
        retailerId,
        step: step || 'gift',
        giftId: giftId || null,
        giftConfirmed: giftConfirmed ?? false,
        giftSelectedAt: confirmedAt ?? null,
        formData: formData ? JSON.stringify(formData) : null,
        updatedAt: new Date(),
      };
      await docRef.set(createData, { merge: true });
      return NextResponse.json({ draft: { id: retailerId, ...createData } });
    } else {
      // Update — build patch and merge in memory to avoid a post-write read
      const updateData: Record<string, unknown> = {
        retailerId,
        step: step || 'gift',
        updatedAt: new Date(),
      };
      if (giftId !== undefined) updateData.giftId = giftId;
      if (giftConfirmed !== undefined) updateData.giftConfirmed = giftConfirmed;
      if (confirmedAt) updateData.giftSelectedAt = confirmedAt;
      if (formData !== undefined) updateData.formData = formData ? JSON.stringify(formData) : null;

      await docRef.set(updateData, { merge: true });

      // Construct response in-memory (no post-write read needed)
      const draft = { id: retailerId, ...existingData, ...updateData };
      return NextResponse.json({ draft });
    }
  } catch (err) {
    console.error('[draft POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
