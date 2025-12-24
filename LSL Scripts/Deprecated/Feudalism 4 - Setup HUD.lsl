// ============================================================================
// Feudalism 4 - Setup HUD (MOAP Thin Client)
// ============================================================================
// Version: 4.0.1
// Description: Single-prim MOAP HUD that displays Firebase-powered web UI
// No Experience permissions required - works anywhere on the grid
// ============================================================================

// =========================== CONFIGURATION ==================================
// Firebase Hosting URL for the MOAP interface
string MOAP_BASE_URL = "https://feudalism4-rpg.web.app";

// MOAP Face (which face of the prim displays the web content)
// Face 4 is the standard front face used for HUDs
integer MOAP_FACE = 4;

// MOAP dimensions (match your UI design)
integer MOAP_WIDTH = 1024;
integer MOAP_HEIGHT = 768;

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
key objectKey;

// Communication channels
integer hudChannel;
integer listenHandle;
integer FIREBASE_SYNC_CHANNEL = -88888;  // Channel for Players HUD sync requests
integer syncListenHandle;

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

// Clear MOAP display
clearMOAP() {
    llClearPrimMedia(MOAP_FACE);
}

// Send message to owner
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Announce message to local chat (for dice rolls, combat, etc.)
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
        objectKey = llGetKey();
        
        // Generate unique communication channel based on avatar UUID
        hudChannel = generateChannel(ownerKey);
        
        notify("Initializing HUD...");
        
        // Build MOAP URL with avatar parameters
        // The web app will use Firebase Anonymous Auth tied to this UUID
        string hudUrl = MOAP_BASE_URL + "/hud.html";
        hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
        hudUrl += "&username=" + llEscapeURL(ownerUsername);
        hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
        hudUrl += "&channel=" + (string)hudChannel;
        hudUrl += "&t=" + (string)llGetUnixTime(); // Cache buster
        
        setMOAPUrl(hudUrl);
        
        // Set up listener for MOAP callbacks
        listenHandle = llListen(hudChannel, "", NULL_KEY, "");
        
        // Set up listener for Players HUD sync requests
        syncListenHandle = llListen(FIREBASE_SYNC_CHANNEL, "", NULL_KEY, "");
        
        notify("Ready! Interface loaded.");
    }
    
    // Handle touch events
    touch_start(integer num) {
        key toucher = llDetectedKey(0);
        if (toucher != ownerKey) {
            llRegionSayTo(toucher, 0, "This HUD belongs to " + ownerDisplayName + ".");
            return;
        }
        
        // Get which part of the HUD was touched
        string linkName = llGetLinkName(llDetectedLinkNumber(0));
        
        // Handle special button touches (if HUD has physical buttons)
        if (linkName == "btn_refresh") {
            notify("Refreshing interface...");
            llResetScript();
        }
        else if (linkName == "btn_minimize") {
            clearMOAP();
            notify("HUD minimized. Touch to restore.");
            state minimized;
        }
    }
    
    // Listen for commands from MOAP or world objects
    // Commands use pipe-delimited format: COMMAND|param1|param2|...
    listen(integer channel, string name, key id, string message) {
        // Handle Players HUD sync requests (SYNC only - no LOAD requests)
        // Note: Players HUD works independently from local data and doesn't request LOAD
        if (channel == FIREBASE_SYNC_CHANNEL) {
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "SYNC") {
                // Players HUD sending data to sync to Firestore
                // Extract the data and send to MOAP for saving
                string syncData = llList2String(parts, 1);
                llRegionSay(hudChannel, "SYNC_REQUEST|SAVE|" + syncData);
                notify("Players HUD syncing data to Firestore...");
            }
            // Note: No LOAD handler - Players HUD doesn't request data, it works from local storage
            return;
        }
        
        // Handle responses from MOAP interface for sync
        if (channel == hudChannel) {
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "CHARACTER_DATA") {
                // MOAP interface sending character data - forward to Players HUD
                llRegionSay(FIREBASE_SYNC_CHANNEL, message);
                notify("Character data sent to Players HUD");
            }
            else if (cmd == "SYNC_REQUEST") {
                // MOAP interface requesting sync - this shouldn't happen, but handle it
                string action = llList2String(parts, 1);
                if (action == "LOAD") {
                    // Request character data from MOAP (but MOAP can't receive this)
                    // Instead, we'll rely on MOAP automatically broadcasting when loaded
                    notify("MOAP requested character data - waiting for broadcast...");
                }
            }
        }
        
        if (channel != hudChannel) return;
        
        list parts = llParseString2List(message, ["|"], []);
        string cmd = llList2String(parts, 0);
        
        // NOTIFY|message - Show notification to owner
        if (cmd == "NOTIFY") {
            string msg = llList2String(parts, 1);
            notify(msg);
        }
        // ANNOUNCE|message - Say in local chat
        else if (cmd == "ANNOUNCE") {
            string msg = llList2String(parts, 1);
            announce(msg);
        }
        // ROLL|stat|dice|target|result|success - Announce dice roll result
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
        // COMBAT|action|target|damage|effect - Announce combat action
        else if (cmd == "COMBAT") {
            string action = llList2String(parts, 1);
            string target = llList2String(parts, 2);
            string damage = llList2String(parts, 3);
            string effect = llList2String(parts, 4);
            
            string announcement = "⚔️ " + ownerDisplayName + " uses " + action;
            if (target != "") {
                announcement += " on " + target;
            }
            if (damage != "") {
                announcement += " dealing " + damage + " damage";
            }
            if (effect != "") {
                announcement += " [" + effect + "]";
            }
            announce(announcement);
        }
        // EMOTE|action - Say as emote
        else if (cmd == "EMOTE") {
            string action = llList2String(parts, 1);
            llSay(0, "/me " + action);
        }
        // REFRESH - Reload the MOAP interface
        else if (cmd == "REFRESH") {
            notify("Refreshing interface...");
            llResetScript();
        }
        // STATUS|message - Update HUD hover text (optional)
        else if (cmd == "STATUS") {
            string status = llList2String(parts, 1);
            llSetText(status, <1.0, 1.0, 1.0>, 0.8);
        }
        // CLEARSTATUS - Remove hover text
        else if (cmd == "CLEARSTATUS") {
            llSetText("", ZERO_VECTOR, 0.0);
        }
        // REQUEST|action|data - Request that needs LSL capabilities
        else if (cmd == "REQUEST") {
            string action = llList2String(parts, 1);
            
            if (action == "region_info") {
                // Send region info back to MOAP via channel
                string region = llGetRegionName();
                vector pos = llGetPos();
                llRegionSay(hudChannel, "REGION|" + region + "|" + (string)pos);
            }
            else if (action == "nearby_players") {
                // Scan for nearby avatars
                llSensor("", NULL_KEY, AGENT, 96.0, PI);
            }
        }
    }
    
    // Sensor callback for nearby player detection
    sensor(integer num) {
        list players = [];
        integer i;
        for (i = 0; i < num && i < 10; i++) { // Max 10 players
            key av = llDetectedKey(i);
            if (av != ownerKey) {
                players += [llDetectedName(i) + ":" + (string)av];
            }
        }
        string response = "PLAYERS|" + llDumpList2String(players, ",");
        llRegionSay(hudChannel, response);
    }
    
    no_sensor() {
        llRegionSay(hudChannel, "PLAYERS|");
    }
    
    // Handle script reset and ownership changes
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) {
            // Refresh after teleport
            notify("Region changed. Refreshing interface...");
            llResetScript();
        }
    }
    
    // Clean up on detach
    attach(key id) {
        if (id == NULL_KEY) {
            clearMOAP();
        }
    }
}

