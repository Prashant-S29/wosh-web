import { MKDFConfig } from '@/types/encryptions';

export type CreateOrganizationRequest = {
  name: string;
  ownerId: string;
  encryptionIv: string;
  keyDerivationSalt: string;
  publicKey: string;
  privateKeyEncrypted: string;

  // mkdf data
  mkdfConfig: {
    mkdfVersion: number;
    requiredFactors: number;
    factorConfig: MKDFConfig;
  };

  // device registration
  deviceInfo: {
    deviceName: string;
    deviceFingerprint: string;
    encryptedDeviceKey: string;
    encryptionIv: string;
    keyDerivationSalt: string;
    combinationSalt: string;
    pinSalt?: string;
  };
};

export type UpdateOrganizationRequest = {
  name: string;
};
