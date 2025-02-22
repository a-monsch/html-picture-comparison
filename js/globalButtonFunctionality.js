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
      const columnsData = stateParam.split('|').map(colState => {
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
    
});

// Permalink button click handler
document.getElementById('permalinkBtn').addEventListener('click', () => {
  const state = activeColumns.map(col => {
    const title = col.title || 'Column Title';
    const folder = col.folder || '';
    const channel = col.channel || '';
    return encodeURIComponent(title) + ',' + encodeURIComponent(folder) + ',' + encodeURIComponent(channel);
  }).join('|');
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
