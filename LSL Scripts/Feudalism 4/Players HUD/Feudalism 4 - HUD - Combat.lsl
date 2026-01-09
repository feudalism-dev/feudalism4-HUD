// ============================================================================
// Feudalism 4 - HUD - Combat Manager
// ============================================================================
// Hybrid combat system combining physical action with dice-based resolution
// - Melee: Physical clicks trigger stat-based dice rolls
// - Ranged: Physical collision triggers stat-based damage scaling
// - D20 dice system with degrees of success
// - Attack vs Defense rolls with speed/height/impairment modifiers
// - Hit location system with armor defense
// - Critical success/failure mechanics
// - XP rewards for combat participation
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Combat] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;           // Main HUD channel
integer WEAPON_CHANNEL = -77771;        // Primary weapon
integer WEAPON_CHANNEL2 = -77773;       // Secondary weapon
integer SHEATH_CHANNEL = -77772;        // Primary sheath
integer SHEATH_CHANNEL2 = -77774;       // Secondary sheath

// =========================== STAT INDICES ===================================
// F4 stat system (matches Main.lsl)
integer AGILITY = 0;
integer ANIMAL = 1;
integer ATHLETICS = 2;
integer AWARENESS = 3;
integer CRAFTING = 4;
integer DECEPTION = 5;
integer ENDURANCE = 6;
integer ENTERTAINING = 7;
integer FIGHTING = 8;
integer HEALING = 9;
integer INFLUENCE = 10;
integer INTELLIGENCE = 11;
integer KNOWLEDGE = 12;
integer MARKSMANSHIP = 13;
integer PERSUASION = 14;
integer STEALTH = 15;
integer SURVIVAL = 16;
integer THIEVERY = 17;
integer WILL = 18;
integer WISDOM = 19;

// =========================== STATE VARIABLES ================================
// Character stats (loaded from Main)
list myStats = [];
string mode = "roleplay";  // "roleplay" or "tournament"
integer impairmentLevel = 0;  // Drunk/impaired penalty

// Current resources (loaded from Main/Stats)
integer currentHealth = 100;
integer currentStamina = 100;
integer baseHealth = 100;
integer baseStamina = 100;

// Weapon status (loaded from Weapons Manager)
integer primaryWeaponIsDrawn = FALSE;
integer secondaryWeaponIsDrawn = FALSE;

// Attack data (from weapon broadcast)
key attackerID = NULL_KEY;
integer attackerFighting = 0;
integer attackerAttackBonus = 0;
integer attackerBaseDamage = 0;
vector attackerPos = ZERO_VECTOR;
string attackerHand = "primary";  // "primary" or "secondary"

// Listen handle
integer hudListenHandle;

// Body parts for hit location
list bodyParts = [
    "head", "neck", "upper torso", "lower torso",
    "right arm", "left arm", "upper leg", "lower leg", "foot"
];

// =========================== UTILITY FUNCTIONS ==============================

// Roll D20 dice
integer rollDice(integer numDice) {
    integer results = 0;
    
    integer i = 0;
    while (i < numDice) {
        results += (integer)(llFrand(20.0) + 1);  // D20: 1-20
        i++;
    }
    
    debugLog("Rolled " + (string)numDice + "d20 = " + (string)results);
    return results;
}

// Check if weapon should drop (30% chance)
integer doesWeaponDrop() {
    return (llFrand(100.0) > 70);
}

// Randomly determine hit location
string whichPartHit() {
    integer hitResult = (integer)llFrand(100) + 1;
    
    // Weighted hit locations (more likely to hit torso/limbs than head)
    if (hitResult > 96) return "head";
    else if (hitResult > 93) return "neck";
    else if (hitResult > 70) return "upper torso";
    else if (hitResult > 50) return "lower torso";
    else if (hitResult > 40) return "right arm";
    else if (hitResult > 30) return "left arm";
    else if (hitResult > 20) return "upper leg";
    else if (hitResult > 10) return "lower leg";
    else return "foot";
}

