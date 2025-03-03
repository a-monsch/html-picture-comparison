// Global next and previous button functionality.
let hasLevel2 = true; // Global flag for level2 existence

document.addEventListener('DOMContentLoaded', () => {
  // Check level2-options.json existence
    fetch('data/level2-options.json')
      .then(r => { 
        hasLevel2 = r.ok; 
        // Show/hide sync checkbox based on level2 availability.
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
    const urlParams = new URLSearchParams(window.location.search);
    const stateParam = urlParams.get('state');
    if (stateParam) {
      // If state contains a global part (using ";" as delimiter), split it.
      let globalState = { sync: 'true', toggle: 'linear' };
      let columnsPart = stateParam;
      if (stateParam.includes(';')) {
        const parts = stateParam.split(';');
        const globalPart = parts.shift();
        columnsPart = parts.join(';'); // remaining is columns state
        globalPart.split(',').forEach(pair => {
          const [k, v] = pair.split(':');
          globalState[k] = v;
        });
        if (globalState.pic) {
          currentPictureIndex = parseInt(globalState.pic);
        }
      }
      // Set global sync checkbox.
      const syncCb = document.getElementById('syncChannelsCheckbox');
      if (syncCb) {
        syncCb.checked = (globalState.sync === 'true');
      }
      // Set toggle dropdown value (show it if a folder indicating log/linear is present).
      const toggleDropdown = document.getElementById('togglePathDropdown');
      if (toggleDropdown) {
        toggleDropdown.style.display = 'inline-block';
        toggleDropdown.value = globalState.toggle || 'linear';
      }
      // For older links without a global part, columnsPart will be the full state.
      const columnsData = columnsPart.split('|').map(colState => {
        const [title, folder, channel] = colState.split(',').map(s => decodeURIComponent(s));
        return { title, folder, channel };
      });
      columnsData.forEach(data => addColumn(data));
    } else {
      addColumn();
      addColumn();
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
  const state = globalState + ';' + columnsState;
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
