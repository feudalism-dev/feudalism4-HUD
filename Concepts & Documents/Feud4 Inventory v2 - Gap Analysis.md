# Feud4 Inventory v2 – Gap Analysis & Migration Plan

## Executive Summary

This document provides a comprehensive analysis of the changes required to migrate Feudalism 4's inventory system from a **map field** on the character document (`characters/{characterId}.inventory`) to a **subcollection** model (`characters/{characterId}/inventory/{itemId}`).

### Target Model Overview

**Current Model (v1):**
- Inventory stored as a map field: `characters/{characterId}.inventory = {apple: 10, banana: 5}`
- Entire inventory fetched as single JSON blob
- LSL memory pressure and truncation issues
- No true pagination support

**Target Model (v2):**
- Inventory stored as subcollection: `characters/{characterId}/inventory/{itemId}`
- Each item type = one document with `qty` field
- Firestore-level pagination via `runQuery` with `startAfter` cursors
- Scalable reads/writes, no full inventory in memory

**Key API Contracts:**
- **Read:** `getInventoryPage` with `cursor` and `pageSize` → returns `{items: [{name, qty}], cursor, hasMore}`
- **Write:** `applyInventoryDeltas` with `{itemNames: [...], deltas: [...]}` → atomic increments via `documents:commit`

---

## 1. Firestore Bridge (`Feudalism 4 - Players HUD Firestore Bridge.lsl`)

### File Path
`LSL Scripts/Feudalism 4 - Players HUD Firestore Bridge.lsl`

### Current Behavior and Assumptions

#### 1.1. Read Paths

**Function: `getInventoryPage(string characterId, integer page, integer pageSize, integer senderLink)`**
- **Lines:** 143-174
- **Current behavior:**
  - Uses GET request with field mask: `?mask.fieldPaths=inventory`
  - Fetches entire `inventory` map field from character document
  - Returns raw CSV string: `banana,11,apple,2`
- **Assumptions:**
  - Inventory is a map field on character document
  - Entire inventory can be fetched in one request
  - CSV format is sufficient (no pagination metadata)
- **Required changes:**
  - Replace GET with POST to `documents:runQuery`
  - Query subcollection: `characters/{characterId}/inventory`
  - Use `startAfter` cursor for pagination (not numeric `page`)
  - Parse query results as array of documents
  - Extract `itemId` from document name (last segment of path)
  - Extract `qty` from `fields.qty.integerValue`
  - Build JSON response: `{items: [{name, qty}], cursor, hasMore}`
  - Send JSON (not CSV) to HUD
- **Risk level:** **HIGH** - Core read path, affects all inventory displays

**Function: `getInventoryFromFirestore(integer senderLink)`**
- **Lines:** 119-135
- **Current behavior:**
  - Gets character ID first, then uses `getFieldByUUID` to fetch `inventory` field
  - Sends `inventory` message with map JSON
- **Assumptions:**
  - Inventory is a field on character document
  - Full inventory can be sent in one message
- **Required changes:**
  - **DEPRECATE** or redirect to `getInventoryPage` with `cursor=""`, `pageSize=9999`
  - Or remove entirely if no callers remain
- **Risk level:** **MEDIUM** - May be legacy/unused

**HTTP Response Handler: `GET_INVENTORY_PAGE`**
- **Lines:** 798-1020
- **Current behavior:**
  - Parses Firestore response as raw string
  - Extracts inventory map from `fields.inventory.mapValue.fields`
  - Builds CSV string via string manipulation
  - Sends CSV to HUD via `inventoryPage` message
- **Assumptions:**
  - Response contains `inventory` map field
  - String parsing can extract item names and quantities
  - CSV format is acceptable
- **Required changes:**
  - Parse `runQuery` response structure (array of documents)
  - Extract document names and `qty` fields
  - Build JSON response object
  - Send JSON (not CSV) to HUD
- **Risk level:** **HIGH** - Critical parsing logic

#### 1.2. Write Paths

