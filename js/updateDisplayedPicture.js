// Update images based on the union of files and update status.
function updateDisplayedPicture() {
  const unionFiles = getUnionFiles();
  const statusEl = document.getElementById('pictureStatus');
  if (unionFiles.length === 0) {
    activeColumns.forEach(columnObj => {
      columnObj.imageContainer.innerHTML = '';
    });
    statusEl.textContent = '';
    return;
  }
  // Clamp currentPictureIndex.
  if (currentPictureIndex >= unionFiles.length) {
    currentPictureIndex = unionFiles.length - 1;
  }
  if (currentPictureIndex < 0) {
    currentPictureIndex = 0;
  }
  const fileObj = unionFiles[currentPictureIndex];
  activeColumns.forEach(columnObj => {
    columnObj.imageContainer.innerHTML = '';
    if (columnObj.availableFiles.includes(fileObj.png)) {
      // Create a dedicated container for the picture.
      const pictureWrapper = document.createElement('div');
      // Set height so that the PDF link (approx. 60px high) remains visible.
      pictureWrapper.style.height = "calc(100% - 60px)";
      pictureWrapper.style.display = "flex";
      pictureWrapper.style.justifyContent = "center";
      // Create the image element and adjust dimensions to fill the container while preserving aspect ratio.
      const img = document.createElement('img');
      if (hasLevel2) { // <-- ADD
        img.src = `data/${columnObj.folder}/${columnObj.channel}/${fileObj.png}`;
        } else {
        img.src = `data/${columnObj.folder}/${fileObj.png}`;
      }
      img.style.maxWidth = "100%";
      img.style.maxHeight = "100%";
      img.style.objectFit = "contain";
      // Append the image to the dedicated picture container.
      pictureWrapper.appendChild(img);
      columnObj.imageContainer.appendChild(pictureWrapper);
      // Append the PDF link below the picture.
      if (fileObj.pdf) {
        const link = document.createElement('a');
        if (hasLevel2) { // <-- ADD
          link.href = `data/${columnObj.folder}/${columnObj.channel}/${fileObj.pdf}`;
        } else {
          link.href = `data/${columnObj.folder}/${fileObj.pdf}`;
        }
        link.textContent = "View PDF";
        link.target = "_blank";
        link.style.display = 'block';
        link.style.textAlign = 'center';
        columnObj.imageContainer.appendChild(link);
      }
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.height = '100px';
      placeholder.style.backgroundColor = '#eee';
      placeholder.style.textAlign = 'center';
      placeholder.style.lineHeight = '100px';
      placeholder.textContent = 'No image';
      columnObj.imageContainer.appendChild(placeholder);
    }
  });
  statusEl.textContent = `${currentPictureIndex + 1} / ${unionFiles.length} | ${fileObj.png}`;
}
