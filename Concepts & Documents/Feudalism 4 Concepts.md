Feudalism RPG 4: Master Design Document

## 1. The Core Engine: Exploding d20 + Vocation

The game utilizes an **Opposed Exploding d20 Pool** combined with a static **Vocation Bonus**.

* **The Roll:** Attribute \times d20! (Where ! indicates a 20 rolls again and adds).
* **The Vocation Bonus:** A static number derived from (Stat A + Stat B).
* **The Formula:** \text{Pool Total} + \text{Vocation} = \text{Final Result}.

---

## 2. Dynamic Career Templates (Level-less System)

The **System Admin** has the power to create and modify "Classes" (Career Templates) on the fly via the server.

### **A. Class Structure**

Every Class Template contains:

* **The Vocation:** The name of the special bonus (e.g., "Knight's Prowess") and the two stats that calculate it.
* **Stat Envelopes:** The `Min` and `Max` caps for all 20 attributes.
* **The Progression Path:** Which classes are required to enter, and which "Exit Careers" are unlocked upon completion.

### **B. Vocation Logic (Non-Stacking)**

When a player switches careers (e.g., from *Squire* to *Knight*):

1. The old **Vocation** (and its bonus) is discarded.
2. The new **Vocation** is applied based on the new Class Template.
3. The player’s stats remain, but their **Caps** increase, allowing them to spend XP to grow further.

---

## 3. Administrative Roles & Permissions

The system uses **Role-Based Access Control (RBAC)** to ensure the game environment remains balanced and manageable.

| Role | Responsibility | Capability |
| --- | --- | --- |
| **System Admin** | World Architect | Create/Delete Species, Genders, Classes, and Vocations. |
| **Sim Admin** | Local Moderator | Award XP/Currency, manage local region events, override local rolls. |
| **Player** | Participant | Interact with world, manage own character within Class limits. |

---

## 4. UI & Character Management (MOAP)

The Character Creation and Management system utilizes **Media on a Prim (MOAP)** to provide a sophisticated, modern interface.

1. **Species Selection:** Choosing a Species sets the "Biological Base" stats.
2. **Gender Selection:** Sets social/career tags.
3. **Vocation Hub:** The UI pulls all available Class Templates from the server. If a player meets the prerequisites for a new career, the "Shift Career" button becomes active.

---

## 5. Security & Persistence

## 6. Global Permission Hierarchy & Management

The System Admin (Root) has the power to promote or demote any user via a **Web Management Console** (MOAP or External Browser). This ensures the game can scale as you recruit more help to run the sim or develop the world.

### **A. Role Definitions**

| Role | Power Level | Capability Description |
| --- | --- | --- |
| **System Admin** | **Root (3)** | Full CRUD (Create, Read, Update, Delete) access to Global Templates (Classes, Species, Vocations). Can promote/demote System and Sim Admins. |
| **Sim Admin** | **Officer (2)** | Region-level controls. Can award/deduct XP and Currency, modify local "World State" objects, and override player rolls for storytelling purposes. |
| **Player** | **User (1)** | standard gameplay access. Can only modify their own character within the boundaries set by their current Class Template. |

### **B. Admin Management Workflow**

To ensure security, the process for adding new admins is handled through the **System Dashboard**:

1. **Search:** The System Admin enters a Resident's Legacy Name or UUID into the Dashboard.
2. **Assign Role:** The Admin selects "System Admin" or "Sim Admin" from a dropdown menu.
3. **Validation:** The server updates the `users` collection in Firebase:
* `{ "uuid": "0000-0000...", "role": "sys_admin", "date_promoted": "2025-12-17" }`


4. **HUD Sync:** The next time that user attaches their HUD, the server sends an "Admin Flag." This unlocks the hidden Admin Menus and "God Mode" tools within the HUD interface.

---

## 7. Master Document: Data Structure (Technical Appendix)

For the System Admin to manage these dynamically, the Firebase database must be organized into four primary "Books":

### **1. The Ledger (Users)**

* Stores UUIDs and Permission Levels.
* Controls who can access the Admin Dashboard.

### **2. The Grimoire (Classes & Vocations)**

* Stores your Level-less Career Templates.
* Defines the **Vocation Bonus** formulas (e.g., Agility + Awareness).
* Defines the Stat Max/Min "Envelopes."

