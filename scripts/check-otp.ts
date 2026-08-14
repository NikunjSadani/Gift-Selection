import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY!;
const app = initializeApp({ credential: cert(JSON.parse(key.replace(/^﻿/, ''))) });
const db = getFirestore(app);

async function main() {
  // Check retailers
  const retailers = await db.collection('retailers').get();
  console.log(`\n=== Retailers (${retailers.size}) ===`);
  retailers.docs.forEach(d => {
    const data = d.data();
    console.log(`  mobile: ${data.mobile}  name: ${data.name}  status: ${data.status}`);
  });

  // Check recent OTPs
  const otps = await db.collection('otps').get();
  console.log(`\n=== OTP Records (${otps.size}) ===`);
  otps.docs.forEach(d => {
    const data = d.data();
    console.log(`  mobile: ${data.mobile}  otp: ${data.otp}  expires: ${data.expiresAt?.toDate?.()}`);
  });

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
