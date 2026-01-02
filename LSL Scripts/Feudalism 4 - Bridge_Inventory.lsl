// Feudalism 4 - Bridge Inventory Module
// ============================================================================
// Handles inventory operations: read, write, pagination, fGiveItem/fTakeItem
// ============================================================================

// Import constants
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
integer FS_BRIDGE_CHANNEL = -777001;
integer MODULE_CHANNEL = -777002;
integer INVENTORY_CHANNEL = -454545;
string DOMAIN_INV = "INV";

// Owner info
key ownerKey;
string ownerUUID;

// Request tracking for inventory operations
list pendingInventoryUpdates;
integer MAX_PENDING_INVENTORY = 10;

// Current character cache
string currentCharacterId = "";

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
    
    string mapValue = llJsonGetValue(fieldData, ["mapValue"]);
    if (mapValue != JSON_INVALID && mapValue != "") {
        string mapFields = llJsonGetValue(mapValue, ["fields"]);
        if (mapFields != JSON_INVALID && mapFields != "") {
            return mapFields;
        }
    }
    
    return "";
}

string normalizeItemName(string name) {
    return llToLower(llStringTrim(name, STRING_TRIM));
}

cleanupTrackingLists() {
    if (llGetListLength(pendingInventoryUpdates) > MAX_PENDING_INVENTORY * 5) {
        pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, 0, 4);
    }
}

// Get character document ID (helper - calls Characters module via link)
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

// =========================== INVENTORY OPERATIONS ===========================

// Get inventory field from users collection (legacy - routes through character)
getInventoryFromFirestore(integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
        return;
    }
    
    key requestId = getCharacterInfo();
    pendingInventoryUpdates += [requestId, "GET_INVENTORY_CHARACTER", senderLink];
    cleanupTrackingLists();
}

// Get inventory page from Firestore (v2: subcollection)
getInventoryPage(string characterId, string cursor, integer pageSize, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
        return;
    }
    
    if (characterId == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
        return;
    }
    
    if (pageSize > 100) {
        pageSize = 100;
    } else if (pageSize < 1) {
        pageSize = 20;
    }
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents:runQuery";
    
    string parentPath = "projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents/characters/" + characterId;
    
    list queryParts = [
        "{\"structuredQuery\":{",
            "\"from\":[{",
                "\"collectionId\":\"inventory\",",
                "\"allDescendants\":true",
            "}],",
            "\"orderBy\":[{",
                "\"field\":{\"fieldPath\":\"__name__\"},",
                "\"direction\":\"ASCENDING\"",
            "}],",
            "\"limit\":" + (string)pageSize
    ];
    
    if (cursor != "") {
        string cursorDocPath = parentPath + "/inventory/" + cursor;
        queryParts += [
            ",",
            "\"startAfter\":[{",
                "\"referenceValue\":\"" + cursorDocPath + "\"",
            "}]"
        ];
    }
    
    queryParts += [
        "},",
        "\"parent\":\"" + parentPath + "\"",
        "}"
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
    
    pendingInventoryUpdates += [requestId, "GET_INVENTORY_PAGE", senderLink, cursor, pageSize];
    cleanupTrackingLists();
}

