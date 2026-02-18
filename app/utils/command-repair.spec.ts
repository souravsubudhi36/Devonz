import { describe, it, expect } from 'vitest';
import { repairMalformedCommand } from '~/utils/command-repair';

describe('repairMalformedCommand', () => {
  describe('Rule 1: Bare "install" → "npm install"', () => {
    it('should prepend npm to bare install', () => {
      const result = repairMalformedCommand('install -D tailwindcss postcss autoprefixer');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install -D tailwindcss postcss autoprefixer');
    });

    it('should prepend npm to bare install with no args', () => {
      const result = repairMalformedCommand('install');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install');
    });

    it('should prepend npm to bare install with --save-dev', () => {
      const result = repairMalformedCommand('install --save-dev react react-dom');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install --save-dev react react-dom');
    });
  });

  describe('Rule 2: Bare "i" with npm flags → "npm i"', () => {
    it('should prepend npm to bare i -D', () => {
      const result = repairMalformedCommand('i -D tailwindcss');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm i -D tailwindcss');
    });

    it('should prepend npm to bare i --save-dev', () => {
      const result = repairMalformedCommand('i --save-dev postcss');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm i --save-dev postcss');
    });

    it('should NOT prepend npm to bare i without flags', () => {
      const result = repairMalformedCommand('i');
      expect(result.wasRepaired).toBe(false);
    });
  });

  describe('Rule 3: Bare "add" → "yarn add"', () => {
    it('should prepend yarn to bare add', () => {
      const result = repairMalformedCommand('add tailwindcss -D');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('yarn add tailwindcss -D');
    });

    it('should NOT prepend yarn to bare add without args', () => {
      const result = repairMalformedCommand('add');
      expect(result.wasRepaired).toBe(false);
    });
  });

  describe('Rule 4: Bare "run" → "npm run"', () => {
    it('should prepend npm to bare run', () => {
      const result = repairMalformedCommand('run dev');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm run dev');
    });

    it('should prepend npm to bare run build', () => {
      const result = repairMalformedCommand('run build');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm run build');
    });
  });

  describe('Rule 5: Bare script names → "npm run X"', () => {
    it.each(['dev', 'build', 'preview', 'lint', 'format'])('should wrap "%s" in npm run', (script) => {
      const result = repairMalformedCommand(script);
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe(`npm run ${script}`);
    });

    it('should NOT wrap "dev" if it has arguments', () => {
      const result = repairMalformedCommand('dev --port 3000');
      expect(result.wasRepaired).toBe(false);
    });
  });

  describe('Rule 6: Bare flags with packages → "npm install"', () => {
    it('should wrap -D with packages', () => {
      const result = repairMalformedCommand('-D tailwindcss postcss');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install -D tailwindcss postcss');
    });

    it('should wrap --save-dev with packages', () => {
      const result = repairMalformedCommand('--save-dev react');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install --save-dev react');
    });
  });

  describe('Rule 7: Package-like tokens → "npm install"', () => {
    it('should wrap multiple package-like tokens', () => {
      const result = repairMalformedCommand('tailwindcss postcss autoprefixer');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install tailwindcss postcss autoprefixer');
    });

    it('should wrap scoped package names', () => {
      const result = repairMalformedCommand('@types/node @tailwindcss/forms');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install @types/node @tailwindcss/forms');
    });

    it('should NOT wrap a single unknown token (could be a non-whitelisted binary)', () => {
      const result = repairMalformedCommand('postcss');
      expect(result.wasRepaired).toBe(false);
    });

    it('should wrap tokens with install flags even if first token is unknown', () => {
      const result = repairMalformedCommand('windcss -D postcss');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install windcss -D postcss');
    });
  });

  describe('Rule 8: Command fusion detection', () => {
    it('should split fused commands (npx + install)', () => {
      const result = repairMalformedCommand('npx tailwindcss init -pm install -D tail');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toContain('npx tailwindcss init');
      expect(result.command).toContain('npm install -D tail');
      expect(result.command).toContain(' && ');
    });

    it('should clean up residual chars from flag fusion', () => {
      const result = repairMalformedCommand('npx tailwindcss init -pm install -D tailwindcss');
      expect(result.wasRepaired).toBe(true);

      // The "-pm" should have "m" stripped (residual from "npm")
      expect(result.command).toMatch(/npx tailwindcss init -p\s*&&\s*npm install -D tailwindcss/);
    });

    it('should NOT split when install is used by npm itself', () => {
      const result = repairMalformedCommand('npm install -D tailwindcss');
      expect(result.wasRepaired).toBe(false);
    });

    it('should NOT split when install is used by yarn', () => {
      const result = repairMalformedCommand('yarn install');
      expect(result.wasRepaired).toBe(false);
    });
  });

  describe('Chained commands (&&)', () => {
    it('should repair first segment in a chain', () => {
      const result = repairMalformedCommand('install -D tailwindcss && npm run dev');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install -D tailwindcss && npm run dev');
    });

    it('should repair both segments if both are broken', () => {
      const result = repairMalformedCommand('install -D tailwindcss && dev');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toContain('npm install -D tailwindcss');
      expect(result.command).toContain('npm run dev');
    });

    it('should repair the garbled command from the real scenario', () => {
      const result = repairMalformedCommand('windcss postcss autoprefixer && npx tailwindcss init -pm install -D tail');
      expect(result.wasRepaired).toBe(true);

      // First segment: package names → npm install
      expect(result.command).toContain('npm install windcss postcss autoprefixer');

      // Second segment: should be split at fusion point
      expect(result.command).toContain('npx tailwindcss init');
      expect(result.command).toContain('npm install -D tail');
    });
  });

  describe('No-op cases (valid commands)', () => {
    it('should not modify a valid npm install', () => {
      const result = repairMalformedCommand('npm install -D tailwindcss');
      expect(result.wasRepaired).toBe(false);
      expect(result.command).toBe('npm install -D tailwindcss');
    });

    it('should not modify a valid npm run dev', () => {
      const result = repairMalformedCommand('npm run dev');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify a valid npx command', () => {
      const result = repairMalformedCommand('npx tailwindcss init -p');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify a valid chained command', () => {
      const result = repairMalformedCommand('npm install -D tailwindcss && npx tailwindcss init -p');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify a valid git command', () => {
      const result = repairMalformedCommand('git init');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify a valid mkdir command', () => {
      const result = repairMalformedCommand('mkdir -p src/components');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify a valid echo command', () => {
      const result = repairMalformedCommand('echo "hello world"');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify a path-based binary', () => {
      const result = repairMalformedCommand('./node_modules/.bin/vite build');
      expect(result.wasRepaired).toBe(false);
    });

    it('should not modify cd commands', () => {
      const result = repairMalformedCommand('cd src && ls');
      expect(result.wasRepaired).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = repairMalformedCommand('');
      expect(result.wasRepaired).toBe(false);
    });

    it('should handle whitespace-only string', () => {
      const result = repairMalformedCommand('   ');
      expect(result.wasRepaired).toBe(false);
    });

    it('should handle || separators', () => {
      const result = repairMalformedCommand('install -D foo || install -D bar');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toContain('npm install -D foo');
      expect(result.command).toContain('npm install -D bar');
    });

    it('should handle ; separator', () => {
      const result = repairMalformedCommand('install -D foo; dev');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toContain('npm install -D foo');
      expect(result.command).toContain('npm run dev');
    });

    it('should preserve valid commands in mixed chains', () => {
      const result = repairMalformedCommand('npm install && build');
      expect(result.wasRepaired).toBe(true);
      expect(result.command).toBe('npm install && npm run build');
    });
  });
});
