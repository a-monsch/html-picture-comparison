import { fileStructure } from './fileStructure.js';
// Ensure ALL necessary state functions are imported
import {
    columnsState, setColumnsContainerRef, addColumnToState,
    loadStateFromPermalink, updatePermalink, generateId, setNextColumnId,
    getColumnState, removeColumnFromState, updateColumnOrderState // Added updateColumnOrderState just in case
} from './state.js';
// Ensure ALL necessary domUtils functions are imported
import {
    createColumnElement, updateDropdownsUI, hideSearchPreview, updateImageUI,
    updateSearchResultsPreview, setDraggingStyle, clearDragOverStyles,
    setDragOverStyle, getDragAfterElement,
    syncDropdownContainerHeights // <<< Import dropdown sync function
} from './domUtils.js';
// Ensure ALL necessary logic functions are imported, INCLUDING global nav
import {
    applyDarkMode, invertImageDisplay, syncDropdowns, findMatchingPaths,
    recalculateCombinedImageList, navigateGlobalImageIndex, // <<< NEW global nav functions
    getCombinedImageList, getGlobalImageIndex // <<< Keep Getters needed by domUtils
} from './logic.js';
// Import all handlers
import * as handlers from './eventHandlers.js';
// Import debounce from helpers
import { debounce } from './helpers.js';


// --- Global References ---
const columnsContainer = document.getElementById('columnsContainer');
const addColumnBtn = document.getElementById('addColumnBtn');
const permalinkBtn = document.getElementById('permalinkBtn');
const darkModeToggle = document.getElementById('darkModeToggle');

// Not changed: debouncedSyncLayout
const debouncedSyncLayout = (typeof debounce === 'function' && typeof syncDropdownContainerHeights === 'function')
    ? debounce(syncDropdownContainerHeights, 250) // Sync dropdowns on resize
    : () => { console.warn("Debounce or syncDropdownContainerHeights not available for resize."); };


/**
 * Creates a new column instance: state object, DOM element, listeners, initial UI update.
 * @param {object} initialState - Optional initial state for the column.
 * @returns {HTMLElement|null} The created column element or null on failure.
 */
function createColumnInstance(initialState = {}) {
    // Purpose: Create state, create DOM element, append, attach listeners, run initial UI update
    if (typeof generateId !== 'function' || typeof addColumnToState !== 'function' || typeof createColumnElement !== 'function') { console.error("Essential functions not loaded!"); return null; }
    const newId = generateId();
    const newState = {
        id: newId,
        title: initialState.title || '',
        path: initialState.path || 'data/',
        dropdownSelections: initialState.dropdownSelections || [],
        syncDisabled: (typeof initialState.syncDisabled === 'object' && initialState.syncDisabled !== null) ? initialState.syncDisabled : {},
        currentIndex: initialState.currentIndex ?? -1, // Default to -1 (no image selected initially)
        currentImageFiles: [],
    };
    addColumnToState(newState);
    const columnFragment = createColumnElement(newState, newId); if (!columnFragment) { return null; }
    if (!columnsContainer) { return null; } columnsContainer.appendChild(columnFragment); const columnElement = columnsContainer.querySelector(`.column[data-id="${newId}"]`); if (!columnElement) { return null; }

    try { // Attach listeners
        if (typeof handlers !== 'object' || handlers === null) throw new Error("handlers object not loaded");

        const titleInput = columnElement.querySelector('.columnTitle');
        if (titleInput && handlers.handleTitleChange) {
            titleInput.addEventListener('input', handlers.handleTitleChange);
        }

        const pathInput = columnElement.querySelector('.pathInput');
        if (pathInput && handlers.handlePathInputChange && handlers.handlePathInputBlur && handlers.handlePathInputKeyDown) { // <<< Added KeyDown Handler
            pathInput.addEventListener('input', handlers.handlePathInputChange);
            pathInput.addEventListener('blur', handlers.handlePathInputBlur);
            pathInput.addEventListener('keydown', handlers.handlePathInputKeyDown); // <<< Attach KeyDown Listener
        }

        const dropdownContainer = columnElement.querySelector('.dropdownContainer');
        if (dropdownContainer && handlers.handleDropdownChange && handlers.handleSyncCheckboxChange) {
            dropdownContainer.addEventListener('change', (event) => {
                if (event.target.tagName === 'SELECT') handlers.handleDropdownChange(event);
                else if (event.target.tagName === 'INPUT' && event.target.classList.contains('syncCheckbox')) handlers.handleSyncCheckboxChange(event);
            });
        }

        const deleteBtn = columnElement.querySelector('.deleteColumnBtn');
        if (deleteBtn && handlers.handleDeleteColumnClick) {
            deleteBtn.addEventListener('click', handlers.handleDeleteColumnClick);
        }

        if (handlers.handleDragStart) columnElement.addEventListener('dragstart', handlers.handleDragStart);
        if (handlers.handleDragEnd) columnElement.addEventListener('dragend', handlers.handleDragEnd);

    } catch (e) { console.error(`Error attaching listeners for column ${newId}:`, e); return null; }

    try { // Initial UI Update
        if (typeof updateDropdownsUI !== 'function') throw new Error("updateDropdownsUI function not available.");
        updateDropdownsUI(newId); // Calls syncDropdownContainerHeights and updateImageUI inside
    } catch (error) { console.error(`Error during initial updateDropdownsUI for column ${newId}:`, error); try { if (columnElement) columnElement.remove(); if (typeof removeColumnFromState === 'function') removeColumnFromState(newId); } catch (e) {} return null; }

    if (darkModeToggle?.checked) { // Apply Dark Mode if needed now
        const imgElement = columnElement.querySelector('.displayImage'); if (imgElement && typeof invertImageDisplay === 'function') { invertImageDisplay(imgElement, true); }
    }

    // NO recalculate/sync calls here - do it after creation loop/event
    return columnElement;
}

