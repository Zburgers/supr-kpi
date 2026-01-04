/**
 * Structured Logger
 * Provides consistent JSON logging for observability with improved formatting
 *
 * @module lib/logger
 */

import pino, { Logger as PinoLogger } from 'pino';
import { ETLEvent, ETLEventType, DataSource, IsoDate } from '../types/etl.js';

// Create base pino logger with pretty printing in development
const createPinoLogger = (componentName?: string): PinoLogger => {
  const isDev = process.env.NODE_ENV !== 'production';

  const transport = isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
    }
  } : undefined;

  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport,
    base: componentName ? { component: componentName } : undefined,
    formatters: {
      level(label) {
        return { level: label };
      }
    }
  });

  return logger;
};

/**
 * Logger class with structured output
 * Can be instantiated with a component name for contextualized logging
 */
class Logger {
  private pinoLogger: PinoLogger;
  private context: Record<string, unknown> = {};

  constructor(componentName?: string) {
    this.pinoLogger = createPinoLogger(componentName);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger();
    childLogger.pinoLogger = this.pinoLogger.child(context);
    return childLogger;
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.pinoLogger.debug(context || {}, message);
    }
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.info(context || {}, message);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.warn(context || {}, message);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.pinoLogger.error(context || {}, message);
  }

  /**
   * Log an ETL event
   */
  event(event: ETLEvent): void {
    const level = event.type.includes('FAILURE') || event.type.includes('EXPIRED') ? 'error' : 'info';
    const logMethod = this.pinoLogger[level].bind(this.pinoLogger);

    logMethod({
      eventType: event.type,
      source: event.source,
      date: event.date,
      jobId: event.jobId,
      durationMs: event.durationMs,
      rowCount: event.rowCount,
      error: event.error,
      ...event.metadata,
    }, `ETL_EVENT: ${event.type}`);
  }
}

/**
 * Event emitter for ETL events
 * Decouples event emission from logging
 */
class EventEmitter {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Emit an ETL event
   */
  emit(
    type: ETLEventType,
    options?: {
      source?: DataSource;
      date?: IsoDate;
      jobId?: string;
      durationMs?: number;
      rowCount?: number;
      error?: string;
      metadata?: Record<string, unknown>;
    }
  ): ETLEvent {
    const event: ETLEvent = {
      type,
      timestamp: now(),
      source: options?.source,
      date: options?.date,
      jobId: options?.jobId,
      durationMs: options?.durationMs,
      rowCount: options?.rowCount,
      error: options?.error,
      metadata: options?.metadata,
    };

    this.logger.event(event);
    return event;
  }

  /**
   * Emit sync started event
   */
  syncStarted(source: DataSource, date: IsoDate, jobId: string): ETLEvent {
    return this.emit('SYNC_STARTED', { source, date, jobId });
  }

  /**
   * Emit sync success event
   */
  syncSuccess(
    source: DataSource,
    date: IsoDate,
    jobId: string,
    durationMs: number,
    rowCount: number = 1
  ): ETLEvent {
    return this.emit('SYNC_SUCCESS', { source, date, jobId, durationMs, rowCount });
  }

  /**
   * Emit sync failure event
   */
  syncFailure(source: DataSource, date: IsoDate, jobId: string, error: string, durationMs?: number): ETLEvent {
    return this.emit('SYNC_FAILURE', { source, date, jobId, error, durationMs });
  }

  /**
   * Emit row appended event
   */
  rowAppended(source: DataSource, date: IsoDate, rowNumber: number): ETLEvent {
    return this.emit('ROW_APPENDED', { source, date, metadata: { rowNumber } });
  }

  /**
   * Emit row updated event
   */
  rowUpdated(source: DataSource, date: IsoDate, rowNumber: number): ETLEvent {
    return this.emit('ROW_UPDATED', { source, date, metadata: { rowNumber } });
  }

  /**
   * Emit rate limited event
   */
  rateLimited(source: DataSource, retryAfterMs?: number): ETLEvent {
    return this.emit('RATE_LIMITED', { source, metadata: { retryAfterMs } });
  }

  /**
   * Emit token expired event
   */
  tokenExpired(source: DataSource): ETLEvent {
    return this.emit('TOKEN_EXPIRED', { source });
  }

  /**
   * Emit schema mismatch event
   */
  schemaMismatch(source: DataSource, expected: string[], actual: string[]): ETLEvent {
    return this.emit('SCHEMA_MISMATCH', { source, metadata: { expected, actual } });
  }
}

// Export singleton instances
/**
 * Get current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

// Export singleton instances
export const logger = new Logger();
export const events = new EventEmitter(logger);

export { Logger, EventEmitter };
