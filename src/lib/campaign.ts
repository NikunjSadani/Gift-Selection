import { db } from './firebase-admin';

export type CampaignStatus = 'active' | 'before' | 'closed';

export interface CampaignSetting {
  id: string;
  campaignName: string;
  startDate: Date | null;
  endDate: Date | null;
  forceStatus: string | null;
  supportWhatsapp: string;
  otpExpiryMinutes: number;
  otpResendSeconds: number;
  maxDocSizeMb: number;
  whatsappEnabled: boolean;
}

export interface CampaignResult {
  status: CampaignStatus;
  setting: CampaignSetting;
}

/** Converts a Firestore Timestamp, a plain Date, or null/undefined → Date | null */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function docToSetting(id: string, data: Record<string, unknown>): CampaignSetting {
  return {
    id,
    campaignName: (data.campaignName as string) ?? 'Kwality Walls Gift Program',
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    forceStatus: (data.forceStatus as string | null) ?? null,
    supportWhatsapp: (data.supportWhatsapp as string) ?? '',
    otpExpiryMinutes: (data.otpExpiryMinutes as number) ?? 5,
    otpResendSeconds: (data.otpResendSeconds as number) ?? 45,
    maxDocSizeMb: (data.maxDocSizeMb as number) ?? 5,
    whatsappEnabled: (data.whatsappEnabled as boolean) ?? true,
  };
}

export async function getOrCreateCampaignSetting(): Promise<CampaignSetting> {
  const docRef = db.collection('settings').doc('campaign');
  const snap = await docRef.get();

  if (snap.exists) {
    return docToSetting(snap.id, snap.data() as Record<string, unknown>);
  }

  const defaultData = {
    campaignName: 'Kwality Walls Gift Program',
    startDate: null,
    endDate: null,
    forceStatus: null,
    supportWhatsapp: '',
    otpExpiryMinutes: 5,
    otpResendSeconds: 45,
    maxDocSizeMb: 5,
    whatsappEnabled: true,
    updatedAt: new Date(),
  };

  await docRef.set(defaultData);
  return { id: 'campaign', ...defaultData };
}

export async function getCampaignStatus(): Promise<CampaignResult> {
  const setting = await getOrCreateCampaignSetting();

  let status: CampaignStatus;

  if (
    setting.forceStatus === 'active' ||
    setting.forceStatus === 'before' ||
    setting.forceStatus === 'closed'
  ) {
    status = setting.forceStatus as CampaignStatus;
  } else {
    const now = new Date();
    if (setting.startDate && now < setting.startDate) {
      status = 'before';
    } else if (setting.endDate && now > setting.endDate) {
      status = 'closed';
    } else {
      status = 'active';
    }
  }

  return { status, setting };
}
