import { z } from 'zod';

export const CreateOrganizationSchema = z
  .object({
    organizationName: z.string().trim().min(3, 'Name is too short').max(50, 'Name is too long'),
    masterPassphrase: z
      .string()
      .min(12, 'Passphrase must be at least 12 characters')
      .max(128, 'Passphrase too long'),
    confirmPassphrase: z.string(),
    pin: z
      .string()
      .optional()
      .refine((val) => !val || (val.length >= 4 && val.length <= 8), {
        message: 'PIN must be 4-8 digits',
      }),
    confirmPin: z.string().optional(),
    enablePinProtection: z.boolean(),
  })
  .refine((data) => data.masterPassphrase === data.confirmPassphrase, {
    message: "Passphrases don't match",
    path: ['confirmPassphrase'],
  })
  .refine(
    (data) => {
      if (data.enablePinProtection) {
        return data.pin === data.confirmPin && data.pin && data.pin.length >= 4;
      }
      return true;
    },
    {
      message: "PINs don't match or PIN is too short",
      path: ['confirmPin'],
    },
  );

export type CreateOrganizationSchemaType = z.infer<typeof CreateOrganizationSchema>;
