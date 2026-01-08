// ============================================================================
// Inventory_Coins.lsl
// ============================================================================
// Handles all coin-related UI and logic (extracted from Inventory Controller)
// ============================================================================

// =========================== CONFIGURATION ==================================
// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Coins] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer MENU_CHANNEL = -777799;
integer INVENTORY_CACHE_CHANNEL = 9001;
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Bridge responses to HUD controllers
integer HUD_CHANNEL = -77770;  // Channel for HUD-to-HUD communication (cGiveItem)

// Coin item names
string COIN_GOLD = "gold_coin";
string COIN_SILVER = "silver_coin";
string COIN_COPPER = "copper_coin";

// =========================== STATE VARIABLES ================================
// Owner info
key ownerKey;

// Coin menu state
integer COIN_MENU_MODE_NONE = 0;
integer COIN_MENU_MODE_MAIN = 1;
integer COIN_MENU_MODE_GIVE_TARGET = 2;
integer COIN_MENU_MODE_GIVE_COIN_TYPE = 3;
integer COIN_MENU_MODE_GIVE_AMOUNT = 4;
integer COIN_MENU_MODE_VAULT_DEPOSIT_COIN_TYPE = 5;
integer COIN_MENU_MODE_VAULT_DEPOSIT_AMOUNT = 6;
integer COIN_MENU_MODE_VAULT_WITHDRAW_COIN_TYPE = 7;
integer COIN_MENU_MODE_VAULT_WITHDRAW_AMOUNT = 8;
integer coinMenuMode = COIN_MENU_MODE_NONE;
list detectedAvatars = [];  // [name, uuid, name, uuid, ...]
key selectedTargetUUID = NULL_KEY;
string selectedCoinType = "";  // "gold_coin", "silver_coin", or "copper_coin"
integer selectedCoinAmount = 0;
integer coinGoldCount = 0;
integer coinSilverCount = 0;
integer coinCopperCount = 0;

// Vault state
integer vaultNearby = FALSE;
integer vaultGoldCount = 0;
integer vaultSilverCount = 0;
integer vaultCopperCount = 0;

// Menu and text input
integer coinMenuListener = 0;
integer coinTextInputChannel = 0;

// =========================== HELPER FUNCTIONS ================================

notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Update inventory delta in cache (communicates directly with InventoryCache)
updateInventoryDelta(string itemName, integer delta) {
    // Build JSON object: { "item": itemName, "delta": delta }
    string json = "{\"item\":\"" + itemName + "\",\"delta\":" + (string)delta + "}";
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_ADD_DELTA", json);
    debugLog("Added inventory delta: " + itemName + " = " + (string)delta);
}

// Flush inventory deltas to Firestore Bridge (communicates directly with InventoryCache)
flushInventoryDeltas() {
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_GET_DELTAS", "");
    debugLog("Requested inventory deltas from cache");
}

// =========================== COIN MENU FUNCTIONS ============================

// Show coin main menu (automatically requests coin counts first)
showCoinMainMenu() {
    coinMenuMode = COIN_MENU_MODE_MAIN;
    
    // Automatically request coin counts to display in menu
    requestCoinCounts();
    // Store flag to show menu after counts are loaded
    llLinksetDataWrite("_coin_menu_after_counts", "TRUE");
    
    // Set timer as fallback - if currency doesn't respond within 3 seconds, show menu with cached/default values
    llSetTimerEvent(3.0);
}

// Request coin counts from currency field (not inventory items)
requestCoinCounts() {
    string characterId = llLinksetDataRead("characterId");
    debugLog("requestCoinCounts() called, characterId: " + characterId);
    if (characterId != "" && characterId != "JSON_INVALID") {
        // Request currency field from Firestore (currency is stored as map: {gold, silver, copper})
        // Set flag to indicate we're requesting for coin counts
        llLinksetDataWrite("_coin_counts_request", "TRUE");
        
        // Request currency field - send to Bridge Main which routes to Bridge Characters
        // Bridge Main expects: command="getCurrency", id=characterId
        // It will route as: CHAR|getCurrency|characterId|senderLink
        // Bridge Characters responds with: llMessageLinked(senderLink, 0, "currency", fieldValue)
        // Since we're using LINK_SET, we'll receive it on channel 0
        integer myLinkNumber = llGetLinkNumber();
        debugLog("Sending getCurrency request for characterId: " + characterId + ", my link number: " + (string)myLinkNumber);
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getCurrency", (key)characterId);
    } else {
        debugLog("ERROR: No character selected, cannot request coin counts");
        notify("No character selected. Cannot show coins.");
        coinMenuMode = COIN_MENU_MODE_NONE;
    }
}

