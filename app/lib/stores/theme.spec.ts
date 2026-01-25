import { describe, expect, it } from 'vitest';
import { themeStore } from './theme';

describe('themeStore', () => {
  describe('initial state', () => {
    it('should have a valid theme value', () => {
      const theme = themeStore.get();
      expect(['light', 'dark']).toContain(theme);
    });
  });

  describe('theme switching', () => {
    it('should switch to dark theme', () => {
      themeStore.set('dark');
      expect(themeStore.get()).toBe('dark');
    });

    it('should switch to light theme', () => {
      themeStore.set('light');
      expect(themeStore.get()).toBe('light');
    });

    it('should toggle between themes', () => {
      const initialTheme = themeStore.get();
      const newTheme = initialTheme === 'dark' ? 'light' : 'dark';

      themeStore.set(newTheme);
      expect(themeStore.get()).toBe(newTheme);

      themeStore.set(initialTheme);
      expect(themeStore.get()).toBe(initialTheme);
    });
  });

  describe('store reactivity', () => {
    it('should notify subscribers on theme change', () => {
      let notifiedTheme: string | undefined;
      const unsubscribe = themeStore.subscribe((theme) => {
        notifiedTheme = theme;
      });

      const newTheme = themeStore.get() === 'dark' ? 'light' : 'dark';
      themeStore.set(newTheme);

      expect(notifiedTheme).toBe(newTheme);

      unsubscribe();
    });
  });
});
