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

// Request to consume an item
// Writes to users/<uid>/consume_requests/<auto-id>
// Steps:
//   1. Read the local HUD inventory cache (via InventoryCache)
//   2. Confirm the item exists and quantity > 0
//   3. Send a Firestore write to users/<uid>/consume_requests/<auto-id>
requestConsumeItem(string itemId, string userUuid, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Project ID not configured");
        return;
    }
    
    if (itemId == "" || userUuid == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Invalid parameters");
        return;
    }
    
    // Step 1 & 2: Check inventory cache via InventoryCache
    // Request inventory cache to check if item exists and qty > 0
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_GET_ITEM", itemId);
    
    // We'll handle the cache response in link_message and then write to Firestore
    // For now, track this request: [itemId, userUuid, senderLink]
    // Actually, we need to wait for cache response, so we'll handle it differently
    // Let's write directly to Firestore (the Cloud Function will validate)
    
    // Step 3: Write to Firestore
    // Path: users/<uid>/consume_requests (POST to create with auto-id)
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID
        + "/databases/(default)/documents/users/" + userUuid + "/consume_requests";
    
    // Build document JSON: { "fields": { "item_id": { "stringValue": "..." }, "timestamp": { "timestampValue": "..." } } }
    // Note: timestamp will be set by serverTimestamp() in Cloud Function, but we need to include it for the write
    // Actually, we can't set serverTimestamp in REST API directly, so we'll let the Cloud Function handle it
    // For now, just write item_id and let Cloud Function add timestamp
    
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
    
    // Track request: [requestId, "REQUEST_CONSUME_ITEM", itemId, userUuid, senderLink]
    pendingInventoryUpdates += [requestId, "REQUEST_CONSUME_ITEM", itemId, userUuid, senderLink];
    cleanupTrackingLists();
}

