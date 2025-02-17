# HTML based plot comparison

This project provides a dynamic, multi-column web interface where you can view and compare images organized by folders (and optionally by channels). The repository was mainly created with the help of Copilot!

Necessary requirement: All pictures that want to be compared need to have the same name and only differ in their folder locations.

## Key Features

- Add new columns to the display. Each column allows you to select a folder (and channel, if enabled) to load specific images.
- Use the global Previous (◄) and Next (►) buttons (or corresponding arrow keys) to cycle through images from the joined collection across all columns. If the arrow keys show no effect: left-click outside the latest used search field
- Rearrange your columns using a simple drag and drop mechanism (TODO: permalink currently does not remember the rearrangement order but only the initialization order)
- Generate a shareable URL that preserves the state of your columns (their folders, channels, and titles, not the order if they were rearranged after creation).
- Start typing to filter through folder options with real-time suggestions after clicking into the search field.
- If an image has a corresponding PDF, a “View PDF” link is provided for quick access.

## Modes of Operation

This repository supports two operating modes based on your folder structure:

1. **Default Mode (with Level-2 Options):**  
   In this mode, folders are expected to contain subfolders (channels). When you select a folder, the website will automatically load the available channels so you can choose one. Currently they are synced between columns. (TODO: add a check button to unsync them)
   
2. **Simple Mode (--no-level-2):**  
   Your directory structure does not include channels. This mode bypasses the channel selection and uses the folder directly for image display. The image names should still be the same for the comparison

## How to Use

0. **Clone Repository:**
   - Clone the repository to a place to your specified location.

1. **Populate data/ directory:**
   - Put all your `.png` files in a corresponding directory structure that you want to compare. Pictues need to have same names accross the different directories. Additionally: if `.pdf` files exist they will be added as an additional link at the bottom.

2. **Generate Options:**
   - Run the Python script [scripts/generate_options.py](scripts/generate_options.py) to create the necessary JSON option files from the root dir of the repository.
   - To use simple mode (without channels), run:
     ```sh
     python3 scripts/generate_options.py --no-level-2
     ```
   - For the default behavior (with channels), simply run:
     ```sh
     python3 scripts/generate_options.py
     ```
