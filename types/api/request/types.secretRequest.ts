export type CreateSecretRequestBase = {
  keyName: string;
  note?: string | null;
  ciphertext?: string;
  nonce?: string;
  metadata?: Record<string, unknown>;
};

export type CreateSecretRequest = { secrets: CreateSecretRequestBase[] };

export type UpdateSecretRequestBase = Partial<CreateSecretRequestBase>;
