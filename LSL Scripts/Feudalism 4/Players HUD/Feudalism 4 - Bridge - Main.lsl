/*
    Feudalism 4 - Bridge Main Dispatcher
    ------------------------------------
    Clean, minimal, domain-based router.
    No MODULE_CHANNEL.
    No routeToModule().
    Uses original protocol: msg = command, id = payload.
    All modules receive messages on their own dedicated channels.
*/

// ====================== CHANNEL CONSTANTS ======================

// HUD → Bridge_Main
integer FS_BRIDGE_CHANNEL = -777001;

// Module channels (must match your existing modules)
integer INVENTORY_CHANNEL   = -454545;
integer STIPEND_CHANNEL     = -454546;   // example — replace with your real value
integer CONSUMABLES_CHANNEL = -454547;   // example — replace with your real value
integer CLASS_CHANNEL       = -454548;   // example — replace with your real value
integer UNIVERSE_CHANNEL    = -454549;   // example — replace with your real value
integer CHARACTER_CHANNEL   = -454550;   // example — replace with your real value
integer MODULE_CHANNEL      = -777002;   // Channel used by Bridge Characters and Bridge Stipends

// ====================== DEBUG ======================

integer DEBUG_MODE = TRUE;

debugLog(string msg) {
    if (DEBUG_MODE) {
        llOwnerSay("[Bridge_Main] " + msg);
    }
}

// ====================== DOMAIN CONSTANTS ======================

string DOMAIN_CHAR = "CHAR";
string DOMAIN_CLASS = "CLASS";
string DOMAIN_UNIV = "UNIV";
string DOMAIN_INV = "INV";
string DOMAIN_STIP = "STIP";
string DOMAIN_CONS = "CONS";

// ====================== OWNER INFO ======================

key ownerKey;
string ownerUUID;

// ====================== DOMAIN ROUTING ======================

string getDomainForCommand(string command) {

    // Character domain
    if (llSubStringIndex(command, "get") == 0) {
        if (command == "getClass" || command == "getClass_id" ||
            command == "getStats" || command == "getGender" ||
            command == "getSpecies" || command == "getSpecies_id" ||
            command == "getHasMana" || command == "getHas_mana" ||
            command == "getHealth" || command == "getStamina" ||
            command == "getMana" || command == "getXP" ||
            command == "getXP_total" || command == "getSpeciesFactors" ||
            command == "getSpecies_factors" || command == "getCurrency" ||
            command == "getMode" || command == "getUniverseId" ||
            command == "getUniverse_id") {
            return DOMAIN_CHAR;
        }
    }

    if (llSubStringIndex(command, "GET_ACTIVE_CHARACTER") == 0 ||
        llSubStringIndex(command, "SET_ACTIVE_CHARACTER") == 0 ||
        llSubStringIndex(command, "UPDATE_CURRENCY") == 0 ||
        llSubStringIndex(command, "FORCE_STIPEND_PAYOUT") == 0 ||
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

    // Default
    return DOMAIN_CHAR;
}

// ====================== MAIN ROUTER ======================

default {

    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;

        debugLog("Bridge_Main INIT");
        llListen(INVENTORY_CHANNEL, "", NULL_KEY, "");
    }

    // HUD → Bridge_Main
    link_message(integer sender_num, integer num, string msg, key id) {

        debugLog("LINK_MESSAGE: sender=" + (string)sender_num +
                 ", channel=" + (string)num +
                 ", msg='" + msg + "'");

        // Check for response messages FIRST (on channel 0 only)
        // Responses from Bridge modules on channel 0 should be forwarded to all listeners
        // Use LINK_OTHERS to prevent forwarding back to ourselves (no infinite loop)
        if (num == 0) {
            if (msg == "currency" || msg == "currency_ERROR" || 
                llSubStringIndex(msg, "_ERROR") > 0 || llSubStringIndex(msg, " loaded") > 0) {
                debugLog("Response detected: '" + msg + "' from link " + (string)sender_num + " - forwarding to LINK_OTHERS");
                llMessageLinked(LINK_OTHERS, 0, msg, id);
            }
            // All other channel 0 messages are internal HUD commands - ignore them for routing
            return;
        }

        // Only accept messages on FS_BRIDGE_CHANNEL for routing
        if (num != FS_BRIDGE_CHANNEL) {
            return;
        }

        // Parse protocol
        list parts = llParseString2List(msg, ["|"], []);
        string domain;
        string command;
        string payload;

        if (llGetListLength(parts) == 1) {
            command = msg;
            payload = (string)id;
            domain = getDomainForCommand(command);
        } else {
            domain = llList2String(parts, 0);
            command = llList2String(parts, 1);
            payload = llDumpList2String(llList2List(parts, 2, -1), "|");
        }

        debugLog("Parsed domain=" + domain + " command=" + command);

        // ====================== ROUTE TO MODULE ======================

        if (domain == DOMAIN_INV) {
            debugLog("→ Inventory");
            llMessageLinked(LINK_SET, INVENTORY_CHANNEL, command, payload);
            return;
        }

        if (domain == DOMAIN_STIP) {
            debugLog("→ Stipends");
            // Bridge Stipends expects MODULE_CHANNEL with format: DOMAIN|COMMAND|PAYLOAD
            integer senderLink = sender_num;
            string fullMessage = domain + "|" + command + "|" + payload;
            llMessageLinked(LINK_SET, MODULE_CHANNEL, fullMessage, NULL_KEY);
            return;
        }

        if (domain == DOMAIN_CONS) {
            debugLog("→ Consumables");
            llMessageLinked(LINK_SET, CONSUMABLES_CHANNEL, command, payload);
            return;
        }

        if (domain == DOMAIN_CLASS) {
            debugLog("→ Class");
            // CLASS commands are also routed to MODULE_CHANNEL (handled by Bridge Stipends or Bridge Characters)
            integer senderLink = sender_num;
            string fullMessage = domain + "|" + command + "|" + payload;
            llMessageLinked(LINK_SET, MODULE_CHANNEL, fullMessage, NULL_KEY);
            return;
        }

        if (domain == DOMAIN_UNIV) {
            debugLog("→ Universe");
            llMessageLinked(LINK_SET, UNIVERSE_CHANNEL, command, payload);
            return;
        }

        // Default → Character module
        debugLog("→ Character");
        // Bridge Characters expects MODULE_CHANNEL with format: DOMAIN|COMMAND|PAYLOAD|SENDERLINK
        integer senderLink = sender_num;
        string fullMessage = domain + "|" + command + "|" + payload + "|" + (string)senderLink;
        llMessageLinked(LINK_SET, MODULE_CHANNEL, fullMessage, NULL_KEY);
    }

    // World object inventory messages (fGiveItem, fTakeItem)
    listen(integer channel, string name, key id, string msg) {
        if (channel == INVENTORY_CHANNEL) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string command = llList2String(parts, 0);
                string payload = llDumpList2String(llList2List(parts, 1, -1), "|");
                llMessageLinked(LINK_SET, INVENTORY_CHANNEL, command, payload);
            }
        }
    }
}