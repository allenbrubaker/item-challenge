import type { GetCommandOutput, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { EntityType } from './enums.js';
import type { ExamItem } from './models.js';

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
export type DeepPartial<T> = T extends Primitive | Date | RegExp | Function
  ? T
  : T extends Array<infer U>
    ? DeepPartial<U>[]
    : { [K in keyof T]?: DeepPartial<T[K]> };

export type BuildExpressionProps<T> = {
  keys: (keyof T)[];
  attrs: DeepPartial<T>;
  conditions?: string[];
  orderAttr?: keyof T | string;
  depth?: number;
  /**
   * Variables to escape in expressions. Keys starting with ':' are treated as values, '#' as names.
   */
  vars?: Record<string, unknown>;
};

export type DynamoRecordPrimaryKey = {
  pk: string;
  sk: string;
};

export type DynamoRecordKey = DynamoRecordPrimaryKey & {
  gsi_pk?: string;
  gsi_sk?: string;
  gsi2_pk?: string;
  gsi2_sk?: string;
  gsi3_pk?: string;
  gsi3_sk?: string;
  gsi4_pk?: string;
  gsi4_sk?: string;
};

export type DynamoRecord<T = unknown> = DynamoRecordKey & {
  entityType: EntityType;
  detail: T;
};

export function itemRecord(item: ExamItem): DynamoRecord<ExamItem> {
  const sk = itemUpdatedSortKey(item.metadata.lastModified);

  return {
    detail: item,
    ...itemKey(item.id),
    entityType: EntityType.item,
    gsi_pk: 'ITEMS',
    gsi_sk: sk,
    gsi2_pk: itemSubjectKey(item.subject),
    gsi2_sk: sk,
    gsi3_pk: itemStatusKey(item.metadata.status),
    gsi3_sk: sk,
    gsi4_pk: itemSubjectStatusKey(item.subject, item.metadata.status),
    gsi4_sk: sk
  };
}

export function itemUpdateRecord(data: DeepPartial<ExamItem>): DeepPartial<DynamoRecord<ExamItem>> {
  const record = itemRecord({
    ...data,
    metadata: {
      ...data.metadata,
      lastModified: Date.now()
    }
  } as ExamItem);
  if (data.subject === undefined) delete record.gsi2_pk;
  if (data.metadata?.status === undefined) delete record.gsi3_pk;
  if (data.subject === undefined || data.metadata?.status === undefined) delete record.gsi4_pk;
  return record;
}

export function itemVersionRecord(item: ExamItem): DynamoRecord<ExamItem> {
  return {
    ...itemVersionKey(item.id, item.metadata.version),
    entityType: EntityType.itemVersion,
    detail: item
  };
}

export function itemKey(id: string): Pick<DynamoRecord<ExamItem>, 'pk' | 'sk'> {
  return { pk: `ITEM#${id}`, sk: 'CURRENT' };
}

export function itemVersionKey(id: string, version: number): Pick<DynamoRecord<ExamItem>, 'pk' | 'sk'> {
  return {
    pk: `ITEM#${id}`,
    sk: `VERSION#${String(version).padStart(6, '0')}`
  };
}

export function itemUpdatedSortKey(lastModified: number): string {
  return `UPDATED#${String(lastModified).padStart(13, '0')}`;
}

export function itemSubjectKey(subject: string): string {
  return `SUBJECT#${subject}`;
}

export function itemStatusKey(status: string): string {
  return `STATUS#${status}`;
}

export function itemSubjectStatusKey(subject: string, status: string): string {
  return `SUBJECT#${subject}#STATUS#${status}`;
}
