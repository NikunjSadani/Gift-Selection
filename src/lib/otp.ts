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

/**
 * Sends a WhatsApp confirmation message via MSG91.
 * Returns true if MSG91 accepted the message, false otherwise.
 */
export async function sendWhatsappConfirmation(
  mobile: string,
  name: string,
  giftName: string,
): Promise<boolean> {
  const authKey          = process.env.MSG91_AUTH_KEY?.trim();
  const templateName     = process.env.MSG91_WHATSAPP_TEMPLATE?.trim();
  const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER?.trim();

  if (!authKey || !templateName || !integratedNumber) {
    console.log(
      `[DEV WhatsApp] Mobile: ${mobile} | Name: ${name} | Gift: ${giftName}` +
      (!authKey ? ' | MISSING: MSG91_AUTH_KEY' : '') +
      (!templateName ? ' | MISSING: MSG91_WHATSAPP_TEMPLATE' : '') +
      (!integratedNumber ? ' | MISSING: MSG91_WHATSAPP_INTEGRATED_NUMBER' : '')
    );
    return false;
  }

  const recipient = mobile.startsWith('91') ? mobile : `91${mobile}`;

  const requestBody = {
    integrated_number: integratedNumber,  // business sender number registered in MSG91
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: recipient,                       // recipient's WhatsApp number
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: name },     // {{1}} — recipient name / store name
              { type: 'text', text: giftName }, // {{2}} — gift selected
            ],
          },
        ],
      },
    },
  };

  try {
    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
    console.log('[MSG91 WhatsApp]', JSON.stringify(data));

    // MSG91 returns { status: 'success', hasError: false } on acceptance
    const success = response.ok && data?.status === 'success';
    if (!success) {
      console.error('[MSG91 WhatsApp] Rejected:', JSON.stringify(data));
    }
    return success;
  } catch (err) {
    console.error('[MSG91 WhatsApp Error]', err);
    return false;
  }
}
