integer itemChannel = -454545;
integer PLAYERHUDCHANNEL = -77770;
integer pouchListener;
integer pouchCheck = FALSE;
integer pouchIsWorn = FALSE;
float menuTimer = 30.0;
string recipeName;
key ToucherID;
string makingItem = "";
integer countdown = 60;

debug(string message)
{
    if (llGetObjectDesc() == "debug")
        llOwnerSay(message);   
}

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

integer rollDice(integer numDice) {
    integer results = 0;
    
    integer i = 0;
    while (i < numDice) {
        results += (integer)(llFrand(20.0) + 1);
        i++;    
    }
    return results;    
}

processXPError(integer errorCode, string fieldName)
{
    string errorMessage = "The item producer reports the following error when loading " + fieldName + " data: "; 
    errorMessage += llGetExperienceErrorMessage(errorCode);      
    llOwnerSay(errorMessage);
    //llOwnerSay((string)errorCode);
}

default
{
    state_entry()
    {   
        ToucherID = NULL_KEY;
        recipeName = "";
        makingItem = "";
        countdown = 60;
    }
       
    link_message(integer sender, integer num, string msg, key id)
    {
debug("msg: " + msg);
        if(num == 90060)
        {
            ToucherID = id;
            pouchListener = llListen(itemChannel, "", NULL_KEY, "");
            llRegionSayTo(ToucherID, itemChannel, "detectPouch," + (string)llGetKey());  
            llRegionSayTo(ToucherID, 0, "Detecting if pouch is worn..."); 
            llSetTimerEvent(10.0);            
        }        
        if (msg == "Make Butter")
        {
            if (pouchIsWorn)
            {
                makingItem = "butter";
                state getItems;
            }
            else
                llRegionSayTo(ToucherID, 0, "You need to wait for your pouch to be detected.");
        }
        else if (msg == "Make Cream")
        {
            if (pouchIsWorn)
            {                
                makingItem = "cream";
                state getItems;
            }
            else 
                llRegionSayTo(ToucherID, 0, "You need to wait for your pouch to be detected.");              
        } 
    }  

    listen( integer channel, string name, key id, string message )
    {   
        if (channel == itemChannel)
        {
//llOwnerSay("Message received: " + message);            
            llListenRemove(pouchListener);
            llSetTimerEvent(0.0);
            message = llToLower(message);
            list messageParms = llCSV2List(message);
            string action = llList2String(messageParms, 0);
            key fromKey = llList2Key(messageParms, 1);
            if (action == "pouchworn")
            {
                if (fromKey == ToucherID)
                {
                    pouchIsWorn = TRUE; 
                    llRegionSayTo(ToucherID, 0, "Pouch found... you may now make cream or butter.");   
                }               
            }
        }    
    }    
    
    timer()
    {

            llSetTimerEvent(0.0);
            llRegionSayTo(ToucherID, 0, "We were unable to find your pouch. Try again later.");
            llUnSit(ToucherID);
            //llMessageLinked(LINK_SET, 90000, "Stand", "");  
            state bounce;
    } 
}

state bounce
{
    state_entry()
    {
        state default;   
    }   
}

state getItems
{
    state_entry()
    {
        pouchListener = llListen(itemChannel, "", "", ""); 
        if (makingItem == "cream")       
            llRegionSayTo(ToucherID, itemChannel, "check,milk");
        else if (makingItem == "butter")
            llRegionSayTo(ToucherID, itemChannel, "check,cream");
        llSetTimerEvent(10.0);
    }  
    
    listen( integer channel, string name, key id, string message )
    {  
        if (channel == itemChannel)
        {
            llListenRemove(pouchListener);
            list params = llCSV2List(message);
            if (llGetListLength(params) == 2)
            {
                string foundItem = llList2String(params, 0);           
                integer foundQuantity = (integer)llList2String(params, 1);
                if (foundItem == "milk")
                {
                    if (foundQuantity >= 4)
                    {
                        llMessageLinked(LINK_SET, 90000, "Churn", "");   
                        llRegionSayTo(ToucherID, 0, "Attempting to make cream...");
                        llRegionSayTo(ToucherID, itemChannel, "fTakeItem,milk,4");
                        makingItem = "cream";
                        state churning;
                    } 
                    else
                    {
                        llRegionSayTo(ToucherID, 0, "Sorry, you do not have enought milk to make cream. Go get some more milk and come back.");
                        llUnSit(ToucherID);
                        state bounce; 
                    }
                }
                else if (foundItem == "cream")
                {
                    if (foundQuantity >= 4)
                    {
                        llMessageLinked(LINK_SET, 90000, "Churn", "");                      
                        llRegionSayTo(ToucherID, 0, "Attempting to make butter...");
                        llRegionSayTo(ToucherID, itemChannel, "fTakeItem,cream,4");
                        makingItem = "butter";
                        state churning;
                    }
                    else
                    {
                        llRegionSayTo(ToucherID, 0, "Sorry, you do not have enought cream to make butter. Go get some more milk and come back.");
                        llUnSit(ToucherID);
                        state bounce; 
                    }                    
                }        
            }
        }
        
    }
    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(pouchListener);
        llRegionSayTo(ToucherID, 0, "Error occurred. Timeout getting items from your pouch.");  
        //llUnSit(ToucherID);
        llMessageLinked(LINK_SET, 90000, "Stand", "");  
        state bounce; 
    }      
}

state churning
{
    
    state_entry()
    {
        llRegionSayTo(ToucherID, 0, "You will have to churn for 60 seconds.");
        llSetText("Churning " + makingItem + ". Time left: " + (string)countdown + " seconds.", <1.0,1.0,1.0>, 1.0);
        countdown = 60;
        llSetTimerEvent(1.0);
    } 
    
    timer()
    {
        llSetTimerEvent(0.0);
        countdown--;
        if (countdown > 0)
        {
            llSetText("Churning " + makingItem + ". Time left: " + (string)countdown + " seconds.", <1.0,1.0,1.0>, 1.0);  
            llSetTimerEvent(1.0);            
        }
        else
        {
            llRegionSayTo(ToucherID, itemChannel, "fGiveItem," + makingItem + ",1");
            if (makingItem = "cream")
                llRegionSayTo(ToucherID, itemChannel, "fGiveItem,buttermilk,3");
            llRegionSayTo(ToucherID, 0, "You successfully produced 1 unit of " + makingItem);
            llMessageLinked(LINK_SET, 90000, "Stand", "");  
            llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP,20");   
            llSetText("", <1.0,1.0,1.0>, 1.0);                     
            state bounce; 
        }      
    }
}