// Get armor defense for a body part (requests from Armor Manager)
integer getArmorDefense(string hitLocation) {
    // Request armor defense from Armor Manager
    llMessageLinked(LINK_SET, 0, "get armor for " + hitLocation, "");
    
    // For now, return 0 - will be updated via link_message response
    // In actual implementation, this would use a global variable updated by link_message
    return 0;
}

// Apply damage to health (notifies Main)
applyDamage(integer damage) {
    currentHealth -= damage;
    
    if (currentHealth < 0) {
        currentHealth = 0;
    }
    
    // Notify Main to update display and save
    llMessageLinked(LINK_SET, damage, "combat damage", "");
    
    debugLog("Applied " + (string)damage + " damage. Health now: " + (string)currentHealth);
}

// Award XP (notifies Main)
awardXP(integer amount) {
    llMessageLinked(LINK_SET, amount, "gain xp", "");
    debugLog("Awarded " + (string)amount + " XP");
}

// Trigger knockout (notifies Main)
triggerKnockout() {
    llMessageLinked(LINK_SET, 0, "pass out", "");
    debugLog("Knockout triggered");
}

// =========================== MELEE COMBAT ===================================

// Process incoming melee attack
processAttack() {
    debugLog("Processing attack from " + llKey2Name(attackerID));
    
    // Step 1: Stat Preparation
    integer defFighting = llList2Integer(myStats, FIGHTING);
    integer defDodgeBonus = llList2Integer(myStats, AGILITY);
    
    // Tournament mode override (balanced PvP)
    if (mode == "tournament") {
        defFighting = 5;
        defDodgeBonus = 5;
        attackerFighting = 5;
        attackerAttackBonus = 5;
    }
    
    integer maxDefense = defFighting * 20;
    integer maxAttack = attackerFighting * 20;
    
    // Save raw bonuses for later use
    integer atkBonus = attackerAttackBonus;
    integer defBonus = defDodgeBonus;
    
    // Step 2: Speed Bonuses/Penalties
    vector myPos = llGetPos();
    float mySpeed = llVecMag(llList2Vector(llGetObjectDetails(llGetOwner(), [OBJECT_VELOCITY]), 0));
    float attackerSpeed = llVecMag(llList2Vector(llGetObjectDetails(attackerID, [OBJECT_VELOCITY]), 0));
    
    debugLog("My speed: " + (string)mySpeed + " m/s, Attacker speed: " + (string)attackerSpeed + " m/s");
    
    // Fast movement bonus to defense (harder to hit)
    if (mySpeed > 3.2) {
        defDodgeBonus += 5;
        debugLog("Fast movement: +5 dodge");
    }
    
    // Fast movement penalty to attack (harder to aim)
    if (attackerSpeed > 3.2) {
        attackerAttackBonus -= 5;
        debugLog("Attacker moving fast: -5 attack");
    }
    
    // Step 3: Height Advantage
    if (attackerPos.z > myPos.z) {
        ++attackerAttackBonus;
        debugLog("Attacker has high ground: +1 attack");
    }
    else if (attackerPos.z < myPos.z) {
        ++defDodgeBonus;
        debugLog("Defender has high ground: +1 dodge");
    }
    
    // Step 4: Impairment Penalty
    if (impairmentLevel > 0) {
        defDodgeBonus -= impairmentLevel;  // Fixed from F3 bug
        debugLog("Impairment: -" + (string)impairmentLevel + " dodge");
    }
    
    // Step 5: Roll Attack and Defense
    integer defenseRoll = 0;
    integer attackRoll = 0;
    
    if (defDodgeBonus > 0) {
        defenseRoll = rollDice(defFighting) + (integer)llFrand(defDodgeBonus) + 1;
    } else {
        defenseRoll = rollDice(defFighting);
        defDodgeBonus = 0;
    }
    
    if (attackerAttackBonus > 0) {
        attackRoll = rollDice(attackerFighting) + (integer)llFrand(attackerAttackBonus);
    } else {
        attackRoll = rollDice(attackerFighting);
        attackerAttackBonus = 0;
    }
    
    debugLog("Attack roll: " + (string)attackRoll + " vs Defense roll: " + (string)defenseRoll);
    
    // Step 6: Determine Hit or Miss
    if (attackRoll > defenseRoll) {
        // HIT!
        processHit(attackRoll, defenseRoll, maxAttack, atkBonus, defBonus);
    } else {
        // MISS!
        processMiss(attackRoll, defenseRoll, maxDefense);
    }
}

