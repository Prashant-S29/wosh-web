import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  organizationName: z.string().trim().min(3, 'Name is too short').max(50, 'Name is too long'),
  masterPassphrase: z
    .string()
    .min(12, 'Passphrase must be at least 12 characters')
    .max(128, 'Passphrase too long'),
  pin: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 4 && val.length <= 8), {
      message: 'PIN must be 4-8 digits',
    }),
  enablePinProtection: z.boolean(),
  signedUndertaking: z.boolean(),
});

export type CreateOrganizationSchemaType = z.infer<typeof CreateOrganizationSchema>;
