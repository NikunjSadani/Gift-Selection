/**
 * Unit tests for src/lib/bulk-retailers.ts
 *
 * This module is PURE (no firebase import), so it can be imported directly —
 * no jest.unstable_mockModule needed. We still use the ESM dynamic-import style
 * for consistency with the rest of the server test suite.
 */
const { normaliseRow, planBulkImport } = await import('@/lib/bulk-retailers');

// ── Fixtures ────────────────────────────────────────────────────────────────
const allSlabs = [{ id: 's1', name: '4K', internalCode: 'SLAB_4K' }];

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

const noExisting = new Set<string>();

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
});

// ── planBulkImport ────────────────────────────────────────────────────────────
describe('planBulkImport', () => {
  it('a valid row is Imported and produces one create', () => {
    const { rowResults, creates } = planBulkImport([validRow()], noExisting, allSlabs);
    expect(rowResults).toHaveLength(1);
    expect(rowResults[0].status).toBe('Imported');
    expect(rowResults[0].row).toBe(2); // first data row = header + 1
    expect(creates).toHaveLength(1);
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

  it('id already in existingRetailerIds → Skipped "already exists"', () => {
    const { rowResults, creates } = planBulkImport(
      [validRow({ retailerId: 'DUP' })],
      new Set(['DUP']),
      allSlabs,
    );
    expect(rowResults[0].status).toBe('Skipped');
    expect(rowResults[0].remark).toBe('Retailer ID "DUP" already exists');
    expect(creates).toHaveLength(0);
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
});
