/**
 * Auto-Fix Store
 *
 * State management for the automatic error fixing feature.
 * When enabled, errors detected in terminal/preview are automatically
 * sent to the LLM for fixing, up to a configurable max retry count.
 */

import { atom, map } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AutoFixStore');

/**
 * Record of a single fix attempt
 */
export interface FixAttempt {
  /** When the fix was attempted */
  timestamp: number;

  /** The error that triggered this attempt */
  errorType: string;

  /** Brief error description */
  errorMessage: string;

  /** Full error content for context */
  errorContent: string;

  /** Whether the fix resolved the error */
  wasSuccessful: boolean;

  /** Duration of the fix attempt in ms */
  duration?: number;
}

/**
 * Error source types
 */
export type ErrorSource = 'terminal' | 'preview' | 'build';

/**
 * Auto-fix settings that persist to localStorage
 */
export interface AutoFixSettings {
  /** Whether auto-fix is enabled */
  isEnabled: boolean;

  /** Maximum retry attempts before giving up */
  maxRetries: number;

  /** Delay between fix attempts in ms */
  delayBetweenAttempts: number;

  /** Show notification when auto-fix starts */
  showNotifications: boolean;
}

/**
 * Main auto-fix state
 */
export interface AutoFixState {
  /** Current settings */
  settings: AutoFixSettings;

  /** Number of retries in current fix session */
  currentRetries: number;

  /** Whether we're currently attempting a fix */
  isFixing: boolean;

  /** The current error being fixed */
  currentError: {
    source: ErrorSource;
    type: string;
    message: string;
    content: string;
  } | null;

  /** History of fix attempts in current session */
  fixHistory: FixAttempt[];

  /** Timestamp when current fix session started */
  sessionStartTime: number | null;
}

// Default settings
const DEFAULT_SETTINGS: AutoFixSettings = {
  isEnabled: true,
  maxRetries: 3,
  delayBetweenAttempts: 1000,
  showNotifications: true,
};

// Load settings from localStorage
function loadSettings(): AutoFixSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem('devonz_autofix_settings');

    if (stored) {
      const parsed = JSON.parse(stored);

      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    logger.error('Failed to load auto-fix settings:', error);
  }

  return DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveSettings(settings: AutoFixSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('devonz_autofix_settings', JSON.stringify(settings));
  } catch (error) {
    logger.error('Failed to save auto-fix settings:', error);
  }
}

/**
 * Initial state
 */
const initialState: AutoFixState = {
  settings: loadSettings(),
  currentRetries: 0,
  isFixing: false,
  currentError: null,
  fixHistory: [],
  sessionStartTime: null,
};

/**
 * Main auto-fix store
 */
export const autoFixStore = map<AutoFixState>(initialState);

/**
 * Derived atoms for easy access
 */
export const isAutoFixEnabled = atom(initialState.settings.isEnabled);
export const isAutoFixing = atom(false);
export const autoFixRetryCount = atom(0);

// Sync derived atoms with main store
autoFixStore.subscribe((state) => {
  isAutoFixEnabled.set(state.settings.isEnabled);
  isAutoFixing.set(state.isFixing);
  autoFixRetryCount.set(state.currentRetries);
});

/**
 * Update auto-fix settings
 */
export function updateAutoFixSettings(updates: Partial<AutoFixSettings>): void {
  const currentState = autoFixStore.get();
  const newSettings = { ...currentState.settings, ...updates };

  autoFixStore.set({
    ...currentState,
    settings: newSettings,
  });

  saveSettings(newSettings);
  logger.info('Auto-fix settings updated:', updates);
}

/**
 * Toggle auto-fix enabled state
 */
