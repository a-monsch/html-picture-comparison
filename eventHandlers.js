import { fileStructure } from './fileStructure.js';
import { columnsState, getColumnState, getColumnElement, updateColumnOrderState, updatePermalink, addColumnToState, removeColumnFromState } from './state.js'; // Keep columnsState
import {
    updateDropdownsUI, hideSearchPreview, updateSearchResultsPreview,
    setDraggingStyle, clearDragOverStyles, setDragOverStyle, getDragAfterElement,
    syncDropdownContainerHeights, updateImageUI // Keep updateImageUI import (needed elsewhere)
} from './domUtils.js';
import { findMatchingPaths, recalculateCombinedImageList, navigateGlobalImageIndex } from './logic.js'; // Removed syncDropdowns
import { debounce, parsePath, getNested, isValidPath } from './helpers.js';

let draggedColumnElement = null;
/**
 * Updates the state and UI based on the current value of the path input.
 * This is called directly on input changes and when finalizing (blur/escape/selection).
 * Does NOT trigger the search preview itself.
 * @param {string} columnId
 * @param {string} currentPathValue
 */
function finalizePathInputState(columnId, currentPathValue) {
    const state = getColumnState(columnId);
    if (!state) return;

    console.log(`[finalizePathInputState ${columnId}] Updating state for path: "${currentPathValue}"`);
    state.path = currentPathValue;
    const oldPathParts = parsePath(state.path || ''); // Old path in state *before* update
    const newPathParts = parsePath(currentPathValue || ''); // New path from input

    state.dropdownSelections = []; // Always reset dropdowns on path input change/finalization
    state.syncDisabled = {};     // Reset sync flags
    state.currentIndex = -1;     // Reset image index initially; selectSearchResult will set it for files

    if (typeof updateDropdownsUI === 'function') {
        updateDropdownsUI(columnId); // Update dropdowns based on new path
    } else {
        console.error("finalizePathInputState: updateDropdownsUI function is not available.");
    }

    if (typeof recalculateCombinedImageList === 'function') {
        recalculateCombinedImageList(); // Update global image list
    } else {
        console.error("finalizePathInputState: recalculateCombinedImageList function is not available.");
    }

    updatePermalink(); // Save the state

}


/**
 * Central handler for selecting a search result via click or Enter.
 * Updates the input, state, UI. If a directory is selected, triggers the next search.
 * If a PNG file is selected, sets path to parent dir and selects the image.
 * If a PDF file is selected, sets path to parent dir.
 * @param {string} columnId - The ID of the column.
 * @param {string} selectedPath - The full path string that was selected.
 */
