# Feudalism 4 - Players HUD Architecture & Design Document

## Executive Summary

This document outlines the architecture for migrating the Feudalism 3 Players HUD to Feudalism 4, leveraging Firebase/Firestore for data persistence and MOAP (Metaverse Object Application Protocol) for a modern, web-based UI. The goal is to streamline the codebase, improve performance, and create a more flexible and maintainable system.

---

## 1. Core Game Mechanics Analysis (From F3)

### 1.1 Combat System
**Core Logic:**
- **Dice-based combat** using Fighting stat (Xd20 where X = Fighting stat value)
- **Attack vs Defense rolls** with modifiers:
  - Agility for dodge bonuses
  - Weapon attack bonuses
  - Speed-based penalties/bonuses (movement > 3.2 m/s)
  - Height advantage (attacker position Z)
  - Impairment penalties
- **Hit location system** (9 body parts: head, neck, upper/lower torso, arms, legs, foot)
- **Damage calculation:**
  - Base weapon damage (randomized: 1 to 2x base damage)
  - Armor reduction (randomized: 1 to armor value)
  - Defense bonus reduction (randomized: 1 to defense bonus)
  - Degrees of success add extra damage
- **Weapon dropping mechanics** (30% chance on critical hits/misses)
- **XP rewards** based on combat outcomes

**Key Formulas:**
```
Defense Roll = Fighting × d20 + random(1 to Agility bonus)
Attack Roll = Attacker Fighting × d20 + random(1 to Attack bonus)
Degrees of Success = (Attack Roll - Defense Roll) / 10 + 1
Final Damage = Base Damage - Armor - Defense Bonus + (Degrees × Attack Bonus)
```

### 1.2 Health & Stamina System
**Core Logic:**
- **Base calculations:**
  - Health = (Athletics + Agility + Endurance) × 20
  - Stamina = (Endurance + Will + Athletics) × 20
- **Current values** tracked in real-time
- **Resting mechanics:** +1 health/stamina every 5 seconds until full
- **Passing out:** When health or stamina reaches 0
- **Impairment system:** Reduces dodge bonus
- **Stamina reduction:** -1 every 10 minutes (passive drain)

### 1.3 Weapon System
**Core Logic:**
- **Primary and secondary weapon slots**
- **Weapon properties:**
  - Type (dagger, sword, mace, etc.)
  - Base damage
  - Speed (attack speed modifier)
  - Weight (affects stamina)
  - Range (min/max in meters)
- **Draw/sheath mechanics** via channel communication
- **Weapon registration** when attached
- **Active weapon tracking** for combat calculations

**Weapon Types:** 16 types with varying stats

### 1.4 Armor System
**Core Logic:**
- **9 body parts** with independent armor coverage
- **Armor types:** none, cloth, fur, leather, chainmail, ring mail, scale mail, brigandine, plate
- **Protection values:** 0-8 based on type
- **Weight system:** Affects movement/stamina
- **Shield system:** Separate from body armor
- **Best armor wins:** If multiple pieces cover same part, highest value is used

### 1.5 Character Data
**Stored Data:**
- Name, Class, XP
- 20 stats (Agility, Animal Handling, Athletics, etc.)
- Current Health, Stamina
- Condition (normal, poisoned, etc.)
- Impairment Level
- Mode (roleplay, tournament, OOC, AFK)

### 1.6 Collision Detection
**Core Logic:**
- **Arrow detection:** Name contains "arrow"
- **Projectile damage:** Based on attacker's Marksmanship vs defender's Agility
- **Generic objects:** "fcobject" prefix with damage value
- **Automatic damage application** on collision

---

## 2. Obsolete/Redundant Code (Remove in F4)

### 2.1 Experience Database Integration
- **Remove:** All `llReadKeyValue`/`llUpdateKeyValue` calls
- **Replace with:** Firestore real-time listeners
- **Reason:** Firebase provides better reliability, real-time sync, and cross-region support

### 2.2 Complex State Machines
- **Remove:** Multiple states (preRun, loading, loaded, resting, experienceFailure)
- **Simplify:** Single state with event-driven logic
- **Reason:** Firebase handles async operations better, reducing need for complex state management

### 2.3 Version Control & State Management
- **Remove:** Manual version tracking, state persistence
- **Replace with:** Firestore document versioning (automatic)
- **Reason:** Firestore handles versioning and conflict resolution

### 2.4 Pouch/Water Bucket Detection
- **Remove:** Special channel listeners for pouches/buckets
- **Replace with:** MOAP UI for inventory management
- **Reason:** Better UX, centralized inventory system

