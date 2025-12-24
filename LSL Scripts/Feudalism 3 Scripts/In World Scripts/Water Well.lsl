integer waterChannel = -595225;
integer listenHandle;
integer menuChannel;
float menuTimer = 60.0;
float waitTimer = 10.0;
key ToucherID;
key recipientKey; 
integer quantityToSend = 0;
string itemToSend = "water";

list gNames = ["Get Water"];  // Your list of potential menu choices
integer gMenuPosition;  // Index number of the first button on the current page
integer gLsn;   // Dialog Listen Handle

debug(string message)
{
    if (llGetObjectDesc() == "debug")
        llOwnerSay(message);   
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
debug("Well state default starting.");  
        menuChannel = (integer)llFrand(-10000);           
        quantityToSend = 0;
        recipientKey = NULL_KEY;   
        llSetText("Ready. You may click to get water.", <0,1,0>,1.0);          
    }

    touch_start(integer total_number)
    {
        vector pos = llDetectedPos(0);
        float dist = llVecDist(pos, llGetPos() );
        recipientKey = llDetectedKey(0);        
        if (dist <= 5.0)
        {
debug("Well touched.");  
            ToucherID = llDetectedKey(0);
            state touched;
        }
        else
        {
            llRegionSayTo(recipientKey, 0, "You are too far to interact with the object. You need to be within 5 meters."); 
            recipientKey = NULL_KEY;  
        }        
    }
}

state touched
{
    state_entry()
    {
debug("State touched start.");
        llSetText(llGetDisplayName(ToucherID) + " is using the well. Please wait.", <1,0,0>,1.0);
        llSetTimerEvent(menuTimer);
        llListenRemove(gLsn);
        gMenuPosition = 0;                  
        Menu();
    }
    
    touch_start(integer total_number)
    {
        debug("Well touched.");
        llRegionSayTo(llDetectedKey(0), 0, "Sorry, the well is busy. Try again. You may have to wait up to 30 seconds.");
    }    
    
    listen(integer channel, string name, key id, string message)
    {
        debug("Well Listen. message=" + message + ", id:" + (string)id + ", name: " + name);        
        if (channel == waterChannel)
        {
            llListenRemove(listenHandle);
            list parms = llCSV2List(message);
            string action = llList2String(parms,0);
            string drinkName = llList2String(parms,1);
            integer tempAmount = llList2Integer(parms,2);
            if (drinkName == "water" || drinkName == "Water" || drinkName == "None" || drinkName == "none")
            {
                if (tempAmount > 0)
                {
                    quantityToSend = tempAmount;
                    itemToSend = "water";    
                    //llRegionSayTo(recipientKey, waterChannel, "bGive," + itemToSend + "," + (string)quantityToSend);  
                    llRegionSayTo(id, waterChannel, "bGive," + itemToSend + "," + (string)quantityToSend);  

debug("well listen. quantity: " + (string)quantityToSend);                 
                }
                else
                {
                    llRegionSayTo(recipientKey, 0, "Sorry, it seems your container is full and you cannot get any more water.");
                }
            }
        }
        else if (channel == menuChannel)
        {
            if (message == "Get Water")
            {    
            // check if the user has a bucket
                listenHandle = llListen(waterChannel, "", "", "");        
                llRegionSayTo(recipientKey, waterChannel, "check");     
                llSetTimerEvent(waitTimer);
            }
        }    
    }
    
    timer()
    {
        llListenRemove(gLsn);
        llSetTimerEvent(0.0);       
        state default;   
    }    
}
