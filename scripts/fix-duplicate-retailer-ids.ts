/**
 * Finds and removes duplicate retailer IDs from Firestore.
 * For each duplicated retailer ID, keeps the OLDEST document (earliest createdAt)
 * and deletes all newer duplicates — unless one of them has a submission, in which
 * case that one is kept instead.
 *
 * Usage:
 *   npx tsx scripts/fix-duplicate-retailer-ids.ts
 *
 * Add --dry-run to preview without deleting anything.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountRaw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set in .env.local');
  process.exit(1);
}
const serviceAccount = JSON.parse(serviceAccountRaw.replace(/^﻿/, ''));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(dryRun ? '[DRY RUN] No changes will be made.\n' : '');

  const snap = await db.collection('retailers').get();
  const all = snap.docs.map((d) => ({
    docId: d.id,
    data: d.data() as Record<string, unknown>,
  }));

  // Group by retailerId
  const groups = new Map<string, typeof all>();
  for (const doc of all) {
    const rid = (doc.data.retailerId as string) ?? '';
    if (!rid) continue;
    if (!groups.has(rid)) groups.set(rid, []);
    groups.get(rid)!.push(doc);
  }

  // Find duplicates
  const duplicates = [...groups.entries()].filter(([, docs]) => docs.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ No duplicate retailer IDs found.');
    return;
  }

  console.log(`Found ${duplicates.length} duplicated retailer ID(s):\n`);

  for (const [retailerId, docs] of duplicates) {
    console.log(`── Retailer ID: ${retailerId} (${docs.length} entries)`);

    // Check which docs have submissions
    const withSubmission: string[] = [];
    for (const doc of docs) {
      const subSnap = await db.collection('submissions').where('retailerId', '==', doc.docId).get();
      if (!subSnap.empty) withSubmission.push(doc.docId);
    }

    // Sort by createdAt ascending (oldest first)
    docs.sort((a, b) => {
      const aT = a.data.createdAt instanceof admin.firestore.Timestamp
        ? a.data.createdAt.toMillis()
        : 0;
      const bT = b.data.createdAt instanceof admin.firestore.Timestamp
        ? b.data.createdAt.toMillis()
        : 0;
      return aT - bT;
    });

    // Decide which to keep: prefer the one with a submission; otherwise oldest
    const keepDocId = withSubmission.length > 0 ? withSubmission[0] : docs[0].docId;
    const toDelete = docs.filter((d) => d.docId !== keepDocId);

    for (const doc of docs) {
      const keep = doc.docId === keepDocId;
      const hasSub = withSubmission.includes(doc.docId);
      console.log(
        `   ${keep ? '✅ KEEP' : '🗑  DELETE'} | docId: ${doc.docId} | name: ${doc.data.name} | mobile: ${doc.data.mobile} | createdAt: ${doc.data.createdAt}${hasSub ? ' | HAS SUBMISSION' : ''}`
      );
    }

    if (!dryRun) {
      for (const doc of toDelete) {
        await db.collection('retailers').doc(doc.docId).delete();
        console.log(`   Deleted: ${doc.docId}`);
      }
    }

    console.log('');
  }

  if (dryRun) {
    console.log('Dry run complete. Re-run without --dry-run to apply deletions.');
  } else {
    console.log('✅ Cleanup complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
