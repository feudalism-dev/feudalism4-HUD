// ============================================================================
// Feudalism 4 - Helper Prim Script
// ============================================================================
// Version: 4.0.1
// Description: Minimal script for helper prim HUDs that receive configuration
//              from the main controller and display MOAP content
// ============================================================================

// =========================== CONFIGURATION ==================================
integer CONTROL_CHANNEL = -77769; // Communication with main controller
integer listenHandle;

// State
integer isConfigured = FALSE;
integer attachPoint = 0;
vector primSize = <0.5, 0.05, 0.01>;
string moapUrl = "";

// =========================== UTILITY FUNCTIONS ==============================

// Set MOAP URL on the prim face
setMOAPUrl(string url) {
    // Determine MOAP dimensions based on prim size
    integer width = 512;
    integer height = 64;
    
    // Adjust based on prim dimensions (horizontal vs vertical)
    if (primSize.x > primSize.y) {
        // Horizontal layout
        width = 512;
        height = (integer)(primSize.y / primSize.x * 512);
    } else {
        // Vertical layout
        width = (integer)(primSize.x / primSize.y * 512);
        height = 512;
    }
    
    llSetPrimMediaParams(4, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, width,
        PRIM_MEDIA_HEIGHT_PIXELS, height,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER
    ]);
}

// =========================== MAIN STATE =====================================
default {
    state_entry() {
        // Listen for configuration commands from main controller
        listenHandle = llListen(CONTROL_CHANNEL, "", NULL_KEY, "");
        
        // Make prim transparent initially (will be visible when configured)
        llSetAlpha(0.0, ALL_SIDES);
    }
    
    // Listen for configuration commands
    listen(integer channel, string name, key id, string message) {
        if (channel != CONTROL_CHANNEL) return;
        
        list parts = llParseString2List(message, ["|"], []);
        string cmd = llList2String(parts, 0);
        
        if (cmd == "ATTACH") {
            attachPoint = (integer)llList2String(parts, 1);
            llAttachToAvatarTemp(attachPoint);
        }
        else if (cmd == "SIZE") {
            float x = (float)llList2String(parts, 1);
            float y = (float)llList2String(parts, 2);
            float z = (float)llList2String(parts, 3);
            primSize = <x, y, z>;
            llSetScale(primSize);
        }
        else if (cmd == "MOAP") {
            moapUrl = llList2String(parts, 1);
            setMOAPUrl(moapUrl);
            
            // Make prim visible
            llSetAlpha(1.0, ALL_SIDES);
            
            // Notify main controller that we're ready
            string component = llGetObjectName();
            llRegionSayTo(id, CONTROL_CHANNEL, "HELPER_READY|" + component);
            
            isConfigured = TRUE;
        }
        else if (cmd == "DEREZ") {
            llDie();
        }
    }
    
    // Handle attachment
    attach(key id) {
        if (id == NULL_KEY) {
            // Detached - die
            llDie();
        } else if (isConfigured) {
            // Re-attached and configured - make visible
            llSetAlpha(1.0, ALL_SIDES);
        }
    }
    
    // Handle errors
    on_rez(integer start_param) {
        // Reset on rez
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llDie(); // Die if ownership changes
        }
    }
}

// =========================== NOTES ==========================================
/*
USAGE:

This script is added to helper prim objects that are stored in the
Main Controller's inventory.

Each helper prim should be:
- Named exactly as expected by Main Controller:
  * "Resource Meters Helper"
  * "Action Bar Helper"
  * "Status Bar Helper"
- Set to "Copy" permissions
- Placed in Main Controller's inventory (Objects folder)

The Main Controller will:
1. Rez the helper prim
2. Send ATTACH command with attach point
3. Send SIZE command with dimensions
4. Send MOAP command with URL
5. Helper prim configures itself and becomes visible

When Main Controller sends DEREZ command, helper prim removes itself.

*/

