import { fileStructure } from './fileStructure.js';
import { columnsState, getColumnState, getColumnElement } from './state.js';
// Import updateImageUI, NOT updateDropdownsUI for core logic here
import { updateDropdownsUI, updateImageUI } from './domUtils.js';
import { parsePath, getNested, getImageFilesInDir } from './helpers.js';

// --- NEW: Global Navigation State ---
let globalImageIndex = 0;
let combinedImageList = [];

// --- NEW: Export Getter Functions ---
export function getCombinedImageList() {
    // Return a copy to prevent accidental modification? Or trust consumers? Let's return direct for now.
    return combinedImageList;
}
export function getGlobalImageIndex() {
    return globalImageIndex;
}

// --- NEW: Recalculate Combined List ---
/**
 * Recalculates the combined list of unique image filenames across all active columns.
 * Updates each column's internal file list cache.
 * Updates all column displays based on the current global index.
 */
export function recalculateCombinedImageList() {
    console.log("[recalculateCombinedImageList] Recalculating...");
    const uniqueFilenames = new Set();
    let previousFilename = combinedImageList[globalImageIndex]; // Try to preserve position

    columnsState.forEach(state => {
        const element = getColumnElement(state.id);
        if (!element) { // Skip if column element doesn't exist (e.g., during deletion?)
            state.currentImageFiles = [];
            return;
        }

        // Resolve path for this column
        const pathInput = element.querySelector('.pathInput');
        const basePathSegments = parsePath(pathInput?.value || '');
        let currentLevelObj = fileStructure;
        let pathIsValid = true;
        let dropdownIndex = 0;

        try {
            for (let i = 0; i < basePathSegments.length; i++) { /* ... path traversal logic ... */
                 const segment = basePathSegments[i]; if (!currentLevelObj || typeof currentLevelObj !== 'object') { pathIsValid = false; break; }
                 if (segment === '*') { const selection = state.dropdownSelections[dropdownIndex]; if (selection && currentLevelObj.hasOwnProperty(selection)) { currentLevelObj = currentLevelObj[selection]; } else { pathIsValid = false; break; } dropdownIndex++; }
                 else { if (currentLevelObj.hasOwnProperty(segment)) { currentLevelObj = currentLevelObj[segment]; } else { pathIsValid = false; break; } }
            }
            while (pathIsValid && currentLevelObj && dropdownIndex < state.dropdownSelections.length) { /* ... subsequent levels ... */
                 if (typeof currentLevelObj !== 'object') { pathIsValid = false; break; } const selection = state.dropdownSelections[dropdownIndex];
                 if (selection && currentLevelObj.hasOwnProperty(selection)) { currentLevelObj = currentLevelObj[selection]; }
                 else if (selection === "") { currentLevelObj = null; break; } else { pathIsValid = false; break; }
                 dropdownIndex++;
             }
        } catch (e) { pathIsValid = false; console.error(`Error resolving path for col ${state.id}`, e); }

        // Get images and update cache/set
        if (pathIsValid && currentLevelObj && typeof currentLevelObj === 'object') {
            const imageFiles = getImageFilesInDir(currentLevelObj);
            imageFiles.forEach(filename => uniqueFilenames.add(filename));
            state.currentImageFiles = imageFiles; // Update cache
        } else {
            state.currentImageFiles = []; // Clear cache if path invalid/incomplete
        }
    });

    // Create the new sorted list
    combinedImageList = Array.from(uniqueFilenames).sort();
    console.log("[recalculateCombinedImageList] New combined list:", combinedImageList);

    // Try to restore index based on filename
    if (previousFilename) {
        const newIndex = combinedImageList.indexOf(previousFilename);
        if (newIndex !== -1) {
            globalImageIndex = newIndex;
        } else if (globalImageIndex >= combinedImageList.length) {
            // If previous filename gone AND old index out of bounds, go to last image
            globalImageIndex = Math.max(0, combinedImageList.length - 1);
        } // Otherwise, keep old index if it's still valid, even if filename changed
    } else {
         // No previous filename, reset or keep current index if valid
          if (globalImageIndex >= combinedImageList.length) {
             globalImageIndex = Math.max(0, combinedImageList.length - 1);
          }
    }
     console.log(`[recalculateCombinedImageList] Adjusted global index to: ${globalImageIndex}`);


    // Update all displays based on the new list and potentially adjusted index
    updateAllColumnsDisplay();
}


