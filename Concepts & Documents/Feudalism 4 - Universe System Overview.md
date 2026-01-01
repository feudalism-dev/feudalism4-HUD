# **FEUDALISM 4 — UNIVERSE SYSTEM IMPLEMENTATION SPECIFICATION (FOR CURSOR)**  
### *Authoritative, Non‑Negotiable Rules & Requirements*  
### *This document defines EXACTLY how the Universe System must be implemented.*

---

# **0. IMPORTANT: EXISTING ROLES (DO NOT MODIFY)**

The following roles **already exist** in Feudalism 4.  
Cursor must NOT rename, remove, merge, reinterpret, or alter these roles or their permissions.

### **SUPER USER**
- Full access to everything  
- Can modify or delete any universe  
- Can assign/remove System Admins  

### **SYSTEM ADMIN**
- Can modify any universe  
- Can modify the Default Universe  
- Can create universes  
- Can delete universes  
- Can assign Universe Admins  

### **ADMIN**
- Limited admin tools (stats, currency, moderation)  
- Cannot modify universes  
- Cannot assign Universe Admins  

### **PLAYER**
- No admin privileges  
- Can create characters  
- Can select universes during character creation  

---

# **1. NEW ROLE TO ADD: UNIVERSE ADMIN (UA)**

This is the **ONLY** new role being added.  
Cursor must implement it exactly as described.

### **UNIVERSE ADMIN (UA)**
- Can create universes  
- Can edit universes they own  
- Can activate/deactivate universes they own  
- Can delete universes they own  
- Can add/remove additional Universe Admins for their own universes  
- Cannot modify the Default Universe  
- Cannot modify universes owned by others  
- Cannot assign System Admins  
- Cannot modify global system settings  

**Do NOT create any additional roles.  
Do NOT modify existing roles.  
Do NOT infer new permissions.**

---

# **2. DEFAULT UNIVERSE**

There is exactly **one** Default Universe.

### Rules:
- ID must be `"default"`  
- Cannot be deleted  
- Always active  
- Only Super User and System Admins may modify it  
- Used when:
  - Player selects no universe  
  - A universe is deactivated  
  - A universe is deleted  
- Only the super user can change the maturity level for the default universe

---

# **3. FIRESTORE SCHEMA**

Each universe is stored at:

```
universes/{universeId}
```

### **Required Fields**
```
name: string
description: string
theme: string
roleplayType: string
imageUrl: string (1024x1024)
groupSlurl: string
welcomeSlurl: string
landmarks: array of { name: string, slurl: string }
contacts: array of { name: string, role: string, avatarKey: string }
maturityRating: "general" | "moderate" | "adult"

ownerAdminId: string
active: boolean
visibility: "public" | "private"

acceptNewPlayers: "open" | "key" | "closed"
signupKeyHash: string (hashed key or empty)

characterLimit: number (0 = unlimited)
manaEnabled: boolean

allowedGenders: array of genderIds
allowedSpecies: array of speciesIds
allowedClasses: array of classIds
allowedCareers: array of careerIds

createdAt: timestamp
updatedAt: timestamp
```

### **Subcollection: Universe Admins**
```
universes/{universeId}/admins/{adminId}
{
  role: "owner" | "admin",
  addedBy: <adminId>,
  addedAt: timestamp
}
```

---

# **4. UNIVERSE ACCESS MODES**

Each universe defines:

```
acceptNewPlayers: "open" | "key" | "closed"
```

### **OPEN**
- Anyone can create a character in this universe.

### **KEY**
- Universe requires a signup key.
- UA sets `signupKeyHash`.
- Player must enter the correct key during character creation.

### **CLOSED**
- Universe does not appear in character creation.
- No new characters may join.
- Existing characters remain valid.

---

# **5. IDENTITY RULES (NON‑NEGOTIABLE)**

## **5.1 Gender**
- Gender changes are allowed at any time.  
- Gender has **no mechanical impact**.  
- No universe restrictions apply.  
- HUD must allow gender change.  
- This behavior must remain unchanged.

## **5.2 Species**
- Species changes are **NOT allowed** under normal circumstances.  
- If a species is removed from the universe’s allowed list:
  - Existing characters remain valid.
  - No forced species change.
  - No UI prompt.
- Only Super User or System Admin may change species manually in Firestore.
- HUD must NOT provide any species-change UI.
- Cursor must NOT implement any system that allows species changes at will.

## **5.3 Classes & Careers**
- Governed by universe allowed lists.
- Class/career changes depend on universe rules (future feature).

---

# **6. CHARACTER CREATION RULES**

### **6.1 Universe Selection**
HUD must show:
- Default Universe  
- All universes where:
  - `active == true`
  - `acceptNewPlayers != "closed"`

### **6.2 Signup Key Flow**
If universe is `"key"`:
- HUD prompts for key  
- Hash of input is compared to `signupKeyHash`  
- If match → allow creation  
- If not → block creation  

### **6.3 Identity Filtering**
HUD must filter identity options by:

```
allowedGenders
allowedSpecies
allowedClasses
allowedCareers
```

### **6.4 Mana Rules**
```
character.hasMana = species.manaRule AND universe.manaEnabled
```

### **6.5 Character Limit**
```
characterLimit: number
```

- 0 = unlimited  
- N = max characters per player in that universe  
- HUD must enforce this during character creation  

---

# **7. UNIVERSE EDITING (MOAP SETUP HUD)**

Universe Admins must be able to:

- Edit name  
- Edit description  
- Edit theme  
- Edit roleplayType  
- Edit image  
- Edit groupSlurl  
- Edit welcomeSlurl  
- Edit landmarks  
- Edit contacts  
- Edit allowed identity lists  
- Edit manaEnabled  
- Edit acceptNewPlayers  
- Edit signupKey (hash only)  
- Edit characterLimit  
- Activate/deactivate universe  
- Delete universe  
- Add/remove additional Universe Admins  
- Edit maturityRating (editable by UA, SA, SU; not editable by Admin or Player)

HUD must enforce:
- UA can only edit universes they own  
- UA cannot edit Default Universe  
- System Admin can edit any universe  

---

# **8. UNIVERSE DELETION**

### Rules:
- UA may delete universes they own  
- System Admin may delete any universe except Default  
- Super User may delete anything  
- Deletion sets:
  ```
  deleted: true
  ```
- Characters in deleted universes are reassigned to Default Universe  

---

# **9. BACKEND ENDPOINTS CURSOR MUST IMPLEMENT**

### **Universe CRUD**
- `createUniverse`
- `updateUniverse`
- `deleteUniverse`
- `getUniverse`
- `listUniversesForAdmin`

### **Universe Admin Management**
- `assignUniverseAdmin`
- `removeUniverseAdmin`

### **Universe Activation**
- `setUniverseActiveState`

### **Signup Key**
- `setSignupKey` (hash key)
- `clearSignupKey`
- `validateSignupKey`

### **Character Creation Validation**
- `validateCharacterLimit`
- `validateIdentityOptions`

---

# **10. NON‑NEGOTIABLE IMPLEMENTATION RULES**

Cursor must follow these exactly:

### **10.1 Do NOT allow species changes through HUD or backend.**  
Only Super User/System Admin may change species manually in Firestore.

### **10.2 Do NOT generalize gender rules to species.**  
Gender is flexible.  
Species is permanent.

### **10.3 Do NOT force species changes when universes change.**  
Existing characters remain valid.

### **10.4 Do NOT rewrite or reinterpret these rules.**  
This document is authoritative.

### **10.5 Do NOT create new roles beyond Universe Admin.**  
Do NOT modify existing roles.

---

# **END OF SPECIFICATION**

---
