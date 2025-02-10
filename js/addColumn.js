// Add a new column.
function addColumn(state) {
  const columnsDiv = document.getElementById('columns');
  const colWrapper = document.createElement('div');
  colWrapper.className = 'col-wrapper';
  // Provide a unique data attribute for drag identification
  colWrapper.dataset.syncId = generateId();

  // Enable drag and drop reordering
  colWrapper.draggable = true;
  colWrapper.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', colWrapper.dataset.syncId);
  });
  colWrapper.addEventListener('dragenter', (e) => {
    e.preventDefault();
    colWrapper.style.backgroundColor = 'rgba(128,128,128,0.1)';
  });
  colWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  colWrapper.addEventListener('dragleave', () => {
    colWrapper.style.backgroundColor = '';
  });
  colWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    colWrapper.style.backgroundColor = '';
    const draggedId = e.dataTransfer.getData('text/plain');
    // Find the dragged element by its syncId
    const draggedEl = [...document.querySelectorAll('.col-wrapper')]
      .find(w => w.dataset.syncId === draggedId);
    if (draggedEl && draggedEl !== colWrapper) {
      const parent = colWrapper.parentNode;
      // Reinsert the current column (colWrapper) before/after the draggedEl
      if ([...parent.children].indexOf(draggedEl) < [...parent.children].indexOf(colWrapper)) {
        parent.insertBefore(colWrapper, draggedEl);
      } else {
        parent.insertBefore(colWrapper, draggedEl.nextSibling);
      }
      adjustColumnWidths();
    }
  });

  // Pass state (if any) to createColumn() so that it can prefill title if implemented.
  const column = createColumn(state);
  colWrapper.appendChild(column);
  columnsDiv.appendChild(colWrapper);
  adjustColumnWidths();

  // If state is provided with folder and channel saved, pre-populate and load channels.
  if (state && state.folder && state.channel) {
    // Set folder value in the search input and column dataset.
    const searchInput = column.querySelector('input[type="text"]');
    searchInput.value = state.folder;
    searchInput.setAttribute('data-selected', state.folder);
    column.dataset.folder = state.folder;
    
    // Also set the title if provided.
    const titleInput = column.querySelector('.column-title');
    if (titleInput && state.title) {
      titleInput.value = state.title;
    }
    
    // Fetch channels for the saved folder and then set the channel selection.
    fetchChannels(state.folder)
      .then(channels => {
        const channelSelect = column.querySelector('select');
        // Clear out any existing options.
        channelSelect.innerHTML = '';
        // Always show default prompt option.
        channelSelect.appendChild(new Option('Select Channel', ''));
        // Filter duplicates minimally.
        const seen = new Set();
        channels.forEach(ch => {
          const trimmed = ch.value.trim();
          if (!seen.has(trimmed)) {
            seen.add(trimmed);
            channelSelect.appendChild(new Option(ch.label.trim(), trimmed));
          }
        });
        // Always ensure the dropdown is visible.
        channelSelect.style.display = 'block';
        // If exactly one channel option exists (plus the default), auto-select it.
        if (channelSelect.options.length === 2) {
          channelSelect.value = channelSelect.options[1].value;
          column.dataset.channel = channelSelect.options[1].value;
        }
      })
      .catch(err => console.error("Error fetching channels:", err));
  }
}
