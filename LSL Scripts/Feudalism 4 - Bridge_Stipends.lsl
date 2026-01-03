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

// Debug
integer DEBUG_MODE = TRUE;

debugLog(string msg) {
    if (DEBUG_MODE) {
        llOwnerSay("[Bridge_Stipends] " + msg);
    }
}

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

// Convert Unix timestamp to RFC3339 format (simplified)
// Note: This is a basic conversion. For production, consider using a more accurate date library
string unixToRFC3339(integer unixTime) {
    // Calculate components
    integer seconds = unixTime % 60;
    integer minutes = (unixTime / 60) % 60;
    integer hours = (unixTime / 3600) % 24;
    integer daysSinceEpoch = unixTime / 86400;
    
    // Approximate year (1970-01-01 is epoch)
    integer year = 1970;
    integer remainingDays = daysSinceEpoch;
    
    // Simple year calculation (accounting for leap years approximately)
    integer done = FALSE;
    while (remainingDays >= 365 && !done) {
        integer daysInYear = 365;
        if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) {
            daysInYear = 366; // Leap year
        }
        if (remainingDays >= daysInYear) {
            remainingDays = remainingDays - daysInYear;
            year = year + 1;
        } else {
            done = TRUE;
        }
    }
    
    // Approximate month and day (simplified)
    integer month = 1;
    integer day = 1 + remainingDays;
    
    // Adjust for months (simplified - doesn't account for varying month lengths)
    list monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) {
        monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Leap year
    }
    
    integer i = 0;
    while (i < 12 && day > llList2Integer(monthDays, i)) {
        day = day - llList2Integer(monthDays, i);
        month = month + 1;
        i = i + 1;
    }
    
    // Format: YYYY-MM-DDTHH:MM:SSZ
    string result = (string)year + "-";
    if (month < 10) result += "0";
    result += (string)month + "-";
    if (day < 10) result += "0";
    result += (string)day + "T";
    if (hours < 10) result += "0";
    result += (string)hours + ":";
    if (minutes < 10) result += "0";
    result += (string)minutes + ":";
    if (seconds < 10) result += "0";
    result += (string)seconds + "Z";
    
    return result;
}

// =========================== STIPEND OPERATIONS ============================

