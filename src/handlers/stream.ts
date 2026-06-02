import type { DynamoDBStreamEvent } from 'aws-lambda';
import { container } from '../services/container.js';
import { StreamService } from '../services/stream-service.js';

const streamService = container.get(StreamService);

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  await streamService.stream(event);
}
