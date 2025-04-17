import { fileStructure } from './fileStructure.js';
import { getNested, parsePath, getImageFilesInDir } from './helpers.js';
import { getColumnState, getColumnElement } from './state.js';
// Import logic functions NEEDED by this module
import { invertImageDisplay, getCombinedImageList, getGlobalImageIndex } from './logic.js'; // Keep Getters!

const columnTemplate = document.getElementById('columnTemplate');
if (!columnTemplate) console.error("CRITICAL: Column template #columnTemplate not found!");

// --- Create Column Element ---
export function createColumnElement(initialState, newId) {
     console.log(`[createColumnElement ${newId}] Attempting fragment creation.`);
     if (!columnTemplate) { console.error(`[createColumnElement ${newId}] Template not found.`); return null; }
     let columnClone;
     try { columnClone = columnTemplate.content.cloneNode(true); }
     catch(e) { console.error(`[createColumnElement ${newId}] Error cloning template content:`, e); return null; }

     const columnElement = columnClone.querySelector('.column');
     if (!columnElement) { console.error(`[createColumnElement ${newId}] Could not find '.column' in template fragment.`); return null; }
     columnElement.dataset.id = newId;

     try {
         const titleInput = columnElement.querySelector('.columnTitle');
         if (titleInput) titleInput.value = initialState.title || ''; else console.warn(`[createColumnElement ${newId}] Title input missing in template.`);
         const pathInput = columnElement.querySelector('.pathInput');
         if (pathInput) pathInput.value = initialState.path || ''; else console.warn(`[createColumnElement ${newId}] Path input missing in template.`);
     } catch(e) { console.error(`[createColumnElement ${newId}] Error setting initial values:`, e); }

     console.log(`[createColumnElement ${newId}] Fragment created successfully.`);
     return columnClone;
}

// --- Sync Dropdown Heights ---
export function syncDropdownContainerHeights() {
    const dropdownContainers = document.querySelectorAll('#columnsContainer .dropdownContainer');
    if (dropdownContainers.length <= 1) {
         dropdownContainers.forEach(container => { container.style.height = 'auto'; }); // Reset height for single column
        return;
    }

    let maxHeight = 0;
    // Calculate max scrollHeight
    dropdownContainers.forEach(container => {
        container.style.height = 'auto'; // Reset height to measure content
        // Reading scrollHeight should be sufficient, forcing reflow might not be needed
        maxHeight = Math.max(maxHeight, container.scrollHeight);
    });

    // Read CSS max-height (assuming it's in px)
    let cssMaxHeight = Infinity;
    try {
        const style = window.getComputedStyle(dropdownContainers[0]);
        const maxHeightValue = style.maxHeight;
        if (maxHeightValue && maxHeightValue !== 'none' && maxHeightValue.endsWith('px')) {
            cssMaxHeight = parseFloat(maxHeightValue) || Infinity;
        }
    } catch (e) { console.warn("Could not read CSS max-height for dropdown container.", e); }

    // Target height is the smaller of the content height and the CSS max-height
    const targetHeight = Math.min(maxHeight, cssMaxHeight);
    console.log(`[syncDropdownContainerHeights] Max scrollHeight: ${maxHeight}, CSS max-height: ${cssMaxHeight}, Target height: ${targetHeight}`);

    // Apply the target height
    dropdownContainers.forEach(container => {
        // Add small buffer maybe? Or use targetHeight directly. Let's use directly for now.
        container.style.height = `${targetHeight}px`;
    });
}


