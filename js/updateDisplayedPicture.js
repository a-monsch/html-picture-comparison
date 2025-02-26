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
      pictureWrapper.style.height = "calc(100% - 60px)"; // leave room for the PDF link
      pictureWrapper.style.display = "flex";
      pictureWrapper.style.justifyContent = "center";

      // Create the image element.
      const img = document.createElement('img');
      if (hasLevel2) {
        img.src = `data/${columnObj.folder}/${columnObj.channel}/${fileObj.png}`;
      } else {
        img.src = `data/${columnObj.folder}/${fileObj.png}`;
      }
      img.style.maxWidth = "100%";
      img.style.maxHeight = "100%";
      img.style.objectFit = "contain";

      // When the image loads, process it once to store the original+inverted versions.
      // We use a canvas to invert the pixel data.
      img.addEventListener('load', function() {
        // Only process if we haven’t stored the original version already.
        if (!img.dataset.original) {
          // Store the original image source.
          img.dataset.original = img.src;
          
          // Create an offscreen canvas matching the image dimensions.
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');

          // Draw the original image.
          ctx.drawImage(img, 0, 0);
          
          // Get the image pixel data.
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Invert each pixel’s RGB channels.
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];         // Red channel.
            data[i + 1] = 255 - data[i + 1];   // Green channel.
            data[i + 2] = 255 - data[i + 2];   // Blue channel.
            // Alpha channel stays unchanged.
          }

          // Write back the inverted pixel data.
          ctx.putImageData(imageData, 0, 0);
          // Store the inverted image as a data URL.
          img.dataset.inverted = canvas.toDataURL();
        }
        
        // Immediately update the image source based on the current dark mode state.
        // (When dark mode is active, we use the inverted version.)
        if (document.body.classList.contains('dark-mode')) {
          img.src = img.dataset.inverted;
        } else {
          img.src = img.dataset.original;
        }
      });

      // Append the image and other elements.
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
      placeholder.className = 'no-image-placeholder';
      placeholder.style.height = '100px';
      placeholder.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#000' : '#eee';
      placeholder.style.textAlign = 'center';
      placeholder.style.lineHeight = '100px';
      // In dark mode, white text; otherwise default text color.
      placeholder.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '';
      placeholder.textContent = 'No image';
      columnObj.imageContainer.appendChild(placeholder);
    }
  });
  statusEl.textContent = `${currentPictureIndex + 1} / ${unionFiles.length} | ${fileObj.png}`;
}
