// Global next and previous button functionality.
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('globalAddBtn').addEventListener('click', addColumn);

      // Create two columns initially.
      addColumn();
      addColumn();
      
      document.getElementById('prevBtn').addEventListener('click', () => {
        let unionFiles = getUnionFiles();
        if (unionFiles.length === 0) return;
        do {
          currentPictureIndex = Math.max(currentPictureIndex - 1, 0);
          unionFiles = getUnionFiles();
        } while (unionFiles.length && !activeColumns.some(c => c.availableFiles.includes(unionFiles[currentPictureIndex].png)));
        updateDisplayedPicture();
      });

      document.getElementById('nextBtn').addEventListener('click', () => {
        let unionFiles = getUnionFiles();
        if (unionFiles.length === 0) return;
        do {
          currentPictureIndex = Math.min(currentPictureIndex + 1, unionFiles.length - 1);
          unionFiles = getUnionFiles();
        } while (unionFiles.length && !activeColumns.some(c => c.availableFiles.includes(unionFiles[currentPictureIndex].png)));
        updateDisplayedPicture();
      });
    });

    document.addEventListener('keydown', (e) => {
      if(e.key === 'ArrowRight') {
        document.getElementById('nextBtn').click();
      } else if(e.key === 'ArrowLeft') {
        document.getElementById('prevBtn').click();
      }
    });
