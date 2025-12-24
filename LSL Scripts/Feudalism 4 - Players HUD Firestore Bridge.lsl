// ============================================================================
// Feudalism 4 - Players HUD Firestore Bridge
// ============================================================================
// Handles HTTP/JSON communication between LSL and Firestore backend
// Uses HTTP requests to load/save character data independently of MOAP
// ============================================================================

// =========================== CONFIGURATION ==================================
// Firebase project configuration
// TODO: Replace with your actual Firebase project details
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
string FIREBASE_API_KEY = "";  // Get from Firebase Console > Project Settings > General > Web API Key

// For now, we'll use a Cloud Function or HTTP endpoint
// If you have Firebase Functions set up, use that URL
// Otherwise, we can use Firestore REST API directly (requires auth token)
string BACKEND_API_URL = "";  // e.g., "https://us-central1-feudalism4-rpg.cloudfunctions.net/api"

// Communication - using link_message for Data Manager (same linkset)
// No channel needed

// =========================== STATE VARIABLES ================================
key ownerKey;
string ownerUUID;
string ownerUsername;
string ownerDisplayName;
key httpRequestId;
string sessionToken;
integer authenticated = FALSE;

// =========================== UTILITY FUNCTIONS ==============================

// Generate JSON request for backend
string buildJSONRequest(string action, list data) {
    string json = "{\"action\":\"" + action + "\"";
    json += ",\"uuid\":\"" + ownerUUID + "\"";
    if (sessionToken != "") {
        json += ",\"token\":\"" + sessionToken + "\"";
    }
    if (llGetListLength(data) > 0) {
        json += ",\"data\":" + llList2String(data, 0);
    }
    json += "}";
    return json;
}

