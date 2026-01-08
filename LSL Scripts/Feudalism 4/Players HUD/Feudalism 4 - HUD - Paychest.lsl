// ============================================================================
// Feudalism 4 - HUD Paychest Handler
// ============================================================================
// Handles all paychest-related communication and Bridge responses
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

// Time formatting helper
string formatTime(integer seconds) {
    if (seconds <= 0) return "just now";

    integer mins = seconds / 60;
    integer hrs  = mins / 60;
    integer days = hrs / 24;

    mins = mins % 60;
    hrs  = hrs % 24;

    string out = "";

    if (days > 0) {
        string dayStr = " day";
        if (days != 1) {
            dayStr = dayStr + "s";
        }
        out = out + (string)days + dayStr;
    }
    
    if (hrs > 0) {
        string prefix = "";
        if (out != "") {
            prefix = ", ";
        }
        string hourStr = " hour";
        if (hrs != 1) {
            hourStr = hourStr + "s";
        }
        out = out + prefix + (string)hrs + hourStr;
    }
    
    if (mins > 0) {
        string prefix = "";
        if (out != "") {
            prefix = ", ";
        }
        string minStr = " minute";
        if (mins != 1) {
            minStr = minStr + "s";
        }
        out = out + prefix + (string)mins + minStr;
    }

    if (out == "") {
        out = (string)seconds + " seconds";
    }

    return out;
}

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;
integer INVENTORY_CACHE_CHANNEL = 9001;  // Channel for InventoryCache communication
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Firestore Bridge responses

// =========================== STATE VARIABLES ================================
// Owner info
key ownerKey;
string ownerUUID;

// Paychest handler state
list pendingPaychestTransactions;  // [tx, chestId, command, ...]
integer MAX_PENDING_PAYCHEST_TX = 20;

// Currency cache (for payouts)
integer currencyGold = 0;
integer currencySilver = 0;
integer currencyCopper = 0;

// =========================== PAYCHEST HANDLER ===============================

// Cleanup old transactions
cleanupPaychestTransactions() {
    if (llGetListLength(pendingPaychestTransactions) > MAX_PENDING_PAYCHEST_TX * 4) {
        pendingPaychestTransactions = llDeleteSubList(pendingPaychestTransactions, 0, 3);
    }
}

// Update inventory delta (for currency)
updateInventoryDelta(string itemName, integer delta) {
    string json = "{\"item\":\"" + itemName + "\",\"delta\":" + (string)delta + "}";
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_ADD_DELTA", json);
    debugLog("Added inventory delta: " + itemName + " = " + (string)delta);
}

// Flush inventory deltas to Bridge
flushInventoryDeltas() {
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_GET_DELTAS", "");
}

// Send response to paychest
sendPaychestResponse(string chestId, string tx, string status, string message) {
    string response = "PAYCHEST_RESULT," + chestId + "," + tx + "," + status + "," + message;
    debugLog("HUD → Paychest: PAYCHEST_RESULT='" + response + "'");
    llRegionSayTo((key)chestId, HUD_CHANNEL, response);
    debugLog("Sent paychest response: " + response);
}

