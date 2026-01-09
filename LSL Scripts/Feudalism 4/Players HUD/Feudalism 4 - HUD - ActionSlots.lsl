// ============================================================================
// Feudalism 4 - HUD - Action Slots Manager
// ============================================================================
// Manages quick-access action slots for items and abilities
// - Register/unregister items (bucket, pouch, waterskin, etc.)
// - Visual slot indicators (texture updates)
// - Button click handling for quick actions
// - Persistent slot bindings via LinksetData
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[ActionSlots] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer HUD_CHANNEL = -77770;           // Main HUD channel
integer WATER_CHANNEL = -595225;        // Waterskin/bucket channel
integer POUCH_CHANNEL = -454545;        // Pickpocket pouch channel

// =========================== SLOT CONFIGURATION =============================
// Action slot assignments (slot number → action type)
// Slots 2-7: Generic/dynamic slots
// Slot 8: Waterskin (drink)
// Slot 9: Bucket (water report)
// Slot 10: Pouch (pickpocket contents)

integer SLOT_SKIN = 8;      // Waterskin slot
integer SLOT_BUCKET = 9;    // Bucket slot  
integer SLOT_POUCH = 10;    // Pouch slot

// =========================== STATE VARIABLES ================================
list rpSlots = [];              // Active slot numbers
list rpSlotLinks = [];          // Link numbers for slot prims
list objectsWorn = [];          // Currently registered objects
integer hudListenHandle;        // Listen handle

// =========================== UTILITY FUNCTIONS ==============================

// Fast texture setter (preserves other prim parameters)
setLinkTextureFast(integer link, string texture, integer face) {
    // Obtain the current texture parameters and replace the texture only.
    list Params = llGetLinkPrimitiveParams(link, [PRIM_TEXTURE, face]);
    integer idx;
    face *= face > 0; // Make it zero if it was ALL_SIDES
    
    // The list returned by llGLPP has a 4 element stride
    // (texture, repeats, offsets, angle). But as we modify it, we add two
    // elements to each, so the completed part of the list has 6 elements per stride.
    integer NumSides = llGetListLength(Params) / 4; // At this point, 4 elements per stride
    for (idx = 0; idx < NumSides; ++idx) {
        // The part we've completed has 6 elements per stride, thus the *6.
        Params = llListReplaceList(Params, [PRIM_TEXTURE, face++, texture], idx*6, idx*6);
    }
    
    llSetLinkPrimitiveParamsFast(link, Params);
}

// Get link number by prim name
integer getLinkNumberByName(string linkName) {
    integer i = 0;
    integer numPrims = llGetNumberOfPrims();
    while (i <= numPrims) {
        if (llGetLinkName(i) == linkName) {
            return i;
        }
        i++;
    }
    return -1;
}

// Initialize all slot prims
initializeSlots() {
    rpSlotLinks = [];
    rpSlots = [];
    
    integer i;
    for (i = 2; i < 11; i++) {
        integer link = getLinkNumberByName("rp_slot" + (string)i);
        
        if (link != -1) {
            rpSlotLinks += link;
            setLinkTextureFast(link, "active_none", 4);
            llSetLinkAlpha(link, 0.0, 4);  // Start invisible
            debugLog("Initialized slot " + (string)i + " (link " + (string)link + ")");
        } else {
            debugLog("WARNING: Slot prim 'rp_slot" + (string)i + "' not found");
            rpSlotLinks += -1;  // Placeholder
        }
    }
}

// Get slot number for action type
integer getSlotForActionType(string actionType) {
    if (actionType == "bucket") {
        return SLOT_BUCKET;
    }
    else if (actionType == "pouch") {
        return SLOT_POUCH;
    }
    else if (actionType == "skin" || actionType == "waterskin") {
        return SLOT_SKIN;
    }
    // Generic slots (2-7) - future expansion
    else {
        return 3;  // Default to slot 3
    }
}

// Register an action to a slot
registerAction(string actionType, string objectName) {
    integer slot = getSlotForActionType(actionType);
    integer link = getLinkNumberByName("rp_slot" + (string)slot);
    
    if (link == -1) {
        debugLog("ERROR: Slot prim not found for slot " + (string)slot);
        return;
    }
    
    debugLog("Registering " + actionType + " (" + objectName + ") to slot " + (string)slot);
    
    // Set slot texture to active
    string texture = actionType + " active";
    setLinkTextureFast(link, texture, 4);
    llSetLinkAlpha(link, 1.0, 4);
    
    // Store in objectsWorn list (if not already there)
    integer index = llListFindList(objectsWorn, [objectName]);
    if (index == -1) {
        objectsWorn += objectName;
    }
    
    // Store binding in LinksetData for persistence
    llLinksetDataWrite("action_slot_" + (string)slot, actionType + "|" + objectName);
}

