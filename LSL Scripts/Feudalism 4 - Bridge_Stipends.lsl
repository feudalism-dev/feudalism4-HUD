// Feudalism 4 - Bridge Stipends Module
// ============================================================================
// Handles stipend operations: GET_STIPEND_DATA, UPDATE_LAST_PAID
// ============================================================================

// Import constants
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
integer FS_BRIDGE_CHANNEL = -777001;
integer MODULE_CHANNEL = -777002;
string DOMAIN_STIP = "STIP";

// Request tracking
list pendingStipendOps;
integer MAX_PENDING_STIPEND_OPS = 10;

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
    
    string boolVal = llJsonGetValue(fieldData, ["booleanValue"]);
    if (boolVal != JSON_INVALID && boolVal != "") {
        return boolVal;
    }
    
    return "";
}

cleanupTrackingLists() {
    if (llGetListLength(pendingStipendOps) > MAX_PENDING_STIPEND_OPS * 5) {
        pendingStipendOps = llDeleteSubList(pendingStipendOps, 0, 4);
    }
}

// =========================== STIPEND OPERATIONS ============================

// Get stipend data for a character
getStipendData(string characterID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Project ID not configured");
        return;
    }
    
    if (characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Invalid character ID");
        return;
    }
    
    string charUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID;
    
    key requestId = llHTTPRequest(
        charUrl,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    pendingStipendOps += [requestId, "GET_STIPEND_DATA", senderLink];
    cleanupTrackingLists();
}

