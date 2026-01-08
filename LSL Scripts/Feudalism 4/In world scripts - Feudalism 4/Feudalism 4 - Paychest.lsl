/*
    Feudalism 4 – Paychest Script (Full Menu Version)
    -------------------------------------------------
    World object with ONE script.
    Talks ONLY to the HUD using llRegionSayTo.

    HUD handles:
      - activeCharacter
      - class lookup
      - stipend lookup
      - cooldown
      - currency deltas
      - lastPaidTimestamp update

    Paychest only:
      - shows menus
      - sends commands to HUD
      - displays results
*/

integer HUD_CHANNEL = -77770;     // HUD listens here
integer DIALOG_CHANNEL = -777701; // Paychest dialog menu channel
integer TEXT_CHANNEL = -777702;   // Paychest text input channel

key toucher;
key paychestUUID;

integer menuListener = 0;
integer textListener = 0;

string pendingAction = "";
string pendingClassId = "";
string pendingUserId = "";

// Sensor-based avatar selection
list detectedAvatars;  // [name, key, name, key, ...]
key targetAvatar = NULL_KEY;
string pendingTx = "";

// Debug
integer DEBUG = TRUE;

debug(string msg) {
    if (DEBUG) {
        llOwnerSay("[Paychest] " + msg);
    }
}

// Time formatting helper
string formatTime(integer seconds) {
    if (seconds <= 0) return "just now";

    integer mins = seconds / 60;
    integer hrs  = mins / 60;
    integer days = hrs / 24;

    mins = mins % 60;
    hrs  = hrs % 24;

    string out = "";

    if (days > 0) {
        string dayStr = " day";
        if (days != 1) {
            dayStr = dayStr + "s";
        }
        out = out + (string)days + dayStr;
    }
    
    if (hrs > 0) {
        string prefix = "";
        if (out != "") {
            prefix = ", ";
        }
        string hourStr = " hour";
        if (hrs != 1) {
            hourStr = hourStr + "s";
        }
        out = out + prefix + (string)hrs + hourStr;
    }
    
    if (mins > 0) {
        string prefix = "";
        if (out != "") {
            prefix = ", ";
        }
        string minStr = " minute";
        if (mins != 1) {
            minStr = minStr + "s";
        }
        out = out + prefix + (string)mins + minStr;
    }

    if (out == "") {
        out = (string)seconds + " seconds";
    }

    return out;
}

// Utility
cleanup() {
    debug("cleanup() called");
    if (menuListener != 0) {
        llListenRemove(menuListener);
        menuListener = 0;
    }
    if (textListener != 0) {
        llListenRemove(textListener);
        textListener = 0;
    }
    llSetTimerEvent(0.0);
    pendingAction = "";
}

// ---------------- MENU BUILDERS ----------------

showPlayerMenu() {
    debug("showPlayerMenu() called for toucher: " + (string)toucher);
    cleanup();
    menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");

    list buttons = ["Check My Pay", "Last Paid", "Get Pay", "Close"];

    // Admin button only for owner
    if (toucher == llGetOwner()) {
        buttons = ["ADMIN"] + buttons;
        debug("Admin button added (owner)");
    }

    llDialog(toucher,
        "\n[ Paychest ]\n\nSelect an option:",
        buttons,
        DIALOG_CHANNEL
    );
    llSetTimerEvent(60.0);
    debug("Player menu displayed");
}

showAdminMenu() {
    debug("showAdminMenu() called");
    cleanup();
    menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");

    list buttons = [
        "Class Stipend Lookup",
        "Admin Payout",
        "Give Pay to Player",
        "Back",
        "Close"
    ];

    llDialog(toucher,
        "\n[ Paychest Admin ]\n\nSelect an option:",
        buttons,
        DIALOG_CHANNEL
    );
    llSetTimerEvent(60.0);
    debug("Admin menu displayed");
}

// ---------------- HUD REQUESTS ----------------