function selectSearchResult(columnId, selectedPath) {
    const col = getColumnElement(columnId);
    let state = getColumnState(columnId); // Use let as state might be re-fetched
    if (!col || !state) return;

    const input = col.querySelector('.pathInput');
    if (!input) return;

    console.log(`[selectSearchResult ${columnId}] Selected: "${selectedPath}"`);

    // --- Check if a file was selected ---
    const isPngFile = /\.png$/i.test(selectedPath);
    const isPdfFile = /\.pdf$/i.test(selectedPath);
    const isFile = isPngFile || isPdfFile;

    if (isFile) {
        console.log(`[selectSearchResult ${columnId}] Detected file selection.`);
        // Extract parent directory and filename
        const parts = selectedPath.split('/');
        const selectedFilename = parts.pop(); // Get filename
        const parentDir = parts.join('/') + (parts.length > 0 ? '/' : ''); // Add trailing slash if not root

        console.log(`[selectSearchResult ${columnId}] Setting path to parent directory: "${parentDir}"`);

        // 1. Hide the search preview FIRST
        hideSearchPreview(columnId);

        // 2. Update the input field value (do this *before* finalizing state)
        input.value = parentDir;

        // 3. Update state/UI for the parent directory
        // This will reset dropdowns, currentIndex to -1, and populate currentImageFiles for the parent dir.
        finalizePathInputState(columnId, parentDir);

        // 4. Now, if it was a PNG, try to select it in the updated state
        if (isPngFile) {
            // state was just updated by finalizePathInputState, so currentImageFiles should be accurate
            state = getColumnState(columnId); // Re-fetch state to be safe
            if (!state) { console.error(`[selectSearchResult ${columnId}] State missing after finalize!`); return; }

            const imageFiles = state.currentImageFiles || [];
            const newIndex = imageFiles.indexOf(selectedFilename);
            console.log(`[selectSearchResult ${columnId}] Trying to select "${selectedFilename}". Found at index: ${newIndex} in list of ${imageFiles.length} images.`);

            if (newIndex > -1) {
                state.currentIndex = newIndex;
                // Only need to update the image display for this column and the permalink
                if (typeof updateImageUI === 'function') {
                    updateImageUI(columnId);
                } else {
                     console.error("selectSearchResult: updateImageUI function is not available.");
                }
                updatePermalink();
            } else {
                 console.warn(`[selectSearchResult ${columnId}] Could not find selected PNG "${selectedFilename}" in updated image list for "${parentDir}". Index set to -1.`);
            }
        }
        return;
    }

    // --- Handle directory selection (original logic) ---
    console.log(`[selectSearchResult ${columnId}] Detected directory selection.`);
    let finalPath = selectedPath;
    // Ensure trailing slash for directories before finalizing/searching
    if (!finalPath.endsWith('/')) {
        finalPath += '/';
    }
    console.log(`[selectSearchResult ${columnId}] Final directory path: "${finalPath}"`);

    // 1. Hide the search preview FIRST
    hideSearchPreview(columnId);

    // 2. Update the input field value
    input.value = finalPath;

    // 3. Update the column's state & UI using the finalization function
    // This resets dropdowns, index, etc., and builds new dropdowns.
    finalizePathInputState(columnId, finalPath);

    // 4. Trigger a new debounced search based on the final path (directory)
    if (typeof currentDebouncedSearch === 'function') {
        console.log(`[selectSearchResult ${columnId}] Triggering next search for directory: "${finalPath}"`);
        currentDebouncedSearch(columnId, finalPath);
    } else {
         console.error("selectSearchResult: Debounced search function is not available to trigger next suggestions.");
    }
}

// Define the debounced function structure once
const createDebouncedSearch = () => debounce((columnId, query) => {
    console.log(`[Debounced Search ${columnId}] Query: "${query}"`);
    if (!query) { // If query is empty, maybe hide preview?
        hideSearchPreview(columnId);
        return;
    }
     if (typeof findMatchingPaths !== 'function') { console.error("findMatchingPaths function is not available."); return; }
     const results = findMatchingPaths(query);
     console.log(`[Debounced Search ${columnId}] Found ${results.length} results.`);
     if (typeof updateSearchResultsPreview !== 'function') { console.error("updateSearchResultsPreview function is not available."); return; }
     // Pass the selectSearchResult helper as the callback
     updateSearchResultsPreview(columnId, results.slice(0, 10), (selectedPath) => {
         selectSearchResult(columnId, selectedPath);
     });
}, 300);

let currentDebouncedSearch = createDebouncedSearch();

export function handleTitleChange(event) {
    const col = event.target.closest('.column'); const id = col?.dataset.id; const state = getColumnState(id);
    if (state) { state.title = event.target.value; updatePermalink(); }
}
/**
 * Handles input events on the path input field.
 * Triggers debounced search AND updates state/UI immediately.
 */
export function handlePathInputChange(event) {
    const pathInput = event.target;
    const col = pathInput.closest('.column');
    const id = col?.dataset.id;
    if (!id) return;

    const newValue = pathInput.value;
    console.log(`[handlePathInputChange ${id}] Value: "${newValue}"`);

    finalizePathInputState(id, newValue);

    if (typeof currentDebouncedSearch === 'function') {
        currentDebouncedSearch(id, newValue);
    }
}

/**
 * Handles blur events on the path input field.
 * Hides the search preview if focus moves outside.
 * Finalizes state if focus leaves the input and is not on the preview.
 */
