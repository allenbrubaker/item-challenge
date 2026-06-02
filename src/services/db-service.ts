import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  type GetCommandOutput,
  PutCommand,
  type PutCommandInput,
  type PutCommandOutput,
  QueryCommand,
  type QueryCommandInput,
  type QueryCommandOutput,
  UpdateCommand,
  type UpdateCommandInput
} from '@aws-sdk/lib-dynamodb';
import { inject, injectable } from 'inversify';
import { ConfigService } from './config-service.js';
import {
  BuildExpressionProps,
  DeepPartial,
  DynamoRecord,
  DynamoRecordKey,
  DynamoRecordPrimaryKey
} from '../types/records.js';
import { DynamoDbIndex } from '../types/index.js';
import { UtilService } from './util-service.js';
import { LogService } from './log-service.js';

export type UpdateOptions = {
  conditions?: string[];
  vars?: Record<string, unknown>;
  throwOnConflict?: boolean;
  orderAttr?: string;
  depth?: number;
  setExpressions?: string[];
};

@injectable()
export class DbService {
  readonly _client: DynamoDBDocumentClient;
  private readonly _table: string;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(UtilService) private readonly _util: UtilService,
    @inject(LogService) private readonly _log: LogService
  ) {
    const dynamoClient = new DynamoDBClient({
      region: configService.awsRegion,
      ...(configService.dynamoDbEndpoint ? { endpoint: configService.dynamoDbEndpoint } : {})
    });

    this._client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: { removeUndefinedValues: true }
    });

    this._table = configService.dynamoDbTableName;
  }

  async get<T>(key: DynamoRecordPrimaryKey): Promise<T | null> {
    return this.pluckItem<T>(
      await this._client.send(
        new GetCommand({
          TableName: this._table,
          Key: key
        })
      )
    );
  }

  put(item: DynamoRecord, input: Omit<PutCommandInput, 'TableName' | 'Item'> = {}): Promise<PutCommandOutput> {
    return this._client.send(
      new PutCommand({
        TableName: this._table,
        Item: item,
        ...input
      })
    );
  }

  query(
    key: Partial<DynamoRecordKey>,
    input: Omit<QueryCommandInput, 'TableName'> & { index?: DynamoDbIndex } = {}
  ): Promise<QueryCommandOutput> {
    const { index, ...queryInput } = input;
    const keyEntries = Object.entries(key);

    if (!keyEntries.length) {
      throw new Error('query-empty-keys');
    }

    const ExpressionAttributeNames = Object.fromEntries(keyEntries.map(([name]) => [`#${name}`, name]));
    const ExpressionAttributeValues = Object.fromEntries(keyEntries.map(([name, value]) => [`:${name}`, value]));

    return this._client.send(
      new QueryCommand({
        TableName: this._table,
        IndexName: index,
        KeyConditionExpression: keyEntries.map(([name]) => `#${name} = :${name}`).join(' AND '),
        ...queryInput,
        ExpressionAttributeNames: this._util.undefineEmpty({
          ...ExpressionAttributeNames,
          ...queryInput.ExpressionAttributeNames
        }),
        ExpressionAttributeValues: this._util.undefineEmpty({
          ...ExpressionAttributeValues,
          ...queryInput.ExpressionAttributeValues
        })
      })
    );
  }

  public async update<T>(
    item: DeepPartial<DynamoRecord<T>>,
    { conditions, vars, orderAttr, depth, setExpressions = [] }: UpdateOptions = {}
  ): Promise<void> {
    this._log.info('enter-update');
    const builtUpdate = this.buildUpdate<DynamoRecord<T>>({
      keys: ['pk', 'sk'],
      attrs: item,
      depth: depth ?? 1,
      conditions: ['attribute_exists(pk)', ...(conditions ?? [])],
      vars,
      orderAttr
    });
    await this._client.send(
      new UpdateCommand({
        ...builtUpdate,
        ...(setExpressions.length
          ? { UpdateExpression: `${builtUpdate.UpdateExpression}, ${setExpressions.join(', ')}` }
          : {})
      })
    );
    this._log.info('exit-update');
  }

  private buildUpdate<T extends DynamoRecord>({
    keys,
    attrs,
    conditions = [],
    vars = {},
    orderAttr,
    depth
  }: BuildExpressionProps<T>): UpdateCommandInput {
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    const setSegments: string[] = [];

    let isOrdered = false;

    const recur = (obj: any, depth: number, prefix?: string) => {
      for (let [key, val] of Object.entries(obj)) {
        const isReserved = RESERVED.has(key.toLowerCase());
        if (isReserved || INVALID_REGEX.test(key)) {
          const hashKey = `#${key.replace(INVALID_REGEX, '_')}`;
          names[hashKey] = key;
          key = hashKey;
        }
        if (prefix) {
          key = `${prefix}.${key}`;
        }
        if (val === undefined || keys.includes(key as keyof T)) continue;
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && depth > 0) {
          recur(val, depth - 1, key);
        } else {
          const keyNoHash = key.replace(/#/g, '');
          const fieldKey = key;
          const valueKey = `:${keyNoHash.replace(/\./g, '_')}`;
          values[valueKey] = val;
          setSegments.push(`${fieldKey} = ${valueKey}`);

          if (keyNoHash === orderAttr) {
            conditions = [
              ...conditions,
              `attribute_not_exists(${fieldKey}) OR attribute_type(${fieldKey}, :NULL) OR ${valueKey} > ${fieldKey}`
            ];
            values[':NULL'] = 'NULL';
            isOrdered = true;
          }
        }
      }
    };

    recur(attrs, depth ?? 0);

    if (orderAttr && !isOrdered) throw new Error(`Order attribute ${String(orderAttr)} is missing in update statement`);

    const [keyVars, valueVars] = this._util.partitionObject(vars, key => key.startsWith('#'));

    return {
      TableName: this._table,
      Key: keys.reduce<Partial<T>>((acc, key) => {
        acc[key] = (attrs as Partial<T>)[key];
        return acc;
      }, {}),
      UpdateExpression: `SET ${setSegments.join(', ')}`,
      ExpressionAttributeNames: this._util.undefineEmpty({ ...names, ...(keyVars as Record<string, string>) }),
      ExpressionAttributeValues: this._util.undefineEmpty({ ...values, ...valueVars }),
      ...(conditions.length && { ConditionExpression: conditions.map(c => `(${c})`).join(' AND ') })
    };
  }

  pluckItems<T>(output: QueryCommandOutput): T[] {
    return (output.Items ?? []).map(item => (item as DynamoRecord<T>).detail);
  }

  pluckItem<T>(output: GetCommandOutput): T | null {
    return (output?.Item as DynamoRecord<T>)?.detail ?? null;
  }

  pluckRecord<T>(record: Record<string, unknown> | undefined): T | null {
    return (record as DynamoRecord<T> | undefined)?.detail ?? null;
  }

  isConditionalCheckFailed(error: unknown): boolean {
    return error instanceof Error && error.name === 'ConditionalCheckFailedException';
  }
}

