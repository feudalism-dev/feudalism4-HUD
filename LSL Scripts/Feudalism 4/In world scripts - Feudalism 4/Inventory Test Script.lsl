// ============================================================================
// Inventory Test Script
// ============================================================================
// Standalone script that accesses Firestore via REST API
// Solves: 2048 byte JSON limit and LSL memory constraints
// Approach: Firestore-native pagination with minimal state storage
// ============================================================================

// =========================== CONFIGURATION ==================================
string FIREBASE_PROJECT_ID = "feudalism4-rpg";
string FIRESTORE_BASE_URL = "";  // Will be built in state_entry()

// Test character ID (used if not found in linkset data)
string TEST_CHARACTER_ID = "dCNjYbAbLjiCp2ffpwKI";

// Page size for Firestore requests (small to avoid 2048 byte limit)
integer FIRESTORE_PAGE_SIZE = 5;

// Dialog display settings
integer ITEMS_PER_DIALOG_PAGE = 8;  // Max items to show in one dialog

// Menu channel
integer MENU_CHANNEL = -999888;

// Debug mode
integer DEBUG_MODE = TRUE;

// =========================== STATE VARIABLES =================================
key ownerKey;
string characterId = "";

// Pagination state
string currentPageToken = "";  // Firestore pageToken for next page
list pageTokenHistory = [];  // Stack of page tokens as we navigate forward
integer hasMorePages = FALSE;
integer currentPageNumber = 1;

// Current page data (minimal storage)
list currentItemNames = [];
list currentItemQuantities = [];
list currentItemIds = [];  // Store item IDs for operations

// Menu state
integer menuListener = 0;
integer currentMenuMode = 0;  // 0=view, 1=item actions
string selectedItemName = "";
string selectedItemId = "";
integer selectedItemQty = 0;

// Request tracking
key pendingRequestId = NULL_KEY;
integer isRequestPending = FALSE;

// =========================== HELPER FUNCTIONS ================================

debugLog(string message) {
    if (DEBUG_MODE) {
        llOwnerSay("[Inventory Test] " + message);
    }
}

notify(string message) {
    llOwnerSay("[Inventory] " + message);
}

// Extract value from Firestore field structure
string extractFirestoreValue(string fieldData) {
    if (fieldData == JSON_INVALID || fieldData == "") return "";
    
    string stringVal = llJsonGetValue(fieldData, ["stringValue"]);
    if (stringVal != JSON_INVALID && stringVal != "") {
        // Remove quotes if present
        if (llGetSubString(stringVal, 0, 0) == "\"" && llGetSubString(stringVal, -1, -1) == "\"") {
            stringVal = llGetSubString(stringVal, 1, -2);
        }
        return stringVal;
    }
    
    string intVal = llJsonGetValue(fieldData, ["integerValue"]);
    if (intVal != JSON_INVALID && intVal != "") {
        return intVal;
    }
    
    return "";
}

// Build Firestore listDocuments URL with pagination
string buildListInventoryUrl(string charId, string pageToken) {
    string path = "/characters/" + llEscapeURL(charId) + "/inventory";
    string url = FIRESTORE_BASE_URL + path + "?pageSize=" + (string)FIRESTORE_PAGE_SIZE;
    
    if (pageToken != "") {
        url = url + "&pageToken=" + llEscapeURL(pageToken);
    }
    
    return url;
}

// Request inventory page from Firestore
requestInventoryPage(string charId, string pageToken) {
    if (isRequestPending) {
        debugLog("Request already pending, ignoring duplicate request");
        return;
    }
    
    if (charId == "" || charId == "JSON_INVALID") {
        notify("Error: No character ID available.");
        return;
    }
    
    isRequestPending = TRUE;
    string url = buildListInventoryUrl(charId, pageToken);
    
    debugLog("Requesting: " + url);
    
    // Make GET request to Firestore REST API
    pendingRequestId = llHTTPRequest(url, [
        HTTP_METHOD, "GET",
        HTTP_MIMETYPE, "application/json"
    ], "");
}

