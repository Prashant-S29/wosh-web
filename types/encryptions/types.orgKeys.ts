export interface OrganizationKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface KeyDerivationResult {
  masterKey: Uint8Array;
  salt: Uint8Array;
}

export interface StoredOrgKeys {
  publicKey: string;
  privateKeyEncrypted: string;
  salt: string;
  iv: string;
}
