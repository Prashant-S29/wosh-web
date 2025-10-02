export interface SecretEncryptionResult {
  ciphertext: string; // Base64 encoded (includes auth tag for GCM)
  nonce: string; // Base64 encoded
}

export interface SecretDecryptionResult {
  plaintext: string;
}

export interface EncryptedSecret {
  keyName: string;
  ciphertext: string;
  nonce: string;
  note?: string | null;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Encrypt a single secret value using AES-256-GCM
 */
export async function encryptSecretValue(
  secretValue: string,
  projectKey: Uint8Array,
  keyName: string,
) {
  try {
    // Convert secret value to bytes
    const plaintext = new TextEncoder().encode(secretValue);

    // Generate random 12-byte nonce for GCM
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Import project key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      projectKey as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );

    // Encrypt with key name as additional authenticated data
    const additionalData = new TextEncoder().encode(keyName);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: additionalData,
      },
      cryptoKey,
      plaintext,
    );

    // AES-GCM automatically appends the 16-byte auth tag to the ciphertext
    // Store the entire encrypted buffer (ciphertext + auth tag)
    const encrypted = new Uint8Array(encryptedBuffer);

    return {
      data: {
        ciphertext: btoa(String.fromCharCode(...encrypted)),
        nonce: btoa(String.fromCharCode(...nonce)),
      },
      error: null,
      message: 'Secret encrypted successfully',
    };
  } catch (error) {
    console.error('Secret encryption failed:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown encryption error'),
      message: 'Failed to encrypt secret',
    };
  }
}

/**
 * Decrypt a single secret value using AES-256-GCM
 */
export async function decryptSecretValue({
  encryptedSecret,
  keyName,
  projectKey,
}: {
  encryptedSecret: SecretEncryptionResult;
  projectKey: Uint8Array;
  keyName: string;
}) {
  try {
    const nonce = new Uint8Array(
      atob(encryptedSecret.nonce)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    // The ciphertext includes the auth tag (last 16 bytes)
    // Decrypt expects the full buffer: ciphertext + auth tag
    const encryptedData = new Uint8Array(
      atob(encryptedSecret.ciphertext)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    // Import project key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      projectKey as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    // Decrypt with key name as additional authenticated data
    const additionalData = new TextEncoder().encode(keyName);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: additionalData,
      },
      cryptoKey,
      encryptedData, // This includes both ciphertext and auth tag
    );

    const plaintext = new TextDecoder().decode(decryptedBuffer);

    return {
      data: { plaintext },
      error: null,
      message: 'Secret decrypted successfully',
    };
  } catch (error) {
    console.error('Secret decryption failed:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown decryption error'),
      message: 'Failed to decrypt secret. Key may be incorrect or data corrupted.',
    };
  }
}

/**
 * Encrypt multiple secrets in batch
 */
export async function encryptSecretsArray(
  secrets: Array<{ key: string; value?: string | undefined; note?: string | undefined }>,
  projectKey: Uint8Array,
) {
  try {
    const encryptedSecrets: EncryptedSecret[] = [];

    for (const secret of secrets) {
      // Skip empty values - treat as valid but don't encrypt
      if (secret.value === '') {
        encryptedSecrets.push({
          keyName: secret.key,
          ciphertext: '',
          nonce: '',
          note: secret.note || '',
          metadata: { isEmpty: true },
        });
        continue;
      }

      const encryptResult = await encryptSecretValue(secret?.value ?? '', projectKey, secret.key);

      if (encryptResult.error || !encryptResult.data) {
        return {
          data: null,
          error: encryptResult.error || new Error('Encryption failed'),
          message: `Failed to encrypt secret: ${secret.key}`,
        };
      }

      encryptedSecrets.push({
        keyName: secret.key,
        ciphertext: encryptResult.data.ciphertext,
        nonce: encryptResult.data.nonce,
        note: secret.note || '',
        metadata: {
          algorithm: 'aes-256-gcm',
          version: 1,
          isEmpty: false,
        },
      });
    }

    return {
      data: encryptedSecrets,
      error: null,
      message: `Successfully encrypted ${encryptedSecrets.length} secrets`,
    };
  } catch (error) {
    console.error('Batch secret encryption failed:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown batch encryption error'),
      message: 'Failed to encrypt secrets in batch',
    };
  }
}

/**
 * Decrypt multiple secrets in batch
 */
export async function decryptSecretsArray({
  encryptedSecrets,
  projectKey,
}: {
  encryptedSecrets: EncryptedSecret[];
  projectKey: Uint8Array;
}) {
  try {
    const decryptedSecrets: Array<{
      key: string;
      value?: string | undefined;
      note?: string | undefined | null;
    }> = [];

    for (const encrypted of encryptedSecrets) {
      // Handle empty values
      if (encrypted.metadata?.isEmpty || (!encrypted.ciphertext && !encrypted.nonce)) {
        decryptedSecrets.push({
          key: encrypted.keyName,
          value: '',
          note: encrypted.note,
        });
        continue;
      }

      const decryptResult = await decryptSecretValue({
        encryptedSecret: {
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
        },
        projectKey,
        keyName: encrypted.keyName,
      });

      if (decryptResult.error || !decryptResult.data) {
        return {
          data: null,
          error: decryptResult.error || new Error('Decryption failed'),
          message: `Failed to decrypt secret: ${encrypted.keyName}`,
        };
      }

      decryptedSecrets.push({
        key: encrypted.keyName,
        value: decryptResult.data.plaintext,
        note: encrypted.note,
      });
    }

    return {
      data: decryptedSecrets,
      error: null,
      message: `Successfully decrypted ${decryptedSecrets.length} secrets`,
    };
  } catch (error) {
    console.error('Batch secret decryption failed:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown batch decryption error'),
      message: 'Failed to decrypt secrets in batch',
    };
  }
}

/**
 * Secure memory wipe for sensitive data
 */
export function secureWipeSecrets(secrets: Array<{ value: string }>): void {
  try {
    secrets.forEach((secret) => {
      if (secret.value) {
        secret.value = '';
      }
    });
  } catch (error) {
    console.warn('Failed to securely wipe secrets from memory:', error);
  }
}
