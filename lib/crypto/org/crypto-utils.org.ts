import { ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes } from '@noble/hashes/utils';
import { MKDFConfig, OrganizationKeyPair, StoredOrgKeysMKDF } from '@/types/encryptions';

type CryptoResult<T> = {
  data: T | null;
  error: string | null;
  message: string;
};

// MKDF specific types
export interface MKDFFactors {
  factor1: Uint8Array; // Passphrase-derived
  factor2?: Uint8Array; // Device-derived
  factor3?: Uint8Array | null | undefined; // PIN/Biometric-derived
}

// Generate a cryptographically secure salt
export function generateSalt(): CryptoResult<Uint8Array> {
  try {
    const salt = randomBytes(32);
    return {
      data: salt,
      error: null,
      message: 'Salt generated successfully',
    };
  } catch (error) {
    console.error('Failed to generate cryptographic salt:', error);
    return {
      data: null,
      error: 'Failed to generate cryptographic salt',
      message: 'Failed to generate cryptographic salt',
    };
  }
}

// Derive factor 1: Passphrase-based key (unchanged from original)
export async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 100000,
): Promise<CryptoResult<Uint8Array>> {
  try {
    if (!passphrase || passphrase.length < 12) {
      return {
        data: null,
        error: 'Invalid passphrase',
        message: 'Passphrase must be at least 12 characters long',
      };
    }

    if (!salt || salt.length !== 32) {
      return {
        data: null,
        error: 'Invalid salt',
        message: 'Invalid salt provided for key derivation',
      };
    }

    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);

    const factor1 = pbkdf2(sha256, passphraseBytes, salt, {
      c: iterations,
      dkLen: 32,
    });

    return {
      data: factor1,
      error: null,
      message: 'Passphrase factor derived successfully',
    };
  } catch (error) {
    console.error('Failed to derive passphrase factor:', error);
    return {
      data: null,
      error: 'Failed to derive passphrase factor',
      message: 'Failed to derive passphrase factor',
    };
  }
}

// Derive factor 2: Device-based key
export function deriveDeviceKey(
  deviceFingerprint: string,
  deviceSalt: Uint8Array,
): CryptoResult<Uint8Array> {
  try {
    if (!deviceFingerprint || deviceFingerprint.length < 10) {
      return {
        data: null,
        error: 'Invalid device fingerprint',
        message: 'Device fingerprint is too short or invalid',
      };
    }

    if (!deviceSalt || deviceSalt.length !== 32) {
      return {
        data: null,
        error: 'Invalid device salt',
        message: 'Invalid device salt provided',
      };
    }

    const encoder = new TextEncoder();
    const fingerprintBytes = encoder.encode(deviceFingerprint);

    // Use HKDF to derive device factor
    const factor2 = hkdf(
      sha256,
      fingerprintBytes,
      deviceSalt,
      encoder.encode('wosh-device-factor-v1'),
      32,
    );

    return {
      data: factor2,
      error: null,
      message: 'Device factor derived successfully',
    };
  } catch (error) {
    console.error('Failed to derive device factor:', error);
    return {
      data: null,
      error: 'Failed to derive device factor',
      message: 'Failed to derive device factor',
    };
  }
}

// Derive factor 3: PIN/Biometric-based key
export async function derivePinKey(
  pin: string,
  pinSalt: Uint8Array,
  iterations: number = 50000,
): Promise<CryptoResult<Uint8Array>> {
  try {
    if (!pin || pin.length < 4) {
      return {
        data: null,
        error: 'Invalid PIN',
        message: 'PIN must be at least 4 characters long',
      };
    }

    if (!pinSalt || pinSalt.length !== 32) {
      return {
        data: null,
        error: 'Invalid PIN salt',
        message: 'Invalid PIN salt provided',
      };
    }

    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);

    // Use fewer iterations for PIN as it's typically shorter
    const factor3 = pbkdf2(sha256, pinBytes, pinSalt, {
      c: iterations,
      dkLen: 32,
    });

    return {
      data: factor3,
      error: null,
      message: 'PIN factor derived successfully',
    };
  } catch (error) {
    console.error('Failed to derive PIN factor:', error);
    return {
      data: null,
      error: 'Failed to derive PIN factor',
      message: 'Failed to derive PIN factor',
    };
  }
}

