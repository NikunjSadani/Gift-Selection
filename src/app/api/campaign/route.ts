import { NextResponse } from 'next/server'
import { getCampaignStatus } from '@/lib/campaign'

export async function GET() {
  try {
    const { status, setting } = await getCampaignStatus()
    return NextResponse.json({ status, supportWhatsapp: setting.supportWhatsapp })
  } catch {
    return NextResponse.json({ status: 'active', supportWhatsapp: '' })
  }
}
