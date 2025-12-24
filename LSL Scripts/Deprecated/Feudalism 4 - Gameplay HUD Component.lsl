// ============================================================================
// Feudalism 4 - Gameplay HUD Component Prim
// ============================================================================
// Script for linked child prims that display MOAP components
// Place this script in each linked prim that should display a component
// ============================================================================

integer MOAP_FACE = 4;  // Standard HUD face
string moapUrl = "";
integer isConfigured = FALSE;

setMOAPUrl(string url, integer silent) {
    if (!silent) {
        moapUrl = url;
    }
    
    // Get prim size to calculate MOAP dimensions
    vector primSize = llGetScale();
    integer pixelsPerMeter = 1280;
    integer width = (integer)(primSize.x * pixelsPerMeter);
    integer height = (integer)(primSize.y * pixelsPerMeter);
    
    // Ensure minimum dimensions
    if (width < 256) width = 256;
    if (height < 64) height = 64;
    
    // Round to nearest 16 for better rendering
    width = (width / 16) * 16;
    height = (height / 16) * 16;
    
    // Set MOAP with AUTO_PLAY enabled - this is critical for auto-loading
    llSetPrimMediaParams(MOAP_FACE, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,  // Critical for auto-loading
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_AUTO_ZOOM, TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, width,
        PRIM_MEDIA_HEIGHT_PIXELS, height,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_OWNER
    ]);
    
    if (!silent) {
        llOwnerSay("[Component] MOAP URL set: " + url);
        llOwnerSay("[Component] Prim size: " + (string)primSize);
        llOwnerSay("[Component] MOAP dimensions: " + (string)width + "x" + (string)height);
    }
}

default {
    state_entry() {
        // Make prim visible
        llSetAlpha(1.0, ALL_SIDES);
        string primName = llGetObjectName();
        llOwnerSay("[Component] " + primName + " ready, waiting for MOAP configuration...");
        llOwnerSay("[Component] " + primName + " is attached: " + (string)(llGetAttached() != 0));
        llOwnerSay("[Component] " + primName + " link number: " + (string)llGetLinkNumber());
        
        // Notify root prim we're ready
        llMessageLinked(LINK_ROOT, 0, "READY|" + primName, NULL_KEY);
    }
    
    link_message(integer sender_num, integer num, string str, key id) {
        // Receive configuration from root prim
        if (sender_num == LINK_ROOT) {
            list parts = llParseString2List(str, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "MOAP") {
                string url = llList2String(parts, 1);
                moapUrl = url;
                string primName = llGetObjectName();
                
                llOwnerSay("[Component] " + primName + " received MOAP command");
                llOwnerSay("[Component] " + primName + " URL: " + url);
                
                // Set MOAP immediately if we're already attached
                if (llGetAttached() != 0) {
                    llOwnerSay("[Component] " + primName + " is attached, setting MOAP now...");
                    setMOAPUrl(url, FALSE);
                    // Re-set after a delay to ensure AUTO_PLAY works
                    llSleep(1.5);
                    setMOAPUrl(url, TRUE);  // Silent re-set
                    llOwnerSay("[Component] " + primName + " MOAP configuration complete");
                } else {
                    // Not attached yet - will be set in attach() event
                    llOwnerSay("[Component] " + primName + " not attached yet, will set in attach() event");
                    isConfigured = TRUE;
                }
            }
            else if (cmd == "SHOW") {
                llSetAlpha(1.0, ALL_SIDES);
            }
            else if (cmd == "HIDE") {
                llSetAlpha(0.0, ALL_SIDES);
            }
        }
    }
    
    attach(key id) {
        string primName = llGetObjectName();
        if (id == NULL_KEY) {
            // Detaching
            llOwnerSay("[Component] " + primName + " detaching");
            isConfigured = FALSE;
            moapUrl = "";
        } else {
            // Attached - wait for linkset to stabilize, then set MOAP
            // This is critical - MOAP must be set AFTER attachment for AUTO_PLAY to work
            llOwnerSay("[Component] " + primName + " attached, waiting to set MOAP...");
            llSleep(2.0);  // Give time for attachment to fully complete
            
            if (moapUrl != "") {
                llOwnerSay("[Component] " + primName + " setting MOAP in attach() event");
                // Set MOAP with full logging
                setMOAPUrl(moapUrl, FALSE);
                // Re-set once more after a delay to ensure AUTO_PLAY works
                llSleep(1.0);
                setMOAPUrl(moapUrl, TRUE);  // Silent re-set
                llOwnerSay("[Component] " + primName + " MOAP set in attach() complete");
            } else {
                // URL not set yet - wait a bit more and check again
                llOwnerSay("[Component] " + primName + " URL not set yet, waiting...");
                llSleep(1.0);
                if (moapUrl != "") {
                    llOwnerSay("[Component] " + primName + " URL now available, setting MOAP");
                    setMOAPUrl(moapUrl, FALSE);
                    llSleep(1.0);
                    setMOAPUrl(moapUrl, TRUE);
                } else {
                    llOwnerSay("[Component] " + primName + " WARNING: URL still not set after attach!");
                }
            }
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

