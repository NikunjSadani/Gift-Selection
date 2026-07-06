/**
 * Pure, testable helpers for the admin bulk-retailer import.
 *
 * This module deliberately imports NOTHING from firebase — it is pure logic so
 * it can be unit-tested directly and reasoned about in isolation. The route
 * handler owns all Firestore I/O (the pre-flight read + batched writes) and
 * calls `planBulkImport` to decide what to write.
 */

// Map every accepted column header spelling to an internal key
export const COL: Record<string, string> = {
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

export function normaliseRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = COL[key.trim().toLowerCase()];
    // Stringify everything — XLSX may parse phone/pincode as JS numbers
    if (mapped) out[mapped] = String(value ?? '').trim();
  }
  return out;
}

/** Returns columns present in the file that could not be mapped to any known key */
export function findUnrecognisedColumns(rawRows: Record<string, unknown>[]): string[] {
  if (rawRows.length === 0) return [];
  const seen = new Set<string>();
  for (const row of rawRows) {
    for (const key of Object.keys(row)) {
      seen.add(key.trim());
    }
  }
  return Array.from(seen).filter((k) => !COL[k.toLowerCase()]);
}

// ── Planning ─────────────────────────────────────────────────────────────────

export type RowStatus = 'Imported' | 'Skipped' | 'Failed';

export interface RowResult {
  row: number;
  status: RowStatus;
  remark: string;
}

export interface PlannedCreate {
  rowNum: number;
  data: Record<string, unknown>;
}

export interface BulkPlan {
  rowResults: RowResult[];
  creates: PlannedCreate[];
}

export interface SlabRef {
  id: string;
  name: string;
  internalCode: string;
}

/**
 * Pure planning pass: decides, per row, whether it is Imported / Skipped /
 * Failed and — for the Imported rows — builds the retailer document to write.
 *
 * The route stamps `createdAt`/`updatedAt` at write time; everything else
 * (including `status: 'active'`) is decided here so the write step is trivial.
 *
 * Validation order matches the original serial loop exactly:
 *   retailerId → name → mobile → 10-digit mobile → pincode → 6-digit pincode →
 *   slabId → existing/duplicate skip → slab lookup → create.
 */
export function planBulkImport(
  normalisedRows: Record<string, string>[],
  existingRetailerIds: Set<string>,
  allSlabs: SlabRef[],
): BulkPlan {
  const rowResults: RowResult[] = [];
  const creates: PlannedCreate[] = [];

  // Guards against writing the same retailerId twice within one request.
  const seenInThisRequest = new Set<string>();

  for (let i = 0; i < normalisedRows.length; i++) {
    const row = normalisedRows[i];
    const rowNum = i + 2; // +2 = 1-based + header row

    // ── Validation errors → Failed ──────────────────────────────────────
    if (!row.retailerId) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Retailer ID' });
      continue;
    }
    if (!row.name) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Retailer Name' });
      continue;
    }
    if (!row.mobile) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Phone Number' });
      continue;
    }
    if (!/^\d{10}$/.test(row.mobile)) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: `Invalid phone number "${row.mobile}" — must be exactly 10 digits` });
      continue;
    }
    if (!row.pincode) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Pin Code' });
      continue;
    }
    if (!/^\d{6}$/.test(row.pincode)) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: `Invalid pin code "${row.pincode}" — must be exactly 6 digits` });
      continue;
    }
    if (!row.slabId) {
      rowResults.push({ row: rowNum, status: 'Failed', remark: 'Missing: Slab Winner' });
      continue;
    }

    // ── Already exists in DB → Skipped ──────────────────────────────────
    if (existingRetailerIds.has(row.retailerId)) {
      rowResults.push({ row: rowNum, status: 'Skipped', remark: `Retailer ID "${row.retailerId}" already exists` });
      continue;
    }

    // ── Duplicate within this same file → Skipped (bug fix) ─────────────
    if (seenInThisRequest.has(row.retailerId)) {
      rowResults.push({ row: rowNum, status: 'Skipped', remark: `Duplicate Retailer ID "${row.retailerId}" within file` });
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
      rowResults.push({
        row: rowNum,
        status: 'Failed',
        remark: `Slab not found: "${row.slabId}" — valid values: ${allSlabs.map((s) => s.name).join(', ')}`,
      });
      continue;
    }

    // ── Plan the create ──────────────────────────────────────────────────
    seenInThisRequest.add(row.retailerId);
    creates.push({
      rowNum,
      data: {
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
      },
    });
    rowResults.push({ row: rowNum, status: 'Imported', remark: '' });
  }

  return { rowResults, creates };
}
