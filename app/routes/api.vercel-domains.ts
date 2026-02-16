/**
 * Vercel Domains API
 *
 * Handles domain management for Vercel projects:
 * - List project domains
 * - Add custom subdomain
 * - Remove domain
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { withSecurity } from '~/lib/security';

const VERCEL_API_BASE = 'https://api.vercel.com';

interface DomainRequest {
  /** Project ID */
  projectId: string;

  /** Action to perform */
  action: 'list' | 'add' | 'remove';

  /** Domain name (for add/remove) */
  domain?: string;
}

/**
 * Get Vercel token from request
 */
function getVercelToken(request: Request, context: any): string | null {
  // Try cookies first
  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);

  if (apiKeys.VITE_VERCEL_ACCESS_TOKEN) {
    return apiKeys.VITE_VERCEL_ACCESS_TOKEN;
  }

  // Try environment
  const envToken = context?.cloudflare?.env?.VITE_VERCEL_ACCESS_TOKEN || process.env.VITE_VERCEL_ACCESS_TOKEN;

  if (envToken) {
    return envToken;
  }

  // Try Authorization header
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Handle GET requests - list domains for a project
 */
async function vercelDomainsLoader({ request, context }: LoaderFunctionArgs) {
  const vercelToken = getVercelToken(request, context);

  if (!vercelToken) {
    return json({ error: 'Vercel token not found' }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains`, {
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'User-Agent': 'devonz-app',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();

      return json(
        {
          error: `Failed to fetch domains: ${response.status}`,
          details: errorData,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    return json(data);
  } catch (error) {
    console.error('Vercel domains error:', error);

    return json(
      {
        error: 'Failed to fetch domains',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * Handle POST requests - add or remove domains
 */
async function vercelDomainsAction({ request, context }: ActionFunctionArgs) {
  const vercelToken = getVercelToken(request, context);

  if (!vercelToken) {
    return json({ error: 'Vercel token not found' }, { status: 401 });
  }

  try {
    const body: DomainRequest = await request.json();
    const { projectId, action, domain } = body;

    if (!projectId) {
      return json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (action === 'add') {
      if (!domain) {
        return json({ error: 'Domain name is required for add action' }, { status: 400 });
      }

      // Add the domain
      const response = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'User-Agent': 'devonz-app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 409) {
          return json(
            {
              error: 'Domain already exists',
              details: data,
            },
            { status: 409 },
          );
        }

        if (response.status === 400) {
          const errorMessage =
            data?.error?.message || data?.message || 'Invalid domain name or domain already registered on another team';

          return json(
            {
              error: errorMessage,
              details: data,
            },
            { status: 400 },
          );
        }

        return json(
          {
            error: `Failed to add domain: ${response.status}`,
            details: data,
          },
          { status: response.status },
        );
      }

      return json({ success: true, domain: data });
    }

    if (action === 'remove') {
      if (!domain) {
        return json({ error: 'Domain name is required for remove action' }, { status: 400 });
      }

      const response = await fetch(
        `${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'User-Agent': 'devonz-app',
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();

        return json(
          {
            error: `Failed to remove domain: ${response.status}`,
            details: data,
          },
          { status: response.status },
        );
      }

      return json({ success: true, removed: domain });
    }

    if (action === 'list') {
      const response = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains`, {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'User-Agent': 'devonz-app',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();

        return json(
          {
            error: `Failed to fetch domains: ${response.status}`,
            details: errorData,
          },
          { status: response.status },
        );
      }

      const data = await response.json();

      return json(data);
    }

    return json({ error: 'Invalid action. Use: list, add, or remove' }, { status: 400 });
  } catch (error) {
    console.error('Vercel domains error:', error);

    return json(
      {
        error: 'Failed to process domain request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const loader = withSecurity(vercelDomainsLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});

export const action = withSecurity(vercelDomainsAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
