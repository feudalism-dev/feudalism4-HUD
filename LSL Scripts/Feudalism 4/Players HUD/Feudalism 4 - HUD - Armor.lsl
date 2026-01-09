// ============================================================================
// Feudalism 4 - HUD - Armor Manager
// ============================================================================
// Manages armor registration and defense calculations
// - 9 body part armor tracking
// - Armor type system (cloth, leather, chainmail, plate, etc.)
// - Shield management
// - Armor weight calculations
// - Integration with Combat System for defense bonuses
// - Persistent storage via LinksetData
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Armor] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;       // Main HUD channel
integer ARMOR_CHANNEL = -77775;     // Armor registration channel

// =========================== ARMOR DATA =====================================
// Body parts (9 total)
list bodyParts = [
    "head", "neck", "upper torso", "lower torso",
    "right arm", "left arm", "upper leg", "lower leg", "foot"
];

// Armor types (ordered by protection level)
list armorTypes = [
    "none", "cloth", "fur", "leather", "chainmail",
    "ring male", "scale mail", "brigandine", "plate", "shield"
];

// Armor defense values (by type index)
list armorValues = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Armor weight by type (base weight)
list armorWeightByType = [0, 0, 1, 1, 2, 2, 2, 3, 4, 0];

// Armor weight multiplier by body part
list armorWeightByPart = [1.0, 0.5, 2.8, 1.0, 1.0, 1.0, 1.25, 1.25, 1.1];

// Shield types
list shieldTypes = ["buckler", "round", "kite", "heater", "pavise"];
list shieldWeightByType = [1, 4, 3, 2, 5];

// Shield materials
list shieldMaterials = ["leather", "wood", "rimmed", "bronze", "steel"];
list shieldWeightByMaterial = [1, 2, 3, 4, 5];

// =========================== STATE VARIABLES ================================
integer numberOfParts = 9;

// Current armor worn (by body part)
list myArmor = ["none", "none", "none", "none", "none", "none", "none", "none", "none"];

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

// Check if armor type is valid
integer isValidArmorType(string typeToCheck) {
    return llListFindList(armorTypes, [typeToCheck]);
}

// Calculate total armor weight
integer calculateArmorWeight() {
    integer totalWeight = 0;
    integer i = 0;
    
    while (i < numberOfParts) {
        string armorType = llList2String(myArmor, i);
        integer typeIndex = llListFindList(armorTypes, [armorType]);
        
        if (typeIndex != -1 && typeIndex > 0) {  // 0 = "none"
            integer baseWeight = llList2Integer(armorWeightByType, typeIndex);
            float partMultiplier = llList2Float(armorWeightByPart, i);
            totalWeight += (integer)(baseWeight * partMultiplier);
        }
        
        i++;
    }
    
    debugLog("Total armor weight: " + (string)totalWeight);
    return totalWeight;
}

// Calculate total armor defense value
integer calculateArmorDefense() {
    integer totalDefense = 0;
    integer i = 0;
    
    while (i < numberOfParts) {
        string armorType = llList2String(myArmor, i);
        integer typeIndex = llListFindList(armorTypes, [armorType]);
        
        if (typeIndex != -1 && typeIndex > 0) {  // 0 = "none"
            totalDefense += llList2Integer(armorValues, typeIndex);
        }
        
        i++;
    }
    
    debugLog("Total armor defense: " + (string)totalDefense);
    return totalDefense;
}

// Update armor weight (notify Stamina Manager)
updateArmorWeight() {
    integer totalWeight = calculateArmorWeight();
    
    // Notify Stamina Manager
    llMessageLinked(LINK_SET, totalWeight, "armor weight", "");
    
    debugLog("Updated armor weight: " + (string)totalWeight);
}

// Save armor data to LinksetData
saveArmorData() {
    llLinksetDataWrite("armor_worn", llList2CSV(myArmor));
    
    integer defense = calculateArmorDefense();
    llLinksetDataWrite("armor_defense", (string)defense);
}

// Register armor (replaces armor on parts if better)
registerArmor(list armorAffected) {
    integer i = 0;
    integer updated = FALSE;
    
    while (i < numberOfParts) {
        string newType = llList2String(armorAffected, i);
        
        if (isValidArmorType(newType) != -1) {
            // Get current and new armor type indices
            string currentType = llList2String(myArmor, i);
            integer currentIndex = llListFindList(armorTypes, [currentType]);
            integer newIndex = llListFindList(armorTypes, [newType]);
            
            // Only replace if new armor is better
            if (newIndex > currentIndex) {
                myArmor = llListReplaceList(myArmor, [newType], i, i);
                updated = TRUE;
                debugLog("Updated " + llList2String(bodyParts, i) + " to " + newType);
            }
        }
        
        i++;
    }
    
    if (updated) {
        // Notify Main script
        llMessageLinked(LINK_SET, 0, "setArmor", llList2CSV(myArmor));
        
        // Save to LinksetData
        saveArmorData();
        
        // Update weight
        updateArmorWeight();
    }
}

