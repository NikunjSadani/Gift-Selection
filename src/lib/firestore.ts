/**
 * Typed Firestore helper functions.
 * All API routes import from here — never touching db directly.
 * This keeps routes thin and makes mocking in tests straightforward.
 */
import { db } from './firebase-admin';

// ── Shared types ───────────────────────────────────────────────────────────────

export interface Retailer {
  id: string;
  retailerId: string;
  name: string;
  ownerName: string | null;
  mobile: string;
  slabId: string;
  slabName: string;
  ndaCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  landmark: string | null;
  cso: string | null;
  csoPhone: string | null;
  gstNumber: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Gift {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  imageUrl: string | null;
  mrp: number | null;
  showMrp: boolean;
  status: string;
}

export interface Slab {
  id: string;
  name: string;
  internalCode: string;
  displayOrder: number;
}

export interface Draft {
  id: string;
  retailerId: string;
  step: string;
  giftId: string | null;
  giftConfirmed: boolean;
  giftSelectedAt: Date | null;
  formData: string | null;
  updatedAt: Date;
}

export interface Submission {
  id: string;
  referenceId: string;
  retailerId: string;
  retailerName: string;
  retailerMobile: string;
  slabName: string;
  giftId: string;
  giftName: string;
  giftImageUrl: string | null;
  storeName: string;
  ownerName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string | null;
  landmark: string | null;
  alternateMobile: string | null;
  detailsEdited: boolean;
  documentUrl: string | null;
  documentType: string | null;
  whatsappSent: boolean;
  whatsappSentAt: Date | null;
  giftConfirmedAt: Date | null;
  submittedAt: Date;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  return toDate(value);
}

function docToRetailer(id: string, d: Record<string, unknown>): Retailer {
  return {
    id,
    retailerId:   d.retailerId as string,
    name:         d.name as string,
    ownerName:    (d.ownerName as string | null) ?? null,
    mobile:       d.mobile as string,
    slabId:       d.slabId as string,
    slabName:     (d.slabName as string) ?? '',
    ndaCode:      (d.ndaCode as string | null) ?? null,
    addressLine1: (d.addressLine1 as string | null) ?? null,
    addressLine2: (d.addressLine2 as string | null) ?? null,
    city:         (d.city as string | null) ?? null,
    state:        (d.state as string | null) ?? null,
    pincode:      (d.pincode as string | null) ?? null,
    landmark:     (d.landmark as string | null) ?? null,
    cso:          (d.cso as string | null) ?? null,
    csoPhone:     (d.csoPhone as string | null) ?? null,
    gstNumber:    (d.gstNumber as string | null) ?? null,
    status:       (d.status as string) ?? 'active',
    createdAt:    toDate(d.createdAt),
    updatedAt:    toDate(d.updatedAt),
  };
}

function docToGift(id: string, d: Record<string, unknown>): Gift {
  return {
    id,
    name:        d.name as string,
    description: d.description as string,
    sku:         (d.sku as string | null) ?? null,
    imageUrl:    (d.imageUrl as string | null) ?? null,
    mrp:         (d.mrp as number | null) ?? null,
    showMrp:     (d.showMrp as boolean) ?? false,
    status:      (d.status as string) ?? 'active',
  };
}

function docToSubmission(id: string, d: Record<string, unknown>): Submission {
  return {
    id,
    referenceId:     d.referenceId as string,
    retailerId:      d.retailerId as string,
    retailerName:    (d.retailerName as string) ?? '',
    retailerMobile:  (d.retailerMobile as string) ?? '',
    slabName:        (d.slabName as string) ?? '',
    giftId:          d.giftId as string,
    giftName:        (d.giftName as string) ?? '',
    giftImageUrl:    (d.giftImageUrl as string | null) ?? null,
    storeName:       d.storeName as string,
    ownerName:       d.ownerName as string,
    addressLine1:    d.addressLine1 as string,
    addressLine2:    (d.addressLine2 as string | null) ?? null,
    city:            d.city as string,
    state:           d.state as string,
    pincode:         d.pincode as string,
    gstNumber:       (d.gstNumber as string | null) ?? null,
    landmark:        (d.landmark as string | null) ?? null,
    alternateMobile: (d.alternateMobile as string | null) ?? null,
    detailsEdited:   (d.detailsEdited as boolean) ?? false,
    documentUrl:     (d.documentUrl as string | null) ?? null,
    documentType:    (d.documentType as string | null) ?? null,
    whatsappSent:    (d.whatsappSent as boolean) ?? false,
    whatsappSentAt:  toDateOrNull(d.whatsappSentAt),
    giftConfirmedAt: toDateOrNull(d.giftConfirmedAt),
    submittedAt:     toDate(d.submittedAt),
  };
}

function docToDraft(id: string, d: Record<string, unknown>): Draft {
  return {
    id,
    retailerId:     d.retailerId as string,
    step:           (d.step as string) ?? 'gift',
    giftId:         (d.giftId as string | null) ?? null,
    giftConfirmed:  (d.giftConfirmed as boolean) ?? false,
    giftSelectedAt: toDateOrNull(d.giftSelectedAt),
    formData:       (d.formData as string | null) ?? null,
    updatedAt:      toDate(d.updatedAt),
  };
}

// ── Retailer helpers ───────────────────────────────────────────────────────────

export async function getRetailerByMobile(mobile: string): Promise<Retailer | null> {
  const snap = await db
    .collection('retailers')
    .where('mobile', '==', mobile)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToRetailer(doc.id, doc.data() as Record<string, unknown>);
}

export async function getRetailerById(id: string): Promise<Retailer | null> {
  const snap = await db.collection('retailers').doc(id).get();
  if (!snap.exists) return null;
  return docToRetailer(snap.id, snap.data() as Record<string, unknown>);
}

// ── Gift helpers ───────────────────────────────────────────────────────────────

export async function getGiftsForSlab(slabId: string): Promise<Gift[]> {
  const mappingSnap = await db
    .collection('giftSlabMappings')
    .where('slabId', '==', slabId)
    .get();

  if (mappingSnap.empty) return [];

  const mappings = mappingSnap.docs
    .map((d) => d.data() as { giftId: string; displaySequence: number })
    .sort((a, b) => a.displaySequence - b.displaySequence);

  const gifts: Gift[] = [];
  for (const mapping of mappings) {
    const giftSnap = await db.collection('gifts').doc(mapping.giftId).get();
    if (giftSnap.exists) {
      gifts.push(docToGift(giftSnap.id, giftSnap.data() as Record<string, unknown>));
    }
  }
  return gifts;
}

// ── Draft helpers ──────────────────────────────────────────────────────────────

export async function getOrCreateDraft(retailerId: string): Promise<Draft> {
  const docRef = db.collection('drafts').doc(retailerId);
  const snap = await docRef.get();

  if (snap.exists) {
    return docToDraft(snap.id, snap.data() as Record<string, unknown>);
  }

  const defaultDraft = {
    retailerId,
    step:          'gift',
    giftId:        null,
    giftConfirmed: false,
    giftSelectedAt: null,
    formData:      null,
    updatedAt:     new Date(),
  };

  await docRef.set(defaultDraft, { merge: true });
  return { id: retailerId, ...defaultDraft };
}

export async function getDraftByRetailerId(retailerId: string): Promise<Draft | null> {
  const snap = await db.collection('drafts').doc(retailerId).get();
  if (!snap.exists) return null;
  return docToDraft(snap.id, snap.data() as Record<string, unknown>);
}

// ── Submission helpers ─────────────────────────────────────────────────────────

export async function getSubmissionByRetailerId(retailerId: string): Promise<Submission | null> {
  const snap = await db
    .collection('submissions')
    .where('retailerId', '==', retailerId)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToSubmission(doc.id, doc.data() as Record<string, unknown>);
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const snap = await db.collection('submissions').doc(id).get();
  if (!snap.exists) return null;
  return docToSubmission(snap.id, snap.data() as Record<string, unknown>);
}

// ── Slab helpers ───────────────────────────────────────────────────────────────

export async function getAllSlabs(): Promise<Slab[]> {
  const snap = await db.collection('slabs').orderBy('displayOrder').get();
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id:           d.id,
      name:         data.name as string,
      internalCode: data.internalCode as string,
      displayOrder: (data.displayOrder as number) ?? 0,
    };
  });
}

export async function getSlabById(id: string): Promise<Slab | null> {
  const snap = await db.collection('slabs').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  return {
    id:           snap.id,
    name:         data.name as string,
    internalCode: data.internalCode as string,
    displayOrder: (data.displayOrder as number) ?? 0,
  };
}

// ── Count helpers (for reference ID generation + dashboard) ───────────────────

export async function getSubmissionCount(): Promise<number> {
  const snap = await db.collection('submissions').get();
  return snap.size;
}
