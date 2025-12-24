integer itemChannel = -454545;
string itemName;
integer itemGivePerClick;
integer itemMaxClicks;
string itemDepletionAction;
float itemResetTime;
integer numberOfClicks = 0;
key toucher;
float sleepTime;
integer wasTouchedRecently = FALSE;
float clickDistance = 10.0;

string FormatDecimal(float number, integer precision)
{    
    float roundingValue = llPow(10, -precision)*0.5;
    float rounded;
    if (number < 0) rounded = number - roundingValue;
    else            rounded = number + roundingValue;
    
    if (precision < 1) // Rounding integer value
    {
        integer intRounding = (integer)llPow(10, -precision);
        rounded = (integer)rounded/intRounding*intRounding;
        precision = -1; // Don't truncate integer value
    }
    
    string strNumber = (string)rounded;
    return llGetSubString(strNumber, 0, llSubStringIndex(strNumber, ".") + precision);
}

    setup()
    {
        list parms = llCSV2List(llGetObjectDesc());
        integer numberOfParms = llGetListLength(parms);
        integer i = 0;
        itemName = "";
        itemGivePerClick = -1;
        if (numberOfParms == 6)
        {
            while (i < numberOfParms) 
            {
                if (i == 0) 
                {
                    itemName = llToLower(llList2String(parms, 0));                
                }
                else if (i == 1) 
                {
                    itemGivePerClick = (integer)llList2String(parms, 1);              
                }
                else if (i == 2) 
                {
                    itemMaxClicks = (integer)llList2String(parms, 2);                 
                }
                else if (i == 3) 
                { 
                    itemDepletionAction = llToLower(llList2String(parms, 3)); 
                    if (itemDepletionAction == "die")
                    {
                        i++;
                    } 
                    else if (itemDepletionAction == "reset" && numberOfParms == 4) 
                    {
                        itemResetTime = 5.0;  // set to default of 5 seconds if no time parm set for reset action 
                        llOwnerSay("No reset time in description, default set to 5.0 seconds.");  
                        i++; 
                    }             
                }
                else if (i == 4)
                {
                    if (i == 4) 
                    {
                        itemResetTime = (float)llList2String(parms, 4);   
                        if (itemResetTime < 1.0) 
                        {
                            itemResetTime = 1.0;
                            llOwnerSay("Reset time was less than 1.0 seconds in the description, setting to 1.0 seconds.");
                        }
                        if (itemResetTime > 3600.0) 
                        {
                            itemResetTime = 3600.0;    
                            llOwnerSay("Reset time was greater than 3600.0 seconds in the description, setting to 3600.0 seconds.");
                        }
                    }                       
                }
                else if (i == 5)
                {
                    sleepTime = (float)llList2String(parms, 5);
                    if (sleepTime < 1.0) 
                    {
                        sleepTime = 1.0;
                        llOwnerSay("Reset time was less than 1.0 seconds in the description, setting to 1.0 seconds.");
                    }
                    if (sleepTime > 30.0) 
                    {
                        sleepTime = 30.0;    
                        llOwnerSay("Reset time was greater than 30.0 seconds in the description, setting to 30.0 seconds.");
                    }                    
                }
                i++;    
            }
            if (itemName != "gold coin" && itemName != "silver coin" && itemName != "copper coin")
            {                       
                llSetLinkAlpha(LINK_THIS, 1.0, ALL_SIDES);
                //llOwnerSay("The " + itemName + " giver object is ready to give items.");
            }
            else 
            {
                llRegionSayTo(toucher, 0, "You may not use this script to give out currency.");   
            }
        }
        else 
        {
            llOwnerSay("Error: Wrong number of parameters in item description.");
            llOwnerSay("Parameters should be: name of item to give(single), number of items to give per click, number of clicks before item runs out, what to do when item runs out: reset (after some seconds) or die (permanently destroy the item giver - use with caution), number of seconds to wait when resetting before having the item reappear, as a decimal number - 2.5 means 2.5 seconds.");
            llOwnerSay("Separate each parameter with commas as follows: banana,1,7,reset,5.0)");
        }     
    }

        
default
{
    state_entry()  // runs first time or when reset
    {
        numberOfClicks = 0;
        wasTouchedRecently = FALSE;
        setup();
    }
    
    on_rez(integer start_param)
    {
        // Restarts the script every time the object is rezzed
        llResetScript(); 
    }

    touch_start(integer total_number)
    {
        setup();
        if (wasTouchedRecently == FALSE)
        {
            toucher = llDetectedKey(0);
            vector pos = llDetectedPos(0);
            float dist = llVecDist(pos, llGetPos() );
            if (dist <= clickDistance)
            {
//    llOwnerSay("Touch itemMaxClicks: " +(string)itemMaxClicks + ", itemGivePerClicks: " + (string)itemGivePerClick + ", numberOfClicks: " +(string)numberOfClicks);
               if (numberOfClicks < itemMaxClicks)
                {
                    llRegionSayTo(toucher, itemChannel, "fGiveItem," + itemName + "," + (string)itemGivePerClick); 
                    numberOfClicks++;
                    wasTouchedRecently = TRUE;
                    llSetTimerEvent(sleepTime);
                }
                if (numberOfClicks == itemMaxClicks) 
                {
                    numberOfClicks = 0;
                    state depleted;
                }            
            }
            else
            {   
                llRegionSayTo(toucher, 0, "You are too far to interact with the object. You need to be within " + (string)FormatDecimal(clickDistance,1) + " meters.");   
            }
        }
        else
            llRegionSayTo(toucher, 0, "Sorry, you cannot gather this item so rapidly. Please wait up to " +(string)FormatDecimal(sleepTime,1) + " seconds before trying again.");
    }
    
    timer()
    {
        llSetTimerEvent(0.0);
        wasTouchedRecently = FALSE; 
    }
}

state touched
{
    state_entry()  // runs first time or when reset
    {

    }    
}

state depleted
{
    state_entry()
    {
        // Clicks are depleted
        if (itemDepletionAction == "reset")
        {
            llSetLinkAlpha(LINK_THIS, 0.0, ALL_SIDES);
            llSleep(2.0);
            llSetTimerEvent(itemResetTime); 
        } 
        else if (itemDepletionAction == "die")
        {
            llDie();
        }         
    }
    
    timer()
    {
        state default;
    }    
}