### 2.5 Texture-Based UI
- **Remove:** Texture swapping for health/stamina bars, XP display
- **Replace with:** MOAP web-based UI
- **Reason:** More flexible, easier to update, better visual design

### 2.6 Manual Character Loading
- **Remove:** Sequential key-value reads with timers
- **Replace with:** Single Firestore document read with real-time listener
- **Reason:** Faster, more reliable, real-time updates

---

## 3. Feudalism 4 Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Second Life World                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Weapons      │  │  Armor       │  │  Projectiles │    │
│  │  (Attached)   │  │  (Attached)  │  │  (Collision) │    │
│  └──────┬────────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                   │                  │            │
│         └───────────────────┼──────────────────┘            │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Players HUD   │                      │
│                    │  (LSL Scripts) │                      │
│                    └────────┬───────┘                      │
│                             │                               │
│         ┌───────────────────┼───────────────────┐          │
│         │                   │                   │          │
│  ┌──────▼──────┐   ┌────────▼────────┐  ┌──────▼──────┐  │
│  │ Combat      │   │ Resource        │  │ Equipment   │  │
│  │ Manager     │   │ Manager         │  │ Manager     │  │
│  │ (LSL)       │   │ (LSL)           │  │ (LSL)       │  │
│  └──────┬──────┘   └────────┬────────┘  └──────┬───────┘  │
│         │                   │                   │          │
│         └───────────────────┼───────────────────┘          │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  MOAP Interface │                      │
│                    │  (Web UI)       │                      │
│                    └────────┬───────┘                      │
└─────────────────────────────┼───────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Firebase        │
                    │   ┌─────────────┐ │
                    │   │  Firestore  │ │
                    │   │  (Database) │ │
                    │   └─────────────┘ │
                    │   ┌─────────────┐ │
                    │   │  Hosting    │ │
                    │   │  (MOAP UI)  │ │
                    │   └─────────────┘ │
                    └───────────────────┘
