import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

/**
 * Temporary diagnostic endpoint — tries multiple MSG91 payload formats and
 * returns responses for each so we can find which one works.
 * DELETE after fix is confirmed.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await verifyAdminToken(token);

    const { mobile, name, gift } = await request.json();
    if (!mobile) return NextResponse.json({ error: 'mobile required' }, { status: 400 });

    const authKey          = process.env.MSG91_AUTH_KEY?.trim();
    const templateName     = process.env.MSG91_WHATSAPP_TEMPLATE?.trim();
    const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER?.trim();

    if (!authKey || !templateName || !integratedNumber) {
      return NextResponse.json({ error: 'env_vars_missing' }, { status: 500 });
    }

    const recipient = mobile.startsWith('91') ? mobile : `91${mobile}`;
    const storeName = name ?? 'Test Store';
    const giftName  = gift ?? 'Test Gift';

    const headers = { 'Content-Type': 'application/json', authkey: authKey };

    const variants: Record<string, unknown>[] = [
      // Variant A — current (with messaging_product, components inside template)
      {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: storeName }, { type: 'text', text: giftName }] }],
          },
        },
      },
      // Variant B — components outside template, inside payload
      {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: { name: templateName, language: { code: 'en' } },
          components: [{ type: 'body', parameters: [{ type: 'text', text: storeName }, { type: 'text', text: giftName }] }],
        },
      },
      // Variant C — no components (minimal, to check if basic structure is accepted)
      {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: { name: templateName, language: { code: 'en' } },
        },
      },
      // Variant D — en_US language code
      {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: storeName }, { type: 'text', text: giftName }] }],
          },
        },
      },
      // Variant E — recipient without country code
      {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          to: mobile.replace(/^91/, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: storeName }, { type: 'text', text: giftName }] }],
          },
        },
      },
    ];

    const results: Record<string, unknown>[] = [];
    for (let i = 0; i < variants.length; i++) {
      const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method: 'POST',
        headers,
        body: JSON.stringify(variants[i]),
      });
      const body = await res.json();
      results.push({ variant: String.fromCharCode(65 + i), httpStatus: res.status, msg91Response: body });
      // Stop at first success
      if (res.ok && (body as Record<string, unknown>).type === 'success') break;
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
