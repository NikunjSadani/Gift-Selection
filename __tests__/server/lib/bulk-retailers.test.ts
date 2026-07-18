/**
 * Unit tests for src/lib/bulk-retailers.ts
 *
 * This module is PURE (no firebase import), so it can be imported directly —
 * no jest.unstable_mockModule needed. We still use the ESM dynamic-import style
 * for consistency with the rest of the server test suite.
 */
const { normaliseRow, planBulkImport, mapHeader } = await import('@/lib/bulk-retailers');
import type { ExistingRetailer } from '@/lib/bulk-retailers';

// ── Fixtures ────────────────────────────────────────────────────────────────
const allSlabs = [
  { id: 's1', name: '4K', internalCode: 'SLAB_4K' },
  { id: 's2', name: '8K', internalCode: 'SLAB_8K' },
];

/** A fully-valid normalised row for a fresh retailer. */
function validRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    retailerId: 'R100',
    name: 'Test Store',
    mobile: '9876543210',
    pincode: '560001',
    slabId: '4K',
    ...overrides,
  };
}

/** Builds an ExistingRetailer fixture — defaults mirror validRow() (resolved to slab s1). */
function existingRetailer(overrides: Partial<ExistingRetailer> = {}): ExistingRetailer {
  return {
    docId: 'doc1',
    retailerId: 'R100',
    name: 'Test Store',
    ownerName: null,
    mobile: '9876543210',
    slabId: 's1',
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    pincode: '560001',
    landmark: null,
    cso: null,
    csoPhone: null,
    ...overrides,
  };
}

/** Builds a Map<retailerId, ExistingRetailer> from a list of existing retailers. */
function existingMap(...list: ExistingRetailer[]): Map<string, ExistingRetailer> {
  return new Map(list.map((r) => [r.retailerId, r]));
}

const noExisting = new Map<string, ExistingRetailer>();

// ── normaliseRow ──────────────────────────────────────────────────────────────
describe('normaliseRow', () => {
  it('maps known headers to internal keys and trims/stringifies', () => {
    const out = normaliseRow({
      'Retailer ID': '  R1  ',
      'Phone Number': 9876543210, // XLSX may hand us a number
      'Slab Winner': '4K',
    });
    expect(out.retailerId).toBe('R1');
    expect(out.mobile).toBe('9876543210');
    expect(out.slabId).toBe('4K');
  });

  it('ignores unknown headers', () => {
    const out = normaliseRow({ 'Totally Unknown Column': 'x', Name: 'Shop' });
    expect(out.name).toBe('Shop');
    expect(Object.keys(out)).not.toContain('Totally Unknown Column');
  });

  it('maps space/punctuation-free headers (e.g. exported "SlabWinner", "CSOPhoneNumber")', () => {
    const out = normaliseRow({
      RetailerID: 'HUL-1',
      RetailerName: 'Esswell Chemist',
      PhoneNumber: 9769920115,
      PinCode: 400014,
      SlabWinner: '1.25L',
      CSOPhoneNumber: 9222976133,
    });
    expect(out.retailerId).toBe('HUL-1');
    expect(out.name).toBe('Esswell Chemist');
    expect(out.mobile).toBe('9769920115');
    expect(out.pincode).toBe('400014');
    expect(out.slabId).toBe('1.25L');   // the header that was breaking the whole upload
    expect(out.csoPhone).toBe('9222976133');
  });
});

// ── mapHeader ─────────────────────────────────────────────────────────────────
describe('mapHeader', () => {
  it.each([
    ['Slab Winner', 'slabId'],
    ['SlabWinner', 'slabId'],
    ['slab_winner', 'slabId'],
    ['SLABWINNER', 'slabId'],
    ['Phone Number', 'mobile'],
    ['PhoneNumber', 'mobile'],
    ['CSOPhoneNumber', 'csoPhone'],
    ['RetailerID', 'retailerId'],
  ])('%s -> %s', (header, expected) => {
    expect(mapHeader(header)).toBe(expected);
  });

  it('returns undefined for a genuinely unknown header', () => {
    expect(mapHeader('Favourite Colour')).toBeUndefined();
  });
});

