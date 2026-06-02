import type { APIGatewayProxyEventV2, DynamoDBRecord } from 'aws-lambda';
import { marshall } from '@aws-sdk/util-dynamodb';
import { EntityType, ItemStatus, ItemType, SecurityLevel } from '../types/enums.js';
import type { ExamItem } from '../types/models.js';
import { itemRecord, itemVersionRecord, type DeepPartial } from '../types/records.js';
import { ConfigService } from '../services/config-service.js';
import { DbService } from '../services/db-service.js';
import { ItemService } from '../services/item-service.js';
import { LogService } from '../services/log-service.js';
import { StreamService } from '../services/stream-service.js';
import { UtilService } from '../services/util-service.js';

export function sampleExamItem(overrides: DeepPartial<ExamItem> = {}): ExamItem {
  const base: ExamItem = {
    id: 'item-1',
    subject: 'AP Biology',
    itemType: ItemType.MultipleChoice,
    difficulty: 3,
    content: {
      question: 'Which molecule stores genetic information?',
      options: ['DNA', 'ATP'],
      correctAnswer: 'DNA',
      explanation: 'DNA stores genetic instructions.'
    },
    metadata: {
      author: 'Ada',
      created: 1700000000000,
      lastModified: 1710000000000,
      version: 1,
      status: ItemStatus.Review,
      tags: ['cells']
    },
    securityLevel: SecurityLevel.Standard
  };

  return {
    ...base,
    ...overrides,
    content: {
      ...base.content,
      ...overrides.content
    },
    metadata: {
      ...base.metadata,
      ...overrides.metadata
    }
  };
}

export function currentItemRecord(item: ExamItem = sampleExamItem()): Record<string, unknown> {
  return itemRecord(item);
}

export function versionItemRecord(item: ExamItem = sampleExamItem()): Record<string, unknown> {
  return itemVersionRecord(item);
}

export function streamRecord(
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE',
  newImage: Record<string, unknown>
): DynamoDBRecord {
  return {
    eventID: '1',
    eventName,
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'us-east-1',
    dynamodb: {
      NewImage: marshall(newImage) as NonNullable<DynamoDBRecord['dynamodb']>['NewImage'],
      SequenceNumber: '1',
      SizeBytes: 1,
      StreamViewType: 'NEW_IMAGE'
    },
    eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/test/stream/1'
  };
}

export function invalidCurrentItemRecord(detail: unknown = { id: 'item-1' }): Record<string, unknown> {
  return {
    pk: 'ITEM#item-1',
    sk: 'CURRENT',
    entityType: EntityType.item,
    detail
  };
}

export type ApiGatewayEventFixture = Partial<Omit<APIGatewayProxyEventV2, 'body'>> & {
  body?: unknown;
  rawBody?: string;
};

export function apiGatewayEvent({
  body,
  headers = {},
  pathParameters,
  queryStringParameters,
  rawBody,
  rawPath = '/',
  rawQueryString = '',
  routeKey = '$default'
}: ApiGatewayEventFixture = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey,
    rawPath,
    rawQueryString,
    headers,
    ...(pathParameters ? { pathParameters } : {}),
    ...(queryStringParameters ? { queryStringParameters } : {}),
    requestContext: {} as APIGatewayProxyEventV2['requestContext'],
    isBase64Encoded: false,
    ...(rawBody !== undefined ? { body: rawBody } : body === undefined ? {} : { body: JSON.stringify(body) })
  };
}

export function testConfigService(overrides: Record<string, string | undefined> = {}): ConfigService {
  const values = {
    APP_ENV: 'local',
    AWS_REGION: 'us-east-1',
    DYNAMODB_TABLE_NAME: 'test-table',
    LOG_LEVEL: 'error',
    ...overrides
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));

  Object.assign(process.env, values);

  try {
    return new ConfigService();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export function testDbService(config = testConfigService()): DbService {
  return new DbService(config, new UtilService(), new LogService(config));
}

export function testItemService(overrides: Record<string, string | undefined> = {}): ItemService {
  const config = testConfigService(overrides);
  return new ItemService(testDbService(config), new LogService(config));
}

export function testStreamService(overrides: Record<string, string | undefined> = {}): StreamService {
  const config = testConfigService(overrides);
  return new StreamService(testDbService(config), new LogService(config));
}
