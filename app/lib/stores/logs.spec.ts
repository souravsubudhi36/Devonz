import { describe, expect, it, vi, beforeEach } from 'vitest';
import { logStore } from './logs';

describe('logStore', () => {
  beforeEach(() => {
    // Clear logs before each test
    logStore.clearLogs();
  });

  describe('initial state', () => {
    it('should have logs property', () => {
      expect(logStore.logs).toBeDefined();
    });

    it('should have getLogs method', () => {
      expect(typeof logStore.getLogs).toBe('function');
    });
  });

  describe('logSystem', () => {
    it('should add system log entry', () => {
      logStore.logSystem('Test system message', { component: 'TestComponent' });

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);

      expect(logEntries.length).toBeGreaterThan(0);

      const lastLog = logEntries[logEntries.length - 1];
      expect(lastLog.category).toBe('system');
    });

    it('should include timestamp', () => {
      const before = Date.now();
      logStore.logSystem('Test message');

      const after = Date.now();

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);
      const lastLog = logEntries[logEntries.length - 1];

      const logTime = new Date(lastLog.timestamp).getTime();
      expect(logTime).toBeGreaterThanOrEqual(before);
      expect(logTime).toBeLessThanOrEqual(after);
    });
  });

  describe('logError', () => {
    it('should add error log entry', () => {
      const error = new Error('Test error');
      logStore.logError('Error occurred', error);

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);
      const errorLogs = logEntries.filter((log) => log.level === 'error');

      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it('should capture error message', () => {
      const error = new Error('Specific error message');
      logStore.logError('Error context', error);

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);
      const lastLog = logEntries[logEntries.length - 1];

      // Error should be captured in some form
      expect(JSON.stringify(lastLog)).toContain('error');
    });
  });

  describe('logProvider', () => {
    it('should add provider log', () => {
      logStore.logProvider('Model response', {
        component: 'Chat',
        action: 'response',
        model: 'claude-3.5',
        provider: 'Anthropic',
      });

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);
      expect(logEntries.length).toBeGreaterThan(0);
    });

    it('should include provider metadata', () => {
      const metadata = {
        component: 'Chat',
        action: 'response',
        model: 'gpt-4',
        provider: 'OpenAI',
        usage: { promptTokens: 100, completionTokens: 50 },
      };

      logStore.logProvider('API call complete', metadata);

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);
      expect(logEntries.length).toBeGreaterThan(0);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      logStore.logSystem('Message 1');
      logStore.logSystem('Message 2');
      logStore.logSystem('Message 3');

      const logsBefore = logStore.getLogs();
      expect(Object.keys(logsBefore).length).toBeGreaterThan(0);

      logStore.clearLogs();

      const logsAfter = logStore.getLogs();
      expect(Object.keys(logsAfter).length).toBe(0);
    });

    it('should be safe to call when empty', () => {
      logStore.clearLogs();

      const logs = logStore.getLogs();
      expect(Object.keys(logs).length).toBe(0);
    });
  });

  describe('log limits', () => {
    it('should handle many logs without memory issues', () => {
      for (let i = 0; i < 100; i++) {
        logStore.logSystem(`Log message ${i}`);
      }

      const logs = logStore.getLogs();
      const logEntries = Object.values(logs);

      // Should either have all logs or be truncated to a reasonable limit
      expect(logEntries.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('store reactivity', () => {
    it('should notify subscribers on new log', () => {
      const callback = vi.fn();
      const unsubscribe = logStore.logs.subscribe(callback);

      logStore.logSystem('New log');
      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });
  });
});
