/**
 * Error Type Definitions
 *
 * Shared types for error handling across the application.
 *
 * @module types/errors
 */

/**
 * Error severity levels
 * - critical: Blocking errors that prevent functionality
 * - warning: Issues that should be addressed but don't block
 * - info: Informational messages, often suppressible
 */
export type ErrorSeverity = 'critical' | 'warning' | 'info';

/**
 * Error categories for filtering and handling
 */
export type ErrorCategory = 'preview' | 'terminal' | 'module' | 'network' | 'build' | 'runtime';

/**
 * Structured error information
 */
export interface StructuredError {
  /** Original error message */
  originalMessage: string;

  /** User-friendly title */
  title: string;

  /** User-friendly description */
  description: string;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Error category */
  category: ErrorCategory;

  /** Optional suggestion for fixing */
  suggestion?: string;

  /** Optional recovery action */
  recoveryAction?: string;

  /** Cleaned stack trace */
  stack?: string;

  /** Timestamp when error occurred */
  timestamp: number;

  /** Unique hash for deduplication */
  hash: string;

  /** Source of the error (file path, URL, etc.) */
  source?: string;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Enable/disable error handling */
  enabled: boolean;

  /** Cooldown between alerts in milliseconds */
  cooldownMs: number;

  /** Maximum buffer size for error aggregation */
  maxBufferSize: number;

  /** Time-to-live for error hashes (deduplication) */
  hashTtlMs: number;

  /** Minimum severity to show alerts */
  minSeverityForAlert: ErrorSeverity;
}

/**
 * Default error handler configuration
 */
export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  enabled: true,
  cooldownMs: 5000,
  maxBufferSize: 10000,
  hashTtlMs: 60000,
  minSeverityForAlert: 'warning',
};

/**
 * Error boundary fallback props
 */
export interface ErrorBoundaryFallbackProps {
  /** The error that was caught */
  error: Error;

  /** Function to reset the error boundary */
  resetErrorBoundary: () => void;

  /** Error category if known */
  category?: ErrorCategory;
}

/**
 * Error recovery action
 */
export interface ErrorRecoveryAction {
  /** Action label */
  label: string;

  /** Action handler */
  handler: () => void | Promise<void>;

  /** Whether this is the primary action */
  primary?: boolean;
}