export function handlePathInputBlur(event) {
    const pathInput = event.target;
    const col = pathInput.closest('.column');
    const id = col?.dataset.id;
    if (!id) return;

    // Use setTimeout to allow clicks on the preview to register first
    setTimeout(() => {
        const preview = col?.querySelector('.searchResultsPreview');
        // Check if the newly focused element is *within* the search preview
        const relatedTargetIsPreviewItem = preview && preview.contains(document.activeElement);
        const isInputFocused = document.activeElement === pathInput;

        // Hide if the preview exists, focus is not on the input, and focus is not on a preview item
        if (preview && !isInputFocused && !relatedTargetIsPreviewItem) {
            console.log(`[handlePathInputBlur ${id}] Hiding preview and finalizing state.`);
            hideSearchPreview(id);
             finalizePathInputState(id, pathInput.value);
        } else if (preview && isInputFocused) {
        } else if (preview && relatedTargetIsPreviewItem) {
        } else {
            // If there was no preview, or focus just moved away normally, finalize state
             console.log(`[handlePathInputBlur ${id}] Focus left input, finalizing state.`);
             finalizePathInputState(id, pathInput.value);
        }

    }, 150);
}

/**
 * Handles keydown events on the path input field for search preview navigation and escape behavior.
 */
export function handlePathInputKeyDown(event) {
    const pathInput = event.target;
    const col = pathInput.closest('.column');
    const columnId = col?.dataset.id;
    if (!columnId) return;

    const previewContainer = col.querySelector('.searchResultsPreview');
    const isPreviewVisible = previewContainer && previewContainer.style.display !== 'none';

    if (event.key === 'Escape') {
        event.preventDefault(); // Prevent other browser actions
        if (isPreviewVisible) {
            // First Escape: Hide preview
            console.log(`[handlePathInputKeyDown ${columnId}] Escape (1st): Hiding preview.`);
            hideSearchPreview(columnId);
        } else {
            // Second Escape (Preview not visible, but input is focused): Blur the input
            console.log(`[handlePathInputKeyDown ${columnId}] Escape (2nd): Blurring input.`);
            pathInput.blur(); // This removes focus, allowing global keys. Blur handler will finalize state.
        }
        return; // Stop further processing for Escape
    }

    if (!isPreviewVisible) {
        return;
    }

    const resultsItems = previewContainer.querySelectorAll('div[data-index]');
    if (resultsItems.length === 0) return; // No items to navigate

    let currentIndex = parseInt(previewContainer.dataset.selectedIndex || '-1', 10);
    let nextIndex = currentIndex;

    const updateHighlight = (indexToHighlight) => {
        resultsItems.forEach((item, idx) => {
            item.classList.toggle('highlighted', idx === indexToHighlight);
        });
         if (indexToHighlight >= 0 && indexToHighlight < resultsItems.length) {
             resultsItems[indexToHighlight].scrollIntoView({ block: 'nearest', inline: 'nearest' });
         }
        previewContainer.dataset.selectedIndex = indexToHighlight;
    };

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault(); // Prevent cursor move in input
            nextIndex = currentIndex >= resultsItems.length - 1 ? 0 : currentIndex + 1;
            updateHighlight(nextIndex);
            break;

        case 'ArrowUp':
            event.preventDefault(); // Prevent cursor move in input
            nextIndex = currentIndex <= 0 ? resultsItems.length - 1 : currentIndex - 1;
            updateHighlight(nextIndex);
            break;

        case 'Enter':
            event.preventDefault(); // Prevent potential form submission/input newline
            if (currentIndex >= 0 && currentIndex < resultsItems.length) {
                // Item is highlighted - select it
                const selectedItem = resultsItems[currentIndex];
                const selectedPath = selectedItem.textContent;
                selectSearchResult(columnId, selectedPath); // Use the central selection handler
            } else {
                // No item highlighted - treat Enter as finalization of current text
                console.log(`[handlePathInputKeyDown ${columnId}] Enter pressed without selection, finalizing state.`);
                hideSearchPreview(columnId); // Hide preview just in case
                finalizePathInputState(columnId, pathInput.value);
            }
            break; // Exit switch after handling Enter

        default:
            break; // Allow other keys (like typing) to pass through
    }
}

