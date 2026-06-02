import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';

const verifyMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn(() => ({ verify: verifyMock })));
const logServiceMock = vi.hoisted(() => ({
  error: vi.fn()
}));

vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: createMock
  }
}));

vi.mock('../services/container.js', () => ({
  container: {
    get: (service: { name: string }) => {
      if (service.name === 'ConfigService') {
        return {
          cognitoUserPoolId: 'test-user-pool',
          cognitoClientId: 'test-client-id'
        };
      }

      return logServiceMock;
    }
  }
}));

const { handler } = await import('./authorizer.js');

describe('authorizer handler', () => {
  beforeEach(() => {
    verifyMock.mockReset();
    logServiceMock.error.mockReset();
  });

  it('creates a Cognito access-token verifier from config', () => {
    expect(createMock).toHaveBeenCalledWith({
      userPoolId: 'test-user-pool',
      tokenUse: 'access',
      clientId: 'test-client-id'
    });
  });

  it('denies requests without a bearer token', async () => {
    const result = await handler(authorizerEvent());

    expect(result).toEqual({ isAuthorized: false });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('allows requests with a valid bearer token from lowercase headers', async () => {
    verifyMock.mockResolvedValue({});

    const result = await handler(authorizerEvent({ authorization: 'Bearer valid-token' }));

    expect(verifyMock).toHaveBeenCalledWith('valid-token');
    expect(result).toEqual({ isAuthorized: true });
  });

  it('allows requests with a valid bearer token from uppercase headers', async () => {
    verifyMock.mockResolvedValue({});

    const result = await handler(authorizerEvent({ Authorization: 'Bearer another-token' }));

    expect(verifyMock).toHaveBeenCalledWith('another-token');
    expect(result).toEqual({ isAuthorized: true });
  });

  it('denies and logs when token verification fails', async () => {
    const error = new Error('invalid token');
    verifyMock.mockRejectedValue(error);

    const result = await handler(authorizerEvent({ authorization: 'Bearer bad-token' }));

    expect(verifyMock).toHaveBeenCalledWith('bad-token');
    expect(logServiceMock.error).toHaveBeenCalledWith('Authorizer error', error);
    expect(result).toEqual({ isAuthorized: false });
  });
});

function authorizerEvent(headers: Record<string, string> = {}): APIGatewayRequestAuthorizerEventV2 {
  return {
    version: '2.0',
    type: 'REQUEST',
    routeArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/$default/GET/items',
    identitySource: [],
    routeKey: 'GET /items',
    rawPath: '/items',
    rawQueryString: '',
    cookies: [],
    headers,
    requestContext: {} as APIGatewayRequestAuthorizerEventV2['requestContext']
  };
}