const INVALID_REGEX = /[^a-zA-Z0-9_.]/g;
const RESERVED = new Set<string>([
  'abort',
  'absolute',
  'action',
  'add',
  'after',
  'agent',
  'aggregate',
  'all',
  'allocate',
  'alter',
  'analyze',
  'and',
  'any',
  'archive',
  'are',
  'array',
  'as',
  'asc',
  'ascii',
  'asensitive',
  'assertion',
  'asymmetric',
  'at',
  'atomic',
  'attach',
  'attribute',
  'auth',
  'authorization',
  'authorize',
  'auto',
  'avg',
  'back',
  'backup',
  'base',
  'batch',
  'before',
  'begin',
  'between',
  'bigint',
  'binary',
  'bit',
  'blob',
  'block',
  'boolean',
  'both',
  'breadth',
  'bucket',
  'bulk',
  'by',
  'byte',
  'call',
  'called',
  'calling',
  'capacity',
  'cascade',
  'cascaded',
  'case',
  'cast',
  'catalog',
  'char',
  'character',
  'check',
  'class',
  'clob',
  'close',
  'cluster',
  'clustered',
  'clustering',
  'clusters',
  'coalesce',
  'collate',
  'collation',
  'collection',
  'column',
  'columns',
  'combine',
  'comment',
  'commit',
  'compact',
  'compile',
  'compress',
  'condition',
  'conflict',
  'connect',
  'connection',
  'consistency',
  'consistent',
  'constraint',
  'constraints',
  'constructor',
  'consumed',
  'continue',
  'convert',
  'copy',
  'corresponding',
  'count',
  'counter',
  'create',
  'cross',
  'cube',
  'current',
  'cursor',
  'cycle',
  'data',
  'database',
  'date',
  'datetime',
  'day',
  'deallocate',
  'dec',
  'decimal',
  'declare',
  'default',
  'deferrable',
  'deferred',
  'define',
  'defined',
  'definition',
  'delete',
  'delimited',
  'depth',
  'deref',
  'desc',
  'describe',
  'descriptor',
  'detach',
  'deterministic',
  'diagnostics',
  'directories',
  'disable',
  'disconnect',
  'distinct',
  'distribute',
  'do',
  'domain',
  'double',
  'drop',
  'dump',
  'duration',
  'dynamic',
  'each',
  'element',
  'else',
  'elseif',
  'empty',
  'enable',
  'end',
  'equal',
  'equals',
  'error',
  'escape',
  'escaped',
  'eval',
  'evaluate',
  'exceeded',
  'except',
  'exception',
  'exceptions',
  'exclusive',
  'exec',
  'execute',
  'exists',
  'exit',
  'explain',
  'explode',
  'export',
  'expression',
  'extended',
  'external',
  'extract',
  'fail',
  'false',
  'family',
  'fetch',
  'fields',
  'file',
  'filter',
  'filtering',
  'final',
  'finish',
  'first',
  'fixed',
  'flattern',
  'float',
  'for',
  'force',
  'foreign',
  'format',
  'forward',
  'found',
  'free',
  'from',
  'full',
  'function',
  'functions',
  'general',
  'generate',
  'get',
  'glob',
  'global',
  'go',
  'goto',
  'grant',
  'greater',
  'group',
  'grouping',
  'handler',
  'hash',
  'have',
  'having',
  'heap',
  'hidden',
  'hold',
  'hour',
  'identified',
  'identity',
  'if',
  'ignore',
  'immediate',
  'import',
  'in',
  'including',
  'inclusive',
  'increment',
  'incremental',
  'index',
  'indexed',
  'indexes',
  'indicator',
  'infinite',
  'initially',
  'inline',
  'inner',
  'innter',
  'inout',
  'input',
  'insensitive',
  'insert',
  'instead',
  'int',
  'integer',
  'intersect',
  'interval',
  'into',
  'invalidate',
  'is',
  'isolation',
  'item',
  'items',
  'iterate',
  'join',
  'key',
  'keys',
  'lag',
  'language',
  'large',
  'last',
  'lateral',
  'lead',
  'leading',
  'leave',
  'left',
  'length',
  'less',
  'level',
  'like',
  'limit',
  'limited',
  'lines',
  'list',
  'load',
  'local',
  'localtime',
  'localtimestamp',
  'location',
  'locator',
  'lock',
  'locks',
  'log',
  'loged',
  'long',
  'loop',
  'lower',
  'map',
  'match',
  'materialized',
  'max',
  'maxlen',
  'member',
  'merge',
  'method',
  'metrics',
  'min',
  'minus',
  'minute',
  'missing',
  'mod',
  'mode',
  'modifies',
  'modify',
  'module',
  'month',
  'multi',
  'multiset',
  'name',
  'names',
  'national',
  'natural',
  'nchar',
  'nclob',
  'new',
  'next',
  'no',
  'none',
  'not',
  'null',
  'nullif',
  'number',
  'numeric',
  'object',
  'of',
  'offline',
  'offset',
  'old',
  'on',
  'online',
  'only',
  'opaque',
  'open',
  'operator',
  'option',
  'or',
  'order',
  'ordinality',
  'other',
  'others',
  'out',
  'outer',
  'output',
  'over',
  'overlaps',
  'override',
  'owner',
  'pad',
  'parallel',
  'parameter',
  'parameters',
  'partial',
  'partition',
  'partitioned',
  'partitions',
  'path',
  'percent',
  'percentile',
  'permission',
  'permissions',
  'pipe',
  'pipelined',
  'plan',
  'pool',
  'position',
  'precision',
  'prepare',
  'preserve',
  'primary',
  'prior',
  'private',
  'privileges',
  'procedure',
  'processed',
  'project',
  'projection',
  'property',
  'provisioning',
  'public',
  'put',
  'query',
  'quit',
  'quorum',
  'raise',
  'random',
  'range',
  'rank',
  'raw',
  'read',
  'reads',
  'real',
  'rebuild',
  'record',
  'recursive',
  'reduce',
  'ref',
  'reference',
  'references',
  'referencing',
  'regexp',
  'region',
  'reindex',
  'relative',
  'release',
  'remainder',
  'rename',
  'repeat',
  'replace',
  'request',
  'reset',
  'resignal',
  'resource',
  'response',
  'restore',
  'restrict',
  'result',
  'return',
  'returning',
  'returns',
  'reverse',
  'revoke',
  'right',
  'role',
  'roles',
  'rollback',
  'rollup',
  'routine',
  'row',
  'rows',
  'rule',
  'rules',
  'sample',
  'satisfies',
  'save',
  'savepoint',
  'scan',
  'schema',
  'scope',
  'scroll',
  'search',
  'second',
  'section',
  'segment',
  'segments',
  'select',
  'self',
  'semi',
  'sensitive',
  'separate',
  'sequence',
  'serializable',
  'session',
  'set',
  'sets',
  'shard',
  'share',
  'shared',
  'short',
  'show',
  'signal',
  'similar',
  'size',
  'skewed',
  'smallint',
  'snapshot',
  'some',
  'source',
  'space',
  'spaces',
  'sparse',
  'specific',
  'specifictype',
  'split',
  'sql',
  'sqlcode',
  'sqlerror',
  'sqlexception',
  'sqlstate',
  'sqlwarning',
  'start',
  'state',
  'static',
  'status',
  'storage',
  'store',
  'stored',
  'stream',
  'string',
  'struct',
  'style',
  'sub',
  'submultiset',
  'subpartition',
  'substring',
  'subtype',
  'sum',
  'super',
  'symmetric',
  'synonym',
  'system',
  'table',
  'tablesample',
  'temp',
  'temporary',
  'terminated',
  'text',
  'than',
  'then',
  'throughput',
  'time',
  'timestamp',
  'timezone',
  'tinyint',
  'to',
  'token',
  'total',
  'touch',
  'trailing',
  'transaction',
  'transform',
  'translate',
  'translation',
  'treat',
  'trigger',
  'trim',
  'true',
  'truncate',
  'ttl',
  'tuple',
  'type',
  'under',
  'undo',
  'union',
  'unique',
  'unit',
  'unknown',
  'unlogged',
  'unnest',
  'unprocessed',
  'unsigned',
  'until',
  'update',
  'upper',
  'url',
  'usage',
  'use',
  'user',
  'users',
  'using',
  'uuid',
  'vacuum',
  'value',
  'valued',
  'values',
  'varchar',
  'variable',
  'variance',
  'varint',
  'varying',
  'view',
  'views',
  'virtual',
  'void',
  'wait',
  'when',
  'whenever',
  'where',
  'while',
  'window',
  'with',
  'within',
  'without',
  'work',
  'wrapped',
  'write',
  'year',
  'zone'
]);
