import crypto from 'crypto';

interface KeyData {
  masterPassphrase: string;
  pin?: string;
}

interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
  salt: string;
}

export function encryptKeys(data: KeyData) {
  const SALT = process.env.KEYS_ENCRYPTION_SALT;

  if (!SALT || SALT.length < 32) {
    return {
      data: null,
      error: 'KEYS_ENCRYPTION_SALT must be set and at least 32 characters',
      message: 'Failed to encrypt keys',
    };
  }

  const plaintext = JSON.stringify(data);
  const keySalt = crypto.randomBytes(32);

  const derivedKey = crypto.pbkdf2Sync(SALT, keySalt, 600000, 32, 'sha512');

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  const result: EncryptedData = {
    encryptedData: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: keySalt.toString('base64'),
  };

  const hashKeys = Buffer.from(JSON.stringify(result)).toString('base64');
  return {
    data: hashKeys,
    error: null,
    message: 'Keys encrypted successfully',
  };
}
