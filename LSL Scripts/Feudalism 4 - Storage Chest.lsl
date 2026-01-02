// Feud4 Storage Container v1.0
// World-side, HUD-mediated, Feud3-compatible container
// - Contents stored in Linkset Data (LSD)
// - Uses cGiveItem / fGiveItem protocol
// - Simple dialog UI: View, Add, Remove, Transfer All, Access
// - No backend, no Firestore, no Bridge

// -----------------------------
// CONFIG
// -----------------------------
integer CHANNEL_HUD_ITEMS   = -454545;   // same as old itemChannel (HUD listens here)
integer CHANNEL_CONTAINER   = -454555;   // same as old containerChannel (pouch/other containers talk here)

float   MENU_TIMEOUT        = 30.0;
float   ADD_WINDOW_SECONDS  = 60.0;

integer ACCESS_OWNER_ONLY   = 0;
integer ACCESS_GROUP        = 1;
integer ACCESS_PUBLIC       = 2;

// -----------------------------
// STATE
// -----------------------------
key     gToucher;
integer gMenuListen;
integer gAddListen;
integer gRemoveListen;
integer gQuantityListen;

integer gAccessMode = ACCESS_OWNER_ONLY;

// Reserved LSD key for access mode persistence
string KEY_ACCESS_MODE = "_access_mode";

// pagination
list    gPageItems;
integer gPageIndex;
integer gPageListen;
integer gPageChannel;

// temp for remove flow
string  gRemoveItemName;
integer gRemoveItemQuantity;

// -----------------------------
// UTILS
// -----------------------------

integer RandomChannel()
{
    // simple negative random channel
    return -1 - (integer)llFrand(1000000.0);
}

integer CanAccess(key avatar)
{
    if (avatar == llGetOwner())
        return TRUE;

    if (gAccessMode == ACCESS_OWNER_ONLY)
        return FALSE;

    if (gAccessMode == ACCESS_GROUP)
    {
        if (llSameGroup(avatar))
            return TRUE;
        return FALSE;
    }

    // ACCESS_PUBLIC
    return TRUE;
}

list GetAllItemKeys()
{
    integer count = llLinksetDataCountKeys();
    list keys = [];
    integer offset = 0;
    while (offset < count)
    {
        list batch = llLinksetDataListKeys(offset, 10);
        keys += batch;
        offset += 10;
    }
    return keys;
}

integer GetItemQuantity(string name)
{
    string v = llLinksetDataRead(name);
    if (v == "") return 0;
    return (integer)v;
}

SetItemQuantity(string name, integer qty)
{
    if (qty <= 0)
    {
        llLinksetDataDelete(name);
    }
    else
    {
        llLinksetDataWrite(name, (string)qty);
    }
}

list GetSortedContents()
{
    list keys = GetAllItemKeys();
    keys = llListSort(keys, 1, TRUE);
    list result = [];
    integer i;
    integer len = llGetListLength(keys);
    for (i = 0; i < len; ++i)
    {
        string k = llList2String(keys, i);
        integer q = GetItemQuantity(k);
        if (q > 0)
            result += [k, q];
    }
    return result; // [name1, qty1, name2, qty2, ...]
}

// -----------------------------
// UI HELPERS
// -----------------------------

ShowMainMenu()
{
    if (!CanAccess(gToucher))
    {
        llRegionSayTo(gToucher, 0, "You do not have permission to use this container.");
        return;
    }

    if (gMenuListen)
        llListenRemove(gMenuListen);

    integer channel = RandomChannel();
    gMenuListen = llListen(channel, "", gToucher, "");

    list buttons = [
        "View Contents",
        "Add Items",
        "Remove Items",
        "Transfer All",
        "Access Settings",
        "Close"
    ];

    string title = "📦 " + llGetObjectName() + "\nChoose an action:";
    llDialog(gToucher, title, buttons, channel);
    llSetTimerEvent(MENU_TIMEOUT);
}

