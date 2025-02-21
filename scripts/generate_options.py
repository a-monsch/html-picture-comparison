import os
import json
import argparse


def generate_options(create_level2=True, level_2_depth=1):
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
            if create_level2:
                # Use the last `level2_depth` parts as the channel grouping.
                if len(parts) > level_2_depth:
                    level1_key = os.path.join(*parts[:-level_2_depth])
                    channel_name = os.path.join(*parts[-level_2_depth:])
                else:
                    # Fallback if not enough parts exist.
                    level1_key = parts[0]
                    channel_name = os.path.join(*parts)
                if level1_key not in level2:
                    level2[level1_key] = []
                level2[level1_key].append({"label": channel_name, "value": channel_name})
            else:
                # Without level2, use the full folder path.
                level1_key = rel_dir

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
    if create_level2:
        with open(level2_file, 'w') as f:
            json.dump(level2, f, indent=2)
    with open(file_order_file, 'w') as f:
        json.dump(file_order, f, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate options for asym_comparison project.")
    parser.add_argument("--no-level-2", action="store_true", help="Do not create level2-options.json")
    parser.add_argument("--level-2-depth", type=int, default=1, help="Number of folder levels to use for level2 grouping")
    args = parser.parse_args()
    generate_options(create_level2=not args.no_level_2, level_2_depth=args.level_2_depth)