// Unregister an action from a slot
unregisterAction(string actionType, string objectName) {
    integer slot = getSlotForActionType(actionType);
    integer link = getLinkNumberByName("rp_slot" + (string)slot);
    
    if (link == -1) {
        debugLog("ERROR: Slot prim not found for slot " + (string)slot);
        return;
    }
    
    debugLog("Unregistering " + actionType + " (" + objectName + ") from slot " + (string)slot);
    
    // Set slot texture to inactive
    setLinkTextureFast(link, "active_none", 4);
    llSetLinkAlpha(link, 0.0, 4);
    
    // Remove from objectsWorn list
    integer index = llListFindList(objectsWorn, [objectName]);
    if (index != -1) {
        objectsWorn = llDeleteSubList(objectsWorn, index, index);
    }
    
    // Clear binding from LinksetData
    llLinksetDataDelete("action_slot_" + (string)slot);
}

// Handle slot button click
handleSlotClick(integer slotNum) {
    debugLog("Slot " + (string)slotNum + " clicked");
    
    // Check what's bound to this slot
    string binding = llLinksetDataRead("action_slot_" + (string)slotNum);
    
    if (binding == "") {
        debugLog("Slot " + (string)slotNum + " is empty");
        return;
    }
    
    list parts = llParseString2List(binding, ["|"], []);
    string actionType = llList2String(parts, 0);
    string objectName = llList2String(parts, 1);
    
    debugLog("Activating " + actionType + " (" + objectName + ")");
    
    // Trigger action based on slot
    if (slotNum == SLOT_BUCKET) {
        // Bucket - report water level
        llRegionSayTo(llGetOwner(), WATER_CHANNEL, "report");
    }
    else if (slotNum == SLOT_POUCH) {
        // Pouch - show contents
        llRegionSayTo(llGetOwner(), POUCH_CHANNEL, "contents");
    }
    else if (slotNum == SLOT_SKIN) {
        // Waterskin - drink
        llRegionSayTo(llGetOwner(), WATER_CHANNEL, "drink");
    }
    else {
        // Generic slot - broadcast activation
        llRegionSayTo(llGetOwner(), HUD_CHANNEL, "activate_slot," + (string)slotNum + "," + actionType);
    }
}

// Restore slot bindings from LinksetData
restoreSlotBindings() {
    debugLog("Restoring slot bindings from LinksetData...");
    
    integer i;
    for (i = 2; i < 11; i++) {
        string binding = llLinksetDataRead("action_slot_" + (string)i);
        
        if (binding != "") {
            list parts = llParseString2List(binding, ["|"], []);
            string actionType = llList2String(parts, 0);
            string objectName = llList2String(parts, 1);
            
            debugLog("Restoring slot " + (string)i + ": " + actionType);
            registerAction(actionType, objectName);
        }
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Action Slots Manager starting...");
        
        // Clean up old listener
        llListenRemove(hudListenHandle);
        
        // Initialize
        objectsWorn = [];
        initializeSlots();
        
        // Start listening for register/unregister commands
        hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        
        // Restore previous bindings
        restoreSlotBindings();
        
        debugLog("Action Slots Manager ready");
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == HUD_CHANNEL) {
            llListenRemove(hudListenHandle);
            
            list parsedMessage = llCSV2List(message);
            string action = llList2String(parsedMessage, 0);
            string actionType = llList2String(parsedMessage, 1);
            string objectName = llList2String(parsedMessage, 2);
            
            debugLog("Listen: " + action + ", type: " + actionType + ", object: " + objectName);
            
            if (action == "registerAction") {
                registerAction(actionType, objectName);
            }
            else if (action == "unregisterAction") {
                unregisterAction(actionType, objectName);
            }
            
            // Re-enable listener
            hudListenHandle = llListen(HUD_CHANNEL, "", "", "");
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        debugLog("Link message: " + msg);
        
        // Check if the message is a slot button click
        if (llSubStringIndex(msg, "rp_slot") == 0) {
            // Extract slot number
            string slotStr = llGetSubString(msg, 7, -1);
            integer slotNum = (integer)slotStr;
            
            // Verify valid range
            if (slotNum >= 2 && slotNum <= 10) {
                handleSlotClick(slotNum);
            } else {
                debugLog("Invalid slot number: " + (string)slotNum);
            }
        }
    }
}
