import { NextResponse } from 'next/server';
import { getCampaignStatus } from '@/lib/campaign';

/**
 * GET /api/auth/campaign-status
 * Returns the current campaign status without requiring any credentials.
 * Used by the login page to show "Coming Soon" / "Program Closed" banners
 * without making a fake OTP request.
 */
export async function GET() {
  try {
    const { status } = await getCampaignStatus();
    return NextResponse.json({ status });
  } catch (err) {
    console.error('[campaign-status]', err);
    // On error, fail open — let the login page proceed normally
    return NextResponse.json({ status: 'active' });
  }
}
