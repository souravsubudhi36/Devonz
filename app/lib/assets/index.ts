/**
 * Spline Asset Library - Main Exports
 *
 * This module provides a curated collection of verified Spline 3D scenes
 * that can be offered to users when they request 3D content.
 */

// Export all types
export type {
    SplineAsset,
    SplineAssetCollection,
    SplineAssetFilter,
    SplineCategory,
    SplineLicense,
} from './splineAssetTypes';

// Export the categories constant
export { SPLINE_CATEGORIES } from './splineAssetTypes';

// Export the asset library and utility functions
export {
    filterAssets,
    formatAssetForDisplay,
    getAssetById,
    getAssetCollection,
    getAssetLibrarySummary,
    getAssetsByCategory,
    getAssetsByName,
    getAvailableCategories,
    getRandomAsset,
    getVerifiedAssets,
    searchAssets,
    splineAssets,
} from './splineAssets';
