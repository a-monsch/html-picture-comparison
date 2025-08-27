import { fileStructure } from './fileStructure.js';
import { getNested, parsePath, getImageFilesInDir } from './helpers.js';
import { getColumnState, getColumnElement } from './state.js';
import { invertImageDisplay, getCombinedImageList, getGlobalImageIndex } from './logic.js';

const columnTemplate = document.getElementById('columnTemplate');
if (!columnTemplate) console.error("CRITICAL: Column template #columnTemplate not found!");

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

    let cssMaxHeight = Infinity;
    try { // Read CSS max-height (assuming it's in px)
        const style = window.getComputedStyle(dropdownContainers[0]);
        const maxHeightValue = style.maxHeight;
        if (maxHeightValue && maxHeightValue !== 'none' && maxHeightValue.endsWith('px')) {
            cssMaxHeight = parseFloat(maxHeightValue) || Infinity;
        }
    } catch (e) { console.warn("Could not read CSS max-height for dropdown container.", e); }

    // Target height is the smaller of the content height and the CSS max-height
    const targetHeight = Math.min(maxHeight, cssMaxHeight);
    console.log(`[syncDropdownContainerHeights] Max scrollHeight: ${maxHeight}, CSS max-height: ${cssMaxHeight}, Target height: ${targetHeight}`);

    dropdownContainers.forEach(container => {
        container.style.height = `${targetHeight}px`;
    });
}


