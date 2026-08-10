const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const AES_PARAMS: AesKeyGenParams = { name: "AES-GCM", length: 256 };

export interface ExportedKeyPair {
  publicKeyB64: string;
  privateKeyB64: string;
}

export async function generateKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  exported: ExportedKeyPair;
}> {
  const keyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, [
    "deriveKey",
    "deriveBits",
  ]);

  const publicKeyRaw = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKeyRaw = await crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey,
  );

  return {
    keyPair,
    exported: {
      publicKeyB64: arrayBufferToBase64(publicKeyRaw),
      privateKeyB64: arrayBufferToBase64(privateKeyRaw),
    },
  };
}

export async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(spkiB64),
    ECDH_PARAMS,
    true,
    [],
  );
}

export async function importPrivateKey(pkcs8B64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(pkcs8B64),
    ECDH_PARAMS,
    false,
    ["deriveKey", "deriveBits"],
  );
}

// Bypasses the need for key exchange servers. We enforce ECDH P-256 natively in the browser.
export async function deriveSharedKey(
  ownPrivateKey: CryptoKey,
  recipientPublicKeyB64: string,
): Promise<CryptoKey> {
  const recipientPubKey = await importPublicKey(recipientPublicKeyB64);
  
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPubKey },
    ownPrivateKey,
    AES_PARAMS,
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(
  plaintext: string,
  sharedKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded,
  );

  return `${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(cipherBuffer)}`;
}

export async function decryptMessage(
  payload: string,
  sharedKey: CryptoKey,
): Promise<string> {
  const [ivB64, ciphertextB64] = payload.split(":");

  if (!ivB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = base64ToArrayBuffer(ivB64);
  const ciphertext = base64ToArrayBuffer(ciphertextB64);
  
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuffer);
}

async function derivePasswordWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Uses PBKDF2 with 100,000 iterations to mitigate brute-force offline cracking of the cloud backup blob.
export async function encryptPrivateKeyWithPassword(
  privateKeyB64: string,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const wrappingKey = await derivePasswordWrappingKey(password, salt);
  const encoded = new TextEncoder().encode(privateKeyB64);
  
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    encoded,
  );

  return `${arrayBufferToBase64(salt.buffer)}:${arrayBufferToBase64(iv.buffer)}:${arrayBufferToBase64(cipherBuffer)}`;
}

export async function decryptPrivateKeyWithPassword(
  encryptedBlob: string,
  password: string,
): Promise<string | null> {
  try {
    const parts = encryptedBlob.split(":");
    
    if (parts.length !== 3) return null;

    const [saltB64, ivB64, ciphertextB64] = parts;
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
    const ciphertext = base64ToArrayBuffer(ciphertextB64);
    
    const wrappingKey = await derivePasswordWrappingKey(password, salt);
    
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      ciphertext,
    );

    return new TextDecoder().decode(plainBuffer);

  } catch (err) {
    console.error(
      "[E2EE] Failed to decrypt private key backup with password:",
      err,
    );
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  
  for (const b of bytes) binary += String.fromCharCode(b);
  
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes.buffer;
}