// ============================================================================
// Feudalism 4 - Players HUD UI Manager
// ============================================================================
// Handles visual display of resources (Health, Stamina, Mana) and XP
// Uses linked prims with named components and textures
// Based on F3 UI Manager but adapted for F4
// ============================================================================

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[UI Manager] " + message);
    }
}

integer meterChannel = -77777;
integer menuChannel = -777799;
integer meterModeChannel = -7777777;
integer menuListener;
integer menuActive = FALSE;

// =========================== UTILITY FUNCTIONS ==============================

integer getLinkNumberByName(string linkName) {
    integer i = 0;
    while (i <= llGetNumberOfPrims()) {
        if (llGetLinkName(i) == linkName)
            return i;
        i++;
    }
    return -1;
}

setLinkTextureFast(integer link, string texture, integer face) {
    // Obtain the current texture parameters and replace the texture only
    list Params = llGetLinkPrimitiveParams(link, [PRIM_TEXTURE, face]);
    integer idx;
    face *= face > 0; // Make it zero if it was ALL_SIDES
    integer NumSides = llGetListLength(Params) / 4;
    for (idx = 0; idx < NumSides; ++idx) {
        Params = llListReplaceList(Params, [PRIM_TEXTURE, face++, texture], idx*6, idx*6);
    }
    llSetLinkPrimitiveParamsFast(link, Params);
}

string getPercentage(integer percent) {
    // Returns percentage in 10% increments (0, 10, 20, ..., 100)
    if (percent > 90) return "100";
    else if (percent > 80) return "90";
    else if (percent > 70) return "80";
    else if (percent > 60) return "70";
    else if (percent > 50) return "60";
    else if (percent > 40) return "50";
    else if (percent > 30) return "40";
    else if (percent > 20) return "30";
    else if (percent > 10) return "20";
    else if (percent > 0) return "10";
    else return "0";
}

