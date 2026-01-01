// Feudalism 4 - Bridge Characters Module
// ============================================================================
// Handles character-related operations: field gets, active character, etc.
// ============================================================================

// Import constants (shared with Utils)
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
integer FS_BRIDGE_CHANNEL = -777001;
integer MODULE_CHANNEL = -777002;
string DOMAIN_CHAR = "CHAR";

// Owner info
key ownerKey;
string ownerUUID;
string firestoreRestBase;

// Request tracking for character field requests
list pendingRequests;
integer MAX_PENDING_REQUESTS = 20;

// Request tracking for active character operations
list pendingCharOps;
integer MAX_PENDING_CHAR_OPS = 10;

// Current character cache
string currentCharacterId = "";

// =========================== UTILITY FUNCTIONS ==============================

// Import extractFirestoreValue from Utils pattern
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
    
    string mapValue = llJsonGetValue(fieldData, ["mapValue"]);
    if (mapValue != JSON_INVALID && mapValue != "") {
        string mapFields = llJsonGetValue(mapValue, ["fields"]);
        if (mapFields != JSON_INVALID && mapFields != "") {
            return mapFields;
        }
    }
    
    return "";
}

// Helper to determine which UUID to use
string getUUIDToUse(string targetUUID, string ownerUUID) {
    if (targetUUID != "") {
        return targetUUID;
    } else {
        return ownerUUID;
    }
}

// Limit tracking list size
cleanupTrackingLists() {
    if (llGetListLength(pendingRequests) > MAX_PENDING_REQUESTS * 3) {
        pendingRequests = llDeleteSubList(pendingRequests, 0, 2);
    }
    if (llGetListLength(pendingCharOps) > MAX_PENDING_CHAR_OPS * 5) {
        pendingCharOps = llDeleteSubList(pendingCharOps, 0, 4);
    }
}

// =========================== CHARACTER OPERATIONS ===========================

// Get a single field from Firestore by UUID
getFieldByUUID(string fieldName, string targetUUID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, 0, fieldName + "_ERROR", "Project ID not configured");
        return;
    }
    
    cleanupTrackingLists();
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    list queryParts = [
        "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"",
        targetUUID,
        "\"}}},\"select\":{\"fields\":[{\"fieldPath\":\"",
        fieldName,
        "\"}]},\"limit\":1}}"
    ];
    string queryJson = llDumpList2String(queryParts, "");
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        queryJson
    );
    
    pendingRequests += [requestId, fieldName, senderLink];
}

// Get character document ID and universe_id from Firestore
key getCharacterInfo() {
    if (FIREBASE_PROJECT_ID == "") {
        return NULL_KEY;
    }
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    list queryParts = [
        "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"",
        ownerUUID,
        "\"}}},\"select\":{\"fields\":[{\"fieldPath\":\"universe_id\"}]},\"limit\":1}}"
    ];
    string queryJson = llDumpList2String(queryParts, "");
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        queryJson
    );
    
    return requestId;
}

// Fetch full character document for reset/rp_update sync
key fetchFullCharacterDocument(string characterId) {
    if (FIREBASE_PROJECT_ID == "") {
        return NULL_KEY;
    }
    
    if (characterId == "") {
        return NULL_KEY;
    }
    
    llLinksetDataWrite("characterId", characterId);
    currentCharacterId = characterId;
    
    string url = firestoreRestBase + "/characters/" + llEscapeURL(characterId);
    
    key requestId = llHTTPRequest(
        url,
        [HTTP_METHOD, "GET"],
        ""
    );
    
    pendingRequests += [requestId, "FETCH_FULL_CHARACTER", characterId];
    cleanupTrackingLists();
    
    return requestId;
}

// Set active character for a user (validates ownership)
setActiveCharacter(string userID, string characterID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Project ID not configured");
        return;
    }
    
    if (userID == "" || characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Invalid parameters");
        return;
    }
    
    string validateUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    list validateQueryParts = [
        "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"compositeFilter\":{\"op\":\"AND\",\"filters\":[{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"",
        userID,
        "\"}}},{\"fieldFilter\":{\"field\":{\"fieldPath\":\"__name__\"},\"op\":\"EQUAL\",\"value\":{\"referenceValue\":\"projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/",
        characterID,
        "\"}}}]}},\"select\":{\"fields\":[{\"fieldPath\":\"__name__\"}]},\"limit\":1}}"
    ];
    string validateQueryJson = llDumpList2String(validateQueryParts, "");
    
    key validateRequestId = llHTTPRequest(
        validateUrl,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        validateQueryJson
    );
    
    pendingCharOps += [validateRequestId, "VALIDATE_OWNERSHIP", userID, characterID, senderLink];
    cleanupTrackingLists();
}