// Apply multiple inventory deltas atomically
applyInventoryDeltas(string characterId, string deltasJson) {
    if (FIREBASE_PROJECT_ID == "") {
        return;
    }
    
    if (characterId == "") {
        return;
    }
    
    if (deltasJson == "" || deltasJson == "{}" || deltasJson == JSON_INVALID) {
        return;
    }
    
    string url = "https://firestore.googleapis.com/v1/projects/" 
        + FIREBASE_PROJECT_ID 
        + "/databases/(default)/documents:commit";
    
    list writes = [];
    integer writeCount = 0;
    
    string itemNamesJson = llJsonGetValue(deltasJson, ["itemNames"]);
    string deltasArrayJson = llJsonGetValue(deltasJson, ["deltas"]);
    
    if (itemNamesJson != JSON_INVALID && itemNamesJson != "" && deltasArrayJson != JSON_INVALID && deltasArrayJson != "") {
        integer i = 0;
        while (TRUE) {
            string itemName = llJsonGetValue(itemNamesJson, [i]);
            if (itemName == JSON_INVALID || itemName == "") jump done_deltas;
            
            if (llStringLength(itemName) >= 2 && llGetSubString(itemName, 0, 0) == "\"" && llGetSubString(itemName, -1, -1) == "\"") {
                itemName = llGetSubString(itemName, 1, -2);
            }
            
            string deltaStr = llJsonGetValue(deltasArrayJson, [i]);
            if (deltaStr != JSON_INVALID && deltaStr != "") {
                if (llStringLength(deltaStr) >= 2 && llGetSubString(deltaStr, 0, 0) == "\"" && llGetSubString(deltaStr, -1, -1) == "\"") {
                    deltaStr = llGetSubString(deltaStr, 1, -2);
                }
                
                integer deltaValue = (integer)deltaStr;
                
                if (deltaValue != 0) {
                    string docPath = "projects/" + FIREBASE_PROJECT_ID
                        + "/databases/(default)/documents/characters/" + characterId
                        + "/inventory/" + itemName;
                    
                    if (writeCount > 0) {
                        writes += ",";
                    }
                    
                    writes += [
                        "{\"transform\":{",
                            "\"document\":\"" + docPath + "\",",
                            "\"fieldTransforms\":[{",
                                "\"fieldPath\":\"qty\",",
                                "\"increment\":{\"integerValue\":\"" + (string)deltaValue + "\"}",
                            "}]",
                        "}}"
                    ];
                    writeCount++;
                }
            }
            i++;
        }
    }
    @done_deltas;
    
    if (writeCount == 0) {
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasApplied", "");
        return;
    }
    
    list jsonParts = [
        "{\"writes\":[",
            llDumpList2String(writes, ""),
        "]}"
    ];
    
    string commitJson = llDumpList2String(jsonParts, "");
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        commitJson
    );
    
    pendingInventoryUpdates += [requestId, "APPLY_INVENTORY_DELTAS"];
    cleanupTrackingLists();
}

// Update inventory (GIVE/TAKE)
updateInventory(string itemName, integer qty, string operation) {
    if (FIREBASE_PROJECT_ID == "") {
        return;
    }
    
    if (qty == 0) {
        return;
    }
    
    integer delta;
    if (operation == "GIVE") {
        delta = qty;
    } else if (operation == "TAKE") {
        delta = -qty;
    } else {
        return;
    }
    
    cleanupTrackingLists();
    
    key requestId = getCharacterInfo();
    pendingInventoryUpdates += [requestId, "GET_CHARACTER_ID", operation, itemName, delta];
}

