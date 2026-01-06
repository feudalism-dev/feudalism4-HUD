// ============================================================================
// Feudalism 4 - Players HUD Data Manager
// ============================================================================
// Manages local data storage (LSD) and sync with Firestore
// Strategy: Local-first for performance, periodic sync for persistence
// ============================================================================

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Data Manager] " + message);
    }
}

// Data keys for LinksetData (LSD)
string KEY_STATS = "stats";
string KEY_HEALTH = "health";
string KEY_STAMINA = "stamina";
string KEY_MANA = "mana";
string KEY_XP = "xp";
string KEY_CLASS = "class";
string KEY_LAST_SYNC = "last_sync";
string KEY_ACTION_SLOTS = "action_slots";

// Sync settings
integer SYNC_INTERVAL = 300;  // Interval for syncing local changes to Firestore (300 seconds)
integer SYNC_ON_CHANGE = TRUE;  // Sync local changes to Firestore immediately

// Prevent duplicate load processing
integer isLoading = FALSE;  // Flag to prevent cascade of load requests
integer lastSyncTime = 0;
integer pendingLocalChanges = FALSE;  // TRUE when local changes need to be synced to Firestore

// Communication - using link_message for Firestore Bridge (same linkset)
integer syncListenHandle;

// =========================== LSD FUNCTIONS ==================================

saveToLSD(string dataKey, string value) {
    llLinksetDataWrite(dataKey, value);
}

string loadFromLSD(string dataKey) {
    return llLinksetDataRead(dataKey);
}

integer deleteFromLSD(string dataKey) {
    return llLinksetDataDelete(dataKey);
}

// Helper function to get universe_id from LSD
string getUniverseId() {
    return llLinksetDataRead("universe_id");
}

// Action slots helpers (LSD-only, no Firestore)
saveActionSlots(string json) {
    saveToLSD(KEY_ACTION_SLOTS, json);
}

string loadActionSlots() {
    return loadFromLSD(KEY_ACTION_SLOTS);
}

// Save stats list to LSD
saveStats(list stats) {
    string statsString = llDumpList2String(stats, ",");
    saveToLSD(KEY_STATS, statsString);
}

// Load stats list from LSD
list loadStats() {
    string statsString = loadFromLSD(KEY_STATS);
    debugLog("loadStats() -> statsString='" + statsString + "' (length: " + (string)llStringLength(statsString) + ")");
    if (statsString == "") {
        debugLog("No stats found in LSD, returning default (all 2s)");
        // Return default stats (all 2s)
        return [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];
    }
    list stats = llCSV2List(statsString);
    debugLog("Parsed stats: " + (string)llGetListLength(stats) + " values: " + llDumpList2String(stats, ","));
    return stats;
}

// Save resource pool to LSD
saveResourcePool(string resourceType, integer current, integer base, integer max) {
    string data = (string)current + "|" + (string)base + "|" + (string)max;
    saveToLSD(resourceType, data);
}

// Load resource pool from LSD
list loadResourcePool(string resourceType) {
    string data = loadFromLSD(resourceType);
    debugLog("loadResourcePool('" + resourceType + "') -> data='" + data + "'");
    if (data == "") {
        debugLog("No data found for " + resourceType + ", returning [0,0,0]");
        return [0, 0, 0];  // Default: empty pool
    }
    list result = llParseString2List(data, ["|"], []);
    if (llGetListLength(result) >= 3) {
        debugLog("Parsed " + resourceType + ": current=" + llList2String(result, 0) + ", base=" + llList2String(result, 1) + ", max=" + llList2String(result, 2));
    } else {
        debugLog("Parsed " + resourceType + ": " + llDumpList2String(result, ",") + " (unexpected format)");
    }
    return result;
}

// =========================== SYNC FUNCTIONS =================================

syncToFirestore() {
    // Sync to Firestore via Firestore Bridge (HTTP-based)
    // The Firestore Bridge will make HTTP requests to the backend
    
    list stats = loadStats();
    list healthData = loadResourcePool(KEY_HEALTH);
    list staminaData = loadResourcePool(KEY_STAMINA);
    list manaData = loadResourcePool(KEY_MANA);
    string xp = loadFromLSD(KEY_XP);
    string class = loadFromLSD(KEY_CLASS);
    
    // Build sync message (format expected by backend)
    string syncData = 
        "stats:" + llDumpList2String(stats, ",") + "|" +
        "health:" + llDumpList2String(healthData, ",") + "|" +
        "stamina:" + llDumpList2String(staminaData, ",") + "|" +
        "mana:" + llDumpList2String(manaData, ",") + "|" +
        "xp:" + xp + "|" +
        "class:" + class;
    
    // Send to Firestore Bridge via link_message
    llMessageLinked(LINK_SET, 0, "firestore_save", syncData);
    
    // Update last sync time
    lastSyncTime = llGetUnixTime();
    saveToLSD(KEY_LAST_SYNC, (string)lastSyncTime);
    
    debugLog("Syncing to Firestore via HTTP bridge");
}

