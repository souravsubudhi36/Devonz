/**
 * Spline Proxy Client
 *
 * Utilities for loading Spline 3D scenes through the proxy API.
 * This allows Spline scenes to work in both:
 * - Local WebContainer development
 * - Production Vercel deployment
 *
 * Usage in React components:
 *   import { getProxiedSplineUrl, useSplineProxy } from '~/lib/api/spline-client';
 *
 *   // Simple URL conversion
 *   const proxiedUrl = getProxiedSplineUrl('https://prod.spline.design/xxx/scene.splinecode');
 *
 *   // Or use with scene ID
 *   const proxiedUrl = getProxiedSplineUrl(undefined, 'xxx');
 */

/**
 * Convert a Spline CDN URL to use our proxy endpoint
 *
 * @param originalUrl - The original spline.design URL
 * @param sceneId - Optional scene ID if not providing full URL
 * @returns Proxied URL that works with CORS
 */
export function getProxiedSplineUrl(originalUrl?: string, sceneId?: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    if (originalUrl) {
        // Use the full URL parameter
        return `${baseUrl}/api/spline-proxy?url=${encodeURIComponent(originalUrl)}`;
    }

    if (sceneId) {
        // Use the scene ID parameter
        return `${baseUrl}/api/spline-proxy?scene=${encodeURIComponent(sceneId)}`;
    }

    throw new Error('Either originalUrl or sceneId must be provided');
}

/**
 * Extract scene ID from a Spline URL
 *
 * @param url - Spline URL (e.g., https://prod.spline.design/xxx/scene.splinecode)
 * @returns Scene ID or null if not found
 */
export function extractSplineSceneId(url: string): string | null {
    /*
     * Match patterns like:
     * https://prod.spline.design/V2pT-fO5F255I0pA/scene.splinecode
     * https://my.spline.design/genkubgreetingrobot-xxx/
     */
    const prodMatch = url.match(/prod\.spline\.design\/([^/]+)/);

    if (prodMatch) {
        return prodMatch[1];
    }

    const myMatch = url.match(/my\.spline\.design\/([^/]+)/);

    if (myMatch) {
        return myMatch[1];
    }

    return null;
}

/**
 * Check if a URL is a Spline scene URL
 */
export function isSplineUrl(url: string): boolean {
    return url.includes('spline.design') || url.includes('.splinecode');
}

/**
 * Transform a Spline scene prop to use the proxy
 * Use this when you have a Spline component with a scene prop
 *
 * @param sceneProp - The original scene prop value
 * @returns Proxied scene URL
 */
export function proxySplineScene(sceneProp: string): string {
    // If it's already using our proxy, return as-is
    if (sceneProp.includes('/api/spline-proxy')) {
        return sceneProp;
    }

    // If it's a Spline URL, proxy it
    if (isSplineUrl(sceneProp)) {
        return getProxiedSplineUrl(sceneProp);
    }

    // If it looks like just a scene ID
    if (!sceneProp.includes('://') && !sceneProp.includes('/')) {
        return getProxiedSplineUrl(undefined, sceneProp);
    }

    // Return as-is if we can't determine what it is
    return sceneProp;
}

/**
 * React hook for managing Spline proxy URLs
 * Provides loading state and error handling
 */
export interface SplineProxyResult {
    url: string;
    isProxied: boolean;
    originalUrl: string;
}

export function useSplineProxy(sceneUrl: string): SplineProxyResult {
    const proxiedUrl = proxySplineScene(sceneUrl);

    return {
        url: proxiedUrl,
        isProxied: proxiedUrl !== sceneUrl,
        originalUrl: sceneUrl,
    };
}
