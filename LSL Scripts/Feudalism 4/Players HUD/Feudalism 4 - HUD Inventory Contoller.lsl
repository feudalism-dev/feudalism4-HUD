// ============================================================================
// Feudalism 4 - HUD Inventory Controller
// ============================================================================
// Handles all inventory UI and logic (moved from Combined HUD Controller)
// 
// Coin Items:
// The following items are treated as standard stackable inventory items:
// - gold_coin
// - silver_coin
// - copper_coin
// These items work with fGiveItem/fTakeItem and cGiveItem/cTakeItem
// exactly like any other inventory item. They are stored in Firestore
// and tracked via the inventory cache system.
// ============================================================================

// =========================== CONFIGURATION ==================================
// Debug settings
integer DEBUG_MODE = FALSE;  // Enable debug logging (set to TRUE only when debugging)

// Page size (must match Bridge INVENTORY_PAGE_SIZE_CAP = 5)
integer INVENTORY_PAGE_SIZE = 5;

// Debug function - centralized logging
debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Inventory] " + message);
    }
}

// =========================== COMMUNICATION CHANNELS ========================
integer MENU_CHANNEL = -777799;
integer FS_BRIDGE_CHANNEL = -777001;  // Channel for Bridge responses to HUD controllers
integer HUD_CHANNEL = -77770;  // Channel for HUD-to-HUD communication (cGiveItem)

// =========================== STATE VARIABLES ================================
// Owner info
key ownerKey;

// Inventory dialog state
integer inventoryMenuListener = 0;
integer inventoryTextInputChannel = 0;
string pendingDropItemName = "";
integer pendingDropQty = 0;
integer dropQtyStep = 0;  // 0=waiting for item name, 1=waiting for quantity, 2=waiting for confirmation

// Pagination state (v2: cursor-based with history stack)
string currentInventoryCursor = "";  // Next page token (from last response's nextPageToken)
string cursorUsedForCurrentPage = "";  // The cursor we used to request the CURRENT page (for history)
list cursorHistory = [];  // Stack of cursors: [cursor1, cursor2, ...] where each cursor is the START token for that page
integer currentInventoryHasMore = FALSE;
integer nextInFlight = FALSE;  // Prevent duplicate Next Page requests
string currentCharacterId = "";

// New menu system state
integer MENU_MODE_VIEW = 0;
integer MENU_MODE_ITEM = 1;
integer currentMenuMode = MENU_MODE_VIEW;
integer currentPageNumber = 1;
integer totalPages = 0;  // Only set when we know we're on the last page
list currentPageItemNames = [];
list currentPageItemQuantities = [];
string selectedItemName = "";
integer selectedItemQty = 0;
string searchTerm = "";
integer isSearchMode = FALSE;

// =========================== HELPER FUNCTIONS ================================

notify(string message) {
    llOwnerSay("[Feudalism 4] " + message);
}

// =========================== INVENTORY MENU FUNCTIONS ======================

// Show inventory main menu - NEW: requests inventory and shows VIEW layer
showInventoryMainMenu() {
    // Reset state
    currentMenuMode = MENU_MODE_VIEW;
    currentPageNumber = 1;
    cursorHistory = [];  // Clear cursor history
    currentInventoryCursor = "";  // Will be set to nextPageToken from response
    cursorUsedForCurrentPage = "";  // First page uses empty cursor
    currentInventoryHasMore = FALSE;
    nextInFlight = FALSE;  // Reset in-flight flag
    searchTerm = "";
    isSearchMode = FALSE;
    
    // Request first page of inventory
    string characterId = llLinksetDataRead("characterId");
    if (characterId != "" && characterId != "JSON_INVALID") {
        cursorUsedForCurrentPage = "";  // Track that we're using "" cursor for page 1
        string payload = llJsonSetValue("{}", ["characterId"], characterId);
        payload = llJsonSetValue(payload, ["cursor"], "");
        payload = llJsonSetValue(payload, ["pageSize"], (string)INVENTORY_PAGE_SIZE);
        
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
    } else {
        notify("No character selected.");
    }
}