export function toggleAutoFix(enabled?: boolean): void {
  const currentState = autoFixStore.get();
  const newEnabled = enabled ?? !currentState.settings.isEnabled;

  updateAutoFixSettings({ isEnabled: newEnabled });
  logger.info(`Auto-fix ${newEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Start a new auto-fix session
 */
export function startAutoFix(error: { source: ErrorSource; type: string; message: string; content: string }): boolean {
  const currentState = autoFixStore.get();

  // Check if auto-fix is enabled
  if (!currentState.settings.isEnabled) {
    logger.debug('Auto-fix is disabled, skipping');

    return false;
  }

  // Check if we've exceeded max retries
  if (currentState.currentRetries >= currentState.settings.maxRetries) {
    logger.warn(`Max retries (${currentState.settings.maxRetries}) reached, stopping auto-fix`);

    return false;
  }

  // Check if we're already fixing
  if (currentState.isFixing) {
    logger.debug('Already fixing, queuing error');

    // Could implement a queue here in the future
    return false;
  }

  autoFixStore.set({
    ...currentState,
    isFixing: true,
    currentError: error,
    currentRetries: currentState.currentRetries + 1,
    sessionStartTime: currentState.sessionStartTime ?? Date.now(),
  });

  logger.info(`Starting auto-fix attempt ${currentState.currentRetries + 1}/${currentState.settings.maxRetries}`, {
    errorType: error.type,
    source: error.source,
  });

  return true;
}

/**
 * Record the result of a fix attempt
 */
export function recordFixAttempt(wasSuccessful: boolean): void {
  const currentState = autoFixStore.get();

  if (!currentState.currentError) {
    logger.warn('No current error to record fix attempt for');

    return;
  }

  const attempt: FixAttempt = {
    timestamp: Date.now(),
    errorType: currentState.currentError.type,
    errorMessage: currentState.currentError.message,
    errorContent: currentState.currentError.content,
    wasSuccessful,
    duration: currentState.sessionStartTime ? Date.now() - currentState.sessionStartTime : undefined,
  };

  autoFixStore.set({
    ...currentState,
    isFixing: false,
    currentError: wasSuccessful ? null : currentState.currentError,
    fixHistory: [...currentState.fixHistory, attempt],
  });

  if (wasSuccessful) {
    logger.info('Auto-fix successful!');
    resetAutoFix();
  } else {
    logger.info(
      `Auto-fix attempt failed, ${currentState.settings.maxRetries - currentState.currentRetries} retries remaining`,
    );
  }
}

/**
 * Mark fix as complete (called when no more errors detected)
 */
export function markFixComplete(): void {
  recordFixAttempt(true);
}

/**
 * Mark fix as failed (called when same/new error detected after fix)
 */
export function markFixFailed(): void {
  recordFixAttempt(false);
}

/**
 * Reset auto-fix state (end of session)
 */
export function resetAutoFix(): void {
  const currentState = autoFixStore.get();

  autoFixStore.set({
    ...currentState,
    currentRetries: 0,
    isFixing: false,
    currentError: null,
    fixHistory: [],
    sessionStartTime: null,
  });

  logger.debug('Auto-fix session reset');
}

/**
 * Check if we should continue attempting fixes
 */
export function shouldContinueFix(): boolean {
  const state = autoFixStore.get();

  return state.settings.isEnabled && !state.isFixing && state.currentRetries < state.settings.maxRetries;
}

/**
 * Check if we've exceeded max retries
 */
export function hasExceededMaxRetries(): boolean {
  const state = autoFixStore.get();

  return state.currentRetries >= state.settings.maxRetries;
}

/**
 * Get fix history context for LLM
 * Returns a formatted string of previous fix attempts
 */
export function getFixHistoryContext(): string {
  const state = autoFixStore.get();

  if (state.fixHistory.length === 0) {
    return '';
  }

  const attempts = state.fixHistory
    .map(
      (attempt, index) =>
        `Attempt ${index + 1}: ${attempt.wasSuccessful ? 'Success' : 'Failed'} - ${attempt.errorType}: ${attempt.errorMessage}`,
    )
    .join('\n');

  return `\n**Previous Fix Attempts:**\n${attempts}`;
}

/**
 * Get current fix status for UI display
 */
export function getAutoFixStatus(): {
  isActive: boolean;
  currentAttempt: number;
  maxAttempts: number;
  errorType: string | null;
} {
  const state = autoFixStore.get();

  return {
    isActive: state.isFixing,
    currentAttempt: state.currentRetries,
    maxAttempts: state.settings.maxRetries,
    errorType: state.currentError?.type ?? null,
  };
}
