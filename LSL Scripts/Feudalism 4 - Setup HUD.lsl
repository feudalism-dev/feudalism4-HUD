// ============================================================================
// Feudalism 4 - Setup HUD (MOAP Thin Client)
// ============================================================================
// Version: 4.0.0
// Description: Single-prim MOAP HUD that communicates with Firebase/GAS backend
// No Experience permissions required - works anywhere on the grid
// ============================================================================

// =========================== CONFIGURATION ==================================
// Replace this URL with your deployed Google Apps Script Web App URL
string GAS_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

// Replace with your Firebase Hosting URL for the MOAP interface
string MOAP_BASE_URL = "https://your-project.web.app";

// MOAP Face (which face of the prim displays the web content)
integer MOAP_FACE = 0;

// MOAP dimensions
integer MOAP_WIDTH = 1024;
integer MOAP_HEIGHT = 768;

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
key objectKey;

// Session management
string sessionToken = "";
integer isAuthenticated = FALSE;
string userRole = "player";
integer hasCharacter = FALSE;

// HTTP request tracking
key httpAuthRequest;
key httpDataRequest;
key httpActionRequest;

// Communication channels
integer hudChannel;
integer listenHandle;

// Retry logic
integer authRetries = 0;
integer MAX_AUTH_RETRIES = 3;

// =========================== UTILITY FUNCTIONS ==============================

// Generate a unique channel based on owner UUID for HUD communication
integer generateChannel(key id) {
    return -1 - (integer)("0x" + llGetSubString((string)id, 0, 6));
}

// Build JSON request payload
string buildRequest(string action, string data) {
    string payload = "{";
    payload += "\"action\":\"" + action + "\",";
    payload += "\"uuid\":\"" + ownerUUID + "\",";
    payload += "\"username\":\"" + ownerUsername + "\",";
    payload += "\"object_key\":\"" + (string)objectKey + "\"";
    
    if (sessionToken != "") {
        payload += ",\"token\":\"" + sessionToken + "\"";
    }
    
    if (data != "") {
        payload += ",\"data\":" + data;
    }
    
    payload += "}";
    return payload;
}

// Parse JSON value (simple parser for known response format)
string getJSONValue(string json, string key) {
    integer keyStart = llSubStringIndex(json, "\"" + key + "\"");
    if (keyStart == -1) return "";
    
    integer colonPos = llSubStringIndex(llGetSubString(json, keyStart, -1), ":");
    if (colonPos == -1) return "";
    
    string remainder = llGetSubString(json, keyStart + colonPos + 1, -1);
    remainder = llStringTrim(remainder, STRING_TRIM);
    
    // Check if value is a string (starts with ")
    if (llGetSubString(remainder, 0, 0) == "\"") {
        integer endQuote = llSubStringIndex(llGetSubString(remainder, 1, -1), "\"");
        return llGetSubString(remainder, 1, endQuote);
    }
    // Check for boolean/number (ends at comma, }, or end)
    else {
        integer endPos = llSubStringIndex(remainder, ",");
        integer endPos2 = llSubStringIndex(remainder, "}");
        if (endPos == -1 || (endPos2 != -1 && endPos2 < endPos)) {
            endPos = endPos2;
        }
        if (endPos == -1) endPos = llStringLength(remainder);
        return llStringTrim(llGetSubString(remainder, 0, endPos - 1), STRING_TRIM);
    }
}

// Set MOAP URL on the HUD face
setMOAPUrl(string url) {
    llSetPrimMediaParams(MOAP_FACE, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, MOAP_WIDTH,
        PRIM_MEDIA_HEIGHT_PIXELS, MOAP_HEIGHT,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER
    ]);
}

// Clear MOAP display
clearMOAP() {
    llClearPrimMedia(MOAP_FACE);
}

// Send message to owner
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Send HTTP request to GAS backend
key sendRequest(string action, string data) {
    string payload = buildRequest(action, data);
    
    return llHTTPRequest(GAS_URL, [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384,
        HTTP_VERIFY_CERT, TRUE
    ], payload);
}

