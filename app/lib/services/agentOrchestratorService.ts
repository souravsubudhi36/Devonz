/**
 * Agent Orchestrator Service
 *
 * Manages the autonomous agent execution loop with state tracking,
 * approval flows, iteration limits, and tool coordination.
 */

import { createScopedLogger } from '~/utils/logger';
import { AGENT_ITERATION_WARNING_PROMPT } from '~/lib/agent/prompts';
import type {
  AgentExecutionState,
  AgentModeSettings,
  AgentOrchestratorOptions,
  AgentStatus,
  ToolCallRecord,
  ApprovalRequest,
} from '~/lib/agent/types';
import { DEFAULT_AGENT_SETTINGS } from '~/lib/agent/types';

const logger = createScopedLogger('AgentOrchestrator');

function createInitialState(): AgentExecutionState {
  return {
    status: 'idle',
    isExecuting: false,
    iteration: 0,
    maxIterations: DEFAULT_AGENT_SETTINGS.maxIterations,
    totalToolCalls: 0,
    toolCalls: [],
    filesCreated: [],
    filesModified: [],
    commandsExecuted: [],
  };
}

export class AgentOrchestrator {
  private state: AgentExecutionState;
  private settings: AgentModeSettings;
  private options: AgentOrchestratorOptions;

  constructor(settings: Partial<AgentModeSettings> = {}, options: Partial<AgentOrchestratorOptions> = {}) {
    this.settings = { ...DEFAULT_AGENT_SETTINGS, ...settings };
    this.options = options;
    this.state = createInitialState();
    this.state.maxIterations = this.settings.maxIterations;
    logger.debug('AgentOrchestrator initialized', { settings: this.settings });
  }

  getState(): Readonly<AgentExecutionState> {
    return { ...this.state };
  }

  getSettings(): Readonly<AgentModeSettings> {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<AgentModeSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.state.maxIterations = this.settings.maxIterations;
    logger.debug('Settings updated', { updates });
  }

  startSession(task: string): void {
    this.state = createInitialState();
    this.state.currentTask = task;
    this.state.status = 'thinking';
    this.state.sessionStartTime = Date.now();
    this.state.maxIterations = this.settings.maxIterations;
    logger.info('Session started', { task });
    this.notifyStatusChange('thinking');
  }

  endSession(): AgentExecutionState {
    this.state.status = 'completed';
    this.state.sessionEndTime = Date.now();
    logger.info('Session ended', this.getSessionSummary());
    this.notifyStatusChange('completed');
    return this.getState();
  }

  reset(): void {
    this.state = createInitialState();
    this.state.maxIterations = this.settings.maxIterations;
    logger.debug('State reset');
    this.notifyStatusChange('idle');
  }

  canContinue(): boolean {
    if (this.state.status === 'error') {
      return false;
    }
    return this.state.iteration < this.state.maxIterations;
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { isAgentTool, executeAgentTool } = await import('./agentToolsService');

    if (!isAgentTool(toolName)) {
      const error = `Unknown agent tool: ${toolName}`;
      logger.error(error);
      return { success: false, error };
    }

    const needsApproval = this.checkNeedsApproval(toolName, params);

    if (needsApproval && !this.options.autoApproveAll) {
      const approved = await this.requestApproval({
        toolName,
        params,
        reason: `Tool ${toolName} requires approval`,
      });

      if (!approved) {
        return { success: false, error: 'Tool execution not approved by user' };
      }
    }

    this.state.status = 'executing';
    this.notifyStatusChange('executing');

    const startTime = Date.now();

    try {
      const result = await executeAgentTool(toolName, params);
      const duration = Date.now() - startTime;

      const record: ToolCallRecord = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        params,
        result,
        timestamp: startTime,
        duration,
      };

      this.state.toolCalls.push(record);
      this.state.totalToolCalls++;
      this.state.lastToolCall = record;

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;

        if (data.created && data.path) {
          this.state.filesCreated.push(data.path as string);
        } else if (data.modified && data.path) {
          this.state.filesModified.push(data.path as string);
        } else if (toolName === 'devonz_write_file' && data.path) {
          this.state.filesCreated.push(data.path as string);
        }

        if (toolName === 'devonz_run_command' && params.command) {
          this.state.commandsExecuted.push(params.command as string);
        }
      }

