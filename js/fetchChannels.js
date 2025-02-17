// Fetch channel options for a given folder from JSON file.
function fetchChannels(folder) {
  return fetch('data/level2-options.json')
    .then(response => {
        if (!response.ok) return {};
        return response.json();
    })
    .then(data => data[folder] || []);
}
