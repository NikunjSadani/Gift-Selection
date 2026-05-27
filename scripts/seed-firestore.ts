/**
 * Seed script — populates Firestore with initial data for local dev / production first-run.
 *
 * Usage:
 *   npx tsx scripts/seed-firestore.ts
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_STORAGE_BUCKET in .env.local
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY not set in .env.local');
  process.exit(1);
}

const app = initializeApp({ credential: cert(JSON.parse(serviceAccountKey)) });
const db  = getFirestore(app);

async function upsert(
  collection: string,
  id: string,
  data: Record<string, unknown>,
) {
  await db.collection(collection).doc(id).set(data, { merge: true });
}

async function main() {
  const now = Timestamp.now();
  console.log('🌱  Seeding Firestore…\n');

  // ── Campaign setting ─────────────────────────────────────────────────────────
  const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  await upsert('settings', 'campaign', {
    campaignName:    'Kwality Walls Gift Program 2025',
    startDate:       now,
    endDate:         Timestamp.fromDate(threeMonthsLater),
    forceStatus:     null,
    supportWhatsapp: '919999999999',
    otpExpiryMinutes: 5,
    otpResendSeconds: 45,
    maxDocSizeMb:    5,
    whatsappEnabled: true,
    updatedAt:       now,
  });
  console.log('✅  Campaign setting');

  // ── Admin ────────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminRef = db.collection('admins').doc('superadmin');
  const adminSnap = await adminRef.get();
  if (!adminSnap.exists) {
    await adminRef.set({
      email:        'admin@kwalitywalls.com',
      passwordHash,
      name:         'Super Admin',
      role:         'superadmin',
      createdAt:    now,
      updatedAt:    now,
    });
    console.log('✅  Admin: admin@kwalitywalls.com (password: admin123)');
  } else {
    console.log('⏭️   Admin already exists — skipped');
  }

  // ── Slabs ────────────────────────────────────────────────────────────────────
  const slabs = [
    { id: 'slab-tier-1', name: '2K', internalCode: 'TIER_1', displayOrder: 1 },
    { id: 'slab-tier-2', name: '4K', internalCode: 'TIER_2', displayOrder: 2 },
    { id: 'slab-tier-3', name: '6K', internalCode: 'TIER_3', displayOrder: 3 },
  ];
  for (const slab of slabs) {
    await upsert('slabs', slab.id, { ...slab, createdAt: now, updatedAt: now });
  }
  console.log('✅  Slabs: 2K, 4K, 6K');

  // ── Gifts + mappings ─────────────────────────────────────────────────────────
  const giftDefs = [
    // 2K
    { id: 'gift-2k-1', name: 'Steel Water Bottle Set',  description: 'Premium stainless steel water bottle set of 2 with insulated design', sku: 'GIFT-2K-001', mrp: 1200, slabId: 'slab-tier-1', seq: 0 },
    { id: 'gift-2k-2', name: 'Bluetooth Speaker',       description: 'Compact portable Bluetooth speaker with 8-hour battery life',          sku: 'GIFT-2K-002', mrp: 1800, slabId: 'slab-tier-1', seq: 1 },
    { id: 'gift-2k-3', name: 'Kitchen Tool Set',        description: 'Set of 5 premium stainless steel kitchen tools with stand',             sku: 'GIFT-2K-003', mrp: 1500, slabId: 'slab-tier-1', seq: 2 },
    // 4K
    { id: 'gift-4k-1', name: 'Electric Kettle',         description: '1.5L stainless steel electric kettle with auto shut-off',              sku: 'GIFT-4K-001', mrp: 2500, slabId: 'slab-tier-2', seq: 0 },
    { id: 'gift-4k-2', name: 'Mixer Grinder',           description: '500W mixer grinder with 3 jars for everyday kitchen use',              sku: 'GIFT-4K-002', mrp: 3200, slabId: 'slab-tier-2', seq: 1 },
    { id: 'gift-4k-3', name: 'Air Fryer (2L)',          description: 'Compact 2L air fryer with 7 presets for healthy cooking',               sku: 'GIFT-4K-003', mrp: 3800, slabId: 'slab-tier-2', seq: 2 },
    // 6K
    { id: 'gift-6k-1', name: 'Microwave Oven (20L)',    description: '20L solo microwave oven with auto-cook menus and child lock',          sku: 'GIFT-6K-001', mrp: 5500, slabId: 'slab-tier-3', seq: 0 },
    { id: 'gift-6k-2', name: 'Instant Pot (3L)',        description: '3L electric pressure cooker & multi-cooker with 12 presets',           sku: 'GIFT-6K-002', mrp: 4800, slabId: 'slab-tier-3', seq: 1 },
    { id: 'gift-6k-3', name: 'Smart Watch',             description: 'Fitness smart watch with heart rate monitor, SpO2, and 7-day battery', sku: 'GIFT-6K-003', mrp: 5999, slabId: 'slab-tier-3', seq: 2 },
  ];

  for (const g of giftDefs) {
    const { slabId, seq, ...giftData } = g;
    await upsert('gifts', g.id, {
      ...giftData,
      imageUrl:  '/gifts/gift-placeholder.jpg',
      showMrp:   false,
      status:    'active',
      createdAt: now,
      updatedAt: now,
    });
    await upsert('giftSlabMappings', `${g.id}-${slabId}`, {
      giftId:          g.id,
      slabId,
      displaySequence: seq,
    });
  }
  console.log('✅  Gifts: 9 total (3 per slab) + mappings');

  // ── Sample retailers ─────────────────────────────────────────────────────────
  const retailers = [
    { id: 'retailer-r001', retailerId: 'R001', name: 'Star Ice Cream Store',  ownerName: 'Rajesh Kumar', mobile: '9999900001', slabId: 'slab-tier-1', slabName: '2K' },
    { id: 'retailer-r002', retailerId: 'R002', name: 'Cool Corner Ice Cream', ownerName: 'Priya Sharma',  mobile: '9999900002', slabId: 'slab-tier-2', slabName: '4K' },
    { id: 'retailer-r003', retailerId: 'R003', name: 'Sweet Freeze Parlour',  ownerName: 'Amit Patel',   mobile: '9999900003', slabId: 'slab-tier-3', slabName: '6K' },
  ];

  for (const r of retailers) {
    const snap = await db.collection('retailers').where('mobile', '==', r.mobile).get();
    if (snap.empty) {
      await upsert('retailers', r.id, {
        ...r,
        addressLine1: '123 Main Street',
        city:         'Mumbai',
        state:        'Maharashtra',
        pincode:      '400001',
        status:       'active',
        createdAt:    now,
        updatedAt:    now,
      });
    }
  }
  console.log('✅  Retailers: 3 sample retailers');

  console.log('\n🎉  Seeding complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
