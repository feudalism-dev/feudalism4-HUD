integer DEBUG = FALSE;
integer skinChannel;
integer menuChannel;
integer waterChannel = -595225;
integer listenHandle;
key skinID;
float drinkTime = 60.0;
float menuTimer = 60.0;
key ToucherID;
integer capacity = 5;
integer contents = 5;
string drinkName = "water";
key senderKey;
integer permissionGranted = FALSE;
integer wantToDetach = FALSE;
// consumable stuff
integer PLAYERHUDCHANNEL = -77770;
string itemType;
integer itemHealthMod;
integer itemStaminaMod;
integer foundConsumable;
key transGetConsumable = NULL_KEY;
//key trans = NULL_KEY;
//string transReason = "none";
string thisObject;

list gNames = ["Contents","Drink","Empty"];  // Your list of potential menu choices
integer gMenuPosition;  // Index number of the first button on the current page
integer gLsn;   // Dialog Listen Handle

debug(string message)
{
    if (DEBUG)
        llOwnerSay("Skin. " + message);   
}

drink()
{
    debug("drink function... ");
    drinkName = llLinksetDataRead("drinkName");
    contents = (integer)llLinksetDataRead("contents");
    debug("skin has contents.");       
    skinChannel = llRound(llFrand(-100000));
    debug("rezz the held skin.");
    llRezObject("Feudalism Drink Skin Right Hand", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, skinChannel);
    llRegionSayTo(llGetOwner(), 0, "You start drinking " + drinkName + ". Your skin now has " + (string)contents + " servings left.");
    debug("check for consumable item data");
    transGetConsumable = llReadKeyValue("consumableItem_" + drinkName); 
}

Menu()
{
    integer Last;
    list Buttons;
    integer All = llGetListLength(gNames);
//llOwnerSay("Menu running.");    
    if(gMenuPosition >= 9)   //This is NOT the first menu page
    {
        Buttons += "    <----";
        if((All - gMenuPosition) > 11)  // This is not the last page
        {
            Buttons += "    ---->";
        }
        else    // This IS the last page
        {
            Last = TRUE;
        }            
    }    
    else if (All > gMenuPosition+9) // This IS the first page
    {
        if((All - gMenuPosition) > 11)  // There are more pages to follow
        {
            Buttons += "    ---->";
        }
        else    // This IS the last page
        {
            Last = TRUE;
        }            
    }
    else    // This is the only menu page
    {
        Last = TRUE;
    }
    if (All > 0)
    {
        integer b;
        integer len = llGetListLength(Buttons);
        // This bizarre test does the important work ......        
        for(b = gMenuPosition + len + Last - 1 ; (len < 12)&&(b < All); ++b)
        {
            Buttons = Buttons + [llList2String(gNames,b)];
            len = llGetListLength(Buttons);
        }
    }
    gLsn = llListen(menuChannel,"","","");    
    llSetTimerEvent(menuTimer);
    llDialog(ToucherID," \nWhat would you like to do with your drink skin?",Buttons,menuChannel);
}

