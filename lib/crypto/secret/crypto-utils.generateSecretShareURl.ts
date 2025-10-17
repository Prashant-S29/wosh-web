'use server';

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

interface ShareData {
  organizationId: string;
  projectId: string;
  masterPassphrase: string;
  pin?: string;
  timestamp: number;
}

/**
 * Server Action: Generates a secure, unique share URL token
 * The token is encrypted and can be decrypted using the same salt
 */
export async function generateShareTokenAndCode({
  orgId,
  projectId,
  masterPassphrase,
  pin,
}: {
  orgId: string;
  projectId: string;
  masterPassphrase: string;
  pin?: string;
}) {
  try {
    const salt = process.env.SECRET_HASH_SALT;

    if (!salt) {
      return {
        data: null,
        error: 'SECRET_HASH_SALT environment variable is not set',
        message: 'Failed to generate share token',
      };
    }

    const data: ShareData = {
      organizationId: orgId,
      projectId: projectId,
      masterPassphrase,
      ...(pin ? { pin } : {}),

      timestamp: Date.now(),
    };

    // Generate a random IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from salt
    const key = crypto.scryptSync(salt, 'share-token', 32);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([iv, encrypted, authTag]);

    // Convert to URL-safe base64
    const token = combined.toString('base64url');

    // get code
    const code = await generateSecretSharingCode({ orgId, projectId });

    console.log('Share token and code generated successfully');

    return {
      data: { token, code },
      error: null,
      message: 'Share token and code generated successfully',
    };
  } catch (error) {
    console.error('Failed to generate share token and code:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to generate share token and code',
    };
  }
}

/**
 * Server Action: Decrypts a share token to get the original organization and project IDs
 */
export async function decryptShareToken(token: string) {
  try {
    const salt = process.env.SECRET_HASH_SALT;

    if (!salt) {
      return {
        data: null,
        error: 'SECRET_HASH_SALT environment variable is not set',
        message: 'Failed to decrypt share token',
      };
    }

    // Decode from URL-safe base64
    const combined = Buffer.from(token, 'base64url');

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

    // Derive key from salt
    const key = crypto.scryptSync(salt, 'share-token', 32);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Parse JSON
    const data: ShareData = JSON.parse(decrypted.toString('utf8'));

    return {
      data: {
        organizationId: data.organizationId,
        projectId: data.projectId,
        timestamp: data.timestamp,
      },
      error: null,
      message: 'Share token decrypted successfully',
    };
  } catch (error) {
    console.error('Failed to decrypt share token:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to decrypt share token',
      message: 'Failed to decrypt share token',
    };
  }
}

export const generateSecretSharingCode = async ({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId: string;
}) => {
  const randomBytes = crypto.randomBytes(6).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(`${orgId}-${projectId}-${Date.now()}-${randomBytes}`)
    .digest('hex');

  const code = BigInt('0x' + hash)
    .toString()
    .slice(0, 12);
  return code;
};

/**
 * Generates the complete share URL (can be used client or server side)
 */
export async function getShareUrl(token: string) {
  return `https://vault.wosh.app/share/${token}`;
}
