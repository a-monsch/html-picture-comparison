// Global next and previous button functionality.
let hasLevel2 = true; // Global flag for level2 existence

// --- Begin Mapping Functions for Permalink Shortening ---
function shortenPath(path) {
  if (window.folderMapping && window.folderMapping.folderToHash && window.folderMapping.folderToHash[path]) {
    return window.folderMapping.folderToHash[path];
  }
  // Fallback: use last segment.
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function expandPath(hash) {
  if (window.folderMapping && window.folderMapping.hashToFolder && window.folderMapping.hashToFolder[hash]) {
    return window.folderMapping.hashToFolder[hash];
  }
  return hash;
}

function shortenState(state) {
  // Given state as "globalState;columnsState" shorten folder part in each column.
  let parts = state.split(';');
  if (parts.length < 2) return state;
  let globalPart = parts[0];
  let columnsPart = parts.slice(1).join(';');
  const shortenedColumns = columnsPart.split('|').map(col => {
    // Expected column state: title,folder,channel
    let tokens = col.split(',');
    if (tokens.length > 1) {
      tokens[1] = encodeURIComponent(shortenPath(decodeURIComponent(tokens[1])));
    }
    return tokens.join(',');
  }).join('|');
  return globalPart + ';s:' + shortenedColumns;
}

function expandState(state) {
  // If the columns part has been shortened (marker "s:"), expand the folder values.
  let parts = state.split(';');
  if (parts.length < 2) return state;
  let globalPart = parts[0];
  let columnsPart = parts.slice(1).join(';');
  if (columnsPart.startsWith('s:')) {
    columnsPart = columnsPart.substring(2);
    const expandedColumns = columnsPart.split('|').map(col => {
      let tokens = col.split(',');
      if (tokens.length > 1) {
        tokens[1] = encodeURIComponent(expandPath(decodeURIComponent(tokens[1])));
      }
      return tokens.join(',');
    }).join('|');
    return globalPart + ';' + expandedColumns;
  }
  return state;
}
// --- End Mapping Functions ---

document.addEventListener('DOMContentLoaded', () => {
  // Check level2-options.json existence (unchanged)
  fetch('data/level2-options.json')
    .then(r => { 
      hasLevel2 = r.ok; 
      const syncCb = document.getElementById('syncChannelsCheckbox');
      if (syncCb) {
        syncCb.style.display = hasLevel2 ? 'inline-block' : 'none';
      }
    })
    .catch(() => { 
      hasLevel2 = false;
      const syncCb = document.getElementById('syncChannelsCheckbox');
      if (syncCb) {
        syncCb.style.display = 'none';
      }
    });

  // Load folder mapping from level1-options.json and create a deterministic mapping.
  window.folderMapping = { folderToHash: {}, hashToFolder: {} };
  fetch('data/level1-options.json')
    .then(response => response.json())
    .then(data => {
      let sorted = data.slice().sort();
      sorted.forEach((folder, index) => {
        let hash = (index + 1).toString().padStart(5, '0'); // 5-character hash
        window.folderMapping.folderToHash[folder] = hash;
        window.folderMapping.hashToFolder[hash] = folder;
      });
      processStateParam();
    })
    .catch(() => {
      processStateParam();
    });

  function processStateParam() {
    const urlParams = new URLSearchParams(window.location.search);
    let stateParam = urlParams.get('state');
    if (stateParam) {
      stateParam = expandState(stateParam);
      let globalState = { sync: 'true', toggle: 'linear' };
      let columnsPart = stateParam;
      if (stateParam.includes(';')) {
        const parts = stateParam.split(';');
        const globalPart = parts.shift();
        columnsPart = parts.join(';');
        globalPart.split(',').forEach(pair => {
          const [k, v] = pair.split(':');
          globalState[k] = v;
        });
        if (globalState.pic) {
          currentPictureIndex = parseInt(globalState.pic);
        }
      }
      const syncCb = document.getElementById('syncChannelsCheckbox');
      if (syncCb) {
        syncCb.checked = (globalState.sync === 'true');
      }
      const toggleDropdown = document.getElementById('togglePathDropdown');
      if (toggleDropdown) {
        toggleDropdown.style.display = 'inline-block';
        toggleDropdown.value = globalState.toggle || 'linear';
      }
      const columnsData = columnsPart.split('|').map(colState => {
        const [title, folder, channel] = colState.split(',').map(s => decodeURIComponent(s));
        return { title, folder, channel };
      });
      columnsData.forEach(data => addColumn(data));
    } else {
      addColumn();
      addColumn();
    }
  }
    
    document.getElementById('globalAddBtn').addEventListener('click', addColumn);

    document.getElementById('prevBtn').addEventListener('click', () => {
    let unionFiles = getUnionFiles();
    if (unionFiles.length === 0) return;
    do {
        currentPictureIndex = Math.max(currentPictureIndex - 1, 0);
        unionFiles = getUnionFiles();
    } while (unionFiles.length && !activeColumns.some(c => c.availableFiles.includes(unionFiles[currentPictureIndex].png)));
    updateDisplayedPicture();
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
    let unionFiles = getUnionFiles();
    if (unionFiles.length === 0) return;
    do {
        currentPictureIndex = Math.min(currentPictureIndex + 1, unionFiles.length - 1);
        unionFiles = getUnionFiles();
    } while (unionFiles.length && !activeColumns.some(c => c.availableFiles.includes(unionFiles[currentPictureIndex].png)));
    updateDisplayedPicture();
    });

    // Global toggle for folder path replacement.
    const toggleDropdown = document.getElementById('togglePathDropdown');
    if (toggleDropdown) {
      toggleDropdown.addEventListener('change', (e) => {
        const newVal = e.target.value; // either "log" or "linear"
        activeColumns.forEach(colData => {
          // Updated regex to match /log or /linear that may or may not end with a slash.
          if (colData.folder && /\/(log|linear)(\/|$)/.test(colData.folder)) {
            colData.folder = colData.folder.replace(/\/(log|linear)(\/|$)/, (match, p1, p2) => {
              return '/' + newVal + (p2 === '/' ? '/' : '');
            });
            // Update the search input for visual feedback.
            colData.searchInput.value = colData.folder;
            colData.searchInput.setAttribute('data-selected', colData.folder);
            // Re-trigger channel update.
            colData.channelSelect.dispatchEvent(new Event('change'));
          }
        });
        updateDisplayedPicture();
      });
    }

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', () => {
        // Toggle the dark-mode class.
        document.body.classList.toggle('dark-mode');

        // Update the toggle button icon.
        if (document.body.classList.contains('dark-mode')) {
          darkModeToggle.textContent = '🌙';
        } else {
          darkModeToggle.textContent = '☀';
        }

        // Immediately update all displayed PNG images.
        // For each image in a column wrapper, swap its src with the stored original/inverted version.
        document.querySelectorAll('.col-wrapper img').forEach(img => {
          if (img.dataset.original && img.dataset.inverted) {
            if (document.body.classList.contains('dark-mode')) {
              // If dark mode is on, show the inverted version.
              img.src = img.dataset.inverted;
            } else {
              // Otherwise, restore the original.
              img.src = img.dataset.original;
            }
          }
        });

        // Update the background color and text color of placeholders.
        document.querySelectorAll('.no-image-placeholder').forEach(placeholder => {
          placeholder.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#000' : '#eee';
          placeholder.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '';
        });
      });
    }
    
});

