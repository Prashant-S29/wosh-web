'use server';

import crypto from 'crypto';
import { encryptKeys } from './generateKeys';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

interface CLITokenData {
  hashKeys: string;
  orgId: string;
  projectId: string;
}

interface GenerateCLITokenResult {
  data: { token: string } | null;
  error: string | null;
  message: string;
}

export interface GenerateCLITokenParams {
  masterPassphrase: string;
  pin?: string;
  orgId: string;
  projectId: string;
}

export async function generateCLIToken({
  masterPassphrase,
  pin,
  orgId,
  projectId,
}: {
  masterPassphrase: string;
  pin?: string;
  orgId: string;
  projectId: string;
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

    const hashKeysResponse = encryptKeys({
      masterPassphrase,
      ...(pin ? { pin } : {}),
    });

    if (hashKeysResponse.error || !hashKeysResponse.data) {
      return {
        data: null,
        error: hashKeysResponse.error,
        message: hashKeysResponse.message,
      };
    }

    const tokenData: CLITokenData = {
      hashKeys: hashKeysResponse.data,
      orgId,
      projectId,
    };

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    const key = crypto.scryptSync(cliTokenHash, salt, 32, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

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
