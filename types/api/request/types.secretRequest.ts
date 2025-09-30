export type CreateSecretRequestBase = {
  keyName: string;
  note?: string;
  ciphertext?: string;
  nonce?: string;
  metadata?: Record<string, unknown>;
};

export type CreateSecretRequest = { secrets: CreateSecretRequestBase[] };