ShowContentsMenu()
{
    list contents = GetSortedContents();
    integer len = llGetListLength(contents);

    if (len == 0)
    {
        llRegionSayTo(gToucher, 0, "This container is empty.");
        ShowMainMenu();
        return;
    }

    // Paginated list
    if (gPageListen)
        llListenRemove(gPageListen);

    gPageChannel = RandomChannel();
    gPageListen = llListen(gPageChannel, "", gToucher, "");

    gPageItems = contents;
    gPageIndex = 0;

    // show first page
    integer i;
    list buttons = [];
    integer maxButtons = 9; // leave room for Prev/Next
    integer count = llGetListLength(gPageItems) / 2;

    for (i = gPageIndex; i < count && llGetListLength(buttons) < maxButtons; ++i)
    {
        string name = llList2String(gPageItems, i * 2);
        integer qty = llList2Integer(gPageItems, i * 2 + 1);
        buttons += [name + " (" + (string)qty + ")"];
    }

    // navigation
    if (gPageIndex > 0)
        buttons += ["< Prev"];
    if ((gPageIndex + maxButtons) < count)
        buttons += ["Next >"];

    string title = "📦 Contents of " + llGetObjectName();
    llDialog(gToucher, title, buttons, gPageChannel);
    llSetTimerEvent(MENU_TIMEOUT);
}

ShowAccessMenu()
{
    if (gMenuListen)
        llListenRemove(gMenuListen);

    integer channel = RandomChannel();
    gMenuListen = llListen(channel, "", gToucher, "");

    list buttons = [
        "Owner Only",
        "Group Access",
        "Public Access",
        "Back"
    ];

    string mode;
    if (gAccessMode == ACCESS_OWNER_ONLY) mode = "Owner Only";
    else if (gAccessMode == ACCESS_GROUP) mode = "Group Access";
    else mode = "Public Access";

    string title = "Access Settings\nCurrent: " + mode;
    llDialog(gToucher, title, buttons, channel);
    llSetTimerEvent(MENU_TIMEOUT);
}

BeginAddItems()
{
    if (!CanAccess(gToucher))
    {
        llRegionSayTo(gToucher, 0, "You do not have permission to use this container.");
        return;
    }

    if (gAddListen)
        llListenRemove(gAddListen);

    gAddListen = llListen(CHANNEL_CONTAINER, "", "", "");
    llSetTimerEvent(ADD_WINDOW_SECONDS);

    llRegionSayTo(gToucher, 0,
        "You may now transfer items into this container.\n" +
        "You have " + (string)((integer)ADD_WINDOW_SECONDS) + " seconds.\n" +
        "Use your pouch or another container to send items.");
}

BeginRemoveItems()
{
    if (!CanAccess(gToucher))
    {
        llRegionSayTo(gToucher, 0, "You do not have permission to use this container.");
        return;
    }

    list contents = GetSortedContents();
    integer len = llGetListLength(contents);
    if (len == 0)
    {
        llRegionSayTo(gToucher, 0, "This container is empty.");
        ShowMainMenu();
        return;
    }

    // show item selection menu
    if (gRemoveListen)
        llListenRemove(gRemoveListen);

    integer channel = RandomChannel();
    gRemoveListen = llListen(channel, "", gToucher, "");

    list buttons = [];
    integer i;
    integer maxButtons = 12;
    integer count = len / 2;

    for (i = 0; i < count && llGetListLength(buttons) < maxButtons; ++i)
    {
        string name = llList2String(contents, i * 2);
        integer qty = llList2Integer(contents, i * 2 + 1);
        buttons += [name + " (" + (string)qty + ")"];
    }

    string title = "Remove which item?";
    llDialog(gToucher, title, buttons, channel);
    llSetTimerEvent(MENU_TIMEOUT);
}

