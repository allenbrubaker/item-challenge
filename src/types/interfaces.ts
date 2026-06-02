import {
  AuditTrailQuery,
  AuditTrailResult,
  CreateItemRequest,
  ListItemsQuery,
  ListItemsResult,
  UpdateItemRequest
} from './dtos.js';
import { ExamItem } from './models.js';

export interface ItemStorage {
  createItem(data: CreateItemRequest): Promise<ExamItem>;
  getItem(id: string): Promise<ExamItem | null>;
  updateItem(data: UpdateItemRequest): Promise<boolean>;
  listItems(query: ListItemsQuery): Promise<ListItemsResult>;
  getAuditTrail(query: AuditTrailQuery): Promise<AuditTrailResult>;
}
