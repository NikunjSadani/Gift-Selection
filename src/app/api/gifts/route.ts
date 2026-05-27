import { NextRequest, NextResponse } from 'next/server';
import { verifyRetailerToken } from '@/lib/auth';
import { getRetailerById, getGiftsForSlab } from '@/lib/firestore';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifyRetailerToken(token);
    const retailer = await getRetailerById(payload.retailerId);

    if (!retailer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const allGifts = await getGiftsForSlab(retailer.slabId);
    const gifts = allGifts.filter((g) => g.status === 'active');

    return NextResponse.json({ gifts });
  } catch (err) {
    console.error('[gifts]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