PromptRemoveQuantity(string itemName, integer maxQty)
{
    gRemoveItemName = itemName;
    gRemoveItemQuantity = maxQty;

    if (gQuantityListen)
        llListenRemove(gQuantityListen);

    integer channel = RandomChannel();
    gQuantityListen = llListen(channel, "", gToucher, "");

    list buttons = [];

    if (maxQty >= 1) buttons += ["1"];
    if (maxQty >= 5) buttons += ["5"];
    if (maxQty >= 10) buttons += ["10"];
    buttons += ["All (" + (string)maxQty + ")"];

    string title = "How many " + itemName + "?";
    llDialog(gToucher, title, buttons, channel);
    llSetTimerEvent(MENU_TIMEOUT);
}

TransferAllToHUD()
{
    if (!CanAccess(gToucher))
    {
        llRegionSayTo(gToucher, 0, "You do not have permission to use this container.");
        return;
    }

    list contents = GetSortedContents();
    integer len = llGetListLength(contents);
    if (len == 0)
    {
        llRegionSayTo(gToucher, 0, "This container is empty.");
        ShowMainMenu();
        return;
    }

    integer i;
    integer count = len / 2;
    for (i = 0; i < count; ++i)
    {
        string name = llList2String(contents, i * 2);
        integer qty = llList2Integer(contents, i * 2 + 1);
        if (qty > 0)
        {
            // send to HUD
            llRegionSayTo(gToucher, CHANNEL_HUD_ITEMS,
                "fGiveItem," + name + "," + (string)qty);
            SetItemQuantity(name, 0);
        }
    }

    llRegionSayTo(gToucher, 0, "All items have been transferred to your inventory.");
    ShowMainMenu();
}

// -----------------------------
// LIFECYCLE
// -----------------------------
default
{
    state_entry()
    {
        // Load persisted access mode from LSD
        string accessModeStr = llLinksetDataRead(KEY_ACCESS_MODE);
        if (accessModeStr != "")
        {
            integer mode = (integer)accessModeStr;
            if (mode >= ACCESS_OWNER_ONLY && mode <= ACCESS_PUBLIC)
            {
                gAccessMode = mode;
            }
        }
        
        llOwnerSay("Feud4 Container ready. Free memory: " + (string)llGetFreeMemory());
    }

    on_rez(integer start_param)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {
            // reset access to owner-only on owner change
            gAccessMode = ACCESS_OWNER_ONLY;
            llResetScript();
        }
    }

    touch_start(integer total_number)
    {
        key toucher = llDetectedKey(0);
        vector pos = llDetectedPos(0);
        
        // Validate distance
        if (llVecDist(pos, llGetPos()) > 5.0)
        {
            llRegionSayTo(toucher, 0, "You are too far away to use this container.");
            return;
        }
        
        // Validate permissions
        if (!CanAccess(toucher))
        {
            llRegionSayTo(toucher, 0, "You do not have permission to use this container.");
            return;
        }
        
        // Assign gToucher and switch to locked state
        gToucher = toucher;
        state locked;
    }

    timer()
    {
        // Timer should not fire in default state (no active listeners)
        llSetTimerEvent(0.0);
    }
}

