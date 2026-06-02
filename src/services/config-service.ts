import 'reflect-metadata';
import { injectable, unmanaged } from 'inversify';

export const appEnvironments = ['local', 'dev', 'qa', 'int', 'uat', 'prod'] as const;
export const logLevels = ['debug', 'info', 'warn', 'error'] as const;

export type AppEnvironment = (typeof appEnvironments)[number];
export type LogLevel = (typeof logLevels)[number];

export interface AppConfig {
  appEnv: AppEnvironment;
  awsRegion: string;
  dynamoDbTableName: string;
  dynamoDbEndpoint?: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
  logLevel: LogLevel;
}

@injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = {
      appEnv: parseAppEnv(process.env.APP_ENV),
      awsRegion: process.env.AWS_REGION ?? 'us-east-1',
      dynamoDbTableName: process.env.DYNAMODB_TABLE_NAME ?? 'local-challenge-items',
      ...(process.env.DYNAMODB_ENDPOINT ? { dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT } : {}),
      ...(process.env.COGNITO_USER_POOL_ID ? { cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID } : {}),
      ...(process.env.COGNITO_CLIENT_ID ? { cognitoClientId: process.env.COGNITO_CLIENT_ID } : {}),
      logLevel: parseLogLevel(process.env.LOG_LEVEL)
    };
  }

  get values(): AppConfig {
    return this.config;
  }

  get appEnv(): AppEnvironment {
    return this.config.appEnv;
  }

  get awsRegion(): string {
    return this.config.awsRegion;
  }

  get dynamoDbTableName(): string {
    return this.config.dynamoDbTableName;
  }

  get dynamoDbEndpoint(): string | undefined {
    return this.config.dynamoDbEndpoint;
  }

  get cognitoUserPoolId(): string {
    return requiredConfig('COGNITO_USER_POOL_ID', this.config.cognitoUserPoolId);
  }

  get cognitoClientId(): string {
    return requiredConfig('COGNITO_CLIENT_ID', this.config.cognitoClientId);
  }

  get logLevel(): LogLevel {
    return this.config.logLevel;
  }
}

function parseAppEnv(value: string | undefined): AppEnvironment {
  const appEnv = value ?? 'local';

  if (isAppEnvironment(appEnv)) {
    return appEnv;
  }

  throw new Error(`APP_ENV must be one of: ${appEnvironments.join(', ')}`);
}

function parseLogLevel(value: string | undefined): LogLevel {
  const logLevel = value?.toLowerCase() ?? 'info';

  if (isLogLevel(logLevel)) {
    return logLevel;
  }

  throw new Error(`LOG_LEVEL must be one of: ${logLevels.join(', ')}`);
}

function isAppEnvironment(value: string): value is AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment);
}

function isLogLevel(value: string): value is LogLevel {
  return logLevels.includes(value as LogLevel);
}

function requiredConfig(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
