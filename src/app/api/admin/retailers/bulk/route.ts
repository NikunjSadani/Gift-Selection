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
  type ExistingRetailer,
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

    // ── Pre-flight: fetch the current DB state of every retailer in the file ──
    const retailerIdsInFile = new Set(normalisedRows.map((r) => r.retailerId).filter(Boolean));
    const existingByRetailerId = new Map<string, ExistingRetailer>();

    if (retailerIdsInFile.size > 0) {
      const retailersSnap = await db.collection('retailers').get();
      for (const doc of retailersSnap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const rid = data.retailerId as string;
        if (retailerIdsInFile.has(rid)) {
          existingByRetailerId.set(rid, {
            docId:        doc.id,
            retailerId:   rid,
            name:         (data.name as string) ?? '',
            ownerName:    (data.ownerName ?? null) as string | null,
            mobile:       (data.mobile as string) ?? '',
            slabId:       (data.slabId as string) ?? '',
            addressLine1: (data.addressLine1 ?? null) as string | null,
            addressLine2: (data.addressLine2 ?? null) as string | null,
            city:         (data.city ?? null) as string | null,
            state:        (data.state ?? null) as string | null,
            pincode:      (data.pincode ?? null) as string | null,
            landmark:     (data.landmark ?? null) as string | null,
            cso:          (data.cso ?? null) as string | null,
            csoPhone:     (data.csoPhone ?? null) as string | null,
          });
        }
      }
    }

    // ── Plan: decide per-row status + which docs to create/update (pure) ──
    const { rowResults, creates, updates } = planBulkImport(normalisedRows, existingByRetailerId, allSlabs);

    // Index rowResults by rowNum so a failed batch can flip the right rows.
    const resultByRowNum = new Map<number, RowResult>();
    for (const r of rowResults) resultByRowNum.set(r.row, r);

    // ── Batched writes: unify inserts + updates, chunk by 450, commit each ──
    const now = new Date();
    const ops = [
      ...creates.map((c) => ({
        rowNum: c.rowNum,
        ref: db.collection('retailers').doc(),
        data: { ...c.data, createdAt: now, updatedAt: now },
        kind: 'set' as const,
      })),
      ...updates.map((u) => ({
        rowNum: u.rowNum,
        ref: db.collection('retailers').doc(u.docId),
        data: { ...u.data, updatedAt: now },
        kind: 'update' as const,
      })),
    ];

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const chunk = ops.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const op of chunk) {
        if (op.kind === 'set') batch.set(op.ref, op.data);
        else batch.update(op.ref, op.data);
      }
      try {
        await batch.commit();
      } catch (err) {
        // The whole chunk failed to persist — mark every written row in it Failed.
        const message = (err as Error).message;
        for (const op of chunk) {
          const rr = resultByRowNum.get(op.rowNum);
          if (rr && (rr.status === 'Imported' || rr.status === 'Updated')) {
            rr.status = 'Failed';
            rr.remark = `Write failed: ${message}`;
          }
        }
      }
    }

    // Counts derived from the FINAL rowResults so they always match the report.
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    for (const r of rowResults) {
      if (r.status === 'Imported') imported++;
      else if (r.status === 'Updated') updated++;
      else if (r.status === 'Skipped') skipped++;
      else failed++;
    }

    return NextResponse.json({ imported, updated, skipped, failed, rowResults, unrecognisedColumns, detectedColumns });
  } catch (err) {
    console.error('[admin/retailers/bulk]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
