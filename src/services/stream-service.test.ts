import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { DynamoDBRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import {
  currentItemRecord,
  sampleExamItem,
  streamRecord,
  testStreamService,
  versionItemRecord
} from '../test/fixtures.js';
import { EntityType } from '../types/enums.js';
import 'aws-sdk-client-mock-jest/vitest';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('StreamService.stream', () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  it('writes version records for current item insert and modify events', async () => {
    const service = testStreamService();
    dynamoMock.on(PutCommand).resolves({});

    await service.stream({
      Records: [
        streamRecord('INSERT', currentItemRecord(sampleExamItem({ metadata: { version: 1 } }))),
        streamRecord('MODIFY', currentItemRecord(sampleExamItem({ metadata: { version: 2 } })))
      ]
    });

    expect(dynamoMock).toHaveReceivedCommandTimes(PutCommand, 2);
    expect(dynamoMock).toHaveReceivedNthCommandWith(1, PutCommand, {
      TableName: 'test-table',
      Item: expect.objectContaining({
        pk: 'ITEM#item-1',
        sk: 'VERSION#000001',
        entityType: EntityType.itemVersion
      })
    });
    expect(dynamoMock).toHaveReceivedNthCommandWith(2, PutCommand, {
      TableName: 'test-table',
      Item: expect.objectContaining({
        pk: 'ITEM#item-1',
        sk: 'VERSION#000002',
        entityType: EntityType.itemVersion
      })
    });
  });

  it('ignores version records and remove events', async () => {
    const service = testStreamService();
    dynamoMock.on(PutCommand).resolves({});

    await service.stream({
      Records: [
        streamRecord('INSERT', versionItemRecord(sampleExamItem({ metadata: { version: 1 } }))),
        removeStreamRecord(currentItemRecord(sampleExamItem({ metadata: { version: 1 } })))
      ]
    });

    expect(dynamoMock).not.toHaveReceivedCommand(PutCommand);
  });
});

function removeStreamRecord(oldImage: Record<string, unknown>): DynamoDBRecord {
  return {
    eventID: '1',
    eventName: 'REMOVE',
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'us-east-1',
    dynamodb: {
      OldImage: marshall(oldImage) as NonNullable<DynamoDBRecord['dynamodb']>['OldImage'],
      SequenceNumber: '1',
      SizeBytes: 1,
      StreamViewType: 'OLD_IMAGE'
    },
    eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/test/stream/1'
  };
}
