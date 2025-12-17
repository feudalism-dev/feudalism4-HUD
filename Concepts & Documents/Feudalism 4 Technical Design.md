# Feudalism 4: Technical Design Document

> **Version**: 1.0  
> **Last Updated**: December 17, 2025  
> **Goal**: Experience-free, grid-portable RPG system using Firebase + Google Apps Script + MOAP

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SECOND LIFE CLIENT                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MOAP HUD (Single Prim)                    │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────────┐ │   │
│  │  │   LSL Script    │◄──►│   HTML/JS Interface (MOAP)      │ │   │
│  │  │  (Thin Client)  │    │   - Character Setup             │ │   │
│  │  │                 │    │   - Stats Management            │ │   │
│  │  └────────┬────────┘    │   - Admin Dashboard             │ │   │
│  │           │             └─────────────────────────────────┘ │   │
│  └───────────┼─────────────────────────────────────────────────┘   │
└──────────────┼──────────────────────────────────────────────────────┘
               │ HTTPS (llHTTPRequest)
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GOOGLE APPS SCRIPT (GAS)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  - Authentication & Token Validation                         │   │
│  │  - Business Logic (Dice Rolls, XP Calculations)              │   │
│  │  - CRUD Operations                                           │   │
│  │  - Admin Permission Checks                                   │   │
│  └────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────────┘
                                │ Firebase Admin SDK
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FIREBASE                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │   Firestore  │ │  Auth (opt)  │ │   Hosting    │                │
│  │  (Database)  │ │              │ │  (MOAP UI)   │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Design Principles

### 2.1 Experience-Free Operation
- **No SL Experience Required**: Authentication uses UUID + server-generated tokens
- **Grid Portable**: Works on any region without land permissions
- **Self-Contained**: Single HUD prim, no rezzing sub-objects

### 2.2 Thin Client Architecture  
- **LSL = Communication Layer**: Handles HTTP requests and MOAP display only
- **GAS = Business Logic**: All game rules, validation, and calculations server-side
- **MOAP = Rich UI**: Modern web interface for complex interactions

### 2.3 Security Model (Without Experiences)
Since we can't use Experience KVP, we use a **Token-Based Authentication** system:

```
1. Player attaches HUD
2. LSL sends: { uuid, username, object_key } to GAS
3. GAS generates session token, stores in Firestore with timestamp
4. Token returned to LSL, cached for session
5. All subsequent requests include token for validation
6. Tokens expire after 24 hours or on detach
```

---

## 3. Firebase Database Schema

### 3.1 Collections Overview

```
firestore/
├── users/                    # Player accounts & permissions
├── characters/               # Character data (1 per user for now)
├── sessions/                 # Active session tokens
├── templates/
│   ├── species/              # Species definitions
│   ├── classes/              # Class/Career templates
│   └── vocations/            # Vocation bonus definitions
└── config/                   # Global game settings
```

### 3.2 Collection: `users`
```json
{
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "username": "john.resident",
  "display_name": "John Resident",
  "role": "player",           // "player" | "sim_admin" | "sys_admin"
  "created_at": "2025-12-17T00:00:00Z",
  "last_login": "2025-12-17T12:00:00Z",
  "banned": false
}
```

### 3.3 Collection: `characters`
```json
{
  "owner_uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "Sir Reginald",
  "title": "Knight of the Realm",
  "gender": "male",
  "species_id": "human",
  "class_id": "knight",
  "xp_total": 1500,
  "xp_available": 200,
  "currency": 500,
  "stats": {
    "fighting": 5,
    "agility": 4,
    "awareness": 3,
    "strength": 4,
    "endurance": 5,
    "will": 3,
    "intellect": 2,
    "charisma": 3,
    "perception": 3,
    "stealth": 2,
    "crafting": 2,
    "survival": 3,
    "medicine": 1,
    "arcana": 1,
    "faith": 2,
    "persuasion": 3,
    "intimidation": 2,
    "athletics": 4,
    "acrobatics": 2,
    "luck": 3
  },
  "inventory": [],
  "created_at": "2025-12-17T00:00:00Z",
  "updated_at": "2025-12-17T12:00:00Z"
}
```

