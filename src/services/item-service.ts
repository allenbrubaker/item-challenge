import { randomUUID } from 'crypto';
import { inject, injectable } from 'inversify';
import { BadRequestError } from '../errors/http-errors.js';
import { ItemStorage } from '../types/interfaces.js';
import { DynamoDbIndex } from '../types/enums.js';
import { ExamItem } from '../types/models.js';
import { DbService, type UpdateOptions } from './db-service.js';
import { LogService } from './log-service.js';
import {
  AuditTrailQuery,
  AuditTrailResult,
  CreateItemRequest,
  ListItemsQuery,
  ListItemsResult,
  UpdateItemRequest
} from '../types/dtos.js';
import { itemKey, itemRecord, itemUpdateRecord } from '../types/records.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

@injectable()
export class ItemService implements ItemStorage {
  constructor(
    @inject(DbService) private readonly _db: DbService,
    @inject(LogService) private readonly _log: LogService
  ) {}

  async createItem(data: CreateItemRequest): Promise<ExamItem> {
    const now = Date.now();
    const item: ExamItem = {
      id: randomUUID(),
      ...data,
      metadata: {
        ...data.metadata,
        created: now,
        lastModified: now,
        version: 1
      }
    };
    await this._db.put(itemRecord(item), {
      ConditionExpression: 'attribute_not_exists(pk)'
    });
    this._log.info('Created item', { itemId: item.id, version: item.metadata.version });
    return item;
  }

  async getItem(id: string): Promise<ExamItem | null> {
    return this._db.get<ExamItem>(itemKey(id));
  }

  async updateItem(data: UpdateItemRequest): Promise<boolean> {
    const updated = await this.updateCurrentItem(data);

    if (!updated) {
      return false;
    }

    this._log.info('Updated item', { itemId: data.id });
    return true;
  }

  async listItems(query: ListItemsQuery): Promise<ListItemsResult> {
    const { key, value, index } = selectListIndex(query);
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const exclusiveStartKey = decodeCursor(query.cursor);
    const result = await this._db.query(
      { [key]: value },
      {
        index: index,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false
      }
    );
    this._log.debug('Listed items', {
      indexName: index,
      count: result.Items?.length ?? 0,
      hasNextCursor: Boolean(result.LastEvaluatedKey)
    });

    return {
      items: this._db.pluckItems<ExamItem>(result),
      ...(result.LastEvaluatedKey ? { nextCursor: encodeCursor(result.LastEvaluatedKey) } : {})
    };
  }

  async getAuditTrail(query: AuditTrailQuery): Promise<AuditTrailResult> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const exclusiveStartKey = decodeCursor(query.cursor);
    const result = await this._db.query(
      { pk: `ITEM#${query.id}` },
      {
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#sk': 'sk'
        },
        ExpressionAttributeValues: {
          ':sk': 'VERSION#'
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: true
      }
    );

    this._log.debug('Listed audit trail', {
      itemId: query.id,
      count: result.Items?.length ?? 0,
      hasNextCursor: Boolean(result.LastEvaluatedKey)
    });

    return {
      items: this._db.pluckItems<ExamItem>(result),
      ...(result.LastEvaluatedKey ? { nextCursor: encodeCursor(result.LastEvaluatedKey) } : {})
    };
  }

  private async updateCurrentItem(data: UpdateItemRequest): Promise<boolean> {
    try {
      const { item, options } = buildUpdateItemProps(data);
      await this._db.update(item, options);
      return true;
    } catch (error) {
      if (this._db.isConditionalCheckFailed(error)) {
        return false;
      }

      throw error;
    }
  }
}

export function buildUpdateItemProps(data: UpdateItemRequest): {
  item: ReturnType<typeof itemUpdateRecord>;
  options: UpdateOptions;
} {
  return {
    item: itemUpdateRecord(data),
    options: {
      depth: 3,
      vars: {
        '#version': 'version',
        ':one': 1
      },
      setExpressions: ['detail.metadata.#version = detail.metadata.#version + :one']
    }
  };
}

export function encodeCursor(lastEvaluatedKey: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): Record<string, unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;

    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Cursor did not decode to an object');
    }

    return decoded as Record<string, unknown>;
  } catch {
    throw new BadRequestError('Malformed pagination cursor');
  }
}

function selectListIndex(query: ListItemsQuery): {
  index: DynamoDbIndex;
  key: string;
  value: string;
} {
  if (query.subject && query.status) {
    return {
      index: DynamoDbIndex.gsi4,
      key: 'gsi4_pk',
      value: `SUBJECT#${query.subject}#STATUS#${query.status}`
    };
  }

  if (query.subject) {
    return {
      index: DynamoDbIndex.gsi2,
      key: 'gsi2_pk',
      value: `SUBJECT#${query.subject}`
    };
  }

  if (query.status) {
    return {
      index: DynamoDbIndex.gsi3,
      key: 'gsi3_pk',
      value: `STATUS#${query.status}`
    };
  }

  return {
    index: DynamoDbIndex.gsi,
    key: 'gsi_pk',
    value: 'ITEMS'
  };
}
