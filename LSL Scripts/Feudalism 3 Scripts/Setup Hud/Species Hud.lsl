string keyName;
key transGetSpecies;
key transSetSpecies;
string mySpecies = "human";
integer meterChannel = -77777;
integer listener;
integer hudChannel = -55667792;
string requestReason = "detach";

list species = ["human", "elf", "dwarf", "halfling", "gnome", "dragonborn", "half-elf", "half-orc", "tiefling", "drow", "demon", "imp", "werewolf", "vampire", "merfolk", "fairy", "merfolk", "satyr", "minotaur", "reptilian", "goblin"];

debug(string debugMessage)
{
    if (llGetObjectDesc() == "debug")
        llOwnerSay(debugMessage);  
}

default
{
    
    state_entry()
    {    
debug("Species hud starting.");    
    }    
    
    on_rez(integer start_parameter)
    {   // Start listening for a message from rezzer
//llOwnerSay("Class HUD has been rezzed");

        llRequestExperiencePermissions(llGetOwner(), "");
        llSetTimerEvent(60.0);           
    }  
    
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {
            llSetTimerEvent(0.0);
             //llOwnerSay("Now attached with a key " + (string)id + " and llGetAttached() returning " + (string)llGetAttached());
            // From this point, the object can start doing whatever it needs to do.
            state running;
        }
        else
        {
             //llOwnerSay("No longer attached");
            llDie();
        }
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
debug("Experience Permissions accepted");
        llSetTimerEvent(0.0);      
        llAttachToAvatarTemp(ATTACH_HUD_CENTER_1);
         //llOwnerSay("After llAttachToAvatarTemp() with llGetAttached() returning " + (string)llGetAttached());
        if (llGetAttached() == 0)
        {   // Attaching failed
            llDie();
        }
    }
        
    timer()
    {   // Use a timer to catch no permissions response
         //llOwnerSay("Permissions timer expired");
        llDie();
    }        
    
    
}

state running
{
    state_entry()
    {
debug("State running.");
        mySpecies = "human";
// remove this
        listener = llListen(hudChannel, "", NULL_KEY, "");  
        keyName = (string)llGetOwner() + "_species";      
        transGetSpecies = llReadKeyValue(keyName);  // check to see if the stats key/value exists               
    }
    
    attach (key id)
    {
        if (id)
        {    
            mySpecies = "human";   
            keyName = (string)llGetOwner() + "_species";      
            transGetSpecies = llReadKeyValue(keyName);  // check to see if the stats key/value exists 
        }   
    }    

    link_message(integer sender_num, integer num, string msg, key id)
    {
debug("Species Script: link message received: " + msg);
        if (msg == "close")
        {
            debug("Yep, it wants to close.");
            requestReason = "detach";
            llRequestExperiencePermissions(llGetOwner(), "");
            llSetTimerEvent(60.0);             
        }         
        else if (llListFindList(species, [msg]) != -1)
        {
debug("Species of " + msg + " was a valid species.");
            //llMessageLinked(LINK_ALL_OTHERS, 0, mySpecies, ""); 
            mySpecies = msg;
            transSetSpecies = llUpdateKeyValue((string)llGetOwner() + "_species", mySpecies, FALSE, "");             
        }     
    }
    
    dataserver(key t, string value)
    {
        
        if (t == transGetSpecies)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                mySpecies =  llGetSubString(value, 2, -1);
                llMessageLinked(LINK_SET, 0, mySpecies, "");               
                llRegionSayTo(llGetOwner(),0, "Your species of " + mySpecies + " was read from the database.");                                           
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llRegionSayTo(llGetOwner(),0, "Your species was not found in the database and has been set to human by default.");
                mySpecies = "human";
                llMessageLinked(LINK_SET, 0, mySpecies, "");  
            }
        } 
        if (t == transSetSpecies)
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                llRegionSayTo(llGetOwner(),0, "Your species of " + mySpecies + " was successfully saved to the database.");
                llRegionSayTo(llGetOwner(), meterChannel, "species," + mySpecies);                   
            }
            else
            {
                integer error = llList2Integer(result, 1);
                if(error == XP_ERROR_RETRY_UPDATE)
                    llRegionSayTo(llGetOwner(),0, "Could not save your species to the database.");
                else
                    llRegionSayTo(llGetOwner(),0, "Could not save your species to the database.");
            }  
        }         
    } 
    
    listen(integer channel, string name, key id, string text)
    {   // Listen for the message from the rezzer with the target agent key
        if (channel == hudChannel)
        {   // Ask for the experience permission
                if (text == "KILL")
                {
                    requestReason = "detach";
                    llRequestExperiencePermissions(llGetOwner(), "");
                    llSetTimerEvent(60.0);  
                }
        }
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        if (requestReason == "rez")
        {
            llSetTimerEvent(0.0);      
            llAttachToAvatarTemp(ATTACH_HUD_CENTER_1);
            requestReason = "detach";
             //llOwnerSay("After llAttachToAvatarTemp() with llGetAttached() returning " + (string)llGetAttached());
//            showHud();
            if (llGetAttached() == 0)
            {   // Attaching failed
                llDie();
            }                
        }
        else
        {            
            //llOwnerSay("Trying llAttachToAvatarTemp()");
            llDetachFromAvatar();
            //llOwnerSay("Detaching from avatar.");
            llSetTimerEvent(0.0);
        }
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
        //llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }  
 
    timer()
    {   // Use a timer to catch no permissions response
        //llOwnerSay("Permissions timer expired");
        llDie();
    }    
 
}