// ============================================================================
// Feudalism 4 - POC Helper Prim (Proof of Concept)
// ============================================================================
// Simple script for helper prim that receives configuration from main controller
// ============================================================================

integer CONTROL_CHANNEL = -77769;
integer listenHandle;

integer attachPoint = 0;
vector primSize = <0.5, 0.05, 0.01>;
string moapUrl = "";
integer isConfigured = FALSE;
integer hasAttachPermission = FALSE;
integer waitingForPermission = FALSE;

setMOAPUrl(string url) {
    // Calculate MOAP dimensions based on prim size
    // Use a standard pixel density: ~1280 pixels per meter
    integer pixelsPerMeter = 1280;
    integer width = (integer)(primSize.x * pixelsPerMeter);
    integer height = (integer)(primSize.y * pixelsPerMeter);
    
    // Ensure minimum dimensions
    if (width < 256) width = 256;
    if (height < 64) height = 64;
    
    // Round to nearest 16 for better rendering
    width = (width / 16) * 16;
    height = (height / 16) * 16;
    
    llSetPrimMediaParams(4, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,  // This ensures MOAP loads automatically without clicking
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, width,
        PRIM_MEDIA_HEIGHT_PIXELS, height,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER
    ]);
    
    llOwnerSay("[POC Helper] MOAP URL set: " + url);
    llOwnerSay("[POC Helper] Prim size: " + (string)primSize);
    llOwnerSay("[POC Helper] MOAP dimensions: " + (string)width + "x" + (string)height);
    llOwnerSay("[POC Helper] AUTO_PLAY: TRUE (should load automatically)");
}

doAttach() {
    if (!hasAttachPermission) {
        llOwnerSay("[POC Helper] ERROR: No attach permission. Cannot attach.");
        return;
    }
    
    llOwnerSay("[POC Helper] Attaching to point: " + (string)attachPoint);
    
    // Try llAttachToAvatar first (for rezzed objects)
    llAttachToAvatar(attachPoint);
    
    // Check if attachment succeeded after a short delay
    llSleep(0.5);
    if (llGetAttached() == 0) {
        // llAttachToAvatar failed, try llAttachToAvatarTemp (requires Experience or already attached)
        llOwnerSay("[POC Helper] llAttachToAvatar failed, trying llAttachToAvatarTemp...");
        llAttachToAvatarTemp(attachPoint);
        llSleep(0.5);
        if (llGetAttached() == 0) {
            llOwnerSay("[POC Helper] ERROR: Both attach methods failed. Make sure you have attachment slots available.");
        }
    }
}

default {
    state_entry() {
        listenHandle = llListen(CONTROL_CHANNEL, "", NULL_KEY, "");
        llSetAlpha(0.0, ALL_SIDES); // Invisible until configured
        llOwnerSay("[POC Helper] Waiting for configuration...");
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel != CONTROL_CHANNEL) return;
        
        list parts = llParseString2List(message, ["|"], []);
        string cmd = llList2String(parts, 0);
        
        if (cmd == "ATTACH") {
            attachPoint = (integer)llList2String(parts, 1);
            llOwnerSay("[POC Helper] Requesting attach permission for point: " + (string)attachPoint);
            
            // Request attach permission from owner
            if (!hasAttachPermission && !waitingForPermission) {
                waitingForPermission = TRUE;
                llRequestPermissions(llGetOwner(), PERMISSION_ATTACH);
                llOwnerSay("[POC Helper] Please accept the attachment permission request.");
            }
            else if (hasAttachPermission) {
                // Already have permission, attach immediately
                doAttach();
            }
        }
        else if (cmd == "SIZE") {
            float x = (float)llList2String(parts, 1);
            float y = (float)llList2String(parts, 2);
            float z = (float)llList2String(parts, 3);
            primSize = <x, y, z>;
            llSetScale(primSize);
            llOwnerSay("[POC Helper] Size set: " + (string)primSize);
        }
        else if (cmd == "POS") {
            float x = (float)llList2String(parts, 1);
            float y = (float)llList2String(parts, 2);
            float z = (float)llList2String(parts, 3);
            vector position = <x, y, z>;
            llSetPos(position);
            llOwnerSay("[POC Helper] Position set: " + (string)position);
        }
        else if (cmd == "MOAP") {
            moapUrl = llList2String(parts, 1);
            setMOAPUrl(moapUrl);
            
            // Make visible
            llSetAlpha(1.0, ALL_SIDES);
            
            // Notify main controller
            string component = llGetObjectName();
            llRegionSayTo(id, CONTROL_CHANNEL, "HELPER_READY|" + component);
            
            isConfigured = TRUE;
            llOwnerSay("[POC Helper] Configuration complete! Component: " + component);
        }
        else if (cmd == "DEREZ") {
            llOwnerSay("[POC Helper] Received DEREZ command, removing...");
            llDie();
        }
    }
    
    run_time_permissions(integer perm) {
        if (perm & PERMISSION_ATTACH) {
            hasAttachPermission = TRUE;
            waitingForPermission = FALSE;
            llOwnerSay("[POC Helper] Attach permission granted!");
            
            // If we already have an attach point configured, attach now
            if (attachPoint != 0) {
                doAttach();
            }
        } else {
            llOwnerSay("[POC Helper] ERROR: Attach permission denied. Cannot attach.");
            waitingForPermission = FALSE;
        }
    }
    
    attach(key id) {
        if (id == NULL_KEY) {
            llDie();
        } else if (isConfigured) {
            llSetAlpha(1.0, ALL_SIDES);
            llOwnerSay("[POC Helper] Successfully attached!");
            
            // Re-set MOAP after attachment to ensure AUTO_PLAY works
            if (moapUrl != "") {
                llSleep(0.5); // Wait a moment for attachment to stabilize
                setMOAPUrl(moapUrl);
                llOwnerSay("[POC Helper] MOAP re-initialized after attachment");
            }
        }
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llDie();
        }
    }
}

