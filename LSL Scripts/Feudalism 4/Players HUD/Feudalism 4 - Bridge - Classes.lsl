// Feudalism 4 - Bridge Classes Module
// ============================================================================
// Handles class operations (currently minimal, used by stipends)
// Can be extended for future class-related operations
// ============================================================================

// Import constants
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
integer FS_BRIDGE_CHANNEL = -777001;
integer MODULE_CHANNEL = -777002;
string DOMAIN_CLASS = "CLASS";

// Request tracking
list pendingClassOps;
integer MAX_PENDING_CLASS_OPS = 10;

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
    if (llGetListLength(pendingClassOps) > MAX_PENDING_CLASS_OPS * 5) {
        pendingClassOps = llDeleteSubList(pendingClassOps, 0, 4);
    }
}

// =========================== CLASS OPERATIONS ==============================

// Get list of all classes
getClassList(integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_LIST_ERROR", "");
        return;
    }
    
    cleanupTrackingLists();
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents:runQuery";
    
    list queryParts = [
        "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"classes\"}],\"select\":{\"fields\":[{\"fieldPath\":\"__name__\"},{\"fieldPath\":\"name\"}]},\"orderBy\":[{\"field\":{\"fieldPath\":\"name\"},\"direction\":\"ASCENDING\"}]}}"
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
    
    pendingClassOps += [requestId, "GET_CLASS_LIST", senderLink];
}