sendHUD(string msg) {
    debug("sendHUD() -> toucher: " + (string)toucher + ", channel: " + (string)HUD_CHANNEL + ", message: " + msg);
    debug("Paychest → HUD: channel=" + (string)HUD_CHANNEL + ", toucher=" + (string)toucher + ", msg='" + msg + "'");
    llRegionSayTo(toucher, HUD_CHANNEL, msg);
}

requestActiveCharacter() {
    debug("requestActiveCharacter() called");
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_GET_ACTIVE_CHARACTER," + (string)paychestUUID + "," + tx);
}

requestStipendData() {
    debug("requestStipendData() called");
    string tx = (string)llGenerateKey();
    debug("requestStipendData(): chestId=" + (string)paychestUUID + ", tx=" + tx);
    sendHUD("PAYCHEST_GET_STIPEND_DATA," + (string)paychestUUID + "," + tx);
}

requestLastPaid() {
    debug("requestLastPaid() called");
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_GET_LAST_PAID," + (string)paychestUUID + "," + tx);
}

requestPayout(integer ignoreCooldown) {
    debug("requestPayout() called, ignoreCooldown: " + (string)ignoreCooldown);
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_PAYOUT," + (string)paychestUUID + "," + tx + "," + (string)ignoreCooldown);
}


requestClassList() {
    debug("requestClassList() called");
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_CLASS_LIST," + (string)paychestUUID + "," + tx);
}

requestClassStipend(string classId) {
    debug("requestClassStipend() called, classId: " + classId);
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_CLASS_STIPEND," + (string)paychestUUID + "," + tx + "," + classId);
}

requestUserActiveCharacter(string userId) {
    debug("requestUserActiveCharacter() called, userId: " + userId);
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_GET_USER_ACTIVE_CHARACTER," + (string)paychestUUID + "," + tx + "," + userId);
}

requestGivePay(string characterId) {
    debug("requestGivePay() called, characterId: " + characterId);
    string tx = (string)llGenerateKey();
    sendHUD("PAYCHEST_GIVE_PAY," + (string)paychestUUID + "," + tx + "," + characterId);
}

// ---------------- HUD RESPONSE HANDLER ----------------

