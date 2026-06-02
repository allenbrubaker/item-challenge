import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ConfigService } from '../services/config-service.js';
import { container } from '../services/container.js';
import { LogService } from '../services/log-service.js';

const configService = container.get(ConfigService);
const logService = container.get(LogService);

const verifier = CognitoJwtVerifier.create({
  userPoolId: configService.cognitoUserPoolId,
  tokenUse: 'access',
  clientId: configService.cognitoClientId
});

export async function handler(event: APIGatewayRequestAuthorizerEventV2): Promise<APIGatewaySimpleAuthorizerResult> {
  const token = getBearerToken(event);

  if (!token) {
    return { isAuthorized: false };
  }

  try {
    await verifier.verify(token);

    return {
      isAuthorized: true
    };
  } catch (error) {
    logService.error('Authorizer error', error);
    return { isAuthorized: false };
  }
}

function getBearerToken(event: APIGatewayRequestAuthorizerEventV2): string | null {
  const authorization = event.headers?.authorization ?? event.headers?.Authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}
