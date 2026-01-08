# Bridge_Inventory.lsl Cleanup Analysis

## Current Size: 1312 lines

## Findings

### 1. UNUSED/DEPRECATED CODE (Can Remove)

#### A. ITEM QTY RESPONSE Handler (Lines 1222-1307) - ~85 lines
- **Status:** DEPRECATED - marked as no longer used with single-phase fetching
- **Still referenced by:** Master inventory system and PAGE NAME RESPONSE (but those may also be unused)
- **Action:** Can remove if master inventory/PAGE NAME not used

#### B. PAGE NAME RESPONSE Handler (Lines 1139-1220) - ~81 lines
- **Status:** Alternative code path using old two-phase approach
- **Triggered by:** `pg_nameReqId` - but this is never set in new code
- **Action:** Can likely remove - no code sets `pg_nameReqId` anymore

#### C. Unused Variables - ~10 lines
- `LIST_INVENTORY_RETRY_LIMIT` (line 56) - defined but never used
- `listInventoryRetryCount` (line 57) - defined but never used  
- `MASTER_FETCH_TIMEOUT` (line 47) - defined but never used
- `AUTO_FOLLOW_ENABLED` (line 39) - test-only, disabled
- `AUTO_FOLLOW_MAX` (line 40) - test-only, disabled
- `autoFollowCount` (line 41) - test-only, disabled
- `pg_nameReqId` (line 32) - only checked, never set in new code

#### D. Master Inventory System (Lines 43-48, 147-244) - ~100 lines
- **Status:** Separate system that still uses old two-phase approach
- **Used by:** `serveMasterPage()` called from link_message if `useMaster=true` or `pageIndex` provided
- **Action:** Keep for now (might be used), but could be simplified later

#### E. `getCharacterInfo()` Function (Lines 121-145) - ~24 lines
- **Status:** Used by legacy `getInventoryFromFirestore()` and `updateInventory()`
- **Action:** Keep - still used

### 2. EXCESSIVE DEBUG OUTPUT (Can Reduce)

#### Current Debug Calls: ~40 instances
- `diag()` calls: ~25 instances (sends to both owner AND HUD)
- `debugLog()` calls: ~15 instances

#### High-Volume Debug (Can Remove/Reduce):
1. **PENDING_BEFORE/PENDING_AFTER** (lines 904, 1083) - internal state tracking
2. **LIST_RAW** (line 1003) - body length (only needed if troubleshooting)
3. **ITEM_RESP_START/ITEM_QTY_PARSED/ITEM_APPENDED** (lines 1230, 1286, 1298) - deprecated handler
4. **OUTSTANDING_CONSUMED/OUTSTANDING_MISS** (lines 624, 626) - token tracking
5. **OUTSTANDING_EXPIRE** (lines 292, 1113) - token expiration
6. **HUD_DUP** (line 374) - duplicate cursor detection
7. **GET_LIST** (line 398) - URL logging
8. **PAGE NAME RESPONSE** debug logs (lines 1142, 1191, 1197, 1212) - deprecated handler
9. **AUTO_FOLLOW** (line 300) - test-only feature
10. **MASTER_START/MASTER_CONT/MASTER_DONE** (lines 201, 966, 980) - master inventory system

#### Keep (Essential Debug):
1. **LIST_ERR** - errors are important
2. **SIZE_REDUCE** - important for monitoring truncation
3. **OUT_PAGE** - maybe reduce verbosity
4. **LIST_PARSED** - maybe reduce to just itemCount

### 3. REDUNDANT CODE

#### A. Duplicate Token Cleanup Logic
- Lines 282-295: Token cleanup in `sendInventoryPage()`
- Lines 1103-1116: Same token cleanup in LIST_INVENTORY handler
- **Action:** Consolidate into helper function

#### B. Duplicate State Reset
- Lines 304-314: State reset in `sendInventoryPage()`
- Lines 1118-1128: Same state reset in LIST_INVENTORY handler
- **Action:** Consolidate into helper function

#### C. Verbose String Building
- Multiple places build JSON strings manually instead of using helper
- Could simplify but might not save much

### 4. SIMPLIFICATIONS

#### A. Remove Test-Only Features
- AUTO_FOLLOW code (lines 297-302) - disabled, test-only
- "banana" debug check (line 343) - specific test code

#### B. Simplify Debug Functions
- `diag()` sends to both owner AND HUD - could make HUD part optional
- Many `diag()` calls could be `debugLog()` instead (owner only)

#### C. Remove Unused Helper
- `_masterKeyFor()` (line 149) - defined but never used

## Estimated Savings

### If Remove Deprecated Handlers:
- ITEM QTY RESPONSE: ~85 lines
- PAGE NAME RESPONSE: ~81 lines
- **Total: ~166 lines**

### If Remove Unused Variables:
- ~10 lines

### If Reduce Debug Output:
- Remove ~20 debug calls = ~30-40 lines saved
- **Total: ~30-40 lines**

### If Consolidate Duplicate Code:
- Token cleanup: ~15 lines saved
- State reset: ~10 lines saved
- **Total: ~25 lines**

## Grand Total Potential Savings: ~231 lines

**New estimated size: ~1081 lines (from 1312)**

## Recommendations

### Phase 1: Safe Removals (Do First)
1. Remove unused variables (LIST_INVENTORY_RETRY, AUTO_FOLLOW, etc.)
2. Remove test-only code (banana check, AUTO_FOLLOW)
3. Remove `_masterKeyFor()` unused helper
4. Reduce debug output (remove PENDING, LIST_RAW, etc.)
5. **Savings: ~50-60 lines**

### Phase 2: Deprecated Code (Verify First)
1. Check if PAGE NAME RESPONSE is ever triggered (pg_nameReqId never set)
2. If not triggered, remove PAGE NAME RESPONSE handler
3. If master inventory not used, consider removing ITEM QTY RESPONSE
4. **Savings: ~85-166 lines**

### Phase 3: Consolidation (Refactor)
1. Create helper functions for token cleanup
2. Create helper function for state reset
3. **Savings: ~25 lines**

## Risk Assessment

- **Low Risk:** Removing unused variables, reducing debug
- **Medium Risk:** Removing PAGE NAME RESPONSE (verify not used first)
- **High Risk:** Removing master inventory system (verify not used)

