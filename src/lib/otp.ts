export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(mobile: string, otp: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    console.log(`[DEV OTP] Mobile: ${mobile} | OTP: ${otp}`);
    return;
  }

  try {
    const response = await fetch('https://api.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: `91${mobile}`,
        otp,
      }),
    });
    const data = await response.json();
    console.log('[MSG91 OTP]', data);
  } catch (err) {
    console.error('[MSG91 OTP Error]', err);
  }
}

export async function sendWhatsappConfirmation(
  mobile: string,
  name: string,
  giftName: string,
): Promise<void> {
  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_WHATSAPP_TEMPLATE) {
    console.log(
      `[DEV WhatsApp] Mobile: ${mobile} | Name: ${name} | Gift: ${giftName}`
    );
    return;
  }

  try {
    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        integrated_number: '91' + mobile,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: process.env.MSG91_WHATSAPP_TEMPLATE,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: name },    // {{1}} — recipient name
                  { type: 'text', text: giftName }, // {{2}} — gift selected
                ],
              },
            ],
          },
        },
      }),
    });
    const data = await response.json();
    console.log('[MSG91 WhatsApp]', data);
  } catch (err) {
    console.error('[MSG91 WhatsApp Error]', err);
  }
}
