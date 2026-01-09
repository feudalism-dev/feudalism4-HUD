# Feudalism 4 - Combat System Specification
**Date:** January 8, 2026  
**Purpose:** Complete specification of F3 combat system for F4 implementation

---

## EXECUTIVE SUMMARY

The Feudalism combat system is a **unique hybrid** combining:
- **Physical Action Combat** - Players click weapons, aim arrows, move tactically
- **Tabletop RPG Mechanics** - D20 dice rolls, stats, armor, character progression

This creates combat where **player skill AND character stats both matter**.

### Core Systems:
- **D20 dice rolling** (1-20 per die) - Stats determine dice pool size
- **Attack vs Defense rolls** - With speed/height/impairment modifiers
- **Degrees of Success** - Damage scaling based on roll difference
- **Hit location system** - 9 body parts with individual armor
- **Physical projectiles** - Arrows use collision + stat resolution
- **Weapon interactions** - Click to swing, broadcast attack data
- **XP rewards** - Combat participation and victories
- **Critical mechanics** - Weapon drops on extreme rolls

**Key Innovation:** Melee uses broadcasts (no hitbox collision), arrows use physics (actual collision), but **both** resolve damage via dice rolls.

**Status in F4:** ❌ **NOT IMPLEMENTED** - Needs to be ported

---

## HYBRID COMBAT DESIGN PHILOSOPHY

### The Best of Both Worlds

Feudalism's combat system is a **unique hybrid** that combines:
- **Physical Action Combat** (movement, clicking, aiming)
- **Tabletop RPG Mechanics** (dice rolls, stats, character progression)

This design creates a combat experience where **both player skill AND character stats matter**.

### Layer 1: Physical Action (Player Skill)

**Melee Combat:**
- 🖱️ **Player clicks their weapon** to initiate attack
- 📡 **Weapon broadcasts attack** to nearby players (no physical collision required)
- 🏃 **Movement affects combat** - Moving fast (>3.2 m/s) gives +5 dodge bonus
- ⛰️ **Height matters** - Higher ground = +1 attack bonus
- 🎯 **Positioning is tactical** - Players must be in range

**Ranged Combat:**
- 🏹 **Player aims and fires** - Physical targeting skill required
- 🎯 **Arrow flies as physical projectile** - Uses SL physics
- 💥 **Collision detection** - Arrow must physically hit target
- 📍 **Distance and movement** affect difficulty

### Layer 2: Statistical Resolution (Character Stats)

**Melee Combat:**
- 🎲 **Target's HUD rolls dice** - Attack vs Defense (D20 system)
- 📊 **Stats determine rolls** - Fighting stat = number of d20 to roll
- ⚔️ **Bonuses/penalties applied** - Agility, speed, height, impairment
- 🛡️ **Armor reduces damage** - Based on hit location
- 📈 **Degrees of success** scale damage

**Ranged Combat:**
- 💥 **Collision triggers** stat check (physical hit confirmed)
- 🎲 **Marksmanship vs Athletics** - Dice roll determines damage scaling
- 📊 **Base damage (5) modified** by roll difference
- 🛡️ **Armor should apply** (F4 enhancement)

### Why This Hybrid Works

#### ✅ **Prevents "Twitch Shooter" Dominance**
- Fast clicking ≠ automatic win
- A level 2 warrior can't beat a level 10 warrior just by clicking faster
- **Character progression matters**

#### ✅ **Maintains Physical Immersion**
- Combat **feels active** - you swing, aim, dodge
- Not standing still clicking "Attack" buttons
- **Visceral and engaging**

#### ✅ **Balanced for Roleplayers**
- Stat-based resolution means **roleplay time investment pays off**
- Older players or those with disabilities aren't at massive disadvantage
- **Fair competitive balance**

#### ✅ **Tactical Depth**
- Position yourself on high ground
- Move to get dodge bonus
- Draw shield for defense
- Wear better armor
- **Multiple paths to victory**

#### ✅ **Arrows Are Best of Both Worlds**
- **Physical aiming** - Player must have skill to hit
- **Stat resolution** - Marksmanship vs Athletics after collision
- Combines **accuracy** (player) with **effectiveness** (character)

### Combat Flow Visualization

