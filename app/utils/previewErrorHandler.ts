/**
 * Preview Error Handler
 *
 * Handles preview errors with cooldown, deduplication, and intelligent filtering
 * to prevent the same error from triggering multiple alerts and to suppress
 * non-actionable errors that would only confuse users.
 *
 * Features:
 * - Error suppression for known non-actionable issues (source maps, 3D lib buffers)
 * - Severity classification (critical, warning, info)
 * - User-friendly error messages
 * - Cooldown and deduplication
 */

import { workbenchStore } from '~/lib/stores/workbench';
import { cleanStackTrace } from '~/utils/stacktrace';
import { createScopedLogger } from '~/utils/logger';
import {
  shouldSuppressError,
  getUserFriendlyMessage,
  classifyErrorSeverity,
  SEVERITY_CONFIG,
} from '~/utils/errors/errorConfig';

const logger = createScopedLogger('PreviewErrorHandler');

/**
 * Simple hash function for error deduplication
 */
function hashError(error: string): string {
  let hash = 0;
  const cleanError = error.replace(/\d+/g, 'N').slice(0, 200); // Normalize numbers, limit length

  for (let i = 0; i < cleanError.length; i++) {
    const char = cleanError.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}

/**
 * Preview Error Handler class
 * Handles cooldown and deduplication for preview errors
 */
class PreviewErrorHandler {
  #lastAlertTime: number = 0;
  #recentErrorHashes: Set<string> = new Set();
  #isEnabled: boolean = true;

  // Configuration constants
  #COOLDOWN_MS = 5000; // 5 seconds cooldown between alerts
  #HASH_TTL_MS = 60000; // Clear hashes after 1 minute

  constructor() {
    // Clean up old hashes periodically
    setInterval(() => this.#cleanupOldHashes(), this.#HASH_TTL_MS);
  }

  /**
   * Enable/disable error handling
   */
  setEnabled(enabled: boolean): void {
    this.#isEnabled = enabled;
    logger.debug(`Preview error handling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Handle a preview error message from WebContainer
   */
  handlePreviewMessage(message: {
    type: string;
    message?: string;
    stack?: string;
    pathname?: string;
    search?: string;
    hash?: string;
    port?: number;
  }): void {
    if (!this.#isEnabled) {
      return;
    }

    // Handle both uncaught exceptions and unhandled promise rejections
    if (message.type !== 'PREVIEW_UNCAUGHT_EXCEPTION' && message.type !== 'PREVIEW_UNHANDLED_REJECTION') {
      return;
    }

    const now = Date.now();
    const errorMessage = message.message || 'Unknown error';
    const fullErrorContext = `${errorMessage} ${message.stack || ''}`;
    const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';

    // Check if error should be suppressed (non-actionable errors)
    if (shouldSuppressError(fullErrorContext, 'preview')) {
      logger.debug(`Suppressing non-actionable preview error: ${errorMessage.slice(0, 100)}`);

      return;
    }

    // Classify error severity
    const severity = classifyErrorSeverity(errorMessage, message.stack);

    // Only show alerts for critical and warning errors
    if (!SEVERITY_CONFIG[severity].showAlert) {
      logger.debug(`Skipping ${severity} severity preview error (no alert): ${errorMessage.slice(0, 100)}`);

      return;
    }

    // Generate error hash for deduplication
    const errorHash = hashError(errorMessage + (message.stack || ''));

    // Check cooldown
    if (now - this.#lastAlertTime < this.#COOLDOWN_MS) {
      logger.debug('Skipping preview alert due to cooldown');

      return;
    }

    // Check deduplication
    if (this.#recentErrorHashes.has(errorHash)) {
      logger.debug('Skipping duplicate preview error');

      return;
    }

    // Mark error as seen
    this.#recentErrorHashes.add(errorHash);
    this.#lastAlertTime = now;

    // Get user-friendly message if available
    const friendlyMessage = getUserFriendlyMessage(errorMessage);

    // Create title and description
    const title = friendlyMessage?.title || (isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception');
    const description = friendlyMessage?.description || errorMessage;
    const suggestion = friendlyMessage?.suggestion || '';

    // Create content with helpful context
    const contentParts: string[] = [];
    contentParts.push(`Error occurred at ${message.pathname || '/'}${message.search || ''}${message.hash || ''}`);
    contentParts.push(`Port: ${message.port || 'unknown'}`);

    if (suggestion) {
      contentParts.push(`\n💡 Suggestion: ${suggestion}`);
    }

    contentParts.push(`\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`);

    const content = contentParts.join('\n');

    workbenchStore.actionAlert.set({
      type: 'preview',
      title,
      description,
      content,
      source: 'preview',
    });

    logger.info(`Preview error detected [${severity}]: ${title} - ${errorMessage.slice(0, 100)}`);
  }

  /**
   * Reset the handler state
   * Call this when user clicks "Ask Bolt" so the same error can be caught again
   */
  reset(): void {
    this.#recentErrorHashes.clear();
    this.#lastAlertTime = 0;
    logger.debug('Preview error handler reset');
  }

  #cleanupOldHashes(): void {
    // Simple cleanup - just clear if too many
    if (this.#recentErrorHashes.size > 50) {
      this.#recentErrorHashes.clear();
    }
  }
}

// Singleton instance
let handlerInstance: PreviewErrorHandler | null = null;

/**
 * Get the singleton preview error handler instance
 */
export function getPreviewErrorHandler(): PreviewErrorHandler {
  if (!handlerInstance) {
    handlerInstance = new PreviewErrorHandler();
  }

  return handlerInstance;
}

/**
 * Reset the preview error handler state
 * Call this when user requests a fix so the same error can be detected again
 */
export function resetPreviewErrorHandler(): void {
  getPreviewErrorHandler().reset();
}
