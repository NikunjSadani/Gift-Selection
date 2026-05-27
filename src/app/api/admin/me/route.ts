import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const payload = await verifyAdminToken(token);
    const snap = await db.collection('admins').doc(payload.adminId).get();

    if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const data = snap.data() as Record<string, unknown>;
    const admin = {
      id: snap.id,
      email: data.email,
      name: data.name,
      role: data.role,
    };

    return NextResponse.json({ admin });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