// Get stipend data for a character
getStipendData(string characterID, integer senderLink) {
    // Atomic stipend fetch pipeline:
    // 1. GET character.class_id and character.lastPaidTimestamp
    // 2. GET class.stipend (atomic)
    // 3. Return stipend JSON + lastPaidTimestamp

    if (FIREBASE_PROJECT_ID == "") {
        debugLog("ERROR: Project ID not configured");
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Project ID not configured");
        return;
    }
    
    if (characterID == "") {
        debugLog("ERROR: Invalid character ID");
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Invalid character ID");
        return;
    }

    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID
        + "?mask.fieldPaths=class_id"
        + "&mask.fieldPaths=lastPaidTimestamp";

    debugLog("Bridge_Stipends HTTP GET: url='" + url + "'");
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    pendingStipendOps += [requestId, "GET_STIPEND_CHAR", senderLink, characterID];
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
        debugLog("Bridge_Stipends INIT: FS_BRIDGE_CHANNEL=" + (string)FS_BRIDGE_CHANNEL);
    }
    
    // Handle routed commands from Bridge_Main
    link_message(integer sender_num, integer num, string msg, key id) {
        debugLog("Bridge_Stipends LINK_MESSAGE: sender=" + (string)sender_num + ", channel=" + (string)num + ", msg='" + msg + "'");
        
        if (num != MODULE_CHANNEL) return;
        
        list parts = llParseString2List(msg, ["|"], []);
        if (llGetListLength(parts) < 3) return;
        
        string domain = llList2String(parts, 0);
        string command = llList2String(parts, 1);
        // New format: DOMAIN|COMMAND|PAYLOAD...
        string payload = llDumpList2String(llList2List(parts, 2, -1), "|");
        
        // Sender link comes from sender_num parameter
        integer originalSenderLink = sender_num;
        
        debugLog("Received command: " + command + ", payload: " + payload + ", senderLink: " + (string)originalSenderLink);
        
        // Handle CLASS|GET_CLASS_STIPEND|<classId>
        if (domain == "CLASS" && llSubStringIndex(command, "GET_CLASS_STIPEND") == 0) {
            string classId = payload;
            if (classId == "") {
                debugLog("ERROR: Invalid class ID");
                llMessageLinked(originalSenderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND|NOT_FOUND", "");
                return;
            }
            
            string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/classes/" + classId
                + "?mask.fieldPaths=stipend";
            
            debugLog("Bridge_Stipends HTTP GET (class stipend): url='" + url + "'");
            
            key requestId = llHTTPRequest(
                url,
                [
                    HTTP_METHOD, "GET",
                    HTTP_MIMETYPE, "application/json"
                ],
                ""
            );
            
            pendingStipendOps += [requestId, "GET_CLASS_STIPEND", originalSenderLink, classId];
            cleanupTrackingLists();
            return;
        }
        
        // Handle CHAR|GET_ACTIVE_CHARACTER|<userId>
        if (domain == "CHAR" && llSubStringIndex(command, "GET_ACTIVE_CHARACTER") == 0) {
            string userId = payload;
            if (userId == "") {
                debugLog("ERROR: Invalid user ID");
                llMessageLinked(originalSenderLink, FS_BRIDGE_CHANNEL, "USER_ACTIVE_CHARACTER|NULL", "");
                return;
            }
            
            string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users/" + userId
                + "?mask.fieldPaths=activeCharacter";
            
            debugLog("Bridge_Stipends HTTP GET (active character): url='" + url + "'");
            
            key requestId = llHTTPRequest(
                url,
                [
                    HTTP_METHOD, "GET",
                    HTTP_MIMETYPE, "application/json"
                ],
                ""
            );
            
            pendingStipendOps += [requestId, "GET_ACTIVE_CHARACTER", originalSenderLink, userId];
            cleanupTrackingLists();
            return;
        }
        
        // Handle CHAR|GIVE_PAY|<characterId>
        if (domain == "CHAR" && llSubStringIndex(command, "GIVE_PAY") == 0) {
            string characterId = payload;
            if (characterId == "") {
                debugLog("ERROR: Invalid character ID");
                llMessageLinked(originalSenderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|INVALID_CHARACTER_ID", "");
                return;
            }
            
            // Step 1: GET character document to get classId
            string url1 = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterId
                + "?mask.fieldPaths=class_id";
            
            debugLog("Bridge_Stipends HTTP GET (character for GIVE_PAY): url='" + url1 + "'");
            
            key requestId1 = llHTTPRequest(
                url1,
                [
                    HTTP_METHOD, "GET",
                    HTTP_MIMETYPE, "application/json"
                ],
                ""
            );
            
            pendingStipendOps += [requestId1, "GIVE_PAY_GET_CHAR", originalSenderLink, characterId];
            cleanupTrackingLists();
            return;
        }
        
        // Handle CHAR|FORCE_STIPEND_PAYOUT|<characterId>
        if (domain == "CHAR" && llSubStringIndex(command, "FORCE_STIPEND_PAYOUT") == 0) {
            string characterId = payload;
            if (characterId == "") {
                debugLog("ERROR: Invalid character ID for FORCE_STIPEND_PAYOUT");
                llMessageLinked(originalSenderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|ERROR|INVALID_CHARACTER_ID", "");
                return;
            }
            
            // Step 1: GET character document to get classId
            string url1 = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterId
                + "?mask.fieldPaths=class_id";
            
            debugLog("Bridge_Stipends HTTP GET (character for FORCE_STIPEND_PAYOUT): url='" + url1 + "'");
            
            key requestId1 = llHTTPRequest(
                url1,
                [
                    HTTP_METHOD, "GET",
                    HTTP_MIMETYPE, "application/json"
                ],
                ""
            );
            
            pendingStipendOps += [requestId1, "FORCE_STIPEND_GET_CHAR", originalSenderLink, characterId];
            cleanupTrackingLists();
            return;
        }
        
        // Only process STIP domain messages for other commands
        if (domain != DOMAIN_STIP) return;
        
        // Route command
        if (llSubStringIndex(command, "GET_STIPEND_DATA") == 0) {
            // Parse: GET_STIPEND_DATA|<transactionId>|<characterId> or GET_STIPEND_DATA|<characterId>
            // The payload from Bridge_Main contains: <tx>|<characterId>
            string characterID;
            string tx = "";
            if (payload != "") {
                list payloadParts = llParseString2List(payload, ["|"], []);
                debugLog("Payload parts count: " + (string)llGetListLength(payloadParts) + ", parts: " + llDumpList2String(payloadParts, ","));
                if (llGetListLength(payloadParts) >= 2) {
                    // Payload format: <tx>|<characterId> - take the last part (characterId)
                    tx = llList2String(payloadParts, 0);
                    characterID = llList2String(payloadParts, llGetListLength(payloadParts) - 1);
                    debugLog("Bridge_Stipends parsed GET_STIPEND_DATA: tx=" + tx + ", characterID=" + characterID + ", senderLink=" + (string)originalSenderLink);
                } else {
                    // Single value in payload - assume it's the characterId
                    characterID = payload;
                    debugLog("Bridge_Stipends parsed GET_STIPEND_DATA: tx=(none), characterID=" + characterID + ", senderLink=" + (string)originalSenderLink);
                }
            } else {
                debugLog("Bridge_Stipends parsed GET_STIPEND_DATA: tx=(none), characterID=(empty), senderLink=" + (string)originalSenderLink);
            }
            debugLog("Extracted characterID: " + characterID + ", calling getStipendData()");
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
        else if (llSubStringIndex(command, "SET_CLASS_STIPEND") == 0) {
            // Payload format: className|gold|silver|copper
            list payloadParts = llParseString2List(payload, ["|"], []);
            if (llGetListLength(payloadParts) != 4) {
                debugLog("ERROR: Invalid SET_CLASS_STIPEND payload: " + payload);
                return;
            }
            
            string className = llList2String(payloadParts, 0);
            string gold      = llList2String(payloadParts, 1);
            string silver    = llList2String(payloadParts, 2);
            string copper    = llList2String(payloadParts, 3);
            
            debugLog("Updating stipend for class " + className +
                       " to " + gold + "|" + silver + "|" + copper);
            
            // Firestore PATCH URL
            string url =
                "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
                "/databases/(default)/documents/classes/" + className +
                "?updateMask.fieldPaths=stipend";
            
            // Firestore body
            string body = 
                "{\"fields\":{\"stipend\":{\"mapValue\":{\"fields\":{"
                + "\"gold\":{\"integerValue\":\"" + gold + "\"},"
                + "\"silver\":{\"integerValue\":\"" + silver + "\"},"
                + "\"copper\":{\"integerValue\":\"" + copper + "\"}"
                + "}}}}}";
            
            key requestId = llHTTPRequest(
                url,
                [
                    HTTP_METHOD, "PATCH",
                    HTTP_MIMETYPE, "application/json"
                ],
                body
            );
            
            // Track operation
            pendingStipendOps += [requestId, "SET_CLASS_STIPEND", originalSenderLink];
            cleanupTrackingLists();
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        debugLog("http_response received - requestId: " + (string)request_id + ", status: " + (string)status);
        integer opIndex = llListFindList(pendingStipendOps, [request_id]);
        
        if (opIndex != -1) {
            string operation = llList2String(pendingStipendOps, opIndex + 1);
            debugLog("Bridge_Stipends HTTP_RESPONSE: requestId=" + (string)request_id + ", status=" + (string)status + ", op=" + operation);
            debugLog("Found matching operation: " + operation);
            
            // ======================================================
            // ATOMIC STIPEND PIPELINE
            // ======================================================

            // 1. Character atomic GET result
            if (operation == "GET_STIPEND_CHAR") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string characterID = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status == 200) {
                    string fields = llJsonGetValue(body, ["fields"]);
                    string classId = llJsonGetValue(fields, ["class_id","stringValue"]);
                    if (classId == JSON_INVALID || classId == "") {
                        classId = llJsonGetValue(fields, ["classId","stringValue"]);
                    }
                    string lastPaid = llJsonGetValue(fields, ["lastPaidTimestamp","integerValue"]);
                    
                    if (lastPaid == JSON_INVALID || lastPaid == "") {
                        lastPaid = "-1";
                    }
                    
                    if (classId == "" || classId == JSON_INVALID) {
                        // No class → no stipend
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL,
                            "STIPEND_DATA",
                            "{\"gold\":0,\"silver\":0,\"copper\":0}|-1");
                        return;
                    }

                    // Prepare next atomic GET
                    string url2 = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/classes/" + classId
                        + "?mask.fieldPaths=stipend";

                    debugLog("Bridge_Stipends HTTP GET: url='" + url2 + "'");
                    
                    key requestId2 = llHTTPRequest(
                        url2,
                        [
                            HTTP_METHOD, "GET",
                            HTTP_MIMETYPE, "application/json"
                        ],
                        ""
                    );
                    
                    pendingStipendOps += [requestId2, "GET_STIPEND_CLASS_ATOMIC", senderLink, lastPaid];
                    cleanupTrackingLists();
                    return;
                } else if (status == 404) {
                    debugLog("Bridge_Stipends → HUD ERROR: senderLink=" + (string)senderLink + ", msg='Character not found'");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Character not found");
                } else {
                    debugLog("Bridge_Stipends → HUD ERROR: senderLink=" + (string)senderLink + ", msg='Status " + (string)status + "'");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Status " + (string)status);
                }
                return;
            }

            // 2. Class stipend atomic GET result
            if (operation == "GET_STIPEND_CLASS_ATOMIC") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string lastPaid = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status == 200) {
                    string fields = llJsonGetValue(body, ["fields"]);
                    string stipendFields = llJsonGetValue(fields, ["stipend","mapValue","fields"]);

                    string goldStr = llJsonGetValue(stipendFields, ["gold","integerValue"]);
                    string silverStr = llJsonGetValue(stipendFields, ["silver","integerValue"]);
                    string copperStr = llJsonGetValue(stipendFields, ["copper","integerValue"]);

                    integer gold = 0;
                    integer silver = 0;
                    integer copper = 0;
                    
                    if (goldStr != JSON_INVALID && goldStr != "") {
                        gold = (integer)goldStr;
                    }
                    if (silverStr != JSON_INVALID && silverStr != "") {
                        silver = (integer)silverStr;
                    }
                    if (copperStr != JSON_INVALID && copperStr != "") {
                        copper = (integer)copperStr;
                    }

                    string stipendJson =
                        "{\"gold\":" + (string)gold +
                        ",\"silver\":" + (string)silver +
                        ",\"copper\":" + (string)copper + "}";

                    debugLog("Bridge_Stipends → HUD: senderLink=" + (string)senderLink + ", payload='" + stipendJson + "|" + lastPaid + "'");
                    
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL,
                        "STIPEND_DATA",
                        stipendJson + "|" + lastPaid);

                    return;
                } else if (status == 404) {
                    debugLog("Bridge_Stipends → HUD ERROR: senderLink=" + (string)senderLink + ", msg='Class not found'");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "{\"gold\":0,\"silver\":0,\"copper\":0}|" + lastPaid);
                } else {
                    debugLog("Bridge_Stipends → HUD ERROR: senderLink=" + (string)senderLink + ", msg='Status " + (string)status + "'");
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
            
            // Handle SET_CLASS_STIPEND
            if (operation == "SET_CLASS_STIPEND") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 2);
                
                if (status == 200) {
                    debugLog("Stipend updated successfully.");
                } else {
                    debugLog("ERROR updating stipend: HTTP " + (string)status);
                }
                return;
            }
            
            // Handle GET_CLASS_STIPEND
            if (operation == "GET_CLASS_STIPEND") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string classId = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status != 200) {
                    // Class not found
                    debugLog("Class not found: " + classId + " (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND|NOT_FOUND", "");
                    return;
                }
                
                // Parse stipend mapValue
                string fields = llJsonGetValue(body, ["fields"]);
                string stipendField = llJsonGetValue(fields, ["stipend"]);
                
                if (stipendField == JSON_INVALID || stipendField == "") {
                    debugLog("No stipend field found for class: " + classId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND|NOT_FOUND", "");
                    return;
                }
                
                string stipendMapValue = llJsonGetValue(stipendField, ["mapValue","fields"]);
                if (stipendMapValue == JSON_INVALID || stipendMapValue == "") {
                    debugLog("No stipend mapValue found for class: " + classId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND|NOT_FOUND", "");
                    return;
                }
                
                string goldField = llJsonGetValue(stipendMapValue, ["gold","integerValue"]);
                string silverField = llJsonGetValue(stipendMapValue, ["silver","integerValue"]);
                string copperField = llJsonGetValue(stipendMapValue, ["copper","integerValue"]);
                
                string gold = "0";
                string silver = "0";
                string copper = "0";
                
                if (goldField != JSON_INVALID && goldField != "") {
                    gold = goldField;
                }
                if (silverField != JSON_INVALID && silverField != "") {
                    silver = silverField;
                }
                if (copperField != JSON_INVALID && copperField != "") {
                    copper = copperField;
                }
                
                debugLog("Class stipend extracted: gold=" + gold + ", silver=" + silver + ", copper=" + copper);
                
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND|" + gold + "|" + silver + "|" + copper, "");
                return;
            }
            
            // Handle GET_ACTIVE_CHARACTER
            if (operation == "GET_ACTIVE_CHARACTER") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string userId = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status != 200) {
                    debugLog("User not found or error: " + userId + " (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "USER_ACTIVE_CHARACTER|NULL", "");
                    return;
                }
                
                // Extract activeCharacter
                string fields = llJsonGetValue(body, ["fields"]);
                string activeCharacterField = llJsonGetValue(fields, ["activeCharacter"]);
                
                if (activeCharacterField == JSON_INVALID || activeCharacterField == "") {
                    debugLog("No activeCharacter field found for user: " + userId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "USER_ACTIVE_CHARACTER|NULL", "");
                    return;
                }
                
                string characterId = llJsonGetValue(activeCharacterField, ["stringValue"]);
                if (characterId == JSON_INVALID || characterId == "") {
                    debugLog("activeCharacter is empty for user: " + userId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "USER_ACTIVE_CHARACTER|NULL", "");
                    return;
                }
                
                debugLog("Active character found: " + characterId + " for user: " + userId);
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "USER_ACTIVE_CHARACTER|" + characterId, "");
                return;
            }
            
            // Handle GIVE_PAY_GET_CHAR (step 1: get character's classId)
            if (operation == "GIVE_PAY_GET_CHAR") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string characterId = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status != 200) {
                    debugLog("Character not found: " + characterId + " (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|CHARACTER_NOT_FOUND", "");
                    return;
                }
                
                // Extract classId
                string fields = llJsonGetValue(body, ["fields"]);
                string classId = llJsonGetValue(fields, ["class_id","stringValue"]);
                if (classId == JSON_INVALID || classId == "") {
                    classId = llJsonGetValue(fields, ["classId","stringValue"]);
                }
                
                if (classId == "" || classId == JSON_INVALID) {
                    debugLog("No classId found for character: " + characterId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|NO_CLASS", "");
                    return;
                }
                
                // Step 2: GET class document to get stipend
                string url2 = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/classes/" + classId
                    + "?mask.fieldPaths=stipend";
                
                debugLog("Bridge_Stipends HTTP GET (class for GIVE_PAY): url='" + url2 + "'");
                
                key requestId2 = llHTTPRequest(
                    url2,
                    [
                        HTTP_METHOD, "GET",
                        HTTP_MIMETYPE, "application/json"
                    ],
                    ""
                );
                
                pendingStipendOps += [requestId2, "GIVE_PAY_GET_CLASS", senderLink, characterId, classId];
                cleanupTrackingLists();
                return;
            }
            
            // Handle GIVE_PAY_GET_CLASS (step 2: get class stipend)
            if (operation == "GIVE_PAY_GET_CLASS") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string characterId = llList2String(pendingStipendOps, opIndex + 3);
                string classId = llList2String(pendingStipendOps, opIndex + 4);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 4);
                
                if (status != 200) {
                    debugLog("Class not found: " + classId + " (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|CLASS_NOT_FOUND", "");
                    return;
                }
                
                // Extract stipend
                string fields = llJsonGetValue(body, ["fields"]);
                string stipendField = llJsonGetValue(fields, ["stipend"]);
                
                if (stipendField == JSON_INVALID || stipendField == "") {
                    debugLog("No stipend field found for class: " + classId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|NO_STIPEND", "");
                    return;
                }
                
                string stipendMapValue = llJsonGetValue(stipendField, ["mapValue","fields"]);
                if (stipendMapValue == JSON_INVALID || stipendMapValue == "") {
                    debugLog("No stipend mapValue found for class: " + classId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|NO_STIPEND", "");
                    return;
                }
                
                string goldField = llJsonGetValue(stipendMapValue, ["gold","integerValue"]);
                string silverField = llJsonGetValue(stipendMapValue, ["silver","integerValue"]);
                string copperField = llJsonGetValue(stipendMapValue, ["copper","integerValue"]);
                
                string gold = "0";
                string silver = "0";
                string copper = "0";
                
                if (goldField != JSON_INVALID && goldField != "") {
                    gold = goldField;
                }
                if (silverField != JSON_INVALID && silverField != "") {
                    silver = silverField;
                }
                if (copperField != JSON_INVALID && copperField != "") {
                    copper = copperField;
                }
                
                // Step 3: Update lastPaidTimestamp
                integer now = llGetUnixTime();
                string timestampRFC3339 = unixToRFC3339(now);
                
                string url3 = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterId
                    + "?updateMask.fieldPaths=lastPaidTimestamp";
                
                string patchBody = "{\"fields\":{\"lastPaidTimestamp\":{\"timestampValue\":\"" + timestampRFC3339 + "\"}}}";
                
                debugLog("Bridge_Stipends HTTP PATCH (update timestamp for GIVE_PAY): url='" + url3 + "'");
                
                key requestId3 = llHTTPRequest(
                    url3,
                    [
                        HTTP_METHOD, "PATCH",
                        HTTP_MIMETYPE, "application/json"
                    ],
                    patchBody
                );
                
                pendingStipendOps += [requestId3, "GIVE_PAY_UPDATE_TIMESTAMP", senderLink, characterId, gold, silver, copper];
                cleanupTrackingLists();
                return;
            }
            
            // Handle GIVE_PAY_UPDATE_TIMESTAMP (step 3: timestamp updated, return success)
            if (operation == "GIVE_PAY_UPDATE_TIMESTAMP") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string characterId = llList2String(pendingStipendOps, opIndex + 3);
                string gold = llList2String(pendingStipendOps, opIndex + 4);
                string silver = llList2String(pendingStipendOps, opIndex + 5);
                string copper = llList2String(pendingStipendOps, opIndex + 6);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 6);
                
                if (status == 200) {
                    debugLog("GIVE_PAY successful: character=" + characterId + ", stipend=" + gold + "|" + silver + "|" + copper);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|OK|" + gold + "|" + silver + "|" + copper, "");
                } else {
                    debugLog("GIVE_PAY timestamp update failed: character=" + characterId + " (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "GIVE_PAY_RESULT|ERROR|TIMESTAMP_UPDATE_FAILED", "");
                }
                return;
            }
            
            // Handle FORCE_STIPEND_GET_CHAR (step 1: get character's classId)
            if (operation == "FORCE_STIPEND_GET_CHAR") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string characterId = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status != 200) {
                    debugLog("Character not found: " + characterId + " (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|ERROR|CHARACTER_NOT_FOUND", "");
                    return;
                }
                
                // Extract classId
                string fields = llJsonGetValue(body, ["fields"]);
                string classId = llJsonGetValue(fields, ["class_id","stringValue"]);
                if (classId == JSON_INVALID || classId == "") {
                    classId = llJsonGetValue(fields, ["classId","stringValue"]);
                }
                
                if (classId == "" || classId == JSON_INVALID) {
                    debugLog("No classId found for character: " + characterId);
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|ERROR|NO_CLASS", "");
                    return;
                }
                
                // Step 2: GET class document to get stipend
                string url2 = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/classes/" + classId
                    + "?mask.fieldPaths=stipend";
                
                debugLog("Bridge_Stipends HTTP GET (class for FORCE_STIPEND_PAYOUT): url='" + url2 + "'");
                
                key requestId2 = llHTTPRequest(
                    url2,
                    [
                        HTTP_METHOD, "GET",
                        HTTP_MIMETYPE, "application/json"
                    ],
                    ""
                );
                
                pendingStipendOps += [requestId2, "FORCE_STIPEND_GET_CLASS", senderLink, characterId];
                cleanupTrackingLists();
                return;
            }
            
            // Handle FORCE_STIPEND_GET_CLASS (step 2: get class stipend, return result)
            if (operation == "FORCE_STIPEND_GET_CLASS") {
                integer senderLink = llList2Integer(pendingStipendOps, opIndex + 2);
                string characterId = llList2String(pendingStipendOps, opIndex + 3);
                
                pendingStipendOps = llDeleteSubList(pendingStipendOps, opIndex, opIndex + 3);
                
                if (status != 200) {
                    debugLog("Class not found for FORCE_STIPEND_PAYOUT (status: " + (string)status + ")");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|ERROR|CLASS_NOT_FOUND", "");
                    return;
                }
                
                // Extract stipend
                string fields = llJsonGetValue(body, ["fields"]);
                string stipendField = llJsonGetValue(fields, ["stipend"]);
                
                if (stipendField == JSON_INVALID || stipendField == "") {
                    debugLog("No stipend field found for FORCE_STIPEND_PAYOUT");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|ERROR|NO_STIPEND", "");
                    return;
                }
                
                string stipendMapValue = llJsonGetValue(stipendField, ["mapValue","fields"]);
                if (stipendMapValue == JSON_INVALID || stipendMapValue == "") {
                    debugLog("No stipend mapValue found for FORCE_STIPEND_PAYOUT");
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|ERROR|NO_STIPEND", "");
                    return;
                }
                
                string goldField = llJsonGetValue(stipendMapValue, ["gold","integerValue"]);
                string silverField = llJsonGetValue(stipendMapValue, ["silver","integerValue"]);
                string copperField = llJsonGetValue(stipendMapValue, ["copper","integerValue"]);
                
                string gold = "0";
                string silver = "0";
                string copper = "0";
                
                if (goldField != JSON_INVALID && goldField != "") {
                    gold = goldField;
                }
                if (silverField != JSON_INVALID && silverField != "") {
                    silver = silverField;
                }
                if (copperField != JSON_INVALID && copperField != "") {
                    copper = copperField;
                }
                
                debugLog("FORCE_STIPEND_PAYOUT successful: character=" + characterId + ", stipend=" + gold + "|" + silver + "|" + copper);
                
                // Return success (no timestamp update for forced payouts)
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "FORCE_STIPEND_PAYOUT_RESULT|OK|" + gold + "|" + silver + "|" + copper, "");
                return;
            }
        }
    }
}