// Combine multiple factors using XOR and HKDF
export function combineMKDFFactors(
  factors: MKDFFactors,
  combinationSalt: Uint8Array,
): CryptoResult<Uint8Array> {
  try {
    if (!factors.factor1) {
      return {
        data: null,
        error: 'Factor 1 required',
        message: 'Passphrase factor is required',
      };
    }

    if (!combinationSalt || combinationSalt.length !== 32) {
      return {
        data: null,
        error: 'Invalid combination salt',
        message: 'Invalid salt for factor combination',
      };
    }

    // Start with factor 1
    const combinedEntropy = new Uint8Array(factors.factor1);

    // XOR with factor 2 if present
    if (factors.factor2) {
      for (let i = 0; i < 32; i++) {
        combinedEntropy[i] ^= factors.factor2[i];
      }
    }

    // XOR with factor 3 if present
    if (factors.factor3) {
      for (let i = 0; i < 32; i++) {
        combinedEntropy[i] ^= factors.factor3[i];
      }
    }

    // Use HKDF to derive final master key
    const encoder = new TextEncoder();
    const masterKey = hkdf(
      sha256,
      combinedEntropy,
      combinationSalt,
      encoder.encode('wosh-mkdf-master-v1'),
      32,
    );

    // Secure wipe the combined entropy
    secureWipe(combinedEntropy);

    return {
      data: masterKey,
      error: null,
      message: 'MKDF factors combined successfully',
    };
  } catch (error) {
    console.error('Failed to combine MKDF factors:', error);
    return {
      data: null,
      error: 'Failed to combine MKDF factors',
      message: 'Failed to combine MKDF factors',
    };
  }
}