// Get active character for a user
getActiveCharacter(string userID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
        return;
    }
    
    if (userID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
        return;
    }
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users/" + userID;
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    pendingCharOps += [requestId, "GET_ACTIVE_CHARACTER", senderLink];
    cleanupTrackingLists();
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        firestoreRestBase = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents";
    }
    
    // Handle routed commands from Bridge_Main
    link_message(integer sender_num, integer num, string msg, key id) {
        if (num != MODULE_CHANNEL) return;
        
        // Parse routed message: DOMAIN|COMMAND|PAYLOAD|SENDERLINK
        list parts = llParseString2List(msg, ["|"], []);
        if (llGetListLength(parts) < 4) return;
        
        string domain = llList2String(parts, 0);
        if (domain != DOMAIN_CHAR) return; // Not for us
        
        string command = llList2String(parts, 1);
        string payload = llList2String(parts, 2);
        integer originalSenderLink = (integer)llList2String(parts, 3);
        
        // Parse payload: targetUUID|additionalParams
        list payloadParts = llParseString2List(payload, ["|"], []);
        string targetUUID = "";
        if (llGetListLength(payloadParts) > 0) {
            targetUUID = llList2String(payloadParts, 0);
        }
        
        // Route command
        if (command == "getClass" || command == "getClass_id") {
            getFieldByUUID("class_id", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getStats") {
            getFieldByUUID("stats", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getGender") {
            getFieldByUUID("gender", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getSpecies" || command == "getSpecies_id") {
            getFieldByUUID("species_id", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getHasMana" || command == "getHas_mana") {
            getFieldByUUID("has_mana", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getHealth") {
            getFieldByUUID("health", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getStamina") {
            getFieldByUUID("stamina", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getMana") {
            getFieldByUUID("mana", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getXP" || command == "getXP_total") {
            getFieldByUUID("xp_total", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getSpeciesFactors" || command == "getSpecies_factors") {
            getFieldByUUID("species_factors", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getCurrency") {
            getFieldByUUID("currency", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getMode") {
            getFieldByUUID("mode", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getUniverseId" || command == "getUniverse_id") {
            getFieldByUUID("universe_id", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "getInventory") {
            // Legacy inventory field get (for old HUD compatibility)
            getFieldByUUID("inventory", getUUIDToUse(targetUUID, ownerUUID), originalSenderLink);
        }
        else if (command == "fetchFullCharacterDocument") {
            fetchFullCharacterDocument(payload);
        }
        else if (llSubStringIndex(command, "GET_ACTIVE_CHARACTER") == 0) {
            // Parse: GET_ACTIVE_CHARACTER|<transactionId>|<userId> or GET_ACTIVE_CHARACTER|<userId>
            list cmdParts = llParseString2List(command, ["|"], []);
            string userID;
            if (llGetListLength(cmdParts) == 3) {
                userID = llList2String(cmdParts, 2);
            } else if (llGetListLength(cmdParts) == 2) {
                userID = llList2String(cmdParts, 1);
            } else if (payload != "") {
                // Try payload
                list payloadParts2 = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts2) >= 2) {
                    userID = llList2String(payloadParts2, 1);
                } else {
                    userID = payload;
                }
            }
            getActiveCharacter(userID, originalSenderLink);
        }
        else if (llSubStringIndex(command, "SET_ACTIVE_CHARACTER") == 0) {
            // Parse: SET_ACTIVE_CHARACTER|<transactionId>|<userId>|<characterId> or SET_ACTIVE_CHARACTER|<userId>|<characterId>
            list cmdParts = llParseString2List(command, ["|"], []);
            string userID;
            string characterID;
            if (llGetListLength(cmdParts) == 4) {
                userID = llList2String(cmdParts, 2);
                characterID = llList2String(cmdParts, 3);
            } else if (llGetListLength(cmdParts) == 3) {
                userID = llList2String(cmdParts, 1);
                characterID = llList2String(cmdParts, 2);
            } else if (payload != "") {
                list payloadParts2 = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts2) >= 2) {
                    userID = llList2String(payloadParts2, 0);
                    characterID = llList2String(payloadParts2, 1);
                }
            }
            setActiveCharacter(userID, characterID, originalSenderLink);
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        // Check pendingRequests (field gets)
        integer requestIndex = llListFindList(pendingRequests, [request_id]);
        if (requestIndex != -1) {
            string fieldName = llList2String(pendingRequests, requestIndex + 1);
            integer senderLink = llList2Integer(pendingRequests, requestIndex + 2);
            
            pendingRequests = llDeleteSubList(pendingRequests, requestIndex, requestIndex + 2);
            
            if (status == 200) {
                // Extract field value from query result
                string firstResult = llJsonGetValue(body, [0]);
                if (firstResult != JSON_INVALID && firstResult != "") {
                    string document = llJsonGetValue(firstResult, ["document"]);
                    if (document != JSON_INVALID && document != "") {
                        string fields = llJsonGetValue(document, ["fields"]);
                        if (fields != JSON_INVALID && fields != "") {
                            string fieldData = llJsonGetValue(fields, [fieldName]);
                            if (fieldData != JSON_INVALID && fieldData != "") {
                                string fieldValue = extractFirestoreValue(fieldData);
                                llMessageLinked(senderLink, 0, fieldName, fieldValue);
                                return;
                            }
                        }
                    }
                }
            }
            
            // Error or empty result
            llMessageLinked(senderLink, 0, fieldName + "_ERROR", "Field not found or error");
            return;
        }
        
        // Check pendingCharOps (active character operations)
        integer opIndex = llListFindList(pendingCharOps, [request_id]);
        if (opIndex != -1) {
            string operation = llList2String(pendingCharOps, opIndex + 1);
            
            // Handle VALIDATE_OWNERSHIP
            if (operation == "VALIDATE_OWNERSHIP") {
                string userID = llList2String(pendingCharOps, opIndex + 2);
                string characterID = llList2String(pendingCharOps, opIndex + 3);
                integer senderLink = llList2Integer(pendingCharOps, opIndex + 4);
                
                pendingCharOps = llDeleteSubList(pendingCharOps, opIndex, opIndex + 4);
                
                if (status == 200) {
                    string firstResult = llJsonGetValue(body, [0]);
                    if (firstResult != JSON_INVALID && firstResult != "") {
                        // Ownership validated, now set activeCharacter
                        string patchUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users/" + userID + "?updateMask.fieldPaths=activeCharacter";
                        
                        list patchBodyParts = [
                            "{\"fields\":{\"activeCharacter\":{\"stringValue\":\"",
                            characterID,
                            "\"}}}"
                        ];
                        string patchBody = llDumpList2String(patchBodyParts, "");
                        
                        key patchRequestId = llHTTPRequest(
                            patchUrl,
                            [
                                HTTP_METHOD, "PATCH",
                                HTTP_MIMETYPE, "application/json"
                            ],
                            patchBody
                        );
                        
                        pendingCharOps += [patchRequestId, "SET_ACTIVE_CHARACTER", senderLink, characterID];
                    } else {
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Ownership validation failed");
                    }
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Validation failed: Status " + (string)status);
                }
                return;
            }
            
            // Handle SET_ACTIVE_CHARACTER (PATCH response)
            if (operation == "SET_ACTIVE_CHARACTER") {
                integer senderLink = llList2Integer(pendingCharOps, opIndex + 2);
                string characterID = llList2String(pendingCharOps, opIndex + 3);
                
                pendingCharOps = llDeleteSubList(pendingCharOps, opIndex, opIndex + 3);
                
                if (status == 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET", characterID);
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle GET_ACTIVE_CHARACTER
            if (operation == "GET_ACTIVE_CHARACTER") {
                integer senderLink = llList2Integer(pendingCharOps, opIndex + 2);
                
                pendingCharOps = llDeleteSubList(pendingCharOps, opIndex, opIndex + 2);
                
                if (status == 200) {
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        string activeCharacterField = llJsonGetValue(fields, ["activeCharacter"]);
                        if (activeCharacterField != JSON_INVALID && activeCharacterField != "") {
                            string characterID = extractFirestoreValue(activeCharacterField);
                            if (characterID != "") {
                                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", characterID);
                            } else {
                                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
                            }
                        } else {
                            llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
                        }
                    } else {
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
                    }
                } else if (status == 404) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle FETCH_FULL_CHARACTER
            if (operation == "FETCH_FULL_CHARACTER") {
                string characterId = llList2String(pendingCharOps, opIndex + 2);
                pendingCharOps = llDeleteSubList(pendingCharOps, opIndex, opIndex + 2);
                
                if (status == 200) {
                    // Forward full document to Data Manager
                    llMessageLinked(LINK_SET, 0, "characterDocument", body);
                }
                return;
            }
        }
    }
}