// --- NEW: Update All Displays ---
/**
 * Updates the display of ALL columns based on the current globalImageIndex
 * and the combinedImageList. Sets column's currentIndex appropriately.
 */
export function updateAllColumnsDisplay() {
    if (!Array.isArray(combinedImageList)) {
        console.error("[updateAllColumnsDisplay] combinedImageList is not an array!");
        return;
    }

    if (combinedImageList.length === 0) {
        console.log("[updateAllColumnsDisplay] Combined image list is empty. Clearing display.");
         columnsState.forEach(state => {
            state.currentIndex = -1; // Indicate no valid image
            if (typeof updateImageUI === 'function') updateImageUI(state.id); // Update UI
         });
        return;
    }

    // Ensure global index is valid
    if (globalImageIndex < 0 || globalImageIndex >= combinedImageList.length) {
         console.warn(`[updateAllColumnsDisplay] Global index ${globalImageIndex} out of bounds (0-${combinedImageList.length - 1}). Resetting to 0.`);
         globalImageIndex = 0;
    }

    const currentMasterFilename = combinedImageList[globalImageIndex];
    if (currentMasterFilename === undefined) { // Should not happen if bounds check works
         console.error(`[updateAllColumnsDisplay] Undefined filename at index ${globalImageIndex}!`);
         return;
    }

    console.log(`[updateAllColumnsDisplay] Updating to global index ${globalImageIndex}, filename: "${currentMasterFilename}"`);

    columnsState.forEach(state => {
        // Use the cached currentImageFiles list from the state
        const localIndex = (state.currentImageFiles && Array.isArray(state.currentImageFiles))
                           ? state.currentImageFiles.indexOf(currentMasterFilename)
                           : -1;

        state.currentIndex = localIndex; // Set index (-1 if not found)
        // console.log(`[updateAllColumnsDisplay] Column ${state.id}: Local index for "${currentMasterFilename}" is ${localIndex}.`); // Verbose

        // Call updateImageUI for this column
         if (typeof updateImageUI === 'function') {
             updateImageUI(state.id);
         } else {
             console.error(`[updateAllColumnsDisplay] updateImageUI function not available!`);
         }
    });
}

// --- NEW: Global Navigation ---
/**
 * Navigates the global index and updates all column displays.
 * @param {number} direction -1 for previous, 1 for next.
 */
export function navigateGlobalImageIndex(direction) {
    if (!Array.isArray(combinedImageList) || combinedImageList.length === 0) {
        console.log("[navigateGlobalImageIndex] No images to navigate.");
        return;
    }
    // Calculate new global index with wrap-around
    let newGlobalIndex = (globalImageIndex + direction + combinedImageList.length) % combinedImageList.length;
    globalImageIndex = newGlobalIndex;
    console.log(`[navigateGlobalImageIndex] New global index: ${globalImageIndex}`);
    updateAllColumnsDisplay(); // Update based on new index
}

// --- Image Navigation ---
/**
 * Navigates to the previous/next image in the source column and attempts
 * to sync other columns by matching the filename in their respective folders.
 * This sync occurs regardless of dropdown sync checkbox state.
 * @param {string} sourceColumnId - The ID of the column initiating the navigation.
 * @param {number} direction - -1 for previous, 1 for next.
 */