// =========================== INITIALIZATION =================================
default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        objectKey = llGetKey();
        
        // Generate unique communication channel
        hudChannel = generateChannel(ownerKey);
        
        // Reset session state
        sessionToken = "";
        isAuthenticated = FALSE;
        userRole = "player";
        hasCharacter = FALSE;
        authRetries = 0;
        
        notify("Initializing... Please wait.");
        
        // Show loading screen via MOAP
        string loadingUrl = MOAP_BASE_URL + "/loading.html";
        setMOAPUrl(loadingUrl);
        
        // Attempt authentication
        state authenticating;
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

// =========================== AUTHENTICATION STATE ===========================
state authenticating {
    state_entry() {
        notify("Connecting to server...");
        
        // Send authentication request
        httpAuthRequest = sendRequest("auth.login", "");
        
        // Set timeout for auth response
        llSetTimerEvent(30.0);
    }
    
    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id == httpAuthRequest) {
            llSetTimerEvent(0.0); // Cancel timeout
            
            if (status == 200) {
                // Parse response
                string success = getJSONValue(body, "success");
                
                if (success == "true") {
                    // Extract session data
                    sessionToken = getJSONValue(body, "token");
                    userRole = getJSONValue(body, "role");
                    string hasChar = getJSONValue(body, "has_character");
                    hasCharacter = (hasChar == "true");
                    
                    isAuthenticated = TRUE;
                    authRetries = 0;
                    
                    notify("Connected! Role: " + userRole);
                    
                    state idle;
                }
                else {
                    string error = getJSONValue(body, "error");
                    notify("Authentication failed: " + error);
                    handleAuthFailure();
                }
            }
            else {
                notify("Server error (HTTP " + (string)status + "). Retrying...");
                handleAuthFailure();
            }
        }
    }
    
    timer() {
        llSetTimerEvent(0.0);
        notify("Connection timeout. Retrying...");
        handleAuthFailure();
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) {
            // Re-authenticate after teleport
            llResetScript();
        }
    }
    
    attach(key id) {
        if (id == NULL_KEY) {
            // Detaching - invalidate session
            if (sessionToken != "") {
                sendRequest("auth.logout", "");
            }
        }
    }
}

// Handle authentication failure with retry logic
handleAuthFailure() {
    authRetries++;
    if (authRetries < MAX_AUTH_RETRIES) {
        notify("Retry attempt " + (string)authRetries + "/" + (string)MAX_AUTH_RETRIES);
        llSleep(2.0);
        httpAuthRequest = sendRequest("auth.login", "");
        llSetTimerEvent(30.0);
    }
    else {
        notify("Unable to connect to server. Please try again later.");
        notify("Make sure you have configured the GAS_URL correctly.");
        // Show error page
        setMOAPUrl(MOAP_BASE_URL + "/error.html?msg=connection_failed");
        state offline;
    }
}

