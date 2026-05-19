import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbPath = dbUrl.replace('file:', '');
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
const adapter = new PrismaBetterSqlite3({ url: resolvedPath });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  console.log('Seeding database...');

  // Admin
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@kwalitywalls.com' },
    update: {},
    create: {
      email: 'admin@kwalitywalls.com',
      passwordHash,
      name: 'Super Admin',
    },
  });
  console.log('Admin created:', admin.email);

  // Slabs
  const slab2k = await prisma.slab.upsert({
    where: { internalCode: 'TIER_1' },
    update: {},
    create: { name: '2K', internalCode: 'TIER_1', displayOrder: 1 },
  });
  const slab4k = await prisma.slab.upsert({
    where: { internalCode: 'TIER_2' },
    update: {},
    create: { name: '4K', internalCode: 'TIER_2', displayOrder: 2 },
  });
  const slab6k = await prisma.slab.upsert({
    where: { internalCode: 'TIER_3' },
    update: {},
    create: { name: '6K', internalCode: 'TIER_3', displayOrder: 3 },
  });
  console.log('Slabs created: 2K, 4K, 6K');

  // Gifts for 2K slab
  const gifts2k = [
    { name: 'Steel Water Bottle Set', description: 'Premium stainless steel water bottle set of 2 with insulated design', sku: 'GIFT-2K-001', mrp: 1200, showMrp: false },
    { name: 'Bluetooth Speaker', description: 'Compact portable Bluetooth speaker with 8-hour battery life', sku: 'GIFT-2K-002', mrp: 1800, showMrp: false },
    { name: 'Kitchen Tool Set', description: 'Set of 5 premium stainless steel kitchen tools with stand', sku: 'GIFT-2K-003', mrp: 1500, showMrp: false },
  ];

  // Gifts for 4K slab
  const gifts4k = [
    { name: 'Electric Kettle', description: '1.5L stainless steel electric kettle with auto shut-off and temperature control', sku: 'GIFT-4K-001', mrp: 2500, showMrp: false },
    { name: 'Mixer Grinder', description: '500W mixer grinder with 3 jars for everyday kitchen use', sku: 'GIFT-4K-002', mrp: 3200, showMrp: false },
    { name: 'Air Fryer (2L)', description: 'Compact 2L air fryer with 7 presets for healthy cooking', sku: 'GIFT-4K-003', mrp: 3800, showMrp: false },
  ];

  // Gifts for 6K slab
  const gifts6k = [
    { name: 'Microwave Oven (20L)', description: '20L solo microwave oven with auto-cook menus and child lock', sku: 'GIFT-6K-001', mrp: 5500, showMrp: false },
    { name: 'Instant Pot (3L)', description: '3L electric pressure cooker & multi-cooker with 12 presets', sku: 'GIFT-6K-002', mrp: 4800, showMrp: false },
    { name: 'Smart Watch', description: 'Fitness smart watch with heart rate monitor, SpO2, and 7-day battery', sku: 'GIFT-6K-003', mrp: 5999, showMrp: false },
  ];

  for (let i = 0; i < gifts2k.length; i++) {
    const g = await prisma.gift.create({ data: { ...gifts2k[i], imageUrl: '/gifts/gift-placeholder.jpg' } });
    await prisma.giftSlabMapping.upsert({
      where: { giftId_slabId: { giftId: g.id, slabId: slab2k.id } },
      update: {},
      create: { giftId: g.id, slabId: slab2k.id, displaySequence: i },
    });
  }

  for (let i = 0; i < gifts4k.length; i++) {
    const g = await prisma.gift.create({ data: { ...gifts4k[i], imageUrl: '/gifts/gift-placeholder.jpg' } });
    await prisma.giftSlabMapping.upsert({
      where: { giftId_slabId: { giftId: g.id, slabId: slab4k.id } },
      update: {},
      create: { giftId: g.id, slabId: slab4k.id, displaySequence: i },
    });
  }

  for (let i = 0; i < gifts6k.length; i++) {
    const g = await prisma.gift.create({ data: { ...gifts6k[i], imageUrl: '/gifts/gift-placeholder.jpg' } });
    await prisma.giftSlabMapping.upsert({
      where: { giftId_slabId: { giftId: g.id, slabId: slab6k.id } },
      update: {},
      create: { giftId: g.id, slabId: slab6k.id, displaySequence: i },
    });
  }
  console.log('Gifts created: 9 total (3 per slab)');

  // Sample retailers
  const retailers = [
    { retailerId: 'R001', name: 'Star Ice Cream Store', ownerName: 'Rajesh Kumar', mobile: '9999900001', slabId: slab2k.id },
    { retailerId: 'R002', name: 'Cool Corner Ice Cream', ownerName: 'Priya Sharma', mobile: '9999900002', slabId: slab4k.id },
    { retailerId: 'R003', name: 'Sweet Freeze Parlour', ownerName: 'Amit Patel', mobile: '9999900003', slabId: slab6k.id },
  ];

  for (const r of retailers) {
    await prisma.retailer.upsert({
      where: { mobile: r.mobile },
      update: {},
      create: {
        ...r,
        addressLine1: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });
  }
  console.log('Retailers created: 3 sample retailers');

  // Campaign setting
  const now = new Date();
  const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const existing = await prisma.campaignSetting.findFirst();
  if (!existing) {
    await prisma.campaignSetting.create({
      data: {
        campaignName: 'Kwality Walls Gift Program 2025',
        startDate: now,
        endDate: threeMonthsLater,
        supportWhatsapp: '919999999999',
        otpExpiryMinutes: 5,
        otpResendSeconds: 45,
        maxDocSizeMb: 5,
        whatsappEnabled: true,
      },
    });
    console.log('Campaign setting created');
  } else {
    console.log('Campaign setting already exists, skipping');
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
