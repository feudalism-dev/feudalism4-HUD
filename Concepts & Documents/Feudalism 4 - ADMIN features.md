# Feudalism 4 – Admin Tools Architecture  
### Draft 1.0

## 1. Overview

Feudalism 4 includes an Admin Tooling layer for:

- Managing players (stats, inventory, currency)
- Managing universes (rules, modifiers, whitelists/blacklists)
- Observing and debugging the system
- Running events and interventions

Admin tooling sits on top of:

- Firestore (as the source of truth)
- HUD (for in-world admin actions)
- External dashboards (optional, web-based)

---

## 2. Admin roles and permissions

### 2.1 Roles (example)

- **System Admin**  
  Full access; can change anything.
- **Game Admin**  
  Can adjust players, world states, and universes; cannot alter system configs.
- **Moderator**  
  Limited tools: mutes, warnings, small adjustments.
- **Universe Owner**  
  Can configure their specific universe rules & whitelists.

Permissions are enforced:

- In Firestore rules
- In Cloud Functions
- In HUD Admin UI (visibility and available actions)

---

## 3. Admin capabilities

### 3.1 Player-focused

- Search players by:
  - avatar key
  - display name
  - Feud 4 ID
- View:
  - stats
  - achievements
  - quest states
  - currency balances
  - Vault inventory
- Adjust:
  - stats (add/subtract/reset)
  - currency (grant/remove)
  - inventory (grant/revoke specific items)
- Sanctions:
  - soft reset (inventory/stat partial)
  - hard reset (careful, high-level only)
  - flags/notes on player records

### 3.2 Universe-focused

- Configure:
  - stat caps
  - XP modifiers
  - loot/drop tables
  - allowed item sets
  - disallowed item sets
  - RP guidelines (informational)
- Activate/deactivate universe-wide events:
  - double XP weekends
  - resource surges/scarcity

### 3.3 Item-focused

- Mark items as:
  - rare
  - unique
  - soulbound
  - universe-limited
- Adjust:
  - balance properties (e.g., damage, modifiers)
- Deprecate items:
  - retire from drops
  - automatically convert to replacement items

---

## 4. Interfaces

### 4.1 HUD Admin panel

For in-world actions such as:

- Inspect player:
  - right-click or click admin scan button
  - see quick overlay of stats and flags
- Quick adjustments:
  - add/remove currency
  - tweak stats
  - grant quest item
- Moderation:
  - log admin notes
  - mark a player as under review

### 4.2 Web/Admin Dashboard (optional, recommended)

A browser-based UI for:

- Searching large data sets
- Bulk operations
- Deep analytics
- Historical logs
- Universe configuration management

Backend uses the same Firestore data model, so HUD and web admin stay in sync.

---

## 5. Data model (high-level)

### 5.1 Players

Example collections:

- `players/{playerId}/profile`
- `players/{playerId}/stats`
- `players/{playerId}/currency`
- `players/{playerId}/vaultInventory`
- `players/{playerId}/flags`
- `players/{playerId}/notes`
- `players/{playerId}/quests`

### 5.2 Universes

- `universes/{universeId}/config`
- `universes/{universeId}/rules`
- `universes/{universeId}/events`

### 5.3 Items

- `items/{itemId}`
- `consumables/{itemId}`
- `recipes/{recipeId}`

### 5.4 Logs (optional)

- `logs/adminActions/{logId}`
- `logs/economy/{logId}`
- `logs/events/{logId}`

---

## 6. Safety and audit

- Every admin action should be:
  - logged with timestamp
  - actor (admin)
  - target player/universe
  - before/after values where applicable
- Certain critical actions require:
  - higher privilege
  - confirmation prompts
  - possibly dual-approval for the most destructive changes

---

7. Admin Tools – Identity Data Management
(Genders, Species, Classes, Careers)
Feudalism 4 treats genders, species, classes, and careers as data‑driven identity primitives that define character creation, RP flavor, and mechanical modifiers. These are stored centrally in Firestore and managed exclusively through Admin Tools.
This ensures:
- Consistency across universes
- Easy updates without touching scripts
- Creator‑friendly customization
- Secure, authoritative definitions
- Automatic propagation to HUDs, pouches, and world objects

7.1 Data Model
Each identity category is stored in its own Firestore collection:
genders/{genderId}
species/{speciesId}
classes/{classId}
careers/{careerId}


Each document contains:
Common fields
- name: string
- description: string
- icon: optional URL or asset reference
- tags: list of strings
- enabled: boolean (for soft-deprecation)
- universeOverrides: map (optional per-universe modifications)
Optional mechanical fields
Depending on category:
- statModifiers: map of statName → integer
- manaEnabled: boolean
- manaModifier: integer
- allowedClasses: list
- allowedCareers: list
- restrictedSpecies: list
- restrictedGenders: list
These fields allow deep customization without touching LSL.

7.2 Admin Capabilities
Admins (or universe owners) can:
Create new entries
- Add new genders, species, classes, or careers
- Provide name, description, icon, tags
- Define mechanical modifiers
- Define universe-specific overrides
Edit existing entries
- Update descriptions
- Change icons
- Add/remove tags
- Adjust stat modifiers
- Enable/disable entries
- Add universe-specific rules
Delete or deprecate entries
- Hard delete (system admin only)
- Soft delete via enabled = false
Preview changes
- HUD preview mode
- Universe preview mode
- Test character creation with new definitions

7.3 HUD Integration
The HUD uses these definitions for:
- Character creation
- Character editing
- Displaying species/class/gender/career in profile
- Applying stat modifiers
- Determining mana availability
- Enforcing universe restrictions
HUD fetches identity data via:
- Firestore direct calls
- Cached local copies
- Universe override logic

7.4 Universe Overrides
Each universe can override identity definitions:
Example:
universeOverrides: {
  "medieval": {
    "enabled": true,
    "statModifiers": { "strength": +2 },
    "restrictedClasses": ["Mage"]
  },
  "sci-fi": {
    "enabled": false
  }
}


This allows:
- Species that exist only in certain universes
- Classes that behave differently per universe
- Genders with universe-specific RP rules
- Careers that unlock only in certain worlds
Universe owners manage overrides through the Admin UI.

7.5 Admin UI (HUD)
The HUD Admin Panel includes:
Identity Management Section
- Tabs: Genders, Species, Classes, Careers
- List view with:
- Name
- Enabled/disabled
- Tags
- Universe availability
Edit Panel
- Name
- Description
- Icon
- Tags
- Stat modifiers
- Mana settings
- Allowed/restricted lists
- Universe overrides
Actions
- Create new
- Duplicate existing
- Save changes
- Soft delete
- Hard delete (system admin only)

7.6 Firestore Security Rules
Identity collections are protected by:
- Read: allowed for all authenticated players
- Write: allowed only for admins or universe owners
- Hard delete: system admin only
- Universe overrides: universe owner or system admin
This ensures:
- Players cannot modify identity definitions
- Universe owners can customize their own worlds
- System admins maintain global consistency

7.7 Impact on Other Systems
Identity data affects:
Character Creation
- Available genders/species/classes/careers
- Stat modifiers
- Mana availability
HUD
- Display of identity
- Stat calculations
- RP profile
Pouch/Container
- No direct dependency, but identity may affect:
- capacity modifiers
- allowed items (optional future feature)
World Objects
- NPCs may use species/class definitions
- Quests may require certain careers
- Combat may use class modifiers

End of Identity Management Section

# End of Document