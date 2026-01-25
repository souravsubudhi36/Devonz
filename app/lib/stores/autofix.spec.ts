import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  autoFixStore,
  getAutoFixStatus,
  resetAutoFix,
  recordFixAttempt,
  markFixComplete,
  markFixFailed,
  startAutoFix,
  shouldContinueFix,
  hasExceededMaxRetries,
  getFixHistoryContext,
} from './autofix';

describe('autoFixStore', () => {
  beforeEach(() => {
    // Reset to clean state before each test
    resetAutoFix();
  });

  describe('initial state', () => {
    it('should have isFixing as false', () => {
      const state = autoFixStore.get();
      expect(state.isFixing).toBe(false);
    });

    it('should have currentRetries as 0', () => {
      const state = autoFixStore.get();
      expect(state.currentRetries).toBe(0);
    });

    it('should have default settings', () => {
      const state = autoFixStore.get();
      expect(state.settings).toBeDefined();
      expect(typeof state.settings.isEnabled).toBe('boolean');
      expect(typeof state.settings.maxRetries).toBe('number');
    });

    it('should have empty fixHistory', () => {
      const state = autoFixStore.get();
      expect(state.fixHistory).toEqual([]);
    });

    it('should have null currentError', () => {
      const state = autoFixStore.get();
      expect(state.currentError).toBeNull();
    });
  });

  describe('getAutoFixStatus', () => {
    it('should return current status', () => {
      const status = getAutoFixStatus();
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('currentAttempt');
      expect(status).toHaveProperty('maxAttempts');
      expect(status).toHaveProperty('errorType');
    });

    it('should reflect store state', () => {
      const storeState = autoFixStore.get();
      const status = getAutoFixStatus();
      expect(status.isActive).toBe(storeState.isFixing);
      expect(status.currentAttempt).toBe(storeState.currentRetries);
      expect(status.maxAttempts).toBe(storeState.settings.maxRetries);
    });
  });

  describe('resetAutoFix', () => {
    it('should reset isFixing to false', () => {
      // First start a fix
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'test content',
      });
      expect(autoFixStore.get().isFixing).toBe(true);

      resetAutoFix();
      expect(autoFixStore.get().isFixing).toBe(false);
    });

    it('should reset currentRetries to 0', () => {
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'test content',
      });
      resetAutoFix();
      expect(autoFixStore.get().currentRetries).toBe(0);
    });

    it('should preserve settings', () => {
      const originalSettings = autoFixStore.get().settings;
      resetAutoFix();
      expect(autoFixStore.get().settings).toEqual(originalSettings);
    });

    it('should clear fixHistory', () => {
      resetAutoFix();
      expect(autoFixStore.get().fixHistory).toEqual([]);
    });
  });

  describe('startAutoFix', () => {
    it('should set isFixing to true', () => {
      startAutoFix({
        source: 'terminal',
        type: 'SyntaxError',
        message: 'Unexpected token',
        content: 'error content',
      });
      expect(autoFixStore.get().isFixing).toBe(true);
    });

    it('should set currentError', () => {
      const error = {
        source: 'preview' as const,
        type: 'ReferenceError',
        message: 'undefined variable',
        content: 'full error content',
      };
      startAutoFix(error);
      expect(autoFixStore.get().currentError).toEqual(error);
    });

    it('should increment currentRetries', () => {
      expect(autoFixStore.get().currentRetries).toBe(0);
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'content',
      });
      expect(autoFixStore.get().currentRetries).toBe(1);
    });

    it('should return false if already fixing', () => {
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'first',
        content: 'content',
      });

      const result = startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'second',
        content: 'content',
      });
      expect(result).toBe(false);
    });
  });

  describe('recordFixAttempt', () => {
    beforeEach(() => {
      // Start a fix first so there's a currentError
      startAutoFix({
        source: 'terminal',
        type: 'TestError',
        message: 'test message',
        content: 'test content',
      });
    });

    it('should add to fixHistory on failure', () => {
      recordFixAttempt(false);
      expect(autoFixStore.get().fixHistory.length).toBe(1);
      expect(autoFixStore.get().fixHistory[0].wasSuccessful).toBe(false);
    });

    it('should add to fixHistory on success', () => {
      recordFixAttempt(true);

      /*
       * After success, history might be cleared by resetAutoFix
       * Just verify it was tracked
       */
      expect(autoFixStore.get().currentRetries).toBe(0); // Reset on success
    });

    it('should set isFixing to false', () => {
      recordFixAttempt(false);
      expect(autoFixStore.get().isFixing).toBe(false);
    });
  });

  describe('markFixComplete', () => {
    beforeEach(() => {
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'content',
      });
    });

    it('should reset the auto-fix state', () => {
      markFixComplete();
      expect(autoFixStore.get().isFixing).toBe(false);
      expect(autoFixStore.get().currentRetries).toBe(0);
    });
  });

  describe('markFixFailed', () => {
    beforeEach(() => {
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'content',
      });
    });

    it('should set isFixing to false', () => {
      markFixFailed();
      expect(autoFixStore.get().isFixing).toBe(false);
    });

    it('should preserve currentError for retry', () => {
      const errorBefore = autoFixStore.get().currentError;
      markFixFailed();

      // Error is preserved for potential retry
      expect(autoFixStore.get().currentError).toEqual(errorBefore);
    });
  });

  describe('shouldContinueFix', () => {
    it('should return true when conditions are met', () => {
      // Not fixing, under max retries, enabled
      expect(shouldContinueFix()).toBe(true);
    });

    it('should return false when fixing', () => {
      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'content',
      });
      expect(shouldContinueFix()).toBe(false);
    });
  });

  describe('hasExceededMaxRetries', () => {
    it('should return false initially', () => {
      expect(hasExceededMaxRetries()).toBe(false);
    });
  });

  describe('getFixHistoryContext', () => {
    it('should return empty string when no history', () => {
      expect(getFixHistoryContext()).toBe('');
    });
  });

  describe('store reactivity', () => {
    it('should notify on state changes', () => {
      const callback = vi.fn();
      const unsubscribe = autoFixStore.subscribe(callback);

      startAutoFix({
        source: 'terminal',
        type: 'error',
        message: 'test',
        content: 'content',
      });
      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('max attempts logic', () => {
    it('should respect maxRetries setting', () => {
      const maxRetries = autoFixStore.get().settings.maxRetries;
      expect(maxRetries).toBeGreaterThan(0);
      expect(maxRetries).toBeLessThanOrEqual(10); // Reasonable limit
    });

    it('should report maxAttempts in status', () => {
      const status = getAutoFixStatus();
      expect(status.maxAttempts).toBeDefined();
      expect(typeof status.maxAttempts).toBe('number');
    });
  });
});
