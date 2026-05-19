import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signAdminToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const token = await signAdminToken(admin.id, admin.email);

    const response = NextResponse.json({
      success: true,
      admin: { email: admin.email, name: admin.name },
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      maxAge: 8 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (err) {
    console.error('[admin/login]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
