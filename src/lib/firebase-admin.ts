import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function initAdmin() {
  if (getApps().length > 0) return getApps()[0]!;

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');

  const serviceAccount = JSON.parse(key);

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const app = initAdmin();
export const db = getFirestore(app);
export const storage = getStorage(app);
