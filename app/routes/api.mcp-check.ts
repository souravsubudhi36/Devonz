import { json } from '@remix-run/node';
import { createScopedLogger } from '~/utils/logger';
import { MCPService } from '~/lib/services/mcpService';
import { withSecurity } from '~/lib/security';

const logger = createScopedLogger('api.mcp-check');

async function mcpCheckLoader() {
  try {
    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.checkServersAvailabilities();

    return json(serverTools);
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return json({ error: 'Failed to check MCP servers' }, { status: 500 });
  }
}

export const loader = withSecurity(mcpCheckLoader as any, {
  allowedMethods: ['GET'],
  rateLimit: false,
});
