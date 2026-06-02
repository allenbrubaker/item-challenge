import { z } from 'zod';
import { ExamItemContentSchema, ExamItemMetadataSchema, ExamItemSchema } from './models.js';

const CreateItemMetadataSchema = ExamItemMetadataSchema.omit({
  created: true,
  lastModified: true,
  version: true
});

const UpdateItemMetadataSchema = ExamItemMetadataSchema.pick({
  author: true,
  status: true,
  tags: true
})
  .partial()
  .strict();

export const CreateItemRequestSchema = ExamItemSchema.omit({
  id: true,
  metadata: true
}).extend({
  metadata: CreateItemMetadataSchema
});

export const IdRequestSchema = ExamItemSchema.pick({
  id: true
});

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional()
});

export const UpdateItemRequestSchema = ExamItemSchema.omit({ metadata: true }).partial().extend({
  id: ExamItemSchema.shape.id,
  content: ExamItemContentSchema.partial().optional(),
  metadata: UpdateItemMetadataSchema.optional()
});

export const ListItemsQuerySchema = PaginationQuerySchema.extend({
  subject: ExamItemSchema.shape.subject.optional(),
  status: ExamItemMetadataSchema.shape.status.optional()
});

export const AuditTrailQuerySchema = IdRequestSchema.merge(PaginationQuerySchema);

export const PagedResultSchema = <TItemSchema extends z.ZodTypeAny>(itemSchema: TItemSchema) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().min(1).optional()
  });

export const ListItemsResultSchema = PagedResultSchema(ExamItemSchema);
export const AuditTrailResultSchema = PagedResultSchema(ExamItemSchema);

export type IdRequest = z.infer<typeof IdRequestSchema>;
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;
export type UpdateItemRequest = z.infer<typeof UpdateItemRequestSchema>;
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
export type AuditTrailQuery = z.infer<typeof AuditTrailQuerySchema>;
export type ListItemsResult = z.infer<typeof ListItemsResultSchema>;
export type AuditTrailResult = z.infer<typeof AuditTrailResultSchema>;
