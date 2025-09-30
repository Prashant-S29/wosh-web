export interface SecretFormData {
  key: string;
  value: string;
  note?: string;
}

export interface CreateSecretsRequest {
  secrets: SecretFormData[];
  projectId: string;
  organizationId: string;
}

export interface EncryptedSecretData {
  keyName: string;
  ciphertext: string;
  nonce: string;
  note?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface StoredSecret {
  id: string;
  projectId: string;
  keyName: string;
  note: string | null;
  ciphertext: string;
  nonce: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecryptedSecret {
  keyName: string;
  value: string;
  note: string | null;
}