export function navigateImage(sourceColumnId, direction) {
    const sourceState = getColumnState(sourceColumnId);
    if (!sourceState) { console.error(`[navigateImage] Source state ${sourceColumnId} not found.`); return; }

    // 1. Check if source column has images
    if (!sourceState.currentImageFiles || sourceState.currentImageFiles.length === 0) {
        console.log(`[navigateImage ${sourceColumnId}] No images in source column's current folder.`);
        // Ensure its display reflects "no images"
        updateImageUI(sourceColumnId); // Will show appropriate alt text
        return; // Cannot navigate
    }

    // 2. Calculate the new index for the source column
    const numImagesSource = sourceState.currentImageFiles.length;
    // Ensure currentIndex is valid before calculating next (might be -1 initially)
    const currentSourceIndex = (sourceState.currentIndex >= 0 && sourceState.currentIndex < numImagesSource) ? sourceState.currentIndex : 0;
    let newIndexSource = (currentSourceIndex + direction + numImagesSource) % numImagesSource;

    // 3. Update the source column's state and get the target filename
    sourceState.currentIndex = newIndexSource;
    const targetFilename = sourceState.currentImageFiles[newIndexSource];

    if (!targetFilename) {
        console.error(`[navigateImage ${sourceColumnId}] Failed to get filename at new index ${newIndexSource}.`);
        updateImageUI(sourceColumnId); // Update UI even on error maybe?
        return;
    }
    console.log(`[navigateImage ${sourceColumnId}] Navigated to index ${newIndexSource}, filename: "${targetFilename}".`);

    // 4. Update the source column's UI FIRST
    updateImageUI(sourceColumnId);

    // 5. Iterate and attempt to sync other columns by filename
    console.log(`[navigateImage ${sourceColumnId}] Attempting to sync other columns to filename "${targetFilename}"`);
    columnsState.forEach(targetState => {
        if (targetState.id === sourceColumnId) return; // Skip self

        const targetColumnId = targetState.id;
        // Check if target has a valid image list (it should be kept up-to-date by its own updateImageUI calls)
        if (!targetState.currentImageFiles || targetState.currentImageFiles.length === 0) {
            console.log(`[navigateImage sync ${targetColumnId}] Target has no images in its list. Setting index to -1.`);
            targetState.currentIndex = -1; // Indicate no image possible
        } else {
            // Find the index of the target filename in the target's list
            const targetIndex = targetState.currentImageFiles.indexOf(targetFilename);
            targetState.currentIndex = targetIndex; // Will be -1 if not found
            console.log(`[navigateImage sync ${targetColumnId}] Found filename "${targetFilename}" at index: ${targetIndex}.`);
        }

        // Update the target column's UI to reflect the new index (or -1)
        updateImageUI(targetColumnId);
    });
}

