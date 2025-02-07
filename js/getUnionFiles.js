// Returns the union of file order objects that at least one configured column has.
function getUnionFiles() {
    return currentMasterOrder.filter(fileObj =>
    activeColumns.some(c => c.folder && c.channel && c.availableFiles.includes(fileObj.png))
    );
}
