import { testConfigService } from '../test/fixtures.js';
import { ConfigService } from './config-service.js';

describe('ConfigService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps environment variables to strongly typed config values', () => {
    const configService = testConfigService({
      APP_ENV: 'qa',
      AWS_REGION: 'us-west-2',
      DYNAMODB_TABLE_NAME: 'qa-challenge-items',
      DYNAMODB_ENDPOINT: 'http://localhost:4566',
      COGNITO_USER_POOL_ID: 'pool-id',
      COGNITO_CLIENT_ID: 'client-id',
      LOG_LEVEL: 'warn'
    });

    expect(configService.values).toEqual({
      appEnv: 'qa',
      awsRegion: 'us-west-2',
      dynamoDbTableName: 'qa-challenge-items',
      dynamoDbEndpoint: 'http://localhost:4566',
      cognitoUserPoolId: 'pool-id',
      cognitoClientId: 'client-id',
      logLevel: 'warn'
    });
  });

  it('uses defaults for optional environment variables', () => {
    vi.stubEnv('APP_ENV', undefined);
    vi.stubEnv('AWS_REGION', undefined);
    vi.stubEnv('DYNAMODB_TABLE_NAME', undefined);
    vi.stubEnv('DYNAMODB_ENDPOINT', undefined);
    vi.stubEnv('COGNITO_USER_POOL_ID', undefined);
    vi.stubEnv('COGNITO_CLIENT_ID', undefined);
    vi.stubEnv('LOG_LEVEL', undefined);

    const configService = new ConfigService();

    expect(configService.appEnv).toBe('local');
    expect(configService.awsRegion).toBe('us-east-1');
    expect(configService.dynamoDbTableName).toBe('local-challenge-items');
    expect(configService.dynamoDbEndpoint).toBeUndefined();
    expect(configService.logLevel).toBe('info');
  });

  it('normalizes log levels to lowercase', () => {
    vi.stubEnv('LOG_LEVEL', 'DEBUG');

    expect(new ConfigService().logLevel).toBe('debug');
  });

  it('requires Cognito config through the strict getters', () => {
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('DYNAMODB_TABLE_NAME', 'test-table');
    vi.stubEnv('LOG_LEVEL', 'error');
    vi.stubEnv('COGNITO_USER_POOL_ID', undefined);
    vi.stubEnv('COGNITO_CLIENT_ID', undefined);
    const configService = new ConfigService();

    expect(() => configService.cognitoUserPoolId).toThrow('COGNITO_USER_POOL_ID is required');
    expect(() => configService.cognitoClientId).toThrow('COGNITO_CLIENT_ID is required');
  });

  it('returns configured Cognito values through the strict getters', () => {
    const configService = testConfigService({
      COGNITO_USER_POOL_ID: 'pool-id',
      COGNITO_CLIENT_ID: 'client-id'
    });

    expect(configService.cognitoUserPoolId).toBe('pool-id');
    expect(configService.cognitoClientId).toBe('client-id');
  });

  it('rejects unsupported app environments', () => {
    vi.stubEnv('APP_ENV', 'staging');

    expect(() => new ConfigService()).toThrow('APP_ENV must be one of: local, dev, qa, int, uat, prod');
  });

  it('rejects unsupported log levels', () => {
    vi.stubEnv('LOG_LEVEL', 'verbose');

    expect(() => new ConfigService()).toThrow('LOG_LEVEL must be one of: debug, info, warn, error');
  });
});