export function updateDropdownsUI(columnId) {
    const columnState = getColumnState(columnId); const columnElement = getColumnElement(columnId);
    if (!columnState || !columnElement || typeof fileStructure === 'undefined') return;
    const pathInput = columnElement.querySelector('.pathInput'); const dropdownContainer = columnElement.querySelector('.dropdownContainer');
    if (!dropdownContainer) return; dropdownContainer.innerHTML = '';
    const basePathSegments = parsePath(pathInput?.value || ''); let currentLevelObj = fileStructure; let dropdownLevelIndex = 0;

    try {
        // --- Process base path segments ---
        for (let i = 0; i < basePathSegments.length; i++) {
            const segment = basePathSegments[i];
            if (!currentLevelObj || typeof currentLevelObj !== 'object') { currentLevelObj = null; break; }
            if (segment === '*') {
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
        }

        // --- Process subsequent levels ---
        while (currentLevelObj && typeof currentLevelObj === 'object') {
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
        }

    } catch (error) { console.error(`[updateDropdownsUI ${columnId}] ERROR:`, error); dropdownContainer.innerHTML = '<p style="color: red;">Error.</p>'; }
    finally {
        // Sync heights AFTER building dropdowns
        try { if (typeof syncDropdownContainerHeights === 'function') syncDropdownContainerHeights(); } catch (e) { console.warn("Error syncing dropdown heights", e); }
    }
}

/**
 * Updates the displayed image and PDF link for a specific column.
 * Handles URL encoding for special characters in file paths.
 * @param {string} columnId - The ID of the column to update.
 */
export function updateImageUI(columnId) {
    const columnState = getColumnState(columnId);
    const columnElement = getColumnElement(columnId);
    if (!columnState || !columnElement || typeof fileStructure === 'undefined') return;
    const imgElement = columnElement.querySelector('.displayImage');
    const pdfLink = columnElement.querySelector('.pdfLink');
    const pathInput = columnElement.querySelector('.pathInput');
    if (!imgElement || !pdfLink) return;

    // --- Path reconstruction ---
    const basePathSegments = parsePath(pathInput?.value || '');
    let resolvedPathParts = [];
    let currentLevelObj = fileStructure;
    let dropdownIndex = 0;
    let pathIsValid = true;

    try {
        for (let i = 0; i < basePathSegments.length; i++) {
            const segment = basePathSegments[i];
            if (!currentLevelObj || typeof currentLevelObj !== 'object') { pathIsValid = false; break; }
            if (segment === '*') {
                const selection = columnState.dropdownSelections[dropdownIndex];
                if (selection && currentLevelObj.hasOwnProperty(selection)) {
                    resolvedPathParts.push(selection);
                    currentLevelObj = currentLevelObj[selection];
                } else { pathIsValid = false; break; }
                dropdownIndex++;
            } else {
                if (currentLevelObj.hasOwnProperty(segment)) {
                    resolvedPathParts.push(segment);
                    currentLevelObj = currentLevelObj[segment];
                } else { pathIsValid = false; break; }
            }
        }

        while (pathIsValid && currentLevelObj && dropdownIndex < columnState.dropdownSelections.length) {
            if (typeof currentLevelObj !== 'object') { pathIsValid = false; break; }
            const selection = columnState.dropdownSelections[dropdownIndex];
            if (selection && currentLevelObj.hasOwnProperty(selection)) {
                 resolvedPathParts.push(selection);
                 currentLevelObj = currentLevelObj[selection];
            } else if (selection === "") { currentLevelObj = null; break; }
            else { pathIsValid = false; break; }
            dropdownIndex++;
        }
    } catch (error) { pathIsValid = false; currentLevelObj = null; console.error(`[updateImageUI ${columnId}] Error resolving path:`, error); }

    // --- Update DOM ---
    imgElement.src = ''; imgElement.alt = '...'; imgElement.removeAttribute('data-original-src');
    pdfLink.style.display = 'none'; pdfLink.href = '#';

    // --- Handle different states ---
    if (pathIsValid && currentLevelObj && typeof currentLevelObj === 'object') {
        // Path is valid to a directory. Use cached currentImageFiles list IF AVAILABLE.
        const imageFiles = columnState.currentImageFiles || []; // Use cached list

        if (columnState.currentIndex === -1) {
            // Use getter functions for the "not found" message
            const currentGlobalIndex = (typeof getGlobalImageIndex === 'function') ? getGlobalImageIndex() : 0;
            const masterList = (typeof getCombinedImageList === 'function') ? getCombinedImageList() : [];
            const masterFilename = masterList[currentGlobalIndex] || '(Unknown)';
            const pathForAlt = basePathSegments.join('/') + (basePathSegments.length > 0 && !basePathSegments[basePathSegments.length - 1].endsWith('/') ? '/' : '');
            imgElement.alt = `Image "${masterFilename}" not found in ${pathForAlt}`;

        } else if (imageFiles.length > 0) {
            if (columnState.currentIndex >= imageFiles.length || columnState.currentIndex < 0) {
                 console.warn(`[updateImageUI ${columnId}] currentIndex ${columnState.currentIndex} out of bounds for image list of length ${imageFiles.length}. Resetting to 0.`);
                 columnState.currentIndex = 0; // Reset to first image
            }

            const imageName = imageFiles[columnState.currentIndex];

            if (imageName) {
                // --- Construct paths for URL, applying encoding ---
                const encodedPathSegments = resolvedPathParts.map(encodeURIComponent);
                const encodedImageName = encodeURIComponent(imageName);
                const imagePathUrl = [...encodedPathSegments, encodedImageName].join('/');

                imgElement.dataset.originalSrc = imagePathUrl; // Store encoded path for invertImageDisplay
                imgElement.alt = imageName; // Alt text uses the original filename

                // Apply dark mode inversion or set src directly
                const isDarkMode = document.body.classList.contains('dark-mode');
                if (typeof invertImageDisplay === 'function' && isDarkMode) {
                    // invertImageDisplay will load the encoded path from dataset.originalSrc
                    invertImageDisplay(imgElement, isDarkMode);
                } else {
                    imgElement.src = imagePathUrl; // Set src directly using encoded path
                }

                // Check for corresponding PDF and set PDF link
                const pdfName = imageName.replace(/\.png$/i, '.pdf');
                if (currentLevelObj.hasOwnProperty(pdfName)) {
                    const encodedPdfName = encodeURIComponent(pdfName);
                    const pdfLinkUrl = [...encodedPathSegments, encodedPdfName].join('/');
                    pdfLink.href = pdfLinkUrl;
                    pdfLink.style.display = 'block';
                    pdfLink.textContent = `View ${pdfName}`; // Link text uses original filename
                }
            } else {
                imgElement.alt = 'Error: Invalid image name at index';
                console.error(`[updateImageUI ${columnId}] Invalid image name found at index ${columnState.currentIndex}`);
            }
        } else {
            imgElement.alt = 'No PNG images found in this folder'; // Folder valid, but empty or only contains non-PNG files
            console.log(`[updateImageUI ${columnId}] No PNG images found in resolved path.`);
        }
    } else if (!pathIsValid) {
        imgElement.alt = 'Invalid path or selection';
        if(columnState) columnState.currentIndex = -1; // Ensure index is -1 for invalid path
         console.log(`[updateImageUI ${columnId}] Path is invalid.`);
    }
    else {
         imgElement.alt = 'Select a full path'; // Path prefix might be valid, but doesn't resolve to a directory yet
         if(columnState) columnState.currentIndex = -1;
         console.log(`[updateImageUI ${columnId}] Path is incomplete.`);
    }
}


/**
 * Updates the search results preview dropdown, adding hover and keyboard highlighting.
 * @param {string} columnId - The ID of the column.
 * @param {string[]} results - Array of path strings to display.
 * @param {function(string)} selectionCallback - Function to call when a result is definitively selected (click or Enter).
 */
export function updateSearchResultsPreview(columnId, results, selectionCallback) {
    const columnElement = getColumnElement(columnId); if (!columnElement) return;
    const previewContainer = columnElement.querySelector('.searchResultsPreview'); if (!previewContainer) return;

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
            });

            div.addEventListener('mouseenter', () => {
                updateHighlight(index);
            });

            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            previewContainer.appendChild(div);
        });
        previewContainer.style.display = 'block';
        updateHighlight(-1); // Initialize with no highlight

    } else {
        previewContainer.style.display = 'none';
    }
}
export function hideSearchPreview(columnId) { const col = getColumnElement(columnId); if(col) { const prev = col.querySelector('.searchResultsPreview'); if(prev) prev.style.display = 'none'; } }
export function setDraggingStyle(columnElement, isDragging) { if(columnElement) columnElement.classList.toggle('dragging', isDragging); }
export function clearDragOverStyles(container) { if(container) container.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over')); }
export function setDragOverStyle(element) { if(element) element.classList.add('drag-over'); }
export function getDragAfterElement(container, x) { if (!container) return null; const els = [...container.querySelectorAll('.column:not(.dragging)')]; return els.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = x - box.left - box.width / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; }
