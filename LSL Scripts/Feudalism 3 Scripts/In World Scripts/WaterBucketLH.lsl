integer debugMode = FALSE;
integer wantToDetach = FALSE;
integer waterChannel = -595225;
integer PLAYERHUDCHANNEL = -77770;
integer capacity = 15;
integer contents = 0;
integer listenHandle;
key senderKey;
string attachMessage = "waterBucketOn";
string attachPoint = "LeftHand";
string thisObject;
string gripAnim = "gripBucket";
string carryAnim = "carryBucket";

debug(string message)
{
    if (debugMode)
        llOwnerSay(message);   
}

default
{
    state_entry()
    {
        llLinksetDataWrite("contents", "0");
        llMessageLinked(LINK_SET, 0, "hide", "");            
        thisObject = llGetObjectName();
        state idle;
    }
}
    
state idle
{
    
    state_entry()
    {
        debug("Bucket state idle starting.");        
        contents = (integer)llLinksetDataRead("contents");
        if (contents > 0)
            llMessageLinked(LINK_SET, 0, "show", "");
        else
            llMessageLinked(LINK_SET, 0, "hide", "");        
        if (attachPoint == "LeftHand")
        {
            carryAnim += "LH";
            gripAnim += "LH";   
        }
             
        debug("bucket contents= " + (string)contents);        
        llRegionSayTo(llGetOwner(),0, llGetObjectDesc() + " contains " + (string)contents + " units of water.");
        wantToDetach = FALSE;
        listenHandle = llListen(waterChannel, "", "", "");
        senderKey = NULL_KEY;
    }    
    
    attach(key id)
    {
        if (id == NULL_KEY)
        {   
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterAction,bucket," + thisObject); 
            debug("pouch detaching");
        }  
        else
        {  
            debug("Bucket attaching.");   
            wantToDetach = FALSE;
            llRegionSayTo(llGetOwner(), waterChannel, "waterBucketOn" + attachPoint);  
            llSleep(0.5);            
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "registerAction,bucket," + thisObject);          
            llRequestExperiencePermissions(llGetOwner(), "");  
        } 
    }   
    
    experience_permissions(key target_id)
    { 
        if (!wantToDetach)
        {
            llStartAnimation(carryAnim);
            llStartAnimation(gripAnim);
        }
        else
        {  
            debug("Attempting to detach from.");
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterAction,bucket," + thisObject);        
            llStopAnimation(carryAnim); 
            llStopAnimation(gripAnim); 
            llRegionSayTo(llGetOwner(), 0, "Sorry, but you can only wear one water bucket at a time. This bucket has detected another bucket and is detaching.");  
            llDetachFromAvatar();
        }
    }

    touch_start(integer total_number)
    {
        debug("Bucket touch. Capacity = " + (string)capacity + ", contents = " + (string)contents);        
        if (contents == capacity)
            llRegionSayTo(llGetOwner(),0, llGetObjectDesc() + " contains " + (string)contents + " units of water and is FULL.");   
        else
            llRegionSayTo(llGetOwner(),0, llGetObjectDesc() + " contains " + (string)contents + " units of water and can hold " + (string)(capacity - contents) + " more.");
    }
    
    listen(integer channel, string name, key id, string message)
    {
        debug("bucket listen. message:" + message + ", id:" + (string)id);
        if (channel == waterChannel)
        {
            message = llToLower(message);
            if (message == "waterbucketonlefthand" && attachPoint == "RightHand")
            {
                debug("Got bucket on left hand while one is on the right hand.");
                wantToDetach = TRUE;              
                llRequestExperiencePermissions(llGetOwner(), "");  
            }
            else if (message == "waterbucketonrighthand" && attachPoint == "LeftHand")
            {  
                debug("Got bucket on right hand while one is on left hand.");   
                wantToDetach = TRUE;
                llRequestExperiencePermissions(llGetOwner(), "");  
            }            
            else if (message == "check")
            {
                debug("bucket listen, check message received.");                
                senderKey = id;
                llRegionSayTo(senderKey, waterChannel, "contents,water," + (string)(capacity - contents));    
            } 
            else if (message == "check,water")
            {
                debug("bucket listen, check message received.");                
                senderKey = id;
                llRegionSayTo(senderKey, waterChannel, "water,"  + (string)15);   
            }            
            else if (message == "contents")
            {
                debug("bucket listen, contents message received.");                
                senderKey = id;
                llRegionSayTo(senderKey, waterChannel, (string)contents);    
            }   
            else if (message == "report")
                llRegionSayTo(llGetOwner(), 0, "Water bucket contains " +(string)contents + " units of water.");      
            else
            {
                debug("bucket listen, other message received.");                
                list params = llCSV2List(message);
                if (llGetListLength(params) == 3)
                {
                    string action = llList2String(params,0);
                    debug("action: " + action);
                    string itemName = llList2String(params,1);
                    debug("itemName: " + itemName);
                    integer itemQuantity = llList2Integer(params,2);
                    debug("itemQuantity: " +(string)itemQuantity);
                    if (action == "bgive")
                    {
                        contents += itemQuantity;
                        string output = "You received " + (string)itemQuantity + " units of " + itemName;
                        if (contents >= capacity)
                        {
                            contents = capacity;
                            output += ". Your bucket is full.";
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
                            debug("btake");
                            contents -= itemQuantity;
                            llRegionSayTo(llGetOwner(), 0, "You now have " + (string)contents + " units of " + itemName + " in this bucket.");
                        }
                        else
                            llRegionSayTo(llGetOwner(), 0, "Sorry, you only have " + (string)contents + " units of " + itemName + " but a request was received to take " + (string)itemQuantity + " units. Please try again when you have enough.");
                    }
                    else if (action == "btakeitem")
                    {
                        debug("btakeitem. itemQuantity: " + (string)itemQuantity + ", contents: " + (string)contents);
                        if (itemQuantity <= contents)
                        {

                            contents -= itemQuantity;
                            llRegionSayTo(llGetOwner(), 0, "You now have " + (string)contents + " units of " + itemName + " in this bucket.");
                        }
                        else
                            llRegionSayTo(llGetOwner(), 0, "Sorry, you only have " + (string)contents + " units of " + itemName + " but a request was received to take " + (string)itemQuantity + " units. Please try again when you have enough.");
                    }                    
                }
                else
                {
                    
                }
                if (contents > 0)
                    llMessageLinked(LINK_SET, 0, "show", "");
                else
                    llMessageLinked(LINK_SET, 0, "hide", "");                    
            }  
        }
    }
}