// --- Update Dropdowns UI (Calls Sync) ---
export function updateDropdownsUI(columnId) {
    // console.log(`[updateDropdownsUI ${columnId}] Starting update.`);
    const columnState = getColumnState(columnId); const columnElement = getColumnElement(columnId);
    if (!columnState || !columnElement || typeof fileStructure === 'undefined') return;
    const pathInput = columnElement.querySelector('.pathInput'); const dropdownContainer = columnElement.querySelector('.dropdownContainer');
    if (!dropdownContainer) return; dropdownContainer.innerHTML = '';
    const basePathSegments = parsePath(pathInput?.value || ''); let currentLevelObj = fileStructure; let dropdownLevelIndex = 0;

    try {
        // --- Process base path segments ---
        for (let i = 0; i < basePathSegments.length; i++) {
            // ... (inner loop logic remains the same) ...
            const segment = basePathSegments[i];
            if (!currentLevelObj || typeof currentLevelObj !== 'object') { currentLevelObj = null; break; }
            if (segment === '*') {
                // ... (dropdown creation logic remains the same) ...
                 const subdirs = Object.keys(currentLevelObj).filter(key => typeof currentLevelObj[key] === 'object' && !key.endsWith('.png') && !key.endsWith('.pdf'));
                 if (subdirs.length === 0) { currentLevelObj = null; break; }
                 const levelDiv = document.createElement('div'); levelDiv.className = 'dropdownLevel'; levelDiv.dataset.levelIndex = String(dropdownLevelIndex);
                 const select = document.createElement('select'); select.dataset.levelIndex = String(dropdownLevelIndex); select.innerHTML = '<option value="">-- Select --</option>';
                 subdirs.sort().forEach(dir => { const option = document.createElement('option'); option.value = dir; option.textContent = dir; select.appendChild(option); });
                 const syncCheckbox = document.createElement('input'); syncCheckbox.type = 'checkbox'; syncCheckbox.className = 'syncCheckbox'; syncCheckbox.title = 'Sync this level'; syncCheckbox.dataset.levelIndex = String(dropdownLevelIndex);
                 // Use the current state to set checked status
                 syncCheckbox.checked = !(columnState.syncDisabled?.[dropdownLevelIndex] ?? false);
                 levelDiv.appendChild(select); levelDiv.appendChild(syncCheckbox); dropdownContainer.appendChild(levelDiv);
                 const savedSelection = columnState.dropdownSelections[dropdownLevelIndex];
                 let nextLevelObj = null;
                 if (savedSelection && subdirs.includes(savedSelection)) {
                     select.value = savedSelection;
                     nextLevelObj = (currentLevelObj && typeof currentLevelObj === 'object') ? currentLevelObj[savedSelection] : null;
                 }
                 currentLevelObj = nextLevelObj;
                 dropdownLevelIndex++;
                 if (!select.value) { currentLevelObj = null; break; }
            } else {
                if (currentLevelObj.hasOwnProperty(segment) && typeof currentLevelObj[segment] === 'object') {
                    currentLevelObj = currentLevelObj[segment];
                } else { currentLevelObj = null; break; }
            }
        } // End for loop (base path)

        // --- Process subsequent levels ---
        while (currentLevelObj && typeof currentLevelObj === 'object') {
            // ... (subsequent dropdown creation logic remains the same) ...
            const subdirs = Object.keys(currentLevelObj).filter(key => typeof currentLevelObj[key] === 'object' && !key.endsWith('.png') && !key.endsWith('.pdf'));
            if (subdirs.length === 0) { break; }
            const levelDiv = document.createElement('div'); levelDiv.className = 'dropdownLevel'; levelDiv.dataset.levelIndex = String(dropdownLevelIndex);
            const select = document.createElement('select'); select.dataset.levelIndex = String(dropdownLevelIndex); select.innerHTML = '<option value="">-- Select --</option>';
            subdirs.sort().forEach(dir => { const option = document.createElement('option'); option.value = dir; option.textContent = dir; select.appendChild(option); });
            const syncCheckbox = document.createElement('input'); syncCheckbox.type = 'checkbox'; syncCheckbox.className = 'syncCheckbox'; syncCheckbox.title = 'Sync this level'; syncCheckbox.dataset.levelIndex = String(dropdownLevelIndex);
            // Use the current state to set checked status
            syncCheckbox.checked = !(columnState.syncDisabled?.[dropdownLevelIndex] ?? false);
            levelDiv.appendChild(select); levelDiv.appendChild(syncCheckbox); dropdownContainer.appendChild(levelDiv);
            const savedSelection = columnState.dropdownSelections[dropdownLevelIndex];
            let nextLevelObj = null;
            if (savedSelection && subdirs.includes(savedSelection)) {
                select.value = savedSelection;
                nextLevelObj = (currentLevelObj && typeof currentLevelObj === 'object') ? currentLevelObj[savedSelection] : null;
            }
            currentLevelObj = nextLevelObj;
            dropdownLevelIndex++;
            if (!select.value) { currentLevelObj = null; break; }
        } // End while loop (subsequent levels)

    } catch (error) { console.error(`[updateDropdownsUI ${columnId}] ERROR:`, error); dropdownContainer.innerHTML = '<p style="color: red;">Error.</p>'; }
    finally {
        // Sync heights AFTER building dropdowns
        try { if (typeof syncDropdownContainerHeights === 'function') syncDropdownContainerHeights(); } catch (e) { console.warn("Error syncing dropdown heights", e); }

        // --- REMOVED image update from here ---
        // rely on recalculateCombinedImageList -> updateAllColumnsDisplay -> updateImageUI
        // if (typeof updateImageUI === 'function') updateImageUI(columnId); // <<< REMOVED
        // else console.error("updateImageUI function not available in updateDropdownsUI"); // <<< REMOVED
    }
}

