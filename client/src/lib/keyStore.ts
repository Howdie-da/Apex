import { openDB } from "idb";
import type { IDBPDatabase } from "idb";
import { generateKeyPair, importPrivateKey } from "./crypto";

const DB_NAME = "apex-e2ee";
const DB_VERSION = 1;
const STORE_NAME = "keys";

interface StoredKeyPair {
  userId: string;
  publicKeyB64: string;
  privateKeyB64: string;
}

let _db: IDBPDatabase | null = null;

// We strictly isolate private keys into IndexedDB instead of localStorage to mitigate XSS exfiltration risks.
async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    },
  });

  return _db;
}

export async function saveKeyPair(
  userId: string,
  publicKeyB64: string,
  privateKeyB64: string,
): Promise<void> {
  const db = await getDB();
  
  await db.put(STORE_NAME, { userId, publicKeyB64, privateKeyB64 });
}

export async function loadKeyPair(
  userId: string,
): Promise<StoredKeyPair | null> {
  const db = await getDB();
  
  return (await db.get(STORE_NAME, userId)) || null;
}

export async function clearKeyPair(userId: string): Promise<void> {
  const db = await getDB();
  
  await db.delete(STORE_NAME, userId);
}

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

  const { exported, keyPair } = await generateKeyPair();
  
  await saveKeyPair(userId, exported.publicKeyB64, exported.privateKeyB64);

  return {
    publicKeyB64: exported.publicKeyB64,
    privateKey: keyPair.privateKey,
    isNew: true,
  };
}