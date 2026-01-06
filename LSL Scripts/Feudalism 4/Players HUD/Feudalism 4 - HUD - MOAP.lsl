// ============================================================================
// Feudalism 4 - HUD MOAP Handler
// ============================================================================
// Handles all MOAP (Media On A Prim) interface logic
// ============================================================================

// =========================== CONFIGURATION ==================================
// Development Mode: Set to TRUE to use preview channel URL, FALSE for production
integer DEV_MODE = FALSE;

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[HUD] " + message);
    }
}

// GitHub Pages URL for the MOAP interface
// Production: https://feudalism-dev.github.io/feudalism4-HUD/hud.html
// Dev Channel: (same as production for now)
string MOAP_BASE_URL;

// MOAP Face (which face of the prim displays the web content)
integer MOAP_FACE = 4;

// MOAP dimensions
integer MOAP_WIDTH = 1024;
integer MOAP_HEIGHT = 768;

// MOAP Prim Name (child prim that contains the MOAP interface)
string MOAP_PRIM_NAME = "setup_moap";

// =========================== COMMUNICATION CHANNELS ========================
integer METER_MODE_CHANNEL = -7777777;
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Firestore Bridge responses

// =========================== STATE VARIABLES ================================
// Owner info
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
integer hudChannel;  // Generated channel for MOAP communication

// HUD Mode
integer setupModeActive = FALSE;  // TRUE when Setup HUD is visible
integer moapPrimLink = -1;  // Link number of MOAP prim

// =========================== DRIFT-FREE HUD POSITIONS ======================
// Hardcoded absolute positions - NEVER use relative movement or calculations
// These are the exact positions you provided - snap directly to these
vector SETUP_HUD_VISIBLE_POS = <0.0, 0.0, -0.44653>;
vector SETUP_HUD_HIDDEN_POS = <0.0, 0.0, 0.91040>;

// =========================== UTILITY FUNCTIONS ==============================

// Generate a unique channel based on owner UUID
integer generateChannel(key id) {
    return -1 - (integer)("0x" + llGetSubString((string)id, 0, 6));
}

// Find link number by name
integer getLinkNumberByName(string linkName) {
    integer i = 0;
    while (i <= llGetNumberOfPrims()) {
        if (llGetLinkName(i) == linkName)
            return i;
        i++;
    }
    return -1;
}

// Set MOAP URL on the MOAP prim
setMOAPUrl(string url) {
    if (moapPrimLink > 0) {
        llSetLinkMedia(moapPrimLink, MOAP_FACE, [
            PRIM_MEDIA_CURRENT_URL, url,
            PRIM_MEDIA_HOME_URL, url,
            PRIM_MEDIA_AUTO_PLAY, TRUE,
            PRIM_MEDIA_AUTO_SCALE, TRUE,
            PRIM_MEDIA_AUTO_ZOOM, TRUE,
            PRIM_MEDIA_WIDTH_PIXELS, MOAP_WIDTH,
            PRIM_MEDIA_HEIGHT_PIXELS, MOAP_HEIGHT
        ]);
    }
}

// Clear MOAP display
clearMOAP() {
    if (moapPrimLink > 0) {
        llClearLinkMedia(moapPrimLink, MOAP_FACE);
    }
}

// Move MOAP prim to show Setup HUD - snap directly to visible position
showSetupHUD() {
    // Check if already active - prevent duplicate calls
    if (setupModeActive) {
        return;
    }
    
    // FIRST: Set flag immediately to prevent race conditions
    setupModeActive = TRUE;
    
    if (moapPrimLink <= 0) {
        debugLog("ERROR: moapPrimLink is invalid: " + (string)moapPrimLink);
        setupModeActive = FALSE;  // Reset flag on error
        return;
    }
    
    debugLog("Showing Setup HUD");
    
    // Move panel into view
    llSetLinkPrimitiveParamsFast(moapPrimLink, [
        PRIM_POS_LOCAL,
        SETUP_HUD_VISIBLE_POS
    ]);
    
    // Wait for viewer to render the prim
    llSleep(0.3);
    
    // Build URL
    string hudUrl = MOAP_BASE_URL + "/hud.html";
    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
    hudUrl += "&username=" + llEscapeURL(ownerUsername);
    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
    hudUrl += "&channel=" + (string)hudChannel;
    hudUrl += "&t=" + (string)llGetUnixTime();
    
    // DO NOT clear MOAP here — it breaks autoplay
    setMOAPUrl(hudUrl);
    
    // Start timer to poll for MOAP commands
    llSetTimerEvent(1.0);
}

