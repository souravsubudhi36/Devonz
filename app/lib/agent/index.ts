/**
 * Agent Module Index
 *
 * Exports all agent-related types, prompts, and utilities.
 */

// Types
export * from './types';

// Prompts
export {
  AGENT_SYSTEM_PROMPT,
  AGENT_SYSTEM_PROMPT_COMPACT,
  AGENT_ERROR_CONTEXT_PROMPT,
  AGENT_ITERATION_WARNING_PROMPT,
  getAgentSystemPrompt,
} from './prompts';

// Re-export orchestrator and tools from services
// These are the main entry points for agent mode functionality
export {
  AgentOrchestrator,
  getAgentOrchestrator,
  createAgentOrchestrator,
  resetAgentOrchestrator,
  runAgentTask,
  isAgentModeAvailable,
  getAgentStatus,
} from '~/lib/services/agentOrchestratorService';

export {
  agentToolDefinitions,
  getAgentTools,
  getAgentToolsWithoutExecute,
  executeAgentTool,
  getAgentToolNames,
  isAgentTool,
} from '~/lib/services/agentToolsService';