// Convert character JSON object to CHARACTER_DATA format
// Input: JSON string like {"class_id":"squire","stats":{"agility":2,...},"health":{"current":100,"base":100,"max":100},...}
// Output: CHARACTER_DATA|stats:2,2,2,...|health:100,100,100|class:squire|...
string convertCharacterJSONToCHARACTER_DATA(string charJson) {
    string charData = "CHARACTER_DATA|";
    
    // Extract class_id
    integer classPos = llSubStringIndex(charJson, "\"class_id\":");
    if (classPos != -1) {
        string afterClass = llGetSubString(charJson, classPos + 11, -1);
        integer quote1 = llSubStringIndex(afterClass, "\"");
        if (quote1 != -1) {
            string afterQuote1 = llGetSubString(afterClass, quote1 + 1, -1);
            integer quote2 = llSubStringIndex(afterQuote1, "\"");
            if (quote2 != -1) {
                string classId = llGetSubString(afterQuote1, 0, quote2 - 1);
                charData += "class:" + classId + "|";
            }
        }
    }
    
    // Extract stats - need to parse stats object
    // Stats format: {"agility":2,"athletics":2,...}
    integer statsPos = llSubStringIndex(charJson, "\"stats\":");
    if (statsPos != -1) {
        string afterStats = llGetSubString(charJson, statsPos + 9, -1);
        integer braceStart = llSubStringIndex(afterStats, "{");
        if (braceStart != -1) {
            integer braceCount = 1;
            integer i = braceStart + 1;
            integer statsEnd = -1;
            while (i < llStringLength(afterStats) && braceCount > 0) {
                string char = llGetSubString(afterStats, i, i);
                if (char == "{") braceCount++;
                else if (char == "}") {
                    braceCount--;
                    if (braceCount == 0) {
                        statsEnd = i;
                        jump statsDone;
                    }
                }
                i++;
            }
            @statsDone;
            if (statsEnd != -1) {
                string statsJson = llGetSubString(afterStats, braceStart, statsEnd);
                // Parse stats in order: agility, animal_handling, athletics, awareness, crafting, deception, endurance, entertaining, fighting, healing, influence, intelligence, knowledge, marksmanship, persuasion, stealth, survival, thievery, will, wisdom
                list statNames = ["agility", "animal_handling", "athletics", "awareness", "crafting", "deception", "endurance", "entertaining", "fighting", "healing", "influence", "intelligence", "knowledge", "marksmanship", "persuasion", "stealth", "survival", "thievery", "will", "wisdom"];
                list statValues = [];
                integer j;
                for (j = 0; j < llGetListLength(statNames); j++) {
                    string statName = llList2String(statNames, j);
                    integer statPos = llSubStringIndex(statsJson, "\"" + statName + "\":");
                    if (statPos != -1) {
                        string afterStat = llGetSubString(statsJson, statPos + llStringLength(statName) + 3, -1);
                        // Find the number value
                        integer numStart = -1;
                        integer numEnd = -1;
                        integer k;
                        for (k = 0; k < llStringLength(afterStat); k++) {
                            string c = llGetSubString(afterStat, k, k);
                            if (llSubStringIndex("0123456789", c) != -1) {
                                if (numStart == -1) numStart = k;
                                numEnd = k;
                            } else if (numStart != -1) {
                                jump numDone;
                            }
                        }
                        @numDone;
                        if (numStart != -1) {
                            string statValue = llGetSubString(afterStat, numStart, numEnd);
                            statValues += [(integer)statValue];
                        } else {
                            statValues += [2]; // Default
                        }
                    } else {
                        statValues += [2]; // Default if not found
                    }
                }
                charData += "stats:" + llList2CSV(statValues) + "|";
            }
        }
    }
    
    // Extract health, stamina, mana
    // Format: {"current":100,"base":100,"max":100}
    list resources = ["health", "stamina", "mana"];
    integer r;
    for (r = 0; r < llGetListLength(resources); r++) {
        string resName = llList2String(resources, r);
        integer resPos = llSubStringIndex(charJson, "\"" + resName + "\":");
        if (resPos != -1) {
            string afterRes = llGetSubString(charJson, resPos + llStringLength(resName) + 3, -1);
            integer braceStart = llSubStringIndex(afterRes, "{");
            if (braceStart != -1) {
                integer braceCount = 1;
                integer i = braceStart + 1;
                integer resEnd = -1;
                while (i < llStringLength(afterRes) && braceCount > 0) {
                    string char = llGetSubString(afterRes, i, i);
                    if (char == "{") braceCount++;
                    else if (char == "}") {
                        braceCount--;
                        if (braceCount == 0) {
                            resEnd = i;
                            jump resDone;
                        }
                    }
                    i++;
                }
                @resDone;
                if (resEnd != -1) {
                    string resJson = llGetSubString(afterRes, braceStart, resEnd);
                    // Extract current, base, max
                    integer current = extractIntFromJSON(resJson, "current");
                    integer base = extractIntFromJSON(resJson, "base");
                    integer max = extractIntFromJSON(resJson, "max");
                    if (current == 0) current = base; // Default to base if current is 0
                    if (max == 0) max = base; // Default to base if max is 0
                    charData += resName + ":" + (string)current + "," + (string)base + "," + (string)max + "|";
                }
            }
        }
    }
    
    // Extract xp_total
    integer xpPos = llSubStringIndex(charJson, "\"xp_total\":");
    if (xpPos != -1) {
        string afterXp = llGetSubString(charJson, xpPos + 11, -1);
        integer numStart = -1;
        integer numEnd = -1;
        integer i;
        for (i = 0; i < llStringLength(afterXp); i++) {
            string c = llGetSubString(afterXp, i, i);
            if (llSubStringIndex("0123456789", c) != -1) {
                if (numStart == -1) numStart = i;
                numEnd = i;
            } else if (numStart != -1) {
                jump xpDone;
            }
        }
        @xpDone;
        if (numStart != -1) {
            string xpValue = llGetSubString(afterXp, numStart, numEnd);
            charData += "xp:" + xpValue + "|";
        }
    }
    
    // Extract has_mana
    integer hasManaPos = llSubStringIndex(charJson, "\"has_mana\":");
    if (hasManaPos != -1) {
        string afterHasMana = llGetSubString(charJson, hasManaPos + 11, -1);
        integer boolEnd = llSubStringIndex(afterHasMana, ",");
        if (boolEnd == -1) boolEnd = llSubStringIndex(afterHasMana, "}");
        if (boolEnd == -1) boolEnd = llStringLength(afterHasMana);
        string hasManaStr = llGetSubString(afterHasMana, 0, boolEnd - 1);
        integer hasMana = (integer)hasManaStr;
        charData += "has_mana:" + (string)hasMana;
    }
    
    return charData;
}

