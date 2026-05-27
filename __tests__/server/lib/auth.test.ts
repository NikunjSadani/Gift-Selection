/**
 * Tests for src/lib/auth.ts
 * Covers: token signing, token verification, requireSuperAdmin guard
 */
import {
  signRetailerToken,
  verifyRetailerToken,
  signAdminToken,
  verifyAdminToken,
  requireSuperAdmin,
  type AdminTokenPayload,
} from '@/lib/auth';

// ── Retailer tokens ────────────────────────────────────────────────────────────

describe('Retailer tokens', () => {
  it('signs and verifies a retailer token', async () => {
    const token = await signRetailerToken('ret-001', '9876543210');
    const payload = await verifyRetailerToken(token);

    expect(payload.retailerId).toBe('ret-001');
    expect(payload.mobile).toBe('9876543210');
  });

  it('throws on a tampered retailer token', async () => {
    const token = await signRetailerToken('ret-001', '9876543210');
    const tampered = token.slice(0, -5) + 'XXXXX';

    await expect(verifyRetailerToken(tampered)).rejects.toThrow();
  });

  it('throws on an empty string', async () => {
    await expect(verifyRetailerToken('')).rejects.toThrow();
  });
});

// ── Admin tokens ───────────────────────────────────────────────────────────────

describe('Admin tokens', () => {
  it('signs and verifies an admin token with default role', async () => {
    const token = await signAdminToken('adm-001', 'admin@kwalitywalls.com');
    const payload = await verifyAdminToken(token);

    expect(payload.adminId).toBe('adm-001');
    expect(payload.email).toBe('admin@kwalitywalls.com');
    expect(payload.role).toBe('admin');
  });

  it('signs and verifies a superadmin token', async () => {
    const token = await signAdminToken('adm-002', 'admin@gifsy.in', 'superadmin');
    const payload = await verifyAdminToken(token);

    expect(payload.role).toBe('superadmin');
  });

  it('throws on a tampered admin token', async () => {
    const token = await signAdminToken('adm-001', 'admin@kwalitywalls.com');
    const tampered = token.slice(0, -5) + 'XXXXX';

    await expect(verifyAdminToken(tampered)).rejects.toThrow();
  });

  it('retailer token cannot be used as admin token (different secrets)', async () => {
    const retailerToken = await signRetailerToken('ret-001', '9876543210');
    await expect(verifyAdminToken(retailerToken)).rejects.toThrow();
  });
});

// ── requireSuperAdmin guard ────────────────────────────────────────────────────

describe('requireSuperAdmin', () => {
  it('passes silently for superadmin role', () => {
    const payload: AdminTokenPayload = {
      adminId: 'adm-002',
      email: 'admin@gifsy.in',
      role: 'superadmin',
    };
    expect(() => requireSuperAdmin(payload)).not.toThrow();
  });

  it('throws 403 for admin role', () => {
    const payload: AdminTokenPayload = {
      adminId: 'adm-001',
      email: 'admin@kwalitywalls.com',
      role: 'admin',
    };
    expect(() => requireSuperAdmin(payload)).toThrow('forbidden');
    try {
      requireSuperAdmin(payload);
    } catch (e) {
      expect((e as { status: number }).status).toBe(403);
    }
  });

  it('throws 403 for any unrecognised role', () => {
    const payload: AdminTokenPayload = {
      adminId: 'adm-003',
      email: 'unknown@example.com',
      role: 'viewer',
    };
    expect(() => requireSuperAdmin(payload)).toThrow('forbidden');
  });
});
