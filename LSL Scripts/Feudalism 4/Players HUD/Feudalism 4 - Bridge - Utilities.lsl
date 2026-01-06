// Feudalism 4 - Bridge Utilities
// ============================================================================
// Shared helpers, constants, and utility functions for all Bridge modules
// ============================================================================

// Firebase Project Configuration
string FIREBASE_PROJECT_ID = "feudalism4-rpg";

// Communication channels
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Bridge responses to HUD controllers
integer INVENTORY_CHANNEL = -454545;   // Channel for GIVE_ITEM/TAKE_ITEM from world objects

// Internal module communication channels (via link_message)
integer MODULE_CHANNEL = -777002;      // For module-to-module communication

// Module domain prefixes
string DOMAIN_CHAR = "CHAR";
string DOMAIN_CLASS = "CLASS";
string DOMAIN_UNIV = "UNIV";
string DOMAIN_INV = "INV";
string DOMAIN_STIP = "STIP";
string DOMAIN_CONS = "CONS";

// Request tracking limits
integer MAX_PENDING_REQUESTS = 20;
integer MAX_PENDING_INVENTORY = 10;

// =========================== UTILITY FUNCTIONS ==============================

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

// Helper to determine which UUID to use (provided target or owner's UUID)
string getUUIDToUse(string targetUUID, string ownerUUID) {
    if (targetUUID != "") {
        return targetUUID;
    } else {
        return ownerUUID;
    }
}

// Normalize item name to lowercase
string normalizeItemName(string name) {
    return llToLower(llStringTrim(name, STRING_TRIM));
}

// Limit tracking list size to prevent memory issues
// Note: In LSL, lists are passed by value, so this function returns a modified copy.
// Each module implements its own cleanupTrackingLists() that modifies the module's list directly.
list cleanupTrackingList(list trackingList, integer maxEntries, integer entriesPerRequest) {
    integer listLen = llGetListLength(trackingList);
    integer maxLen = maxEntries * entriesPerRequest;
    if (listLen > maxLen) {
        // Remove oldest entries
        trackingList = llDeleteSubList(trackingList, 0, entriesPerRequest - 1);
    }
    return trackingList;
}

// Build Firestore REST API base URL
string getFirestoreBase() {
    return "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents";
}

// =========================== MAIN STATE =====================================
// Note: This is a utility library. The default block is required by LSL syntax
// but this script is not meant to be run standalone - it's a reference for
// constants and function patterns that should be copied into other modules.

default {
    state_entry() {
        // Utility library - not meant to run standalone
    }
}
