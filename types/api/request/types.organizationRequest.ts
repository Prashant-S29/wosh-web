export type CreateOrganizationRequest = {
  name: string;
  publicKey: string;
  ownerId: string;
  privateKeyEncrypted: string;
  keyDerivationSalt: string;
  encryptionIv: string;
};