// =========================== MAIN STATE =====================================

// Clean up unused LSD keys from previous versions
cleanupUnusedLSDKeys() {
    // List of keys that should NOT exist (old/unused keys)
    list unusedKeys = [
        "mode",  // KEY_MODE - no longer used
        "moap_base_url",  // From deprecated Firestore Bridge
        "CHARACTER_DATA",  // Old format key if it exists
        "character_json"  // Legacy character JSON storage
    ];
    
    integer i;
    for (i = 0; i < llGetListLength(unusedKeys); i++) {
        string dataKey = llList2String(unusedKeys, i);
        string value = llLinksetDataRead(dataKey);
        if (value != "") {
            llLinksetDataDelete(dataKey);
            debugLog("Cleaned up unused LSD key: " + dataKey);
        }
    }
}

default {
    state_entry() {
        debugLog("===== STATE_ENTRY START =====");
        debugLog("Script is running!");
        debugLog("Initialized");
        
        // Clean up any unused LSD keys from previous versions
        cleanupUnusedLSDKeys();
        
        // Load from LSD (which should have data from previous session or from Firestore sync)
        debugLog("Waiting 1 second before loading...");
        llSleep(1.0);  // Wait for HUD to stabilize
        
        // Load from LSD
        // Only if not already loading (prevents cascade)
        if (!isLoading) {
            isLoading = TRUE;
            debugLog("Loading from LSD...");
            llMessageLinked(LINK_SET, 0, "load stats", "");
            llMessageLinked(LINK_SET, 0, "load health", "");
            llMessageLinked(LINK_SET, 0, "load stamina", "");
            llMessageLinked(LINK_SET, 0, "load mana", "");
            llMessageLinked(LINK_SET, 0, "load xp", "");
            llMessageLinked(LINK_SET, 0, "load class", "");
            debugLog("Load requests sent");
            // Reset flag after loads complete (timer will handle this)
            llSetTimerEvent(2.0);
        }
        
        debugLog("===== STATE_ENTRY COMPLETE =====");
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // HUD attached - data will be loaded from LSD or synced via rp_update
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Debug: Log all incoming messages
        debugLog(">>> Data Manager link_message: msg='" + msg + "' num=" + (string)num);
        
        // write_character_to_lsd handler moved to Data Manager Legacy JSON Parser script
        
        // Handle data update requests from other scripts
        // Also handle messages from Firestore Bridge
        
        // Handle data update requests from other scripts
        
        if (msg == "save stats") {
            // Save stats list (passed as string in id)
            list stats = llCSV2List((string)id);
            saveStats(stats);
            if (SYNC_ON_CHANGE) {
                pendingLocalChanges = TRUE;
                llSetTimerEvent(10.0);  // Sync to Firestore in 10 seconds (debounce)
            }
        }
        else if (msg == "save health") {
            // Save health: num = current, id = "base|max"
            list parts = llParseString2List((string)id, ["|"], []);
            integer base = (integer)llList2String(parts, 0);
            integer max = (integer)llList2String(parts, 1);
            saveResourcePool(KEY_HEALTH, num, base, max);
            if (SYNC_ON_CHANGE) {
                pendingLocalChanges = TRUE;
                llSetTimerEvent(10.0);
            }
        }
        else if (msg == "save stamina") {
            list parts = llParseString2List((string)id, ["|"], []);
            integer base = (integer)llList2String(parts, 0);
            integer max = (integer)llList2String(parts, 1);
            saveResourcePool(KEY_STAMINA, num, base, max);
            if (SYNC_ON_CHANGE) {
                pendingLocalChanges = TRUE;
                llSetTimerEvent(10.0);
            }
        }
        else if (msg == "save mana") {
            list parts = llParseString2List((string)id, ["|"], []);
            integer base = (integer)llList2String(parts, 0);
            integer max = (integer)llList2String(parts, 1);
            saveResourcePool(KEY_MANA, num, base, max);
            if (SYNC_ON_CHANGE) {
                pendingLocalChanges = TRUE;
                llSetTimerEvent(10.0);
            }
        }
        else if (msg == "save xp") {
            saveToLSD(KEY_XP, (string)num);
            if (SYNC_ON_CHANGE) {
                pendingLocalChanges = TRUE;
                llSetTimerEvent(10.0);
            }
        }
        // "load <field>" handlers moved to HUD Character Data Controller script
        // Handle stats field from Firestore Bridge (atomic field get)
        else if (msg == "stats") {
            // Receive mapValue fields JSON from Firestore Bridge
            // Format: {"0":{"integerValue":"2"},"1":{"integerValue":"3"},...}
            string statsMapValue = (string)id;
            
            if (statsMapValue != "" && statsMapValue != JSON_INVALID && statsMapValue != "{}") {
                list statsList = [];
                integer i;
                for (i = 0; i < 20; i++) {
                    string statKey = (string)i;
                    string statField = llJsonGetValue(statsMapValue, [statKey]);
                    if (statField != JSON_INVALID && statField != "") {
                        string intValue = llJsonGetValue(statField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            // Remove quotes if present
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            statsList += [(integer)intValue];
                        } else {
                            statsList += [2]; // Default if missing
                        }
                    } else {
                        statsList += [2]; // Default if missing
                    }
                }
                if (llGetListLength(statsList) > 0) {
                    string statsCSV = llDumpList2String(statsList, ",");
                    llLinksetDataWrite("stats", statsCSV);
                    debugLog("Wrote stats = " + statsCSV);
                    // Send "loaded" message to HUD Controller
                    llMessageLinked(LINK_SET, 0, "stats loaded", statsCSV);
                }
            }
        }
        // Handle health field from Firestore Bridge (atomic field get)
        else if (msg == "health") {
            // Receive mapValue fields JSON from Firestore Bridge
            // Format: {"current":{"integerValue":"100"},"base":{"integerValue":"100"},"max":{"integerValue":"100"}}
            string healthMapValue = (string)id;
            
            if (healthMapValue != "" && healthMapValue != JSON_INVALID && healthMapValue != "{}") {
                integer current = 0;
                integer base = 0;
                integer max = 0;
                
                string currentField = llJsonGetValue(healthMapValue, ["current"]);
                if (currentField != JSON_INVALID && currentField != "") {
                    string intValue = llJsonGetValue(currentField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        current = (integer)intValue;
                    }
                }
                
                string baseField = llJsonGetValue(healthMapValue, ["base"]);
                if (baseField != JSON_INVALID && baseField != "") {
                    string intValue = llJsonGetValue(baseField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        base = (integer)intValue;
                    }
                }
                
                string maxField = llJsonGetValue(healthMapValue, ["max"]);
                if (maxField != JSON_INVALID && maxField != "") {
                    string intValue = llJsonGetValue(maxField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        max = (integer)intValue;
                    }
                }
                
                string healthData = (string)current + "|" + (string)base + "|" + (string)max;
                llLinksetDataWrite("health", healthData);
                debugLog("Wrote health = " + healthData);
                // Send "loaded" message to HUD Controller
                string healthParam = (string)base + "|" + (string)max;
                llMessageLinked(LINK_SET, current, "health loaded", healthParam);
            }
        }
        // Handle stamina field from Firestore Bridge (atomic field get)
        else if (msg == "stamina") {
            // Receive mapValue fields JSON from Firestore Bridge
            // Format: {"current":{"integerValue":"100"},"base":{"integerValue":"100"},"max":{"integerValue":"100"}}
            string staminaMapValue = (string)id;
            
            if (staminaMapValue != "" && staminaMapValue != JSON_INVALID && staminaMapValue != "{}") {
                integer current = 0;
                integer base = 0;
                integer max = 0;
                
                string currentField = llJsonGetValue(staminaMapValue, ["current"]);
                if (currentField != JSON_INVALID && currentField != "") {
                    string intValue = llJsonGetValue(currentField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        current = (integer)intValue;
                    }
                }
                
                string baseField = llJsonGetValue(staminaMapValue, ["base"]);
                if (baseField != JSON_INVALID && baseField != "") {
                    string intValue = llJsonGetValue(baseField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        base = (integer)intValue;
                    }
                }
                
                string maxField = llJsonGetValue(staminaMapValue, ["max"]);
                if (maxField != JSON_INVALID && maxField != "") {
                    string intValue = llJsonGetValue(maxField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        max = (integer)intValue;
                    }
                }
                
                string staminaData = (string)current + "|" + (string)base + "|" + (string)max;
                llLinksetDataWrite("stamina", staminaData);
                debugLog("Wrote stamina = " + staminaData);
                // Send "loaded" message to HUD Controller
                string staminaParam = (string)base + "|" + (string)max;
                llMessageLinked(LINK_SET, current, "stamina loaded", staminaParam);
            }
        }
        // Handle mana field from Firestore Bridge (atomic field get)
        else if (msg == "mana") {
            // Receive mapValue fields JSON from Firestore Bridge
            // Format: {"current":{"integerValue":"50"},"base":{"integerValue":"50"},"max":{"integerValue":"50"}}
            string manaMapValue = (string)id;
            
            if (manaMapValue != "" && manaMapValue != JSON_INVALID && manaMapValue != "{}") {
                integer current = 0;
                integer base = 0;
                integer max = 0;
                
                string currentField = llJsonGetValue(manaMapValue, ["current"]);
                if (currentField != JSON_INVALID && currentField != "") {
                    string intValue = llJsonGetValue(currentField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        current = (integer)intValue;
                    }
                }
                
                string baseField = llJsonGetValue(manaMapValue, ["base"]);
                if (baseField != JSON_INVALID && baseField != "") {
                    string intValue = llJsonGetValue(baseField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        base = (integer)intValue;
                    }
                }
                
                string maxField = llJsonGetValue(manaMapValue, ["max"]);
                if (maxField != JSON_INVALID && maxField != "") {
                    string intValue = llJsonGetValue(maxField, ["integerValue"]);
                    if (intValue != JSON_INVALID && intValue != "") {
                        if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                            intValue = llGetSubString(intValue, 1, -2);
                        }
                        max = (integer)intValue;
                    }
                }
                
                string manaData = (string)current + "|" + (string)base + "|" + (string)max;
                llLinksetDataWrite("mana", manaData);
                debugLog("Wrote mana = " + manaData);
                // Send "loaded" message to HUD Controller
                string manaParam = (string)base + "|" + (string)max;
                llMessageLinked(LINK_SET, current, "mana loaded", manaParam);
            }
        }
        // Handle xp_total field from Firestore Bridge (atomic field get)
        else if (msg == "xp_total") {
            string xpValue = (string)id;
            if (xpValue != "" && xpValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(xpValue) >= 2 && llGetSubString(xpValue, 0, 0) == "\"" && llGetSubString(xpValue, -1, -1) == "\"") {
                    xpValue = llGetSubString(xpValue, 1, -2);
                }
                // Note: We store xp_total in "xp" key (combining with xp_available would require separate handling)
                llLinksetDataWrite("xp", xpValue);
                debugLog("Wrote xp_total = " + xpValue);
                // Send "loaded" message to HUD Controller
                llMessageLinked(LINK_SET, (integer)xpValue, "xp loaded", "");
            }
        }
        // Handle class_id field from Firestore Bridge (atomic field get)
        else if (msg == "class_id") {
            string classValue = (string)id;
            if (classValue != "" && classValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(classValue) >= 2 && llGetSubString(classValue, 0, 0) == "\"" && llGetSubString(classValue, -1, -1) == "\"") {
                    classValue = llGetSubString(classValue, 1, -2);
                }
                // Store as "class" key (not "class_id")
                llLinksetDataWrite("class", classValue);
                debugLog("Wrote class_id = " + classValue);
                // Send "loaded" message to HUD Controller
                llMessageLinked(LINK_SET, 0, "class loaded", classValue);
            }
        }
        // Handle species_id field from Firestore Bridge (atomic field get)
        else if (msg == "species_id") {
            string speciesValue = (string)id;
            if (speciesValue != "" && speciesValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(speciesValue) >= 2 && llGetSubString(speciesValue, 0, 0) == "\"" && llGetSubString(speciesValue, -1, -1) == "\"") {
                    speciesValue = llGetSubString(speciesValue, 1, -2);
                }
                llLinksetDataWrite("species_id", speciesValue);
                debugLog("Wrote species_id = " + speciesValue);
            }
        }
        // Handle has_mana field from Firestore Bridge (atomic field get)
        else if (msg == "has_mana") {
            string hasManaValue = (string)id;
            if (hasManaValue != "" && hasManaValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(hasManaValue) >= 2 && llGetSubString(hasManaValue, 0, 0) == "\"" && llGetSubString(hasManaValue, -1, -1) == "\"") {
                    hasManaValue = llGetSubString(hasManaValue, 1, -2);
                }
                llLinksetDataWrite("has_mana", hasManaValue);
                debugLog("Wrote has_mana = " + hasManaValue);
            }
        }
        // Handle gender field from Firestore Bridge (atomic field get)
        else if (msg == "gender") {
            string genderValue = (string)id;
            if (genderValue != "" && genderValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(genderValue) >= 2 && llGetSubString(genderValue, 0, 0) == "\"" && llGetSubString(genderValue, -1, -1) == "\"") {
                    genderValue = llGetSubString(genderValue, 1, -2);
                }
                llLinksetDataWrite("gender", genderValue);
                debugLog("Wrote gender = " + genderValue);
            }
        }
        // Handle species_factors field from Firestore Bridge (atomic field get)
        else if (msg == "species_factors") {
            // Receive mapValue fields JSON from Firestore Bridge
            // Format: {"health_factor":{"integerValue":"25"},"stamina_factor":{"integerValue":"25"},"mana_factor":{"integerValue":"25"}}
            string factorsMapValue = (string)id;
            
            if (factorsMapValue != "" && factorsMapValue != JSON_INVALID && factorsMapValue != "{}") {
                list factorNames = ["health_factor", "stamina_factor", "mana_factor"];
                integer i;
                integer len = llGetListLength(factorNames);
                
                for (i = 0; i < len; i++) {
                    string factorName = llList2String(factorNames, i);
                    string factorField = llJsonGetValue(factorsMapValue, [factorName]);
                    
                    if (factorField != JSON_INVALID && factorField != "") {
                        string intValue = llJsonGetValue(factorField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            // Remove quotes if present
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            // Write individual LSD key
                            llLinksetDataWrite(factorName, intValue);
                            debugLog("Wrote " + factorName + " = " + intValue);
                        }
                    }
                }
            }
        }
        // Handle currency field from Firestore Bridge (atomic field get)
        else if (msg == "currency") {
            string currencyValue = (string)id;
            if (currencyValue != "" && currencyValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(currencyValue) >= 2 && llGetSubString(currencyValue, 0, 0) == "\"" && llGetSubString(currencyValue, -1, -1) == "\"") {
                    currencyValue = llGetSubString(currencyValue, 1, -2);
                }
                llLinksetDataWrite("currency", currencyValue);
                debugLog("Wrote currency = " + currencyValue);
            }
        }
        // Handle mode field from Firestore Bridge (atomic field get)
        else if (msg == "mode") {
            string modeValue = (string)id;
            if (modeValue != "" && modeValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(modeValue) >= 2 && llGetSubString(modeValue, 0, 0) == "\"" && llGetSubString(modeValue, -1, -1) == "\"") {
                    modeValue = llGetSubString(modeValue, 1, -2);
                }
                llLinksetDataWrite("mode", modeValue);
                debugLog("Wrote mode = " + modeValue);
            }
        }
        // Handle universe_id field from Firestore Bridge (atomic field get)
        else if (msg == "universe_id") {
            string universeValue = (string)id;
            if (universeValue != "" && universeValue != JSON_INVALID) {
                // Remove quotes if present
                if (llStringLength(universeValue) >= 2 && llGetSubString(universeValue, 0, 0) == "\"" && llGetSubString(universeValue, -1, -1) == "\"") {
                    universeValue = llGetSubString(universeValue, 1, -2);
                }
                llLinksetDataWrite("universe_id", universeValue);
                debugLog("Wrote universe_id = " + universeValue);
            }
        }
        // Handle inventory field from Firestore Bridge (v2: DEPRECATED - inventory now uses subcollection)
        // This handler is kept for backward compatibility but no longer stores inventory in LSD
        // Inventory is now paginated and fetched directly from Firestore subcollection
        // The "inventory loaded" message is still sent to trigger HUD inventory refresh
        else if (msg == "inventory") {
            // v2: Inventory is no longer stored in LSD (it's paginated from subcollection)
            // Just send "inventory loaded" message to trigger HUD to request inventoryPage
            debugLog("Inventory field received (v2: not storing in LSD, inventory is paginated)");
            llMessageLinked(LINK_SET, 0, "inventory loaded", "");
        }
        else if (msg == "force sync") {
            syncToFirestore();
        }
        // Sync to Firestore request - this shouldn't happen anymore
        // Data Manager now sends directly to Firestore Bridge via region say
        else if (msg == "sync to firestore") {
            debugLog("WARNING: Received sync request via link_message - this should go through Firestore Bridge");
            return;
        }
    }
    
    timer() {
        // Reset loading flag if it was set (debounce mechanism)
        if (isLoading) {
            isLoading = FALSE;
            // Continue with normal timer logic
        }
        
        // Check if there are pending local changes to sync TO Firestore
        if (pendingLocalChanges) {
            // Sync local changes to Firestore
            syncToFirestore();
            pendingLocalChanges = FALSE;
            // Reset timer for next sync check
            llSetTimerEvent(SYNC_INTERVAL);
        }
        // No periodic pull from Firestore - data arrives via "write_character_to_lsd" message
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

