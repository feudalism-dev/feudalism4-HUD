// ============================================================================
// Feudalism 4 - HUD - Weapons Manager
// ============================================================================
// Manages weapon registration, stats, and draw/sheath mechanics
// - Primary and secondary weapon slots
// - Weapon stats (damage, speed, weight, range)
// - Draw/sheath via button clicks
// - Visual slot indicators
// - Persistent storage via LinksetData
// - Integration with Stamina Manager (weight) and Combat System
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Weapons] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;           // Main HUD channel
integer WEAPON_CHANNEL = -77771;        // Primary weapon channel
integer SHEATH_CHANNEL = -77772;        // Primary sheath channel
integer WEAPON_CHANNEL2 = -77773;       // Secondary weapon channel
integer SHEATH_CHANNEL2 = -77774;       // Secondary sheath channel

// =========================== SLOT CONFIGURATION =============================
integer SLOT_PRIMARY = 0;    // Primary weapon slot (rp_slot0)
integer SLOT_SECONDARY = 1;  // Secondary weapon slot (rp_slot1)

// =========================== WEAPON DATA ====================================
// Weapon type lists with stats
list weaponTypeList = [
    "dagger", "knife", "short sword", "longsword", "bastard sword",
    "two handed sword", "great sword", "polearm", "spear", "dual swords",
    "fists", "club", "mace", "two handed mace", "hand axe", "battle axe"
];

list weaponSpeedList = [2, 2, 2, 3, 3, 4, 5, 3, 2, 2, 1, 3, 3, 3, 3, 5];
list weaponWeightList = [1, 1, 2, 3, 4, 5, 9, 4, 2, 6, 1, 3, 5, 8, 3, 10];
list weaponDamageList = [4, 3, 5, 6, 8, 9, 12, 6, 4, 5, 2, 5, 6, 10, 7, 11];
list weaponMinRangeList = [0.0, 0.0, 0.1, 0.65, 0.77, 0.72, 0.85, 1.5, 1.2, 0.75, 0.0, 0.2, 0.8, 1.0, 0.5, 0.7];
list weaponMaxRangeList = [1.0, 1.0, 1.3, 1.6, 2.0, 1.9, 3, 3.5, 3.2, 1.5, 0.8, 1.2, 1.4, 1.6, 1.4, 1.7];

// One-handed weapon types (can dual wield)
list oneHandedTypes = [
    "dagger", "knife", "short sword", "longsword", "bastard sword",
    "hand axe", "mace", "club"
];

// =========================== STATE VARIABLES ================================
// Primary weapon
string primaryWeaponName = "";
string primaryWeaponType = "";
string primaryWeaponPosition = "";
integer primaryWeaponDamage = 0;
integer primaryWeaponSpeed = 0;
integer primaryWeaponWeight = 0;
float primaryWeaponMinRange = 0.0;
float primaryWeaponMaxRange = 0.0;
integer primaryWeaponActive = FALSE;
integer primaryWeaponDrawn = FALSE;

// Secondary weapon
string secondaryWeaponName = "";
string secondaryWeaponType = "";
string secondaryWeaponPosition = "";
integer secondaryWeaponDamage = 0;
integer secondaryWeaponSpeed = 0;
integer secondaryWeaponWeight = 0;
float secondaryWeaponMinRange = 0.0;
float secondaryWeaponMaxRange = 0.0;
integer secondaryWeaponActive = FALSE;
integer secondaryWeaponDrawn = FALSE;

integer hudListenHandle;

// =========================== UTILITY FUNCTIONS ==============================

// Fast texture setter
setLinkTextureFast(integer link, string texture, integer face) {
    list Params = llGetLinkPrimitiveParams(link, [PRIM_TEXTURE, face]);
    integer idx;
    face *= face > 0;
    
    integer NumSides = llGetListLength(Params) / 4;
    for (idx = 0; idx < NumSides; ++idx) {
        Params = llListReplaceList(Params, [PRIM_TEXTURE, face++, texture], idx*6, idx*6);
    }
    
    llSetLinkPrimitiveParamsFast(link, Params);
}

// Get link number by prim name
integer getLinkNumberByName(string linkName) {
    integer i = 0;
    integer numPrims = llGetNumberOfPrims();
    while (i <= numPrims) {
        if (llGetLinkName(i) == linkName) {
            return i;
        }
        i++;
    }
    return -1;
}

// Check if weapon type is one-handed
integer isOneHanded(string type) {
    return (llListFindList(oneHandedTypes, [type]) != -1);
}

