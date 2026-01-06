integer pouchChannel = -454545;   // Legacy Feud3 pouch communication channel

default
{
    state_entry()
    {
        // Listen for detectPouch messages from ovens, crafting stations, etc.
        llListen(pouchChannel, "", NULL_KEY, "");
    }

    listen(integer channel, string name, key id, string message)
    {
        list p = llCSV2List(llToLower(message));
        string action = llList2String(p, 0);

        // detectPouch,<object_key>
        if (action == "detectpouch")
        {
            key objectKey = llList2Key(p, 1);

            // Respond exactly like the old pouch did
            llRegionSayTo(
                objectKey,
                pouchChannel,
                "pouchWorn," + (string)llGetOwner() + ","
            );
        }
    }
}
