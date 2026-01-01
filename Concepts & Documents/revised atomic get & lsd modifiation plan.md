# **🔥 REVISED PLAN: Atomic Field Gets + LSD Format Migration (Safe, Phased, No Premature Deletions)**

This plan replaces the previous version.  
It is safer, simpler, and aligned with the validated Feud4 architecture.

---

# **1. Core Principles (Do Not Change These)**

### **1.1 Never fetch full Firestore documents in LSL**
- LSL truncates large JSON responses  
- Any truncation corrupts the JSON  
- Any corruption breaks all `llJsonGetValue` calls  

**Therefore:**  
All Firestore access must use **atomic field gets** via field masks.

---

### **1.2 Never store JSON blobs in LSD**
LSD should contain:
- simple values  
- CSV lists  
- pipe‑delimited resource pools  
- flattened key/value pairs  

**No JSON in LSD.**

---

### **1.3 Three‑tier data model**
1. **Firestore** = source of truth  
2. **LSD** = persistent local mirror (simple values only)  
3. **Runtime variables** = working state  

This applies only to LSL scripts.  
MOAP components are unaffected.

---

# **2. Scope of Work**
We will update:
- Firestore Bridge  
- Data Manager  
- Combined HUD Controller  

We will **not** delete any handlers or JSON logic until the new atomic‑get flow is fully validated.

---

# **3. Implementation Phases (Safe Order)**

---

## **Phase 1 — Convert LSD Formats (Independent, Low Risk)**

### **1.1 species_factors**
Current: JSON string  
New: three separate LSD keys  
- `health_factor`  
- `stamina_factor`  
- `mana_factor`  

**Implementation:**  
- Parse Firestore mapValue in Data Manager  
- Write three simple keys  
- Update any readers to use the new keys  
- Keep JSON parsing temporarily until migration is complete

---

### **1.2 inventory**
Current: JSON string  
New: CSV pairs  
Example:  
`banana,4,apple,2`

**Implementation:**  
- When inventory field arrives, convert mapValue → CSV  
- Store CSV in LSD  
- Update HUD inventory display and drop logic to parse CSV  
- Keep JSON parsing temporarily until migration is complete

---

## **Phase 2 — Replace Full‑Document Fetch in rp_inventory**

### **2.1 Firestore Bridge**
- Replace full document GET with:  
  `getFieldByUUID("inventory", uuid, senderLink)`

### **2.2 Data Manager**
- Receive inventory field  
- Convert to CSV  
- Store in LSD  

### **2.3 HUD**
- Parse CSV for display and drop logic  

**Do not remove old logic yet.**

---

## **Phase 3 — Replace Full‑Document Fetch in rp_update**

### **3.1 Remove dependency on fetchFullCharacterDocument (but do NOT delete it yet)**

### **3.2 Combined HUD Controller**
Replace full‑doc request with individual field requests:

```
getStats
getHealth
getStamina
getMana
getXP
getClass
getSpecies
getHasMana
getSpeciesFactors
getGender
getCurrency
getMode
getUniverseId
```

### **3.3 Data Manager**
- Each field handler writes to LSD  
- Runtime variables updated as usual  

### **3.4 Character‑loaded trigger**
We will **not** implement counters yet.  
We will evaluate whether the HUD already behaves correctly with partial loads.

---

## **Phase 4 — Validate Atomic Field Flow (No Deletions Yet)**

### Tasks:
- Confirm all fields load correctly  
- Confirm LSD writes are correct  
- Confirm HUD reads from LSD correctly  
- Confirm no JSON truncation issues remain  
- Confirm rp_update and rp_inventory both work end‑to‑end  

Only after validation do we proceed.

---

## **Phase 5 — Remove Deprecated Logic (After Validation Only)**

### **5.1 Safe to remove:**
- `fetchFullCharacterDocument()`  
- Full‑document GET handlers  
- JSON‑based inventory parsing  
- JSON‑based species_factors parsing  
- `write_character_to_lsd` (only after confirming all atomic handlers cover its responsibilities)

### **5.2 Clean up**
- Remove unused variables  
- Remove unused message handlers  
- Remove any JSON building logic  

---

## **Phase 6 — Final Verification**

### Tests:
- rp_update  
- rp_inventory  
- Inventory display  
- Drop item flow  
- Species factor calculations  
- Stat updates  
- Health/stamina/mana updates  
- XP and class updates  

### Confirm:
- No JSON stored in LSD  
- No full document GETs  
- All Firestore access is atomic  
- All LSD values are simple formats  

---

# **4. Questions for User (unchanged but clarified)**

### **4.1 Inventory format**
Do you prefer:
- CSV pairs (`banana,4,apple,2`)  
- or individual LSD keys (`inventory_banana = 4`)?  

CSV is simpler; individual keys scale better.

---

### **4.2 Species factors**
Should we:
- Parse the mapValue in Data Manager (one query)  
- Or request three separate fields (three queries)?  

Parsing is more efficient.

---

### **4.3 Field loading order**
For rp_update:
- Parallel (fastest)  
- Sequential (simplest)  
- Hybrid (critical fields first)  

Default recommendation: **parallel**, since each request is independent.

---

# **End of Revised Plan**