// ===========================
// LOCKED STATE
// ===========================
state locked
{
    state_entry()
    {
        // Show main menu immediately when entering locked state
        ShowMainMenu();
    }
    
    touch_start(integer total_number)
    {
        key toucher = llDetectedKey(0);
        
        // Only allow gToucher to interact
        if (toucher != gToucher)
        {
            llRegionSayTo(toucher, 0, "This container is in use by another player.");
            return;
        }
        
        // gToucher can reopen menu
        ShowMainMenu();
    }
    
    listen(integer channel, string name, key id, string message)
    {
        // Only accept events from gToucher
        if (id != gToucher)
            return;
        
        // MAIN MENU
        if (channel == gMenuListen)
        {
            llListenRemove(gMenuListen);
            llSetTimerEvent(0.0);
            gMenuListen = 0;

            if (message == "View Contents")
            {
                ShowContentsMenu();
            }
            else if (message == "Add Items")
            {
                BeginAddItems();
            }
            else if (message == "Remove Items")
            {
                BeginRemoveItems();
            }
            else if (message == "Transfer All")
            {
                TransferAllToHUD();
            }
            else if (message == "Access Settings")
            {
                ShowAccessMenu();
            }
            else if (message == "Close")
            {
                // Return to default state - cleanup and transition
                llSetTimerEvent(0.0);
                
                if (gMenuListen)
                {
                    llListenRemove(gMenuListen);
                    gMenuListen = 0;
                }
                if (gAddListen)
                {
                    llListenRemove(gAddListen);
                    gAddListen = 0;
                }
                if (gRemoveListen)
                {
                    llListenRemove(gRemoveListen);
                    gRemoveListen = 0;
                }
                if (gQuantityListen)
                {
                    llListenRemove(gQuantityListen);
                    gQuantityListen = 0;
                }
                if (gPageListen)
                {
                    llListenRemove(gPageListen);
                    gPageListen = 0;
                }
                
                gToucher = NULL_KEY;
                state default;
            }
            else if (message == "Owner Only")
            {
                gAccessMode = ACCESS_OWNER_ONLY;
                llLinksetDataWrite(KEY_ACCESS_MODE, (string)gAccessMode);
                llRegionSayTo(gToucher, 0, "Access set to: Owner Only.");
                ShowAccessMenu();
            }
            else if (message == "Group Access")
            {
                gAccessMode = ACCESS_GROUP;
                llLinksetDataWrite(KEY_ACCESS_MODE, (string)gAccessMode);
                llRegionSayTo(gToucher, 0, "Access set to: Group Access.");
                ShowAccessMenu();
            }
            else if (message == "Public Access")
            {
                gAccessMode = ACCESS_PUBLIC;
                llLinksetDataWrite(KEY_ACCESS_MODE, (string)gAccessMode);
                llRegionSayTo(gToucher, 0, "Access set to: Public Access.");
                ShowAccessMenu();
            }
            else if (message == "Back")
            {
                ShowMainMenu();
            }
        }

        // CONTENTS pagination
        if (channel == gPageChannel)
        {
            llListenRemove(gPageListen);
            llSetTimerEvent(0.0);
            gPageListen = 0;
            gPageChannel = 0;

            integer len = llGetListLength(gPageItems) / 2;
            integer maxButtons = 9;

            if (message == "< Prev")
            {
                gPageIndex -= maxButtons;
                if (gPageIndex < 0) gPageIndex = 0;
            }
            else if (message == "Next >")
            {
                gPageIndex += maxButtons;
                // Clamp to valid range
                integer maxIndex = len - maxButtons;
                if (maxIndex < 0) maxIndex = 0;
                if (gPageIndex > maxIndex) gPageIndex = maxIndex;
                if (gPageIndex < 0) gPageIndex = 0;
            }

            // rebuild page
            gPageChannel = RandomChannel();
            gPageListen = llListen(gPageChannel, "", gToucher, "");

            list buttons = [];
            integer i;
            for (i = gPageIndex; i < len && llGetListLength(buttons) < maxButtons; ++i)
            {
                string name = llList2String(gPageItems, i * 2);
                integer qty = llList2Integer(gPageItems, i * 2 + 1);
                buttons += [name + " (" + (string)qty + ")"];
            }

            if (gPageIndex > 0)
                buttons += ["< Prev"];
            if ((gPageIndex + maxButtons) < len)
                buttons += ["Next >"];

            string title = "📦 Contents of " + llGetObjectName();
            llDialog(gToucher, title, buttons, gPageChannel);
            llSetTimerEvent(MENU_TIMEOUT);
        }

        // ADD ITEMS: listen for cGiveItem from pouch/other container
        // Only accept from gToucher (owner of the sending object)
        if (channel == CHANNEL_CONTAINER)
        {
            // Validate sender is gToucher
            if (llGetOwnerKey(id) != gToucher)
                return;

            // message: "cGiveItem,<item>,<qty>"
            list parts = llCSV2List(message);
            string action = llToLower(llList2String(parts, 0));
            if (action == "cgiveitem")
            {
                string itemName = llToLower(llList2String(parts, 1));
                integer qty = (integer)llList2String(parts, 2);
                if (qty <= 0) return;

                integer current = GetItemQuantity(itemName);
                integer newQty = current + qty;
                SetItemQuantity(itemName, newQty);

                llRegionSayTo(gToucher, 0,
                    "You added " + (string)qty + " of " + itemName +
                    " to " + llGetObjectName() + ".");
            }
        }

        // REMOVE ITEMS: item selection
        if (channel == gRemoveListen)
        {
            llListenRemove(gRemoveListen);
            llSetTimerEvent(0.0);
            gRemoveListen = 0;

            // message like "iron ore (12)"
            // Find LAST occurrence of " (" to handle item names with parentheses
            integer idx = llSubStringIndex(message, " (");
            integer lastIdx = idx;
            while (idx != -1)
            {
                lastIdx = idx;
                idx = llSubStringIndex(llGetSubString(message, idx + 2, -1), " (");
                if (idx != -1)
                    idx = lastIdx + 2 + idx;
            }
            if (lastIdx > 0)
            {
                string name = llGetSubString(message, 0, lastIdx - 1);
                integer qty = GetItemQuantity(name);
                if (qty > 0)
                {
                    PromptRemoveQuantity(name, qty);
                }
                else
                {
                    llRegionSayTo(gToucher, 0, "That item is no longer available.");
                    ShowMainMenu();
                }
            }
        }

        // REMOVE ITEMS: quantity selection
        if (channel == gQuantityListen)
        {
            llListenRemove(gQuantityListen);
            llSetTimerEvent(0.0);
            gQuantityListen = 0;

            integer maxQty = gRemoveItemQuantity;
            integer qty;

            if (llSubStringIndex(message, "All (") == 0)
            {
                qty = maxQty;
            }
            else
            {
                qty = (integer)message;
                if (qty <= 0 || qty > maxQty)
                {
                    llRegionSayTo(gToucher, 0, "Invalid amount.");
                    ShowMainMenu();
                    return;
                }
            }

            // send to HUD
            llRegionSayTo(gToucher, CHANNEL_HUD_ITEMS,
                "fGiveItem," + gRemoveItemName + "," + (string)qty);

            integer remaining = maxQty - qty;
            SetItemQuantity(gRemoveItemName, remaining);

            if (remaining <= 0)
            {
                llRegionSayTo(gToucher, 0,
                    "You took all of " + gRemoveItemName + ".");
            }
            else
            {
                llRegionSayTo(gToucher, 0,
                    "You took " + (string)qty + " of " + gRemoveItemName +
                    ". " + (string)remaining + " remain.");
            }

            ShowMainMenu();
        }
    }
    
    timer()
    {
        // Timeout - cleanup and return to default
        llSetTimerEvent(0.0);
        
        if (gMenuListen)
        {
            llListenRemove(gMenuListen);
            gMenuListen = 0;
        }
        if (gAddListen)
        {
            llListenRemove(gAddListen);
            gAddListen = 0;
        }
        if (gRemoveListen)
        {
            llListenRemove(gRemoveListen);
            gRemoveListen = 0;
        }
        if (gQuantityListen)
        {
            llListenRemove(gQuantityListen);
            gQuantityListen = 0;
        }
        if (gPageListen)
        {
            llListenRemove(gPageListen);
            gPageListen = 0;
        }
        
        gToucher = NULL_KEY;
        state default;
    }
}