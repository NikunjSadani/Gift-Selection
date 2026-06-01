import { NextRequest, NextResponse } from 'next/server';
import { verifyRetailerToken } from '@/lib/auth';
import { storage } from '@/lib/firebase-admin';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_SIZE_MB = 5;

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('retailer_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    await verifyRetailerToken(token);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'no_file' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'invalid_file_type', allowed: ALLOWED_TYPES }, { status: 400 });
    }

    const maxBytes = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'file_too_large', maxMb: MAX_SIZE_MB }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `uploads/${filename}`;

    const bucket = storage.bucket();
    const storageFile = bucket.file(storagePath);
    await storageFile.save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await storageFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