// Helper function to extract integer from JSON object
integer extractIntFromJSON(string json, string key) {
    integer keyPos = llSubStringIndex(json, "\"" + key + "\":");
    if (keyPos != -1) {
        string afterKey = llGetSubString(json, keyPos + llStringLength(key) + 3, -1);
        integer numStart = -1;
        integer numEnd = -1;
        integer i;
        for (i = 0; i < llStringLength(afterKey); i++) {
            string c = llGetSubString(afterKey, i, i);
            if (llSubStringIndex("0123456789", c) != -1) {
                if (numStart == -1) numStart = i;
                numEnd = i;
            } else if (numStart != -1) {
                jump extractDone;
            }
        }
        @extractDone;
        if (numStart != -1) {
            return (integer)llGetSubString(afterKey, numStart, numEnd);
        }
    }
    return 0;
}

// =========================== HTTP HANDLERS ==================================

// Authenticate with backend and get session token
authenticate() {
    if (BACKEND_API_URL == "") {
        // Silently fail if not configured - this is expected until backend is set up
        return;
    }
    
    string json = "{\"action\":\"auth.login\",\"uuid\":\"" + ownerUUID + "\",\"username\":\"" + llEscapeURL(ownerUsername) + "\",\"displayname\":\"" + llEscapeURL(ownerDisplayName) + "\"}";
    
    httpRequestId = llHTTPRequest(
        BACKEND_API_URL,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        json
    );
    
    llOwnerSay("[Firestore Bridge] Authenticating with backend...");
}

// Load character data from backend
loadCharacterData() {
    if (BACKEND_API_URL == "") {
        // Silently fail if not configured - this is expected until backend is set up
        return;
    }
    
    if (!authenticated) {
        authenticate();
        return;
    }
    
    string json = buildJSONRequest("character.get", []);
    
    httpRequestId = llHTTPRequest(
        BACKEND_API_URL,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        json
    );
    
    llOwnerSay("[Firestore Bridge] Requesting character data from backend...");
}

