import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { BadRequestError, isHttpError } from '../errors/http-errors.js';
import { container } from '../services/container.js';
import { LogService } from '../services/log-service.js';

const jsonHeaders = {
  'content-type': 'application/json'
};
const logService = container.get(LogService);

export type SuccessStatusCode = 200 | 201 | 202 | 204;

export function apiHandler<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  callback: (input: z.infer<TSchema>, event: APIGatewayProxyEventV2) => Promise<unknown> | unknown,
  successStatusCode: SuccessStatusCode = 200
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  return async event => {
    try {
      const input = parse(event);
      const validatedInput = validate(input, schema);
      const result = await callback(validatedInput, event);
      return formatSuccess(result, successStatusCode);
    } catch (error) {
      logService.error('Handler error', error);
      return formatError(error);
    }
  };
}

function parse(event: APIGatewayProxyEventV2): Record<string, unknown> {
  let body: Record<string, unknown> = {};

  if (event.body) {
    try {
      const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      const parsedBody = JSON.parse(rawBody) as unknown;

      if (parsedBody !== null && !isRecord(parsedBody)) {
        throw new BadRequestError('Request body must be a JSON object');
      }

      body = parsedBody ?? {};
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new BadRequestError('Invalid JSON request body');
    }
  }

  return {
    ...body,
    ...(event.queryStringParameters ?? {}),
    ...(event.pathParameters ?? {})
  };
}

function validate<TSchema extends z.ZodTypeAny>(input: Record<string, unknown>, schema: TSchema): z.infer<TSchema> {
  return schema.parse(input);
}

function formatSuccess(result: unknown, statusCode: SuccessStatusCode): APIGatewayProxyStructuredResultV2 {
  if (statusCode === 204) {
    return {
      statusCode,
      headers: jsonHeaders
    };
  }

  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(result ?? {})
  };
}

function formatError(error: unknown): APIGatewayProxyStructuredResultV2 {
  if (error instanceof z.ZodError) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Bad request',
        details: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      })
    };
  }

  if (isHttpError(error)) {
    return {
      statusCode: error.statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }

  return {
    statusCode: 500,
    headers: jsonHeaders,
    body: JSON.stringify({ error: 'An internal error occurred.' })
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