// ── planBulkImport ────────────────────────────────────────────────────────────
describe('planBulkImport', () => {
  it('a valid row is Imported and produces one create', () => {
    const { rowResults, creates, updates } = planBulkImport([validRow()], noExisting, allSlabs);
    expect(rowResults).toHaveLength(1);
    expect(rowResults[0].status).toBe('Imported');
    expect(rowResults[0].row).toBe(2); // first data row = header + 1
    expect(creates).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(creates[0].data.retailerId).toBe('R100');
    expect(creates[0].data.slabId).toBe('s1'); // resolved slab id
    expect(creates[0].data.slabName).toBe('4K');
    expect(creates[0].data.status).toBe('active');
    // route stamps createdAt/updatedAt — the plan must not
    expect(creates[0].data.createdAt).toBeUndefined();
  });

  it('missing name → Failed with the exact remark', () => {
    const { rowResults, creates } = planBulkImport(
      [validRow({ name: '' })],
      noExisting,
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Failed');
    expect(rowResults[0].remark).toBe('Missing: Retailer Name');
    expect(creates).toHaveLength(0);
  });

  it('bad mobile "12345" → Failed with the invalid-phone remark', () => {
    const { rowResults } = planBulkImport(
      [validRow({ mobile: '12345' })],
      noExisting,
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Failed');
    expect(rowResults[0].remark).toBe('Invalid phone number "12345" — must be exactly 10 digits');
  });

  it('bad pincode → Failed with the invalid-pincode remark', () => {
    const { rowResults } = planBulkImport(
      [validRow({ pincode: '123' })],
      noExisting,
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Failed');
    expect(rowResults[0].remark).toBe('Invalid pin code "123" — must be exactly 6 digits');
  });

  it('id already in DB with IDENTICAL values → Skipped "No changes"', () => {
    const { rowResults, creates, updates } = planBulkImport(
      [validRow({ retailerId: 'DUP' })],
      existingMap(existingRetailer({ docId: 'dDup', retailerId: 'DUP' })),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Skipped');
    expect(rowResults[0].remark).toBe('No changes');
    expect(creates).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('two rows with the same NEW id → first Imported, second Skipped (in-file dupe), one create only', () => {
    const { rowResults, creates } = planBulkImport(
      [validRow({ retailerId: 'X1' }), validRow({ retailerId: 'X1' })],
      noExisting,
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Imported');
    expect(rowResults[1].status).toBe('Skipped');
    expect(rowResults[1].remark).toBe('Duplicate Retailer ID "X1" within file');
    expect(creates).toHaveLength(1);
    expect(creates[0].data.retailerId).toBe('X1');
  });

  it('unknown slab value → Failed with "Slab not found"', () => {
    const { rowResults, creates } = planBulkImport(
      [validRow({ slabId: 'NOPE' })],
      noExisting,
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Failed');
    expect(rowResults[0].remark).toContain('Slab not found: "NOPE"');
    expect(creates).toHaveLength(0);
  });

  it('slab matched case-insensitively by name ("4k" → "4K") → Imported', () => {
    const { rowResults, creates } = planBulkImport(
      [validRow({ slabId: '4k' })],
      noExisting,
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Imported');
    expect(creates[0].data.slabId).toBe('s1');
    expect(creates[0].data.slabName).toBe('4K');
  });

  // ── Upsert behaviour ───────────────────────────────────────────────────────
  it('(a) existing id, city differs → Updated with a diff note', () => {
    const { rowResults, creates, updates } = planBulkImport(
      [validRow({ city: 'Mumbai' })],
      existingMap(existingRetailer({ city: null })),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Updated');
    expect(creates).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].docId).toBe('doc1');
    expect(updates[0].changedFields).toContain('city');
    expect(updates[0].data.city).toBe('Mumbai');
    expect(rowResults[0].remark).toContain('city (');
    expect(rowResults[0].remark).toContain('→');
  });

  it('(b) existing id, mobile differs → Updated, phone diff note shows old→new', () => {
    const { rowResults, updates } = planBulkImport(
      [validRow({ mobile: '8887776666' })],
      existingMap(existingRetailer({ mobile: '9990001111' })),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Updated');
    expect(updates[0].changedFields).toContain('phone');
    expect(updates[0].data.mobile).toBe('8887776666');
    expect(rowResults[0].remark).toContain('phone (9990001111→8887776666)');
  });

  it('(c) existing id, file blanks an optional field → Updated, field set to null', () => {
    const { rowResults, updates } = planBulkImport(
      [validRow({ landmark: '' })],
      existingMap(existingRetailer({ landmark: 'Old Landmark' })),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Updated');
    expect(updates[0].changedFields).toContain('landmark');
    expect(updates[0].data.landmark).toBeNull();
    expect(rowResults[0].remark).toContain('landmark (Old Landmark→(blank))');
  });

  it('(d) existing id, ALL values identical → Skipped "No changes", no update', () => {
    const { rowResults, updates } = planBulkImport(
      [validRow()],
      existingMap(existingRetailer()),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Skipped');
    expect(rowResults[0].remark).toBe('No changes');
    expect(updates).toHaveLength(0);
  });

  it('(e) existing id but invalid mobile in file → Failed, no update', () => {
    const { rowResults, updates } = planBulkImport(
      [validRow({ mobile: '12345' })],
      existingMap(existingRetailer()),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Failed');
    expect(rowResults[0].remark).toBe('Invalid phone number "12345" — must be exactly 10 digits');
    expect(updates).toHaveLength(0);
  });

  it('(f) existing id appears twice (both changing) → first Updated, second Skipped in-file dup, one update', () => {
    const { rowResults, updates } = planBulkImport(
      [validRow({ city: 'Mumbai' }), validRow({ city: 'Delhi' })],
      existingMap(existingRetailer({ city: null })),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Updated');
    expect(rowResults[1].status).toBe('Skipped');
    expect(rowResults[1].remark).toBe('Duplicate Retailer ID "R100" within file');
    expect(updates).toHaveLength(1);
  });

  it('(g) slab change: existing s1, file resolves to s2 → Updated, data.slabId==="s2"', () => {
    const { rowResults, updates } = planBulkImport(
      [validRow({ slabId: '8K' })],
      existingMap(existingRetailer({ slabId: 's1' })),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Updated');
    expect(updates[0].changedFields).toContain('slab');
    expect(updates[0].data.slabId).toBe('s2');
    expect(updates[0].data.slabName).toBe('8K');
  });
});
