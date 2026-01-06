// ============================================================================
// Feudalism 4 - HUD Stats Handler
// ============================================================================
// Handles all stats, resources, XP, and currency display logic
// ============================================================================

// =========================== CONFIGURATION ==================================
// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[HUD] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Firestore Bridge responses

// =========================== STATE VARIABLES ================================
// Character data (Players HUD)
string myName;
list myStats;
integer myXP;
integer currentHealth;
integer currentStamina;
integer currentMana;
integer baseHealth;
integer baseStamina;
integer baseMana;
string myClass;
string actionSlotsJson = "";  // Action slots (LSD-only, no Firestore)
integer characterLoaded = FALSE;
integer resourcesInitialized = FALSE;  // Prevent duplicate resource initialization
integer loadRequestsSent = FALSE;  // Prevent duplicate load requests

// Species factors (stored from character data)
integer healthFactor = 25;
integer staminaFactor = 25;
integer manaFactor = 25;
integer hasMana = TRUE;  // Default to TRUE, will be set from character data

// Game mode
string mode = "roleplay";
integer isResting = FALSE;
integer isPassedOut = FALSE;
integer timerCount = 0;

// Currency cache (for display)
integer currencyGold = 0;
integer currencySilver = 0;
integer currencyCopper = 0;

// Stat indices
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

// =========================== UTILITY FUNCTIONS ==============================

// Find link number by name
integer getLinkNumberByName(string linkName) {
    integer i = 0;
    while (i <= llGetNumberOfPrims()) {
        if (llGetLinkName(i) == linkName)
            return i;
        i++;
    }
    return -1;
}

// Set prim text
setPrimText(string primName, string value) {
    integer linkNum = getLinkNumberByName(primName);
    if (linkNum != -1) {
        llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, value, <1.000, 0.863, 0.000>, 0.8]);
    }
}

// Calculate resource pools from stats
calculateHealth() {
    // F4: Health = (Agility + Athletics) * health_factor
    baseHealth = (llList2Integer(myStats, AGILITY) + 
                  llList2Integer(myStats, ATHLETICS)) * healthFactor;
    if (currentHealth > baseHealth) currentHealth = baseHealth;
    if (currentHealth < 0) currentHealth = 0;
}

calculateStamina() {
    // F4: Stamina = (Endurance + Will) * stamina_factor
    baseStamina = (llList2Integer(myStats, ENDURANCE) + 
                   llList2Integer(myStats, WILL)) * staminaFactor;
    if (currentStamina > baseStamina) currentStamina = baseStamina;
    if (currentStamina < 0) currentStamina = 0;
}

calculateMana() {
    // F4: Mana = (Wisdom + Intelligence) * mana_factor (only if has_mana)
    if (!hasMana) {
        baseMana = 0;
        currentMana = 0;
        return;
    }
    // Only calculate if we have stats
    if (llGetListLength(myStats) != 20) {
        return;
    }
    integer newBaseMana = (llList2Integer(myStats, WISDOM) + 
                           llList2Integer(myStats, INTELLIGENCE)) * manaFactor;
    // Only update if we don't already have a valid baseMana from LSD
    // This prevents overwriting loaded values
    if (baseMana == 0 || newBaseMana > baseMana) {
        baseMana = newBaseMana;
    }
    if (currentMana > baseMana) currentMana = baseMana;
    if (currentMana < 0) currentMana = 0;
}

// Update resource displays (Players HUD)
updateResourceDisplays() {
    llMessageLinked(LINK_SET, currentHealth, "set health display", (string)baseHealth);
    llMessageLinked(LINK_SET, currentStamina, "set stamina display", (string)baseStamina);
    llMessageLinked(LINK_SET, currentMana, "set mana display", (string)baseMana);
    llMessageLinked(LINK_SET, myXP, "set xp display", "");
}

// Send notification
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Show coins function
showCoins() {
    string msg = "You have " + (string)currencyGold + " gold, "
                           + (string)currencySilver + " silver and "
                           + (string)currencyCopper + " copper.";
    llRegionSayTo(llGetOwner(), 0, msg);
}

