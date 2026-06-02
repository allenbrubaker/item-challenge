import { App } from 'aws-cdk-lib';
import { Stack } from './stack.js';

describe('Stack', () => {
  it('synthesizes the DynamoDB table with generic GSI names', () => {
    const app = new App();
    const stack = new Stack(app, 'dev-challenge-stack-test', { appEnv: 'dev' });
    expect(stack).toMatchCdkSnapshot({
      ignoreAssets: true
    });
  });
});
