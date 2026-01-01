// ============================================================================
// Feudalism 4 - Combined HUD Controller
// ============================================================================
// Merges Players HUD and Setup HUD into a single linkset
// Rotates MOAP prim to switch between Players HUD view and Setup HUD view
// ============================================================================

// =========================== CONFIGURATION ==================================
// Development Mode: Set to TRUE to use preview channel URL, FALSE for production
integer DEV_MODE = FALSE;

// Universe ID for this HUD (enforces one character → one universe rule)
string HUD_UNIVERSE_ID = "feud4_core";

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[HUD] " + message);
    }
}

// GitHub Pages URL for the MOAP interface
// Production: https://feudalism-dev.github.io/feudalism4-HUD/hud.html
// Dev Channel: (same as production for now)
string MOAP_BASE_URL;

// MOAP Face (which face of the prim displays the web content)
integer MOAP_FACE = 4;

// MOAP dimensions
integer MOAP_WIDTH = 1024;
integer MOAP_HEIGHT = 768;

// MOAP Prim Name (child prim that contains the MOAP interface)
string MOAP_PRIM_NAME = "setup_moap";

// Button to toggle Setup HUD (touch this prim to open/close Setup HUD)
string SETUP_BUTTON_NAME = "btn_setup";  // Optional: can be empty to use chat command

// =========================== COMMUNICATION CHANNELS ========================
integer METER_CHANNEL = -77777;
integer MENU_CHANNEL = -777799;
integer METER_MODE_CHANNEL = -7777777;
integer HUD_CHANNEL = -77770;
integer WEAPON_CHANNEL = -77771;
integer WEAPON_CHANNEL2 = -77773;
integer PLAYERS_HUD_CHANNEL = -777700;  // Internal channel for Players HUD communication

// =========================== STATE VARIABLES ================================
// Owner info
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
integer hudChannel;  // Generated channel for MOAP communication

// HUD Mode
integer setupModeActive = FALSE;  // TRUE when Setup HUD is visible
integer moapPrimLink = -1;  // Link number of MOAP prim
float lastToggleTime = 0.0;  // Time of last toggle for debouncing

// Character data (Players HUD)
string myName;
list myStats;
integer myXP;
integer currentHealth;
integer currentStamina;
integer currentMana;
integer baseHealth;
integer baseStamina;
integer baseMana;
string myClass;
string actionSlotsJson = "";  // Action slots (LSD-only, no Firestore)
integer characterLoaded = FALSE;
integer resourcesInitialized = FALSE;  // Prevent duplicate resource initialization
integer loadRequestsSent = FALSE;  // Prevent duplicate load requests

// Species factors (stored from character data)
integer healthFactor = 25;
integer staminaFactor = 25;
integer manaFactor = 25;
integer hasMana = TRUE;  // Default to TRUE, will be set from character data

// Game mode
string mode = "roleplay";
integer isResting = FALSE;
integer isPassedOut = FALSE;
integer timerCount = 0;
// Character data now loaded via Firestore Bridge (HTTP-based), not MOAP
// Character data polling removed - now handled by Firestore Bridge via HTTP

// Inventory is now handled by HUD Inventory Controller script

// Stat indices
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

// Listeners
integer listenHandle;
integer syncListenHandle;

// =========================== UTILITY FUNCTIONS ==============================

// Generate a unique channel based on owner UUID
integer generateChannel(key id) {
    return -1 - (integer)("0x" + llGetSubString((string)id, 0, 6));
}

// Find link number by name
integer getLinkNumberByName(string linkName) {
    integer i = 0;
    while (i <= llGetNumberOfPrims()) {
        if (llGetLinkName(i) == linkName)
            return i;
        i++;
    }
    return -1;
}

// Set prim text
setPrimText(string primName, string value) {
    integer linkNum = getLinkNumberByName(primName);
    if (linkNum != -1) {
        llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, value, <1.000, 0.863, 0.000>, 0.8]);
    }
}