// Get weapon stats by type
list getWeaponStats(string type) {
    integer index = llListFindList(weaponTypeList, [type]);
    
    if (index == -1) {
        debugLog("ERROR: Unknown weapon type: " + type);
        return [0, 0, 0, 0.0, 0.0];
    }
    
    integer damage = llList2Integer(weaponDamageList, index);
    integer speed = llList2Integer(weaponSpeedList, index);
    integer weight = llList2Integer(weaponWeightList, index);
    float minRange = llList2Float(weaponMinRangeList, index);
    float maxRange = llList2Float(weaponMaxRangeList, index);
    
    return [damage, speed, weight, minRange, maxRange];
}

// Update total weapon weight (for Stamina Manager)
updateWeaponWeight() {
    integer totalWeight = primaryWeaponWeight + secondaryWeaponWeight;
    
    // Notify Stamina Manager of weapon weight
    llMessageLinked(LINK_SET, totalWeight, "weapon weight", "");
    
    debugLog("Updated weapon weight: " + (string)totalWeight);
}

// Save weapon data to LinksetData
saveWeaponData(integer slot) {
    string prefix = "weapon_primary_";
    if (slot == SLOT_SECONDARY) {
        prefix = "weapon_secondary_";
    }
    
    if (slot == SLOT_PRIMARY && primaryWeaponActive) {
        llLinksetDataWrite(prefix + "name", primaryWeaponName);
        llLinksetDataWrite(prefix + "type", primaryWeaponType);
        llLinksetDataWrite(prefix + "position", primaryWeaponPosition);
        llLinksetDataWrite(prefix + "damage", (string)primaryWeaponDamage);
        llLinksetDataWrite(prefix + "speed", (string)primaryWeaponSpeed);
        llLinksetDataWrite(prefix + "weight", (string)primaryWeaponWeight);
        llLinksetDataWrite(prefix + "minRange", (string)primaryWeaponMinRange);
        llLinksetDataWrite(prefix + "maxRange", (string)primaryWeaponMaxRange);
        llLinksetDataWrite(prefix + "drawn", (string)primaryWeaponDrawn);
    }
    else if (slot == SLOT_SECONDARY && secondaryWeaponActive) {
        llLinksetDataWrite(prefix + "name", secondaryWeaponName);
        llLinksetDataWrite(prefix + "type", secondaryWeaponType);
        llLinksetDataWrite(prefix + "position", secondaryWeaponPosition);
        llLinksetDataWrite(prefix + "damage", (string)secondaryWeaponDamage);
        llLinksetDataWrite(prefix + "speed", (string)secondaryWeaponSpeed);
        llLinksetDataWrite(prefix + "weight", (string)secondaryWeaponWeight);
        llLinksetDataWrite(prefix + "minRange", (string)secondaryWeaponMinRange);
        llLinksetDataWrite(prefix + "maxRange", (string)secondaryWeaponMaxRange);
        llLinksetDataWrite(prefix + "drawn", (string)secondaryWeaponDrawn);
    }
    else {
        // Clear data if weapon deactivated
        llLinksetDataDelete(prefix + "name");
        llLinksetDataDelete(prefix + "type");
        llLinksetDataDelete(prefix + "position");
        llLinksetDataDelete(prefix + "damage");
        llLinksetDataDelete(prefix + "speed");
        llLinksetDataDelete(prefix + "weight");
        llLinksetDataDelete(prefix + "minRange");
        llLinksetDataDelete(prefix + "maxRange");
        llLinksetDataDelete(prefix + "drawn");
    }
}

// Register primary weapon
registerPrimaryWeapon(string name, string type, string position) {
    list stats = getWeaponStats(type);
    
    if (llGetListLength(stats) == 0) {
        llOwnerSay("RP HUD could not find data for weapon type: " + type);
        return;
    }
    
    // Set weapon data
    primaryWeaponName = name;
    primaryWeaponType = type;
    primaryWeaponPosition = position;
    primaryWeaponDamage = llList2Integer(stats, 0);
    primaryWeaponSpeed = llList2Integer(stats, 1);
    primaryWeaponWeight = llList2Integer(stats, 2);
    primaryWeaponMinRange = llList2Float(stats, 3);
    primaryWeaponMaxRange = llList2Float(stats, 4);
    primaryWeaponActive = TRUE;
    primaryWeaponDrawn = FALSE;
    
    // Update visual indicator
    integer link = getLinkNumberByName("rp_slot" + (string)SLOT_PRIMARY);
    if (link != -1) {
        setLinkTextureFast(link, type + " active", 4);
        llSetLinkAlpha(link, 1.0, 4);
    }
    
    // Tell weapon to sheath
    llRegionSayTo(llGetOwner(), WEAPON_CHANNEL, "sheath");
    
    // Notify Main script
    llMessageLinked(LINK_SET, 0, "activatePrimaryWeapon", "");
    
    // Save to LinksetData
    saveWeaponData(SLOT_PRIMARY);
    
    // Update total weight
    updateWeaponWeight();
    
    debugLog("Primary weapon registered: " + name + " (" + type + ")");
}