**Function: `applyInventoryDeltas(string characterId, string deltasJson)`**
- **Lines:** 310-416
- **Current behavior:**
  - Parses `deltasJson` with `itemNames` and `deltas` arrays
  - Builds `fieldTransforms` with `fieldPath: "inventory.{itemName}"`
  - Uses `documents:commit` with transforms on character document
- **Assumptions:**
  - Inventory is a map field on character document
  - Field path format: `inventory.{itemName}`
  - Atomic increments work on nested map fields
- **Required changes:**
  - Change `fieldPath` from `"inventory.{itemName}"` to subcollection document path
  - For each delta:
    - If document exists: use transform with `increment` on `qty`
    - If document doesn't exist and `delta > 0`: create document with `qty = delta`, `last_updated = timestamp`
    - If document doesn't exist and `delta <= 0`: skip or create with `qty = 0` (policy TBD)
  - Use `documents:commit` with multiple writes (transforms + creates)
  - Document path: `projects/{project}/databases/(default)/documents/characters/{characterId}/inventory/{itemName}`
- **Risk level:** **HIGH** - Core write path, affects all inventory updates

**Function: `sendInventoryIncrement(string characterId, string itemName, integer delta)`**
- **Lines:** 253-306
- **Current behavior:**
  - Single-item atomic increment
  - Uses `fieldPath: "inventory.{itemName}"` on character document
- **Assumptions:**
  - Same as `applyInventoryDeltas` (map field assumption)
- **Required changes:**
  - **DEPRECATE** or redirect to `applyInventoryDeltas` with single-item delta
  - Or rewrite to use subcollection document path
- **Risk level:** **MEDIUM** - May be legacy/unused

**Function: `updateInventory(string itemName, integer qty, string operation)`**
- **Lines:** 422-451
- **Current behavior:**
  - Gets character ID, then calls `sendInventoryIncrement`
- **Assumptions:**
  - Depends on `sendInventoryIncrement` behavior
- **Required changes:**
  - Update to use `applyInventoryDeltas` or new subcollection increment
- **Risk level:** **MEDIUM** - Used by world objects (`fGiveItem`/`fTakeItem`)

#### 1.3. Link Message Handlers

**Handler: `"getInventoryPage"`**
- **Lines:** 557-592
- **Current behavior:**
  - Parses JSON payload: `{characterId, page, pageSize}`
  - Calls `getInventoryPage(characterId, page, pageSize, sender_num)`
- **Assumptions:**
  - Payload uses numeric `page` (not cursor)
- **Required changes:**
  - Update payload parsing to accept `cursor` (optional, defaults to `""`)
  - Pass `cursor` to `getInventoryPage` instead of `page`
  - Update function signature if needed
- **Risk level:** **MEDIUM** - Interface change, but straightforward

**Handler: `"applyInventoryDeltas"`**
- **Lines:** 596-614
- **Current behavior:**
  - Parses payload: `{characterId, deltas: {itemNames: [...], deltas: [...]}}`
  - Calls `applyInventoryDeltas(characterId, deltasFullJson)`
- **Assumptions:**
  - Payload format is correct (already matches target)
- **Required changes:**
  - **NONE** - Payload format is already correct
  - Only internal `applyInventoryDeltas` function needs changes
- **Risk level:** **LOW** - Interface unchanged

**Handler: `"getInventory"`**
- **Lines:** 553-554
- **Current behavior:**
  - Calls `getInventoryFromFirestore(sender_num)`
- **Assumptions:**
  - Legacy handler
- **Required changes:**
  - **DEPRECATE** or redirect to `getInventoryPage` with default pagination
- **Risk level:** **LOW** - May be unused

---

## 2. HUD Inventory Controller (`Feudalism 4 - HUD Inventory Controller.lsl`)

### File Path
`LSL Scripts/Feudalism 4 - HUD Inventory Controller.lsl`

### Current Behavior and Assumptions

#### 2.1. Inventory Request Functions