// Handle paychest command from paychest object
handlePaychestCommand(string message) {
    debugLog("handlePaychestCommand() received: " + message);
    list parts = llCSV2List(message);
    if (llGetListLength(parts) < 3) {
        debugLog("ERROR: Paychest command has < 3 parts");
        return;
    }
    
    string cmd = llList2String(parts, 0);
    string chestId = llList2String(parts, 1);
    string tx = llList2String(parts, 2);
    
    debugLog("Parsed paychest command - cmd: " + cmd + ", chestId: " + chestId + ", tx: " + tx);
    
    cleanupPaychestTransactions();
    
    // Get active character ID from LSD
    string characterId = llLinksetDataRead("characterId");
    debugLog("Character ID from LSD: " + characterId);
    if (characterId == "" || characterId == "JSON_INVALID") {
        debugLog("ERROR: No active character found");
        sendPaychestResponse(chestId, tx, "ERROR", "No active character");
        return;
    }
    
    // PAYCHEST_GET_ACTIVE_CHARACTER
    if (cmd == "PAYCHEST_GET_ACTIVE_CHARACTER") {
        pendingPaychestTransactions += [tx, chestId, "GET_ACTIVE_CHARACTER", characterId];
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CHAR|GET_ACTIVE_CHARACTER|" + ownerUUID, (key)((string)llGetLinkNumber()));
        return;
    }
    
    // PAYCHEST_REQUEST_ACTIVE_CHARACTER (from Paychest requesting this HUD's active character)
    if (cmd == "PAYCHEST_REQUEST_ACTIVE_CHARACTER") {
        debugLog("PAYCHEST_REQUEST_ACTIVE_CHARACTER received from Paychest: " + chestId);
        
        // Get active character ID from LSD
        string activeCharacterId = llLinksetDataRead("characterId");
        if (activeCharacterId == "" || activeCharacterId == "JSON_INVALID") {
            activeCharacterId = "NULL";
        }
        
        debugLog("Responding with activeCharacterId: " + activeCharacterId);
        
        // Respond directly to Paychest
        string response = "PAYCHEST_ACTIVE_CHARACTER_RESPONSE," + chestId + "," + tx + "," + activeCharacterId;
        llRegionSayTo((key)chestId, HUD_CHANNEL, response);
        
        return;
    }
    
    // PAYCHEST_GET_STIPEND_DATA
    if (cmd == "PAYCHEST_GET_STIPEND_DATA") {
        debugLog("HUD RECEIVED PAYCHEST_GET_STIPEND_DATA: raw='" + message + "'");
        debugLog("HUD parsed: chestId=" + chestId + ", tx=" + tx);
        debugLog("Processing PAYCHEST_GET_STIPEND_DATA, adding to pending transactions");
        pendingPaychestTransactions += [tx, chestId, "GET_STIPEND_DATA", characterId];
        string bridgeMsg = "STIP|GET_STIPEND_DATA|" + tx + "|" + characterId;
        debugLog("HUD → Bridge_Main: STIP|GET_STIPEND_DATA|" + tx + "|" + characterId + "|" + (string)llGetLinkNumber());
        debugLog("Sending to Bridge: " + bridgeMsg);
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, bridgeMsg, (key)((string)llGetLinkNumber()));
        return;
    }
    
    // PAYCHEST_GET_LAST_PAID
    if (cmd == "PAYCHEST_GET_LAST_PAID") {
        pendingPaychestTransactions += [tx, chestId, "GET_LAST_PAID", characterId];
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "STIP|GET_STIPEND_DATA|" + tx + "|" + characterId, (key)((string)llGetLinkNumber()));
        return;
    }
    
    // PAYCHEST_PAYOUT
    if (cmd == "PAYCHEST_PAYOUT") {
        if (llGetListLength(parts) >= 4) {
            integer ignoreCooldown = (integer)llList2String(parts, 3);
            pendingPaychestTransactions += [tx, chestId, "PAYOUT", characterId + "|" + (string)ignoreCooldown];
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "STIP|GET_STIPEND_DATA|" + tx + "|" + characterId, (key)((string)llGetLinkNumber()));
        }
        return;
    }
    
    // PAYCHEST_CLASS_LIST
    if (cmd == "PAYCHEST_CLASS_LIST") {
        pendingPaychestTransactions += [tx, chestId, "CLASS_LIST", ""];
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CLASS|GET_CLASS_LIST", (key)((string)llGetLinkNumber()));
        return;
    }
    
    // PAYCHEST_CLASS_STIPEND
    if (cmd == "PAYCHEST_CLASS_STIPEND") {
        if (llGetListLength(parts) >= 4) {
            string classId = llList2String(parts, 3);
            pendingPaychestTransactions += [tx, chestId, "CLASS_STIPEND", classId];
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CLASS|GET_CLASS_STIPEND|" + classId, (key)((string)llGetLinkNumber()));
        }
        return;
    }
    
    // PAYCHEST_GET_USER_ACTIVE_CHARACTER
    if (cmd == "PAYCHEST_GET_USER_ACTIVE_CHARACTER") {
        if (llGetListLength(parts) >= 4) {
            string userId = llList2String(parts, 3);
            pendingPaychestTransactions += [tx, chestId, "GET_USER_ACTIVE_CHARACTER", userId];
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CHAR|GET_ACTIVE_CHARACTER|" + userId, (key)((string)llGetLinkNumber()));
        }
        return;
    }
    
    // PAYCHEST_GIVE_PAY
    if (cmd == "PAYCHEST_GIVE_PAY") {
        if (llGetListLength(parts) >= 4) {
            string targetCharacterId = llList2String(parts, 3);
            pendingPaychestTransactions += [tx, chestId, "GIVE_PAY", targetCharacterId];
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "STIP|GET_STIPEND_DATA|" + tx + "|" + targetCharacterId, (key)((string)llGetLinkNumber()));
        }
        return;
    }
    
    // PAYCHEST_FORCE_STIPEND_PAYOUT
    if (cmd == "PAYCHEST_FORCE_STIPEND_PAYOUT") {
        if (llGetListLength(parts) >= 4) {
            string charId = llList2String(parts, 3);
            pendingPaychestTransactions += [tx, chestId, "FORCE_STIPEND_PAYOUT", charId];
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CHAR|FORCE_STIPEND_PAYOUT|" + charId, (key)((string)llGetLinkNumber()));
        }
        return;
    }
}

