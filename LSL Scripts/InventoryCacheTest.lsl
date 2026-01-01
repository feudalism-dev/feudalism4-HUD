// ============================================================================
// InventoryCacheTest.lsl
// ============================================================================
// Test script for InventoryCache
// ============================================================================

integer MENU_CHANNEL = -999999;
integer listenerHandle = 0;
key owner;

default {
    state_entry() {
        owner = llGetOwner();
        llListen(MENU_CHANNEL, "", owner, "");
    }
    
    touch_start(integer num) {
        showMenu();
    }
    
    showMenu() {
        if (listenerHandle != 0) {
            llListenRemove(listenerHandle);
        }
        listenerHandle = llListen(MENU_CHANNEL, "", owner, "");
        
        list buttons = ["Add Delta", "Get Deltas", "Clear", "Stress Test", "Close"];
        llDialog(owner, "\nInventory Cache Test Menu:", buttons, MENU_CHANNEL);
        llSetTimerEvent(30.0);
    }
    
    listen(integer channel, string name, key id, string message) {
        if (channel == MENU_CHANNEL && id == owner) {
            if (message == "Add Delta") {
                // Add a test delta
                string json = "{\"item\":\"banana\",\"delta\":5}";
                llMessageLinked(LINK_SET, 0, "CACHE_ADD_DELTA", json);
                llOwnerSay("Sent CACHE_ADD_DELTA: " + json);
                showMenu();
            }
            else if (message == "Get Deltas") {
                // Request deltas
                llMessageLinked(LINK_SET, 0, "CACHE_GET_DELTAS", "");
                llOwnerSay("Sent CACHE_GET_DELTAS");
                showMenu();
            }
            else if (message == "Clear") {
                // Clear cache
                llMessageLinked(LINK_SET, 0, "CACHE_CLEAR", "");
                llOwnerSay("Sent CACHE_CLEAR");
                showMenu();
            }
            else if (message == "Stress Test") {
                // Send 50 rapid deltas
                llOwnerSay("Starting stress test: 50 rapid deltas...");
                integer i;
                for (i = 0; i < 50; i++) {
                    string item = "item" + (string)(i % 5);  // 5 different items
                    integer deltaValue = (i % 3) + 1;  // Deltas 1-3
                    string json = "{\"item\":\"" + item + "\",\"delta\":" + (string)deltaValue + "}";
                    llMessageLinked(LINK_SET, 0, "CACHE_ADD_DELTA", json);
                }
                llOwnerSay("Stress test complete: sent 50 deltas");
                showMenu();
            }
            else if (message == "Close") {
                if (listenerHandle != 0) {
                    llListenRemove(listenerHandle);
                    listenerHandle = 0;
                }
                llSetTimerEvent(0.0);
            }
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id) {
        if (msg == "CACHE_DELTAS") {
            // Received deltas response
            string json = (string)id;
            llOwnerSay("Received CACHE_DELTAS: " + json);
        }
    }
    
    timer() {
        if (listenerHandle != 0) {
            llListenRemove(listenerHandle);
            listenerHandle = 0;
        }
        llSetTimerEvent(0.0);
    }
}

