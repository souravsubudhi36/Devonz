import { type LoaderFunctionArgs, json } from '@remix-run/node';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { withSecurity } from '~/lib/security';

async function exportApiKeysLoader({ context, request }: LoaderFunctionArgs) {
  // Get API keys from cookie
  const cookieHeader = request.headers.get('Cookie');
  const apiKeysFromCookie = getApiKeysFromCookie(cookieHeader);

  // Initialize the LLM manager to access environment variables
  const llmManager = LLMManager.getInstance(context?.cloudflare?.env ?? {});

  // Get all provider instances to find their API token keys
  const providers = llmManager.getAllProviders();

  // Create a comprehensive API keys object
  const apiKeys: Record<string, string> = { ...apiKeysFromCookie };

  // For each provider, check all possible sources for API keys
  for (const provider of providers) {
    if (!provider.config.apiTokenKey) {
      continue;
    }

    const envVarName = provider.config.apiTokenKey;

    // Skip if we already have this provider's key from cookies
    if (apiKeys[provider.name]) {
      continue;
    }

    // Check environment variables in order of precedence
    const envValue =
      (context?.cloudflare?.env as Record<string, any>)?.[envVarName] ||
      process.env[envVarName] ||
      llmManager.env[envVarName];

    if (envValue) {
      apiKeys[provider.name] = envValue;
    }
  }

  return json(apiKeys);
}

export const loader = withSecurity(exportApiKeysLoader, {
  allowedMethods: ['GET'],
  rateLimit: false,
});