default
{
    state_entry()
    {
        permissionGranted = FALSE;
        wantToDetach = FALSE;
        listenHandle = llListen(waterChannel, "", "", "");          
        menuChannel = (integer)llFrand(-10000);        
        skinID = NULL_KEY;
        llSetLinkAlpha(LINK_SET,1.0,ALL_SIDES);
        thisObject = llGetObjectName();
        //llLinksetDataWrite("drinkName", drinkName);
        //llLinksetDataWrite("contents", (string)contents);
    }
    
    attach(key id)
    {
        if (id == NULL_KEY)
        {
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterAction,skin," + thisObject);                
        }   
        else
        { 
            llRegionSayTo(llGetOwner(), waterChannel, "check");  
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "registerAction,skin," + thisObject);  
        }         
    }     

    object_rez(key id)
    {
        llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);
        skinID = id;
        permissionGranted = FALSE;
        llRequestExperiencePermissions(llGetOwner(), "");        
        llSetTimerEvent(30.0);
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        if (wantToDetach)
        {
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterAction,skin");             
            llDetachFromAvatar();   
        }
        else
        {
            permissionGranted = TRUE;
            llSetTimerEvent(0.0);
            llStartAnimation("drinkSkinRight_m"); 
            llSetTimerEvent(drinkTime);
        }
    }   
    
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
        llRegionSayTo(skinID, skinChannel, "die");
    }    

    touch_start(integer total_number)
    {
        ToucherID = llDetectedKey(0);
        if (ToucherID == llGetOwner())
        {
            llListenRemove(gLsn);
            gMenuPosition = 0;                  
            Menu();
        }
    }
    
    listen( integer channel, string name, key id, string message )
    { 
debug("Listen channel = " +(string)channel + ", name: " + name + ", id: " + (string)id + ", message: " + message);    
        if (channel == menuChannel)
        {
debug("got right channel");            
            llListenRemove(gLsn);
            message = llToLower(message);
            if (message == "contents")
            {
                string tempName = llLinksetDataRead("drinkName");
                if (tempName == "None")
                    llRegionSayTo(llGetOwner(), 0, "Your drink skin is empty.");
                else
                {
                llRegionSayTo(llGetOwner(), 0, "Your drink skin contains: ");
                llRegionSayTo(llGetOwner(),0,llLinksetDataRead("drinkName") + ": " + llLinksetDataRead("contents"));   
                }
            }
            else if (message == "empty")
            {
                llLinksetDataWrite("drinkName", "None");
                llLinksetDataWrite("contents", "0");   
                drinkName = "None";
                contents = 0;
                llRegionSayTo(llGetOwner(), 0, "Your drink skin is now empty.");
            }
        }
        else if (channel == waterChannel)
        {
            if (message == "check")
            {
                senderKey = id;
                contents = (integer)llLinksetDataRead("contents");
                llRegionSayTo(senderKey, waterChannel, "contents," + llLinksetDataRead("drinkName") + "," + (string)(capacity - contents)); 
            }
            else if (message == "drink")   
            {
                drink();
            }
            else
            {
debug("drink skin listen, other message received.");                
                list params = llCSV2List(message);
                if (llGetListLength(params) == 3)
                {
                    string action = llToLower(llList2String(params,0));
                    string itemName = llList2String(params,1);
                    integer itemQuantity = llList2Integer(params,2);
debug("action: " + action + ", itemName: " + itemName + ", itemQuantity: " + (string)itemQuantity); 
                    if (action == "bgive")
                    {
debug("Got bGive");                        
                        contents += itemQuantity;
                        string output = "You received " + (string)itemQuantity + " units of " + itemName;
                        if (contents >= capacity)
                        {
                            contents = capacity;
                            output += ". Your skin is now full.";
                        }
                        else
                        {
                            output += ".";   
                        }
                        llRegionSayTo(llGetOwner(), 0, output);
                        llLinksetDataWrite("contents", (string)contents); 
                    }
                    else if (action == "btake")
                    {
                        if (itemQuantity <= contents)
                        {
                            contents -= itemQuantity;
                            llRegionSayTo(llGetOwner(), 0, "You now have " + (string)contents + " units of " + itemName + " in this skin.");
                        }
                        else
                            llRegionSayTo(llGetOwner(), 0, "Sorry, you only have " + (string)contents + " units of " + itemName + " but a request was received to take " + (string)itemQuantity + " units. Please try again when you have enough.");
                    }
                    else if (action == "contents")
                    {
                        llRegionSayTo(llGetOwner(), 0, "Your drink skin has detected that you are wearing another skin. You may only wear one skin at a time. Detaching this skin.");
                        wantToDetach = TRUE; 
                        llRequestExperiencePermissions(llGetOwner(),"");
                    }
                    else if (action == "drink")
                    {
                        drink();
                    }                    
                }
                else
                {

                }    
            }
        }
    
    }    

    dataserver(key t, string value)
    { 
        if (t == transGetConsumable)
        {
debug("Got response for transGetConsumable lookup");            
            foundConsumable = FALSE;
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
debug("Consumable item found. Value: " + value);
                // the key-value pair was successfully read
                string itemDesc = llGetSubString(value, 2, -1);
                list itemParms = llCSV2List(itemDesc);
                itemHealthMod = llList2Integer(itemParms, 3);
                itemStaminaMod = llList2Integer(itemParms, 4);
                foundConsumable = TRUE;
                if (contents > 0)
                {
                    contents--;    
                    llLinksetDataWrite("contents", (string)contents);
                }                    
            }
            else
            {
debug("Consumable item not found.");
               // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llRegionSayTo(llGetOwner(), 0, "The item you used is not registered as consumable in the Feudalism database and so nothing happens. To have the item registered, talk to a Feudalism RPG admin.");
                foundConsumable = FALSE;
            }
            if (foundConsumable)
            {
                if (itemHealthMod != 0)            
                    llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "changeHealth," + (string)itemHealthMod); 
                    //llRegionSayTo(toucherID, 0, "changeHealth," + (string)itemHealthMod);
                if (itemStaminaMod != 0)            
                    llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "changeStamina," + (string)itemStaminaMod); 
                    //llRegionSayTo(toucherID, 0, "changeStamina," + (string)itemStaminaMod);
            }             
        }     
    }    // end of dataserver
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (permissionGranted)
            llStopAnimation("drinkSkinRight_m");             
        llRegionSayTo(skinID, skinChannel, "die");
        llSetLinkAlpha(LINK_SET,1.0, ALL_SIDES);
        skinID = NULL_KEY; 
    }
}
