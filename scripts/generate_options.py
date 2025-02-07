import os
import json


def generate_options():
    data_dir = 'data'
    level1_file = os.path.join(data_dir, 'level1-options.json')
    level2_file = os.path.join(data_dir, 'level2-options.json')
    file_order_file = os.path.join(data_dir, 'file_order.json')

    level1 = []  # List of parent paths (level-1) where channel folders reside.
    level2 = {}  # Mapping from level-1 path to channels (each with label and value).
    files_set = set()

    # Walk recursively through the data directory.
    for dirpath, dirnames, filenames in os.walk(data_dir):
        # Check if the current directory contains any png/pdf files.
        if any(file.lower().endswith(('.png', '.pdf')) for file in filenames):
            # Compute the relative path from data_dir.
            rel_dir = os.path.relpath(dirpath, data_dir)
            parts = rel_dir.split(os.sep)
            # The channel folder is the last directory.
            channel_name = parts[-1]
            # The level-1 folder is the path until (but not including) the channel folder.
            if len(parts) >= 2:
                level1_key = os.path.join(*parts[:-1])
            else:
                level1_key = parts[0]
            # Register the channel info under the corresponding level-1 key.
            if level1_key not in level2:
                level2[level1_key] = []
            level2[level1_key].append({"label": channel_name, "value": channel_name})
            # Add level1_key if not already added.
            if level1_key not in level1:
                level1.append(level1_key)
            # Collect all png and pdf files.
            for file in filenames:
                if file.lower().endswith(('.png', '.pdf')):
                    files_set.add(file)

    # Create a sorted list of PNG files.
    png_files = sorted([file for file in files_set if file.lower().endswith('.png')])

    # Build file_order: for each PNG file check if there is a corresponding PDF.
    file_order = []
    for png in png_files:
        pdf = png[:-4] + ".pdf"  # replace .png with .pdf
        if pdf in files_set:
            file_order.append({"png": png, "pdf": pdf})
        else:
            file_order.append({"png": png})

    # Write the JSON files with indentation for readability.
    with open(level1_file, 'w') as f:
        json.dump(level1, f, indent=2)
    with open(level2_file, 'w') as f:
        json.dump(level2, f, indent=2)
    with open(file_order_file, 'w') as f:
        json.dump(file_order, f, indent=2)


if __name__ == "__main__":
    generate_options()
