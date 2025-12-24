integer DEBUG = FALSE;
integer PLAYERHUDCHANNEL = -77770;
integer waterChannel = -595225;
integer pouchChannel = -454545;
integer hudListenHandle;
list rpSlots = [];
list rpSlotLinks = [];
integer nextAvailableSlot;
list objectsWorn = [];

debug(string message)
{
    if (DEBUG)
        llOwnerSay("ActionSlotManager. " + message);
}

setLinkTextureFast(integer link, string texture, integer face)
{
    // Obtain the current texture parameters and replace the texture only.
    // If we are going to apply the texture to ALL_SIDES, we need
    // to adjust the returned parameters in a loop, so that each face
    // keeps its current repeats, offsets and rotation.
    list Params = llGetLinkPrimitiveParams(link, [PRIM_TEXTURE, face]);
    integer idx;
    face *= face > 0; // Make it zero if it was ALL_SIDES
    // This part is tricky. The list returned by llGLPP has a 4 element stride
    // (texture, repeats, offsets, angle). But as we modify it, we add two
    // elements to each, so the completed part of the list has 6 elements per
    // stride.
    integer NumSides = llGetListLength(Params) / 4; // At this point, 4 elements per stride
    for (idx = 0; idx < NumSides; ++idx)
    {
        // The part we've completed has 6 elements per stride, thus the *6.
        Params = llListReplaceList(Params, [PRIM_TEXTURE, face++, texture], idx*6, idx*6);
    }
//debug("SetLinktextureFast, params: " + (string)Params);    
    llSetLinkPrimitiveParamsFast(link, Params);
}

integer getLinkNumberByName (string linkName)
{
    integer i = 0;                      
    while (i <= llGetNumberOfPrims()) 
    {      
       if (llGetLinkName(i) == linkName)
            return i;
    i++;
    } 
    return -1;  
}

default
{
    state_entry()
    {
        llListenRemove(hudListenHandle);
        rpSlotLinks = [];
        rpSlots = [];
        hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");
        integer i;
        for (i = 2; i < 11; i++)
        {
            integer link = getLinkNumberByName("rp_slot" +(string)i);   
            rpSlotLinks += link;   
            setLinkTextureFast(link, "active_none", 4);
        }
        nextAvailableSlot = llGetListLength(rpSlots) + 2;
        objectsWorn = [];
    }

    listen( integer channel, string name, key id, string message ) 
    {
        debug("Listen. message: " + message);
        if (channel == PLAYERHUDCHANNEL) 
        {
            llListenRemove(hudListenHandle);
            list parsedMessage = llCSV2List(message);
            string action = llList2String(parsedMessage, 0); 
            string actionType = llList2String(parsedMessage,1); 
            string objectName = llList2String(parsedMessage,2);
            debug("ActionType: " + actionType);   
            //debug("rpSlots: " + llList2CSV(rpSlots));
            //nextAvailableSlot = llGetListLength(rpSlots) + 2;            
            //debug("NextAvailableSlot: " + (string)nextAvailableSlot); 
            debug("ObjectName: " + objectName);
            debug("objectsWorn: " + llList2CSV(objectsWorn));   
            if (action == "registerAction")
            {  
                debug("Action: register, actionType: " + actionType + ", ObjectName: " + objectName);                  
                integer slot = 3;
                integer link;
                if (actionType == "bucket")
                    slot = 9;
                else if (actionType == "pouch")
                    slot = 10;
                else if (actionType == "skin")
                    slot = 8;
                link = getLinkNumberByName("rp_slot"+(string)slot); 
                debug("linkNum = " +(string)link);
                setLinkTextureFast(link, actionType + " active", 4);
                llSetLinkAlpha(link, 1.0, 4);            
            }
            else if (action == "unregisterAction")
            {
                debug("Action: unregister, actionType: " + actionType + ", ObjectName: " + objectName);                  
                integer slot = 3;
                integer link;                
                if (actionType == "bucket")
                    slot = 9;
                else if (actionType == "pouch")
                    slot = 10;                
                else if (actionType == "skin")
                    slot = 8;
                link = getLinkNumberByName("rp_slot"+(string)slot);                                      
                debug("linkNum = " +(string)link);
                setLinkTextureFast(link, "active_none", 4);   
                llSetLinkAlpha(link, 0.0, 4);                              
            }               
            hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");            
        }
    }
    
    link_message(integer sender_num, integer num, string msg, key id)
    {
        debug("link message. msg: " + msg);
        // Check if the message starts with "rp_slot"
        if (llSubStringIndex(msg, "rp_slot") == 0)
        {
            // Extract the remaining characters (X value)
            string slotStr = llGetSubString(msg, 7, -1);
            integer slotNum = (integer)slotStr;

            // Verify that the slot number is within the valid range
            if (slotNum >= 0 && slotNum <= 10)
            {
                // Place for your additional code
                debug("Valid slot button clicked: " + (string)slotNum);
                if (slotNum == 9)
                    llRegionSayTo(llGetOwner(), waterChannel, "report"); 
                else if (slotNum == 10)
                    llRegionSayTo(llGetOwner(), pouchChannel, "contents");
                else if (slotNum == 8)
                    llRegionSayTo(llGetOwner(),waterChannel, "drink");                
            }
        }



    }
    
        
}