// Set active character for a user
// Validates ownership before setting
setActiveCharacter(string userID, string characterID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Project ID not configured");
        return;
    }
    
    if (userID == "" || characterID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Invalid parameters");
        return;
    }
    
    // First, validate ownership by checking if character exists and belongs to user
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
    
    // Track validation request: [requestId, "VALIDATE_OWNERSHIP", userID, characterID, senderLink]
    pendingInventoryUpdates += [validateRequestId, "VALIDATE_OWNERSHIP", userID, characterID, senderLink];
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
    
    // Get activeCharacter field from users/<userID> document
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users/" + userID;
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track request: [requestId, "GET_ACTIVE_CHARACTER", senderLink]
    pendingInventoryUpdates += [requestId, "GET_ACTIVE_CHARACTER", senderLink];
    cleanupTrackingLists();
}

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
    
    // Get universe document and check bannedCharacters array
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/universes/" + universeID;
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track request: [requestId, "IS_BANNED", senderLink, characterID]
    pendingInventoryUpdates += [requestId, "IS_BANNED", senderLink, characterID];
    cleanupTrackingLists();
}

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
    
    // Get character document to read classId and lastPaidTimestamp
    string charUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/characters/" + characterID;
    
    key requestId = llHTTPRequest(
        charUrl,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    // Track request: [requestId, "GET_STIPEND_DATA", senderLink]
    pendingInventoryUpdates += [requestId, "GET_STIPEND_DATA", senderLink];
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
    
    // PATCH character document with lastPaidTimestamp
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
    
    // Track request: [requestId, "UPDATE_LAST_PAID", senderLink]
    pendingInventoryUpdates += [requestId, "UPDATE_LAST_PAID", senderLink];
    cleanupTrackingLists();
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
        // Request to consume an item
        else if (msg == "requestConsumeItem") {
            // Parse JSON: { "itemId": "...", "userUuid": "..." }
            // Or simple format: itemId as msg, userUuid from ownerUUID
            string payload = (string)id;
            string itemId = llJsonGetValue(payload, ["itemId"]);
            
            // Remove quotes if present
            if (itemId != JSON_INVALID && itemId != "") {
                if (llStringLength(itemId) >= 2 && llGetSubString(itemId, 0, 0) == "\"" && llGetSubString(itemId, -1, -1) == "\"") {
                    itemId = llGetSubString(itemId, 1, -2);
                }
            } else {
                // Try as simple string
                itemId = payload;
            }
            
            if (itemId != JSON_INVALID && itemId != "" && itemId != "JSON_INVALID") {
                requestConsumeItem(itemId, ownerUUID, sender_num);
            } else {
                llMessageLinked(sender_num, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Invalid item ID");
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
        // Handle SET_ACTIVE_CHARACTER
        // Format: "SET_ACTIVE_CHARACTER|userID|characterID"
        else if (llSubStringIndex(msg, "SET_ACTIVE_CHARACTER|") == 0) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) == 3) {
                string userID = llList2String(parts, 1);
                string characterID = llList2String(parts, 2);
                setActiveCharacter(userID, characterID, sender_num);
            }
        }
        // Handle GET_ACTIVE_CHARACTER
        // Format: "GET_ACTIVE_CHARACTER|<transactionId>|<userId>" or "GET_ACTIVE_CHARACTER|<userId>" (backward compatible)
        else if (llSubStringIndex(msg, "GET_ACTIVE_CHARACTER|") == 0) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string userID;
                // Support both formats: with transactionId or without
                if (llGetListLength(parts) == 3) {
                    // Format: GET_ACTIVE_CHARACTER|<transactionId>|<userId>
                    userID = llList2String(parts, 2);
                } else {
                    // Format: GET_ACTIVE_CHARACTER|<userId> (backward compatible)
                    userID = llList2String(parts, 1);
                }
                getActiveCharacter(userID, sender_num);
            }
        }
        // Handle IS_BANNED
        // Format: "IS_BANNED|<transactionId>|<characterId>|<universeId>"
        else if (llSubStringIndex(msg, "IS_BANNED|") == 0) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) == 4) {
                string characterID = llList2String(parts, 2);
                string universeID = llList2String(parts, 3);
                checkBanned(characterID, universeID, sender_num);
            }
        }
        // Handle GET_STIPEND_DATA
        // Format: "GET_STIPEND_DATA|<transactionId>|<characterId>"
        else if (llSubStringIndex(msg, "GET_STIPEND_DATA|") == 0) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string characterID;
                // Support both formats: with transactionId or without
                if (llGetListLength(parts) == 3) {
                    // Format: GET_STIPEND_DATA|<transactionId>|<characterId>
                    characterID = llList2String(parts, 2);
                } else {
                    // Format: GET_STIPEND_DATA|<characterId> (backward compatible)
                    characterID = llList2String(parts, 1);
                }
                getStipendData(characterID, sender_num);
            }
        }
        // Handle UPDATE_LAST_PAID
        // Format: "UPDATE_LAST_PAID|<transactionId>|<characterId>|<timestamp>"
        else if (llSubStringIndex(msg, "UPDATE_LAST_PAID|") == 0) {
            list parts = llParseString2List(msg, ["|"], []);
            if (llGetListLength(parts) >= 3) {
                string characterID;
                string timestampStr;
                // Support both formats: with transactionId or without
                if (llGetListLength(parts) == 4) {
                    // Format: UPDATE_LAST_PAID|<transactionId>|<characterId>|<timestamp>
                    characterID = llList2String(parts, 2);
                    timestampStr = llList2String(parts, 3);
                } else {
                    // Format: UPDATE_LAST_PAID|<characterId>|<timestamp> (backward compatible)
                    characterID = llList2String(parts, 1);
                    timestampStr = llList2String(parts, 2);
                }
                integer timestamp = (integer)timestampStr;
                updateLastPaid(characterID, timestamp, sender_num);
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
            // Handle REQUEST_CONSUME_ITEM (POST to consume_requests)
            if (operation == "REQUEST_CONSUME_ITEM") {
                string itemId = llList2String(pendingInventoryUpdates, inventoryIndex + 2);
                string userUuid = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 4);
                
                // Remove from tracking (5 elements: requestId, "REQUEST_CONSUME_ITEM", itemId, userUuid, senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 4);
                
                if (status == 200 || status == 201) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_SENT", itemId);
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CONSUME_REQUEST_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle VALIDATE_OWNERSHIP (for SET_ACTIVE_CHARACTER)
            if (operation == "VALIDATE_OWNERSHIP") {
                string userID = llList2String(pendingInventoryUpdates, inventoryIndex + 2);
                string characterID = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 4);
                
                // Remove from tracking (5 elements: requestId, "VALIDATE_OWNERSHIP", userID, characterID, senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 4);
                
                if (status == 200) {
                    // Check if character was found (ownership validated)
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
                        
                        // Track patch request: [requestId, "SET_ACTIVE_CHARACTER", senderLink, characterID]
                        pendingInventoryUpdates += [patchRequestId, "SET_ACTIVE_CHARACTER", senderLink, characterID];
                    } else {
                        // Ownership validation failed
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Ownership validation failed");
                    }
                } else {
                    // Validation request failed
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Validation failed: Status " + (string)status);
                }
                return;
            }
            
            // Handle SET_ACTIVE_CHARACTER (PATCH response)
            if (operation == "SET_ACTIVE_CHARACTER") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                string characterID = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                
                // Remove from tracking (4 elements: requestId, "SET_ACTIVE_CHARACTER", senderLink, characterID)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 3);
                
                if (status == 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET", characterID);
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_SET_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle GET_ACTIVE_CHARACTER
            if (operation == "GET_ACTIVE_CHARACTER") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                
                // Remove from tracking (3 elements: requestId, "GET_ACTIVE_CHARACTER", senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                
                if (status == 200) {
                    // Extract activeCharacter field
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
                    // User document doesn't exist yet - return null
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER", "null");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "ACTIVE_CHARACTER_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle IS_BANNED
            if (operation == "IS_BANNED") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                string characterID = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                
                // Remove from tracking (4 elements: requestId, "IS_BANNED", senderLink, characterID)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 3);
                
                if (status == 200) {
                    // Extract bannedCharacters array from universe document
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        string bannedCharsField = llJsonGetValue(fields, ["bannedCharacters"]);
                        if (bannedCharsField != JSON_INVALID && bannedCharsField != "") {
                            // Check if bannedCharacters is an arrayValue
                            string arrayValue = llJsonGetValue(bannedCharsField, ["arrayValue"]);
                            if (arrayValue != JSON_INVALID && arrayValue != "") {
                                string values = llJsonGetValue(arrayValue, ["values"]);
                                if (values != JSON_INVALID && values != "") {
                                    // Parse array and check if characterID is in it
                                    // Firestore arrays are JSON arrays, so we need to iterate through indices
                                    integer isBanned = 0;
                                    integer i = 0;
                                    // Try to get first element to see if array exists
                                    string firstItem = llJsonGetValue(values, [0]);
                                    if (firstItem != JSON_INVALID && firstItem != "") {
                                        // Array has at least one element, iterate through
                                        while (i < 100) { // Safety limit
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
                    // Universe doesn't exist - not banned
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED", "false");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "BANNED_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle GET_STIPEND_DATA
            if (operation == "GET_STIPEND_DATA") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                
                // Remove from tracking (3 elements: requestId, "GET_STIPEND_DATA", senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                
                if (status == 200) {
                    // Extract classId and lastPaidTimestamp from character document
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        // Try both class_id and classId (check which one exists)
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
                        
                        // Now get class document to read stipend
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
                            
                            // Track: [requestId, "GET_STIPEND_CLASS", senderLink, lastPaidTimestamp]
                            pendingInventoryUpdates += [classRequestId, "GET_STIPEND_CLASS", senderLink, (string)lastPaidTimestamp];
                        } else {
                            // No class - return 0 stipend
                            llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "0|" + (string)lastPaidTimestamp);
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
            
            // Handle GET_STIPEND_CLASS (second step of GET_STIPEND_DATA)
            if (operation == "GET_STIPEND_CLASS") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                string lastPaidTimestampStr = llList2String(pendingInventoryUpdates, inventoryIndex + 3);
                
                // Remove from tracking (4 elements: requestId, "GET_STIPEND_CLASS", senderLink, lastPaidTimestampStr)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 3);
                
                if (status == 200) {
                    // Extract stipend from class document
                    string fields = llJsonGetValue(body, ["fields"]);
                    if (fields != JSON_INVALID && fields != "") {
                        string stipendField = llJsonGetValue(fields, ["stipend"]);
                        float stipend = 0.0;
                        if (stipendField != JSON_INVALID && stipendField != "") {
                            string stipendStr = extractFirestoreValue(stipendField);
                            stipend = (float)stipendStr;
                        }
                        // Return: STIPEND_DATA|<stipend>|<lastPaidTimestamp>
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", (string)stipend + "|" + lastPaidTimestampStr);
                    } else {
                        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "0|" + lastPaidTimestampStr);
                    }
                } else if (status == 404) {
                    // Class not found - return 0 stipend
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA", "0|" + lastPaidTimestampStr);
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "STIPEND_DATA_ERROR", "Status " + (string)status);
                }
                return;
            }
            
            // Handle UPDATE_LAST_PAID
            if (operation == "UPDATE_LAST_PAID") {
                integer senderLink = llList2Integer(pendingInventoryUpdates, inventoryIndex + 2);
                
                // Remove from tracking (3 elements: requestId, "UPDATE_LAST_PAID", senderLink)
                pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, inventoryIndex, inventoryIndex + 2);
                
                if (status == 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "LAST_PAID_UPDATED", "OK");
                } else {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "LAST_PAID_UPDATED_ERROR", "Status " + (string)status);
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