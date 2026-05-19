import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRetailerToken } from '@/lib/auth';

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

  const draft = await prisma.draft.findUnique({ where: { retailerId } });
  return NextResponse.json({ draft });
}

export async function POST(request: NextRequest) {
  const retailerId = await getRetailerId(request);
  if (!retailerId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { step, giftId, formData } = body;

    const draft = await prisma.draft.upsert({
      where: { retailerId },
      create: {
        retailerId,
        step: step || 'gift',
        giftId: giftId || null,
        formData: formData ? JSON.stringify(formData) : null,
      },
      update: {
        step: step || 'gift',
        giftId: giftId !== undefined ? giftId : undefined,
        formData: formData !== undefined ? JSON.stringify(formData) : undefined,
      },
    });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error('[draft POST]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