// Extract coin counts from inventory items list
extractCoinCounts(list itemNames, list itemQuantities) {
    coinGoldCount = 0;
    coinSilverCount = 0;
    coinCopperCount = 0;
    
    integer i;
    integer count = llGetListLength(itemNames);
    for (i = 0; i < count; i++) {
        string itemName = llList2String(itemNames, i);
        integer qty = llList2Integer(itemQuantities, i);
        
        if (itemName == COIN_GOLD) {
            coinGoldCount = qty;
        } else if (itemName == COIN_SILVER) {
            coinSilverCount = qty;
        } else if (itemName == COIN_COPPER) {
            coinCopperCount = qty;
        }
    }
}

// Show coin menu dialog with counts displayed
showCoinMenuWithCounts() {
    coinMenuMode = COIN_MENU_MODE_MAIN;
    
    // Remove any existing listener
    if (coinMenuListener != 0) {
        llListenRemove(coinMenuListener);
    }
    
    // Create new listener
    coinMenuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    // Build message showing coin counts
    string message = "\nYou have: " + (string)coinGoldCount + " gold coins, " 
                     + (string)coinSilverCount + " silver coins, and " 
                     + (string)coinCopperCount + " copper coins.\n\nWhat would you like to do?";
    
    // Build buttons list
    list buttons = ["Give Coins", "Close"];
    if (vaultNearby) {
        buttons = ["Give Coins", "Vault: Deposit", "Vault: Withdraw", "Close"];
    }
    
    llDialog(ownerKey, message, buttons, MENU_CHANNEL);
    
    // Set timer
    llSetTimerEvent(60.0);
}

// Start give coins flow - sensor scan
startGiveCoinsFlow() {
    coinMenuMode = COIN_MENU_MODE_GIVE_TARGET;
    detectedAvatars = [];
    llSensor("", NULL_KEY, AGENT, 10.0, PI);
}

// Show target selection dialog
showTargetSelectionDialog() {
    integer avatarCount = llGetListLength(detectedAvatars) / 2;
    
    if (avatarCount == 0) {
        llDialog(ownerKey, "No players nearby.", ["Close"], MENU_CHANNEL);
        coinMenuMode = COIN_MENU_MODE_NONE;
        llSetTimerEvent(0.0);
        return;
    }
    
    // Build button list (max 12 buttons in dialog)
    list buttons = [];
    integer i;
    integer maxButtons = 12;
    if (avatarCount > maxButtons) avatarCount = maxButtons;
    
    for (i = 0; i < avatarCount; i++) {
        string name = llList2String(detectedAvatars, i * 2);
        buttons += [name];
    }
    
    llDialog(ownerKey, "\nSelect a player to give coins to:", buttons, MENU_CHANNEL);
}

// Show coin type selection dialog
showCoinTypeSelectionDialog() {
    coinMenuMode = COIN_MENU_MODE_GIVE_COIN_TYPE;
    
    list buttons = ["Gold", "Silver", "Copper"];
    llDialog(ownerKey, "\nWhich coins do you want to give?", buttons, MENU_CHANNEL);
}

// Start amount entry for give coins
startGiveCoinsAmountEntry() {
    coinMenuMode = COIN_MENU_MODE_GIVE_AMOUNT;
    
    // Get coin count for selected type
    integer availableCount = 0;
    string coinDisplayName = "";
    if (selectedCoinType == COIN_GOLD) {
        availableCount = coinGoldCount;
        coinDisplayName = "gold";
    } else if (selectedCoinType == COIN_SILVER) {
        availableCount = coinSilverCount;
        coinDisplayName = "silver";
    } else if (selectedCoinType == COIN_COPPER) {
        availableCount = coinCopperCount;
        coinDisplayName = "copper";
    }
    
    // Set up text input channel
    coinTextInputChannel = (integer)llFrand(-100000) - 100000;
    
    // Remove menu listener, add text input listener
    if (coinMenuListener != 0) {
        llListenRemove(coinMenuListener);
    }
    coinMenuListener = llListen(coinTextInputChannel, "", ownerKey, "");
    
    llTextBox(ownerKey, "How many " + coinDisplayName + " coins do you want to give?\n\nYou have: " + (string)availableCount, coinTextInputChannel);
    llSetTimerEvent(60.0);
}

