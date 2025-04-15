// --- General Utility Functions ---

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
