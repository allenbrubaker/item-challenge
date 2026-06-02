import { NotFoundError } from '../errors/http-errors.js';
import { container } from '../services/container.js';
import { ItemService } from '../services/item-service.js';
import {
  AuditTrailQuerySchema,
  CreateItemRequestSchema,
  IdRequestSchema,
  ListItemsQuerySchema,
  UpdateItemRequestSchema
} from '../types/dtos.js';
import { apiHandler as apiHandler } from './handler-factory.js';

const itemService = container.get(ItemService);

export const createItem = apiHandler(CreateItemRequestSchema, async input => {
  return itemService.createItem(input);
}, 201);

export const getItem = apiHandler(IdRequestSchema, async ({ id }) => {
  const item = await itemService.getItem(id);
  if (!item) {
    throw new NotFoundError();
  }
  return item;
});

export const listItems = apiHandler(ListItemsQuerySchema, async query => {
  return itemService.listItems(query);
});

export const updateItem = apiHandler(UpdateItemRequestSchema, async input => {
  const updated = await itemService.updateItem(input);

  if (!updated) {
    throw new NotFoundError();
  }

  return {};
}, 204);

export const getAuditTrail = apiHandler(AuditTrailQuerySchema, async query => {
  return itemService.getAuditTrail(query);
});
