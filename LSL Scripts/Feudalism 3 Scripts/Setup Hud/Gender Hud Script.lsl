integer DEBUG = FALSE;

integer listener;
integer hudChannel = -55667789;
//integer genderChannel = -55667789;
integer meterChannel = -77777;

string myGender;
string keyName;
key trans;
string transReason;

hideHud()
{
    llSetPos(llGetLocalPos() + <0,0,1>);      
}

showHud()
{
    llSetPos(<0,0,0>);      
    
}

//////////////////////////////////////////////////////////////////////////////////////
//
//
//
//         MAIN SCRIP STARTS HERE
//
//
//
//////////////////////////////////////////////////////////////////////////////////////

// Default state can do any init you need that doesn't require configuration.


 
default
{
    on_rez(integer start_parameter)
    {   // Start listening for a message from rezzer
        //llOwnerSay("Test HUD has been rezzed");

                    llRequestExperiencePermissions(llGetOwner(), "");
                    llSetTimerEvent(60.0);        
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        llSetTimerEvent(0.0);
        llAttachToAvatarTemp(ATTACH_HUD_CENTER_1);
        if (llGetAttached() == 0)
        {   // Attaching failed
            llDie();
        }
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
       // llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }
 
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {
            llSetTimerEvent(0.0);
            // llOwnerSay("Now attached with a key " + (string)id + " and llGetAttached() returning " + (string)llGetAttached());
            // From this point, the object can start doing whatever it needs to do.
            hideHud();
            state running;
        }
        else
        {
            // llOwnerSay("No longer attached");
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
        //llOwnerSay("off and running!");
        listener = llListen(hudChannel, "", NULL_KEY, "");          
        DEBUG = (integer)llGetObjectDesc();
        //llOwnerSay("Bandor's RPG Class Selection Hud Starting .... please wait");  
                   
        //llOwnerSay("RP Hud Class Selection setup complete. Ready for use."); 
 
        keyName = (string)llGetOwner() + "_gender";      
        
        trans = llReadKeyValue(keyName);  // check to see if the stats key/value exists
        transReason = "getGender";  
    }    
    
    attach(key id)
    {
        if (id == NULL_KEY)
        {   // if the object ever un-attaches, make sure it deletes itself
            // llOwnerSay("No longer attached");
            llDie();
        }
    }          
    
    listen(integer channel, string name, key id, string text)
    {   // Listen for the message from the rezzer with the target agent key
        if (channel == hudChannel)
        {   // Ask for the experience permission
            if (text == "HIDE")
            {
                hideHud();
            }
            else if (text == "SHOW")
            {
                showHud();
            }
            else if (text == "KILL")
            {                    
                llRequestExperiencePermissions(llGetOwner(), "");
                llListenRemove(listener);
                llSetTimerEvent(60.0);
            }                
        }
    } 
    
    touch_start(integer num_detected)
    {
    
        string action = llGetLinkName(llDetectedLinkNumber(0));
            
        if ( action == "gender_female") 
        {
            myGender = "female";  
            llRegionSayTo(llGetOwner(), meterChannel, "gender," + myGender);
            transReason = "genderUpdate";
            trans = llUpdateKeyValue(keyName, myGender, FALSE, "");                      
        } 
        else if ( action == "gender_male") 
        {
            myGender = "male";
            llRegionSayTo(llGetOwner(), meterChannel, "gender," + myGender);            
            transReason = "genderUpdate";
            trans = llUpdateKeyValue(keyName, myGender, FALSE, "");             
        } 
        else if ( action == "gender_exit") 
        {
            hideHud();
        }
    } 

    dataserver(key t, string value)
    {
        
        if (t == trans && transReason == "getGender")
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myGender =  llGetSubString(value, 2, -1);
                llOwnerSay("Your gender of " + myGender + " was read from the database."); 
                llRegionSayTo(llGetOwner(), meterChannel, "gender," + myGender);                               
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llOwnerSay("Your gender was not found in the database and may not have been saved yet.");
            }
            transReason = "none";
            trans = NULL_KEY;
        } 
        if (t == trans && transReason == "genderUpdate")
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                llOwnerSay("Your gender of " + myGender + " was successfully saved to the database.");
                    hideHud();
            }
            else
            {
                integer error = llList2Integer(result, 1);
                if(error == XP_ERROR_RETRY_UPDATE)
                    llOwnerSay("Could not save your gender to the database.");
                else
                    llOwnerSay("Could not save your gender to the database.");
            }  
        }
        trans = NULL_KEY;
        transReason = "none";                         
    }  

    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        //llOwnerSay("Trying llAttachToAvatarTemp()");
        llDetachFromAvatar();
       //llOwnerSay("Detaching from avatar.");
        llSetTimerEvent(0.0);
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
       // llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }  
 
    timer()
    {   // Use a timer to catch no permissions response
       // llOwnerSay("Permissions timer expired");
        llDie();
    }    
    
    
    
}