// Unregister all armor
unregisterArmor() {
    myArmor = ["none", "none", "none", "none", "none", "none", "none", "none", "none"];
    
    // Notify Main script
    llMessageLinked(LINK_SET, 0, "setArmor", llList2CSV(myArmor));
    
    // Save to LinksetData
    saveArmorData();
    
    // Update weight
    updateArmorWeight();
    
    debugLog("All armor unregistered");
}

// Check current armor (request from all armor pieces)
checkArmor() {
    // Reset armor
    unregisterArmor();
    
    // Broadcast check command to all armor pieces
    llRegionSayTo(llGetOwner(), ARMOR_CHANNEL, "checkArmor");
    
    debugLog("Armor check requested");
}

// Display current armor
displayArmor() {
    string text = "Armor worn:\n";
    text += "==========================\n";
    
    integer i = 0;
    while (i < numberOfParts) {
        text += llList2String(bodyParts, i) + ": ";
        text += llList2String(myArmor, i) + "\n";
        i++;
    }
    
    integer defense = calculateArmorDefense();
    integer weight = calculateArmorWeight();
    
    text += "==========================\n";
    text += "Total Defense: " + (string)defense + "\n";
    text += "Total Weight: " + (string)weight;
    
    llRegionSayTo(llGetOwner(), 0, text);
}

// Restore armor from LinksetData
restoreArmor() {
    string saved = llLinksetDataRead("armor_worn");
    
    if (saved != "") {
        myArmor = llCSV2List(saved);
        debugLog("Restored armor from LinksetData");
        
        // Notify Main script
        llMessageLinked(LINK_SET, 0, "setArmor", llList2CSV(myArmor));
        
        // Update weight
        updateArmorWeight();
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Armor Manager starting...");
        
        // Clean up old listener
        llListenRemove(hudListenHandle);
        
        // Initialize
        myArmor = ["none", "none", "none", "none", "none", "none", "none", "none", "none"];
        
        // Start listening
        hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        
        // Restore previous armor
        restoreArmor();
        
        debugLog("Armor Manager ready");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == HUD_CHANNEL) {
            llListenRemove(hudListenHandle);
            
            list parsedMessage = llCSV2List(message);
            string action = llList2String(parsedMessage, 0);
            
            if (action == "registerArmor") {
                // Extract armor affected (9 parts + 1 for shield)
                list armorAffected = [];
                integer i = 0;
                while (i < (numberOfParts + 1)) {
                    armorAffected += llList2String(parsedMessage, i + 1);
                    i++;
                }
                
                debugLog("Register armor: " + llList2CSV(armorAffected));
                registerArmor(armorAffected);
            }
            else if (action == "unregisterArmor") {
                unregisterArmor();
            }
            
            // Re-enable listener
            hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        debugLog("Link message: " + msg);
        
        // Check armor status
        if (msg == "checkArmor") {
            checkArmor();
        }
        
        // Get armor defense (for combat system)
        else if (msg == "get armor defense") {
            integer defense = calculateArmorDefense();
            llMessageLinked(LINK_SET, defense, "armor defense", "");
        }
        
        // Get armor by body part (for hit location damage reduction)
        else if (llSubStringIndex(msg, "get armor for ") == 0) {
            string part = llGetSubString(msg, 14, -1);  // Extract part name
            integer partIndex = llListFindList(bodyParts, [part]);
            
            if (partIndex != -1) {
                string armorType = llList2String(myArmor, partIndex);
                integer typeIndex = llListFindList(armorTypes, [armorType]);
                integer defense = 0;
                
                if (typeIndex != -1) {
                    defense = llList2Integer(armorValues, typeIndex);
                }
                
                llMessageLinked(LINK_SET, defense, "armor for " + part, armorType);
            }
        }
    }
    
    touch_start(integer num_detected) {
        string touchAction = llGetLinkName(llDetectedLinkNumber(0));
        
        if (touchAction == "rp_armor") {
            // Display armor button clicked
            displayArmor();
        }
    }
}
