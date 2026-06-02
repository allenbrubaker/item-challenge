import { inject, injectable } from 'inversify';
import { ConfigService, LogLevel } from './config-service.js';

const logSeverity: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

@injectable()
export class LogService {
  constructor(@inject(ConfigService) private readonly configService: ConfigService) {}

  debug(message: string, context?: unknown): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: unknown): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: unknown): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: unknown): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const consoleMethod = console[level];

    if (context === undefined) {
      consoleMethod(message);
      return;
    }

    consoleMethod(message, context);
  }

  private shouldLog(level: LogLevel): boolean {
    return logSeverity[level] >= logSeverity[this.configService.logLevel];
  }
}
