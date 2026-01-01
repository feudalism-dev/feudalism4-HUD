# Feudalism 4 – Firestore Bridge Architecture  
### Draft 1.0

## 1. Overview

The **Firestore Bridge** is a generic script dropped into world objects that need:

- Player stats
- Item metadata
- Consumable metadata
- Crafting recipes
- Universe rules and overrides

It centralizes all Firestore/HTTPS logic so that **individual objects**:

- never embed URLs or API keys
- never talk directly to Firestore
- remain small, simple, and creator-friendly

World objects talk to the Bridge using link messages or a dedicated channel; the Bridge handles:

- requests to the backend
- caching
- responses
- offline mode

---

## 2. Design goals

- **Modularity:** One script, many consumers.
- **Security:** No API keys or Firestore logic embedded in every object.
- **Performance:** Cache repeated requests per object/region.
- **Fault tolerance:** Handle offline/unreachable backend gracefully.
- **Creator-friendliness:** Objects just send high-level “getX” messages.

---

## 3. Responsibilities

### 3.1 The Bridge does:

- Expose a small, clean LSL API:
  - `getStats`
  - `getItemMeta`
  - `getConsumable`
  - `getRecipe`
  - `getUniverseRules`
- Handle HTTP requests/responses to/from backend.
- Manage per-object cache to reduce redundant calls.
- Indicate errors or offline states to caller.

### 3.2 The Bridge does not:

- Make game decisions (e.g., success/fail, damage, XP).
- Directly modify pouches or containers.
- Directly modify Vault.
- Perform authoritative stat or inventory changes.

---

## 4. APIs

### 4.1 World Object → Bridge requests

Using `llMessageLinked(LINK_THIS, ...)` or a shared message bus pattern.

**Common pattern:**

- `bridge:<action>,<requestId>,<params...>`

Where `<requestId>` is a locally unique ID so the caller can match responses.

#### 4.1.1 Get player stats

- Request:
  - `bridge:getStats,<requestId>,<avatarKey>`
- Response:
  - `bridge:stats,<requestId>,<avatarKey>,<json>`

#### 4.1.2 Get item metadata

- Request:
  - `bridge:getItemMeta,<requestId>,<itemName>`
- Response:
  - `bridge:itemMeta,<requestId>,<itemName>,<json>`

#### 4.1.3 Get consumable metadata

- Request:
  - `bridge:getConsumable,<requestId>,<itemName>`
- Response:
  - `bridge:consumable,<requestId>,<itemName>,<json>`

#### 4.1.4 Get recipe metadata

- Request:
  - `bridge:getRecipe,<requestId>,<recipeIdOrName>`
- Response:
  - `bridge:recipe,<requestId>,<recipeIdOrName>,<json>`

#### 4.1.5 Get universe rules

- Request:
  - `bridge:getUniverseRules,<requestId>,<universeId>`
- Response:
  - `bridge:universeRules,<requestId>,<universeId>,<json>`

---

## 5. Caching strategy

### 5.1 Cache scope

- Per Bridge instance
- Optionally keyed by:
  - avatar ID (stats)
  - itemName
  - recipeId
  - universeId

### 5.2 Cache invalidation policy

- Time-based (e.g., 30–120 seconds lifetime)
- Manual invalidation for certain operations:
  - after stat-changing events
  - after crafting or level ups

### 5.3 Offline behavior

If backend is unreachable:

- For cached entries:
  - Serve cached data if still “fresh enough”.
- For uncached entries:
  - Return an error or “offline” flag in response JSON.

---

## 6. Security considerations

- Only the Bridge script contains:
  - HTTP endpoint URLs
  - API keys or tokens (if used)
- Other object scripts:
  - never see keys
  - cannot forge backend traffic directly

Admin or system tools should be able to:

- disable bridging for certain regions/universes
- switch endpoints (staging vs production)

---

## 7. Usage examples

### 7.1 Oven checking ingredients

1. Oven sends:
   - `bridge:getRecipe,<id>,<recipeName>`
2. Bridge replies with recipe JSON.
3. Oven uses:
   - recipe metadata
   - pouch API (`pouch_api`) to check ingredients

### 7.2 Pickpocket checking stats

1. Pickpocket module sends:
   - `bridge:getStats,<id>,<victimKey>`
2. Then:
   - `bridge:getStats,<id2>,<thiefKey>`
3. Uses stats for thievery vs awareness tests.

---

# End of Document