// Register secondary weapon
registerSecondaryWeapon(string name, string type, string position) {
    list stats = getWeaponStats(type);
    
    if (llGetListLength(stats) == 0) {
        llOwnerSay("RP HUD could not find data for weapon type: " + type);
        return;
    }
    
    // Set weapon data
    secondaryWeaponName = name;
    secondaryWeaponType = type;
    secondaryWeaponPosition = position;
    secondaryWeaponDamage = llList2Integer(stats, 0);
    secondaryWeaponSpeed = llList2Integer(stats, 1);
    secondaryWeaponWeight = llList2Integer(stats, 2);
    secondaryWeaponMinRange = llList2Float(stats, 3);
    secondaryWeaponMaxRange = llList2Float(stats, 4);
    secondaryWeaponActive = TRUE;
    secondaryWeaponDrawn = FALSE;
    
    // Update visual indicator
    integer link = getLinkNumberByName("rp_slot" + (string)SLOT_SECONDARY);
    if (link != -1) {
        setLinkTextureFast(link, type + " active", 4);
        llSetLinkAlpha(link, 1.0, 4);
    }
    
    // Tell weapon to sheath
    llRegionSayTo(llGetOwner(), WEAPON_CHANNEL2, "sheath");
    
    // Notify Main script
    llMessageLinked(LINK_SET, 0, "activateSecondaryWeapon", "");
    
    // Save to LinksetData
    saveWeaponData(SLOT_SECONDARY);
    
    // Update total weight
    updateWeaponWeight();
    
    debugLog("Secondary weapon registered: " + name + " (" + type + ")");
}

// Unregister primary weapon
unregisterPrimaryWeapon() {
    primaryWeaponName = "";
    primaryWeaponType = "";
    primaryWeaponPosition = "";
    primaryWeaponDamage = 0;
    primaryWeaponSpeed = 0;
    primaryWeaponWeight = 0;
    primaryWeaponMinRange = 0.0;
    primaryWeaponMaxRange = 0.0;
    primaryWeaponActive = FALSE;
    primaryWeaponDrawn = FALSE;
    
    // Update visual indicator
    integer link = getLinkNumberByName("rp_slot" + (string)SLOT_PRIMARY);
    if (link != -1) {
        setLinkTextureFast(link, "active_none", 4);
        llSetLinkAlpha(link, 0.0, 4);
    }
    
    // Notify Main script
    llMessageLinked(LINK_SET, 0, "deactivatePrimaryWeapon", "");
    
    // Clear LinksetData
    saveWeaponData(SLOT_PRIMARY);
    
    // Update total weight
    updateWeaponWeight();
    
    debugLog("Primary weapon unregistered");
}

// Unregister secondary weapon
unregisterSecondaryWeapon() {
    secondaryWeaponName = "";
    secondaryWeaponType = "";
    secondaryWeaponPosition = "";
    secondaryWeaponDamage = 0;
    secondaryWeaponSpeed = 0;
    secondaryWeaponWeight = 0;
    secondaryWeaponMinRange = 0.0;
    secondaryWeaponMaxRange = 0.0;
    secondaryWeaponActive = FALSE;
    secondaryWeaponDrawn = FALSE;
    
    // Update visual indicator
    integer link = getLinkNumberByName("rp_slot" + (string)SLOT_SECONDARY);
    if (link != -1) {
        setLinkTextureFast(link, "active_none", 4);
        llSetLinkAlpha(link, 0.0, 4);
    }
    
    // Notify Main script
    llMessageLinked(LINK_SET, 0, "deactivateSecondaryWeapon", "");
    
    // Clear LinksetData
    saveWeaponData(SLOT_SECONDARY);
    
    // Update total weight
    updateWeaponWeight();
    
    debugLog("Secondary weapon unregistered");
}

