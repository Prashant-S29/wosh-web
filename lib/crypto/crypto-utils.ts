import { ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes } from '@noble/hashes/utils';
import { OrganizationKeyPair, StoredOrgKeys } from '@/types/encryptions';

// generate a cryptographically secure salt
export function generateSalt(): Uint8Array {
  return randomBytes(32);
}

// derive master key from user passphrase using PBKDF2
export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 100000,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  return pbkdf2(sha256, passphraseBytes, salt, {
    c: iterations,
    dkLen: 32,
  });
}

// derive organization private key from master key using HKDF
export function deriveOrgPrivateKey(masterKey: Uint8Array): Uint8Array {
  const info = new TextEncoder().encode('org-signing-v1');
  return hkdf(sha256, masterKey, undefined, info, 32);
}

// generate Ed25519 key pair for organization
export function generateOrgKeyPair(privateKeySeed?: Uint8Array): OrganizationKeyPair {
  let privateKey: Uint8Array;

  if (privateKeySeed) {
    // Use provided seed (derived from passphrase)
    privateKey = privateKeySeed;
  } else {
    // Generate random private key
    privateKey = ed25519.utils.randomSecretKey();
  }

  const publicKey = ed25519.getPublicKey(privateKey);

  return {
    publicKey,
    privateKey,
  };
}

// convert bytes to base64 string
export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// convert base64 string to bytes
export function fromBase64(base64: string): Uint8Array {
  return new Uint8Array(
    atob(base64)
      .split('')
      .map((c) => c.charCodeAt(0)),
  );
}

// encrypt data using AES-GCM (Web Crypto API)
export async function encryptData(
  data: Uint8Array,
  key: Uint8Array,
): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
  const iv = randomBytes(12); // 96-bit IV for GCM

  // Create new Uint8Array instances to ensure correct type
  const keyBuffer = new Uint8Array(key);
  const dataBuffer = new Uint8Array(data);
  const ivBuffer = new Uint8Array(iv);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    cryptoKey,
    dataBuffer,
  );

  return {
    encrypted: new Uint8Array(encrypted),
    iv: ivBuffer,
  };
}

/**
 * Decrypt data using AES-GCM (Web Crypto API)
 */
export async function decryptData(
  encryptedData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  // Create new Uint8Array instances to ensure correct type
  const keyBuffer = new Uint8Array(key);
  const encryptedBuffer = new Uint8Array(encryptedData);
  const ivBuffer = new Uint8Array(iv);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    cryptoKey,
    encryptedBuffer,
  );

  return new Uint8Array(decrypted);
}

// create organization keys with passphrase-based security
export async function createOrganizationKeys(passphrase: string): Promise<StoredOrgKeys> {
  // 1. Generate salt for key derivation
  const salt = generateSalt();

  // 2. Derive master key from passphrase
  const masterKey = await deriveMasterKey(passphrase, salt);

  // 3. Derive organization private key seed
  const orgPrivateKeySeed = deriveOrgPrivateKey(masterKey);

  // 4. Generate Ed25519 key pair
  const keyPair = generateOrgKeyPair(orgPrivateKeySeed);

  // 5. Create encryption key for local storage (different derivation)
  const storageInfo = new TextEncoder().encode('local-storage-v1');
  const storageKey = hkdf(sha256, masterKey, undefined, storageInfo, 32);

  // 6. Encrypt private key for storage
  const { encrypted, iv } = await encryptData(keyPair.privateKey, storageKey);

  return {
    publicKey: toBase64(keyPair.publicKey),
    privateKeyEncrypted: toBase64(encrypted),
    salt: toBase64(salt),
    iv: toBase64(iv),
  };
}

// retrieve and decrypt organization private key
export async function retrieveOrgPrivateKey(
  passphrase: string,
  storedKeys: StoredOrgKeys,
): Promise<Uint8Array> {
  // 1. Reconstruct master key
  const salt = fromBase64(storedKeys.salt);
  const masterKey = await deriveMasterKey(passphrase, salt);

  // 2. Derive storage encryption key
  const storageInfo = new TextEncoder().encode('local-storage-v1');
  const storageKey = hkdf(sha256, masterKey, undefined, storageInfo, 32);

  // 3. Decrypt private key
  const encryptedPrivateKey = fromBase64(storedKeys.privateKeyEncrypted);
  const iv = fromBase64(storedKeys.iv);

  const privateKey = await decryptData(encryptedPrivateKey, storageKey, iv);

  return privateKey;
}

// generate project symmetric key (for encrypting secrets)
export function generateProjectKey(): Uint8Array {
  return randomBytes(32); // AES-256 key
}

// Sign data with Ed25519 private key
export function signData(data: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(data, privateKey);
}

// verify signature with Ed25519 public key
export function verifySignature(
  signature: Uint8Array,
  data: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  return ed25519.verify(signature, data, publicKey);
}

// secure memory wipe
export function secureWipe(buffer: Uint8Array): void {
  // Fill with random data
  crypto.getRandomValues(buffer);
  // Fill with zeros
  buffer.fill(0);
}