// Set MOAP URL on the MOAP prim
setMOAPUrl(string url) {
    if (moapPrimLink > 0) {
        llSetLinkMedia(moapPrimLink, MOAP_FACE, [
            PRIM_MEDIA_CURRENT_URL, url,
            PRIM_MEDIA_HOME_URL, url,
            PRIM_MEDIA_AUTO_PLAY, TRUE,
            PRIM_MEDIA_AUTO_SCALE, TRUE,
            PRIM_MEDIA_AUTO_ZOOM, TRUE,
            PRIM_MEDIA_WIDTH_PIXELS, MOAP_WIDTH,
            PRIM_MEDIA_HEIGHT_PIXELS, MOAP_HEIGHT
        ]);
    }
}

// Clear MOAP display
clearMOAP() {
    if (moapPrimLink > 0) {
        llClearLinkMedia(moapPrimLink, MOAP_FACE);
    }
}

// =========================== DRIFT-FREE HUD POSITIONS ======================
// Hardcoded absolute positions - NEVER use relative movement or calculations
// These are the exact positions you provided - snap directly to these
vector SETUP_HUD_VISIBLE_POS = <0.0, 0.0, -0.44653>;
vector SETUP_HUD_HIDDEN_POS = <0.0, 0.0, 0.91040>;

// Move MOAP prim to show Setup HUD - snap directly to visible position
showSetupHUD() {
    // Check if already active - prevent duplicate calls
    if (setupModeActive) {
        return;
    }
    
    // FIRST: Set flag immediately to prevent race conditions
    setupModeActive = TRUE;
    
    if (moapPrimLink <= 0) {
        debugLog("ERROR: moapPrimLink is invalid: " + (string)moapPrimLink);
        setupModeActive = FALSE;  // Reset flag on error
        return;
    }
    
    debugLog("Showing Setup HUD");
    
    // Move panel into view
    llSetLinkPrimitiveParamsFast(moapPrimLink, [
        PRIM_POS_LOCAL,
        SETUP_HUD_VISIBLE_POS
    ]);
    
    // Wait for viewer to render the prim
    llSleep(0.3);
    
    // Build URL
    string hudUrl = MOAP_BASE_URL + "/hud.html";
    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
    hudUrl += "&username=" + llEscapeURL(ownerUsername);
    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
    hudUrl += "&channel=" + (string)hudChannel;
    hudUrl += "&t=" + (string)llGetUnixTime();
    
    // DO NOT clear MOAP here — it breaks autoplay
    setMOAPUrl(hudUrl);
    
    // Start timer to poll for MOAP commands
    llSetTimerEvent(1.0);
}

// Move MOAP prim to hide Setup HUD - snap directly to hidden position
hideSetupHUD() {
    // Check if already hidden - prevent duplicate calls
    if (!setupModeActive) {
        return;
    }
    
    if (moapPrimLink <= 0) {
        debugLog("ERROR: moapPrimLink is invalid: " + (string)moapPrimLink);
        setupModeActive = FALSE;  // Reset flag on error
        return;
    }
    
    debugLog("Hiding Setup HUD");
    
    // Stop timer first
    llSetTimerEvent(0.0);
    
    // Move to hidden position
    llSetLinkPrimitiveParamsFast(moapPrimLink, [
        PRIM_POS_LOCAL,
        SETUP_HUD_HIDDEN_POS
    ]);
    
    // Clear MOAP
    clearMOAP();
    
    // LAST: Set flag to FALSE after everything is done
    // This ensures that if a link message arrives while hiding, it sees TRUE and returns early
    setupModeActive = FALSE;
}

// Calculate resource pools from stats
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
    // Only calculate if we have stats
    if (llGetListLength(myStats) != 20) {
        return;
    }
    integer newBaseMana = (llList2Integer(myStats, WISDOM) + 
                           llList2Integer(myStats, INTELLIGENCE)) * manaFactor;
    // Only update if we don't already have a valid baseMana from LSD
    // This prevents overwriting loaded values
    if (baseMana == 0 || newBaseMana > baseMana) {
        baseMana = newBaseMana;
    }
    if (currentMana > baseMana) currentMana = baseMana;
    if (currentMana < 0) currentMana = 0;
}