// --- Update Image UI ---
export function updateImageUI(columnId) {
    const columnState = getColumnState(columnId); const columnElement = getColumnElement(columnId);
    if (!columnState || !columnElement || typeof fileStructure === 'undefined') return;
    const imgElement = columnElement.querySelector('.displayImage'); const pdfLink = columnElement.querySelector('.pdfLink'); const pathInput = columnElement.querySelector('.pathInput');
    if (!imgElement || !pdfLink) return;

    // --- Path reconstruction (keep existing) ---
    const basePathSegments = parsePath(pathInput?.value || ''); let resolvedPathParts = []; let currentLevelObj = fileStructure; let dropdownIndex = 0; let pathIsValid = true;

    try {
        for (let i = 0; i < basePathSegments.length; i++) {
            const segment = basePathSegments[i];
            if (!currentLevelObj || typeof currentLevelObj !== 'object') { pathIsValid = false; break; }
            if (segment === '*') {
                const selection = columnState.dropdownSelections[dropdownIndex];
                if (selection && currentLevelObj.hasOwnProperty(selection)) {
                    resolvedPathParts.push(selection); currentLevelObj = currentLevelObj[selection];
                } else { pathIsValid = false; break; }
                dropdownIndex++;
            } else {
                if (currentLevelObj.hasOwnProperty(segment)) {
                    resolvedPathParts.push(segment); currentLevelObj = currentLevelObj[segment];
                } else { pathIsValid = false; break; }
            }
        } // End base path loop

        while (pathIsValid && currentLevelObj && dropdownIndex < columnState.dropdownSelections.length) {
            if (typeof currentLevelObj !== 'object') { pathIsValid = false; break; }
            const selection = columnState.dropdownSelections[dropdownIndex];
            if (selection && currentLevelObj.hasOwnProperty(selection)) {
                 resolvedPathParts.push(selection); currentLevelObj = currentLevelObj[selection];
            } else if (selection === "") { currentLevelObj = null; break; }
            else { pathIsValid = false; break; }
            dropdownIndex++;
        } // End subsequent selections loop
    } catch (error) { pathIsValid = false; currentLevelObj = null; }

    // --- Update DOM ---
    imgElement.src = ''; imgElement.alt = '...'; imgElement.removeAttribute('data-original-src');
    pdfLink.style.display = 'none'; pdfLink.href = '#';

    // --- Handle different states ---
    if (pathIsValid && currentLevelObj && typeof currentLevelObj === 'object') {
        // Path is valid to a directory. Use cached currentImageFiles list IF AVAILABLE.
        // recalculateCombinedImageList should have updated it.
        const imageFiles = columnState.currentImageFiles || []; // Use cached list

        if (columnState.currentIndex === -1) {
            // Use getter functions for the "not found" message
            const currentGlobalIndex = (typeof getGlobalImageIndex === 'function') ? getGlobalImageIndex() : 0;
            const masterList = (typeof getCombinedImageList === 'function') ? getCombinedImageList() : [];
            const masterFilename = masterList[currentGlobalIndex] || '(Unknown)';
            imgElement.alt = `Image "${masterFilename}" not found here`;
        } else if (imageFiles.length > 0) {
            // Valid index and images exist in this column's current folder
            if (columnState.currentIndex >= imageFiles.length || columnState.currentIndex < 0) { columnState.currentIndex = 0; } // Safety bound check
            const imageName = imageFiles[columnState.currentIndex];
            if (imageName) {
                const imagePath = [...resolvedPathParts, imageName].join('/');
                imgElement.dataset.originalSrc = imagePath; imgElement.alt = imageName;
                if (typeof invertImageDisplay === 'function') { invertImageDisplay(imgElement, document.body.classList.contains('dark-mode')); } else { imgElement.src = imagePath; }
                const pdfName = imageName.replace(/\.png$/i, '.pdf');
                if (currentLevelObj.hasOwnProperty(pdfName)) { pdfLink.href = [...resolvedPathParts, pdfName].join('/'); pdfLink.style.display = 'block'; pdfLink.textContent = `View ${pdfName}`; }
            } else { imgElement.alt = 'Error: Invalid image name at index'; }
        } else { imgElement.alt = 'No PNG images found'; } // Folder valid, but empty
    } else if (!pathIsValid) { imgElement.alt = 'Invalid path/selection'; if(columnState) columnState.currentIndex = -1; }
    else { imgElement.alt = 'Select full path'; if(columnState) columnState.currentIndex = -1; }
}


