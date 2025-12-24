// ============================================================================
// Standalone Firestore Field Lookup Script
// ============================================================================
// Helper functions to retrieve individual character fields from Firestore
// by UUID. Each function uses field masks to retrieve only the needed field,
// reducing response size and avoiding truncation.
// ============================================================================

// Firebase Project Configuration
string FIREBASE_PROJECT_ID = "feudalism4-rpg";

// State
key ownerKey;
string ownerUUID;
key httpRequestId;
string pendingFieldRequest;  // Track which field we're requesting

// Generic function to get a single field from Firestore
getFieldByUUID(string fieldName) {
    ownerKey = llGetOwner();
    ownerUUID = (string)ownerKey;
    pendingFieldRequest = fieldName;
    
    llOwnerSay("Looking up " + fieldName + " for UUID: " + ownerUUID);
    
    // Firestore REST API query endpoint with field mask
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    // Build structured query with field mask for just this field
    string queryJson = "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"" + ownerUUID + "\"}}},\"select\":{\"fields\":[{\"fieldPath\":\"" + fieldName + "\"}]},\"limit\":1}}";
    
    httpRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        queryJson
    );
}

// Specific helper functions for common fields
getClassByUUID() {
    getFieldByUUID("class_id");
}

getStatsByUUID() {
    getFieldByUUID("stats");
}

getGenderByUUID() {
    getFieldByUUID("gender");
}

getSpeciesByUUID() {
    getFieldByUUID("species_id");
}

getHasManaByUUID() {
    getFieldByUUID("has_mana");
}

getHealthByUUID() {
    getFieldByUUID("health");
}

getStaminaByUUID() {
    getFieldByUUID("stamina");
}

getManaByUUID() {
    getFieldByUUID("mana");
}

getXPTotalByUUID() {
    getFieldByUUID("xp_total");
}

// Extract value from Firestore field format
// Handles: {"stringValue":"value"}, {"integerValue":123}, {"booleanValue":true}, {"mapValue":{...}}
string extractFirestoreValue(string fieldData) {
    if (fieldData == JSON_INVALID || fieldData == "") {
        return "";
    }
    
    // Try stringValue first (most common)
    string stringValue = llJsonGetValue(fieldData, ["stringValue"]);
    if (stringValue != JSON_INVALID && stringValue != "") {
        return stringValue;
    }
    
    // Try integerValue
    string intValue = llJsonGetValue(fieldData, ["integerValue"]);
    if (intValue != JSON_INVALID && intValue != "") {
        return intValue;
    }
    
    // Try booleanValue
    string boolValue = llJsonGetValue(fieldData, ["booleanValue"]);
    if (boolValue != JSON_INVALID && boolValue != "") {
        return boolValue;
    }
    
    // For mapValue (complex objects like stats, health), return the whole structure
    string mapValue = llJsonGetValue(fieldData, ["mapValue"]);
    if (mapValue != JSON_INVALID && mapValue != "") {
        return fieldData;  // Return full structure for complex objects
    }
    
    return "";
}

default {
    state_entry() {
        llOwnerSay("Firestore Field Lookup - Initialized");
        llOwnerSay("Commands:");
        llOwnerSay("  /1 class - Get class_id");
        llOwnerSay("  /2 stats - Get stats");
        llOwnerSay("  /3 gender - Get gender");
        llOwnerSay("  /4 species - Get species_id");
        llOwnerSay("  /5 hasMana - Get has_mana");
        llOwnerSay("  /6 health - Get health");
        llOwnerSay("  /7 stamina - Get stamina");
        llOwnerSay("  /8 mana - Get mana");
        llOwnerSay("  /9 xp - Get xp_total");
    }
    
    listen(integer channel, string name, key id, string message) {
        if (id != llGetOwner()) return;
        
        message = llToLower(llStringTrim(message, STRING_TRIM));
        
        if (message == "class") {
            getClassByUUID();
        }
        else if (message == "stats") {
            getStatsByUUID();
        }
        else if (message == "gender") {
            getGenderByUUID();
        }
        else if (message == "species") {
            getSpeciesByUUID();
        }
        else if (message == "hasmana") {
            getHasManaByUUID();
        }
        else if (message == "health") {
            getHealthByUUID();
        }
        else if (message == "stamina") {
            getStaminaByUUID();
        }
        else if (message == "mana") {
            getManaByUUID();
        }
        else if (message == "xp") {
            getXPTotalByUUID();
        }
    }
    
    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id != httpRequestId) return;
        
        if (status == 200) {
            llOwnerSay("Response received for field: " + pendingFieldRequest);
            
            // Navigate JSON structure: [0].document.fields.{fieldName}
            string firstResult = llJsonGetValue(body, [0]);
            if (firstResult == JSON_INVALID) {
                llOwnerSay("ERROR: No results found for UUID: " + ownerUUID);
                return;
            }
            
            string document = llJsonGetValue(firstResult, ["document"]);
            if (document == JSON_INVALID) {
                llOwnerSay("ERROR: No document in result");
                return;
            }
            
            string fields = llJsonGetValue(document, ["fields"]);
            if (fields == JSON_INVALID) {
                llOwnerSay("ERROR: No fields in document");
                return;
            }
            
            // Get the specific field we requested
            string fieldData = llJsonGetValue(fields, [pendingFieldRequest]);
            if (fieldData == JSON_INVALID) {
                llOwnerSay("ERROR: Field '" + pendingFieldRequest + "' not found in document");
                return;
            }
            
            // Extract the actual value from Firestore format
            string value = extractFirestoreValue(fieldData);
            
            if (value != "") {
                llOwnerSay("✓ SUCCESS! " + pendingFieldRequest + " = " + value);
            } else {
                llOwnerSay("ERROR: Could not extract value from field data");
                llOwnerSay("Field data: " + llGetSubString(fieldData, 0, 200));
            }
        } else {
            llOwnerSay("HTTP ERROR: Status " + (string)status);
            llOwnerSay("Response: " + llGetSubString(body, 0, 500));
        }
    }
    
    touch_start(integer total_number) {
        // Show menu on touch
        llOwnerSay("Firestore Field Lookup");
        llOwnerSay("Say one of these commands in chat:");
        llOwnerSay("  class, stats, gender, species, hasmana, health, stamina, mana, xp");
        llOwnerSay("Or use the command channel /1 for class, /2 for stats, etc.");
    }
}

