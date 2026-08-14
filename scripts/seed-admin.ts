/**
 * One-off: create an admin account.
 *
 * Credentials come from the environment (never hardcode them in the repo):
 *   ADMIN_EMAIL    — required
 *   ADMIN_PASSWORD — required
 *   ADMIN_NAME     — optional (default "Admin")
 *   ADMIN_ROLE     — optional (default "admin"; use "superadmin" for full access)
 *
 * Usage (PowerShell):
 *   $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="a-strong-password"; npx tsx scripts/seed-admin.ts
 * Usage (bash):
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-strong-password' npx tsx scripts/seed-admin.ts
 *
 * Reads FIREBASE_SERVICE_ACCOUNT_KEY from .env.local. Idempotent: if an admin
 * with the same email already exists it does NOT overwrite it — it reports and
 * exits. Login matches on the email field, so the document id is irrelevant.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

// ── What we're creating (from the environment — no credentials in source) ─────
const EMAIL    = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const NAME     = process.env.ADMIN_NAME || 'Admin';
const ROLE     = process.env.ADMIN_ROLE || 'admin';

// Safety: refuse to run unless the key targets the expected project.
const EXPECTED_PROJECT = 'kwality-gift---production';

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌  Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment (see header).');
    process.exit(1);
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY not set in .env.local');
    process.exit(1);
  }

  const parsed = JSON.parse(key);
  console.log(`🔑  Target project: ${parsed.project_id}`);
  if (parsed.project_id !== EXPECTED_PROJECT) {
    console.error(`❌  Refusing to run: expected ${EXPECTED_PROJECT}, got ${parsed.project_id}`);
    process.exit(1);
  }

  const app = initializeApp({ credential: cert(parsed) });
  const db  = getFirestore(app);

  // Idempotency guard — do not create a duplicate or overwrite an existing one.
  const existing = await db.collection('admins').where('email', '==', EMAIL).get();
  if (!existing.empty) {
    console.log(`⏭️   An admin with email ${EMAIL} already exists (id: ${existing.docs[0].id}). No changes made.`);
    process.exit(0);
  }

  const now = Timestamp.now();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ref = await db.collection('admins').add({
    email:        EMAIL,
    passwordHash,
    name:         NAME,
    role:         ROLE,
    createdAt:    now,
    updatedAt:    now,
  });

  // Verify the write + that the password round-trips.
  const written = (await ref.get()).data() as { email: string; role: string; passwordHash: string };
  const ok = await bcrypt.compare(PASSWORD, written.passwordHash);
  console.log(`✅  Created admin (id: ${ref.id})`);
  console.log(`    email: ${written.email}`);
  console.log(`    role:  ${written.role}`);
  console.log(`    password verifies: ${ok}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Failed:', err);
  process.exit(1);
});
