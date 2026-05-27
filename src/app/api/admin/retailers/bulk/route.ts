import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdminToken } from '@/lib/auth';
import { getAllSlabs } from '@/lib/firestore';

// Map every accepted column header spelling to an internal key
const COL: Record<string, string> = {
  // Retailer ID
  'retailer id': 'retailerId',
  'retailerid': 'retailerId',
  'retailer_id': 'retailerId',

  // Retailer Name
  'retailer name': 'name',
  'retailername': 'name',
  'name': 'name',
  'store name': 'name',

  // Owner Name
  'owner name': 'ownerName',
  'ownername': 'ownerName',
  'owner': 'ownerName',

  // Phone / Mobile
  'phone number': 'mobile',
  'phonenumber': 'mobile',
  'phone': 'mobile',
  'mobile': 'mobile',
  'mobile number': 'mobile',

  // Address
  'address line 1': 'addressLine1',
  'addressline1': 'addressLine1',
  'address1': 'addressLine1',
  'address line 2': 'addressLine2',
  'addressline2': 'addressLine2',
  'address2': 'addressLine2',

  // Location
  'state': 'state',
  'city': 'city',
  'pin code': 'pincode',
  'pincode': 'pincode',
  'pin': 'pincode',
  'postal code': 'pincode',
  'landmark': 'landmark',

  // CSO
  'cso': 'cso',
  'cso name': 'cso',
  'cso phone number': 'csoPhone',
  'cso phone': 'csoPhone',
  'csophone': 'csoPhone',

  // Slab
  'slab winner': 'slabId',
  'slab': 'slabId',
  'slabid': 'slabId',
  'tier': 'slabId',
};

function normaliseRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = COL[key.trim().toLowerCase()];
    // Stringify everything — XLSX may parse phone/pincode as JS numbers
    if (mapped) out[mapped] = String(value ?? '').trim();
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const body = await request.json();
    const rawRows: Record<string, unknown>[] = body.rows || [];

    // Cache slabs once — avoids a DB query per row
    const allSlabs = await getAllSlabs();

    // ── Pre-flight: catch duplicate mobile numbers within the file itself ──
    const seenMobilesInFile = new Map<string, number>(); // mobile → first row number
    const fileErrors: { row: number; error: string }[] = [];

    const normalisedRows = rawRows.map((r, i) => {
      const row = normaliseRow(r);
      if (row.mobile) {
        if (seenMobilesInFile.has(row.mobile)) {
          fileErrors.push({
            row: i + 2,
            error: `Duplicate phone number ${row.mobile} — already used in row ${seenMobilesInFile.get(row.mobile)}`,
          });
        } else {
          seenMobilesInFile.set(row.mobile, i + 2);
        }
      }
      return row;
    });

    // If any in-file duplicates found, reject the whole upload immediately
    if (fileErrors.length > 0) {
      return NextResponse.json({
        imported: 0,
        failed: fileErrors.length,
        errors: fileErrors,
      });
    }

    // ── Pre-flight: fetch all existing retailer IDs and mobiles ──
    const retailerIdsInFile = normalisedRows.map((r) => r.retailerId).filter(Boolean);
    const mobilesInFile = normalisedRows.map((r) => r.mobile).filter(Boolean);

    const existingRetailerIds = new Set<string>();
    const mobileToExistingRetailerId = new Map<string, string>();

    if (retailerIdsInFile.length > 0 || mobilesInFile.length > 0) {
      const retailersSnap = await db.collection('retailers').get();
      for (const doc of retailersSnap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const rid = data.retailerId as string;
        const mob = data.mobile as string;
        if (retailerIdsInFile.includes(rid)) existingRetailerIds.add(rid);
        if (mobilesInFile.includes(mob)) mobileToExistingRetailerId.set(mob, rid);
      }
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    // Each entry carries the row number, a status, and a remark
    const rowResults: { row: number; status: 'Imported' | 'Skipped' | 'Failed'; remark: string }[] = [];

    for (let i = 0; i < normalisedRows.length; i++) {
      const row = normalisedRows[i];
      const rowNum = i + 2; // +2 = 1-based + header row

      // ── Validation errors → Failed ──────────────────────────────────────
      if (!row.retailerId) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Retailer ID' });
        continue;
      }
      if (!row.name) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Retailer Name' });
        continue;
      }
      if (!row.mobile) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Phone Number' });
        continue;
      }
      if (!row.slabId) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Slab Winner' });
        continue;
      }

      // ── Already exists → Skipped (not an error, just a duplicate) ───────
      if (existingRetailerIds.has(row.retailerId)) {
        skipped++;
        rowResults.push({ row: rowNum, status: 'Skipped', remark: `Retailer ID "${row.retailerId}" already exists` });
        continue;
      }

      // ── Mobile already registered → Failed ───────────────────────────────
      const existingOwner = mobileToExistingRetailerId.get(row.mobile);
      if (existingOwner) {
        failed++;
        rowResults.push({
          row: rowNum,
          status: 'Failed',
          remark: `Phone number ${row.mobile} is already registered to Retailer ID "${existingOwner}"`,
        });
        continue;
      }

      // ── Slab lookup ──────────────────────────────────────────────────────
      const needle = row.slabId.toLowerCase();
      const slab = allSlabs.find(
        (s) =>
          s.id.toLowerCase() === needle ||
          s.name.toLowerCase() === needle ||
          s.internalCode.toLowerCase() === needle,
      );
      if (!slab) {
        failed++;
        rowResults.push({
          row: rowNum,
          status: 'Failed',
          remark: `Slab not found: "${row.slabId}" — valid values: ${allSlabs.map((s) => s.name).join(', ')}`,
        });
        continue;
      }

      // ── Create ───────────────────────────────────────────────────────────
      try {
        const now = new Date();
        await db.collection('retailers').add({
          retailerId:   row.retailerId,
          name:         row.name,
          ownerName:    row.ownerName    || null,
          mobile:       row.mobile,
          slabId:       slab.id,
          slabName:     slab.name,
          addressLine1: row.addressLine1 || null,
          addressLine2: row.addressLine2 || null,
          city:         row.city         || null,
          state:        row.state        || null,
          pincode:      row.pincode      || null,
          landmark:     row.landmark     || null,
          cso:          row.cso          || null,
          csoPhone:     row.csoPhone     || null,
          status:       'active',
          createdAt:    now,
          updatedAt:    now,
        });
        imported++;
        rowResults.push({ row: rowNum, status: 'Imported', remark: '' });
      } catch (err) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: (err as Error).message });
      }
    }

    return NextResponse.json({ imported, skipped, failed, rowResults });
  } catch (err) {
    console.error('[admin/retailers/bulk]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
