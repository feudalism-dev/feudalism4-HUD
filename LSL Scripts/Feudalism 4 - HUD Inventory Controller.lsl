// ============================================================================
// Feudalism 4 - HUD Inventory Controller
// ============================================================================
// Handles all inventory UI and logic (moved from Combined HUD Controller)
// ============================================================================

// =========================== CONFIGURATION ==================================
// Debug settings
integer DEBUG_MODE = TRUE;  // Enable debug logging (set to TRUE only when debugging)

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Inventory] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer MENU_CHANNEL = -777799;
integer INVENTORY_CACHE_CHANNEL = 9001;
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Bridge responses to HUD controllers

// =========================== STATE VARIABLES ================================
// Owner info
key ownerKey;

// Inventory dialog state
integer inventoryMenuListener = 0;
integer inventoryTextInputChannel = 0;
string pendingDropItemName = "";
integer pendingDropQty = 0;
integer dropQtyStep = 0;  // 0=waiting for item name, 1=waiting for quantity, 2=waiting for confirmation

// Pagination state (v2: cursor-based)
string currentInventoryCursor = "";
integer currentInventoryHasMore = FALSE;
string currentCharacterId = "";

// =========================== HELPER FUNCTIONS ================================

notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// Update inventory delta in cache
updateInventoryDelta(string itemName, integer delta) {
    // Build JSON object: { "item": itemName, "delta": delta }
    string json = "{\"item\":\"" + itemName + "\",\"delta\":" + (string)delta + "}";
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_ADD_DELTA", json);
    debugLog("Added inventory delta: " + itemName + " = " + (string)delta);
}

// Flush inventory deltas to Firestore Bridge
flushInventoryDeltas() {
    llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_GET_DELTAS", "");
    debugLog("Requested inventory deltas from cache");
}

// =========================== INVENTORY MENU FUNCTIONS ======================

// Show inventory main menu
showInventoryMainMenu() {
    list menuButtons = ["View Items", "Drop Item", "Close"];
    string message = "\nInventory:\n\n";
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create new listener for menu responses
    inventoryMenuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    // Show dialog
    llDialog(ownerKey, message, menuButtons, MENU_CHANNEL);
    
    // Set timer to clean up listener after 30 seconds
    llSetTimerEvent(30.0);
}

// Show view items dialog (displays inventory contents)
// This function is deprecated - use showViewItemsDialogFromLists() instead
// Kept for backward compatibility but now requests inventoryPage from Firestore Bridge (v2: cursor-based)
showViewItemsDialog(string inventoryJson) {
    // Request inventory from Firestore Bridge
    string characterId = llLinksetDataRead("characterId");
    
    if (characterId != "" && characterId != "JSON_INVALID") {
        string payload = llJsonSetValue("{}", ["characterId"], characterId);
        payload = llJsonSetValue(payload, ["cursor"], "");  // Empty cursor = first page
        payload = llJsonSetValue(payload, ["pageSize"], (string)20);
        
        debugLog("Requesting inventoryPage for view items (cursor-based)");
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
    } else {
        // No characterId - show empty
        showViewItemsDialogFromLists([], [], "", FALSE);
    }
}

// Request next inventory page (v2: cursor-based pagination)
requestNextInventoryPage() {
    string characterId = llLinksetDataRead("characterId");
    if (characterId == "" || characterId == "JSON_INVALID") {
        debugLog("ERROR: Cannot request next page - characterId not found");
        return;
    }
    
    string payload = llJsonSetValue("{}", ["characterId"], characterId);
    payload = llJsonSetValue(payload, ["cursor"], currentInventoryCursor);
    payload = llJsonSetValue(payload, ["pageSize"], (string)20);
    
    debugLog("Requesting next inventory page with cursor: " + currentInventoryCursor);
    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
}

