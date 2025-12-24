// ============================================================================
// Feudalism 4 - Main Controller HUD
// ============================================================================
// Version: 4.0.1
// Description: Main HUD controller that dynamically rezzes and manages
//              helper prim HUDs for resource meters, action bar, etc.
// ============================================================================

// =========================== CONFIGURATION ==================================
string MOAP_BASE_URL = "https://feudalism4-rpg.web.app";

// Helper prim object names (must match objects in inventory)
string HELPER_RESOURCE_METERS = "Resource Meters Helper";
string HELPER_ACTION_BAR = "Action Bar Helper";
string HELPER_STATUS_BAR = "Status Bar Helper"; // Optional

// Communication channels
integer CONTROL_CHANNEL = -77769; // Main controller → Helper prims
integer PLAYERHUDCHANNEL = -77770; // Gameplay communication (same as F3)
integer listenHandle;

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;

// Helper prim tracking
list activeHelpers = []; // [key, component_name, key, component_name, ...]

// User preferences (loaded from Firestore or defaults)
integer metersVisible = TRUE;
integer actionBarVisible = TRUE;
integer statusBarVisible = FALSE;

integer metersAttachPoint = ATTACH_HUD_TOP_LEFT;
integer actionBarAttachPoint = ATTACH_HUD_BOTTOM_LEFT;
integer statusBarAttachPoint = ATTACH_HUD_TOP_RIGHT;

// =========================== UTILITY FUNCTIONS ==============================

// Generate unique channel based on owner UUID
integer generateChannel(key id) {
    return -1 - (integer)("0x" + llGetSubString((string)id, 0, 6));
}

// Send message to owner
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// =========================== HELPER PRIM MANAGEMENT ========================

// Rez and configure resource meters helper
rezResourceMeters() {
    if (!metersVisible) return;
    
    vector rezPos = llGetPos() + <0, 0, 2>; // Above main HUD
    rotation rezRot = llGetRot();
    
    notify("Rezzing resource meters...");
    llRezObject(HELPER_RESOURCE_METERS, rezPos, ZERO_VECTOR, rezRot, 0);
}

// Rez and configure action bar helper
rezActionBar() {
    if (!actionBarVisible) return;
    
    vector rezPos = llGetPos() + <0, 0, 2>; // Above main HUD
    rotation rezRot = llGetRot();
    
    notify("Rezzing action bar...");
    llRezObject(HELPER_ACTION_BAR, rezPos, ZERO_VECTOR, rezRot, 0);
}

// Rez and configure status bar helper (optional)
rezStatusBar() {
    if (!statusBarVisible) return;
    
    vector rezPos = llGetPos() + <0, 0, 2>;
    rotation rezRot = llGetRot();
    
    notify("Rezzing status bar...");
    llRezObject(HELPER_STATUS_BAR, rezPos, ZERO_VECTOR, rezRot, 0);
}

// Configure a helper prim after it's rezzed
configureHelper(key helperKey, string component) {
    // Wait a moment for prim to initialize
    llSleep(0.5);
    
    if (component == "meters") {
        // Set attach point
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "ATTACH|" + (string)metersAttachPoint);
        
        // Set size (horizontal bar)
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "SIZE|0.5|0.05|0.01");
        
        // Set MOAP URL
        string moapUrl = MOAP_BASE_URL + "/gameplay-hud.html";
        moapUrl += "?component=meters";
        moapUrl += "&uuid=" + llEscapeURL(ownerUUID);
        moapUrl += "&username=" + llEscapeURL(ownerUsername);
        moapUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
        moapUrl += "&channel=" + (string)PLAYERHUDCHANNEL;
        moapUrl += "&attach=" + (string)metersAttachPoint;
        moapUrl += "&t=" + (string)llGetUnixTime();
        
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "MOAP|" + moapUrl);
        
        // Track helper
        activeHelpers += [helperKey, "meters"];
        
        notify("Resource meters configured");
    }
    else if (component == "actions") {
        // Set attach point
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "ATTACH|" + (string)actionBarAttachPoint);
        
        // Set size (horizontal bar)
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "SIZE|0.5|0.1|0.01");
        
        // Set MOAP URL
        string moapUrl = MOAP_BASE_URL + "/gameplay-hud.html";
        moapUrl += "?component=actions";
        moapUrl += "&uuid=" + llEscapeURL(ownerUUID);
        moapUrl += "&username=" + llEscapeURL(ownerUsername);
        moapUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
        moapUrl += "&channel=" + (string)PLAYERHUDCHANNEL;
        moapUrl += "&attach=" + (string)actionBarAttachPoint;
        moapUrl += "&t=" + (string)llGetUnixTime();
        
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "MOAP|" + moapUrl);
        
        // Track helper
        activeHelpers += [helperKey, "actions"];
        
        notify("Action bar configured");
    }
    else if (component == "status") {
        // Set attach point
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "ATTACH|" + (string)statusBarAttachPoint);
        
        // Set size (small horizontal bar)
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "SIZE|0.3|0.03|0.01");
        
        // Set MOAP URL
        string moapUrl = MOAP_BASE_URL + "/gameplay-hud.html";
        moapUrl += "?component=status";
        moapUrl += "&uuid=" + llEscapeURL(ownerUUID);
        moapUrl += "&username=" + llEscapeURL(ownerUsername);
        moapUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
        moapUrl += "&channel=" + (string)PLAYERHUDCHANNEL;
        moapUrl += "&attach=" + (string)statusBarAttachPoint;
        moapUrl += "&t=" + (string)llGetUnixTime();
        
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "MOAP|" + moapUrl);
        
        // Track helper
        activeHelpers += [helperKey, "status"];
        
        notify("Status bar configured");
    }
}

