import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(3, 'Name is too short').max(50, 'Name is too long'),
});

export type CreateOrganizationSchemaType = z.infer<typeof CreateOrganizationSchema>;