// Toggle draw/sheath for primary weapon
togglePrimaryWeapon() {
    if (!primaryWeaponActive) {
        debugLog("No primary weapon equipped");
        return;
    }
    
    if (primaryWeaponDrawn) {
        // Sheath
        llRegionSayTo(llGetOwner(), WEAPON_CHANNEL, "sheath");
        primaryWeaponDrawn = FALSE;
        debugLog("Primary weapon sheathed");
    } else {
        // Draw
        llRegionSayTo(llGetOwner(), WEAPON_CHANNEL, "draw");
        primaryWeaponDrawn = TRUE;
        debugLog("Primary weapon drawn");
    }
    
    saveWeaponData(SLOT_PRIMARY);
}

// Toggle draw/sheath for secondary weapon
toggleSecondaryWeapon() {
    if (!secondaryWeaponActive) {
        debugLog("No secondary weapon equipped");
        return;
    }
    
    if (secondaryWeaponDrawn) {
        // Sheath
        llRegionSayTo(llGetOwner(), WEAPON_CHANNEL2, "sheath");
        secondaryWeaponDrawn = FALSE;
        debugLog("Secondary weapon sheathed");
    } else {
        // Draw
        llRegionSayTo(llGetOwner(), WEAPON_CHANNEL2, "draw");
        secondaryWeaponDrawn = TRUE;
        debugLog("Secondary weapon drawn");
    }
    
    saveWeaponData(SLOT_SECONDARY);
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Weapons Manager starting...");
        
        // Clean up old listener
        llListenRemove(hudListenHandle);
        
        // Initialize
        primaryWeaponActive = FALSE;
        secondaryWeaponActive = FALSE;
        
        // Start listening
        hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        
        debugLog("Weapons Manager ready");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == HUD_CHANNEL) {
            llListenRemove(hudListenHandle);
            
            list parsedMessage = llCSV2List(message);
            string action = llList2String(parsedMessage, 0);
            
            if (action == "registerWeapon") {
                string weaponName = llList2String(parsedMessage, 1);
                string weaponType = llList2String(parsedMessage, 2);
                string weaponPosition = llList2String(parsedMessage, 3);
                
                registerPrimaryWeapon(weaponName, weaponType, weaponPosition);
            }
            else if (action == "registerWeapon2") {
                string weaponName = llList2String(parsedMessage, 1);
                string weaponType = llList2String(parsedMessage, 2);
                string weaponPosition = llList2String(parsedMessage, 3);
                
                registerSecondaryWeapon(weaponName, weaponType, weaponPosition);
            }
            else if (action == "unregisterWeapon") {
                unregisterPrimaryWeapon();
            }
            else if (action == "unregisterWeapon2") {
                unregisterSecondaryWeapon();
            }
            
            // Re-enable listener
            hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        debugLog("Link message: " + msg);
        
        // Check weapon status (from combat system)
        if (msg == "check weapon") {
            llRegionSayTo(llGetOwner(), WEAPON_CHANNEL, "check");
        }
        
        // Get weapon stats (for combat system)
        else if (msg == "get primary weapon stats") {
            if (primaryWeaponActive) {
                string stats = llList2CSV([
                    primaryWeaponDamage,
                    primaryWeaponSpeed,
                    primaryWeaponWeight,
                    primaryWeaponMinRange,
                    primaryWeaponMaxRange,
                    primaryWeaponDrawn
                ]);
                llMessageLinked(LINK_SET, 0, "primary weapon stats", stats);
            } else {
                llMessageLinked(LINK_SET, 0, "primary weapon stats", "");
            }
        }
        else if (msg == "get secondary weapon stats") {
            if (secondaryWeaponActive) {
                string stats = llList2CSV([
                    secondaryWeaponDamage,
                    secondaryWeaponSpeed,
                    secondaryWeaponWeight,
                    secondaryWeaponMinRange,
                    secondaryWeaponMaxRange,
                    secondaryWeaponDrawn
                ]);
                llMessageLinked(LINK_SET, 0, "secondary weapon stats", stats);
            } else {
                llMessageLinked(LINK_SET, 0, "secondary weapon stats", "");
            }
        }
    }
    
    touch_start(integer num_detected) {
        string touchAction = llGetLinkName(llDetectedLinkNumber(0));
        
        if (touchAction == "rp_slot0") {
            // Primary weapon slot clicked
            togglePrimaryWeapon();
        }
        else if (touchAction == "rp_slot1") {
            // Secondary weapon slot clicked
            toggleSecondaryWeapon();
        }
    }
}
