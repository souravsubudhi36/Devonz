import { describe, expect, it, vi, beforeEach } from 'vitest';

// Must mock import.meta.env and chalk before importing the module
vi.mock('chalk', () => ({
  Chalk: vi.fn().mockImplementation(() => ({
    bgHex: () => (text: string) => text,
    hex: () => (text: string) => text,
  })),
}));

/*
 * We need to test the logger module. Since it uses import.meta.env,
 * we test the exported functions.
 */
import { logger, createScopedLogger } from '~/utils/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger object', () => {
    it('should have all log level methods', () => {
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should have setLevel method', () => {
      expect(typeof logger.setLevel).toBe('function');
    });

    it('should call console.log when logging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not throw when logging various types', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      expect(() => logger.info('string')).not.toThrow();
      expect(() => logger.info(123)).not.toThrow();
      expect(() => logger.info({ key: 'value' })).not.toThrow();
      expect(() => logger.info(null)).not.toThrow();
      expect(() => logger.info(undefined)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('createScopedLogger', () => {
    it('should create a logger with all methods', () => {
      const scopedLogger = createScopedLogger('TestScope');

      expect(typeof scopedLogger.trace).toBe('function');
      expect(typeof scopedLogger.debug).toBe('function');
      expect(typeof scopedLogger.info).toBe('function');
      expect(typeof scopedLogger.warn).toBe('function');
      expect(typeof scopedLogger.error).toBe('function');
      expect(typeof scopedLogger.setLevel).toBe('function');
    });

    it('should log with scope name', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
      const scopedLogger = createScopedLogger('MyModule');

      scopedLogger.info('hello world');

      // The console.log should be called with scope formatting
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should create independent loggers', () => {
      const logger1 = createScopedLogger('Module1');
      const logger2 = createScopedLogger('Module2');

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('log level filtering', () => {
    it('should respect log level settings', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      // Set to error level - should filter out info/debug/trace
      logger.setLevel('error');
      logger.info('should not appear');

      // The number of calls should not increase for filtered levels
      const callCountAfterInfo = consoleSpy.mock.calls.length;

      logger.error('should appear');
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(callCountAfterInfo);

      // Reset to debug for other tests
      logger.setLevel('debug');
      consoleSpy.mockRestore();
    });

    it('should not log anything when level is none', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      logger.setLevel('none');

      const initialCalls = consoleSpy.mock.calls.length;

      logger.trace('test');
      logger.debug('test');
      logger.info('test');
      logger.warn('test');
      logger.error('test');

      expect(consoleSpy.mock.calls.length).toBe(initialCalls);

      // Reset
      logger.setLevel('debug');
      consoleSpy.mockRestore();
    });
  });
});