```

### 3.2 Script Architecture

#### **Script 1: Combat Manager (LSL)**
**Purpose:** Handle all real-time combat calculations
**Responsibilities:**
- Listen for attack broadcasts from weapons
- Process attack/defense rolls
- Calculate damage with armor/defense
- Determine hit locations
- Apply health/stamina changes
- Broadcast combat results
- Handle weapon dropping
- Award XP for combat

**Why LSL:** Needs to be instant, real-time, and handle collision detection

**Data Flow:**
```
Weapon → Channel Message → Combat Manager → Calculate → Update Health → Firestore → MOAP UI
```

#### **Script 2: Resource Manager (LSL)**
**Purpose:** Manage health, stamina, and resource pools
**Responsibilities:**
- Track current health/stamina
- Calculate base health/stamina from stats
- Handle resting mechanics (timer-based recovery)
- Passive stamina drain
- Passing out/waking up logic
- Sync to Firestore on changes

**Why LSL:** Real-time updates needed, timer-based mechanics

**Data Flow:**
```
Timer/Event → Resource Manager → Update Values → Firestore → MOAP UI
```

#### **Script 3: Equipment Manager (LSL)**
**Purpose:** Detect and manage weapons/armor
**Responsibilities:**
- Listen for weapon registration (channel-based)
- Listen for armor registration (channel-based)
- Track active weapons (primary/secondary)
- Track armor coverage per body part
- Provide equipment data to combat system
- Sync equipment state to Firestore

**Why LSL:** Needs immediate response to attachment/detachment

**Data Flow:**
```
Weapon/Armor Attach → Channel Message → Equipment Manager → Update State → Firestore → MOAP UI
```

#### **Script 4: MOAP Interface Controller (LSL)**
**Purpose:** Bridge between LSL and MOAP web interface
**Responsibilities:**
- Initialize MOAP on HUD face
- Pass character data to MOAP via URL parameters
- Listen for MOAP commands via channel
- Send updates to MOAP (health, stamina, combat results)
- Handle MOAP-initiated actions (rest, reset, etc.)

**Why LSL:** MOAP requires LSL to initialize and communicate

**Data Flow:**
```
MOAP UI ←→ Channel/URL Params ←→ MOAP Controller ←→ Other Scripts
```

### 3.3 Firebase/Firestore Structure

#### **Character Document** (`characters/{uuid}`)
```javascript
{
  owner_uuid: "uuid",
  name: "Character Name",
  class_id: "knight",
  species_id: "human",
  stats: {
    agility: 5,
    fighting: 7,
    // ... all 20 stats
  },
  health: {
    current: 450,
    base: 500,
    max: 500
  },
  stamina: {
    current: 380,
    base: 400,
    max: 400
  },
  equipment: {
    primary_weapon: {
      type: "longsword",
      damage: 6,
      speed: 3,
      weight: 3,
      range: { min: 0.65, max: 1.6 }
    },
    secondary_weapon: null,
    armor: {
      head: "chainmail",
      neck: "leather",
      // ... all 9 body parts
    },
    shield: null
  },
  condition: "normal",
  impairment_level: 0,
  mode: "roleplay", // roleplay, tournament, ooc, afk
  xp: 12500,
  points: 15,
  updated_at: timestamp,
  last_combat: timestamp
}
```

#### **Combat Log Collection** (`combat_logs/{logId}`)
```javascript
{
  attacker_uuid: "uuid",
  defender_uuid: "uuid",
  timestamp: timestamp,
  attack_roll: 87,
  defense_roll: 72,
  hit_location: "upper torso",
  damage_dealt: 12,
  armor_reduction: 3,
  degrees_of_success: 2,
  weapon_type: "longsword",
  result: "hit" // hit, miss, critical
}
```

#### **Inventory System** (`inventories/{uuid}`)
```javascript
{
  owner_uuid: "uuid",
  items: [
    {
      id: "item_123",
      template_id: "iron_sword",
      name: "Iron Longsword",
      quantity: 1,
      condition: 100, // durability
      properties: {
        damage: 6,
        speed: 3,
        weight: 3
      },
      acquired_at: timestamp
    },
    // ... more items
  ],
  currency: 500,
  weight: 45.2, // total weight
  capacity: 100, // max weight
  updated_at: timestamp
}
```

#### **Container System** (`containers/{containerId}`)
```javascript
{
  container_id: "uuid_of_object", // SL object UUID
  owner_uuid: "uuid", // who placed it (optional for public containers)
  type: "pouch" | "chest" | "barrel" | "crate" | "shop",
  name: "Leather Pouch",
  location: {
    region: "region_name",
    position: { x: 100, y: 200, z: 50 }
  },
  access: {
    public: false,
    allowed_uuids: ["uuid1", "uuid2"], // for sharing
    locked: false
  },
  items: [
    // Same item structure as inventory
  ],
  capacity: 50, // max weight
  weight: 12.5,
  created_at: timestamp,
  updated_at: timestamp
}
```

#### **Item Templates** (`item_templates/{templateId}`)
```javascript
{
  id: "iron_sword",
  name: "Iron Longsword",
  category: "weapon",
  subcategory: "sword",
  description: "A well-crafted iron longsword",
  weight: 3.0,
  value: 150, // base currency value
  stackable: false,
  max_condition: 100,
  properties: {
    damage: 6,
    speed: 3,
    weapon_type: "longsword",
    range: { min: 0.65, max: 1.6 }
  },
  requirements: {
    stats: {
      fighting: 3
    }
  },
  enabled: true
}
```

### 3.4 MOAP Interface Design

#### **Main HUD View**
- **Health Bar:** Real-time health display with percentage
- **Stamina Bar:** Real-time stamina display with percentage
- **XP Display:** Current XP and progress to next milestone
- **Equipment Display:** Active weapons and armor summary
- **Quick Actions:** Rest, Reset, Mode Toggle

#### **Combat View** (Modal/Overlay)
- **Combat Log:** Recent combat events
- **Hit Location Display:** Visual body diagram showing recent hits
- **Damage Breakdown:** Show armor reduction, degrees of success

#### **Equipment View** (Modal)
- **Weapon Slots:** Primary/Secondary with stats
- **Armor Coverage:** Visual body diagram with armor types
- **Equipment Details:** Weight, protection values

#### **Inventory View** (Modal)
- **Item Grid:** Visual grid of all items in inventory
- **Item Details:** Hover/click for item stats, description
- **Weight Display:** Current weight / Max capacity
- **Filter/Sort:** By category, type, value
- **Quick Actions:** Use, Drop, Transfer to Container

#### **Container View** (Modal - opened from in-world container)
- **Container Contents:** Grid of items in container
- **Player Inventory:** Side-by-side with container for drag-drop
- **Transfer Buttons:** Quick transfer actions
- **Access Control:** Shows who can access (for shared containers)
- **Weight/Capacity:** For both player and container

#### **Settings View** (Modal)
- **Mode Selection:** Roleplay, Tournament, OOC, AFK
- **Display Options:** Show/hide bars, combat notifications
- **Reset Options:** OOC Reset, IC Rest

---

## 4. Inventory & Container System

### 4.1 Overview

The inventory system in Feudalism 4 is designed to support:
- **Virtual items** stored in Firestore (not SL inventory)
- **In-world containers** (pouches, chests, barrels, shops) that can hold virtual items
- **Trading/sharing** between players via containers
- **API for in-world objects** to interact with inventory system

### 4.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    In-World Objects                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Pouch       │  │  Chest       │  │  Shop        │    │
│  │  (Container) │  │  (Container) │  │  (Container) │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            │                               │
│                    ┌───────▼────────┐                      │
│                    │  Container     │                      │
│                    │  Script        │                      │
│                    │  (LSL)         │                      │
│                    └───────┬────────┘                      │
│                            │                               │
│                    ┌───────▼────────┐                      │
│                    │  Inventory API  │                      │
│                    │  Channel        │                      │
│                    │  (-77780)       │                      │
│                    └───────┬────────┘                      │
└────────────────────────────┼───────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Players HUD    │
                    │  Inventory API  │
                    │  Manager (LSL)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Firestore     │
                    │   - inventories │
                    │   - containers  │
                    │   - items       │
                    └─────────────────┘
```

