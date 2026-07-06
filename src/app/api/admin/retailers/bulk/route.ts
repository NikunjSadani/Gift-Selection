import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';
import { getAllSlabs } from '@/lib/firestore';
import {
  COL,
  normaliseRow,
  findUnrecognisedColumns,
  planBulkImport,
  type RowResult,
} from '@/lib/bulk-retailers';

// A 3,079-row import writes in batches, but the pre-flight full-collection read
// plus the batched commits can still exceed the default function timeout on a
// cold instance — give it room.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Firestore batched writes cap at 500 operations; 450 leaves headroom.
const BATCH_SIZE = 450;

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const body = await request.json();
    const rawRows: Record<string, unknown>[] = body.rows || [];

    // Report any column headers from the file that we don't recognise
    const unrecognisedColumns = findUnrecognisedColumns(rawRows);

    // Report which internal keys were successfully mapped from the file
    const detectedColumns = rawRows.length > 0
      ? Array.from(new Set(Object.keys(rawRows[0]).map((k) => COL[k.trim().toLowerCase()]).filter(Boolean)))
      : [];

    // Cache slabs once — avoids a DB query per row
    const allSlabs = await getAllSlabs();

    const normalisedRows = rawRows.map((r) => normaliseRow(r));

    // ── Pre-flight: fetch all existing retailer IDs ──
    const retailerIdsInFile = normalisedRows.map((r) => r.retailerId).filter(Boolean);
    const existingRetailerIds = new Set<string>();

    if (retailerIdsInFile.length > 0) {
      const retailersSnap = await db.collection('retailers').get();
      for (const doc of retailersSnap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const rid = data.retailerId as string;
        if (retailerIdsInFile.includes(rid)) existingRetailerIds.add(rid);
      }
    }

    // ── Plan: decide per-row status + which docs to create (pure) ──
    const { rowResults, creates } = planBulkImport(normalisedRows, existingRetailerIds, allSlabs);

    // Index rowResults by rowNum so a failed batch can flip the right rows.
    const resultByRowNum = new Map<number, RowResult>();
    for (const r of rowResults) resultByRowNum.set(r.row, r);

    // ── Batched writes: chunk into batches of 450 and commit each ──
    const now = new Date();
    for (let i = 0; i < creates.length; i += BATCH_SIZE) {
      const chunk = creates.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const create of chunk) {
        batch.set(db.collection('retailers').doc(), {
          ...create.data,
          createdAt: now,
          updatedAt: now,
        });
      }
      try {
        await batch.commit();
      } catch (err) {
        // The whole chunk failed to persist — mark every row in it Failed.
        const message = (err as Error).message;
        for (const create of chunk) {
          const rr = resultByRowNum.get(create.rowNum);
          if (rr && rr.status === 'Imported') {
            rr.status = 'Failed';
            rr.remark = `Write failed: ${message}`;
          }
        }
      }
    }

    // Counts derived from the FINAL rowResults so they always match the report.
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    for (const r of rowResults) {
      if (r.status === 'Imported') imported++;
      else if (r.status === 'Skipped') skipped++;
      else failed++;
    }

    return NextResponse.json({ imported, skipped, failed, rowResults, unrecognisedColumns, detectedColumns });
  } catch (err) {
    console.error('[admin/retailers/bulk]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
