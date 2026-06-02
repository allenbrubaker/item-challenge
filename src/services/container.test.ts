describe('service container', () => {
  it('resolves singleton services directly from the container', async () => {
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('DYNAMODB_TABLE_NAME', 'test-table');
    vi.stubEnv('LOG_LEVEL', 'error');
    vi.resetModules();

    const { container } = await import('./container.js');
    const { ConfigService } = await import('./config-service.js');
    const { DbService } = await import('./db-service.js');
    const { ItemService } = await import('./item-service.js');
    const { LogService } = await import('./log-service.js');
    const { StreamService } = await import('./stream-service.js');

    expect(container.get(ConfigService)).toBe(container.get(ConfigService));
    expect(container.get(DbService)).toBe(container.get(DbService));
    expect(container.get(LogService)).toBe(container.get(LogService));
    expect(container.get(ItemService)).toBeInstanceOf(ItemService);
    expect(container.get(StreamService)).toBeInstanceOf(StreamService);

    vi.unstubAllEnvs();
  });
});
