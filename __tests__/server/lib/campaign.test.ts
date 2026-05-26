/**
 * Tests for the campaign status logic in src/lib/campaign.ts
 * Uses jest.unstable_mockModule (the ESM-compatible mock API).
 * All imports are dynamic so mocks are in place before the module loads.
 */
import { jest } from '@jest/globals';

// ── Mock prisma before any module that imports it is loaded ───────────────────
const mockFindFirst = jest.fn<() => Promise<unknown>>();
const mockCreate    = jest.fn<() => Promise<unknown>>();

await jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    campaignSetting: {
      findFirst: mockFindFirst,
      create:    mockCreate,
    },
  },
}));

// Dynamic imports AFTER mocks are registered
const { getCampaignStatus, getOrCreateCampaignSetting } =
  await import('@/lib/campaign');

// ── Shared fixture ─────────────────────────────────────────────────────────────
const baseSetting = {
  id: 'setting-1',
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
});

// ── getOrCreateCampaignSetting ─────────────────────────────────────────────────

describe('getOrCreateCampaignSetting', () => {
  it('returns existing setting if found', async () => {
    mockFindFirst.mockResolvedValue(baseSetting);
    const result = await getOrCreateCampaignSetting();
    expect(result).toEqual(baseSetting);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a default setting when none exists', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ ...baseSetting, id: 'new-setting' });
    const result = await getOrCreateCampaignSetting();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect((result as typeof baseSetting).id).toBe('new-setting');
  });
});

// ── getCampaignStatus — forceStatus overrides ──────────────────────────────────

describe('getCampaignStatus — forceStatus', () => {
  it('returns active when forceStatus is active', async () => {
    mockFindFirst.mockResolvedValue({ ...baseSetting, forceStatus: 'active' });
    const { status } = await getCampaignStatus();
    expect(status).toBe('active');
  });

  it('returns before when forceStatus is before', async () => {
    mockFindFirst.mockResolvedValue({ ...baseSetting, forceStatus: 'before' });
    const { status } = await getCampaignStatus();
    expect(status).toBe('before');
  });

  it('returns closed when forceStatus is closed', async () => {
    mockFindFirst.mockResolvedValue({ ...baseSetting, forceStatus: 'closed' });
    const { status } = await getCampaignStatus();
    expect(status).toBe('closed');
  });
});

// ── getCampaignStatus — date-based logic ──────────────────────────────────────

describe('getCampaignStatus — date logic (no forceStatus)', () => {
  it('returns before when campaign has not started yet', async () => {
    const future = new Date(Date.now() + 86400000 * 7);
    mockFindFirst.mockResolvedValue({ ...baseSetting, startDate: future });
    const { status } = await getCampaignStatus();
    expect(status).toBe('before');
  });

  it('returns closed when campaign has ended', async () => {
    const past = new Date(Date.now() - 86400000 * 7);
    mockFindFirst.mockResolvedValue({ ...baseSetting, endDate: past });
    const { status } = await getCampaignStatus();
    expect(status).toBe('closed');
  });

  it('returns active when within campaign window', async () => {
    mockFindFirst.mockResolvedValue({
      ...baseSetting,
      startDate: new Date(Date.now() - 86400000),  // started yesterday
      endDate:   new Date(Date.now() + 86400000),  // ends tomorrow
    });
    const { status } = await getCampaignStatus();
    expect(status).toBe('active');
  });

  it('returns active when no dates are set', async () => {
    mockFindFirst.mockResolvedValue(baseSetting);
    const { status } = await getCampaignStatus();
    expect(status).toBe('active');
  });
});
