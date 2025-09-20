import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(3, 'Name is too short').max(50, 'Name is too long'),
});

export type CreateProjectSchemaType = z.infer<typeof CreateProjectSchema>;
