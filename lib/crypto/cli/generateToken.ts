'use server';

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

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
