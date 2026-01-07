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

// Get vault field name from coin item name
string getVaultFieldName(string itemName) {
    if (itemName == "gold_coin") {
        return "vault_gold_coin";
    } else if (itemName == "silver_coin") {
        return "vault_silver_coin";
    } else if (itemName == "copper_coin") {
        return "vault_copper_coin";
    }
    return "";
}

// Deposit coins to vault
vaultDeposit(string characterID, string itemName, integer amount, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_DEPOSIT_FAIL", "Project ID not configured");
        return;
    }
    
    if (characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_DEPOSIT_FAIL", "Invalid character ID");
        return;
    }
    
    string vaultFieldName = getVaultFieldName(itemName);
    if (vaultFieldName == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_DEPOSIT_FAIL", "Invalid coin type");
        return;
    }
    
    if (amount <= 0) {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_DEPOSIT_FAIL", "Invalid amount");
        return;
    }
    
    cleanupTrackingLists();
    
    // First, get current vault value
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID;
    
    key getRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track: [requestId, "GET_VAULT_FOR_DEPOSIT", senderLink, characterID, vaultFieldName, itemName, amount]
    pendingCharOps += [getRequestId, "GET_VAULT_FOR_DEPOSIT", senderLink, characterID, vaultFieldName, itemName, (string)amount];
    cleanupTrackingLists();
}

// Withdraw coins from vault
vaultWithdraw(string characterID, string itemName, integer amount, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_WITHDRAW_FAIL", "Project ID not configured");
        return;
    }
    
    if (characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_WITHDRAW_FAIL", "Invalid character ID");
        return;
    }
    
    string vaultFieldName = getVaultFieldName(itemName);
    if (vaultFieldName == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_WITHDRAW_FAIL", "Invalid coin type");
        return;
    }
    
    if (amount <= 0) {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_WITHDRAW_FAIL", "Invalid amount");
        return;
    }
    
    cleanupTrackingLists();
    
    // First, get current vault value
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID;
    
    key getRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track: [requestId, "GET_VAULT_FOR_WITHDRAW", senderLink, characterID, vaultFieldName, itemName, amount]
    pendingCharOps += [getRequestId, "GET_VAULT_FOR_WITHDRAW", senderLink, characterID, vaultFieldName, itemName, (string)amount];
    cleanupTrackingLists();
}

// Get vault inventory (all three coin types)
getVaultInventory(string characterID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_INVENTORY_ERROR", "Project ID not configured");
        return;
    }
    
    if (characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "VAULT_INVENTORY_ERROR", "Invalid character ID");
        return;
    }
    
    cleanupTrackingLists();
    
    // Get character document
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID;
    
    key getRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track: [requestId, "GET_VAULT_INVENTORY", senderLink]
    pendingCharOps += [getRequestId, "GET_VAULT_INVENTORY", senderLink];
    cleanupTrackingLists();
}

