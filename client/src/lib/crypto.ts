// ============================================
// client/src/lib/crypto.ts
// Phase 2 E2EE: Real P-256 ECDH + AES-256-GCM Implementation
// Uses browser-native SubtleCrypto (no external library)
// ============================================

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const AES_PARAMS: AesKeyGenParams = { name: 'AES-GCM', length: 256 };

export interface ExportedKeyPair {
  /** SPKI Base64 — safe to send to server and other users */
  publicKeyB64: string;
  /** PKCS8 Base64 — must never leave the device */
  privateKeyB64: string;
}

// ─── Key Generation ─────────────────────────────────────────────────────────

/**
 * Generate a new P-256 ECDH key pair.
 * Returns raw CryptoKey objects for use in the same session,
 * plus Base64 exports for persistence.
 */
export async function generateKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  exported: ExportedKeyPair;
}> {
  const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits']);

  const publicKeyRaw = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    keyPair,
    exported: {
      publicKeyB64: arrayBufferToBase64(publicKeyRaw),
      privateKeyB64: arrayBufferToBase64(privateKeyRaw),
    },
  };
}

// ─── Key Import ──────────────────────────────────────────────────────────────

/**
 * Import an SPKI Base64 public key for ECDH derivation.
 */
export async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(spkiB64),
    ECDH_PARAMS,
    true,
    []
  );
}

/**
 * Import a PKCS8 Base64 private key for ECDH derivation.
 */
export async function importPrivateKey(pkcs8B64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(pkcs8B64),
    ECDH_PARAMS,
    false, // private keys are not extractable after import
    ['deriveKey', 'deriveBits']
  );
}

// ─── Shared Key Derivation ───────────────────────────────────────────────────

/**
 * Derive a shared AES-256-GCM key from our private key and the recipient's public key.
 * This is the ECDH handshake — both sides arrive at the same secret independently.
 */
export async function deriveSharedKey(
  ownPrivateKey: CryptoKey,
  recipientPublicKeyB64: string
): Promise<CryptoKey> {
  const recipientPubKey = await importPublicKey(recipientPublicKeyB64);

  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPubKey },
    ownPrivateKey,
    AES_PARAMS,
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a compact `<iv_b64>:<ciphertext_b64>` string.
 */
export async function encryptMessage(plaintext: string, sharedKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  );

  return `${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(cipherBuffer)}`;
}

/**
 * Decrypt an `<iv_b64>:<ciphertext_b64>` string back to plaintext.
 * Throws if tampered or wrong key — AES-GCM is authenticated.
 */
export async function decryptMessage(payload: string, sharedKey: CryptoKey): Promise<string> {
  const [ivB64, ciphertextB64] = payload.split(':');
  if (!ivB64 || !ciphertextB64) throw new Error('Invalid encrypted payload format');

  const iv = base64ToArrayBuffer(ivB64);
  const ciphertext = base64ToArrayBuffer(ciphertextB64);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext
  );

  return new TextDecoder().decode(plainBuffer);
}

// ─── Password-Derived Cloud Backup (PBKDF2 + AES-GCM) ─────────────────────────

async function derivePasswordWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a PKCS8 Base64 private key with the user's password using PBKDF2 + AES-256-GCM.
 * Returns `<salt_b64>:<iv_b64>:<ciphertext_b64>`.
 */
export async function encryptPrivateKeyWithPassword(privateKeyB64: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await derivePasswordWrappingKey(password, salt);
  
  const encoded = new TextEncoder().encode(privateKeyB64);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    encoded
  );
  
  return `${arrayBufferToBase64(salt.buffer)}:${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(cipherBuffer)}`;
}

/**
 * Decrypt an encrypted cloud private key backup using the user's password.
 * Returns the plaintext PKCS8 Base64 private key string, or null if decryption fails.
 */
export async function decryptPrivateKeyWithPassword(encryptedBlob: string, password: string): Promise<string | null> {
  try {
    const parts = encryptedBlob.split(':');
    if (parts.length !== 3) return null;
    const [saltB64, ivB64, ciphertextB64] = parts;

    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
    const ciphertext = base64ToArrayBuffer(ciphertextB64);

    const wrappingKey = await derivePasswordWrappingKey(password, salt);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      wrappingKey,
      ciphertext
    );

    return new TextDecoder().decode(plainBuffer);
  } catch (err) {
    console.error('[E2EE] Failed to decrypt private key backup with password:', err);
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
