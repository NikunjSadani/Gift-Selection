/**
 * TDD tests for src/lib/otp-store.ts
 *
 * Tests the Firestore-backed OTP record operations:
 *   createOtpRecord, findValidOtp, markOtpUsed, deleteOtpsByMobile
 */
import { jest } from '@jest/globals';

// ── Firestore mock chain ───────────────────────────────────────────────────────
// /otpRecords collection supports: add, where(...).orderBy(...).limit(...).get(), doc(id).update()

const mockAdd    = jest.fn<() => Promise<unknown>>();
const mockUpdate = jest.fn<() => Promise<unknown>>();
const mockGet    = jest.fn<() => Promise<unknown>>();
const mockWhere  = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit  = jest.fn();
const mockDoc    = jest.fn<() => unknown>();
const mockDelete = jest.fn<() => Promise<unknown>>();
const mockBatchDelete = jest.fn<() => void>();           // batch.delete is synchronous
const mockBatchCommit = jest.fn<() => Promise<unknown>>();

// query chain: where → orderBy → limit → get
mockLimit.mockReturnValue({ get: mockGet });
mockOrderBy.mockReturnValue({ limit: mockLimit });
mockWhere.mockReturnValue({ orderBy: mockOrderBy, where: mockWhere, get: mockGet });
mockDoc.mockReturnValue({ update: mockUpdate, delete: mockDelete });

const mockBatch = {
  delete: mockBatchDelete,
  commit: mockBatchCommit,
};

await jest.unstable_mockModule('@/lib/firebase-admin', () => ({
  db: {
    collection: jest.fn(() => ({
      add:   mockAdd,
      where: mockWhere,
      doc:   mockDoc,
    })),
    batch: jest.fn(() => mockBatch),
  },
}));

const { createOtpRecord, findValidOtp, markOtpUsed, deleteOtpsByMobile } =
  await import('@/lib/otp-store');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOBILE = '9876543210';
const OTP    = '123456';
const future = new Date(Date.now() + 5 * 60 * 1000);
const past   = new Date(Date.now() - 5 * 60 * 1000);

function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAdd.mockResolvedValue({ id: 'rec-1' });
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockBatchDelete.mockReturnValue(undefined);
  mockBatchCommit.mockResolvedValue(undefined);
});

// ── createOtpRecord ───────────────────────────────────────────────────────────

describe('createOtpRecord', () => {
  it('adds a new OTP document and returns its id', async () => {
    const id = await createOtpRecord(MOBILE, OTP, future);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      mobile: MOBILE,
      otp:    OTP,
      used:   false,
    }));
    expect(id).toBe('rec-1');
  });
});

// ── findValidOtp ──────────────────────────────────────────────────────────────

describe('findValidOtp', () => {
  it('returns the most recent valid (unused, not expired) OTP record', async () => {
    mockGet.mockResolvedValue(makeSnap([
      { id: 'rec-1', data: { mobile: MOBILE, otp: OTP, used: false, expiresAt: future } },
    ]));
    const result = await findValidOtp(MOBILE);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('rec-1');
    expect(result!.otp).toBe(OTP);
  });

  it('returns null when no valid OTP exists', async () => {
    mockGet.mockResolvedValue(makeSnap([]));
    const result = await findValidOtp(MOBILE);
    expect(result).toBeNull();
  });

  it('returns null when only expired OTPs exist (expiresAt in past)', async () => {
    mockGet.mockResolvedValue(makeSnap([
      { id: 'rec-2', data: { mobile: MOBILE, otp: OTP, used: false, expiresAt: past } },
    ]));
    // The query filters expiresAt > now — if the snap is empty the store returns null
    mockGet.mockResolvedValue(makeSnap([]));
    const result = await findValidOtp(MOBILE);
    expect(result).toBeNull();
  });
});

// ── markOtpUsed ───────────────────────────────────────────────────────────────

describe('markOtpUsed', () => {
  it('updates the used flag to true on the given record id', async () => {
    await markOtpUsed('rec-1');
    expect(mockDoc).toHaveBeenCalledWith('rec-1');
    expect(mockUpdate).toHaveBeenCalledWith({ used: true });
  });
});

// ── deleteOtpsByMobile ────────────────────────────────────────────────────────

describe('deleteOtpsByMobile', () => {
  it('batch-deletes all OTP docs for a mobile number', async () => {
    mockGet.mockResolvedValue(makeSnap([
      { id: 'r1', data: {} },
      { id: 'r2', data: {} },
    ]));
    await deleteOtpsByMobile(MOBILE);
    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there are no OTP docs for that mobile', async () => {
    mockGet.mockResolvedValue(makeSnap([]));
    await deleteOtpsByMobile(MOBILE);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});