// Update lastPaidTimestamp for a character
updateLastPaid(string characterID, integer timestamp, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "LAST_PAID_UPDATED_ERROR", "Project ID not configured");
        return;
    }
    
    if (characterID == "" || timestamp < 0) {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "LAST_PAID_UPDATED_ERROR", "Invalid parameters");
        return;
    }
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID + "?updateMask.fieldPaths=lastPaidTimestamp";
    
    list patchBodyParts = [
        "{\"fields\":{\"lastPaidTimestamp\":{\"integerValue\":\"",
        (string)timestamp,
        "\"}}}"
    ];
    string patchBody = llDumpList2String(patchBodyParts, "");
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "PATCH",
            HTTP_MIMETYPE, "application/json"
        ],
        patchBody
    );
    
    pendingStipendOps += [requestId, "UPDATE_LAST_PAID", senderLink];
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
        if (domain != DOMAIN_STIP) return;
        
        string command = llList2String(parts, 1);
        string payload = llList2String(parts, 2);
        integer originalSenderLink = (integer)llList2String(parts, 3);
        
        // Route command
        if (llSubStringIndex(command, "GET_STIPEND_DATA") == 0) {
            // Parse: GET_STIPEND_DATA|<transactionId>|<characterId> or GET_STIPEND_DATA|<characterId>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            if (llGetListLength(cmdParts) == 3) {
                characterID = llList2String(cmdParts, 2);
            } else if (llGetListLength(cmdParts) == 2) {
                characterID = llList2String(cmdParts, 1);
            } else if (payload != "") {
                list payloadParts = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts) >= 2) {
                    characterID = llList2String(payloadParts, 1);
                } else {
                    characterID = payload;
                }
            }
            getStipendData(characterID, originalSenderLink);
        }
        else if (llSubStringIndex(command, "UPDATE_LAST_PAID") == 0) {
            // Parse: UPDATE_LAST_PAID|<transactionId>|<characterId>|<timestamp> or UPDATE_LAST_PAID|<characterId>|<timestamp>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            string timestampStr;
            if (llGetListLength(cmdParts) == 4) {
                characterID = llList2String(cmdParts, 2);
                timestampStr = llList2String(cmdParts, 3);
            } else if (llGetListLength(cmdParts) == 3) {
                characterID = llList2String(cmdParts, 1);
                timestampStr = llList2String(cmdParts, 2);
            } else if (payload != "") {
                list payloadParts = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts) >= 2) {
                    characterID = llList2String(payloadParts, 0);
                    timestampStr = llList2String(payloadParts, 1);
                }
            }
            integer timestamp = (integer)timestampStr;
            updateLastPaid(characterID, timestamp, originalSenderLink);
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        integer opIndex = llListFindList(pendingStipendOps, [request_id]);
        
        if (opIndex != -1) {
            string operation = llList2String(pendingStipendOps, opIndex + 1);
            
            // Handle GET_STIPEND_DATA
            if (operation == "GET_STIPEND_DATA") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 2);
                
                if (status == 200) {
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        string classIdField = llJsonGetValue(fields, ["class_id"]);
                        if (classIdField == JSON_INVALID || classIdField == "") {
                            classIdField = llJsonGetValue(fields, ["classId"]);
                        }
                        string lastPaidField = llJsonGetValue(fields, ["lastPaidTimestamp"]);
                        
                        string classId = "";
                        if (classIdField != JSON_INVALID && classIdField != "") {
                            classId = extractFirestoreValue(classIdField);
                        }
                        
                        integer lastPaidTimestamp = 0;
                        if (lastPaidField != JSON_INVALID && lastPaidField != "") {
                            string lastPaidStr = extractFirestoreValue(lastPaidField);
                            lastPaidTimestamp = (integer)lastPaidStr;
                        }
                        
                        // Get class document to read stipend
                        if (classId != "") {
                            string classUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/classes/" + classId;
                            
                            key classRequestId = llHTTPRequest(
                                classUrl,
                                [
                                    HTTP_METHOD, "GET",
                                    HTTP_MIMETYPE, "application/json"
                                ],
                                ""
                            );
                            
                            pendingStipendOps += [classRequestId, "GET_STIPEND_CLASS", senderLink, (string)lastPaidTimestamp];
                        } else {
                            llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "{\"gold\":0,\"silver\":0,\"copper\":0}|" + (string)lastPaidTimestamp);
                        }
                    } else {
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "No fields in character document");
                    }
                } else if (status == 404) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Character not found");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle GET_STIPEND_CLASS (second step)
            if (operation == "GET_STIPEND_CLASS") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string lastPaidTimestampStr = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status == 200) {
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        string stipendField = llJsonGetValue(fields, ["stipend"]);
                        string stipendJson = "{\"gold\":0,\"silver\":0,\"copper\":0}";
                        
                        if (stipendField != JSON_INVALID && stipendField != "") {
                            // Check if it's a mapValue (object) or a numeric value (legacy)
                            string mapValue = llJsonGetValue(stipendField, ["mapValue"]);
                            if (mapValue != JSON_INVALID && mapValue != "") {
                                // New format: object with gold, silver, copper
                                string mapFields = llJsonGetValue(mapValue, ["fields"]);
                                if (mapFields != JSON_INVALID && mapFields != "") {
                                    string goldField = llJsonGetValue(mapFields, ["gold"]);
                                    string silverField = llJsonGetValue(mapFields, ["silver"]);
                                    string copperField = llJsonGetValue(mapFields, ["copper"]);
                                    
                                    integer gold = 0;
                                    integer silver = 0;
                                    integer copper = 0;
                                    
                                    if (goldField != JSON_INVALID && goldField != "") {
                                        string goldStr = extractFirestoreValue(goldField);
                                        gold = (integer)goldStr;
                                    }
                                    if (silverField != JSON_INVALID && silverField != "") {
                                        string silverStr = extractFirestoreValue(silverField);
                                        silver = (integer)silverStr;
                                    }
                                    if (copperField != JSON_INVALID && copperField != "") {
                                        string copperStr = extractFirestoreValue(copperField);
                                        copper = (integer)copperStr;
                                    }
                                    
                                    stipendJson = "{\"gold\":" + (string)gold + ",\"silver\":" + (string)silver + ",\"copper\":" + (string)copper + "}";
                                }
                            } else {
                                // Legacy format: numeric value (silver units)
                                string stipendStr = extractFirestoreValue(stipendField);
                                integer stipendSilver = (integer)stipendStr;
                                // Convert to 3-currency: assume it's in silver units
                                integer gold = stipendSilver / 100;
                                integer silver = stipendSilver % 100;
                                stipendJson = "{\"gold\":" + (string)gold + ",\"silver\":" + (string)silver + ",\"copper\":0}";
                            }
                        }
                        
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", stipendJson + "|" + lastPaidTimestampStr);
                    } else {
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "{\"gold\":0,\"silver\":0,\"copper\":0}|" + lastPaidTimestampStr);
                    }
                } else if (status == 404) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "{\"gold\":0,\"silver\":0,\"copper\":0}|" + lastPaidTimestampStr);
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle UPDATE_LAST_PAID
            if (operation == "UPDATE_LAST_PAID") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 2);
                
                if (status == 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "LAST_PAID_UPDATED", "OK");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "LAST_PAID_UPDATED_ERROR", "Status " + (string)status);
                }
                return;
            }
        }
    }
}