### 4.3 Container Object Script Template

**Every in-world container needs:**
1. **Container Registration Script** - Registers container with HUD on rez
2. **Access Control** - Checks permissions before allowing access
3. **UI Script** - Displays container contents (MOAP or prim-based)
4. **API Communication** - Communicates with HUD via channel

**Example Container Script Structure:**
```lsl
// Container Registration
integer INVENTORY_API_CHANNEL = -77780;
key containerUUID;
string containerType = "pouch";
string containerName = "Leather Pouch";

default {
    on_rez(integer start_param) {
        containerUUID = llGetKey();
        // Register with HUD
        llRegionSay(INVENTORY_API_CHANNEL, 
            "registerContainer," + (string)containerUUID + "," + 
            containerType + "," + containerName);
    }
    
    touch_start(integer num_detected) {
        key toucher = llDetectedKey(0);
        // Request container contents from HUD
        llRegionSay(INVENTORY_API_CHANNEL, 
            "getContainer," + (string)containerUUID + "," + (string)toucher);
    }
}
```

### 4.4 Inventory API Protocol

**Channel:** `-77780` (Inventory API Channel)

**Message Format:** `action,param1,param2,...`

**Supported Actions:**

| Action | Parameters | Description |
|--------|-----------|-------------|
| `getInventory` | `player_uuid` | Get player's inventory from Firestore |
| `getContainer` | `container_uuid,player_uuid` | Get container contents (with access check) |
| `addItem` | `container_uuid,item_template_id,quantity` | Add item to container |
| `removeItem` | `container_uuid,item_id,quantity` | Remove item from container |
| `transferItem` | `from_type,from_id,to_type,to_id,item_id,quantity` | Transfer item between inventories |
| `registerContainer` | `container_uuid,type,name` | Register new container in Firestore |
| `unregisterContainer` | `container_uuid` | Remove container from Firestore |
| `checkAccess` | `container_uuid,player_uuid` | Check if player can access container |
| `openContainer` | `container_uuid,player_uuid` | Open container UI for player |
| `closeContainer` | `container_uuid,player_uuid` | Close container UI |

**Transfer Types:**
- `player` - Player inventory
- `container` - In-world container
- `ground` - Temporary ground drop (for item dropping)

### 4.5 Item Transfer Flow

#### **Player → Container:**
```
1. Player opens container (touch/command)
2. Container script → Sends "getContainer" to HUD
3. HUD Inventory Manager → Queries Firestore for container
4. HUD Inventory Manager → Returns container data to container script
5. Container script → Displays contents (MOAP UI or prim text)
6. Player selects item to deposit
7. Container script → Sends "transferItem,player,player_uuid,container,container_uuid,item_id,qty"
8. HUD Inventory Manager → Validates transfer (weight, capacity, permissions)
9. HUD Inventory Manager → Updates Firestore (atomic transaction)
10. HUD Inventory Manager → Broadcasts update to MOAP UI
11. Container script → Refreshes display
```

#### **Container → Player:**
```
1. Player opens container
2. Player selects item to take
3. Container script → Sends "transferItem,container,container_uuid,player,player_uuid,item_id,qty"
4. HUD Inventory Manager → Validates transfer
5. HUD Inventory Manager → Updates Firestore
6. HUD Inventory Manager → Broadcasts to MOAP UI
7. Container script → Refreshes display
```

#### **Player → Player (Trading):**
```
1. Player A opens trade with Player B (both must be nearby)
2. Player A selects items to trade
3. Trade system → Creates temporary trade document in Firestore
4. Player B reviews and accepts
5. Trade system → Executes atomic transfer of all items
6. Both players' inventories updated
7. Trade document deleted
```

### 4.6 Container Types

