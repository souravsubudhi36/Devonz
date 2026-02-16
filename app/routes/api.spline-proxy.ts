/**
 * Spline 3D Scene Proxy API
 *
 * A proxy endpoint that fetches Spline scene files from prod.spline.design
 * and serves them with proper CORS headers. This solves:
 *
 * 1. CORS issues in WebContainer local development
 * 2. Access to scenes that may have origin restrictions
 * 3. Caching for better performance
 *
 * Usage:
 *   GET /api/spline-proxy?scene=<scene-id>
 *   OR
 *   GET /api/spline-proxy?url=<full-spline-url>
 *
 * Examples:
 *   /api/spline-proxy?scene=V2pT-fO5F255I0pA
 *   /api/spline-proxy?url=https://prod.spline.design/V2pT-fO5F255I0pA/scene.splinecode
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SplineProxy');

const SPLINE_CDN_BASE = 'https://prod.spline.design';

// Cache for scene data (simple in-memory cache)
const sceneCache = new Map<string, { data: ArrayBuffer; timestamp: number; contentType: string }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache

/**
 * CORS headers for cross-origin requests
 */
function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
  };
}

/**
 * Build Spline scene URL from scene ID or full URL
 */
function buildSplineUrl(params: URLSearchParams): string | null {
  const scene = params.get('scene');
  const url = params.get('url');

  if (url) {
    // Validate it's a spline URL
    if (url.includes('spline.design') || url.includes('splinecode')) {
      return url;
    }

    return null;
  }

  if (scene) {
    // Build standard spline scene URL
    return `${SPLINE_CDN_BASE}/${scene}/scene.splinecode`;
  }

  return null;
}

/**
 * Handle OPTIONS preflight requests
 */
function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Main loader - handles GET requests for Spline scene data
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  const url = new URL(request.url);
  const splineUrl = buildSplineUrl(url.searchParams);

  if (!splineUrl) {
    return new Response(
      JSON.stringify({
        error: 'Missing or invalid scene parameter',
        usage: {
          scene: '/api/spline-proxy?scene=<scene-id>',
          url: '/api/spline-proxy?url=<full-spline-url>',
        },
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      },
    );
  }

  // Check cache first
  const cached = sceneCache.get(splineUrl);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug(`Cache hit for: ${splineUrl}`);

    return new Response(cached.data, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'HIT',
        ...getCorsHeaders(request),
      },
    });
  }

  logger.info(`Fetching scene: ${splineUrl}`);

  try {
    // Fetch the Spline scene from CDN
    const response = await fetch(splineUrl, {
      headers: {
        Accept: 'application/octet-stream, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Origin: 'https://spline.design',
        Referer: 'https://spline.design/',
      },
    });

    if (!response.ok) {
      logger.error(`Failed to fetch: ${response.status} ${response.statusText}`);

      return new Response(
        JSON.stringify({
          error: 'Failed to fetch Spline scene',
          status: response.status,
          statusText: response.statusText,
          url: splineUrl,
          hint:
            response.status === 403
              ? 'The scene may be private or the URL may be incorrect. Make sure the scene is published as public.'
              : 'Check the scene URL is correct.',
        }),
        {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request),
          },
        },
      );
    }

    // Get the scene data
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

    // Cache the result
    sceneCache.set(splineUrl, {
      data,
      timestamp: Date.now(),
      contentType,
    });

    logger.info(`Successfully fetched scene: ${data.byteLength} bytes`);

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': data.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
        'X-Spline-Url': splineUrl,
        ...getCorsHeaders(request),
      },
    });
  } catch (error) {
    logger.error('Error fetching scene:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch Spline scene',
        message: error instanceof Error ? error.message : 'Unknown error',
        url: splineUrl,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request),
        },
      },
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function action({ request }: LoaderFunctionArgs): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  return new Response('Method not allowed', { status: 405 });
}