// Print inventory list to chat and show VIEW menu
printInventoryListAndShowViewMenu(list itemNames, list itemQuantities, integer pageNum, integer totalPages) {
    // Print formatted list to chat
    string chatOutput = "[Inventory Page " + (string)pageNum;
    // Only show total if we know it (when totalPages is set and equals current page, meaning we're on last page)
    if (totalPages > 0 && totalPages == pageNum) {
        chatOutput = chatOutput + "/" + (string)totalPages;
    }
    chatOutput = chatOutput + "]\n";
    
    integer itemCount = llGetListLength(itemNames);
    integer i;
    for (i = 0; i < itemCount; i++) {
        string itemName = llList2String(itemNames, i);
        integer qty = llList2Integer(itemQuantities, i);
        chatOutput = chatOutput + (string)(i + 1) + ". " + itemName + " (" + (string)qty + ")\n";
    }
    
    if (itemCount == 0) {
        chatOutput = chatOutput + "Empty";
    }
    
    notify(chatOutput);
    
    // Build dialog message with same inventory list
    string dialogMessage = "[Inventory Page " + (string)pageNum;
    // Only show total if we know it (when totalPages is set and equals current page, meaning we're on last page)
    if (totalPages > 0 && totalPages == pageNum) {
        dialogMessage = dialogMessage + "/" + (string)totalPages;
    }
    dialogMessage = dialogMessage + "]\n";
    
    for (i = 0; i < itemCount; i++) {
        string itemName = llList2String(itemNames, i);
        integer qty = llList2Integer(itemQuantities, i);
        dialogMessage = dialogMessage + (string)(i + 1) + ". " + itemName + " (" + (string)qty + ")\n";
    }
    
    if (itemCount == 0) {
        dialogMessage = dialogMessage + "Empty\n";
    }
    
    dialogMessage = dialogMessage + "\nSelect an option:";
    
    // Show VIEW menu dialog
    list menuButtons = [];

    // Only show Next Page if there is a next page and no request is in flight
    if (currentInventoryHasMore && !nextInFlight) {
        menuButtons += ["Next Page"];
    }

    // Only show Prev Page if we are not on page 1
    if (currentPageNumber > 1) {
        menuButtons += ["Prev Page"];
    }

    // Always show these
    menuButtons += ["Search", "Select Item", "Close"];
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create new listener for menu responses
    inventoryMenuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    // Show dialog with inventory list in message
    llDialog(ownerKey, dialogMessage, menuButtons, MENU_CHANNEL);
    
    // Set timer
    llSetTimerEvent(60.0);
}

// Show ITEM MENU (action layer)
showItemMenu(string itemName, integer qty) {
    currentMenuMode = MENU_MODE_ITEM;
    selectedItemName = itemName;
    selectedItemQty = qty;
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create new listener
    inventoryMenuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    string message = "\n[" + itemName + "]\nQty: " + (string)qty;
    list buttons = ["Consume", "Drop", "Back"];
    
    llDialog(ownerKey, message, buttons, MENU_CHANNEL);
    
    // Set timer
    llSetTimerEvent(60.0);
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
        payload = llJsonSetValue(payload, ["pageSize"], (string)INVENTORY_PAGE_SIZE);
        
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
    } else {
        // No characterId - show empty
        showViewItemsDialogFromLists([], [], "", FALSE);
    }
}

// Request next inventory page (v2: cursor-based pagination)
requestNextInventoryPage() {
    // Prevent duplicate requests
    if (nextInFlight) {
        return;
    }
    
    if (!currentInventoryHasMore) {
        notify("No more pages.");
        return;
    }
    
    string characterId = llLinksetDataRead("characterId");
    if (characterId == "" || characterId == "JSON_INVALID") {
        notify("Cannot load next page: No character selected.");
        return;
    }
    
    // Set in-flight flag and disable Next button
    nextInFlight = TRUE;
    
    // Save the cursor we used to get the CURRENT page to history (for going back)
    // cursorUsedForCurrentPage is the cursor we used to request the page we're currently viewing
    cursorHistory += [cursorUsedForCurrentPage];
    
    // currentInventoryCursor is the nextPageToken from the previous response
    // This is the cursor we'll use to request the NEXT page
    string nextPageCursor = currentInventoryCursor;
    
    // Track what cursor we're using for the NEXT page (so we can save it to history later)
    cursorUsedForCurrentPage = nextPageCursor;
    
    // Pass cursor for next page (this is the nextPageToken from previous response)
    string payload = llJsonSetValue("{}", ["characterId"], characterId);
    payload = llJsonSetValue(payload, ["cursor"], nextPageCursor);
    payload = llJsonSetValue(payload, ["pageSize"], (string)INVENTORY_PAGE_SIZE);
    
    // Send to Bridge (payload will be received as (string)id in link_message)
    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
    currentPageNumber++;
}

