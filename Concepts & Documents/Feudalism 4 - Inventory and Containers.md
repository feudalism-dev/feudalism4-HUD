# **Feudalism 4 – Inventory, Pouch, and Container Architecture**  
### *Design Document (Draft 1.0)*  
### *Author: Robert*  
### *System Architecture Partner: Copilot*

---

# **1. Overview**

Feudalism 4 introduces a hybrid inventory system designed for:

- **Security** (anti‑cheat, anti‑duplication)
- **Scalability** (cross‑sim, cross‑universe)
- **Performance** (local LSD for world interactions)
- **Creator‑friendliness** (drop‑in components)
- **Roleplay expressiveness** (renameable pouches/containers)
- **Future‑proofing** (Firestore-backed universal inventory)

This document defines:

- Universal Inventory (Vault)
- Local Inventory (Pouches & Containers)
- Session ID security model
- Rename/description facilities for NO‑MOD objects
- Script architecture (Core, Menu, API)
- Messaging protocols
- Rules for currency, rare items, and metadata

This is the canonical reference for Feudalism 4’s inventory system.

---

# **2. Inventory Model**

Feudalism 4 uses a **hybrid inventory model**:

## **2.1 Universal Inventory (Vault)**  
Stored in **Firestore**, authoritative, secure, cross‑sim.

### Contains:
- Currency  
- Rare items  
- Unique/soulbound items  
- Quest items  
- Achievements  
- Stats  
- Universe unlocks  
- Account-level progression  

### Never contains:
- Crafting ingredients  
- Food/drink  
- Raw materials  
- Temporary items  
- Pickpocketable items  
- Container/pouch contents  

### Why:
- Prevents cheating  
- Enables cross‑sim persistence  
- Supports global economy  
- Supports admin tools  
- Supports analytics  

---

## **2.2 Local Inventory (LSD)**  
Stored inside **pouches and containers**, fast and ephemeral.

### Contains:
- Crafting ingredients  
- Food/drink  
- Raw materials  
- RP items  
- Temporary items  
- Pickpocketable items  
- Loot  
- Container contents  

### Never contains:
- Currency  
- Rare items  
- Unique items  
- Quest items  
- Anything requiring security  

### Why:
- Fast for world interactions  
- Works offline  
- Supports physical gameplay  
- Supports RP  
- Supports pickpocketing  
- Supports containers and pouches  

---

# **3. Security Model**

## **3.1 NO‑MOD Requirement**

Pouches and containers **must be NO‑MOD** to prevent:

- Adding malicious scripts  
- Removing core scripts  
- Altering LSD  
- Spoofing inventory  
- Bypassing capacity  
- Duplicating items  
- Changing permissions  
- Breaking API behavior  

## **3.2 Rename/Description Facilities**

Because objects are NO‑MOD, Feud 4 provides **script‑driven customization**:

- Owners can rename pouches/containers  
- Owners can set descriptions  
- Names/descriptions are stored in LSD  
- Names/descriptions are re-applied on rez/attach  

This preserves RP expressiveness without compromising security.

---

# **4. Currency Rules (Hard‑Coded)**

Currency is **never** stored in LSD.

### Allowed currency types:
- Gold Coin  
- Silver Coin  
- Bronze Coin  
- Copper Coin  

### Rules:
- Currency exists **only** in the Vault  
- Currency is accessed via the HUD ($ button)  
- Currency values are fixed and immutable  
- Currency cannot be:
  - stored in pouches  
  - stored in containers  
  - dropped  
  - traded via pouch  
  - pickpocketed via LSD  
  - modified by world objects  

Pickpocketing currency uses Vault → Vault operations.

---

# **5. Pouch Architecture**

A pouch consists of **three core scripts**, plus optional modules.

## **5.1 Script A — `pouch_core.lsl`**

### Responsibilities:
- Generate and maintain **session ID**  
- Maintain LSD inventory  
- Enforce **no currency** rule  
- Handle rename/description  
- Respond to internal link messages  
- Register/unregister with HUD  
- Provide inventory operations:
  - addItem  
  - removeItem  
  - getQuantity  
  - listContents  
  - drop  
  - eat  
  - giveAvatar  
  - moveContainer  

### LSD Namespace:
```
pouch:<sessionId>:item:<itemName> = <quantity>
pouch:<sessionId>:meta:name = <customName>
pouch:<sessionId>:meta:desc = <customDescription>
```

