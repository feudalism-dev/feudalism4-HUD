// ============================================================================
// Standalone Firestore Class Lookup Script
// ============================================================================
// This script independently queries Firestore to get a user's class_id
// by their Second Life UUID. No dependencies on any other scripts.
// ============================================================================

// Firebase Project Configuration
string FIREBASE_PROJECT_ID = "feudalism4-rpg";

// State
key ownerKey;
string ownerUUID;
key httpRequestId;

// Query Firestore for character class
lookupClass() {
    ownerKey = llGetOwner();
    ownerUUID = (string)ownerKey;
    
    llOwnerSay("Looking up class for UUID: " + ownerUUID);
    
    // Firestore REST API query endpoint with field mask to only get class_id
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    // Build structured query with field mask: Only return class_id field
    // This reduces response size significantly
    string queryJson = "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"characters\"}],\"where\":{\"fieldFilter\":{\"field\":{\"fieldPath\":\"owner_uuid\"},\"op\":\"EQUAL\",\"value\":{\"stringValue\":\"" + ownerUUID + "\"}}},\"select\":{\"fields\":[{\"fieldPath\":\"class_id\"}]},\"limit\":1}}";
    
    httpRequestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        queryJson
    );
    
    llOwnerSay("Querying Firestore...");
}

default {
    state_entry() {
        llOwnerSay("Standalone Firestore Class Lookup - Initialized");
        llOwnerSay("Touch me to look up your class from Firestore");
    }
    
    touch_start(integer total_number) {
        lookupClass();
    }
    
    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id != httpRequestId) return;
        
        if (status == 200) {
            llOwnerSay("Firestore response received (length: " + (string)llStringLength(body) + ")");
            llOwnerSay("Note: LSL truncates HTTP responses at 2048 chars");
            
            // Response format: [{"document":{"name":"...","fields":{"class_id":{"stringValue":"squire"},...}}}]
            // Use llJsonGetValue to navigate the JSON structure directly
            // This works even with truncated responses as long as the field we want is within the first 2048 chars
            
            // Get first element of array: [0]
            string firstResult = llJsonGetValue(body, [0]);
            if (firstResult == JSON_INVALID) {
                llOwnerSay("ERROR: Response is not a valid JSON array or is empty");
                llOwnerSay("Response preview: " + llGetSubString(body, 0, 500));
                return;
            }
            
            // Get document from first result: [0].document
            string document = llJsonGetValue(firstResult, ["document"]);
            if (document == JSON_INVALID) {
                llOwnerSay("ERROR: No document found in query result");
                return;
            }
            
            // Get fields from document: [0].document.fields
            string fields = llJsonGetValue(document, ["fields"]);
            if (fields == JSON_INVALID) {
                llOwnerSay("ERROR: No fields found in document");
                return;
            }
            
            llOwnerSay("Fields object extracted (length: " + (string)llStringLength(fields) + ")");
            
            // Get class_id field: [0].document.fields.class_id
            string classIdField = llJsonGetValue(fields, ["class_id"]);
            
            if (classIdField == JSON_INVALID) {
                llOwnerSay("ERROR: class_id field not found in response");
                llOwnerSay("Fields preview: " + llGetSubString(fields, 0, 500));
                
                // Try to find what fields ARE available
                llOwnerSay("Searching for available fields...");
                if (llSubStringIndex(fields, "\"owner_uuid\"") != -1) llOwnerSay("  - owner_uuid found");
                if (llSubStringIndex(fields, "\"name\"") != -1) llOwnerSay("  - name found");
                if (llSubStringIndex(fields, "\"title\"") != -1) llOwnerSay("  - title found");
                if (llSubStringIndex(fields, "\"gender\"") != -1) llOwnerSay("  - gender found");
                if (llSubStringIndex(fields, "\"species_id\"") != -1) llOwnerSay("  - species_id found");
                if (llSubStringIndex(fields, "\"class_id\"") != -1) llOwnerSay("  - class_id found (but JSON parsing failed)");
                return;
            }
            
            llOwnerSay("Found class_id field: " + llGetSubString(classIdField, 0, 200));
            
            // Extract the actual value from Firestore format: {"stringValue":"squire"}
            // Get stringValue from class_id field
            string classId = llJsonGetValue(classIdField, ["stringValue"]);
            
            if (classId == JSON_INVALID || classId == "") {
                // Try integerValue as fallback
                string classIdInt = llJsonGetValue(classIdField, ["integerValue"]);
                if (classIdInt != JSON_INVALID) {
                    classId = classIdInt;
                }
            }
            
            if (classId != "" && classId != JSON_INVALID) {
                llOwnerSay("✓ SUCCESS! Your class_id is: " + classId);
            } else {
                llOwnerSay("ERROR: Could not extract class_id value");
                llOwnerSay("class_id field structure: " + classIdField);
            }
        } else {
            llOwnerSay("HTTP ERROR: Status " + (string)status);
            llOwnerSay("Response: " + llGetSubString(body, 0, 1000));
        }
    }
}

