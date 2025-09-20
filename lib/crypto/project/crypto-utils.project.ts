// lib/crypto/project/crypto-utils.project.ts
import { randomBytes } from '@noble/hashes/utils';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2.js';
import { x25519 } from '@noble/curves/ed25519';
import {
  toBase64,
  fromBase64,
  encryptData,
  decryptData,
  secureWipe,
} from '../org/crypto-utils.org';

type ProjectCryptoResult<T> = {
  data: T | null;
  error: unknown;
  message: string;
};

export interface WrappedProjectKey {
  ciphertext: string; // Base64 encrypted project key
  iv: string; // Base64 IV for AES-GCM
  ephemeralPublicKey: string; // Base64 ephemeral public key for ECDH
  algorithm: string; // 'aes-256-gcm-x25519'
  version: number; // Version for future compatibility
}

export interface ProjectKeyData {
  projectId: string;
  symmetricKey: Uint8Array;
  wrappedKey: WrappedProjectKey;
  createdAt: number;
}

// Generate a new AES-256 symmetric key for project-level encryption
export function generateProjectKey(): ProjectCryptoResult<Uint8Array> {
  try {
    const key = randomBytes(32); // 256-bit key for AES-256-GCM

    if (!key || key.length !== 32) {
      return {
        data: null,
        error: new Error('Key generation failed'),
        message: 'Failed to generate 256-bit project key',
      };
    }

    return {
      data: key,
      error: null,
      message: 'Project symmetric key generated successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to generate project symmetric key',
    };
  }
}

// Wrap project symmetric key using organization private key and X25519 ECDH
export async function wrapProjectKey(
  projectKey: Uint8Array,
  orgPrivateKey: Uint8Array,
): Promise<ProjectCryptoResult<WrappedProjectKey>> {
  try {
    // Validate inputs
    if (!projectKey || projectKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid project key'),
        message: 'Project key must be 32 bytes for AES-256',
      };
    }

    if (!orgPrivateKey || orgPrivateKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid organization private key'),
        message: 'Organization private key must be 32 bytes',
      };
    }

    // Generate ephemeral X25519 key pair for this wrapping operation
    let ephemeralPrivateKey: Uint8Array;
    let ephemeralPublicKey: Uint8Array;

    try {
      ephemeralPrivateKey = x25519.utils.randomSecretKey();
      ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
    } catch (error) {
      return {
        data: null,
        error,
        message: 'Failed to generate ephemeral key pair for wrapping',
      };
    }

    // Convert Ed25519 org private key to X25519 for ECDH
    const orgX25519PrivateKey = orgPrivateKey.slice(0, 32);

    let orgX25519PublicKey: Uint8Array;
    try {
      orgX25519PublicKey = x25519.getPublicKey(orgX25519PrivateKey);
    } catch (error) {
      secureWipe(ephemeralPrivateKey);
      return {
        data: null,
        error,
        message: 'Failed to derive X25519 public key from organization key',
      };
    }

    // Perform X25519 key agreement to get shared secret
    let sharedSecret: Uint8Array;
    try {
      sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, orgX25519PublicKey);
    } catch (error) {
      secureWipe(ephemeralPrivateKey);
      return {
        data: null,
        error,
        message: 'Failed to perform X25519 key agreement',
      };
    }

    // Derive encryption key from shared secret using HKDF
    let wrappingKey: Uint8Array;
    try {
      const info = new TextEncoder().encode('project-key-wrapping-v1');
      wrappingKey = hkdf(sha256, sharedSecret, undefined, info, 32);
    } catch (error) {
      secureWipe(ephemeralPrivateKey);
      secureWipe(sharedSecret);
      return {
        data: null,
        error,
        message: 'Failed to derive wrapping key from shared secret',
      };
    }

    // Encrypt project key with derived wrapping key
    const encryptResult = await encryptData(projectKey, wrappingKey);
    if (!encryptResult.data) {
      secureWipe(ephemeralPrivateKey);
      secureWipe(sharedSecret);
      secureWipe(wrappingKey);
      return {
        data: null,
        error: encryptResult.error,
        message: encryptResult.message,
      };
    }

    // Convert to base64 for storage
    const ciphertextB64 = toBase64(encryptResult.data.encrypted);
    const ivB64 = toBase64(encryptResult.data.iv);
    const ephemeralPublicKeyB64 = toBase64(ephemeralPublicKey);

    if (!ciphertextB64.data || !ivB64.data || !ephemeralPublicKeyB64.data) {
      secureWipe(ephemeralPrivateKey);
      secureWipe(sharedSecret);
      secureWipe(wrappingKey);
      return {
        data: null,
        error: new Error('Base64 encoding failed'),
        message: 'Failed to encode wrapped key components',
      };
    }

    // Clean up sensitive data
    secureWipe(ephemeralPrivateKey);
    secureWipe(sharedSecret);
    secureWipe(wrappingKey);

    const wrappedKey: WrappedProjectKey = {
      ciphertext: ciphertextB64.data,
      iv: ivB64.data,
      ephemeralPublicKey: ephemeralPublicKeyB64.data,
      algorithm: 'aes-256-gcm-x25519',
      version: 1,
    };

    return {
      data: wrappedKey,
      error: null,
      message: 'Project key wrapped successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to wrap project key',
    };
  }
}

