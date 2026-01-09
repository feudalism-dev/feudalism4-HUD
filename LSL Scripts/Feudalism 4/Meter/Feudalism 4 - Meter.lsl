// ============================================================================
// Feudalism 4 - Meter (All-in-One)
// ============================================================================
// Displays character information as floating text above player's head
// Listens to Players HUD broadcasts for real-time updates
// ============================================================================

// =========================== CONFIGURATION ==================================
integer DEBUG_MODE = FALSE;

// Debug function
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Meter] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer METER_CHANNEL = -77777;           // HUD → Meter updates
integer METER_MODE_CHANNEL = -7777777;    // HUD → Meter mode changes
integer PLAYERHUDCHANNEL = -77770;        // Meter → HUD commands (for poison damage, etc.)

// =========================== DISPLAY CHARACTERS =============================
// Enhanced Unicode characters for better visual appeal
string BLOCK = "█";          // Full block (was ▇)
string HEART = "♥";          // Heart for health
string STAR = "★";           // Star for stamina
string MANA = "✦";           // Diamond for mana
string DIVIDER = "═";        // Divider line
string CORNER_TL = "╔";      // Top-left corner
string CORNER_TR = "╗";      // Top-right corner
string CORNER_BL = "╚";      // Bottom-left corner
string CORNER_BR = "╝";      // Bottom-right corner

// =========================== CHARACTER DATA =================================
string myName = "";
string myTitle = "";
string myGender = "";
string mySpecies = "";
string myClass = "";
integer myHealth = 0;
integer myStamina = 0;
integer myMana = 0;
integer maxHealth = 100;
integer maxStamina = 100;
integer maxMana = 100;

// =========================== STATE VARIABLES ================================
string mode = "roleplay";
string healthbarMode = "hide";
integer characterLoaded = FALSE;

// Status effects (for future Phase 2)
integer impairmentLevel = 0;
integer isPoisoned = FALSE;
string poisonName = "";

// =========================== DISPLAY FUNCTIONS ==============================

// Create decorative divider line
string makeDivider(integer length) {
    string line = "";
    integer i = 0;
    while (i < length) {
        line += DIVIDER;
        i++;
    }
    return line;
}

// Create health bar with visual blocks
string setHealthBar() {
    string bar = HEART + " ";
    integer blocks = 10;  // Always show 10 blocks for consistency
    integer filled;
    
    // Calculate filled blocks based on percentage
    if (maxHealth > 0) {
        filled = (myHealth * blocks) / maxHealth;
    } else {
        filled = 0;
    }
    
    // Ensure we don't exceed limits
    if (filled > blocks) filled = blocks;
    if (filled < 0) filled = 0;
    
    // Add filled blocks
    integer i = 0;
    while (i < filled) {
        bar += BLOCK;
        i++;
    }
    
    // Add empty spaces for remaining
    while (i < blocks) {
        bar += "·";  // Middle dot for empty
        i++;
    }
    
    bar += " " + (string)myHealth;
    return bar;
}

// Create stamina bar
string setStaminaBar() {
    string bar = STAR + " ";
    integer blocks = 10;
    integer filled;
    
    if (maxStamina > 0) {
        filled = (myStamina * blocks) / maxStamina;
    } else {
        filled = 0;
    }
    
    if (filled > blocks) filled = blocks;
    if (filled < 0) filled = 0;
    
    integer i = 0;
    while (i < filled) {
        bar += BLOCK;
        i++;
    }
    
    while (i < blocks) {
        bar += "·";
        i++;
    }
    
    bar += " " + (string)myStamina;
    return bar;
}

// Create mana bar (new for F4!)
string setManaBar() {
    string bar = MANA + " ";
    integer blocks = 10;
    integer filled;
    
    if (maxMana > 0) {
        filled = (myMana * blocks) / maxMana;
    } else {
        filled = 0;
    }
    
    if (filled > blocks) filled = blocks;
    if (filled < 0) filled = 0;
    
    integer i = 0;
    while (i < filled) {
        bar += BLOCK;
        i++;
    }
    
    while (i < blocks) {
        bar += "·";
        i++;
    }
    
    bar += " " + (string)myMana;
    return bar;
}

// Roleplay mode display
string showRP() {
    string display = makeDivider(20) + "\n";
    
    // Character name (bold by being first)
    display += myName + "\n";
    
    // Title (if exists)
    if (myTitle != "" && myTitle != " ") {
        display += myTitle + "\n";
    }
    
    // Species, Gender, Class
    string identity = mySpecies;
    if (myGender != "" && myGender != " ") {
        identity += ", " + myGender;
    }
    if (myClass != "" && myClass != " ") {
        identity += ", " + myClass;
    }
    display += identity + "\n";
    
    // Bars (if enabled)
    if (healthbarMode == "show") {
        display += "\n";
        display += setHealthBar() + "\n";
        display += setStaminaBar() + "\n";
        if (maxMana > 0) {  // Only show mana if character has it
            display += setManaBar() + "\n";
        }
    }
    
    display += makeDivider(20);
    return display;
}

// Tournament mode display
string showTournament() {
    string display = makeDivider(20) + "\n";
    display += "⚔ TOURNAMENT ⚔\n";
    display += makeDivider(20) + "\n\n";
    
    display += myName + "\n";
    if (myTitle != "" && myTitle != " ") {
        display += myTitle + "\n";
    }
    
    // Always show bars in tournament mode
    display += "\n";
    display += setHealthBar() + "\n";
    display += setStaminaBar() + "\n";
    
    display += makeDivider(20);
    return display;
}

