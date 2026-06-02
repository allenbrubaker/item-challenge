import { z } from 'zod';
import { NotFoundError } from '../errors/http-errors.js';
import { apiGatewayEvent } from '../test/fixtures.js';
import { apiHandler } from './handler-factory.js';

describe('apiHandler', () => {
  it('validates input and passes typed data to the callback', async () => {
    const callback = vi.fn(async (input: { name: string }) => ({ greeting: `Hello, ${input.name}` }));
    const handler = apiHandler(z.object({ name: z.string() }), callback);

    const result = await handler(apiGatewayEvent({ body: { name: 'Ada' } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body ?? '{}')).toEqual({ greeting: 'Hello, Ada' });
    expect(callback).toHaveBeenCalledWith({ name: 'Ada' }, expect.any(Object));
  });

  it('returns 400 for invalid JSON', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = apiHandler(z.object({ name: z.string() }), vi.fn());

    const result = await handler(apiGatewayEvent({ rawBody: '{' }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'Invalid JSON request body' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 400 for JSON bodies that are not objects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = apiHandler(z.object({ name: z.string() }), vi.fn());

    const result = await handler(apiGatewayEvent({ body: ['Ada'] }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'Request body must be a JSON object' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('parses base64 encoded request bodies', async () => {
    const callback = vi.fn(async (input: { name: string }) => input);
    const handler = apiHandler(z.object({ name: z.string() }), callback);

    const result = await handler({
      ...apiGatewayEvent(),
      body: Buffer.from(JSON.stringify({ name: 'Ada' }), 'utf8').toString('base64'),
      isBase64Encoded: true
    });

    expect(result.statusCode).toBe(200);
    expect(callback).toHaveBeenCalledWith({ name: 'Ada' }, expect.any(Object));
  });

  it('treats a null JSON body as an empty object before merging request params', async () => {
    const callback = vi.fn(async (input: { id: string }) => input);
    const handler = apiHandler(z.object({ id: z.string() }), callback);

    const result = await handler(apiGatewayEvent({ rawBody: 'null', pathParameters: { id: 'item-1' } }));

    expect(result.statusCode).toBe(200);
    expect(callback).toHaveBeenCalledWith({ id: 'item-1' }, expect.any(Object));
  });

  it('returns an empty JSON object when the callback result is nullish', async () => {
    const handler = apiHandler(z.object({ id: z.string() }), async () => undefined);

    const result = await handler(apiGatewayEvent({ pathParameters: { id: 'item-1' } }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body ?? '{}')).toEqual({});
  });

  it('uses a caller-provided success status code', async () => {
    const handler = apiHandler(z.object({ name: z.string() }), async input => input, 201);

    const result = await handler(apiGatewayEvent({ body: { name: 'Ada' } }));

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body ?? '{}')).toEqual({ name: 'Ada' });
  });

  it('omits the response body for 204 success responses', async () => {
    const handler = apiHandler(z.object({ id: z.string() }), async () => ({ ignored: true }), 204);

    const result = await handler(apiGatewayEvent({ pathParameters: { id: 'item-1' } }));

    expect(result.statusCode).toBe(204);
    expect(result.body).toBeUndefined();
  });

  it('returns 400 for zod validation failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = apiHandler(z.object({ name: z.string() }), vi.fn());

    const result = await handler(apiGatewayEvent({ body: { name: 123 } }));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({ error: 'Bad request' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('maps known custom errors to their status codes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = apiHandler(z.object({ id: z.string() }), async () => {
      throw new NotFoundError('Item not found');
    });

    const result = await handler(apiGatewayEvent({ pathParameters: { id: 'missing' } }));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'Item not found' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs unknown errors and returns an obfuscated 500', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = apiHandler(z.object({ id: z.string() }), async () => {
      throw new Error('database details');
    });

    const result = await handler(apiGatewayEvent({ pathParameters: { id: 'abc' } }));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body ?? '{}')).toEqual({ error: 'An internal error occurred.' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
