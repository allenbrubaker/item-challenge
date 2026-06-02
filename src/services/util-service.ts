import { injectable } from 'inversify';

@injectable()
export class UtilService {
  constructor() {}

  omit<T extends Record<string, any>, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
    const copy = { ...obj };
    keys.forEach(key => delete copy[key]);
    return copy;
  }

  pick<T extends Record<string, any>, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
    return keys.reduce(
      (acc, key) => {
        acc[key] = obj[key];
        return acc;
      },
      {} as Pick<T, K>
    );
  }

  groupBy = <T, TKey extends string | number>(list: T[], getKey: (_: T, i: number) => TKey) =>
    list.reduce<Record<TKey, T[]>>((group, item, i) => {
      const key = getKey(item, i);
      (group[key] ||= []).push(item);
      return group;
    }, {} as any);

  partition = <T, TResult = T>(
    list: T[],
    predicate: (item: T, index: number) => boolean,
    map: (item: T, index: number) => TResult = item => item as unknown as TResult
  ): [TResult[], TResult[]] => {
    const grouped = this.groupBy(list, (item, i) => String(predicate(item, i)));
    return [(grouped.true ?? []).map(map), (grouped.false ?? []).map(map)];
  };

  getBatches = <T, TMap = T[]>(list: T[], size: number, map: (_: T[], i: number) => TMap = x => x as TMap) => {
    return Object.values(this.groupBy(list, (_, i) => Math.floor(i / size))).map<TMap>(map);
  };

  decodeBase64 = (base64: string) => Buffer.from(base64, 'base64').toString('utf8');
  encodeBase64 = (s: string | Uint8Array) =>
    typeof s === 'string' ? Buffer.from(s, 'utf8').toString('base64') : Buffer.from(s).toString('base64');

  dictionary = <T extends Object, TKey extends string | number | symbol = string, TValue extends Object = string>(
    list: T[],
    getKey: (o: T) => TKey,
    getValue: (o: T, index: number) => TValue,
    replace?: (existing: TValue, candidate: TValue) => boolean
  ): Record<TKey, TValue> =>
    list.reduce(
      (map, next, i) => {
        const key = getKey(next);
        const value = getValue(next, i);
        map[key] = !replace || !map[key] ? value : replace(map[key], value) ? value : map[key];
        return map;
      },
      {} as Record<TKey, TValue>
    );

  dedup = <T extends Object>(list: T[], getKey: (o: T) => string, replace?: (current: T, candidate: T) => boolean) => {
    return Object.values(this.dictionary(list, getKey, x => x, replace));
  };

  findDups<T extends object>(list: T[], getKey: (x: T) => string): Set<string> {
    const dups = new Set<string>();
    this.dedup<T>(list, getKey, (_, dup) => {
      dups.add(getKey(dup));
      return true;
    });
    return dups;
  }

  partitionObject<T extends object>(
    object: T,
    predicate: (key: string, value: unknown) => boolean
  ): [Partial<T>, Partial<T>] {
    const group = this.groupBy(Object.entries(object), ([key, value]) => String(predicate(key, value)));
    return [Object.fromEntries(group.true ?? []) as T, Object.fromEntries(group.false ?? []) as T];
  }

  async processInBatches<T, S>(
    records: T[],
    batchSize: number,
    concurrency: number,
    cb: (batch: T[]) => Promise<S>
  ): Promise<void> {
    if (!records.length) return;
    const groups = this.getBatches(records, concurrency * batchSize);
    for (const group of groups) {
      await Promise.all(this.getBatches(group, batchSize, batch => cb(batch)));
    }
  }

  undefineEmpty<T extends object>(obj: T): T | undefined {
    return Object.keys(obj).length === 0 ? undefined : obj;
  }

  csvStringify(value?: unknown): string {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `[${value.map(item => this.csvStringify(item)).join(', ')}]`;
    return `{${Object.entries(value)
      .map(([key, item]) => `${key}=${this.csvStringify(item)}`)
      .join(', ')}}`;
  }

  deepMerge<T>(target: T, source: unknown): T {
    if (!this.isPlainObject(target) || !this.isPlainObject(source)) return source as T;
    return Object.entries(source).reduce(
      (merged, [key, value]) => {
        merged[key] =
          this.isPlainObject(merged[key]) && this.isPlainObject(value) ? this.deepMerge(merged[key], value) : value;
        return merged;
      },
      { ...(target as Record<string, unknown>) }
    ) as T;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }
}