**Function: `showViewItemsDialog(string inventoryJson)`**
- **Lines:** 79-94
- **Current behavior:**
  - Deprecated, but still requests `getInventoryPage` from Bridge
  - Uses payload: `{characterId, page: 0, pageSize: 20}`
- **Assumptions:**
  - Numeric `page` parameter
- **Required changes:**
  - Update to use `cursor: ""` instead of `page: 0`
  - Handle `hasMore` flag for next page navigation
- **Risk level:** **LOW** - Already deprecated, minimal impact

**Function: `showViewItemsDialogFromLists(list itemNames, list itemQuantities)`**
- **Lines:** 97-130
- **Current behavior:**
  - Displays inventory items in dialog
  - Takes pre-parsed lists (from CSV parsing)
- **Assumptions:**
  - Receives lists from CSV parsing
  - No pagination UI (single page display)
- **Required changes:**
  - Accept JSON structure: `{items: [{name, qty}], cursor, hasMore}`
  - Extract `items` array and build lists
  - Add "Next Page" button if `hasMore == true`
  - Store `cursor` for next page request
- **Risk level:** **MEDIUM** - UI changes needed

#### 2.2. Inventory Response Handlers

**Handler: `"inventoryPage"` (link_message)**
- **Lines:** 335-392
- **Current behavior:**
  - Receives CSV string: `banana,11,apple,2`
  - Parses CSV into `itemNames` and `itemQuantities` lists
  - Calls `showViewItemsDialogFromLists` or `checkItemQuantityForDropFromLists`
- **Assumptions:**
  - Message body is CSV string
  - No pagination metadata
- **Required changes:**
  - Parse JSON instead of CSV: `{items: [{name, qty}], cursor, hasMore}`
  - Extract `items` array
  - Build `itemNames` and `itemQuantities` lists from `items`
  - Store `cursor` and `hasMore` for pagination
  - Update UI to show "Next Page" if `hasMore == true`
- **Risk level:** **HIGH** - Core parsing logic, affects all inventory displays

**Handler: `"inventory loaded"` (link_message)**
- **Lines:** 220-245
- **Current behavior:**
  - Requests `getInventoryPage` when inventory is loaded
  - Uses `page: 0, pageSize: 20` or `pageSize: 9999` for drop flow
- **Assumptions:**
  - Numeric `page` parameter
- **Required changes:**
  - Update to use `cursor: ""` instead of `page: 0`
  - For drop flow, may need to fetch all items (consider cursor-based iteration)
- **Risk level:** **MEDIUM** - Initial load path

#### 2.3. Drop Item Flow

**Function: `checkItemQuantityForDropFromLists(integer availableQty)`**
- **Lines:** 132-159
- **Current behavior:**
  - Checks if item exists in current page
  - Uses `availableQty` from parsed lists
- **Assumptions:**
  - Item is in current page
  - No pagination needed for drop flow
- **Required changes:**
  - If item not found in current page and `hasMore == true`, request next page
  - Or: request specific item via new `getInventoryItem` API (if added)
  - Or: fetch all items for drop flow (cursor-based iteration)
- **Risk level:** **MEDIUM** - Drop flow may need full inventory scan

**Function: `startDropItemFlow()`**
- **Lines:** 162-183
- **Current behavior:**
  - Requests text input for item name
  - Then requests inventory page with `pageSize: 9999`
- **Assumptions:**
  - Can fetch all items in one request
- **Required changes:**
  - Use cursor-based iteration to fetch all items
  - Or: add `getInventoryItem(characterId, itemName)` API for single-item lookup
- **Risk level:** **MEDIUM** - Drop flow needs item lookup

#### 2.4. Delta Management

**Function: `updateInventoryDelta(string itemName, integer delta)`**
- **Lines:** 41-46
- **Current behavior:**
  - Sends delta to `InventoryCache` via link message
- **Assumptions:**
  - Delta cache format unchanged
- **Required changes:**
  - **NONE** - Delta cache interface unchanged
