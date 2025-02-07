// Fetch folder options from JSON file.
    function fetchFolders() {
      return fetch('data/level1-options.json')
        .then(response => response.json());
    }
