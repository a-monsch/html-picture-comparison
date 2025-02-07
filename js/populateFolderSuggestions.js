// Populate folder suggestions based on regex filter.
// The suggestions are rendered in container (a dropdown div).
function populateFolderSuggestions(filter, suggestionsContainer) {
  fetchFolders().then(folders => {
    suggestionsContainer.innerHTML = '';
    // When filter is empty, set regex to match all folders.
    let regex;
    try {
      regex = new RegExp(filter || ".*", 'i');
    } catch (e) {
      regex = /.*/;
    }
    let found = false;
    folders.forEach(folder => {
      if(regex.test(folder)) {
        found = true;
        const item = document.createElement('div');
        item.textContent = folder;
        item.className = 'folder-suggestion-item';
        // Click selects the suggestion.
        item.addEventListener('click', () => {
          selectSuggestion(item, suggestionsContainer);
        });
        suggestionsContainer.appendChild(item);
      }
    });
    if (!found) {
      const noResult = document.createElement('div');
      noResult.textContent = 'No matching folders found.';
      noResult.style.padding = '5px';
      suggestionsContainer.appendChild(noResult);
    }
  }).catch(err => console.error("Error fetching folders:", err));
}