- **Risk level:** **LOW** - No changes needed

**Function: `flushInventoryDeltas()`**
- **Lines:** 49-52
- **Current behavior:**
  - Requests deltas from `InventoryCache`
  - Receives `CACHE_DELTAS` response
- **Assumptions:**
  - Cache format unchanged
- **Required changes:**
  - **NONE** - Cache interface unchanged
- **Risk level:** **LOW** - No changes needed

**Handler: `"CACHE_DELTAS"` (link_message)**
- **Lines:** 262-282
- **Current behavior:**
  - Receives JSON: `{itemNames: [...], deltas: [...]}`
  - Builds payload: `{characterId, deltas: {...}}`
  - Sends `applyInventoryDeltas` to Bridge
- **Assumptions:**
  - Payload format matches Bridge expectations
- **Required changes:**
  - **NONE** - Payload format already correct
- **Risk level:** **LOW** - No changes needed

---

## 3. InventoryCache (`InventoryCache.lsl`)

### File Path
`LSL Scripts/InventoryCache.lsl`

### Current Behavior and Assumptions

**Handler: `"CACHE_ADD_DELTA"`**
- **Lines:** 22-51
- **Current behavior:**
  - Maintains parallel lists: `itemName[]` and `delta[]`
  - Accumulates deltas for same item
- **Assumptions:**
  - Item names are strings
  - Deltas are integers
- **Required changes:**
  - **NONE** - Cache logic is storage-agnostic
- **Risk level:** **LOW** - No changes needed

**Handler: `"CACHE_GET_DELTAS"`**
- **Lines:** 53-80
- **Current behavior:**
  - Returns JSON: `{itemNames: [...], deltas: [...]}`
- **Assumptions:**
  - Format matches Bridge expectations
- **Required changes:**
  - **NONE** - Format already correct
- **Risk level:** **LOW** - No changes needed

**Handler: `"CACHE_CLEAR"`**
- **Lines:** 81-85
- **Current behavior:**
  - Clears both lists
- **Assumptions:**
  - Simple clear operation
- **Required changes:**
  - **NONE** - No changes needed
- **Risk level:** **LOW** - No changes needed

---

## 4. Data Manager (`Feudalism 4 - Players HUD Data Manager.lsl`)

### File Path
`LSL Scripts/Feudalism 4 - Players HUD Data Manager.lsl`

### Current Behavior and Assumptions

**Handler: `"inventory"` (link_message)**
- **Lines:** 587-639
- **Current behavior:**
  - Receives inventory map JSON from Bridge
  - Parses map and writes individual LSD keys: `<characterId>_inventory_<itemName> = quantity`
  - Writes inventory list key: `<characterId>_inventory_list = "item1,item2,..."`
  - Sends `"inventory loaded"` message
- **Assumptions:**
  - Inventory arrives as map JSON
  - Full inventory can be stored in LSD
  - LSD keys are per-item
- **Required changes:**
  - **OPTION 1:** Remove inventory LSD storage entirely (inventory is now paginated, not full)
  - **OPTION 2:** Store only current page in LSD (with cursor)
  - **OPTION 3:** Keep LSD for caching, but update on each page load
  - **RECOMMENDATION:** Remove inventory LSD storage - inventory is now dynamic and paginated
  - Remove `"inventory loaded"` message or change semantics (page loaded, not full inventory)
- **Risk level:** **HIGH** - LSD storage model conflicts with pagination

**Note:** If inventory is no longer stored in LSD, other scripts that read from LSD will break. Need to identify all LSD readers.

---

## 5. Setup HUD JavaScript (`MOAP Interface/js/`)

### Files
- `api-firestore.js` (lines 2243-2362)
- `app.js` (lines 1066-1095)
- `ui.js` (lines 1485+)

### Current Behavior and Assumptions

#### 5.1. API Layer (`api-firestore.js`)

**Function: `getInventory(characterId)`**
- **Lines:** 2252-2298
- **Current behavior:**
  - Reads `characters/{characterId}` document
  - Extracts `inventory` field (map object)
  - Returns `{success: true, data: {inventory: {...}}}`
