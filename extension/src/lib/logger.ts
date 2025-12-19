/**
 * Enhanced Logger for Browser Extension
 * 
 * Logs to both:
 * 1. Browser console (for dev tools)
 * 2. Chrome storage (readable by Cursor via exported file)
 * 
 * Usage:
 *   import { logger } from './lib/logger';
 *   logger.info('Message', { data: 'value' });
 *   logger.error('Error occurred', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = 'background' | 'content' | 'popup' | 'offscreen';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private context: LogContext;
  private maxLogs = 1000; // Keep last 1000 logs
  private storageKey = 'debug_logs';
  private enableConsole = true;
  private enableStorage = true;

  constructor() {
    this.context = this.detectContext();
  }

  private detectContext(): LogContext {
    if (typeof window === 'undefined') {
      return 'background';
    }
    if (window.location.pathname.includes('popup')) {
      return 'popup';
    }
    if (window.location.pathname.includes('offscreen')) {
      return 'offscreen';
    }
    return 'content';
  }

  private async appendLog(entry: LogEntry) {
    if (!this.enableStorage) return;

    try {
      // Get existing logs
      const result = await chrome.storage.local.get(this.storageKey);
      const logs: LogEntry[] = result[this.storageKey] || [];
      
      // Add new log
      logs.push(entry);
      
      // Keep only recent logs
      const recentLogs = logs.slice(-this.maxLogs);
      
      // Save back
      await chrome.storage.local.set({ [this.storageKey]: recentLogs });
    } catch (error) {
      // Fallback to console only if storage fails
      console.error('[Logger] Failed to write to storage:', error);
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context.toUpperCase()}] [${level.toUpperCase()}]`;
    let formatted = `${prefix} ${message}`;
    
    if (data !== undefined) {
      formatted += ` ${JSON.stringify(data, this.getCircularReplacer(), 2)}`;
    }
    
    return formatted;
  }

  private getCircularReplacer() {
    const seen = new WeakSet();
    return (_key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      // Handle Error objects
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      return value;
    };
  }

  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      data: data !== undefined ? this.serializeData(data) : undefined,
      stack: level === 'error' ? new Error().stack : undefined
    };

    // Log to console
    if (this.enableConsole) {
      const formatted = this.formatMessage(level, message, data);
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](formatted);
    }

    // Log to storage (async, non-blocking)
    this.appendLog(entry).catch(console.error);
  }

  private serializeData(data: any): any {
    try {
      // Create a deep copy that handles circular references and special objects
      return JSON.parse(JSON.stringify(data, this.getCircularReplacer()));
    } catch (error) {
      return { error: 'Failed to serialize data', original: String(data) };
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  // Clear all logs
  async clear() {
    try {
      await chrome.storage.local.remove(this.storageKey);
      console.log('[Logger] Logs cleared');
    } catch (error) {
      console.error('[Logger] Failed to clear logs:', error);
    }
  }

  // Get all logs
  async getLogs(): Promise<LogEntry[]> {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error('[Logger] Failed to get logs:', error);
      return [];
    }
  }

  // Export logs as text (for copying to Cursor)
  async exportLogsAsText(): Promise<string> {
    const logs = await this.getLogs();
    return logs.map(entry => {
      let line = `[${entry.timestamp}] [${entry.context.toUpperCase()}] [${entry.level.toUpperCase()}] ${entry.message}`;
      if (entry.data) {
        line += `\nData: ${JSON.stringify(entry.data, null, 2)}`;
      }
      if (entry.stack) {
        line += `\nStack: ${entry.stack}`;
      }
      return line;
    }).join('\n\n---\n\n');
  }

  // Configure logger
  configure(options: { enableConsole?: boolean; enableStorage?: boolean; maxLogs?: number }) {
    if (options.enableConsole !== undefined) this.enableConsole = options.enableConsole;
    if (options.enableStorage !== undefined) this.enableStorage = options.enableStorage;
    if (options.maxLogs !== undefined) this.maxLogs = options.maxLogs;
  }
}

// Export singleton instance
export const logger = new Logger();

// Also export the class and types for testing
export { Logger };
export type { LogEntry, LogLevel, LogContext };

