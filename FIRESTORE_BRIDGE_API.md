# Firestore Bridge API Documentation

## Overview

The Firestore Bridge provides a unified interface for LSL scripts to access Firestore data. All Firestore communication should go through the Firestore Bridge via link messages - **no scripts should make direct HTTP requests to Firestore**.

## Architecture

```
[LSL Scripts] 
    ↓ (link_message)
[Firestore Bridge] 
    ↓ (llHTTPRequest)
[Firestore REST API]
```

## API Reference

### Individual Field Requests (Recommended)

Request individual fields using specific link messages. Each request returns only the requested field, avoiding HTTP response truncation.

#### Available Field Requests

Send these messages via `llMessageLinked(LINK_SET, 0, "messageName", "")`:

- **`getClass`** or **`getClass_id`** → Returns `class_id` field
- **`getStats`** → Returns `stats` field (mapValue with 20 stat values)
- **`getGender`** → Returns `gender` field
- **`getSpecies`** or **`getSpecies_id`** → Returns `species_id` field
- **`getHasMana`** or **`getHas_mana`** → Returns `has_mana` field
- **`getHealth`** → Returns `health` field (mapValue with current/base/max)
- **`getStamina`** → Returns `stamina` field (mapValue with current/base/max)
- **`getMana`** → Returns `mana` field (mapValue with current/base/max)
- **`getXP`** or **`getXP_total`** → Returns `xp_total` field
- **`getSpeciesFactors`** or **`getSpecies_factors`** → Returns `species_factors` field (mapValue)

#### Response Format

The Firestore Bridge responds with a link message where:
- **`msg`** = The field name (e.g., `"class_id"`, `"stats"`, `"health"`)
- **`id`** = The extracted value as a string

For complex objects (mapValue), the value is the `fields` object from Firestore's format.

#### Error Responses

If a field request fails, the Bridge sends:
- **`msg`** = `"fieldName_ERROR"` (e.g., `"class_id_ERROR"`)
- **`id`** = Error message string

### Full Character Load (Deprecated)

The `firestore_load` message is deprecated. Use individual field requests instead.

**Old approach (deprecated):**
```lsl
llMessageLinked(LINK_SET, 0, "firestore_load", "");
// Waits for CHARACTER_DATA response with full character JSON
```

**New approach (recommended):**
```lsl
llMessageLinked(LINK_SET, 0, "getClass", "");
llMessageLinked(LINK_SET, 0, "getStats", "");
llMessageLinked(LINK_SET, 0, "getHealth", "");
// ... etc
// Each field arrives independently as separate link messages
```

### Saving Data

Send character data updates to Firestore:

**Message:** `firestore_save`
**Data:** Pipe-delimited format in the `id` parameter
```lsl
string syncData = 
    "stats:" + llDumpList2String(stats, ",") + "|" +
    "health:" + llDumpList2String(healthData, ",") + "|" +
    "stamina:" + llDumpList2String(staminaData, ",") + "|" +
    "mana:" + llDumpList2String(manaData, ",") + "|" +
    "xp:" + xp + "|" +
    "class:" + class;

llMessageLinked(LINK_SET, 0, "firestore_save", syncData);
```

## Parsing Field Responses

### Simple String Fields

For fields like `class_id`, `gender`, `species_id`, `xp_total`, `has_mana`:

```lsl
link_message(integer sender_num, integer num, string msg, key id) {
    if (msg == "class_id") {
        string classId = (string)id;
        // classId is the direct value (e.g., "squire")
        saveToLSD(KEY_CLASS, classId);
    }
}
```

### Complex Objects (mapValue)

For fields like `stats`, `health`, `stamina`, `mana`, `species_factors`, the value is the `fields` JSON object from Firestore.

#### Stats Example