// Save character data to backend
saveCharacterData(string characterData) {
    if (BACKEND_API_URL == "") {
        // Silently fail if not configured - this is expected until backend is set up
        return;
    }
    
    if (!authenticated) {
        authenticate();
        return;
    }
    
    string json = buildJSONRequest("character.update", [characterData]);
    
    httpRequestId = llHTTPRequest(
        BACKEND_API_URL,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        json
    );
    
    llOwnerSay("[Firestore Bridge] Saving character data to backend...");
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        ownerUUID = (string)ownerKey;
        ownerUsername = llGetUsername(ownerKey);
        ownerDisplayName = llGetDisplayName(ownerKey);
        
        llOwnerSay("[Firestore Bridge] Initialized for " + ownerDisplayName);
        if (BACKEND_API_URL == "") {
            llOwnerSay("[Firestore Bridge] NOTE: BACKEND_API_URL not configured - using local data only");
        } else {
            // Authenticate on startup if backend is configured
            authenticate();
        }
    }
    
    // Handle link messages from Data Manager
    link_message(integer sender_num, integer num, string msg, key id) {
        if (msg == "firestore_load") {
            loadCharacterData();
        }
        else if (msg == "firestore_save") {
            string data = (string)id;
            saveCharacterData(data);
        }
    }
    
    // Handle HTTP responses
    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id != httpRequestId) return;
        
        if (status == 200) {
            // Parse JSON response
            // Note: LSL doesn't have native JSON parsing, so we'll do basic string parsing
            integer successPos = llSubStringIndex(body, "\"success\":");
            if (successPos != -1) {
                // Extract success value
                string successStr = llGetSubString(body, successPos + 10, successPos + 14);
                integer success = (integer)successStr;
                
                if (success) {
                    // Extract action to determine what this response is for
                    integer actionPos = llSubStringIndex(body, "\"action\":");
                    if (actionPos != -1) {
                        // Find the opening quote after "action":"
                        string afterAction = llGetSubString(body, actionPos + 9, -1);
                        integer quotePos1 = llSubStringIndex(afterAction, "\"");
                        if (quotePos1 != -1) {
                            string afterQuote1 = llGetSubString(afterAction, quotePos1 + 1, -1);
                            integer quotePos2 = llSubStringIndex(afterQuote1, "\"");
                            if (quotePos2 != -1) {
                                string action = llGetSubString(afterQuote1, 0, quotePos2 - 1);
                        
                                if (action == "auth.login") {
                                    // Extract token
                                    integer tokenPos = llSubStringIndex(body, "\"token\":");
                                    if (tokenPos != -1) {
                                        string afterToken = llGetSubString(body, tokenPos + 8, -1);
                                        integer tokenQuote1 = llSubStringIndex(afterToken, "\"");
                                        if (tokenQuote1 != -1) {
                                            string afterTokenQuote1 = llGetSubString(afterToken, tokenQuote1 + 1, -1);
                                            integer tokenQuote2 = llSubStringIndex(afterTokenQuote1, "\"");
                                            if (tokenQuote2 != -1) {
                                                                sessionToken = llGetSubString(afterTokenQuote1, 0, tokenQuote2 - 1);
                                                authenticated = TRUE;
                                                llOwnerSay("[Firestore Bridge] Authenticated successfully");
                                                
                                                // Auto-load character data after authentication
                                                loadCharacterData();
                                            }
                                        }
                                    }
                                }
                                else if (action == "character.get") {
                                    // Extract character data from JSON response
                                    // Response format: {"success":true,"action":"character.get","data":{"character":{...}}}
                                    // We need to extract the character object and convert to CHARACTER_DATA format
                                    integer charPos = llSubStringIndex(body, "\"character\":");
                                    if (charPos != -1) {
                                        // Find the character object
                                        string afterChar = llGetSubString(body, charPos + 12, -1);
                                        // Find opening brace
                                        integer braceStart = llSubStringIndex(afterChar, "{");
                                        if (braceStart != -1) {
                                            // Find matching closing brace (simplified - assumes no nested objects)
                                            integer braceCount = 1;
                                            integer i = braceStart + 1;
                                            integer charEnd = -1;
                                            while (i < llStringLength(afterChar) && braceCount > 0) {
                                                string char = llGetSubString(afterChar, i, i);
                                                if (char == "{") braceCount++;
                                                else if (char == "}") {
                                                    braceCount--;
                                                    if (braceCount == 0) {
                                                        charEnd = i;
                                                        jump done;
                                                    }
                                                }
                                                i++;
                                            }
                                            @done;
                                            if (charEnd != -1) {
                                                string charJson = llGetSubString(afterChar, braceStart, charEnd);
                                                // Convert JSON character object to CHARACTER_DATA format
                                                string charData = convertCharacterJSONToCHARACTER_DATA(charJson);
                                                if (charData != "") {
                                                    llMessageLinked(LINK_SET, 0, "CHARACTER_DATA", charData);
                                                    llOwnerSay("[Firestore Bridge] Character data loaded and converted from backend");
                                                } else {
                                                    llOwnerSay("[Firestore Bridge] ERROR: Failed to convert character JSON to CHARACTER_DATA format");
                                                }
                                            }
                                        }
                                    } else {
                                        llOwnerSay("[Firestore Bridge] ERROR: No character object found in response");
                                    }
                                }
                                else if (action == "character.update") {
                                    llMessageLinked(LINK_SET, 0, "SAVE_CONFIRMED", "");
                                    llOwnerSay("[Firestore Bridge] Character data saved to backend");
                                }
                            }
                        }
                    }
                } else {
                    // Extract error message
                    integer errorPos = llSubStringIndex(body, "\"error\":");
                    if (errorPos != -1) {
                        string afterError = llGetSubString(body, errorPos + 8, -1);
                        integer errorQuote1 = llSubStringIndex(afterError, "\"");
                        if (errorQuote1 != -1) {
                            string afterErrorQuote1 = llGetSubString(afterError, errorQuote1 + 1, -1);
                            integer errorQuote2 = llSubStringIndex(afterErrorQuote1, "\"");
                            if (errorQuote2 != -1) {
                                string error = llGetSubString(afterErrorQuote1, 0, errorQuote2 - 1);
                                llOwnerSay("[Firestore Bridge] ERROR: " + error);
                            }
                        }
                    }
                }
            }
        } else {
            llOwnerSay("[Firestore Bridge] HTTP ERROR: Status " + (string)status);
            llOwnerSay("[Firestore Bridge] Response: " + llGetSubString(body, 0, 500));
        }
    }
    
    attach(key id) {
        if (id != NULL_KEY) {
            llSleep(1.0);
            if (BACKEND_API_URL != "") {
                authenticate();
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

