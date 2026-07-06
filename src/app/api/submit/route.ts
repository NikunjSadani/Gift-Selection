import { NextRequest, NextResponse } from 'next/server';
import { verifyRetailerToken } from '@/lib/auth';
import { sendWhatsappConfirmation } from '@/lib/otp';
import {
  getRetailerById,
  getSubmissionByRetailerId,
  getDraftByRetailerId,
  getGiftsForSlab,
  getNextSubmissionNumber,
} from '@/lib/firestore';
import { db } from '@/lib/firebase-admin';
import { CHANGE_WINDOW_MS } from '@/lib/gift-window';

// Change gift on an existing submission — allowed within 24h of giftConfirmedAt
export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const payload = await verifyRetailerToken(token);
    const { retailerId } = payload;

    const retailer = await getRetailerById(retailerId);
    if (!retailer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const submission = await getSubmissionByRetailerId(retailerId);
    if (!submission) {
      return NextResponse.json({ error: 'no_submission' }, { status: 404 });
    }

    // 24h window is from giftConfirmedAt (when they clicked "Confirm My Gift Selection").
    // Fall back to submittedAt if giftConfirmedAt is not set (legacy submissions).
    const clockStart = submission.giftConfirmedAt ?? submission.submittedAt;
    const msSince = Date.now() - new Date(clockStart).getTime();
    if (msSince > CHANGE_WINDOW_MS) {
      return NextResponse.json({ error: 'window_expired' }, { status: 403 });
    }

    const { giftId } = await request.json();
    if (!giftId) return NextResponse.json({ error: 'giftId_required' }, { status: 400 });

    // Validate the new gift belongs to this retailer's slab
    const slabGifts = await getGiftsForSlab(retailer.slabId);
    const validGift = slabGifts.find((g) => g.id === giftId);
    if (!validGift) {
      return NextResponse.json({ error: 'invalid_gift' }, { status: 400 });
    }

    // validGift already contains name and imageUrl from the slab validation above
    const giftName = validGift.name;
    const giftImageUrl = validGift.imageUrl;

    await db.collection('submissions').doc(submission.id).update({
      giftId,
      giftName,
      giftImageUrl,
    });

    // Send WhatsApp confirmation for the updated gift selection (async, non-blocking)
    const storeName = (submission.storeName as string) || retailer.name;
    sendWhatsappConfirmation(retailer.mobile, storeName, giftName)
      .then(async (sent) => {
        if (sent) {
          await db.collection('submissions').doc(submission.id).update({
            whatsappSent: true,
            whatsappSentAt: new Date(),
          });
        }
      })
      .catch((err) => console.error('[WhatsApp gift-change send error]', err));

    return NextResponse.json({
      success: true,
      gift: { id: giftId, name: giftName, imageUrl: giftImageUrl },
    });
  } catch (err) {
    console.error('[submit PATCH]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifyRetailerToken(token);
    const { retailerId } = payload;

    const retailer = await getRetailerById(retailerId);
    if (!retailer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const existingSubmission = await getSubmissionByRetailerId(retailerId);
    if (existingSubmission) {
      return NextResponse.json(
        { error: 'already_submitted', referenceId: existingSubmission.referenceId },
        { status: 409 },
      );
    }

    const draft = await getDraftByRetailerId(retailerId);

    const body = await request.json();
    const {
      giftId,
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
      detailsEdited,
      documentUrl,
      documentType,
    } = body;

    if (!giftId || !storeName || !addressLine1 || !city || !state || !pincode) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    // Validate the gift belongs to this retailer's slab
    const slabGifts = await getGiftsForSlab(retailer.slabId);
    const validGift = slabGifts.find((g) => g.id === giftId);
    if (!validGift) {
      return NextResponse.json({ error: 'invalid_gift' }, { status: 400 });
    }

    // validGift already contains name and imageUrl from the slab validation above
    const giftName = validGift.name;
    const giftImageUrl = validGift.imageUrl;

    // Generate referenceId using atomic counter (O(1), no race condition)
    const submissionNumber = await getNextSubmissionNumber();
    const year = new Date().getFullYear();
    const referenceId = `KW-${year}-${String(submissionNumber).padStart(5, '0')}`;

    const submittedAt = new Date();

    const submissionData = {
      referenceId,
      retailerId,
      retailerName: retailer.name,
      retailerMobile: retailer.mobile,
      slabName: retailer.slabName,
      giftId,
      giftName,
      giftImageUrl,
      storeName,
      ownerName: ownerName || null,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      state,
      pincode,
      gstNumber: gstNumber || null,
      landmark: landmark || null,
      alternateMobile: alternateMobile || null,
      detailsEdited: !!detailsEdited,
      documentUrl: documentUrl || null,
      documentType: documentType || null,
      whatsappSent: false,
      whatsappSentAt: null,
      // Carry the confirm-clock timestamp so the confirmation page can use it
      giftConfirmedAt: draft?.giftSelectedAt ?? null,
      submittedAt,
    };

    const submissionRef = await db.collection('submissions').add(submissionData);

    // Delete draft
    await db.collection('drafts').doc(retailerId).delete();

    // Send WhatsApp async — only mark sent if MSG91 actually accepted the message
    sendWhatsappConfirmation(retailer.mobile, storeName, giftName)
      .then(async (sent) => {
        if (sent) {
          await db.collection('submissions').doc(submissionRef.id).update({
            whatsappSent: true,
            whatsappSentAt: new Date(),
          });
        }
      })
      .catch((err) => console.error('[WhatsApp send error]', err));

    return NextResponse.json({
      success: true,
      referenceId,
      submittedAt,
    });
  } catch (err) {
    console.error('[submit]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