// --- Dropdown Synchronization ---
export function syncDropdowns(sourceColumnId, levelIndex, selectedValue) {
    console.log(`[syncDropdowns] Source: ${sourceColumnId}, Level: ${levelIndex}, Value: "${selectedValue}"`);
    columnsState.forEach(targetState => {
        if (targetState.id === sourceColumnId) return;
        if (targetState.syncDisabled?.[levelIndex]) { return; }
        const targetElement = getColumnElement(targetState.id); if (!targetElement) return;
        const targetPathInput = targetElement.querySelector('.pathInput');
        const targetBasePathSegments = parsePath(targetPathInput?.value || '');
        let parentLevelObj = fileStructure; let targetDdIndex = 0; let pathValid = true;
        try {
            for(let i = 0; i < targetBasePathSegments.length; i++) {
                 if (!parentLevelObj || typeof parentLevelObj !== 'object') { pathValid = false; break; }
                 const segment = targetBasePathSegments[i];
                 if (segment === '*') {
                     if(targetDdIndex === levelIndex) break;
                     const currentTargetSelection = targetState.dropdownSelections[targetDdIndex];
                     if (currentTargetSelection && parentLevelObj.hasOwnProperty(currentTargetSelection)) { parentLevelObj = parentLevelObj[currentTargetSelection]; } else { pathValid = false; break; }
                     targetDdIndex++;
                 } else {
                     if (parentLevelObj.hasOwnProperty(segment)) { parentLevelObj = parentLevelObj[segment]; } else { pathValid = false; break; }
                 }
            }
            while(pathValid && parentLevelObj && targetDdIndex < levelIndex) {
                 if (typeof parentLevelObj !== 'object') { pathValid = false; break; }
                 const currentTargetSelection = targetState.dropdownSelections[targetDdIndex];
                 if (currentTargetSelection && parentLevelObj.hasOwnProperty(currentTargetSelection)) { parentLevelObj = parentLevelObj[currentTargetSelection]; } else { pathValid = false; break; }
                 targetDdIndex++;
            }
        } catch (error) { console.error(`[syncDropdowns] Error checking target path validity for ${targetState.id}:`, error); pathValid = false; }

        const isValidTargetOption = pathValid && parentLevelObj && typeof parentLevelObj === 'object' && parentLevelObj.hasOwnProperty(selectedValue) && typeof parentLevelObj[selectedValue] === 'object';
        const canReset = pathValid && parentLevelObj && typeof parentLevelObj === 'object';
        const targetSelect = targetElement.querySelector(`.dropdownContainer select[data-level-index="${levelIndex}"]`);
        const targetCurrentValue = targetSelect ? targetSelect.value : undefined;

        // Sync Logic
        if (selectedValue && isValidTargetOption && targetCurrentValue !== selectedValue) {
            const oldTargetSelections = [...targetState.dropdownSelections];
            let newTargetSelections = oldTargetSelections.slice(0, levelIndex);
            newTargetSelections[levelIndex] = selectedValue;
            let currentSubLevelObj = parentLevelObj[selectedValue];
            for (let i = levelIndex + 1; i < oldTargetSelections.length; i++) {
               const oldSubSelection = oldTargetSelections[i];
               if (oldSubSelection && currentSubLevelObj && typeof currentSubLevelObj === 'object' && currentSubLevelObj.hasOwnProperty(oldSubSelection)) { newTargetSelections[i] = oldSubSelection; currentSubLevelObj = currentSubLevelObj[oldSubSelection]; } else { break; }
            }
            while (newTargetSelections.length > 0 && newTargetSelections[newTargetSelections.length - 1] === undefined) { newTargetSelections.pop(); }
            targetState.dropdownSelections = newTargetSelections;
            targetState.currentIndex = 0;
            Object.keys(targetState.syncDisabled || {}).forEach(key => { if (parseInt(key) > levelIndex) delete targetState.syncDisabled[key]; });
            updateDropdownsUI(targetState.id);

        } else if (selectedValue === "" && canReset && targetCurrentValue !== "") {
            targetState.dropdownSelections = targetState.dropdownSelections.slice(0, levelIndex);
            targetState.currentIndex = 0;
            Object.keys(targetState.syncDisabled || {}).forEach(key => { if (parseInt(key) > levelIndex) delete targetState.syncDisabled[key]; });
            updateDropdownsUI(targetState.id);
        }
    });
}


// --- Dark Mode ---
export function invertImageDisplay(imgElement, forceInvert) {
    if (!imgElement) return;
    const originalSrc = imgElement.dataset.originalSrc;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!forceInvert || !originalSrc) {
        if (imgElement.src !== originalSrc || imgElement.src.startsWith('data:image/png')) {
            imgElement.src = originalSrc || '';
        }
        if (!originalSrc && !forceInvert) imgElement.alt = 'Source path missing';
        return;
    }
    if (imgElement.src.startsWith('data:image/png')) { return; }

    const tempImg = new Image();
    tempImg.crossOrigin = "Anonymous";
    tempImg.onload = () => {
        canvas.width = tempImg.naturalWidth; canvas.height = tempImg.naturalHeight;
        ctx.drawImage(tempImg, 0, 0);
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) { data[i]=255-data[i]; data[i+1]=255-data[i+1]; data[i+2]=255-data[i+2]; }
            ctx.putImageData(imageData, 0, 0);
            const isCurrentlyDark = document.body.classList.contains('dark-mode');
            if (isCurrentlyDark) { imgElement.src = canvas.toDataURL(); }
            else { if (imgElement.src !== originalSrc) { imgElement.src = originalSrc; } }
        } catch (e) { console.error(`[invertImageDisplay] Canvas processing failed for ${originalSrc}:`, e); if (imgElement.src !== originalSrc) imgElement.src = originalSrc; }
    };
    tempImg.onerror = () => { console.error(`[invertImageDisplay] Failed to load image for inversion: ${originalSrc}`); imgElement.alt = 'Failed to load'; if (imgElement.src !== originalSrc) imgElement.src = originalSrc || ''; };
    tempImg.src = originalSrc;
}
export function applyDarkMode(isDark) {
    // console.log(`[applyDarkMode] Setting dark mode to: ${isDark}`); // Reduce noise
    document.body.classList.toggle('dark-mode', isDark);
    const container = document.getElementById('columnsContainer');
    if (!container) { console.error("[applyDarkMode] columnsContainer not found."); return; }
    try {
        container.querySelectorAll('.column .displayImage').forEach(img => {
            if (img.dataset.originalSrc) { invertImageDisplay(img, isDark); }
        });
    } catch (error) { console.error("[applyDarkMode] Error processing images:", error); }
}