// Process successful hit
processHit(integer attackRoll, integer defenseRoll, integer maxAttack, integer atkBonus, integer defBonus) {
    debugLog("HIT! Attack: " + (string)attackRoll + " > Defense: " + (string)defenseRoll);
    
    // Damage weapon
    llRegionSayTo(attackerID, WEAPON_CHANNEL, "damageWeapon");
    
    // Calculate degrees of success
    integer degreesOfSuccess = ((attackRoll - defenseRoll) / 10) + 1;
    debugLog("Degrees of success: " + (string)degreesOfSuccess);
    
    // Determine hit location
    string hitLocation = whichPartHit();
    debugLog("Hit location: " + hitLocation);
    
    // Request armor defense from Armor Manager
    // NOTE: In full implementation, this would wait for response
    // For now, we'll use a simplified inline check
    integer armorDefBonus = 0;  // Will be set by Armor Manager response
    
    // Shield bonus (if dual wielding in roleplay mode)
    if (primaryWeaponIsDrawn && secondaryWeaponIsDrawn && mode == "roleplay") {
        armorDefBonus++;
        debugLog("Shield bonus: +1 defense");
    }
    
    // Calculate base damage
    integer damage = (integer)llFrand(2 * attackerBaseDamage) + 1;
    debugLog("Base damage: " + (string)damage);
    
    // Apply armor reduction
    damage -= (integer)llFrand(armorDefBonus) + 1;
    
    // Apply agility reduction
    damage -= (integer)llFrand(defBonus) + 1;
    
    debugLog("Damage after defenses: " + (string)damage);
    
    // Check for critical success (weapon drop for defender)
    if ((float)attackRoll / (float)maxAttack >= 0.95) {
        if (degreesOfSuccess >= 6) {
            if (doesWeaponDrop()) {
                llRegionSayTo(llGetOwner(), WEAPON_CHANNEL, "drop");
                llRegionSayTo(llGetOwner(), 0, "You were hit so badly, you dropped your primary weapon.");
                debugLog("CRITICAL HIT: Weapon dropped!");
            }
        }
    }
    
    // Add degrees of success bonus damage
    integer i = 1;
    while (i <= degreesOfSuccess) {
        damage += (integer)llFrand(atkBonus) + 1;
        i++;
    }
    
    debugLog("Final damage: " + (string)damage);
    
    // Generate output message
    string output;
    
    if (damage <= 0) {
        damage = 0;
        output = llGetDisplayName(attackerID) + " hits " + 
                 llGetDisplayName(llGetOwner()) + ", but delivers no damage.";
    } else {
        output = llGetDisplayName(attackerID) + " hits " + 
                 llGetDisplayName(llGetOwner()) + " on the " + 
                 hitLocation + " for " + (string)damage + " points of damage.";
    }
    
    // Display message in tournament mode
    if (mode == "tournament") {
        llSay(0, output);
    }
    
    // Award XP to attacker
    llRegionSayTo(attackerID, HUD_CHANNEL, "gainXP,1");
    
    // Apply damage
    if (damage > 0) {
        applyDamage(damage);
    }
    
    // Check for knockout
    if (currentHealth <= 0 || currentStamina <= 0) {
        debugLog("KNOCKOUT!");
        
        if (currentHealth < 0) currentHealth = 0;
        if (currentStamina < 0) currentStamina = 0;
        
        triggerKnockout();
        
        // Loser gets 5 XP
        awardXP(5);
        
        // Winner gets scaled XP
        integer defFighting = llList2Integer(myStats, FIGHTING);
        integer factor = 1;
        
        if (attackerFighting > defFighting) {
            factor = 1 / (attackerFighting - defFighting);
        } else if (attackerFighting < defFighting) {
            factor = defFighting - attackerFighting;
        }
        
        integer enemyXPEarned = baseHealth * factor;
        llRegionSayTo(attackerID, HUD_CHANNEL, "gainXP," + (string)enemyXPEarned);
    }
}

