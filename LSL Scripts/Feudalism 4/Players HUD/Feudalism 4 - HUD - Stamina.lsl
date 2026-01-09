// ============================================================================
// Feudalism 4 - HUD - Stamina Manager
// ============================================================================
// Handles automatic stamina reduction based on:
// - Time passage (base drain)
// - Movement detection
// - Equipment weight (weapons/armor)
// - Game mode (no drain in OOC, AFK, or *)
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Stamina] " + message);
    }
}

// Stamina drain settings
float STAMINA_CHECK_INTERVAL = 600.0;  // 10 minutes (like F3)
integer BASE_STAMINA_DRAIN = 1;         // Base drain per interval
float INITIAL_CHECK_DELAY = 5.0;        // Delay after attach before first check

// Movement detection settings
integer ENABLE_MOVEMENT_DRAIN = TRUE;   // Enable extra drain when moving
float MOVEMENT_CHECK_INTERVAL = 30.0;   // Check movement every 30 seconds
float MOVEMENT_THRESHOLD = 0.5;         // Distance to consider "moving" (meters)
integer MOVEMENT_STAMINA_DRAIN = 1;     // Extra drain per check when moving

// Equipment weight settings (for future expansion)
integer ENABLE_WEIGHT_DRAIN = FALSE;    // Enable weight-based drain (Phase 2)
integer weaponWeight = 0;               // Current weapon weight
integer armorWeight = 0;                // Current armor weight

// =========================== STATE VARIABLES ================================
string currentMode = "roleplay";        // Current game mode
integer staminaDrainEnabled = TRUE;     // Global enable/disable
vector lastPosition;                    // Track movement
integer isMoving = FALSE;               // Movement state

// =========================== UTILITY FUNCTIONS ==============================

// Check if stamina drain should be active based on game mode
integer shouldDrainStamina() {
    // No drain in OOC, AFK, or None modes
    if (currentMode == "ooc" || currentMode == "afk" || currentMode == "*" || currentMode == "none") {
        return FALSE;
    }
    
    // Drain in roleplay and tournament modes
    return staminaDrainEnabled;
}

// Calculate total stamina drain for this interval
integer calculateStaminaDrain() {
    integer totalDrain = 0;
    
    // Base drain (always applies if active)
    totalDrain += BASE_STAMINA_DRAIN;
    
    // Movement drain (if enabled and moving)
    if (ENABLE_MOVEMENT_DRAIN && isMoving) {
        totalDrain += MOVEMENT_STAMINA_DRAIN;
        debugLog("Movement detected, adding " + (string)MOVEMENT_STAMINA_DRAIN + " drain");
    }
    
    // Weight-based drain (Phase 2 - disabled for now)
    if (ENABLE_WEIGHT_DRAIN) {
        integer weightDrain = (weaponWeight + armorWeight) / 10;  // 1 stamina per 10 weight units
        totalDrain += weightDrain;
        debugLog("Weight drain: " + (string)weightDrain);
    }
    
    return totalDrain;
}

// Apply stamina drain
applyStaminaDrain() {
    if (!shouldDrainStamina()) {
        debugLog("Stamina drain disabled for mode: " + currentMode);
        return;
    }
    
    integer drain = calculateStaminaDrain();
    
    if (drain > 0) {
        debugLog("Draining " + (string)drain + " stamina");
        
        // Send drain command to Main script (negative value = drain)
        llMessageLinked(LINK_SET, -drain, "change stamina", "auto_drain");
        
        // Also broadcast to external listeners (if needed)
        // llRegionSayTo(llGetOwner(), -77770, "drain stamina," + (string)drain);
    }
}

// Check if avatar is moving
checkMovement() {
    if (!ENABLE_MOVEMENT_DRAIN) {
        return;
    }
    
    vector currentPosition = llGetPos();
    float distance = llVecDist(currentPosition, lastPosition);
    
    if (distance > MOVEMENT_THRESHOLD) {
        isMoving = TRUE;
        debugLog("Moving: " + (string)distance + "m");
    } else {
        isMoving = FALSE;
    }
    
    lastPosition = currentPosition;
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Stamina Manager starting...");
        
        // Initialize
        currentMode = "roleplay";
        staminaDrainEnabled = TRUE;
        lastPosition = llGetPos();
        isMoving = FALSE;
        weaponWeight = 0;
        armorWeight = 0;
        
        // Start timers
        llSetTimerEvent(STAMINA_CHECK_INTERVAL);
        
        debugLog("Stamina Manager ready. Drain every " + (string)STAMINA_CHECK_INTERVAL + " seconds");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    attach(key id) {
        if (id) {
            // Attached - trigger first check after short delay
            llSetTimerEvent(INITIAL_CHECK_DELAY);
            debugLog("Attached, first check in " + (string)INITIAL_CHECK_DELAY + "s");
        }
    }
    
    timer() {
        // Check movement
        checkMovement();
        
        // Apply stamina drain
        applyStaminaDrain();
        
        // Reset timer to normal interval (in case it was shortened)
        llSetTimerEvent(STAMINA_CHECK_INTERVAL);
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Mode changes
        if (msg == "tournament mode" || msg == "roleplay mode" || 
            msg == "ooc mode" || msg == "afk mode" || 
            msg == "none mode" || msg == "* mode") {
            
            // Extract mode from message
            list parts = llParseString2List(msg, [" "], []);
            currentMode = llList2String(parts, 0);
            debugLog("Mode changed to: " + currentMode);
        }
        
        // Enable/disable stamina drain
        else if (msg == "enable stamina drain") {
            staminaDrainEnabled = TRUE;
            debugLog("Stamina drain enabled");
        }
        else if (msg == "disable stamina drain") {
            staminaDrainEnabled = FALSE;
            debugLog("Stamina drain disabled");
        }
        
        // Weapon weight update (Phase 2)
        else if (msg == "weapon weight") {
            weaponWeight = num;
            debugLog("Weapon weight: " + (string)weaponWeight);
        }
        
        // Armor weight update (Phase 2)
        else if (msg == "armor weight") {
            armorWeight = num;
            debugLog("Armor weight: " + (string)armorWeight);
        }
        
        // Manual stamina check (for testing)
        else if (msg == "check stamina drain") {
            applyStaminaDrain();
        }
    }
}