// Original functions (unchanged but renamed for clarity)
export function deriveKey(masterKey: Uint8Array, infoString: string): CryptoResult<Uint8Array> {
  try {
    if (!masterKey || masterKey.length !== 32) {
      return {
        data: null,
        error: 'Invalid master key',
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
    console.error(`Failed to derive key with context "${infoString}":`, error);
    return {
      data: null,
      error: 'Failed to derive key with context',
      message: `Failed to derive key with context "${infoString}"`,
    };
  }
}

// Generate Ed25519 key pair for organization (unchanged)
export function generateOrgKeyPair(privateKeySeed?: Uint8Array): CryptoResult<OrganizationKeyPair> {
  try {
    let privateKey: Uint8Array;

    if (privateKeySeed) {
      if (privateKeySeed.length !== 32) {
        return {
          data: null,
          error: 'Invalid private key seed',
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
    console.error('Failed to generate organization key pair:', error);
    return {
      data: null,
      error: 'Failed to generate organization key pair',
      message: 'Failed to generate organization key pair',
    };
  }
}

// Convert bytes to base64 string (unchanged)
export function toBase64(bytes: Uint8Array): CryptoResult<string> {
  try {
    if (!bytes || bytes.length === 0) {
      return {
        data: null,
        error: 'Invalid bytes',
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
    console.error('Failed to encode bytes to base64:', error);
    return {
      data: null,
      error: 'Failed to encode bytes to base64',
      message: 'Failed to encode bytes to base64',
    };
  }
}

// Convert base64 string to bytes (unchanged)
export function fromBase64(base64: string): CryptoResult<Uint8Array> {
  try {
    if (!base64 || typeof base64 !== 'string') {
      return {
        data: null,
        error: 'Invalid base64',
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
    console.error('Failed to decode base64 string:', error);
    return {
      data: null,
      error: 'Failed to decode base64 string',
      message: 'Failed to decode base64 string',
    };
  }
}

// Encrypt data using AES-GCM (unchanged)
export async function encryptData(
  data: Uint8Array,
  key: Uint8Array,
): Promise<CryptoResult<{ encrypted: Uint8Array; iv: Uint8Array }>> {
  try {
    if (!data || data.length === 0) {
      return {
        data: null,
        error: 'No data to encrypt',
        message: 'No data provided for encryption',
      };
    }

    if (!key || key.length !== 32) {
      return {
        data: null,
        error: 'Invalid encryption key',
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
    console.error('Failed to encrypt data:', error);
    return {
      data: null,
      error: 'Failed to encrypt data',
      message: 'Failed to encrypt data',
    };
  }
}

// Decrypt data using AES-GCM (unchanged)
export async function decryptData(
  encryptedData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<CryptoResult<Uint8Array>> {
  try {
    if (!encryptedData || encryptedData.length === 0) {
      return {
        data: null,
        error: 'No encrypted data',
        message: 'No encrypted data provided for decryption',
      };
    }

    if (!key || key.length !== 32) {
      return {
        data: null,
        error: 'Invalid decryption key',
        message: 'Decryption key must be 32 bytes',
      };
    }

    if (!iv || iv.length !== 12) {
      return {
        data: null,
        error: 'Invalid IV',
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
      console.error('[OperationError] Failed to decrypt data:', error);
      return {
        data: null,
        error: 'Failed to decrypt data',
        message: 'Incorrect passphrase or corrupted data',
      };
    }

    console.error(' Failed to decrypt data:', error);

    return {
      data: null,
      error: 'Failed to decrypt data',
      message: 'Failed to decrypt data',
    };
  }
}

// MKDF: Create organization keys with multi-factor security
export async function createOrganizationKeysMKDF(
  passphrase: string,
  deviceFingerprint: string,
  pin?: string,
  config?: Partial<MKDFConfig>,
): Promise<CryptoResult<StoredOrgKeysMKDF>> {
  try {
    // Default MKDF configuration
    const mkdfConfig: MKDFConfig = {
      requiredFactors: 2,
      enabledFactors: pin ? ['passphrase', 'device', 'pin'] : ['passphrase', 'device'],
      ...config,
    };

    // 1. Generate all required salts
    const mainSaltResult = generateSalt();
    const deviceSaltResult = generateSalt();
    const pinSaltResult = pin ? generateSalt() : null;
    const combinationSaltResult = generateSalt();

    if (!mainSaltResult.data || !deviceSaltResult.data || !combinationSaltResult.data) {
      return {
        data: null,
        error: 'Salt generation failed',
        message: 'Failed to generate required salts',
      };
    }

    // 2. Derive Factor 1: Passphrase
    const factor1Result = await derivePassphraseKey(passphrase, mainSaltResult.data);
    if (!factor1Result.data) {
      return {
        data: null,
        error: factor1Result.error,
        message: factor1Result.message,
      };
    }

    // 3. Derive Factor 2: Device
    const factor2Result = deriveDeviceKey(deviceFingerprint, deviceSaltResult.data);
    if (!factor2Result.data) {
      return {
        data: null,
        error: factor2Result.error,
        message: factor2Result.message,
      };
    }

    // 4. Derive Factor 3: PIN (optional)
    let factor3Result: CryptoResult<Uint8Array> | null = null;
    if (pin && pinSaltResult?.data) {
      factor3Result = await derivePinKey(pin, pinSaltResult.data);
      if (!factor3Result.data) {
        return {
          data: null,
          error: factor3Result.error,
          message: factor3Result.message,
        };
      }
    }

    // 5. Combine factors
    const factors: MKDFFactors = {
      factor1: factor1Result.data,
      factor2: factor2Result.data,
      factor3: factor3Result?.data,
    };

    const masterKeyResult = combineMKDFFactors(factors, combinationSaltResult.data);
    if (!masterKeyResult.data) {
      return {
        data: null,
        error: masterKeyResult.error,
        message: masterKeyResult.message,
      };
    }

    // 6. Generate organization key pair
    const orgPrivateKeyResult = deriveKey(masterKeyResult.data, 'org-signing-v1');
    if (!orgPrivateKeyResult.data) {
      return {
        data: null,
        error: orgPrivateKeyResult.error,
        message: orgPrivateKeyResult.message,
      };
    }

    const keyPairResult = generateOrgKeyPair(orgPrivateKeyResult.data);
    if (!keyPairResult.data) {
      return {
        data: null,
        error: keyPairResult.error,
        message: keyPairResult.message,
      };
    }

    // 7. Create storage encryption key
    const storageKeyResult = deriveKey(masterKeyResult.data, 'local-storage-v1');
    if (!storageKeyResult.data) {
      return {
        data: null,
        error: storageKeyResult.error,
        message: 'Failed to derive storage encryption key',
      };
    }

    // 8. Encrypt private key for storage
    const encryptResult = await encryptData(keyPairResult.data.privateKey, storageKeyResult.data);
    if (!encryptResult.data) {
      return {
        data: null,
        error: encryptResult.error,
        message: encryptResult.message,
      };
    }

    // 9. Encrypt device factor for storage
    const deviceKeyEncryptResult = await encryptData(factor2Result.data, storageKeyResult.data);
    if (!deviceKeyEncryptResult.data) {
      return {
        data: null,
        error: deviceKeyEncryptResult.error,
        message: 'Failed to encrypt device factor',
      };
    }

    // 10. Convert to base64 for storage
    const publicKeyB64 = toBase64(keyPairResult.data.publicKey);
    const encryptedPrivateKeyB64 = toBase64(encryptResult.data.encrypted);
    const mainSaltB64 = toBase64(mainSaltResult.data);
    const ivB64 = toBase64(encryptResult.data.iv);
    const deviceKeyEncryptedB64 = toBase64(deviceKeyEncryptResult.data.encrypted);
    const deviceKeyIvB64 = toBase64(deviceKeyEncryptResult.data.iv);
    const deviceKeySaltB64 = toBase64(deviceSaltResult.data);
    const combinationSaltB64 = toBase64(combinationSaltResult.data);
    const pinSaltB64 = pinSaltResult?.data ? toBase64(pinSaltResult.data) : { data: null };

    if (
      !publicKeyB64.data ||
      !encryptedPrivateKeyB64.data ||
      !mainSaltB64.data ||
      !ivB64.data ||
      !deviceKeyEncryptedB64.data ||
      !deviceKeyIvB64.data ||
      !deviceKeySaltB64.data
    ) {
      return {
        data: null,
        error: 'Base64 encoding failed',
        message: 'Failed to encode keys for storage',
      };
    }

    // 11. Secure cleanup
    secureWipe(factor1Result.data);
    secureWipe(factor2Result.data);
    if (factor3Result?.data) secureWipe(factor3Result.data);
    secureWipe(masterKeyResult.data);

    if (!combinationSaltB64.data) {
      return {
        data: null,
        error: 'Missing combination salt',
        message: 'Missing combination salt',
      };
    }

    return {
      data: {
        // Original fields
        publicKey: publicKeyB64.data,
        privateKeyEncrypted: encryptedPrivateKeyB64.data,
        salt: mainSaltB64.data,
        iv: ivB64.data,
        // MKDF specific fields
        mkdfVersion: 1,
        mkdfConfig,
        deviceFingerprint,
        deviceKeyEncrypted: deviceKeyEncryptedB64.data,
        deviceKeyIv: deviceKeyIvB64.data,
        deviceKeySalt: deviceKeySaltB64.data,
        combinationSalt: combinationSaltB64.data,
        ...(pinSaltB64.data ? { pinSalt: pinSaltB64.data } : {}),
      },
      error: null,
      message: 'MKDF organization keys created successfully',
    };
  } catch (error) {
    console.error('Failed to create MKDF organization keys:', error);
    return {
      data: null,
      error: 'Failed to create MKDF organization keys',
      message: 'Failed to create MKDF organization keys',
    };
  }
}

export async function retrieveOrgPrivateKeyMKDF(
  passphrase: string,
  deviceFingerprint: string,
  pin: string | undefined,
  storedKeys: StoredOrgKeysMKDF,
): Promise<CryptoResult<Uint8Array>> {
  try {
    // Validate inputs
    if (!passphrase || passphrase.length < 12) {
      return {
        data: null,
        error: 'Invalid passphrase',
        message: 'Passphrase must be at least 12 characters long',
      };
    }

    if (!deviceFingerprint) {
      return {
        data: null,
        error: 'Device fingerprint required',
        message: 'Device fingerprint is required for MKDF',
      };
    }

    // Validate basic stored keys
    if (
      !storedKeys.salt ||
      !storedKeys.privateKeyEncrypted ||
      !storedKeys.iv ||
      !storedKeys.deviceKeySalt ||
      !storedKeys.deviceFingerprint ||
      !storedKeys.combinationSalt // Must have combination salt
    ) {
      return {
        data: null,
        error: 'Incomplete MKDF keys',
        message: 'MKDF keys are missing required fields',
      };
    }

    // Verify device fingerprint matches
    if (storedKeys.deviceFingerprint !== deviceFingerprint) {
      return {
        data: null,
        error: 'Device mismatch',
        message: 'Device mismatch',
      };
    }

    // Check if PIN is required but not provided
    const requiresPin = storedKeys.mkdfConfig.enabledFactors.includes('pin');
    if (requiresPin && !pin) {
      return {
        data: null,
        error: 'PIN required',
        message: 'PIN is required',
      };
    }

    if (requiresPin && !storedKeys.pinSalt) {
      return {
        data: null,
        error: 'PIN salt missing',
        message: 'PIN salt is required but not found in stored keys',
      };
    }

    // Decode base64 strings - USE THE ACTUAL STORED SALTS
    const mainSaltResult = fromBase64(storedKeys.salt);
    const deviceKeySaltResult = fromBase64(storedKeys.deviceKeySalt);
    const combinationSaltResult = fromBase64(storedKeys.combinationSalt); // USE STORED SALT
    const encryptedPrivateKeyResult = fromBase64(storedKeys.privateKeyEncrypted);
    const ivResult = fromBase64(storedKeys.iv);

    if (
      !mainSaltResult.data ||
      !deviceKeySaltResult.data ||
      !combinationSaltResult.data ||
      !encryptedPrivateKeyResult.data ||
      !ivResult.data
    ) {
      return {
        data: null,
        error: 'Base64 decoding failed',
        message: 'Failed to decode stored keys',
      };
    }

    // Decode PIN salt if needed
    let pinSaltResult: CryptoResult<Uint8Array> | null = null;
    if (requiresPin) {
      pinSaltResult = fromBase64(storedKeys.pinSalt!); // USE STORED PIN SALT
      if (!pinSaltResult.data) {
        return {
          data: null,
          error: 'Failed to decode PIN salt',
          message: 'Failed to decode PIN salt',
        };
      }
    }

    // Generate factors using the correct stored salts
    const factor1Result = await derivePassphraseKey(passphrase, mainSaltResult.data);
    if (!factor1Result.data) {
      return {
        data: null,
        error: factor1Result.error,
        message: 'Incorrect passphrase, PIN, or device mismatch',
      };
    }

    const factor2Result = deriveDeviceKey(deviceFingerprint, deviceKeySaltResult.data);
    if (!factor2Result.data) {
      return {
        data: null,
        error: factor2Result.error,
        message: 'Incorrect passphrase, PIN, or device mismatch',
      };
    }

    let factor3Result: CryptoResult<Uint8Array> | null = null;
    if (pin && requiresPin && pinSaltResult?.data) {
      factor3Result = await derivePinKey(pin, pinSaltResult.data); // USE REAL PIN SALT
      if (!factor3Result.data) {
        return {
          data: null,
          error: factor3Result.error,
          message: 'Incorrect passphrase, PIN, or device mismatch',
        };
      }
    }

    // Combine factors using the REAL stored combination salt
    const factors: MKDFFactors = {
      factor1: factor1Result.data,
      factor2: factor2Result.data,
      factor3: factor3Result?.data,
    };

    const masterKeyResult = combineMKDFFactors(factors, combinationSaltResult.data); // USE REAL SALT
    if (!masterKeyResult.data) {
      return {
        data: null,
        error: masterKeyResult.error,
        message: 'Incorrect passphrase, PIN, or device mismatch',
      };
    }

    // Derive storage key
    const storageKeyResult = deriveKey(masterKeyResult.data, 'local-storage-v1');
    if (!storageKeyResult.data) {
      return {
        data: null,
        error: storageKeyResult.error,
        message: 'Failed to derive storage decryption key',
      };
    }

    // Decrypt private key
    const decryptResult = await decryptData(
      encryptedPrivateKeyResult.data,
      storageKeyResult.data,
      ivResult.data,
    );

    // Secure cleanup
    secureWipe(factor1Result.data);
    secureWipe(factor2Result.data);
    if (factor3Result?.data) secureWipe(factor3Result.data);
    secureWipe(masterKeyResult.data);
    secureWipe(storageKeyResult.data);

    if (!decryptResult.data) {
      return {
        data: null,
        error: decryptResult.error,
        message: 'Incorrect passphrase, PIN, or device mismatch',
      };
    }

    return {
      data: decryptResult.data,
      error: null,
      message: 'Organization private key retrieved successfully',
    };
  } catch (error) {
    console.error('MKDF retrieval error:', error);
    return {
      data: null,
      error: 'Incorrect passphrase, PIN, or device mismatch',
      message: 'Incorrect passphrase, PIN, or device mismatch',
    };
  }
}

// Sign data with Ed25519 private key (unchanged)
export function signData(data: Uint8Array, privateKey: Uint8Array): CryptoResult<Uint8Array> {
  try {
    if (!data || data.length === 0) {
      return {
        data: null,
        error: 'No data to sign',
        message: 'No data provided for signing',
      };
    }

    if (!privateKey || privateKey.length !== 32) {
      return {
        data: null,
        error: 'Invalid private key',
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
    console.error('Failed to sign data:', error);
    return {
      data: null,
      error: 'Failed to sign data',
      message: 'Failed to sign data',
    };
  }
}

// Verify signature with Ed25519 public key (unchanged)
export function verifySignature(
  signature: Uint8Array,
  data: Uint8Array,
  publicKey: Uint8Array,
): CryptoResult<boolean> {
  try {
    if (!signature || !data || !publicKey) {
      return {
        data: null,
        error: 'Missing parameters',
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
    console.error('Failed to verify signature:', error);
    return {
      data: null,
      error: 'Failed to verify signature',
      message: 'Failed to verify signature',
    };
  }
}

// Secure memory wipe (unchanged)
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
    console.error('Failed to wipe memory securely:', error);
    return {
      data: null,
      error: 'Failed to wipe memory securely',
      message: 'Failed to wipe memory securely',
    };
  }
}
