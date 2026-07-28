// ============================================
// client/src/lib/keyStore.ts
// Phase 2: IndexedDB persistence for ECDH key pairs
// Uses the `idb` library for a clean promise-based API
// ============================================

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { generateKeyPair, importPrivateKey } from './crypto';

const DB_NAME = 'apex-e2ee';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

interface StoredKeyPair {
  userId: string;
  publicKeyB64: string;   // SPKI Base64 — also on server
  privateKeyB64: string;  // PKCS8 Base64 — local only, never leaves device
}

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    },
  });
  return _db;
}

/**
 * Save a key pair for the given user.
 * The private key (PKCS8 Base64) is stored only in IndexedDB — never sent to the server.
 */
export async function saveKeyPair(
  userId: string,
  publicKeyB64: string,
  privateKeyB64: string
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { userId, publicKeyB64, privateKeyB64 });
}

/**
 * Load the stored key pair for a user, or return null if none exists.
 */
export async function loadKeyPair(userId: string): Promise<StoredKeyPair | null> {
  const db = await getDB();
  return (await db.get(STORE_NAME, userId)) || null;
}

/**
 * Delete a user's key pair (e.g., on logout for security).
 */
export async function clearKeyPair(userId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, userId);
}

/**
 * Ensure a key pair exists for this user:
 * - Loads from IndexedDB if already generated.
 * - Generates and saves a new one if not.
 * Returns the Base64 public key (to upload to the server).
 */
export async function ensureKeyPair(userId: string): Promise<{
  publicKeyB64: string;
  privateKey: CryptoKey;
  isNew: boolean;
}> {
  const existing = await loadKeyPair(userId);

  if (existing) {
    const privateKey = await importPrivateKey(existing.privateKeyB64);
    return { publicKeyB64: existing.publicKeyB64, privateKey, isNew: false };
  }

  // First time: generate, store, and flag as new so caller uploads to server
  const { exported, keyPair } = await generateKeyPair();
  await saveKeyPair(userId, exported.publicKeyB64, exported.privateKeyB64);
  return { publicKeyB64: exported.publicKeyB64, privateKey: keyPair.privateKey, isNew: true };
}