// Handle Bridge responses for paychest transactions
handlePaychestBridgeResponse(string msg, key id) {
    debugLog("handlePaychestBridgeResponse() - msg: " + msg + ", id: " + (string)id);
    debugLog("Pending transactions count: " + (string)(llGetListLength(pendingPaychestTransactions) / 4));
    
    // Handle USER_ACTIVE_CHARACTER messages (must come before pending transaction matching)
    if (llSubStringIndex(msg, "USER_ACTIVE_CHARACTER|") == 0) {
        debugLog("Received USER_ACTIVE_CHARACTER message");
        
        // Extract characterId
        list p = llParseString2List(msg, ["|"], []);
        string characterId = llList2String(p, 1);
        if (characterId == "") {
            characterId = "NULL";
        }
        
        debugLog("Extracted characterId: " + characterId);
        
        // Find the FIRST pending transaction with command GET_USER_ACTIVE_CHARACTER
        integer txIndex = -1;
        integer i = 0;
        integer found = FALSE;
        while (i < llGetListLength(pendingPaychestTransactions) && !found) {
            string command = llList2String(pendingPaychestTransactions, i + 2);
            if (command == "GET_USER_ACTIVE_CHARACTER") {
                txIndex = i;
                found = TRUE;
                debugLog("Found GET_USER_ACTIVE_CHARACTER pending transaction at index " + (string)txIndex);
            }
            i = i + 4;
        }
        
        if (txIndex == -1) {
            debugLog("No pending GET_USER_ACTIVE_CHARACTER transaction found, ignoring USER_ACTIVE_CHARACTER message");
            return;
        }
        
        // Get chestId and tx from the pending transaction
        string tx = llList2String(pendingPaychestTransactions, txIndex);
        string chestId = llList2String(pendingPaychestTransactions, txIndex + 1);
        
        debugLog("Forwarding USER_ACTIVE_CHARACTER to Paychest - chestId: " + chestId + ", tx: " + tx + ", characterId: " + characterId);
        
        // Forward the result to the Paychest
        string response = "PAYCHEST_USER_ACTIVE_CHARACTER_RESULT," + chestId + "," + tx + "," + characterId;
        llRegionSayTo((key)chestId, HUD_CHANNEL, response);
        
        // Remove the pending transaction
        pendingPaychestTransactions = llDeleteSubList(pendingPaychestTransactions, txIndex, txIndex + 3);
        
        debugLog("Removed pending GET_USER_ACTIVE_CHARACTER transaction");
        return;
    }
    
    // Handle FORCE_STIPEND_PAYOUT_RESULT messages (must come before pending transaction matching)
    if (llSubStringIndex(msg, "FORCE_STIPEND_PAYOUT_RESULT|") == 0) {
        debugLog("Received FORCE_STIPEND_PAYOUT_RESULT message");
        
        // Parse the message
        list p = llParseString2List(msg, ["|"], []);
        string status = llList2String(p, 1);
        
        debugLog("FORCE_STIPEND_PAYOUT_RESULT status: " + status);
        
        // Find the FIRST pending transaction with command FORCE_STIPEND_PAYOUT
        integer txIndex = -1;
        integer i = 0;
        integer found = FALSE;
        while (i < llGetListLength(pendingPaychestTransactions) && !found) {
            string command = llList2String(pendingPaychestTransactions, i + 2);
            if (command == "FORCE_STIPEND_PAYOUT") {
                txIndex = i;
                found = TRUE;
                debugLog("Found FORCE_STIPEND_PAYOUT pending transaction at index " + (string)txIndex);
            }
            i = i + 4;
        }
        
        if (txIndex == -1) {
            debugLog("No pending FORCE_STIPEND_PAYOUT transaction found, ignoring message");
            return;
        }
        
        // Get chestId and tx from the pending transaction
        string tx = llList2String(pendingPaychestTransactions, txIndex);
        string chestId = llList2String(pendingPaychestTransactions, txIndex + 1);
        
        // Remove the pending transaction
        pendingPaychestTransactions = llDeleteSubList(pendingPaychestTransactions, txIndex, txIndex + 3);
        
        // Build response message
        string resultMsg;
        if (status == "OK") {
            string gold = llList2String(p, 2);
            string silver = llList2String(p, 3);
            string copper = llList2String(p, 4);
            
            resultMsg = "Forced stipend payout completed.\n" +
                       "Amount: " + gold + " gold, " +
                                   silver + " silver, " +
                                   copper + " copper.";
            
            debugLog("FORCE_STIPEND_PAYOUT success - gold: " + gold + ", silver: " + silver + ", copper: " + copper);
            sendPaychestResponse(chestId, tx, "OK", resultMsg);
        } else {
            string reason = llList2String(p, 2);
            resultMsg = "Forced stipend payout failed: " + reason;
            
            debugLog("FORCE_STIPEND_PAYOUT error - reason: " + reason);
            sendPaychestResponse(chestId, tx, "ERROR", resultMsg);
        }
        
        return;
    }
    
    // Find matching transaction by checking all pending transactions
    integer txIndex = -1;
    integer i = 0;
    integer found = FALSE;
    while (i < llGetListLength(pendingPaychestTransactions) && !found) {
        string tx = llList2String(pendingPaychestTransactions, i);
        string command = llList2String(pendingPaychestTransactions, i + 2);
        
        debugLog("Checking pending tx[" + (string)(i/4) + "]: tx=" + tx + ", command=" + command);
        
        // Match by command type and response message
        if ((msg == "ACTIVE_CHARACTER" && (command == "GET_ACTIVE_CHARACTER" || command == "GET_USER_ACTIVE_CHARACTER")) ||
            (llSubStringIndex(msg, "STIPEND_DATA") == 0 && (command == "GET_STIPEND_DATA" || command == "GET_LAST_PAID" || command == "PAYOUT" || command == "GIVE_PAY")) ||
            (llSubStringIndex(msg, "LAST_PAID_UPDATED") == 0 && command == "UPDATE_LAST_PAID_PENDING") ||
            (llSubStringIndex(msg, "CLASS_LIST") == 0 && command == "CLASS_LIST") ||
            (llSubStringIndex(msg, "CLASS_STIPEND") == 0 && command == "CLASS_STIPEND") ||
            (llSubStringIndex(msg, "CURRENCY_UPDATED") == 0)) {
            txIndex = i;
            found = TRUE;
            debugLog("MATCH FOUND at index " + (string)txIndex);
        }
        i = i + 4;
    }
    
    if (txIndex == -1) {
        debugLog("No matching transaction found for msg: " + msg);
        return;  // Not a paychest transaction
    }
    
    string tx = llList2String(pendingPaychestTransactions, txIndex);
    string chestId = llList2String(pendingPaychestTransactions, txIndex + 1);
    string command = llList2String(pendingPaychestTransactions, txIndex + 2);
    string param = llList2String(pendingPaychestTransactions, txIndex + 3);
    
    // Remove from pending (4 elements: tx, chestId, command, param)
    pendingPaychestTransactions = llDeleteSubList(pendingPaychestTransactions, txIndex, txIndex + 3);
    
    // Handle GET_ACTIVE_CHARACTER response
    if (msg == "ACTIVE_CHARACTER" && (command == "GET_ACTIVE_CHARACTER" || command == "GET_USER_ACTIVE_CHARACTER")) {
        string characterId = (string)id;
        if (command == "GET_USER_ACTIVE_CHARACTER") {
            string response = "PAYCHEST_USER_ACTIVE_CHARACTER_RESULT," + chestId + "," + tx + "," + characterId;
            llRegionSayTo((key)chestId, HUD_CHANNEL, response);
        } else {
            sendPaychestResponse(chestId, tx, "OK", "Active character: " + characterId);
        }
        return;
    }
    
    // Handle STIPEND_DATA response
    if (llSubStringIndex(msg, "STIPEND_DATA") == 0) {
        debugLog("HUD RECEIVED STIPEND_DATA: raw='" + msg + "'");
        debugLog("Processing STIPEND_DATA response, command: " + command);
        if (msg == "STIPEND_DATA") {
            // Format: STIPEND_DATA|<json>|<lastPaid>
            string data = (string)id;
            debugLog("STIPEND_DATA payload: " + data);
            list dataParts = llParseString2List(data, ["|"], []);
            if (llGetListLength(dataParts) >= 2) {
                string stipendJson = llList2String(dataParts, 0);
                string lastPaidStr = llList2String(dataParts, 1);
                debugLog("Parsed - stipendJson: " + stipendJson + ", lastPaid: " + lastPaidStr);
                
                if (command == "GET_STIPEND_DATA" || command == "GET_LAST_PAID") {
                    // Extract gold, silver, copper from JSON
                    string goldStr = llJsonGetValue(stipendJson, ["gold"]);
                    string silverStr = llJsonGetValue(stipendJson, ["silver"]);
                    string copperStr = llJsonGetValue(stipendJson, ["copper"]);
                    integer gold = (integer)goldStr;
                    integer silver = (integer)silverStr;
                    integer copper = (integer)copperStr;
                    
                    debugLog("Extracted currency - gold: " + (string)gold + ", silver: " + (string)silver + ", copper: " + (string)copper);
                    
                    string message = "Stipend: " + (string)gold + " gold, " + (string)silver + " silver, " + (string)copper + " copper";
                    if (command == "GET_LAST_PAID") {
                        integer lastPaid = (integer)lastPaidStr;
                        integer now = llGetUnixTime();
                        integer timeSince = now - lastPaid;
                        integer timeUntil = 604800 - timeSince;  // 7 days in seconds
                        if (timeUntil < 0) timeUntil = 0;
                        
                        string timeSinceFormatted = formatTime(timeSince);
                        string timeUntilFormatted = formatTime(timeUntil);
                        
                        message = message + "\nLast paid: " + timeSinceFormatted + " ago\nNext eligible: in " + timeUntilFormatted;
                    }
                    debugLog("Sending paychest response for GET_STIPEND_DATA");
                    sendPaychestResponse(chestId, tx, "OK", message);
                } else if (command == "PAYOUT" || command == "GIVE_PAY") {
                    // Apply currency deltas and update timestamp
                    string goldStr = llJsonGetValue(stipendJson, ["gold"]);
                    string silverStr = llJsonGetValue(stipendJson, ["silver"]);
                    string copperStr = llJsonGetValue(stipendJson, ["copper"]);
                    integer gold = (integer)goldStr;
                    integer silver = (integer)silverStr;
                    integer copper = (integer)copperStr;
                    
                    // Extract characterId and ignoreCooldown from param (for PAYOUT, param is "characterId|ignoreCooldown")
                    string characterId = param;
                    integer ignoreCooldown = 0;
                    if (command == "PAYOUT") {
                        list paramParts = llParseString2List(param, ["|"], []);
                        if (llGetListLength(paramParts) >= 1) {
                            characterId = llList2String(paramParts, 0);
                        }
                        if (llGetListLength(paramParts) >= 2) {
                            ignoreCooldown = (integer)llList2String(paramParts, 1);
                        }
                    }
                    
                    // Check cooldown (unless ignored)
                    integer lastPaidSeconds = (integer)lastPaidStr;
                    if (lastPaidSeconds < 0) {
                        lastPaidSeconds = 0;  // Default if never paid
                    }
                    
                    integer now = llGetUnixTime();
                    integer cooldownSeconds = 604800;  // 7 days
                    integer timeSinceLastPaid = now - lastPaidSeconds;
                    
                    if (ignoreCooldown == 0 && timeSinceLastPaid < cooldownSeconds) {
                        // Cooldown not expired, reject payout
                        integer timeRemaining = cooldownSeconds - timeSinceLastPaid;
                        string timeRemainingFormatted = formatTime(timeRemaining);
                        string errorMsg = "Cooldown not expired. Next payout available in " + timeRemainingFormatted + ".";
                        sendPaychestResponse(chestId, tx, "ERROR", errorMsg);
                        return;
                    }
                    
                    // Cooldown passed or ignored, proceed with payout
                    // Apply currency deltas to currency cache (not inventory)
                    currencyGold = currencyGold + gold;
                    currencySilver = currencySilver + silver;
                    currencyCopper = currencyCopper + copper;
                    
                    // Update currency in Firestore via Bridge
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CHAR|UPDATE_CURRENCY|" + characterId + "|" + (string)gold + "|" + (string)silver + "|" + (string)copper, (key)((string)llGetLinkNumber()));
                    
                    // Update lastPaidTimestamp to now (current payout time)
                    // Only update if not ignoring cooldown (admin bypass doesn't update timestamp)
                    if (ignoreCooldown == 0) {
                        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "STIP|UPDATE_LAST_PAID|" + characterId + "|" + (string)now, (key)((string)llGetLinkNumber()));
                        // Track this update
                        pendingPaychestTransactions += [tx, chestId, "UPDATE_LAST_PAID_PENDING", characterId];
                    }
                    
                    // Calculate next available payout time
                    integer nextAvailableSeconds;
                    if (ignoreCooldown == 1) {
                        // Admin bypass: next available is based on old timestamp (they can keep getting pay)
                        nextAvailableSeconds = lastPaidSeconds + cooldownSeconds;
                    } else {
                        // Normal payout: next available is based on current time (timestamp will be updated)
                        nextAvailableSeconds = now + cooldownSeconds;
                    }
                    
                    // Build payout message with timestamp info
                    // Format: "Payout: X gold, Y silver, Z copper|lastPaidSeconds|nextAvailableSeconds"
                    // lastPaidSeconds = previous payout time (for "last paid X ago")
                    // nextAvailableSeconds = when next payout will be available
                    string payoutAmount = (string)gold + " gold, " + (string)silver + " silver, " + (string)copper + " copper";
                    string message = "Payout: " + payoutAmount + "|" + (string)lastPaidSeconds + "|" + (string)nextAvailableSeconds;
                    sendPaychestResponse(chestId, tx, "OK", message);
                }
            }
        } else if (msg == "STIPEND_DATA_ERROR") {
            sendPaychestResponse(chestId, tx, "ERROR", (string)id);
        }
        return;
    }
    
    // Handle UPDATE_LAST_PAID response
    if (llSubStringIndex(msg, "LAST_PAID_UPDATED") == 0) {
        if (msg == "LAST_PAID_UPDATED") {
            if (command == "UPDATE_LAST_PAID_PENDING") {
                // Payout already sent complete message, don't send duplicate confirmation
                // The payout response already includes all the information
            }
        } else if (msg == "LAST_PAID_UPDATED_ERROR") {
            sendPaychestResponse(chestId, tx, "ERROR", (string)id);
        }
        return;
    }
    
    // Handle CLASS_LIST response
    if (llSubStringIndex(msg, "CLASS_LIST") == 0 && command == "CLASS_LIST") {
        if (msg == "CLASS_LIST_ERROR") {
            sendPaychestResponse(chestId, tx, "ERROR", "Failed to get class list");
        } else {
            // Format: CLASS_LIST|<buttonListString>
            string buttonListString = llGetSubString(msg, 11, -1);  // Remove "CLASS_LIST|" prefix
            string response = "PAYCHEST_CLASS_LIST_RESULT," + chestId + "," + tx + "," + buttonListString;
            llRegionSayTo((key)chestId, HUD_CHANNEL, response);
        }
        return;
    }
    
    // Handle CLASS_STIPEND response
    if (llSubStringIndex(msg, "CLASS_STIPEND") == 0 && command == "CLASS_STIPEND") {
        if (llSubStringIndex(msg, "CLASS_STIPEND_ERROR") == 0) {
            // Format: CLASS_STIPEND_ERROR|<reason>
            // Send NOT_FOUND for any error (format: PAYCHEST_RESULT,CLASS_STIPEND,<chestId>,<tx>,NOT_FOUND)
            string response = "PAYCHEST_RESULT,CLASS_STIPEND," + chestId + "," + tx + ",NOT_FOUND";
            llRegionSayTo((key)chestId, HUD_CHANNEL, response);
        } else {
            // Format: CLASS_STIPEND|<message>
            // Extract stipend value from message (format: "Class stipend: X gold, Y silver, Z copper.")
            string message = llGetSubString(msg, 14, -1);  // Remove "CLASS_STIPEND|" prefix
            // Send the stipend value (format: PAYCHEST_RESULT,CLASS_STIPEND,<chestId>,<tx>,<stipendValue>)
            string response = "PAYCHEST_RESULT,CLASS_STIPEND," + chestId + "," + tx + "," + message;
            llRegionSayTo((key)chestId, HUD_CHANNEL, response);
        }
        return;
    }
    
    // Handle CURRENCY_UPDATED response
    if (llSubStringIndex(msg, "CURRENCY_UPDATED") == 0) {
        // Currency update confirmed - no action needed, optionally log success
        debugLog("Currency updated successfully");
        return;
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        
        // Clear any leftover corrupted entries from previous versions
        if (llGetListLength(pendingPaychestTransactions) % 4 != 0) {
            debugLog("HUD_Paychest: Detected misaligned pending transactions, clearing.");
            pendingPaychestTransactions = [];
        }
        
        debugLog("HUD INIT: HUD_CHANNEL=" + (string)HUD_CHANNEL + ", FS_BRIDGE_CHANNEL=" + (string)FS_BRIDGE_CHANNEL);
    }
    
    link_message(integer sender, integer num, string msg, key id) {
        // PAYCHEST commands from HUD_Core
        if (num == 1001) {
            handlePaychestCommand(msg);
            return;
        }
        
        // Bridge responses
        if (num == FS_BRIDGE_CHANNEL) {
            debugLog("HUD_Paychest received Bridge response - msg: " + msg + ", id: " + (string)id + ", sender: " + (string)sender);
            handlePaychestBridgeResponse(msg, id);
            return;
        }
    }
}