// Parse Firestore listDocuments response
parseInventoryResponse(string body) {
    isRequestPending = FALSE;
    pendingRequestId = NULL_KEY;
    
    if (body == "" || body == JSON_INVALID) {
        notify("Error: Empty response from Firestore.");
        return;
    }
    
    // Clear current page data
    currentItemNames = [];
    currentItemQuantities = [];
    currentItemIds = [];
    
    // Extract documents array
    string documentsJson = llJsonGetValue(body, ["documents"]);
    
    if (documentsJson == JSON_INVALID || documentsJson == "") {
        // No documents - empty inventory
        showInventoryMenu();
        return;
    }
    
    // Parse each document
    integer i = 0;
    
    while (TRUE) {
        string docJson = llJsonGetValue(documentsJson, [i]);
        if (docJson == JSON_INVALID || docJson == "") jump done_parse;
        
        string itemId = "";
        string itemName = "";
        integer qty = 0;
        
        // Extract document name to get item ID
        string docName = llJsonGetValue(docJson, ["name"]);
        if (docName != JSON_INVALID && docName != "") {
            // Remove quotes
            if (llGetSubString(docName, 0, 0) == "\"" && llGetSubString(docName, -1, -1) == "\"") {
                docName = llGetSubString(docName, 1, -2);
            }
            
            // Extract item ID from path: .../inventory/{itemId}
            integer lastSlash = llSubStringIndex(docName, "/inventory/");
            if (lastSlash != -1) {
                itemId = llGetSubString(docName, lastSlash + 11, -1);
                itemName = itemId;  // Default to itemId as name
            }
        }
        
        // Extract fields
        string fieldsJson = llJsonGetValue(docJson, ["fields"]);
        if (fieldsJson != JSON_INVALID && fieldsJson != "") {
            // Get qty field
            string qtyField = llJsonGetValue(fieldsJson, ["qty"]);
            string qtyStr = extractFirestoreValue(qtyField);
            qty = (integer)qtyStr;
            
            // Check for name field (if stored separately)
            string nameField = llJsonGetValue(fieldsJson, ["name"]);
            string nameFromField = extractFirestoreValue(nameField);
            if (nameFromField != "") {
                // Use name from field if available
                itemName = nameFromField;
            }
        }
        
        // Only add items with valid ID and quantity > 0
        if (itemId != "" && qty > 0) {
            currentItemIds += [itemId];
            currentItemNames += [itemName];
            currentItemQuantities += [qty];
        }
        
        i++;
    }
    @done_parse;
    
    // Extract nextPageToken
    string nextPageToken = llJsonGetValue(body, ["nextPageToken"]);
    if (nextPageToken != JSON_INVALID && nextPageToken != "") {
        // Remove quotes
        if (llGetSubString(nextPageToken, 0, 0) == "\"" && llGetSubString(nextPageToken, -1, -1) == "\"") {
            nextPageToken = llGetSubString(nextPageToken, 1, -2);
        }
        currentPageToken = nextPageToken;
        hasMorePages = TRUE;
    } else {
        currentPageToken = "";
        hasMorePages = FALSE;
    }
    
    debugLog("Parsed " + (string)llGetListLength(currentItemNames) + " items. Has more: " + (string)hasMorePages);
    
    // Show menu with current page
    showInventoryMenu();
}

// Show inventory menu dialog
showInventoryMenu() {
    // Remove old listener
    if (menuListener != 0) {
        llListenRemove(menuListener);
    }
    
    // Create new listener
    menuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    // Build dialog message
    string message = "[Inventory Page " + (string)currentPageNumber + "]\n\n";
    
    integer itemCount = llGetListLength(currentItemNames);
    integer i;
    
    if (itemCount == 0) {
        message = message + "Empty inventory\n";
    } else {
        for (i = 0; i < itemCount; i++) {
            string itemName = llList2String(currentItemNames, i);
            integer qty = llList2Integer(currentItemQuantities, i);
            message = message + (string)(i + 1) + ". " + itemName + " (" + (string)qty + ")\n";
        }
    }
    
    message = message + "\nSelect an option:";
    
    // Build buttons
    list buttons = [];
    
    // Pagination buttons
    if (hasMorePages) {
        buttons += ["Next Page"];
    }
    
    if (currentPageNumber > 1) {
        buttons += ["Prev Page"];
    }
    
    // Action buttons
    buttons += ["Select Item", "Refresh", "Close"];
    
    // Show dialog
    llDialog(ownerKey, message, buttons, MENU_CHANNEL);
    
    // Set timer
    llSetTimerEvent(60.0);
}