// Update resource displays (Players HUD)
updateResourceDisplays() {
    llMessageLinked(LINK_SET, currentHealth, "set health display", (string)baseHealth);
    llMessageLinked(LINK_SET, currentStamina, "set stamina display", (string)baseStamina);
    llMessageLinked(LINK_SET, currentMana, "set mana display", (string)baseMana);
    llMessageLinked(LINK_SET, myXP, "set xp display", "");
}

// Send notification
notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Announce to local chat
announce(string message) {
    llSay(0, message);
}

// Inventory menu functions moved to HUD Inventory Controller script

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        // Generate unique communication channel
        hudChannel = generateChannel(ownerKey);
        
        // Set MOAP URL based on DEV_MODE
        if (DEV_MODE) {
            MOAP_BASE_URL = "https://feudalism-dev.github.io/feudalism4-HUD";
            debugLog("Running in DEV mode - Using GitHub Pages URL");
        } else {
            MOAP_BASE_URL = "https://feudalism-dev.github.io/feudalism4-HUD";
            debugLog("Running in PRODUCTION mode - Using GitHub Pages URL");
        }
        
        // Find MOAP prim
        moapPrimLink = getLinkNumberByName(MOAP_PRIM_NAME);
        if (moapPrimLink == -1) {
            debugLog("WARNING: MOAP prim '" + MOAP_PRIM_NAME + "' not found!");
        }
        
        // Inventory menu is now handled by HUD Inventory Controller script
        
        // Initialize Setup HUD - snap directly to hidden position
        if (moapPrimLink > 0) {
            debugLog("Initializing Setup HUD - MOAP prim link: " + (string)moapPrimLink);
            
            // Small delay to ensure prim is ready
            llSleep(0.1);
            
            // Snap directly to hidden position - NO calculations, NO reading current pos
            llSetLinkPrimitiveParamsFast(moapPrimLink, [
                PRIM_POS_LOCAL,
                SETUP_HUD_HIDDEN_POS
            ]);
            
            // Verify position was set
            llSleep(0.1);
            vector actualPos = llList2Vector(llGetLinkPrimitiveParams(moapPrimLink, [PRIM_POS_LOCAL]), 0);
            debugLog("Setup HUD initialized - Target: " + (string)SETUP_HUD_HIDDEN_POS + ", Actual: " + (string)actualPos);
            
            // DON'T set MOAP URL here - prim is hidden/off-screen, so autoplay won't fire
            // We'll set it in showSetupHUD() after moving the prim into view
            clearMOAP();
        }
        
        // Load species factors and has_mana from LSD FIRST (before processing stats)
        // This ensures calculateMana() has the correct hasMana value and prevents blinking
        string healthFactorStr = llLinksetDataRead("health_factor");
        string staminaFactorStr = llLinksetDataRead("stamina_factor");
        string manaFactorStr = llLinksetDataRead("mana_factor");
        string hasManaStr = llLinksetDataRead("has_mana");
        
        if (healthFactorStr != "") {
            healthFactor = (integer)healthFactorStr;
        }
        if (staminaFactorStr != "") {
            staminaFactor = (integer)staminaFactorStr;
        }
        if (manaFactorStr != "") {
            manaFactor = (integer)manaFactorStr;
        }
        if (hasManaStr != "") {
            hasMana = (integer)hasManaStr;
        }
        
        // Set up listeners
        listenHandle = llListen(hudChannel, "", NULL_KEY, "");
        syncListenHandle = llListen(PLAYERS_HUD_CHANNEL, "", NULL_KEY, "");
        llListen(HUD_CHANNEL, "", NULL_KEY, "");
        
        // Data Manager will send load requests itself in state_entry
        // Don't send duplicate loads here - wait for Data Manager to initialize
        // This prevents cascade of load requests
    }
    
    // Handle touch events
    touch_start(integer num) {
        key toucher = llDetectedKey(0);
        if (toucher != ownerKey) return;
        
        integer linkNum = llDetectedLinkNumber(0);
        string linkName = llGetLinkName(linkNum);
        
        // Toggle Setup HUD if setup button is touched
        if (SETUP_BUTTON_NAME != "" && linkName == SETUP_BUTTON_NAME) {
            if (setupModeActive) {
                hideSetupHUD();
            } else {
                showSetupHUD();
            }
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
            
            // Simple hard toggle based on current state
            if (setupModeActive == FALSE) {
                // Show Setup HUD
                showSetupHUD();
            } else {
                // Hide Setup HUD
                hideSetupHUD();
            }
        }
        // Show inventory menu if rp_inventory is touched (route to Inventory Controller)
        else if (linkName == "rp_inventory") {
            llMessageLinked(LINK_SET, 0, "show_inventory_menu", "");
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
    
    // Handle link messages from other scripts
    link_message(integer sender_num, integer num, string msg, key id) {
        // Handle Bridge responses on FS_BRIDGE_CHANNEL
        if (num == -777001) {
            // ACTIVE_CHARACTER_SET response
            if (msg == "ACTIVE_CHARACTER_SET") {
                string characterID = (string)id;
                debugLog("Active character set: " + characterID);
                // Update URL to notify HUD (HUD will poll for this)
                if (setupModeActive && moapPrimLink > 0) {
                    string hudUrl = MOAP_BASE_URL + "/hud.html";
                    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                    hudUrl += "&username=" + llEscapeURL(ownerUsername);
                    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                    hudUrl += "&channel=" + (string)hudChannel;
                    hudUrl += "&active_char=" + llEscapeURL(characterID);
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                }
            }
            // ACTIVE_CHARACTER response (from GET_ACTIVE_CHARACTER)
            else if (msg == "ACTIVE_CHARACTER") {
                string characterID = (string)id;
                debugLog("Active character retrieved: " + characterID);
                // Update URL to notify HUD
                if (setupModeActive && moapPrimLink > 0) {
                    string hudUrl = MOAP_BASE_URL + "/hud.html";
                    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                    hudUrl += "&username=" + llEscapeURL(ownerUsername);
                    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                    hudUrl += "&channel=" + (string)hudChannel;
                    if (characterID != "null" && characterID != "") {
                        hudUrl += "&active_char=" + llEscapeURL(characterID);
                    }
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                }
            }
            // Error responses
            else if (llSubStringIndex(msg, "ACTIVE_CHARACTER") == 0 && llSubStringIndex(msg, "ERROR") != -1) {
                string errorMsg = (string)id;
                debugLog("Active character error: " + msg + " - " + errorMsg);
                notify("Error setting active character: " + errorMsg);
            }
            return;
        }
        
        // Character data loaded from Firestore (via Data Manager)
        if (msg == "character loaded from firestore") {
                debugLog("Character data received from Firestore");
            
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
            
            llMessageLinked(LINK_SET, 0, "load stats", "");
            llMessageLinked(LINK_SET, 0, "load health", "");
            llMessageLinked(LINK_SET, 0, "load stamina", "");
            llMessageLinked(LINK_SET, 0, "load mana", "");
            llMessageLinked(LINK_SET, 0, "load xp", "");
            llMessageLinked(LINK_SET, 0, "load class", "");
            llMessageLinked(LINK_SET, 0, "load action_slots", "");
            
            // Check if Setup HUD was auto-shown and should be hidden after character creation
            string autoHide = llLinksetDataRead("auto_hide_setup");
            if (autoHide == "TRUE" && setupModeActive) {
                llLinksetDataDelete("auto_hide_setup");
                llSleep(2.0);  // Wait for data to be fully saved
                hideSetupHUD();
                debugLog("Character created! Switching to Players HUD...");
            }
        }
        // Stats loaded
        else if (msg == "stats loaded") {
            myStats = llCSV2List((string)id);
            if (llGetListLength(myStats) == 20) {
                // Only calculate if not already initialized
                if (!resourcesInitialized) {
                    calculateHealth();
                    calculateStamina();
                    calculateMana();
                }
                updateResourceDisplays();
            } else {
                debugLog("WARNING: Expected 20 stats but got " + (string)llGetListLength(myStats));
            }
        }
        // Health loaded
        else if (msg == "health loaded") {
            // Only update current if loaded value is > 0 (preserve existing value if already set)
            if (num > 0) currentHealth = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseHealth = (integer)llList2String(parts, 0);
                integer maxHealth = (integer)llList2String(parts, 1);
                if (maxHealth > 0) baseHealth = maxHealth;
            }
            // Only initialize if not already initialized and we have stats
            if (!resourcesInitialized && baseHealth == 0 && llGetListLength(myStats) == 20) {
                calculateHealth();
                // If current is 0 and we just calculated base, set current to base (full health)
                if (currentHealth == 0) {
                    currentHealth = baseHealth;
                    // Save immediately so it doesn't get overwritten
                    llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
                }
            }
            updateResourceDisplays();
        }
        // Stamina loaded
        else if (msg == "stamina loaded") {
            // Only update current if loaded value is > 0 (preserve existing value if already set)
            if (num > 0) currentStamina = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                baseStamina = (integer)llList2String(parts, 0);
                integer maxStamina = (integer)llList2String(parts, 1);
                if (maxStamina > 0) baseStamina = maxStamina;
            }
            // Only initialize if not already initialized and we have stats
            if (!resourcesInitialized && baseStamina == 0 && llGetListLength(myStats) == 20) {
                calculateStamina();
                // If current is 0 and we just calculated base, set current to base (full stamina)
                if (currentStamina == 0) {
                    currentStamina = baseStamina;
                    // Save immediately so it doesn't get overwritten
                    llMessageLinked(LINK_SET, currentStamina, "save stamina", (string)baseStamina + "|" + (string)baseStamina);
                }
            }
            updateResourceDisplays();
        }
        // Mana loaded
        else if (msg == "mana loaded") {
            // Only update current if loaded value is > 0 (preserve existing value if already set)
            if (num > 0) currentMana = num;
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                integer loadedBase = (integer)llList2String(parts, 0);
                integer maxMana = (integer)llList2String(parts, 1);
                if (maxMana > 0) {
                    baseMana = maxMana;
                } else if (loadedBase > 0) {
                    baseMana = loadedBase;
                }
            }
            // Only initialize if not already initialized, we have stats, AND we don't have a valid loaded value
            // This prevents recalculating when we already have data from LSD
            if (!resourcesInitialized && baseMana == 0 && llGetListLength(myStats) == 20) {
                // Make sure hasMana is loaded before calculating
                if (hasMana) {
                    calculateMana();
                    // If current is 0 and we just calculated base, set current to base (full mana)
                    if (currentMana == 0) {
                        currentMana = baseMana;
                        // Save immediately so it doesn't get overwritten
                        llMessageLinked(LINK_SET, currentMana, "save mana", (string)baseMana + "|" + (string)baseMana);
                    }
                } else {
                    // No mana for this character
                    baseMana = 0;
                    currentMana = 0;
                }
            }
            // Mark as initialized once all three resources have been processed
            if (baseHealth > 0 && baseStamina > 0 && (baseMana > 0 || !hasMana)) {
                resourcesInitialized = TRUE;
            }
            updateResourceDisplays();
        }
        // XP loaded
        else if (msg == "xp loaded") {
            myXP = num;
            updateResourceDisplays();
        }
        // Class loaded
        else if (msg == "class loaded") {
            myClass = (string)id;
            if (myClass != "") {
                setPrimText("rp_class", myClass);
            }
        }
        else if (msg == "action_slots loaded") {
            actionSlotsJson = (string)id;
            debugLog("Action slots loaded (length: " + (string)llStringLength(actionSlotsJson) + ")");
            // Forward to action bar script if needed:
            // llMessageLinked(LINK_SET, 0, "apply_action_slots", (key)actionSlotsJson);
        }
        else if (msg == "update_action_slots") {
            string newSlotsJson = (string)id;
            actionSlotsJson = newSlotsJson;
            llMessageLinked(LINK_SET, 0, "save action_slots", (key)newSlotsJson);
            debugLog("Action slots updated (length: " + (string)llStringLength(newSlotsJson) + ")");
        }
        // Setup HUD commands
        else if (msg == "show setup hud") {
            showSetupHUD();
        }
        else if (msg == "hide setup hud") {
            hideSetupHUD();
        }
        // Inventory messages are now handled by HUD Inventory Controller script
        // Data Manager requests are now handled by Firestore Bridge (HTTP-based)
        // No longer needed here - removed to eliminate MOAP dependency
    }
    
    // Handle messages from MOAP interface
    listen(integer channel, string name, key id, string message) {
        if (channel == hudChannel) {
            list parts = llParseString2List(message, ["|"], []);
            string cmd = llList2String(parts, 0);
            
            // Character data is now handled by Firestore Bridge via HTTP, not MOAP
            // This handler kept for backward compatibility but should not be used
            
            // Close Setup HUD command from MOAP - IGNORED (use rp_options prim to toggle)
            if (cmd == "CLOSE_SETUP") {
                debugLog("Ignoring CLOSE_SETUP from listen() - use rp_options prim");
                return;  // Ignore this command
            }
            // Other MOAP commands (ROLL, ANNOUNCE, etc.)
            else if (cmd == "ROLL") {
                string stat = llList2String(parts, 1);
                string dice = llList2String(parts, 2);
                string target = llList2String(parts, 3);
                string result = llList2String(parts, 4);
                string success = llList2String(parts, 5);
                
                string announcement = "⚔️ " + ownerDisplayName + " rolls " + stat + ": ";
                announcement += "[" + dice + "] = " + result + " vs DC " + target;
                if (success == "true") {
                    announcement += " ✅ SUCCESS!";
                } else {
                    announcement += " ❌ FAILURE";
                }
                announce(announcement);
            }
            else if (cmd == "ANNOUNCE") {
                string msg = llList2String(parts, 1);
                announce(msg);
            }
            else if (cmd == "NOTIFY") {
                string msg = llList2String(parts, 1);
                notify(msg);
            }
            // Mode change from Options tab
            else if (cmd == "MODE") {
                string mode = llList2String(parts, 1);
                llMessageLinked(LINK_SET, 0, mode + " mode", "");
                llRegionSayTo(llGetOwner(), METER_MODE_CHANNEL, "mode," + mode);
                notify("Mode set to " + mode);
            }
            // Show/Hide bars
            else if (cmd == "SHOW_BARS") {
                llMessageLinked(LINK_SET, 0, "show bars", "");
                llRegionSayTo(llGetOwner(), METER_MODE_CHANNEL, "healthbar,show");
                notify("Health and stamina bars will be shown");
            }
            else if (cmd == "HIDE_BARS") {
                llRegionSayTo(llGetOwner(), METER_MODE_CHANNEL, "healthbar,hide");
                notify("Health and stamina bars will be hidden");
            }
            // OOC Reset
            else if (cmd == "OOC_RESET") {
                llMessageLinked(LINK_SET, 0, "reset character", "");
                notify("Character resources reset");
            }
            // IC Rest
            else if (cmd == "IC_REST") {
                llMessageLinked(LINK_SET, 0, "rest", "");
                notify("Resting...");
            }
            // Stop Resting
            else if (cmd == "STOP_RESTING") {
                llMessageLinked(LINK_SET, 0, "stop resting", "");
                notify("Stopped resting");
            }
            // Set Active Character
            else if (cmd == "SET_ACTIVE_CHARACTER") {
                string userID = llList2String(parts, 1);
                string characterID = llList2String(parts, 2);
                if (userID != "" && characterID != "") {
                    // Forward to Bridge via link_message
                    llMessageLinked(LINK_SET, 0, "SET_ACTIVE_CHARACTER|" + userID + "|" + characterID, "");
                    debugLog("Forwarding SET_ACTIVE_CHARACTER to Bridge: " + userID + " -> " + characterID);
                }
            }
            // Get Active Character
            else if (cmd == "GET_ACTIVE_CHARACTER") {
                string userID = llList2String(parts, 1);
                if (userID != "") {
                    // Forward to Bridge via link_message
                    llMessageLinked(LINK_SET, 0, "GET_ACTIVE_CHARACTER|" + userID, "");
                    debugLog("Forwarding GET_ACTIVE_CHARACTER to Bridge: " + userID);
                }
            }
        }
        // Handle external HUD channel commands
        else if (channel == HUD_CHANNEL) {
            // Commands from external sources (weapons, combat, etc.)
            list parts = llParseString2List(message, [","], []);
            string cmd = llList2String(parts, 0);
            
            if (cmd == "damage") {
                integer damage = (integer)llList2String(parts, 1);
                currentHealth -= damage;
                if (currentHealth < 0) currentHealth = 0;
                calculateHealth();
                updateResourceDisplays();
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            }
            else if (cmd == "heal") {
                integer heal = (integer)llList2String(parts, 1);
                currentHealth += heal;
                calculateHealth();
                updateResourceDisplays();
                llMessageLinked(LINK_SET, currentHealth, "save health", (string)baseHealth + "|" + (string)baseHealth);
            }
            // Add other HUD_CHANNEL commands as needed
        }
        // Inventory menu dialogs and text input are now handled by HUD Inventory Controller script
    }
    
    timer() {
        
        // Poll for Setup HUD UI commands (like CLOSE_SETUP) when Setup HUD is active
        if (setupModeActive && moapPrimLink > 0) {
            list mediaParams = llGetLinkPrimitiveParams(moapPrimLink, [PRIM_MEDIA_CURRENT_URL]);
            string currentUrl = llList2String(mediaParams, 0);
            
            // Character data is now loaded via Firestore Bridge and stored in LSD by Data Manager
            // No need to poll URL for char_data parameter
            
            // Check if URL contains LSL command
            integer cmdPos = llSubStringIndex(currentUrl, "lsl_cmd=");
            if (cmdPos != -1) {
                // Extract command from URL
                string dataPart = llGetSubString(currentUrl, cmdPos + 8, -1);
                // Find end of command (next & or end of string)
                integer endPos = llSubStringIndex(dataPart, "&");
                if (endPos == -1) endPos = llStringLength(dataPart);
                string encodedCmd = llGetSubString(dataPart, 0, endPos - 1);
                
                // Decode and process command
                string command = llUnescapeURL(encodedCmd);
                debugLog("Received command from MOAP: " + command);
                
                // Parse and handle command directly
                // NOTE: CLOSE_SETUP is no longer used - rp_options prim handles toggle
                // Ignore CLOSE_SETUP commands to prevent conflicts with rp_options toggle
                if (command == "CLOSE_SETUP") {
                    debugLog("Ignoring CLOSE_SETUP command - use rp_options prim to toggle");
                    // Remove command from URL but don't hide
                    string hudUrl = MOAP_BASE_URL + "/hud.html";
                    hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                    hudUrl += "&username=" + llEscapeURL(ownerUsername);
                    hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                    hudUrl += "&channel=" + (string)hudChannel;
                    hudUrl += "&t=" + (string)llGetUnixTime();
                    setMOAPUrl(hudUrl);
                    return;
                } else {
                    // Send other commands via channel to trigger listen handler
                    llRegionSay(hudChannel, command);
                }
                
                // Remove command from URL by reloading URL without the command
                // This prevents reprocessing the same command
                string hudUrl = MOAP_BASE_URL + "/hud.html";
                hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                hudUrl += "&username=" + llEscapeURL(ownerUsername);
                hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                hudUrl += "&channel=" + (string)hudChannel;
                hudUrl += "&t=" + (string)llGetUnixTime();
                setMOAPUrl(hudUrl);
                debugLog("Cleared command from URL");
            }
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            // Don't automatically show Setup HUD on attach
            // User must click rp_options to show it
            // Data Manager will fetch from Firestore and load data
        } else {
            clearMOAP();
        }
    }
    
    on_rez(integer start_param) {
        llResetScript();
    }
    
    changed(integer change) {
        if (change & CHANGED_OWNER) {
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) {
            // Refresh MOAP after teleport
            if (setupModeActive && moapPrimLink > 0) {
                string hudUrl = MOAP_BASE_URL + "/hud.html";
                hudUrl += "?uuid=" + llEscapeURL(ownerUUID);
                hudUrl += "&username=" + llEscapeURL(ownerUsername);
                hudUrl += "&displayname=" + llEscapeURL(ownerDisplayName);
                hudUrl += "&channel=" + (string)hudChannel;
                hudUrl += "&t=" + (string)llGetUnixTime();
                setMOAPUrl(hudUrl);
            }
        }
    }
}

