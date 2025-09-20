export type CreateOrganizationResponse = {
  id: string;
};

export type GetAllAvailableOrganizationsResponse = {
  data: {
    id: string;
    name: string;
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
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
};