// Request previous inventory page (uses cursor history for proper backward navigation)
requestPrevInventoryPage() {
    string characterId = llLinksetDataRead("characterId");
    if (characterId == "" || characterId == "JSON_INVALID") {
        notify("Cannot load previous page: No character selected.");
        return;
    }
    
    if (currentPageNumber <= 1) {
        notify("Already on first page.");
        return;
    }
    
    if (llGetListLength(cursorHistory) == 0) {
        // No history - go back to first page
        string payload = llJsonSetValue("{}", ["characterId"], characterId);
        payload = llJsonSetValue(payload, ["cursor"], "");
        payload = llJsonSetValue(payload, ["pageSize"], (string)INVENTORY_PAGE_SIZE);
        currentPageNumber = 1;
        currentInventoryCursor = "";
        cursorHistory = [];
        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
        return;
    }
    
    // Pop the last cursor from history (this is the cursor that gets us to the previous page)
    integer historyLen = llGetListLength(cursorHistory);
    string prevCursor = llList2String(cursorHistory, historyLen - 1);
    cursorHistory = llDeleteSubList(cursorHistory, historyLen - 1, historyLen - 1);
    
    // Track what cursor we're using for the previous page
    cursorUsedForCurrentPage = prevCursor;
    
    // Use the popped cursor to request the previous page
    string payload = llJsonSetValue("{}", ["characterId"], characterId);
    payload = llJsonSetValue(payload, ["cursor"], prevCursor);
    payload = llJsonSetValue(payload, ["pageSize"], (string)INVENTORY_PAGE_SIZE);
    
    currentPageNumber--;
    // currentInventoryCursor will be updated when response arrives (it will be the nextPageToken from that page)
    
    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
}

// Start search flow
startSearchFlow() {
    // Set up text input for search term
    inventoryTextInputChannel = (integer)llFrand(-100000) - 100000;
    isSearchMode = TRUE;
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create listener for text input
    inventoryMenuListener = llListen(inventoryTextInputChannel, "", ownerKey, "");
    
    // Request text input for search term
    llTextBox(ownerKey, "Enter search term:", inventoryTextInputChannel);
    
    // Set timer
    llSetTimerEvent(60.0);
}

// Start select item flow
startSelectItemFlow() {
    // Set up text input for item number
    inventoryTextInputChannel = (integer)llFrand(-100000) - 100000;
    
    // Remove any existing listener
    if (inventoryMenuListener != 0) {
        llListenRemove(inventoryMenuListener);
    }
    
    // Create listener for text input
    inventoryMenuListener = llListen(inventoryTextInputChannel, "", ownerKey, "");
    
    // Build the same list shown in the VIEW menu
    string listText = "[Inventory Page " + (string)currentPageNumber + "]\n";
    integer count = llGetListLength(currentPageItemNames);
    integer i;
    for (i = 0; i < count; i++) {
        string name = llList2String(currentPageItemNames, i);
        integer qty = llList2Integer(currentPageItemQuantities, i);
        listText += (string)(i + 1) + ". " + name + " (" + (string)qty + ")\n";
    }

    // Show the list + prompt
    llTextBox(ownerKey,
        listText + "\nEnter item number:",
        inventoryTextInputChannel);
    
    // Set timer
    llSetTimerEvent(60.0);
}


