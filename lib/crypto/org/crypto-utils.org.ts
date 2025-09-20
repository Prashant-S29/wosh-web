import { ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes } from '@noble/hashes/utils';
import { OrganizationKeyPair, StoredOrgKeys } from '@/types/encryptions';

type CryptoResult<T> = {
  data: T | null;
  error: unknown;
  message: string;
};

// generate a cryptographically secure salt
export function generateSalt(): CryptoResult<Uint8Array> {
  try {
    const salt = randomBytes(32);
    return {
      data: salt,
      error: null,
      message: 'Salt generated successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to generate cryptographic salt',
    };
  }
}

// derive master key from user passphrase using PBKDF2
export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 100000,
): Promise<CryptoResult<Uint8Array>> {
  try {
    if (!passphrase || passphrase.length < 12) {
      return {
        data: null,
        error: new Error('Invalid passphrase'),
        message: 'Passphrase must be at least 12 characters long',
      };
    }

    if (!salt || salt.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid salt'),
        message: 'Invalid salt provided for key derivation',
      };
    }

    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);

    const masterKey = pbkdf2(sha256, passphraseBytes, salt, {
      c: iterations,
      dkLen: 32,
    });

    return {
      data: masterKey,
      error: null,
      message: 'Master key derived successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to derive master key from passphrase',
    };
  }
}

// derive organization private key from master key using HKDF
export function deriveKey(masterKey: Uint8Array, infoString: string): CryptoResult<Uint8Array> {
  try {
    if (!masterKey || masterKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid master key'),
        message: 'Invalid master key provided',
      };
    }

    const info = new TextEncoder().encode(infoString);
    const derivedKey = hkdf(sha256, masterKey, undefined, info, 32);

    return {
      data: derivedKey,
      error: null,
      message: `Key derived with context "${infoString}" successfully`,
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: `Failed to derive key with context "${infoString}"`,
    };
  }
}

// generate Ed25519 key pair for organization
export function generateOrgKeyPair(privateKeySeed?: Uint8Array): CryptoResult<OrganizationKeyPair> {
  try {
    let privateKey: Uint8Array;

    if (privateKeySeed) {
      if (privateKeySeed.length !== 32) {
        return {
          data: null,
          error: new Error('Invalid private key seed'),
          message: 'Private key seed must be 32 bytes',
        };
      }
      privateKey = privateKeySeed;
    } else {
      privateKey = ed25519.utils.randomSecretKey();
    }

    const publicKey = ed25519.getPublicKey(privateKey);

    return {
      data: { publicKey, privateKey },
      error: null,
      message: 'Organization key pair generated successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to generate organization key pair',
    };
  }
}

// convert bytes to base64 string
export function toBase64(bytes: Uint8Array): CryptoResult<string> {
  try {
    if (!bytes || bytes.length === 0) {
      return {
        data: null,
        error: new Error('Invalid bytes'),
        message: 'No bytes provided for encoding',
      };
    }

    const base64 = btoa(String.fromCharCode(...bytes));
    return {
      data: base64,
      error: null,
      message: 'Bytes encoded to base64 successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to encode bytes to base64',
    };
  }
}

// convert base64 string to bytes
export function fromBase64(base64: string): CryptoResult<Uint8Array> {
  try {
    if (!base64 || typeof base64 !== 'string') {
      return {
        data: null,
        error: new Error('Invalid base64'),
        message: 'Invalid base64 string provided',
      };
    }

    const bytes = new Uint8Array(
      atob(base64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    return {
      data: bytes,
      error: null,
      message: 'Base64 decoded to bytes successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to decode base64 string',
    };
  }
}

// encrypt data using AES-GCM (Web Crypto API)
export async function encryptData(
  data: Uint8Array,
  key: Uint8Array,
): Promise<CryptoResult<{ encrypted: Uint8Array; iv: Uint8Array }>> {
  try {
    if (!data || data.length === 0) {
      return {
        data: null,
        error: new Error('No data to encrypt'),
        message: 'No data provided for encryption',
      };
    }

    if (!key || key.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid encryption key'),
        message: 'Encryption key must be 32 bytes',
      };
    }

    const iv = randomBytes(12); // 96-bit IV for GCM

    const keyBuffer = new Uint8Array(key);
    const dataBuffer = new Uint8Array(data);
    const ivBuffer = new Uint8Array(iv);

    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
      'encrypt',
    ]);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      cryptoKey,
      dataBuffer,
    );

    return {
      data: {
        encrypted: new Uint8Array(encrypted),
        iv: ivBuffer,
      },
      error: null,
      message: 'Data encrypted successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to encrypt data',
    };
  }
}

