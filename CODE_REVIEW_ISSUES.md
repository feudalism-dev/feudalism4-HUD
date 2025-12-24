# Feudalism 4 HUD Code Review - Issues Found

## Critical Issues

### 1. **Rotation Value Incorrect** (Combined HUD Controller) ✅ FIXED
**Location**: Line 144
**Issue**: Code uses `PI_BY_TWO` (90 degrees) but should use `-PI_BY_TWO` (-90 degrees) or `3*PI_BY_TWO` (270 degrees).
**Verified**: User confirmed Z = 0 shows Players HUD, Z = -90 or 270 shows Setup HUD.
**Status**: Fixed - changed to `-PI_BY_TWO`

### 2. **Duplicate Functionality** (Combined HUD Controller vs Players HUD Main)
**Location**: Multiple locations
**Issue**: Both scripts have:
- `calculateHealth()`, `calculateStamina()`, `calculateMana()` functions
- `updateResourceDisplays()` function
- Resource pool variables (currentHealth, baseHealth, etc.)
- Link message handlers for "stats loaded", "health loaded", etc.

**Problem**: This creates confusion about which script handles what, and can cause duplicate updates or conflicts.

**Recommendation**: 
- Combined HUD Controller should ONLY handle:
  - Rotation logic
  - MOAP communication
  - Forwarding messages between components
- Players HUD Main should handle:
  - All game logic
  - Resource calculations
  - Display updates

### 3. **Broken Sync Handler** (Data Manager)
**Location**: Line 306-313
**Issue**: The "sync to firestore" message handler just returns without doing anything:
```lsl
else if (msg == "sync to firestore") {
    // Forward sync request to Combined HUD Controller
    string syncData = (string)id;
    // The Combined HUD Controller listens for this and forwards to MOAP
    // For now, we'll handle it in the Combined HUD Controller's link_message
    return;  // <-- DOES NOTHING!
}
```

**Fix Needed**: This handler should forward the sync data to Combined HUD Controller, but it's currently in the Data Manager's link_message handler, which means it's receiving its own message. The Combined HUD Controller should be the one calling `syncToFirestore()` in Data Manager, not the other way around.

**Correct Flow**:
1. Data Manager's `syncToFirestore()` function sends "sync to firestore" message with data
2. Combined HUD Controller receives it and forwards to MOAP
3. Data Manager should NOT handle its own "sync to firestore" message

## Logic Issues

### 4. **Race Condition in Auto-Hide Logic** (Combined HUD Controller)
**Location**: Lines 309-316, 482-509
**Issue**: The auto-hide flag is set in `attach()`, but the check happens in `link_message()` when "character loaded from firestore" is received. If the character data loads before the flag is set, or if there's a delay, the auto-hide won't work.

**Fix**: Ensure the flag is set before any data loading begins, and add a timeout fallback.

### 5. **Missing Validation in Resource Calculations** (Both scripts)
**Location**: calculateHealth(), calculateStamina(), calculateMana()
**Issue**: These functions don't check if `myStats` list is valid before accessing it. If stats haven't loaded yet, `llList2Integer()` will return 0, causing incorrect calculations.

**Fix**: Add validation:
```lsl
if (llGetListLength(myStats) != 20) {
    return;  // Don't calculate if stats aren't loaded
}
```

### 6. **Incorrect Base Health/Mana/Stamina Parsing** (Combined HUD Controller)
**Location**: Lines 332-368
**Issue**: The code parses base and max, but then uses max if available:
```lsl
baseHealth = (integer)llList2String(parts, 0);
integer maxHealth = (integer)llList2String(parts, 1);
if (maxHealth > 0) baseHealth = maxHealth;  // Uses max, not base!
```

**Problem**: This overwrites base with max, which might not be intended. The variable should probably be named `maxHealth` and used separately, or the logic should be clarified.

### 7. **Missing Error Handling for MOAP Prim** (Combined HUD Controller)
**Location**: Multiple locations
**Issue**: If `moapPrimLink` is -1 (not found), many functions will silently fail or cause errors. The script warns once but continues.

**Fix**: Add checks in `showSetupHUD()`, `hideSetupHUD()`, `setMOAPUrl()`, etc. to return early if prim not found.

## Communication Issues

### 8. **Circular Message Flow** (Data Manager)
**Location**: Line 97, 306-313
**Issue**: `syncToFirestore()` sends "sync to firestore" message, but the Data Manager's own `link_message` handler receives it and does nothing. The Combined HUD Controller should be listening for this message, not Data Manager.

**Fix**: Remove the handler from Data Manager, or change the message name to avoid conflict.

### 9. **Missing Message Forwarding** (Combined HUD Controller)
**Location**: Line 400-412
**Issue**: The "sync to firestore" handler receives data and forwards to MOAP, but if MOAP isn't active, it activates it. However, there's no guarantee the MOAP will be ready to receive the message after the 1-second sleep.

**Fix**: Add a callback mechanism or retry logic to ensure MOAP receives the sync data.

### 10. **Inconsistent Message Format** (Multiple scripts)
**Issue**: Some messages use `num` parameter for data, others use `id` parameter. Some use pipe-delimited strings, others use CSV. This can cause parsing errors.

**Examples**:
- "health loaded": uses `num` for current, `id` for "base|max"
- "save health": uses `num` for current, `id` for "base|max"
- But format might not match between scripts

## Minor Issues

### 11. **Unused Variables** (Combined HUD Controller)
**Location**: Lines 59-63
**Issue**: `mode`, `isResting`, `isPassedOut`, `timerCount` are declared but never used in Combined HUD Controller (they're used in Players HUD Main).

**Fix**: Remove unused variables or move them to Players HUD Main.

### 12. **Missing Timer Cleanup** (Combined HUD Controller)
**Issue**: No timer is set up, but if one were added, there's no cleanup in `attach()` when HUD is detached.

### 13. **Hardcoded Face Number** (UI Manager)
**Location**: Line 222
**Issue**: XP bar uses face 4 hardcoded, but other displays use ALL_SIDES. Should be consistent or configurable.

### 14. **Potential Memory Leak** (UI Manager)
**Location**: Lines 13-16
**Issue**: Menu listeners are created but might not be cleaned up if script resets during menu display.

## Recommendations

1. **Separate Concerns**: Clearly define which script handles what:
   - Combined HUD Controller: Rotation, MOAP, message routing
   - Players HUD Main: Game logic, calculations, state
   - Data Manager: Storage, sync coordination
   - UI Manager: Visual display only

2. **Fix Rotation**: Test different rotation axes to find which one correctly shows face 4. Consider using relative rotation from current position rather than absolute.

3. **Add Error Handling**: Validate all inputs, check for prim existence, handle edge cases.

4. **Standardize Messages**: Create a message format specification document and ensure all scripts follow it.

5. **Add Debug Logging**: Add more detailed logging to trace message flow and identify issues.

6. **Test Rotation**: The user mentioned rotating to show different faces is common. Verify the rotation actually shows face 4 when rotated 90°.

