// Fetch channel options for a given folder from JSON file.
    function fetchChannels(folder) {
      return fetch('data/level2-options.json')
        .then(response => response.json())
        .then(data => data[folder] || []);
    }
