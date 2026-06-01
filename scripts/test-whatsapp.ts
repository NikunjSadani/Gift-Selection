/**
 * Diagnostic script — checks WhatsApp send status for recent submissions
 * and fires a live test call to MSG91 to see the raw response.
 *
 * Usage:
 *   npx tsx scripts/test-whatsapp.ts
 *
 * Pass a mobile number to also send a test message:
 *   npx tsx scripts/test-whatsapp.ts --mobile 9999900001
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountRaw) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set'); process.exit(1); }
const serviceAccount = JSON.parse(serviceAccountRaw.replace(/^﻿/, ''));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const mobileArg = (() => {
  const idx = process.argv.indexOf('--mobile');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

async function main() {
  // ── 1. Check recent submissions for whatsappSent status ──────────────────
  console.log('\n── Recent Submissions (whatsappSent status) ──');
  const snap = await db.collection('submissions')
    .orderBy('submittedAt', 'desc')
    .limit(5)
    .get();

  if (snap.empty) {
    console.log('No submissions found.');
  } else {
    for (const doc of snap.docs) {
      const d = doc.data();
      const submittedAt = d.submittedAt?.toDate?.() ?? d.submittedAt;
      console.log(
        `  ${d.referenceId} | mobile: ${d.retailerMobile} | whatsappSent: ${d.whatsappSent} | submittedAt: ${submittedAt}`
      );
    }
  }

  // ── 2. Check env vars available ───────────────────────────────────────────
  console.log('\n── Environment Variables ──');
  const authKey = process.env.MSG91_AUTH_KEY;
  const template = process.env.MSG91_WHATSAPP_TEMPLATE;
  const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;

  console.log(`  MSG91_AUTH_KEY:                  ${authKey ? `SET (len=${authKey.length}, trimmed len=${authKey.trim().length})` : 'NOT SET ❌'}`);
  console.log(`  MSG91_WHATSAPP_TEMPLATE:          ${template || 'NOT SET ❌'}`);
  console.log(`  MSG91_WHATSAPP_INTEGRATED_NUMBER: ${integratedNumber || 'NOT SET ❌'}`);

  if (!authKey || !template) {
    console.log('\n❌ Cannot test: required env vars missing locally (they live in Secret Manager in production).');
    console.log('   Add MSG91_AUTH_KEY and MSG91_WHATSAPP_TEMPLATE to .env.local to test locally.');
    return;
  }

  if (!mobileArg) {
    console.log('\nℹ️  Pass --mobile <number> to send a live test WhatsApp message.');
    return;
  }

  // ── 3. Fire test call to MSG91 ────────────────────────────────────────────
  const mobile = mobileArg.replace(/^91/, ''); // strip country code if included
  console.log(`\n── Sending test WhatsApp to 91${mobile} ──`);

  // Build the payload the same way the production code does
  const payload = {
    integrated_number: integratedNumber ?? `91${mobile}`, // show what we'd send
    content_type: 'template',
    payload: {
      to: `91${mobile}`,
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: template,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Test Store' },
              { type: 'text', text: 'Test Gift' },
            ],
          },
        ],
      },
    },
  };

  console.log('  Request body:', JSON.stringify(payload, null, 2));

  const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: authKey.trim(),
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json();
  console.log(`\n  MSG91 HTTP status: ${response.status}`);
  console.log('  MSG91 response:', JSON.stringify(responseBody, null, 2));

  if (response.ok && responseBody.type === 'success') {
    console.log('\n✅ WhatsApp message sent successfully!');
  } else {
    console.log('\n❌ WhatsApp message failed. See response above.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