// Update currency for a character (adds deltas to existing currency)
updateCurrency(string characterID, integer goldDelta, integer silverDelta, integer copperDelta, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CURRENCY_UPDATED_ERROR", "Project ID not configured");
        return;
    }
    
    if (characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CURRENCY_UPDATED_ERROR", "Invalid character ID");
        return;
    }
    
    cleanupTrackingLists();
    
    // First, get current currency to add deltas
    // Include mask to ensure currency field is returned
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID + "?mask.fieldPaths=currency";
    
    key getRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track: [requestId, "GET_CURRENCY_FOR_UPDATE", senderLink, characterID, goldDelta, silverDelta, copperDelta]
    pendingCharOps += [getRequestId, "GET_CURRENCY_FOR_UPDATE", senderLink, characterID, (string)goldDelta, (string)silverDelta, (string)copperDelta];
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
        // Support both 3-part (domain|command|payload) and 4+ part (domain|command|payload|senderLink) formats
        if (llGetListLength(parts) < 3) return;
        
        string domain = llList2String(parts, 0);
        if (domain != DOMAIN_CHAR) return; // Not for us
        
        string command = llList2String(parts, 1);
        
        // Extract payload and senderLink
        // Format: DOMAIN|COMMAND|PAYLOAD[|SENDERLINK]
        // When Bridge Main sends: CHAR|UPDATE_CURRENCY|characterId|gold|silver|copper|senderLink
        // parts[0]="CHAR", parts[1]="UPDATE_CURRENCY", parts[2..n-1]=payload parts, parts[n]=senderLink (if present)
        integer originalSenderLink = sender_num;  // Default to sender_num
        string payload;
        
        if (llGetListLength(parts) >= 4) {
            // Check if last part could be senderLink
            string lastPart = llList2String(parts, llGetListLength(parts) - 1);
            integer testSenderLink = (integer)lastPart;
            // Heuristic: if last part is numeric and looks like a link number, assume senderLink
            // Link numbers are typically 1-30, but could be any positive integer
            if (testSenderLink > 0 && lastPart == (string)testSenderLink) {
                // Last part is likely senderLink - extract payload excluding it
                originalSenderLink = testSenderLink;
                payload = llDumpList2String(llList2List(parts, 2, llGetListLength(parts) - 2), "|");
            } else {
                // Last part is part of payload (e.g., "copper" value)
                payload = llDumpList2String(llList2List(parts, 2, -1), "|");
            }
        } else {
            // 3-part format: DOMAIN|COMMAND|PAYLOAD (no senderLink)
            payload = llDumpList2String(llList2List(parts, 2, -1), "|");
        }
        
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
        else if (llSubStringIndex(command, "UPDATE_CURRENCY") == 0) {
            // Parse: UPDATE_CURRENCY|<characterId>|<gold>|<silver>|<copper>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            string goldStr;
            string silverStr;
            string copperStr;
            if (llGetListLength(cmdParts) == 5) {
                characterID = llList2String(cmdParts, 1);
                goldStr = llList2String(cmdParts, 2);
                silverStr = llList2String(cmdParts, 3);
                copperStr = llList2String(cmdParts, 4);
            } else if (payload != "") {
                list payloadParts2 = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts2) >= 4) {
                    characterID = llList2String(payloadParts2, 0);
                    goldStr = llList2String(payloadParts2, 1);
                    silverStr = llList2String(payloadParts2, 2);
                    copperStr = llList2String(payloadParts2, 3);
                }
            }
            integer gold = (integer)goldStr;
            integer silver = (integer)silverStr;
            integer copper = (integer)copperStr;
            updateCurrency(characterID, gold, silver, copper, originalSenderLink);
        }
        else if (llSubStringIndex(command, "VAULT_DEPOSIT") == 0) {
            // Parse: VAULT_DEPOSIT|<characterId>|<itemName>|<amount>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            string itemName;
            string amountStr;
            if (llGetListLength(cmdParts) == 4) {
                characterID = llList2String(cmdParts, 1);
                itemName = llList2String(cmdParts, 2);
                amountStr = llList2String(cmdParts, 3);
            } else if (payload != "") {
                list payloadParts2 = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts2) >= 3) {
                    characterID = llList2String(payloadParts2, 0);
                    itemName = llList2String(payloadParts2, 1);
                    amountStr = llList2String(payloadParts2, 2);
                }
            }
            integer amount = (integer)amountStr;
            vaultDeposit(characterID, itemName, amount, originalSenderLink);
        }
        else if (llSubStringIndex(command, "VAULT_WITHDRAW") == 0) {
            // Parse: VAULT_WITHDRAW|<characterId>|<itemName>|<amount>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            string itemName;
            string amountStr;
            if (llGetListLength(cmdParts) == 4) {
                characterID = llList2String(cmdParts, 1);
                itemName = llList2String(cmdParts, 2);
                amountStr = llList2String(cmdParts, 3);
            } else if (payload != "") {
                list payloadParts2 = llParseString2List(payload, ["|"], []);
                if (llGetListLength(payloadParts2) >= 3) {
                    characterID = llList2String(payloadParts2, 0);
                    itemName = llList2String(payloadParts2, 1);
                    amountStr = llList2String(payloadParts2, 2);
                }
            }
            integer amount = (integer)amountStr;
            vaultWithdraw(characterID, itemName, amount, originalSenderLink);
        }
        else if (llSubStringIndex(command, "GET_VAULT_INVENTORY") == 0) {
            // Parse: GET_VAULT_INVENTORY|<characterId>
            list cmdParts = llParseString2List(command, ["|"], []);
            string characterID;
            if (llGetListLength(cmdParts) == 2) {
                characterID = llList2String(cmdParts, 1);
            } else if (payload != "") {
                characterID = payload;
            }
            getVaultInventory(characterID, originalSenderLink);
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
            
            // Handle GET_CURRENCY_FOR_UPDATE (first step of UPDATE_CURRENCY)
            if (operation == "GET_CURRENCY_FOR_UPDATE") {
                integer senderLink = llList2Integer(pendingCharOps, opIndex + 2);
                string characterID = llList2String(pendingCharOps, opIndex + 3);
                string goldDeltaStr = llList2String(pendingCharOps, opIndex + 4);
                string silverDeltaStr = llList2String(pendingCharOps, opIndex + 5);
                string copperDeltaStr = llList2String(pendingCharOps, opIndex + 6);
                
                pendingCharOps = llDeleteSubList(pendingCharOps, opIndex, opIndex + 6);
                
                integer goldDelta = (integer)goldDeltaStr;
                integer silverDelta = (integer)silverDeltaStr;
                integer copperDelta = (integer)copperDeltaStr;
                
                if (status == 200) {
                    debugLog("GET_CURRENCY_FOR_UPDATE: HTTP 200, characterID=" + characterID + ", deltas: gold=" + (string)goldDelta + ", silver=" + (string)silverDelta + ", copper=" + (string)copperDelta);
                    
                    // Debug: log body length and first 500 chars to see structure
                    integer bodyLen = llStringLength(body);
                    string bodyPreview = body;
                    if (bodyLen > 500) {
                        bodyPreview = llGetSubString(body, 0, 499) + "...";
                    }
                    debugLog("GET_CURRENCY_FOR_UPDATE: Response body length=" + (string)bodyLen + ", preview: " + bodyPreview);
                    
                    // Extract current currency
                    string fields = llJsonGetValue(body, ["fields"]);
                    integer currentGold = 0;
                    integer currentSilver = 0;
                    integer currentCopper = 0;
                    
                    string fieldsStatus = "NO";
                    if (fields != JSON_INVALID && fields != "") {
                        fieldsStatus = "YES";
                        debugLog("GET_CURRENCY_FOR_UPDATE: fields value: " + fields);
                    } else {
                        string jsonInvalidStatus = "FALSE";
                        if (fields == JSON_INVALID) {
                            jsonInvalidStatus = "TRUE";
                        }
                        string emptyStatus = "FALSE";
                        if (fields == "") {
                            emptyStatus = "TRUE";
                        }
                        debugLog("GET_CURRENCY_FOR_UPDATE: fields is JSON_INVALID or empty. JSON_INVALID check: " + jsonInvalidStatus + ", empty check: " + emptyStatus);
                    }
                    debugLog("GET_CURRENCY_FOR_UPDATE: fields extracted: " + fieldsStatus);
                    
                    if (fields != JSON_INVALID && fields != "") {
                        // Extract currency mapFields using same pattern as Bridge Stipends
                        // Bridge Stipends does: llJsonGetValue(fields, ["stipend","mapValue","fields"])
                        string currencyFields = llJsonGetValue(fields, ["currency","mapValue","fields"]);
                        
                        string currencyFieldsStatus = "EMPTY/INVALID";
                        if (currencyFields != JSON_INVALID && currencyFields != "") {
                            currencyFieldsStatus = currencyFields;
                        }
                        debugLog("GET_CURRENCY_FOR_UPDATE: currencyFields extracted: " + currencyFieldsStatus);
                        
                        if (currencyFields != JSON_INVALID && currencyFields != "") {
                            // Directly extract integerValue strings (same pattern as Bridge Stipends)
                            string goldStr = llJsonGetValue(currencyFields, ["gold","integerValue"]);
                            string silverStr = llJsonGetValue(currencyFields, ["silver","integerValue"]);
                            string copperStr = llJsonGetValue(currencyFields, ["copper","integerValue"]);
                            
                            debugLog("GET_CURRENCY_FOR_UPDATE: Extracted values - goldStr='" + goldStr + "', silverStr='" + silverStr + "', copperStr='" + copperStr + "'");
                            
                            if (goldStr != JSON_INVALID && goldStr != "") {
                                currentGold = (integer)goldStr;
                            }
                            if (silverStr != JSON_INVALID && silverStr != "") {
                                currentSilver = (integer)silverStr;
                            }
                            if (copperStr != JSON_INVALID && copperStr != "") {
                                currentCopper = (integer)copperStr;
                            }
                        } else {
                            debugLog("GET_CURRENCY_FOR_UPDATE: WARNING - currencyFields is empty/invalid, using defaults (0,0,0)");
                        }
                    } else {
                        debugLog("GET_CURRENCY_FOR_UPDATE: WARNING - fields is empty/invalid");
                    }
                    
                    debugLog("GET_CURRENCY_FOR_UPDATE: Current currency - gold=" + (string)currentGold + ", silver=" + (string)currentSilver + ", copper=" + (string)currentCopper);
                    
                    // Add deltas
                    integer newGold = currentGold + goldDelta;
                    integer newSilver = currentSilver + silverDelta;
                    integer newCopper = currentCopper + copperDelta;
                    
                    debugLog("GET_CURRENCY_FOR_UPDATE: New totals - gold=" + (string)newGold + ", silver=" + (string)newSilver + ", copper=" + (string)newCopper);
                    
                    // Now update with new totals
                    string patchUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID + "?updateMask.fieldPaths=currency.gold&updateMask.fieldPaths=currency.silver&updateMask.fieldPaths=currency.copper";
                    
                    list patchBodyParts = [
                        "{\"fields\":{\"currency\":{\"mapValue\":{\"fields\":{\"gold\":{\"integerValue\":\"",
                        (string)newGold,
                        "\"},\"silver\":{\"integerValue\":\"",
                        (string)newSilver,
                        "\"},\"copper\":{\"integerValue\":\"",
                        (string)newCopper,
                        "\"}}}}}}"
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
                    
                    pendingCharOps += [patchRequestId, "UPDATE_CURRENCY", senderLink];
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CURRENCY_UPDATED_ERROR", "Failed to read current currency: Status " + (string)status);
                }
                return;
            }
            
            // Handle UPDATE_CURRENCY (PATCH response)
            if (operation == "UPDATE_CURRENCY") {
                integer senderLink = llList2Integer(pendingCharOps, opIndex + 2);
                
                pendingCharOps = llDeleteSubList(pendingCharOps, opIndex, opIndex + 2);
                
                if (status == 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CURRENCY_UPDATED|OK", "");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CURRENCY_UPDATED_ERROR", "Status " + (string)status);
                }
                return;
            }
        }
    }
}

