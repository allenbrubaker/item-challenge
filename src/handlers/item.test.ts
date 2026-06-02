import { apiGatewayEvent, sampleExamItem } from '../test/fixtures.js';

const itemServiceMock = vi.hoisted(() => ({
  createItem: vi.fn(),
  getItem: vi.fn(),
  updateItem: vi.fn(),
  listItems: vi.fn(),
  getAuditTrail: vi.fn()
}));

const logServiceMock = vi.hoisted(() => ({
  error: vi.fn()
}));

vi.mock('../services/container.js', () => ({
  container: {
    get: (service: { name: string }) => {
      if (service.name === 'ItemService') {
        return itemServiceMock;
      }

      return logServiceMock;
    }
  }
}));

const { createItem, getAuditTrail, getItem, listItems, updateItem } = await import('./item.js');

describe('item handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an item through the item service', async () => {
    const item = sampleExamItem();
    const input = createItemRequest(item);
    itemServiceMock.createItem.mockResolvedValue(item);

    const result = await createItem(apiGatewayEvent({ body: input }));

    expect(itemServiceMock.createItem).toHaveBeenCalledWith(input);
    expect(result.statusCode).toBe(201);
    expect(jsonBody(result)).toEqual(item);
  });

  it('gets an item by id', async () => {
    const item = sampleExamItem();
    itemServiceMock.getItem.mockResolvedValue(item);

    const result = await getItem(apiGatewayEvent({ pathParameters: { id: item.id } }));

    expect(itemServiceMock.getItem).toHaveBeenCalledWith(item.id);
    expect(result.statusCode).toBe(200);
    expect(jsonBody(result)).toEqual(item);
  });

  it('returns 404 when an item is not found', async () => {
    itemServiceMock.getItem.mockResolvedValue(null);

    const result = await getItem(apiGatewayEvent({ pathParameters: { id: 'missing-item' } }));

    expect(itemServiceMock.getItem).toHaveBeenCalledWith('missing-item');
    expect(result.statusCode).toBe(404);
    expect(jsonBody(result)).toEqual({ error: 'Item not found' });
  });

  it('lists items with query filters', async () => {
    const item = sampleExamItem();
    const listResult = { items: [item], nextCursor: 'next-page' };
    itemServiceMock.listItems.mockResolvedValue(listResult);

    const result = await listItems(
      apiGatewayEvent({
        queryStringParameters: {
          subject: item.subject,
          status: item.metadata.status,
          limit: '10'
        }
      })
    );

    expect(itemServiceMock.listItems).toHaveBeenCalledWith({
      subject: item.subject,
      status: item.metadata.status,
      limit: 10
    });
    expect(result.statusCode).toBe(200);
    expect(jsonBody(result)).toEqual(listResult);
  });

  it('updates an item through the item service', async () => {
    itemServiceMock.updateItem.mockResolvedValue(true);

    const result = await updateItem(
      apiGatewayEvent({
        pathParameters: { id: 'item-1' },
        body: {
          subject: 'AP Chemistry',
          metadata: {
            tags: ['atoms']
          }
        }
      })
    );

    expect(itemServiceMock.updateItem).toHaveBeenCalledWith({
      id: 'item-1',
      subject: 'AP Chemistry',
      metadata: {
        tags: ['atoms']
      }
    });
    expect(result.statusCode).toBe(204);
    expect(result.body).toBeUndefined();
  });

  it('returns 404 when updating a missing item', async () => {
    itemServiceMock.updateItem.mockResolvedValue(false);

    const result = await updateItem(apiGatewayEvent({ pathParameters: { id: 'missing-item' } }));

    expect(itemServiceMock.updateItem).toHaveBeenCalledWith({ id: 'missing-item' });
    expect(result.statusCode).toBe(404);
    expect(jsonBody(result)).toEqual({ error: 'Item not found' });
  });

  it('gets an item audit trail', async () => {
    const item = sampleExamItem();
    const auditResult = { items: [item] };
    itemServiceMock.getAuditTrail.mockResolvedValue(auditResult);

    const result = await getAuditTrail(
      apiGatewayEvent({
        pathParameters: { id: item.id },
        queryStringParameters: {
          limit: '5',
          cursor: 'page-2'
        }
      })
    );

    expect(itemServiceMock.getAuditTrail).toHaveBeenCalledWith({
      id: item.id,
      limit: 5,
      cursor: 'page-2'
    });
    expect(result.statusCode).toBe(200);
    expect(jsonBody(result)).toEqual(auditResult);
  });
});

function createItemRequest(item: ReturnType<typeof sampleExamItem>) {
  return {
    subject: item.subject,
    itemType: item.itemType,
    difficulty: item.difficulty,
    content: item.content,
    metadata: {
      author: item.metadata.author,
      status: item.metadata.status,
      tags: item.metadata.tags
    },
    securityLevel: item.securityLevel
  };
}

function jsonBody(result: { body?: string }) {
  return JSON.parse(result.body ?? '{}') as unknown;
}