### **3. The Bestiary (Species)**

* Stores Racial base-stats and biological caps.
* Stores unique species abilities (e.g., "Night Vision" for Elves).

### **4. The Chronicles (Characters)**

* Stores the actual persistent data for every player.
* Tracks current XP, current Class, current Stats, and Inventory.

---

## 🛠️ The "Vocation" Management UI

When the System Admin opens the **Vocation Creator**, they will see a interface that allows them to "Build a Bonus."

* **Vocation Name:** [ Knight's Prowess ]
* **Primary Modifier:** (Dropdown: Fighting)
* **Secondary Modifier:** (Dropdown: Awareness)
* **Applied To:** [ Fighting Tests ]

This creates a dynamic link: whenever a player in the "Knight" class performs a "Fighting Test," the server automatically looks up the **Vocation** associated with that class and adds the current values of those two stats to the roll.


# ⚔️ Feudalism 4: System Design & World Specification

## 1. Project Vision

**Feudalism 4** is a high-fidelity, persistent RPG ecosystem for Second Life that simulates the social, economic, and martial complexities of a fantasy medieval world. It moves away from localized, script-heavy HUDs toward a **"Thin Client" architecture**—where the SL HUD is a window into a massive, grid-wide server environment.

---

## 2. The Core Mechanics (The "Rules of Reality")

The world functions on a "Skill-Pool" system that emphasizes training over raw luck, but leaves room for the "Divine Intervention" of **Ifnia, the Goddess of Luck**.

* **The Exploding d20 Pool**: Every action is resolved by rolling d20s equal to your Attribute (1–9). Any natural 20 "explodes," rolling again to add to the total.
* **Vocation System**: Replacing traditional levels, players occupy **Career Templates** (e.g., Squire, Smith, Alchemist).
* **The Vocation Bonus**: Each Class grants a unique, non-stacking bonus (e.g., "Knight’s Prowess") calculated by adding two secondary stats to the roll.
* **Horizontal Progression**: Players spend XP to increase stats within their current Class's "envelope." To grow further, they must "Career Shift" into an exit-career (e.g., Squire → Knight).

---

## 3. The Gameplay Pillars

### **A. Martial Combat & The Joust**

Combat is an opposed test of skills. The system is designed to handle everything from tavern brawls to formal tournaments.

* **Jousting**: A specialized compound test involving HUD-based timing, horse speed (detected via LSL), and an opposed **Fighting** roll to determine unhorsing or lance breakage.
* **The "Peasant's Prayer"**: Because of the exploding dice, a low-skill player always has a microscopic chance to land a "miracle" blow on a master, keeping combat tense and high-stakes.

### **B. Universal Production System (UPS)**

The world is built on a physical economy where players must interact with animated "Producers."

* **Resource Chains**: Gathering (Trees/Ore) leads to Processing (Sawhorse/Forge) and finally Crafting (Workbenches).
* **Server-Side Crafting**: All recipes and ingredient checks happen in **Firebase**. The HUD sends a "Craft" request, and the server validates the inventory before granting the item.
* **Dependency States**: Objects in the world communicate (e.g., an Oven only works if a nearby Campfire object is "Lit").

### **C. The Social Hierarchy & Administration**

The system mimics feudal governance through its **Role-Based Access Control (RBAC)**.

* **System Admins (Global)**: Architects who define Species, Classes, and the math of the world.
* **Sim Admins (Local)**: Region owners who act as "Lords," managing local XP, currency, and events.
* **Titles & Reputation**: Character names and feudal titles are persistent across the grid, displayed via the dynamic Title HUD.

---

## 4. Technical Infrastructure (Feudalism 4 vs 3)

The transition to version 4.0 centers on **consolidation and security**.

* 
**Unified MOAP HUD**: Replaces the legacy system that rezzed multiple physical sub-HUDs. All setup—Gender, Species (Human, Elf, Alka Alon, etc.), Stats, and Class selection—happens in a single web-driven interface.


* 
**Centralized Database**: All player data, inventories, and "World State" objects are stored in **Firebase**, preventing data loss during teleports or region crashes.


* 
**The Bestiary & Grimoire**: Admins manage a live "Species" list (currently supporting 21+ races like Human, Karshak Alon, and Merfolk) and a "Class" list through the server dashboard.

Moving from a fragmented "multi-HUD" attachment system to a single **Media On A Prim (MOAP)** interface is a massive upgrade. It eliminates the "inventory clutter" of 6+ separate HUD objects and provides a seamless, web-like experience that feels like a modern RPG.

By using a single MOAP HUD, the LSL script becomes a simple "window" that displays a web page hosted by your Google Apps Script (GAS). All the complex logic for pagination, stat math, and class descriptions happens in HTML/JavaScript, which is much more powerful than LSL.

---

## 🖥️ The Integrated MOAP Setup HUD Design

Instead of rezzing separate objects, your HUD will now have a single "Setup Mode" screen. This screen renders a rich, interactive web dashboard with the following workflow:

### **1. The Onboarding Flow (Web-Interface)**

The MOAP HUD will guide the player through a tabbed or stepped process:

* **Step 1: Identity (Title/Gender):** Combined into one screen. Players type their name and title into text fields and select a gender icon.
* **Step 2: Species Selection:** A gallery view of available species (pulled from your Firebase Bestiary). Clicking one updates the "Base Stat" preview on the side.
* **Step 3: Class (Career) Gallery:** A paginated grid of class thumbnails. Clicking a thumbnail opens a detailed modal showing the **Vocation** (e.g., "Knight’s Prowess: Agility + Awareness") and the stat caps.
* **Step 4: Stat Allocation:** The 20 stats are displayed with `[ + ]` and `[ - ]` buttons. The JS validates your XP pool in real-time, preventing you from exceeding the **Class Max** or **Species Max** defined in your templates.

---

## 🛠️ Updated Master Design Document: UI Addendum

### **10. Unified Setup Interface (MOAP)**

The legacy multi-HUD system is replaced by the **Aetherbound Nexus**, a single MOAP-enabled prim.

* **Communication:** The MOAP (HTML/JS) communicates with the LSL script via `window.location = "secondlife:///app/hud/" + data;`. This allows the web UI to tell the LSL HUD to "Save Character" or "Play Animation."
* **Dynamic Content:** Because the UI is web-based, the **System Admin** can add a new Species or Class to Firebase, and it will *instantly* appear in the HUD's gallery without players needing to update their objects.

---

## 👑 The System Admin Management Console

Since you want the ability for System Admins to add other Admins and manage templates, you can use this same MOAP technology to create an **Admin Dashboard**.

When a user with `Role: System_Admin` opens their HUD, they see an extra tab: **[ADMIN]**.

1. **User Manager:** A searchable list of all players. The Admin can click a name and select "Promote to Sim Admin."
2. **Template Editor:** A form to create new Classes.
* Input Name: "Paladin"
* Set Vocation: "Will + Fighting"
* Set Caps: (A grid of 20 number inputs)
* Set Requirements: (Select "Squire" from a dropdown)


3. **Global Parameters:** A slider to adjust the "Experience Multiplier" for the whole grid or toggle "Permadeath" settings.

---

## 🚀 Developer’s Implementation Roadmap

To get this "Level-less, Server-Bound, MOAP-Driven" system online, here is your order of operations:

1. **The Database (Firebase):** Create your collections for `Users`, `Characters`, and `Templates` (Species/Classes).
2. **The Server (GAS):** Write the "Referee" script that handles the **Exploding d20** math and the permission checks.
3. **The Web UI (HTML/JS):** Build the "Setup HUD" page that pulls the templates from GAS.
4. **The LSL HUD:** Create the "Shell" HUD that contains the MOAP face and the GSB script to talk to the server.
5. **The Admin Console:** Build the secondary web page for managing other admins and templates.


Strategic Implementation Plan

Reduce SL Footprint: Modify the default state to no longer check for SLOTS_NEEDED. A single HUD prim is all that will be required.


Stat Logic Migration: Move the statsChannel logic  into the JavaScript layer of the MOAP. This ensures that a player cannot click [+] if they have 0 XP, without needing a round-trip message to LSL.



Dynamic Species List: Instead of a hardcoded list species in the script , the MOAP will fetch the species list (Human, Elf, Alka Alon, etc.) directly from your Bestiary database.


Security: Keep the experience_permissions checks  as they are vital for ensuring only authorized players use the system, but use the Experience KVP (Key-Value Pair) to store the character's "Draft" state while they are in the MOAP UI.

This comprehensive overview synthesizes your vision for **Feudalism 4**, moving away from the fragmented, multi-HUD architecture of version 3.0  toward a centralized, server-bound, and mathematically robust RPG engine.

---

# ⚔️ Feudalism 4: System Design Specification

## 1. Core Philosophy: The Exploding d20 Pool

Feudalism 4 utilizes an **Opposed Exploding d20 Pool** to resolve all game actions. This system replaces standard linear rolls with a model that balances character mastery against "Divine Luck."

* 
**Pool Construction**: Players roll a number of d20 dice equal to their Attribute Rank (1–9).


* **The "Explosion" (Aces)**: Any natural **20** is recorded and rolled again, adding to the total. This process repeats infinitely as long as 20s are rolled.
* **Vocation Bonus**: A static numerical bonus unique to the character's current Class. It is derived from a formula of (Stat A + Stat B).
* **The Resolution Formula**: (Attribute \times d20!) + (Vocation) \ge Target Total.
* **Design Intent**: While high attributes provide consistency and a high "floor," the exploding mechanic ensures a Stat 1 character always has a "Peasant's Prayer" chance to overcome a Stat 9 demigod.

---

## 2. Level-less Career Progression

Following a "Warhammer-style" horizontal progression, players do not gain levels. Instead, they occupy **Class Templates**.

* **Stat Envelopes**: Each Class defines a `Min` and `Max` cap for the 20 attributes. Players spend XP to increase stats only within these boundaries.
* **Vocation Specialization**: Every Class provides a unique Vocation (e.g., "Knight’s Prowess"). These bonuses are **non-stacking**; when a player shifts to a new career, the old Vocation is replaced by the new one.
* **Career Shifting**: To move to a new Class, a player must "max out" the current template's core stats and meet specific prerequisites (Species, Gender, or previous Class).
* **Gender Changes**: Players can change their character's gender at any time through the Setup HUD. Gender has no mechanical impact and no universe restrictions apply. This behavior must remain unchanged.
* **Species Changes**: Species is **permanently locked** after character creation. Players cannot change species through the HUD. Only Super Users or System Admins may change species manually in Firestore. If a character's species becomes disallowed in their universe, the character keeps their species - no forced change, no automatic change, no UI prompt. This rule must not be altered or generalized. No species change UI, backend endpoints, automatic reassignment, fallback logic, or migration logic may be implemented.

---

## 3. Administrative Architecture & Roles

The system is managed via a **Google Apps Script (GAS)** and **Firebase** backend, governed by a three-tier permission hierarchy:

* **System Admin (Root)**: Has global authority to modify Master Templates. They can create/edit Species, Genders, and Classes, and promote/demote other admins.
* **Sim Admin (Officer)**: local moderators who can award XP, currency, and trigger region-specific events.
* **Player (User)**: standard access to character growth and world interaction.

---

## 4. Unified MOAP Interface

Feudalism 4 replaces the legacy "Multi-HUD" system  with a single **Media On A Prim (MOAP)** dashboard. This eliminates the need for rezzing sub-objects and managing multiple communication channels.

### **The Setup Workflow**

1. 
**Identity & Title**: Combined text entry for Name and Title.


2. 
**Species Selection**: A dynamic gallery of options (Human, Elf, Alka Alon, etc.) pulled directly from the server-side Bestiary.


3. 
**Class Gallery**: A paginated, thumbnail-based interface to view and select career templates.


4. 
**Stat Management**: An interactive grid for spending XP on the 20 attributes with real-time validation against Class/Species caps.



---

## 5. Technical Infrastructure (SL-to-Server)

* **Centralized Logic**: All dice rolls, stat math, and inventory updates occur on the GAS server. The HUD acts as a "Thin Client" for display and input.
* 
**Experience Integration**: Continues to utilize the **Feudalism RPG Experience** for secure data persistence and automated attachment handling.


* 
**Data Security**: By housing templates in Firebase, the System Admin can update game-wide parameters (like a new Species or Class) instantly across all HUDs without requiring a script reset or object update.



---

## 6. Comparison: v3.0 vs. v4.0

| Feature | Feudalism 3.0 (Legacy) | Feudalism 4.0 (Current) |
| --- | --- | --- |
| **HUD Logic** | 6+ physical sub-HUD attachments 

 | Single MOAP Unified HUD |
| **Roll System** | Static d6/d20 Pool | Exploding d20 Pool + Vocation |
| **Stat Caps** | Manual/Loose | Enforced via Class Templates |
| **Data Storage** | Dispersed/HUD-based | Centralized Firebase/GAS |
| **Admin Power** | Limited/Script-hardcoded | Dynamic Global Template Editor |


# ⚔️ Feudalism 4: System Design & World Specification

## 1. Project Vision

**Feudalism 4** is a high-fidelity, persistent RPG ecosystem for Second Life that simulates the social, economic, and martial complexities of a fantasy medieval world. It moves away from localized, script-heavy HUDs toward a **"Thin Client" architecture**—where the SL HUD is a window into a massive, grid-wide server environment.

---

## 2. The Core Mechanics (The "Rules of Reality")

The world functions on a "Skill-Pool" system that emphasizes training over raw luck, but leaves room for the "Divine Intervention" of **Ifnia, the Goddess of Luck**.

* **The Exploding d20 Pool**: Every action is resolved by rolling d20s equal to your Attribute (1–9). Any natural 20 "explodes," rolling again to add to the total.
* **Vocation System**: Replacing traditional levels, players occupy **Career Templates** (e.g., Squire, Smith, Alchemist).
* **The Vocation Bonus**: Each Class grants a unique, non-stacking bonus (e.g., "Knight’s Prowess") calculated by adding two secondary stats to the roll.
* **Horizontal Progression**: Players spend XP to increase stats within their current Class's "envelope." To grow further, they must "Career Shift" into an exit-career (e.g., Squire → Knight).

---

## 3. The Gameplay Pillars

### **A. Martial Combat & The Joust**

Combat is an opposed test of skills. The system is designed to handle everything from tavern brawls to formal tournaments.

* **Jousting**: A specialized compound test involving HUD-based timing, horse speed (detected via LSL), and an opposed **Fighting** roll to determine unhorsing or lance breakage.
* **The "Peasant's Prayer"**: Because of the exploding dice, a low-skill player always has a microscopic chance to land a "miracle" blow on a master, keeping combat tense and high-stakes.

### **B. Universal Production System (UPS)**

The world is built on a physical economy where players must interact with animated "Producers."

* **Resource Chains**: Gathering (Trees/Ore) leads to Processing (Sawhorse/Forge) and finally Crafting (Workbenches).
* **Server-Side Crafting**: All recipes and ingredient checks happen in **Firebase**. The HUD sends a "Craft" request, and the server validates the inventory before granting the item.
* **Dependency States**: Objects in the world communicate (e.g., an Oven only works if a nearby Campfire object is "Lit").

### **C. The Social Hierarchy & Administration**

The system mimics feudal governance through its **Role-Based Access Control (RBAC)**.

* **System Admins (Global)**: Architects who define Species, Classes, and the math of the world.
* **Sim Admins (Local)**: Region owners who act as "Lords," managing local XP, currency, and events.
* **Titles & Reputation**: Character names and feudal titles are persistent across the grid, displayed via the dynamic Title HUD.

---

## 4. Technical Infrastructure (Feudalism 4 vs 3)

The transition to version 4.0 centers on **consolidation and security**.

* 
**Unified MOAP HUD**: Replaces the legacy system that rezzed multiple physical sub-HUDs. All setup—Gender, Species (Human, Elf, Alka Alon, etc.), Stats, and Class selection—happens in a single web-driven interface.


* 
**Centralized Database**: All player data, inventories, and "World State" objects are stored in **Firebase**, preventing data loss during teleports or region crashes.


* 
**The Bestiary & Grimoire**: Admins manage a live "Species" list (currently supporting 21+ races like Human, Karshak Alon, and Merfolk) and a "Class" list through the server dashboard.



---

## 5. Summary of Roles

| Role | Responsibility |
| --- | --- |
| **System Admin** | Manages the **Class Templates**, **Species Base Stats**, and promotes new Admins.

 |
| **Sim Admin** | Oversees regional play, awards XP for roleplay, and manages regional "Production" objects. |
| **Player** | Navigates the career tree, participates in the economy, and engages in combat using the d20 pool. |