// --- Search Logic ---
/**
 * Finds potential matching paths or subdirectories/files based on a query string.
 * Excludes PDF files from the results.
 * @param {string} query - The path query string.
 * @returns {string[]} An array of matching path strings (excluding PDFs).
 */
export function findMatchingPaths(query) {
    if (!query) return [];
    if (typeof fileStructure === 'undefined') return [];

    // Helper to filter out PDFs
    const isNotPdf = (key) => typeof key === 'string' && !key.toLowerCase().endsWith('.pdf');

    const queryParts = parsePath(query);
    if (queryParts.length === 0) return [];

    let currentLevelObj = fileStructure;
    let currentPathParts = [];
    let found = true;

    try {
        for (let i = 0; i < queryParts.length; i++) {
            const part = queryParts[i];
            if (!currentLevelObj || typeof currentLevelObj !== 'object') {
                found = false;
                break;
            }
            if (currentLevelObj.hasOwnProperty(part)) {
                currentLevelObj = currentLevelObj[part];
                currentPathParts.push(part);
            } else {
                // Check for partial match only at the last part of the query
                if (i === queryParts.length - 1) {
                    const partialMatchKeys = Object.keys(currentLevelObj)
                        .filter(key => key.startsWith(part) && isNotPdf(key)); // Exclude PDFs here

                    if (partialMatchKeys.length > 0) {
                        // Return full paths for partial matches
                        return partialMatchKeys
                               .sort() // Sort partial matches
                               .map(key => [...currentPathParts, key].join('/'));
                    }
                }
                // No exact match or partial match found for this part
                found = false;
                break;
            }
        }
    } catch (error) {
        console.error("[findMatchingPaths] Error traversing file structure:", error);
        return [];
    }

    // If exact path found and it leads to a directory object
    if (found && currentLevelObj && typeof currentLevelObj === 'object') {
        // Return list of items within the directory (excluding PDFs)
        return Object.keys(currentLevelObj)
               .filter(isNotPdf) // Exclude PDFs here
               .sort()
               .map(key => [...currentPathParts, key].join('/'));
    }
    // If exact path found and it leads to a file (e.g., user typed full file path - currentLevelObj might be null or primitive)
    // We only want to suggest *items within* a directory, or partial matches.
    // An exact match to a file shouldn't list the file itself as a suggestion,
    // unless it was a partial match handled above.
    // If the path leads exactly to a file, suggest nothing further from here.
    // Returning the exact path might be desired if the user paused typing?
    // For consistency with suggestion purpose, let's return empty if exact match is a non-directory.
    // However, the current logic already handles the case where currentLevelObj is not an object by setting `found = false` earlier.
    // Let's refine the logic: if found is true, but currentLevelObj is NOT an object, it means the path exactly matched a file. Return empty suggestion list.
    if (found && (currentLevelObj === null || typeof currentLevelObj !== 'object')) {
        return []; // Exact path is a file, no further suggestions from *within* it.
    }


    // If path was not found at some point
    return [];
}
