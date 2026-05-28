import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'kwality-walls-super-secret-jwt-key-change-in-production'
);

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'kwality-walls-admin-secret-key-change-in-production'
);

export interface RetailerTokenPayload {
  retailerId: string;
  mobile: string;
}

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string; // "admin" | "superadmin"
}

export async function signRetailerToken(retailerId: string, mobile: string): Promise<string> {
  return await new SignJWT({ retailerId, mobile })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('150h')
    .sign(JWT_SECRET);
}

export async function verifyRetailerToken(token: string): Promise<RetailerTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as RetailerTokenPayload;
}

export async function signAdminToken(adminId: string, email: string, role: string = 'admin'): Promise<string> {
  return await new SignJWT({ adminId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(ADMIN_JWT_SECRET);
}

/** Throws if the caller is not a superadmin. Call inside API route handlers. */
export function requireSuperAdmin(payload: AdminTokenPayload): void {
  if (payload.role !== 'superadmin') {
    throw Object.assign(new Error('forbidden'), { status: 403 });
  }
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload> {
  const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET);
  return payload as unknown as AdminTokenPayload;
}
