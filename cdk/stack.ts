import { CfnOutput, Duration, RemovalPolicy, Stack as CdkStack, StackProps as CdkStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DynamoDbIndex } from '../src/types/enums.js';

export interface StackProps extends CdkStackProps {
  appEnv: string;
}

const cdkDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(cdkDir, '..');

export class Stack extends CdkStack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const prefix = `${props.appEnv}-challenge-`;
    const removalPolicy = props.appEnv === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const commonLambdaEnvironment = {
      APP_ENV: props.appEnv,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      LOG_LEVEL: process.env.LOG_LEVEL ?? (props.appEnv === 'prod' ? 'info' : 'debug'),
      ...(props.appEnv === 'local' ? { DYNAMODB_ENDPOINT: 'http://localhost.localstack.cloud:4566' } : {})
    };

    const table = new dynamodb.Table(this, `${prefix}items-table`, {
      tableName: `${prefix}items`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: props.appEnv === 'prod'
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy
    });

    // Generic GSI names keep the table reusable for future single-table access patterns.
    table.addGlobalSecondaryIndex({
      indexName: DynamoDbIndex.gsi,
      partitionKey: { name: 'gsi_pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi_sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });
    table.addGlobalSecondaryIndex({
      indexName: DynamoDbIndex.gsi2,
      partitionKey: { name: 'gsi2_pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2_sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });
    table.addGlobalSecondaryIndex({
      indexName: DynamoDbIndex.gsi3,
      partitionKey: { name: 'gsi3_pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi3_sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });
    table.addGlobalSecondaryIndex({
      indexName: DynamoDbIndex.gsi4,
      partitionKey: { name: 'gsi4_pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi4_sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    const userPool = new cognito.UserPool(this, `${prefix}user-pool`, {
      userPoolName: `${prefix}user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy
    });

    const userPoolClient = new cognito.UserPoolClient(this, `${prefix}user-pool-client`, {
      userPool,
      userPoolClientName: `${prefix}user-pool-client`,
      authFlows: {
        userPassword: true,
        userSrp: true
      }
    });

    const authorizerFunction = this.createFunction(prefix, 'authorizer', 'src/handlers/authorizer.ts', {
      ...commonLambdaEnvironment,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId
    });

    const apiAuthorizer = new authorizers.HttpLambdaAuthorizer(`${prefix}lambda-authorizer`, authorizerFunction, {
      responseTypes: [authorizers.HttpLambdaResponseType.SIMPLE]
    });

    const api = new apigatewayv2.HttpApi(this, `${prefix}api`, {
      apiName: `${prefix}api`,
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.OPTIONS
        ],
        allowOrigins: ['*']
      }
    });

    const routeDefinitions: Array<{
      name: string;
      entry: string;
      handler: string;
      method: apigatewayv2.HttpMethod;
      path: string;
    }> = [
      {
        name: 'create-item',
        entry: 'src/handlers/item.ts',
        handler: 'createItem',
        method: apigatewayv2.HttpMethod.POST,
        path: '/api/items'
      },
      {
        name: 'get-item',
        entry: 'src/handlers/item.ts',
        handler: 'getItem',
        method: apigatewayv2.HttpMethod.GET,
        path: '/api/items/{id}'
      },
      {
        name: 'update-item',
        entry: 'src/handlers/item.ts',
        handler: 'updateItem',
        method: apigatewayv2.HttpMethod.PUT,
        path: '/api/items/{id}'
      },
      {
        name: 'list-items',
        entry: 'src/handlers/item.ts',
        handler: 'listItems',
        method: apigatewayv2.HttpMethod.GET,
        path: '/api/items'
      },
      {
        name: 'get-item-audit',
        entry: 'src/handlers/item.ts',
        handler: 'getAuditTrail',
        method: apigatewayv2.HttpMethod.GET,
        path: '/api/items/{id}/audit'
      }
    ];

    for (const route of routeDefinitions) {
      const fn = this.createFunction(
        prefix,
        route.name,
        route.entry,
        {
          ...commonLambdaEnvironment,
          DYNAMODB_TABLE_NAME: table.tableName
        },
        route.handler
      );
      table.grantReadWriteData(fn);

      api.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: new integrations.HttpLambdaIntegration(`${prefix}${route.name}-integration`, fn),
        authorizer: apiAuthorizer
      });
    }

    const streamFunction = this.createFunction(
      prefix,
      'stream',
      'src/handlers/stream.ts',
      {
        ...commonLambdaEnvironment,
        DYNAMODB_TABLE_NAME: table.tableName
      }
    );
    table.grantReadWriteData(streamFunction);
    streamFunction.addEventSource(
      new eventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 3
      })
    );

    new CfnOutput(this, `${prefix}api-url`, { value: api.apiEndpoint });
    new CfnOutput(this, `${prefix}table-name`, { value: table.tableName });
    new CfnOutput(this, `${prefix}user-pool-id`, { value: userPool.userPoolId });
    new CfnOutput(this, `${prefix}user-pool-client-id`, { value: userPoolClient.userPoolClientId });
  }

  private createFunction(
    prefix: string,
    name: string,
    entry: string,
    environment: Record<string, string>,
    handler = 'handler'
  ): nodejs.NodejsFunction {
    const functionName = `${prefix}${name}`;

    const fn = new nodejs.NodejsFunction(this, `${functionName}-lambda`, {
      functionName,
      entry: join(rootDir, entry),
      handler,
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment,
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: 'node20',
        sourceMap: true
      }
    });

    new logs.LogGroup(this, `${functionName}-log-group`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    return fn;
  }
}
