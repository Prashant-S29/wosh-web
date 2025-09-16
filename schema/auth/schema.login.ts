import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.email('Invalid email'),
  password: z
    .string()
    .trim()
    .min(8, 'Password must be at least 8 characters')
    .max(40, 'Password must be at most 40 characters'),
});

export type LoginSchemaType = z.infer<typeof LoginSchema>;
