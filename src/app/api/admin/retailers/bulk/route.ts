import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const body = await request.json();
    const rows: Record<string, string>[] = body.rows || [];

    let imported = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.retailerId || !row.name || !row.mobile || !row.slabId) {
          throw new Error('Missing required fields: retailerId, name, mobile, slabId');
        }

        const slab = await prisma.slab.findFirst({
          where: {
            OR: [
              { id: row.slabId },
              { internalCode: row.slabId },
              { name: row.slabId },
            ],
          },
        });

        if (!slab) throw new Error(`Slab not found: ${row.slabId}`);

        await prisma.retailer.upsert({
          where: { retailerId: row.retailerId },
          create: {
            retailerId: row.retailerId,
            name: row.name,
            ownerName: row.ownerName || null,
            mobile: row.mobile,
            slabId: slab.id,
            ndaCode: row.ndaCode || null,
            addressLine1: row.addressLine1 || null,
            addressLine2: row.addressLine2 || null,
            city: row.city || null,
            state: row.state || null,
            pincode: row.pincode || null,
            gstNumber: row.gstNumber || null,
          },
          update: {
            name: row.name,
            ownerName: row.ownerName || null,
            mobile: row.mobile,
            slabId: slab.id,
          },
        });

        imported++;
      } catch (err) {
        failed++;
        errors.push({ row: i + 1, error: (err as Error).message });
      }
    }

    return NextResponse.json({ imported, failed, errors });
  } catch (err) {
    console.error('[admin/retailers/bulk]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
