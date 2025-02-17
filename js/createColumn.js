// Create a new column.
function createColumn(initialData) {
  const col = document.createElement('div');
  col.className = 'column';
  col.dataset.syncId = generateId();

  // Title input
  const titleInput = document.createElement('input');
  titleInput.className = 'column-title';
  titleInput.placeholder = 'Column Title';
  col.appendChild(titleInput);

  // Search input for regex filtering.
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  // Updated placeholder to indicate folder paths with "/" as delimiters.
  searchInput.placeholder = 'Search folder paths (regex). E.g., folder/subfolder';
  searchInput.style.width = '95%';
  searchInput.style.marginRight = '5%';
  searchInput.style.boxSizing = 'border-box';
  col.appendChild(searchInput);

  // Suggestions container for folder matches.
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.className = 'folder-suggestions';
  col.appendChild(suggestionsContainer);

  // Channel dropdown, initially hidden.
  const channelSelect = document.createElement('select');
  channelSelect.style.display = 'none';
  channelSelect.appendChild(new Option('Select Channel', ''));
  col.appendChild(channelSelect);

  // Image container for displaying the picture or placeholder.
  const imageContainer = document.createElement('div');
  imageContainer.className = 'image-container';
  col.appendChild(imageContainer);

  // Track the current highlighted suggestion index.
  let currentSelectionIndex = -1;

  // When typing, update suggestions and reset selection index.
  searchInput.addEventListener('input', () => {
    currentSelectionIndex = -1;
    populateFolderSuggestions(searchInput.value, suggestionsContainer);
  });

  // Handle arrow key navigation and Enter key to select.
  searchInput.addEventListener('keydown', (e) => {
    const items = suggestionsContainer.getElementsByClassName('folder-suggestion-item');
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      if (currentSelectionIndex < items.length - 1) {
        if (currentSelectionIndex >= 0) {
          items[currentSelectionIndex].classList.remove('highlighted');
        }
        currentSelectionIndex++;
        items[currentSelectionIndex].classList.add('highlighted');
        items[currentSelectionIndex].scrollIntoView({ block: 'nearest' });
        e.preventDefault();
      }
    } else if (e.key === "ArrowUp") {
      if (currentSelectionIndex > 0) {
        items[currentSelectionIndex].classList.remove('highlighted');
        currentSelectionIndex--;
        items[currentSelectionIndex].classList.add('highlighted');
        items[currentSelectionIndex].scrollIntoView({ block: 'nearest' });
        e.preventDefault();
      }
    } else if (e.key === "Enter") {
      if (currentSelectionIndex >= 0 && items[currentSelectionIndex]) {
        selectSuggestion(items[currentSelectionIndex], suggestionsContainer);
        currentSelectionIndex = -1;
      } else if (items[0]) {
        selectSuggestion(items[0], suggestionsContainer);
        currentSelectionIndex = -1;
      }
      e.preventDefault();
    }
  });

  // If the user clicks into an empty search field, show all searchable options.
  searchInput.addEventListener('click', () => {
    if (searchInput.value.trim() === "") {
      populateFolderSuggestions("", suggestionsContainer);
    }
  });

  // Enable left click selection on suggestions.
  suggestionsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('folder-suggestion-item')) {
      searchInput.value = e.target.textContent;
      selectSuggestion(e.target, suggestionsContainer);
    }
  });
  
  // On focus, if search field is empty, show all folders.
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim() === "") {
      populateFolderSuggestions("", suggestionsContainer);
    }
  });

  // When the search input loses focus, hide suggestions after a short delay.
  searchInput.addEventListener('blur', () => {
    setTimeout(() => { suggestionsContainer.innerHTML = ''; }, 150);
  });

  // When search input changes (due to selection), update channel dropdown.
  searchInput.addEventListener('change', () => {
    const folder = searchInput.getAttribute('data-selected') || '';
    // Reset channel dropdown and image container.
    channelSelect.innerHTML = '';
    channelSelect.appendChild(new Option('Select Channel', ''));
    imageContainer.innerHTML = '';
    if (folder) {
      fetchChannels(folder).then(channels => {
        channels.forEach(ch => {
          channelSelect.appendChild(new Option(ch.label, ch.value));
        });
        channelSelect.style.display = (hasLevel2 && channels.length) ? 'block' : 'none';
        if (!hasLevel2) channelSelect.dispatchEvent(new Event('change')); // Auto-trigger load
      });
    } else {
      channelSelect.style.display = 'none';
    }
  });

  // Delete Column button (absolutely positioned inside .column)
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '✖';
  deleteBtn.style.position = 'absolute';
  deleteBtn.style.top = '2px';
  deleteBtn.style.right = '0%';
  deleteBtn.style.width = '5%';
  deleteBtn.style.aspectRatio = '1';
  // deleteBtn.style.height = '48px';
  deleteBtn.addEventListener('click', () => {
    const colWrapper = col.parentNode;
    if (colWrapper && colWrapper.parentNode) {
      colWrapper.parentNode.removeChild(colWrapper);
      activeColumns = activeColumns.filter(item => item.col !== col);
      adjustColumnWidths();
      updateDisplayedPicture();
    }
  });
  col.appendChild(deleteBtn);

  // Initialize with data if provided
  if (initialData) {
    titleInput.value = initialData.title;
    if (initialData.folder) {
      searchInput.value = initialData.folder;
      searchInput.setAttribute('data-selected', initialData.folder);
      searchInput.dispatchEvent(new Event('change'));
      // Set channel after a delay to allow channel fetch
      setTimeout(() => {
        if (initialData.channel) {
          channelSelect.value = initialData.channel;
          channelSelect.dispatchEvent(new Event('change'));
        }
      }, 500);
    }
  }

  // Record for this column.
  const colData = {
    col: col,
    title: titleInput.value,
    searchInput: searchInput,
    suggestionsContainer: suggestionsContainer,
    channelSelect: channelSelect,
    imageContainer: imageContainer,
    folder: null,
    channel: null,
    availableFiles: []  // Populated on channel selection.
  };

  titleInput.addEventListener('input', () => {
    colData.title = titleInput.value;
  });

  // When channel is selected, load available images and synchronize channel selection.
  channelSelect.addEventListener('change', () => {
    const folder = searchInput.getAttribute('data-selected');
    const channel = channelSelect.value;
    colData.folder = folder;
    colData.channel = channel;
    imageContainer.innerHTML = '';
    if (folder && (!hasLevel2 || (channel && channel !== ''))) {
      fetch('data/file_order.json')
        .then(response => response.json())
        .then(file_order => {
          if (currentMasterOrder.length === 0) {
            currentMasterOrder = file_order;
          }
          let pngFiles = file_order.filter(obj => obj.png && obj.png.toLowerCase().endsWith('.png'));
          let loadPromises = pngFiles.map(obj => new Promise(resolve => {
            const img = new Image();
            img.src = hasLevel2 ? // <-- MODIFY
              `data/${folder}/${channel}/${obj.png}` :
              `data/${folder}/${obj.png}`;
            img.onload = () => resolve({ file: obj.png, exists: true });
            img.onerror = () => resolve({ file: obj.png, exists: false });
          }));
          Promise.all(loadPromises).then(results => {
            colData.availableFiles = pngFiles.map(obj => obj.png).filter(file => {
              let res = results.find(r => r.file === file);
              return res && res.exists;
            });
            updateDisplayedPicture();
          });
        })
        .catch(err => console.error('Error loading file_order.json:', err));
    } else {
      colData.availableFiles = [];
      updateDisplayedPicture();
    }

    // Synchronize channel selection across all other columns.
    if (hasLevel2 && !window._isSyncingChannel) {
      window._isSyncingChannel = true;
      activeColumns.forEach(otherCol => {
        if (otherCol === colData) return;
        const hasOption = Array.from(otherCol.channelSelect.options)
                              .some(opt => opt.value === channel);
        const newVal = hasOption ? channel : '';
        if (otherCol.channelSelect.value !== newVal) {
          otherCol.channelSelect.value = newVal;
          // Trigger change event only if the value was actually updated.
          otherCol.channelSelect.dispatchEvent(new Event('change'));
        }
      });
      window._isSyncingChannel = false;
    }
  });

  activeColumns.push(colData);
  return col;
}
