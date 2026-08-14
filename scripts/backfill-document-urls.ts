/**
 * One-off backfill: strip stray whitespace/newlines from submissions.documentUrl.
 *
 * A mis-set FIREBASE_STORAGE_BUCKET secret embedded a newline into stored
 * document URLs, breaking the "Open Document" links. This rewrites each affected
 * documentUrl to its whitespace-free form.
 *
 * DRY RUN by default. To actually write:  npx tsx scripts/backfill-document-urls.ts --apply
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EXPECTED_PROJECT = 'kwality-gift---production';
const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 450;

async function main() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) { console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY not set'); process.exit(1); }
  const parsed = JSON.parse(key);
  console.log(`🔑  Project: ${parsed.project_id}  |  mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (read-only)'}`);
  if (parsed.project_id !== EXPECTED_PROJECT) {
    console.error(`❌  Refusing: expected ${EXPECTED_PROJECT}, got ${parsed.project_id}`); process.exit(1);
  }

  const db = getFirestore(initializeApp({ credential: cert(parsed) }));
  const snap = await db.collection('submissions').get();

  const dirty: { id: string; before: string; after: string }[] = [];
  snap.docs.forEach((d) => {
    const url = d.data().documentUrl;
    if (typeof url !== 'string' || !url) return;
    const clean = url.replace(/\s+/g, '');
    if (clean !== url) dirty.push({ id: d.id, before: url, after: clean });
  });

  console.log(`\n📊  ${snap.size} submissions scanned · ${dirty.length} have whitespace in documentUrl\n`);
  dirty.slice(0, 3).forEach((x) => {
    console.log(`  ${x.id}`);
    console.log(`    before: ${JSON.stringify(x.before)}`);
    console.log(`    after : ${JSON.stringify(x.after)}`);
  });
  if (dirty.length > 3) console.log(`  … and ${dirty.length - 3} more`);

  if (!APPLY) { console.log('\n🟡  DRY RUN — no changes written. Re-run with --apply to fix.'); process.exit(0); }

  let done = 0;
  for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
    const chunk = dirty.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const x of chunk) batch.update(db.collection('submissions').doc(x.id), { documentUrl: x.after });
    await batch.commit();
    done += chunk.length;
    console.log(`  ✔ committed ${done}/${dirty.length}`);
  }
  console.log(`\n✅  Backfill complete — ${done} documentUrl values cleaned.`);
  process.exit(0);
}

main().catch((err) => { console.error('❌  Failed:', err); process.exit(1); });