// Show item action menu
showItemActionMenu(string itemName, string itemId, integer qty) {
    currentMenuMode = 1;
    selectedItemName = itemName;
    selectedItemId = itemId;
    selectedItemQty = qty;
    
    // Remove old listener
    if (menuListener != 0) {
        llListenRemove(menuListener);
    }
    
    // Create new listener
    menuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    string message = "\n[" + itemName + "]\nQuantity: " + (string)qty + "\n\nSelect action:";
    list buttons = ["Drop", "Give", "Use", "Consume", "Back"];
    
    llDialog(ownerKey, message, buttons, MENU_CHANNEL);
    llSetTimerEvent(60.0);
}

// Request next page
requestNextPage() {
    if (!hasMorePages) {
        notify("No more pages.");
        return;
    }
    
    if (isRequestPending) {
        notify("Please wait for current request to complete.");
        return;
    }
    
    // Save current token to history (for potential future use)
    // Note: Firestore tokens can't go backwards, but we store for reference
    if (currentPageToken != "") {
        pageTokenHistory += [currentPageToken];
    }
    
    // Request next page using current token
    requestInventoryPage(characterId, currentPageToken);
    currentPageNumber++;
}

// Request previous page
// Note: Firestore doesn't support backward pagination with tokens.
// We'll reset to page 1 and let user navigate forward again.
// Alternative: Could implement page caching, but that uses more memory.
requestPrevPage() {
    if (currentPageNumber <= 1) {
        notify("Already on first page.");
        return;
    }
    
    if (isRequestPending) {
        notify("Please wait for current request to complete.");
        return;
    }
    
    // Reset to first page (Firestore limitation: can't go backwards with tokens)
    notify("Returning to first page...");
    currentPageToken = "";
    pageTokenHistory = [];
    currentPageNumber = 1;
    requestInventoryPage(characterId, "");
}

// Start select item flow
startSelectItemFlow() {
    // Remove old listener
    if (menuListener != 0) {
        llListenRemove(menuListener);
    }
    
    // Create new listener
    menuListener = llListen(MENU_CHANNEL, "", ownerKey, "");
    
    // Build item list text
    string listText = "[Select Item]\n\n";
    integer count = llGetListLength(currentItemNames);
    integer i;
    
    for (i = 0; i < count; i++) {
        string name = llList2String(currentItemNames, i);
        integer qty = llList2Integer(currentItemQuantities, i);
        listText = listText + (string)(i + 1) + ". " + name + " (" + (string)qty + ")\n";
    }
    
    listText = listText + "\nEnter item number:";
    
    // Use text input (we'll parse the number in listen)
    integer textChannel = (integer)llFrand(-100000) - 100000;
    menuListener = llListen(textChannel, "", ownerKey, "");
    
    llTextBox(ownerKey, listText, textChannel);
    llSetTimerEvent(60.0);
}

// Handle item selection by number
handleItemSelection(string input) {
    integer itemNum = (integer)input;
    integer itemCount = llGetListLength(currentItemNames);
    
    if (itemNum < 1 || itemNum > itemCount) {
        notify("Invalid item number. Please enter 1-" + (string)itemCount);
        startSelectItemFlow();
        return;
    }
    
    integer index = itemNum - 1;
    string itemName = llList2String(currentItemNames, index);
    string itemId = llList2String(currentItemIds, index);
    integer qty = llList2Integer(currentItemQuantities, index);
    
    showItemActionMenu(itemName, itemId, qty);
}

// Perform item action (placeholder - implement actual Firestore updates)
performItemAction(string action, string itemId, integer qty) {
    notify("Action: " + action + " on " + selectedItemName + " (qty: " + (string)qty + ")");
    
    // TODO: Implement actual Firestore PATCH requests to update inventory
    // For now, just refresh the inventory
    llSleep(0.5);
    currentPageToken = "";
    pageTokenHistory = [];
    currentPageNumber = 1;
    requestInventoryPage(characterId, "");
}

// =========================== MAIN STATE ======================================

