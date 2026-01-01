# Bridge Refactoring Guide

## Overview
The monolithic Firestore Bridge (~1552 lines) has been refactored into a modular, dispatcher-based architecture to avoid stack/heap issues.

## Architecture

### Bridge_Main.lsl (Dispatcher)
- Entry point for all HUD communication
- Routes commands to appropriate modules via link_message
- Listens on INVENTORY_CHANNEL for world object messages
- Contains NO Firestore logic

### Module Scripts
Each module:
- Listens for routed commands from Bridge_Main on MODULE_CHANNEL
- Executes domain-specific Firestore logic
- Sends responses directly to original sender via FS_BRIDGE_CHANNEL
- Maintains its own request tracking lists

## Module Responsibilities

### Bridge_Characters.lsl
- Character field gets (getStats, getHealth, etc.)
- GET_ACTIVE_CHARACTER
- SET_ACTIVE_CHARACTER
- fetchFullCharacterDocument
- getCharacterInfo

### Bridge_Inventory.lsl
- getInventory, getInventoryPage
- applyInventoryDeltas
- updateInventory
- fGiveItem/fTakeItem handling
- Inventory HTTP response handlers

### Bridge_Stipends.lsl
- GET_STIPEND_DATA
- UPDATE_LAST_PAID
- GET_STIPEND_CLASS handler

### Bridge_Universes.lsl
- IS_BANNED
- IS_BANNED HTTP response handler

### Bridge_Classes.lsl
- Class document reads (currently only used by stipends)
- Can be extended for future class operations

### Bridge_Utils.lsl
- Shared constants and helper functions
- extractFirestoreValue
- getUUIDToUse
- normalizeItemName
- cleanupTrackingList
- getFirestoreBase

## Migration Notes

1. **Request Tracking**: Each module maintains its own `pendingRequests` or `pendingInventoryUpdates` list
2. **HTTP Responses**: Modules handle their own HTTP responses
3. **Module Communication**: Modules can communicate via MODULE_CHANNEL if needed
4. **Backward Compatibility**: All HUD commands work exactly as before

## Implementation Status

✅ **COMPLETED:**
- Bridge_Utils.lsl - Shared utilities and constants
- Bridge_Main.lsl - Dispatcher/router
- Bridge_Characters.lsl - Character operations (field gets, active character)
- Bridge_Inventory.lsl - Inventory operations (read, write, pagination, fGiveItem/fTakeItem)
- Bridge_Stipends.lsl - Stipend operations (GET_STIPEND_DATA, UPDATE_LAST_PAID)
- Bridge_Universes.lsl - Universe operations (IS_BANNED)
- Bridge_Classes.lsl - Class operations (placeholder, can be extended)

## Module File Sizes

- Bridge_Main.lsl: ~150 lines (dispatcher only)
- Bridge_Characters.lsl: ~400 lines
- Bridge_Inventory.lsl: ~550 lines
- Bridge_Stipends.lsl: ~250 lines
- Bridge_Universes.lsl: ~180 lines
- Bridge_Classes.lsl: ~60 lines (minimal)
- Bridge_Utils.lsl: ~100 lines

**Total: ~1690 lines** (vs 1552 in monolithic, but now modular and maintainable)

## Deployment Instructions

1. **Remove old script:**
   - Delete or rename: `Feudalism 4 - Players HUD Firestore Bridge.lsl`

2. **Install new modules:**
   - Add all 7 Bridge_*.lsl scripts to the same linkset
   - Ensure Bridge_Main.lsl is present (required for routing)

3. **Verify HUD compatibility:**
   - All existing HUD commands work exactly as before
   - No changes needed to HUD code
   - External API remains unchanged

4. **Test each domain:**
   - Characters: Field gets, active character selection
   - Inventory: Page loading, item add/remove, fGiveItem/fTakeItem
   - Stipends: GET_STIPEND_DATA, UPDATE_LAST_PAID
   - Universes: IS_BANNED checks

## Architecture Benefits

- **Reduced stack/heap pressure:** Each module is ~60-550 lines (vs 1552 monolithic)
- **Maintainability:** Clear separation of concerns
- **Extensibility:** New features can be added to appropriate module
- **Backward compatibility:** HUD API unchanged
- **Modular testing:** Each domain can be tested independently

