// ============================================================================
// Feudalism 4 - Buff Manager
// ============================================================================
// HUD-local buff management system
// Maintains active buffs and calculates current stats from base stats + buffs
// ============================================================================

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Buff Manager] " + message);
    }
}

// LSD Keys
string KEY_STATS_BASE = "rp_stats_base";
string KEY_STATS_CURRENT = "rp_stats_current";
string KEY_MODE = "mode";

// Active buffs list
// Format: [stat_name, amount, expiry_timestamp, stat_name, amount, expiry_timestamp, ...]
// Each buff is 3 elements: [stat_name, amount, expiry]
list active_buffs = [];

// Maximum number of active buffs (hard limit)
integer MAX_ACTIVE_BUFFS = 3;

// Timer interval (1 second)
float TIMER_INTERVAL = 1.0;

// ============================================================================
// BUFF MANAGEMENT FUNCTIONS
// ============================================================================

// Add a buff to active_buffs
addBuff(string stat, integer amount, integer duration_seconds) {
    // Check buff cap (3 active buffs maximum)
    integer currentBuffCount = llGetListLength(active_buffs) / 3;
    if (currentBuffCount >= MAX_ACTIVE_BUFFS) {
        // Reject silently - do not add buff
        return;
    }
    
    integer expiry = llGetUnixTime() + duration_seconds;
    active_buffs += [stat, amount, expiry];
    debugLog("Added buff: " + stat + " +" + (string)amount + " for " + (string)duration_seconds + "s (expires: " + (string)expiry + ")");
    
    // Immediately recalc and write current stats
    recalcAndWriteCurrentStats();
    
    // Send UI update
    sendBuffUIUpdate();
}

// Remove expired buffs
removeExpiredBuffs() {
    integer now = llGetUnixTime();
    integer i = 0;
    integer removed = 0;
    
    while (i < llGetListLength(active_buffs)) {
        integer expiry = llList2Integer(active_buffs, i + 2);
        if (expiry <= now) {
            string stat = llList2String(active_buffs, i);
            integer amount = llList2Integer(active_buffs, i + 1);
            debugLog("Removed expired buff: " + stat + " +" + (string)amount);
            active_buffs = llDeleteSubList(active_buffs, i, i + 2);
            removed++;
        } else {
            i += 3;  // Move to next buff (3 elements per buff)
        }
    }
    
    if (removed > 0) {
        recalcAndWriteCurrentStats();
        // Send UI update when buffs expire
        sendBuffUIUpdate();
    }
}

// Generate and send BUFF_UI_UPDATE message
sendBuffUIUpdate() {
    integer now = llGetUnixTime();
    
    // Aggregate buffs by stat
    list statTotals = [];  // [stat_name, total_amount, min_remaining, ...]
    
    integer i = 0;
    while (i < llGetListLength(active_buffs)) {
        string stat = llList2String(active_buffs, i);
        integer amount = llList2Integer(active_buffs, i + 1);
        integer expiry = llList2Integer(active_buffs, i + 2);
        integer remaining = expiry - now;
        
        if (remaining > 0) {
            // Find or add stat in statTotals
            integer statIndex = llListFindList(statTotals, [stat]);
            if (statIndex == -1) {
                // New stat - add it
                statTotals += [stat, amount, remaining];
            } else {
                // Existing stat - update total and remaining (use minimum remaining)
                integer currentTotal = llList2Integer(statTotals, statIndex + 1);
                integer currentRemaining = llList2Integer(statTotals, statIndex + 2);
                integer minRemaining = currentRemaining;
                if (remaining < currentRemaining) {
                    minRemaining = remaining;
                }
                statTotals = llListReplaceList(statTotals, [currentTotal + amount, minRemaining], statIndex + 1, statIndex + 2);
            }
        }
        
        i += 3;
    }
    
    // Build JSON array
    list jsonParts = ["["];
    integer j = 0;
    integer entryCount = 0;
    while (j < llGetListLength(statTotals)) {
        string stat = llList2String(statTotals, j);
        integer totalAmount = llList2Integer(statTotals, j + 1);
        integer remaining = llList2Integer(statTotals, j + 2);
        
        // Only include stats with nonzero total buffs
        if (totalAmount != 0) {
            if (entryCount > 0) {
                jsonParts += ",";
            }
            jsonParts += [
                "{\"stat\":\"", stat, "\",",
                "\"amount\":", (string)totalAmount, ",",
                "\"remaining\":", (string)remaining, "}"
            ];
            entryCount++;
        }
        
        j += 3;
    }
    jsonParts += "]";
    
    string jsonArray = llDumpList2String(jsonParts, "");
    string uiMessage = "BUFF_UI_UPDATE|" + jsonArray;
    
    llMessageLinked(LINK_SET, 0, uiMessage, NULL_KEY);
    debugLog("Sent BUFF_UI_UPDATE: " + jsonArray);
}