handleHUDResponse(string message) {
    debug("handleHUDResponse() received: " + message);
    list parts = llCSV2List(message);
    string cmd = llList2String(parts, 0);

    debug("Parsed - cmd: " + cmd);

    // Generic result
    if (cmd == "PAYCHEST_RESULT") {
        string subcmd = llList2String(parts, 1);
        debug("PAYCHEST_RESULT received, subcmd: " + subcmd);

        // Handle CLASS_STIPEND result (format: PAYCHEST_RESULT,CLASS_STIPEND,<chestId>,<tx>,<result>)
        if (subcmd == "CLASS_STIPEND") {
            string chestIdCheck = llList2String(parts, 2);
            string txCheck = llList2String(parts, 3);
            string result = llList2String(parts, 4);

            debug("CLASS_STIPEND result - chestId: " + chestIdCheck + ", tx: " + txCheck + ", result: " + result);

            if (chestIdCheck != (string)paychestUUID) {
                debug("Chest ID mismatch in CLASS_STIPEND, ignoring");
                return;
            }

            if (result == "NOT_FOUND") {
                cleanup();
                pendingAction = "RETURN_TO_MENU";
                menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
                llDialog(toucher, "Class not found.", ["Back"], DIALOG_CHANNEL);
                llSetTimerEvent(60.0);
                return;
            }

            // result is "gold|silver|copper"
            list stipendParts = llParseString2List(result, ["|"], []);
            string gold   = llList2String(stipendParts, 0);
            string silver = llList2String(stipendParts, 1);
            string copper = llList2String(stipendParts, 2);

            string msg = "\n[ Class Stipend ]\n\n" +
                         "Class: " + pendingClassId + "\n" +
                         "Stipend:\n" +
                         "• " + gold   + " gold\n" +
                         "• " + silver + " silver\n" +
                         "• " + copper + " copper";

            cleanup();
            pendingAction = "RETURN_TO_MENU";
            menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
            llDialog(toucher, msg, ["Back"], DIALOG_CHANNEL);
            llSetTimerEvent(60.0);
            return;

        }
        else {
            // Standard format: PAYCHEST_RESULT,<chestId>,<tx>,<status>,<message>
            string chestIdCheck = llList2String(parts, 1);
            string txCheck = llList2String(parts, 2);
            string statusCheck = llList2String(parts, 3);
        
        // Reassemble full message (handles commas inside stipend text)
        string msg = llDumpList2String(llList2List(parts, 4, -1), ", ");

        // Check if this is a payout message
        integer isPayout = (llSubStringIndex(msg, "Payout:") == 0);
        
        string finalMsg;
        if (isPayout && statusCheck == "OK") {
            // Parse payout message with timestamp info
            // Format: "Payout: X gold, Y silver, Z copper|lastPaidSeconds|nextAvailableSeconds"
            // Note: After CSV parsing and reassembly, commas may have been affected
            // But pipes should still be intact in the last part
            list msgParts = llParseString2List(msg, ["|"], []);
            string payoutAmount = "";
            integer lastPaidSeconds = -1;
            integer nextAvailableSeconds = -1;
            
            if (llGetListLength(msgParts) >= 3) {
                // Extract payout amount (remove "Payout: " prefix)
                string payoutLine = llList2String(msgParts, 0);
                payoutAmount = llGetSubString(payoutLine, 7, -1);  // Remove "Payout:" prefix
                lastPaidSeconds = (integer)llList2String(msgParts, 1);
                nextAvailableSeconds = (integer)llList2String(msgParts, 2);
            } else {
                // Fallback: old format without timestamps
                payoutAmount = llGetSubString(msg, 7, -1);  // Remove "Payout:" prefix
            }
            
            // Build final message with time formatting
            if (lastPaidSeconds >= 0 && nextAvailableSeconds >= 0) {
                integer now = llGetUnixTime();
                integer secondsSince = now - lastPaidSeconds;
                integer secondsUntil = nextAvailableSeconds - now;
                
                string lastPaidHuman = formatTime(secondsSince);
                string nextAvailHuman = formatTime(secondsUntil);
                
                finalMsg = "You have been paid!\n\n" +
                          "Amount: " + payoutAmount + "\n" +
                          "Last paid: " + lastPaidHuman + " ago\n" +
                          "Next available payout: in " + nextAvailHuman;
            } else {
                // Fallback if timestamp parsing fails
                finalMsg = "You have been paid!\n\n" +
                          "Amount: " + payoutAmount;
            }
        } else {
            // Build dialog message for non-payout results
            if (statusCheck == "OK") {
                finalMsg = "\n[ Paychest ]\n\n" + msg;
            } else {
                finalMsg = "\n[ Paychest ]\n\nError:\n" + msg;
            }
        }

        // Send to both local chat and dialog
        llRegionSayTo(toucher, 0, finalMsg);
        
        // Show result in a dialog
        list buttons = ["Back", "Close"];

        // Always cleanup BEFORE showing a result dialog
        cleanup();

        pendingAction = "RETURN_TO_MENU";
        menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");

        llDialog(
            toucher,
            finalMsg,
            buttons,
            DIALOG_CHANNEL
        );
        llSetTimerEvent(60.0);
        return;
        }
    }

    // Class list
    if (cmd == "PAYCHEST_CLASS_LIST_RESULT") {
        string listJson = llList2String(parts, 3);
        debug("PAYCHEST_CLASS_LIST_RESULT received, listJson: " + listJson);
        // HUD will format this as a dialog-friendly list
        list buttons = llParseString2List(listJson, ["|"], []);
        buttons += ["Back"];

        debug("Class list buttons: " + llDumpList2String(buttons, ", "));
        cleanup();
        pendingAction = "CLASS_SELECT";
        debug("Set pendingAction = CLASS_SELECT");
        menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
        llDialog(toucher, "\n[ Class List ]\n\nSelect a class:", buttons, DIALOG_CHANNEL);
        debug("Class list dialog displayed");
        return;
    }

    // Class stipend
    if (cmd == "PAYCHEST_CLASS_STIPEND_RESULT") {
        string msg = llList2String(parts, 3);
        debug("PAYCHEST_CLASS_STIPEND_RESULT received: " + msg);
        llRegionSayTo(toucher, 0, msg);
        showAdminMenu();
        return;
    }

    // Give Pay flow
    if (cmd == "PAYCHEST_USER_ACTIVE_CHARACTER_RESULT") {
        string chestIdCheck = llList2String(parts, 1);
        string tx = llList2String(parts, 2);
        string characterId = llList2String(parts, 3);
        debug("PAYCHEST_USER_ACTIVE_CHARACTER_RESULT received, characterId: " + characterId);

        if (characterId == "" || characterId == "NULL") {
            debug("No active character found");
            cleanup();
            pendingAction = "RETURN_TO_MENU";
            menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
            llDialog(toucher, "User has no active character.", ["Back"], DIALOG_CHANNEL);
            llSetTimerEvent(60.0);
            return;
        }

        // At this point we have a valid characterId.
        // Request a forced stipend payout for this character.
        string newTx = (string)llGenerateKey();
        sendHUD("PAYCHEST_FORCE_STIPEND_PAYOUT," + (string)paychestUUID + "," + newTx + "," + characterId);
        return;
    }
    
    // Handle response from target avatar's HUD
    if (cmd == "PAYCHEST_ACTIVE_CHARACTER_RESPONSE") {
        string chestIdCheck = llList2String(parts, 1);
        string tx = llList2String(parts, 2);
        string characterId = llList2String(parts, 3);
        
        debug("PAYCHEST_ACTIVE_CHARACTER_RESPONSE received, tx: " + tx + ", characterId: " + characterId);
        
        // Check if this is the response we're waiting for
        if (tx != pendingTx || pendingAction != "AWAIT_CHARACTER_RESPONSE") {
            debug("Response tx mismatch or not waiting for response, ignoring");
            return;
        }
        
        // Clear timeout
        llSetTimerEvent(0.0);
        pendingAction = "";
        pendingTx = "";
        
        if (characterId == "" || characterId == "NULL") {
            debug("No active character found");
            cleanup();
            pendingAction = "RETURN_TO_MENU";
            menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
            llDialog(toucher, "The selected user has no active character.", ["Back"], DIALOG_CHANNEL);
            llSetTimerEvent(60.0);
            targetAvatar = NULL_KEY;
            return;
        }
        
        // Forward to admin's HUD to trigger payout
        string newTx = (string)llGenerateKey();
        sendHUD("PAYCHEST_FORCE_STIPEND_PAYOUT," + (string)paychestUUID + "," + newTx + "," + characterId);
        targetAvatar = NULL_KEY;
        return;
    }

    debug("Unhandled HUD response command: " + cmd);
}

