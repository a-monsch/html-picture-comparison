import { fileStructure } from './fileStructure.js';
// Import state functions used in this module
import { getColumnState, getColumnElement, updateColumnOrderState, updatePermalink, addColumnToState, removeColumnFromState } from './state.js';
// Import ALL domUtils functions used in this module
import {
    updateDropdownsUI, hideSearchPreview, updateSearchResultsPreview,
    setDraggingStyle, clearDragOverStyles, setDragOverStyle, getDragAfterElement,
    syncDropdownContainerHeights, updateImageUI // Added updateImageUI just in case
} from './domUtils.js';
// Import NEW logic functions
import { syncDropdowns, findMatchingPaths, recalculateCombinedImageList, navigateGlobalImageIndex } from './logic.js';
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
    if (event.target.tagName !== 'SELECT') return;
    const select = event.target; const col = select.closest('.column'); const id = col?.dataset.id; const state = getColumnState(id);
    const index = parseInt(select.dataset.levelIndex); const value = select.value; // The newly selected value at this index

    if (state && id && !isNaN(index)) {
        const oldSelections = [...state.dropdownSelections];
        // --- Store old sync state BEFORE potentially modifying it ---
        const oldSyncDisabled = state.syncDisabled ? { ...state.syncDisabled } : {}; // Shallow copy is sufficient

        const pathInput = col.querySelector('.pathInput');
        const basePathString = pathInput?.value || '';
        let finalSelections = [];

        // --- Check if subsequent selections can be preserved ---
        let preserveSubsequent = false;
        if (value) {
            let potentialNewSelections = oldSelections.slice(0, index);
            potentialNewSelections[index] = value;
            if (oldSelections.length > index + 1) {
                 potentialNewSelections = potentialNewSelections.concat(oldSelections.slice(index + 1));
            }
             // console.log(`[handleDropdownChange ${id}] Checking potential path:`, basePathString, potentialNewSelections);
            if (isValidPath(basePathString, potentialNewSelections)) {
                preserveSubsequent = true;
                finalSelections = potentialNewSelections;
                 // console.log(`[handleDropdownChange ${id}] Path valid. Preserving subsequent selections.`);
            } else {
                 // console.log(`[handleDropdownChange ${id}] Path invalid. Resetting subsequent selections.`);
            }
        } else {
             // console.log(`[handleDropdownChange ${id}] Empty selection. Resetting subsequent selections.`);
        }

        // --- Apply Reset Logic if Preservation Failed ---
        if (!preserveSubsequent) {
            finalSelections = oldSelections.slice(0, index);
            if (value) {
                finalSelections[index] = value;
            }
        }

        // --- Update State Selections ---
        state.dropdownSelections = finalSelections;
        state.currentIndex = -1; // Reset image index

        // --- Conditionally Reset Sync Disabled Flags ---
        // *Only* reset sync flags for subsequent levels if we are *NOT* preserving them.
        if (!preserveSubsequent) {
            // console.log(`[handleDropdownChange ${id}] Resetting subsequent syncDisabled flags.`);
            if (state.syncDisabled) {
                Object.keys(state.syncDisabled).forEach(key => {
                    const keyIndex = parseInt(key);
                    // Check if the key represents an index *after* the one changed
                    if (!isNaN(keyIndex) && keyIndex > index) {
                        delete state.syncDisabled[key]; // Remove the disabled flag (enables sync)
                    }
                });
            }
        } else {
             // console.log(`[handleDropdownChange ${id}] Preserving subsequent syncDisabled flags.`);
             // If preserving, we don't touch state.syncDisabled here.
             // updateDropdownsUI will read the existing preserved flags.
        }
        // --- End Conditional Reset ---


        // --- Update UI and Sync/Recalculate (remains the same) ---
        if (typeof updateDropdownsUI === 'function') {
             updateDropdownsUI(id); // This will now use the potentially preserved syncDisabled state
        } else {
            console.error("[handleDropdownChange] updateDropdownsUI function is not available.");
        }

        const syncCb = col.querySelector(`.syncCheckbox[data-level-index="${index}"]`);
        if (syncCb && syncCb.checked) {
            if (typeof syncDropdowns === 'function') {
                syncDropdowns(id, index, value);
            } else {
                console.error("[handleDropdownChange] syncDropdowns function not available.");
            }
        }

        if (typeof recalculateCombinedImageList === 'function') {
             recalculateCombinedImageList();
        } else {
            console.error("[handleDropdownChange] recalculateCombinedImageList function not available.");
        }

        updatePermalink();
    }
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