// Show view items dialog from parsed lists (v2: with pagination support)
showViewItemsDialogFromLists(list itemNames, list itemQuantities, string cursor, integer hasMore) {
    string displayText = "Your inventory:\n\n";
    integer itemCount = llGetListLength(itemNames);
    
    if (itemCount == 0) {
        displayText += "Empty";
    } else {
        integer i;
        integer maxItems = 15; // Limit to prevent dialog overflow
        integer displayedCount = 0;
        
        for (i = 0; i < itemCount && displayedCount < maxItems; i++) {
            string itemName = llList2String(itemNames, i);
            integer qty = llList2Integer(itemQuantities, i);
            if (qty > 0) {
                displayText += itemName + ": " + (string)qty + "\n";
                displayedCount++;
            }
        }
        
        if (displayedCount == 0) {
            displayText += "Empty";
        }
    }
    
    // Build menu buttons: Back, and Next Page if hasMore
    list menuButtons = ["Back"];
    if (hasMore) {
        menuButtons += ["Next Page"];
    }
    
    // Show dialog
    llDialog(ownerKey, displayText, menuButtons, MENU_CHANNEL);
    
    // Set timer
    llSetTimerEvent(30.0);
}

// Check item quantity for drop from parsed data (used by inventoryPage response)
checkItemQuantityForDropFromLists(integer availableQty) {
    if (availableQty <= 0) {
        notify("You don't have any " + pendingDropItemName + " to drop.");
        dropQtyStep = 0;
        pendingDropItemName = "";
        showInventoryMainMenu();
        return;
    }
    
    // Item exists, ask for quantity
    dropQtyStep = 2;  // Waiting for quantity
    inventoryTextInputChannel = (integer)llFrand(-100000) - 100000;
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create listener for text input AND menu responses
    inventoryMenuListener = llListen(inventoryTextInputChannel, "", ownerKey, "");
    
    // Request text input for quantity
    llTextBox(ownerKey, "You have " + (string)availableQty + " " + pendingDropItemName + ".\nEnter quantity to drop:", inventoryTextInputChannel);
    
    // Set timer
    llSetTimerEvent(60.0);
}

// Start drop item flow - ask for item name
startDropItemFlow() {
    // Set up text input for item name
    inventoryTextInputChannel = (integer)llFrand(-100000) - 100000;
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create listener for text input AND menu responses
    inventoryMenuListener = llListen(inventoryTextInputChannel, "", ownerKey, "");
    
    // Request text input for item name
    llTextBox(ownerKey, "Enter item name to drop:", inventoryTextInputChannel);
    
    dropQtyStep = 0;  // Waiting for item name
    pendingDropItemName = "";
    pendingDropQty = 0;
    
    // Set timer
    llSetTimerEvent(60.0);
}

// Check item quantity for drop (called after getting inventory and item name)
// This function is deprecated - use checkItemQuantityForDropFromLists() instead
// Kept for backward compatibility but now requests inventoryPage from Firestore Bridge
checkItemQuantityForDrop(string inventoryJson) {
    // Request inventory from Firestore Bridge
    string characterId = llLinksetDataRead("characterId");
    
    if (characterId != "" && characterId != "JSON_INVALID") {
        string payload = llJsonSetValue("{}", ["characterId"], characterId);
        payload = llJsonSetValue(payload, ["page"], (string)0);
        payload = llJsonSetValue(payload, ["pageSize"], (string)9999); // get all items for drop flow
        
        debugLog("Requesting inventoryPage for drop item check");
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
    } else {
        // No characterId - item not found
        checkItemQuantityForDropFromLists(0);
    }
}

// =========================== MAIN STATE =====================================

