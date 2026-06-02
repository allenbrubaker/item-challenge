import { App } from 'aws-cdk-lib';
import { Stack } from './stack.js';

const allowedEnvironments = ['local', 'dev', 'qa', 'int', 'uat', 'prod'] as const;
const appEnv = process.env.APP_ENV ?? 'local';

if (!allowedEnvironments.includes(appEnv as (typeof allowedEnvironments)[number])) {
  throw new Error(`APP_ENV must be one of: ${allowedEnvironments.join(', ')}`);
}

const app = new App();

new Stack(app, `${appEnv}-challenge-stack`, {
  appEnv,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1'
  }
});
