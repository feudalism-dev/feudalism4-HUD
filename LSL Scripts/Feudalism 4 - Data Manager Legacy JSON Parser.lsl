// ============================================================================
// Feudalism 4 - Data Manager Legacy JSON Parser
// ============================================================================
// Handles legacy full-document JSON parsing (moved from Data Manager)
// This is backward-compatibility code for write_character_to_lsd
// ============================================================================

// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Legacy Parser] " + message);
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // No initialization needed - script responds to link messages
    }
    
    // Handle link messages from Firestore Bridge
    link_message(integer sender_num, integer num, string msg, key id) {
        // Handle write_character_to_lsd message from Firestore Bridge
        if (msg == "write_character_to_lsd") {
            string charDocJson = (string)id;
            if (charDocJson == "" || charDocJson == "JSON_INVALID") {
                return;
            }
            
            string fieldsJson = llJsonGetValue(charDocJson, ["fields"]);
            if (fieldsJson == JSON_INVALID || fieldsJson == "") {
                return;
            }
            
            // Extract and write stats (as CSV)
            string statsField = llJsonGetValue(fieldsJson, ["stats"]);
            if (statsField != JSON_INVALID && statsField != "") {
                string statsMapValue = llJsonGetValue(statsField, ["mapValue", "fields"]);
                if (statsMapValue != JSON_INVALID && statsMapValue != "") {
                    list statsList = [];
                    integer i;
                    for (i = 0; i < 20; i++) {
                        string statKey = (string)i;
                        string statField = llJsonGetValue(statsMapValue, [statKey]);
                        if (statField != JSON_INVALID && statField != "") {
                            string intValue = llJsonGetValue(statField, ["integerValue"]);
                            if (intValue != JSON_INVALID && intValue != "") {
                                // Remove quotes if present
                                if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                    intValue = llGetSubString(intValue, 1, -2);
                                }
                                statsList += [(integer)intValue];
                            }
                        }
                    }
                    if (llGetListLength(statsList) > 0) {
                        string statsCSV = llDumpList2String(statsList, ",");
                        llLinksetDataWrite("stats", statsCSV);
                    }
                }
            }
            
            // Extract and write health (as current|base|max)
            string healthField = llJsonGetValue(fieldsJson, ["health"]);
            if (healthField != JSON_INVALID && healthField != "") {
                string healthMapValue = llJsonGetValue(healthField, ["mapValue", "fields"]);
                if (healthMapValue != JSON_INVALID && healthMapValue != "") {
                    integer current = 0;
                    integer base = 0;
                    integer max = 0;
                    
                    string currentField = llJsonGetValue(healthMapValue, ["current"]);
                    if (currentField != JSON_INVALID && currentField != "") {
                        string intValue = llJsonGetValue(currentField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            current = (integer)intValue;
                        }
                    }
                    
                    string baseField = llJsonGetValue(healthMapValue, ["base"]);
                    if (baseField != JSON_INVALID && baseField != "") {
                        string intValue = llJsonGetValue(baseField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            base = (integer)intValue;
                        }
                    }
                    
                    string maxField = llJsonGetValue(healthMapValue, ["max"]);
                    if (maxField != JSON_INVALID && maxField != "") {
                        string intValue = llJsonGetValue(maxField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            max = (integer)intValue;
                        }
                    }
                    
                    string healthData = (string)current + "|" + (string)base + "|" + (string)max;
                    llLinksetDataWrite("health", healthData);
                }
            }
            
            // Extract and write stamina (as current|base|max)
            string staminaField = llJsonGetValue(fieldsJson, ["stamina"]);
            if (staminaField != JSON_INVALID && staminaField != "") {
                string staminaMapValue = llJsonGetValue(staminaField, ["mapValue", "fields"]);
                if (staminaMapValue != JSON_INVALID && staminaMapValue != "") {
                    integer current = 0;
                    integer base = 0;
                    integer max = 0;
                    
                    string currentField = llJsonGetValue(staminaMapValue, ["current"]);
                    if (currentField != JSON_INVALID && currentField != "") {
                        string intValue = llJsonGetValue(currentField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            current = (integer)intValue;
                        }
                    }
                    
                    string baseField = llJsonGetValue(staminaMapValue, ["base"]);
                    if (baseField != JSON_INVALID && baseField != "") {
                        string intValue = llJsonGetValue(baseField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            base = (integer)intValue;
                        }
                    }
                    
                    string maxField = llJsonGetValue(staminaMapValue, ["max"]);
                    if (maxField != JSON_INVALID && maxField != "") {
                        string intValue = llJsonGetValue(maxField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            max = (integer)intValue;
                        }
                    }
                    
                    string staminaData = (string)current + "|" + (string)base + "|" + (string)max;
                    llLinksetDataWrite("stamina", staminaData);
                }
            }
            
            // Extract and write mana (as current|base|max)
            string manaField = llJsonGetValue(fieldsJson, ["mana"]);
            if (manaField != JSON_INVALID && manaField != "") {
                string manaMapValue = llJsonGetValue(manaField, ["mapValue", "fields"]);
                if (manaMapValue != JSON_INVALID && manaMapValue != "") {
                    integer current = 0;
                    integer base = 0;
                    integer max = 0;
                    
                    string currentField = llJsonGetValue(manaMapValue, ["current"]);
                    if (currentField != JSON_INVALID && currentField != "") {
                        string intValue = llJsonGetValue(currentField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            current = (integer)intValue;
                        }
                    }
                    
                    string baseField = llJsonGetValue(manaMapValue, ["base"]);
                    if (baseField != JSON_INVALID && baseField != "") {
                        string intValue = llJsonGetValue(baseField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            base = (integer)intValue;
                        }
                    }
                    
                    string maxField = llJsonGetValue(manaMapValue, ["max"]);
                    if (maxField != JSON_INVALID && maxField != "") {
                        string intValue = llJsonGetValue(maxField, ["integerValue"]);
                        if (intValue != JSON_INVALID && intValue != "") {
                            if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                intValue = llGetSubString(intValue, 1, -2);
                            }
                            max = (integer)intValue;
                        }
                    }
                    
                    string manaData = (string)current + "|" + (string)base + "|" + (string)max;
                    llLinksetDataWrite("mana", manaData);
                }
            }
            
            // Extract and write class_id
            string classField = llJsonGetValue(fieldsJson, ["class_id"]);
            if (classField != JSON_INVALID && classField != "") {
                string classValue = llJsonGetValue(classField, ["stringValue"]);
                if (classValue != JSON_INVALID && classValue != "") {
                    if (llStringLength(classValue) >= 2 && llGetSubString(classValue, 0, 0) == "\"" && llGetSubString(classValue, -1, -1) == "\"") {
                        classValue = llGetSubString(classValue, 1, -2);
                    }
                    llLinksetDataWrite("class", classValue);
                }
            }
            
            // Extract and write xp_total and xp_available (combine as "total|available")
            string xpTotalField = llJsonGetValue(fieldsJson, ["xp_total"]);
            string xpAvailableField = llJsonGetValue(fieldsJson, ["xp_available"]);
            integer xpTotal = 0;
            integer xpAvailable = 0;
            
            if (xpTotalField != JSON_INVALID && xpTotalField != "") {
                string intValue = llJsonGetValue(xpTotalField, ["integerValue"]);
                if (intValue != JSON_INVALID && intValue != "") {
                    if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                        intValue = llGetSubString(intValue, 1, -2);
                    }
                    xpTotal = (integer)intValue;
                }
            }
            
            if (xpAvailableField != JSON_INVALID && xpAvailableField != "") {
                string intValue = llJsonGetValue(xpAvailableField, ["integerValue"]);
                if (intValue != JSON_INVALID && intValue != "") {
                    if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                        intValue = llGetSubString(intValue, 1, -2);
                    }
                    xpAvailable = (integer)intValue;
                }
            }
            
            if (xpTotal != 0 || xpAvailable != 0) {
                string xpData = (string)xpTotal + "|" + (string)xpAvailable;
                llLinksetDataWrite("xp", xpData);
            }
            
            // Extract and write species_id
            string speciesField = llJsonGetValue(fieldsJson, ["species_id"]);
            if (speciesField != JSON_INVALID && speciesField != "") {
                string speciesValue = llJsonGetValue(speciesField, ["stringValue"]);
                if (speciesValue != JSON_INVALID && speciesValue != "") {
                    if (llStringLength(speciesValue) >= 2 && llGetSubString(speciesValue, 0, 0) == "\"" && llGetSubString(speciesValue, -1, -1) == "\"") {
                        speciesValue = llGetSubString(speciesValue, 1, -2);
                    }
                    llLinksetDataWrite("species_id", speciesValue);
                }
            }
            
            // Extract and write species_factors (as individual LSD keys + JSON string for backward compatibility)
            string speciesFactorsField = llJsonGetValue(fieldsJson, ["species_factors"]);
            if (speciesFactorsField != JSON_INVALID && speciesFactorsField != "") {
                string factorsMapValue = llJsonGetValue(speciesFactorsField, ["mapValue", "fields"]);
                if (factorsMapValue != JSON_INVALID && factorsMapValue != "") {
                    list factorNames = ["health_factor", "stamina_factor", "mana_factor"];
                    integer i;
                    integer len = llGetListLength(factorNames);
                    
                    // Build JSON for backward compatibility (temporary)
                    list jsonParts = ["{"];
                    
                    for (i = 0; i < len; i++) {
                        if (i > 0) jsonParts += ",";
                        string factorName = llList2String(factorNames, i);
                        string factorField = llJsonGetValue(factorsMapValue, [factorName]);
                        if (factorField != JSON_INVALID && factorField != "") {
                            string intValue = llJsonGetValue(factorField, ["integerValue"]);
                            if (intValue != JSON_INVALID && intValue != "") {
                                if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                                    intValue = llGetSubString(intValue, 1, -2);
                                }
                                // Write individual LSD key (new format)
                                llLinksetDataWrite(factorName, intValue);
                                
                                // Also build JSON for backward compatibility (temporary)
                                jsonParts += ["\"", factorName, "\":", intValue];
                            }
                        }
                    }
                    jsonParts += "}";
                    string factorsJson = llDumpList2String(jsonParts, "");
                    // Keep JSON for backward compatibility (temporary - will be removed in Phase 5)
                    llLinksetDataWrite("species_factors", factorsJson);
                }
            }
            
            // Extract and write has_mana (as "true"/"false")
            string hasManaField = llJsonGetValue(fieldsJson, ["has_mana"]);
            if (hasManaField != JSON_INVALID && hasManaField != "") {
                string boolValue = llJsonGetValue(hasManaField, ["booleanValue"]);
                if (boolValue != JSON_INVALID && boolValue != "") {
                    // Remove quotes if present
                    if (llStringLength(boolValue) >= 2 && llGetSubString(boolValue, 0, 0) == "\"" && llGetSubString(boolValue, -1, -1) == "\"") {
                        boolValue = llGetSubString(boolValue, 1, -2);
                    }
                    llLinksetDataWrite("has_mana", boolValue);
                }
            }
            
            // Extract and write currency
            string currencyField = llJsonGetValue(fieldsJson, ["currency"]);
            if (currencyField != JSON_INVALID && currencyField != "") {
                string intValue = llJsonGetValue(currencyField, ["integerValue"]);
                if (intValue != JSON_INVALID && intValue != "") {
                    if (llStringLength(intValue) >= 2 && llGetSubString(intValue, 0, 0) == "\"" && llGetSubString(intValue, -1, -1) == "\"") {
                        intValue = llGetSubString(intValue, 1, -2);
                    }
                    llLinksetDataWrite("currency", intValue);
                }
            }
            
            // Extract and write mode
            string modeField = llJsonGetValue(fieldsJson, ["mode"]);
            if (modeField != JSON_INVALID && modeField != "") {
                string modeValue = llJsonGetValue(modeField, ["stringValue"]);
                if (modeValue != JSON_INVALID && modeValue != "") {
                    if (llStringLength(modeValue) >= 2 && llGetSubString(modeValue, 0, 0) == "\"" && llGetSubString(modeValue, -1, -1) == "\"") {
                        modeValue = llGetSubString(modeValue, 1, -2);
                    }
                    llLinksetDataWrite("mode", modeValue);
                }
            }
            
            // Action slots are now HUD-only and LSD-only (not synced from Firestore)
            
            // Extract inventory field (v2: DEPRECATED - inventory now uses subcollection)
            // v2: Inventory is no longer stored in LSD (it's paginated from subcollection)
            // The inventory field in the character document is ignored
            // Inventory is fetched directly from characters/{characterId}/inventory subcollection
            string inventoryField = llJsonGetValue(fieldsJson, ["inventory"]);
            if (inventoryField != JSON_INVALID && inventoryField != "") {
                // Do not write inventory to LSD - it's now paginated from subcollection
            }
            
            // Extract and write universe_id
            string universeField = llJsonGetValue(fieldsJson, ["universe_id"]);
            if (universeField != JSON_INVALID && universeField != "") {
                string universeValue = llJsonGetValue(universeField, ["stringValue"]);
                if (universeValue != JSON_INVALID && universeValue != "") {
                    if (llStringLength(universeValue) >= 2 && llGetSubString(universeValue, 0, 0) == "\"" && llGetSubString(universeValue, -1, -1) == "\"") {
                        universeValue = llGetSubString(universeValue, 1, -2);
                    }
                    llLinksetDataWrite("universe_id", universeValue);
                }
            }
            
            // Send notification that character data was loaded
            llMessageLinked(LINK_SET, 0, "character loaded from firestore", "");
        }
    }
}