// decrypt data using AES-GCM (Web Crypto API)
export async function decryptData(
  encryptedData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<CryptoResult<Uint8Array>> {
  try {
    if (!encryptedData || encryptedData.length === 0) {
      return {
        data: null,
        error: new Error('No encrypted data'),
        message: 'No encrypted data provided for decryption',
      };
    }

    if (!key || key.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid decryption key'),
        message: 'Decryption key must be 32 bytes',
      };
    }

    if (!iv || iv.length !== 12) {
      return {
        data: null,
        error: new Error('Invalid IV'),
        message: 'Invalid initialization vector for decryption',
      };
    }

    const keyBuffer = new Uint8Array(key);
    const encryptedBuffer = new Uint8Array(encryptedData);
    const ivBuffer = new Uint8Array(iv);

    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
      'decrypt',
    ]);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      cryptoKey,
      encryptedBuffer,
    );

    return {
      data: new Uint8Array(decrypted),
      error: null,
      message: 'Data decrypted successfully',
    };
  } catch (error) {
    // Check for specific decryption errors
    if (error instanceof Error && error.name === 'OperationError') {
      return {
        data: null,
        error,
        message: 'Incorrect passphrase or corrupted data',
      };
    }

    return {
      data: null,
      error,
      message: 'Failed to decrypt data',
    };
  }
}

// create organization keys with passphrase-based security
export async function createOrganizationKeys(
  passphrase: string,
): Promise<CryptoResult<StoredOrgKeys>> {
  try {
    // 1. Generate salt for key derivation
    const saltResult = generateSalt();
    if (!saltResult.data) {
      return {
        data: null,
        error: saltResult.error,
        message: saltResult.message,
      };
    }

    // 2. Derive master key from passphrase
    const masterKeyResult = await deriveMasterKey(passphrase, saltResult.data);
    if (!masterKeyResult.data) {
      return {
        data: null,
        error: masterKeyResult.error,
        message: masterKeyResult.message,
      };
    }

    // 3. Derive organization private key seed
    const orgPrivateKeyResult = deriveKey(masterKeyResult.data, 'org-signing-v1');
    if (!orgPrivateKeyResult.data) {
      return {
        data: null,
        error: orgPrivateKeyResult.error,
        message: orgPrivateKeyResult.message,
      };
    }

    // 4. Generate Ed25519 key pair
    const keyPairResult = generateOrgKeyPair(orgPrivateKeyResult.data);
    if (!keyPairResult.data) {
      return {
        data: null,
        error: keyPairResult.error,
        message: keyPairResult.message,
      };
    }

    // 5. Create encryption key for local storage
    const storageKeyResult = deriveKey(masterKeyResult.data, 'local-storage-v1');
    if (!storageKeyResult.data) {
      return {
        data: null,
        error: storageKeyResult.error,
        message: 'Failed to derive storage encryption key',
      };
    }

    // 6. Encrypt private key for storage
    const encryptResult = await encryptData(keyPairResult.data.privateKey, storageKeyResult.data);
    if (!encryptResult.data) {
      return {
        data: null,
        error: encryptResult.error,
        message: encryptResult.message,
      };
    }

    // 7. Convert to base64 for storage
    const publicKeyB64 = toBase64(keyPairResult.data.publicKey);
    const encryptedPrivateKeyB64 = toBase64(encryptResult.data.encrypted);
    const saltB64 = toBase64(saltResult.data);
    const ivB64 = toBase64(encryptResult.data.iv);

    if (!publicKeyB64.data || !encryptedPrivateKeyB64.data || !saltB64.data || !ivB64.data) {
      return {
        data: null,
        error: new Error('Base64 encoding failed'),
        message: 'Failed to encode keys for storage',
      };
    }

    return {
      data: {
        publicKey: publicKeyB64.data,
        privateKeyEncrypted: encryptedPrivateKeyB64.data,
        salt: saltB64.data,
        iv: ivB64.data,
      },
      error: null,
      message: 'Organization keys created successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to create organization keys',
    };
  }
}

