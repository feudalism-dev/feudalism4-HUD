// Feudalism 4 - Players HUD Firestore Bridge
// ============================================================================
// Direct Firestore REST API access - no middleware, no redirects, no OAuth
// Uses field masks to retrieve only needed fields, avoiding truncation
// INVENTORY UPDATED: uses atomic increments via documents:commit
// ============================================================================

// Debug settings
integer DEBUG_MODE = TRUE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging (optimized to reduce string operations)
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[FS Bridge] " + message);
    }
}

// Firebase Project Configuration (for direct Firestore reads)
string FIREBASE_PROJECT_ID = "feudalism4-rpg";

// Communication - using link_message for Data Manager (same linkset)
// Also listens on channel -454545 for GIVE_ITEM/TAKE_ITEM messages from world objects
integer INVENTORY_CHANNEL = -454545;
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Bridge responses to HUD controllers

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
string firestoreRestBase;
string currentCharacterId = ""; // Cache current character document ID
string currentUniverseId = "default"; // Cache current character's universe_id

// Request tracking for concurrent field requests
// Format: [requestId1, fieldName1, senderLink1, requestId2, fieldName2, senderLink2, ...]
// LIMITED SIZE to prevent memory issues - max 20 pending requests
list pendingRequests;
integer MAX_PENDING_REQUESTS = 20;

// Inventory update tracking
// Format for inventory flow now:
//   GET_CHARACTER_ID: [requestId, "GET_CHARACTER_ID", operation, itemName, qty]
//   PATCH_INVENTORY: [requestId, "PATCH_INVENTORY", itemName, delta]
//   GET_INVENTORY_CHARACTER: [requestId, "GET_INVENTORY_CHARACTER", senderLink]
//   GET_INVENTORY: [requestId, "GET_INVENTORY", senderLink]
//   APPLY_INVENTORY_DELTAS: [requestId, "APPLY_INVENTORY_DELTAS"]
//   GET_INVENTORY_PAGE: [requestId, "GET_INVENTORY_PAGE", senderLink, page, pageSize]
list pendingInventoryUpdates;
integer MAX_PENDING_INVENTORY = 10;

// =========================== UTILITY FUNCTIONS ==============================

// Helper to determine which UUID to use (provided target or owner's UUID)
string getUUIDToUse(string targetUUID) {
    if (targetUUID != "") {
        return targetUUID;
    } else {
        return ownerUUID;
    }
}

// Extract value from Firestore field format (optimized)
// Handles: {"stringValue":"value"}, {"integerValue":123}, {"booleanValue":true}, {"mapValue":{...}}
string extractFirestoreValue(string fieldData) {
    if (fieldData == JSON_INVALID || fieldData == "") {
        return "";
    }
    
    // Try stringValue first (most common)
    string stringVal = llJsonGetValue(fieldData, ["stringValue"]);
    if (stringVal != JSON_INVALID && stringVal != "") {
        return stringVal;
    }
    
    // Try integerValue
    string intVal = llJsonGetValue(fieldData, ["integerValue"]);
    if (intVal != JSON_INVALID && intVal != "") {
        return intVal;
    }
    
    // Try booleanValue
    string boolVal = llJsonGetValue(fieldData, ["booleanValue"]);
    if (boolVal != JSON_INVALID && boolVal != "") {
        return boolVal;
    }
    
    // For mapValue (complex objects like stats, health, etc.), return the nested fields
    string mapValue = llJsonGetValue(fieldData, ["mapValue"]);
    if (mapValue != JSON_INVALID && mapValue != "") {
        string mapFields = llJsonGetValue(mapValue, ["fields"]);
        if (mapFields != JSON_INVALID && mapFields != "") {
            return mapFields;
        }
    }
    
    return "";
}

