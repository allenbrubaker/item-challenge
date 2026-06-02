import { mockConsole } from '../test/utils.js';
import { container } from './container.js';
import { UtilService } from './util-service.js';

describe('UtilService', () => {
  const service = container.get(UtilService);

  beforeEach(() => {
    mockConsole();
    vi.clearAllMocks();
  });

  describe('omit', () => {
    it('should omit specified keys from an object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = service.omit(obj, 'a', 'c');
      expect(result).toEqual({ b: 2 });
    });

    it('should not modify the original object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      service.omit(obj, 'a', 'c');
      expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('pick', () => {
    it('should pick specified keys from an object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = service.pick(obj, 'a', 'c');
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should not include keys that are not present in the object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = service.pick(obj, 'a', 'd' as any);
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('groupBy()', () => {
    it('should group objects by the key extractor', () => {
      const list = [{ a: 'cat', b: 1 }, { a: 'dog' }, { a: 'mouse' }, { a: 'cat', b: 2 }];
      expect(service.groupBy(list, x => x.a)).toEqual({
        cat: list.filter(x => x.a === 'cat'),
        dog: list.filter(x => x.a === 'dog'),
        mouse: list.filter(x => x.a === 'mouse')
      });
    });
  });

  describe('partition()', () => {
    it('returns two empty arrays for an empty list', () => {
      const [yes, no] = service.partition([], () => true);
      expect(yes).toEqual([]);
      expect(no).toEqual([]);
    });

    it('partitions items into [trueItems, falseItems] using the predicate result', () => {
      const list = [1, 2, 3, 4, 5];
      const [evens, odds] = service.partition(list, n => n % 2 === 0);
      expect(evens).toEqual([2, 4]);
      expect(odds).toEqual([1, 3, 5]);
    });
  });

  describe('decodeBase64()', () => {
    it('encodes and decodes a string to base 64', () => {
      const message = 'xyz';
      expect(service.decodeBase64(service.encodeBase64(message))).toEqual(message);
    });

    it('decodes UInt8Array to base 64', () => {
      const message = new Uint8Array([1, 2, 3]);

      expect(service.encodeBase64(message)).toEqual(Buffer.from(message).toString('base64'));
    });
  });

  describe('getBatches()', () => {
    it("subdivides an array into groups of size 'size'", () => {
      expect(service.getBatches([1, 2, 3, 4, 5, 6, 7, 8, 9], 2)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9]]);
      expect(
        service.getBatches([1, 2, 3, 4, 5, 6, 7, 8, 9], 5, batch => ({
          batch
        }))
      ).toEqual([{ batch: [1, 2, 3, 4, 5] }, { batch: [6, 7, 8, 9] }]);
    });
  });

  describe('dedup()', () => {
    it('dedups an array of objects based on a key extractor', () => {
      const list = [
        { a: 'hello', b: 1 },
        { a: 'world', b: 2 },
        { a: 'hello', b: 3 }
      ];
      expect(service.dedup(list, x => x.a)).toEqual([
        { a: 'hello', b: 3 },
        { a: 'world', b: 2 }
      ]);
    });
  });

  describe('findDups()', () => {
    it('returns the duplicated keys', () => {
      const list = [
        { a: 'hello', b: 1 },
        { a: 'world', b: 2 },
        { a: 'hello', b: 3 },
        { a: 'world', b: 4 },
        { a: 'solo', b: 5 }
      ];

      expect(service.findDups(list, x => x.a)).toEqual(new Set(['hello', 'world']));
    });
  });

  describe('dictionary()', () => {
    it('should create a dictionary where the keys and values are constructed according to the getKey and getValue parameters', () => {
      expect(
        service.dictionary(
          [
            { a: 'hello', b: 2 },
            { a: 'world', b: 4 }
          ],
          x => x.a,
          x => x.b
        )
      ).toEqual({ hello: 2, world: 4 });
    });
    it('should only replace existing value if replace predicate is specified and returns true', () => {
      expect(
        service.dictionary(
          [
            { a: 'hello', b: 2 },
            { a: 'hello', b: 4 }
          ],
          x => x.a,
          x => x.b,
          (existing, candidate) => candidate > existing
        )
      ).toEqual({ hello: 4 });
      expect(
        service.dictionary(
          [
            { a: 'hello', b: 4 },
            { a: 'hello', b: 2 }
          ],
          x => x.a,
          x => x.b,
          (existing, candidate) => candidate > existing
        )
      ).toEqual({ hello: 4 });
    });
  });

  describe('partitionObject()', () => {
    it('should partition an object into two based on the predicate', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const [even, odd] = service.partitionObject(obj, (key, value) => Number(value) % 2 === 0);
      expect(even).toEqual({ b: 2, d: 4 });
      expect(odd).toEqual({ a: 1, c: 3 });
    });

    it('should return empty objects if the input object is empty', () => {
      const obj = {};
      const [group1, group2] = service.partitionObject(obj, (key, value) => Number(value) > 0);
      expect(group1).toEqual({});
      expect(group2).toEqual({});
    });
  });

  describe('processInBatches()', () => {
    const concurrency = 500;
    const cb = vi.fn();
    const getBatches = vi.spyOn(service, 'getBatches');

    it('processes records in batches by invoking the callback function on each batch', async () => {
      const records = Array(5)
        .fill(0)
        .map((_, id) => ({ id }));
      await service.processInBatches(records, 10, concurrency, cb);
      expect(getBatches).toHaveBeenCalledTimes(2);
      expect(getBatches).toHaveBeenNthCalledWith(1, records, concurrency * 10);
      expect(getBatches).toHaveBeenNthCalledWith(2, records, 10, expect.any(Function));
      expect(cb).toHaveBeenCalledWith(records);
    });

    it('skips processing 0 records', async () => {
      await service.processInBatches([], 10, concurrency, cb);
      expect(getBatches).not.toHaveBeenCalled();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('undefinedIfEmpty()', () => {
    it('returns undefined for empty object literal', () => {
      expect(service.undefineEmpty({})).toBeUndefined();
    });

    it('returns original object when not empty', () => {
      const obj = { a: 1 };
      expect(service.undefineEmpty(obj)).toBe(obj);
    });
  });

  describe('csvStringify()', () => {
    it('returns an empty string for undefined input', () => {
      expect(service.csvStringify(undefined)).toBe('');
    });

    it('stringifies nested objects and arrays', () => {
      expect(
        service.csvStringify({
          a: 1,
          b: { c: 'x', d: [2, { e: false }] }
        })
      ).toBe('{a=1, b={c=x, d=[2, {e=false}]}}');
    });

    it('renders null nested values as empty strings', () => {
      expect(service.csvStringify({ a: null, b: [null] } as any)).toBe('{a=, b=[]}');
    });
  });

  describe('deepMerge()', () => {
    it('returns the source when either value is not a plain object', () => {
      expect(service.deepMerge({ a: 1 }, null)).toBeNull();
      expect(service.deepMerge('target' as any, { a: 1 })).toEqual({ a: 1 });
    });

    it('deep merges nested object fields', () => {
      expect(
        service.deepMerge(
          { a: 1, nested: { keep: true, replace: 'old', deep: { x: 1 } } },
          { nested: { replace: 'new', deep: { y: 2 } }, b: 2 }
        )
      ).toEqual({
        a: 1,
        nested: { keep: true, replace: 'new', deep: { x: 1, y: 2 } },
        b: 2
      });
    });

    it('replaces arrays and non-object values', () => {
      expect(service.deepMerge({ a: { x: 1 }, list: [1] }, { a: 'replaced', list: [2] })).toEqual({
        a: 'replaced',
        list: [2]
      });
    });
  });
});
