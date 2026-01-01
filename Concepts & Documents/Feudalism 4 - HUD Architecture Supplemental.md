# Feudalism 4 – HUD Architecture  
### Draft 1.0

## 1. Overview

The Feudalism 4 HUD is the player’s primary interface to:

- Universal Inventory (Vault)
- Currency (Gold/Silver/Bronze/Copper)
- Local inventories (pouches/containers, via APIs)
- Character stats and progression
- Admin tools (for authorized users)
- Universe-specific UI affordances

The HUD **does not** directly implement world-object Firestore lookups; that is the job of the Firestore Bridge. The HUD mediates **player-centric** operations:

- Vault ↔ Pouch transfers
- Currency display and mutation
- Stat display
- Inventory browsing and filtering
- Admin UI access

This document focuses on the HUD’s relationship with:

- Vault (Firestore)
- Pouches and containers
- Buttons: `I`, `C`, `$`
- Admin functions

---

## 2. HUD responsibilities and boundaries

### 2.1 Responsibilities

- **Display**:
  - Player stats (health, stamina, mana, etc.)
  - Currency balances
  - Universal Inventory (Vault)
  - Active pouch information
  - Active universe / shard indicators

- **Control**:
  - Vault ↔ Pouch transfers
  - Currency spend/receive
  - Item use (e.g., consume, equip) at the UI layer
  - Admin functions (for authorized admins)

- **Communication**:
  - With the Feud 4 backend (Firestore) through HTTPS
  - With the active pouch via chat channel and link messages
  - With containers only indirectly (optionally), via pouch or Vault

### 2.2 Explicit non-responsibilities

- HUD does **not**:
  - Embed Firestore logic for world objects
  - Resolve crafting, recipe, or stat logic for objects in the world
  - Provide per-object APIs beyond pouch and possibly container UI
  - Store authoritative player stats locally

These are delegated to:

- Firestore Bridge (for world-object lookup)
- Backend services
- World scripts using pouch/container APIs

---

## 3. Core HUD components

### 3.1 Universal Inventory (Vault) UI – `I` button

**Purpose:**  
Show the player’s universal inventory (Vault) and allow Vault ↔ Pouch transfers.

**Features:**

- Paginated list/grid of items in Vault
- Search/filter by name, type, tags, rarity
- Simple item detail view (icon, description, tags)

**Operations:**

- **Withdraw to Pouch**:
  - Player selects item + quantity
  - HUD:
    - Checks if an active pouch is present and verified (session ID)
    - Calls backend: decrement Vault amount
    - On success: instructs pouch_core to `addItem`
    - On failure: shows error, does not touch pouch

- **Deposit from Pouch**:
  - Player chooses item + quantity from pouch (list provided by pouch_core)
  - HUD:
    - Requests pouch_core to reserve/remove the amount
    - Calls backend: increment Vault amount
    - On backend failure: instructs pouch_core to roll back (optional) or warn player

**Offline behavior:**

- If Vault is unavailable:
  - Vault UI shows “Vault temporarily unavailable”
  - Withdraw/deposit buttons disabled
  - Pouch remains usable for local gameplay

---

### 3.2 Container UI – `C` button

**Purpose:**  
Either:

- Show a “container browser” UI for containers the player has “registered” with the HUD, or
- Provide context-sensitive container UI when interacting with a container.

This can be implemented in phases.

**Phase 1 (minimal):**

- `C` shows a “No containers bound to HUD yet” message.
- Later, when containers gain HUD-awareness:
  - `C` lists “favourite” or “nearby” containers
  - Allows simple content viewing and possibly Vault proxy actions (if designed)

For Feud 4 initial focus, `C` is lower priority than:

- `I` (Vault)
- `$` (Currency)
- pouch integration
- Firestore Bridge

---

### 3.3 Currency UI – `$` button

**Purpose:**  
Provide a secure, authoritative, Vault-backed view and control over player currency.

**Currency types:**

- Gold Coin
- Silver Coin
- Bronze Coin
- Copper Coin

All currency is stored **only in Vault**, never in LSD.

**Features:**

- Display balances for each coin type
- Support currency spend/gain from:
  - Vendors
  - Quests
  - Rewards
  - Admin tools

**Operations:**

- `addCurrency(type, amount)`
- `removeCurrency(type, amount)`
- `convertCurrency(fromType, toType, amount)` (optional)

All operations:

- Call backend (Firestore / Cloud Functions)
- Update local HUD display on success
- Never attempt to store currency in pouches/containers

---

## 4. HUD ↔ Pouch integration

### 4.1 Registration

On pouch attach:

- `pouch_core` sends HUD on `PLAYERHUDCHANNEL`:
  - `registerAction,pouch,<pouchNameOrKey>`
- On detach:
  - `unregisterAction,pouch,<pouchNameOrKey>`

HUD maintains:

- Active pouch reference
- Session ID (queried via API from pouch)

### 4.2 Commands HUD sends to pouch

Examples:

- `getPouchContents`  
  → pouch replies with a structured list/JSON of items

- `addItem,<itemName>,<quantity>`  
  (used after successful Vault → Pouch withdraw)

- `removeItem,<itemName>,<quantity>`  
  (used before Pouch → Vault deposit)

- `eatItem,<itemName>,<effectPayload>`  
  (HUD provided effectPayload from Firestore metadata)

**Note:** The exact string formats are defined in the inventory/pouch spec and should be reused here.

---

## 5. Admin integration

For authorized admins, the HUD exposes:

- An Admin panel (e.g., `A` button or long-press gesture)
- Links into Admin tools:
  - Player lookup
  - Inventory / currency adjustment
  - Stat editing
  - Universe configuration (for high-level admins)

Admin UI is backed by:

- Firestore (admin collections)
- Cloud Functions with admin-only checks
- Per-admin permissions model

(Details in the Admin Tools document.)

---

## 6. Future HUD features

- Quest panel
- Combat log and status effects view
- Universe selector / shard indicator
- RP log and XP overview
- Multi-language support

---

# End of Document