# generate_structure.py (Updated)
import os
import json

def get_dir_structure(rootdir):
    """
    Creates a nested dictionary that represents the folder structure of rootdir
    and includes .png and .pdf files.
    """
    dir_structure = {}
    rootdir = rootdir.rstrip(os.sep)
    start = rootdir.rfind(os.sep) + 1
    # Handle case where rootdir is the folder itself (e.g., 'data')
    if start == 0 and rootdir:
         start = -len(rootdir) -1 # Adjust start index correctly


    for path, dirs, files in os.walk(rootdir):
        # Correctly handle path splitting relative to the initial rootdir
        relative_path = path[len(rootdir):].strip(os.sep)
        folders = relative_path.split(os.sep) if relative_path else []

        subdir = dir_structure
        # Navigate to the correct depth in the dictionary
        for folder in folders:
            if not folder: continue
            if folder not in subdir:
                subdir[folder] = {}
            subdir = subdir[folder]

        # Add files (png and pdf) at the current level
        for file in files:
            if file.lower().endswith(('.png', '.pdf')):
                subdir[file] = None # Use filename as key
    return dir_structure

# --- Configuration ---
DATA_FOLDER = 'data' # The name of your data directory
OUTPUT_FILE = 'fileStructure.js'
# --- End Configuration ---

if __name__ == '__main__':
    structure = {}
    if not os.path.isdir(DATA_FOLDER):
        print(f"Error: Directory '{DATA_FOLDER}' not found.")
        # Create a dummy structure for testing if needed
        structure = {
            DATA_FOLDER: { # Keep the top-level data key
                "f1": {
                    "f2": {
                        "f3": {
                            "f4.1": {"f5.1": {"picA.png": None, "picA.pdf": None, "picB.png": None}, "f5.2": {"picC.png": None}},
                            "f4.2": {"f5.1": {"picD.png": None}, "f5.3": {"picE.png": None, "picE.pdf": None}}
                        },
                        "other.png": None
                    }
                }, "empty_folder": {}
            }
        }
        print(f"Creating dummy structure in {OUTPUT_FILE} for testing.")
    else:
        # Get structure starting *within* the data folder
        inner_structure = get_dir_structure(DATA_FOLDER)
        # Wrap it with the top-level 'data' key
        structure = { DATA_FOLDER: inner_structure }


    # Write the structure to a JavaScript file using ES6 export
    with open(OUTPUT_FILE, 'w') as f:
        # IMPORTANT: Use json.dumps for proper JS object notation
        f.write(f"export const fileStructure = {json.dumps(structure, indent=4)};\n")

    print(f"File structure written to {OUTPUT_FILE} (using ES6 export)")
    print(f"Make sure the '{DATA_FOLDER}' directory is served alongside your index.html.")
