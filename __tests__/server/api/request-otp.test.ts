/**
 * TDD tests for POST /api/auth/request-otp
 *
 * Mocks: @/lib/firebase-admin (Firestore), @/lib/campaign, @/lib/otp, @/lib/otp-store
 */
import { jest } from '@jest/globals';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetCampaignStatus  = jest.fn<() => Promise<unknown>>();
const mockGetRetailerByMobile = jest.fn<() => Promise<unknown>>();
const mockDeleteOtpsByMobile  = jest.fn<() => Promise<void>>();
const mockCreateOtpRecord     = jest.fn<() => Promise<string>>();
const mockSendOtp             = jest.fn<() => Promise<void>>();
const mockGenerateOtp         = jest.fn<() => string>();

await jest.unstable_mockModule('@/lib/campaign',   () => ({ getCampaignStatus: mockGetCampaignStatus }));
await jest.unstable_mockModule('@/lib/firestore',  () => ({ getRetailerByMobile: mockGetRetailerByMobile }));
await jest.unstable_mockModule('@/lib/otp-store',  () => ({
  deleteOtpsByMobile: mockDeleteOtpsByMobile,
  createOtpRecord:    mockCreateOtpRecord,
}));
await jest.unstable_mockModule('@/lib/otp', () => ({
  generateOtp: mockGenerateOtp,
  sendOtp:     mockSendOtp,
}));

const { POST } = await import('@/app/api/auth/request-otp/route');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const activeSetting = {
  status: 'active',
  setting: { otpExpiryMinutes: 5, otpResendSeconds: 45 },
};

const activeRetailer = {
  id: 'ret-1', mobile: '9999900001', status: 'active', name: 'Star Ice Cream',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCampaignStatus.mockResolvedValue(activeSetting);
  mockGetRetailerByMobile.mockResolvedValue(activeRetailer);
  mockDeleteOtpsByMobile.mockResolvedValue(undefined);
  mockCreateOtpRecord.mockResolvedValue('rec-1');
  mockSendOtp.mockResolvedValue(undefined);
  mockGenerateOtp.mockReturnValue('123456');
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/request-otp', () => {
  it('returns 400 for missing mobile', async () => {
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_mobile');
  });

  it('returns 400 for invalid mobile format (not 10 digits)', async () => {
    const res = await POST(makeRequest({ mobile: '12345' }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_mobile');
  });

  it('returns 403 when campaign is inactive', async () => {
    mockGetCampaignStatus.mockResolvedValue({ status: 'closed', setting: {} });
    const res = await POST(makeRequest({ mobile: '9999900001' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('campaign_inactive');
  });

  it('returns 404 when mobile not registered', async () => {
    mockGetRetailerByMobile.mockResolvedValue(null);
    const res = await POST(makeRequest({ mobile: '9999900001' }) as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_registered');
  });

  it('returns 403 when retailer is inactive', async () => {
    mockGetRetailerByMobile.mockResolvedValue({ ...activeRetailer, status: 'inactive' });
    const res = await POST(makeRequest({ mobile: '9999900001' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('inactive');
  });

  it('returns 200, deletes old OTPs, creates new OTP, and sends SMS', async () => {
    const res = await POST(makeRequest({ mobile: '9999900001' }) as never);
    expect(res.status).toBe(200);
    expect(mockDeleteOtpsByMobile).toHaveBeenCalledWith('9999900001');
    expect(mockCreateOtpRecord).toHaveBeenCalledWith('9999900001', '123456', expect.any(Date));
    expect(mockSendOtp).toHaveBeenCalledWith('9999900001', '123456');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resendAfter).toBe(45);
  });
});
