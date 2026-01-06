// ============================================================================
// Feudalism 4 - Players HUD Main Controller
// ============================================================================
// Traditional HUD approach using linked prims and textures
// Uses Firestore for character data instead of Experience database
// ============================================================================

// =========================== CONFIGURATION ==================================
// Universe ID for this HUD (enforces one character → one universe rule)
string HUD_UNIVERSE_ID = "feud4_core";

// Button to toggle Setup HUD (touch this prim to open/close Setup HUD)
string SETUP_BUTTON_NAME = "btn_setup";  // Optional: can be empty to use chat command

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[F4 Players HUD] " + message);
    }
}

// Communication channels
integer METER_CHANNEL = -77777;
integer MENU_CHANNEL = -777799;
integer METER_MODE_CHANNEL = -7777777;
integer HUD_CHANNEL = -77770;
integer WEAPON_CHANNEL = -77771;
integer WEAPON_CHANNEL2 = -77773;

// Character data
string myName;
list myStats;
integer myXP;
integer currentHealth;
integer currentStamina;
integer currentMana;  // New for F4
integer baseHealth;
integer baseStamina;
integer baseMana;     // New for F4
string myClass;
integer characterLoaded = FALSE;

// Species factors (stored from character data)
integer healthFactor = 25;
integer staminaFactor = 25;
integer manaFactor = 25;
integer hasMana = TRUE;  // Default to TRUE, will be set from character data

// Stat indices (F3 stat system)
integer AGILITY = 0;
integer ANIMAL = 1;
integer ATHLETICS = 2;
integer AWARENESS = 3;
integer CRAFTING = 4;
integer DECEPTION = 5;
integer ENDURANCE = 6;
integer ENTERTAINING = 7;
integer FIGHTING = 8;
integer HEALING = 9;
integer INFLUENCE = 10;
integer INTELLIGENCE = 11;
integer KNOWLEDGE = 12;
integer MARKSMANSHIP = 13;
integer PERSUASION = 14;
integer STEALTH = 15;
integer SURVIVAL = 16;
integer THIEVERY = 17;
integer WILL = 18;
integer WISDOM = 19;

// Game mode
string mode = "roleplay";
integer isResting = FALSE;
integer isPassedOut = FALSE;
integer timerCount = 0;  // For rest timer

// Owner info (for touch handling)
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;

// Toggle debounce
float lastToggleTime = 0.0;  // Time of last toggle for debouncing

// Firebase/Firestore communication
// Note: LSL cannot directly access Firestore, so we rely on the Setup HUD
// (which has Firebase access via MOAP web interface) to sync data via llRegionSay
// The Players HUD itself is traditional (textures/prims) and does NOT use MOAP

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

setPrimText(string primName, string value) {
    integer linkNum = getLinkNumberByName(primName);
    if (linkNum == -1) {
        // Prim not found - silent fail
    } else {
        llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, value, <1.000, 0.863, 0.000>, 0.8]);
    }
}

calculateHealth() {
    // F4: Health = (Agility + Athletics) * health_factor
    baseHealth = (llList2Integer(myStats, AGILITY) + 
                  llList2Integer(myStats, ATHLETICS)) * healthFactor;
    if (currentHealth > baseHealth) currentHealth = baseHealth;
    if (currentHealth < 0) currentHealth = 0;
}

calculateStamina() {
    // F4: Stamina = (Endurance + Will) * stamina_factor
    baseStamina = (llList2Integer(myStats, ENDURANCE) + 
                   llList2Integer(myStats, WILL)) * staminaFactor;
    if (currentStamina > baseStamina) currentStamina = baseStamina;
    if (currentStamina < 0) currentStamina = 0;
}

calculateMana() {
    // F4: Mana = (Wisdom + Intelligence) * mana_factor (only if has_mana)
    if (!hasMana) {
        baseMana = 0;
        currentMana = 0;
        return;
    }
    baseMana = (llList2Integer(myStats, WISDOM) + 
                llList2Integer(myStats, INTELLIGENCE)) * manaFactor;
    if (currentMana > baseMana) currentMana = baseMana;
    if (currentMana < 0) currentMana = 0;
}

