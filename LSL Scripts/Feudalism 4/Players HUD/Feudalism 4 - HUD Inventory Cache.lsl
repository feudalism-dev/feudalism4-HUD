// ============================================================================
// InventoryCache.lsl
// ============================================================================
// Maintains a delta map for inventory changes
// ============================================================================

// Communication channel
integer INVENTORY_CACHE_CHANNEL = 9001;

// Delta map: two parallel lists
list itemName = [];
list delta = [];

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // No initialization needed
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        if (msg == "CACHE_ADD_DELTA") {
            // Parse JSON: { "item": "...", "delta": int }
            string json = (string)id;
            string item = llJsonGetValue(json, ["item"]);
            string deltaStr = llJsonGetValue(json, ["delta"]);
            
            if (item != JSON_INVALID && item != "" && deltaStr != JSON_INVALID && deltaStr != "") {
                // Remove quotes if present
                if (llStringLength(item) >= 2 && llGetSubString(item, 0, 0) == "\"" && llGetSubString(item, -1, -1) == "\"") {
                    item = llGetSubString(item, 1, -2);
                }
                if (llStringLength(deltaStr) >= 2 && llGetSubString(deltaStr, 0, 0) == "\"" && llGetSubString(deltaStr, -1, -1) == "\"") {
                    deltaStr = llGetSubString(deltaStr, 1, -2);
                }
                
                integer deltaValue = (integer)deltaStr;
                
                // Find existing entry
                integer index = llListFindList(itemName, [item]);
                if (index != -1) {
                    // Update existing delta
                    integer currentDelta = llList2Integer(delta, index);
                    integer newDelta = currentDelta + deltaValue;
                    delta = llListReplaceList(delta, [newDelta], index, index);
                } else {
                    // Add new entry
                    itemName += [item];
                    delta += [deltaValue];
                }
            }
        }
        else if (msg == "CACHE_GET_DELTAS") {
            // Build JSON response with itemNames and deltas arrays
            // Structure: { "itemNames": [...], "deltas": [...] }
            integer len = llGetListLength(itemName);
            integer i;
            
            // Build itemNames array
            list jsonParts = ["{\"itemNames\":["];
            for (i = 0; i < len; i++) {
                if (i > 0) jsonParts += ",";
                jsonParts += ["\"", llList2String(itemName, i), "\""];
            }
            jsonParts += "]";
            
            // Build deltas array
            jsonParts += ",\"deltas\":[";
            for (i = 0; i < len; i++) {
                if (i > 0) jsonParts += ",";
                jsonParts += [(string)llList2Integer(delta, i)];
            }
            jsonParts += "]";
            
            jsonParts += "}";
            string responseJson = llDumpList2String(jsonParts, "");
            
            // Send response
            llMessageLinked(sender_num, 0, "CACHE_DELTAS", responseJson);
        }
        else if (msg == "CACHE_CLEAR") {
            // Clear all entries
            itemName = [];
            delta = [];
        }
    }
}

