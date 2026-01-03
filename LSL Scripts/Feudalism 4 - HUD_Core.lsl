// ============================================================================
// Feudalism 4 - HUD Core (Message Router)
// ============================================================================
// Handles all llListen() registrations and routes messages to appropriate modules
// ============================================================================

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;
integer PLAYERS_HUD_CHANNEL = -777700;  // Internal channel for Players HUD communication

// =========================== STATE VARIABLES ================================
key ownerKey;
integer hudChannel;  // Generated channel for MOAP communication

// =========================== UTILITY FUNCTIONS ==============================

// Generate a unique channel based on owner UUID
integer generateChannel(key id) {
    return -1 - (integer)("0x" + llGetSubString((string)id, 0, 6));
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        hudChannel = generateChannel(ownerKey);
        
        // Set up listeners
        llListen(hudChannel, "", NULL_KEY, "");
        llListen(PLAYERS_HUD_CHANNEL, "", NULL_KEY, "");
        llListen(HUD_CHANNEL, "", NULL_KEY, "");
    }
    
    listen(integer channel, string name, key id, string msg) {
        // PAYCHEST commands → HUD_Paychest
        if (channel == HUD_CHANNEL && llSubStringIndex(msg, "PAYCHEST_") == 0) {
            llMessageLinked(LINK_SET, 1001, msg, id);
            return;
        }
        
        // Other HUD_CHANNEL commands (damage, heal, fGivePay) → HUD_Stats
        if (channel == HUD_CHANNEL) {
            llMessageLinked(LINK_SET, 1004, msg, id);
            return;
        }
        
        // MOAP commands → HUD_MOAP
        if (channel == hudChannel) {
            llMessageLinked(LINK_SET, 1002, msg, id);
            return;
        }
        
        // Players HUD internal → HUD_Stats
        if (channel == PLAYERS_HUD_CHANNEL) {
            llMessageLinked(LINK_SET, 1003, msg, id);
            return;
        }
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
    }
}

