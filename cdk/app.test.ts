describe('CDK app entrypoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('loads with a supported environment', async () => {
    vi.stubEnv('APP_ENV', 'dev');
    vi.stubEnv('CDK_DEFAULT_ACCOUNT', '123456789012');
    vi.stubEnv('CDK_DEFAULT_REGION', 'us-west-2');
    vi.resetModules();

    await expect(import('./app.js')).resolves.toBeDefined();
  });

  it('rejects unsupported environments', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.resetModules();

    await expect(import('./app.js')).rejects.toThrow('APP_ENV must be one of: local, dev, qa, int, uat, prod');
  });
});
