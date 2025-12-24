#!/usr/bin/env python3
"""
ES6 to ES5 Converter for app.js
Converts ES6+ syntax to ES5 for Second Life MOAP browser compatibility
"""

import re
import sys

def convert_es6_to_es5(content):
    """Convert ES6+ syntax to ES5"""
    
    # Track changes
    changes = []
    
    # 1. Convert shorthand methods to ES5 function syntax
    # init() { -> init: function() {
    def replace_shorthand_method(match):
        indent = match.group(1)
        method_name = match.group(2)
        return f"{indent}{method_name}: function() {{"
    
    original = content
    content = re.sub(r'(\s+)(\w+)\(\)\s*\{', replace_shorthand_method, content)
    if content != original:
        changes.append("Converted shorthand methods")
    
    # 2. Convert default parameters
    # function(param = 'default') -> function(param)  with param = param || 'default'; inside
    # This is complex, so we'll handle specific cases manually
    
    # 3. Convert const/let to var
    original = content
    content = re.sub(r'\bconst\s+', 'var ', content)
    content = re.sub(r'\blet\s+', 'var ', content)
    if content != original:
        changes.append("Converted const/let to var")
    
    # 4. Convert simple arrow functions
    # () => { -> function() {
    original = content
    content = re.sub(r'\(\)\s*=>\s*\{', 'function() {', content)
    # (param) => { -> function(param) {
    content = re.sub(r'\((\w+)\)\s*=>\s*\{', r'function(\1) {', content)
    # (a, b) => { -> function(a, b) {
    content = re.sub(r'\(([^)]+)\)\s*=>\s*\{', r'function(\1) {', content)
    if content != original:
        changes.append("Converted arrow functions")
    
    # 5. Convert optional chaining (careful with this one)
    # obj?.prop -> (obj && obj.prop)
    original = content
    content = re.sub(r'(\w+)\?\.(\w+)', r'(\1 && \1.\2)', content)
    if content != original:
        changes.append("Converted optional chaining")
    
    # 6. Convert template literals to string concatenation
    # This is the most complex - we'll do simple cases
    def convert_template_literal(match):
        template = match.group(1)
        # Split by ${...} expressions
        parts = re.split(r'\$\{([^}]+)\}', template)
        result_parts = []
        for i, part in enumerate(parts):
            if i % 2 == 0:  # String part
                if part:
                    result_parts.append(f'"{part}"')
            else:  # Expression part
                result_parts.append(f'({part})')
        return ' + '.join(result_parts) if result_parts else '""'
    
    original = content
    # Match template literals (simple cases without nested backticks)
    content = re.sub(r'`([^`]+)`', lambda m: convert_template_literal(m), content)
    if content != original:
        changes.append("Converted template literals")
    
    return content, changes

def main():
    file_path = r"d:\Documents\My LSL Scripts\Feudalism RPG 4\MOAP Interface\js\app.js"
    
    print("Reading app.js...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("Converting ES6 to ES5...")
    converted, changes = convert_es6_to_es5(content)
    
    print(f"\nMade {len(changes)} types of changes:")
    for change in changes:
        print(f"  - {change}")
    
    print(f"\nWriting converted file...")
    with open(file_path, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(converted)
    
    print("Done!")

if __name__ == "__main__":
    main()
