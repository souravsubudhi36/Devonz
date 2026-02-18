import { describe, expect, it } from 'vitest';
import {
  shortcutsStore,
  providersStore,
  isDebugMode,
  latestBranchStore,
  autoSelectStarterTemplate,
  enableContextOptimizationStore,
  isEventLogsEnabled,
  promptStore,
  autoSwitchToFileStore,
  LOCAL_PROVIDERS,
  URL_CONFIGURABLE_PROVIDERS,
} from './settings';

describe('settings store', () => {
  describe('shortcutsStore', () => {
    it('should have all expected shortcuts', () => {
      const shortcuts = shortcutsStore.get();

      expect(shortcuts.toggleTheme).toBeDefined();
      expect(shortcuts.toggleTerminal).toBeDefined();
      expect(shortcuts.acceptAllChanges).toBeDefined();
      expect(shortcuts.rejectAllChanges).toBeDefined();
      expect(shortcuts.openDiffPreview).toBeDefined();
      expect(shortcuts.nextChange).toBeDefined();
      expect(shortcuts.previousChange).toBeDefined();
    });

    it('should have valid key bindings for each shortcut', () => {
      const shortcuts = shortcutsStore.get();

      Object.values(shortcuts).forEach((shortcut) => {
        expect(shortcut.key).toBeDefined();
        expect(typeof shortcut.key).toBe('string');
        expect(shortcut.key.length).toBeGreaterThan(0);
      });
    });

    it('should have action functions for each shortcut', () => {
      const shortcuts = shortcutsStore.get();

      Object.values(shortcuts).forEach((shortcut) => {
        expect(typeof shortcut.action).toBe('function');
      });
    });

    it('should have descriptions for each shortcut', () => {
      const shortcuts = shortcutsStore.get();

      Object.values(shortcuts).forEach((shortcut) => {
        expect(shortcut.description).toBeDefined();
        expect(typeof shortcut.description).toBe('string');
      });
    });

    it('toggleTheme shortcut should have meta+alt+shift+d binding', () => {
      const { toggleTheme } = shortcutsStore.get();
      expect(toggleTheme.key).toBe('d');
      expect(toggleTheme.metaKey).toBe(true);
      expect(toggleTheme.altKey).toBe(true);
      expect(toggleTheme.shiftKey).toBe(true);
    });

    it('toggleTerminal shortcut should have ctrl/meta+backtick binding', () => {
      const { toggleTerminal } = shortcutsStore.get();
      expect(toggleTerminal.key).toBe('`');
      expect(toggleTerminal.ctrlOrMetaKey).toBe(true);
    });

    it('acceptAllChanges should have ctrl/meta+shift+enter binding', () => {
      const { acceptAllChanges } = shortcutsStore.get();
      expect(acceptAllChanges.key).toBe('Enter');
      expect(acceptAllChanges.ctrlOrMetaKey).toBe(true);
      expect(acceptAllChanges.shiftKey).toBe(true);
    });
  });

  describe('providersStore', () => {
    it('should have provider settings initialized', () => {
      const providers = providersStore.get();
      expect(Object.keys(providers).length).toBeGreaterThan(0);
    });

    it('should have settings object for each provider', () => {
      const providers = providersStore.get();

      Object.values(providers).forEach((provider) => {
        expect(provider.settings).toBeDefined();
        expect(typeof provider.settings.enabled).toBe('boolean');
      });
    });

    it('should have local providers disabled by default', () => {
      const providers = providersStore.get();

      LOCAL_PROVIDERS.forEach((localName) => {
        if (providers[localName]) {
          expect(providers[localName].settings.enabled).toBe(false);
        }
      });
    });

    it('should have non-local providers enabled by default', () => {
      const providers = providersStore.get();

      Object.entries(providers).forEach(([name, provider]) => {
        if (!LOCAL_PROVIDERS.includes(name)) {
          expect(provider.settings.enabled).toBe(true);
        }
      });
    });
  });

  describe('constants', () => {
    it('should define URL_CONFIGURABLE_PROVIDERS', () => {
      expect(URL_CONFIGURABLE_PROVIDERS).toContain('Ollama');
      expect(URL_CONFIGURABLE_PROVIDERS).toContain('LMStudio');
      expect(URL_CONFIGURABLE_PROVIDERS).toContain('OpenAILike');
    });

    it('should define LOCAL_PROVIDERS', () => {
      expect(LOCAL_PROVIDERS).toContain('OpenAILike');
      expect(LOCAL_PROVIDERS).toContain('LMStudio');
      expect(LOCAL_PROVIDERS).toContain('Ollama');
    });
  });

  describe('boolean settings atoms', () => {
    it('isDebugMode should default to false', () => {
      expect(isDebugMode.get()).toBe(false);
    });

    it('latestBranchStore should have boolean value', () => {
      expect(typeof latestBranchStore.get()).toBe('boolean');
    });

    it('autoSelectStarterTemplate should have boolean value', () => {
      expect(typeof autoSelectStarterTemplate.get()).toBe('boolean');
    });

    it('enableContextOptimizationStore should have boolean value', () => {
      expect(typeof enableContextOptimizationStore.get()).toBe('boolean');
    });

    it('isEventLogsEnabled should have boolean value', () => {
      expect(typeof isEventLogsEnabled.get()).toBe('boolean');
    });

    it('promptStore should have string value', () => {
      expect(typeof promptStore.get()).toBe('string');
    });

    it('autoSwitchToFileStore should have boolean value', () => {
      expect(typeof autoSwitchToFileStore.get()).toBe('boolean');
    });
  });

  describe('atom reactivity', () => {
    it('isDebugMode should update when set', () => {
      const initial = isDebugMode.get();
      isDebugMode.set(!initial);
      expect(isDebugMode.get()).toBe(!initial);

      // Reset
      isDebugMode.set(initial);
    });

    it('promptStore should update when set', () => {
      const initial = promptStore.get();
      promptStore.set('test-prompt');
      expect(promptStore.get()).toBe('test-prompt');

      // Reset
      promptStore.set(initial);
    });
  });
});