// retrieve and decrypt organization private key
export async function retrieveOrgPrivateKey(
  passphrase: string,
  storedKeys: StoredOrgKeys,
): Promise<CryptoResult<Uint8Array>> {
  try {
    if (!passphrase || passphrase.length < 12) {
      return {
        data: null,
        error: new Error('Invalid passphrase'),
        message: 'Passphrase must be at least 12 characters long',
      };
    }

    if (!storedKeys.salt || !storedKeys.privateKeyEncrypted || !storedKeys.iv) {
      return {
        data: null,
        error: new Error('Incomplete stored keys'),
        message: 'Stored keys are incomplete or corrupted',
      };
    }

    // 1. Decode base64 strings
    const saltResult = fromBase64(storedKeys.salt);
    const encryptedPrivateKeyResult = fromBase64(storedKeys.privateKeyEncrypted);
    const ivResult = fromBase64(storedKeys.iv);

    if (!saltResult.data || !encryptedPrivateKeyResult.data || !ivResult.data) {
      return {
        data: null,
        error: new Error('Base64 decoding failed'),
        message: 'Failed to decode stored keys',
      };
    }

    // 2. Reconstruct master key
    const masterKeyResult = await deriveMasterKey(passphrase, saltResult.data);
    if (!masterKeyResult.data) {
      return {
        data: null,
        error: masterKeyResult.error,
        message: masterKeyResult.message,
      };
    }

    // 3. Derive storage encryption key
    const storageKeyResult = deriveKey(masterKeyResult.data, 'local-storage-v1');
    if (!storageKeyResult.data) {
      return {
        data: null,
        error: storageKeyResult.error,
        message: 'Failed to derive storage decryption key',
      };
    }

    // 4. Decrypt private key
    const decryptResult = await decryptData(
      encryptedPrivateKeyResult.data,
      storageKeyResult.data,
      ivResult.data,
    );

    if (!decryptResult.data) {
      // Specifically handle wrong passphrase case
      if (decryptResult.message === 'Incorrect passphrase or corrupted data') {
        return {
          data: null,
          error: decryptResult.error,
          message: 'Incorrect master passphrase',
        };
      }
      return decryptResult;
    }

    return {
      data: decryptResult.data,
      error: null,
      message: 'Organization private key retrieved successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to retrieve organization private key',
    };
  }
}

// Sign data with Ed25519 private key
export function signData(data: Uint8Array, privateKey: Uint8Array): CryptoResult<Uint8Array> {
  try {
    if (!data || data.length === 0) {
      return {
        data: null,
        error: new Error('No data to sign'),
        message: 'No data provided for signing',
      };
    }

    if (!privateKey || privateKey.length !== 32) {
      return {
        data: null,
        error: new Error('Invalid private key'),
        message: 'Invalid private key for signing',
      };
    }

    const signature = ed25519.sign(data, privateKey);
    return {
      data: signature,
      error: null,
      message: 'Data signed successfully',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to sign data',
    };
  }
}

// verify signature with Ed25519 public key
export function verifySignature(
  signature: Uint8Array,
  data: Uint8Array,
  publicKey: Uint8Array,
): CryptoResult<boolean> {
  try {
    if (!signature || !data || !publicKey) {
      return {
        data: null,
        error: new Error('Missing parameters'),
        message: 'Missing signature, data, or public key for verification',
      };
    }

    const isValid = ed25519.verify(signature, data, publicKey);
    return {
      data: isValid,
      error: null,
      message: isValid ? 'Signature verified successfully' : 'Signature verification failed',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to verify signature',
    };
  }
}

// secure memory wipe
export function secureWipe(buffer: Uint8Array): CryptoResult<null> {
  try {
    if (!buffer) {
      return {
        data: null,
        error: null,
        message: 'No buffer provided for wiping',
      };
    }

    // Fill with random data
    crypto.getRandomValues(buffer);
    // Fill with zeros
    buffer.fill(0);

    return {
      data: null,
      error: null,
      message: 'Memory wiped securely',
    };
  } catch (error) {
    return {
      data: null,
      error,
      message: 'Failed to wipe memory securely',
    };
  }
}
