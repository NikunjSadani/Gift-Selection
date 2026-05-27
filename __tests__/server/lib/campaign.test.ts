/**
 * TDD tests for src/lib/campaign.ts (Firestore version)
 *
 * Mocks @/lib/firebase-admin so the real Firebase SDK never initialises.
 * Firestore snapshots are simulated with plain objects:
 *   { exists: boolean, id: string, data: () => object }
 */
import { jest } from '@jest/globals';

// ── Mock firebase-admin before any import that touches it ─────────────────────
const mockGet = jest.fn<() => Promise<unknown>>();
const mockSet = jest.fn<() => Promise<unknown>>();

await jest.unstable_mockModule('@/lib/firebase-admin', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: mockGet, set: mockSet })),
    })),
  },
}));

// Dynamic imports AFTER mocks are registered
const { getCampaignStatus, getOrCreateCampaignSetting } =
  await import('@/lib/campaign');

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a Firestore-like snapshot that "exists" */
function existsSnap(data: Record<string, unknown>) {
  return { exists: true, id: 'campaign', data: () => data };
}

/** Snapshot that does not exist */
const missingSnap = { exists: false, id: 'campaign', data: () => undefined };

// ── Base setting (no dates, no forceStatus) ───────────────────────────────────
const baseData = {
  campaignName: 'Test Campaign',
  startDate: null,
  endDate: null,
  forceStatus: null,
  supportWhatsapp: '',
  otpExpiryMinutes: 5,
  otpResendSeconds: 45,
  maxDocSizeMb: 5,
  whatsappEnabled: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSet.mockResolvedValue(undefined);
});

// ── getOrCreateCampaignSetting ─────────────────────────────────────────────────

describe('getOrCreateCampaignSetting', () => {
  it('returns existing setting when document exists', async () => {
    mockGet.mockResolvedValue(existsSnap(baseData));
    const result = await getOrCreateCampaignSetting();
    expect(result.id).toBe('campaign');
    expect(result.campaignName).toBe('Test Campaign');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('creates and returns default setting when document is missing', async () => {
    mockGet.mockResolvedValue(missingSnap);
    const result = await getOrCreateCampaignSetting();
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('campaign');
    expect(result.otpExpiryMinutes).toBe(5);
  });

  it('converts Firestore Timestamp-like objects (with toDate) to Date', async () => {
    const future = new Date(Date.now() + 86400000);
    const firestoreTimestamp = { toDate: () => future };
    mockGet.mockResolvedValue(existsSnap({ ...baseData, startDate: firestoreTimestamp }));
    const result = await getOrCreateCampaignSetting();
    expect(result.startDate).toEqual(future);
  });

  it('handles plain Date objects stored in Firestore (dev/seed scenarios)', async () => {
    const future = new Date(Date.now() + 86400000);
    mockGet.mockResolvedValue(existsSnap({ ...baseData, startDate: future }));
    const result = await getOrCreateCampaignSetting();
    expect(result.startDate).toEqual(future);
  });
});

// ── getCampaignStatus — forceStatus overrides ──────────────────────────────────

describe('getCampaignStatus — forceStatus', () => {
  it('returns active when forceStatus is active', async () => {
    mockGet.mockResolvedValue(existsSnap({ ...baseData, forceStatus: 'active' }));
    const { status } = await getCampaignStatus();
    expect(status).toBe('active');
  });

  it('returns before when forceStatus is before', async () => {
    mockGet.mockResolvedValue(existsSnap({ ...baseData, forceStatus: 'before' }));
    const { status } = await getCampaignStatus();
    expect(status).toBe('before');
  });

  it('returns closed when forceStatus is closed', async () => {
    mockGet.mockResolvedValue(existsSnap({ ...baseData, forceStatus: 'closed' }));
    const { status } = await getCampaignStatus();
    expect(status).toBe('closed');
  });
});

// ── getCampaignStatus — date-based logic ──────────────────────────────────────

describe('getCampaignStatus — date logic (no forceStatus)', () => {
  it('returns before when campaign has not started yet', async () => {
    const future = new Date(Date.now() + 86400000 * 7);
    mockGet.mockResolvedValue(existsSnap({ ...baseData, startDate: future }));
    const { status } = await getCampaignStatus();
    expect(status).toBe('before');
  });

  it('returns closed when campaign has ended', async () => {
    const past = new Date(Date.now() - 86400000 * 7);
    mockGet.mockResolvedValue(existsSnap({ ...baseData, endDate: past }));
    const { status } = await getCampaignStatus();
    expect(status).toBe('closed');
  });

  it('returns active when within campaign window', async () => {
    mockGet.mockResolvedValue(existsSnap({
      ...baseData,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    }));
    const { status } = await getCampaignStatus();
    expect(status).toBe('active');
  });

  it('returns active when no dates are set', async () => {
    mockGet.mockResolvedValue(existsSnap(baseData));
    const { status } = await getCampaignStatus();
    expect(status).toBe('active');
  });
});
