import { fileStructure } from './fileStructure.js'; // Assuming fileStructure is accessible like this

/**
 * Safely accesses nested properties in an object using a path array.
 * @param {object} obj The object to traverse.
 * @param {string[]} pathArr Array of keys representing the path.
 * @returns {*} The value at the path, or undefined if path doesn't exist.
 */
export function getNested(obj, pathArr) {
    if (!Array.isArray(pathArr)) { console.error("getNested received non-array path:", pathArr); return undefined; }
    return pathArr.reduce((acc, part) => (acc && typeof acc === 'object' && acc.hasOwnProperty(part)) ? acc[part] : undefined, obj);
}

/**
 * Parses a path string into an array of non-empty segments.
 * @param {string} pathStr The path string (e.g., "data/f1/f2/").
 * @returns {string[]} Array of path segments.
 */
export function parsePath(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') return [];
    return pathStr.split('/').filter(p => p);
}

/**
 * Finds all keys in a directory object that end with .png (case-insensitive) and sorts them.
 * @param {object} dirObject The object representing a directory in fileStructure.
 * @returns {string[]} Sorted array of PNG filenames.
 */
export function getImageFilesInDir(dirObject) {
     if (!dirObject || typeof dirObject !== 'object') return [];
     return Object.keys(dirObject)
         .filter(key => typeof key === 'string' && key.toLowerCase().endsWith('.png'))
         .sort();
}

/**
 * Simple debounce function. Ensures a function doesn't run too frequently.
 * @param {Function} func The function to debounce.
 * @param {number} delay Delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Checks if a path constructed from a base path string and dropdown selections is valid in the fileStructure.
 * @param {string} basePathString The base path from the input field (e.g., "data/results/*").
 * @param {string[]} selections The array of dropdown selections.
 * @returns {boolean} True if the path resolves to a valid directory object, false otherwise.
 */
export function isValidPath(basePathString, selections) {
    if (typeof fileStructure === 'undefined') {
        console.error("[isValidPath] fileStructure is not available.");
        return false;
    }
    const basePathSegments = parsePath(basePathString || '');
    let currentLevelObj = fileStructure;
    let dropdownIndex = 0;
    let pathIsValid = true;

    try {
        // --- Traverse using Base Path Segments ---
        for (let i = 0; i < basePathSegments.length; i++) {
            const segment = basePathSegments[i];
            if (!currentLevelObj || typeof currentLevelObj !== 'object') {
                pathIsValid = false;
                break;
            }

            if (segment === '*') {
                // Need a selection to proceed past a wildcard in the base path
                const selection = selections[dropdownIndex];
                if (selection && currentLevelObj.hasOwnProperty(selection) && typeof currentLevelObj[selection] === 'object') {
                    currentLevelObj = currentLevelObj[selection];
                    dropdownIndex++; // Consume this selection index
                } else {
                    pathIsValid = false; // Invalid selection or missing selection for '*'
                    break;
                }
            } else {
                // Fixed segment in base path
                if (currentLevelObj.hasOwnProperty(segment) && typeof currentLevelObj[segment] === 'object') {
                    currentLevelObj = currentLevelObj[segment];
                } else {
                    pathIsValid = false; // Fixed segment not found
                    break;
                }
            }
        } // End base path loop

        // --- Traverse using Remaining Selections ---
        // Starts from the current dropdownIndex, continues until the end of selections
        while (pathIsValid && currentLevelObj && dropdownIndex < selections.length) {
            if (typeof currentLevelObj !== 'object') {
                pathIsValid = false; // Should not happen if previous checks worked, but safety first
                break;
            }
            const selection = selections[dropdownIndex];
            // An empty selection ("-- Select --") means the path is incomplete *unless* it's the very last one
            // but for validation purposes here, we treat any intermediate empty selection as invalidating the *full* path.
            // A *truly* empty selection array might be valid if the base path itself points to a directory.
            if (selection && currentLevelObj.hasOwnProperty(selection) && typeof currentLevelObj[selection] === 'object') {
                currentLevelObj = currentLevelObj[selection];
            } else {
                // Path is invalid if selection is empty or doesn't exist at this level
                pathIsValid = false;
                break;
            }
            dropdownIndex++;
        }

    } catch (error) {
        console.error(`[isValidPath] Error during traversal:`, error);
        pathIsValid = false;
        currentLevelObj = null;
    }
    return pathIsValid && currentLevelObj && typeof currentLevelObj === 'object';
}