function addInitialColumn() {
    // Purpose: Call createColumnInstance if no columns exist.
    if (Array.isArray(columnsState) && columnsState.length === 0) {
         console.log("[addInitialColumn] Adding default column.");
        if (typeof createColumnInstance === 'function') {
            return createColumnInstance({ path: 'data/' }); // Return the created element/null
         } else { console.error("[addInitialColumn] createColumnInstance function is not available!"); return null; }
    } else if (!Array.isArray(columnsState)) { console.error("[addInitialColumn] columnsState is not an array or undefined."); return null; }
    return null; // Indicate no column was added
}

function initializeApp() {
     console.log("[initializeApp] Starting initialization...");
    if (typeof fileStructure === 'undefined' || Object.keys(fileStructure).length === 0) { alert("Error: fileStructure.js not loaded."); return; }
    if (!columnsContainer) { console.error("CRITICAL: #columnsContainer not found!"); return; }
    if (typeof setColumnsContainerRef !== 'function') { console.error("CRITICAL: setColumnsContainerRef function not available!"); return; }
    setColumnsContainerRef(columnsContainer);
     console.log("[initializeApp] Base setup complete.");

    // --- Check for essential functions used later ---
    const canCreateColumns = typeof createColumnInstance === 'function';
    const canSetId = typeof setNextColumnId === 'function';
    const canApplyDark = typeof applyDarkMode === 'function';
    const canAddInitial = typeof addInitialColumn === 'function';
    const canSyncDropdowns = typeof syncDropdownContainerHeights === 'function';
    const canHidePreview = typeof hideSearchPreview === 'function';
    const canRecalculate = typeof recalculateCombinedImageList === 'function'; // Check recalculate function
    // ------------------------------------------------------------------

    // --- Attach Global Event Listeners ---
    // Add Column Listener (Calls recalculate)
    if (addColumnBtn && canCreateColumns && typeof updatePermalink === 'function' && canRecalculate) {
        addColumnBtn.addEventListener('click', () => {
            console.log("[Add Column Button] Clicked.");
            const newCol = createColumnInstance({ path: 'data/' }); // Create instance
            if (newCol) {
                recalculateCombinedImageList(); // Recalculate master list and update displays
                // syncDropdownContainerHeights(); // Called by updateDropdownsUI inside createColumnInstance
                updatePermalink();
                console.log("[Add Column Button] Column added and list recalculated.");
            } else {
                console.error("[Add Column Button] Failed to create column instance.");
            }
        });
         console.log("[initializeApp] Add column listener attached.");
    } else { console.warn("[initializeApp] Add column button/functions not fully available."); }

    // Other listeners (Permalink, Dark Mode, Keydown, Drag/Drop, Global Click)
    if (permalinkBtn && typeof updatePermalink === 'function') { permalinkBtn.addEventListener('click', () => { updatePermalink(); navigator.clipboard.writeText(window.location.href).then(() => { alert('Permalink URL copied!'); }).catch(err => { alert('Permalink updated. Could not copy.'); console.error('Copy failed: ', err); }); }); } else console.warn("[initializeApp] Permalink button/functions not fully available.");
    if (darkModeToggle && canApplyDark && typeof updatePermalink === 'function') { darkModeToggle.addEventListener('change', (e) => { applyDarkMode(e.target.checked); updatePermalink(); }); } else console.warn("[initializeApp] Dark mode toggle/functions not fully available.");
    if (typeof handlers === 'object' && handlers !== null) {
         if (handlers.handleGlobalKeyDown) document.addEventListener('keydown', handlers.handleGlobalKeyDown); else console.warn("[initializeApp] handleGlobalKeyDown handler not available.");
         if (handlers.handleDragOver && columnsContainer) columnsContainer.addEventListener('dragover', handlers.handleDragOver); else console.warn("[initializeApp] handleDragOver handler not available.");
         if (handlers.handleDrop && columnsContainer) columnsContainer.addEventListener('drop', handlers.handleDrop); else console.warn("[initializeApp] handleDrop handler not available.");
         // Use the checked function variable
         if (canHidePreview) { document.addEventListener('click', (event) => { if (!event.target.closest?.('.searchContainer')) { columnsState?.forEach(cs => hideSearchPreview(cs.id)); } }); }
         else console.warn("[initializeApp] hideSearchPreview function not available for global click listener.");
    } else { console.error("[initializeApp] Event handlers module not loaded correctly."); }
    window.addEventListener('resize', debouncedSyncLayout); // Add resize listener
    console.log("[initializeApp] Global listeners attached.");


    // --- Load State ---
     console.log("[initializeApp] Loading state from permalink...");
     let loadedState = null;
     if (typeof loadStateFromPermalink === 'function') { loadedState = loadStateFromPermalink(); }
     else { console.error("[initializeApp] loadStateFromPermalink function not available!"); }

    // Now the 'can...' variables are defined before this block
    if (loadedState && canSetId && canCreateColumns) { // <<< USAGE HERE IS NOW SAFE
         console.log("[initializeApp] Permalink state found:", loadedState);
        setNextColumnId(loadedState.nextId || 0);
        if (loadedState.columns && Array.isArray(loadedState.columns)) {
             console.log(`[initializeApp] Recreating ${loadedState.columns.length} columns from state...`);
            loadedState.columns.forEach((colState, index) => { createColumnInstance(colState); }); // Create all columns first
             // Recalculate ONCE after all columns created
             if (canRecalculate) {
                 console.log("[initializeApp] Recalculating list after loading state.");
                 recalculateCombinedImageList(); // Recalculates list and calls updateAllColumnsDisplay
             } else { console.error("recalculateCombinedImageList function not available."); }
             // Sync dropdowns if needed (updateDropdownsUI called inside createColumnInstance should handle initial sync)
             // if (canSyncDropdowns) { syncDropdownContainerHeights(); }
        } else {
            console.warn("[initializeApp] Permalink state columns invalid. Loading default.");
            let defaultColAdded = false;
            if (canAddInitial) defaultColAdded = !!addInitialColumn(); else console.error("Cannot add initial column - function missing.");
            // Recalculate after adding default column
             if (canRecalculate) recalculateCombinedImageList();
             // Sync heights if column was added
             if (defaultColAdded && canSyncDropdowns) syncDropdownContainerHeights();
        }
        const isDark = loadedState.darkMode || false; if (darkModeToggle) darkModeToggle.checked = isDark;
         if (canApplyDark) applyDarkMode(isDark); else console.error("[initializeApp] applyDarkMode function not available!");

    } else {
         console.log("[initializeApp] No valid permalink state or essential functions missing. Adding initial column.");
         let initialColAdded = false;
        if (canAddInitial) { initialColAdded = !!addInitialColumn(); } // Create the column instance
        else { console.error("Cannot add initial column - function missing."); }
         // Recalculate AFTER initial column attempt
         if (canRecalculate) { console.log("[initializeApp] Recalculating list after adding initial column."); recalculateCombinedImageList(); }
         else { console.error("recalculateCombinedImageList function not available."); }
         // Sync heights if column was added
         // if (initialColAdded && canSyncDropdowns) { syncDropdownContainerHeights(); } // Called by updateDropdownsUI
         const initialDark = darkModeToggle?.checked ?? false;
          if (canApplyDark) applyDarkMode(initialDark); else console.error("[initializeApp] applyDarkMode function not available!");
    }

     // Final check
    if (Array.isArray(columnsState) && columnsState.length === 0) { console.warn("[initializeApp] No columns present after loading."); }
    else if (!Array.isArray(columnsState)) { console.error("[initializeApp] columnsState is invalid after initialization."); }
     console.log(`[initializeApp] Initialization finished. ${columnsState?.length ?? 0} columns active.`);
}

// --- Run Initialization ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeApp); }
else { initializeApp(); }
