// ============================================================================
// Feudalism 4 - POC Main Controller (Proof of Concept)
// ============================================================================
// Simple prototype to test dynamic helper prim rezzing and configuration
// ============================================================================

string HELPER_PRIM_NAME = "Helper Prim"; // Name of helper prim in inventory
string MOAP_BASE_URL = "https://feudalism4-rpg.web.app";

integer CONTROL_CHANNEL = -77769;
integer listenHandle;

key ownerKey;
string ownerUUID;

// Track rezzed helpers
list activeHelpers = [];

// Attachment slot constants
integer MAX_ATTACHMENT_SLOTS = 38;
integer SLOTS_NEEDED = 3; // Number of helper prims we need to attach

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        
        llOwnerSay("[POC] Main Controller initialized");
        
        // Check available attachment slots
        list details = llGetObjectDetails(ownerKey, [OBJECT_ATTACHED_SLOTS_AVAILABLE]);
        integer slotsAvailable = llList2Integer(details, 0);
        
        llOwnerSay("[POC] Checking attachment slots...");
        llOwnerSay("[POC] Available slots: " + (string)slotsAvailable);
        llOwnerSay("[POC] Slots needed: " + (string)SLOTS_NEEDED);
        
        if (slotsAvailable < SLOTS_NEEDED) {
            integer slotsUsed = MAX_ATTACHMENT_SLOTS - slotsAvailable;
            llOwnerSay("[POC] ERROR: Not enough attachment slots available!");
            llOwnerSay("[POC] You are currently wearing " + (string)slotsUsed + " attachments.");
            llOwnerSay("[POC] You need at least " + (string)SLOTS_NEEDED + " free slots to use this HUD.");
            llOwnerSay("[POC] Please detach some attachments and try again.");
            
            // List currently attached items for debugging
            list attachedList = llGetAttachedList(ownerKey);
            integer attachedCount = llGetListLength(attachedList);
            if (attachedCount > 0) {
                llOwnerSay("[POC] Currently attached items: " + (string)attachedCount);
            }
            
            return; // Don't proceed with rezzing
        }
        
        llOwnerSay("[POC] Sufficient attachment slots available. Rezzing helper prims in 2 seconds...");
        
        listenHandle = llListen(CONTROL_CHANNEL, "", NULL_KEY, "");
        
        llSleep(2.0);
        
        // Rez 3 helper prims
        vector rezPos = llGetPos() + <0, 0, 2>;
        rotation rezRot = llGetRot();
        
        llOwnerSay("[POC] Rezzing Helper 1 (Resource Meters)...");
        llRezObject(HELPER_PRIM_NAME, rezPos, ZERO_VECTOR, rezRot, 0);
        
        llSleep(0.5);
        
        llOwnerSay("[POC] Rezzing Helper 2 (Action Bar)...");
        llRezObject(HELPER_PRIM_NAME, rezPos + <0, 0, 0.5>, ZERO_VECTOR, rezRot, 1);
        
        llSleep(0.5);
        
        llOwnerSay("[POC] Rezzing Helper 3 (Status)...");
        llRezObject(HELPER_PRIM_NAME, rezPos + <0, 0, 1.0>, ZERO_VECTOR, rezRot, 2);
    }
    
    object_rez(key id) {
        llSleep(0.2); // Wait for prim to initialize
        
        // Determine which helper this is based on rez order
        integer helperIndex = llGetListLength(activeHelpers) / 2;
        string component = "";
        integer attachPoint = 0;
        vector size = ZERO_VECTOR;
        string moapUrl = "";
        
        if (helperIndex == 0) {
            // First helper - Resource Meters at TOP LEFT (horizontal bar)
            component = "meters";
            attachPoint = ATTACH_HUD_TOP_LEFT;
            size = <0.4, 0.08, 0.01>;  // Wider horizontal bar for meters
            moapUrl = MOAP_BASE_URL + "/gameplay-hud.html?component=meters&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
        }
        else if (helperIndex == 1) {
            // Second helper - Action Bar at BOTTOM LEFT (horizontal bar)
            component = "actions";
            attachPoint = ATTACH_HUD_BOTTOM_LEFT;
            size = <0.4, 0.12, 0.01>;  // Wider horizontal bar for actions
            moapUrl = MOAP_BASE_URL + "/gameplay-hud.html?component=actions&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
        }
        else if (helperIndex == 2) {
            // Third helper - Status at TOP RIGHT (vertical bar)
            component = "status";
            attachPoint = ATTACH_HUD_TOP_RIGHT;
            size = <0.12, 0.3, 0.01>;  // Taller vertical bar for status
            moapUrl = MOAP_BASE_URL + "/gameplay-hud.html?component=status&uuid=" + llEscapeURL(ownerUUID) + "&t=" + (string)llGetUnixTime();
        }
        
        llOwnerSay("[POC] Configuring helper: " + component + " at attach point " + (string)attachPoint);
        
        // Configure helper prim (order matters: attach first, then size, then position, then MOAP)
        llRegionSayTo(id, CONTROL_CHANNEL, "ATTACH|" + (string)attachPoint);
        llSleep(0.2);
        
        llRegionSayTo(id, CONTROL_CHANNEL, "SIZE|" + (string)size.x + "|" + (string)size.y + "|" + (string)size.z);
        llSleep(0.2);
        
        // Position the prim relative to attach point (local coordinates)
        // For TOP_LEFT: position to the left side
        // For BOTTOM_LEFT: position to the left side, lower
        // For TOP_RIGHT: position to the right side
        vector position = ZERO_VECTOR;
        if (attachPoint == ATTACH_HUD_TOP_LEFT) {
            position = <-0.2, 0.0, 0.0>;  // Left side of screen
        }
        else if (attachPoint == ATTACH_HUD_BOTTOM_LEFT) {
            position = <-0.2, 0.0, -0.3>;  // Left side, lower
        }
        else if (attachPoint == ATTACH_HUD_TOP_RIGHT) {
            position = <0.2, 0.0, 0.0>;  // Right side of screen
        }
        llRegionSayTo(id, CONTROL_CHANNEL, "POS|" + (string)position.x + "|" + (string)position.y + "|" + (string)position.z);
        llSleep(0.2);
        
        llRegionSayTo(id, CONTROL_CHANNEL, "MOAP|" + moapUrl);
        
        // Track helper
        activeHelpers += [id, component];
        
        llOwnerSay("[POC] Helper " + component + " configured and ready!");
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == CONTROL_CHANNEL) {
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "HELPER_READY") {
                string component = llList2String(parts, 1);
                llOwnerSay("[POC] " + component + " helper reports ready!");
            }
        }
    }
    
    touch_start(integer num) {
        if (llDetectedKey(0) == ownerKey) {
            llOwnerSay("[POC] Main Controller touched");
            llOwnerSay("[POC] Active helpers: " + (string)(llGetListLength(activeHelpers) / 2));
            
            // If helpers exist, remove them
            if (llGetListLength(activeHelpers) > 0) {
                integer i;
                for (i = 0; i < llGetListLength(activeHelpers); i += 2) {
                    key helperKey = llList2Key(activeHelpers, i);
                    llRegionSayTo(helperKey, CONTROL_CHANNEL, "DEREZ");
                }
                activeHelpers = [];
                llOwnerSay("[POC] All helpers removed. Touch again to rez new ones.");
            }
            else {
                // No helpers exist, check slots and rez new ones
                list details = llGetObjectDetails(ownerKey, [OBJECT_ATTACHED_SLOTS_AVAILABLE]);
                integer slotsAvailable = llList2Integer(details, 0);
                
                if (slotsAvailable < SLOTS_NEEDED) {
                    integer slotsUsed = MAX_ATTACHMENT_SLOTS - slotsAvailable;
                    llOwnerSay("[POC] ERROR: Not enough attachment slots available!");
                    llOwnerSay("[POC] Available: " + (string)slotsAvailable + " | Needed: " + (string)SLOTS_NEEDED);
                    llOwnerSay("[POC] Currently wearing: " + (string)slotsUsed + " attachments.");
                    return;
                }
                
                llOwnerSay("[POC] Rezzing helper prims...");
                
                vector rezPos = llGetPos() + <0, 0, 2>;
                rotation rezRot = llGetRot();
                
                llRezObject(HELPER_PRIM_NAME, rezPos, ZERO_VECTOR, rezRot, 0);
                llSleep(0.5);
                llRezObject(HELPER_PRIM_NAME, rezPos + <0, 0, 0.5>, ZERO_VECTOR, rezRot, 1);
                llSleep(0.5);
                llRezObject(HELPER_PRIM_NAME, rezPos + <0, 0, 1.0>, ZERO_VECTOR, rezRot, 2);
            }
        }
    }
    
    attach(key id) {
        if (id == NULL_KEY) {
            // Detaching - remove all helpers
            integer i;
            for (i = 0; i < llGetListLength(activeHelpers); i += 2) {
                key helperKey = llList2Key(activeHelpers, i);
                llRegionSayTo(helperKey, CONTROL_CHANNEL, "DEREZ");
            }
            activeHelpers = [];
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