| Type | Description | Access | Use Case |
|------|-------------|--------|----------|
| **pouch** | Personal container, attached to avatar | Owner only | Personal storage |
| **chest** | Fixed location container | Owner + allowed list | Home storage |
| **barrel** | Public container | Public | Community storage |
| **crate** | Temporary container | Owner only | Temporary storage |
| **shop** | Merchant container | Public (buy), Owner (stock) | Commerce |
| **trade** | Temporary trading container | Two players | Player-to-player trading |

### 4.7 Security Considerations

1. **Access Control:**
   - Containers check player UUID before allowing access
   - Firestore rules enforce ownership
   - HUD validates all transfer requests

2. **Atomic Transactions:**
   - All item transfers use Firestore transactions
   - Prevents duplication/exploitation
   - Rollback on failure

3. **Rate Limiting:**
   - Limit API calls per container (prevent spam)
   - Cooldown on rapid transfers

4. **Validation:**
   - Verify item exists before transfer
   - Check weight/capacity limits
   - Validate item templates

### 4.8 MOAP Integration

**Container UI can be:**
1. **MOAP-based** - Web interface for rich display
2. **Prim-based** - Simple text display for performance
3. **Hybrid** - MOAP for complex containers, prims for simple ones

**MOAP Container View:**
- Item grid with icons
- Item details on hover/click
- Drag-and-drop for transfers
- Weight/capacity display
- Search/filter functionality

## 5. Data Flow & Synchronization

### 4.1 Character Loading
```
1. HUD Attached → MOAP Controller initializes
2. MOAP Controller → Reads character from Firestore
3. Firestore → Returns character document
4. MOAP Controller → Passes data to MOAP UI via URL params
5. MOAP UI → Displays character data
6. Firestore Listener → Real-time updates to MOAP UI
```

### 4.2 Combat Flow
```
1. Weapon broadcasts attack → Combat Manager receives
2. Combat Manager → Reads defender stats from Firestore (cached locally)
3. Combat Manager → Calculates attack/defense
4. Combat Manager → Applies damage to local health
5. Combat Manager → Updates Firestore character document
6. Firestore → Triggers real-time listener
7. MOAP UI → Updates health bar instantly
8. Combat Manager → Logs combat event to Firestore
```

### 4.3 Equipment Changes
```
1. Weapon/Armor Attached → Sends channel message
2. Equipment Manager → Receives registration
3. Equipment Manager → Updates local state
4. Equipment Manager → Updates Firestore character.equipment
5. Firestore → Triggers real-time listener
6. MOAP UI → Updates equipment display
```

### 4.4 Resource Updates (Health/Stamina)
```
1. Timer/Event → Resource Manager updates value
2. Resource Manager → Updates local state
3. Resource Manager → Updates Firestore (throttled: max 1/sec)
4. Firestore → Triggers real-time listener
5. MOAP UI → Updates bars
```

---

## 7. Performance Considerations

### 5.1 Local Caching
- **Character stats:** Cache in LSL script memory (updated on Firestore changes)
- **Equipment data:** Cache locally, sync on changes
- **Combat calculations:** All done locally, Firestore updated after

### 5.2 Firestore Optimization
- **Throttle updates:** Health/stamina updates max 1 per second
- **Batch writes:** Group multiple updates when possible
- **Use listeners:** Real-time listeners instead of polling
- **Index optimization:** Index on `owner_uuid`, `last_combat`

### 5.3 MOAP Performance
- **Lazy loading:** Load combat log only when opened
- **Debounce updates:** Throttle UI updates to 60fps max
- **Cache busting:** Version parameters for script updates

---

## 8. Security Considerations

### 6.1 Firestore Rules
- Characters: Users can only read/write their own character
- Combat logs: Read own logs, write on combat events
- Admin access: System admins can read all

### 6.2 LSL Security
- Validate all channel messages (check sender UUID)
- Sanitize all user input
- Rate limit combat events (prevent spam)

---

## 9. Migration Strategy

### Phase 1: Core Infrastructure
1. Set up Firestore character structure
2. Create MOAP interface skeleton
3. Implement MOAP Controller script
4. Migrate character loading from Experience DB to Firestore

### Phase 2: Combat System
1. Port combat calculations to Combat Manager script
2. Implement Firestore combat logging
3. Create MOAP combat display
4. Test combat flow end-to-end

### Phase 3: Resource Management
1. Port health/stamina logic to Resource Manager
2. Implement resting mechanics
3. Create MOAP resource bars
4. Test resource updates

### Phase 4: Equipment System
1. Port weapon/armor detection to Equipment Manager
2. Implement Firestore equipment sync
3. Create MOAP equipment display
4. Test equipment changes

### Phase 5: Inventory & Container System
1. Design Firestore inventory/container structure
2. Implement Inventory API Manager script
3. Create container registration system
4. Build MOAP inventory/container UI
5. Test item transfers (player ↔ container)
6. Implement trading system (player ↔ player)

