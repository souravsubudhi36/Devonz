import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mcpStore, updateMCPSettings, type MCPSettings } from './mcp';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('mcpStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    mcpStore.set({
      isInitialized: false,
      settings: {
        maxLLMSteps: 5,
        mcpConfig: { mcpServers: {} },
      },
      serverTools: {},
      error: null,
      isUpdatingConfig: false,
    });
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('should have isInitialized as false', () => {
      expect(mcpStore.get().isInitialized).toBe(false);
    });

    it('should have default settings', () => {
      const state = mcpStore.get();
      expect(state.settings.maxLLMSteps).toBe(5);
      expect(state.settings.mcpConfig.mcpServers).toEqual({});
    });

    it('should have empty serverTools', () => {
      expect(mcpStore.get().serverTools).toEqual({});
    });

    it('should have null error', () => {
      expect(mcpStore.get().error).toBeNull();
    });

    it('should have isUpdatingConfig as false', () => {
      expect(mcpStore.get().isUpdatingConfig).toBe(false);
    });
  });

  describe('state mutations', () => {
    it('should update isInitialized', () => {
      mcpStore.setKey('isInitialized', true);
      expect(mcpStore.get().isInitialized).toBe(true);
    });

    it('should update error', () => {
      mcpStore.setKey('error', 'Something went wrong');
      expect(mcpStore.get().error).toBe('Something went wrong');
    });

    it('should update settings', () => {
      const newSettings: MCPSettings = {
        maxLLMSteps: 10,
        mcpConfig: {
          mcpServers: {
            testServer: { type: 'stdio', command: 'test', args: [], env: {} },
          },
        },
      };
      mcpStore.setKey('settings', newSettings);
      expect(mcpStore.get().settings.maxLLMSteps).toBe(10);
    });

    it('should update isUpdatingConfig', () => {
      mcpStore.setKey('isUpdatingConfig', true);
      expect(mcpStore.get().isUpdatingConfig).toBe(true);
    });
  });

  describe('store reactivity', () => {
    it('should notify subscribers on state change', () => {
      let notified = false;
      const unsubscribe = mcpStore.subscribe(() => {
        notified = true;
      });

      mcpStore.setKey('error', 'test error');
      expect(notified).toBe(true);

      unsubscribe();
    });

    it('should allow multiple key updates', () => {
      mcpStore.setKey('isInitialized', true);
      mcpStore.setKey('error', null);
      mcpStore.setKey('isUpdatingConfig', false);

      const state = mcpStore.get();
      expect(state.isInitialized).toBe(true);
      expect(state.error).toBeNull();
      expect(state.isUpdatingConfig).toBe(false);
    });
  });

  describe('updateMCPSettings', () => {
    it('should skip if already updating', async () => {
      mcpStore.setKey('isUpdatingConfig', true);

      const newSettings = {
        maxLLMSteps: 10,
        mcpConfig: { mcpServers: {} },
      };

      await updateMCPSettings(newSettings);

      // Fetch should not have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should set isUpdatingConfig during update', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const newSettings = {
        maxLLMSteps: 10,
        mcpConfig: { mcpServers: {} },
      };

      let wasUpdating = false;
      const unsubscribe = mcpStore.subscribe((state) => {
        if (state.isUpdatingConfig) {
          wasUpdating = true;
        }
      });

      await updateMCPSettings(newSettings);
      expect(wasUpdating).toBe(true);

      // Should be reset after completion
      expect(mcpStore.get().isUpdatingConfig).toBe(false);

      unsubscribe();
    });

    it('should reset isUpdatingConfig on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const newSettings = {
        maxLLMSteps: 10,
        mcpConfig: { mcpServers: {} },
      };

      await expect(updateMCPSettings(newSettings)).rejects.toThrow();
      expect(mcpStore.get().isUpdatingConfig).toBe(false);
    });
  });
});
