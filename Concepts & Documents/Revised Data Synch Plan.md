**Feudalism 4 — Data Synchronization Strategy (Revised Architecture)**  
### **Final Implementation Plan**

---

# **Overview**

This plan aligns the HUD, Firestore Bridge, and Setup HUD with the intended Feud4 architecture:

### **Firestore/JS is the source of truth for:**
- `has_mana`
- `species_factors`
- `health.base`, `health.max`
- `stamina.base`, `stamina.max`
- `mana.base`, `mana.max`
- all stat‑based recalculations
- all species/universe logic

### **LSL/HUD is responsible only for:**
- tracking **current** health/stamina/mana  
- updating LSD  
- sending REST updates when needed  
- displaying values  
- running inventory updates  

### **HUD always reads from LSD.**  
### **rp_update and reset always resync from Firestore → LSD → HUD.**

---

# **Critical Behavioral Gaps (Real Issues Only)**

These are the only gaps that must be fixed:

1. **No full document fetch**  
   HUD must fetch the entire character document on reset and rp_update.

2. **No validation/repair logic**  
   Missing fields (`has_mana`, `species_factors`, pools, inventory) must be repaired and written back to Firestore.

3. **No rp_update handler**  
   The refresh button must trigger a full Firestore → LSD sync.

4. **Inventory doesn’t update LSD**  
   After PATCH, LSD must be updated so HUD stays consistent.

5. **HUD still depends on URL blob**  
   HUD must stop using URL‑injected JSON and rely solely on LSD.

6. **No LSD write‑back of Firestore values**  
   After sync, all Firestore values must be written into LSD using existing key names.

---

# **Phase 1 — Full Character Document Fetch**

**File:**  
`Feudalism 4 - Players HUD Firestore Bridge.lsl`

### Add:
`fetchFullCharacterDocument(characterId)`  
- Sends GET `/characters/{characterId}`  
- Tracks request as `"FETCH_FULL_CHARACTER"`  
- Stores full JSON for processing  

### Modify reset workflow:
- Check LSD for `characterId` key (stored from previous session)
- If missing → use existing `getCharacterInfo()` to query by owner_uuid
- Extract characterId from query result and store in LSD as `characterId`
- Then call `fetchFullCharacterDocument(characterId)`  
- Do **not** request individual fields anymore  

### Add http_response handler:
- When `"FETCH_FULL_CHARACTER"` returns:
  - Pass JSON to validation/repair  
  - Then write to LSD  
  - Then notify HUD to refresh  

---

# **Phase 2 — Validation & Repair Logic**

**File:**  
`Feudalism 4 - Players HUD Firestore Bridge.lsl`

### Add:
`validateAndRepairCharacter(charDocJson, characterId)`

### Responsibilities:
- Parse Firestore document  
- Check for missing fields  
- Initialize missing fields with defaults  
- Mark `needsUpdate = true` if repairs made  
- Return repaired JSON  

### Repair rules:

#### Required fields:
- `stats` → default all 2s  
- `species_factors` → default `{25,25,25}`  
  - **Log warning**: `"WARNING: Document has no fields for species_factors - JS should have set this during character creation"`
- `has_mana` → **use Firestore value only**  
  - If missing → set to `false` (safe default)  
  - **Log warning**: `"WARNING: Document has no fields for has_mana - JS should have set this during character creation"`
  - **No LSL mana roll**  
- `health`, `stamina`, `mana`  
  - If missing → set to `{current:0, base:0, max:0}`  
  - **Log warning**: `"WARNING: Document has no fields for <pool> - JS should have calculated this"`
  - **Do not recalc in LSL**  
- `xp_total`, `xp_available` → default 100  
- `currency` → default 50  
- `mode` → `"roleplay"`  
- `action_slots` → empty array  
- `inventory` → empty map  

### If repairs were made:
- Send PATCH with only repaired fields  
- Use `updateMask.fieldPaths`  
- Log `"REPAIR: Initialized <fields> for character <id>"`

---

# **Phase 3 — Write Repaired Data to LSD**

**Files:**  
- `Firestore Bridge.lsl`  
- `Players HUD Data Manager.lsl`

### Add:
`writeCharacterToLSD(charDocJson)`

### Responsibilities:
- Extract all fields from Firestore JSON  
- Write them into LSD using **existing key names**  
- Convert values to existing formats:
  - stats → CSV  
  - pools → `current|base|max`  
  - inventory → existing format  
  - booleans → `"true"` / `"false"`  

### After writing:
- Send link messages to HUD to refresh UI  
- HUD reads from LSD only  

---

# **Phase 4 — Remove LSL Mana Eligibility & Pool Math**

### Remove from plan:
- LSL calculating `has_mana`  
- LSL calculating species_factors  
- LSL recalculating health/stamina/mana  
- LSL parsing species templates  
- LSL parsing universe templates  

### Replace with:
**Firestore/JS always calculates:**
- `has_mana`  
- `species_factors`  
- `health.base`, `health.max`  
- `stamina.base`, `stamina.max`  
- `mana.base`, `mana.max`  

LSL only reads these values and stores them in LSD.

---

# **Phase 5 — rp_update Handler**

**File:**  
`Combined HUD Controller.lsl`

### Add:
- When rp_update button is clicked:
  - Read `characterId` from LSD (stored by Bridge during reset/previous sync)
  - If missing, send link message to Bridge to query by owner_uuid
  - Call `fetchFullCharacterDocument(characterId)` in Bridge  
  - Run full sync (same as reset)  
  - Notify user: `"Character data synchronized with server."`  

### rp_update must use the **exact same code path** as reset.

---

# **Phase 6 — Inventory LSD Sync**

**File:**  
`Firestore Bridge.lsl`

### Modify:
After successful PATCH in `PATCH_INVENTORY` handler:

1. We already have the updated inventory from the character document GET (before PATCH)
2. Extract inventory field from character document JSON
3. Convert Firestore mapValue format to JSON string: `{"itemName": quantity, ...}`
4. Write updated inventory JSON to LSD using key `inventory` (or check existing key name)
5. Send link message `"inventory_updated"` to notify HUD to refresh inventory UI

### Inventory format:
- Store as JSON string in LSD: `{"banana": 3, "iron ore": 12}`
- Use existing key name (check Data Manager for current key, or use `inventory`)

---

# **Phase 7 — Remove URL Blob Dependency**

**File:**  
`app.js` (Setup HUD)

### Remove:
- URL `char_data` injection  
- HUD reading stats/pools from URL  

### Replace with:
- HUD reads everything from LSD  
- LSD is populated by Firestore Bridge sync  

---

# **Testing Checklist**

- [ ] Reset → full Firestore → LSD sync  
- [ ] rp_update → same sync path  
- [ ] Missing fields repaired and PATCHed  
- [ ] HUD reads only from LSD  
- [ ] Inventory updates reflected in LSD  
- [ ] No URL blob dependency  
- [ ] No LSL pool math  
- [ ] No LSL mana eligibility logic  
- [ ] Firestore always contains complete, correct character documents  

---

# **Notes**

- **Do not rename LSD keys.**  
- **Do not change existing LSD formats.**  
- **All calculations happen in Firestore/JS.**  
- **LSL only tracks current values and syncs with Firestore.**  
- **rp_update and reset use the same sync path.**

---
