# LSL Syntax Rules and Restrictions

## Critical Rules - MUST FOLLOW

### 1. NO Ternary Operators
**❌ FORBIDDEN:**
```lsl
string value = condition ? "yes" : "no";
integer x = (a > b) ? a : b;
```

**✓ CORRECT:**
```lsl
string value;
if (condition) {
    value = "yes";
} else {
    value = "no";
}

integer x;
if (a > b) {
    x = a;
} else {
    x = b;
}
```

### 2. NO continue or break Statements
**❌ FORBIDDEN:**
```lsl
for (i = 0; i < 10; i++) {
    if (i == 5) continue;
    if (i == 8) break;
}
```

**✓ CORRECT:**
Use `jump` labels or restructure logic:
```lsl
integer i = 0;
while (i < 10) {
    if (i == 5) {
        i++;
        jump nextIteration;
    }
    if (i == 8) {
        jump done;
    }
    // ... do work ...
    @nextIteration;
    i++;
}
@done;
```

### 3. Reserved Keywords Cannot Be Variable Names
**❌ FORBIDDEN:**
```lsl
key key = llGetOwner();
string string = "value";
list list = [];
integer integer = 5;
```

**✓ CORRECT:**
```lsl
key ownerKey = llGetOwner();
string valueString = "value";
list dataList = [];
integer count = 5;
```

**Common Reserved Words:**
- `key`, `string`, `list`, `vector`, `rotation`, `integer`, `float`
- `default`, `state`, `if`, `else`, `for`, `while`, `do`, `jump`
- `return`, `llGetOwner`, and all LSL built-in functions

### 4. All Functions Must Be Defined BEFORE default State
**❌ FORBIDDEN:**
```lsl
default {
    state_entry() {
        myFunction();
    }
}

myFunction() {
    // This will cause a compile error!
}
```

**✓ CORRECT:**
```lsl
myFunction() {
    // Function defined before default state
}

default {
    state_entry() {
        myFunction();
    }
}
```

### 5. String Concatenation in Global Variable Declarations
**❌ FORBIDDEN:**
```lsl
string BASE_URL = "https://api.example.com";
string FULL_URL = BASE_URL + "/endpoint";  // ERROR!
```

**✓ CORRECT:**
```lsl
string BASE_URL = "https://api.example.com";
string FULL_URL;  // Declare empty

default {
    state_entry() {
        FULL_URL = BASE_URL + "/endpoint";  // Build in state_entry or function
    }
}
```

### 6. JSON Functions
- Use `llJsonGetValue` to navigate JSON structures
- JSON paths use list syntax: `llJsonGetValue(jsonString, ["field1", "field2"])`
- Check for `JSON_INVALID` to test if a value exists
- `llJsonSetValue` can be used to modify JSON (returns new JSON string)

### 7. HTTP Response Size Limit
- LSL truncates HTTP responses at **2048 characters**
- Use field masks in Firestore queries to retrieve only needed fields
- For large responses, request specific fields separately

### 8. Variable Declaration Order
- Global variables must be declared at the top of the script
- Local variables can be declared at the start of functions
- Variables cannot be redeclared in the same scope

### 9. Function Return Types
- Functions can return: `string`, `integer`, `float`, `vector`, `rotation`, `list`, `key`
- Functions that don't return a value have no return type specified
- Use `return` statement to exit function early (if supported in context)

### 10. List Operations
- Lists are 0-indexed
- Use `llList2String(list, index)` to get elements (cast to appropriate type)
- Use `llGetListLength(list)` to get size
- Lists are immutable - operations return new lists

## Common Patterns

### Safe String Comparison
```lsl
if (value == JSON_INVALID || value == "") {
    // Handle missing/invalid value
}
```

### Safe List Access
```lsl
if (llGetListLength(myList) > index) {
    string value = llList2String(myList, index);
}
```

### Loop with Jump Label
```lsl
integer i = 0;
while (i < llGetListLength(list)) {
    if (someCondition) {
        i++;
        jump nextIteration;
    }
    // ... process ...
    @nextIteration;
    i++;
}
```

## References
- LSL Wiki: http://wiki.secondlife.com/wiki/LSL_Portal
- LSL Functions: http://wiki.secondlife.com/wiki/Category:LSL_Functions

