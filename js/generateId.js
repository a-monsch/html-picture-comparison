// Generate a unique ID for column identification.
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
