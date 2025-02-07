// Function to set the selected suggestion.
    function selectSuggestion(item, suggestionsContainer) {
      const searchInput = suggestionsContainer.previousElementSibling;
      searchInput.value = item.textContent;
      searchInput.setAttribute('data-selected', item.textContent);
      suggestionsContainer.innerHTML = '';
      // Trigger change so that channel selection is updated.
      searchInput.dispatchEvent(new Event('change'));
    }
