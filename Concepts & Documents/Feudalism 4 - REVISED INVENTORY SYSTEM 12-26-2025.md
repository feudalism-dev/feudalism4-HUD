(Inventory Management Only — Strict Scope)

0. Scope Limitation (MANDATORY)
This document applies ONLY to the INVENTORY MANAGEMENT portion of the project.
Cursor must follow these rules:
✔ This spec ONLY affects:
- The Inventory section of the Setup HUD (MOAP/JS)
- The SL dialog‑based handlers for the rp_inventory button on the Player HUD (LSL)
- The HUD inventory API (JS)
- The GIVE_ITEM / TAKE_ITEM message handling in
Feudalism 4 - Players HUD Firestore Bridge.lsl
❌ This spec does NOT affect ANY other part of the project:
Cursor must NOT modify, remove, rewrite, or refactor:
- Combat
- Stats
- XP
- Crafting
- Containers
- Pouches
- Wearables
- Action slots
- Animations
- Targeting
- Vendors
- NPCs
- Production chains
- Any other Setup HUD pages
- Any other Player HUD buttons
- Any other MOAP pages
- Any other LSL scripts
Only the inventory management code is replaced.
Everything else must remain untouched.

1. System Separation (MANDATORY)
1.1 Player HUD (LSL)
The Player HUD handles SL dialog menus only.
It must implement:
- rp_inventory button handler
- View Items (text‑only)
- Drop Item (text input)
- GIVE_ITEM / TAKE_ITEM message handling
- Calls to HUD JS inventory API
The Player HUD must NOT:
- Render HTML
- Use MOAP
- Modify the Setup HUD
- Display full inventory visually
- Implement GIVE to other avatars
- Implement sensors or avatar lists

1.2 Setup HUD (MOAP/JS)
The Setup HUD inventory page is read‑only.
It must:
- Call getInventory()
- Display a list of items + quantities
It must NOT:
- Modify inventory
- Implement give/drop/use
- Show SL dialogs
- Communicate with the Player HUD

1.3 The two HUDs do NOT communicate
- No messages between them
- No shared UI
- No shared logic
- They only share Firestore inventory data

2. Firestore Schema
Inventory is stored as a map field inside the user document:
users/{uuid}/
    inventory: {
        "<itemName>": <quantity:int>,
        ...
    }


Rules:
- Item names stored lowercase
- Quantities are integers
- No metadata, icons, or categories
Migration
- Ignore characters/{uuid}.inventory
- Do NOT migrate it
- Do NOT delete it
- Do NOT reference it

3. HUD Inventory API (JS)
Located in api-firestore.js inside the existing API object.
3.1 addItem(name, qty)
- Normalize name to lowercase
- Fetch current quantity (default 0)
- Write updated quantity
3.2 removeItem(name, qty)
- Normalize name
- Fetch current quantity
- New quantity = max(0, current - qty)
- Write updated quantity
3.3 getItemQuantity(name)
- Normalize name
- Return quantity or 0
3.4 checkItems(list)
- Ensure each {name, qty} is available
3.5 setItem(name, qty)
- Normalize name
- Write quantity directly
3.6 getInventory()
- Return full {name: quantity} object

4. LSL → JS Inventory Messaging
All inventory messages must be handled in:
Feudalism 4 - Players HUD Firestore Bridge.lsl
This is the ONLY script that communicates inventory changes to JS.
4.1 GIVE_ITEM
GIVE_ITEM|<name>|<qty>


HUD behavior:
- Normalize name
- Parse qty
- Call addItem(name, qty)
4.2 TAKE_ITEM
TAKE_ITEM|<name>|<qty>


HUD behavior:
- Normalize name
- Parse qty
- Call removeItem(name, qty)
No other message types are implemented in this phase.

5. Setup HUD Inventory Page (MOAP)
5.1 Behavior
- On load, call getInventory()
- Display a simple list:
Item        Quantity
--------------------
wheat       12
iron_ore    4
bread       1


5.2 Restrictions
- Read‑only
- No give/drop/use
- No modification of inventory
- No metadata, icons, or categories

6. Player HUD — rp_inventory Menu (LSL)
6.1 Main Menu
Inventory:
[View Items]
[Drop Item]
[Close]



6.2 View Items
Behavior:
- Call getInventory()
- Build a multi‑line TEXT block:
Your inventory:

wheat: 12
iron_ore: 4
bread: 1


Buttons:
[Close]


No pagination required in this phase.
No item selection.
View‑only.

6.3 Drop Item (text‑driven)
Flow:
- Ask for item name (text input)
- Normalize to lowercase
- If getItemQuantity(name) == 0, show error
- Ask for quantity (text input)
- Parse integer, clamp to available
- Ask for confirmation:
Drop <qty> <name>?
- If Yes → removeItem(name, qty)
Notes:
- No GIVE function in this phase
- No sensors
- No avatar lists
- No targeting

7. Out of Scope (Cursor must NOT implement)
Cursor must NOT implement:
- GIVE to other avatars
- Sensors or avatar lists
- Containers
- Pouches
- Wearable items
- Consumables
- “Use Item”
- Action slots
- Metadata
- Icons
- Categories
- Master Item Dictionary
- Crafting
- Vendors
- NPCs
- Physical dropped objects
- Any Setup HUD → Player HUD communication
- Any Player HUD → Setup HUD communication
- Any changes to non‑inventory systems

End of Document