// Process miss
processMiss(integer attackRoll, integer defenseRoll, integer maxDefense) {
    debugLog("MISS! Attack: " + (string)attackRoll + " <= Defense: " + (string)defenseRoll);
    
    // Generate output message
    string output = llGetDisplayName(attackerID) + " swings at " + 
                    llGetDisplayName(llGetOwner()) + " but misses.";
    
    if (mode == "tournament") {
        llSay(0, output);
    }
    
    // Calculate degrees of failure
    integer degreesOfFailure = ((defenseRoll - attackRoll) / 10) + 1;
    debugLog("Degrees of failure: " + (string)degreesOfFailure);
    
    // Check for critical failure (weapon drop for attacker)
    if ((float)defenseRoll / (float)maxDefense >= 0.95) {
        if (degreesOfFailure >= 6) {
            if (doesWeaponDrop()) {
                if (attackerHand == "primary") {
                    llRegionSayTo(attackerID, WEAPON_CHANNEL, "drop");
                } else {
                    llRegionSayTo(attackerID, WEAPON_CHANNEL2, "drop");
                }
                llRegionSayTo(attackerID, 0, "You missed so badly, that you dropped your weapon!");
                debugLog("CRITICAL MISS: Attacker dropped weapon!");
            }
        }
    }
}

// =========================== RANGED COMBAT (COLLISION) =====================

// Process arrow collision
processArrowHit(key shooter, string projectileName) {
    debugLog("Arrow hit from " + llKey2Name(shooter));
    
    integer collisionBaseDamage = 5;  // Base arrow damage
    
    // Get shooter's Marksmanship stat (would need to request from their HUD)
    // For now, use default
    integer enemyMarksmanship = 2;
    
    // Get defender's Athletics stat
    integer myAthletics = llList2Integer(myStats, ATHLETICS);
    
    // Roll opposed checks
    integer enemyRoll = rollDice(enemyMarksmanship);
    integer myRoll = rollDice(myAthletics);
    
    debugLog("Arrow roll - Attacker: " + (string)enemyRoll + " vs Defender: " + (string)myRoll);
    
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
    applyDamage(collisionBaseDamage);
    
    // Output message
    string shooterName = llGetDisplayName(shooter);
    llOwnerSay("You have been shot with an arrow for " + 
               (string)collisionBaseDamage + " points of damage by " + 
               shooterName + ".");
    
    // Check for knockout
    if (currentHealth <= 0) {
        triggerKnockout();
        awardXP(5);  // Knockout XP
    }
}