// Unwrap project symmetric key using organization private key
export async function unwrapProjectKey(
  wrappedKey: WrappedProjectKey,
  orgPrivateKey: Uint8Array,
): Promise<ProjectCryptoResult<Uint8Array>> {
  try {
    // Validate inputs
    if (!wrappedKey) {
      return {
        data: null,
        error: new Error('Missing wrapped key'),
        message: 'No wrapped key provided for unwrapping',
      };
    }

    if (wrappedKey.algorithm !== 'aes-256-gcm-x25519' || wrappedKey.version !== 1) {
      return {
        data: null,
        error: new Error('Unsupported format'),
        message: 'Unsupported key wrapping format or version',
      };
    }

    if (!orgPrivateKey || orgPrivateKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid organization private key'),
        message: 'Organization private key must be 32 bytes',
      };
    }

    if (!wrappedKey.ciphertext || !wrappedKey.iv || !wrappedKey.ephemeralPublicKey) {
      return {
        data: null,
        error: new Error('Incomplete wrapped key'),
        message: 'Wrapped key is missing required components',
      };
    }

    // Decode base64 components
    const ciphertextResult = fromBase64(wrappedKey.ciphertext);
    const ivResult = fromBase64(wrappedKey.iv);
    const ephemeralPublicKeyResult = fromBase64(wrappedKey.ephemeralPublicKey);

    if (!ciphertextResult.data || !ivResult.data || !ephemeralPublicKeyResult.data) {
      return {
        data: null,
        error: new Error('Base64 decoding failed'),
        message: 'Failed to decode wrapped key components',
      };
    }

    // Convert Ed25519 org private key to X25519 for ECDH
    const orgX25519PrivateKey = orgPrivateKey.slice(0, 32);

    // Perform X25519 key agreement to recreate shared secret
    let sharedSecret: Uint8Array;
    try {
      sharedSecret = x25519.getSharedSecret(orgX25519PrivateKey, ephemeralPublicKeyResult.data);
    } catch (error) {
      return {
        data: null,
        error,
        message: 'Failed to recreate shared secret during unwrapping',
      };
    }

    // Derive the same encryption key using HKDF
    let wrappingKey: Uint8Array;
    try {
      const info = new TextEncoder().encode('project-key-wrapping-v1');
      wrappingKey = hkdf(sha256, sharedSecret, undefined, info, 32);
    } catch (error) {
      secureWipe(sharedSecret);
      return {
        data: null,
        error,
        message: 'Failed to derive unwrapping key',
      };
    }

    // Decrypt project key
    const decryptResult = await decryptData(ciphertextResult.data, wrappingKey, ivResult.data);

    // Clean up sensitive data
    secureWipe(sharedSecret);
    secureWipe(wrappingKey);

    if (!decryptResult.data) {
      return {
        data: null,
        error: decryptResult.error,
        message:
          decryptResult.message === 'Incorrect passphrase or corrupted data'
            ? 'Invalid organization key or corrupted wrapped project key'
            : decryptResult.message,
      };
    }

    return {
      data: decryptResult.data,
      error: null,
      message: 'Project key unwrapped successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to unwrap project key',
    };
  }
}

// Derive a key for encrypting project keys in local storage
export async function deriveProjectStorageKey(
  orgPrivateKey: Uint8Array,
  projectId: string,
): Promise<ProjectCryptoResult<Uint8Array>> {
  try {
    if (!orgPrivateKey || orgPrivateKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid organization private key'),
        message: 'Organization private key must be 32 bytes',
      };
    }

    if (!projectId || typeof projectId !== 'string') {
      return {
        data: null,
        error: new Error('Invalid project ID'),
        message: 'Project ID must be a non-empty string',
      };
    }

    const info = new TextEncoder().encode(`project-storage-${projectId}-v1`);
    const storageKey = hkdf(sha256, orgPrivateKey, undefined, info, 32);

    return {
      data: storageKey,
      error: null,
      message: 'Project storage key derived successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to derive project storage key',
    };
  }
}

// Encrypt project key for local storage
export async function encryptProjectKeyForStorage(
  projectKey: Uint8Array,
  storageKey: Uint8Array,
): Promise<ProjectCryptoResult<{ encrypted: string; iv: string }>> {
  try {
    if (!projectKey || projectKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid project key'),
        message: 'Project key must be 32 bytes',
      };
    }

    if (!storageKey || storageKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid storage key'),
        message: 'Storage key must be 32 bytes',
      };
    }

    const encryptResult = await encryptData(projectKey, storageKey);
    if (!encryptResult.data) {
      return {
        data: null,
        error: encryptResult.error,
        message: encryptResult.message,
      };
    }

    const encryptedB64 = toBase64(encryptResult.data.encrypted);
    const ivB64 = toBase64(encryptResult.data.iv);

    if (!encryptedB64.data || !ivB64.data) {
      return {
        data: null,
        error: new Error('Base64 encoding failed'),
        message: 'Failed to encode encrypted project key for storage',
      };
    }

    return {
      data: {
        encrypted: encryptedB64.data,
        iv: ivB64.data,
      },
      error: null,
      message: 'Project key encrypted for storage successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to encrypt project key for storage',
    };
  }
}

