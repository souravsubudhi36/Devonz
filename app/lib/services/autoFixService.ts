/**
 * Auto-Fix Service
 *
 * Core service that orchestrates the automatic error fixing loop.
 * Receives errors from detectors, formats them for the LLM, and
 * tracks fix attempts.
 */

import { createScopedLogger } from '~/utils/logger';
import {
  autoFixStore,
  getAutoFixStatus,
  getFixHistoryContext,
  markFixComplete,
  markFixFailed,
  resetAutoFix,
  type ErrorSource,
} from '~/lib/stores/autofix';
import { workbenchStore } from '~/lib/stores/workbench';

const logger = createScopedLogger('AutoFixService');

/**
 * Error context for auto-fix
 */
export interface AutoFixError {
  source: ErrorSource;
  type: string;
  message: string;
  content: string;
}

/**
 * Formatted message for sending to chat
 */
export interface AutoFixMessage {
  text: string;
  isAutoFix: true;
  attemptNumber: number;
  maxAttempts: number;
}

/**
 * Format an error for sending to the LLM via chat
 */
export function formatErrorForLLM(error: AutoFixError): AutoFixMessage {
  const status = getAutoFixStatus();
  const historyContext = getFixHistoryContext();

  // Determine source label
  const sourceLabel = error.source === 'terminal' ? 'terminal' : error.source === 'preview' ? 'preview' : 'build';

  // Build the message text
  const lines: string[] = [];

  // Header with attempt count
  lines.push(`[Auto-Fix Attempt ${status.currentAttempt}/${status.maxAttempts}]`);
  lines.push('');
  lines.push(`*Automatically fixing ${sourceLabel} error*`);
  lines.push('');

  // Error details
  lines.push(`**Error Type**: ${error.type}`);
  lines.push('**Error Message**:');
  lines.push('```' + (error.source === 'preview' ? 'js' : 'sh'));
  lines.push(error.content.slice(0, 2000)); // Limit content length
  lines.push('```');

  // Add history context if there were previous attempts
  if (historyContext) {
    lines.push('');
    lines.push(historyContext);
  }

  // Instruction
  lines.push('');
  lines.push('Please analyze and fix this error.');

  return {
    text: lines.join('\n'),
    isAutoFix: true,
    attemptNumber: status.currentAttempt,
    maxAttempts: status.maxAttempts,
  };
}

/**
 * Handle successful fix (no more errors detected after fix)
 * Call this when the error is resolved
 */
export function handleFixSuccess(): void {
  logger.info('Auto-fix successful - error resolved');
  markFixComplete();

  // Clear the terminal/preview error alert since the fix succeeded
  workbenchStore.clearAlert();

  // Optionally show success notification
  const state = autoFixStore.get();

  if (state.settings.showNotifications) {
    // Could trigger a toast notification here
    logger.info('Fix completed successfully');
  }
}

/**
 * Handle failed fix (error still present or new error)
 * Call this when the same/similar error is detected after fix attempt
 */
export function handleFixFailure(): void {
  const status = getAutoFixStatus();
  logger.info(`Auto-fix attempt ${status.currentAttempt} failed`);

  markFixFailed();

  // Check if we should continue
  if (status.currentAttempt >= status.maxAttempts) {
    logger.warn('Max auto-fix attempts reached, stopping');

    // The terminal error detector will now show the alert to user
  }
}

/**
 * Cancel ongoing auto-fix session
 * Call this when user manually intervenes or closes the chat
 */
export function cancelAutoFix(): void {
  logger.info('Auto-fix cancelled by user');
  resetAutoFix();
}

/**
 * Check if auto-fix is currently active
 */
export function isAutoFixActive(): boolean {
  return getAutoFixStatus().isActive;
}

/**
 * Get the current auto-fix attempt number
 */
export function getCurrentAttempt(): number {
  return getAutoFixStatus().currentAttempt;
}

/**
 * Get summary of auto-fix session for display
 */
export function getAutoFixSummary(): string {
  const state = autoFixStore.get();

  if (!state.isFixing && state.fixHistory.length === 0) {
    return 'No auto-fix activity';
  }

  const successCount = state.fixHistory.filter((a) => a.wasSuccessful).length;
  const failCount = state.fixHistory.filter((a) => !a.wasSuccessful).length;

  if (state.isFixing) {
    return `Auto-fixing... (Attempt ${state.currentRetries}/${state.settings.maxRetries})`;
  }

  if (successCount > 0) {
    return `Fixed after ${state.currentRetries} attempt(s)`;
  }

  return `Failed after ${failCount} attempt(s)`;
}

/**
 * Create the auto-fix callback function for the terminal error detector
 * This returns a function that can be registered with the detector
 */
export function createAutoFixHandler(sendMessage: (message: string) => void): (error: AutoFixError) => Promise<void> {
  return async (error: AutoFixError): Promise<void> => {
    logger.info('Auto-fix handler triggered', { type: error.type, source: error.source });

    // Format the error for the LLM
    const formattedMessage = formatErrorForLLM(error);

    // Send the fix request via chat
    sendMessage(formattedMessage.text);
  };
}
