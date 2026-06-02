import { CreateItemRequestSchema, ExamItemSchema, ItemStatus, itemKey } from './index.js';

describe('types barrel', () => {
  it('re-exports schemas, enums, and record helpers', () => {
    expect(ItemStatus.Review).toBe('review');
    expect(itemKey('item-1')).toEqual({ pk: 'ITEM#item-1', sk: 'CURRENT' });
    expect(ExamItemSchema.shape.id.safeParse('item-1').success).toBe(true);
    expect(
      CreateItemRequestSchema.shape.metadata.safeParse({
        author: 'Ada',
        status: ItemStatus.Review,
        tags: ['cells']
      }).success
    ).toBe(true);
  });
});
