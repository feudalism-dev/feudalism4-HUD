// Feudalism 4 - Players HUD Firestore Bridge
// ============================================================================
// Direct Firestore REST API access - no middleware, no redirects, no OAuth
// Uses field masks to retrieve only needed fields, avoiding truncation
// ============================================================================

// Firebase Project Configuration
string FIREBASE_PROJECT_ID = "feudalism4-rpg";

// Communication - using link_message for Data Manager (same linkset)
// No channel needed

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
key httpRequestId;  // For deprecated full character load only
string firestoreRestBase;

// Request tracking for concurrent field requests
// Format: [requestId1, fieldName1, senderLink1, requestId2, fieldName2, senderLink2, ...]
list pendingRequests;  // Stores: requestId, fieldName, senderLink for each pending request

// =========================== UTILITY FUNCTIONS ==============================

// Helper to determine which UUID to use (provided target or owner's UUID)
string getUUIDToUse(string targetUUID) {
    if (targetUUID != "") {
        return targetUUID;
    } else {
        return ownerUUID;
    }
}

// Extract value from Firestore field format
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

// =========================== HTTP HANDLERS ==================================

// Get a single field from Firestore by UUID
// Used for individual field lookups via link messages
getFieldByUUID(string fieldName, string targetUUID, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llOwnerSay("[Firestore Bridge] ERROR: FIREBASE_PROJECT_ID not configured");
        llMessageLinked(senderLink, 0, fieldName + "_ERROR", "Project ID not configured");
        return;
    }
    
    // Firestore REST API query endpoint with field mask for just this field
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    // Build structured query with field mask for just this field
    string queryJson = "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"" + targetUUID + "\"}}},\"select\":{\"fields\":[{\"fieldPath\":\"" + fieldName + "\"}]},\"limit\":1}}";
    
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
    
    llOwnerSay("[Firestore Bridge] Querying " + fieldName + " for UUID: " + targetUUID + " (request ID: " + (string)requestId + ")");
}

// Load character data directly from Firestore (full character load)
// NOTE: Response may be truncated if requesting too many fields at once
// If truncation occurs, individual field requests should be used instead
// Uses field mask to retrieve only needed fields, but 10 fields may still be too large
loadCharacterData() {
    if (FIREBASE_PROJECT_ID == "") {
        llOwnerSay("[Firestore Bridge] ERROR: FIREBASE_PROJECT_ID not configured");
        return;
    }
    
    // Firestore REST API query: POST to runQuery endpoint
    // Query for character where owner_uuid == ownerUUID
    // Use field mask to get only the fields we need
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    // Build structured query with field mask for CRITICAL fields only (6 fields)
    // Requesting all 10 fields causes truncation at 2048 chars
    // So we only request: class_id, stats, health, stamina, mana, xp_total
    // Other fields (gender, species_id, has_mana, species_factors) are requested individually
    string queryJson = "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"" + ownerUUID + "\"}}},\"select\":{\"fields\":[{\"fieldPath\":\"class_id\"},{\"fieldPath\":\"stats\"},{\"fieldPath\":\"health\"},{\"fieldPath\":\"stamina\"},{\"fieldPath\":\"mana\"},{\"fieldPath\":\"xp_total\"}]},\"limit\":1}}";
    
    httpRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        queryJson
    );
    
    llOwnerSay("[Firestore Bridge] Querying character data from Firestore for UUID: " + ownerUUID);
}