```
MELEE ATTACK:
Player Action          Statistical Resolution          Result
─────────────          ──────────────────────          ──────
Click Sword     →      Attack Roll (Fighting)    →     
                       vs                              Hit/Miss
Move Fast       →      Defense Roll (Agility)    →     determined
                       +Speed/Height/Armor             by dice
Stand on Rock   →      Calculate Damage          →     
                       Apply to Health                 Display msg


RANGED ATTACK:
Player Action          Physical Layer           Statistical Layer        Result
─────────────          ──────────────           ─────────────────        ──────
Aim Bow         →      Arrow Flies       →      Collision?        →      No hit
                       (Physics)                                         
Click Fire      →      Travels Path      →      YES!              →      
                                                                          
                                                 Marksmanship      →      Damage
                                                 vs Athletics             scaled
                                                                          
                                                 Apply Damage      →      Display
```

### Design Implications for F4

**This hybrid nature means:**
1. **Weapon objects** must handle physical interactions (clicks, broadcasts)
2. **HUD scripts** must handle statistical resolution (dice, damage)
3. **Arrow objects** bridge both systems (physics + stats)
4. **Communication** must be robust (weapon → HUD broadcasts)
5. **Balance testing** requires both mechanical and statistical tuning

**The beauty:** Players experience smooth action combat, but the **fairness of RPG mechanics protects the integrity of character progression**.

---

## COMPONENT 1: DICE ROLLING SYSTEM

### Purpose
Core random number generator for all combat and skill checks.

### Function: `rollDice(integer numDice)`
**Location:** F3 Main.lsl lines 135-144

```lsl
integer rollDice(integer numDice) {
    integer results = 0;
    
    integer i = 0;
    while (i < numDice) {
        results += (integer)(llFrand(20.0) + 1);  // D20: 1-20
        i++;    
    }
    return results;    
}
```

### How It Works
- **Input:** Number of dice to roll
- **Output:** Sum of all dice (e.g., 3d20 = 3-60)
- **Mechanism:** Each die rolls 1-20 using `llFrand(20.0) + 1`
- **Usage:** 
  - Attack rolls: `rollDice(Fighting Stat)`
  - Defense rolls: `rollDice(Fighting Stat)`
  - Skill checks: `rollDice(Relevant Stat)`

### Example
- Player has Fighting = 5
- Rolls `rollDice(5)` → 5d20
- Possible result: 47 (rolls of 12, 8, 15, 7, 5)

---

## COMPONENT 2: MELEE COMBAT SYSTEM

### Purpose
Process melee weapon attacks between two players.

**Critical Design Note:** Melee combat uses **broadcast communication**, NOT physical collision detection. When a player clicks their weapon:
1. The weapon object broadcasts attack data to all nearby players
2. Each player's HUD receives the broadcast and checks if they're in range
3. The TARGET's HUD rolls dice to determine hit/miss
4. **The sword mesh does NOT need to physically touch the target**

This design prevents hitbox exploits and ensures **stats determine combat outcome**, not lag or hitbox manipulation. Player skill is shown through positioning, timing, and movement.

### Function: `processAttack()`
**Location:** F3 Main.lsl lines 166-353

### Data Required
**Attacker Data** (from weapon broadcast):
- `attackerID` - Key of attacker
- `attackerFighting` - Attacker's Fighting stat
- `attackerAttackBonus` - Attacker's bonus stat (varies by weapon)
- `attackerBaseDamage` - Weapon base damage
- `attackerPos` - Attacker's position (for height bonus)
- `attackerHand` - "primary" or "secondary"

**Defender Data** (local):
- `myStats` - All 20 stats
- `currentHealth` / `currentStamina`
- `baseHealth` / `baseStamina`
- `myArmor` - Armor worn on 9 body parts
- `impairmentLevel` - Drunk/impaired penalty
- `mode` - "roleplay" or "tournament"
- `primaryWeaponIsActive` / `secondaryWeaponIsActive` - Shield check

### Combat Flow

#### Step 1: Stat Preparation
```lsl
integer defFighting = llList2Integer(myStats, FIGHTING);
integer defDodgeBonus = llList2Integer(myStats, AGILITY);

// Tournament mode override (balanced PvP)
if (mode == "tournament") {
    defFighting = 5;
    defDodgeBonus = 5;  
    attackerFighting = 5;
    attackerAttackBonus = 5;  
}

integer maxDefense = defFighting * 20;  // Max possible defense roll
integer maxAttack = attackerFighting * 20;  // Max possible attack roll
```