// --- Search and Drag/Drop Helpers ---
/**
 * Updates the search results preview dropdown, adding hover and keyboard highlighting.
 * @param {string} columnId - The ID of the column.
 * @param {string[]} results - Array of path strings to display.
 * @param {function(string)} selectionCallback - Function to call when a result is definitively selected (click or Enter).
 */
export function updateSearchResultsPreview(columnId, results, selectionCallback) {
    const columnElement = getColumnElement(columnId); if (!columnElement) return;
    const previewContainer = columnElement.querySelector('.searchResultsPreview'); if (!previewContainer) return;

    // --- Helper function to manage highlight ---
    const updateHighlight = (indexToHighlight) => {
        const items = previewContainer.querySelectorAll('div[data-index]');
        items.forEach((item, idx) => {
            item.classList.toggle('highlighted', idx === indexToHighlight);
        });
        if (indexToHighlight >= 0 && indexToHighlight < items.length) {
             // Ensure the highlighted item is visible within the scrollable preview
             items[indexToHighlight].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        previewContainer.dataset.selectedIndex = indexToHighlight; // Store current index
    };
    // --- End Helper ---

    previewContainer.innerHTML = ''; // Clear previous results
    previewContainer.removeAttribute('data-selected-index'); // Reset selected index attribute

    if (results.length > 0) {
        results.forEach((result, index) => {
            const div = document.createElement('div');
            div.textContent = result;
            div.title = result;
            div.dataset.index = String(index); // Add index for navigation

            // Click selects the item
            div.addEventListener('click', () => {
                selectionCallback(result); // Use the callback
                // Preview hidden by selectionCallback's flow now
            });

            // Mouse hover updates highlight and stored index
            div.addEventListener('mouseenter', () => {
                updateHighlight(index); // Highlight this item
            });

            // Mouse leave removes highlight (unless it's the keyboard-selected one)
            // Let keyboard handler manage persistence, just remove hover effect visually
            // Update: Simpler to just let updateHighlight handle everything.
            // The next mouseenter or keydown will correct the highlight.

            // Prevent blur on input when clicking preview item
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            previewContainer.appendChild(div);
        });
        previewContainer.style.display = 'block';
        // Initialize with no highlight
        updateHighlight(-1); // Set index to -1 initially

    } else {
        previewContainer.style.display = 'none';
    }
}
export function hideSearchPreview(columnId) { const col = getColumnElement(columnId); if(col) { const prev = col.querySelector('.searchResultsPreview'); if(prev) prev.style.display = 'none'; } }
export function setDraggingStyle(columnElement, isDragging) { if(columnElement) columnElement.classList.toggle('dragging', isDragging); }
export function clearDragOverStyles(container) { if(container) container.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over')); }
export function setDragOverStyle(element) { if(element) element.classList.add('drag-over'); }
export function getDragAfterElement(container, x) { if (!container) return null; const els = [...container.querySelectorAll('.column:not(.dragging)')]; return els.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = x - box.left - box.width / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; }