// =========================== OFFLINE STATE ==================================
state offline {
    state_entry() {
        notify("Operating in offline mode. Touch HUD to retry connection.");
    }
    
    touch_start(integer num) {
        if (llDetectedKey(0) == ownerKey) {
            notify("Attempting to reconnect...");
            llResetScript();
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

// =========================== IDLE STATE (MAIN) ==============================
state idle {
    state_entry() {
        // Build MOAP URL with session parameters
        string hudUrl = MOAP_BASE_URL + "/hud.html";
        hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
        hudUrl += "&token=" + llEscapeURL(sessionToken);
        hudUrl += "&role=" + llEscapeURL(userRole);
        hudUrl += "&has_char=" + (string)hasCharacter;
        hudUrl += "&channel=" + (string)hudChannel;
        
        setMOAPUrl(hudUrl);
        
        // Set up listener for MOAP callbacks
        listenHandle = llListen(hudChannel, "", NULL_KEY, "");
        
        notify("Ready! Click the HUD to interact.");
        
        // Heartbeat timer to keep session alive
        llSetTimerEvent(300.0); // 5 minute heartbeat
    }
    
    state_exit() {
        llListenRemove(listenHandle);
        llSetTimerEvent(0.0);
    }
    
    touch_start(integer num) {
        key toucher = llDetectedKey(0);
        if (toucher != ownerKey) {
            llRegionSayTo(toucher, 0, "This HUD belongs to " + llGetDisplayName(ownerKey) + ".");
            return;
        }
        
        // Get which part of the HUD was touched
        string linkName = llGetLinkName(llDetectedLinkNumber(0));
        
        // Handle special button touches (if HUD has physical buttons)
        if (linkName == "btn_refresh") {
            notify("Refreshing...");
            state idle; // Re-enter to refresh MOAP
        }
        else if (linkName == "btn_logout") {
            notify("Logging out...");
            sendRequest("auth.logout", "");
            sessionToken = "";
            isAuthenticated = FALSE;
            clearMOAP();
            notify("Logged out. Touch to reconnect.");
            state offline;
        }
    }
    
    // Listen for commands from MOAP via llDialog or external scripts
    listen(integer channel, string name, key id, string message) {
        if (channel == hudChannel) {
            // Parse command from MOAP or world objects
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "REFRESH") {
                state idle; // Re-enter to refresh
            }
            else if (cmd == "LOGOUT") {
                sendRequest("auth.logout", "");
                sessionToken = "";
                llResetScript();
            }
            else if (cmd == "NOTIFY") {
                // MOAP requested a notification
                string msg = llList2String(parts, 1);
                notify(msg);
            }
            else if (cmd == "ROLL") {
                // Request a dice roll from server
                string stat = llList2String(parts, 1);
                string difficulty = llList2String(parts, 2);
                httpActionRequest = sendRequest("roll.test", 
                    "{\"stat\":\"" + stat + "\",\"difficulty\":" + difficulty + "}");
            }
            else if (cmd == "SAVE") {
                // Character save request
                string charData = llList2String(parts, 1);
                httpActionRequest = sendRequest("character.update", charData);
            }
        }
    }
    
    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id == httpActionRequest) {
            if (status == 200) {
                string success = getJSONValue(body, "success");
                string action = getJSONValue(body, "action");
                
                if (success == "true") {
                    // Handle successful responses
                    if (action == "roll.test") {
                        // Extract roll results
                        string result = getJSONValue(body, "final_result");
                        string rollSuccess = getJSONValue(body, "success");
                        string margin = getJSONValue(body, "margin");
                        
                        // Announce roll result
                        string announcement = llGetDisplayName(ownerKey) + " rolled: " + result;
                        if (rollSuccess == "true") {
                            announcement += " (SUCCESS by " + margin + ")";
                        } else {
                            announcement += " (FAILURE by " + margin + ")";
                        }
                        llSay(0, announcement);
                    }
                    else if (action == "character.update") {
                        notify("Character saved successfully!");
                    }
                }
                else {
                    string error = getJSONValue(body, "error");
                    notify("Error: " + error);
                }
            }
            else {
                notify("Server communication error. Please try again.");
            }
        }
    }
    
    // Session heartbeat
    timer() {
        // Send heartbeat to keep session alive
        httpDataRequest = sendRequest("auth.heartbeat", "");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) {
            // Session persists across teleports since it's server-side
            // Just refresh the MOAP
            notify("Region changed. Refreshing interface...");
            state idle; // Re-enter to refresh
        }
    }
    
    attach(key id) {
        if (id == NULL_KEY) {
            // Detaching - notify server
            if (sessionToken != "") {
                sendRequest("auth.logout", "");
            }
            clearMOAP();
        }
        else {
            // Re-attaching - refresh
            state idle;
        }
    }
}

// =========================== ADMIN STATE ====================================
// This state could be used for admin-specific functionality
// For now, admin features are handled in the MOAP interface
// based on the userRole variable passed in the URL

// =========================== NOTES ==========================================
/*
SETUP INSTRUCTIONS:

1. Deploy your Google Apps Script as a Web App and copy the URL to GAS_URL above.

2. Host your MOAP interface files on Firebase Hosting and update MOAP_BASE_URL.

3. Create a single prim HUD and add this script to it.

4. The MOAP face (MOAP_FACE) should be the face players will see.
   For a standard box, face 0 is typically the front face.

5. Optional: Add additional prims linked to the HUD for physical buttons.
   Name them "btn_refresh", "btn_logout", etc. to trigger actions.

COMMUNICATION FLOW:

LSL → GAS:  HTTP POST requests with JSON payload
GAS → LSL:  HTTP response with JSON payload
MOAP → LSL: Chat messages on hudChannel (via world object or external)
MOAP → GAS: Direct fetch() calls from JavaScript
LSL → MOAP: URL parameters when setting MOAP URL

SECURITY NOTES:

- The session token is passed to MOAP via URL parameters
- MOAP should use HTTPS for all GAS communications
- Token expiration is handled server-side
- Never store sensitive data in LSL (no Experience KVP dependency)

*/

