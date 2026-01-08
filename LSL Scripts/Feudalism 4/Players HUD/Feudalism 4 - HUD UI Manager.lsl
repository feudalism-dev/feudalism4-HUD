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

// Track last known valid mana values to prevent flashing during initialization
float lastValidBaseMana = 0.0;

// Buff slot prim names (max 3 buffs)
list BUFF_SLOTS = ["rp_slot2", "rp_slot3", "rp_slot4"];
string GENERIC_BUFF_TEXTURE = "buff_generic";  // Generic buff icon texture

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

// Update buff slots with buff data
updateBuffSlots(string jsonArray) {
    // Parse JSON array
    list buffEntries = [];
    
    integer i = 0;
    while (TRUE) {
        string entryJson = llJsonGetValue(jsonArray, [i]);
        if (entryJson == JSON_INVALID || entryJson == "") {
            jump done_parsing;
        }
        
        // Extract stat, amount, remaining
        string stat = llJsonGetValue(entryJson, ["stat"]);
        string amountStr = llJsonGetValue(entryJson, ["amount"]);
        string remainingStr = llJsonGetValue(entryJson, ["remaining"]);
        
        // Remove quotes if present
        if (stat != JSON_INVALID && stat != "") {
            if (llStringLength(stat) >= 2 && llGetSubString(stat, 0, 0) == "\"" && llGetSubString(stat, -1, -1) == "\"") {
                stat = llGetSubString(stat, 1, -2);
            }
        }
        if (amountStr != JSON_INVALID && amountStr != "") {
            if (llStringLength(amountStr) >= 2 && llGetSubString(amountStr, 0, 0) == "\"" && llGetSubString(amountStr, -1, -1) == "\"") {
                amountStr = llGetSubString(amountStr, 1, -2);
            }
        }
        if (remainingStr != JSON_INVALID && remainingStr != "") {
            if (llStringLength(remainingStr) >= 2 && llGetSubString(remainingStr, 0, 0) == "\"" && llGetSubString(remainingStr, -1, -1) == "\"") {
                remainingStr = llGetSubString(remainingStr, 1, -2);
            }
        }
        
        if (stat != JSON_INVALID && stat != "" && amountStr != JSON_INVALID && amountStr != "" && remainingStr != JSON_INVALID && remainingStr != "") {
            integer amount = (integer)amountStr;
            integer remaining = (integer)remainingStr;
            buffEntries += [stat, amount, remaining];
        }
        
        i++;
    }
    @done_parsing;
    
    // Sort entries alphabetically by stat name
    integer len = llGetListLength(buffEntries);
    integer j;
    integer k;
    for (j = 0; j < len - 3; j += 3) {
        for (k = j + 3; k < len; k += 3) {
            string stat1 = llList2String(buffEntries, j);
            string stat2 = llList2String(buffEntries, k);
            if ((integer)stat1 > (integer)stat2) {
                // Swap entries
                string tempStat = stat1;
                integer tempAmount = llList2Integer(buffEntries, j + 1);
                integer tempRemaining = llList2Integer(buffEntries, j + 2);
                buffEntries = llListReplaceList(buffEntries, [stat2, llList2Integer(buffEntries, k + 1), llList2Integer(buffEntries, k + 2)], j, j + 2);
                buffEntries = llListReplaceList(buffEntries, [tempStat, tempAmount, tempRemaining], k, k + 2);
            }
        }
    }
    
    // Assign to slots (max 3)
    integer slotIndex;
    integer entryIndex = 0;
    integer maxSlots = llGetListLength(BUFF_SLOTS);
    
    for (slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
        string slotName = llList2String(BUFF_SLOTS, slotIndex);
        integer linkNum = getLinkNumberByName(slotName);
        
        if (entryIndex < len) {
            // Has buff to display
            string stat = llList2String(buffEntries, entryIndex);
            integer amount = llList2Integer(buffEntries, entryIndex + 1);
            integer remaining = llList2Integer(buffEntries, entryIndex + 2);
            
            // Build hover text: "<stat> <+amount or -amount> (<seconds remaining>s)"
            string amountStr;
            if (amount > 0) {
                amountStr = "+" + (string)amount;
            } else {
                amountStr = (string)amount;
            }
            string hoverText = stat + " " + amountStr + " (" + (string)remaining + "s)";
            
            if (linkNum != -1) {
                // Set generic buff icon texture
                setLinkTextureFast(linkNum, GENERIC_BUFF_TEXTURE, ALL_SIDES);
                // Set hover text
                llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, hoverText, <1.0, 1.0, 1.0>, 1.0]);
            }
            
            entryIndex += 3;
        } else {
            // Clear unused slot
            if (linkNum != -1) {
                // Clear texture and text
                llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXTURE, ALL_SIDES, TEXTURE_BLANK, <1,1,0>, ZERO_VECTOR, 0.0]);
                llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, "", <1,1,1>, 0.0]);
            }
        }
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Reset tracking variables on script reset
        lastValidBaseMana = 0.0;
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Handle BUFF_UI_UPDATE
        if (llSubStringIndex(msg, "BUFF_UI_UPDATE|") == 0) {
            string jsonStr = llGetSubString(msg, 15, -1);  // Extract JSON after "BUFF_UI_UPDATE|"
            updateBuffSlots(jsonStr);
            return;
        }
        
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
            
            // Validate baseMana - if id is NULL_KEY or empty, baseMana will be 0.0
            // Don't set texture if baseMana is invalid (data not loaded yet)
            string baseManaStr = (string)id;
            float baseMana = 0.0;
            if (baseManaStr != "" && id != NULL_KEY) {
                baseMana = (float)baseManaStr;
            }
            
            if (currentMana < 0) currentMana = 0;
            
            linkNum = getLinkNumberByName(linkName);
            
            // CRITICAL: Only update display if baseMana is valid (data loaded)
            // Once we've seen valid data, don't accept invalid data that would overwrite it
            // This prevents flashing between valid values and blank/"..." during initialization
            if (baseMana > 0.0) {
                lastValidBaseMana = baseMana;  // Remember we have valid data
            } else if (lastValidBaseMana > 0.0) {
                // We've already displayed valid data, and now we're getting invalid data
                // This is likely a stale message during reset - ignore it to prevent flashing
                return;  // Exit early - don't overwrite valid display with invalid data
            } else {
                // No valid data yet, and this message is invalid - don't update yet
                return;  // Exit early - wait for valid data
            }
            
            // Data is valid - update display
            setPrimText("rp_manaStatPrim", (string)currentMana);
            llRegionSayTo(llGetOwner(), meterChannel, "mana," + (string)currentMana);
            
            // Calculate percentage
            if (currentMana == 0) {
                percentage = "0";
            } else if (currentMana >= baseMana) {
                percentage = "100";
            } else {
                percent = (integer)(((float)currentMana / baseMana) * 100);
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