// OOC mode display
string showOOC() {
    string display = makeDivider(20) + "\n";
    display += "    ⊗ OOC ⊗\n";
    display += makeDivider(20);
    return display;
}

// AFK mode display
string showAFK() {
    string display = makeDivider(20) + "\n";
    display += "    💤 AFK 💤\n";
    display += makeDivider(20);
    return display;
}

// None mode (invisible)
string showNone() {
    return "";
}

// Main display update function
setDisplay() {
    string textToDisplay = "";
    
    // Status flags
    if (isPoisoned) {
        textToDisplay += "☠ POISONED ☠\n";
    }
    if (impairmentLevel > 0) {
        textToDisplay += "🍺 IMPAIRED (" + (string)impairmentLevel + ") 🍺\n";
    }
    
    // Mode-based display
    if (mode == "roleplay") {
        textToDisplay += showRP();
    }
    else if (mode == "tournament") {
        textToDisplay += showTournament();
    }
    else if (mode == "ooc") {
        textToDisplay += showOOC();
    }
    else if (mode == "afk") {
        textToDisplay += showAFK();
    }
    else if (mode == "none" || mode == "*") {
        textToDisplay += showNone();
    }
    else {
        // Default to roleplay if unknown mode
        textToDisplay += showRP();
    }
    
    llSetText(textToDisplay, <1.0, 1.0, 1.0>, 1.0);
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        llSetText("", <1.0, 1.0, 1.0>, 1.0);
        llOwnerSay("Feudalism 4 Meter starting up...");
        
        // Set defaults
        myName = "Loading...";
        myHealth = 100;
        myStamina = 100;
        myMana = 0;
        maxHealth = 100;
        maxStamina = 100;
        maxMana = 0;
        mode = "roleplay";
        characterLoaded = FALSE;
        
        // Request initial data from HUD
        llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "meter,request_data");
        
        // Start listening
        llListen(METER_CHANNEL, "", NULL_KEY, "");
        llListen(METER_MODE_CHANNEL, "", NULL_KEY, "");
        
        llOwnerSay("Feudalism 4 Meter ready. Listening for HUD updates...");
        setDisplay();
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    attach(key id) {
        if (id) {
            // Attached - do nothing, state_entry handles it
        }
        else {
            // Detached - clear display
            llSetText("", <1.0, 1.0, 1.0>, 1.0);
        }
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) {
            // Refresh display after region change/teleport
            llSleep(1.0);  // Give HUD time to reconnect
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "meter,request_data");
        }
    }
    
    listen(integer channel, string name, key id, string text) {
        // Only listen to messages from objects owned by us or from owner's HUD
        if (llGetOwnerKey(id) != llGetOwner()) {
            return;
        }
        
        // Parse CSV message
        list message = llCSV2List(text);
        string action = llList2String(message, 0);
        string parameter = llList2String(message, 1);
        
        // ===== METER_CHANNEL (-77777) - Data Updates =====
        if (channel == METER_CHANNEL) {
            debugLog("Meter update: " + action + " = " + parameter);
            
            if (action == "name") {
                myName = parameter;
                characterLoaded = TRUE;
            }
            else if (action == "title") {
                myTitle = parameter;
            }
            else if (action == "species") {
                mySpecies = parameter;
            }
            else if (action == "gender") {
                myGender = parameter;
            }
            else if (action == "class") {
                myClass = parameter;
            }
            else if (action == "health") {
                myHealth = (integer)parameter;
            }
            else if (action == "stamina") {
                myStamina = (integer)parameter;
            }
            else if (action == "mana") {
                myMana = (integer)parameter;
            }
            else if (action == "maxHealth") {
                maxHealth = (integer)parameter;
            }
            else if (action == "maxStamina") {
                maxStamina = (integer)parameter;
            }
            else if (action == "maxMana") {
                maxMana = (integer)parameter;
            }
            else if (action == "reset") {
                // Reset to defaults
                myHealth = maxHealth;
                myStamina = maxStamina;
                myMana = maxMana;
                impairmentLevel = 0;
                isPoisoned = FALSE;
                poisonName = "";
            }
            // Phase 2 features (stub for now)
            else if (action == "addImpairment") {
                impairmentLevel++;
                if (impairmentLevel > 9) impairmentLevel = 9;
            }
            else if (action == "remImpairment") {
                impairmentLevel--;
                if (impairmentLevel < 0) impairmentLevel = 0;
            }
            else if (action == "clearImpairment") {
                impairmentLevel = 0;
            }
            else if (action == "addPoison") {
                isPoisoned = TRUE;
                poisonName = parameter;
            }
            else if (action == "clearPoison") {
                isPoisoned = FALSE;
                poisonName = "";
            }
            
            setDisplay();
        }
        
        // ===== METER_MODE_CHANNEL (-7777777) - Mode Changes =====
        else if (channel == METER_MODE_CHANNEL) {
            debugLog("Mode update: " + action + " = " + parameter);
            
            if (action == "mode") {
                if (parameter == "tournament") {
                    mode = "tournament";
                }
                else if (parameter == "roleplay") {
                    mode = "roleplay";
                }
                else if (parameter == "ooc") {
                    mode = "ooc";
                }
                else if (parameter == "afk") {
                    mode = "afk";
                }
                else if (parameter == "none" || parameter == "*") {
                    mode = "none";
                }
            }
            else if (action == "healthbar") {
                if (parameter == "show") {
                    healthbarMode = "show";
                }
                else {
                    healthbarMode = "hide";
                }
            }
            
            setDisplay();
        }
    }
}
