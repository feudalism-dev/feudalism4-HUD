You are modifying the Feud4 HUD codebase. Implement ONLY Phase A and Phase B below. 
Do NOT modify any other systems, scripts, or files. 
Do NOT add new features beyond what is explicitly described.

============================================================
PHASE A — Integrate InventoryCache.lsl into the HUD Controller
============================================================

1. Locate the HUD inventory controller script (rp_inventory or the script that handles 
   pickup/drop/consume/craft events).

2. Add a helper function named updateInventoryDelta(itemName, delta):
   - Build a JSON object: { "item": itemName, "delta": delta }
   - Send a link message:
       llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_ADD_DELTA", json);

3. Replace ALL direct Firestore inventory update calls with updateInventoryDelta().
   - This includes pickup, drop, consume, craft, combine, split, etc.
   - Do NOT remove Firestore code yet; just bypass it by routing through the cache.

4. Add a function named flushInventoryDeltas():
   - Send: llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_GET_DELTAS", "");
   - The controller must wait for a "CACHE_DELTAS" response.

5. Add a link_message handler for CACHE_DELTAS:
   - Parse the JSON: {"deltas": { itemName: delta, ... }}
   - If the deltas object is empty, do nothing.
   - Otherwise, send a Firestore Bridge message:
       msg = "applyInventoryDeltas"
       id  = JSON containing:
            {
              "characterId": <existing characterId>,
              "deltas": { ... }   // embed the deltas object directly
            }

6. Add a link_message handler for the Bridge success response:
   - When Bridge responds with "inventoryDeltasApplied":
       llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_CLEAR", "");

7. Do NOT implement threshold logic, timers, or event-based flushes yet.
   - flushInventoryDeltas() must be callable manually for now.
   - We will add thresholds in a later phase.

8. Do NOT modify LSD usage.
   - Inventory is NOT stored in LSD.
   - Do not add or remove LSD keys.

============================================================
PHASE B — Implement Firestore Bridge Handler for applyInventoryDeltas
============================================================

1. Locate the Firestore Bridge script.

2. Add a new handler for the message "applyInventoryDeltas":
   - Parse JSON:
       characterId = payload["characterId"]
       deltas      = payload["deltas"]   // map of itemName → integer delta

3. For each itemName in deltas:
   - Apply the delta atomically in Firestore:
       inventory[itemName] += delta
   - If the resulting quantity <= 0:
       - Remove the item from the inventory map OR set to 0 (choose one and be consistent).

4. Perform the update in a single Firestore request if possible.
   - Use a transaction or atomic update if supported.
   - Do NOT send multiple requests per item.

5. After Firestore update succeeds:
   - Send a link message back to the HUD controller:
       llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasApplied", "");

6. Do NOT modify any other Bridge handlers.
7. Do NOT implement paging or inventory reads yet.
8. Do NOT modify rp_inventory yet.

============================================================
SCOPE LIMITS (DO NOT VIOLATE)
============================================================

- Do NOT implement the LSD display cache.
- Do NOT implement threshold-based flushing.
- Do NOT implement event-based flushing.
- Do NOT modify rp_inventory’s UI or paging logic.
- Do NOT modify any stats, pools, class, species, or mode systems.
- Do NOT modify any unrelated scripts.
- Do NOT rename functions or variables unless required for correctness.

============================================================
EXPECTED OUTCOME
============================================================

After completing Phase A + B:

- HUD will accumulate inventory deltas in InventoryCache.lsl.
- HUD can manually flush deltas to Firestore.
- Firestore Bridge will apply deltas atomically.
- Cache will clear only after Bridge confirms success.
- No LSD inventory keys will exist.
- No Firestore spam will occur.
- rp_inventory will still be broken (expected), but the write path will be correct.

Stop after this. Do not proceed to any further phases.