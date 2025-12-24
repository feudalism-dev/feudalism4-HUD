integer meterChannel = -77777;
integer menuChannel = -777799;
integer meterModeChannel = -7777777;
integer menuListener;
integer menuActive = FALSE;
integer characterLoaded = FALSE;
string mode;


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

string getPercentage(integer percent) {
    string result = "100";
    
    if (percent > 90) result = "100";
    else if (percent > 80) result = "90";
    else if (percent > 70) result = "80";
    else if (percent > 60) result = "70";
    else if (percent > 50) result = "60";
    else if (percent > 40) result = "50";
    else if (percent > 30) result = "40";
    else if (percent > 20) result = "30";
    else if (percent > 10) result = "20";
    else if (percent > 0) result = "10";    
    else if (percent = 0) result = "0";
    
    return result;    
}

setPrimText(string primName, string value) {
    integer linkNum = getLinkNumberByName(primName);
    if (linkNum == -1) {
       // llOwnerSay("Error: " + primName + " prim not found");            
    } else {
        llSetLinkPrimitiveParamsFast(linkNum, [PRIM_TEXT, value, <1.000, 0.863, 0.000>,0.8]); 
    }       
}

default
{
    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay(msg);
        if (msg == "set health display")
        {
            string linkName = "rp_health";
            integer linkNum;
            string texture;
            integer percent;
            string percentage;
            integer currentHealth = num;  
            float baseHealth = (float)((string)id);         
            
            if (currentHealth < 0) 
            {
                currentHealth = 0;
            }
            
            linkNum = getLinkNumberByName(linkName);
            setPrimText("rp_healthStatPrim", (string)currentHealth);
            llRegionSayTo(llGetOwner(), meterChannel, "health," + (string)currentHealth);    
            if (currentHealth == 0) 
            {
                percentage = "0";
            }
            else 
            {        
                percent = (integer)(((float)currentHealth / (float)baseHealth) * 100);
                percentage = getPercentage(percent);
            }
    
            texture = "health" + percentage;

            if (linkNum > 1) 
            {
                setLinkTextureFast(linkNum, texture, ALL_SIDES);
            } else 
            {
                //llOwnerSay("Error. Set Stamina Globe could not find prim rp_stamina in linkNames.");
                //llOwnerSay((string)linkNames);        
            }
        }
        if (msg == "set stamina display")
        {
            string linkName = "rp_stamina";
            integer linkNum;
            string texture;
            integer percent;
            string percentage;
            integer currentStamina = num;
            float baseStamina = (float)((string)id);
            
            if (currentStamina < 0)
            {
                currentStamina = 0;   
            }

            linkNum = getLinkNumberByName(linkName);    
            setPrimText("rp_staminaStatPrim", (string)currentStamina);    
            llRegionSayTo(llGetOwner(), meterChannel, "stamina," + (string)currentStamina);    
            if (currentStamina == 0) 
            {
                percentage = "0";
            }
            else 
            {        
                percent = (integer)(((float)currentStamina / (float)baseStamina) * 100);
                percentage = getPercentage(percent);
            }
    
            texture = "stamina" + percentage;

            if (linkNum > 1) 
            {
                setLinkTextureFast(linkNum, texture, ALL_SIDES);
            } else 
            {
                //llOwnerSay("Error. Set Stamina Globe could not find prim rp_stamina in linkNames.");
                //llOwnerSay((string)linkNames);        
            }                   
        }
        if (msg == "set xp display")
        {
            integer link = getLinkNumberByName("rp_xpBar");
            string texture;
            integer percent;
            string percentage;
            integer targetXP;
            integer step1XP;
            integer step2XP;
            integer myXP = num;
            integer i = 0;
    
            setPrimText("rp_xpText", (string)myXP + " XP");
    
            if (myXP < 1000) targetXP = 1000;
            else if (myXP < 5000) targetXP = 5000;
            else if (myXP < 10000) targetXP = 10000;
            else if (myXP < 100000) targetXP = 100000;
            else targetXP = 1000000;
    
            if (myXP == 0) 
            {
                percentage = "0";
            }
            else 
            {        
                percent = (integer)(((float)myXP / (float)targetXP) * 100);
                if (percent > 100) 
                {
                    percent = 100;
                    //llOwnerSay("You qualify for a new level. You should update your character.");
                }
                percentage = getPercentage(percent);
            }
            texture = "xp" + percentage;

            if (link > 1) 
            {
                setLinkTextureFast(link, texture, 4);
            } else 
            {
                // llOwnerSay("Error. Set XP Bar could not find prim rp_xpBar in linkNames.");
                // llOwnerSay((string)linkNames);        
            }                
        }
    }

    touch_start(integer num_detected)
    {
        string touchAction = llGetLinkName(llDetectedLinkNumber(0));
        if ( touchAction == "rp_update") 
        {
//llOwnerSay("RP UPDATE");            
            llMessageLinked(LINK_ROOT, 0, "hard reset", "");                                    
        }  
        else if ( touchAction == "rp_options") 
        // use this to allow the user to define options, like meter color, tournament mode, etc.
        {    
            list menuChoices = ["Tournament", "Roleplay", "OOC", "AFK", "*", "Show Bars", "Hide Bars"];        
            string message = "\nPlease select an option:\n\n";
            llListenRemove(menuListener);
            menuListener = llListen(menuChannel, "", llGetOwner(), "");            
            llDialog(llGetOwner(), message, menuChoices, menuChannel);
            menuActive = TRUE;
            llSetTimerEvent(30.0);            
          
        }                
        else if ( touchAction == "rp_heart") 
        { 
//llOwnerSay("RP_heart");
        
            list menuChoices;
            menuChoices = ["OOC Reset", "IC Rest", "Stop Resting"];    
             
            string message = "\nPlease make a choice:\n\n";
            llDialog(llGetOwner(), message, menuChoices, menuChannel);
            llListenRemove(menuListener);
            menuListener = llListen(menuChannel, "", llGetOwner(), "");  
            llSetTimerEvent(30.0);                 
        }
        else if (touchAction == "rp_slot2" || touchAction == "rp_slot3" || touchAction == "rp_slot4" || touchAction == "rp_slot5" || touchAction == "rp_slot6" || touchAction == "rp_slot7" || touchAction == "rp_slot8" || touchAction == "rp_slot9" || touchAction == "rp_slot10"  )
            {
                //llOwnerSay("Touched an rp slot.");
                llMessageLinked(LINK_SET, 0, touchAction, "");                                 
            }
    }  

    listen( integer channel, string name, key id, string message ) 
    {
        if (channel == menuChannel) {       
      //  llOwnerSay("Hud says: " + message); 
            llListenRemove(menuListener);
            message = llToLower(message);
            if (message == "ooc reset")
            {
                llMessageLinked(LINK_ROOT, 0, "reset character", "");                         
            } 
            if (message == "ic rest")
            {
                llMessageLinked(LINK_ROOT, 0, "rest", "");
            }
            if (message == "stop resting")
            {
                llMessageLinked(LINK_ROOT, 0, "stop resting", "");
            }            
            if (message == "tournament")
            {
                llMessageLinked(LINK_ROOT, 0, "tournament mode", "");                  
                llOwnerSay("Setting hud to Tournament mode.");
                mode = "tournament";
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,tournament");                
            }                                                
            if (message == "roleplay")
            {
                llMessageLinked(LINK_ROOT, 0, "roleplay mode", "");                                  
                llOwnerSay("Setting hud to Roleplay mode."); 
                mode = "roleplay";   
                         
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,roleplay");                 
            }                                                
            if (message == "ooc")
            {
                llMessageLinked(LINK_ROOT, 0, "ooc mode", "");                                           
                llOwnerSay("Setting hud to OOC mode.");  
                mode = "ooc";                                
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,ooc");                 
            }   
            if (message == "afk")
            {
                llMessageLinked(LINK_ROOT, 0, "afk mode", "");                                   
                llOwnerSay("Setting hud to AFK mode.");  
                mode = "afk";                                
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,afk");                 
            }   
            if (message == "*")
            {                  
                llOwnerSay("Setting hud to * mode.");  
                mode = "none";                                
                llRegionSayTo(llGetOwner(), meterModeChannel, "mode,none");                 
            }                                                                        
            if (message == "hide bars")
            {                  
                llOwnerSay("Setting hud to hide the health and stamina bars.");                   
                llRegionSayTo(llGetOwner(), meterModeChannel, "healthbar,hide");                 
            }                                                
            if (message == "show bars")
            {
                llMessageLinked(LINK_ROOT, 0, "show bars", "");                   
                llOwnerSay("Setting hud to show the health and stamina bars.");                 
                llRegionSayTo(llGetOwner(), meterModeChannel, "healthbar,show");                 
            }                                                
        }         
    }

    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(menuListener);
           
    }      
    
}