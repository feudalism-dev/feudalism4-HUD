integer wantToDetach = FALSE;
string mySpecies = "human";
list species = ["human", "elf", "dwarf", "halfling", "gnome", "dragonborn", "half-elf", "half-orc", "tiefling", "drow", "demon", "imp", "werewolf", "vampire", "shapeshifter", "alka alon", "karshak alon", "enshadowed", "gurvani", "merfolk", "fairy"];

integer genderChannel = -55667789;
integer titleChannel = -55667790;
integer statsChannel = -55667791;
integer classChannel = -55667792;
integer newChannel = -55667793;
integer speciesChannel = -55667794;
key toucherID;  

integer listen_handle;

default
{
    state_entry()
    {
        integer MAX_SLOTS = 38;
        integer SLOTS_NEEDED = 4;

        
        wantToDetach = FALSE;
        list details = llGetObjectDetails(llGetOwner(), ([OBJECT_ATTACHED_SLOTS_AVAILABLE]));
        integer slotsOpen = llList2Integer(details,0);
        if (slotsOpen >= SLOTS_NEEDED)
        {
            llOwnerSay("You have enough attachment slots available to wear this hud.");
            if (llAgentInExperience(llGetOwner()))
            {
                state idle;
            }
            else
            {
                llRequestExperiencePermissions(llGetOwner(), "");            
            } 
        } 
        else
        { 
            llOwnerSay("You DO NOT have enough attachment slots available to wear this hud. You are currently wearing " + (string)(MAX_SLOTS - slotsOpen) + " attachments, including HUDs. You need at least " + (string)SLOTS_NEEDED + " free slots to wear this hud.");        
            wantToDetach = TRUE; 
            llRequestExperiencePermissions(llGetOwner(), "");             
        } 
    }
    
    on_rez(integer start_param)
    {
        llResetScript();
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        if (wantToDetach)
            llDetachFromAvatar();
        else
            state idle;
    }
 
    experience_permissions_denied( key agent_id, integer reasonCode )
    {   // Permissions denied, so go away
        string reason;
        if (reasonCode == 1)
            reason = "Too Many Requests";
        else if (reasonCode == 2)
            reason = "The region currently has experiences disabled.";
        else if (reasonCode == 3)
            reason = "One of the string arguments was too big to fit in the key-value store.";
        else if (reasonCode == 4)
            reason = "Experience permissions were denied by the user.";
        else if (reasonCode == 5)
            reason = "This script is not associated with an experience.";
        else if (reasonCode == 6)
            reason = "The sim was unable to verify the validity of the experience. Retrying after a short wait is advised.";
        else if (reasonCode == 7)
            reason = "The script is associated with an experience that no longer exists.";
        else if (reasonCode == 8)
            reason = "The experience owner has temporarily disabled the experience.";
        else if (reasonCode == 9)
            reason = "The experience has been suspended by Linden Lab customer support.";
        else if (reasonCode == 10)
            reason = "An unknown error not covered by any of the other predetermined error states.";
        else if (reasonCode == 11)
            reason = "An attempt to write data to the key-value store failed due to the data quota being met.";
        else if (reasonCode == 12)
            reason = "They key-value store is currently disabled on this region.";
        else if (reasonCode == 13)
            reason = "Unable to communicate with the key-value store.";
        else if (reasonCode == 14)
            reason = "They requested key does not exist.";
        else if (reasonCode == 15)
            reason = "A checked update failed due to an out of date request.";
        else if (reasonCode == 16)
            reason = "The content rating of the experience exceeds that of the region.";
        else if (reasonCode == 17)
            reason = "The experience is blocked or not enabled for this land.";
        else if (reasonCode == 18)
            reason = "The request for experience permissions was ignored.";
        llOwnerSay("The Feudalism RPG system requires that you be on a sim that has the Feudalism RPG experience enabled and that you accept the Feudalism RPG experience permissions request. Please correct this and try to wear the HUD again. Reason: " + reason);
        llDetachFromAvatar();
    } 
    
    changed(integer change)
    {
        if (change & CHANGED_REGION) //note that it's & and not &&... it's bitwise!
        {
            //llOwnerSay("You changed regions. Resetting.");
            llResetScript(); 
        }
        else if (change & CHANGED_TELEPORT) //note that it's & and not &&... it's bitwise!
        {
            //llOwnerSay("You teleported. Resetting.");
            llResetScript(); 
        }
        if (change & CHANGED_OWNER)
        {
            //llOwnerSay("Hud changed owners. Resetting.");            
            llResetScript();   
        }
    }        
}

