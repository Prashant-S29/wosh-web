'use server';

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

interface CLITokenData {
  masterPassphrase: string;
  pin?: string;
}

export async function generateCLIToken({
  masterPassphrase,
  pin,
}: {
  masterPassphrase: string;
  pin?: string;
}) {
  try {
    const cliTokenHash = process.env.CLI_TOKEN_HASH;

    if (!cliTokenHash) {
      console.error('CRITICAL: CLI_TOKEN_HASH environment variable is not set');
      return {
        data: null,
        error: 'Server configuration error',
        message: 'Failed to generate CLI token',
      };
    }

    // Prepare the data to encrypt
    const tokenData: CLITokenData = {
      masterPassphrase,
      ...(pin ? { pin } : {}),
    };

    const deterministicSaltSource = `${masterPassphrase}-${pin || 'no-pin'}`;
    const salt = crypto.createHash('sha256').update(deterministicSaltSource).digest();

    const key = crypto.scryptSync(cliTokenHash, salt, 32);

    const ivHash = crypto.createHash('sha256').update(deterministicSaltSource).digest();
    const iv = ivHash.subarray(0, IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the token data
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokenData), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([encrypted, authTag]);

    const token = combined.toString('base64url');

    console.log('CLI token generated successfully');

    return {
      data: {
        token,
        salt: salt.toString('base64url'),
      },
      error: null,
      message: 'CLI token generated successfully',
    };
  } catch (error) {
    console.error('Failed to generate CLI token:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to generate CLI token',
    };
  }
}

export async function decryptCLIToken({
  token,
  masterPassphrase,
  pin,
}: {
  token: string;
  masterPassphrase: string;
  pin?: string;
}): Promise<{
  data: { masterPassphrase: string; pin?: string } | null;
  error: string | null;
  message: string;
}> {
  try {
    const cliTokenHash = process.env.CLI_TOKEN_HASH;

    if (!cliTokenHash) {
      console.error('CRITICAL: CLI_TOKEN_HASH environment variable is not set');
      return {
        data: null,
        error: 'Server configuration error',
        message: 'Failed to decrypt CLI token',
      };
    }

    // Decode the token from URL-safe base64
    const combined = Buffer.from(token, 'base64url');

    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);

    const deterministicSaltSource = `${masterPassphrase}-${pin || 'no-pin'}`;
    const salt = crypto.createHash('sha256').update(deterministicSaltSource).digest();

    const key = crypto.scryptSync(cliTokenHash, salt, 32);

    const ivHash = crypto.createHash('sha256').update(deterministicSaltSource).digest();
    const iv = ivHash.subarray(0, IV_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Parse JSON
    const tokenData: CLITokenData = JSON.parse(decrypted.toString('utf8'));

    // Verify the decrypted credentials match what was provided
    if (tokenData.masterPassphrase !== masterPassphrase || (tokenData.pin || '') !== (pin || '')) {
      return {
        data: null,
        error: 'Authentication failed',
        message: 'Invalid credentials',
      };
    }

    return {
      data: {
        masterPassphrase: tokenData.masterPassphrase,
        pin: tokenData.pin || '',
      },
      error: null,
      message: 'CLI token decrypted successfully',
    };
  } catch (error) {
    console.error('Failed to decrypt CLI token:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to decrypt CLI token',
      message: 'Invalid or corrupted CLI token',
    };
  }
}

/**
 * Validates that a CLI token has correct format
 */
export async function validateCLIToken({ token }: { token: string }): Promise<{
  valid: boolean;
  error: string | null;
}> {
  try {
    const cliTokenHash = process.env.CLI_TOKEN_HASH;

    if (!cliTokenHash) {
      return { valid: false, error: 'Server configuration error' };
    }

    // Verify token format
    const combined = Buffer.from(token, 'base64url');

    // Minimum length: 16 (auth tag) + some encrypted data
    if (combined.length < 16 + 32) {
      return { valid: false, error: 'Invalid token format' };
    }

    return { valid: true, error: null };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}
