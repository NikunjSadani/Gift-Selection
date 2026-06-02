import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

/**
 * Temporary diagnostic endpoint — fires a live WhatsApp test message and
 * returns the raw MSG91 response so we can see exactly what is failing.
 *
 * DELETE THIS FILE once WhatsApp is confirmed working.
 *
 * Usage (curl):
 *   curl -X POST https://<host>/api/admin/test-whatsapp \
 *     -H 'Content-Type: application/json' \
 *     -b 'admin_token=<token>' \
 *     -d '{"mobile":"9999900001","name":"Test Store","gift":"Test Gift"}'
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

    const envCheck = {
      MSG91_AUTH_KEY:                  authKey          ? `SET (len=${authKey.length})`          : 'MISSING ❌',
      MSG91_WHATSAPP_TEMPLATE:          templateName     ? `SET (${templateName})`                 : 'MISSING ❌',
      MSG91_WHATSAPP_INTEGRATED_NUMBER: integratedNumber ? `SET (${integratedNumber})`             : 'MISSING ❌',
    };

    if (!authKey || !templateName || !integratedNumber) {
      return NextResponse.json({ error: 'env_vars_missing', envCheck }, { status: 500 });
    }

    const recipient = mobile.startsWith('91') ? mobile : `91${mobile}`;

    const requestBody = {
      integrated_number: integratedNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: name   ?? 'Test Store' },
                { type: 'text', text: gift   ?? 'Test Gift'  },
              ],
            },
          ],
        },
      },
    };

    const msg91Res = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: authKey },
        body: JSON.stringify(requestBody),
      },
    );

    const msg91Body = await msg91Res.json();

    return NextResponse.json({
      envCheck,
      requestBody,
      msg91Status: msg91Res.status,
      msg91Response: msg91Body,
    });
  } catch (err) {
    console.error('[test-whatsapp]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
