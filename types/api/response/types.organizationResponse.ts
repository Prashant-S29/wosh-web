export type CreateOrganizationResponse = {
  id: string;
};

export type Organization = {
  id: string;
  name: string;
  createdAt: string;
  totalProjects: number;
};

export type GetAllAvailableOrganizationsResponse = {
  allOrgs: Organization[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type GetOrganizationResponse = {
  id: string;
  name: string;
  ownerId: string;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
};
export type RecoverOrgKeysResponse = {
  privateKeyEncrypted: string;
  keyDerivationSalt: string;
  encryptionIv: string;
  publicKey: string;
  mkdfVersion: number;

  requiredFactors: number;
  factorConfig: {
    requiredFactors: number;
    enabledFactors: ('passphrase' | 'device' | 'pin')[];
  };

  deviceInfo: {
    id: string;
    deviceName: string;
    encryptedDeviceKey: string;
    keyDerivationSalt: string;
    encryptionIv: string;
    isActive: boolean;
    combinationSalt: string;
    pinSalt?: string;
    deviceFingerprint: string;
  };
};

// export type RecoverOrgKeysResponse = StoredOrgKeysMKDF;
