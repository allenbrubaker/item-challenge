import { z } from 'zod';
import { ItemStatus, ItemType, SecurityLevel } from './enums.js';

export { ItemStatus, ItemType, SecurityLevel } from './enums.js';

/**
 * Exam Item Types
 */

export const ExamItemContentSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1)
});

export const ExamItemMetadataSchema = z.object({
  author: z.string().min(1),
  created: z.coerce.number().int(),
  lastModified: z.coerce.number().int(),
  version: z.coerce.number().int().positive(),
  status: z.nativeEnum(ItemStatus),
  tags: z.array(z.string())
});

export const ExamItemSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  itemType: z.nativeEnum(ItemType),
  difficulty: z.coerce.number().int().min(1).max(5),
  content: ExamItemContentSchema,
  metadata: ExamItemMetadataSchema,
  securityLevel: z.nativeEnum(SecurityLevel)
});

export type ExamItem = z.infer<typeof ExamItemSchema>;
