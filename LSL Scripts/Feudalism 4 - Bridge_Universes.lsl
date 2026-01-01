// Feudalism 4 - Bridge Universes Module
// ============================================================================
// Handles universe operations: IS_BANNED
// ============================================================================

// Import constants
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
integer FS_BRIDGE_CHANNEL = -777001;
integer MODULE_CHANNEL = -777002;
string DOMAIN_UNIV = "UNIV";

// Request tracking
list pendingUnivOps;
integer MAX_PENDING_UNIV_OPS = 10;

// =========================== UTILITY FUNCTIONS ==============================

string extractFirestoreValue(string fieldData) {
    if (fieldData == JSON_INVALID || fieldData == "") {
        return "";
    }
    
    string stringVal = llJsonGetValue(fieldData, ["stringValue"]);
    if (stringVal != JSON_INVALID && stringVal != "") {
        return stringVal;
    }
    
    string intVal = llJsonGetValue(fieldData, ["integerValue"]);
    if (intVal != JSON_INVALID && intVal != "") {
        return intVal;
    }
    
    return "";
}

cleanupTrackingLists() {
    if (llGetListLength(pendingUnivOps) > MAX_PENDING_UNIV_OPS * 5) {
        pendingUnivOps = llDeleteSubList(pendingUnivOps, 0, 4);
    }
}

// =========================== UNIVERSE OPERATIONS ===========================

// Check if character is banned in universe
checkBanned(string characterID, string universeID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
        return;
    }
    
    if (characterID == "" || universeID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
        return;
    }
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/universes/" + universeID;
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    pendingUnivOps += [requestId, "IS_BANNED", senderLink, characterID];
    cleanupTrackingLists();
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Module initialized
    }
    
    // Handle routed commands from Bridge_Main
    link_message(integer sender_num, integer num, string msg, key id) {
        if (num != MODULE_CHANNEL) return;
        
        list parts = llParseString2List(msg, ["|"], []);
        if (llGetListLength(parts) < 4) return;
        
        string domain = llList2String(parts, 0);
        if (domain != DOMAIN_UNIV) return;
        
        string command = llList2String(parts, 1);
        string payload = llList2String(parts, 2);
        integer originalSenderLink = (integer)llList2String(parts, 3);
        
        // Route command
        if (llSubStringIndex(command, "IS_BANNED") == 0) {
            // Parse: IS_BANNED|<transactionId>|<characterId>|<universeId>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            string universeID;
            if (llGetListLength(cmdParts) == 4) {
                characterID = llList2String(cmdParts, 2);
                universeID = llList2String(cmdParts, 3);
            } else if (payload != "") {
                list payloadParts = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts) >= 2) {
                    characterID = llList2String(payloadParts, 0);
                    universeID = llList2String(payloadParts, 1);
                }
            }
            checkBanned(characterID, universeID, originalSenderLink);
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        integer opIndex = llListFindList(pendingUnivOps, [request_id]);
        
        if (opIndex != -1) {
            string operation = llList2String(pendingUnivOps, opIndex + 1);
            
            // Handle IS_BANNED
            if (operation == "IS_BANNED") {
                integer senderLink = llList2Integer(pendingUnivOps, opIndex + 2);
                string characterID = llList2String(pendingUnivOps, opIndex + 3);
                
                pendingUnivOps = llDeleteSubList(pendingUnivOps, opIndex, opIndex + 3);
                
                if (status == 200) {
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        string bannedCharsField = llJsonGetValue(fields, ["bannedCharacters"]);
                        if (bannedCharsField != JSON_INVALID && bannedCharsField != "") {
                            string arrayValue = llJsonGetValue(bannedCharsField, ["arrayValue"]);
                            if (arrayValue != JSON_INVALID && arrayValue != "") {
                                string values = llJsonGetValue(arrayValue, ["values"]);
                                if (values != JSON_INVALID && values != "") {
                                    integer isBanned = 0;
                                    integer i = 0;
                                    string firstItem = llJsonGetValue(values, [0]);
                                    if (firstItem != JSON_INVALID && firstItem != "") {
                                        while (i < 100) {
                                            string item = llJsonGetValue(values, [i]);
                                            if (item == JSON_INVALID || item == "") {
                                                jump done;
                                            }
                                            string stringVal = extractFirestoreValue(item);
                                            if (stringVal == characterID) {
                                                isBanned = 1;
                                                jump done;
                                            }
                                            i++;
                                        }
                                    }
                                    @done;
                                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", (string)isBanned);
                                } else {
                                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
                                }
                            } else {
                                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
                            }
                        } else {
                            llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
                        }
                    } else {
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
                    }
                } else if (status == 404) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED_ERROR", "Status " + (string)status);
                }
                return;
            }
        }
    }
}

