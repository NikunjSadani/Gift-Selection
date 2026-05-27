import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0]!;

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');

  const serviceAccount = JSON.parse(key);

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

// Lazy singletons — initialised on first use (request time), not at import
// time (build time). This prevents build failures when env vars are not
// available during `next build`.
let _db: Firestore | null = null;
let _storage: Storage | null = null;

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!_db) {
      _db = getFirestore(initAdmin());
    }
    const value = (_db as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(_db) : value;
  },
});

export const storage: Storage = new Proxy({} as Storage, {
  get(_target, prop) {
    if (!_storage) {
      _storage = getStorage(initAdmin());
    }
    const value = (_storage as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(_storage) : value;
  },
});
