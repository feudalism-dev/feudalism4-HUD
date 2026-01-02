/*
    Feud4 Paychest Script
    ---------------------
    Weekly stipend payout system using 3‑currency stipends:
        gold | silver | copper

    Flow:
      1. User touches chest
      2. Request active character
      3. Check universe ban
      4. Request stipend + lastPaidTimestamp
      5. Enforce 7‑day rule
      6. Pay gold/silver/copper via HUD
      7. Update lastPaidTimestamp
*/

integer MODULE_CHANNEL = -9000;
integer HUD_CHANNEL    = -8000;

integer STATE_IDLE     = 0;
integer STATE_WAIT_CHAR = 1;
integer STATE_WAIT_BAN  = 2;
integer STATE_WAIT_STIP = 3;
integer STATE_WAIT_UPDATE = 4;

integer currentState = STATE_IDLE;

key toucher;
string activeCharacter;
integer gold;
integer silver;
integer copper;
integer lastPaid;
integer now;

string universeId = "default"; // set per‑universe

default
{
    state_entry()
    {
        llOwnerSay("Paychest ready.");
    }

    touch_start(integer n)
    {
        if (currentState != STATE_IDLE)
        {
            llRegionSayTo(llDetectedKey(0), 0, "Please wait...");
            return;
        }

        toucher = llDetectedKey(0);
        currentState = STATE_WAIT_CHAR;

        string tx = (string)llGenerateKey();
        llMessageLinked(LINK_THIS, MODULE_CHANNEL,
            "GET_ACTIVE_CHARACTER|" + tx + "|" + (string)toucher,
            NULL_KEY);
    }

    link_message(integer sender, integer channel, string msg, key id)
    {
        if (channel != MODULE_CHANNEL) return;

        list parts = llParseStringKeepNulls(msg, ["|"], []);
        string cmd = llList2String(parts, 0);
        string tx  = llList2String(parts, 1);

        // -------------------------------
        // 1. ACTIVE CHARACTER RECEIVED
        // -------------------------------
        if (cmd == "ACTIVE_CHARACTER" && currentState == STATE_WAIT_CHAR)
        {
            activeCharacter = llList2String(parts, 2);

            if (activeCharacter == "" || activeCharacter == "NULL")
            {
                llRegionSayTo(toucher, 0, "No active character selected.");
                currentState = STATE_IDLE;
                return;
            }

            // Check ban status
            currentState = STATE_WAIT_BAN;
            string tx2 = (string)llGenerateKey();
            llMessageLinked(LINK_THIS, MODULE_CHANNEL,
                "IS_BANNED|" + tx2 + "|" + universeId + "|" + activeCharacter,
                NULL_KEY);
            return;
        }

        // -------------------------------
        // 2. BAN CHECK
        // -------------------------------
        if (cmd == "BANNED_STATUS" && currentState == STATE_WAIT_BAN)
        {
            string banned = llList2String(parts, 2);

            if (banned == "YES")
            {
                llRegionSayTo(toucher, 0, "You are banned from stipends in this universe.");
                currentState = STATE_IDLE;
                return;
            }

            // Request stipend + lastPaidTimestamp
            currentState = STATE_WAIT_STIP;
            string tx3 = (string)llGenerateKey();
            llMessageLinked(LINK_THIS, MODULE_CHANNEL,
                "GET_STIPEND_DATA|" + tx3 + "|" + activeCharacter,
                NULL_KEY);
            return;
        }

        // -------------------------------
        // 3. STIPEND DATA RECEIVED
        // -------------------------------
        if (cmd == "STIPEND_DATA" && currentState == STATE_WAIT_STIP)
        {
            gold       = (integer)llList2String(parts, 2);
            silver     = (integer)llList2String(parts, 3);
            copper     = (integer)llList2String(parts, 4);
            lastPaid   = (integer)llList2String(parts, 5);

            now = llGetUnixTime();

            // Enforce 7‑day rule
            if (now - lastPaid < 604800)
            {
                integer hours = (604800 - (now - lastPaid)) / 3600;
                llRegionSayTo(toucher, 0,
                    "You have already been paid. Try again in " + (string)hours + " hours.");
                currentState = STATE_IDLE;
                return;
            }

            // Pay the user via HUD
            llRegionSayTo(toucher, 0,
                "Paying stipend: " +
                (string)gold + " gold, " +
                (string)silver + " silver, " +
                (string)copper + " copper.");

            string tx4 = (string)llGenerateKey();
            llRegionSayTo(toucher, HUD_CHANNEL,
                "ADD_CURRENCY|" + tx4 + "|" +
                (string)gold + "|" + (string)silver + "|" + (string)copper);

            // Update lastPaidTimestamp
            currentState = STATE_WAIT_UPDATE;
            string tx5 = (string)llGenerateKey();
            llMessageLinked(LINK_THIS, MODULE_CHANNEL,
                "UPDATE_LAST_PAID|" + tx5 + "|" + activeCharacter + "|" + (string)now,
                NULL_KEY);
            return;
        }

        // -------------------------------
        // 4. LAST PAID UPDATED
        // -------------------------------
        if (cmd == "LAST_PAID_UPDATED" && currentState == STATE_WAIT_UPDATE)
        {
            llRegionSayTo(toucher, 0, "Stipend paid successfully.");
            currentState = STATE_IDLE;
            return;
        }
    }
}