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
string KEY_MODE = "mode";
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
    debugLog("loadStats() -> statsString='" + statsString + "'");
    if (statsString == "") {
        debugLog("No stats found in LSD, returning default (all 2s)");
        // Return default stats (all 2s)
        return [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];
    }
    list stats = llCSV2List(statsString);
    debugLog("Parsed stats: " + (string)llGetListLength(stats) + " values");
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
    debugLog("Parsed " + resourceType + " data: " + llDumpList2String(result, ","));
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
    string mode = loadFromLSD(KEY_MODE);
    
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
    debugLog("loadFromFirestore() called");
    // Request character data from Firestore via Firestore Bridge (HTTP-based)
    // The Firestore Bridge will make HTTP requests to the backend
    debugLog("Sending 'firestore_load' message to Firestore Bridge");
    llMessageLinked(LINK_SET, 0, "firestore_load", "");
    llOwnerSay("[Data Manager] Requesting character data from Firestore via HTTP bridge...");
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("===== STATE_ENTRY START =====");
        debugLog("Script is running!");
        llOwnerSay("[Data Manager] Initialized");
        
        // FIRST: Fetch from Firestore, then write to LSD, then load from LSD
        // This ensures we have the latest data from Firebase
        debugLog("Waiting 1 second before loading...");
        llSleep(1.0);  // Wait for HUD to stabilize
        
        // Fetch from Firestore FIRST (if backend is configured)
        debugLog("Fetching from Firestore FIRST...");
        loadFromFirestore();
        
        // Wait for Firestore data to arrive and be saved to LSD
        // Then load from LSD (which now has the Firestore data)
        llSleep(2.0);  // Give Firestore time to respond
        
        // Now load from LSD (which should have Firestore data if available, or old data if not)
        // Only if not already loading (prevents cascade)
        if (!isLoading) {
            isLoading = TRUE;
            debugLog("Loading from LSD (after Firestore fetch)...");
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
        debugLog(">>> link_message received: msg='" + msg + "' num=" + (string)num + " id=" + (string)id);
        
        // Handle data update requests from other scripts
        // Also handle messages from Firestore Bridge
        
        // Character data from Firestore Bridge
        if (msg == "CHARACTER_DATA") {
            // Parse and save character data received from Firestore
            // Format: CHARACTER_DATA|stats:...|health:...|stamina:...|etc
            string data = (string)id;
            debugLog("=== CHARACTER_DATA RECEIVED ===");
            debugLog("Full data length: " + (string)llStringLength(data));
            debugLog("First 200 chars: " + llGetSubString(data, 0, 199));
            list parts = llParseString2List(data, ["|"], []);
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
                            debugLog("Saved stats from Firestore");
                        }
                        else if (dataKey == "health") {
                            list healthParts = llCSV2List(value);
                            if (llGetListLength(healthParts) >= 3) {
                                saveResourcePool(KEY_HEALTH, 
                                    (integer)llList2String(healthParts, 0),
                                    (integer)llList2String(healthParts, 1),
                                    (integer)llList2String(healthParts, 2));
                                debugLog("Saved health from Firestore");
                            }
                        }
                        else if (dataKey == "stamina") {
                            list staminaParts = llCSV2List(value);
                            if (llGetListLength(staminaParts) >= 3) {
                                saveResourcePool(KEY_STAMINA,
                                    (integer)llList2String(staminaParts, 0),
                                    (integer)llList2String(staminaParts, 1),
                                    (integer)llList2String(staminaParts, 2));
                                debugLog("Saved stamina from Firestore");
                            }
                        }
                        else if (dataKey == "mana") {
                            list manaParts = llCSV2List(value);
                            if (llGetListLength(manaParts) >= 3) {
                                saveResourcePool(KEY_MANA,
                                    (integer)llList2String(manaParts, 0),
                                    (integer)llList2String(manaParts, 1),
                                    (integer)llList2String(manaParts, 2));
                                debugLog("Saved mana from Firestore");
                            }
                        }
                        else if (dataKey == "xp") {
                            if (value != "") {
                                saveToLSD(KEY_XP, value);
                                debugLog("Saved XP from Firestore: " + value);
                            }
                        }
                        else if (dataKey == "class") {
                            debugLog("=== CLASS DATA RECEIVED ===");
                            debugLog("Raw value: '" + value + "'");
                            debugLog("Value length: " + (string)llStringLength(value));
                            debugLog("KEY_CLASS constant: '" + KEY_CLASS + "'");
                            if (value != "") {
                                saveToLSD(KEY_CLASS, value);
                                string verify = llLinksetDataRead(KEY_CLASS);
                                debugLog("Saved class to LSD: '" + value + "'");
                                debugLog("Verified from LSD: '" + verify + "'");
                            } else {
                                debugLog("WARNING: Class value is empty in CHARACTER_DATA!");
                                debugLog("Full CHARACTER_DATA part: '" + part + "'");
                            }
                            debugLog("=== END CLASS DATA ===");
                        }
                        else if (dataKey == "factors") {
                            // Format: healthFactor,staminaFactor,manaFactor
                            list factorParts = llCSV2List(value);
                            if (llGetListLength(factorParts) >= 3) {
                                saveToLSD("health_factor", llList2String(factorParts, 0));
                                saveToLSD("stamina_factor", llList2String(factorParts, 1));
                                saveToLSD("mana_factor", llList2String(factorParts, 2));
                                debugLog("Saved species factors from Firestore");
                            }
                        }
                        else if (dataKey == "has_mana") {
                            saveToLSD("has_mana", value);
                            debugLog("Saved has_mana from Firestore: " + value);
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
            debugLog("*** Processing load xp ***");
            string xp = loadFromLSD(KEY_XP);
            debugLog("Loading XP from LSD: '" + xp + "'");
            debugLog("Sending 'xp loaded' message: num=" + xp);
            llMessageLinked(LINK_SET, (integer)xp, "xp loaded", "");
            debugLog("*** load xp complete ***");
        }
        else if (msg == "load class") {
            debugLog("*** Processing load class ***");
            string class = loadFromLSD(KEY_CLASS);
            debugLog("Loading class from LSD: '" + class + "' (length: " + (string)llStringLength(class) + ")");
            if (class == "") {
                debugLog("WARNING: Class is empty in LSD! Checking if it exists...");
                // Try to read directly to see if key exists
                string directRead = llLinksetDataRead(KEY_CLASS);
                debugLog("Direct read of '" + KEY_CLASS + "': '" + directRead + "'");
            }
            debugLog("Sending 'class loaded' message: id=" + class);
            llMessageLinked(LINK_SET, 0, "class loaded", class);
            debugLog("*** load class complete ***");
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

