import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRetailerToken } from '@/lib/auth';
import { sendWhatsappConfirmation } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifyRetailerToken(token);
    const { retailerId } = payload;

    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      include: { submission: true },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (retailer.submission) {
      return NextResponse.json({ error: 'already_submitted', referenceId: retailer.submission.referenceId }, { status: 409 });
    }

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

    if (!giftId || !storeName || !ownerName || !addressLine1 || !city || !state || !pincode) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
    }

    // Generate referenceId
    const count = await prisma.submission.count();
    const year = new Date().getFullYear();
    const referenceId = `KW-${year}-${String(count + 1).padStart(5, '0')}`;

    const submission = await prisma.submission.create({
      data: {
        referenceId,
        retailerId,
        giftId,
        storeName,
        ownerName,
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
      },
      include: { gift: true },
    });

    // Delete draft
    await prisma.draft.deleteMany({ where: { retailerId } });

    // Send WhatsApp async
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    sendWhatsappConfirmation(
      retailer.mobile,
      storeName,
      submission.gift.name,
      referenceId,
      dateStr
    ).then(async () => {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { whatsappSent: true, whatsappSentAt: new Date() },
      });
    }).catch((err) => console.error('[WhatsApp send error]', err));

    return NextResponse.json({
      success: true,
      referenceId,
      submittedAt: submission.submittedAt,
    });
  } catch (err) {
    console.error('[submit]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
