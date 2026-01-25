import { describe, expect, it } from 'vitest';
import { stripIndents } from './stripIndent';

describe('stripIndents', () => {
  describe('string input', () => {
    it('should strip indentation from simple string', () => {
      const input = `
        line 1
        line 2
        line 3
      `;
      const expected = `line 1
line 2
line 3`;
      expect(stripIndents(input)).toBe(expected);
    });

    it('should handle single line', () => {
      expect(stripIndents('  hello  ')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(stripIndents('')).toBe('');
    });

    it('should strip leading whitespace from each line', () => {
      const input = `    deeply
        indented
      lines`;
      expect(stripIndents(input)).toBe('deeply\nindented\nlines');
    });

    it('should preserve content within lines', () => {
      const input = `
        hello world
        foo bar baz
      `;
      expect(stripIndents(input)).toBe('hello world\nfoo bar baz');
    });

    it('should handle tabs and spaces', () => {
      const input = `
\t\ttab indented
    space indented
      `;
      expect(stripIndents(input)).toBe('tab indented\nspace indented');
    });
  });

  describe('template literal input', () => {
    it('should work with template literals', () => {
      const result = stripIndents`
        line 1
        line 2
      `;
      expect(result).toBe('line 1\nline 2');
    });

    it('should handle interpolated values', () => {
      const name = 'world';
      const result = stripIndents`
        hello ${name}
        goodbye ${name}
      `;
      expect(result).toBe(`hello ${name}\ngoodbye ${name}`);
    });

    it('should handle multiple interpolations', () => {
      const a = 'A';
      const b = 'B';
      const c = 'C';
      const result = stripIndents`
        ${a} then ${b}
        and finally ${c}
      `;
      expect(result).toBe('A then B\nand finally C');
    });

    it('should handle empty interpolation', () => {
      const empty = '';
      const result = stripIndents`
        before${empty}after
      `;
      expect(result).toBe('beforeafter');
    });

    it('should handle null-ish interpolation', () => {
      const val = null;
      const result = stripIndents`
        value: ${val}
      `;
      expect(result).toBe('value:');
    });

    it('should handle undefined interpolation', () => {
      const val = undefined;
      const result = stripIndents`
        value: ${val}
      `;
      expect(result).toBe('value:');
    });
  });

  describe('edge cases', () => {
    it('should handle string with only whitespace', () => {
      /*
       * Each line is trimmed to empty, joined with \n, trimStart removes leading empty,
       * then trailing newline removed - results in empty string
       */
      expect(stripIndents('   \n   \n   ')).toBe('');
    });

    it('should remove trailing newline', () => {
      const result = stripIndents`
        hello
      `;
      expect(result.endsWith('\n')).toBe(false);
    });

    it('should remove carriage return at end', () => {
      expect(stripIndents('hello\r')).toBe('hello');
    });

    it('should handle mixed line endings', () => {
      // The function splits on \n, so \r\n becomes \r at end of line which is trimmed
      const input = '  line1\r\n  line2\n  line3';
      const result = stripIndents(input);

      // After trimming each line, \r is removed, and lines are joined with \n only
      expect(result).toBe('line1\nline2\nline3');
    });

    it('should handle code block content', () => {
      const result = stripIndents`
        function hello() {
          console.log('world');
        }
      `;

      // Note: inner content is also stripped since we strip each line
      expect(result).toBe("function hello() {\nconsole.log('world');\n}");
    });
  });
});