### Phase 6: Polish & Optimization
1. Optimize Firestore queries
2. Improve MOAP UI/UX
3. Add animations/feedback
4. Performance testing
5. Security audit

---

## 10. Key Differences: F3 vs F4

| Feature | F3 | F4 |
|---------|----|----|
| **Data Storage** | Experience Database (Key-Value) | Firestore (Document Database) |
| **UI** | Texture-based prims | MOAP Web Interface |
| **Character Loading** | Sequential key reads with timers | Single document read + real-time listener |
| **State Management** | Complex state machines | Event-driven with Firestore |
| **Combat Logging** | None | Firestore collection |
| **Real-time Updates** | Manual polling | Firestore listeners |
| **Cross-region** | Limited | Full support |
| **Version Control** | Manual | Automatic (Firestore) |
| **Inventory** | Pouch detection (channel-based) | Firestore + MOAP UI + Container API |
| **Containers** | Simple pouch objects | Full container system with sharing/trading |

---

## 11. Benefits of F4 Architecture

1. **Performance:** Faster character loading, real-time updates
2. **Reliability:** Firestore handles failures, retries, offline support
3. **Flexibility:** MOAP UI easier to update, no texture uploads
4. **Scalability:** Firestore scales automatically
5. **Maintainability:** Cleaner code, separation of concerns
6. **Cross-platform:** MOAP works on any device with web browser
7. **Real-time:** Instant updates across all clients
8. **Analytics:** Firestore enables combat analytics, player stats

---

## 12. Open Questions & Considerations

### 12.1 Inventory & Container Questions
1. **Item Durability:** Should items degrade with use? (Weapons, armor, tools)
2. **Stacking:** How to handle stackable items (arrows, coins, materials)?
3. **Container Persistence:** Should containers persist across region restarts?
4. **Ground Items:** How to handle items dropped on ground? (Temporary vs permanent)
5. **Item Crafting:** Should crafting consume items from inventory or containers?
6. **Container Limits:** Max items per container? Max weight? Max containers per player?
7. **Container Theft:** Can containers be "stolen" or must they be given?
8. **MOAP vs Prim UI:** Which containers should use MOAP? (Performance vs features)

1. **Offline Mode:** Should HUD work offline? (Cache last known state)
2. **Combat Spam Protection:** Rate limiting on combat events?
3. **XP Calculation:** Server-side validation or client-side?
4. **Animation System:** How to trigger SL animations from MOAP?
5. **Multi-region Combat:** How to handle cross-region combat?
6. **Weapon Durability:** Should weapons degrade? (Not in F3)
7. **Status Effects:** Poison, disease system? (Partially in F3)
8. **MOAP vs Prim UI:** Should some UI stay as prims for speed?

---

## Conclusion

The Feudalism 4 architecture leverages modern web technologies (Firebase/MOAP) while preserving the core game mechanics that made F3 fun. By moving data persistence to Firestore and UI to MOAP, we gain flexibility, performance, and maintainability without sacrificing the real-time combat experience that requires LSL scripts.

The key is finding the right balance: **LSL for real-time game mechanics, Firestore for data persistence, MOAP for user interface.**

---

## 13. Feudalism 3 System Analysis & F4 Migration Plan

### 13.1 Communication Channels (F3 → F4)

| Channel | F3 Usage | F4 Usage | Notes |
|---------|----------|----------|-------|
| `-77770` | Main HUD communication (PLAYERHUDCHANNEL) | Main HUD communication | Keep same for compatibility |
| `-77771` | Weapon communication (weaponChannel) | Weapon communication | Keep same |
| `-77772` | Scabbard communication (sheathChannel) | Scabbard communication | Keep same |
| `-77777` | Meter updates (meterChannel) | Meter/Display updates | Keep same |
| `-7777777` | Meter mode changes (meterModeChannel) | Meter mode changes | Keep same |
| `-454545` | Pouch/inventory communication (pouchChannel/itemChannel) | **Migrate to `-77780`** | Unified inventory API |
| `-454555` | Container communication (containerChannel) | **Migrate to `-77780`** | Unified inventory API |
| `-453213492` | NPC communication (NPC_CHANNEL) | NPC communication | Keep same |
| `-595225` | Water bucket communication (waterChannel) | Specialized item channels | Keep for specialized items |
| `-88880` | Combat dummy communication (DUMMYCHANNEL) | Combat dummy communication | Keep same |

**F4 Recommendation:** Consolidate inventory-related channels (`-454545`, `-454555`) into unified `-77780` (Inventory API Channel) for cleaner architecture.

