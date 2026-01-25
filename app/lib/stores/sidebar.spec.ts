import { describe, expect, it } from 'vitest';
import { sidebarStore } from './sidebar';

describe('sidebarStore', () => {
  describe('initial state', () => {
    it('should have open store defined', () => {
      expect(sidebarStore.open).toBeDefined();
    });

    it('should have a boolean value for open', () => {
      const isOpen = sidebarStore.open.get();
      expect(typeof isOpen).toBe('boolean');
    });
  });

  describe('toggle functionality', () => {
    it('should toggle from closed to open', () => {
      sidebarStore.open.set(false);
      expect(sidebarStore.open.get()).toBe(false);

      sidebarStore.open.set(true);
      expect(sidebarStore.open.get()).toBe(true);
    });

    it('should toggle from open to closed', () => {
      sidebarStore.open.set(true);
      expect(sidebarStore.open.get()).toBe(true);

      sidebarStore.open.set(false);
      expect(sidebarStore.open.get()).toBe(false);
    });
  });

  describe('store reactivity', () => {
    it('should notify subscribers on state change', () => {
      let notifiedValue: boolean | undefined;
      const unsubscribe = sidebarStore.open.subscribe((value) => {
        notifiedValue = value;
      });

      const currentValue = sidebarStore.open.get();
      sidebarStore.open.set(!currentValue);

      expect(notifiedValue).toBe(!currentValue);

      // Cleanup
      unsubscribe();
      sidebarStore.open.set(currentValue); // Reset to original
    });
  });
});