export function handleDropdownChange(event) {
    const select = event.target;
    if (select.tagName !== 'SELECT') return;

    const col = select.closest('.column');
    const currentColumnId = col?.dataset.id;
    const state = getColumnState(currentColumnId);
    const index = parseInt(select.dataset.levelIndex);
    const value = select.value;

    if (!state || !currentColumnId || isNaN(index)) return;

    // --- Guard against programmatic sync loops ---
    if (event.isProgrammaticSync) {
        const oldSelections = [...state.dropdownSelections]; // Use current selections of the target
        const pathInput = col.querySelector('.pathInput');
        const basePathString = pathInput?.value || '';
        let finalSelections = [];
        let preserveSubsequent = false;

        if (value) { // Value here is the one received from the sync source
            let potentialNewSelections = oldSelections.slice(0, index);
            potentialNewSelections[index] = value;
            if (oldSelections.length > index + 1) {
                 potentialNewSelections = potentialNewSelections.concat(oldSelections.slice(index + 1));
            }
            if (isValidPath(basePathString, potentialNewSelections)) {
                preserveSubsequent = true;
                finalSelections = potentialNewSelections;
            }
        }

        if (!preserveSubsequent) {
            finalSelections = oldSelections.slice(0, index);
            if (value) {
                finalSelections[index] = value;
            }
        }

        state.dropdownSelections = finalSelections;
        state.currentIndex = -1; // Reset image index

        // Reset sync flags ONLY if subsequent selections were NOT preserved
        if (!preserveSubsequent) {
            if (state.syncDisabled) {
                Object.keys(state.syncDisabled).forEach(key => {
                    const keyIndex = parseInt(key);
                    if (!isNaN(keyIndex) && keyIndex > index) {
                        delete state.syncDisabled[key];
                    }
                });
            }
        }

        if (typeof updateDropdownsUI === 'function') {
             updateDropdownsUI(currentColumnId);
        } else {
            console.error("[handleDropdownChange] updateDropdownsUI function is not available.");
        }

        // DO NOT trigger recalculate/permalink here; let the original event handler do it once.
        return;
    }

    // --- Regular User Event Processing ---

    // --- 1. Update State for the Source Column ---
    const oldSelections = [...state.dropdownSelections];
    const pathInput = col.querySelector('.pathInput');
    const basePathString = pathInput?.value || '';
    let finalSelections = [];
    let preserveSubsequent = false;

    if (value) {
        let potentialNewSelections = oldSelections.slice(0, index);
        potentialNewSelections[index] = value;
        if (oldSelections.length > index + 1) {
             potentialNewSelections = potentialNewSelections.concat(oldSelections.slice(index + 1));
        }
        if (isValidPath(basePathString, potentialNewSelections)) {
            preserveSubsequent = true;
            finalSelections = potentialNewSelections;
        }
    }

    if (!preserveSubsequent) {
        finalSelections = oldSelections.slice(0, index);
        if (value) {
            finalSelections[index] = value;
        }
    }

    state.dropdownSelections = finalSelections;
    state.currentIndex = -1;

    if (!preserveSubsequent) {
        if (state.syncDisabled) {
            Object.keys(state.syncDisabled).forEach(key => {
                const keyIndex = parseInt(key);
                if (!isNaN(keyIndex) && keyIndex > index) {
                    delete state.syncDisabled[key];
                }
            });
        }
    }

    // --- 2. Trigger Synchronization in OTHER columns (if user event) ---
    console.log(`[handleDropdownChange ${currentColumnId}] Initiating sync check for level ${index} value "${value}"`);
    columnsState.forEach(targetState => {
        if (targetState.id === currentColumnId) return; // Skip self

        const isSyncEnabled = !(targetState.syncDisabled?.[index] ?? false);
        if (isSyncEnabled) {
            const targetElement = getColumnElement(targetState.id);
            if (!targetElement) return;
            const targetSelect = targetElement.querySelector(`select[data-level-index="${index}"]`);

            if (targetSelect) {
                const optionExists = targetSelect.querySelector(`option[value="${value}"]`);
                const valueChanged = targetSelect.value !== value;

                if (optionExists && valueChanged) {
                     console.log(`[handleDropdownChange ${currentColumnId}] --> Syncing Column ${targetState.id} @ level ${index} to "${value}"`);
                    targetSelect.value = value;
                    const syncEvent = new Event('change', { bubbles: true });
                    syncEvent.isProgrammaticSync = true;
                    targetSelect.dispatchEvent(syncEvent);
                }
            }
        }
    });

    // --- 3. Update Source Column Dropdown UI ---
    if (typeof updateDropdownsUI === 'function') {
        updateDropdownsUI(currentColumnId);
    } else {
        console.error("[handleDropdownChange] updateDropdownsUI function is not available.");
    }

    // --- 4. Recalculate Global Image List & Update ALL Image Displays ---
    if (typeof recalculateCombinedImageList === 'function') {
         console.log(`[handleDropdownChange ${currentColumnId}] Triggering global recalculation.`);
         recalculateCombinedImageList();
    } else {
        console.error("[handleDropdownChange] recalculateCombinedImageList function not available.");
    }

    updatePermalink();
}

