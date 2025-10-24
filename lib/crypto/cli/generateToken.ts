'use server';

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

interface CLITokenData {
  masterPassphrase: string;
  pin?: string;
  orgInfo: { id: string; name: string };
  projectInfo: { id: string; name: string };
}

interface GenerateCLITokenResult {
  data: { token: string } | null;
  error: string | null;
  message: string;
}

interface DecryptCLITokenResult {
  data: CLITokenData | null;
  error: string | null;
  message: string;
}

export async function generateCLIToken({
  masterPassphrase,
  pin,
  orgInfo,
  projectInfo,
}: {
  masterPassphrase: string;
  pin?: string;
  orgInfo: { id: string; name: string };
  projectInfo: { id: string; name: string };
}): Promise<GenerateCLITokenResult> {
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
      orgInfo,
      projectInfo,
    };

    // Create deterministic salt from the token data
    const saltSource = JSON.stringify({
      masterPassphrase,
      pin: pin || '',
      orgId: orgInfo.id,
      projectId: projectInfo.id,
    });
    const salt = crypto.createHash('sha256').update(saltSource).digest();

    // Create deterministic IV from the token data
    const ivSource = `${saltSource}-iv`;
    const ivHash = crypto.createHash('sha256').update(ivSource).digest();
    const iv = ivHash.subarray(0, IV_LENGTH);

    // Derive key from CLI_TOKEN_HASH and salt
    const key = crypto.scryptSync(cliTokenHash, salt, 32);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the token data
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokenData), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + encrypted + authTag
    const combined = Buffer.concat([salt, iv, encrypted, authTag]);

    // Encode as base64url for safe transport
    const token = combined.toString('base64url');

    console.log('CLI token generated successfully');

    return {
      data: { token },
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
}: {
  token: string;
}): Promise<DecryptCLITokenResult> {
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

    // Verify minimum length
    const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
    if (combined.length < minLength) {
      return {
        data: null,
        error: 'Invalid token format',
        message: 'Token is too short or corrupted',
      };
    }

    // Extract components: salt + iv + encrypted + authTag
    let offset = 0;
    const salt = combined.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = combined.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(offset, combined.length - AUTH_TAG_LENGTH);

    // Derive the same key using CLI_TOKEN_HASH and extracted salt
    const key = crypto.scryptSync(cliTokenHash, salt, 32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Parse JSON
    const tokenData: CLITokenData = JSON.parse(decrypted.toString('utf8'));

    return {
      data: tokenData,
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

    // Minimum length: salt + iv + auth tag + some encrypted data
    const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
    if (combined.length < minLength) {
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