// Permalink button click handler
document.getElementById('permalinkBtn').addEventListener('click', () => {
  // Get global sync state.
  const syncCb = document.getElementById('syncChannelsCheckbox');
  const sync = syncCb ? (syncCb.checked ? 'true' : 'false') : 'true';
  // Get global toggle dropdown value; default to "linear" if not visible.
  const toggleDropdown = document.getElementById('togglePathDropdown');
  let toggleVal = 'linear';
  if (toggleDropdown && toggleDropdown.style.display !== 'none') {
    toggleVal = toggleDropdown.value;
  }
  // Get the column order from the DOM (#columns children order).
  const colWrappers = document.querySelectorAll('#columns .col-wrapper');
  const colStateArray = [];
  colWrappers.forEach(wrapper => {
    // Retrieve corresponding column state from activeColumns using the syncId.
    const syncId = wrapper.dataset.syncId;
    const colData = activeColumns.find(x => x.col.parentNode === wrapper || x.col.dataset.syncId === syncId);
    if (colData) {
      const title = colData.title || 'Column Title';
      const folder = colData.folder || '';
      const channel = colData.channel || '';
      colStateArray.push(encodeURIComponent(title) + ',' + encodeURIComponent(folder) + ',' + encodeURIComponent(channel));
    }
  });
  // Global state stored as "sync:true,toggle:linear"
  const globalState = `sync:${sync},toggle:${toggleVal},pic:${currentPictureIndex}`;
  // Columns state with the order as in the DOM.
  const columnsState = colStateArray.join('|');
  const fullState = globalState + ';' + columnsState;
  // Apply shortening to new state
  const state = shortenState(fullState);
  const url = new URL(window.location);
  url.searchParams.set('state', state);
  navigator.clipboard.writeText(url.href).then(() => {
    alert('Permalink copied to clipboard!');
  });
});

document.addEventListener('keydown', (e) => {
  // If focus is in an input field that is either the title or search box, ignore arrow keys.
  const active = document.activeElement;
  if (
    active &&
    active.tagName === "INPUT" &&
    (
      active.classList.contains("column-title") ||
      (active.placeholder && active.placeholder.includes("Search folder paths"))
    )
  ) {
    return;
  }
  
  if (e.key === 'ArrowRight') {
    document.getElementById('nextBtn').click();
  } else if (e.key === 'ArrowLeft') {
    document.getElementById('prevBtn').click();
  }
});
