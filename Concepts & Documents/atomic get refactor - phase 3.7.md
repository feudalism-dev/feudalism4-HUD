PHASE 3.7 — DATA MANAGER LEGACY SPLIT (Memory Reduction)
Do NOT modify Firestore Bridge.
Do NOT modify message formats.
Do NOT modify LSD key formats.
Do NOT modify atomic field handlers.
Do NOT modify syncToFirestore().
Do NOT modify any parsing logic for atomic fields.
Do NOT optimize or rewrite logic.
This phase is ONLY a structural refactor to reduce script memory usage.

Goal:
Split the legacy full-document JSON parsing logic out of the main Data Manager script into a new script called:
"Feudalism 4 - Data Manager Legacy JSON Parser.lsl"

This new script will contain ONLY the legacy JSON-based full-document parsing logic used for:
- write_character_to_lsd
- JSON fallback for stats, health, stamina, mana
- JSON fallback for xp_total and xp_available
- JSON fallback for class_id, species_id, gender, has_mana
- JSON fallback for species_factors
- JSON fallback for currency
- JSON fallback for mode
- JSON fallback for inventory (including inventory_list and per-item keys)
- Any other deprecated or backward-compatibility JSON parsing

Rules:
1. Do NOT change the behavior of write_character_to_lsd.
2. Do NOT change the JSON parsing logic.
3. Do NOT change any LSD key names.
4. Do NOT change any message names.
5. Do NOT change any payload formats.
6. Do NOT modify atomic field handlers in the core Data Manager.
7. Do NOT move syncToFirestore() out of the core Data Manager.
8. Do NOT move LSD helpers (saveStats, loadStats, saveResourcePool, loadResourcePool) out of the core Data Manager.
9. Do NOT duplicate functions. Move them exactly as-is.

After moving:
- The core Data Manager script should contain ONLY:
  - atomic field handlers ("stats", "health", "stamina", "mana", "xp_total", "class_id", "species_id", "has_mana", "gender", "currency", "mode", "universe_id", "inventory")
  - parsing logic for atomic fields
  - LSD write helpers
  - syncToFirestore()
  - cleanupUnusedLSDKeys()
  - sending "loaded" messages after atomic writes

- The new Legacy JSON Parser script should contain ONLY:
  - the entire write_character_to_lsd handler
  - all JSON fallback logic
  - all full-document parsing logic
  - all deprecated handlers
  - all JSON-based inventory parsing
  - all JSON-based species_factors parsing
  - all JSON-based xp parsing
  - all JSON-based mode/class parsing

Communication:
- The new Legacy JSON Parser script should listen for the "write_character_to_lsd" message directly.
- It should perform the same LSD writes the Data Manager used to perform.
- It should NOT send any "loaded" messages.
- It should NOT call syncToFirestore().
- It should NOT handle atomic fields.

Behavior:
No behavior should change.
No message formats should change.
No LSD key formats should change.
This is a cut-and-paste modularization ONLY.

When finished:
- The core Data Manager should be significantly smaller and no longer contain any full-document JSON parsing.
- The new Legacy JSON Parser script should compile with no errors.
- The system should behave exactly the same as before.