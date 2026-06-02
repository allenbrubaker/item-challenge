import { testConfigService } from '../test/fixtures.js';
import { LogService } from './log-service.js';

describe('LogService', () => {
  it('uses LOG_LEVEL as the minimum logged severity', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logService = new LogService(testConfigService({ LOG_LEVEL: 'warn' }));

    logService.debug('debug message');
    logService.info('info message');
    logService.warn('warn message');
    logService.error('error message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('warn message');
    expect(errorSpy).toHaveBeenCalledWith('error message');

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
