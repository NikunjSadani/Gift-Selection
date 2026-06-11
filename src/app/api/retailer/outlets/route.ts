import { NextRequest, NextResponse } from 'next/server';
import { verifyRetailerToken } from '@/lib/auth';
import { getRetailersByMobile, getSubmissionByRetailerId } from '@/lib/firestore';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const payload = await verifyRetailerToken(token);
    const retailers = await getRetailersByMobile(payload.mobile);

    const outlets = await Promise.all(
      retailers.map(async (r) => {
        const submission = await getSubmissionByRetailerId(r.id);
        return {
          id: r.id,
          retailerId: r.retailerId,
          slabName: r.slabName,
          hasSubmission: !!submission,
          isCurrent: r.id === payload.retailerId,
        };
      }),
    );

    return NextResponse.json({ outlets });
  } catch (err) {
    console.error('[retailer/outlets]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