```lsl
if (msg == "stats") {
    string statsJson = (string)id;
    // statsJson format: {"0":{"integerValue":"2"},"1":{"integerValue":"2"},...}
    
    list statsList = [];
    integer i;
    for (i = 0; i < 20; i++) {
        string statKey = (string)i;
        string statField = llJsonGetValue(statsJson, [statKey]);
        if (statField != JSON_INVALID && statField != "") {
            string intVal = llJsonGetValue(statField, ["integerValue"]);
            if (intVal != JSON_INVALID && intVal != "") {
                statsList += [(integer)intVal];
            } else {
                statsList += [2];  // Default
            }
        } else {
            statsList += [2];  // Default
        }
    }
    saveStats(statsList);
}
```

#### Health/Stamina/Mana Example

```lsl
if (msg == "health") {
    string healthJson = (string)id;
    // healthJson format: {"current":{"integerValue":"100"},"base":{"integerValue":"100"},"max":{"integerValue":"100"}}
    
    string currentField = llJsonGetValue(healthJson, ["current"]);
    string baseField = llJsonGetValue(healthJson, ["base"]);
    string maxField = llJsonGetValue(healthJson, ["max"]);
    
    if (currentField != JSON_INVALID && baseField != JSON_INVALID && maxField != JSON_INVALID) {
        string current = llJsonGetValue(currentField, ["integerValue"]);
        string base = llJsonGetValue(baseField, ["integerValue"]);
        string max = llJsonGetValue(maxField, ["integerValue"]);
        
        if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
            saveResourcePool(KEY_HEALTH, (integer)current, (integer)base, (integer)max);
        }
    }
}
```

## Implementation Status

### ✅ Updated Scripts

- **Feudalism 4 - Players HUD Data Manager.lsl**
  - Uses individual field requests (`getClass`, `getStats`, etc.)
  - Handles field-level responses correctly
  - Keeps `CHARACTER_DATA` handler for MOAP backward compatibility only

- **Feudalism 4 - Players HUD Firestore Bridge.lsl**
  - Implements all individual field request handlers
  - Marks `firestore_load` and `loadCharacterData()` as deprecated
  - Continues to support full character load for backward compatibility

### ✅ No Changes Needed

- **Feudalism 4 - Combined HUD Controller.lsl** - No direct Firestore calls, uses Data Manager
- **Feudalism 4 - Players HUD Main.lsl** - No direct Firestore calls, uses Data Manager
- **Feudalism 4 - Players HUD UI Manager.lsl** - No Firestore calls

### 📝 Test Scripts (No Changes)

- **Firestore Class Lookup - Standalone.lsl** - Test script, can remain as-is
- **Firestore Field Lookup - Standalone.lsl** - Test script, can remain as-is

## Best Practices

1. **Use Individual Field Requests**: Always prefer individual field requests over full character loads
2. **Handle Responses Asynchronously**: Field responses arrive independently - don't assume order
3. **Check for Errors**: Always handle `fieldName_ERROR` responses
4. **Use Field Masks**: The Bridge automatically uses Firestore field masks to reduce response size
5. **Avoid Direct HTTP Calls**: Never use `llHTTPRequest` to call Firestore directly - always use the Bridge

## Migration Guide

If you have scripts using the old `firestore_load` approach:

### Before
```lsl
llMessageLinked(LINK_SET, 0, "firestore_load", "");

// In link_message:
if (msg == "CHARACTER_DATA") {
    string jsonData = (string)id;
    // Parse entire JSON object...
}
```

### After
```lsl
// Request individual fields
llMessageLinked(LINK_SET, 0, "getClass", "");
llMessageLinked(LINK_SET, 0, "getStats", "");
llMessageLinked(LINK_SET, 0, "getHealth", "");
// ... etc

// In link_message:
if (msg == "class_id") {
    string classId = (string)id;
    saveToLSD(KEY_CLASS, classId);
}
else if (msg == "stats") {
    // Parse stats field...
}
// ... handle each field separately
```

## Configuration

The Firestore Bridge requires `FIREBASE_PROJECT_ID` to be set in `Feudalism 4 - Players HUD Firestore Bridge.lsl`:

```lsl
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
```

Ensure this matches your Firebase project ID.

