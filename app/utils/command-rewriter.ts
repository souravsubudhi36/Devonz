import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CommandRewriter');

export interface RewriteResult {
  command: string;
  wasRewritten: boolean;
  originalCommand?: string;
  reason?: string;
}

/**
 * Rewrites unsupported runtime commands to Node.js equivalents
 * for WebContainer compatibility.
 *
 * WebContainer only supports Node.js — Python, Ruby, PHP, etc. are not available.
 * When AI models generate commands using these runtimes, we transparently
 * rewrite them to the closest Node.js equivalent so the preview works.
 */
export function rewriteUnsupportedCommand(command: string): RewriteResult {
  const trimmed = command.trim();

  /*
   * python3 -m http.server [PORT] → npx --yes serve -l PORT
   * python -m http.server [PORT]  → npx --yes serve -l PORT
   */
  const pythonHttpServerMatch = trimmed.match(/^python3?\s+-m\s+http\.server(?:\s+(\d+))?$/);

  if (pythonHttpServerMatch) {
    const port = pythonHttpServerMatch[1] || '8000';
    const rewritten = `npx --yes serve -l ${port}`;
    logger.info(`Rewrote: "${trimmed}" → "${rewritten}"`);

    return {
      command: rewritten,
      wasRewritten: true,
      originalCommand: trimmed,
      reason: `WebContainer has no Python runtime. Replaced with Node.js serve on port ${port}.`,
    };
  }

  // python -m SimpleHTTPServer [PORT] (Python 2 legacy) → npx --yes serve -l PORT
  const simpleHttpMatch = trimmed.match(/^python\s+-m\s+SimpleHTTPServer(?:\s+(\d+))?$/);

  if (simpleHttpMatch) {
    const port = simpleHttpMatch[1] || '8000';
    const rewritten = `npx --yes serve -l ${port}`;
    logger.info(`Rewrote: "${trimmed}" → "${rewritten}"`);

    return {
      command: rewritten,
      wasRewritten: true,
      originalCommand: trimmed,
      reason: `WebContainer has no Python runtime. Replaced with Node.js serve on port ${port}.`,
    };
  }

  // php -S localhost:PORT → npx --yes serve -l PORT
  const phpServerMatch = trimmed.match(/^php\s+-S\s+(?:localhost|0\.0\.0\.0|127\.0\.0\.1):(\d+)/);

  if (phpServerMatch) {
    const port = phpServerMatch[1];
    const rewritten = `npx --yes serve -l ${port}`;
    logger.info(`Rewrote: "${trimmed}" → "${rewritten}"`);

    return {
      command: rewritten,
      wasRewritten: true,
      originalCommand: trimmed,
      reason: `WebContainer has no PHP runtime. Replaced with Node.js serve on port ${port}.`,
    };
  }

  // ruby -run -e httpd . -p PORT → npx --yes serve -l PORT
  const rubyServerMatch = trimmed.match(/^ruby\s+-run\s+-e\s+httpd\s+.*-p\s+(\d+)/);

  if (rubyServerMatch) {
    const port = rubyServerMatch[1];
    const rewritten = `npx --yes serve -l ${port}`;
    logger.info(`Rewrote: "${trimmed}" → "${rewritten}"`);

    return {
      command: rewritten,
      wasRewritten: true,
      originalCommand: trimmed,
      reason: `WebContainer has no Ruby runtime. Replaced with Node.js serve on port ${port}.`,
    };
  }

  // Generic python/python3 script execution → echo warning
  const pythonScriptMatch = trimmed.match(/^python3?\s+[\w./-]+\.py/);

  if (pythonScriptMatch) {
    logger.warn(`Cannot run Python script in WebContainer: ${trimmed}`);

    return {
      command: `echo "Error: WebContainer only supports Node.js. Cannot run: ${trimmed.replace(/"/g, '\\"')}"`,
      wasRewritten: true,
      originalCommand: trimmed,
      reason: 'WebContainer only supports Node.js. Python scripts cannot be executed.',
    };
  }

  return { command, wasRewritten: false };
}