default {
    state_entry() {
        ownerKey = llGetOwner();
        
        // Build Firestore base URL (can't concatenate in global scope)
        FIRESTORE_BASE_URL = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents";
        
        // Try to get characterId from linkset data, fallback to test ID
        characterId = llLinksetDataRead("characterId");
        
        if (characterId == "" || characterId == "JSON_INVALID") {
            characterId = TEST_CHARACTER_ID;
            notify("Using test character ID: " + characterId);
        }
        
        debugLog("Script initialized. Character ID: " + characterId);
    }
    
    touch_start(integer total_number) {
        if (llDetectedKey(0) != ownerKey) return;
        
        // Load character ID (try linkset data first, then test ID)
        characterId = llLinksetDataRead("characterId");
        
        if (characterId == "" || characterId == "JSON_INVALID") {
            characterId = TEST_CHARACTER_ID;
            debugLog("Using test character ID: " + characterId);
        }
        
        // Reset pagination state
        currentPageToken = "";
        pageTokenHistory = [];
        currentPageNumber = 1;
        hasMorePages = FALSE;
        
        // Request first page
        requestInventoryPage(characterId, "");
    }
    
    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id != pendingRequestId) {
            debugLog("Ignoring response for unknown request: " + (string)request_id);
            return;
        }
        
        if (status != 200) {
            notify("Error: Firestore request failed. Status: " + (string)status);
            debugLog("Response body: " + body);
            isRequestPending = FALSE;
            pendingRequestId = NULL_KEY;
            return;
        }
        
        // Check if response is truncated (LSL limit is 2048 bytes)
        if (llStringLength(body) >= 2047) {
            debugLog("WARNING: Response may be truncated! Length: " + (string)llStringLength(body));
            // Reduce page size for next request
            if (FIRESTORE_PAGE_SIZE > 2) {
                FIRESTORE_PAGE_SIZE = FIRESTORE_PAGE_SIZE - 1;
                debugLog("Reduced page size to: " + (string)FIRESTORE_PAGE_SIZE);
            }
        }
        
        parseInventoryResponse(body);
    }
    
    listen(integer channel, string name, key id, string message) {
        if (id != ownerKey) return;
        
        message = llToLower(llStringTrim(message, STRING_TRIM));
        
        // View menu mode
        if (currentMenuMode == 0) {
            if (message == "next page") {
                requestNextPage();
            }
            else if (message == "prev page") {
                requestPrevPage();
            }
            else if (message == "select item") {
                startSelectItemFlow();
            }
            else if (message == "refresh") {
                // Reset and reload first page
                currentPageToken = "";
                pageTokenHistory = [];
                currentPageNumber = 1;
                requestInventoryPage(characterId, "");
            }
            else if (message == "close") {
                if (menuListener != 0) {
                    llListenRemove(menuListener);
                    menuListener = 0;
                }
                llSetTimerEvent(0.0);
            }
            else {
                // Try to parse as item number
                integer itemNum = (integer)message;
                if (itemNum > 0) {
                    handleItemSelection(message);
                }
            }
        }
        // Item action menu mode
        else if (currentMenuMode == 1) {
            if (message == "drop") {
                // Ask for quantity
                notify("Drop functionality - enter quantity in chat (or implement text input)");
                // TODO: Implement quantity input
            }
            else if (message == "give") {
                notify("Give functionality - not yet implemented");
            }
            else if (message == "use") {
                notify("Use functionality - not yet implemented");
            }
            else if (message == "consume") {
                performItemAction("consume", selectedItemId, 1);
            }
            else if (message == "back") {
                currentMenuMode = 0;
                showInventoryMenu();
            }
        }
    }
    
    timer() {
        // Clean up on timeout
        if (menuListener != 0) {
            llListenRemove(menuListener);
            menuListener = 0;
        }
        currentMenuMode = 0;
        selectedItemName = "";
        selectedItemId = "";
        selectedItemQty = 0;
        llSetTimerEvent(0.0);
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        // Allow external scripts to trigger inventory menu
        if (msg == "show_inventory") {
            characterId = llLinksetDataRead("characterId");
            if (characterId == "" || characterId == "JSON_INVALID") {
                characterId = TEST_CHARACTER_ID;
            }
            currentPageToken = "";
            pageTokenHistory = [];
            currentPageNumber = 1;
            requestInventoryPage(characterId, "");
        }
    }
}