### 3.4 Collection: `templates/species`
```json
{
  "id": "human",
  "name": "Human",
  "description": "Versatile and adaptable, humans are the most common species.",
  "base_stats": {
    "fighting": 2, "agility": 2, "awareness": 2, "strength": 2,
    "endurance": 2, "will": 2, "intellect": 2, "charisma": 2,
    "perception": 2, "stealth": 2, "crafting": 2, "survival": 2,
    "medicine": 2, "arcana": 2, "faith": 2, "persuasion": 2,
    "intimidation": 2, "athletics": 2, "acrobatics": 2, "luck": 2
  },
  "stat_caps": {
    "fighting": 9, "agility": 9, "awareness": 9, "strength": 9,
    "endurance": 9, "will": 9, "intellect": 9, "charisma": 9,
    "perception": 9, "stealth": 9, "crafting": 9, "survival": 9,
    "medicine": 9, "arcana": 9, "faith": 9, "persuasion": 9,
    "intimidation": 9, "athletics": 9, "acrobatics": 9, "luck": 9
  },
  "abilities": [],
  "allowed_classes": ["commoner", "soldier", "squire", "merchant", "scholar"],
  "enabled": true
}
```

### 3.5 Collection: `templates/classes`
```json
{
  "id": "knight",
  "name": "Knight",
  "description": "A mounted warrior sworn to a lord, trained in the arts of war and chivalry.",
  "vocation_id": "knights_prowess",
  "stat_minimums": {
    "fighting": 4, "agility": 3, "strength": 4, "endurance": 4
  },
  "stat_maximums": {
    "fighting": 9, "agility": 7, "awareness": 6, "strength": 8,
    "endurance": 8, "will": 6, "intellect": 5, "charisma": 6,
    "perception": 5, "stealth": 3, "crafting": 4, "survival": 5,
    "medicine": 4, "arcana": 3, "faith": 5, "persuasion": 5,
    "intimidation": 7, "athletics": 7, "acrobatics": 5, "luck": 5
  },
  "prerequisites": {
    "required_classes": ["squire"],
    "required_species": [],
    "required_gender": []
  },
  "exit_careers": ["champion", "lord", "knight_commander"],
  "xp_cost": 500,
  "enabled": true
}
```

### 3.6 Collection: `templates/vocations`
```json
{
  "id": "knights_prowess",
  "name": "Knight's Prowess",
  "description": "Martial excellence honed through years of training.",
  "primary_stat": "fighting",
  "secondary_stat": "awareness",
  "applies_to": ["fighting", "intimidation"]
}
```

### 3.7 Collection: `sessions`
```json
{
  "token": "abc123xyz789...",
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "object_key": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "created_at": "2025-12-17T12:00:00Z",
  "expires_at": "2025-12-18T12:00:00Z",
  "last_activity": "2025-12-17T14:30:00Z"
}
```

---

## 4. API Protocol (LSL ↔ GAS)

### 4.1 Request Format
All requests from LSL to GAS use JSON:

```json
{
  "action": "string",
  "token": "session_token (after auth)",
  "uuid": "avatar_uuid",
  "data": { }
}
```

### 4.2 Response Format
```json
{
  "success": true,
  "action": "original_action",
  "data": { },
  "error": null
}
```

### 4.3 API Endpoints (Actions)

| Action | Description | Auth Required |
|--------|-------------|---------------|
| `auth.login` | Initialize session, get token | No |
| `auth.logout` | Invalidate session token | Yes |
| `character.get` | Fetch character data | Yes |
| `character.create` | Create new character | Yes |
| `character.update` | Update character (stats, title, etc.) | Yes |
| `character.delete` | Delete character | Yes |
| `templates.species` | Get all species templates | Yes |
| `templates.classes` | Get all class templates | Yes |
| `templates.vocations` | Get all vocations | Yes |
| `admin.users.list` | List all users (admin only) | Yes + Admin |
| `admin.users.promote` | Change user role | Yes + SysAdmin |
| `admin.templates.create` | Create new template | Yes + SysAdmin |
| `admin.templates.update` | Update template | Yes + SysAdmin |
| `admin.templates.delete` | Delete template | Yes + SysAdmin |
| `roll.test` | Perform skill test (exploding d20) | Yes |