// Limit tracking list size to prevent memory issues
cleanupTrackingLists() {
    // Limit pendingRequests
    if (llGetListLength(pendingRequests) > MAX_PENDING_REQUESTS * 3) {
        // Remove oldest entries (first 3 elements = 1 request)
        pendingRequests = llDeleteSubList(pendingRequests, 0, 2);
    }
    
    // Limit pendingInventoryUpdates
    if (llGetListLength(pendingInventoryUpdates) > MAX_PENDING_INVENTORY * 5) {
        // Remove oldest entries (first 5 elements max per op, though we now use 3-5)
        pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, 0, 4);
    }
}

// =========================== HTTP HELPERS ===================================

// Get inventory field from users collection for current character's universe
getInventoryFromFirestore(integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
        return;
    }
    
    // Step 1: get character ID
    key requestId = getCharacterInfo();
    
    // Track this request
    // Format: [requestId, "GET_INVENTORY_CHARACTER", senderLink]
    pendingInventoryUpdates += [requestId, "GET_INVENTORY_CHARACTER", senderLink];
    cleanupTrackingLists();
}

// Get inventory page from Firestore for a specific character (v2: subcollection)
// characterId: character document ID
// cursor: last itemId from previous page (empty string for first page)
// pageSize: number of items per page
// senderLink: link number to send response to
getInventoryPage(string characterId, string cursor, integer pageSize, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
        return;
    }
    
    if (characterId == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
        return;
    }
    
    // Clamp pageSize to safe maximum (50-100)
    if (pageSize > 100) {
        pageSize = 100;
    } else if (pageSize < 1) {
        pageSize = 20; // Default
    }
    
    // Firestore REST API: Query subcollection using runQuery
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents:runQuery";
    
    // Build query JSON
    // Query: characters/{characterId}/inventory collection
    // Order by __name__ (document ID) ascending
    // Limit to pageSize
    // startAfter cursor if provided
    
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
    
    // Add startAfter if cursor is provided
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
    
    // Track: [requestId, "GET_INVENTORY_PAGE", senderLink, cursor, pageSize]
    pendingInventoryUpdates += [requestId, "GET_INVENTORY_PAGE", senderLink, cursor, pageSize];
    cleanupTrackingLists();
}

// Get a single field from Firestore by UUID
// Used for individual field lookups via link messages
getFieldByUUID(string fieldName, string targetUUID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, 0, fieldName + "_ERROR", "Project ID not configured");
        return;
    }
    
    cleanupTrackingLists();
    
    // Firestore REST API query endpoint with field mask for just this field
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    // Build structured query with field mask for just this field
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
    
    // Store request tracking info: requestId, fieldName, senderLink
    pendingRequests += [requestId, fieldName, senderLink];
}

// Normalize item name to lowercase
string normalizeItemName(string name) {
    return llToLower(llStringTrim(name, STRING_TRIM));
}

// Get character document ID and universe_id from Firestore
// Returns requestId for tracking
// Note: This gets the first character for the user (if multiple exist, gets the first one)
key getCharacterInfo() {
    if (FIREBASE_PROJECT_ID == "") {
        return NULL_KEY;
    }
    
    // Query characters collection for this user's character
    // Get both the document name (character ID) and universe_id
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

// Send an atomic increment for inventory.<itemName> by delta using documents:commit
sendInventoryIncrement(string characterId, string itemName, integer delta) {
    if (FIREBASE_PROJECT_ID == "") {
        return;
    }
    
    if (characterId == "") {
        return;
    }

    string docName = "projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents/characters/" + characterId;

    string fieldPath = "inventory." + itemName;
    string deltaStr = (string)delta;

    string url = "https://firestore.googleapis.com/v1/projects/" 
        + FIREBASE_PROJECT_ID 
        + "/databases/(default)/documents:commit";

    // PURE TRANSFORM WRITE (no update)
    list jsonParts = [
        "{\"writes\":[{",
            "\"transform\":{",
                "\"document\":\"", docName, "\",",
                "\"fieldTransforms\":[{",
                    "\"fieldPath\":\"", fieldPath, "\",",
                    "\"increment\":{\"integerValue\":\"", deltaStr, "\"}",
                "}]",
            "}",
        "}]}"    ];
    
    string commitJson = llDumpList2String(jsonParts, "");

    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        commitJson
    );

    pendingInventoryUpdates += [requestId, "PATCH_INVENTORY", itemName, delta];
    cleanupTrackingLists();
}