export function handleSyncCheckboxChange(event) {
    if (event.target.tagName !== 'INPUT' || !event.target.classList.contains('syncCheckbox')) return;
    const cb = event.target; const col = cb.closest('.column'); const id = col?.dataset.id; const state = getColumnState(id);
    const index = parseInt(cb.dataset.levelIndex);
    if (state && !isNaN(index)) { if (!state.syncDisabled) state.syncDisabled = {}; state.syncDisabled[index] = !cb.checked; updatePermalink(); }
}

export function handleDeleteColumnClick(event) {
   const col = event.target.closest('.column'); const id = col?.dataset.id;
   if (id) {
       if (confirm('Are you sure you want to delete this column?')) {
           col.remove();
           removeColumnFromState(id);
           if (typeof syncDropdownContainerHeights === 'function') { syncDropdownContainerHeights(); }
           // Recalculate master list after deleting
           if (typeof recalculateCombinedImageList === 'function') { recalculateCombinedImageList(); }
           else { console.error("recalculateCombinedImageList function not available."); }
           updatePermalink();
       }
   }
}

export function handleGlobalKeyDown(event) {
    const activeElement = document.activeElement;
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT') return;

    let navigated = false;
    // Use the NEW navigation function
    if (typeof navigateGlobalImageIndex !== 'function') { console.error("navigateGlobalImageIndex function is not available."); return; }

    if (event.key === 'ArrowLeft') { event.preventDefault(); navigateGlobalImageIndex(-1); navigated = true; }
    else if (event.key === 'ArrowRight') { event.preventDefault(); navigateGlobalImageIndex(1); navigated = true; }
    if (navigated) { if (typeof updatePermalink === 'function') { updatePermalink(); } }
}

// Drag/Drop Handlers
export function handleDragStart(event) { const col = event.target.closest('.column'); if(col && event.target === col){ draggedColumnElement=col; event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/plain', col.dataset.id); setTimeout(() => { if(typeof setDraggingStyle === 'function') setDraggingStyle(col, true); }, 0); } else { event.preventDefault(); } }
export function handleDragOver(event) { event.preventDefault(); const container=event.currentTarget; if(!draggedColumnElement) return; event.dataTransfer.dropEffect = 'move'; if(typeof clearDragOverStyles === 'function') clearDragOverStyles(container); const after = (typeof getDragAfterElement === 'function') ? getDragAfterElement(container, event.clientX) : null; if(after && after !== draggedColumnElement && typeof setDragOverStyle === 'function') setDragOverStyle(after); }
export function handleDrop(event) { event.preventDefault(); const container=event.currentTarget; if(typeof clearDragOverStyles === 'function') clearDragOverStyles(container); if(draggedColumnElement){ const after = (typeof getDragAfterElement === 'function') ? getDragAfterElement(container, event.clientX) : null; if(after===null) container.appendChild(draggedColumnElement); else container.insertBefore(draggedColumnElement, after); if(typeof updateColumnOrderState === 'function') updateColumnOrderState(); updatePermalink(); } }
export function handleDragEnd(event) { if(draggedColumnElement && typeof setDraggingStyle === 'function') setDraggingStyle(draggedColumnElement, false); const container = document.getElementById('columnsContainer'); if(container && typeof clearDragOverStyles === 'function') clearDragOverStyles(container); draggedColumnElement = null; }
