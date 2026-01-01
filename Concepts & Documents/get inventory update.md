The code for getting the inventory is wrong.  Please review the code below and update the scripts accordingly.

getInventoryFromFirestore(integer senderLink)
{
    // Step 1: get character ID
    key requestId = getCharacterInfo();

    // Track this request
    pendingInventoryUpdates += [requestId, "GET_INVENTORY_CHARACTER", senderLink];

    debugLog("Requesting inventory for UUID: " + ownerUUID + " (getting character ID first)");
}

// Handle GET_INVENTORY_CHARACTER
if (operation == "GET_INVENTORY_CHARACTER")
{
    integer senderLink = llList2Integer(pendingInventoryUpdates, index + 2);

    // Remove tracking entry
    pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, index, index + 2);

    if (status != 200)
    {
        debugLog("ERROR: Failed to get character ID for inventory: " + (string)status);
        llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
        return;
    }

    // Extract character ID
    string firstResult = llJsonGetValue(body, [0]);
    string characterId = "";
    if (firstResult != JSON_INVALID && firstResult != "")
    {
        string document = llJsonGetValue(firstResult, ["document"]);
        if (document != JSON_INVALID && document != "")
        {
            string name = llJsonGetValue(document, ["name"]);
            if (name != JSON_INVALID && name != "")
            {
                list parts = llParseString2List(name, ["/"], []);
                characterId = llList2String(parts, llGetListLength(parts) - 1);
            }
        }
    }

    if (characterId == "")
    {
        debugLog("ERROR: Could not extract character ID");
        llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
        return;
    }

    // Step 2: fetch character document
    key req = getCharacterDocument(characterId);

    // Track GET_INVENTORY
    pendingInventoryUpdates += [req, "GET_INVENTORY", senderLink];

    debugLog("Got character ID: " + characterId + ", getting inventory...");
    return;
}

// Handle GET_INVENTORY
if (operation == "GET_INVENTORY")
{
    integer senderLink = llList2Integer(pendingInventoryUpdates, index + 2);

    // Remove tracking entry
    pendingInventoryUpdates = llDeleteSubList(pendingInventoryUpdates, index, index + 2);

    if (status != 200)
    {
        debugLog("ERROR: Failed to get inventory: " + (string)status);
        llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
        return;
    }

    // Extract inventory field
    string inventoryField = llJsonGetValue(body, ["fields", "inventory"]);

    if (inventoryField == JSON_INVALID || inventoryField == "")
    {
        debugLog("No inventory found for character");
        llMessageLinked(senderLink, 0, "inventory", "{\"mapValue\":{\"fields\":{}}}");
        return;
    }

    debugLog("Inventory retrieved successfully");
    llMessageLinked(senderLink, 0, "inventory", inventoryField);
    return;
}

