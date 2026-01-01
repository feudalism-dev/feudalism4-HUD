PHASE 3.6 — DATA MANAGER SLIMDOWN (Memory Reduction)
Do NOT modify Firestore Bridge. 
Do NOT modify message formats. 
Do NOT modify LSD key formats. 
Do NOT modify JSON fallback. 
Do NOT modify rp_update or rp_inventory.

Goal:
Reduce memory usage in Data Manager by moving all HUD-facing logic into a new script.

Create a new script:
"Feudalism 4 - HUD Character Data Controller.lsl"

Move the following OUT of Data Manager and INTO the new script:
- Any logic that interprets stats, health, stamina, mana, xp_total, class_id, species_id, gender, has_mana, mode, universe_id, species_factors, or currency.
- Any logic that updates HUD UI based on these fields.
- Any logic that builds or updates dialogs.
- Any logic that performs calculations or decisions based on these fields.

Data Manager should ONLY:
1. Receive atomic field messages.
2. Parse the field value.
3. Write the value to LSD.
4. Send a "field_loaded" message to HUD scripts.

Do NOT change the meaning or format of any messages.
Do NOT optimize or rewrite logic.
This is a cut-and-paste modularization only.

After moving:
- Data Manager must contain ONLY parse/write/signal logic.
- The new script must handle all HUD-facing logic for character data.
- No behavior should change.

This is a structural refactor ONLY.