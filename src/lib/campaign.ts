import { prisma } from './prisma';

export type CampaignStatus = 'active' | 'before' | 'closed';

export interface CampaignResult {
  status: CampaignStatus;
  setting: {
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
  };
}

export async function getOrCreateCampaignSetting() {
  let setting = await prisma.campaignSetting.findFirst();
  if (!setting) {
    setting = await prisma.campaignSetting.create({
      data: {
        campaignName: 'Kwality Walls Gift Program',
        supportWhatsapp: '',
        otpExpiryMinutes: 5,
        otpResendSeconds: 45,
        maxDocSizeMb: 5,
        whatsappEnabled: true,
      },
    });
  }
  return setting;
}

export async function getCampaignStatus(): Promise<CampaignResult> {
  const setting = await getOrCreateCampaignSetting();

  let status: CampaignStatus;

  if (setting.forceStatus === 'active' || setting.forceStatus === 'before' || setting.forceStatus === 'closed') {
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