// Remove a helper prim
removeHelper(string component) {
    integer i;
    for (i = 0; i < llGetListLength(activeHelpers); i += 2) {
        key helperKey = llList2Key(activeHelpers, i);
        string comp = llList2String(activeHelpers, i + 1);
        
        if (comp == component) {
            llRegionSayTo(helperKey, CONTROL_CHANNEL, "DEREZ");
            activeHelpers = llDeleteSubList(activeHelpers, i, i + 1);
            notify("Removed " + component);
            return;
        }
    }
}

// Remove all helpers
removeAllHelpers() {
    integer i;
    for (i = 0; i < llGetListLength(activeHelpers); i += 2) {
        key helperKey = llList2Key(activeHelpers, i);
        llRegionSayTo(helperKey, CONTROL_CHANNEL, "DEREZ");
    }
    activeHelpers = [];
}

// =========================== MAIN STATE =====================================
default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        // Generate communication channel
        PLAYERHUDCHANNEL = generateChannel(ownerKey);
        
        notify("Initializing HUD controller...");
        
        // Set up listener for helper communication
        listenHandle = llListen(CONTROL_CHANNEL, "", NULL_KEY, "");
        llListen(PLAYERHUDCHANNEL, "", NULL_KEY, "");
        
        // Rez visible helpers
        rezResourceMeters();
        rezActionBar();
        // rezStatusBar(); // Optional
        
        notify("HUD controller ready!");
    }
    
    // Handle helper prim rez
    object_rez(key id) {
        string name = llKey2Name(id);
        
        if (name == HELPER_RESOURCE_METERS) {
            llSleep(0.1); // Brief delay for prim to initialize
            configureHelper(id, "meters");
        }
        else if (name == HELPER_ACTION_BAR) {
            llSleep(0.1);
            configureHelper(id, "actions");
        }
        else if (name == HELPER_STATUS_BAR) {
            llSleep(0.1);
            configureHelper(id, "status");
        }
    }
    
    // Listen for commands
    listen(integer channel, string name, key id, string message) {
        if (channel == CONTROL_CHANNEL) {
            // Commands from helper prims
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "HELPER_READY") {
                string component = llList2String(parts, 1);
                notify(component + " helper ready");
            }
            else if (cmd == "HELPER_ERROR") {
                string component = llList2String(parts, 1);
                string error = llList2String(parts, 2);
                notify("Error in " + component + ": " + error);
            }
        }
        else if (channel == PLAYERHUDCHANNEL) {
            // Gameplay commands (relay to helpers or handle directly)
            // Commands like ANNOUNCE, COMBAT, etc. can be handled here
            // or passed to appropriate helper
        }
    }
    
    // Handle touch events
    touch_start(integer num) {
        key toucher = llDetectedKey(0);
        if (toucher != ownerKey) return;
        
        // Main controller can be touched to open settings
        // Or can be invisible and only manage helpers
        notify("Main Controller - Touch for settings (coming soon)");
    }
    
    // Handle attachment/detachment
    attach(key id) {
        if (id == NULL_KEY) {
            // Detaching - remove all helpers
            removeAllHelpers();
        }
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
            // Refresh helpers after teleport
            notify("Region changed. Refreshing helpers...");
            removeAllHelpers();
            llSleep(1.0);
            rezResourceMeters();
            rezActionBar();
        }
    }
}

// =========================== NOTES ==========================================
/*
SETUP INSTRUCTIONS:

1. Create the Main Controller prim:
   - Small prim (0.01m cube) or small icon
   - Add this script
   - Name: "Feudalism 4 - Main Controller"
   - Set to "Copy" permissions

2. Create Helper Prim objects (in inventory):
   - Create prims named exactly:
     * "Resource Meters Helper"
     * "Action Bar Helper"
     * "Status Bar Helper" (optional)
   - Add "Feudalism 4 - Helper Prim.lsl" script to each
   - Set to "Copy" permissions
   - Place in Main Controller's inventory (Objects folder)

3. Attach Main Controller:
   - Attach to HUD_BOTTOM_RIGHT (or preferred location)
   - Main controller will automatically rez helpers

4. Helper prims will:
   - Rez above main controller
   - Configure themselves
   - Attach to their designated attach points
   - Load MOAP content

USER PREFERENCES:

Preferences can be stored in Firestore and loaded on initialization.
For now, defaults are used (meters at top, action bar at bottom).

FUTURE ENHANCEMENTS:

- Settings menu to adjust helper positions
- Show/hide individual helpers
- Resize helpers dynamically
- Add more helper types (combat log, target info, etc.)

*/

