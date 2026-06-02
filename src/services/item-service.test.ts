import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { BadRequestError } from '../errors/http-errors.js';
import { sampleExamItem, testItemService, versionItemRecord } from '../test/fixtures.js';
import { DynamoDbIndex, ItemStatus } from '../types/enums.js';
import { buildUpdateItemProps, encodeCursor } from './item-service.js';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('ItemService', () => {
  beforeEach(() => {
    dynamoMock.reset();
    vi.useRealTimers();
  });

  it('creates items with generated metadata and current-item indexes', async () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    dynamoMock.on(PutCommand).resolves({});
    const service = testItemService();
    const itemInput = {
      subject: 'AP Biology',
      itemType: sampleExamItem().itemType,
      difficulty: 3,
      content: sampleExamItem().content,
      metadata: {
        author: 'Ada',
        status: ItemStatus.Draft,
        tags: ['cells']
      },
      securityLevel: sampleExamItem().securityLevel
    };

    const item = await service.createItem(itemInput);

    expect(item).toEqual({
      id: expect.any(String),
      ...itemInput,
      metadata: {
        ...itemInput.metadata,
        created: 1704067200000,
        lastModified: 1704067200000,
        version: 1
      }
    });
    expect(receivedInput(PutCommand)).toMatchObject({
      TableName: 'test-table',
      ConditionExpression: 'attribute_not_exists(pk)',
      Item: {
        pk: `ITEM#${item.id}`,
        sk: 'CURRENT',
        gsi_pk: 'ITEMS',
        gsi_sk: 'UPDATED#1704067200000',
        gsi2_pk: 'SUBJECT#AP Biology',
        gsi3_pk: 'STATUS#draft',
        gsi4_pk: 'SUBJECT#AP Biology#STATUS#draft',
        detail: item
      }
    });
  });

  it('gets the current item by id', async () => {
    const service = testItemService();
    dynamoMock.on(GetCommand).resolves({
      Item: {
        pk: 'ITEM#item-1',
        sk: 'CURRENT',
        detail: sampleExamItem()
      }
    });

    const result = await service.getItem('item-1');

    expect(result).toEqual(sampleExamItem());
    expect(receivedInput(GetCommand)).toMatchObject({
      TableName: 'test-table',
      Key: { pk: 'ITEM#item-1', sk: 'CURRENT' }
    });
  });

  it('updates items using the generated update expression props', async () => {
    vi.setSystemTime(new Date('2024-01-02T00:00:00.000Z'));
    const service = testItemService();
    dynamoMock.on(UpdateCommand).resolves({});

    const result = await service.updateItem({
      id: 'item-1',
      subject: 'AP Chemistry',
      metadata: { status: ItemStatus.Approved }
    });

    expect(result).toBe(true);
    expect(receivedInput(UpdateCommand)).toMatchObject({
      TableName: 'test-table',
      Key: { pk: 'ITEM#item-1', sk: 'CURRENT' },
      ExpressionAttributeValues: {
        ':detail_subject': 'AP Chemistry',
        ':detail_metadata_status': ItemStatus.Approved,
        ':detail_metadata_lastModified': 1704153600000,
        ':one': 1
      }
    });
    expect(receivedInput(UpdateCommand).UpdateExpression).toContain(
      'detail.metadata.#version = detail.metadata.#version + :one'
    );
  });

  it('returns false when update conflicts with a missing current item', async () => {
    const service = testItemService();
    const error = new Error('condition failed');
    error.name = 'ConditionalCheckFailedException';
    dynamoMock.on(UpdateCommand).rejects(error);

    await expect(service.updateItem({ id: 'missing-item' })).resolves.toBe(false);
  });

  it('rethrows non-conditional update errors', async () => {
    const service = testItemService();
    dynamoMock.on(UpdateCommand).rejects(new Error('dynamo unavailable'));

    await expect(service.updateItem({ id: 'item-1' })).rejects.toThrow('dynamo unavailable');
  });

  it.each([
    ['default index', {}, DynamoDbIndex.gsi, { gsi_pk: 'ITEMS' }],
    ['subject index', { subject: 'AP Biology' }, DynamoDbIndex.gsi2, { gsi2_pk: 'SUBJECT#AP Biology' }],
    ['status index', { status: ItemStatus.Review }, DynamoDbIndex.gsi3, { gsi3_pk: 'STATUS#review' }],
    [
      'subject-status index',
      { subject: 'AP Biology', status: ItemStatus.Review },
      DynamoDbIndex.gsi4,
      { gsi4_pk: 'SUBJECT#AP Biology#STATUS#review' }
    ]
  ])('lists items with the %s', async (_label, query, index, keyValues) => {
    const service = testItemService();
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await service.listItems(query);

    expect(receivedInput(QueryCommand)).toMatchObject({
      TableName: 'test-table',
      IndexName: index,
      Limit: 25,
      ScanIndexForward: false,
      ExpressionAttributeValues: Object.fromEntries(
        Object.entries(keyValues).map(([key, value]) => [`:${key}`, value])
      )
    });
  });

  it('caps list limits and returns next cursors', async () => {
    const service = testItemService();
    const lastEvaluatedKey = { pk: 'ITEM#item-2', sk: 'CURRENT' };
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        {
          pk: 'ITEM#item-1',
          sk: 'CURRENT',
          detail: sampleExamItem()
        }
      ],
      LastEvaluatedKey: lastEvaluatedKey
    });

    const result = await service.listItems({ limit: 200 });

    expect(receivedInput(QueryCommand)).toMatchObject({ Limit: 100 });
    expect(result).toEqual({
      items: [sampleExamItem()],
      nextCursor: encodeCursor(lastEvaluatedKey)
    });
  });

  it('lists items when DynamoDB omits the Items collection', async () => {
    const service = testItemService();
    dynamoMock.on(QueryCommand).resolves({});

    const result = await service.listItems({});

    expect(result).toEqual({ items: [] });
  });

  it('builds update props with version increment settings', () => {
    const props = buildUpdateItemProps({ id: 'item-1', metadata: { status: ItemStatus.Approved } });

    expect(props.options).toEqual({
      depth: 3,
      vars: {
        '#version': 'version',
        ':one': 1
      },
      setExpressions: ['detail.metadata.#version = detail.metadata.#version + :one']
    });
    expect(props.item).toMatchObject({
      pk: 'ITEM#item-1',
      sk: 'CURRENT',
      detail: {
        id: 'item-1',
        metadata: {
          status: ItemStatus.Approved,
          lastModified: expect.any(Number)
        }
      }
    });
  });

  it('returns paged audit trail items with a next cursor', async () => {
    const service = testItemService();
    const lastEvaluatedKey = { pk: 'ITEM#item-1', sk: 'VERSION#000002' };
    dynamoMock.on(QueryCommand).resolves({
      Items: [versionItemRecord(sampleExamItem({ metadata: { version: 1 } }))],
      LastEvaluatedKey: lastEvaluatedKey
    });

    const result = await service.getAuditTrail({ id: 'item-1', limit: 1 });

    expect(receivedInput(QueryCommand)).toMatchObject({
      TableName: 'test-table',
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk'
      },
      ExpressionAttributeValues: {
        ':pk': 'ITEM#item-1',
        ':sk': 'VERSION#'
      },
      Limit: 1,
      ScanIndexForward: true
    });
    expect(result).toEqual({
      items: [sampleExamItem({ metadata: { version: 1 } })],
      nextCursor: encodeCursor(lastEvaluatedKey)
    });
  });

  it('passes decoded cursors as the exclusive start key', async () => {
    const service = testItemService();
    const startKey = { pk: 'ITEM#item-1', sk: 'VERSION#000002' };
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const result = await service.getAuditTrail({
      id: 'item-1',
      cursor: encodeCursor(startKey)
    });

    expect(receivedInput(QueryCommand)).toMatchObject({
      ExclusiveStartKey: startKey,
      Limit: 25
    });
    expect(result).toEqual({ items: [] });
  });

  it('returns an empty audit trail when DynamoDB omits the Items collection', async () => {
    const service = testItemService();
    dynamoMock.on(QueryCommand).resolves({});

    const result = await service.getAuditTrail({ id: 'item-1' });

    expect(result).toEqual({ items: [] });
  });

  it('throws a bad request error for malformed cursors', async () => {
    const service = testItemService();

    await expect(service.getAuditTrail({ id: 'item-1', cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(
      BadRequestError
    );
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it('throws a bad request error for cursors that do not decode to objects', async () => {
    const service = testItemService();
    const cursor = Buffer.from(JSON.stringify(['not-an-object']), 'utf8').toString('base64url');

    await expect(service.listItems({ cursor })).rejects.toBeInstanceOf(BadRequestError);
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(0);
  });
});

function receivedInput<TCommand extends new (...args: any[]) => any>(command: TCommand): InstanceType<TCommand>['input'] {
  const input = dynamoMock.commandCalls(command)[0]?.args[0].input;
  expect(input).toBeDefined();
  return input;
}