state idle
{
    state_entry()
    {
        llOwnerSay(llGetObjectName() + " is ready for use.");        
    }
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER)
            llResetScript();
    }    
    
    on_rez(integer start_parameter)
    {
     
    } 
 
    touch_start(integer num)
    {
        toucherID = llDetectedKey(0);  
        if(llAgentInExperience(toucherID))
        {
            string action = llGetLinkName(llDetectedLinkNumber(0));
//            llOwnerSay("Action: " + action);           
            llRegionSayTo(toucherID, genderChannel, "HIDE");                    
            llRegionSayTo(toucherID, titleChannel, "HIDE");                  
            llRegionSayTo(toucherID, classChannel, "HIDE");                  
            llRegionSayTo(toucherID, statsChannel, "HIDE");                     
            llRegionSayTo(toucherID, newChannel, "HIDE");                  
            llRegionSayTo(toucherID, speciesChannel, "HIDE");                  
            
            if ( action == "menu_gender") 
            {                                   
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), titleChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), classChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
                llRegionSayTo(llGetOwner(), newChannel, "KILL");                
                llRezObject("Gender Hud v3.0.0", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, genderChannel);            
                llSleep(1);
               llRegionSayTo(toucherID, genderChannel, "SHOW");                       
            }
            else if ( action == "menu_species") 
            {                                   
                llRegionSayTo(toucherID, genderChannel, "HIDE");               
                llRegionSayTo(llGetOwner(), titleChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), classChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
                llRegionSayTo(llGetOwner(), newChannel, "KILL");                
                llRezObject("Species Hud v3.0.3m", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, speciesChannel);                           
                llSleep(1);
                llRegionSayTo(toucherID, speciesChannel, "SHOW");  
            }                        
            else if ( action == "menu_title") 
            {
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), genderChannel, "KILL");                                    
                llRegionSayTo(llGetOwner(), classChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
                llRegionSayTo(llGetOwner(), newChannel, "KILL");       
                llRezObject("Title Hud v3.0.0", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, titleChannel);                           
                llSleep(1);
                llRegionSayTo(toucherID, titleChannel, "SHOW");  
            }         
            else if ( action == "menu_class") 
            {
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), genderChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), titleChannel, "KILL");                                  
                llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
                llRegionSayTo(llGetOwner(), newChannel, "KILL");     
                llRezObject("Class Hud v3.0.3", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, classChannel);           
                llSleep(1);
                llRegionSayTo(toucherID, classChannel, "SHOW");  
            }    
            else if ( action == "menu_stats") 
            {
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), genderChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), titleChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), classChannel, "KILL");                                      
                llRegionSayTo(llGetOwner(), newChannel, "KILL");      
                llRezObject("Stats Hud v3.0.3", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, statsChannel);
                llSleep(1);
                llRegionSayTo(toucherID, statsChannel, "SHOW");       
            }  
            else if ( action == "menu_new")
            {
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), genderChannel, "KILL");                    
                llRegionSayTo(llGetOwner(), titleChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), classChannel, "KILL");                  
                llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
                llRezObject("Character Hud v3.0.3", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, newChannel); 
                llSleep(1);
                llRegionSayTo(toucherID, newChannel, "SHOW");             
            }
            else
            {      
           
            }            
        }
        else
        {
            llOwnerSay("This Hud will only work in a sim that is using the Feudalism RPG Experience and you must have accepted the Feudalism RPG experience permissions request.");   
        }
    }
    
    attach(key id)
    {
        if (id)     // is a valid key and not NULL_KEY
        {
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
            llRegionSayTo(llGetOwner(), genderChannel, "KILL");                    
            llRegionSayTo(llGetOwner(), titleChannel, "KILL");                  
            llRegionSayTo(llGetOwner(), classChannel, "KILL");                  
            llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
            llRegionSayTo(llGetOwner(), newChannel, "KILL");              
            //llRezObject("Character Hud v3.0.0", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, newChannel);            
            //llRezObject("Gender Hud v3.0.0", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, genderChannel);           
            //llRezObject("Title Hud v3.0.0", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, titleChannel);             
            //llRezObject("Class Hud v3.0.1", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, classChannel);             
            //llRezObject("Stats Hud v3.0.0", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, statsChannel);              
        }
        else
        {
                llRegionSayTo(llGetOwner(), speciesChannel, "KILL");                    
            llOwnerSay("Feudalism RPG Setup Hud Shutting Down.");
            llRegionSayTo(llGetOwner(), genderChannel, "KILL");                    
            llRegionSayTo(llGetOwner(), titleChannel, "KILL");                  
            llRegionSayTo(llGetOwner(), classChannel, "KILL");                  
            llRegionSayTo(llGetOwner(), statsChannel, "KILL");                     
            llRegionSayTo(llGetOwner(), newChannel, "KILL");   
        }
    }
    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(listen_handle);    
    }
    
    listen(integer channel, string name, key id, string message)
    {
        if (llListFindList(species, [llToLower(message)]) != -1)
        {
            mySpecies = llToLower(message);
            llRegionSayTo(id, 0, "You have selected your species to be: " + mySpecies);
        }
    }    
}