### Link Message API (input):
```
core:drop,<itemName>
core:eat,<itemName>,<effectPayload>
core:giveAvatar,<itemName>,<quantity>,<avatarKey>
core:moveContainer,<itemName>,<quantity>,<containerKey>
core:contents
core:rename,<newName>
core:setDesc,<newDescription>
```

---

## **5.2 Script B — `pouch_menu.lsl`**

### Responsibilities:
- Touch → show menu  
- Handle pagination  
- Handle textboxes/dialogs  
- Send link messages to `pouch_core`  
- Never touch LSD directly  

### Menu Options:
- Contents  
- Drop  
- Eat  
- Give  
- Rename  
- Description  
- Vault (optional)  

---

## **5.3 Script C — `pouch_api.lsl`**

### Responsibilities:
- Listen for world object messages  
- Implement pouch test  
- Forward requests to `pouch_core`  
- Prevent cross‑talk  
- Validate session ID  

### External API (object → pouch):
```
detectPouch,<requesterKey>
check,<itemName>
take,<itemName>,<quantity>
store,<containerKey>
```

### External API (pouch → object):
```
pouchHere,<ownerKey>,<sessionId>
<itemName>,<quantity>
```

---

## **5.4 Optional Script D — `pouch_pickpocket.lsl`**

### Responsibilities:
- Handle pickpocket attempts  
- Fetch stats via Firestore Bridge  
- Run thievery vs awareness rolls  
- Remove items from victim pouch  
- Add items to thief pouch or Vault  
- Handle detection messaging  

---

# **6. Container Architecture**

Containers mirror pouches but are simpler.

## **6.1 `container_core.lsl`**
- Maintain LSD inventory  
- Enforce no currency  
- Handle rename/description  
- Handle receiving items from pouch  
- Handle giving items to pouch  

## **6.2 `container_menu.lsl`**
- Owner UI  
- Rename  
- Description  
- Contents  

## **6.3 `container_api.lsl`**
- Optional  
- For world-object interactions  

---

# **7. Firestore Bridge (External Script)**

A generic script dropped into world objects.

### Responsibilities:
- Fetch stats  
- Fetch item metadata  
- Fetch consumable metadata  
- Fetch crafting recipes  
- Fetch universe overrides  
- Cache results  
- Handle offline mode  
- Provide clean LSL API  

### World Object → Bridge:
```
getStats,<avatarKey>
getItemMeta,<itemName>
getConsumable,<itemName>
getRecipe,<recipeName>
```

### Bridge → World Object:
```
stats,<avatarKey>,<json>
itemMeta,<itemName>,<json>
consumable,<itemName>,<json>
recipe,<recipeName>,<json>
```

---

# **8. HUD Integration**

HUD handles:

- Vault ↔ Pouch transfers  
- Currency display and modification  
- Inventory UI (I button)  
- Container UI (C button)  
- Currency UI ($ button)  
- Admin tools  

HUD does **not** handle world-object Firestore lookups.

---

# **9. Offline Mode**

If Firestore is unavailable:

- Pouch and containers continue to function normally  
- World objects continue to use LSD  
- Vault operations are disabled  
- HUD displays “Vault temporarily unavailable”  
- No data is lost  

---

# **10. Implementation Order (Recommended)**

1. **Universal Inventory (Vault)**
   - Firestore schema  
   - HUD integration (I, C, $ buttons)  
   - Admin functions  

2. **Pouch System**
   - pouch_core  
   - pouch_menu  
   - pouch_api  
   - rename/description  

3. **Container System**
   - container_core  
   - container_menu  
   - container_api  

4. **Firestore Bridge**
   - stats  
   - item metadata  
   - consumables  
   - recipes  

5. **Pickpocket System (Feud 4 version)**

6. **World Object Integration**
   - ovens  
   - crafting stations  
   - NPCs  
   - gatherables  

---

# **11. Future Extensions**

- Lockable containers  
- Keyed access  
- Universe-specific pouch skins  
- Weight/encumbrance system  
- Durability system  
- Multi-stage crafting  
- Cross-universe trade  

---

# **12. Appendix: Naming Conventions**

### Channels:
- `pouchChannel`  
- `containerChannel`  
- `hudChannel`  
- `bridgeChannel`  

### Link Message Prefixes:
- `core:`  
- `menu:`  
- `api:`  

### LSD Keys:
- `pouch:<sessionId>:item:<itemName>`  
- `pouch:<sessionId>:meta:name`  
- `pouch:<sessionId>:meta:desc`  
- `container:<containerId>:item:<itemName>`  

---

# **End of Document**

---
