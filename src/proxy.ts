import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'kwality-walls-super-secret-jwt-key-change-in-production'
);

const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'kwality-walls-admin-secret-key-change-in-production'
);

const RETAILER_PROTECTED = ['/gift', '/details', '/upload', '/review', '/confirmation'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes (except login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    try {
      await jwtVerify(token, ADMIN_JWT_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Retailer protected routes
  const isRetailerProtected = RETAILER_PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isRetailerProtected) {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/gift', '/details', '/upload', '/review', '/confirmation', '/admin/:path*'],
};
