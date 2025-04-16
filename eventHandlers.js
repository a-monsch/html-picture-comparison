import { fileStructure } from './fileStructure.js';
// Import state functions used in this module
import { columnsState, getColumnState, getColumnElement, updateColumnOrderState, updatePermalink, addColumnToState, removeColumnFromState } from './state.js'; // Keep columnsState
// Import ALL domUtils functions used in this module
import {
    updateDropdownsUI, hideSearchPreview, updateSearchResultsPreview,
    setDraggingStyle, clearDragOverStyles, setDragOverStyle, getDragAfterElement,
    syncDropdownContainerHeights, updateImageUI // Keep updateImageUI import (needed elsewhere)
} from './domUtils.js';
// Import logic functions
import { findMatchingPaths, recalculateCombinedImageList, navigateGlobalImageIndex } from './logic.js'; // Removed syncDropdowns
// Import helper functions used
import { debounce, parsePath, getNested, isValidPath } from './helpers.js';

let draggedColumnElement = null;
const debouncedSearch = debounce((columnId, query) => {
     if (typeof findMatchingPaths !== 'function') { console.error("findMatchingPaths function is not available."); return; }
     const results = findMatchingPaths(query);
     if (typeof updateSearchResultsPreview !== 'function') { console.error("updateSearchResultsPreview function is not available."); return; }
     updateSearchResultsPreview(columnId, results.slice(0, 10), (selectedPath) => {
         const col = getColumnElement(columnId); const state = getColumnState(columnId);
         if (col && state) { const input = col.querySelector('.pathInput'); if (input) { input.value = selectedPath; handlePathInputChange({ target: input }); } }
     });
}, 300);

export function handleTitleChange(event) {
    const col = event.target.closest('.column'); const id = col?.dataset.id; const state = getColumnState(id);
    if (state) { state.title = event.target.value; updatePermalink(); }
}

export function handlePathInputChange(event) {
    const pathInput = event.target; const col = pathInput.closest('.column'); const id = col?.dataset.id; const state = getColumnState(id);
    if (state && id) {
         const newValue = pathInput.value;
         if (typeof debouncedSearch === 'function') { debouncedSearch(id, newValue); }
         state.path = newValue; state.dropdownSelections = []; state.syncDisabled = {}; state.currentIndex = -1; // Reset index
         if (typeof updateDropdownsUI === 'function') { updateDropdownsUI(id); } // Calls syncHeight and updateImageUI
         else { console.error("updateDropdownsUI function is not available."); }
         // Recalculate master list after path change UI update
         if (typeof recalculateCombinedImageList === 'function') { recalculateCombinedImageList(); }
         else { console.error("recalculateCombinedImageList function not available."); }
         updatePermalink();
    }
}

export function handlePathInputBlur(event) {
    const pathInput = event.target; const col = pathInput.closest('.column'); const id = col?.dataset.id;
    setTimeout(() => {
        const preview = col?.querySelector('.searchResultsPreview');
        if (preview && !preview.contains(document.activeElement) && !pathInput.contains(document.activeElement)) {
            if (typeof hideSearchPreview === 'function') { hideSearchPreview(id); }
            else { console.error("hideSearchPreview function is not available."); }
        }
    }, 150);
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
        // console.log(`[handleDropdownChange ${currentColumnId}] Processing programmatic sync for level ${index}`);
        // This block handles updates *within* the column that received the sync event

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

        // Update this (target) column's dropdown structure
        if (typeof updateDropdownsUI === 'function') {
             updateDropdownsUI(currentColumnId);
        } else {
            console.error("[handleDropdownChange] updateDropdownsUI function is not available.");
        }

        // DO NOT trigger recalculate/permalink here; let the original event handler do it once.
        return; // End processing for programmatic event
    }

    // --- Regular User Event Processing ---
    // console.log(`[handleDropdownChange ${currentColumnId}] Processing user change for level ${index} to "${value}"`);

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
    // Needs to happen after sync dispatch, so target event handlers can process based on old source UI if needed
    // Needs to happen before recalculate, so recalculate sees the final UI state (though state matters more)
    if (typeof updateDropdownsUI === 'function') {
        updateDropdownsUI(currentColumnId);
    } else {
        console.error("[handleDropdownChange] updateDropdownsUI function is not available.");
    }

    // --- 4. Recalculate Global Image List & Update ALL Image Displays ---
    // This should run ONCE after all state changes (source + targets) have settled.
    if (typeof recalculateCombinedImageList === 'function') {
         console.log(`[handleDropdownChange ${currentColumnId}] Triggering global recalculation.`);
         recalculateCombinedImageList();
    } else {
        console.error("[handleDropdownChange] recalculateCombinedImageList function not available.");
    }

    // --- 5. Update Permalink ---
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
