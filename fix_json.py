# fix_json.py - Fix unescaped double quotes in annotation.json
import json

with open('data/work_003/annotation.json', 'r', encoding='utf-8') as f:
    raw = f.read()

# The file has raw ASCII double quotes inside JSON string values
# We need to carefully fix the formal fields
# Strategy: parse line by line and escape internal quotes

fixed_lines = []
for line in raw.splitlines():
    stripped = line.strip()
    # Process value lines (formal, perception, aesthetic, guideText etc.)
    if stripped.startswith('"formal"') or stripped.startswith('"perception"') or stripped.startswith('"aesthetic"') or stripped.startswith('"guideText"'):
        # Find the colon separator, then fix the value part
        colon_idx = line.index(':')
        key_part = line[:colon_idx + 1]
        val_part = line[colon_idx + 1:].strip()
        
        # val_part starts with " and ends with ", or ",
        # Strip trailing comma
        trailing_comma = val_part.endswith(',')
        if trailing_comma:
            val_part = val_part[:-1].strip()
        
        # Now val_part should be a JSON string: "..."
        # The outer quotes are the first and last "
        if val_part.startswith('"') and val_part.endswith('"'):
            inner = val_part[1:-1]
            # Escape any unescaped internal double quotes
            inner_fixed = inner.replace('"', '\\"')
            val_part = '"' + inner_fixed + '"'
        
        line = key_part + ' ' + val_part + (',' if trailing_comma else '')
    
    fixed_lines.append(line)

fixed = '\n'.join(fixed_lines)

# Validate
try:
    data = json.loads(fixed)
    print(f'JSON valid! {len(data["annotations"])} annotations')
    with open('data/work_003/annotation.json', 'w', encoding='utf-8') as f:
        f.write(fixed)
    print('Saved successfully')
except json.JSONDecodeError as e:
    print(f'Still broken: {e}')
    # Show the problematic area
    lines = fixed.splitlines()
    err_line = e.lineno - 1
    for i in range(max(0, err_line-2), min(len(lines), err_line+3)):
        print(f'  {i+1}: {lines[i]}')
