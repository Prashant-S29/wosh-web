// types/encryptions.ts - Updated with MKDF types
export interface OrganizationKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface StoredOrgKeys {
  publicKey: string;
  privateKeyEncrypted: string;
  salt: string;
  iv: string;
}

// New MKDF types
export interface MKDFFactors {
  factor1: Uint8Array; // Passphrase-derived
  factor2?: Uint8Array | undefined; // Device-derived
  factor3?: Uint8Array | null | undefined; // PIN/Biometric-derived
}

export interface MKDFConfig {
  requiredFactors: number;
  enabledFactors: ('passphrase' | 'device' | 'pin')[];
}

export interface StoredOrgKeysMKDF extends StoredOrgKeys {
  mkdfVersion: number;
  mkdfConfig: MKDFConfig;
  deviceFingerprint?: string;
  deviceKeyEncrypted?: string;
  deviceKeyIv?: string;
  deviceKeySalt?: string;
  combinationSalt: string;
  pinSalt?: string;
}

// Device registration types
export interface DeviceRegistration {
  id: string;
  organizationId: string;
  userId: string;
  deviceName: string;
  deviceFingerprint: string;
  publicKey: string;
  encryptedDeviceKey: string;
  keyDerivationSalt: string;
  encryptionIv: string;
  isActive: boolean;
  lastUsed: Date;
  createdAt: Date;
}

// Device fingerprint types
export interface DeviceInfo {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  colorDepth: number;
  webglVendor: string;
  webglRenderer: string;
  availableMemory?: number;
  storageQuota?: number;
  canvasFingerprint: string;
}

export interface DeviceFingerprintResult {
  fingerprint: string;
  deviceInfo: DeviceInfo;
  confidence: 'high' | 'medium' | 'low';
}

// API Request/Response types for MKDF
export interface CreateOrganizationRequestMKDF {
  name: string;
  ownerId: string;
  encryptionIv: string;
  keyDerivationSalt: string;
  privateKeyEncrypted: string;
  publicKey: string;
  // MKDF specific fields
  mkdfVersion: number;
  requiredFactors: number;
  factorConfig: MKDFConfig;
  deviceFingerprint: string;
  deviceKeyEncrypted: string;
  deviceKeyIv: string;
  deviceKeySalt: string;
}

export interface OrganizationResponseMKDF {
  id: string;
  name: string;
  ownerId: string;
  publicKey: string;
  mkdfVersion: number;
  requiredFactors: number;
  factorConfig: MKDFConfig;
  createdAt: string;
  updatedAt: string;
}

// Recovery types
export interface RecoveryBackup {
  id: string;
  organizationId: string;
  userId: string;
  backupType: 'recovery_code' | 'trusted_device' | 'emergency_contact';
  encryptedBackup: string;
  backupMetadata: {
    description?: string;
    expiresAt?: string;
    usageLimit?: number;
    usageCount?: number;
  };
  isUsed: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface RecoveryCode {
  code: string;
  description: string;
  createdAt: Date;
}

// Local storage interface for MKDF
export interface StoredOrgKeyDataMKDF {
  organizationId: string;
  userId: string;
  mkdfVersion: number;
  mkdfConfig: MKDFConfig;
  publicKey: string;
  privateKeyEncrypted: string;
  salt: string;
  iv: string;
  deviceFingerprint: string;
  deviceKeyEncrypted: string;
  deviceKeyIv: string;
  deviceKeySalt: string;

  combinationSalt: string;
  pinSalt?: string;

  createdAt: number;
  lastAccessed: number;
}

// Error types
export interface MKDFError {
  code:
    | 'DEVICE_MISMATCH'
    | 'INVALID_PIN'
    | 'INVALID_PASSPHRASE'
    | 'MISSING_FACTOR'
    | 'CRYPTO_ERROR';
  message: string;
  requiredAction?: 'DEVICE_REGISTRATION' | 'PIN_RESET' | 'PASSPHRASE_RESET' | 'RECOVERY_FLOW';
}