// Process custom projectile collision (fcobject format)
processCustomProjectile(key shooter, string objectName) {
    debugLog("Custom projectile: " + objectName);
    
    list objectParms = llCSV2List(objectName);
    
    if (llGetListLength(objectParms) == 3) {
        string projectileType = llList2String(objectParms, 0);
        
        if (projectileType == "fcobject") {
            string weaponName = llList2String(objectParms, 1);
            integer collisionBaseDamage = llList2Integer(objectParms, 2);
            
            // Apply damage directly (no resistance check for spell projectiles)
            applyDamage(collisionBaseDamage);
            
            // Output message
            string shooterName = llGetDisplayName(shooter);
            llOwnerSay("You were struck by a " + weaponName + 
                       " for " + (string)collisionBaseDamage + 
                       " points of damage by " + shooterName + ".");
            
            // Check for knockout
            if (currentHealth <= 0) {
                triggerKnockout();
                awardXP(5);
            }
        }
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Combat Manager starting...");
        
        // Clean up old listener
        llListenRemove(hudListenHandle);
        
        // Start listening for attack broadcasts
        hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        
        // Request initial data from Main/Stats/Weapons
        llMessageLinked(LINK_SET, 0, "combat request stats", "");
        llMessageLinked(LINK_SET, 0, "combat request resources", "");
        llMessageLinked(LINK_SET, 0, "combat request weapon status", "");
        
        debugLog("Combat Manager ready");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == HUD_CHANNEL) {
            llListenRemove(hudListenHandle);
            
            list parsed = llCSV2List(message);
            string action = llList2String(parsed, 0);
            
            // Incoming melee attack broadcast
            if (action == "broadcastAttack") {
                attackerID = id;  // Key from listen event
                attackerFighting = (integer)llList2String(parsed, 1);
                attackerAttackBonus = (integer)llList2String(parsed, 2);
                attackerBaseDamage = (integer)llList2String(parsed, 3);
                attackerPos = (vector)llList2String(parsed, 4);
                attackerHand = llList2String(parsed, 5);
                
                debugLog("Received attack broadcast from " + llKey2Name(attackerID));
                processAttack();
            }
            
            // XP reward
            else if (action == "gainXP") {
                integer xpAmount = (integer)llList2String(parsed, 1);
                awardXP(xpAmount);
            }
            
            // Re-enable listener
            hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Receive stats from Main
        if (msg == "combat stats") {
            myStats = llCSV2List((string)id);
            debugLog("Received stats: " + (string)llGetListLength(myStats) + " values");
        }
        
        // Receive resources from Stats
        else if (msg == "combat resources") {
            list data = llCSV2List((string)id);
            currentHealth = llList2Integer(data, 0);
            baseHealth = llList2Integer(data, 1);
            currentStamina = llList2Integer(data, 2);
            baseStamina = llList2Integer(data, 3);
            debugLog("Received resources - HP: " + (string)currentHealth + "/" + (string)baseHealth);
        }
        
        // Receive weapon status from Weapons Manager
        else if (msg == "combat weapon status") {
            list data = llCSV2List((string)id);
            primaryWeaponIsDrawn = llList2Integer(data, 0);
            secondaryWeaponIsDrawn = llList2Integer(data, 1);
            debugLog("Weapon status - Primary: " + (string)primaryWeaponIsDrawn + 
                     ", Secondary: " + (string)secondaryWeaponIsDrawn);
        }
        
        // Receive mode from Main
        else if (msg == "combat mode") {
            mode = (string)id;
            debugLog("Mode set to: " + mode);
        }
        
        // Receive impairment level
        else if (msg == "combat impairment") {
            impairmentLevel = num;
            debugLog("Impairment level: " + (string)impairmentLevel);
        }
    }
    
    collision_start(integer numDetected) {
        key collisionObjectKey = llDetectedKey(0);
        string collisionObjectName = llToLower(llDetectedName(0));
        
        // Get object owner (shooter)
        list details = llGetObjectDetails(collisionObjectKey, [OBJECT_OWNER]);
        key shooterID = llList2Key(details, 0);
        
        debugLog("Collision with: " + collisionObjectName);
        
        // Check for arrow
        if (llSubStringIndex(collisionObjectName, "arrow") != -1) {
            // Exclude "barrow" (wheelbarrow)
            if (llSubStringIndex(collisionObjectName, "barrow") == -1) {
                processArrowHit(shooterID, collisionObjectName);
            }
        }
        
        // Check for custom projectile (fcobject format)
        else if (llSubStringIndex(collisionObjectName, "fcobject") != -1) {
            processCustomProjectile(shooterID, collisionObjectName);
        }
    }
}
