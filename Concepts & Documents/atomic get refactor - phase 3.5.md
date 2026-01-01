PHASE 3.5 — MEMORY REDUCTION REFACTOR
Do NOT modify any Firestore logic, any Data Manager logic, any Bridge logic, or any atomic field logic. 
Do NOT change any message formats, field names, or LSD key formats. 
Do NOT optimize, rewrite, or simplify any functions. 
This phase is ONLY a structural refactor to reduce script memory usage.

Goal:
Split all inventory-related UI and logic out of "Feudalism 4 - Combined HUD Controller.lsl" into a new script called:
"Feudalism 4 - HUD Inventory Controller.lsl"

Rules:
1. Do NOT change behavior.
2. Do NOT change logic.
3. Do NOT change variable names.
4. Do NOT change link message formats.
5. Do NOT change how inventory is read from LSD.
6. Do NOT change how inventory is displayed.
7. Do NOT change how items are dropped, consumed, or inspected.
8. Do NOT modify Data Manager or Firestore Bridge.
9. Do NOT modify any non-inventory HUD features.

Move the following from Combined HUD Controller into the new script:
- showViewItemsDialog() and all helper functions it calls.
- Any dialog-building functions for inventory.
- Any functions that read <characterId>_inventory_list or <characterId>_inventory_<item>.
- Any functions that handle drop, consume, inspect, or item actions.
- Any link_message handlers that process inventory-related commands.
- Any inventory-specific state variables.

After moving:
- Combined HUD Controller should ONLY route the "Inventory" button to the new script via a link message.
- The new script should listen for that link message and run the inventory UI.
- The new script should send any necessary responses back to Combined HUD Controller using the SAME link message formats already used.

Do NOT introduce new message types.
Do NOT rename anything.
Do NOT remove JSON fallback.
Do NOT remove deprecated functions.
Do NOT remove rp_update or rp_inventory logic.

This is a cut-and-paste modularization ONLY.

When finished:
- Confirm that Combined HUD Controller is smaller and no longer contains inventory UI logic.
- Confirm that the new HUD Inventory Controller compiles with no errors.
- Confirm that no behavior has changed.