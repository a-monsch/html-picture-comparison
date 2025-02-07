// Add a new column.
function addColumn() {
  const columnsDiv = document.getElementById('columns');
  const colWrapper = document.createElement('div');
  colWrapper.className = 'col-wrapper';
  // Provide a unique data attribute for drag identification
  colWrapper.dataset.syncId = generateId();

  // Enable drag and drop reordering
  colWrapper.draggable = true;
  colWrapper.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', colWrapper.dataset.syncId);
  });
  colWrapper.addEventListener('dragenter', (e) => {
    e.preventDefault();
    colWrapper.style.backgroundColor = 'rgba(128,128,128,0.1)';
  });
  colWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  colWrapper.addEventListener('dragleave', () => {
    colWrapper.style.backgroundColor = '';
  });
  colWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    colWrapper.style.backgroundColor = '';
    const draggedId = e.dataTransfer.getData('text/plain');
    // Find the dragged element by its syncId
    const draggedEl = [...document.querySelectorAll('.col-wrapper')]
      .find(w => w.dataset.syncId === draggedId);
    if (draggedEl && draggedEl !== colWrapper) {
      const parent = colWrapper.parentNode;
      // Reinsert the current column (colWrapper) before/after the draggedEl
      if ([...parent.children].indexOf(draggedEl) < [...parent.children].indexOf(colWrapper)) {
        parent.insertBefore(colWrapper, draggedEl);
      } else {
        parent.insertBefore(colWrapper, draggedEl.nextSibling);
      }
      adjustColumnWidths();
    }
  });

  const column = createColumn();
  colWrapper.appendChild(column);
  columnsDiv.appendChild(colWrapper);
  adjustColumnWidths();
}
