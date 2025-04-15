// --- State Management & Permalink Logic ---

export let columnsState = []; // Array holding the state object for each column
let nextColumnIdInternal = 0; // Internal variable

// Reference to the main container (initialized in main.js)
let columnsContainerRef = null;
export function setColumnsContainerRef(element) {
    columnsContainerRef = element;
}

/** Generates a unique ID for columns and increments the internal counter. */
export function generateId() {
    return `col-${nextColumnIdInternal++}`;
}

/** Sets the starting value for the column ID counter. */
export function setNextColumnId(value) {
    nextColumnIdInternal = parseInt(value, 10) || 0;
}

/** Gets the current next ID value (useful for saving state). */
export function getNextColumnIdValue() {
    return nextColumnIdInternal;
}

/** Gets the state object for a column by its ID. */
export function getColumnState(id) {
    return columnsState.find(c => c.id === id);
}

/** Gets the DOM element for a column by its ID. */
export function getColumnElement(id) {
    if (!columnsContainerRef || typeof columnsContainerRef.querySelector !== 'function') { return null; }
    return columnsContainerRef.querySelector(`.column[data-id="${id}"]`);
}

/** Adds a new column's state to the global state. */
export function addColumnToState(newState) {
    if (!getColumnState(newState.id)) { columnsState.push(newState); }
    else { console.warn(`Attempted to add duplicate column state for ID: ${newState.id}`); }
}

/** Removes a column's state from the global state. */
export function removeColumnFromState(columnId) {
    const index = columnsState.findIndex(c => c.id === columnId);
    if (index > -1) { columnsState.splice(index, 1); }
}

/** Updates the order of columnsState based on the current DOM order. */
export function updateColumnOrderState() {
    if (!columnsContainerRef || typeof columnsContainerRef.querySelectorAll !== 'function') return;
    try {
        const orderedIds = [...columnsContainerRef.querySelectorAll('.column')].map(col => col.dataset.id);
        columnsState.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    } catch (e) { console.error("Error updating column order state:", e); }
}

// --- Permalink Logic ---

/** Generates the serializable state object for the permalink. */
function generateStateObject() {
    updateColumnOrderState();
    const state = {
        columns: columnsState.map(cs => ({
            title: cs.title, path: cs.path, dropdownSelections: cs.dropdownSelections,
            syncDisabled: cs.syncDisabled, currentIndex: cs.currentIndex,
        })),
        darkMode: document.body.classList.contains('dark-mode'),
        nextId: getNextColumnIdValue()
    };
    return state;
}

/** Updates the URL hash with the current application state. */
export function updatePermalink() {
    try {
        const state = generateStateObject();
        const stateString = JSON.stringify(state);
        const encodedState = encodeURIComponent(btoa(stateString));
        window.location.hash = `state=${encodedState}`;
     } catch (e) { console.error("Failed to update permalink state:", e); }
}

/** Loads application state from the URL hash. Returns parsed state or null. */
export function loadStateFromPermalink() {
    if (window.location.hash && window.location.hash.startsWith('#state=')) {
        try {
            let encodedState = window.location.hash.substring(7);
            encodedState = decodeURIComponent(encodedState);
            const stateString = atob(encodedState);
            const loadedState = JSON.parse(stateString);
            if (typeof loadedState === 'object' && loadedState !== null) { return loadedState; }
            else { throw new Error("Parsed state is not a valid object."); }
         } catch (e) {
            console.error("Failed to load state from permalink:", e);
            window.location.hash = '';
            return null;
        }
    }
    return null;
}