// ---------------- MENU HANDLING ----------------

handleMenu(string msg) {
    debug("handleMenu() called with message: '" + msg + "', pendingAction: '" + pendingAction + "'");

    // Handle return from stipend/payout dialog
    if (pendingAction == "RETURN_TO_MENU") {
        if (msg == "Back") {
            pendingAction = "";
            showPlayerMenu();
            return;
        }
        if (msg == "Close") {
            pendingAction = "";
            cleanup();
            return;
        }
    }

    if (pendingAction != "" && msg != "Back") {
        // allow CLASS_SELECT and AWAIT_CLASS_ID to proceed normally
        // but clear any leftover actions
        if (pendingAction != "CLASS_SELECT" && pendingAction != "AWAIT_CLASS_ID") {
            debug("Clearing stale pendingAction: " + pendingAction);
            pendingAction = "";
        }
    }

    if (msg == "Close") {
        debug("Menu option: Close");
        cleanup();
        return;
    }

    if (msg == "ADMIN" && toucher == llGetOwner()) {
        debug("Menu option: ADMIN");
        showAdminMenu();
        return;
    }

    // Player menu
    if (msg == "Check My Pay") {
        debug("Menu option: Check My Pay");
        requestStipendData();
        return;
    }

    if (msg == "Last Paid") {
        debug("Menu option: Last Paid");
        requestLastPaid();
        return;
    }

    if (msg == "Get Pay") {
        debug("Menu option: Get Pay");
        requestPayout(FALSE);
        return;
    }

    // Admin menu
    if (msg == "Back") {
        debug("Menu option: Back");
        showPlayerMenu();
        return;
    }

    if (msg == "Class Stipend Lookup") {
        debug("Menu option: Class Stipend Lookup");
        pendingAction = "AWAIT_CLASS_ID";
        llTextBox(toucher, "Enter class ID:", DIALOG_CHANNEL);
        return;
    }

    if (msg == "Admin Payout") {
        debug("Menu option: Admin Payout");
        requestPayout(TRUE);
        return;
    }

    if (msg == "Give Pay to Player") {
        debug("Menu option: Give Pay to Player");
        cleanup();
        pendingAction = "AWAIT_AVATAR_SELECTION";
        detectedAvatars = [];
        targetAvatar = NULL_KEY;
        llSensor("", NULL_KEY, AGENT, 10.0, PI);
        debug("Sensor scan initiated for avatar selection");
        return;
    }

    // Class ID input (handled in listen() event before routing here, but kept for safety)
    if (pendingAction == "AWAIT_CLASS_ID") {
        pendingAction = "";
        string classId = llToLower(llStringTrim(msg, STRING_TRIM));

        if (classId == "") {
            cleanup();
            pendingAction = "RETURN_TO_MENU";
            menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
            llDialog(toucher, "Not Found", ["Back"], DIALOG_CHANNEL);
            llSetTimerEvent(60.0);
            return;
        }

        string tx = (string)llGenerateKey();
        sendHUD("PAYCHEST_CLASS_STIPEND," + (string)paychestUUID + "," + tx + "," + classId);
        return;
    }

    // Class selection (legacy - may be removed later)
    if (pendingAction == "CLASS_SELECT") {
        debug("Class selection detected, class name: " + msg);
        requestClassStipend(msg);
        pendingAction = "";
        debug("Cleared pendingAction after class selection");
        return;
    }

    debug("Unhandled menu message: " + msg);
}

