#!/usr/bin/env python3
# filepath: /web/amonsch/public_html/2025-02-13/asym_comparison/scripts/dump_js.py
import os
import sys

def main():
    # Assume the top level is one directory up from the scripts folder.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    top_level = os.path.abspath(os.path.join(script_dir, '..'))
    
    # js folder is located at top_level/js
    js_folder = os.path.join(top_level, 'js')
    dump_file = os.path.join(top_level, 'dump.js')

    if not os.path.isdir(js_folder):
        print(f"Error: 'js' folder not found at {js_folder}", file=sys.stderr)
        sys.exit(1)

    # List all .js files in the js folder (non-recursive).
    js_files = [
        filename 
        for filename in os.listdir(js_folder) 
        if filename.endswith('.js') and os.path.isfile(os.path.join(js_folder, filename))
    ]
    js_files.sort()  # Sort files alphabetically.

    with open(dump_file, 'w', encoding='utf-8') as dump:
        for filename in js_files:
            file_path = os.path.join(js_folder, filename)
            dump.write(f"// ===== Start of {filename} =====\n")
            with open(file_path, 'r', encoding='utf-8') as f:
                dump.write(f.read())
                dump.write("\n")
            dump.write(f"// ===== End of {filename} =====\n\n")

    print(f"Dumped {len(js_files)} files into {dump_file}")

if __name__ == "__main__":
    main()