// Decrypt project key from local storage
export async function decryptProjectKeyFromStorage(
  encryptedData: string,
  iv: string,
  storageKey: Uint8Array,
): Promise<ProjectCryptoResult<Uint8Array>> {
  try {
    if (!encryptedData || !iv) {
      return {
        data: null,
        error: new Error('Missing encrypted data or IV'),
        message: 'Both encrypted data and IV are required',
      };
    }

    if (!storageKey || storageKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid storage key'),
        message: 'Storage key must be 32 bytes',
      };
    }

    const encryptedResult = fromBase64(encryptedData);
    const ivResult = fromBase64(iv);

    if (!encryptedResult.data || !ivResult.data) {
      return {
        data: null,
        error: new Error('Base64 decoding failed'),
        message: 'Failed to decode stored project key data',
      };
    }

    const decryptResult = await decryptData(encryptedResult.data, storageKey, ivResult.data);
    if (!decryptResult.data) {
      return {
        data: null,
        error: decryptResult.error,
        message: decryptResult.message,
      };
    }

    return {
      data: decryptResult.data,
      error: null,
      message: 'Project key decrypted from storage successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to decrypt project key from storage',
    };
  }
}

// Generate ephemeral key for sharing (used in links)
export function generateEphemeralKey(): ProjectCryptoResult<Uint8Array> {
  try {
    const key = randomBytes(32);

    if (!key || key.length !== 32) {
      return {
        data: null,
        error: new Error('Key generation failed'),
        message: 'Failed to generate ephemeral key',
      };
    }

    return {
      data: key,
      error: null,
      message: 'Ephemeral key generated successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to generate ephemeral key',
    };
  }
}

// Create shareable wrapped key for invited users
export async function createShareableWrappedKey(
  projectKey: Uint8Array,
  inviteeEmail: string,
  ephemeralKey: Uint8Array,
): Promise<ProjectCryptoResult<WrappedProjectKey>> {
  try {
    // Validate inputs
    if (!projectKey || projectKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid project key'),
        message: 'Project key must be 32 bytes',
      };
    }

    if (!inviteeEmail || typeof inviteeEmail !== 'string' || !inviteeEmail.includes('@')) {
      return {
        data: null,
        error: new Error('Invalid email'),
        message: 'Valid invitee email is required',
      };
    }

    if (!ephemeralKey || ephemeralKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid ephemeral key'),
        message: 'Ephemeral key must be 32 bytes',
      };
    }

    // Derive share-specific key from ephemeral key and invitee email
    let shareKey: Uint8Array;
    try {
      const emailHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(inviteeEmail),
      );
      const info = new TextEncoder().encode('share-key-v1');
      shareKey = hkdf(sha256, ephemeralKey, new Uint8Array(emailHash), info, 32);
    } catch (error) {
      return {
        data: null,
        error,
        message: 'Failed to derive share-specific key',
      };
    }

    // Generate ephemeral key pair for this sharing operation
    let ephemeralPrivateKey: Uint8Array;
    let ephemeralPublicKey: Uint8Array;
    try {
      ephemeralPrivateKey = x25519.utils.randomSecretKey();
      ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
    } catch (error) {
      secureWipe(shareKey);
      return {
        data: null,
        error,
        message: 'Failed to generate ephemeral key pair for sharing',
      };
    }

    // Encrypt project key with share key
    const encryptResult = await encryptData(projectKey, shareKey);
    if (!encryptResult.data) {
      secureWipe(ephemeralPrivateKey);
      secureWipe(shareKey);
      return {
        data: null,
        error: encryptResult.error,
        message: encryptResult.message,
      };
    }

    // Convert to base64
    const ciphertextB64 = toBase64(encryptResult.data.encrypted);
    const ivB64 = toBase64(encryptResult.data.iv);
    const ephemeralPublicKeyB64 = toBase64(ephemeralPublicKey);

    if (!ciphertextB64.data || !ivB64.data || !ephemeralPublicKeyB64.data) {
      secureWipe(ephemeralPrivateKey);
      secureWipe(shareKey);
      return {
        data: null,
        error: new Error('Base64 encoding failed'),
        message: 'Failed to encode shareable wrapped key components',
      };
    }

    // Clean up sensitive data
    secureWipe(ephemeralPrivateKey);
    secureWipe(shareKey);

    const wrappedKey: WrappedProjectKey = {
      ciphertext: ciphertextB64.data,
      iv: ivB64.data,
      ephemeralPublicKey: ephemeralPublicKeyB64.data,
      algorithm: 'aes-256-gcm-x25519',
      version: 1,
    };

    return {
      data: wrappedKey,
      error: null,
      message: 'Shareable wrapped key created successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to create shareable wrapped key',
    };
  }
}
