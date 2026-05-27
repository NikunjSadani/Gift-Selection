/**
 * TDD tests for POST /api/auth/verify-otp
 */
import { jest } from '@jest/globals';

const mockFindValidOtp        = jest.fn<() => Promise<unknown>>();
const mockMarkOtpUsed         = jest.fn<() => Promise<void>>();
const mockGetRetailerByMobile = jest.fn<() => Promise<unknown>>();
const mockGetSubmissionByRetailerId = jest.fn<() => Promise<unknown>>();
const mockSignRetailerToken   = jest.fn<() => Promise<string>>();

await jest.unstable_mockModule('@/lib/otp-store', () => ({
  findValidOtp: mockFindValidOtp,
  markOtpUsed:  mockMarkOtpUsed,
}));
await jest.unstable_mockModule('@/lib/firestore', () => ({
  getRetailerByMobile:        mockGetRetailerByMobile,
  getSubmissionByRetailerId:  mockGetSubmissionByRetailerId,
}));
await jest.unstable_mockModule('@/lib/auth', () => ({
  signRetailerToken: mockSignRetailerToken,
}));

const { POST } = await import('@/app/api/auth/verify-otp/route');

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validRecord  = { id: 'rec-1', mobile: '9999900001', otp: '123456', used: false, expiresAt: new Date(Date.now() + 60000) };
const activeRetailer = { id: 'ret-1', mobile: '9999900001', status: 'active' };

beforeEach(() => {
  jest.clearAllMocks();
  mockFindValidOtp.mockResolvedValue(validRecord);
  mockMarkOtpUsed.mockResolvedValue(undefined);
  mockGetRetailerByMobile.mockResolvedValue(activeRetailer);
  mockGetSubmissionByRetailerId.mockResolvedValue(null);
  mockSignRetailerToken.mockResolvedValue('jwt-token');
});

describe('POST /api/auth/verify-otp', () => {
  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({ mobile: '9999900001' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('missing_fields');
  });

  it('returns 400 when no valid OTP found for mobile', async () => {
    mockFindValidOtp.mockResolvedValue(null);
    const res = await POST(makeRequest({ mobile: '9999900001', otp: '000000' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_otp');
  });

  it('returns 400 when OTP does not match', async () => {
    const res = await POST(makeRequest({ mobile: '9999900001', otp: '999999' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_otp');
  });

  it('marks OTP used and returns token cookie on success', async () => {
    const res = await POST(makeRequest({ mobile: '9999900001', otp: '123456' }) as never);
    expect(res.status).toBe(200);
    expect(mockMarkOtpUsed).toHaveBeenCalledWith('rec-1');
    expect(mockSignRetailerToken).toHaveBeenCalledWith('ret-1', '9999900001');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.hasSubmission).toBe(false);
  });

  it('returns hasSubmission: true when retailer already submitted', async () => {
    mockGetSubmissionByRetailerId.mockResolvedValue({ id: 'sub-1', referenceId: 'KW-2025-00001' });
    const res = await POST(makeRequest({ mobile: '9999900001', otp: '123456' }) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).hasSubmission).toBe(true);
  });

  it('returns 404 when retailer not found after OTP verification', async () => {
    mockGetRetailerByMobile.mockResolvedValue(null);
    const res = await POST(makeRequest({ mobile: '9999900001', otp: '123456' }) as never);
    expect(res.status).toBe(404);
  });
});
