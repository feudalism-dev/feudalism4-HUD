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

cleanupTrackingLists() {
    if (llGetListLength(pendingClassOps) > MAX_PENDING_CLASS_OPS * 5) {
        pendingClassOps = llDeleteSubList(pendingClassOps, 0, 4);
    }
}

// =========================== CLASS OPERATIONS ==============================

// Placeholder for future class operations
// Currently, class reads are handled by Bridge_Stipends.lsl directly
// This module can be extended for class CRUD operations if needed

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
        
        // Future class operations can be added here
        // For now, this module is a placeholder
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        // Future class operation response handlers can be added here
    }
}