// Get stipend for a specific class
getClassStipend(string classId, integer senderLink) {
    if (FIREBASE_PROJECT_ID == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND_ERROR", "Project ID not configured");
        return;
    }
    
    if (classId == "") {
        llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND_ERROR", "Invalid class ID");
        return;
    }
    
    cleanupTrackingLists();
    
    string url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/classes/" + classId;
    
    key requestId = llHTTPRequest(
        url,
        [
            HTTP_METHOD, "GET",
            HTTP_MIMETYPE, "application/json"
        ],
        ""
    );
    
    pendingClassOps += [requestId, "GET_CLASS_STIPEND", senderLink, classId];
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Module initialized
        // Currently minimal - can be extended for class operations
    }
    
    // Handle routed commands from Bridge_Main
    link_message(integer sender_num, integer num, string msg, key id) {
        if (num != MODULE_CHANNEL) return;
        
        list parts = llParseString2List(msg, ["|"], []);
        if (llGetListLength(parts) < 4) return;
        
        string domain = llList2String(parts, 0);
        if (domain != DOMAIN_CLASS) return;
        
        string command = llList2String(parts, 1);
        string payload = llList2String(parts, 2);
        integer originalSenderLink = (integer)llList2String(parts, 3);
        
        // Route command
        if (llSubStringIndex(command, "GET_CLASS_LIST") == 0) {
            getClassList(originalSenderLink);
        }
        else if (llSubStringIndex(command, "GET_CLASS_STIPEND") == 0) {
            // Extract classId from payload (last segment)
            string classId = "";
            if (payload != "") {
                list payloadParts = llParseString2List(payload, ["|"], []);
                integer payloadLen = llGetListLength(payloadParts);
                if (payloadLen > 0) {
                    classId = llList2String(payloadParts, payloadLen - 1);
                }
            }
            getClassStipend(classId, originalSenderLink);
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        integer opIndex = llListFindList(pendingClassOps, [request_id]);
        
        if (opIndex != -1) {
            string operation = llList2String(pendingClassOps, opIndex + 1);
            
            // Handle GET_CLASS_LIST
            if (operation == "GET_CLASS_LIST") {
                integer senderLink = llList2Integer(pendingClassOps, opIndex + 2);
                
                pendingClassOps = llDeleteSubList(pendingClassOps, opIndex, opIndex + 2);
                
                if (status != 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_LIST_ERROR", "");
                    return;
                }
                
                // Parse JSON body
                string documents = llJsonGetValue(body, ["documents"]);
                if (documents == JSON_INVALID || documents == "") {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_LIST_ERROR", "");
                    return;
                }
                
                // Extract class names from documents array
                list classNames = [];
                integer i = 0;
                integer done = FALSE;
                while (!done) {
                    string doc = llJsonGetValue(documents, [i]);
                    if (doc == JSON_INVALID || doc == "") {
                        done = TRUE;
                    } else {
                        // Extract document name (full path)
                        string name = llJsonGetValue(doc, ["name"]);
                        if (name != JSON_INVALID && name != "") {
                            // Extract classId from last segment of name path
                            // Format: projects/.../databases/.../documents/classes/<classId>
                            list nameParts = llParseString2List(name, ["/"], []);
                            integer namePartsLen = llGetListLength(nameParts);
                            string classId = "";
                            if (namePartsLen > 0) {
                                classId = llList2String(nameParts, namePartsLen - 1);
                            }
                            
                            // Extract display name from fields.name.stringValue if present
                            string fields = llJsonGetValue(doc, ["fields"]);
                            string displayName = classId;  // Default to classId
                            if (fields != JSON_INVALID && fields != "") {
                                string nameField = llJsonGetValue(fields, ["name"]);
                                if (nameField != JSON_INVALID && nameField != "") {
                                    string nameValue = extractFirestoreValue(nameField);
                                    if (nameValue != "") {
                                        displayName = nameValue;
                                    }
                                }
                            }
                            
                            classNames = classNames + [displayName];
                        }
                        i = i + 1;
                    }
                }
                
                // Join class names with pipe separator
                string buttonListString = llDumpList2String(classNames, "|");
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_LIST|" + buttonListString, "");
                return;
            }
            
            // Handle GET_CLASS_STIPEND
            if (operation == "GET_CLASS_STIPEND") {
                integer senderLink = llList2Integer(pendingClassOps, opIndex + 2);
                string classId = llList2String(pendingClassOps, opIndex + 3);
                
                pendingClassOps = llDeleteSubList(pendingClassOps, opIndex, opIndex + 3);
                
                if (status != 200) {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND_ERROR|Status " + (string)status, "");
                    return;
                }
                
                // Parse body
                string fields = llJsonGetValue(body, ["fields"]);
                if (fields == JSON_INVALID || fields == "") {
                    llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND_ERROR|No fields in class document", "");
                    return;
                }
                
                // Extract class name if present
                string className = classId;  // Default to classId
                string nameField = llJsonGetValue(fields, ["name"]);
                if (nameField != JSON_INVALID && nameField != "") {
                    string nameValue = extractFirestoreValue(nameField);
                    if (nameValue != "") {
                        className = nameValue;
                    }
                }
                
                // Extract stipend
                string stipendField = llJsonGetValue(fields, ["stipend"]);
                integer gold = 0;
                integer silver = 0;
                integer copper = 0;
                
                if (stipendField != JSON_INVALID && stipendField != "") {
                    // Check if it's a mapValue (object) or a numeric value (legacy)
                    string mapValue = llJsonGetValue(stipendField, ["mapValue"]);
                    if (mapValue != JSON_INVALID && mapValue != "") {
                        // New format: object with gold, silver, copper
                        string mapFields = llJsonGetValue(mapValue, ["fields"]);
                        if (mapFields != JSON_INVALID && mapFields != "") {
                            string goldField = llJsonGetValue(mapFields, ["gold"]);
                            string silverField = llJsonGetValue(mapFields, ["silver"]);
                            string copperField = llJsonGetValue(mapFields, ["copper"]);
                            
                            if (goldField != JSON_INVALID && goldField != "") {
                                string goldStr = extractFirestoreValue(goldField);
                                gold = (integer)goldStr;
                            }
                            if (silverField != JSON_INVALID && silverField != "") {
                                string silverStr = extractFirestoreValue(silverField);
                                silver = (integer)silverStr;
                            }
                            if (copperField != JSON_INVALID && copperField != "") {
                                string copperStr = extractFirestoreValue(copperField);
                                copper = (integer)copperStr;
                            }
                        }
                    } else {
                        // Legacy format: numeric value (silver units)
                        string stipendStr = extractFirestoreValue(stipendField);
                        integer stipendSilver = (integer)stipendStr;
                        // Convert to 3-currency: assume it's in silver units
                        gold = stipendSilver / 100;
                        silver = stipendSilver % 100;
                        copper = 0;
                    }
                }
                
                // Build human-readable message
                string message = "Class stipend: " + (string)gold + " gold, " + (string)silver + " silver, " + (string)copper + " copper.";
                llMessageLinked(senderLink, FS_BRIDGE_CHANNEL, "CLASS_STIPEND|" + message, "");
                return;
            }
        }
    }
}