- **Assumptions:**
  - Inventory is a field on character document
  - Full inventory can be fetched in one read
  - Returns object map: `{itemName: quantity}`
- **Required changes:**
  - **OPTION 1:** Replace with paginated `getInventoryPage(characterId, cursor, pageSize)`
  - **OPTION 2:** Keep for backward compatibility, but add new `getInventoryPage` function
  - Query subcollection: `db.collection('characters').doc(characterId).collection('inventory')`
  - Use Firestore pagination: `.limit(pageSize).startAfter(cursor)`
  - Return: `{success: true, data: {items: [{name, qty}], cursor, hasMore}}`
- **Risk level:** **HIGH** - Core API function, used by UI

**Function: `getItemQuantity(name)`**
- **Lines:** 2304-2318
- **Current behavior:**
  - Calls `getInventory()`, then looks up item in map
- **Assumptions:**
  - Full inventory is available
- **Required changes:**
  - **OPTION 1:** Query specific document: `characters/{characterId}/inventory/{itemName}`
  - **OPTION 2:** Use `getInventoryPage` and search (inefficient)
  - **RECOMMENDATION:** Add direct document read for single-item lookup
- **Risk level:** **MEDIUM** - Used for item checks

**Function: `checkItems(items)`**
- **Lines:** 2325-2362
- **Current behavior:**
  - Calls `getInventory()`, then checks all items in map
- **Assumptions:**
  - Full inventory is available
- **Required changes:**
  - **OPTION 1:** Query multiple documents in batch
  - **OPTION 2:** Use `getInventoryPage` and iterate (may need multiple pages)
  - **RECOMMENDATION:** Use Firestore `whereIn` query if possible, or batch reads
- **Risk level:** **MEDIUM** - Used for crafting/recipe validation

#### 5.2. Application Layer (`app.js`)

**Function: `loadInventory()`**
- **Lines:** 1066-1095
- **Current behavior:**
  - Calls `API.getInventory(characterId)`
  - Passes result to `UI.renderInventory(inventory)`
- **Assumptions:**
  - `getInventory` returns full inventory map
- **Required changes:**
  - Update to use `getInventoryPage(characterId, "", pageSize)`
  - Handle pagination in UI (load more, next page buttons)
  - Store `cursor` and `hasMore` in state
- **Risk level:** **MEDIUM** - UI initialization

#### 5.3. UI Layer (`ui.js`)

**Function: `renderInventory(inventory)`**
- **Lines:** 1485+
- **Current behavior:**
  - Renders inventory grid from object map
  - Iterates over `Object.keys(inventory)`
- **Assumptions:**
  - Inventory is object map: `{itemName: quantity}`
- **Required changes:**
  - Accept new format: `{items: [{name, qty}], cursor, hasMore}`
  - Render items from `items` array
  - Add pagination UI (next page, load more)
  - Handle `hasMore` flag
- **Risk level:** **MEDIUM** - UI rendering

---

## 6. World Objects / External Scripts

### Current Behavior

World objects (gatherables, vendors, crafting stations) send messages via `INVENTORY_CHANNEL`:
- `fGiveItem,<itemName>,<quantity>`
- `fTakeItem,<itemName>,<quantity>`

### Assumptions

- World objects only send messages, don't read inventory structure
- Bridge handles `fGiveItem`/`fTakeItem` via `updateInventory()` function

### Required Changes

- **NONE** - World objects are message-based, not structure-dependent
- Bridge's `updateInventory()` function needs updates (see Section 1.2)

### Risk Level

**LOW** - No changes needed in world objects

---

## 7. Firestore Security Rules

### Current Rules

No specific rules for inventory subcollection found in `firestore.rules`.

### Required Changes

- Add rules for `characters/{characterId}/inventory/{itemId}` subcollection
- Allow read/write for character owner
- Consider write restrictions (e.g., only via Bridge, not direct client writes)

