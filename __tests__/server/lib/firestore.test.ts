/**
 * TDD tests for src/lib/firestore.ts
 *
 * Covers the typed helper functions used by all API routes:
 *   getRetailerByMobile, getRetailerById,
 *   getGiftsForSlab, getOrCreateDraft,
 *   getSubmissionByRetailerId
 */
import { jest } from '@jest/globals';

// ── Firestore mock ─────────────────────────────────────────────────────────────
const mockDocGet    = jest.fn<() => Promise<unknown>>();
const mockDocSet    = jest.fn<() => Promise<unknown>>();
const mockDocUpdate = jest.fn<() => Promise<unknown>>();
const mockQueryGet  = jest.fn<() => Promise<unknown>>();
const mockWhere     = jest.fn();
const mockOrderBy   = jest.fn();
const mockDocFn     = jest.fn<() => unknown>();

mockWhere.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy, get: mockQueryGet });
mockOrderBy.mockReturnValue({ get: mockQueryGet });
mockDocFn.mockReturnValue({ get: mockDocGet, set: mockDocSet, update: mockDocUpdate });

await jest.unstable_mockModule('@/lib/firebase-admin', () => ({
  db: {
    collection: jest.fn(() => ({
      where:  mockWhere,
      doc:    mockDocFn,
      orderBy: mockOrderBy,
    })),
  },
}));

const {
  getRetailerByMobile,
  getRetailerById,
  getGiftsForSlab,
  getOrCreateDraft,
  getSubmissionByRetailerId,
} = await import('@/lib/firestore');

// ── Fixtures ──────────────────────────────────────────────────────────────────
function querySnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { empty: docs.length === 0, docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}
function docSnap(id: string, data: Record<string, unknown> | null) {
  return { exists: data !== null, id, data: () => data ?? undefined };
}

const retailerData = {
  retailerId: 'R001', name: 'Star Ice Cream', ownerName: 'Raj',
  mobile: '9999900001', slabId: 'slab-1', slabName: '2K', status: 'active',
};

beforeEach(() => jest.clearAllMocks());

// ── getRetailerByMobile ───────────────────────────────────────────────────────

describe('getRetailerByMobile', () => {
  it('returns retailer when found', async () => {
    mockQueryGet.mockResolvedValue(querySnap([{ id: 'ret-1', data: retailerData }]));
    const result = await getRetailerByMobile('9999900001');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ret-1');
    expect(result!.mobile).toBe('9999900001');
  });

  it('returns null when mobile not found', async () => {
    mockQueryGet.mockResolvedValue(querySnap([]));
    const result = await getRetailerByMobile('0000000000');
    expect(result).toBeNull();
  });
});

// ── getRetailerById ───────────────────────────────────────────────────────────

describe('getRetailerById', () => {
  it('returns retailer when doc exists', async () => {
    mockDocGet.mockResolvedValue(docSnap('ret-1', retailerData));
    const result = await getRetailerById('ret-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ret-1');
  });

  it('returns null when doc does not exist', async () => {
    mockDocGet.mockResolvedValue(docSnap('ret-1', null));
    const result = await getRetailerById('ret-1');
    expect(result).toBeNull();
  });
});

// ── getGiftsForSlab ───────────────────────────────────────────────────────────

describe('getGiftsForSlab', () => {
  it('returns gifts sorted by displaySequence', async () => {
    // First call: giftSlabMappings query
    mockQueryGet.mockResolvedValueOnce(querySnap([
      { id: 'm1', data: { giftId: 'g1', slabId: 'slab-1', displaySequence: 0 } },
      { id: 'm2', data: { giftId: 'g2', slabId: 'slab-1', displaySequence: 1 } },
    ]));
    // Second call: gift doc reads (via getAll or individual gets)
    mockDocGet
      .mockResolvedValueOnce(docSnap('g1', { name: 'Speaker', description: 'desc', status: 'active' }))
      .mockResolvedValueOnce(docSnap('g2', { name: 'Kettle', description: 'desc', status: 'active' }));

    const gifts = await getGiftsForSlab('slab-1');
    expect(gifts).toHaveLength(2);
    expect(gifts[0].id).toBe('g1');
    expect(gifts[1].id).toBe('g2');
  });

  it('returns empty array when no mappings exist', async () => {
    mockQueryGet.mockResolvedValue(querySnap([]));
    const gifts = await getGiftsForSlab('slab-99');
    expect(gifts).toEqual([]);
  });
});

// ── getOrCreateDraft ──────────────────────────────────────────────────────────

describe('getOrCreateDraft', () => {
  it('returns existing draft when doc exists', async () => {
    mockDocGet.mockResolvedValue(docSnap('ret-1', {
      retailerId: 'ret-1', step: 'gift', giftId: null,
      giftConfirmed: false, formData: null,
    }));
    const draft = await getOrCreateDraft('ret-1');
    expect(draft.retailerId).toBe('ret-1');
    expect(draft.step).toBe('gift');
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('creates and returns default draft when none exists', async () => {
    mockDocGet.mockResolvedValue(docSnap('ret-1', null));
    mockDocSet.mockResolvedValue(undefined);
    const draft = await getOrCreateDraft('ret-1');
    expect(mockDocSet).toHaveBeenCalledWith(expect.objectContaining({
      retailerId: 'ret-1',
      step: 'gift',
      giftConfirmed: false,
    }), { merge: true });
    expect(draft.step).toBe('gift');
  });
});

// ── getSubmissionByRetailerId ─────────────────────────────────────────────────

describe('getSubmissionByRetailerId', () => {
  it('returns submission when found', async () => {
    mockQueryGet.mockResolvedValue(querySnap([
      { id: 'sub-1', data: { retailerId: 'ret-1', referenceId: 'KW-2025-00001' } },
    ]));
    const result = await getSubmissionByRetailerId('ret-1');
    expect(result).not.toBeNull();
    expect(result!.referenceId).toBe('KW-2025-00001');
  });

  it('returns null when no submission exists', async () => {
    mockQueryGet.mockResolvedValue(querySnap([]));
    const result = await getSubmissionByRetailerId('ret-1');
    expect(result).toBeNull();
  });
});