updateResourceDisplays() {
    // Update Health display
    llMessageLinked(LINK_SET, currentHealth, "set health display", (string)baseHealth);
    
    // Update Stamina display
    llMessageLinked(LINK_SET, currentStamina, "set stamina display", (string)baseStamina);
    
    // Update Mana display (F4 addition)
    llMessageLinked(LINK_SET, currentMana, "set mana display", (string)baseMana);
    
    // Update XP display
    llMessageLinked(LINK_SET, myXP, "set xp display", "");
}

// Send notification
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        debugLog("Initialized");
        
        // Initialize owner information
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        // Set up listener for external communications
        llListen(HUD_CHANNEL, "", NULL_KEY, "");
        
        // Load species factors and has_mana from LSD
        string healthFactorStr = llLinksetDataRead("health_factor");
        string staminaFactorStr = llLinksetDataRead("stamina_factor");
        string manaFactorStr = llLinksetDataRead("mana_factor");
        string hasManaStr = llLinksetDataRead("has_mana");
        
        if (healthFactorStr != "") healthFactor = (integer)healthFactorStr;
        if (staminaFactorStr != "") staminaFactor = (integer)staminaFactorStr;
        if (manaFactorStr != "") manaFactor = (integer)manaFactorStr;
        if (hasManaStr != "") hasMana = (integer)hasManaStr;
        
        // Don't request loads here - Combined HUD Controller handles initialization
        // This prevents cascade of load requests from multiple scripts
    }
    
    // Handle touch events
    touch_start(integer num) {
        key toucher = llDetectedKey(0);
        if (toucher != ownerKey) return;
        
        integer linkNum = llDetectedLinkNumber(0);
        string linkName = llGetLinkName(linkNum);
        
        // Toggle Setup HUD if setup button is touched
        if (SETUP_BUTTON_NAME != "" && linkName == SETUP_BUTTON_NAME) {
            // Route to HUD_MOAP (HUD_MOAP will handle state check internally)
            llMessageLinked(LINK_SET, 2001, "TOGGLE_SETUP_HUD", "");
            return;
        }
        // Toggle Setup HUD if rp_options is touched
        else if (linkName == "rp_options") {
            // Debounce: Check time since last toggle using stored time
            float currentTime = llGetTime();
            float elapsed = currentTime - lastToggleTime;
            if (elapsed < 1.0 && lastToggleTime > 0.0) {
                debugLog("Toggle debounce - ignoring rapid click (elapsed: " + (string)elapsed + ")");
                return;
            }
            
            // Update last toggle time
            lastToggleTime = currentTime;
            
            // Route toggle to HUD_MOAP (HUD_MOAP will handle state check internally)
            llMessageLinked(LINK_SET, 2001, "TOGGLE_SETUP_HUD", "");
        }
        // Show inventory menu if rp_inventory is touched (route to Inventory Controller)
        else if (linkName == "rp_inventory") {
            llMessageLinked(LINK_SET, 0, "show_inventory_menu", "");
        }
        // Show coin menu if rp_coins is touched (route to Inventory Controller)
        else if (linkName == "rp_coins") {
            llMessageLinked(LINK_SET, 0, "show_coin_menu", "");
        }
        // Handle rp_update button (refresh/sync character data from Firestore)
        else if (linkName == "rp_update") {
            // Read characterId from LSD (stored by Firestore Bridge)
            string characterId = llLinksetDataRead("characterId");
            if (characterId == "" || characterId == "JSON_INVALID") {
                // No characterId in LSD - need to query Firestore first
                llMessageLinked(LINK_SET, 0, "get_character_info", NULL_KEY);
                notify("Querying character information...");
            } else {
                // Use atomic field gets instead of fetching full document (prevents truncation)
                // Send all field requests in parallel (fastest approach)
                llMessageLinked(LINK_SET, 0, "getStats", "");
                llMessageLinked(LINK_SET, 0, "getHealth", "");
                llMessageLinked(LINK_SET, 0, "getStamina", "");
                llMessageLinked(LINK_SET, 0, "getMana", "");
                llMessageLinked(LINK_SET, 0, "getXP", "");
                llMessageLinked(LINK_SET, 0, "getClass", "");
                llMessageLinked(LINK_SET, 0, "getSpecies", "");
                llMessageLinked(LINK_SET, 0, "getHasMana", "");
                llMessageLinked(LINK_SET, 0, "getSpeciesFactors", "");
                llMessageLinked(LINK_SET, 0, "getGender", "");
                llMessageLinked(LINK_SET, 0, "getCurrency", "");
                llMessageLinked(LINK_SET, 0, "getMode", "");
                llMessageLinked(LINK_SET, 0, "getUniverseId", "");
                notify("Synchronizing character data with server...");
            }
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Character data loaded from Firestore
        if (msg == "character loaded from firestore") {
            debugLog("Character data received from Firestore, loading...");
            
            // Check universe_id to enforce one character → one universe rule
            string universeId = llLinksetDataRead("universe_id");
            if (universeId != "" && universeId != HUD_UNIVERSE_ID) {
                notify("Warning: This character belongs to universe '" + universeId +
                       "' but this HUD is for universe '" + HUD_UNIVERSE_ID + "'.");
            }
            
            // Load species factors and has_mana from LSD (set by Data Manager)
            string healthFactorStr = llLinksetDataRead("health_factor");
            string staminaFactorStr = llLinksetDataRead("stamina_factor");
            string manaFactorStr = llLinksetDataRead("mana_factor");
            string hasManaStr = llLinksetDataRead("has_mana");
            
            if (healthFactorStr != "") {
                healthFactor = (integer)healthFactorStr;
                debugLog("Health factor: " + (string)healthFactor);
            }
            if (staminaFactorStr != "") {
                staminaFactor = (integer)staminaFactorStr;
                debugLog("Stamina factor: " + (string)staminaFactor);
            }
            if (manaFactorStr != "") {
                manaFactor = (integer)manaFactorStr;
                debugLog("Mana factor: " + (string)manaFactor);
            }
            if (hasManaStr != "") {
                hasMana = (integer)hasManaStr;
                debugLog("Has mana: " + (string)hasMana);
            }
            
            // Request all data from Data Manager
            llMessageLinked(LINK_SET, 0, "load stats", "");
            llMessageLinked(LINK_SET, 0, "load health", "");
            llMessageLinked(LINK_SET, 0, "load stamina", "");
            llMessageLinked(LINK_SET, 0, "load mana", "");
            
            // Check if Setup HUD was auto-shown and should be hidden after character creation
            string autoHide = llLinksetDataRead("auto_hide_setup");
            if (autoHide == "TRUE") {
                llLinksetDataDelete("auto_hide_setup");
                llSleep(2.0);  // Wait for data to be fully saved
                // Route hide command to HUD_MOAP
                llMessageLinked(LINK_SET, 2001, "HIDE_SETUP_HUD", "");
                debugLog("Character created! Switching to Players HUD...");
            }
        }
        // Stats loaded from Data Manager
        else if (msg == "stats loaded") {
            myStats = llCSV2List((string)id);
            if (llGetListLength(myStats) == 20) {
                debugLog("Stats loaded: " + (string)llGetListLength(myStats) + " stats");
                
                // Ensure factors are loaded before calculating
                string healthFactorStr = llLinksetDataRead("health_factor");
                string staminaFactorStr = llLinksetDataRead("stamina_factor");
                string manaFactorStr = llLinksetDataRead("mana_factor");
                string hasManaStr = llLinksetDataRead("has_mana");
                
                if (healthFactorStr != "") healthFactor = (integer)healthFactorStr;
                if (staminaFactorStr != "") staminaFactor = (integer)staminaFactorStr;
                if (manaFactorStr != "") manaFactor = (integer)manaFactorStr;
                if (hasManaStr != "") hasMana = (integer)hasManaStr;
                
                // Recalculate resource pools based on new stats
                // This ensures base values are set even if they weren't loaded from Firestore
                calculateHealth();
                calculateStamina();
                calculateMana();
                debugLog("Calculated pools - Health: " + (string)baseHealth + ", Stamina: " + (string)baseStamina + ", Mana: " + (string)baseMana);
                
                // If base values are still 0, something is wrong - set defaults
                if (baseHealth == 0) {
                    debugLog("WARNING: baseHealth is 0, setting default");
                    baseHealth = 100;
                    currentHealth = 100;
                }
                if (baseStamina == 0) {
                    debugLog("WARNING: baseStamina is 0, setting default");
                    baseStamina = 100;
                    currentStamina = 100;
                }
                
                // Update displays
                updateResourceDisplays();
            } else {
                debugLog("ERROR: Stats list length is " + (string)llGetListLength(myStats) + ", expected 20");
            }
        }
        // Health loaded from Data Manager
        else if (msg == "health loaded") {
            currentHealth = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseHealth = (integer)llList2String(parts, 0);
                integer maxHealth = (integer)llList2String(parts, 1);
                if (maxHealth > 0) baseHealth = maxHealth;  // Use max if available
            }
            // If baseHealth is still 0, recalculate from stats (ensure factors are loaded first)
            if (baseHealth == 0 && llGetListLength(myStats) == 20) {
                string healthFactorStr = llLinksetDataRead("health_factor");
                if (healthFactorStr != "") healthFactor = (integer)healthFactorStr;
                calculateHealth();
                // If still 0, set default
                if (baseHealth == 0) {
                    baseHealth = 100;
                    currentHealth = 100;
                }
            }
            debugLog("Health loaded: " + (string)currentHealth + "/" + (string)baseHealth);
            updateResourceDisplays();
        }
        // Stamina loaded from Data Manager
        else if (msg == "stamina loaded") {
            currentStamina = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseStamina = (integer)llList2String(parts, 0);
                integer maxStamina = (integer)llList2String(parts, 1);
                if (maxStamina > 0) baseStamina = maxStamina;  // Use max if available
            }
            // If baseStamina is still 0, recalculate from stats (ensure factors are loaded first)
            if (baseStamina == 0 && llGetListLength(myStats) == 20) {
                string staminaFactorStr = llLinksetDataRead("stamina_factor");
                if (staminaFactorStr != "") staminaFactor = (integer)staminaFactorStr;
                calculateStamina();
                // If still 0, set default
                if (baseStamina == 0) {
                    baseStamina = 100;
                    currentStamina = 100;
                }
            }
            debugLog("Stamina loaded: " + (string)currentStamina + "/" + (string)baseStamina);
            updateResourceDisplays();
        }
        // Mana loaded from Data Manager
        else if (msg == "mana loaded") {
            currentMana = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseMana = (integer)llList2String(parts, 0);
                integer maxMana = (integer)llList2String(parts, 1);
                if (maxMana > 0) baseMana = maxMana;  // Use max if available
            }
            // If baseMana is still 0, recalculate from stats (ensure factors are loaded first)
            if (baseMana == 0 && llGetListLength(myStats) == 20) {
                string manaFactorStr = llLinksetDataRead("mana_factor");
                string hasManaStr = llLinksetDataRead("has_mana");
                if (manaFactorStr != "") manaFactor = (integer)manaFactorStr;
                if (hasManaStr != "") hasMana = (integer)hasManaStr;
                calculateMana();
                // Note: baseMana can legitimately be 0 if hasMana is FALSE
            }
            debugLog("Mana loaded: " + (string)currentMana + "/" + (string)baseMana + " (has_mana: " + (string)hasMana + ")");
            updateResourceDisplays();
        }
        // XP loaded from Data Manager
        else if (msg == "xp loaded") {
            myXP = num;
            updateResourceDisplays();
        }
        // Class loaded from Data Manager
        else if (msg == "class loaded") {
            myClass = (string)id;
            if (myClass == "") {
                debugLog("WARNING: Class is empty! (id='" + (string)id + "', length=" + (string)llStringLength((string)id) + ")");
                // Try to read directly from LSD as fallback
                string directRead = llLinksetDataRead("class");
                if (directRead != "") {
                    debugLog("Found class in LSD directly: '" + directRead + "'");
                    myClass = directRead;
                    setPrimText("rp_class", myClass);
                }
            } else {
                debugLog("Class: " + myClass);
                setPrimText("rp_class", myClass);
            }
        }
        // Update health (from external sources)
        else if (msg == "update health") {
            currentHealth = num;
            if (currentHealth < 0) currentHealth = 0;
            calculateHealth();
            updateResourceDisplays();
            // Save to Data Manager
            llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
        }
        // Update stamina (from external sources)
        else if (msg == "update stamina") {
            currentStamina = num;
            if (currentStamina < 0) currentStamina = 0;
            calculateStamina();
            updateResourceDisplays();
            // Save to Data Manager
            llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
        }
        // Update mana (from external sources)
        else if (msg == "update mana") {
            currentMana = num;
            if (currentMana < 0) currentMana = 0;
            calculateMana();
            updateResourceDisplays();
            // Save to Data Manager
            llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
        }
        // Update XP (from external sources)
        else if (msg == "update xp") {
            myXP = num;
            updateResourceDisplays();
            // Save to Data Manager
            llMessageLinked(LINK_SET, myXP, "save xp", "");
        }
        // Hard reset
        else if (msg == "hard reset") {
            llResetScript();
        }
        // Rest mode
        else if (msg == "rest") {
            isResting = TRUE;
            llOwnerSay("Resting...");
            // Start rest timer - restore resources over time
            llSetTimerEvent(5.0);  // Check every 5 seconds
        }
        // Stop resting
        else if (msg == "stop resting") {
            isResting = FALSE;
            llSetTimerEvent(0.0);
            llOwnerSay("Stopped resting.");
        }
        // Mode changes
        else if (msg == "tournament mode") {
            mode = "tournament";
            // Tournament mode: fixed health/stamina
            baseHealth = 100;
            baseStamina = 100;
            baseMana = 50;
            currentHealth = baseHealth;
            currentStamina = baseStamina;
            currentMana = baseMana;
            updateResourceDisplays();
        }
        else if (msg == "roleplay mode") {
            mode = "roleplay";
            // Recalculate based on stats
            calculateHealth();
            calculateStamina();
            calculateMana();
            updateResourceDisplays();
        }
        else if (msg == "ooc mode") {
            mode = "ooc";
        }
        else if (msg == "afk mode") {
            mode = "afk";
        }
        // Reset character (OOC reset)
        else if (msg == "reset character") {
            // Reset to full health/stamina/mana
            calculateHealth();
            calculateStamina();
            calculateMana();
            currentHealth = baseHealth;
            currentStamina = baseStamina;
            currentMana = baseMana;
            updateResourceDisplays();
            // Save to Data Manager
            llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
            llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
        }
    }
    
    listen(integer channel, string name, key id, string message) {
        // Handle external communications
        if (channel == HUD_CHANNEL) {
            // Commands from external sources (weapons, combat, etc.)
            list parts = llParseString2List(message, [","], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "damage") {
                integer damage = (integer)llList2String(parts, 1);
                currentHealth -= damage;
                if (currentHealth < 0) currentHealth = 0;
                calculateHealth();
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            }
            else if (cmd == "heal") {
                integer heal = (integer)llList2String(parts, 1);
                currentHealth += heal;
                calculateHealth();
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            }
            else if (cmd == "drain stamina") {
                integer drain = (integer)llList2String(parts, 1);
                currentStamina -= drain;
                if (currentStamina < 0) currentStamina = 0;
                calculateStamina();
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
            }
            else if (cmd == "restore stamina") {
                integer restore = (integer)llList2String(parts, 1);
                currentStamina += restore;
                calculateStamina();
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
            }
            else if (cmd == "drain mana") {
                integer drain = (integer)llList2String(parts, 1);
                currentMana -= drain;
                if (currentMana < 0) currentMana = 0;
                calculateMana();
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
            }
            else if (cmd == "restore mana") {
                integer restore = (integer)llList2String(parts, 1);
                currentMana += restore;
                calculateMana();
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
            }
            else if (cmd == "add xp") {
                integer xpGain = (integer)llList2String(parts, 1);
                myXP += xpGain;
                updateResourceDisplays();
                // Save to Data Manager
                llMessageLinked(LINK_SET, myXP, "save xp", "");
            }
        }
    }
    
    timer() {
        if (isResting) {
            // Resting: restore resources over time
            integer healthRestore = 5;
            integer staminaRestore = 10;
            integer manaRestore = 5;
            
            if (currentHealth < baseHealth) {
                currentHealth += healthRestore;
                if (currentHealth > baseHealth) currentHealth = baseHealth;
            }
            if (currentStamina < baseStamina) {
                currentStamina += staminaRestore;
                if (currentStamina > baseStamina) currentStamina = baseStamina;
            }
            if (currentMana < baseMana) {
                currentMana += manaRestore;
                if (currentMana > baseMana) currentMana = baseMana;
            }
            
            updateResourceDisplays();
            
            // Save to Data Manager every 30 seconds while resting
            timerCount++;
            if (timerCount >= 6) {  // 6 * 5 seconds = 30 seconds
                timerCount = 0;
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
                llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
                llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
            }
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // HUD attached - Combined HUD Controller will handle data loading
            // Don't request loads here to prevent cascade
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

