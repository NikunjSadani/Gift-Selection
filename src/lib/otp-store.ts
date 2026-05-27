import { db } from './firebase-admin';

export interface OtpRecord {
  id: string;
  mobile: string;
  otp: string;
  expiresAt: Date;
  used: boolean;
}

/** Persist a new OTP record; returns the Firestore document id */
export async function createOtpRecord(
  mobile: string,
  otp: string,
  expiresAt: Date,
): Promise<string> {
  const ref = await db.collection('otpRecords').add({
    mobile,
    otp,
    expiresAt,
    used: false,
    createdAt: new Date(),
  });
  return ref.id;
}

/** Find the most recent valid (unused, not expired) OTP for a mobile number */
export async function findValidOtp(mobile: string): Promise<OtpRecord | null> {
  const snap = await db
    .collection('otpRecords')
    .where('mobile', '==', mobile)
    .where('used', '==', false)
    .where('expiresAt', '>', new Date())
    .orderBy('expiresAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();
  return {
    id:        doc.id,
    mobile:    data.mobile as string,
    otp:       data.otp as string,
    expiresAt: data.expiresAt instanceof Date
      ? data.expiresAt
      : (data.expiresAt as { toDate: () => Date }).toDate(),
    used:      data.used as boolean,
  };
}

/** Mark an OTP record as used so it cannot be replayed */
export async function markOtpUsed(recordId: string): Promise<void> {
  await db.collection('otpRecords').doc(recordId).update({ used: true });
}

/** Delete all OTP records for a mobile (called before issuing a fresh OTP) */
export async function deleteOtpsByMobile(mobile: string): Promise<void> {
  const snap = await db
    .collection('otpRecords')
    .where('mobile', '==', mobile)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