### Risk Level

**MEDIUM** - Security rules needed for new subcollection

---

## 8. Migration Checklist

### Phase 1: Bridge Updates (HIGH PRIORITY)
- [ ] Rewrite `getInventoryPage()` to use `runQuery` on subcollection
- [ ] Update `GET_INVENTORY_PAGE` HTTP response handler to parse query results
- [ ] Rewrite `applyInventoryDeltas()` to use subcollection document paths
- [ ] Update `updateInventory()` to use new delta system
- [ ] Update `"getInventoryPage"` handler to accept `cursor` instead of `page`
- [ ] Test atomic increments on subcollection documents
- [ ] Test document creation for new items

### Phase 2: HUD Controller Updates (HIGH PRIORITY)
- [ ] Update `"inventoryPage"` handler to parse JSON instead of CSV
- [ ] Update `showViewItemsDialogFromLists()` to accept JSON structure
- [ ] Add pagination UI (next page button)
- [ ] Update drop item flow to handle pagination
- [ ] Update `"inventory loaded"` handler to use cursor

### Phase 3: Data Manager Updates (MEDIUM PRIORITY)
- [ ] Remove or update inventory LSD storage logic
- [ ] Update `"inventory loaded"` message semantics
- [ ] Identify and update all LSD readers

### Phase 4: Setup HUD JS Updates (MEDIUM PRIORITY)
- [ ] Add `getInventoryPage(characterId, cursor, pageSize)` function
- [ ] Update `getItemQuantity()` to query specific document
- [ ] Update `checkItems()` to use batch queries or pagination
- [ ] Update `loadInventory()` to use paginated API
- [ ] Update `renderInventory()` to handle pagination UI

### Phase 5: Testing & Validation
- [ ] Test pagination with large inventories (100+ items)
- [ ] Test drop item flow with paginated inventory
- [ ] Test atomic increments on new and existing items
- [ ] Test Setup HUD inventory display
- [ ] Test world object `fGiveItem`/`fTakeItem` messages
- [ ] Validate Firestore security rules

### Phase 6: Cleanup
- [ ] Remove deprecated `getInventory()` functions
- [ ] Remove CSV parsing logic
- [ ] Remove inventory LSD storage (if removed)
- [ ] Update documentation

---

## 9. Risk Assessment Summary

| Component | Risk Level | Impact | Effort |
|-----------|------------|--------|--------|
| Firestore Bridge - Read | HIGH | All inventory displays | HIGH |
| Firestore Bridge - Write | HIGH | All inventory updates | MEDIUM |
| HUD Inventory Controller | HIGH | Player HUD inventory UI | MEDIUM |
| Data Manager | HIGH | LSD storage conflicts | LOW |
| Setup HUD JS | MEDIUM | Setup HUD inventory display | MEDIUM |
| InventoryCache | LOW | No changes needed | N/A |
| World Objects | LOW | No changes needed | N/A |

---

## 10. Open Questions & Decisions Needed

1. **LSD Storage Policy:** Should inventory be stored in LSD at all? If yes, how (current page only, or remove entirely)?

2. **Drop Item Flow:** How should drop item handle pagination? Options:
   - Fetch all items via cursor iteration
   - Add `getInventoryItem(characterId, itemName)` API
   - Search current page, request next if not found

3. **Document Creation Policy:** When `delta <= 0` and document doesn't exist, should we:
   - Skip the delta (ignore)
   - Create document with `qty = 0`
   - Return error

4. **Pagination Defaults:** What should default `pageSize` be?
   - HUD: 20 items per page
   - Setup HUD: 50 items per page
   - Drop flow: All items (cursor iteration)

5. **Backward Compatibility:** Should we maintain `getInventory()` for legacy callers, or force migration?

6. **Firestore Rules:** What security rules are needed for inventory subcollection?

---

## End of Document

This gap analysis provides a complete map of all changes required for the Feud4 Inventory v2 migration. Use this document as a checklist during implementation.

