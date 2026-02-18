import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createScopedLogger } from '~/utils/logger';
import { MCPService, type MCPConfig } from '~/lib/services/mcpService';
import { withSecurity } from '~/lib/security';

const logger = createScopedLogger('api.mcp-update-config');

async function mcpUpdateConfigAction({ request }: ActionFunctionArgs) {
  try {
    const mcpConfig = (await request.json()) as MCPConfig;

    if (!mcpConfig || typeof mcpConfig !== 'object') {
      return json({ error: 'Invalid MCP servers configuration' }, { status: 400 });
    }

    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.updateConfig(mcpConfig);

    return json(serverTools);
  } catch (error) {
    logger.error('Error updating MCP config:', error);
    return json({ error: 'Failed to update MCP config' }, { status: 500 });
  }
}

export const action = withSecurity(mcpUpdateConfigAction, {
  allowedMethods: ['POST'],
  rateLimit: false,
});
