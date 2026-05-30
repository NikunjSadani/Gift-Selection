import { NextResponse } from 'next/server';

// TEMPORARY DEBUG — remove after testing
export async function GET() {
  return NextResponse.json({
    MSG91_AUTH_KEY_SET: !!process.env.MSG91_AUTH_KEY,
    MSG91_AUTH_KEY_LENGTH: process.env.MSG91_AUTH_KEY?.length ?? 0,
    MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID ?? 'NOT_SET',
    NODE_ENV: process.env.NODE_ENV,
  });
}
