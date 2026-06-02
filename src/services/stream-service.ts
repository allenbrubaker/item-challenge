import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { DynamoDBStreamEvent } from 'aws-lambda';
import { inject, injectable } from 'inversify';
import { EntityType } from '../types/enums.js';
import { type ExamItem } from '../types/models.js';
import { itemVersionRecord, type DynamoRecord } from '../types/records.js';
import { DbService } from './db-service.js';
import { LogService } from './log-service.js';

export type DynamoStreamRecord<T = unknown> = {
  record: DynamoRecord<T> | null;
  old: DynamoRecord<T> | null;
};

@injectable()
export class StreamService {
  constructor(
    @inject(DbService) private readonly _db: DbService,
    @inject(LogService) private readonly _log: LogService
  ) {}

  async stream(event: DynamoDBStreamEvent): Promise<void> {
    const records = this.parse(event);
    await Promise.all(
      records.map(r => {
        const type = r.record?.entityType ?? r.old?.entityType;
        return type === EntityType.item ? this.itemStream(r as DynamoStreamRecord<ExamItem>) : Promise.resolve();
      })
    );
  }

  private async itemStream({ record }: DynamoStreamRecord<ExamItem>) {
    this._log.debug(`item-stream`, { record });
    const item = record?.detail;
    if (item) {
      const versionRecord = itemVersionRecord(item);
      await this._db.put(versionRecord);
      this._log.debug('Created item version from stream', {
        itemId: versionRecord.detail.id,
        version: versionRecord.detail.metadata.version
      });
    }
  }

  private parse(event: DynamoDBStreamEvent): DynamoStreamRecord[] {
    return event.Records.map(record => {
      const raw = { new: record.dynamodb?.NewImage, old: record.dynamodb?.OldImage };
      const newRecord = raw.new ? (unmarshall(<any>raw.new) as DynamoRecord) : null;
      const oldRecord = raw.old ? (unmarshall(<any>raw.old) as DynamoRecord) : null;
      return { record: newRecord, old: oldRecord };
    });
  }
}