// Validate and execute coin transfer
executeCoinTransfer() {
    // Get coin count for validation
    integer availableCount = 0;
    if (selectedCoinType == COIN_GOLD) {
        availableCount = coinGoldCount;
    } else if (selectedCoinType == COIN_SILVER) {
        availableCount = coinSilverCount;
    } else if (selectedCoinType == COIN_COPPER) {
        availableCount = coinCopperCount;
    }
    
    // Validate amount
    if (selectedCoinAmount < 1) {
        notify("Invalid amount. Must be at least 1.");
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    if (selectedCoinAmount > availableCount) {
        notify("You don't have enough coins. You have " + (string)availableCount + ".");
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    // Subtract from sender inventory
    updateInventoryDelta(selectedCoinType, -selectedCoinAmount);
    flushInventoryDeltas();
    
    // Send cGiveItem command to target HUD
    string senderUUID = (string)ownerKey;
    string command = "cGiveItem," + selectedCoinType + "," + (string)selectedCoinAmount + "," + senderUUID;
    llRegionSayTo(selectedTargetUUID, HUD_CHANNEL, command);
    
    // Show confirmation
    string senderName = llGetDisplayName(ownerKey);
    string coinDisplayName = "";
    if (selectedCoinType == COIN_GOLD) coinDisplayName = "gold";
    else if (selectedCoinType == COIN_SILVER) coinDisplayName = "silver";
    else if (selectedCoinType == COIN_COPPER) coinDisplayName = "copper";
    
    notify("Sent " + (string)selectedCoinAmount + " " + coinDisplayName + " coins to " + llKey2Name(selectedTargetUUID) + ".");
    
    // Reset state
    coinMenuMode = COIN_MENU_MODE_NONE;
    selectedTargetUUID = NULL_KEY;
    selectedCoinType = "";
    selectedCoinAmount = 0;
    if (coinMenuListener != 0) {
        llListenRemove(coinMenuListener);
        coinMenuListener = 0;
    }
    llSetTimerEvent(0.0);
}

// =========================== VAULT FUNCTIONS ============================

// Start vault deposit flow - select coin type
startVaultDepositFlow() {
    coinMenuMode = COIN_MENU_MODE_VAULT_DEPOSIT_COIN_TYPE;
    
    // First, get coin counts to validate amounts
    requestCoinCounts();
    // Store that we need to continue to coin type selection after counts are loaded
    llLinksetDataWrite("_vault_deposit_after_counts", "TRUE");
}

// Show vault deposit coin type selection
showVaultDepositCoinTypeDialog() {
    coinMenuMode = COIN_MENU_MODE_VAULT_DEPOSIT_COIN_TYPE;
    
    list buttons = ["Gold", "Silver", "Copper"];
    llDialog(ownerKey, "\nDeposit which coins?", buttons, MENU_CHANNEL);
}

// Start vault deposit amount entry
startVaultDepositAmountEntry() {
    coinMenuMode = COIN_MENU_MODE_VAULT_DEPOSIT_AMOUNT;
    
    // Get coin count for selected type
    integer availableCount = 0;
    string coinDisplayName = "";
    if (selectedCoinType == COIN_GOLD) {
        availableCount = coinGoldCount;
        coinDisplayName = "gold";
    } else if (selectedCoinType == COIN_SILVER) {
        availableCount = coinSilverCount;
        coinDisplayName = "silver";
    } else if (selectedCoinType == COIN_COPPER) {
        availableCount = coinCopperCount;
        coinDisplayName = "copper";
    }
    
    // Set up text input channel
    coinTextInputChannel = (integer)llFrand(-100000) - 100000;
    
    // Remove menu listener, add text input listener
    if (coinMenuListener != 0) {
        llListenRemove(coinMenuListener);
    }
    coinMenuListener = llListen(coinTextInputChannel, "", ownerKey, "");
    
    llTextBox(ownerKey, "How many " + coinDisplayName + " coins do you want to deposit?\n\nYou have: " + (string)availableCount, coinTextInputChannel);
    llSetTimerEvent(60.0);
}

// Execute vault deposit
executeVaultDeposit() {
    // Get coin count for validation
    integer availableCount = 0;
    string coinDisplayName = "";
    if (selectedCoinType == COIN_GOLD) {
        availableCount = coinGoldCount;
        coinDisplayName = "gold";
    } else if (selectedCoinType == COIN_SILVER) {
        availableCount = coinSilverCount;
        coinDisplayName = "silver";
    } else if (selectedCoinType == COIN_COPPER) {
        availableCount = coinCopperCount;
        coinDisplayName = "copper";
    }
    
    // Validate amount
    if (selectedCoinAmount < 1) {
        notify("Invalid amount. Must be at least 1.");
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    if (selectedCoinAmount > availableCount) {
        notify("You don't have enough coins. You have " + (string)availableCount + ".");
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    // Subtract from HUD inventory (local update first)
    updateInventoryDelta(selectedCoinType, -selectedCoinAmount);
    flushInventoryDeltas();
    
    // Send vault deposit command to Bridge
    string characterId = llLinksetDataRead("characterId");
    if (characterId != "" && characterId != "JSON_INVALID") {
        string command = "CHAR|VAULT_DEPOSIT|" + characterId + "|" + selectedCoinType + "|" + (string)selectedCoinAmount;
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, command, "");
    } else {
        // Roll back - add coins back
        updateInventoryDelta(selectedCoinType, selectedCoinAmount);
        notify("Cannot deposit: No character selected.");
        coinMenuMode = COIN_MENU_MODE_NONE;
    }
    
    // Reset state (but keep coinMenuMode to wait for response)
    selectedCoinAmount = 0;
}

// Start vault withdraw flow - request vault inventory
startVaultWithdrawFlow() {
    // Request vault inventory
    string characterId = llLinksetDataRead("characterId");
    if (characterId != "" && characterId != "JSON_INVALID") {
        string command = "CHAR|GET_VAULT_INVENTORY|" + characterId;
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, command, "");
        // Set flag to continue to coin type selection after inventory is loaded
        llLinksetDataWrite("_vault_withdraw_after_inventory", "TRUE");
    } else {
        notify("Cannot withdraw: No character selected.");
        coinMenuMode = COIN_MENU_MODE_NONE;
    }
}

// Show vault withdraw coin type selection
showVaultWithdrawCoinTypeDialog() {
    coinMenuMode = COIN_MENU_MODE_VAULT_WITHDRAW_COIN_TYPE;
    
    // Build buttons for coin types that have > 0 in vault
    list buttons = [];
    if (vaultGoldCount > 0) buttons += ["Gold"];
    if (vaultSilverCount > 0) buttons += ["Silver"];
    if (vaultCopperCount > 0) buttons += ["Copper"];
    
    if (llGetListLength(buttons) == 0) {
        llDialog(ownerKey, "Your vault is empty.", ["Close"], MENU_CHANNEL);
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    llDialog(ownerKey, "\nWithdraw which coins?", buttons, MENU_CHANNEL);
}

// Start vault withdraw amount entry
startVaultWithdrawAmountEntry() {
    coinMenuMode = COIN_MENU_MODE_VAULT_WITHDRAW_AMOUNT;
    
    // Get vault count for selected type
    integer availableCount = 0;
    string coinDisplayName = "";
    if (selectedCoinType == COIN_GOLD) {
        availableCount = vaultGoldCount;
        coinDisplayName = "gold";
    } else if (selectedCoinType == COIN_SILVER) {
        availableCount = vaultSilverCount;
        coinDisplayName = "silver";
    } else if (selectedCoinType == COIN_COPPER) {
        availableCount = vaultCopperCount;
        coinDisplayName = "copper";
    }
    
    // Set up text input channel
    coinTextInputChannel = (integer)llFrand(-100000) - 100000;
    
    // Remove menu listener, add text input listener
    if (coinMenuListener != 0) {
        llListenRemove(coinMenuListener);
    }
    coinMenuListener = llListen(coinTextInputChannel, "", ownerKey, "");
    
    llTextBox(ownerKey, "How many " + coinDisplayName + " coins do you want to withdraw?\n\nVault has: " + (string)availableCount, coinTextInputChannel);
    llSetTimerEvent(60.0);
}

// Execute vault withdraw
executeVaultWithdraw() {
    // Get vault count for validation
    integer availableCount = 0;
    string coinDisplayName = "";
    if (selectedCoinType == COIN_GOLD) {
        availableCount = vaultGoldCount;
        coinDisplayName = "gold";
    } else if (selectedCoinType == COIN_SILVER) {
        availableCount = vaultSilverCount;
        coinDisplayName = "silver";
    } else if (selectedCoinType == COIN_COPPER) {
        availableCount = vaultCopperCount;
        coinDisplayName = "copper";
    }
    
    // Validate amount
    if (selectedCoinAmount < 1) {
        notify("Invalid amount. Must be at least 1.");
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    if (selectedCoinAmount > availableCount) {
        notify("You don't have enough coins in vault. Vault has " + (string)availableCount + ".");
        coinMenuMode = COIN_MENU_MODE_NONE;
        return;
    }
    
    // Send vault withdraw command to Bridge
    string characterId = llLinksetDataRead("characterId");
    if (characterId != "" && characterId != "JSON_INVALID") {
        string command = "CHAR|VAULT_WITHDRAW|" + characterId + "|" + selectedCoinType + "|" + (string)selectedCoinAmount;
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, command, "");
    } else {
        notify("Cannot withdraw: No character selected.");
        coinMenuMode = COIN_MENU_MODE_NONE;
    }
    
    // Reset state (but keep coinMenuMode to wait for response)
    selectedCoinAmount = 0;
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        
        // DEBUG: ALWAYS log owner info to help troubleshoot (temporary)
        llOwnerSay("[Coins DEBUG] Initialized. ownerKey: " + (string)ownerKey);
        
        // Listen for coin menu responses
        coinMenuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
        
        // Listen for cGiveItem commands (HUD-to-HUD coin transfers)
        llListen(HUD_CHANNEL, "", NULL_KEY, "");
    }
    
    // Handle link messages
    link_message(integer sender_num, integer num, string msg, key id) {
        // Handle VAULT_NEARBY message
        if (llSubStringIndex(msg, "VAULT_NEARBY,") == 0) {
            vaultNearby = TRUE;
            // Store timestamp for vault proximity timeout (10 seconds from now)
            llLinksetDataWrite("_vault_proximity_timeout", (string)(llGetUnixTime() + 10));
            // Ensure timer is running to check timeout (set to 10 seconds, but will be checked on any timer event)
            llSetTimerEvent(10.0);
            return;
        }

        // Show coin menu when requested (from rp_coins button)
        if (msg == "show_coin_menu") {
            debugLog("show_coin_menu");
            showCoinMainMenu();
            return;
        }
        
        // Handle currency response from Firestore Bridge (for coin counts)
        // Currency is stored as map: {gold: X, silver: Y, copper: Z}
        // Response can come on channel 0 (direct from Bridge Characters) or FS_BRIDGE_CHANNEL
        if ((num == 0 || num == FS_BRIDGE_CHANNEL) && msg == "currency") {
            debugLog("Currency response received on channel " + (string)num + ": " + (string)id);
            string coinCountsRequest = llLinksetDataRead("_coin_counts_request");
            debugLog("coinCountsRequest flag: " + coinCountsRequest);
            if (coinCountsRequest == "TRUE") {
                llLinksetDataDelete("_coin_counts_request");
                
                // Parse currency map value from response
                // Response format: mapValue fields with gold, silver, copper as integerValue
                string currencyJson = (string)id;
                
                // Reset counts
                coinGoldCount = 0;
                coinSilverCount = 0;
                coinCopperCount = 0;
                
                if (currencyJson != "" && currencyJson != JSON_INVALID) {
                    // Currency field comes as mapValue JSON string
                    // Extract the fields object
                    string currencyFields = llJsonGetValue(currencyJson, ["fields"]);
                    if (currencyFields == JSON_INVALID || currencyFields == "") {
                        // Try direct extraction if it's already the fields object
                        currencyFields = currencyJson;
                    }
                    
                    if (currencyFields != JSON_INVALID && currencyFields != "") {
                        // Extract gold, silver, copper values
                        string goldField = llJsonGetValue(currencyFields, ["gold"]);
                        string silverField = llJsonGetValue(currencyFields, ["silver"]);
                        string copperField = llJsonGetValue(currencyFields, ["copper"]);
                        
                        if (goldField != JSON_INVALID && goldField != "") {
                            string goldStr = llJsonGetValue(goldField, ["integerValue"]);
                            if (goldStr == JSON_INVALID || goldStr == "") {
                                // Try direct integer value
                                goldStr = goldField;
                            }
                            if (goldStr != "") {
                                coinGoldCount = (integer)goldStr;
                            }
                        }
                        
                        if (silverField != JSON_INVALID && silverField != "") {
                            string silverStr = llJsonGetValue(silverField, ["integerValue"]);
                            if (silverStr == JSON_INVALID || silverStr == "") {
                                silverStr = silverField;
                            }
                            if (silverStr != "") {
                                coinSilverCount = (integer)silverStr;
                            }
                        }
                        
                        if (copperField != JSON_INVALID && copperField != "") {
                            string copperStr = llJsonGetValue(copperField, ["integerValue"]);
                            if (copperStr == JSON_INVALID || copperStr == "") {
                                copperStr = copperField;
                            }
                            if (copperStr != "") {
                                coinCopperCount = (integer)copperStr;
                            }
                        }
                    }
                }
                
                debugLog("Coin counts extracted - gold: " + (string)coinGoldCount + ", silver: " + (string)coinSilverCount + ", copper: " + (string)coinCopperCount);
                
                // Check if we need to show coin menu with counts
                string coinMenuAfterCounts = llLinksetDataRead("_coin_menu_after_counts");
                debugLog("coinMenuAfterCounts flag: " + coinMenuAfterCounts);
                if (coinMenuAfterCounts == "TRUE") {
                    llLinksetDataDelete("_coin_menu_after_counts");
                    debugLog("Calling showCoinMenuWithCounts()");
                    // Cancel the timeout timer since we got the response
                    llSetTimerEvent(60.0);
                    showCoinMenuWithCounts();
                }
                // Check if we need to continue to coin type selection (for give coins flow)
                else {
                    string giveAfterCounts = llLinksetDataRead("_coin_give_after_counts");
                    if (giveAfterCounts == "TRUE") {
                        llLinksetDataDelete("_coin_give_after_counts");
                        showCoinTypeSelectionDialog();
                    } else {
                        // Check if we need to continue to vault deposit coin type selection
                        string vaultDepositAfterCounts = llLinksetDataRead("_vault_deposit_after_counts");
                        if (vaultDepositAfterCounts == "TRUE") {
                            llLinksetDataDelete("_vault_deposit_after_counts");
                            showVaultDepositCoinTypeDialog();
                        }
                    }
                }
            }
        }
        
        // Handle VAULT_INVENTORY response
        if (num == FS_BRIDGE_CHANNEL && msg == "VAULT_INVENTORY") {
            // Parse: gold|silver|copper
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 3) {
                vaultGoldCount = (integer)llList2String(parts, 0);
                vaultSilverCount = (integer)llList2String(parts, 1);
                vaultCopperCount = (integer)llList2String(parts, 2);
            }
            
            // Check if we need to continue to coin type selection
            string vaultWithdrawAfterInventory = llLinksetDataRead("_vault_withdraw_after_inventory");
            if (vaultWithdrawAfterInventory == "TRUE") {
                llLinksetDataDelete("_vault_withdraw_after_inventory");
                showVaultWithdrawCoinTypeDialog();
            }
        }
        
        // Handle VAULT_DEPOSIT_OK response
        if (num == FS_BRIDGE_CHANNEL && msg == "VAULT_DEPOSIT_OK") {
            // Parse: itemName|amount
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string itemName = llList2String(parts, 0);
                integer amount = (integer)llList2String(parts, 1);
                
                string coinDisplayName = "";
                if (itemName == COIN_GOLD) coinDisplayName = "gold";
                else if (itemName == COIN_SILVER) coinDisplayName = "silver";
                else if (itemName == COIN_COPPER) coinDisplayName = "copper";
                
                notify("Deposited " + (string)amount + " " + coinDisplayName + " coins to vault.");
            }
            
            // Reset state
            coinMenuMode = COIN_MENU_MODE_NONE;
            selectedCoinType = "";
            selectedCoinAmount = 0;
            if (coinMenuListener != 0) {
                llListenRemove(coinMenuListener);
                coinMenuListener = 0;
            }
            llSetTimerEvent(0.0);
        }
        
        // Handle VAULT_DEPOSIT_FAIL response
        if (num == FS_BRIDGE_CHANNEL && llSubStringIndex(msg, "VAULT_DEPOSIT_FAIL") == 0) {
            notify("Vault deposit failed: " + (string)id);
            // Roll back - add coins back to inventory
            if (selectedCoinType != "" && selectedCoinAmount > 0) {
                updateInventoryDelta(selectedCoinType, selectedCoinAmount);
                flushInventoryDeltas();
            }
            
            // Reset state
            coinMenuMode = COIN_MENU_MODE_NONE;
            selectedCoinType = "";
            selectedCoinAmount = 0;
            if (coinMenuListener != 0) {
                llListenRemove(coinMenuListener);
                coinMenuListener = 0;
            }
            llSetTimerEvent(0.0);
        }
        
        // Handle VAULT_WITHDRAW_OK response
        if (num == FS_BRIDGE_CHANNEL && msg == "VAULT_WITHDRAW_OK") {
            // Parse: itemName|amount
            list parts = llParseString2List((string)id, ["|"], []);
            if (llGetListLength(parts) >= 2) {
                string itemName = llList2String(parts, 0);
                integer amount = (integer)llList2String(parts, 1);
                
                // Add to HUD inventory
                updateInventoryDelta(itemName, amount);
                flushInventoryDeltas();
                
                string coinDisplayName = "";
                if (itemName == COIN_GOLD) coinDisplayName = "gold";
                else if (itemName == COIN_SILVER) coinDisplayName = "silver";
                else if (itemName == COIN_COPPER) coinDisplayName = "copper";
                
                notify("Withdrew " + (string)amount + " " + coinDisplayName + " coins from vault.");
            }
            
            // Reset state
            coinMenuMode = COIN_MENU_MODE_NONE;
            selectedCoinType = "";
            selectedCoinAmount = 0;
            if (coinMenuListener != 0) {
                llListenRemove(coinMenuListener);
                coinMenuListener = 0;
            }
            llSetTimerEvent(0.0);
        }
        
        // Handle VAULT_WITHDRAW_FAIL response
        if (num == FS_BRIDGE_CHANNEL && llSubStringIndex(msg, "VAULT_WITHDRAW_FAIL") == 0) {
            notify("Vault withdraw failed: " + (string)id);
            
            // Reset state
            coinMenuMode = COIN_MENU_MODE_NONE;
            selectedCoinType = "";
            selectedCoinAmount = 0;
            if (coinMenuListener != 0) {
                llListenRemove(coinMenuListener);
                coinMenuListener = 0;
            }
            llSetTimerEvent(0.0);
        }
    }
    
    // Handle listen events (menu dialogs, text input, cGiveItem)
    listen(integer channel, string name, key id, string message) {
        // Handle cGiveItem commands (HUD-to-HUD coin transfers)
        if (channel == HUD_CHANNEL) {
            if (llSubStringIndex(message, "cGiveItem,") == 0) {
                // Parse: cGiveItem,<coinName>,<amount>,<senderUUID>
                list parts = llParseString2List(message, [","], []);
                if (llGetListLength(parts) >= 4) {
                    string coinName = llToLower(llStringTrim(llList2String(parts, 1), STRING_TRIM));
                    integer amount = (integer)llList2String(parts, 2);
                    key senderUUID = (key)llList2String(parts, 3);
                    
                    // Validate coin type
                    if (coinName == COIN_GOLD || coinName == COIN_SILVER || coinName == COIN_COPPER) {
                        if (amount > 0) {
                            // Add to inventory (treated as normal inventory item)
                            updateInventoryDelta(coinName, amount);
                            flushInventoryDeltas();
                            
                            // Show message to receiver
                            string senderName = llKey2Name(senderUUID);
                            string coinDisplayName = "";
                            if (coinName == COIN_GOLD) coinDisplayName = "gold";
                            else if (coinName == COIN_SILVER) coinDisplayName = "silver";
                            else if (coinName == COIN_COPPER) coinDisplayName = "copper";
                            
                            notify("You received " + (string)amount + " " + coinDisplayName + " coins from " + senderName + ".");
                        }
                    }
                }
            }
            return;
        }
        
        // Handle coin menu dialogs
        if (channel == MENU_CHANNEL && coinMenuMode != COIN_MENU_MODE_NONE) {
            message = llToLower(message);
            
            // Coin main menu
            if (coinMenuMode == COIN_MENU_MODE_MAIN) {
                if (message == "give coins") {
                    startGiveCoinsFlow();
                }
                else if (message == "vault: deposit") {
                    startVaultDepositFlow();
                }
                else if (message == "vault: withdraw") {
                    startVaultWithdrawFlow();
                }
                else if (message == "close") {
                    coinMenuMode = COIN_MENU_MODE_NONE;
                    if (coinMenuListener != 0) {
                        llListenRemove(coinMenuListener);
                        coinMenuListener = 0;
                    }
                    llSetTimerEvent(0.0);
                }
                else {
                    // Unknown option - close menu
                    coinMenuMode = COIN_MENU_MODE_NONE;
                    if (coinMenuListener != 0) {
                        llListenRemove(coinMenuListener);
                        coinMenuListener = 0;
                    }
                    llSetTimerEvent(0.0);
                }
                return;
            }
            // Target selection menu
            else if (coinMenuMode == COIN_MENU_MODE_GIVE_TARGET) {
                // Find selected avatar in detected list
                integer i;
                integer count = llGetListLength(detectedAvatars) / 2;
                for (i = 0; i < count; i++) {
                    string avatarName = llList2String(detectedAvatars, i * 2);
                    if (llToLower(avatarName) == message) {
                        selectedTargetUUID = (key)llList2String(detectedAvatars, i * 2 + 1);
                        // First, get coin counts to validate amounts
                        requestCoinCounts();
                        // Store that we need to continue to coin type selection after counts are loaded
                        llLinksetDataWrite("_coin_give_after_counts", "TRUE");
                        return;
                    }
                }
                // Target not found or cancelled
                coinMenuMode = COIN_MENU_MODE_NONE;
                if (coinMenuListener != 0) {
                    llListenRemove(coinMenuListener);
                    coinMenuListener = 0;
                }
                llSetTimerEvent(0.0);
                return;
            }
            // Coin type selection menu
            else if (coinMenuMode == COIN_MENU_MODE_GIVE_COIN_TYPE) {
                if (message == "gold") {
                    selectedCoinType = COIN_GOLD;
                }
                else if (message == "silver") {
                    selectedCoinType = COIN_SILVER;
                }
                else if (message == "copper") {
                    selectedCoinType = COIN_COPPER;
                }
                else {
                    coinMenuMode = COIN_MENU_MODE_NONE;
                    if (coinMenuListener != 0) {
                        llListenRemove(coinMenuListener);
                        coinMenuListener = 0;
                    }
                    llSetTimerEvent(0.0);
                    return;
                }
                startGiveCoinsAmountEntry();
                return;
            }
            // Vault deposit coin type selection menu
            else if (coinMenuMode == COIN_MENU_MODE_VAULT_DEPOSIT_COIN_TYPE) {
                if (message == "gold") {
                    selectedCoinType = COIN_GOLD;
                }
                else if (message == "silver") {
                    selectedCoinType = COIN_SILVER;
                }
                else if (message == "copper") {
                    selectedCoinType = COIN_COPPER;
                }
                else {
                    coinMenuMode = COIN_MENU_MODE_NONE;
                    if (coinMenuListener != 0) {
                        llListenRemove(coinMenuListener);
                        coinMenuListener = 0;
                    }
                    llSetTimerEvent(0.0);
                    return;
                }
                startVaultDepositAmountEntry();
                return;
            }
            // Vault withdraw coin type selection menu
            else if (coinMenuMode == COIN_MENU_MODE_VAULT_WITHDRAW_COIN_TYPE) {
                if (message == "gold") {
                    selectedCoinType = COIN_GOLD;
                }
                else if (message == "silver") {
                    selectedCoinType = COIN_SILVER;
                }
                else if (message == "copper") {
                    selectedCoinType = COIN_COPPER;
                }
                else {
                    coinMenuMode = COIN_MENU_MODE_NONE;
                    if (coinMenuListener != 0) {
                        llListenRemove(coinMenuListener);
                        coinMenuListener = 0;
                    }
                    llSetTimerEvent(0.0);
                    return;
                }
                startVaultWithdrawAmountEntry();
                return;
            }
        }
        
        // Handle coin text input (amount entry)
        else if (channel == coinTextInputChannel && coinTextInputChannel != 0) {
            // Coin give amount entry
            if (coinMenuMode == COIN_MENU_MODE_GIVE_AMOUNT) {
                integer amount = (integer)message;
                if (amount > 0) {
                    selectedCoinAmount = amount;
                    executeCoinTransfer();
                } else {
                    notify("Invalid amount. Please enter a positive number.");
                    startGiveCoinsAmountEntry();
                }
            }
            // Vault deposit amount entry
            else if (coinMenuMode == COIN_MENU_MODE_VAULT_DEPOSIT_AMOUNT) {
                integer amount = (integer)message;
                if (amount > 0) {
                    selectedCoinAmount = amount;
                    executeVaultDeposit();
                } else {
                    notify("Invalid amount. Please enter a positive number.");
                    startVaultDepositAmountEntry();
                }
            }
            // Vault withdraw amount entry
            else if (coinMenuMode == COIN_MENU_MODE_VAULT_WITHDRAW_AMOUNT) {
                integer amount = (integer)message;
                if (amount > 0) {
                    selectedCoinAmount = amount;
                    executeVaultWithdraw();
                } else {
                    notify("Invalid amount. Please enter a positive number.");
                    startVaultWithdrawAmountEntry();
                }
            }
        }
    }
    
    // Handle sensor results for coin give flow
    sensor(integer num_detected) {
        if (coinMenuMode == COIN_MENU_MODE_GIVE_TARGET) {
            detectedAvatars = [];
            integer i;
            for (i = 0; i < num_detected; i++) {
                key avatarKey = llDetectedKey(i);
                string avatarName = llDetectedName(i);
                // Don't include self
                if (avatarKey != ownerKey) {
                    detectedAvatars += [avatarName, avatarKey];
                }
            }
            showTargetSelectionDialog();
        }
    }
    
    no_sensor() {
        if (coinMenuMode == COIN_MENU_MODE_GIVE_TARGET) {
            llDialog(ownerKey, "No players nearby.", ["Close"], MENU_CHANNEL);
            coinMenuMode = COIN_MENU_MODE_NONE;
            if (coinMenuListener != 0) {
                llListenRemove(coinMenuListener);
                coinMenuListener = 0;
            }
            llSetTimerEvent(0.0);
        }
    }
    
    timer() {
        // Check if we're waiting for currency response but haven't shown menu yet
        if (coinMenuMode == COIN_MENU_MODE_MAIN) {
            string coinMenuAfterCounts = llLinksetDataRead("_coin_menu_after_counts");
            if (coinMenuAfterCounts == "TRUE") {
                // Currency response timeout - show menu with current coin counts (may be 0 if not loaded yet)
                debugLog("Currency response timeout - showing menu with cached counts");
                llLinksetDataDelete("_coin_menu_after_counts");
                llLinksetDataDelete("_coin_counts_request");
                showCoinMenuWithCounts();
                // Reset timer to normal 60-second menu timeout
                llSetTimerEvent(60.0);
                return;
            }
        }
        
        // Check vault proximity timeout
        string vaultTimeoutStr = llLinksetDataRead("_vault_proximity_timeout");
        if (vaultTimeoutStr != "" && vaultTimeoutStr != "JSON_INVALID") {
            integer vaultTimeout = (integer)vaultTimeoutStr;
            integer currentTime = llGetUnixTime();
            if (currentTime >= vaultTimeout) {
                llLinksetDataDelete("_vault_proximity_timeout");
                vaultNearby = FALSE;
            }
        }
        
        // Clean up coin menu listener if timer expires
        if (coinMenuListener != 0) {
            llListenRemove(coinMenuListener);
            coinMenuListener = 0;
        }
        coinTextInputChannel = 0;
        
        // Clean up coin menu state
        coinMenuMode = COIN_MENU_MODE_NONE;
        detectedAvatars = [];
        selectedTargetUUID = NULL_KEY;
        selectedCoinType = "";
        selectedCoinAmount = 0;
        
        llSetTimerEvent(0.0);
    }
}

