/**
 * Spline Asset Types
 *
 * Type definitions for the Spline Asset Library system.
 * These types define the structure of curated 3D assets
 * that Bolt can offer to users.
 */

/**
 * Available asset categories for organization and filtering
 */
export type SplineCategory =
    | 'characters'
    | 'backgrounds'
    | 'icons'
    | 'decorative'
    | 'ui-elements'
    | 'abstract'
    | 'tech'
    | 'nature';

/**
 * License types for Spline assets
 */
export type SplineLicense = 'CC0' | 'CC-BY' | 'CC-BY-SA' | 'Custom' | 'Unknown';

/**
 * Represents a single verified Spline 3D asset
 */
export interface SplineAsset {
    /** Unique identifier for the asset */
    id: string;

    /** Display name of the asset */
    name: string;

    /** Brief description of what the asset is/does */
    description: string;

    /** Category for filtering */
    category: SplineCategory;

    /** The actual Spline scene URL (must be prod.spline.design format) */
    sceneUrl: string;

    /** URL to a thumbnail image (optional, for visual picker) */
    thumbnailUrl?: string;

    /** Searchable tags */
    tags: string[];

    /** Whether this asset has been verified as working */
    verified: boolean;

    /** ISO date string of when it was last verified */
    verifiedDate: string;

    /** Original author/creator (from Spline community) */
    author?: string;

    /** Author's Spline profile URL */
    authorUrl?: string;

    /** License type for the asset */
    license: SplineLicense;

    /** Whether this asset has interactive features (hover, click, etc.) */
    interactive?: boolean;

    /** Estimated file size for loading considerations */
    estimatedSizeKb?: number;

    /** Keywords for LLM matching (helps Bolt find relevant assets) */
    keywords?: string[];
}

/**
 * Asset collection with metadata
 */
export interface SplineAssetCollection {
    /** Version of the asset collection schema */
    version: string;

    /** When the collection was last updated */
    lastUpdated: string;

    /** Total number of assets */
    totalAssets: number;

    /** The assets array */
    assets: SplineAsset[];
}

/**
 * Filter options for querying assets
 */
export interface SplineAssetFilter {
    category?: SplineCategory;
    search?: string;
    tags?: string[];
    verifiedOnly?: boolean;
    interactive?: boolean;
}

/**
 * Result of asset search/filter operations
 */
export interface SplineAssetSearchResult {
    assets: SplineAsset[];
    totalMatches: number;
    categories: SplineCategory[];
}

/**
 * Category metadata for UI display
 */
export interface SplineCategoryInfo {
    id: SplineCategory;
    name: string;
    description: string;
    icon: string;
    count?: number;
}

/**
 * All available categories with display info
 */
export const SPLINE_CATEGORIES: SplineCategoryInfo[] = [
    {
        id: 'characters',
        name: 'Characters',
        description: 'Robots, mascots, avatars, and animated characters',
        icon: '🤖',
    },
    {
        id: 'backgrounds',
        name: 'Backgrounds',
        description: 'Abstract shapes, particles, and geometric patterns',
        icon: '🌌',
    },
    {
        id: 'icons',
        name: '3D Icons',
        description: 'Interactive 3D icons and symbols',
        icon: '💎',
    },
    {
        id: 'ui-elements',
        name: 'UI Elements',
        description: 'Floating cards, widgets, and interface components',
        icon: '📱',
    },
    {
        id: 'decorative',
        name: 'Decorative',
        description: 'Ambient animations, particles, and effects',
        icon: '✨',
    },
    {
        id: 'abstract',
        name: 'Abstract',
        description: 'Geometric shapes, cubes, spheres, and abstract art',
        icon: '🔷',
    },
    {
        id: 'tech',
        name: 'Tech',
        description: 'Technology-themed objects and gadgets',
        icon: '💻',
    },
    {
        id: 'nature',
        name: 'Nature',
        description: 'Plants, animals, and natural elements',
        icon: '🌿',
    },
];