### 13.2 Meter System (F3)

**Purpose:** Separate HUD attachment that displays character information (name, title, species, gender, class, health, stamina) in different modes (roleplay, tournament, OOC, AFK).

**F3 Implementation:**
- Separate HUD object with prim text display
- Loads character data via link messages from character loader
- Displays health/stamina bars using block characters
- Shows/hides health bars based on mode
- Handles impairment and poison display
- Updates via channel messages from main HUD

**F4 Migration:**
- **Option 1:** Integrate into main MOAP HUD as a toggleable overlay
- **Option 2:** Keep as separate HUD but use MOAP for richer display
- **Option 3:** Remove entirely, display info in main HUD only

**Recommendation:** Option 1 - Integrate into main MOAP HUD with a "Meter View" toggle that shows/hides the character info display.

### 13.3 Inventory System (F3 → F4)

#### **F3 Implementation:**
- **Storage:** LinksetData (LSD) - local to pouch/chest object
- **Format:** Key-value pairs: `item_name → quantity` (string → string)
- **Pouch:** Attached HUD item, one per player
- **Chest:** Fixed location container, uses same LSD system
- **Actions:**
  - `fGiveItem,item_name,quantity` - Add item to inventory
  - `fTakeItem,item_name,quantity` - Remove item from inventory
  - `check,item_name` - Check if item exists and quantity
  - `contents` - List all items
  - `detectPouch,container_uuid` - Detect if pouch is worn
  - `pouchWorn,player_uuid` - Response indicating pouch is worn
  - `store,container_uuid` - Transfer items to container

#### **F4 Migration:**
- **Storage:** Firestore `inventories/{uuid}` collection
- **Format:** Structured document with items array
- **Pouch:** Still attached HUD item, but syncs with Firestore
- **Chest:** Fixed location, registered in Firestore `containers/{uuid}`
- **API:** Unified `-77780` channel with standardized protocol

**Key Differences:**
- F3: Local storage (LSD), lost if object deleted
- F4: Cloud storage (Firestore), persistent across regions/objects
- F3: Simple key-value pairs
- F4: Structured documents with metadata (condition, properties, etc.)

### 13.4 In-World Object Types (F3)

#### **13.4.1 Pouch (Attached Container)**
- **Scripts:** MenuManager, MessageManager, GetPouchContents, GiveItem, MoveItem, DropItem, EatItem, PickPocket
- **Features:**
  - Menu system (Contents, Drop, Eat, Give)
  - Pouch detection (only one pouch at a time)
  - Item storage in LinksetData
  - Player-to-player item giving
  - Item dropping (sets quantity to 0)
  - Item consumption (eat/use)

**F4 Migration:**
- Keep pouch as attached HUD item
- Replace LinksetData with Firestore sync
- Enhance menu with MOAP UI option
- Add item templates for validation

#### **13.4.2 Storage Chest (Fixed Container)**
- **Script:** StorageChest.lsl
- **Features:**
  - Fixed location container
  - Menu: Contents, Load Item, Remove Item
  - Pouch detection required
  - LinksetData storage
  - Owner-only or shared access

**F4 Migration:**
- Register in Firestore `containers` collection
- Support access control (owner, allowed list, public)
- MOAP UI for container management
- Persistent across region restarts

#### **13.4.3 Animated Producer (Crafting)**
- **Script:** AnimatedProducer.lsl (Butter Churn example)
- **Features:**
  - Detects pouch
  - Checks for required ingredients
  - Processing time (60 seconds)
  - Consumes ingredients
  - Produces output items
  - Awards XP

**F4 Migration:**
- Recipe system in Firestore `recipes` collection
- Server-side validation (Firebase Functions)
- Ingredient checking via Inventory API
- Processing timers in LSL (real-time)
- XP awards via HUD channel

#### **13.4.4 Rest & Heal Object**
- **Script:** Rest&Heal.lsl
- **Features:**
  - Detects "Sleep" pose
  - Restores +1 stamina every 10 seconds
  - Restores +1 health every 12 seconds (2 second delay)
  - Works while sitting

**F4 Migration:**
- Keep LSL timer-based mechanics
- Update Firestore health/stamina (throttled)
- Can be any sit object with pose detection
- MOAP UI shows rest progress

#### **13.4.5 Weapons System**
- **Scripts:** PrimaryWeapon-blade.lsl, PrimaryWeapon-scabbard.lsl
- **Features:**
  - Weapon registration with HUD
  - Draw/sheath mechanics
  - Weapon stats from Experience DB (damage, speed, weight, range)
  - Weapon health/durability (100 → 0)
  - Weapon dropping on critical hits/misses
  - Animation overrides
  - Combat integration
  - Scabbard attachment system

