// Feudalism 4 - Bridge Inventory Module
// ============================================================================
// Handles inventory operations: read, write, pagination, fGiveItem/fTakeItem
// ============================================================================

// Import constants
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
integer FS_BRIDGE_CHANNEL = -777001;
integer INVENTORY_CHANNEL = -454545;

// Owner info
key ownerKey;
string ownerUUID;

// Request tracking for inventory operations
list pendingInventoryUpdates;
integer MAX_PENDING_INVENTORY = 10;

// ====================== SIMPLE ATOMIC-GET PAGING ======================

// Page state
list    pg_itemIds          = [];
integer pg_index            = 0;
integer pg_hasMore          = FALSE;
string  pg_characterId      = "";
integer pg_pageSize         = 5;
string  pg_itemsJson        = "[]";
integer pg_active           = FALSE;
// Page token storage for pagination
string  pg_pageToken        = "";
string  lastHudCursor      = "";
list    outstandingPageTokens = []; // pairs: [token, timestamp]
integer PAGE_TOKEN_TTL_SECONDS = 300; // 5 minutes

// =========================== DEBUG ==========================================

// DEBUG: set to FALSE for production; enable only while troubleshooting
integer DEBUG_MODE = FALSE;

// Page size hard cap (keeps per-page atomic GETs small to avoid LSL HTTP body truncation)
integer INVENTORY_PAGE_SIZE_CAP = 5;

