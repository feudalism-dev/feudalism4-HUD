// ============================================================================
// Feudalism 4 - Gameplay HUD Main Controller
// ============================================================================
// Manages linked prims for different gameplay UI components
// User positions linked prims manually, script controls visibility and MOAP
// ============================================================================

string MOAP_BASE_URL = "https://feudalism4-rpg.web.app";

// Link numbers for different components (set these based on your linkset)
// Link 0 is the root prim, child prims start at 1
// IMPORTANT: Adjust these to match your actual linkset!
// From your logs: Meters is link 3, so adjust accordingly
integer LINK_METERS = 3;      // Resource meters (Health, Stamina, Mana) - YOURS IS LINK 3
integer LINK_ACTIONS = 2;     // Action bar
integer LINK_STATUS = 1;       // Status bar

// Alternative: Use prim names to identify components
// Set prim names to "Meters", "Actions", "Status" and the script will find them automatically
integer USE_PRIM_NAMES = TRUE;  // Set to TRUE to use prim names instead of link numbers

integer CONTROL_CHANNEL = -77769;
integer listenHandle;

key ownerKey;
string ownerUUID;

// Component configuration
list componentConfigs = [];
integer isConfigured = FALSE;

configureLinkedPrims() {
        integer numLinks = llGetNumberOfPrims();
        
        if (USE_PRIM_NAMES) {
            // Find prims by name
            integer i;
            for (i = 1; i <= numLinks; i++) {
                string primName = llGetLinkName(i);
                string component = "";
                string url = "";
                
                // Debug: show what we're checking
                llOwnerSay("[Gameplay HUD] Checking link " + (string)i + " with name: '" + primName + "'");
                
                // Case-insensitive matching
                string lowerName = llToLower(primName);
                
                if (llSubStringIndex(lowerName, "meter") != -1) {
                    component = "meters";
                    url = MOAP_BASE_URL + "/gameplay-hud.html?component=meters&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
                }
                else if (llSubStringIndex(lowerName, "action") != -1) {
                    component = "actions";
                    url = MOAP_BASE_URL + "/gameplay-hud.html?component=actions&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
                }
                else if (llSubStringIndex(lowerName, "status") != -1) {
                    component = "status";
                    url = MOAP_BASE_URL + "/gameplay-hud.html?component=status&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
                }
                
                if (component != "") {
                    llOwnerSay("[Gameplay HUD] Configuring " + component + " prim (link " + (string)i + ", name: '" + primName + "')");
                    llMessageLinked(i, 0, "MOAP|" + url, NULL_KEY);
                }
            }
        } else {
            // Use fixed link numbers
            if (numLinks > LINK_METERS) {
                string metersUrl = MOAP_BASE_URL + "/gameplay-hud.html?component=meters&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
                llOwnerSay("[Gameplay HUD] Configuring meters prim (link " + (string)LINK_METERS + ")");
                llMessageLinked(LINK_METERS, 0, "MOAP|" + metersUrl, NULL_KEY);
            }
            
            if (numLinks > LINK_ACTIONS) {
                string actionsUrl = MOAP_BASE_URL + "/gameplay-hud.html?component=actions&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
                llOwnerSay("[Gameplay HUD] Configuring actions prim (link " + (string)LINK_ACTIONS + ")");
                llMessageLinked(LINK_ACTIONS, 0, "MOAP|" + actionsUrl, NULL_KEY);
            }
            
            if (numLinks > LINK_STATUS) {
                string statusUrl = MOAP_BASE_URL + "/gameplay-hud.html?component=status&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
                llOwnerSay("[Gameplay HUD] Configuring status prim (link " + (string)LINK_STATUS + ")");
                llMessageLinked(LINK_STATUS, 0, "MOAP|" + statusUrl, NULL_KEY);
            }
        }
    }

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        
        // Generate unique channel based on owner UUID
        CONTROL_CHANNEL = -1 - (integer)("0x" + llGetSubString(ownerUUID, 0, 6));
        listenHandle = llListen(CONTROL_CHANNEL, "", NULL_KEY, "");
        
        llOwnerSay("[Gameplay HUD] Initialized");
        llOwnerSay("[Gameplay HUD] Link count: " + (string)llGetNumberOfPrims());
        
        // Only configure if we're attached (not just rezzed)
        if (llGetAttached() != 0) {
            llSleep(1.0); // Wait a moment for linkset to stabilize
            configureLinkedPrims();
            isConfigured = TRUE;
        }
    }
    
    link_message(integer sender_num, integer num, string str, key id) {
        // Handle messages from linked prims
        if (str == "READY") {
            llOwnerSay("[Gameplay HUD] Link " + (string)sender_num + " is ready");
        }
    }
    
    touch_start(integer num) {
        if (llDetectedKey(0) == ownerKey) {
            // Refresh MOAP URLs (useful for testing)
            llOwnerSay("[Gameplay HUD] Refreshing component URLs...");
            configureLinkedPrims();
        }
    }
    
    attach(key id) {
        if (id == NULL_KEY) {
            // Detaching
            isConfigured = FALSE;
        } else {
            // Attached - configure prims after a delay to ensure linkset is stable
            isConfigured = FALSE;
            llSleep(2.0); // Wait for linkset to fully stabilize
            configureLinkedPrims();
            isConfigured = TRUE;
        }
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & CHANGED_LINK) {
            // Linkset changed, reconfigure only if not already configured
            if (!isConfigured) {
                llSleep(0.5);
                configureLinkedPrims();
                isConfigured = TRUE;
            }
        }
    }
}