      this.options.onToolExecuted?.(record);

      this.state.status = 'thinking';
      this.notifyStatusChange('thinking');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Tool execution failed', { toolName, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private checkNeedsApproval(toolName: string, params: Record<string, unknown>): boolean {
    if (toolName === 'devonz_run_command' && !this.settings.autoApproveCommands) {
      return true;
    }

    if (toolName === 'devonz_write_file') {
      const path = params.path as string | undefined;

      if (path && !this.settings.autoApproveFileCreation) {
        return true;
      }
    }

    return false;
  }

  private async requestApproval(request: ApprovalRequest): Promise<boolean> {
    if (!this.options.onApprovalNeeded) {
      return false;
    }

    this.state.status = 'awaiting_approval';
    this.state.pendingApproval = request;
    this.notifyStatusChange('awaiting_approval');

    try {
      const approved = await this.options.onApprovalNeeded(request);
      this.state.pendingApproval = undefined;
      return approved;
    } catch {
      this.state.pendingApproval = undefined;
      return false;
    }
  }

  incrementIteration(): boolean {
    this.state.iteration++;
    logger.debug('Iteration incremented', { iteration: this.state.iteration });
    this.options.onIterationComplete?.(this.state.iteration, this.getState());
    return this.canContinue();
  }

  isNearIterationLimit(): boolean {
    const threshold = 5;
    return this.state.maxIterations - this.state.iteration <= threshold;
  }

  getIterationWarningPrompt(): string | null {
    if (!this.isNearIterationLimit()) {
      return null;
    }

    return AGENT_ITERATION_WARNING_PROMPT;
  }

  setError(message: string): void {
    this.state.status = 'error';
    this.state.errorMessage = message;
    logger.error('Error set', { message });
    this.notifyStatusChange('error');
  }

  getSessionSummary(): string {
    const parts: string[] = [];
    parts.push(`${this.state.iteration} iterations`);
    parts.push(`${this.state.totalToolCalls} tool calls`);

    if (this.state.filesCreated.length > 0) {
      parts.push(`Files created: ${this.state.filesCreated.join(', ')}`);
    }

    if (this.state.filesModified.length > 0) {
      parts.push(`Files modified: ${this.state.filesModified.join(', ')}`);
    }

    if (this.state.commandsExecuted.length > 0) {
      parts.push(`Commands: ${this.state.commandsExecuted.join(', ')}`);
    }

    return parts.join(' | ');
  }

  abort(): void {
    this.state.status = 'idle';
    this.state.isExecuting = false;
    logger.info('Execution aborted');
    this.notifyStatusChange('idle');
  }

  async getAvailableTools(): Promise<string[]> {
    const { getAgentToolNames } = await import('./agentToolsService');
    return getAgentToolNames();
  }

  private notifyStatusChange(status: AgentStatus): void {
    this.options.onStatusChange?.(status);
  }
}

let singletonInstance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(
  settings?: Partial<AgentModeSettings>,
  options?: Partial<AgentOrchestratorOptions>,
): AgentOrchestrator {
  if (!singletonInstance) {
    singletonInstance = new AgentOrchestrator(settings, options);
  }

  return singletonInstance;
}

export function createAgentOrchestrator(
  settings?: Partial<AgentModeSettings>,
  options?: Partial<AgentOrchestratorOptions>,
): AgentOrchestrator {
  return new AgentOrchestrator(settings, options);
}

export function resetAgentOrchestrator(): void {
  singletonInstance = null;
}

export async function runAgentTask(
  task: string,
  options?: Partial<AgentOrchestratorOptions>,
): Promise<AgentExecutionState> {
  const orchestrator = getAgentOrchestrator({}, options);
  orchestrator.startSession(task);
  return orchestrator.endSession();
}

export function isAgentModeAvailable(): boolean {
  try {
    const { getAgentToolNames } = require('./agentToolsService');
    return getAgentToolNames().length > 0;
  } catch {
    return false;
  }
}

export function getAgentStatus(): AgentStatus | null {
  if (!singletonInstance) {
    return null;
  }

  return singletonInstance.getState().status;
}