#### Step 2: Speed Bonuses/Penalties
```lsl
float mySpeed = llVecMag(llList2Vector(llGetObjectDetails(llGetOwner(), [OBJECT_VELOCITY]), 0));
float attackerSpeed = llVecMag(llList2Vector(llGetObjectDetails(attackerID, [OBJECT_VELOCITY]), 0));

// Fast movement bonus to defense (harder to hit)
if (mySpeed > 3.2) {
    defDodgeBonus += 5;
}

// Fast movement penalty to attack (harder to aim)
if (attackerSpeed > 3.2) {
    attackerAttackBonus -= 5;
}
```

#### Step 3: Height Advantage
```lsl
// Higher ground = attack bonus
if (attackerPos.z > myPos.z) {
    ++attackerAttackBonus;
} 
// Lower ground = defense bonus
else if (attackerPos.z < myPos.z) {
    ++defDodgeBonus;    
}
```

#### Step 4: Impairment Penalty
```lsl
if (impairmentLevel > 0) {
    defDodgeBonus - impairmentLevel;  // Note: F3 has bug (should be -=)
}
```

#### Step 5: Roll Attack and Defense
```lsl
integer defenseRoll;
integer attackRoll;

// Defense roll = dice + random(bonus)
if (defDodgeBonus > 0) {
    defenseRoll = rollDice(defFighting) + (integer)llFrand(defDodgeBonus) + 1;
} else {
    defDodgeBonus = 0;
}

// Attack roll = dice + random(bonus)
if (attackerAttackBonus > 0) {
    attackRoll = rollDice(attackerFighting) + (integer)llFrand(attackerAttackBonus);
} else {
    attackerAttackBonus = 0;
}
```

#### Step 6: Determine Hit or Miss

##### **HIT: Attack Roll > Defense Roll**

**A. Calculate Degrees of Success**
```lsl
integer degreesOfSuccess = ((attackRoll - defenseRoll) / 10) + 1;
```
- **Formula:** For every 10 points attack exceeds defense, +1 degree
- **Minimum:** 1 degree (any hit)
- **Example:** Attack 75, Defense 42 = ((75-42)/10)+1 = 4 degrees

**B. Determine Hit Location**
```lsl
string hitLocation = whichPartHit();
```
- Randomly selects from 9 body parts
- Used to check armor on that specific part

**C. Get Armor Defense Bonus**
```lsl
integer armorDefBonus = getArmorWorn(hitLocation);

// Shield bonus (if dual wielding)
if (primaryWeaponIsActive && secondaryWeaponIsActive && mode == "roleplay") {
    armorDefBonus++;
}
```

**D. Calculate Base Damage**
```lsl
integer damage = (integer)llFrand(2 * attackerBaseDamage) + 1;
```
- **Formula:** Random between 1 and (2 × weapon damage)
- **Example:** Longsword (damage 6) = 1-12 damage

**E. Apply Defense Reductions**
```lsl
// Armor reduction
damage -= (integer)llFrand(armorDefBonus) + 1;

// Agility reduction
damage -= (integer)llFrand(defBonus) + 1;
```

