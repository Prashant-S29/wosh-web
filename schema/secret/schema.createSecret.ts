import { z } from 'zod';

export const SecretEntrySchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(255, 'Key must be less than 255 characters')
    .regex(
      /^[A-Za-z][A-Za-z0-9_]*$/,
      'Key must be uppercase letters, numbers, and underscores only',
    ),
  value: z.string().optional(),
  note: z.string().max(500, 'Note must be less than 500 characters').optional(),
});

export const SecretsFormSchema = z.object({
  secrets: z
    .array(SecretEntrySchema)
    .min(1, 'At least one secret is required')
    .refine(
      (secrets) => {
        const keys = secrets.map((s) => s.key).filter(Boolean);
        return new Set(keys).size === keys.length;
      },
      { message: 'Secret keys must be unique' },
    ),
});

export type SecretsFormValues = z.infer<typeof SecretsFormSchema>;
