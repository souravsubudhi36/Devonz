import { describe, it, expect } from 'vitest';
import { rewriteUnsupportedCommand } from '~/utils/command-rewriter';

describe('rewriteUnsupportedCommand', () => {
  describe('Python http.server', () => {
    it('rewrites python3 -m http.server with port', () => {
      const result = rewriteUnsupportedCommand('python3 -m http.server 8000');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 8000');
      expect(result.originalCommand).toBe('python3 -m http.server 8000');
    });

    it('rewrites python3 -m http.server without port (defaults to 8000)', () => {
      const result = rewriteUnsupportedCommand('python3 -m http.server');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 8000');
    });

    it('rewrites python (no 3) -m http.server', () => {
      const result = rewriteUnsupportedCommand('python -m http.server 3000');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 3000');
    });

    it('handles leading whitespace', () => {
      const result = rewriteUnsupportedCommand('  python3 -m http.server 8080  ');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 8080');
    });
  });

  describe('Python SimpleHTTPServer (Python 2)', () => {
    it('rewrites python -m SimpleHTTPServer', () => {
      const result = rewriteUnsupportedCommand('python -m SimpleHTTPServer 9000');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 9000');
    });

    it('rewrites without port (defaults to 8000)', () => {
      const result = rewriteUnsupportedCommand('python -m SimpleHTTPServer');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 8000');
    });
  });

  describe('PHP built-in server', () => {
    it('rewrites php -S localhost:PORT', () => {
      const result = rewriteUnsupportedCommand('php -S localhost:8080');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 8080');
    });

    it('rewrites php -S 0.0.0.0:PORT', () => {
      const result = rewriteUnsupportedCommand('php -S 0.0.0.0:3000');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 3000');
    });
  });

  describe('Ruby built-in server', () => {
    it('rewrites ruby -run -e httpd . -p PORT', () => {
      const result = rewriteUnsupportedCommand('ruby -run -e httpd . -p 8000');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toBe('npx --yes serve -l 8000');
    });
  });

  describe('Python script execution', () => {
    it('replaces python script with echo warning', () => {
      const result = rewriteUnsupportedCommand('python3 app.py');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toContain('echo');
      expect(result.command).toContain('WebContainer only supports Node.js');
    });

    it('handles python script with path', () => {
      const result = rewriteUnsupportedCommand('python ./scripts/start.py');
      expect(result.wasRewritten).toBe(true);
      expect(result.command).toContain('echo');
    });
  });

  describe('Passthrough (no rewrite needed)', () => {
    it('does not rewrite npm commands', () => {
      const result = rewriteUnsupportedCommand('npm run dev');
      expect(result.wasRewritten).toBe(false);
      expect(result.command).toBe('npm run dev');
    });

    it('does not rewrite npx commands', () => {
      const result = rewriteUnsupportedCommand('npx serve -l 3000');
      expect(result.wasRewritten).toBe(false);
    });

    it('does not rewrite node commands', () => {
      const result = rewriteUnsupportedCommand('node server.js');
      expect(result.wasRewritten).toBe(false);
    });

    it('does not rewrite pnpm commands', () => {
      const result = rewriteUnsupportedCommand('pnpm install');
      expect(result.wasRewritten).toBe(false);
    });

    it('does not rewrite empty string', () => {
      const result = rewriteUnsupportedCommand('');
      expect(result.wasRewritten).toBe(false);
    });
  });
});