// Show view items dialog from parsed lists (v2: with pagination support)
showViewItemsDialogFromLists(list itemNames, list itemQuantities, string cursor, integer hasMore) {
    string displayText = "[Inventory Page " + (string)currentPageNumber;
    // Only show total if we know it (when totalPages is set and equals current page, meaning we're on last page)
    if (totalPages > 0 && totalPages == currentPageNumber) {
        displayText = displayText + "/" + (string)totalPages;
    }
    displayText = displayText + "]\n\n";
    
    integer itemCount = llGetListLength(itemNames);
    
    if (itemCount == 0) {
        displayText += "Empty";
    } else {
        integer i;
        integer maxItems = 12; // Limit to prevent dialog overflow
        integer displayedCount = 0;
        
        for (i = 0; i < itemCount && displayedCount < maxItems; i++) {
            string itemName = llList2String(itemNames, i);
            integer qty = llList2Integer(itemQuantities, i);
            if (qty > 0) {
                displayText += (string)(displayedCount + 1) + ". " + itemName + " (" + (string)qty + ")\n";
                displayedCount++;
            }
        }
        
        if (displayedCount == 0) {
            displayText += "Empty";
        }
    }
    
    displayText += "\nSelect an option:";
    
    // Build menu buttons with pagination support
    list menuButtons = [];
    
    // Show Next Page if there is a next page and no request is in flight
    if (hasMore && !nextInFlight) {
        menuButtons += ["Next Page"];
    }
    
    // Show Prev Page if we are not on page 1
    if (currentPageNumber > 1) {
        menuButtons += ["Prev Page"];
    }
    
    // Always show these
    menuButtons += ["Search", "Select Item", "Back"];
    
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
            
            integer pageSize = INVENTORY_PAGE_SIZE;  // Normal view items (matches Bridge cap)
            payload = llJsonSetValue(payload, ["pageSize"], (string)pageSize);
            
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

    // Firestore Bridge reports error applying deltas
    else if (num == FS_BRIDGE_CHANNEL && msg == "inventoryDeltasError") {
        notify("Failed to apply inventory deltas: " + (string)id);
        debugLog("ERROR: Failed to apply inventory deltas: " + (string)id);
    }
    
    // Firestore Bridge confirms deltas applied
    else if (num == FS_BRIDGE_CHANNEL && msg == "inventoryDeltasApplied") {
    }
    
    // Handle inventoryPage response from Firestore Bridge (v2: JSON format)

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
        
        // LSL's llJsonGetValue doesn't handle booleans well - check the raw JSON string instead
        integer hasMore = FALSE;
        // Check if "hasMore":true exists in the JSON (case-sensitive)
        if (llSubStringIndex(responseJson, "\"hasMore\":true") != -1) {
            hasMore = TRUE;
        } else if (llSubStringIndex(responseJson, "\"hasMore\":1") != -1) {
            hasMore = TRUE;
        }
        
        // Store cursor exactly as received (remove JSON quotes only, no other processing)
        if (cursor != JSON_INVALID && cursor != "") {
            // Remove surrounding quotes if present (JSON encoding)
            if (llStringLength(cursor) >= 2 && llGetSubString(cursor, 0, 0) == "\"" && llGetSubString(cursor, -1, -1) == "\"") {
                cursor = llGetSubString(cursor, 1, -2);
            }
        } else {
            cursor = "";
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
        // cursor from response is the nextPageToken (for the NEXT page)
        currentInventoryCursor = cursor;  // This becomes the token for the next page
        // cursorUsedForCurrentPage is the cursor we used to REQUEST this page
        // We need to track this separately - it's set when we make the request
        // For now, if this is the first page (cursor was ""), we know cursorUsedForCurrentPage = ""
        // For subsequent pages, cursorUsedForCurrentPage was set in requestNextInventoryPage before the request
        currentInventoryHasMore = hasMore;
        
        // Clear in-flight flag when response arrives
        nextInFlight = FALSE;
        
        // Store current page items for selection
        currentPageItemNames = itemNames;
        currentPageItemQuantities = itemQuantities;
        
        // Safety check: if isSearchMode is TRUE but searchTerm is empty, reset it
        if (isSearchMode && searchTerm == "") {
            isSearchMode = FALSE;
        }
        
        // Apply search filter if in search mode
        if (isSearchMode && searchTerm != "") {
            // Get all items first (need to fetch full inventory for search)
            // For now, filter current page only
            list filteredNames = [];
            list filteredQuantities = [];
            integer i;
            integer count = llGetListLength(itemNames);
            string searchLower = llToLower(searchTerm);
            
            for (i = 0; i < count; i++) {
                string itemName = llList2String(itemNames, i);
                integer qty = llList2Integer(itemQuantities, i);
                string itemNameLower = llToLower(itemName);
                
                if (llSubStringIndex(itemNameLower, searchLower) != -1) {
                    filteredNames += [itemName];
                    filteredQuantities += [qty];
                }
            }
            
            itemNames = filteredNames;
            itemQuantities = filteredQuantities;
            currentPageItemNames = itemNames;
            currentPageItemQuantities = itemQuantities;
        }
        
        // Calculate total pages - only set when we know we're on the last page
        // When hasMore is true, we don't know the total, so don't update totalPages
        if (!hasMore) {
            // We're on the last page, so totalPages = currentPageNumber
            totalPages = currentPageNumber;
        }
        // If hasMore is true, keep totalPages as is (don't increment it)
        
        // New VIEW menu flow
        if (currentMenuMode == MENU_MODE_VIEW) {
            printInventoryListAndShowViewMenu(itemNames, itemQuantities, currentPageNumber, totalPages);
        }
        // Legacy view-items flow (for backward compatibility)
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
            
            // VIEW MENU options
            if (currentMenuMode == MENU_MODE_VIEW) {
                if (message == "next page" || message == "Next Page") {
                    if (nextInFlight) {
                        notify("Please wait for the current page to load.");
                    } else if (currentInventoryHasMore) {
                        requestNextInventoryPage();
                    } else {
                        notify("No more pages.");
                    }
                }
                else if (message == "prev page" || message == "Prev Page") {
                    requestPrevInventoryPage();
                }
                else if (message == "search") {
                    startSearchFlow();
                }
                else if (message == "select item") {
                    startSelectItemFlow();
                }
                else if (message == "close") {
                    // Close menu - clean up
                    if (inventoryMenuListener != 0) {
                        llListenRemove(inventoryMenuListener);
                        inventoryMenuListener = 0;
                    }
                    currentMenuMode = MENU_MODE_VIEW;
                    dropQtyStep = 0;
                    pendingDropItemName = "";
                    pendingDropQty = 0;
                    llSetTimerEvent(0.0);
                }
            }
            // ITEM MENU options
            else if (currentMenuMode == MENU_MODE_ITEM) {
                if (message == "consume") {
                    // Trigger consume logic
                    if (selectedItemName != "" && selectedItemQty > 0) {
                        // requestConsumeItem expects just the itemId (item name) as payload
                        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "requestConsumeItem", selectedItemName);
                        notify("Consuming " + selectedItemName + "...");
                    }
                    // Return to VIEW menu
                    currentMenuMode = MENU_MODE_VIEW;
                    selectedItemName = "";
                    selectedItemQty = 0;
                    showInventoryMainMenu();
                }
                else if (message == "drop") {
                    // Ask for quantity
                    inventoryTextInputChannel = (integer)llFrand(-100000) - 100000;

                    if (inventoryMenuListener != 0) {
                        llListenRemove(inventoryMenuListener);
                    }

                    inventoryMenuListener = llListen(inventoryTextInputChannel, "", ownerKey, "");

                    llTextBox(ownerKey,
                        "Enter quantity to drop:\n" +
                        selectedItemName + " (You have " + (string)selectedItemQty + ")",
                        inventoryTextInputChannel);

                    dropQtyStep = 1;
                    pendingDropItemName = selectedItemName;
                    llSetTimerEvent(60.0);
                }
                else if (message == "back") {
                    // Return to VIEW menu (same page)
                    currentMenuMode = MENU_MODE_VIEW;
                    selectedItemName = "";
                    selectedItemQty = 0;
                    // Re-display current page
                    printInventoryListAndShowViewMenu(currentPageItemNames, currentPageItemQuantities, currentPageNumber, totalPages);
                }
            }
            // Legacy menu handlers (for backward compatibility)
            else {
                if (message == "view items") {
                    showInventoryMainMenu();
                }
                else if (message == "drop item") {
                    if (dropQtyStep == 0) {
                        startDropItemFlow();
                    }
                }
                else if (message == "close") {
                    if (inventoryMenuListener != 0) {
                        llListenRemove(inventoryMenuListener);
                        inventoryMenuListener = 0;
                    }
                    dropQtyStep = 0;
                    pendingDropItemName = "";
                    pendingDropQty = 0;
                    llSetTimerEvent(0.0);
                }
                else if (message == "back") {
                    showInventoryMainMenu();
                }
                else if (message == "next page" || message == "Next Page") {
                    if (nextInFlight) {
                        notify("Please wait for the current page to load.");
                    } else if (currentInventoryHasMore) {
                        requestNextInventoryPage();
                    } else {
                        notify("No more items to display.");
                    }
                }
                else if (message == "prev page" || message == "Prev Page") {
                    requestPrevInventoryPage();
                }
            }
        }
        // Handle inventory text input (search, select item, item name, quantity)
        else if (channel == inventoryTextInputChannel && inventoryTextInputChannel != 0) {
            // Search mode
            if (isSearchMode) {
                searchTerm = llStringTrim(message, STRING_TRIM);
                
                if (searchTerm == "") {
                    notify("Search cancelled.");
                    isSearchMode = FALSE;
                    showInventoryMainMenu();
                } else {
                    // Request inventory and apply search filter
                    string characterId = llLinksetDataRead("characterId");
                    if (characterId != "" && characterId != "JSON_INVALID") {
                        string payload = llJsonSetValue("{}", ["characterId"], characterId);
                        payload = llJsonSetValue(payload, ["cursor"], "");
                        payload = llJsonSetValue(payload, ["pageSize"], (string)INVENTORY_PAGE_SIZE);
                        
                        // Keep isSearchMode = TRUE to filter results
                        llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL, "getInventoryPage", payload);
                    } else {
                        isSearchMode = FALSE;
                        notify("Cannot search: No character selected.");
                    }
                }
            }
            // Select item mode (number input)
            else if (currentMenuMode == MENU_MODE_VIEW) {
                integer itemNumber = (integer)message;
                integer itemCount = llGetListLength(currentPageItemNames);
                if (itemNumber > 0 && itemNumber <= itemCount) {
                    integer itemIndex = itemNumber - 1;
                    string itemName = llList2String(currentPageItemNames, itemIndex);
                    integer itemQty = llList2Integer(currentPageItemQuantities, itemIndex);
                    
                    // Show ITEM MENU
                    showItemMenu(itemName, itemQty);
                } else {
                    if (itemCount > 0) {
                        notify("Invalid item number. Please enter a number between 1 and " + (string)itemCount + ".");
                        startSelectItemFlow();
                    } else {
                        notify("No items to select.");
                        showInventoryMainMenu();
                    }
                }
            }
            // Drop flow - quantity
            else if (dropQtyStep == 1 && channel == inventoryTextInputChannel) {
                integer qty = (integer)message;

                if (qty <= 0) {
                    notify("Invalid quantity.");
                    dropQtyStep = 0;
                    pendingDropItemName = "";
                    return;
                }

                if (qty > selectedItemQty) {
                    notify("You don't have that many.");
                    dropQtyStep = 0;
                    pendingDropItemName = "";
                    return;
                }

                // Determine if this is a coin or an item
                string lower = llToLower(pendingDropItemName);
                integer isCoin = (lower == "gold_coin" || lower == "silver_coin" || lower == "copper_coin");

                // 1) SEND THE INVENTORY UPDATE FIRST
                if (isCoin) {
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL,
                        "cTakeItem",
                        pendingDropItemName + "|" + (string)qty);
                } else {
                    llMessageLinked(LINK_SET, FS_BRIDGE_CHANNEL,
                        "fTakeItem",
                        pendingDropItemName + "|" + (string)qty);
                }

                notify("Dropping " + (string)qty + " " + pendingDropItemName + "...");

                // 2) WAIT FOR FIRESTORE TO COMMIT
                llSleep(0.3);

                // 3) REFRESH INVENTORY USING THE SAME PATH AS TOUCH
                llMessageLinked(LINK_SET, 0, "show_inventory_menu", "");

                // 4) RESET DROP STATE
                dropQtyStep = 0;
                pendingDropItemName = "";
                selectedItemName = "";
                selectedItemQty = 0;

                return;
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
        currentMenuMode = MENU_MODE_VIEW;
        selectedItemName = "";
        selectedItemQty = 0;
        isSearchMode = FALSE;
        searchTerm = "";
        
        llSetTimerEvent(0.0);
    }
}

