import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

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

    const storeName = name ?? 'Test Store';
    const giftName  = gift ?? 'Test Gift';
    const headers   = { 'Content-Type': 'application/json', authkey: authKey };

    // Strip and rebuild number variants
    const mobileOnly   = mobile.replace(/^91/, '');           // 10-digit
    const with91       = `91${mobileOnly}`;                    // 12-digit
    const intNumOnly   = integratedNumber.replace(/^91/, ''); // sender without 91

    const components = [{ type: 'body', parameters: [{ type: 'text', text: storeName }, { type: 'text', text: giftName }] }];

    const URL_BULK = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
    const URL_SINGLE = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';

    type Variant = { label: string; url: string; body: unknown };
    const variants: Variant[] = [
      // F — array body (true "bulk" format)
      { label: 'F-array-body', url: URL_BULK, body: [{ integrated_number: integratedNumber, content_type: 'template', payload: { messaging_product: 'whatsapp', to: with91, type: 'template', template: { name: templateName, language: { code: 'en' }, components } } }] },
      // G — sender without 91
      { label: 'G-sender-no91', url: URL_BULK, body: { integrated_number: intNumOnly, content_type: 'template', payload: { messaging_product: 'whatsapp', to: with91, type: 'template', template: { name: templateName, language: { code: 'en' }, components } } } },
      // H — recipient without 91
      { label: 'H-recipient-no91', url: URL_BULK, body: { integrated_number: integratedNumber, content_type: 'template', payload: { messaging_product: 'whatsapp', to: mobileOnly, type: 'template', template: { name: templateName, language: { code: 'en' }, components } } } },
      // I — single message endpoint
      { label: 'I-single-endpoint', url: URL_SINGLE, body: { integrated_number: integratedNumber, content_type: 'template', payload: { messaging_product: 'whatsapp', to: with91, type: 'template', template: { name: templateName, language: { code: 'en' }, components } } } },
      // J — flat structure, no nested payload
      { label: 'J-flat', url: URL_BULK, body: { integrated_number: integratedNumber, to: with91, content_type: 'template', messaging_product: 'whatsapp', type: 'template', template: { name: templateName, language: { code: 'en' }, components } } },
    ];

    const results = [];
    for (const v of variants) {
      const res  = await fetch(v.url, { method: 'POST', headers, body: JSON.stringify(v.body) });
      const body = await res.json();
      results.push({ variant: v.label, url: v.url, httpStatus: res.status, response: body });
      if (res.ok && (body as Record<string,unknown>).type === 'success') break;
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