handleText(string msg) {
    debug("handleText() called with message: '" + msg + "', pendingAction: '" + pendingAction + "'");
    debug("Unhandled text input, pendingAction: " + pendingAction);
}

// ---------------- DEFAULT STATE ----------------

default
{
    state_entry() {
        paychestUUID = llGetKey();
        llListen(HUD_CHANNEL, "", NULL_KEY, "");
        debug("Paychest initialized, UUID: " + (string)paychestUUID + ", listening on HUD_CHANNEL: " + (string)HUD_CHANNEL);
        debug("Paychest INIT: HUD_CHANNEL=" + (string)HUD_CHANNEL);
        llOwnerSay("Paychest ready.");
    }

    touch_start(integer n) {
        toucher = llDetectedKey(0);
        debug("Touch detected, toucher: " + (string)toucher);
        showPlayerMenu();
    }

    listen(integer channel, string name, key id, string msg) {
        debug("listen() - channel: " + (string)channel + ", name: " + name + ", id: " + (string)id + ", msg: " + msg);

        if (channel == HUD_CHANNEL) {
            debug("Message on HUD_CHANNEL, routing to handleHUDResponse()");
            handleHUDResponse(msg);
            return;
        }

        if (id != toucher) {
            debug("Message from wrong toucher, ignoring. Expected: " + (string)toucher + ", got: " + (string)id);
            return;
        }

        if (channel == DIALOG_CHANNEL) {
            // --- TEXT BOX HANDLING MUST COME FIRST ---
            if (pendingAction == "AWAIT_CLASS_ID") {
                pendingAction = "";
                string classId = llToLower(llStringTrim(msg, STRING_TRIM));
                pendingClassId = classId;

                if (classId == "") {
                    cleanup();
                    pendingAction = "RETURN_TO_MENU";
                    menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
                    llDialog(toucher, "Not Found", ["Back"], DIALOG_CHANNEL);
                    llSetTimerEvent(60.0);
                    return;
                }

                string tx = (string)llGenerateKey();
                sendHUD("PAYCHEST_CLASS_STIPEND," + (string)paychestUUID + "," + tx + "," + classId);
                return;
            }
            
            // Handle avatar selection for Give Pay
            if (pendingAction == "AWAIT_AVATAR_SELECTION") {
                if (msg == "Back") {
                    pendingAction = "";
                    showAdminMenu();
                    return;
                }
                
                // Find selected avatar's key
                integer i = 0;
                integer found = FALSE;
                key selectedKey = NULL_KEY;
                while (i < llGetListLength(detectedAvatars) && !found) {
                    string name = llList2String(detectedAvatars, i);
                    if (name == msg) {
                        selectedKey = (key)llList2String(detectedAvatars, i + 1);
                        found = TRUE;
                    }
                    i = i + 2;
                }
                
                if (selectedKey == NULL_KEY) {
                    debug("Selected avatar not found in detected list");
                    cleanup();
                    return;
                }
                
                targetAvatar = selectedKey;
                pendingTx = (string)llGenerateKey();
                pendingAction = "AWAIT_CHARACTER_RESPONSE";
                
                debug("Sending PAYCHEST_REQUEST_ACTIVE_CHARACTER to avatar: " + (string)targetAvatar);
                
                // Send request to target avatar's HUD
                string request = "PAYCHEST_REQUEST_ACTIVE_CHARACTER," + (string)paychestUUID + "," + pendingTx;
                llRegionSayTo(targetAvatar, HUD_CHANNEL, request);
                
                // Start 60-second timeout (HUD_CHANNEL listener already exists in state_entry)
                llSetTimerEvent(60.0);
                
                return;
            }
            
            debug("Message on DIALOG_CHANNEL, routing to handleMenu()");
            handleMenu(msg);
            return;
        }

        if (channel == TEXT_CHANNEL) {
            debug("Message on TEXT_CHANNEL, routing to handleText()");
            handleText(msg);
            return;
        }

        debug("Unhandled channel: " + (string)channel);
    }

    sensor(integer num_detected) {
        if (pendingAction != "AWAIT_AVATAR_SELECTION") {
            return;
        }
        
        debug("Sensor detected " + (string)num_detected + " avatars");
        
        detectedAvatars = [];
        list buttonNames = [];
        
        integer i = 0;
        while (i < num_detected) {
            string name = llDetectedName(i);
            key avatarKey = llDetectedKey(i);
            
            // Skip the admin (toucher) from the list
            if (avatarKey != toucher) {
                detectedAvatars += [name, (string)avatarKey];
                buttonNames += [name];
            }
            i = i + 1;
        }
        
        if (llGetListLength(buttonNames) == 0) {
            debug("No other avatars detected nearby");
            cleanup();
            pendingAction = "RETURN_TO_MENU";
            menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
            llDialog(toucher, "No other players detected within 10 meters.", ["Back"], DIALOG_CHANNEL);
            llSetTimerEvent(60.0);
            return;
        }
        
        buttonNames += ["Back"];
        
        cleanup();
        pendingAction = "AWAIT_AVATAR_SELECTION";
        menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
        llDialog(toucher, "Select a player to pay:", buttonNames, DIALOG_CHANNEL);
        llSetTimerEvent(60.0);
        debug("Avatar selection dialog displayed");
    }
    
    no_sensor() {
        if (pendingAction != "AWAIT_AVATAR_SELECTION") {
            return;
        }
        
        debug("No avatars detected nearby");
        cleanup();
        pendingAction = "RETURN_TO_MENU";
        menuListener = llListen(DIALOG_CHANNEL, "", toucher, "");
        llDialog(toucher, "No players detected within 10 meters.", ["Back"], DIALOG_CHANNEL);
        llSetTimerEvent(60.0);
    }

    timer() {
        debug("Timer expired");
        
        // Check if we're waiting for a character response
        if (pendingAction == "AWAIT_CHARACTER_RESPONSE") {
            debug("Timeout waiting for HUD response from target avatar");
            llRegionSayTo(toucher, 0, "Sorry, we received no reply from the selected user.");
            cleanup();
            pendingAction = "";
            pendingTx = "";
            targetAvatar = NULL_KEY;
            return;
        }
        
        cleanup();
    }
}
