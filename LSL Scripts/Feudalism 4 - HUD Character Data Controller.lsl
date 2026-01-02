// ============================================================================
// Feudalism 4 - HUD Character Data Controller
// ============================================================================
// Handles all HUD-facing character data logic (moved from Data Manager)
// ============================================================================

// =========================== CONFIGURATION ==================================
// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Char Data] " + message);
    }
}

// Data keys for LinksetData (LSD) - same as Data Manager
string KEY_STATS = "stats";
string KEY_HEALTH = "health";
string KEY_STAMINA = "stamina";
string KEY_MANA = "mana";
string KEY_XP = "xp";
string KEY_CLASS = "class";

// =========================== HELPER FUNCTIONS ================================

// Load stats list from LSD (reads from rp_stats_current JSON)
list loadStats() {
    // Read current stats from rp_stats_current (JSON format)
    string statsJson = llLinksetDataRead("rp_stats_current");
    debugLog("loadStats() -> statsJson='" + statsJson + "' (length: " + (string)llStringLength(statsJson) + ")");
    
    if (statsJson == "" || statsJson == "JSON_INVALID" || statsJson == "{}") {
        debugLog("No current stats found in LSD, returning default (all 2s)");
        // Return default stats (all 2s)
        return [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];
    }
    
    // Parse JSON and convert to list
    // Stat names in order: agility, animal handling, athletics, awareness, crafting,
    // deception, endurance, entertaining, fighting, healing,
    // influence, intelligence, knowledge, marksmanship, persuasion,
    // stealth, survival, thievery, will, wisdom
    list statNames = [
        "agility", "animal handling", "athletics", "awareness", "crafting",
        "deception", "endurance", "entertaining", "fighting", "healing",
        "influence", "intelligence", "knowledge", "marksmanship", "persuasion",
        "stealth", "survival", "thievery", "will", "wisdom"
    ];
    
    list stats = [];
    integer i;
    integer len = llGetListLength(statNames);
    for (i = 0; i < len; i++) {
        string statName = llList2String(statNames, i);
        string valueStr = llJsonGetValue(statsJson, [statName]);
        integer value = 2;  // Default
        if (valueStr != JSON_INVALID && valueStr != "") {
            // Remove quotes if present
            if (llStringLength(valueStr) >= 2 && llGetSubString(valueStr, 0, 0) == "\"" && llGetSubString(valueStr, -1, -1) == "\"") {
                valueStr = llGetSubString(valueStr, 1, -2);
            }
            value = (integer)valueStr;
        }
        stats += [value];
    }
    
    debugLog("Parsed stats: " + (string)llGetListLength(stats) + " values: " + llDumpList2String(stats, ","));
    return stats;
}

// Load resource pool from LSD
list loadResourcePool(string resourceType) {
    string data = llLinksetDataRead(resourceType);
    debugLog("loadResourcePool('" + resourceType + "') -> data='" + data + "'");
    if (data == "") {
        debugLog("No data found for " + resourceType + ", returning [0,0,0]");
        return [0, 0, 0];  // Default: empty pool
    }
    list parts = llParseString2List(data, ["|"], []);
    if (llGetListLength(parts) >= 3) {
        integer current = (integer)llList2String(parts, 0);
        integer base = (integer)llList2String(parts, 1);
        integer max = (integer)llList2String(parts, 2);
        debugLog("Parsed " + resourceType + ": current=" + (string)current + ", base=" + (string)base + ", max=" + (string)max);
        return [current, base, max];
    }
    debugLog("Invalid format for " + resourceType + ", returning [0,0,0]");
    return [0, 0, 0];
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // No initialization needed - script responds to link messages
    }
    
    // Handle link messages from Combined HUD Controller
    link_message(integer sender_num, integer num, string msg, key id) {
        // Handle "load <field>" requests from HUD Controller
        if (msg == "load stats") {
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
            string xp = llLinksetDataRead(KEY_XP);
            debugLog("Loading XP from LSD: '" + xp + "'");
            if (xp != "") {
                llMessageLinked(LINK_SET, (integer)xp, "xp loaded", "");
                debugLog("✓ Sent 'xp loaded' message with value: " + xp);
            } else {
                debugLog("✗ WARNING: XP is empty in LSD!");
            }
            debugLog("*** load xp complete ***");
        }
        else if (msg == "load class") {
            debugLog("*** Processing load class ***");
            string class = llLinksetDataRead(KEY_CLASS);
            debugLog("Loading class from LSD: '" + class + "' (length: " + (string)llStringLength(class) + ")");
            if (class == "") {
                debugLog("✗ WARNING: Class is empty in LSD! Checking if it exists...");
                // Try to read directly to see if key exists
                string directRead = llLinksetDataRead(KEY_CLASS);
                debugLog("Direct read of '" + KEY_CLASS + "': '" + directRead + "'");
            } else {
                debugLog("✓ Class found in LSD: '" + class + "'");
            }
            debugLog("Sending 'class loaded' message: id=" + class);
            llMessageLinked(LINK_SET, 0, "class loaded", class);
            debugLog("*** load class complete ***");
        }
    }
}

