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
  'retailer code': 'retailerId',
  'party code': 'retailerId',
  'party id': 'retailerId',
  'dealer code': 'retailerId',
  'dealer id': 'retailerId',
  'customer code': 'retailerId',
  'customer id': 'retailerId',
  'outlet code': 'retailerId',
  'outlet id': 'retailerId',
  'shop code': 'retailerId',
  'code': 'retailerId',
  'sr no': 'retailerId',
  'sr. no': 'retailerId',
  'sr.no': 'retailerId',
  'serial no': 'retailerId',
  'serial number': 'retailerId',
  's.no': 'retailerId',
  'sno': 'retailerId',

  // Retailer Name
  'retailer name': 'name',
  'retailername': 'name',
  'name': 'name',
  'store name': 'name',
  'shop name': 'name',
  'outlet name': 'name',
  'firm name': 'name',
  'business name': 'name',
  'party name': 'name',
  'dealer name': 'name',
  'customer name': 'name',

  // Owner Name
  'owner name': 'ownerName',
  'ownername': 'ownerName',
  'owner': 'ownerName',
  'proprietor': 'ownerName',
  'contact person': 'ownerName',
  'contact name': 'ownerName',

  // Phone / Mobile
  'phone number': 'mobile',
  'phonenumber': 'mobile',
  'phone': 'mobile',
  'mobile': 'mobile',
  'mobile number': 'mobile',
  'mobile no': 'mobile',
  'phone no': 'mobile',
  'contact no': 'mobile',
  'contact number': 'mobile',
  'whatsapp': 'mobile',
  'whatsapp no': 'mobile',
  'whatsapp number': 'mobile',
  'mob': 'mobile',
  'mob no': 'mobile',

  // Address
  'address line 1': 'addressLine1',
  'addressline1': 'addressLine1',
  'address1': 'addressLine1',
  'address': 'addressLine1',
  'address line 2': 'addressLine2',
  'addressline2': 'addressLine2',
  'address2': 'addressLine2',
  'address 1': 'addressLine1',
  'address 2': 'addressLine2',

  // Location
  'state': 'state',
  'city': 'city',
  'town': 'city',
  'district': 'city',
  'area': 'city',
  'pin code': 'pincode',
  'pincode': 'pincode',
  'pin': 'pincode',
  'postal code': 'pincode',
  'zip': 'pincode',
  'zip code': 'pincode',
  'pin no': 'pincode',
  'landmark': 'landmark',
  'beat': 'landmark',
  'beat name': 'landmark',
  'route': 'landmark',
  'zone': 'landmark',
  'territory': 'landmark',

  // CSO / Sales Executive
  'cso': 'cso',
  'cso name': 'cso',
  'cse': 'cso',
  'cse name': 'cso',
  'tse': 'cso',
  'tse name': 'cso',
  'ase': 'cso',
  'ase name': 'cso',
  'se': 'cso',
  'se name': 'cso',
  'sales executive': 'cso',
  'sales person': 'cso',
  'salesman': 'cso',
  'salesman name': 'cso',
  'executive': 'cso',
  'executive name': 'cso',
  'cso phone number': 'csoPhone',
  'cso phone': 'csoPhone',
  'csophone': 'csoPhone',
  'cse phone': 'csoPhone',
  'tse phone': 'csoPhone',
  'executive phone': 'csoPhone',
  'executive mobile': 'csoPhone',

  // Slab
  'slab winner': 'slabId',
  'slab': 'slabId',
  'slabid': 'slabId',
  'tier': 'slabId',
  'gift slab': 'slabId',
  'gift tier': 'slabId',
  'scheme': 'slabId',
  'category': 'slabId',
  'class': 'slabId',
  'segment': 'slabId',
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

/** Returns columns present in the file that could not be mapped to any known key */
function findUnrecognisedColumns(rawRows: Record<string, unknown>[]): string[] {
  if (rawRows.length === 0) return [];
  const seen = new Set<string>();
  for (const row of rawRows) {
    for (const key of Object.keys(row)) {
      seen.add(key.trim());
    }
  }
  return Array.from(seen).filter((k) => !COL[k.toLowerCase()]);
}

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
      if (!/^\d{10}$/.test(row.mobile)) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: `Invalid phone number "${row.mobile}" — must be exactly 10 digits` });
        continue;
      }
      if (!row.pincode) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Pin Code' });
        continue;
      }
      if (!/^\d{6}$/.test(row.pincode)) {
        failed++;
        rowResults.push({ row: rowNum, status: 'Failed', remark: `Invalid pin code "${row.pincode}" — must be exactly 6 digits` });
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

    return NextResponse.json({ imported, skipped, failed, rowResults, unrecognisedColumns, detectedColumns });
  } catch (err) {
    console.error('[admin/retailers/bulk]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