// Save character data directly to Firestore
saveCharacterData(string characterData) {
    if (FIREBASE_PROJECT_ID == "") {
        llOwnerSay("[Firestore Bridge] ERROR: FIREBASE_PROJECT_ID not configured");
        return;
    }
    
    // Direct Firestore REST API call: PATCH /documents/characters/{uuid}
    string url = firestoreRestBase + "/characters/" + llEscapeURL(ownerUUID);
    
    // Parse characterData (pipe-delimited format) and convert to Firestore document format
    // Format: stats:...|health:...|stamina:...|mana:...|xp:...|class:...
    // Firestore REST API format: {"fields":{"fieldName":{"stringValue":"value"}}}
    string firestoreJson = "{\"fields\":{";
    
    list parts = llParseString2List(characterData, ["|"], []);
    integer i;
    integer firstField = TRUE;
    for (i = 0; i < llGetListLength(parts); i++) {
        string part = llList2String(parts, i);
        list keyValue = llParseString2List(part, [":"], []);
        if (llGetListLength(keyValue) >= 2) {
            string fieldName = llList2String(keyValue, 0);
            string fieldValue = llList2String(keyValue, 1);
            
            if (!firstField) firestoreJson += ",";
            firstField = FALSE;
            
            // Add field to Firestore document format
            firestoreJson += "\"" + fieldName + "\":{\"stringValue\":\"" + llEscapeURL(fieldValue) + "\"}";
        }
    }
    firestoreJson += "}}";
    
    httpRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "PATCH",
            HTTP_MIMETYPE, "application/json"
        ],
        firestoreJson
    );
    
    llOwnerSay("[Firestore Bridge] Saving character data to Firestore: " + ownerUUID);
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
        
        llOwnerSay("[Firestore Bridge] Initialized for " + ownerDisplayName);
        if (FIREBASE_PROJECT_ID == "") {
            llOwnerSay("[Firestore Bridge] NOTE: FIREBASE_PROJECT_ID not configured");
        }
    }
    
    // Handle link messages from other scripts
    link_message(integer sender_num, integer num, string msg, key id) {
        string targetUUID = (string)id;
        
        // NOTE: firestore_load is deprecated - use individual field requests instead (getClass, getStats, etc.)
        // Keeping for backward compatibility, but individual field requests are preferred
        if (msg == "firestore_load") {
            llOwnerSay("[Firestore Bridge] WARNING: firestore_load is deprecated, use individual field requests instead");
            loadCharacterData();
        }
        // Save character data
        else if (msg == "firestore_save") {
            string data = targetUUID;
            saveCharacterData(data);
        }
        // Individual field lookups
        else if (msg == "getClass" || msg == "getClass_id") {
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
    }
    
    // Handle HTTP responses from Firestore REST API
    http_response(key request_id, integer status, list metadata, string body) {
        // Check if this is a tracked field request
        integer requestIndex = llListFindList(pendingRequests, [request_id]);
        
        if (requestIndex != -1) {
            // This is a field request - extract tracking info
            string fieldName = llList2String(pendingRequests, requestIndex + 1);
            integer senderLink = llList2Integer(pendingRequests, requestIndex + 2);
            
            // Remove from tracking list
            pendingRequests = llDeleteSubList(pendingRequests, requestIndex, requestIndex + 2);
            
            if (status == 200) {
                llOwnerSay("[Firestore Bridge] Response received for " + fieldName + " (length: " + (string)llStringLength(body) + ")");
                
                // Parse EXACTLY like the standalone script: [0].document.fields.fieldName
                string firstResult = llJsonGetValue(body, [0]);
                if (firstResult == JSON_INVALID) {
                    llOwnerSay("[Firestore Bridge] ERROR: Response is not a valid JSON array or is empty for field '" + fieldName + "'");
                    llOwnerSay("[Firestore Bridge] Response preview: " + llGetSubString(body, 0, 500));
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "NOT_FOUND");
                    return;
                }
                
                string document = llJsonGetValue(firstResult, ["document"]);
                if (document == JSON_INVALID) {
                    llOwnerSay("[Firestore Bridge] ERROR: No document found in query result for field '" + fieldName + "'");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "NO_DOCUMENT");
                    return;
                }
                
                string fields = llJsonGetValue(document, ["fields"]);
                if (fields == JSON_INVALID) {
                    llOwnerSay("[Firestore Bridge] ERROR: No fields found in document for field '" + fieldName + "'");
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "NO_FIELDS");
                    return;
                }
                
                // Extract the requested field (exactly like standalone)
                string fieldData = llJsonGetValue(fields, [fieldName]);
                
                if (fieldData == JSON_INVALID || fieldData == "") {
                    llOwnerSay("[Firestore Bridge] ERROR: Field '" + fieldName + "' not found in response");
                    llOwnerSay("[Firestore Bridge] Fields preview: " + llGetSubString(fields, 0, 500));
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "FIELD_NOT_FOUND");
                    return;
                }
                
                // Extract value using extractFirestoreValue (same as standalone)
                string value = extractFirestoreValue(fieldData);
                
                if (value != "" && value != JSON_INVALID) {
                    // Send field value back to requesting script
                    llMessageLinked(senderLink, 0, fieldName, value);
                    llOwnerSay("[Firestore Bridge] ✓ SUCCESS! " + fieldName + " = " + llGetSubString(value, 0, 100));
                } else {
                    llOwnerSay("[Firestore Bridge] ERROR: Could not extract value from field data for '" + fieldName + "'");
                    llOwnerSay("[Firestore Bridge] Field data structure: " + llGetSubString(fieldData, 0, 200));
                    llMessageLinked(senderLink, 0, fieldName + "_ERROR", "EXTRACTION_FAILED");
                }
            } else {
                llOwnerSay("[Firestore Bridge] HTTP ERROR for field '" + fieldName + "': Status " + (string)status);
                llOwnerSay("[Firestore Bridge] Response: " + llGetSubString(body, 0, 500));
                llMessageLinked(senderLink, 0, fieldName + "_ERROR", "HTTP_" + (string)status);
            }
            return;
        }
        
        // Check if this is the full character load
        if (request_id == httpRequestId) {
            if (status == 200) {
                llOwnerSay("[Firestore Bridge] Full character load response received (length: " + (string)llStringLength(body) + ")");
                
                // Check if response was truncated (LSL HTTP limit is 2048 chars)
                if (llStringLength(body) >= 2048) {
                    llOwnerSay("[Firestore Bridge] WARNING: Response is truncated at 2048 characters!");
                    llOwnerSay("[Firestore Bridge] Response ends with: " + llGetSubString(body, -200, -1));
                    llOwnerSay("[Firestore Bridge] Full response is too large - consider requesting fewer fields or using individual field requests");
                    // Try to parse what we have anyway - it might still be valid JSON up to the truncation point
                }
                
                // Try to parse the response - even if truncated, we might be able to get some fields
                // Navigate JSON: [0].document.fields
                string firstResult = llJsonGetValue(body, [0]);
                if (firstResult == JSON_INVALID) {
                    llOwnerSay("[Firestore Bridge] ERROR: Could not parse response JSON for UUID: " + ownerUUID);
                    llOwnerSay("[Firestore Bridge] Response starts with: " + llGetSubString(body, 0, 300));
                    llOwnerSay("[Firestore Bridge] Response ends with: " + llGetSubString(body, -300, -1));
                    // If response is truncated, fall back to individual field requests
                    llOwnerSay("[Firestore Bridge] Falling back to individual field requests due to truncation");
                    // Don't return - let the code continue to try individual requests
                    // Actually, we can't do that here - we need to return and let Data Manager request fields individually
                    return;
                }
                
                string document = llJsonGetValue(firstResult, ["document"]);
                if (document == JSON_INVALID) {
                    llOwnerSay("[Firestore Bridge] ERROR: No document in query result");
                    return;
                }
                
                string fields = llJsonGetValue(document, ["fields"]);
                if (fields == JSON_INVALID) {
                    llOwnerSay("[Firestore Bridge] ERROR: No fields in document");
                    return;
                }
                
                // Full character load - extract all fields and send to Data Manager
                string characterJson = "{";
                integer firstField = TRUE;
                
                // List of fields to extract (only critical fields requested to avoid truncation)
                list fieldNames = ["class_id", "stats", "health", "stamina", "mana", "xp_total"];
                integer i;
                for (i = 0; i < llGetListLength(fieldNames); i++) {
                    string fieldName = llList2String(fieldNames, i);
                    string fieldData = llJsonGetValue(fields, [fieldName]);
                    
                    if (fieldData != JSON_INVALID && fieldData != "") {
                        // Extract value using helper function
                        string value = extractFirestoreValue(fieldData);
                        
                        if (value != "") {
                            if (!firstField) characterJson += ",";
                            firstField = FALSE;
                            
                            // For complex objects (stats, health, etc.), don't add quotes
                            if (llSubStringIndex(fieldData, "\"mapValue\"") != -1) {
                                characterJson += "\"" + fieldName + "\":" + value;
                            } else {
                                characterJson += "\"" + fieldName + "\":\"" + value + "\"";
                            }
                        }
                    }
                }
                characterJson += "}";
                
                // Send to Data Manager (deprecated format - kept for backward compatibility)
                // New code should use individual field requests instead
                if (characterJson != "{}") {
                    llMessageLinked(LINK_SET, 0, "CHARACTER_DATA", characterJson);
                    llOwnerSay("[Firestore Bridge] Character data sent to Data Manager (deprecated full load format)");
                } else {
                    llOwnerSay("[Firestore Bridge] WARNING: No fields extracted from response");
                }
            }
        } else {
            llOwnerSay("[Firestore Bridge] HTTP ERROR: Status " + (string)status);
            llOwnerSay("[Firestore Bridge] Response: " + llGetSubString(body, 0, 1000));
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // Note: Character data loading is now handled by Data Manager via individual field requests
            // No need to auto-load here - Data Manager will request fields as needed
        }
    }
}