// =========================== MINIMIZED STATE ================================
state minimized {
    state_entry() {
        clearMOAP();
        llSetText("Feudalism 4\n[Touch to Open]", <0.8, 0.6, 0.2>, 0.8);
    }
    
    touch_start(integer num) {
        key toucher = llDetectedKey(0);
        if (toucher == ownerKey) {
            llSetText("", ZERO_VECTOR, 0.0);
            state default;
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

// =========================== NOTES ==========================================
/*
SETUP INSTRUCTIONS:

1. Create a single prim and shape it as desired for your HUD.

2. Add this script to the prim.

3. The MOAP face (MOAP_FACE) should be the face players will see.
   For a standard box, face 0 is typically the front face.
   Adjust MOAP_FACE if needed for your prim shape.

4. Attach the prim as a HUD (e.g., bottom right).

5. Optional: Add linked prims for physical buttons.
   Name them "btn_refresh", "btn_minimize", etc.

COMMUNICATION PROTOCOL:

The HUD communicates with the MOAP interface via region chat on a unique channel
generated from the owner's UUID. This allows the web interface to send commands
that need LSL execution (like chat announcements).

MOAP → LSL Commands (pipe-delimited):
  NOTIFY|message         - Show notification to owner only
  ANNOUNCE|message       - Say message in local chat
  ROLL|stat|dice|target|result|success - Announce dice roll
  COMBAT|action|target|damage|effect - Announce combat action
  EMOTE|action           - Perform emote
  REFRESH                - Reload interface
  STATUS|message         - Set hover text
  CLEARSTATUS            - Clear hover text
  REQUEST|action         - Request LSL data (region_info, nearby_players)

LSL → MOAP Responses:
  REGION|name|position   - Region information
  PLAYERS|name:uuid,...  - Nearby player list

ARCHITECTURE:

This HUD uses a "thin client" architecture:
- All game logic runs in Firebase/Firestore
- Web interface handles UI and data operations
- LSL script only provides:
  * Avatar identity (UUID, username, display name)
  * Second Life world integration (chat, emotes)
  * Nearby player detection
  * Region/position information

Authentication is handled by Firebase Anonymous Auth, tied to the avatar's UUID.
This means:
- No Experience system required
- Works anywhere on the grid
- Session persists across regions (tied to browser session)
- Multiple alts can play independently

*/
