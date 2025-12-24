// ============================================================================
// Feudalism 4 - Players HUD Firestore Bridge
// ============================================================================
// Hidden MOAP prim that handles Firestore communication for the Players HUD
// This allows the Players HUD to work independently without Setup HUD
// ============================================================================

// =========================== CONFIGURATION ==================================
// Firebase Hosting URL for the MOAP interface
string MOAP_BASE_URL = "https://feudalism4-rpg.web.app";

// MOAP Face (which face of the prim displays the web content)
integer MOAP_FACE = 4;

// MOAP dimensions (small, hidden prim)
integer MOAP_WIDTH = 256;
integer MOAP_HEIGHT = 256;

// Communication channel for Players HUD
integer PLAYERS_HUD_CHANNEL = -777700;  // Internal channel for Players HUD communication

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
integer hudChannel;
integer listenHandle;
key httpRequestId;
string callbackURL;

// =========================== UTILITY FUNCTIONS ==============================

// Generate a unique channel based on owner UUID for HUD communication
integer generateChannel(key id) {
    return -1 - (integer)("0x" + llGetSubString((string)id, 0, 6));
}

// Set MOAP URL on the HUD face
setMOAPUrl(string url) {
    llSetPrimMediaParams(MOAP_FACE, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, MOAP_WIDTH,
        PRIM_MEDIA_HEIGHT_PIXELS, MOAP_HEIGHT,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER
    ]);
}

// Make this prim invisible (for hidden Firestore bridge)
// IMPORTANT: Only hide the prim this script is in, never other prims
hidePrim() {
    // Get the link number of the prim containing this script
    integer thisLink = llGetLinkNumber();
    
    // Only hide if this is NOT the root prim (root = 0 or 1)
    // Root prims should never be hidden as they may contain important elements
    if (thisLink > 1) {
        // This is a child prim - safe to hide
        llSetLinkAlpha(thisLink, 0.0, ALL_SIDES);
        llSetLinkPrimitiveParamsFast(thisLink, [PRIM_SIZE, <0.01, 0.01, 0.01>]);
    } else {
        // This is the root prim - DO NOT HIDE IT
        // The Firestore Bridge script should be in a child prim, not the root
        llOwnerSay("[Firestore Bridge] WARNING: Script is in root prim! This script should be in a child prim named 'Firestore Bridge'");
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        // Generate unique communication channel based on avatar UUID
        hudChannel = generateChannel(ownerKey);
        
        // Hide this prim (it's just for Firestore communication)
        hidePrim();
        
        // Build MOAP URL with avatar parameters (callback URL will be added after request)
        // Use a minimal Firestore sync interface
        string hudUrl = MOAP_BASE_URL + "/players-hud-sync.html";
        hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
        hudUrl += "&username=" + llEscapeURL(ownerUsername);
        hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
        hudUrl += "&channel=" + (string)hudChannel;
        hudUrl += "&players_hud_channel=" + (string)PLAYERS_HUD_CHANNEL;
        
        // Store base URL, will add callback URL when available
        llLinksetDataWrite("moap_base_url", hudUrl);
        
        // Set up listener for MOAP callbacks
        listenHandle = llListen(hudChannel, "", NULL_KEY, "");
        
        // Set up listener for Players HUD requests
        llListen(PLAYERS_HUD_CHANNEL, "", NULL_KEY, "");
        
        // Request a callback URL for MOAP to POST data to
        llRequestURL();
        
        llOwnerSay("[Firestore Bridge] Initialized, requesting callback URL...");
    }
    
    // Listen for commands from Players HUD
    listen(integer channel, string name, key id, string message) {
        // Handle requests from Players HUD
        if (channel == PLAYERS_HUD_CHANNEL) {
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "LOAD") {
                // Players HUD requesting character data from Firestore
                // Update MOAP URL with request parameter
                string hudUrl = llLinksetDataRead("moap_base_url");
                if (hudUrl != "" && callbackURL != "") {
                    hudUrl += "&callback=" + llEscapeURL(callbackURL);
                    hudUrl += "&request=LOAD";
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                }
                llOwnerSay("[Firestore Bridge] Requesting character data from Firestore...");
            }
            else if (cmd == "SAVE") {
                // Players HUD sending data to save to Firestore
                // Format: SAVE|stats:...|health:...|etc
                string data = llList2String(parts, 1);
                // Update MOAP URL with save request
                string hudUrl = llLinksetDataRead("moap_base_url");
                if (hudUrl != "" && callbackURL != "") {
                    hudUrl += "&callback=" + llEscapeURL(callbackURL);
                    hudUrl += "&request=SAVE|" + llEscapeURL(data);
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                }
                llOwnerSay("[Firestore Bridge] Saving character data to Firestore...");
            }
        }
    }
    
    // Handle HTTP requests from MOAP interface
    http_request(key request_id, string method, string body) {
        if (method == URL_REQUEST_GRANTED) {
            // Callback URL granted
            callbackURL = body;
            llOwnerSay("[Firestore Bridge] Callback URL granted: " + callbackURL);
            
            // Update MOAP URL with callback
            string hudUrl = llLinksetDataRead("moap_base_url");
            if (hudUrl != "") {
                hudUrl += "&callback=" + llEscapeURL(callbackURL);
                hudUrl += "&t=" + (string)llGetUnixTime();
                setMOAPUrl(hudUrl);
            }
        }
        else if (method == "POST" && request_id == httpRequestId) {
            // Response from MOAP interface
            list parts = llParseString2List(body, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "CHARACTER_DATA") {
                // MOAP interface sending character data - forward to Data Manager
                string data = llList2String(parts, 1);
                llMessageLinked(LINK_SET, 0, "CHARACTER_DATA", data);
                llOwnerSay("[Firestore Bridge] Character data received from Firestore");
                
                // Send HTTP response
                llHTTPResponse(request_id, 200, "OK");
            }
            else if (cmd == "SAVE_CONFIRMED") {
                // MOAP interface confirming save
                llMessageLinked(LINK_SET, 0, "SAVE_CONFIRMED", "");
                llOwnerSay("[Firestore Bridge] Character data saved to Firestore");
                
                // Send HTTP response
                llHTTPResponse(request_id, 200, "OK");
            }
            else {
                llHTTPResponse(request_id, 400, "Unknown command");
            }
        }
        else if (method == URL_REQUEST_DENIED) {
            llOwnerSay("[Firestore Bridge] ERROR: Callback URL request denied");
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // HUD attached - ensure MOAP is set up
            llSleep(1.0);
            // Re-set MOAP URL to ensure it loads
            string hudUrl = MOAP_BASE_URL + "/players-hud-sync.html";
            hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
            hudUrl += "&username=" + llEscapeURL(ownerUsername);
            hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
            hudUrl += "&channel=" + (string)hudChannel;
            hudUrl += "&players_hud_channel=" + (string)PLAYERS_HUD_CHANNEL;
            hudUrl += "&t=" + (string)llGetUnixTime();
            setMOAPUrl(hudUrl);
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

