// variables for the menu system
//list gNames = ["Contents","Drop","Use","Give","Water","Save","Load"];  // Your list of potential menu choices
integer menuChannel = -123456;
list gNames = ["Contents","Drop","Eat","Give"];  // Your list of potential menu choices
integer gMenuPosition;  // Index number of the first button on the current page
integer gLsn;   // Dialog Listen Handle

integer dropInputChannel = -454546;
integer dropListener;
integer eatListener;
integer pouchListener;                  // listener for responses from pouch for detection test

integer itemChannel = -454545;
integer pouchChannel = -777786;
integer eatInputChannel = -454549;
integer giveInputChannel = -454547;
integer giveToInputChannel = -454548;

key toucherID;

string itemToDrop;
string itemToEat;

Menu()
{
    integer Last;
    list Buttons;
    integer All = llGetListLength(gNames);
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
    llSetTimerEvent(20.0);
    llDialog(llGetOwner()," \n",Buttons,menuChannel);
}


default
{
    state_entry()
    {
        llRegionSayTo(llGetOwner(), 0, "Detecting if another pouch is being worn.");        
        pouchListener = llListen(itemChannel, "", "", "");
        llRegionSayTo(llGetOwner(), itemChannel, "detectPouch," + (string)llGetKey());        
        llMessageLinked(LINK_THIS, 0, "contents", "");  
        llRegionSayTo(llGetOwner(), 0, "Feudalism Pouch tested and verified. "+ (string)llLinksetDataAvailable() + " bytes of LSD memory available. "+ (string)llGetFreeMemory() + " bytes free memory.");
    }
    
    on_rez(integer start_param)
    {
        llRegionSayTo(llGetOwner(), 0, "Detecting if another pouch is being worn.");        
        pouchListener = llListen(itemChannel, "", "", "");
        llRegionSayTo(llGetOwner(), itemChannel, "detectPouch," + (string)llGetKey());     
    }
    
    attach(key id)
    {
        if (id)     // is a valid key and not NULL_KEY
        {
        llMessageLinked(LINK_THIS, 0, "contents", ""); 
        llRegionSayTo(llGetOwner(), 0, "Feudalism Pouch tested and verified. No other pouch is being worn. "+ (string)llLinksetDataAvailable() + " bytes of LSD memory available. "+ (string)llGetFreeMemory() + " bytes free memory.");  
        }
    }    
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER) 
        {
            llMessageLinked(LINK_THIS, 0, "contents", "");
            llRegionSayTo(llGetOwner(), 0, "Feudalism Pouch tested and verified. "+ (string)llLinksetDataAvailable() + " bytes of LSD memory available. "+ (string)llGetFreeMemory() + " bytes free memory.");
        }        
    }    

    touch_start(integer total_number)
    {
//llOwnerSay("Touched.");        
        toucherID = llDetectedKey(0);
        if (toucherID == llGetOwner())
        {
            
            // ONLY DO THIS IF THE OWNER TOUCHES THE POUCH
            //        llSay(0, "The container only collects things at this time.");   
            // Menu code
            llListenRemove(gLsn);
            gMenuPosition = 0;
            Menu();
            // end of menu code  
        }   
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV      
        llRegionSayTo(llGetOwner(), 0, "Detaching pouch."); 
        llDetachFromAvatar();
    }    

    listen( integer channel, string name, key id, string message )
    {       
        // test for channel 
        if (channel == menuChannel)
        {
            message = llToLower(message); 
            // menu code
            llListenRemove(gLsn);
            llSetTimerEvent(0.0);
            if (~llSubStringIndex(message,"---->"))
            {
                gMenuPosition += 10;
                Menu();
            }
            else if (~llSubStringIndex(message,"<----"))
            {
                gMenuPosition -= 10;
                Menu();
            }
            else  
            // PROCESS MENU MESSAGES HERE
            {
                if (message == "contents")                 
                    llMessageLinked(LINK_THIS, 0, "contents", "");
                else if (message == "drop")
                {
                    dropListener = llListen(dropInputChannel, "", toucherID, "");     
                    llTextBox(toucherID, "Enter the name of the item to drop, spelled and capitalized exactly as shown in the contents listing.", dropInputChannel);   
                } 
                else if (message == "eat")
                {
                    eatListener = llListen(eatInputChannel, "", toucherID, "");     
                    llTextBox(toucherID, "Enter the name of the item to use, spelled and capitalized exactly as shown in the contents listing.", eatInputChannel);                  
                }
                else if (message == "give")
                    llMessageLinked(LINK_THIS, 0, "give", "");   
//                else if (message == "move")
//                    llMessageLinked(LINK_THIS, 0, "move", ""); 
//                else if (message == "texture")
//                    llMessageLinked(LINK_THIS, -1864098, "Texture", llGetOwner());                                                                                  
            }
        }
        else if (channel == dropInputChannel) // this is input from the DROP text box
        {
            llListenRemove(dropListener);
            message = llToLower(message);
            if (llGetSubString(message, -1, -1) == llUnescapeURL("%0A") ) message = llGetSubString(message, 0, -2);

            if (message == "yes")
            {
                if (itemToDrop != "")
                {
                    llMessageLinked(LINK_THIS, 0, "drop", itemToDrop);
                    itemToDrop = "";             
                }
            }
            else if (message == "no")
            {
                llRegionSayTo(llGetOwner(), 0, "You chose not to drop the item.");
            }
            else if (message != "")
            {
                // if not yes or no, then it must be the item to drop               
                itemToDrop = message;
                dropListener = llListen(dropInputChannel, "", toucherID, "");      
                llSetTimerEvent(20.0);
                list Buttons = ["Yes","No"];
                llDialog(llGetOwner(),"Dropping this item will set its quantity to 0. Are you sure?",Buttons, dropInputChannel);
            }          
        }
        else if (channel == eatInputChannel) // this is input from the DROP text box
        {
            llListenRemove(eatListener);
            message = llToLower(message); 
            if (llGetSubString(message, -1, -1) == llUnescapeURL("%0A") ) message = llGetSubString(message, 0, -2);

            if (message == "yes")
                llMessageLinked(LINK_THIS, 0, "eat", itemToEat);
            else if (message == "no")
                llRegionSayTo(llGetOwner(), 0, "You chose not to eat the item.");
            else if (message != "")
            {
                // item found in list                
                itemToEat = message;                
                eatListener = llListen(eatInputChannel, "", toucherID, "");      
                llSetTimerEvent(20.0);
                list Buttons = ["Yes","No"];
                llDialog(llGetOwner(),"Eating this item will remove one item from your inventory. Are you sure?",Buttons, eatInputChannel);  
            }                       
        }
        else if (channel == itemChannel)
        {          
//llOwnerSay("Pouch Detector: Message from pouch received.");        
            llListenRemove(pouchListener);
            message = llToLower(message);
            list messageParms = llCSV2List(message);
            string action = llList2String(messageParms, 0);
            key fromKey = llList2Key(messageParms, 1);
            if (action == "pouchworn")
            {
                if (fromKey == llGetOwner())
                {
                    llRegionSayTo(llGetOwner(), 0, "Another pouch was detected. You may only wear one pouch at a time. Detaching this pouch."); 
                    llRequestExperiencePermissions(llGetOwner(), "");                     
                }               
            }
        }                
    }    
}
