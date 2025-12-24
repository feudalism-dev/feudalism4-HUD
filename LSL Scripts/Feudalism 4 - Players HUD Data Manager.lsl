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

// Sync settings
integer SYNC_INTERVAL = 300;  // Pull from Firestore every 5 minutes (300 seconds)
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

// Save stats list to LSD
saveStats(list stats) {
    string statsString = llDumpList2String(stats, ",");
    saveToLSD(KEY_STATS, statsString);
}

// Load stats list from LSD
list loadStats() {
    string statsString = loadFromLSD(KEY_STATS);
    llOwnerSay("loadStats() -> statsString='" + statsString + "' (length: " + (string)llStringLength(statsString) + ")");
    if (statsString == "") {
        llOwnerSay("No stats found in LSD, returning default (all 2s)");
        // Return default stats (all 2s)
        return [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];
    }
    list stats = llCSV2List(statsString);
    llOwnerSay("Parsed stats: " + (string)llGetListLength(stats) + " values: " + llDumpList2String(stats, ","));
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
    llOwnerSay("loadResourcePool('" + resourceType + "') -> data='" + data + "'");
    if (data == "") {
        llOwnerSay("No data found for " + resourceType + ", returning [0,0,0]");
        return [0, 0, 0];  // Default: empty pool
    }
    list result = llParseString2List(data, ["|"], []);
    if (llGetListLength(result) >= 3) {
        llOwnerSay("Parsed " + resourceType + ": current=" + llList2String(result, 0) + ", base=" + llList2String(result, 1) + ", max=" + llList2String(result, 2));
    } else {
        llOwnerSay("Parsed " + resourceType + ": " + llDumpList2String(result, ",") + " (unexpected format)");
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
    
    llOwnerSay("[Data Manager] Syncing to Firestore via HTTP bridge");
}

loadFromFirestore() {
    llOwnerSay("[Data Manager] Requesting character data from Firestore via HTTP bridge...");
    // Request each field individually using field masks (exactly like standalone script)
    // Each request gets only ONE field, so responses are small and won't truncate
    llMessageLinked(LINK_SET, 0, "getClass", "");
    llMessageLinked(LINK_SET, 0, "getStats", "");
    llMessageLinked(LINK_SET, 0, "getHealth", "");
    llMessageLinked(LINK_SET, 0, "getStamina", "");
    llMessageLinked(LINK_SET, 0, "getMana", "");
    llMessageLinked(LINK_SET, 0, "getXP", "");
    llMessageLinked(LINK_SET, 0, "getGender", "");
    llMessageLinked(LINK_SET, 0, "getSpecies", "");
    llMessageLinked(LINK_SET, 0, "getHasMana", "");
    llMessageLinked(LINK_SET, 0, "getSpeciesFactors", "");
}

// =========================== MAIN STATE =====================================

// Clean up unused LSD keys from previous versions
cleanupUnusedLSDKeys() {
    // List of keys that should NOT exist (old/unused keys)
    list unusedKeys = [
        "mode",  // KEY_MODE - no longer used
        "moap_base_url",  // From deprecated Firestore Bridge
        "CHARACTER_DATA"  // Old format key if it exists
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
        llOwnerSay("[Data Manager] Initialized");
        
        // Clean up any unused LSD keys from previous versions
        cleanupUnusedLSDKeys();
        
        // FIRST: Fetch from Firestore, then write to LSD, then load from LSD
        // This ensures we have the latest data from Firebase
        debugLog("Waiting 1 second before loading...");
        llSleep(1.0);  // Wait for HUD to stabilize
        
        // Fetch from Firestore FIRST (if backend is configured)
        llOwnerSay("[Data Manager] Fetching from Firestore FIRST...");
        loadFromFirestore();
        
        // Wait for Firestore data to arrive and be saved to LSD
        // Then load from LSD (which now has the Firestore data)
        llSleep(2.0);  // Give Firestore time to respond
        
        // Now load from LSD (which should have Firestore data if available, or old data if not)
        // Individual field responses from Firestore Bridge will arrive asynchronously and trigger their own load messages
        // Only if not already loading (prevents cascade)
        if (!isLoading) {
            isLoading = TRUE;
            llOwnerSay("[Data Manager] Loading from LSD (after Firestore fetch)...");
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
        
        // Set up periodic sync (this will also pull from Firestore periodically)
        debugLog("Setting up periodic timer (interval: " + (string)SYNC_INTERVAL + " seconds)");
        llSetTimerEvent(SYNC_INTERVAL);
        debugLog("===== STATE_ENTRY COMPLETE =====");
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // Pull from Firestore when HUD is attached to ensure we have latest data
            llSleep(2.0);  // Wait for HUD to stabilize
            loadFromFirestore();
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Debug: Log all incoming messages
        llOwnerSay(">>> Data Manager link_message: msg='" + msg + "' num=" + (string)num);
        
        // Handle data update requests from other scripts
        // Also handle messages from Firestore Bridge
        
        // Character data from Firestore Bridge or MOAP (now in JSON format)
        // Handle individual field responses from Firestore Bridge
        if (msg == "class_id") {
            string classId = (string)id;
            llOwnerSay("[Data Manager] Received class_id from Firestore: '" + classId + "'");
            if (classId != "" && classId != "JSON_INVALID") {
                saveToLSD(KEY_CLASS, classId);
                llOwnerSay("[Data Manager] ✓ Saved class_id to LSD: '" + classId + "'");
                // Trigger load message so UI updates
                llMessageLinked(LINK_SET, 0, "load class", "");
            } else {
                llOwnerSay("[Data Manager] ✗ WARNING: class_id is empty or invalid!");
            }
            return;
        }
        else if (msg == "stats") {
            // Stats is a mapValue (JSON object), parse it
            string statsJson = (string)id;
            llOwnerSay("[Data Manager] Received stats from Firestore (length: " + (string)llStringLength(statsJson) + ")");
            if (statsJson != "" && statsJson != "JSON_INVALID") {
                // Parse stats from Firestore mapValue format
                // Format should be: {"0":{"integerValue":"2"},"1":{"integerValue":"2"},...}
                list statsList = [];
                integer i;
                for (i = 0; i < 20; i++) {
                    string statKey = (string)i;
                    string statField = llJsonGetValue(statsJson, [statKey]);
                    if (statField != JSON_INVALID && statField != "") {
                        string intVal = llJsonGetValue(statField, ["integerValue"]);
                        if (intVal != JSON_INVALID && intVal != "") {
                            statsList += [(integer)intVal];
                        } else {
                            statsList += [2];  // Default
                        }
                    } else {
                        statsList += [2];  // Default
                    }
                }
                saveStats(statsList);
                llOwnerSay("[Data Manager] ✓ Saved stats to LSD");
                // Trigger load message so UI updates
                llMessageLinked(LINK_SET, 0, "load stats", "");
            }
            return;
        }
        else if (msg == "health") {
            string healthJson = (string)id;
            llOwnerSay("[Data Manager] Received health from Firestore (length: " + (string)llStringLength(healthJson) + ")");
            if (healthJson != "" && healthJson != "JSON_INVALID") {
                // healthJson is already the fields object from mapValue (e.g., {"current":{"integerValue":"100"},"base":{"integerValue":"100"},"max":{"integerValue":"100"}})
                string currentField = llJsonGetValue(healthJson, ["current"]);
                string baseField = llJsonGetValue(healthJson, ["base"]);
                string maxField = llJsonGetValue(healthJson, ["max"]);
                if (currentField != JSON_INVALID && baseField != JSON_INVALID && maxField != JSON_INVALID) {
                    string current = llJsonGetValue(currentField, ["integerValue"]);
                    string base = llJsonGetValue(baseField, ["integerValue"]);
                    string max = llJsonGetValue(maxField, ["integerValue"]);
                    if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
                        saveResourcePool(KEY_HEALTH, (integer)current, (integer)base, (integer)max);
                        llOwnerSay("[Data Manager] ✓ Saved health to LSD: " + current + "/" + base + "/" + max);
                        // Trigger load message so UI updates
                        llMessageLinked(LINK_SET, 0, "load health", "");
                    }
                }
            }
            return;
        }
        else if (msg == "stamina") {
            string staminaJson = (string)id;
            llOwnerSay("[Data Manager] Received stamina from Firestore (length: " + (string)llStringLength(staminaJson) + ")");
            if (staminaJson != "" && staminaJson != "JSON_INVALID") {
                string currentField = llJsonGetValue(staminaJson, ["current"]);
                string baseField = llJsonGetValue(staminaJson, ["base"]);
                string maxField = llJsonGetValue(staminaJson, ["max"]);
                if (currentField != JSON_INVALID && baseField != JSON_INVALID && maxField != JSON_INVALID) {
                    string current = llJsonGetValue(currentField, ["integerValue"]);
                    string base = llJsonGetValue(baseField, ["integerValue"]);
                    string max = llJsonGetValue(maxField, ["integerValue"]);
                    if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
                        saveResourcePool(KEY_STAMINA, (integer)current, (integer)base, (integer)max);
                        llOwnerSay("[Data Manager] ✓ Saved stamina to LSD: " + current + "/" + base + "/" + max);
                        // Trigger load message so UI updates
                        llMessageLinked(LINK_SET, 0, "load stamina", "");
                    }
                }
            }
            return;
        }
        else if (msg == "mana") {
            string manaJson = (string)id;
            llOwnerSay("[Data Manager] Received mana from Firestore (length: " + (string)llStringLength(manaJson) + ")");
            if (manaJson != "" && manaJson != "JSON_INVALID") {
                string currentField = llJsonGetValue(manaJson, ["current"]);
                string baseField = llJsonGetValue(manaJson, ["base"]);
                string maxField = llJsonGetValue(manaJson, ["max"]);
                if (currentField != JSON_INVALID && baseField != JSON_INVALID && maxField != JSON_INVALID) {
                    string current = llJsonGetValue(currentField, ["integerValue"]);
                    string base = llJsonGetValue(baseField, ["integerValue"]);
                    string max = llJsonGetValue(maxField, ["integerValue"]);
                    if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
                        saveResourcePool(KEY_MANA, (integer)current, (integer)base, (integer)max);
                        llOwnerSay("[Data Manager] ✓ Saved mana to LSD: " + current + "/" + base + "/" + max);
                        // Trigger load message so UI updates
                        llMessageLinked(LINK_SET, 0, "load mana", "");
                    }
                }
            }
            return;
        }
        else if (msg == "xp_total") {
            string xpTotal = (string)id;
            llOwnerSay("[Data Manager] Received xp_total from Firestore: '" + xpTotal + "'");
            if (xpTotal != "" && xpTotal != "JSON_INVALID") {
                saveToLSD(KEY_XP, xpTotal);
                llOwnerSay("[Data Manager] ✓ Saved xp_total to LSD: " + xpTotal);
                // Trigger load message so UI updates
                llMessageLinked(LINK_SET, 0, "load xp", "");
            }
            return;
        }
        else if (msg == "gender") {
            string gender = (string)id;
            llOwnerSay("[Data Manager] Received gender from Firestore: '" + gender + "'");
            if (gender != "" && gender != "JSON_INVALID") {
                saveToLSD("gender", gender);
                llOwnerSay("[Data Manager] ✓ Saved gender to LSD: " + gender);
            }
            return;
        }
        else if (msg == "species_id") {
            string speciesId = (string)id;
            llOwnerSay("[Data Manager] Received species_id from Firestore: '" + speciesId + "'");
            if (speciesId != "" && speciesId != "JSON_INVALID") {
                saveToLSD("species_id", speciesId);
                llOwnerSay("[Data Manager] ✓ Saved species_id to LSD: " + speciesId);
            }
            return;
        }
        else if (msg == "has_mana") {
            string hasMana = (string)id;
            llOwnerSay("[Data Manager] Received has_mana from Firestore: '" + hasMana + "'");
            if (hasMana != "" && hasMana != "JSON_INVALID") {
                saveToLSD("has_mana", hasMana);
                llOwnerSay("[Data Manager] ✓ Saved has_mana to LSD: " + hasMana);
            }
            return;
        }
        else if (msg == "species_factors") {
            string factorsJson = (string)id;
            llOwnerSay("[Data Manager] Received species_factors from Firestore (length: " + (string)llStringLength(factorsJson) + ")");
            if (factorsJson != "" && factorsJson != "JSON_INVALID") {
                // factorsJson is the fields object from mapValue
                string healthFactorField = llJsonGetValue(factorsJson, ["health_factor"]);
                string staminaFactorField = llJsonGetValue(factorsJson, ["stamina_factor"]);
                string manaFactorField = llJsonGetValue(factorsJson, ["mana_factor"]);
                if (healthFactorField != JSON_INVALID) {
                    string healthFactor = llJsonGetValue(healthFactorField, ["doubleValue"]);
                    if (healthFactor != JSON_INVALID) {
                        saveToLSD("health_factor", healthFactor);
                    }
                }
                if (staminaFactorField != JSON_INVALID) {
                    string staminaFactor = llJsonGetValue(staminaFactorField, ["doubleValue"]);
                    if (staminaFactor != JSON_INVALID) {
                        saveToLSD("stamina_factor", staminaFactor);
                    }
                }
                if (manaFactorField != JSON_INVALID) {
                    string manaFactor = llJsonGetValue(manaFactorField, ["doubleValue"]);
                    if (manaFactor != JSON_INVALID) {
                        saveToLSD("mana_factor", manaFactor);
                    }
                }
                llOwnerSay("[Data Manager] ✓ Saved species_factors to LSD");
            }
            return;
        }
        // Handle error responses
        else if (llSubStringIndex(msg, "_ERROR") != -1) {
            llOwnerSay("[Data Manager] ERROR: Firestore field request failed for '" + msg + "': " + (string)id);
            return;
        }
        
        // CHARACTER_DATA handler - kept for backward compatibility with MOAP Setup HUD only
        // The main HUD now uses individual field-level requests via Firestore Bridge
        if (msg == "CHARACTER_DATA") {
            llOwnerSay("[Data Manager] CHARACTER_DATA received (from MOAP Setup HUD - legacy format)");
            // Parse and save character data received from MOAP Setup HUD
            // Format: JSON object {"class_id":"squire","stats":{...},"health":{...},...}
            string jsonData = (string)id;
            
            // Check if it's JSON (starts with {) or old pipe-delimited format (starts with CHARACTER_DATA|)
            if (llGetSubString(jsonData, 0, 0) == "{") {
                // New JSON format - parse using llJsonGetValue
                llOwnerSay("Parsing as JSON format");
                
                // Extract class_id
                string classId = llJsonGetValue(jsonData, ["class_id"]);
                llOwnerSay("Raw class_id from JSON: '" + classId + "' (type check: " + (string)(classId == JSON_INVALID) + ")");
                if (classId != "" && classId != JSON_INVALID) {
                    // Remove quotes if present (llJsonGetValue may return quoted strings)
                    classId = llStringTrim(classId, STRING_TRIM);
                    if (llGetSubString(classId, 0, 0) == "\"") {
                        classId = llGetSubString(classId, 1, -2);
                    }
                    if (classId != "") {
                        saveToLSD(KEY_CLASS, classId);
                        llOwnerSay("✓ Saved class from JSON: '" + classId + "' (length: " + (string)llStringLength(classId) + ")");
                    } else {
                        llOwnerSay("✗ WARNING: class_id is empty after parsing!");
                    }
                } else {
                    llOwnerSay("✗ WARNING: class_id is empty or invalid in JSON! (classId='" + classId + "', JSON_INVALID=" + (string)(classId == JSON_INVALID) + ")");
                }
                
                // Extract stats - parse stats object
                string statsJson = llJsonGetValue(jsonData, ["stats"]);
                string statsPreview = llGetSubString(statsJson, 0, 199);
                if (llStringLength(statsJson) > 200) {
                    statsPreview += "...";
                }
                llOwnerSay("Raw stats JSON: " + statsPreview);
                if (statsJson != JSON_INVALID && statsJson != "") {
                    // Parse stats object - extract each stat value
                    // Stats order: agility, animal_handling, athletics, awareness, crafting, deception, endurance, entertaining, fighting, healing, influence, intelligence, knowledge, marksmanship, persuasion, stealth, survival, thievery, will, wisdom
                    list statNames = ["agility", "animal_handling", "athletics", "awareness", "crafting", "deception", "endurance", "entertaining", "fighting", "healing", "influence", "intelligence", "knowledge", "marksmanship", "persuasion", "stealth", "survival", "thievery", "will", "wisdom"];
                    list statValues = [];
                    string statsDebug = "Stats parsed: ";
                    integer i;
                    for (i = 0; i < llGetListLength(statNames); i++) {
                        string statName = llList2String(statNames, i);
                        string statValue = llJsonGetValue(statsJson, [statName]);
                        if (statValue != JSON_INVALID && statValue != "") {
                            statValue = llStringTrim(statValue, STRING_TRIM);
                            integer statInt = (integer)statValue;
                            statValues += [statInt];
                            statsDebug += statName + "=" + (string)statInt + " ";
                        } else {
                            statValues += [2]; // Default
                            statsDebug += statName + "=2(default) ";
                        }
                    }
                    saveStats(statValues);
                    llOwnerSay("✓ Saved " + (string)llGetListLength(statValues) + " stats from JSON");
                    llOwnerSay(statsDebug);
                } else {
                    llOwnerSay("✗ WARNING: stats JSON is invalid or empty!");
                }
                
                // Extract gender
                string gender = llJsonGetValue(jsonData, ["gender"]);
                if (gender != JSON_INVALID && gender != "") {
                    gender = llStringTrim(gender, STRING_TRIM);
                    if (llGetSubString(gender, 0, 0) == "\"") {
                        gender = llGetSubString(gender, 1, -2);
                    }
                    llOwnerSay("Gender from JSON: '" + gender + "'");
                } else {
                    llOwnerSay("Gender: not found in JSON");
                }
                
                // Extract species
                string species = llJsonGetValue(jsonData, ["species"]);
                if (species != JSON_INVALID && species != "") {
                    species = llStringTrim(species, STRING_TRIM);
                    if (llGetSubString(species, 0, 0) == "\"") {
                        species = llGetSubString(species, 1, -2);
                    }
                    llOwnerSay("Species from JSON: '" + species + "'");
                } else {
                    llOwnerSay("Species: not found in JSON");
                }
                
                // Extract health
                string healthJson = llJsonGetValue(jsonData, ["health"]);
                if (healthJson != JSON_INVALID && healthJson != "") {
                    string current = llJsonGetValue(healthJson, ["current"]);
                    string base = llJsonGetValue(healthJson, ["base"]);
                    string max = llJsonGetValue(healthJson, ["max"]);
                    llOwnerSay("Health JSON: current='" + current + "', base='" + base + "', max='" + max + "'");
                    if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
                        saveResourcePool(KEY_HEALTH, (integer)current, (integer)base, (integer)max);
                        llOwnerSay("✓ Saved health from JSON: " + current + "/" + base + "/" + max);
                    } else {
                        llOwnerSay("✗ WARNING: Health values invalid! (current=" + (string)(current == JSON_INVALID) + ", base=" + (string)(base == JSON_INVALID) + ", max=" + (string)(max == JSON_INVALID) + ")");
                    }
                } else {
                    llOwnerSay("✗ WARNING: Health JSON is invalid or empty!");
                }
                
                // Extract stamina
                string staminaJson = llJsonGetValue(jsonData, ["stamina"]);
                if (staminaJson != JSON_INVALID && staminaJson != "") {
                    string current = llJsonGetValue(staminaJson, ["current"]);
                    string base = llJsonGetValue(staminaJson, ["base"]);
                    string max = llJsonGetValue(staminaJson, ["max"]);
                    llOwnerSay("Stamina JSON: current='" + current + "', base='" + base + "', max='" + max + "'");
                    if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
                        saveResourcePool(KEY_STAMINA, (integer)current, (integer)base, (integer)max);
                        llOwnerSay("✓ Saved stamina from JSON: " + current + "/" + base + "/" + max);
                    } else {
                        llOwnerSay("✗ WARNING: Stamina values invalid!");
                    }
                } else {
                    llOwnerSay("✗ WARNING: Stamina JSON is invalid or empty!");
                }
                
                // Extract mana
                string manaJson = llJsonGetValue(jsonData, ["mana"]);
                if (manaJson != JSON_INVALID && manaJson != "") {
                    string current = llJsonGetValue(manaJson, ["current"]);
                    string base = llJsonGetValue(manaJson, ["base"]);
                    string max = llJsonGetValue(manaJson, ["max"]);
                    llOwnerSay("Mana JSON: current='" + current + "', base='" + base + "', max='" + max + "'");
                    if (current != JSON_INVALID && base != JSON_INVALID && max != JSON_INVALID) {
                        saveResourcePool(KEY_MANA, (integer)current, (integer)base, (integer)max);
                        llOwnerSay("✓ Saved mana from JSON: " + current + "/" + base + "/" + max);
                    } else {
                        llOwnerSay("✗ WARNING: Mana values invalid!");
                    }
                } else {
                    llOwnerSay("✗ WARNING: Mana JSON is invalid or empty!");
                }
                
                // Extract xp_total
                string xpTotal = llJsonGetValue(jsonData, ["xp_total"]);
                llOwnerSay("XP from JSON: '" + xpTotal + "' (invalid=" + (string)(xpTotal == JSON_INVALID) + ")");
                if (xpTotal != JSON_INVALID && xpTotal != "") {
                    xpTotal = llStringTrim(xpTotal, STRING_TRIM);
                    saveToLSD(KEY_XP, xpTotal);
                    llOwnerSay("✓ Saved XP from JSON: " + xpTotal);
                } else {
                    llOwnerSay("✗ WARNING: XP is invalid or empty!");
                }
                
                // Extract has_mana
                string hasMana = llJsonGetValue(jsonData, ["has_mana"]);
                llOwnerSay("has_mana from JSON: '" + hasMana + "' (invalid=" + (string)(hasMana == JSON_INVALID) + ")");
                if (hasMana != JSON_INVALID && hasMana != "") {
                    hasMana = llStringTrim(hasMana, STRING_TRIM);
                    saveToLSD("has_mana", hasMana);
                    llOwnerSay("✓ Saved has_mana from JSON: " + hasMana);
                } else {
                    llOwnerSay("✗ WARNING: has_mana is invalid or empty!");
                }
                
                // Extract species_factors
                string factorsJson = llJsonGetValue(jsonData, ["species_factors"]);
                if (factorsJson != JSON_INVALID && factorsJson != "") {
                    string healthFactor = llJsonGetValue(factorsJson, ["health_factor"]);
                    string staminaFactor = llJsonGetValue(factorsJson, ["stamina_factor"]);
                    string manaFactor = llJsonGetValue(factorsJson, ["mana_factor"]);
                    if (healthFactor != JSON_INVALID) {
                        healthFactor = llStringTrim(healthFactor, STRING_TRIM);
                        saveToLSD("health_factor", healthFactor);
                    }
                    if (staminaFactor != JSON_INVALID) {
                        staminaFactor = llStringTrim(staminaFactor, STRING_TRIM);
                        saveToLSD("stamina_factor", staminaFactor);
                    }
                    if (manaFactor != JSON_INVALID) {
                        manaFactor = llStringTrim(manaFactor, STRING_TRIM);
                        saveToLSD("mana_factor", manaFactor);
                    }
                    debugLog("Saved species factors from JSON");
                }
                
                // Store entire character JSON in LSD for future use
                saveToLSD("character_json", jsonData);
                debugLog("Saved full character JSON to LSD");
                
            } else {
                // Old pipe-delimited format - keep for backward compatibility
                debugLog("Parsing as legacy pipe-delimited format");
                list parts = llParseString2List(jsonData, ["|"], []);
                debugLog("Parsed into " + (string)llGetListLength(parts) + " parts");
                
                integer i;
                for (i = 0; i < llGetListLength(parts); i++) {
                    string part = llList2String(parts, i);
                    if (part != "") {
                        list keyValue = llParseString2List(part, [":"], []);
                        if (llGetListLength(keyValue) >= 2) {
                            string dataKey = llList2String(keyValue, 0);
                            string value = llList2String(keyValue, 1);
                            
                            if (dataKey == "stats") {
                                saveStats(llCSV2List(value));
                                debugLog("Saved stats from legacy format");
                            }
                            else if (dataKey == "health") {
                                list healthParts = llCSV2List(value);
                                if (llGetListLength(healthParts) >= 3) {
                                    saveResourcePool(KEY_HEALTH, 
                                        (integer)llList2String(healthParts, 0),
                                        (integer)llList2String(healthParts, 1),
                                        (integer)llList2String(healthParts, 2));
                                    debugLog("Saved health from legacy format");
                                }
                            }
                            else if (dataKey == "stamina") {
                                list staminaParts = llCSV2List(value);
                                if (llGetListLength(staminaParts) >= 3) {
                                    saveResourcePool(KEY_STAMINA,
                                        (integer)llList2String(staminaParts, 0),
                                        (integer)llList2String(staminaParts, 1),
                                        (integer)llList2String(staminaParts, 2));
                                    debugLog("Saved stamina from legacy format");
                                }
                            }
                            else if (dataKey == "mana") {
                                list manaParts = llCSV2List(value);
                                if (llGetListLength(manaParts) >= 3) {
                                    saveResourcePool(KEY_MANA,
                                        (integer)llList2String(manaParts, 0),
                                        (integer)llList2String(manaParts, 1),
                                        (integer)llList2String(manaParts, 2));
                                    debugLog("Saved mana from legacy format");
                                }
                            }
                            else if (dataKey == "xp") {
                                if (value != "") {
                                    saveToLSD(KEY_XP, value);
                                    debugLog("Saved XP from legacy format: " + value);
                                }
                            }
                            else if (dataKey == "class") {
                                debugLog("=== CLASS DATA RECEIVED (LEGACY) ===");
                                debugLog("Raw value: '" + value + "'");
                                if (value != "") {
                                    saveToLSD(KEY_CLASS, value);
                                    string verify = llLinksetDataRead(KEY_CLASS);
                                    debugLog("Saved class to LSD: '" + value + "'");
                                    debugLog("Verified from LSD: '" + verify + "'");
                                } else {
                                    debugLog("WARNING: Class value is empty in legacy format!");
                                }
                            }
                            else if (dataKey == "factors") {
                                list factorParts = llCSV2List(value);
                                if (llGetListLength(factorParts) >= 3) {
                                    saveToLSD("health_factor", llList2String(factorParts, 0));
                                    saveToLSD("stamina_factor", llList2String(factorParts, 1));
                                    saveToLSD("mana_factor", llList2String(factorParts, 2));
                                    debugLog("Saved species factors from legacy format");
                                }
                            }
                            else if (dataKey == "has_mana") {
                                saveToLSD("has_mana", value);
                                debugLog("Saved has_mana from legacy format: " + value);
                            }
                        }
                    }
                }
            }
            
            // Update last sync time after successfully loading from Firestore
            lastSyncTime = llGetUnixTime();
            saveToLSD(KEY_LAST_SYNC, (string)lastSyncTime);
            
            // Notify other scripts that data is loaded from Firestore
            llMessageLinked(LINK_SET, 0, "character loaded from firestore", "");
            
            // Send individual load messages to trigger Main HUD updates from LSD
            // (Data is now in LSD, so we load from there)
            // Only if not already loading (prevents cascade)
            if (!isLoading) {
                isLoading = TRUE;
                llMessageLinked(LINK_SET, 0, "load stats", "");
                llMessageLinked(LINK_SET, 0, "load health", "");
                llMessageLinked(LINK_SET, 0, "load stamina", "");
                llMessageLinked(LINK_SET, 0, "load mana", "");
                llMessageLinked(LINK_SET, 0, "load xp", "");
                llMessageLinked(LINK_SET, 0, "load class", "");
                // Reset flag after a short delay
                llSetTimerEvent(2.0);
            }
            return;
        }
        
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
        else if (msg == "load stats") {
            debugLog("*** Processing load stats ***");
            list stats = loadStats();
            string statsStr = llList2CSV(stats);
            debugLog("Loading stats from LSD: " + statsStr + " (length: " + (string)llGetListLength(stats) + ")");
            debugLog("Sending 'stats loaded' message with data: " + statsStr);
            llMessageLinked(LINK_SET, 0, "stats loaded", statsStr);
            debugLog("*** load stats complete ***");
        }
        else if (msg == "load health") {
            debugLog("*** Processing load health ***");
            list healthData = loadResourcePool(KEY_HEALTH);
            string healthStr = (string)llList2String(healthData, 0) + "|" + (string)llList2String(healthData, 1) + "|" + (string)llList2String(healthData, 2);
            debugLog("Loading health from LSD: " + healthStr);
            integer currentHealth = (integer)llList2String(healthData, 0);
            string healthParam = llList2String(healthData, 1) + "|" + llList2String(healthData, 2);
            debugLog("Sending 'health loaded' message: num=" + (string)currentHealth + " id=" + healthParam);
            llMessageLinked(LINK_SET, currentHealth, "health loaded", healthParam);
            debugLog("*** load health complete ***");
        }
        else if (msg == "load stamina") {
            debugLog("*** Processing load stamina ***");
            list staminaData = loadResourcePool(KEY_STAMINA);
            string staminaStr = (string)llList2String(staminaData, 0) + "|" + (string)llList2String(staminaData, 1) + "|" + (string)llList2String(staminaData, 2);
            debugLog("Loading stamina from LSD: " + staminaStr);
            integer currentStamina = (integer)llList2String(staminaData, 0);
            string staminaParam = llList2String(staminaData, 1) + "|" + llList2String(staminaData, 2);
            debugLog("Sending 'stamina loaded' message: num=" + (string)currentStamina + " id=" + staminaParam);
            llMessageLinked(LINK_SET, currentStamina, "stamina loaded", staminaParam);
            debugLog("*** load stamina complete ***");
        }
        else if (msg == "load mana") {
            debugLog("*** Processing load mana ***");
            list manaData = loadResourcePool(KEY_MANA);
            string manaStr = (string)llList2String(manaData, 0) + "|" + (string)llList2String(manaData, 1) + "|" + (string)llList2String(manaData, 2);
            debugLog("Loading mana from LSD: " + manaStr);
            integer currentMana = (integer)llList2String(manaData, 0);
            string manaParam = llList2String(manaData, 1) + "|" + llList2String(manaData, 2);
            debugLog("Sending 'mana loaded' message: num=" + (string)currentMana + " id=" + manaParam);
            llMessageLinked(LINK_SET, currentMana, "mana loaded", manaParam);
            debugLog("*** load mana complete ***");
        }
        else if (msg == "load xp") {
            llOwnerSay("*** Processing load xp ***");
            string xp = loadFromLSD(KEY_XP);
            llOwnerSay("Loading XP from LSD: '" + xp + "'");
            if (xp != "") {
                llMessageLinked(LINK_SET, (integer)xp, "xp loaded", "");
                llOwnerSay("✓ Sent 'xp loaded' message with value: " + xp);
            } else {
                llOwnerSay("✗ WARNING: XP is empty in LSD!");
            }
            llOwnerSay("*** load xp complete ***");
        }
        else if (msg == "load class") {
            llOwnerSay("*** Processing load class ***");
            string class = loadFromLSD(KEY_CLASS);
            llOwnerSay("Loading class from LSD: '" + class + "' (length: " + (string)llStringLength(class) + ")");
            if (class == "") {
                llOwnerSay("✗ WARNING: Class is empty in LSD! Checking if it exists...");
                // Try to read directly to see if key exists
                string directRead = llLinksetDataRead(KEY_CLASS);
                llOwnerSay("Direct read of '" + KEY_CLASS + "': '" + directRead + "'");
            } else {
                llOwnerSay("✓ Class found in LSD: '" + class + "'");
            }
            llOwnerSay("Sending 'class loaded' message: id=" + class);
            llMessageLinked(LINK_SET, 0, "class loaded", class);
            llOwnerSay("*** load class complete ***");
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
            // Reset timer to periodic interval for pulling from Firestore
            llSetTimerEvent(SYNC_INTERVAL);
        } else {
            // Periodic: Pull from Firestore to update LSD with latest data
            // This ensures LSD stays in sync with Firestore
            loadFromFirestore();
            // Timer will continue with same interval
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