// Announce to local chat
announce(string message) {
    llSay(0, message);
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Load species factors and has_mana from LSD FIRST (before processing stats)
        // This ensures calculateMana() has the correct hasMana value and prevents blinking
        string healthFactorStr = llLinksetDataRead("health_factor");
        string staminaFactorStr = llLinksetDataRead("stamina_factor");
        string manaFactorStr = llLinksetDataRead("mana_factor");
        string hasManaStr = llLinksetDataRead("has_mana");
        
        if (healthFactorStr != "") {
            healthFactor = (integer)healthFactorStr;
        }
        if (staminaFactorStr != "") {
            staminaFactor = (integer)staminaFactorStr;
        }
        if (manaFactorStr != "") {
            manaFactor = (integer)manaFactorStr;
        }
        if (hasManaStr != "") {
            hasMana = (integer)hasManaStr;
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Show coins command from HUD_Main
        if (num == 2002) {
            if (msg == "SHOW_COINS") {
                showCoins();
            }
            return;
        }
        
        // HUD_CHANNEL commands from HUD_Core (damage, heal, fGivePay)
        if (num == 1004) {
            list parts = llParseString2List(msg, [","], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "damage") {
                integer damage = (integer)llList2String(parts, 1);
                currentHealth -= damage;
                if (currentHealth < 0) currentHealth = 0;
                calculateHealth();
                updateResourceDisplays();
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            }
            else if (cmd == "heal") {
                integer heal = (integer)llList2String(parts, 1);
                currentHealth += heal;
                calculateHealth();
                updateResourceDisplays();
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            }
            // Handle fGivePay command from world objects
            else if (cmd == "fGivePay") {
                if (llGetListLength(parts) >= 4) {
                    integer gold = (integer)llList2String(parts, 1);
                    integer silver = (integer)llList2String(parts, 2);
                    integer copper = (integer)llList2String(parts, 3);
                    
                    // Add to currency cache
                    currencyGold = currencyGold + gold;
                    currencySilver = currencySilver + silver;
                    currencyCopper = currencyCopper + copper;
                    
                    // Get character ID from LSD
                    string characterId = llLinksetDataRead("characterId");
                    if (characterId != "" && characterId != "JSON_INVALID") {
                        // Send Bridge command to update currency
                        llMessageLinked(LINK_SET, 0, "UPDATE_CURRENCY|" + characterId + "|" + (string)gold + "|" + (string)silver + "|" + (string)copper, "");
                    }
                    
                    // Show message to player
                    string msg = "You received " + (string)gold + " gold, " + (string)silver + " silver and " + (string)copper + " copper.";
                    llRegionSayTo(llGetOwner(), 0, msg);
                }
            }
            return;
        }
        
        // Players HUD internal commands from HUD_Core
        if (num == 1003) {
            // Paste the original PLAYERS_HUD_CHANNEL logic here
            // (Currently empty in original, reserved for future use)
            return;
        }
        
        // Bridge responses NOT related to paychest
        if (num == FS_BRIDGE_CHANNEL) {
            // Handle CURRENCY_UPDATED response (not a paychest transaction)
            if (llSubStringIndex(msg, "CURRENCY_UPDATED") == 0) {
                debugLog("Currency updated successfully");
                return;
            }
            return;
        }
        
        // Character data loaded from Firestore (via Data Manager)
        if (msg == "character loaded from firestore") {
            debugLog("Character data received from Firestore");
            
            // Load species factors and has_mana from LSD (set by Data Manager)
            string healthFactorStr = llLinksetDataRead("health_factor");
            string staminaFactorStr = llLinksetDataRead("stamina_factor");
            string manaFactorStr = llLinksetDataRead("mana_factor");
            string hasManaStr = llLinksetDataRead("has_mana");
            
            if (healthFactorStr != "") {
                healthFactor = (integer)healthFactorStr;
                debugLog("Health factor: " + (string)healthFactor);
            }
            if (staminaFactorStr != "") {
                staminaFactor = (integer)staminaFactorStr;
                debugLog("Stamina factor: " + (string)staminaFactor);
            }
            if (manaFactorStr != "") {
                manaFactor = (integer)manaFactorStr;
                debugLog("Mana factor: " + (string)manaFactor);
            }
            if (hasManaStr != "") {
                hasMana = (integer)hasManaStr;
                debugLog("Has mana: " + (string)hasMana);
            }
            
            llMessageLinked(LINK_SET, 0, "load stats", "");
            llMessageLinked(LINK_SET, 0, "load health", "");
            llMessageLinked(LINK_SET, 0, "load stamina", "");
            llMessageLinked(LINK_SET, 0, "load mana", "");
            llMessageLinked(LINK_SET, 0, "load xp", "");
            llMessageLinked(LINK_SET, 0, "load class", "");
            llMessageLinked(LINK_SET, 0, "load action_slots", "");
        }
        // Stats loaded
        else if (msg == "stats loaded") {
            myStats = llCSV2List((string)id);
            if (llGetListLength(myStats) == 20) {
                // Only calculate if not already initialized
                if (!resourcesInitialized) {
                    calculateHealth();
                    calculateStamina();
                    calculateMana();
                }
                updateResourceDisplays();
            } else {
                debugLog("WARNING: Expected 20 stats but got " + (string)llGetListLength(myStats));
            }
        }
        // Health loaded
        else if (msg == "health loaded") {
            // Only update current if loaded value is > 0 (preserve existing value if already set)
            if (num > 0) currentHealth = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseHealth = (integer)llList2String(parts, 0);
                integer maxHealth = (integer)llList2String(parts, 1);
                if (maxHealth > 0) baseHealth = maxHealth;
            }
            // Only initialize if not already initialized and we have stats
            if (!resourcesInitialized && baseHealth == 0 && llGetListLength(myStats) == 20) {
                calculateHealth();
                // If current is 0 and we just calculated base, set current to base (full health)
                if (currentHealth == 0) {
                    currentHealth = baseHealth;
                    // Save immediately so it doesn't get overwritten
                    llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
                }
            }
            updateResourceDisplays();
        }
        // Stamina loaded
        else if (msg == "stamina loaded") {
            // Only update current if loaded value is > 0 (preserve existing value if already set)
            if (num > 0) currentStamina = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseStamina = (integer)llList2String(parts, 0);
                integer maxStamina = (integer)llList2String(parts, 1);
                if (maxStamina > 0) baseStamina = maxStamina;
            }
            // Only initialize if not already initialized and we have stats
            if (!resourcesInitialized && baseStamina == 0 && llGetListLength(myStats) == 20) {
                calculateStamina();
                // If current is 0 and we just calculated base, set current to base (full stamina)
                if (currentStamina == 0) {
                    currentStamina = baseStamina;
                    // Save immediately so it doesn't get overwritten
                    llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
                }
            }
            updateResourceDisplays();
        }
        // Mana loaded
        else if (msg == "mana loaded") {
            // Only update current if loaded value is > 0 (preserve existing value if already set)
            if (num > 0) currentMana = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                integer loadedBase = (integer)llList2String(parts, 0);
                integer maxMana = (integer)llList2String(parts, 1);
                if (maxMana > 0) {
                    baseMana = maxMana;
                } else if (loadedBase > 0) {
                    baseMana = loadedBase;
                }
            }
            // Only initialize if not already initialized, we have stats, AND we don't have a valid loaded value
            // This prevents recalculating when we already have data from LSD
            if (!resourcesInitialized && baseMana == 0 && llGetListLength(myStats) == 20) {
                // Make sure hasMana is loaded before calculating
                if (hasMana) {
                    calculateMana();
                    // If current is 0 and we just calculated base, set current to base (full mana)
                    if (currentMana == 0) {
                        currentMana = baseMana;
                        // Save immediately so it doesn't get overwritten
                        llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
                    }
                } else {
                    // No mana for this character
                    baseMana = 0;
                    currentMana = 0;
                }
            }
            // Mark as initialized once all three resources have been processed
            if (baseHealth > 0 && baseStamina > 0 && (baseMana > 0 || !hasMana)) {
                resourcesInitialized = TRUE;
            }
            updateResourceDisplays();
        }
        // XP loaded
        else if (msg == "xp loaded") {
            myXP = num;
            updateResourceDisplays();
        }
        // Class loaded
        else if (msg == "class loaded") {
            myClass = (string)id;
            if (myClass != "") {
                setPrimText("rp_class", myClass);
            }
        }
        else if (msg == "action_slots loaded") {
            actionSlotsJson = (string)id;
            debugLog("Action slots loaded (length: " + (string)llStringLength(actionSlotsJson) + ")");
            // Forward to action bar script if needed:
            // llMessageLinked(LINK_SET, 0, "apply_action_slots", (key)actionSlotsJson);
        }
        // Currency loaded from Firestore
        else if (msg == "currency") {
            // Parse currency from Firestore fields structure
            // Bridge_Characters.extractFirestoreValue returns mapFields for mapValue
            // Format: {"gold":{"integerValue":"0"},"silver":{"integerValue":"0"},"copper":{"integerValue":"0"}}
            string mapFields = (string)id;
            if (mapFields != "" && mapFields != "JSON_INVALID") {
                string goldField = llJsonGetValue(mapFields, ["gold"]);
                string silverField = llJsonGetValue(mapFields, ["silver"]);
                string copperField = llJsonGetValue(mapFields, ["copper"]);
                
                if (goldField != JSON_INVALID && goldField != "") {
                    string goldStr = llJsonGetValue(goldField, ["integerValue"]);
                    if (goldStr != "") currencyGold = (integer)goldStr;
                }
                if (silverField != JSON_INVALID && silverField != "") {
                    string silverStr = llJsonGetValue(silverField, ["integerValue"]);
                    if (silverStr != "") currencySilver = (integer)silverStr;
                }
                if (copperField != JSON_INVALID && copperField != "") {
                    string copperStr = llJsonGetValue(copperField, ["integerValue"]);
                    if (copperStr != "") currencyCopper = (integer)copperStr;
                }
                debugLog("Currency loaded: " + (string)currencyGold + " gold, " + (string)currencySilver + " silver, " + (string)currencyCopper + " copper");
            }
        }
        else if (msg == "update_action_slots") {
            string newSlotsJson = (string)id;
            actionSlotsJson = newSlotsJson;
            llMessageLinked(LINK_SET, 0, "save action_slots", (key)newSlotsJson);
            debugLog("Action slots updated (length: " + (string)llStringLength(newSlotsJson) + ")");
        }
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
    }
}