// Move MOAP prim to hide Setup HUD - snap directly to hidden position
hideSetupHUD() {
    // Check if already hidden - prevent duplicate calls
    if (!setupModeActive) {
        return;
    }
    
    if (moapPrimLink <= 0) {
        debugLog("ERROR: moapPrimLink is invalid: " + (string)moapPrimLink);
        setupModeActive = FALSE;  // Reset flag on error
        return;
    }
    
    debugLog("Hiding Setup HUD");
    
    // Stop timer first
    llSetTimerEvent(0.0);
    
    // Move to hidden position
    llSetLinkPrimitiveParamsFast(moapPrimLink, [
        PRIM_POS_LOCAL,
        SETUP_HUD_HIDDEN_POS
    ]);
    
    // Clear MOAP
    clearMOAP();
    
    // LAST: Set flag to FALSE after everything is done
    // This ensures that if a link message arrives while hiding, it sees TRUE and returns early
    setupModeActive = FALSE;
}

// Send notification
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Announce to local chat
announce(string message) {
    llSay(0, message);
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        // Generate unique communication channel
        hudChannel = generateChannel(ownerKey);
        
        // Set MOAP URL based on DEV_MODE
        if (DEV_MODE) {
            MOAP_BASE_URL = "https://feudalism-dev.github.io/feudalism4-HUD";
            debugLog("Running in DEV mode - Using GitHub Pages URL");
        } else {
            MOAP_BASE_URL = "https://feudalism-dev.github.io/feudalism4-HUD";
            debugLog("Running in PRODUCTION mode - Using GitHub Pages URL");
        }
        
        // Find MOAP prim
        moapPrimLink = getLinkNumberByName(MOAP_PRIM_NAME);
        if (moapPrimLink == -1) {
            debugLog("WARNING: MOAP prim '" + MOAP_PRIM_NAME + "' not found!");
        }
        
        // Initialize Setup HUD - snap directly to hidden position
        if (moapPrimLink > 0) {
            debugLog("Initializing Setup HUD - MOAP prim link: " + (string)moapPrimLink);
            
            // Small delay to ensure prim is ready
            llSleep(0.1);
            
            // Snap directly to hidden position - NO calculations, NO reading current pos
            llSetLinkPrimitiveParamsFast(moapPrimLink, [
                PRIM_POS_LOCAL,
                SETUP_HUD_HIDDEN_POS
            ]);
            
            // Verify position was set
            llSleep(0.1);
            vector actualPos = llList2Vector(llGetLinkPrimitiveParams(moapPrimLink, [PRIM_POS_LOCAL]), 0);
            debugLog("Setup HUD initialized - Target: " + (string)SETUP_HUD_HIDDEN_POS + ", Actual: " + (string)actualPos);
            
            // DON'T set MOAP URL here - prim is hidden/off-screen, so autoplay won't fire
            // We'll set it in showSetupHUD() after moving the prim into view
            clearMOAP();
        }
    }
    
    link_message(integer sender, integer num, string msg, key id) {
        // Toggle commands from HUD_Main
        if (num == 2001) {
            if (msg == "TOGGLE_SETUP_HUD") {
                if (setupModeActive) {
                    hideSetupHUD();
                } else {
                    showSetupHUD();
                }
            } else if (msg == "HIDE_SETUP_HUD") {
                hideSetupHUD();
            }
            return;
        }
        
        // MOAP commands from HUD_Core
        if (num == 1002) {
            list parts = llParseString2List(msg, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            // Character data is now handled by Firestore Bridge via HTTP, not MOAP
            // This handler kept for backward compatibility but should not be used
            
            // Close Setup HUD command from MOAP - IGNORED (use rp_options prim to toggle)
            if (cmd == "CLOSE_SETUP") {
                debugLog("Ignoring CLOSE_SETUP from listen() - use rp_options prim");
                return;  // Ignore this command
            }
            // Other MOAP commands (ROLL, ANNOUNCE, etc.)
            else if (cmd == "ROLL") {
                string stat = llList2String(parts, 1);
                string dice = llList2String(parts, 2);
                string target = llList2String(parts, 3);
                string result = llList2String(parts, 4);
                string success = llList2String(parts, 5);
                
                string announcement = "⚔️ " + ownerDisplayName + " rolls " + stat + ": ";
                announcement += "[" + dice + "] = " + result + " vs DC " + target;
                if (success == "true") {
                    announcement += " ✅ SUCCESS!";
                } else {
                    announcement += " ❌ FAILURE";
                }
                announce(announcement);
            }
            else if (cmd == "ANNOUNCE") {
                string msg = llList2String(parts, 1);
                announce(msg);
            }
            else if (cmd == "NOTIFY") {
                string msg = llList2String(parts, 1);
                notify(msg);
            }
            // Mode change from Options tab
            else if (cmd == "MODE") {
                string mode = llList2String(parts, 1);
                llMessageLinked(LINK_SET, 0, mode + " mode", "");
                llRegionSayTo(llGetOwner(), METER_MODE_CHANNEL, "mode," + mode);
                notify("Mode set to " + mode);
            }
            // Show/Hide bars
            else if (cmd == "SHOW_BARS") {
                llMessageLinked(LINK_SET, 0, "show bars", "");
                llRegionSayTo(llGetOwner(), METER_MODE_CHANNEL, "healthbar,show");
                notify("Health and stamina bars will be shown");
            }
            else if (cmd == "HIDE_BARS") {
                llRegionSayTo(llGetOwner(), METER_MODE_CHANNEL, "healthbar,hide");
                notify("Health and stamina bars will be hidden");
            }
            // OOC Reset
            else if (cmd == "OOC_RESET") {
                llMessageLinked(LINK_SET, 0, "reset character", "");
                notify("Character resources reset");
            }
            // IC Rest
            else if (cmd == "IC_REST") {
                llMessageLinked(LINK_SET, 0, "rest", "");
                notify("Resting...");
            }
            // Stop Resting
            else if (cmd == "STOP_RESTING") {
                llMessageLinked(LINK_SET, 0, "stop resting", "");
                notify("Stopped resting");
            }
            // Set Active Character
            else if (cmd == "SET_ACTIVE_CHARACTER") {
                string userID = llList2String(parts, 1);
                string characterID = llList2String(parts, 2);
                if (userID != "" && characterID != "") {
                    // Forward to Bridge via link_message
                    llMessageLinked(LINK_SET, 0, "SET_ACTIVE_CHARACTER|" + userID + "|" + characterID, "");
                    debugLog("Forwarding SET_ACTIVE_CHARACTER to Bridge: " + userID + " -> " + characterID);
                }
            }
            // Get Active Character
            else if (cmd == "GET_ACTIVE_CHARACTER") {
                string userID = llList2String(parts, 1);
                if (userID != "") {
                    // Forward to Bridge via link_message
                    llMessageLinked(LINK_SET, 0, "GET_ACTIVE_CHARACTER|" + userID, "");
                    debugLog("Forwarding GET_ACTIVE_CHARACTER to Bridge: " + userID);
                }
            }
            return;
        }
        
        // Handle Bridge responses on FS_BRIDGE_CHANNEL for MOAP URL updates
        if (num == FS_BRIDGE_CHANNEL) {
            // ACTIVE_CHARACTER_SET response
            if (msg == "ACTIVE_CHARACTER_SET") {
                string characterID = (string)id;
                debugLog("Active character set: " + characterID);
                // Update URL to notify HUD (HUD will poll for this)
                if (setupModeActive && moapPrimLink > 0) {
                    string hudUrl = MOAP_BASE_URL + "/hud.html";
                    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                    hudUrl += "&username=" + llEscapeURL(ownerUsername);
                    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                    hudUrl += "&channel=" + (string)hudChannel;
                    hudUrl += "&active_char=" + llEscapeURL(characterID);
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                }
            }
            // ACTIVE_CHARACTER response (from GET_ACTIVE_CHARACTER)
            else if (msg == "ACTIVE_CHARACTER") {
                string characterID = (string)id;
                debugLog("Active character retrieved: " + characterID);
                // Update URL to notify HUD
                if (setupModeActive && moapPrimLink > 0) {
                    string hudUrl = MOAP_BASE_URL + "/hud.html";
                    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                    hudUrl += "&username=" + llEscapeURL(ownerUsername);
                    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                    hudUrl += "&channel=" + (string)hudChannel;
                    if (characterID != "null" && characterID != "") {
                        hudUrl += "&active_char=" + llEscapeURL(characterID);
                    }
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                }
            }
            // Error responses
            else if (llSubStringIndex(msg, "ACTIVE_CHARACTER") == 0 && llSubStringIndex(msg, "ERROR") != -1) {
                string errorMsg = (string)id;
                debugLog("Active character error: " + msg + " - " + errorMsg);
                notify("Error setting active character: " + errorMsg);
            }
            return;
        }
    }
    
    timer() {
        // Poll for Setup HUD UI commands (like CLOSE_SETUP) when Setup HUD is active
        if (setupModeActive && moapPrimLink > 0) {
            list mediaParams = llGetLinkPrimitiveParams(moapPrimLink, [PRIM_MEDIA_CURRENT_URL]);
            string currentUrl = llList2String(mediaParams, 0);
            
            // Character data is now loaded via Firestore Bridge and stored in LSD by Data Manager
            // No need to poll URL for char_data parameter
            
            // Check if URL contains LSL command
            integer cmdPos = llSubStringIndex(currentUrl, "lsl_cmd=");
            if (cmdPos != -1) {
                // Extract command from URL
                string dataPart = llGetSubString(currentUrl, cmdPos + 8, -1);
                // Find end of command (next & or end of string)
                integer endPos = llSubStringIndex(dataPart, "&");
                if (endPos == -1) endPos = llStringLength(dataPart);
                string encodedCmd = llGetSubString(dataPart, 0, endPos - 1);
                
                // Decode and process command
                string command = llUnescapeURL(encodedCmd);
                debugLog("Received command from MOAP: " + command);
                
                // Parse and handle command directly
                // NOTE: CLOSE_SETUP is no longer used - rp_options prim handles toggle
                // Ignore CLOSE_SETUP commands to prevent conflicts with rp_options toggle
                if (command == "CLOSE_SETUP") {
                    debugLog("Ignoring CLOSE_SETUP command - use rp_options prim to toggle");
                    // Remove command from URL but don't hide
                    string hudUrl = MOAP_BASE_URL + "/hud.html";
                    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                    hudUrl += "&username=" + llEscapeURL(ownerUsername);
                    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                    hudUrl += "&channel=" + (string)hudChannel;
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                    return;
                } else {
                    // Send other commands via channel to trigger listen handler
                    llRegionSay(hudChannel, command);
                }
                
                // Remove command from URL by reloading URL without the command
                // This prevents reprocessing the same command
                string hudUrl = MOAP_BASE_URL + "/hud.html";
                hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                hudUrl += "&username=" + llEscapeURL(ownerUsername);
                hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                hudUrl += "&channel=" + (string)hudChannel;
                hudUrl += "&t=" + (string)llGetUnixTime();
                setMOAPUrl(hudUrl);
                debugLog("Cleared command from URL");
            }
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // Don't automatically show Setup HUD on attach
            // User must click rp_options to show it
            // Data Manager will fetch from Firestore and load data
        } else {
            clearMOAP();
        }
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) {
            // Refresh MOAP after teleport
            if (setupModeActive && moapPrimLink > 0) {
                string hudUrl = MOAP_BASE_URL + "/hud.html";
                hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                hudUrl += "&username=" + llEscapeURL(ownerUsername);
                hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                hudUrl += "&channel=" + (string)hudChannel;
                hudUrl += "&t=" + (string)llGetUnixTime();
                setMOAPUrl(hudUrl);
            }
        }
    }
}