// Apply multiple inventory deltas atomically using documents:commit
// characterId: character document ID
// deltasJson: JSON string with format {"itemName": delta, ...}
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
    
    // Build writes array: transforms for existing documents, creates for new documents
    list writes = [];
    integer writeCount = 0;
    
    // Parse deltas using itemNames and deltas arrays
    string itemNamesJson = llJsonGetValue(deltasJson, ["itemNames"]);
    string deltasArrayJson = llJsonGetValue(deltasJson, ["deltas"]);
    
    if (itemNamesJson != JSON_INVALID && itemNamesJson != "" && deltasArrayJson != JSON_INVALID && deltasArrayJson != "") {
        integer i = 0;
        while (TRUE) {
            string itemName = llJsonGetValue(itemNamesJson, [i]);
            if (itemName == JSON_INVALID || itemName == "") jump done_deltas;
            
            // Remove quotes if present
            if (llStringLength(itemName) >= 2 && llGetSubString(itemName, 0, 0) == "\"" && llGetSubString(itemName, -1, -1) == "\"") {
                itemName = llGetSubString(itemName, 1, -2);
            }
            
            string deltaStr = llJsonGetValue(deltasArrayJson, [i]);
            if (deltaStr != JSON_INVALID && deltaStr != "") {
                // Remove quotes if present
                if (llStringLength(deltaStr) >= 2 && llGetSubString(deltaStr, 0, 0) == "\"" && llGetSubString(deltaStr, -1, -1) == "\"") {
                    deltaStr = llGetSubString(deltaStr, 1, -2);
                }
                
                integer deltaValue = (integer)deltaStr;
                
                // Only process if delta is non-zero
                if (deltaValue != 0) {
                    // Document path: characters/{characterId}/inventory/{itemName}
                    string docPath = "projects/" + FIREBASE_PROJECT_ID
                        + "/databases/(default)/documents/characters/" + characterId
                        + "/inventory/" + itemName;
                    
                    if (writeCount > 0) {
                        writes += ",";
                    }
                    
                    // For now, always use transform (increment)
                    // Firestore will create the document if it doesn't exist when using transform
                    // If delta > 0 and document doesn't exist, it will be created with qty = delta
                    // If delta <= 0 and document doesn't exist, it will be created with qty = 0, then decremented
                    // Policy: We'll use transform for all cases, Firestore handles document creation
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
        // Still send success response
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasApplied", "");
        return;
    }
    
    // Build commit JSON with all writes
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
    
    // Track request: [requestId, "APPLY_INVENTORY_DELTAS"]
    pendingInventoryUpdates += [requestId, "APPLY_INVENTORY_DELTAS"];
    cleanupTrackingLists();
}

// Update inventory in Firestore using atomic increment
// itemName: normalized item name (lowercase)
// qty: quantity to add (positive) or remove (negative)
// operation: "GIVE" or "TAKE"
updateInventory(string itemName, integer qty, string operation) {
    if (FIREBASE_PROJECT_ID == "") {
        return;
    }
    
    if (qty == 0) {
        return;
    }
    
    integer delta;
    if (operation == "GIVE") {
        delta = qty;  // positive
    } else if (operation == "TAKE") {
        delta = -qty; // negative
    } else {
        return;
    }
    
    cleanupTrackingLists();
    
    // First, get character document ID
    // Track: [requestId, "GET_CHARACTER_ID", operation, itemName, delta]
    key requestId = getCharacterInfo();
    pendingInventoryUpdates += [requestId, "GET_CHARACTER_ID", operation, itemName, delta];
}

// Fetch full character document for reset/rp_update sync
// NOTE: This path is unchanged; Data Manager will decide how to handle JSON/LSD.
key fetchFullCharacterDocument(string characterId) {
    if (FIREBASE_PROJECT_ID == "") {
        return NULL_KEY;
    }
    
    if (characterId == "") {
        return NULL_KEY;
    }
    
    // Store characterId in LSD for quick access later
    llLinksetDataWrite("characterId", characterId);
    currentCharacterId = characterId;
    
    string url = firestoreRestBase + "/characters/" + llEscapeURL(characterId);
    
    key requestId = llHTTPRequest(
        url,
        [HTTP_METHOD, "GET"],
        ""
    );
    
    // Track this request for full character fetch
    // Format: [requestId, "FETCH_FULL_CHARACTER", characterId]
    pendingRequests += [requestId, "FETCH_FULL_CHARACTER", characterId];
    cleanupTrackingLists();
    
    return requestId;
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        // Build Firestore REST API base URL
        firestoreRestBase = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents";
        
        // Listen for inventory messages from world objects
        llListen(INVENTORY_CHANNEL, "", NULL_KEY, "");
    }
    
    // Handle link messages from other scripts
    link_message(integer sender_num, integer num, string msg, key id) {
        string targetUUID = (string)id;
        
        // Individual field lookups
        if (msg == "getClass" || msg == "getClass_id") {
            getFieldByUUID("class_id", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getStats") {
            getFieldByUUID("stats", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getGender") {
            getFieldByUUID("gender", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getSpecies" || msg == "getSpecies_id") {
            getFieldByUUID("species_id", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getHasMana" || msg == "getHas_mana") {
            getFieldByUUID("has_mana", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getHealth") {
            getFieldByUUID("health", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getStamina") {
            getFieldByUUID("stamina", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getMana") {
            getFieldByUUID("mana", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getXP" || msg == "getXP_total") {
            getFieldByUUID("xp_total", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getSpeciesFactors" || msg == "getSpecies_factors") {
            getFieldByUUID("species_factors", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getCurrency") {
            getFieldByUUID("currency", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getMode") {
            getFieldByUUID("mode", getUUIDToUse(targetUUID), sender_num);
        }
        else if (msg == "getUniverseId" || msg == "getUniverse_id") {
            getFieldByUUID("universe_id", getUUIDToUse(targetUUID), sender_num);
        }
        // Get inventory from users collection (for HUD/rp_inventory display)
        else if (msg == "getInventory") {
            getInventoryFromFirestore(sender_num);
        }
        // Get inventory page (paginated inventory list)
        else if (msg == "getInventoryPage") {
            // Parse JSON: { "characterId": "...", "cursor": "...", "pageSize": int }
            // cursor: last itemId from previous page (empty string or missing for first page)
            string payload = (string)id;
            string characterId = llJsonGetValue(payload, ["characterId"]);
            string cursor = llJsonGetValue(payload, ["cursor"]);
            string pageSizeStr = llJsonGetValue(payload, ["pageSize"]);
            
            // Remove quotes if present
            if (characterId != JSON_INVALID && characterId != "") {
                if (llStringLength(characterId) >= 2 && llGetSubString(characterId, 0, 0) == "\"" && llGetSubString(characterId, -1, -1) == "\"") {
                    characterId = llGetSubString(characterId, 1, -2);
                }
            }
            
            // Cursor defaults to empty string (first page)
            if (cursor != JSON_INVALID && cursor != "") {
                if (llStringLength(cursor) >= 2 && llGetSubString(cursor, 0, 0) == "\"" && llGetSubString(cursor, -1, -1) == "\"") {
                    cursor = llGetSubString(cursor, 1, -2);
                }
            } else {
                cursor = "";
            }
            
            integer pageSize = 20; // Default page size
            if (pageSizeStr != JSON_INVALID && pageSizeStr != "") {
                if (llStringLength(pageSizeStr) >= 2 && llGetSubString(pageSizeStr, 0, 0) == "\"" && llGetSubString(pageSizeStr, -1, -1) == "\"") {
                    pageSizeStr = llGetSubString(pageSizeStr, 1, -2);
                }
                pageSize = (integer)pageSizeStr;
            }
            
            if (characterId != JSON_INVALID && characterId != "") {
                getInventoryPage(characterId, cursor, pageSize, sender_num);
            } else {
                llMessageLinked(sender_num, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
            }
        }
        // Apply inventory deltas from cache
        else if (msg == "applyInventoryDeltas") {
            // Parse JSON: { "characterId": "...", "deltas": { full JSON from InventoryCache } }
            string payload = (string)id;
            string characterId = llJsonGetValue(payload, ["characterId"]);
            string deltasFullJson = llJsonGetValue(payload, ["deltas"]);
            
            // Remove quotes if present
            if (characterId != JSON_INVALID && characterId != "") {
                if (llStringLength(characterId) >= 2 && llGetSubString(characterId, 0, 0) == "\"" && llGetSubString(characterId, -1, -1) == "\"") {
                    characterId = llGetSubString(characterId, 1, -2);
                }
            }
            
            if (characterId != JSON_INVALID && characterId != "" && deltasFullJson != JSON_INVALID && deltasFullJson != "") {
                applyInventoryDeltas(characterId, deltasFullJson);
            }
        }
    }
    
    // Handle inventory messages from world objects (gatherables, crafting stations, etc.)
    listen(integer channel, string name, key id, string message) {
        if (channel != INVENTORY_CHANNEL) return;
        
        // Handle fGiveItem messages
        // Format: fGiveItem,<item name>,<quantity to give>
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
        // Handle fTakeItem messages
        // Format: fTakeItem,<item name>,<quantity to take>
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
    
    // Handle HTTP responses from Firestore REST API
    http_response(key request_id, integer status, list metadata, string body) {
        // Check if this is an inventory-related request
        integer inventoryIndex = llListFindList(pendingInventoryUpdates, [request_id]);
        
        if (inventoryIndex != -1) {
            string operation = llList2String(pendingInventoryUpdates, inventoryIndex + 1);
            
            // Handle GET_INVENTORY (HUD display)
            // Handle GET_INVENTORY - REMOVED: This handler is no longer used
            // Inventory now arrives via the standard field request handler (pendingRequests)
            // The GET_INVENTORY_CHARACTER handler now uses getFieldByUUID which routes through pendingRequests
            // This code block is kept temporarily but should not be reached
            if (operation == "GET_INVENTORY") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
                return;
            }
            
            // Handle GET_INVENTORY_CHARACTER (HUD wants inventory → get characterId → then inventory via atomic field get)
            if (operation == "GET_INVENTORY_CHARACTER") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                
                // Remove tracking entry (3 elements: requestId, "GET_INVENTORY_CHARACTER", senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                
                if (status != 200) {
                    llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
                    return;
                }
                
                // Extract character ID
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
                
                // Store characterId in LSD for Data Manager to use when writing inventory keys
                llLinksetDataWrite("characterId", characterId);
                currentCharacterId = characterId;
                
                // Step 2: Use atomic field get instead of fetching full document
                // Use getFieldByUUID to get just the inventory field
                getFieldByUUID("inventory", ownerUUID, senderLink);
                
                return;
            }
            
            // Handle GET_CHARACTER_ID for inventory update (v2: uses applyInventoryDeltas)
            if (operation == "GET_CHARACTER_ID") {
                string op = llList2String(pendingInventoryUpdates, inventoryIndex + 2); // GIVE/TAKE
                string itemName = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                integer delta  = llList2Integer(pendingInventoryUpdates, inventoryIndex + 4);
                
                // Remove from tracking (5 elements: requestId, "GET_CHARACTER_ID", operation, itemName, delta)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 4);
                
                if (status == 200) {
                    // Extract character document ID from query result
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
                    
                    if (characterId == "") {
                        return;
                    }
                    
                    currentCharacterId = characterId;
                    
                    // Use applyInventoryDeltas with single-item delta (v2: subcollection)
                    string deltasJson = "{\"itemNames\":[\"" + itemName + "\"],\"deltas\":[" + (string)delta + "]}";
                    applyInventoryDeltas(characterId, deltasJson);
                }
                return;
            }
            
            // Handle PATCH_INVENTORY (documents:commit response)
            if (operation == "PATCH_INVENTORY") {
            string itemName = llList2String(pendingInventoryUpdates, inventoryIndex + 2);
                integer delta   = llList2Integer(pendingInventoryUpdates, inventoryIndex + 3);
                
                // Remove from tracking (4 elements: requestId, "PATCH_INVENTORY", itemName, delta)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 3);
                
                return;
            }
            
            // Handle APPLY_INVENTORY_DELTAS (documents:commit response for multiple deltas)
            if (operation == "APPLY_INVENTORY_DELTAS") {
                // Remove from tracking (2 elements: requestId, "APPLY_INVENTORY_DELTAS")
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 1);
                
                if (status == 200) {
                    // Send success response to HUD Controller
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasApplied", "");
                } else {
                    // Send error response to HUD Controller
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "inventoryDeltasError", "Status " + (string)status);
                    // On error, don't clear cache - deltas remain in cache for retry
                }
                return;
            }
            
            // Handle GET_INVENTORY_PAGE (v2: subcollection query results)
            if (operation == "GET_INVENTORY_PAGE") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                string cursor = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                integer pageSize = llList2Integer(pendingInventoryUpdates, inventoryIndex + 4);
                
                // Remove from tracking (5 elements: requestId, "GET_INVENTORY_PAGE", senderLink, cursor, pageSize)
            pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 4);
                
                if (status != 200) {
                    // On error, send empty JSON response
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", "{\"items\":[],\"cursor\":\"\",\"hasMore\":false}");
                    return;
                }
                
                // Parse runQuery response: array of documents
                // Format: [{"document": {"name": ".../inventory/{itemId}", "fields": {"qty": {"integerValue": "..."}}}}, ...]
                
                list items = [];
                string lastItemId = "";
                integer hasMore = FALSE;
                
                // Parse array of results
                integer i = 0;
                integer documentCount = 0;
                while (TRUE) {
                    string resultEntry = llJsonGetValue(body, [i]);
                    if (resultEntry == JSON_INVALID || resultEntry == "") jump done_parse_results;
                    
                    // Extract document from result entry
                    string document = llJsonGetValue(resultEntry, ["document"]);
                    if (document == JSON_INVALID || document == "") {
                        i++;
                        jump continue_parse_results;
                    }
                    
                    documentCount++;
                    
                    // Extract document name (full path)
                    string docName = llJsonGetValue(document, ["name"]);
                    if (docName == JSON_INVALID || docName == "") {
                        i++;
                        jump continue_parse_results;
                    }
                    
                    // Remove quotes if present
                    if (llStringLength(docName) >= 2 && llGetSubString(docName, 0, 0) == "\"" && llGetSubString(docName, -1, -1) == "\"") {
                        docName = llGetSubString(docName, 1, -2);
                    }
                    
                    // Extract itemId from document name: ".../characters/{characterId}/inventory/{itemId}"
                    list pathParts = llParseString2List(docName, ["/"], []);
                    integer pathLen = llGetListLength(pathParts);
                    if (pathLen >= 2) {
                        string itemId = llList2String(pathParts, pathLen - 1);
                        lastItemId = itemId;
                        
                        // Extract qty from fields
                        string fields = llJsonGetValue(document, ["fields"]);
                        if (fields != JSON_INVALID && fields != "") {
                            string qtyField = llJsonGetValue(fields, ["qty"]);
                            
                            if (qtyField != JSON_INVALID && qtyField != "") {
                                // Extract integerValue, doubleValue, or stringValue
                                string qtyStr = llJsonGetValue(qtyField, ["integerValue"]);
                                if (qtyStr == JSON_INVALID || qtyStr == "") {
                                    qtyStr = llJsonGetValue(qtyField, ["doubleValue"]);
                                }
                                if (qtyStr == JSON_INVALID || qtyStr == "") {
                                    qtyStr = llJsonGetValue(qtyField, ["stringValue"]);
                                }
                                
                                // Remove quotes if present
                                if (qtyStr != JSON_INVALID && qtyStr != "" && llStringLength(qtyStr) >= 2 && llGetSubString(qtyStr, 0, 0) == "\"" && llGetSubString(qtyStr, -1, -1) == "\"") {
                                    qtyStr = llGetSubString(qtyStr, 1, -2);
                                }
                                
                                integer qty = (integer)qtyStr;
                                
                                if (qty > 0) {
                                    // Build item object: {"name": itemId, "qty": qty}
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
                
                // Determine hasMore: if we got exactly pageSize items, there might be more
                integer itemCount = llGetListLength(items);
                if (itemCount == pageSize) {
                    hasMore = TRUE;
                }
                
                // Build JSON response: {"items": [...], "cursor": "...", "hasMore": true/false}
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
                
                // Send JSON response to HUD
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "inventoryPage", responseJson);
                
                return;
            }
        }
        
        // Check if this is a FETCH_FULL_CHARACTER request (unchanged)
        integer fetchIndex = llListFindList(pendingRequests, [request_id]);
        if (fetchIndex != -1) {
            string operation = llList2String(pendingRequests, fetchIndex + 1);
            
            if (operation == "FETCH_FULL_CHARACTER") {
                string characterId = llList2String(pendingRequests, fetchIndex + 2);
                // Remove from tracking (3 elements: requestId, "FETCH_FULL_CHARACTER", characterId)
                pendingRequests = llDeleteSubList(pendingRequests, fetchIndex, fetchIndex + 2);
            
            if (status == 200) {
                    // Forward raw JSON body to Data Manager
                    llMessageLinked(LINK_SET, 0, "write_character_to_lsd", body);
            }
            return;
            }
        }
        
        // Check if this is a tracked field request (stats, gender, species, etc.)
        integer requestIndex = llListFindList(pendingRequests, [request_id]);
        
        if (requestIndex != -1) {
            // This is a field request - extract tracking info
            string fieldName = llList2String(pendingRequests, requestIndex + 1);
            integer senderLink = llList2Integer(pendingRequests, requestIndex + 2);
            
            // Remove from tracking list
            pendingRequests = llDeleteSubList(pendingRequests, requestIndex, requestIndex + 2);
            
            if (status == 200) {
                // Parse EXACTLY like the standalone script: [0].document.fields.fieldName
                string firstResult = llJsonGetValue(body, [0]);
                if (firstResult == JSON_INVALID || firstResult == "") {
                    if (fieldName == "has_mana") {
                        llMessageLinked(senderLink, 0, fieldName, "false");
                    } else if (fieldName == "species_factors") {
                        llMessageLinked(senderLink, 0, fieldName, "{}");
                    } else if (fieldName == "inventory") {
                        llMessageLinked(LINK_SET, 0, fieldName, "{}");
                        llMessageLinked(senderLink, 0, fieldName, "{\"mapValue\":{\"fields\":{}}}");
                    } else {
                        llMessageLinked(LINK_SET, 0, fieldName + "_ERROR", "NOT_FOUND");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "NOT_FOUND");
                    }
                    return;
                }
                
                string document = llJsonGetValue(firstResult, ["document"]);
                if (document == JSON_INVALID || document == "") {
                    if (fieldName == "has_mana") {
                        llMessageLinked(senderLink, 0, fieldName, "false");
                    } else if (fieldName == "species_factors") {
                        llMessageLinked(senderLink, 0, fieldName, "{}");
                    } else if (fieldName == "inventory") {
                        llMessageLinked(LINK_SET, 0, fieldName, "{}");
                        llMessageLinked(senderLink, 0, fieldName, "{\"mapValue\":{\"fields\":{}}}");
                    } else {
                        llMessageLinked(LINK_SET, 0, fieldName + "_ERROR", "NO_DOCUMENT");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "NO_DOCUMENT");
                    }
                    return;
                }
                
                string fields = llJsonGetValue(document, ["fields"]);
                if (fields == JSON_INVALID || fields == "") {
                    if (fieldName == "has_mana") {
                        llMessageLinked(senderLink, 0, fieldName, "false");
                    } else if (fieldName == "species_factors") {
                        llMessageLinked(senderLink, 0, fieldName, "{}");
                    } else if (fieldName == "inventory") {
                        llMessageLinked(LINK_SET, 0, fieldName, "{}");
                        llMessageLinked(senderLink, 0, fieldName, "{\"mapValue\":{\"fields\":{}}}");
                    } else {
                        llMessageLinked(LINK_SET, 0, fieldName + "_ERROR", "NO_FIELDS");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "NO_FIELDS");
                    }
                    return;
                }
                
                // Extract the requested field
                string fieldData = llJsonGetValue(fields, [fieldName]);
                
                if (fieldData == JSON_INVALID || fieldData == "") {
                    if (fieldName == "has_mana") {
                        llMessageLinked(senderLink, 0, fieldName, "false");
                    } else if (fieldName == "species_factors") {
                        llMessageLinked(senderLink, 0, fieldName, "{}");
                    } else if (fieldName == "inventory") {
                        llMessageLinked(LINK_SET, 0, fieldName, "{}");
                        llMessageLinked(senderLink, 0, fieldName, "{\"mapValue\":{\"fields\":{}}}");
                    } else {
                        llMessageLinked(LINK_SET, 0, fieldName + "_ERROR", "FIELD_NOT_FOUND");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "FIELD_NOT_FOUND");
                    }
                    return;
                }
                
                // Extract value using extractFirestoreValue
                string value = extractFirestoreValue(fieldData);
                
                if (value != "" && value != JSON_INVALID) {
                    // Send all fields to Data Manager (LINK_SET) so they can be written to LSD
                    // Also send to original sender (HUD) for display/processing
                    llMessageLinked(LINK_SET, 0, fieldName, value);
                    llMessageLinked(senderLink, 0, fieldName, value);
                } else {
                    if (fieldName == "has_mana") {
                        llMessageLinked(senderLink, 0, fieldName, "false");
                    } else if (fieldName == "species_factors") {
                        llMessageLinked(senderLink, 0, fieldName, "{}");
                    } else if (fieldName == "inventory") {
                        // Empty inventory - send to both Data Manager and HUD
                        llMessageLinked(LINK_SET, 0, fieldName, "{}");
                        llMessageLinked(senderLink, 0, fieldName, "{\"mapValue\":{\"fields\":{}}}");
                    } else {
                        // Send error to both Data Manager and HUD
                        llMessageLinked(LINK_SET, 0, fieldName + "_ERROR", "EXTRACTION_FAILED");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "EXTRACTION_FAILED");
                    }
                }
            } else {
                if (fieldName == "has_mana") {
                    llMessageLinked(senderLink, 0, fieldName, "false");
                } else if (fieldName == "species_factors") {
                    llMessageLinked(senderLink, 0, fieldName, "{}");
                } else if (fieldName == "inventory") {
                    llMessageLinked(LINK_SET, 0, fieldName, "{}");
                    llMessageLinked(senderLink, 0, fieldName, "{\"mapValue\":{\"fields\":{}}}");
                } else {
                    llMessageLinked(LINK_SET, 0, fieldName + "_ERROR", "HTTP_" + (string)status);
                llMessageLinked(senderLink, 0, fieldName + "_ERROR", "HTTP_" + (string)status);
            }
            }
                    return;
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // Note: Character data loading is now handled by Data Manager via individual field requests
            // No need to auto-load here - Data Manager will request fields as needed
        }
    }
}