debugLog(string msg) {
    if (DEBUG_MODE) {
        llOwnerSay("[Bridge] " + msg);
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

// Clean up expired outstanding page tokens
cleanupOutstandingTokens() {
    integer now = llGetUnixTime();
    list newList = [];
    integer k;
    for (k = 0; k < llGetListLength(outstandingPageTokens); k += 2) {
        string tok = llList2String(outstandingPageTokens, k);
        integer ts = (integer)llList2String(outstandingPageTokens, k + 1);
        if (now - ts <= PAGE_TOKEN_TTL_SECONDS) {
            newList += [ tok, (string)ts ];
        }
    }
    outstandingPageTokens = newList;
}

// Reset paging state
resetPagingState() {
    pg_active = FALSE;
    pg_itemIds = [];
    pg_itemsJson = "[]";
    pg_index = 0;
    pg_hasMore = FALSE;
    pg_characterId = "";
    pg_pageSize = 5;
    pg_pageToken = "";
}

// =========================== INVENTORY OPERATIONS ===========================

// ---------- SEND INVENTORY PAGE (replace existing final-send/reset block) ----------
sendInventoryPage() {
    string cursorJson = "\"" + pg_pageToken + "\"";
    string hasMoreJson = "false";
    if (pg_hasMore) {
        hasMoreJson = "true";
    }
    if (pg_itemsJson == "") {
        pg_itemsJson = "[]";
    }
    string responseJson = "{\"items\":" + pg_itemsJson + ",\"cursor\":" + cursorJson + ",\"hasMore\":" + hasMoreJson + "}";


    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryPage", responseJson);

    cleanupOutstandingTokens();
    resetPagingState();
}

// Request inventory page
getInventoryPage(string characterId, string cursor, integer pageSize) {
    if (FIREBASE_PROJECT_ID == "" || characterId == "") {
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL,
            "inventoryPage",
            "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
        return;
    }

    if (pageSize > INVENTORY_PAGE_SIZE_CAP) pageSize = INVENTORY_PAGE_SIZE_CAP;
    if (pageSize < 1)  pageSize = 1;

    lastHudCursor = cursor;

    // Initialize paging state
    pg_itemIds = [];
    pg_index = 0;
    pg_hasMore = FALSE;
    pg_characterId = characterId;
    pg_pageSize = pageSize;
    pg_itemsJson = "[]";
    pg_active = TRUE;
    pg_pageToken = ""; // reset for this request

    // Build collection GET URL with optional pageToken
    string listUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents/characters/" + characterId
        + "/inventory?pageSize=" + (string)pageSize;
    if (cursor != "" && cursor != NULL_KEY) {
        listUrl += "&pageToken=" + cursor;
    }


    key listReq = llHTTPRequest(
        listUrl,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );

    // Track this request so http_response can parse documents and start atomic GETs
    pendingInventoryUpdates += [ listReq, "LIST_INVENTORY" ];
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
    
    // Get characterId from linkset data (set by other bridge modules)
    string characterId = llLinksetDataRead("characterId");
    if (characterId == "") {
        return;
    }
    
    string deltasJson = "{\"itemNames\":[\"" + itemName + "\"],\"deltas\":[" + (string)delta + "]}";
    applyInventoryDeltas(characterId, deltasJson);
}

// Request to consume an item
// Writes to users/<uid>/consume_requests/<auto-id>
requestConsumeItem(string itemId, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Project ID not configured");
        return;
    }
    
    if (itemId == "" || ownerUUID == "") {
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Invalid parameters");
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
        if (num != INVENTORY_CHANNEL) return;

        string command = msg;
        string payload = (string)id;

        // Route commands by name
        if (command == "getInventoryPage") {
            string characterId = llJsonGetValue(payload, ["characterId"]);
            string cursor      = llJsonGetValue(payload, ["cursor"]);
            string pageSizeStr = llJsonGetValue(payload, ["pageSize"]);
            
            integer pageSize = (integer)pageSizeStr;
            if (pageSize < 1) pageSize = 1;

            // Detect HUD consuming outstanding tokens
            if (cursor != "" && cursor != NULL_KEY) {
                integer pairIndex = -1;
                integer j;
                for (j = 0; j < llGetListLength(outstandingPageTokens); j += 2) {
                    if (llList2String(outstandingPageTokens, j) == cursor) {
                        pairIndex = j;
                        jump done_token_search;
                    }
                }
                @done_token_search;
                if (pairIndex != -1) {
                    outstandingPageTokens = llDeleteSubList(outstandingPageTokens, pairIndex, pairIndex + 1);
                }
            }

            getInventoryPage(characterId, cursor, pageSize);
        }
        else if (command == "applyInventoryDeltas") {
            string characterId = llJsonGetValue(payload, ["characterId"]);
            string deltasJson  = llJsonGetValue(payload, ["deltas"]);
            applyInventoryDeltas(characterId, deltasJson);
        }
        else if (command == "fGiveItem" || command == "fTakeItem") {
            list parts = llParseString2List(payload, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string itemName = normalizeItemName(llList2String(parts, 0));
                integer qty     = (integer)llList2String(parts, 1);
                if (qty > 0) {
                    string op;
                    if (command == "fGiveItem") {
                        op = "GIVE";
                    } else {
                        op = "TAKE";
                    }
                    updateInventory(itemName, qty, op);
                }
            }
        }
        else if (command == "requestConsumeItem") {
            string itemId = payload;
            if (itemId != "") {
                requestConsumeItem(itemId, LINK_SET);
            } else {
                llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL,
                                "CONSUME_REQUEST_ERROR",
                                "Invalid item ID");
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
        // Defensive guard: if pg_index grows absurdly large, abort page
        if (pg_active && pg_index > 1000) {
            debugLog("SANITY: pg_index exceeded threshold, aborting page");
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL,
                "inventoryPage",
                "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
            pg_active = FALSE;
            pg_itemIds = [];
            pg_itemsJson = "[]";
            pg_index = 0;
            pg_hasMore = FALSE;
            pg_characterId = "";
            return;
        }

        integer inventoryIndex = llListFindList(pendingInventoryUpdates, [request_id]);
        
        if (inventoryIndex != -1) {
            string operation = llList2String(pendingInventoryUpdates, inventoryIndex + 1);
            
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
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_SENT", itemId);
                    
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
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Status " + (string)status);
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
            
            // LIST_INVENTORY handler (captures nextPageToken)
            if (operation == "LIST_INVENTORY") {
                // Remove tracking entry
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 1);

                if (status != 200) {
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL,
                        "inventoryPage",
                        "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
                    pg_active = FALSE;
                    if (DEBUG_MODE) debugLog("LIST_ERR: status=" + (string)status);
                    return;
                }

                // Check if response is truncated (LSL limit is 2048 bytes)
                if (llStringLength(body) >= 2047) {
                    if (DEBUG_MODE) debugLog("WARNING: Response truncated! Reducing page size.");
                    if (INVENTORY_PAGE_SIZE_CAP > 2) {
                        INVENTORY_PAGE_SIZE_CAP = INVENTORY_PAGE_SIZE_CAP - 1;
                    }
                }

                // NEW: Parse documents directly to extract both item ID and qty (single-phase fetching)
                // This eliminates the need for individual GET requests per item
                string documentsJson = llJsonGetValue(body, ["documents"]);
                string itemsJson = "[]";
                integer itemCount = 0;
                
                if (documentsJson != JSON_INVALID && documentsJson != "") {
                    integer i = 0;
                    while (TRUE) {
                        string docJson = llJsonGetValue(documentsJson, [i]);
                        if (docJson == JSON_INVALID || docJson == "") jump done_parse_docs;
                        
                        string itemId = "";
                        integer qty = 0;
                        
                        // Extract document name to get item ID
                        string docName = llJsonGetValue(docJson, ["name"]);
                        if (docName != JSON_INVALID && docName != "") {
                            // Remove quotes
                            if (llGetSubString(docName, 0, 0) == "\"" && llGetSubString(docName, -1, -1) == "\"") {
                                docName = llGetSubString(docName, 1, -2);
                            }
                            
                            // Extract item ID from path: .../inventory/{itemId}
                            integer lastSlash = llSubStringIndex(docName, "/inventory/");
                            if (lastSlash != -1) {
                                itemId = llGetSubString(docName, lastSlash + 11, -1);
                            }
                        }
                        
                        // Extract fields to get qty
                        string fieldsJson = llJsonGetValue(docJson, ["fields"]);
                        if (fieldsJson != JSON_INVALID && fieldsJson != "") {
                            // Get qty field
                            string qtyField = llJsonGetValue(fieldsJson, ["qty"]);
                            string qtyStr = extractFirestoreValue(qtyField);
                            qty = (integer)qtyStr;
                        }
                        
                        // Only add items with valid ID and quantity > 0
                        if (itemId != "" && qty > 0) {
                            string itemObj = "{\"name\":\"" + itemId + "\",\"qty\":" + (string)qty + "}";
                            if (itemsJson == "[]") {
                                itemsJson = "[" + itemObj + "]";
                            } else {
                                itemsJson = llGetSubString(itemsJson, 0, -2) + "," + itemObj + "]";
                            }
                            itemCount++;
                        }
                        
                        i++;
                    }
                    @done_parse_docs;
                }

                // Capture Firestore nextPageToken (if present)
                string nextToken = llJsonGetValue(body, ["nextPageToken"]);
                if (nextToken != "" && nextToken != JSON_INVALID) {
                    if (llGetSubString(nextToken, 0, 0) == "\"" && llGetSubString(nextToken, -1, -1) == "\"") {
                        nextToken = llGetSubString(nextToken, 1, -2);
                    }
                } else {
                    nextToken = "";
                }


                // Build and send response immediately (no need for atomic GET loop)
                string cursorJson = "\"" + nextToken + "\"";
                string hasMoreJson = "false";
                integer hasMore = (nextToken != "");
                if (hasMore) {
                    hasMoreJson = "true";
                    // Add outstanding token record for watchdog
                    outstandingPageTokens += [ nextToken, (string)llGetUnixTime() ];
                }
                
                string responseJson = "{\"items\":" + itemsJson + ",\"cursor\":" + cursorJson + ",\"hasMore\":" + hasMoreJson + "}";
                
                llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryPage", responseJson);
                
                cleanupOutstandingTokens();
                resetPagingState();
                
                return;
            }
            
        }

    }
}

