import { sampleExamItem } from '../test/fixtures.js';
import { ItemStatus } from './enums.js';
import {
  itemKey,
  itemRecord,
  itemStatusKey,
  itemSubjectKey,
  itemSubjectStatusKey,
  itemUpdateRecord,
  itemUpdatedSortKey,
  itemVersionKey,
  itemVersionRecord
} from './records.js';

describe('record helpers', () => {
  it('builds current item records with all access-pattern keys', () => {
    const item = sampleExamItem();

    expect(itemRecord(item)).toEqual({
      detail: item,
      entityType: 'ITEM',
      pk: 'ITEM#item-1',
      sk: 'CURRENT',
      gsi_pk: 'ITEMS',
      gsi_sk: 'UPDATED#1710000000000',
      gsi2_pk: 'SUBJECT#AP Biology',
      gsi2_sk: 'UPDATED#1710000000000',
      gsi3_pk: 'STATUS#review',
      gsi3_sk: 'UPDATED#1710000000000',
      gsi4_pk: 'SUBJECT#AP Biology#STATUS#review',
      gsi4_sk: 'UPDATED#1710000000000'
    });
  });

  it('omits subject and status indexes from partial update records when inputs are absent', () => {
    const record = itemUpdateRecord({ id: 'item-1', metadata: { tags: ['updated'] } });

    expect(record.gsi2_pk).toBeUndefined();
    expect(record.gsi3_pk).toBeUndefined();
    expect(record.gsi4_pk).toBeUndefined();
    expect(record.gsi2_sk).toBeDefined();
    expect(record.gsi3_sk).toBeDefined();
    expect(record.gsi4_sk).toBeDefined();
  });

  it('keeps subject-status indexes when both update fields are present', () => {
    const record = itemUpdateRecord({
      id: 'item-1',
      subject: 'AP Chemistry',
      metadata: { status: ItemStatus.Approved }
    });

    expect(record.gsi2_pk).toBe('SUBJECT#AP Chemistry');
    expect(record.gsi3_pk).toBe('STATUS#approved');
    expect(record.gsi4_pk).toBe('SUBJECT#AP Chemistry#STATUS#approved');
  });

  it('builds version records and key strings', () => {
    const item = sampleExamItem({ metadata: { version: 42 } });

    expect(itemVersionRecord(item)).toEqual({
      pk: 'ITEM#item-1',
      sk: 'VERSION#000042',
      entityType: 'ITEM_VERSION',
      detail: item
    });
    expect(itemKey('item-1')).toEqual({ pk: 'ITEM#item-1', sk: 'CURRENT' });
    expect(itemVersionKey('item-1', 7)).toEqual({ pk: 'ITEM#item-1', sk: 'VERSION#000007' });
    expect(itemUpdatedSortKey(123)).toBe('UPDATED#0000000000123');
    expect(itemSubjectKey('AP Biology')).toBe('SUBJECT#AP Biology');
    expect(itemStatusKey('review')).toBe('STATUS#review');
    expect(itemSubjectStatusKey('AP Biology', 'review')).toBe('SUBJECT#AP Biology#STATUS#review');
  });
});
