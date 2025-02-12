// Helper: fuzzy match – returns true when all characters in pattern appear in text in order.
function fuzzyMatch(pattern, text) {
  pattern = pattern.toLowerCase();
  text = text.toLowerCase();
  let pIndex = 0, tIndex = 0;
  while (pIndex < pattern.length && tIndex < text.length) {
    if (pattern[pIndex] === text[tIndex]) {
      pIndex++;
    }
    tIndex++;
  }
  return pIndex === pattern.length;
}

// Populate folder suggestions based on filter using regex and fuzzy find.
function populateFolderSuggestions(filter, suggestionsContainer) {
  fetchFolders().then(folders => {
    suggestionsContainer.innerHTML = '';
    // If filter is empty, show all folders.
    if (!filter) {
      folders.forEach(folder => {
        addFolderItem(folder);
      });
      return;
    }
    let regex;
    try {
      regex = new RegExp(filter, 'i');
    } catch (e) {
      regex = /.*/;
    }
    let found = false;
    folders.forEach(folder => {
      // Match if either regex test passes or fuzzy match passes.
      if (regex.test(folder) || fuzzyMatch(filter, folder)) {
        found = true;
        addFolderItem(folder);
      }
    });
    if (!found) {
      const noResult = document.createElement('div');
      noResult.textContent = 'No matching folders found.';
      noResult.style.padding = '5px';
      suggestionsContainer.appendChild(noResult);
    }
    
    function addFolderItem(folder) {
      const item = document.createElement('div');
      item.textContent = folder;
      item.className = 'folder-suggestion-item';
      // When clicked, call selectSuggestion (from selectSuggestion.js)
      item.addEventListener('click', () => {
        selectSuggestion(item, suggestionsContainer);
      });
      suggestionsContainer.appendChild(item);
    }
    
  }).catch(err => console.error("Error fetching folders:", err));
}
