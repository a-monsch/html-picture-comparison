// Adjust column wrapper widths based on the number of columns.
function adjustColumnWidths() {
  const colWrappers = document.querySelectorAll('.col-wrapper');
  const total = colWrappers.length;
  const widthPercent = 100 / total;
  colWrappers.forEach(wrapper => {
    wrapper.style.width = widthPercent + '%';
  });
}