setPrimText(string primName, string value) {
    integer linkNum = getLinkNumberByName(primName);
    if (linkNum == -1) {
        // Prim not found - silent fail
    } else {
        llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, value, <1.000, 0.863, 0.000>, 0.8]);
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        llOwnerSay("[UI Manager] Initialized");
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Health Display
        if (msg == "set health display") {
            string linkName = "rp_health";
            integer linkNum;
            string texture;
            integer percent;
            string percentage;
            integer currentHealth = num;
            float baseHealth = (float)((string)id);
            
            if (currentHealth < 0) currentHealth = 0;
            
            linkNum = getLinkNumberByName(linkName);
            setPrimText("rp_healthStatPrim", (string)currentHealth);
            llRegionSayTo(llGetOwner(), meterChannel, "health," + (string)currentHealth);
            
            if (currentHealth == 0) {
                percentage = "0";
            } else {
                percent = (integer)(((float)currentHealth / (float)baseHealth) * 100);
                percentage = getPercentage(percent);
            }
            
            texture = "health" + percentage;
            
            if (linkNum > 1) {
                setLinkTextureFast(linkNum, texture, ALL_SIDES);
            }
        }
        
        // Stamina Display
        if (msg == "set stamina display") {
            string linkName = "rp_stamina";
            integer linkNum;
            string texture;
            integer percent;
            string percentage;
            integer currentStamina = num;
            float baseStamina = (float)((string)id);
            
            if (currentStamina < 0) currentStamina = 0;
            
            linkNum = getLinkNumberByName(linkName);
            setPrimText("rp_staminaStatPrim", (string)currentStamina);
            llRegionSayTo(llGetOwner(), meterChannel, "stamina," + (string)currentStamina);
            
            if (currentStamina == 0) {
                percentage = "0";
            } else {
                percent = (integer)(((float)currentStamina / (float)baseStamina) * 100);
                percentage = getPercentage(percent);
            }
            
            texture = "stamina" + percentage;
            
            if (linkNum > 1) {
                setLinkTextureFast(linkNum, texture, ALL_SIDES);
            }
        }
        
        // Mana Display (F4 addition)
        if (msg == "set mana display") {
            string linkName = "rp_mana";
            integer linkNum;
            string texture;
            integer percent;
            string percentage;
            integer currentMana = num;
            float baseMana = (float)((string)id);
            
            if (currentMana < 0) currentMana = 0;
            
            linkNum = getLinkNumberByName(linkName);
            setPrimText("rp_manaStatPrim", (string)currentMana);
            llRegionSayTo(llGetOwner(), meterChannel, "mana," + (string)currentMana);
            
            if (currentMana == 0) {
                percentage = "0";
            } else {
                percent = (integer)(((float)currentMana / (float)baseMana) * 100);
                percentage = getPercentage(percent);
            }
            
            texture = "mana" + percentage;
            
            if (linkNum > 1) {
                setLinkTextureFast(linkNum, texture, ALL_SIDES);
            }
        }
        
        // XP Display
        if (msg == "set xp display") {
            integer link = getLinkNumberByName("rp_xpBar");
            string texture;
            integer percent;
            string percentage;
            integer targetXP;
            integer myXP = num;
            
            if (link == -1) {
                llOwnerSay("[UI Manager] ERROR: Could not find prim named 'rp_xpBar'");
            } else {
                setPrimText("rp_xpText", (string)myXP + " XP");
                
                // F4: Nonlinear XP milestones
                if (myXP < 1000) targetXP = 1000;
                else if (myXP < 5000) targetXP = 5000;
                else if (myXP < 10000) targetXP = 10000;
                else if (myXP < 100000) targetXP = 100000;
                else targetXP = 1000000;
                
                if (myXP == 0) {
                    percentage = "0";
                } else {
                    percent = (integer)(((float)myXP / (float)targetXP) * 100);
                    if (percent > 100) percent = 100;
                    percentage = getPercentage(percent);
                }
                
                texture = "xp" + percentage;
                
                if (link > 0) {
                    setLinkTextureFast(link, texture, 4);
                }
            }
        }
    }
    
    touch_start(integer num_detected) {
        string touchAction = llGetLinkName(llDetectedLinkNumber(0));
        
        if (touchAction == "rp_update") {
            llMessageLinked(LINK_ROOT, 0, "hard reset", "");
        }
        else if (touchAction == "rp_options") {
            // rp_options is now handled by Combined HUD Controller directly
            // Don't send link message to avoid race conditions with toggle logic
            // The Combined HUD Controller's touch_start handler will toggle the Setup HUD
        }
        else if (touchAction == "rp_heart") {
            list menuChoices = ["OOC Reset", "IC Rest", "Stop Resting"];
            string message = "\nPlease make a choice:\n\n";
            llDialog(llGetOwner(), message, menuChoices, menuChannel);
            llListenRemove(menuListener);
            menuListener = llListen(menuChannel, "", llGetOwner(), "");
            llSetTimerEvent(30.0);
        }
        else if (touchAction == "rp_slot2" || touchAction == "rp_slot3" || touchAction == "rp_slot4" || 
                 touchAction == "rp_slot5" || touchAction == "rp_slot6" || touchAction == "rp_slot7" || 
                 touchAction == "rp_slot8" || touchAction == "rp_slot9" || touchAction == "rp_slot10") {
            llMessageLinked(LINK_SET, 0, touchAction, "");
        }
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == menuChannel) {
            llListenRemove(menuListener);
            message = llToLower(message);
            
            if (message == "ooc reset") {
                llMessageLinked(LINK_ROOT, 0, "reset character", "");
            }
            if (message == "ic rest") {
                llMessageLinked(LINK_ROOT, 0, "rest", "");
            }
            if (message == "stop resting") {
                llMessageLinked(LINK_ROOT, 0, "stop resting", "");
            }
            if (message == "tournament") {
                llMessageLinked(LINK_ROOT, 0, "tournament mode", "");
                llOwnerSay("Setting hud to Tournament mode.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,tournament");
            }
            if (message == "roleplay") {
                llMessageLinked(LINK_ROOT, 0, "roleplay mode", "");
                llOwnerSay("Setting hud to Roleplay mode.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,roleplay");
            }
            if (message == "ooc") {
                llMessageLinked(LINK_ROOT, 0, "ooc mode", "");
                llOwnerSay("Setting hud to OOC mode.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,ooc");
            }
            if (message == "afk") {
                llMessageLinked(LINK_ROOT, 0, "afk mode", "");
                llOwnerSay("Setting hud to AFK mode.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,afk");
            }
            if (message == "*") {
                llOwnerSay("Setting hud to * mode.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,none");
            }
            if (message == "hide bars") {
                llOwnerSay("Setting hud to hide the health and stamina bars.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "healthbar,hide");
            }
            if (message == "show bars") {
                llMessageLinked(LINK_ROOT, 0, "show bars", "");
                llOwnerSay("Setting hud to show the health and stamina bars.");
                llRegionSayTo(llGetOwner(), meterModeChannel, "healthbar,show");
            }
            if (message == "edit character...") {
                // Open Setup HUD for editing
                llMessageLinked(LINK_SET, 0, "show setup hud", "");
                llOwnerSay("Opening character editor...");
            }
        }
    }
    
    timer() {
        llSetTimerEvent(0.0);
        llListenRemove(menuListener);
        menuActive = FALSE;
    }
}

