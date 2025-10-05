export type CreateSecretResponse = { id: string } | { id: string }[];

export type Secrets = {
  id: string;
  keyName: string;
  ciphertext: string;
  nonce: string;
  note: string | null;
  metadata: {
    isEmpty: boolean;
    version?: number;
    algorithm?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type GetAllSecretsResponse = {
  allSecrets: Secrets[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type UpdateSecretResponse = { id: string };

export type DeleteSecretResponse = { deleted: boolean; id: string };