**F4 Migration:**
- Weapon templates in Firestore `item_templates`
- Weapon stats in character `equipment` document
- Durability tracking in Firestore
- Keep LSL for animations and combat detection
- MOAP UI for weapon management

#### **13.4.6 Water Bucket**
- **Script:** WaterBucketRH.lsl, WaterBucketLH.lsl
- **Features:**
  - Attached item (right/left hand)
  - Capacity: 15 units
  - LinksetData storage for contents
  - Visual show/hide based on contents
  - Water giving/taking via channel
  - Only one bucket per hand

**F4 Migration:**
- Store water quantity in Firestore inventory
- Item template: `water` (stackable)
- Keep LSL for attachment/visual management
- MOAP UI shows water quantity

#### **13.4.7 Simple Gatherable Items**
- **Script:** Simple Gatherable Items.lsl
- **Features:**
  - Touch to gather items
  - Configurable via description: `item_name,quantity_per_click,max_clicks,depletion_action,reset_time,sleep_time`
  - Depletion: "reset" or "die"
  - Cooldown between gathers
  - Gives items directly to pouch

**F4 Migration:**
- Item templates in Firestore
- Gathering recipes/mechanics in Firestore
- LSL for touch detection and cooldown
- Inventory API for item giving
- MOAP UI for gathering progress

#### **13.4.8 Combat Training Dummy**
- **Script:** CombatTrainingDummy.lsl
- **Features:**
  - Melee and ranged combat
  - Health tracking
  - Combat Rating (CR) for defense
  - XP rewards on kill
  - Reset timer after death
  - Random position system (optional)
  - Arrow detection (collision)

**F4 Migration:**
- Dummy templates in Firestore
- Health tracking in Firestore (for persistence)
- Keep LSL for real-time combat
- XP awards via HUD channel
- MOAP UI for dummy status

### 13.5 Production System (F3)

**Examples:** Butter Churn, Grain Mill, Grain Silo, Compost Bin, Farm Field, Universal Oven, Water Well

**Common Pattern:**
1. Detect pouch
2. Check for required ingredients
3. Process items (with timer)
4. Consume ingredients
5. Produce output
6. Award XP

**F4 Migration:**
- Recipe system in Firestore
- Production chains (gathering → processing → crafting)
- Server-side validation
- LSL for animations/timers
- MOAP UI for production progress

### 13.6 Key F3 → F4 Migration Decisions

| System | F3 Implementation | F4 Implementation | Rationale |
|--------|-------------------|-------------------|-----------|
| **Inventory Storage** | LinksetData (local) | Firestore (cloud) | Persistence, sharing, backup |
| **Character Data** | Experience DB (key-value) | Firestore (documents) | Better structure, queries |
| **Weapon Stats** | Experience DB | Firestore `item_templates` | Centralized, admin-editable |
| **Container Access** | Owner-only (LSD) | Firestore access control | Sharing, trading, permissions |
| **Pouch Detection** | Channel-based | Firestore + Channel | More reliable, persistent |
| **Item Templates** | Hardcoded in scripts | Firestore `item_templates` | Admin-editable, dynamic |
| **Crafting Recipes** | Hardcoded in scripts | Firestore `recipes` | Admin-editable, extensible |
| **Meter Display** | Prim text | MOAP UI | Richer display, animations |
| **Combat Logs** | Not stored | Firestore `combat_logs` | Analytics, history |

### 13.7 Backward Compatibility

**F4 should support:**
- F3 channel numbers for weapons, meter, HUD (during transition)
- F3 pouch detection protocol (for existing pouches)
- F3 item format (simple name:quantity) during migration

**Migration Path:**
1. **Phase 1:** F4 HUD with F3 compatibility layer
2. **Phase 2:** Dual storage (LSD + Firestore sync)
3. **Phase 3:** Firestore-only with F3 channel support
4. **Phase 4:** Full F4 API (optional F3 support)

## 14. Next Steps & Refinement

This architecture document provides a foundation, but will need refinement as we:

1. **Prototype Inventory API** - Build and test the unified `-77780` channel protocol
2. **Design Item Templates** - Define the complete item system structure
3. **Create Recipe System** - Design crafting/production recipe structure
4. **Build Container Scripts** - Create F4 versions of pouch, chest, etc.
5. **Test Migration Path** - Validate backward compatibility approach
6. **Performance Testing** - Validate Firestore query performance with real-world usage
7. **User Testing** - Get feedback on MOAP UI design and container interaction flow

**Note:** This document now reflects the actual F3 implementation details. The F4 architecture is designed to be a natural evolution that maintains compatibility while providing significant improvements in persistence, sharing, and admin control.

