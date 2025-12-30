/**
 * Structured Logger
 * Provides consistent JSON logging for observability
 *
 * @module lib/logger
 */

import { ETLEvent, ETLEventType, DataSource, IsoDate } from '../types/etl.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
}

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /apiKey/i,
  /accessKey/i,
  /secretKey/i,
];

/**
 * Redact sensitive data from logs using JSON.stringify replacer
 */
export function logReplacer(key: string, value: any): any {
  // Pass through if value is null/undefined
  if (value === null || value === undefined) return value;

  if (key && SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
    return '[REDACTED]';
  }

  return value;
}

/**
 * Format log entry as JSON
 */
function formatLog(entry: LogEntry): string {
  try {
    return JSON.stringify({
      ...entry,
      timestamp: entry.timestamp,
    }, logReplacer);
  } catch (error) {
    // Fallback if JSON.stringify fails (e.g. circular reference)
    return JSON.stringify({
      level: entry.level,
      timestamp: entry.timestamp,
      message: entry.message,
      error: 'Failed to serialize context: ' + (error instanceof Error ? error.message : String(error)),
    });
  }
}

/**
 * Get current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Logger class with structured output
 * Can be instantiated with a component name for contextualized logging
 */
class Logger {
  private context: Record<string, unknown> = {};
  private componentName?: string;

  constructor(componentName?: string) {
    if (componentName) {
      this.componentName = componentName;
      this.context = { component: componentName };
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, context);
    }
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      timestamp: now(),
      message,
      context: { ...this.context, ...context },
    };

    const output = formatLog(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Log an ETL event
   */
  event(event: ETLEvent): void {
    const level = event.type.includes('FAILURE') || event.type.includes('EXPIRED') ? 'error' : 'info';
    this.log(level, `ETL_EVENT: ${event.type}`, {
      eventType: event.type,
      source: event.source,
      date: event.date,
      jobId: event.jobId,
      durationMs: event.durationMs,
      rowCount: event.rowCount,
      error: event.error,
      ...event.metadata,
    });
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
export const logger = new Logger();
export const events = new EventEmitter(logger);

export { Logger, EventEmitter };