### 4.4 Example: Login Flow

**LSL Request:**
```json
{
  "action": "auth.login",
  "uuid": "12345678-1234-1234-1234-123456789012",
  "username": "john.resident",
  "object_key": "87654321-4321-4321-4321-210987654321"
}
```

**GAS Response:**
```json
{
  "success": true,
  "action": "auth.login",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "uuid": "12345678-1234-1234-1234-123456789012",
      "role": "player",
      "has_character": true
    },
    "moap_url": "https://your-project.web.app/hud.html"
  }
}
```

---

## 5. Game Mechanics (Server-Side)

### 5.1 Exploding d20 Pool
```javascript
function rollExplodingD20Pool(poolSize) {
  let total = 0;
  let rolls = [];
  
  for (let i = 0; i < poolSize; i++) {
    let roll = Math.floor(Math.random() * 20) + 1;
    let subtotal = roll;
    rolls.push(roll);
    
    // Explode on 20
    while (roll === 20) {
      roll = Math.floor(Math.random() * 20) + 1;
      subtotal += roll;
      rolls.push(roll);
    }
    
    total += subtotal;
  }
  
  return { total, rolls };
}
```

### 5.2 Vocation Bonus Calculation
```javascript
function calculateVocationBonus(character, vocation) {
  const primaryStat = character.stats[vocation.primary_stat] || 0;
  const secondaryStat = character.stats[vocation.secondary_stat] || 0;
  return primaryStat + secondaryStat;
}
```

### 5.3 Skill Test Resolution
```javascript
function resolveSkillTest(character, statName, difficulty) {
  const statValue = character.stats[statName] || 1;
  const roll = rollExplodingD20Pool(statValue);
  
  // Get vocation bonus if applicable
  let vocationBonus = 0;
  const vocation = getVocation(character.class_id);
  if (vocation && vocation.applies_to.includes(statName)) {
    vocationBonus = calculateVocationBonus(character, vocation);
  }
  
  const finalResult = roll.total + vocationBonus;
  const success = finalResult >= difficulty;
  
  return {
    success,
    roll: roll.total,
    rolls: roll.rolls,
    vocation_bonus: vocationBonus,
    final_result: finalResult,
    difficulty,
    margin: finalResult - difficulty
  };
}
```

---

## 6. MOAP Communication

### 6.1 LSL → MOAP (Setting URL)
```lsl
llSetPrimMediaParams(0, [
    PRIM_MEDIA_CURRENT_URL, url,
    PRIM_MEDIA_AUTO_PLAY, TRUE,
    PRIM_MEDIA_WIDTH_PIXELS, 1024,
    PRIM_MEDIA_HEIGHT_PIXELS, 768
]);
```

### 6.2 MOAP → LSL (Using llOpenURL handler)
The MOAP page uses special URLs to communicate back to LSL:

```javascript
// In MOAP HTML/JS
function sendToLSL(command, data) {
    const payload = encodeURIComponent(JSON.stringify({cmd: command, ...data}));
    window.location.href = `secondlife:///app/callback/${payload}`;
}
```

**Note**: MOAP → LSL communication is limited. For complex data, the MOAP should call GAS directly, and LSL polls GAS for updates.

### 6.3 Alternative: Direct MOAP → GAS
The MOAP page can make direct fetch() calls to GAS:

```javascript
async function saveCharacter(characterData) {
    const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'character.update',
            token: sessionToken,
            uuid: avatarUUID,
            data: characterData
        })
    });
    return response.json();
}
```

---

## 7. Role-Based Access Control (RBAC)

### 7.1 Permission Matrix

| Action | Player | Sim Admin | Sys Admin |
|--------|--------|-----------|-----------|
| View own character | ✓ | ✓ | ✓ |
| Edit own character | ✓ | ✓ | ✓ |
| View other characters | ✗ | ✓ | ✓ |
| Award XP to others | ✗ | ✓ | ✓ |
| Modify currency | ✗ | ✓ | ✓ |
| Create/Edit templates | ✗ | ✗ | ✓ |
| Promote to Sim Admin | ✗ | ✗ | ✓ |
| Promote to Sys Admin | ✗ | ✗ | ✓ |
| Ban users | ✗ | ✓ | ✓ |

### 7.2 Admin Check (Server-Side)
```javascript
function requireRole(uuid, requiredRole) {
  const user = getUser(uuid);
  const roleHierarchy = { 'player': 1, 'sim_admin': 2, 'sys_admin': 3 };
  
  if (!user || roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    throw new Error('Insufficient permissions');
  }
  
  return user;
}
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Firebase project
- [ ] Create Firestore collections and security rules
- [ ] Build GAS backend with auth and basic CRUD
- [ ] Create LSL "Thin Client" HUD script

### Phase 2: MOAP Interface (Week 3-4)
- [ ] Build HTML/JS character creation flow
- [ ] Implement species/class selection UI
- [ ] Create stat allocation interface
- [ ] Host on Firebase Hosting

### Phase 3: Admin Tools (Week 5-6)
- [ ] Build admin dashboard UI
- [ ] Implement template CRUD in GAS
- [ ] Add user management features
- [ ] Role promotion/demotion

### Phase 4: Game Systems (Week 7-8)
- [ ] Implement dice roll system
- [ ] Add combat resolution
- [ ] Create crafting system hooks
- [ ] World object communication protocol

---

## 9. File Structure

```
Feudalism RPG 4/
├── Concepts & Documents/
│   ├── Feudalism 4 Concepts.md          # Original design notes
│   └── Feudalism 4 Technical Design.md  # This document
├── LSL Scripts/
│   └── Feudalism 4 - Setup HUD.lsl      # Main HUD script
├── GAS Backend/
│   ├── Code.gs                          # Main entry point
│   ├── Auth.gs                          # Authentication logic
│   ├── Characters.gs                    # Character CRUD
│   ├── Templates.gs                     # Template management
│   └── Dice.gs                          # Dice roll logic
└── MOAP Interface/
    ├── index.html                       # Main HUD interface
    ├── admin.html                       # Admin dashboard
    ├── css/
    │   └── styles.css
    └── js/
        ├── app.js                       # Main application logic
        ├── api.js                       # GAS communication
        └── ui.js                        # UI components
```

---

## 10. Security Considerations

### 10.1 Token Generation
- Use cryptographically secure random tokens
- Include timestamp and object_key in token validation
- Tokens expire after 24 hours

### 10.2 Request Validation
- Always validate token before processing
- Check user role for admin actions
- Sanitize all input data
- Rate limit requests per UUID

### 10.3 Data Protection
- Firestore security rules restrict access
- Never expose other players' full data
- Log admin actions for audit trail

---

## 11. The 20 Core Stats

| # | Stat | Description |
|---|------|-------------|
| 1 | Fighting | Melee combat proficiency |
| 2 | Agility | Speed and reflexes |
| 3 | Awareness | Situational perception |
| 4 | Strength | Physical power |
| 5 | Endurance | Stamina and resilience |
| 6 | Will | Mental fortitude |
| 7 | Intellect | Reasoning and knowledge |
| 8 | Charisma | Social presence |
| 9 | Perception | Sensory acuity |
| 10 | Stealth | Moving unseen |
| 11 | Crafting | Creating items |
| 12 | Survival | Wilderness skills |
| 13 | Medicine | Healing knowledge |
| 14 | Arcana | Magical aptitude |
| 15 | Faith | Divine connection |
| 16 | Persuasion | Convincing others |
| 17 | Intimidation | Inspiring fear |
| 18 | Athletics | Physical feats |
| 19 | Acrobatics | Balance and tumbling |
| 20 | Luck | Fortune's favor |

---

*This document serves as the technical foundation for Feudalism 4 development.*