default {
    state_entry() {
        // Initialize owner information
        ownerKey = llGetOwner();
        
        // Listen for inventory menu responses
        llListen(MENU_CHANNEL, "", ownerKey, "");
    }
    
    // Handle link messages from Combined HUD Controller
link_message(integer sender_num, integer num, string msg, key id) {

    // Show inventory menu when requested
    if (msg == "show_inventory_menu") {
        debugLog("show_inventory_menu");
        showInventoryMainMenu();
    }

    // Inventory loaded from Data Manager (after LSD keys are written)
    // This is now deprecated - we use inventoryPage instead
    // Kept for backward compatibility but redirects to inventoryPage flow (v2: cursor-based)
    else if (msg == "inventory loaded") {
        // Request inventoryPage instead of using LSD (v2: use cursor, not page)
        string characterId = llLinksetDataRead("characterId");
        
        if (characterId != "" && characterId != "JSON_INVALID") {
            string payload = llJsonSetValue("{}", ["characterId"], characterId);
            payload = llJsonSetValue(payload, ["cursor"], "");  // Empty cursor = first page
            
            integer pageSize;
            if (dropQtyStep == 1) {
                pageSize = 100;  // Large page size for drop flow (but still paginated)
            } else {
                pageSize = 20;  // Normal view items
            }
            payload = llJsonSetValue(payload, ["pageSize"], (string)pageSize);
            
            debugLog("Redirecting inventory loaded to inventoryPage request (cursor-based)");
            llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
        }
    }

    // Inventory error from Firestore Bridge
    else if (msg == "inventory_ERROR") {
        notify("Failed to load inventory: " + (string)id);

        dropQtyStep = 0;
        pendingDropItemName = "";
        pendingDropQty = 0;

        if (inventoryMenuListener != 0) {
            llListenRemove(inventoryMenuListener);
            inventoryMenuListener = 0;
        }
    }

    // Handle CACHE_DELTAS response from InventoryCache
    else if (msg == "CACHE_DELTAS") {
        string json = (string)id;
        
        // Extract itemNames and deltas arrays from the cache response
        string itemNamesJson = llJsonGetValue(json, ["itemNames"]);
        string deltasArrayJson = llJsonGetValue(json, ["deltas"]);
        
        if (itemNamesJson != JSON_INVALID && itemNamesJson != "" && 
            deltasArrayJson != JSON_INVALID && deltasArrayJson != "") {
            string characterId = llLinksetDataRead("characterId");
            
            if (characterId != "" && characterId != "JSON_INVALID") {
                // Build the correct structure expected by Firestore Bridge:
                // {
                //   "characterId": "...",
                //   "deltas": {
                //     "itemNames": [...],
                //     "deltas": [...]
                //   }
                // }
                string deltasObject = "{\"itemNames\":" + itemNamesJson + ",\"deltas\":" + deltasArrayJson + "}";
                string payload = "{\"characterId\":\"" + characterId + "\",\"deltas\":" + deltasObject + "}";
                debugLog("Sending applyInventoryDeltas payload: " + payload);
                llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "applyInventoryDeltas", payload);
                debugLog("Sent applyInventoryDeltas to Firestore Bridge");
            } else {
                debugLog("ERROR: Cannot apply deltas - characterId not found in LSD");
            }
        } else {
            debugLog("No deltas to apply (empty or invalid itemNames/deltas arrays)");
        }
    }


    // Firestore Bridge confirms deltas applied
    else if (num == FS_BRIDGE_CHANNEL && msg == "inventoryDeltasApplied") {
        llMessageLinked(LINK_SET, INVENTORY_CACHE_CHANNEL, "CACHE_CLEAR", "");
        debugLog("Inventory deltas applied successfully, cache cleared");
        
        // Show success message if we just dropped an item
        if (dropQtyStep == 2 && pendingDropItemName != "" && pendingDropQty > 0) {
            notify("Successfully dropped " + (string)pendingDropQty + " " + pendingDropItemName);
            // Clean up drop state
            dropQtyStep = 0;
            pendingDropItemName = "";
            pendingDropQty = 0;
            inventoryTextInputChannel = 0;
            // Return to main menu automatically
            showInventoryMainMenu();
        }
    }
    
    // Firestore Bridge reports error applying deltas
    else if (num == FS_BRIDGE_CHANNEL && msg == "inventoryDeltasError") {
        notify("Failed to drop item: " + (string)id);
        debugLog("ERROR: Failed to apply inventory deltas: " + (string)id);
        
        // Clean up drop state on error and return to main menu
        if (dropQtyStep == 2) {
            dropQtyStep = 0;
            pendingDropItemName = "";
            pendingDropQty = 0;
            inventoryTextInputChannel = 0;
            showInventoryMainMenu();
        }
    }

    // Handle inventoryPage response from Firestore Bridge (v2: JSON format)
    else if (num == FS_BRIDGE_CHANNEL && msg == "inventoryPage") {
        string responseJson = (string)id;

        // Parse JSON: {items: [{name, qty}], cursor, hasMore}
        list itemNames = [];
        list itemQuantities = [];
        
        if (responseJson == "" || responseJson == JSON_INVALID) {
            showViewItemsDialogFromLists([], [], "", FALSE);
            return;
        }
        
        // Extract items array
        string itemsJson = llJsonGetValue(responseJson, ["items"]);
        if (itemsJson == JSON_INVALID || itemsJson == "") {
            showViewItemsDialogFromLists([], [], "", FALSE);
            return;
        }
        
        // Extract cursor and hasMore
        string cursor = llJsonGetValue(responseJson, ["cursor"]);
        string hasMoreStr = llJsonGetValue(responseJson, ["hasMore"]);
        
        // Remove quotes if present
        if (cursor != JSON_INVALID && cursor != "" && llStringLength(cursor) >= 2 && llGetSubString(cursor, 0, 0) == "\"" && llGetSubString(cursor, -1, -1) == "\"") {
            cursor = llGetSubString(cursor, 1, -2);
        }
        
        integer hasMore = FALSE;
        if (hasMoreStr != JSON_INVALID && hasMoreStr != "") {
            if (llStringLength(hasMoreStr) >= 2 && llGetSubString(hasMoreStr, 0, 0) == "\"" && llGetSubString(hasMoreStr, -1, -1) == "\"") {
                hasMoreStr = llGetSubString(hasMoreStr, 1, -2);
            }
            if (hasMoreStr == "true" || hasMoreStr == "1") {
                hasMore = TRUE;
            }
        }
        
        // Parse items array
        integer i = 0;
        while (TRUE) {
            string itemJson = llJsonGetValue(itemsJson, [i]);
            if (itemJson == JSON_INVALID || itemJson == "") jump done_parse_items;
            
            // Extract name and qty from item object
            string itemName = llJsonGetValue(itemJson, ["name"]);
            string qtyStr = llJsonGetValue(itemJson, ["qty"]);
            
            // Remove quotes if present
            if (itemName != JSON_INVALID && itemName != "" && llStringLength(itemName) >= 2 && llGetSubString(itemName, 0, 0) == "\"" && llGetSubString(itemName, -1, -1) == "\"") {
                itemName = llGetSubString(itemName, 1, -2);
            }
            if (qtyStr != JSON_INVALID && qtyStr != "" && llStringLength(qtyStr) >= 2 && llGetSubString(qtyStr, 0, 0) == "\"" && llGetSubString(qtyStr, -1, -1) == "\"") {
                qtyStr = llGetSubString(qtyStr, 1, -2);
            }
            
            integer qty = (integer)qtyStr;
            
            if (itemName != "" && qty > 0) {
                itemNames += [itemName];
                itemQuantities += [qty];
            }
            
            i++;
        }
        @done_parse_items;

        // Store pagination state
        currentInventoryCursor = cursor;
        currentInventoryHasMore = hasMore;
        
        // Show brief inventory summary (user-friendly)
        integer itemCount = llGetListLength(itemNames);
        if (itemCount > 0) {
            string itemPlural = "item";
            if (itemCount != 1) {
                itemPlural = "items";
            }
            string summary = "Inventory (" + (string)itemCount + " " + itemPlural + "):";
            integer i;
            integer maxShow = 10; // Show first 10 items in summary
            for (i = 0; i < itemCount && i < maxShow; i++) {
                summary += "\n" + llList2String(itemNames, i) + " (" + (string)llList2Integer(itemQuantities, i) + ")";
            }
            if (itemCount > maxShow) {
                summary += "\n... (" + (string)(itemCount - maxShow) + " more)";
            }
            notify(summary);
        }

        // Drop-item flow
        if (dropQtyStep == 1 && pendingDropItemName != "") {
            integer itemIndex = llListFindList(itemNames, [pendingDropItemName]);
            if (itemIndex != -1) {
                integer availableQty = llList2Integer(itemQuantities, itemIndex);
                checkItemQuantityForDropFromLists(availableQty);
            } else {
                // Item not found in current page - check if there are more pages
                if (hasMore) {
                    // Request next page for drop flow
                    debugLog("Item not found in current page, requesting next page for drop flow");
                    requestNextInventoryPage();
                } else {
                    // No more pages, item doesn't exist
                    checkItemQuantityForDropFromLists(0);
                }
            }
        }
        // Normal view-items flow
        else {
            showViewItemsDialogFromLists(itemNames, itemQuantities, cursor, hasMore);
        }
    }
}
    
    // Handle dialog and text input responses
    listen(integer channel, string name, key id, string message) {
        // Handle inventory menu dialogs
        if (channel == MENU_CHANNEL) {
            message = llToLower(message);
            
            // Main inventory menu
            if (message == "view items") {
                // Request inventory from Firestore Bridge (v2: cursor-based)
                string characterId = llLinksetDataRead("characterId");
                
                // Reset pagination state
                currentInventoryCursor = "";
                currentInventoryHasMore = FALSE;
                
                string payload = llJsonSetValue("{}", ["characterId"], characterId);
                payload = llJsonSetValue(payload, ["cursor"], "");  // Empty cursor = first page
                payload = llJsonSetValue(payload, ["pageSize"], (string)20);

                llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
            }
            else if (message == "drop item") {
                if (dropQtyStep == 0) {
                    startDropItemFlow();
                }
            }
            else if (message == "close") {
                // Close main menu - clean up
                if (inventoryMenuListener != 0) {
                    llListenRemove(inventoryMenuListener);
                    inventoryMenuListener = 0;
                }
                dropQtyStep = 0;
                pendingDropItemName = "";
                pendingDropQty = 0;
                llSetTimerEvent(0.0);
            }
            // View Items dialog - Back button returns to main menu
            else if (message == "back") {
                // Reset pagination state
                currentInventoryCursor = "";
                currentInventoryHasMore = FALSE;
                showInventoryMainMenu();
            }
            // View Items dialog - Next Page button loads next page
            else if (message == "next page") {
                if (currentInventoryHasMore && currentInventoryCursor != "") {
                    requestNextInventoryPage();
                } else {
                    notify("No more items to display.");
                }
            }
            // Drop Item confirmation dialog
            else if (message == "yes" && dropQtyStep == 2 && pendingDropItemName != "" && pendingDropQty > 0) {
                // Confirm drop - add delta to cache (negative for take)
                updateInventoryDelta(pendingDropItemName, -pendingDropQty);
                // Flush deltas to Firestore (success message will be shown after confirmation)
                flushInventoryDeltas();
                // Keep drop info for success message (don't clean up yet)
                // dropQtyStep, pendingDropItemName, pendingDropQty will be cleared after inventoryDeltasApplied
            }
            else if ((message == "no" || message == "cancel") && dropQtyStep == 2) {
                // Cancel drop - return to main menu
                dropQtyStep = 0;
                pendingDropItemName = "";
                pendingDropQty = 0;
                inventoryTextInputChannel = 0;
                showInventoryMainMenu();
            }
        }
        // Handle inventory text input (item name and quantity)
        else if (channel == inventoryTextInputChannel && inventoryTextInputChannel != 0) {
            if (dropQtyStep == 0) {
                // Received item name
                pendingDropItemName = llToLower(llStringTrim(message, STRING_TRIM));
                // Request inventory to check quantity (v2: cursor-based, start from first page)
                dropQtyStep = 1;
                currentInventoryCursor = "";  // Reset to first page
                currentInventoryHasMore = FALSE;
                string characterId = llLinksetDataRead("characterId");
                string payload = llJsonSetValue("{}", ["characterId"], characterId);
                payload = llJsonSetValue(payload, ["cursor"], "");  // Empty cursor = first page
                payload = llJsonSetValue(payload, ["pageSize"], (string)100); // Large page size for drop flow

                llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
            }
            else if (dropQtyStep == 2) {
                integer qty = (integer)message;
                if (qty > 0) {
                    pendingDropQty = qty;

                    // Restore listener for YES/NO
                    if (inventoryMenuListener != 0) {
                        llListenRemove(inventoryMenuListener);
                    }
                    inventoryMenuListener = llListen(MENU_CHANNEL, "", ownerKey, "");

                    string confirmText = "Drop " + (string)pendingDropQty + " " + pendingDropItemName + "?";
                    list confirmButtons = ["Yes", "No"];
                    llDialog(ownerKey, confirmText, confirmButtons, MENU_CHANNEL);
                } else {
                    notify("Invalid quantity. Please enter a positive number.");
                    llTextBox(ownerKey, "Enter quantity to drop:", inventoryTextInputChannel);
                }
            }
        }
    }
    
    timer() {
        // Clean up inventory menu listener if timer expires
        if (inventoryMenuListener != 0) {
            llListenRemove(inventoryMenuListener);
            inventoryMenuListener = 0;
        }
        dropQtyStep = 0;
        pendingDropItemName = "";
        pendingDropQty = 0;
        inventoryTextInputChannel = 0;
        llSetTimerEvent(0.0);
    }
}