// Request to consume an item
// Writes to users/<uid>/consume_requests/<auto-id>
requestConsumeItem(string itemId, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Project ID not configured");
        return;
    }
    
    if (itemId == "" || ownerUUID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Invalid parameters");
        return;
    }
    
    // Write to Firestore: feud4/users/<uid>/consume_requests/<auto-id>
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents/feud4/users/" + ownerUUID + "/consume_requests";
    
    list docParts = [
        "{\"fields\":{",
            "\"item_id\":{\"stringValue\":\"", itemId, "\"}",
        "}}"
    ];
    string docJson = llDumpList2String(docParts, "");
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        docJson
    );
    
    // Track request: [requestId, "REQUEST_CONSUME_ITEM", itemId, senderLink]
    pendingInventoryUpdates += [requestId, "REQUEST_CONSUME_ITEM", itemId, senderLink];
    cleanupTrackingLists();
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        
        llListen(INVENTORY_CHANNEL, "", NULL_KEY, "");
    }
    
    // Handle routed commands from Bridge_Main
    link_message(integer sender_num, integer num, string msg, key id) {
        if (num != MODULE_CHANNEL) return;
        
        list parts = llParseString2List(msg, ["|"], []);
        if (llGetListLength(parts) < 4) return;
        
        string domain = llList2String(parts, 0);
        if (domain != DOMAIN_INV) return;
        
        string command = llList2String(parts, 1);
        string payload = llList2String(parts, 2);
        integer originalSenderLink = (integer)llList2String(parts, 3);
        
        // Route command
        if (command == "getInventory") {
            getInventoryFromFirestore(originalSenderLink);
        }
        else if (command == "getInventoryPage") {
            // Parse JSON payload: { "characterId": "...", "cursor": "...", "pageSize": int }
            string characterId = llJsonGetValue(payload, ["characterId"]);
            string cursor = llJsonGetValue(payload, ["cursor"]);
            string pageSizeStr = llJsonGetValue(payload, ["pageSize"]);
            
            if (characterId != JSON_INVALID && characterId != "") {
                if (llStringLength(characterId) >= 2 && llGetSubString(characterId, 0, 0) == "\"" && llGetSubString(characterId, -1, -1) == "\"") {
                    characterId = llGetSubString(characterId, 1, -2);
                }
            }
            
            if (cursor != JSON_INVALID && cursor != "") {
                if (llStringLength(cursor) >= 2 && llGetSubString(cursor, 0, 0) == "\"" && llGetSubString(cursor, -1, -1) == "\"") {
                    cursor = llGetSubString(cursor, 1, -2);
                }
            }
            
            integer pageSize = (integer)pageSizeStr;
            if (pageSize < 1) pageSize = 20;
            
            getInventoryPage(characterId, cursor, pageSize, originalSenderLink);
        }
        else if (command == "applyInventoryDeltas") {
            // Parse: characterId|deltasJson
            list payloadParts = llParseString2List(payload, ["|"], []);
            if (llGetListLength(payloadParts) >= 2) {
                string characterId = llList2String(payloadParts, 0);
                string deltasJson = llList2String(payloadParts, 1);
                applyInventoryDeltas(characterId, deltasJson);
            }
        }
        else if (command == "fGiveItem" || command == "fTakeItem") {
            // Parse: itemName|qty
            list payloadParts = llParseString2List(payload, ["|"], []);
            if (llGetListLength(payloadParts) >= 2) {
                string itemName = normalizeItemName(llList2String(payloadParts, 0));
                integer qty = (integer)llList2String(payloadParts, 1);
                if (qty > 0) {
                    string operation;
                    if (command == "fGiveItem") {
                        operation = "GIVE";
                    } else {
                        operation = "TAKE";
                    }
                    updateInventory(itemName, qty, operation);
                    if (command == "fGiveItem") {
                        llOwnerSay("Received " + (string)qty + " " + itemName);
                    } else {
                        llOwnerSay("Removed " + (string)qty + " " + itemName);
                    }
                }
            }
        }
        else if (command == "requestConsumeItem") {
            // Parse: itemId (payload is just the itemId)
            string itemId = payload;
            if (itemId != "") {
                requestConsumeItem(itemId, originalSenderLink);
            } else {
                llMessageLinked(originalSenderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Invalid item ID");
            }
        }
    }
    
    // Handle inventory messages from world objects
    listen(integer channel, string name, key id, string message) {
        if (channel != INVENTORY_CHANNEL) return;
        
        if (llSubStringIndex(message, "fGiveItem,") == 0) {
            list parts = llParseString2List(message, [","], []);
            if (llGetListLength(parts) == 3) {
                string itemName = normalizeItemName(llList2String(parts, 1));
                integer qty = (integer)llList2String(parts, 2);
                if (qty > 0) {
                    updateInventory(itemName, qty, "GIVE");
                    llOwnerSay("Received " + (string)qty + " " + itemName);
                }
            }
        }
        else if (llSubStringIndex(message, "fTakeItem,") == 0) {
            list parts = llParseString2List(message, [","], []);
            if (llGetListLength(parts) == 3) {
                string itemName = normalizeItemName(llList2String(parts, 1));
                integer qty = (integer)llList2String(parts, 2);
                if (qty > 0) {
                    updateInventory(itemName, qty, "TAKE");
                    llOwnerSay("Removed " + (string)qty + " " + itemName);
                }
            }
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        integer inventoryIndex = llListFindList(pendingInventoryUpdates, [request_id]);
        
        if (inventoryIndex != -1) {
            string operation = llList2String(pendingInventoryUpdates, inventoryIndex + 1);
            
            // Handle GET_INVENTORY_CHARACTER
            if (operation == "GET_INVENTORY_CHARACTER") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                
                if (status != 200) {
                    llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
                    return;
                }
                
                string firstResult = llJsonGetValue(body, [0]);
                string characterId = "";
                if (firstResult != JSON_INVALID && firstResult != "") {
                    string document = llJsonGetValue(firstResult, ["document"]);
                    if (document != JSON_INVALID && document != "") {
                        string name = llJsonGetValue(document, ["name"]);
                        if (name != JSON_INVALID && name != "") {
                            list parts = llParseString2List(name, ["/"], []);
                            characterId = llList2String(parts, llGetListLength(parts) - 1);
                        }
                    }
                }
                
                if (characterId == "") {
                    llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
                    return;
                }
                
                llLinksetDataWrite("characterId", characterId);
                currentCharacterId = characterId;
                
                // Request inventory field via Characters module (getFieldByUUID for "inventory" field)
                llMessageLinked(LINK_SET, MODULE_CHANNEL, "CHAR|getInventory|" + ownerUUID + "|" + (string)senderLink, NULL_KEY);
                return;
            }
            
            // Handle GET_CHARACTER_ID for inventory update
            if (operation == "GET_CHARACTER_ID") {
                string op = llList2String(pendingInventoryUpdates, inventoryIndex + 2);
                string itemName = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                integer delta = llList2Integer(pendingInventoryUpdates, inventoryIndex + 4);
                
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 4);
                
                if (status == 200) {
                    string firstResult = llJsonGetValue(body, [0]);
                    string characterId = "";
                    if (firstResult != JSON_INVALID && firstResult != "") {
                        string document = llJsonGetValue(firstResult, ["document"]);
                        if (document != JSON_INVALID && document != "") {
                            string name = llJsonGetValue(document, ["name"]);
                            if (name != JSON_INVALID && name != "") {
                                list pathParts = llParseString2List(name, ["/"], []);
                                integer len = llGetListLength(pathParts);
                                if (len > 0) {
                                    characterId = llList2String(pathParts, len - 1);
                                }
                            }
                        }
                    }
                    
                    if (characterId != "") {
                        currentCharacterId = characterId;
                        string deltasJson = "{\"itemNames\":[\"" + itemName + "\"],\"deltas\":[" + (string)delta + "]}";
                        applyInventoryDeltas(characterId, deltasJson);
                    }
                }
                return;
            }
            
            // Handle APPLY_INVENTORY_DELTAS
            if (operation == "APPLY_INVENTORY_DELTAS") {
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 1);
                
                if (status == 200) {
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasApplied", "");
                } else {
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasError", "Status " + (string)status);
                }
                return;
            }
            
            // Handle REQUEST_CONSUME_ITEM (POST to consume_requests)
            if (operation == "REQUEST_CONSUME_ITEM") {
                string itemId = llList2String(pendingInventoryUpdates, inventoryIndex + 2);
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 3);
                
                // Remove from tracking (4 elements: requestId, "REQUEST_CONSUME_ITEM", itemId, senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 3);
                
                if (status == 200 || status == 201) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_SENT", itemId);
                    
                    // Server confirmed consumable was processed - fetch consumable definition and send BUFF_TRIGGER
                    // Path: feud4/consumables/master/{itemId}
                    string consumableUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID
                        + "/databases/(default)/documents/feud4/consumables/master/" + llToLower(itemId);
                    
                    key consumableRequestId = llHTTPRequest(
                        consumableUrl,
                        [
                            HTTP_METHOD, "GET",
                            HTTP_MIMETYPE, "application/json"
                        ],
                        ""
                    );
                    
                    // Track: [requestId, "GET_CONSUMABLE", itemId]
                    pendingInventoryUpdates += [consumableRequestId, "GET_CONSUMABLE", itemId];
                    cleanupTrackingLists();
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle GET_CONSUMABLE (fetch consumable definition to get effect data)
            if (operation == "GET_CONSUMABLE") {
                string itemId = llList2String(pendingInventoryUpdates, inventoryIndex + 2);
                
                // Remove from tracking (3 elements: requestId, "GET_CONSUMABLE", itemId)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                
                if (status == 200) {
                    // Parse consumable definition
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        // Extract effect_type, effect_value, duration_seconds
                        string effectTypeField = llJsonGetValue(fields, ["effect_type"]);
                        string effectValueField = llJsonGetValue(fields, ["effect_value"]);
                        string durationField = llJsonGetValue(fields, ["duration_seconds"]);
                        
                        string effectType = "";
                        integer effectValue = 0;
                        integer durationSeconds = 0;
                        
                        // Extract effect_type (stringValue)
                        if (effectTypeField != JSON_INVALID && effectTypeField != "") {
                            string stringValue = llJsonGetValue(effectTypeField, ["stringValue"]);
                            if (stringValue != JSON_INVALID && stringValue != "") {
                                // Remove quotes if present
                                if (llStringLength(stringValue) >= 2 && llGetSubString(stringValue, 0, 0) == "\"" && llGetSubString(stringValue, -1, -1) == "\"") {
                                    stringValue = llGetSubString(stringValue, 1, -2);
                                }
                                effectType = stringValue;
                            }
                        }
                        
                        // Extract effect_value (integerValue)
                        if (effectValueField != JSON_INVALID && effectValueField != "") {
                            string intValue = llJsonGetValue(effectValueField, ["integerValue"]);
                            if (intValue != JSON_INVALID && intValue != "") {
                                // Remove quotes if present
                                if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                    intValue = llGetSubString(intValue, 1, -2);
                                }
                                effectValue = (integer)intValue;
                            }
                        }
                        
                        // Extract duration_seconds (integerValue)
                        if (durationField != JSON_INVALID && durationField != "") {
                            string intValue = llJsonGetValue(durationField, ["integerValue"]);
                            if (intValue != JSON_INVALID && intValue != "") {
                                // Remove quotes if present
                                if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                    intValue = llGetSubString(intValue, 1, -2);
                                }
                                durationSeconds = (integer)intValue;
                            }
                        }
                        
                        // Only send BUFF_TRIGGER if duration > 0 (timed buffs only, instant effects are handled server-side)
                        if (durationSeconds > 0 && effectType != "") {
                            string buffTrigger = "BUFF_TRIGGER|" + effectType + "|" + (string)effectValue + "|" + (string)durationSeconds;
                            llMessageLinked(LINK_SET, 0, buffTrigger, NULL_KEY);
                        }
                    }
                }
                // If status != 200, silently fail (consumable might not exist, but that's okay)
                return;
            }
            
            // Handle GET_INVENTORY_PAGE
            if (operation == "GET_INVENTORY_PAGE") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                string cursor = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                integer pageSize = llList2Integer(pendingInventoryUpdates, inventoryIndex + 4);
                
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 4);
                
                if (status != 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
                    return;
                }
                
                list items = [];
                string lastItemId = "";
                integer hasMore = FALSE;
                
                integer i = 0;
                integer documentCount = 0;
                while (TRUE) {
                    string resultEntry = llJsonGetValue(body, [i]);
                    if (resultEntry == JSON_INVALID || resultEntry == "") jump done_parse_results;
                    
                    string document = llJsonGetValue(resultEntry, ["document"]);
                    if (document == JSON_INVALID || document == "") {
                        i++;
                        jump continue_parse_results;
                    }
                    
                    documentCount++;
                    
                    string docName = llJsonGetValue(document, ["name"]);
                    if (docName == JSON_INVALID || docName == "") {
                        i++;
                        jump continue_parse_results;
                    }
                    
                    if (llStringLength(docName) >= 2 && llGetSubString(docName, 0, 0) == "\"" && llGetSubString(docName, -1, -1) == "\"") {
                        docName = llGetSubString(docName, 1, -2);
                    }
                    
                    list pathParts = llParseString2List(docName, ["/"], []);
                    integer pathLen = llGetListLength(pathParts);
                    if (pathLen >= 2) {
                        string itemId = llList2String(pathParts, pathLen - 1);
                        lastItemId = itemId;
                        
                        string fields = llJsonGetValue(document, ["fields"]);
                        if (fields != JSON_INVALID && fields != "") {
                            string qtyField = llJsonGetValue(fields, ["qty"]);
                            
                            if (qtyField != JSON_INVALID && qtyField != "") {
                                string qtyStr = llJsonGetValue(qtyField, ["integerValue"]);
                                if (qtyStr == JSON_INVALID || qtyStr == "") {
                                    qtyStr = llJsonGetValue(qtyField, ["doubleValue"]);
                                }
                                if (qtyStr == JSON_INVALID || qtyStr == "") {
                                    qtyStr = llJsonGetValue(qtyField, ["stringValue"]);
                                }
                                
                                if (qtyStr != JSON_INVALID && qtyStr != "" && llStringLength(qtyStr) >= 2 && llGetSubString(qtyStr, 0, 0) == "\"" && llGetSubString(qtyStr, -1, -1) == "\"") {
                                    qtyStr = llGetSubString(qtyStr, 1, -2);
                                }
                                
                                integer qty = (integer)qtyStr;
                                
                                if (qty > 0) {
                                    string itemJson = "{\"name\":\"" + itemId + "\",\"qty\":" + (string)qty + "}";
                                    items += [itemJson];
                                }
                            }
                        }
                    }
                    
                    i++;
                    @continue_parse_results;
                }
                @done_parse_results;
                
                integer itemCount = llGetListLength(items);
                if (itemCount == pageSize) {
                    hasMore = TRUE;
                }
                
                list responseParts = ["{\"items\":["];
                integer j;
                for (j = 0; j < itemCount; j++) {
                    if (j > 0) responseParts += ",";
                    responseParts += [llList2String(items, j)];
                }
                responseParts += [
                    "],\"cursor\":\"" + lastItemId + "\",\"hasMore\":" + (string)hasMore + "}"
                ];
                
                string responseJson = llDumpList2String(responseParts, "");
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", responseJson);
                return;
            }
        }
    }
}

