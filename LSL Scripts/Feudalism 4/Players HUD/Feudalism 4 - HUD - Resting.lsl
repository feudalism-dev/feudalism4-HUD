// ============================================================================
// Feudalism 4 - HUD - Resting Manager
// ============================================================================
// Handles rest/recovery mechanics
// - Gradual health and stamina recovery
// - Sit animation during rest
// - Auto-stop when fully recovered
// - Manual stop rest command
// - Mana recovery (new for F4!)
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Resting] " + message);
    }
}

// Resting settings
float RECOVERY_INTERVAL = 5.0;      // Recovery tick every 5 seconds
integer HEALTH_RECOVERY_RATE = 1;   // Health per tick
integer STAMINA_RECOVERY_RATE = 1;  // Stamina per tick
integer MANA_RECOVERY_RATE = 1;     // Mana per tick (new for F4!)

string REST_ANIMATION = "sit_ground";  // Animation to play while resting

// =========================== STATE VARIABLES ================================
integer isResting = FALSE;
integer hasExperiencePerms = FALSE;
string animationState = "";  // "start", "resting", "stop"

// =========================== UTILITY FUNCTIONS ==============================

// Start resting
startResting() {
    if (isResting) {
        debugLog("Already resting");
        return;
    }
    
    isResting = TRUE;
    animationState = "start";
    
    llOwnerSay("You sit to rest and begin to recover...");
    
    // Request experience permissions for animation
    llRequestExperiencePermissions(llGetOwner(), "");
    
    // Start recovery timer
    llSetTimerEvent(RECOVERY_INTERVAL);
    
    debugLog("Resting started");
}

// Stop resting
stopResting() {
    if (!isResting) {
        debugLog("Not resting");
        return;
    }
    
    isResting = FALSE;
    animationState = "stop";
    
    // Stop animation
    llRequestExperiencePermissions(llGetOwner(), "");
    
    // Stop timer
    llSetTimerEvent(0.0);
    
    llOwnerSay("You stop resting.");
    
    debugLog("Resting stopped");
}

// Perform recovery tick
performRecovery() {
    if (!isResting) {
        return;
    }
    
    // Request current resource values from Main/Stats
    llMessageLinked(LINK_SET, 0, "get current resources", "");
    
    // Main will respond with recovery command
    llMessageLinked(LINK_SET, HEALTH_RECOVERY_RATE, "rest recover health", "");
    llMessageLinked(LINK_SET, STAMINA_RECOVERY_RATE, "rest recover stamina", "");
    llMessageLinked(LINK_SET, MANA_RECOVERY_RATE, "rest recover mana", "");
    
    debugLog("Recovery tick: +" + (string)HEALTH_RECOVERY_RATE + " HP, +" + 
             (string)STAMINA_RECOVERY_RATE + " SP, +" + (string)MANA_RECOVERY_RATE + " MP");
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Resting Manager starting...");
        
        // Initialize
        isResting = FALSE;
        hasExperiencePerms = FALSE;
        animationState = "";
        
        // Stop any timers
        llSetTimerEvent(0.0);
        
        debugLog("Resting Manager ready");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
    }
    
    experience_permissions(key target_id) {
        hasExperiencePerms = TRUE;
        
        if (animationState == "start") {
            // Start sitting animation
            llStartAnimation(REST_ANIMATION);
            animationState = "resting";
            debugLog("Started rest animation");
        }
        else if (animationState == "stop") {
            // Stop sitting animation
            llStopAnimation(REST_ANIMATION);
            animationState = "";
            debugLog("Stopped rest animation");
        }
    }
    
    experience_permissions_denied(key target_id, integer reason) {
        hasExperiencePerms = FALSE;
        debugLog("Experience permissions denied: " + (string)reason);
        
        if (isResting) {
            llOwnerSay("Warning: Cannot play rest animation without Experience permissions.");
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Start resting command
        if (msg == "rest" || msg == "start resting") {
            startResting();
        }
        
        // Stop resting command
        else if (msg == "stop resting") {
            stopResting();
        }
        
        // Check if fully recovered (from Main/Stats)
        else if (msg == "fully recovered") {
            if (isResting) {
                llOwnerSay("You are fully recovered!");
                stopResting();
            }
        }
        
        // Toggle rest
        else if (msg == "toggle rest") {
            if (isResting) {
                stopResting();
            } else {
                startResting();
            }
        }
    }
    
    timer() {
        if (isResting) {
            performRecovery();
        }
    }
}
