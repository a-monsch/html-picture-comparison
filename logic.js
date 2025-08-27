import { fileStructure } from './fileStructure.js';
import { columnsState, getColumnState, getColumnElement } from './state.js';
import { updateDropdownsUI, updateImageUI } from './domUtils.js';
import { parsePath, getNested, getImageFilesInDir } from './helpers.js';

let globalImageIndex = 0;
let combinedImageList = [];

export function getCombinedImageList() {
    return combinedImageList;
}
export function getGlobalImageIndex() {
    return globalImageIndex;
}

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

    updateAllColumnsDisplay();
}


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

        if (typeof updateImageUI === 'function') {
            updateImageUI(state.id);
        } else {
            console.error(`[updateAllColumnsDisplay] updateImageUI function not available!`);
        }
    });
}

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

        updateImageUI(targetColumnId);
    });
}

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
    document.body.classList.toggle('dark-mode', isDark);
    const container = document.getElementById('columnsContainer');
    if (!container) { console.error("[applyDarkMode] columnsContainer not found."); return; }
    try {
        container.querySelectorAll('.column .displayImage').forEach(img => {
            if (img.dataset.originalSrc) { invertImageDisplay(img, isDark); }
        });
    } catch (error) { console.error("[applyDarkMode] Error processing images:", error); }
}

// search logic
/**
 * Finds potential matching paths or subdirectories/files based on a query string.
 * Excludes PDF files from the results.
 * @param {string} query - The path query string.
 * @returns {string[]} An array of matching path strings (excluding PDFs).
 */
export function findMatchingPaths(query) {
    if (!query || typeof fileStructure === 'undefined') return [];

    // Use a regex that matches common file extensions (case-insensitive)
    // and only suggest directories or files *without* these extensions in intermediate parts.
    // For the final part, allow matching any type except .pdf.
    const fileExtensionRegex = /\.(png|jpg|jpeg|gif|bmp|svg|pdf)$/i; // Added common image formats for robustness
    const isDirectoryOrImage = (key) => typeof key === 'string' && (!fileExtensionRegex.test(key) || key.toLowerCase().endsWith('.png')); // Allow .png files in suggestions

    const queryParts = parsePath(query);
    if (queryParts.length === 0) {
        // If query is empty (just '/'), list top-level items (excluding PDFs)
        let topLevelKeys = Object.keys(fileStructure)
                            .filter(isDirectoryOrImage)
                            .sort();
        // Return as full paths (e.g., "data/")
        return topLevelKeys.map(key => key + (typeof fileStructure[key] === 'object' ? '/' : ''));
    }

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

            // Check if the current part is an exact match (directory or file)
            if (currentLevelObj.hasOwnProperty(part)) {
                 // If it's the last part of the query:
                 if (i === queryParts.length - 1) {
                    const target = currentLevelObj[part];
                     // If the exact match is a directory, list its contents (excluding PDFs)
                    if (typeof target === 'object') {
                        return Object.keys(target)
                               .filter(isDirectoryOrImage) // Filter contents
                               .sort()
                               .map(key => [...currentPathParts, part, key].join('/'));
                    } else if (part.toLowerCase().endsWith('.png')) {
                        // If the exact match is a PNG file, suggest just the file itself?
                        // Or should it be the parent directory's contents? Let's stick to parent contents.
                        // If user typed the full PNG name, maybe suggesting just the name itself is useful.
                        // Let's return just the matched PNG file name.
                         return [[...currentPathParts, part].join('/')]; // Return the exact matched PNG path
                    } else {
                         // Exact match is a non-PNG file (like PDF) - no further suggestions
                         return [];
                    }
                 } else {
                    // Not the last part, must be a directory to continue traversal
                    if (typeof currentLevelObj[part] === 'object') {
                        currentLevelObj = currentLevelObj[part];
                        currentPathParts.push(part);
                    } else {
                        // Intermediate part is not a directory
                        found = false;
                        break;
                    }
                 }
            } else {
                // No exact match for the current part. Look for partial matches *only if it's the last part*.
                if (i === queryParts.length - 1) {
                    const partialMatchKeys = Object.keys(currentLevelObj)
                        .filter(key => key.startsWith(part) && isDirectoryOrImage(key)); // Filter partial matches (no PDFs)

                    if (partialMatchKeys.length > 0) {
                        // Return full paths for partial matches, ensuring trailing slash for dirs
                        return partialMatchKeys
                               .sort()
                               .map(key => [...currentPathParts, key].join('/') + (typeof currentLevelObj[key] === 'object' ? '/' : ''));
                    }
                }
                // No exact match or partial match found for this part
                found = false;
                break;
            }
        }
    } catch (error) {
        console.error("[findMatchingPaths] Error during traversal:", error);
        return [];
    }

    // If we reached here and `found` is true, it means the query path *exactly* matched a directory,
    // and the loop didn't return (which happens when the last part is an exact match).
    // This case should actually be handled by the `if (i === queryParts.length - 1)` block inside the loop.
    // If the loop finishes, it means the path was traversed successfully *but wasn't the last part*.
    // This might happen if the input ends with '/', e.g., "data/f1/".
    // In this case, list the contents of the final directory.
     if (found && currentLevelObj && typeof currentLevelObj === 'object') {
          return Object.keys(currentLevelObj)
              .filter(isDirectoryOrImage) // Filter contents
              .sort()
              .map(key => [...currentPathParts, key].join('/') + (typeof currentLevelObj[key] === 'object' ? '/' : ''));
     }


    // If path was not found or leads to a non-directory intermediate
    return [];
}