**F. Add Degrees of Success Bonus**
```lsl
integer i = 1;
while (i <= degreesOfSuccess) {
    damage += ((integer)llFrand(atkBonus)) + 1;
    i++;
}
```
- Each degree adds random(attacker's bonus stat) damage

**G. Apply Damage**
```lsl
if (damage <= 0) {
    damage = 0;
    // "hits but delivers no damage"
} else {
    currentHealth -= damage;
    // Output: "hits X on the Y for Z points of damage"
}
```

**H. Check Knockout**
```lsl
if (currentHealth <= 0 || currentStamina <= 0) {
    if (currentHealth < 0) currentHealth = 0;
    if (currentStamina < 0) currentStamina = 0;
    passOut();
    
    // Loser gets 5 XP
    gainXP(5);
    
    // Winner gets scaled XP
    integer factor = 1;
    if (attackerFighting > defFighting) {
        factor = factor / (attackerFighting - defFighting);
    } else if (attackerFighting < defFighting) {
        factor = defFighting - attackerFighting;
    }
    integer enemyXPEarned = baseHealth * factor;
    llRegionSayTo(attackerID, PLAYERHUDCHANNEL, "gainXP," + (string)enemyXPEarned);
}
```

**I. XP Reward for Hit**
```lsl
llRegionSayTo(attackerID, PLAYERHUDCHANNEL, "gainXP,1");
```

**J. Weapon Damage**
```lsl
llRegionSayTo(attackerID, weaponChannel, "damageWeapon");
```

**K. Weapon Drop (Critical Success)**
```lsl
// Check if near-perfect attack roll (95%+ of max)
if ((float)maxAttack / (float)attackRoll >= 0.95) {
    // And high degrees of success
    if (degreesOfSuccess >= 6) {
        // 30% chance to drop weapon
        if (llFrand(100.0) > 70) {
            llRegionSayTo(llGetOwner(), weaponChannel, "drop");
            llRegionSayTo(llGetOwner(), 0, "You were hit so badly, you dropped your primary weapon.");
        }
    }
}
```

##### **MISS: Attack Roll ≤ Defense Roll**

**A. Calculate Degrees of Failure**
```lsl
integer degreesOfFailure = ((defenseRoll - attackRoll) / 10) + 1;
```

**B. Output Message**
```lsl
// "X swings at Y but misses"
if (mode == "tournament") {
    llSay(0, output);
}
```

**C. Weapon Drop (Critical Failure)**
```lsl
// Check if terrible attack roll (5% or less of max)
if ((float)maxDefense / (float)defenseRoll <= 0.05) {
    // And high degrees of failure
    if (degreesOfFailure >= 6) {
        // 30% chance attacker drops weapon
        if (llFrand(100.0) > 70) {
            if (attackerHand == "primary") {
                llRegionSayTo(attackerID, weaponChannel, "drop");
            } else {
                llRegionSayTo(attackerID, weaponChannel2, "drop");
            }
            llRegionSayTo(attackerID, 0, "You missed so badly, that you dropped your weapon!");
        }
    }
}
```

---

## COMPONENT 3: HIT LOCATION SYSTEM

### Purpose
Randomly determine which body part was hit for armor calculation.

### Body Parts (9 Total)
1. Head
2. Neck
3. Upper Torso
4. Lower Torso
5. Right Arm
6. Left Arm
7. Upper Leg
8. Lower Leg
9. Foot

### Function: `whichPartHit()`
**Expected Implementation:**
```lsl
string whichPartHit() {
    list bodyParts = [
        "head", "neck", "upper torso", "lower torso",
        "right arm", "left arm", "upper leg", "lower leg", "foot"
    ];
    
    integer index = (integer)llFrand(9);
    return llList2String(bodyParts, index);
}
```

### Function: `getArmorWorn(string part)`
**Expected Implementation:**
```lsl
integer getArmorWorn(string part) {
    integer partIndex = llListFindList(bodyParts, [part]);
    if (partIndex == -1) return 0;
    
    string armorType = llList2String(myArmor, partIndex);
    integer typeIndex = llListFindList(armorTypes, [armorType]);
    
    if (typeIndex == -1) return 0;
    return llList2Integer(armorValues, typeIndex);
}
```

---

## COMPONENT 4: COLLISION DAMAGE SYSTEM

### Purpose
Handle damage from arrows, projectiles, and spell effects.

**Critical Design Note:** This is where the **hybrid combat truly shines**. Arrows require:
1. **Physical player skill** - Must aim and physically hit target (collision_start event)
2. **Character stats** - Marksmanship vs Athletics dice roll determines damage scaling

This means a skilled archer with low Marksmanship might hit often but deal less damage, while a high-Marksmanship character who can't aim won't hit at all. **Both skills matter.**

### Event: `collision_start(integer numDetected)`
**Location:** F3 Main.lsl lines 788-875

### Collision Types

#### Type 1: Arrows
**Detection:** Object name contains "arrow" (but not "barrow")

**Damage Calculation:**
```lsl
integer collisionBaseDamage = 5;  // Base arrow damage

// Get attacker's Marksmanship vs defender's Athletics
integer enemyMarksmanship = 2;  // Default if stats not loaded
if (enemyStatsLoaded) {
    enemyMarksmanship = llList2Integer(enemyStats, MARKSMANSHIP);
}
integer myAgility = llList2Integer(myStats, ATHLETICS);

// Roll opposed checks
integer enemyRoll = rollDice(enemyMarksmanship);
integer myRoll = rollDice(myAgility);

// Adjust damage based on roll difference
if (enemyRoll > myRoll) {
    collisionBaseDamage += (enemyRoll - myRoll);
} else if (enemyRoll < myRoll) {
    collisionBaseDamage -= (myRoll - enemyRoll);
    if (collisionBaseDamage <= 0) {
        collisionBaseDamage = 1;  // Minimum 1 damage
    }
}

// Apply damage
if (currentHealth > collisionBaseDamage) {
    currentHealth -= collisionBaseDamage;
} else {
    currentHealth = 0;
    passOut();
    gainXP(5);
}

// Output message
llOwnerSay("You have been shot with an arrow for " + 
           (string)collisionBaseDamage + " points of damage by " + 
           collisionSourceName + ".");
```

**Key Points:**
- Base damage: 5
- Modified by attacker's Marksmanship vs defender's Athletics
- Damage scales with roll difference (NOT divided by 10)
- Minimum 1 damage on hit
- Awards 5 XP if knocked out

#### Type 2: Custom Objects (fcobject)
**Detection:** Object name contains "fcobject"

**Format:** `"fcobject,<name>,<damage>"`  
**Example:** `"fcobject,fireball,15"`

**Damage Calculation:**
```lsl
list objectParms = llCSV2List(collisionObjectName);

if (llGetListLength(objectParms) == 3) {
    collisionBaseDamage = llList2Integer(objectParms, 2);
    string weaponName = llList2String(objectParms, 1);
    
    // Apply damage directly (no resistance check)
    if (currentHealth > collisionBaseDamage) {
        currentHealth -= collisionBaseDamage;
    } else {
        currentHealth = 0;
        passOut();
        gainXP(5);
    }
    
    // Output message
    llOwnerSay("You were struck by a " + weaponName + 
               " for " + (string)collisionBaseDamage + 
               " points of damage by " + collisionSourceName + ".");
}
```

**Key Points:**
- Damage specified in object name
- No resistance check (direct damage)
- Used for spell projectiles, thrown objects, etc.

#### Type 3: Spell Fire (Legacy - Disabled)
**Detection:** Object name contains "dtmk"

**Status:** Commented out in F3 code  
**Note:** Was used for legacy spell damage system

---

## COMMUNICATION PROTOCOL

### Melee Combat Initiation
**Weapon → Defender's HUD**

**Channel:** PLAYERHUDCHANNEL (-77770)

**Message Format:**
```
"broadcastAttack,<attackerFighting>,<attackerBonus>,<weaponDamage>,<attackerPos>,<weaponHand>"
```

**Example:**
```
"broadcastAttack,5,3,6,<134.5,128.2,25.1>,primary"
```

**F3 Listener:** Lines 755-787

```lsl
if (action == "broadcastAttack") {
    attackerID = id;  // Key from listen event
    attackerFighting = (integer)llList2String(parsed, 1);
    attackerAttackBonus = (integer)llList2String(parsed, 2);
    attackerBaseDamage = (integer)llList2String(parsed, 3);
    attackerPos = (vector)llList2String(parsed, 4);
    attackerHand = llList2String(parsed, 5);
    
    processAttack();
}
```

### XP Awards
**Defender's HUD → Attacker's HUD**

**Channel:** PLAYERHUDCHANNEL (-77770)

**Message Format:**
```
"gainXP,<amount>"
```

**Examples:**
- Hit: `"gainXP,1"`
- Knockout: `"gainXP,<scaled_amount>"`

### Weapon Commands
**HUD → Weapon**

**Channels:**
- Primary weapon: WEAPON_CHANNEL (-77771)
- Secondary weapon: WEAPON_CHANNEL2 (-77773)

**Commands:**
- `"damageWeapon"` - Weapon durability reduction
- `"drop"` - Force weapon drop (critical failure/success)

---

## F4 IMPLEMENTATION APPROACH

### Phase 1: Core Combat Script
**Create:** `Feudalism 4 - HUD - Combat.lsl`

**Components to Port:**
1. ✅ `rollDice(integer numDice)` - Direct port from F3
2. ✅ `processAttack()` - Port with F4 adaptations:
   - Use `llLinksetDataRead()` instead of Experience KV
   - Integrate with F4 Weapons Manager (get weapon stats)
   - Integrate with F4 Armor Manager (get armor defense)
   - Use F4 Stats system (already has stat indices)
   - Broadcast to F4 Meter (health/stamina updates)
3. ✅ `whichPartHit()` - Create function
4. ✅ `getArmorWorn(string part)` - Request from Armor Manager
5. ✅ `doesWeaponDrop()` - Direct port from F3

**New F4 Features:**
- **Mana integration** - Some attacks may consume mana
- **Skill variety** - Different weapon types use different bonus stats
- **Combat log** - Optional detailed combat breakdown
- **Tournament brackets** - Automated tournament system

### Phase 2: Collision Damage
**Integrate into:** `Feudalism 4 - HUD - Combat.lsl` or `Feudalism 4 - HUD - Main.lsl`

**Components to Port:**
1. ✅ `collision_start()` event handler
2. ✅ Arrow damage calculation (Marksmanship vs Athletics)
3. ✅ Custom object damage (fcobject format)
4. ✅ Damage application and knockout check

**F4 Enhancements:**
- **Armor reduction** - Collision damage should check armor on hit location
- **Shield block** - Active shield may deflect projectiles
- **Dodge roll** - Active dodge maneuver may avoid projectiles

### Phase 3: Integration Points

**Weapons Manager Integration:**
```lsl
// In Combat script
llMessageLinked(LINK_SET, 0, "get primary weapon stats", "");

// Weapons Manager responds with:
// damage, speed, weight, minRange, maxRange, isDrawn
```

**Armor Manager Integration:**
```lsl
// In Combat script
llMessageLinked(LINK_SET, 0, "get armor for " + hitLocation, "");

// Armor Manager responds with:
// defense value, armor type
```

**Stats Integration:**
```lsl
// Combat script accesses stats same way F3 did
integer myFighting = llList2Integer(myStats, FIGHTING);
integer myAgility = llList2Integer(myStats, AGILITY);
// Stats are already loaded in Main script
```

**Health/Stamina Updates:**
```lsl
// Combat script applies damage via Main script
currentHealth -= damage;
llMessageLinked(LINK_SET, currentHealth, "set health display", (string)baseHealth);

// Main script updates displays and broadcasts to Meter
```

### Phase 4: Testing Scenarios

**Test 1: Basic Melee**
1. Two players with weapons drawn
2. Attacker uses weapon (broadcasts attack)
3. Defender's HUD processes attack
4. Verify: Damage calculated correctly, health reduced, XP awarded

**Test 2: Critical Hit**
1. Attacker gets very high attack roll (95%+ of max)
2. High degrees of success (6+)
3. Verify: Extra damage applied, possible weapon drop

**Test 3: Critical Miss**
1. Attacker gets very low attack roll (5% or less)
2. High degrees of failure (6+)
3. Verify: Attack misses, possible weapon drop (attacker)

**Test 4: Arrow Damage**
1. Archer fires arrow (object with "arrow" in name)
2. Collision with target
3. Verify: Marksmanship vs Athletics rolls, damage scaled, message displayed

**Test 5: Custom Projectile**
1. Spell/object with "fcobject,fireball,15" in name
2. Collision with target
3. Verify: 15 damage applied, message displayed

**Test 6: Knockout**
1. Reduce health to near zero
2. Take damage that exceeds current health
3. Verify: Health = 0, pass out triggered, XP awarded (5 to loser, scaled to winner)

**Test 7: Armor Protection**
1. Wear armor on body parts
2. Get hit on armored location
3. Verify: Damage reduced by armor value

**Test 8: Tournament Mode**
1. Set mode to "tournament"
2. Initiate combat
3. Verify: Stats normalized to 5, combat messages public

---

## DATA REQUIREMENTS

### Character Stats Required
- **FIGHTING** - Attack/defense dice
- **AGILITY** - Dodge bonus
- **ATHLETICS** - Arrow dodge
- **MARKSMANSHIP** - Arrow accuracy
- **ENDURANCE** - (Potential: health bonus)
- **STRENGTH** - (Potential: damage bonus)

### Weapon Stats Required
- **Damage** - Base damage value
- **Speed** - (Potential: initiative bonus)
- **Weight** - (Used by stamina system)
- **Min/Max Range** - Combat range restrictions

### Armor Stats Required
- **Defense Value** - Damage reduction
- **Weight** - (Used by stamina system)
- **Body Part** - Which part protected

### Game State Required
- **mode** - "roleplay" or "tournament"
- **currentHealth** / **baseHealth**
- **currentStamina** / **baseStamina**
- **impairmentLevel** - Drunk penalty
- **isPassedOut** - Knockout state

---

## COMBAT FORMULAS REFERENCE

### Attack Roll
```
AttackRoll = rollDice(AttackerFighting) + random(AttackerBonus)
```

### Defense Roll
```
DefenseRoll = rollDice(DefenderFighting) + random(DefenderDodgeBonus)
```

### Degrees of Success
```
Degrees = ((AttackRoll - DefenseRoll) / 10) + 1
Minimum: 1 (any hit)
```

### Base Damage
```
BaseDamage = random(1 to 2×WeaponDamage)
```

### Defense Reductions
```
Damage -= random(1 to ArmorDefense)
Damage -= random(1 to AgilityBonus)
```

### Degrees Bonus
```
For each degree of success:
    Damage += random(1 to AttackerBonus)
```

### Final Damage
```
FinalDamage = max(0, Damage)
```

### XP Rewards
- **Hit:** 1 XP to attacker
- **Knockout (Loser):** 5 XP
- **Knockout (Winner):** `baseHealth × factor`  
  Where `factor` = skill difference scaling

### Speed Modifiers
- **Defender moving fast (>3.2 m/s):** +5 dodge bonus
- **Attacker moving fast (>3.2 m/s):** -5 attack penalty

### Height Modifiers
- **Attacker higher:** +1 attack bonus
- **Defender higher:** +1 dodge bonus

### Impairment Penalty
- **Each impairment level:** -1 dodge bonus

---

## ESTIMATED IMPLEMENTATION EFFORT

### Phase 1: Core Combat (8-12 hours)
- Port `rollDice()` - 0.5 hours
- Port `processAttack()` - 4-6 hours
- Create helper functions - 1-2 hours
- Integration testing - 2-3 hours

### Phase 2: Collision Damage (3-4 hours)
- Port collision handler - 1-2 hours
- Arrow damage system - 1 hour
- Custom object damage - 0.5 hours
- Testing - 0.5-1 hours

### Phase 3: Integration (4-6 hours)
- Weapons Manager API - 1-2 hours
- Armor Manager API - 1-2 hours
- Stats coordination - 1 hour
- Display updates - 1 hour

### Phase 4: Testing & Polish (4-6 hours)
- Scenario testing - 2-3 hours
- Balance adjustments - 1-2 hours
- Bug fixes - 1 hour

**Total:** 19-28 hours for complete combat system

---

## DEPENDENCIES

### Required Before Combat Implementation
1. ✅ **Weapons Manager** - DONE
2. ✅ **Armor Manager** - DONE
3. ✅ **Stats System** - DONE (in Main/Stats)
4. ✅ **Health/Stamina Display** - DONE (UI Manager)
5. ✅ **Meter System** - DONE (for visual feedback)

### Required for Full Functionality
6. ⏳ **Weapon Objects** - Need to broadcast attack data
7. ⏳ **Arrow Objects** - Need proper naming convention
8. ⏳ **Experience Permissions** - For animations (pass out, etc.)

---

## RECOMMENDATIONS

### Priority 1: Implement Core Combat
- Port `rollDice()` and `processAttack()` to F4
- Create `Feudalism 4 - HUD - Combat.lsl`
- Integrate with existing Weapons/Armor managers
- **Rationale:** This is the PRIMARY missing feature from F3

### Priority 2: Add Collision Damage
- Port arrow and projectile damage
- Integrate into Combat or Main script
- **Rationale:** Completes ranged combat functionality

### Priority 3: Create Weapon/Arrow Objects
- Update weapon objects to broadcast attacks
- Create arrow rezzer for archers
- **Rationale:** Required for players to actually use combat system

### Priority 4: Polish & Balance
- Combat log display
- Balance testing with real players
- Tournament mode refinement
- **Rationale:** Ensures combat feels fair and fun

---

## CONCLUSION

The F3 combat system is a **robust, stat-based combat engine** with:
- ✅ Clear attack/defense mechanics
- ✅ Degrees of success for damage scaling
- ✅ Armor and agility factoring into defense
- ✅ Environmental bonuses (speed, height)
- ✅ Critical successes/failures (weapon drops)
- ✅ XP rewards for participation
- ✅ Knockout mechanics
- ✅ Collision damage for projectiles

**This system is production-ready and proven** from F3. Implementation in F4 is straightforward since all supporting systems are now in place (Weapons, Armor, Stats, Meter, etc.).

**Estimated Timeline:** 3-4 work days for complete combat system.

**Next Step:** Create `Feudalism 4 - HUD - Combat.lsl` and begin Phase 1 implementation.

---

**Document Status:** ✅ Complete and Ready for Review  
**Recommendation:** Proceed with Combat system implementation after user approval
