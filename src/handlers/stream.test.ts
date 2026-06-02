import type { DynamoDBStreamEvent } from 'aws-lambda';

const streamMock = vi.hoisted(() => vi.fn());

vi.mock('../services/container.js', () => ({
  container: {
    get: () => ({
      stream: streamMock
    })
  }
}));

const { handler } = await import('./stream.js');

describe('stream handler', () => {
  beforeEach(() => {
    streamMock.mockReset();
  });

  it('invokes the stream service with the DynamoDB stream event', async () => {
    const event: DynamoDBStreamEvent = { Records: [] };

    await handler(event);

    expect(streamMock).toHaveBeenCalledWith(event);
  });
});
