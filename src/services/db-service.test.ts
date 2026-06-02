import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDbIndex, EntityType } from '../types/enums.js';
import type { DynamoRecord } from '../types/records.js';
import { sampleExamItem, testConfigService, testDbService } from '../test/fixtures.js';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('DbService', () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  it('gets an item by key from the configured table', async () => {
    const dbService = testDbService();

    dynamoMock.on(GetCommand).resolves({ Item: currentRecord() });

    const result = await dbService.get({ pk: 'ITEM#item-1', sk: 'CURRENT' });

    expect(result).toEqual(sampleExamItem());
    expect(dynamoMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: 'test-table',
      Key: { pk: 'ITEM#item-1', sk: 'CURRENT' }
    });
  });

  it('configures the DynamoDB client with a local endpoint when provided', async () => {
    const dbService = testDbService(
      testConfigService({
        DYNAMODB_ENDPOINT: 'http://localhost:4566'
      })
    );

    const endpoint = await (dbService as any)._client.config.endpoint();

    expect(endpoint).toMatchObject({
      hostname: 'localhost',
      port: 4566,
      protocol: 'http:'
    });
  });

  it('puts an item with additional command input', async () => {
    const dbService = testDbService();
    const record = currentRecord();

    dynamoMock.on(PutCommand).resolves({});

    await dbService.put(record, {
      ConditionExpression: 'attribute_not_exists(pk)'
    });

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: 'test-table',
      Item: record,
      ConditionExpression: 'attribute_not_exists(pk)'
    });
  });

  it('builds query expressions and merges caller-provided expression attributes', async () => {
    const dbService = testDbService();

    dynamoMock.on(QueryCommand).resolves({ Items: [currentRecord()] });

    await dbService.query(
      { gsi2_pk: 'SUBJECT#AP Biology' },
      {
        index: DynamoDbIndex.gsi2,
        ExpressionAttributeNames: { '#gsi2_pk': 'gsi2_pk', '#sk': 'gsi2_sk' },
        ExpressionAttributeValues: { ':skPrefix': 'UPDATED#' },
        KeyConditionExpression: '#gsi2_pk = :gsi2_pk AND begins_with(#sk, :skPrefix)'
      }
    );

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: 'test-table',
      IndexName: DynamoDbIndex.gsi2,
      KeyConditionExpression: '#gsi2_pk = :gsi2_pk AND begins_with(#sk, :skPrefix)',
      ExpressionAttributeNames: {
        '#gsi2_pk': 'gsi2_pk',
        '#sk': 'gsi2_sk'
      },
      ExpressionAttributeValues: {
        ':gsi2_pk': 'SUBJECT#AP Biology',
        ':skPrefix': 'UPDATED#'
      }
    });
  });

  it('rejects empty query keys', async () => {
    const dbService = testDbService();

    expect(() => dbService.query({})).toThrow('query-empty-keys');
    expect(dynamoMock).toHaveReceivedCommandTimes(QueryCommand, 0);
  });

  it('builds nested update expressions and appends custom set expressions', async () => {
    const dbService = testDbService();

    dynamoMock.on(UpdateCommand).resolves({});

    await dbService.update(
      {
        pk: 'ITEM#item-1',
        sk: 'CURRENT',
        detail: {
          subject: 'AP Biology',
          metadata: {
            status: 'review',
            lastModified: 1710000000000
          }
        }
      },
      {
        depth: 3,
        vars: {
          '#version': 'version',
          ':one': 1
        },
        conditions: ['attribute_not_exists(deletedAt)'],
        setExpressions: ['detail.metadata.#version = detail.metadata.#version + :one']
      }
    );

    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: 'test-table',
      Key: { pk: 'ITEM#item-1', sk: 'CURRENT' },
      ConditionExpression: '(attribute_exists(pk)) AND (attribute_not_exists(deletedAt))',
      UpdateExpression:
        'SET detail.subject = :detail_subject, detail.metadata.#status = :detail_metadata_status, detail.metadata.lastModified = :detail_metadata_lastModified, detail.metadata.#version = detail.metadata.#version + :one',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#version': 'version'
      },
      ExpressionAttributeValues: {
        ':detail_subject': 'AP Biology',
        ':detail_metadata_status': 'review',
        ':detail_metadata_lastModified': 1710000000000,
        ':one': 1
      }
    });
  });

  it('adds ordering conditions when the order attribute is present', async () => {
    const dbService = testDbService();

    dynamoMock.on(UpdateCommand).resolves({});

    await dbService.update(
      {
        pk: 'ITEM#item-1',
        sk: 'CURRENT',
        gsi_sk: 'UPDATED#1710000000000'
      },
      { orderAttr: 'gsi_sk' }
    );

    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      ConditionExpression:
        '(attribute_exists(pk)) AND (attribute_not_exists(gsi_sk) OR attribute_type(gsi_sk, :NULL) OR :gsi_sk > gsi_sk)',
      ExpressionAttributeValues: {
        ':gsi_sk': 'UPDATED#1710000000000',
        ':NULL': 'NULL'
      }
    });
  });

  it('throws when the requested ordering attribute is missing from the update', async () => {
    const dbService = testDbService();

    await expect(
      dbService.update(
        {
          pk: 'ITEM#item-1',
          sk: 'CURRENT',
          detail: { subject: 'AP Biology' }
        },
        { orderAttr: 'gsi_sk' }
      )
    ).rejects.toThrow('Order attribute gsi_sk is missing in update statement');
    expect(dynamoMock).toHaveReceivedCommandTimes(UpdateCommand, 0);
  });

  it('builds shallow update expressions when no depth is provided to the expression builder', () => {
    const dbService = testDbService();

    const updateInput = (dbService as any).buildUpdate({
      keys: ['pk', 'sk'],
      attrs: {
        pk: 'ITEM#item-1',
        sk: 'CURRENT',
        detail: {
          subject: 'AP Biology'
        }
      }
    });

    expect(updateInput).toMatchObject({
      TableName: 'test-table',
      Key: { pk: 'ITEM#item-1', sk: 'CURRENT' },
      UpdateExpression: 'SET detail = :detail',
      ExpressionAttributeValues: {
        ':detail': {
          subject: 'AP Biology'
        }
      }
    });
  });

  it('plucks item details from DynamoDB records', () => {
    const dbService = testDbService();
    const item = sampleExamItem();
    const record = currentRecord(item);

    expect(dbService.pluckItem({ Item: record, $metadata: {} })).toEqual(item);
    expect(dbService.pluckItem({ $metadata: {} })).toBeNull();
    expect(dbService.pluckItems({ Items: [record], $metadata: {} })).toEqual([item]);
    expect(dbService.pluckItems({ $metadata: {} })).toEqual([]);
    expect(dbService.pluckRecord(record)).toEqual(item);
    expect(dbService.pluckRecord(undefined)).toBeNull();
  });
});

function currentRecord(item = sampleExamItem()): DynamoRecord {
  return {
    pk: `ITEM#${item.id}`,
    sk: 'CURRENT',
    entityType: EntityType.item,
    detail: item
  };
}
