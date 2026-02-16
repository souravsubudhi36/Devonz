import { describe, expect, it } from 'vitest';
import { isBinaryFile, shouldIncludeFile, generateId, MAX_FILES, IGNORE_PATTERNS } from './fileUtils';

describe('fileUtils', () => {
  describe('IGNORE_PATTERNS', () => {
    it('should include node_modules', () => {
      expect(IGNORE_PATTERNS).toContain('node_modules/**');
    });

    it('should include .git', () => {
      expect(IGNORE_PATTERNS).toContain('.git/**');
    });

    it('should include common build directories', () => {
      expect(IGNORE_PATTERNS).toContain('dist/**');
      expect(IGNORE_PATTERNS).toContain('build/**');
      expect(IGNORE_PATTERNS).toContain('.next/**');
    });

    it('should include log files', () => {
      expect(IGNORE_PATTERNS).toContain('**/*.log');
    });
  });

  describe('MAX_FILES', () => {
    it('should be 1000', () => {
      expect(MAX_FILES).toBe(1000);
    });
  });

  describe('generateId', () => {
    it('should generate a string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('should generate unique ids', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should generate alphanumeric ids', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate ids with reasonable length', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(5);
      expect(id.length).toBeLessThan(20);
    });
  });

  describe('shouldIncludeFile', () => {
    it('should include regular source files', () => {
      expect(shouldIncludeFile('src/index.ts')).toBe(true);
      expect(shouldIncludeFile('app/component.tsx')).toBe(true);
      expect(shouldIncludeFile('styles.css')).toBe(true);
    });

    it('should exclude node_modules', () => {
      expect(shouldIncludeFile('node_modules/package/index.js')).toBe(false);
    });

    it('should exclude .git directory', () => {
      expect(shouldIncludeFile('.git/config')).toBe(false);
      expect(shouldIncludeFile('.git/HEAD')).toBe(false);
    });

    it('should exclude dist directory', () => {
      expect(shouldIncludeFile('dist/bundle.js')).toBe(false);
    });

    it('should exclude build directory', () => {
      expect(shouldIncludeFile('build/index.html')).toBe(false);
    });

    it('should exclude log files', () => {
      expect(shouldIncludeFile('error.log')).toBe(false);
      expect(shouldIncludeFile('debug.log')).toBe(false);
    });

    it('should exclude .DS_Store', () => {
      expect(shouldIncludeFile('.DS_Store')).toBe(false);
      expect(shouldIncludeFile('some/folder/.DS_Store')).toBe(false);
    });

    it('should exclude coverage directory', () => {
      expect(shouldIncludeFile('coverage/lcov-report/index.html')).toBe(false);
    });

    it('should exclude .next directory', () => {
      expect(shouldIncludeFile('.next/cache/webpack/client.json')).toBe(false);
    });

    it('should exclude npm debug logs', () => {
      expect(shouldIncludeFile('npm-debug.log')).toBe(false);
      expect(shouldIncludeFile('npm-debug.log.1')).toBe(false);
    });
  });

  describe('isBinaryFile', () => {
    it('should detect text file as non-binary', async () => {
      const textContent = new Blob(['Hello, world!'], { type: 'text/plain' });
      const file = new File([textContent], 'test.txt', { type: 'text/plain' });

      const result = await isBinaryFile(file);
      expect(result).toBe(false);
    });

    it('should detect file with null bytes as binary', async () => {
      const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const file = new File([binaryContent], 'test.bin', { type: 'application/octet-stream' });

      const result = await isBinaryFile(file);
      expect(result).toBe(true);
    });

    it('should detect file with control characters as binary', async () => {
      // Control characters below 32 (except tab, newline, carriage return)
      const binaryContent = new Uint8Array([0x01, 0x02, 0x03]);
      const file = new File([binaryContent], 'test.bin', { type: 'application/octet-stream' });

      const result = await isBinaryFile(file);
      expect(result).toBe(true);
    });

    it('should allow tab characters in text files', async () => {
      const textContent = new Blob(['line1\tcolumn2\nline2'], { type: 'text/plain' });
      const file = new File([textContent], 'test.txt', { type: 'text/plain' });

      const result = await isBinaryFile(file);
      expect(result).toBe(false);
    });

    it('should allow newline characters', async () => {
      const textContent = new Blob(['line1\nline2\r\nline3'], { type: 'text/plain' });
      const file = new File([textContent], 'test.txt', { type: 'text/plain' });

      const result = await isBinaryFile(file);
      expect(result).toBe(false);
    });

    it('should handle empty file', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });

      const result = await isBinaryFile(file);
      expect(result).toBe(false);
    });

    it('should only check first 1024 bytes', async () => {
      // Large text file should be fast because we only check first chunk
      const largeContent = 'a'.repeat(10000);
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

      const startTime = performance.now();
      const result = await isBinaryFile(file);
      const endTime = performance.now();

      expect(result).toBe(false);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should detect JSON as non-binary', async () => {
      const jsonContent = JSON.stringify({ hello: 'world' });
      const file = new File([jsonContent], 'data.json', { type: 'application/json' });

      const result = await isBinaryFile(file);
      expect(result).toBe(false);
    });
  });
});