// ============================================================================
// STAT CALCULATION FUNCTIONS
// ============================================================================

// Read base stats JSON from LSD
string getBaseStatsJSON() {
    string baseStatsJson = llLinksetDataRead(KEY_STATS_BASE);
    if (baseStatsJson == "" || baseStatsJson == "JSON_INVALID") {
        debugLog("No base stats found in LSD");
        return "{}";
    }
    return baseStatsJson;
}

// Get current mode from LSD
string getMode() {
    string mode = llLinksetDataRead(KEY_MODE);
    if (mode == "" || mode == "JSON_INVALID") {
        return "OOC";  // Default to OOC if mode not set
    }
    return mode;
}

// Calculate current stats from base stats + buffs
string calculateCurrentStats() {
    // Read base stats
    string baseStatsJson = getBaseStatsJSON();
    
    // If missing/empty/invalid, return empty JSON object
    if (baseStatsJson == "{}" || baseStatsJson == "" || baseStatsJson == "JSON_INVALID") {
        return "{}";
    }
    
    // Get mode
    string mode = getMode();
    integer applyBuffs = (mode == "RP");
    
    // Start with base stats (copy)
    string currentStatsJson = baseStatsJson;
    
    // If mode is RP, apply buffs
    if (applyBuffs) {
        integer i = 0;
        while (i < llGetListLength(active_buffs)) {
            string stat = llList2String(active_buffs, i);
            integer amount = llList2Integer(active_buffs, i + 1);
            
            // Get current value for this stat (may not exist in base stats)
            string currentValueStr = llJsonGetValue(currentStatsJson, [stat]);
            integer currentValue = 0;
            
            if (currentValueStr != JSON_INVALID && currentValueStr != "") {
                // Remove quotes if present
                if (llStringLength(currentValueStr) >= 2 && llGetSubString(currentValueStr, 0, 0) == "\"" && llGetSubString(currentValueStr, -1, -1) == "\"") {
                    currentValueStr = llGetSubString(currentValueStr, 1, -2);
                }
                currentValue = (integer)currentValueStr;
            }
            
            // Apply buff: new = current + amount
            integer newValue = currentValue + amount;
            
            // Update JSON (will create key if it doesn't exist)
            currentStatsJson = llJsonSetValue(currentStatsJson, [stat], (string)newValue);
            
            i += 3;  // Move to next buff
        }
    }
    // If mode is not RP, current stats = base stats (already set above)
    
    return currentStatsJson;
}

// Recalculate and write current stats to LSD
recalcAndWriteCurrentStats() {
    string currentStatsJson = calculateCurrentStats();
    llLinksetDataWrite(KEY_STATS_CURRENT, currentStatsJson);
    debugLog("Wrote current stats to LSD: " + currentStatsJson);
}

// ============================================================================
// MAIN STATE
// ============================================================================

default {
    state_entry() {
        debugLog("Buff Manager initialized");
        
        // Start timer
        llSetTimerEvent(TIMER_INTERVAL);
        
        // Initial calculation
        recalcAndWriteCurrentStats();
        
        // Send initial UI update
        sendBuffUIUpdate();
    }
    
    timer() {
        // Remove expired buffs
        removeExpiredBuffs();
        
        // Recalc and write current stats (in case mode changed)
        recalcAndWriteCurrentStats();
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Handle BUFF_TRIGGER messages
        // Format: "BUFF_TRIGGER|<stat>|<amount>|<duration_seconds>"
        if (llSubStringIndex(msg, "BUFF_TRIGGER|") == 0) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) == 4) {
                string stat = llList2String(parts, 1);
                integer amount = (integer)llList2String(parts, 2);
                integer duration = (integer)llList2String(parts, 3);
                
                // No validation - add buff as-is
                addBuff(stat, amount, duration);
            } else {
                debugLog("Invalid BUFF_TRIGGER format: " + msg);
            }
        }
    }
}

