import { NextRequest, NextResponse } from 'next/server';
import { verifyRetailerToken } from '@/lib/auth';
import {
  getRetailerById,
  getSubmissionByRetailerId,
  getDraftByRetailerId,
  getSlabById,
} from '@/lib/firestore';

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

    const [submission, draft, slab] = await Promise.all([
      getSubmissionByRetailerId(retailer.id),
      getDraftByRetailerId(retailer.id),
      getSlabById(retailer.slabId),
    ]);

    return NextResponse.json({
      retailer: {
        ...retailer,
        slab,
        submission,
        draft,
      },
    });
  } catch (err) {
    console.error('[retailer/me]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
