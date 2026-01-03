// Feudalism 4 - Bridge Main Dispatcher
// ============================================================================
// Entry point for all HUD communication. Routes commands to appropriate modules.
// Contains NO Firestore logic - routing only.
// ============================================================================

// Import constants from Utils (we'll use link_message for module communication)
integer FS_BRIDGE_CHANNEL = -777001;
integer INVENTORY_CHANNEL = -454545;
integer MODULE_CHANNEL = -777002;

// Debug
integer DEBUG_MODE = TRUE;

debugLog(string msg) {
    if (DEBUG_MODE) {
        llOwnerSay("[Bridge_Main] " + msg);
    }
}

// Module domain prefixes
string DOMAIN_CHAR = "CHAR";
string DOMAIN_CLASS = "CLASS";
string DOMAIN_UNIV = "UNIV";
string DOMAIN_INV = "INV";
string DOMAIN_STIP = "STIP";
string DOMAIN_CONS = "CONS";

// Owner info (needed for some routing)
key ownerKey;
string ownerUUID;

// =========================== ROUTING LOGIC ==================================

// Map command to domain
string getDomainForCommand(string command) {
    // Character domain
    if (llSubStringIndex(command, "get") == 0) {
        // Field gets: getStats, getHealth, getStamina, etc.
        if (command == "getClass" || command == "getClass_id" ||
            command == "getStats" || command == "getGender" ||
            command == "getSpecies" || command == "getSpecies_id" ||
            command == "getHasMana" || command == "getHas_mana" ||
            command == "getHealth" || command == "getStamina" ||
            command == "getMana" || command == "getXP" || command == "getXP_total" ||
            command == "getSpeciesFactors" || command == "getSpecies_factors" ||
            command == "getCurrency" || command == "getMode" ||
            command == "getUniverseId" || command == "getUniverse_id") {
            return DOMAIN_CHAR;
        }
    }
    
    if (llSubStringIndex(command, "GET_ACTIVE_CHARACTER") == 0 ||
        llSubStringIndex(command, "SET_ACTIVE_CHARACTER") == 0 ||
        command == "fetchFullCharacterDocument") {
        return DOMAIN_CHAR;
    }
    
    // Inventory domain
    if (command == "getInventory" || command == "getInventoryPage" ||
        command == "applyInventoryDeltas" ||
        command == "requestConsumeItem" ||
        llSubStringIndex(command, "fGiveItem") == 0 ||
        llSubStringIndex(command, "fTakeItem") == 0) {
        return DOMAIN_INV;
    }
    
    // Stipend domain
    if (llSubStringIndex(command, "GET_STIPEND_DATA") == 0 ||
        llSubStringIndex(command, "UPDATE_LAST_PAID") == 0 ||
        llSubStringIndex(command, "SET_CLASS_STIPEND") == 0) {
        return DOMAIN_STIP;
    }
    
    // Class domain
    if (llSubStringIndex(command, "GET_CLASS_LIST") == 0 ||
        llSubStringIndex(command, "GET_CLASS_STIPEND") == 0) {
        return DOMAIN_CLASS;
    }
    
    // Universe domain
    if (llSubStringIndex(command, "IS_BANNED") == 0) {
        return DOMAIN_UNIV;
    }
    
    // Default: route to characters (for backward compatibility)
    return DOMAIN_CHAR;
}

// Route command to appropriate module
routeToModule(string domain, string command, string payload, integer senderLink) {
    // Format: DOMAIN|COMMAND|PAYLOAD
    string routedMsg = domain + "|" + command + "|" + payload;
    llMessageLinked(LINK_SET, MODULE_CHANNEL, routedMsg, NULL_KEY);
}

// Note: Modules send responses directly to original sender via FS_BRIDGE_CHANNEL
// Bridge_Main does not need to forward responses

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        
        debugLog("Bridge_Main INIT: FS_BRIDGE_CHANNEL=" + (string)FS_BRIDGE_CHANNEL + ", MODULE_CHANNEL=" + (string)MODULE_CHANNEL);
        
        // Listen for inventory messages from world objects
        llListen(INVENTORY_CHANNEL, "", NULL_KEY, "");
    }
    
    // Handle link messages from HUD controllers
    link_message(integer sender_num, integer num, string msg, key id) {
        debugLog("Bridge_Main LINK_MESSAGE: sender=" + (string)sender_num + ", channel=" + (string)num + ", msg='" + msg + "'");
        
        // Only process messages on FS_BRIDGE_CHANNEL or standard link messages (0)
        // Ignore MODULE_CHANNEL messages (those are module-to-module)
        if (num == MODULE_CHANNEL) {
            return;
        }
        
        if (num != 0 && num != FS_BRIDGE_CHANNEL) {
            return;
        }
        
        list parts = llParseString2List(msg, ["|"], []);
        string domain = llList2String(parts, 0);
        string command = llList2String(parts, 1);
        string payload = llDumpList2String(llList2List(parts, 2, -1), "|");
        
        // Route to module
        if (domain == DOMAIN_STIP) {
            debugLog("Bridge_Main → Bridge_Stipends: '" + msg + "'");
        }
        routeToModule(domain, command, payload, sender_num);
    }
    
    // Handle inventory messages from world objects (fGiveItem, fTakeItem)
    listen(integer channel, string name, key id, string msg) {
        if (channel == INVENTORY_CHANNEL) {
            // Route to inventory module
            // Format: fGiveItem|itemName|qty or fTakeItem|itemName|qty
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string command = llList2String(parts, 0);
                string payload = llDumpList2String(llList2List(parts, 1, -1), "|");
                routeToModule(DOMAIN_INV, command, payload, LINK_SET);
            }
        }
    }
}

