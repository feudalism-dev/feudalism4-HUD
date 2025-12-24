integer DEBUG = FALSE;
// pouch validation and usage values
integer NPC_CHANNEL = -453213492;       // the channel for the npc .. change this for each npc you use
integer PLAYERHUDCHANNEL = -77770;      // the main feudalism player hud listen channel
integer itemChannel = -454545;          // the channel the pouch listens on
integer containerChannel = -454555;
integer npcListener;                    // listener that the npc uses
integer pouchListener;                  // listener for responses from pouch for detection test
integer pouchCheck;                     // flag if a pouch detection test is in progress
integer pouchIsWorn;                    // flag if pouch is found and is on
float menuTimer = 60.0;                 // timer for menu timeouts
string itemName;                        // a specific item name
integer itemValue;                      // the value of the item named with item name
list itemNames;                         // the list of names of items in item inventory
list itemValues;                        // the list of values of items in the item inventory
list tempKeys;                          // temporary holder for the item keys prior to loading into the itemKeys list
list tempValues;                        // temporary holder for the item values prior to loading into the itemValues list
integer pouchTimerCounter;              // varialble to count how many times the timer has fired... errors out after 5 times
integer touched = FALSE;
string menuText = "";
key ToucherID;                          // id of person touching object
string contentItem;
integer maxContents = 100;
list amountsButtons = [];
// description loading values
string objectName;
integer maxQuantity;
string reloadable_string = "yes";
integer reloadable = TRUE;
string loaderRights = "owner";
string userRights = "owner";
integer level = 0; // Meter level (0 = empty, 10 = full)
string meterChars = "░▒▓█"; // Characters for different fill levels
string securityMode = "all";
// menu manager values
list gNames;  // Your list of potential menu choices
integer gMenuPosition;  // Index number of the first button on the current page
integer gLsn;   // Dialog Listen Handle
integer gChannel;

string action;
integer giveListener;
integer receiveListener;
integer quantityListener;
integer giveInputChannel;
integer quantityInputChannel;
string itemToGive;
integer currentQuantity;
integer amountToGive;
string itemToAdd;
string quantityToAdd;
list integers = ["0","1","2","3","4","5","6","7","8","9"];
integer Flag;


// content related values

string contentsName;
list contentsNames;
integer contentsQuantity;
list contentsQuantities;
integer isEmpty = TRUE;

// functions

debug(string message)
{
    if (DEBUG)
        llOwnerSay("RIG: " + message);   
}

string GetMeterString(integer lvl)
{
    integer totalSegments = 10;
    integer filled = (lvl * totalSegments) / 10;
    string meter = "";
    integer i;
    
    for (i = 0; i < totalSegments; i++)
    {
        if (i < filled)
            meter += llGetSubString(meterChars, 3, 3); // Full block
        else
            meter += llGetSubString(meterChars, 0, 0); // Empty block
    }
    
    return meter;
}

// Update hover text
updateMeter()
{
    debug("Update meter.");
    //level = (level + 1) % 11; // Cycle from 0 to 10
    integer currentQuantity = (integer)llLinksetDataRead(llToLower(contentItem));
    debug("CurrentQuantity: " + (string)currentQuantity);
    debug("MaxContents: " + (string)maxContents);
    if (currentQuantity > 0)
        llMessageLinked(LINK_SET, 0, "show", "");
    else
        llMessageLinked(LINK_SET, 0, "hide", "");
    level = llRound((currentQuantity * 10.0) / maxContents);
    //level = (currentQuantity/maxContents)*10;
    debug("Level: " + (string)level);
    llSetText(contentItem +": [" + GetMeterString(level) + "]\nQuantity: " + (string)currentQuantity + "/" + (string)maxContents, <0,1,0>, 1.0);
}

displayInventory()
{
    integer i = 0;
    integer NUM_KEYS = llLinksetDataCountKeys();
    list keys = [];
    integer j = 0;
    string itemKey;
    string itemValue;
    string pouchID = llGetObjectDesc();
//    if (pouchID != ""  && pouchID != "(Put Container ID Here)")
//        llRegionSayTo(llGetOwner(), 0, "Container with ID " + pouchID + " contents\n==========================================");
//    else
        llRegionSayTo(ToucherID, 0, "Container contents\n==========================================");
    while (i < NUM_KEYS)
    {
        keys = llLinksetDataListKeys(i, 10);
        while (j < 10)
        {
            itemKey = llList2String(keys, j);
            itemValue = llLinksetDataRead(itemKey);
            if (itemKey)
                llRegionSayTo(ToucherID, 0, itemKey + ": " + itemValue + " of " + (string)maxContents);
            j++;   
        }
        i += 10;
    }
    llRegionSayTo(ToucherID, 0, "End of Contents");
}

ownerChange()
{
    gChannel = getRandomChannel();
    giveInputChannel = getRandomChannel();
    quantityInputChannel = getRandomChannel();      
    pouchCheck = TRUE;
    pouchIsWorn = FALSE;        
    llRegionSayTo(llGetOwner(), 0, llGetObjectName() + " starting up.");
    ToucherID = NULL_KEY;        
 } 

    
integer getRandomChannel()
{
    float seed = 999999.0;
    float random = 0.0;
    while (random < 100)
    {
        random = llFrand(seed +1);
    }
    integer result = (integer)random;
    result *= -1;
//llOwnerSay("random channel number: " + (string)result);
    return result;
}

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
    gLsn = llListen(gChannel,"",ToucherID,"");    
    llSetTimerEvent(20.0);
    llDialog(ToucherID,menuText,Buttons,gChannel);
}

addItem()
{  
//llOwnerSay("addItem()"); 
    debug("AddItem. BEFORE CurrentQuantity = " +(string)currentQuantity); 
    itemToAdd = llToLower(contentItem);
    currentQuantity = (integer)llLinksetDataRead(itemToAdd);
    currentQuantity += amountToGive;
    if (currentQuantity > maxContents)
    {
        currentQuantity = maxContents;
        llWhisper(0, "The bucket is full. Excess milk spilled on the ground.");
    }
    llLinksetDataWrite(itemToAdd, (string)currentQuantity); 
    llWhisper(0, "Milk squirted into the bucket.");   
    debug("AddItem. AFTER CurrentQuantity = " +(string)currentQuantity);    
    updateMeter();    
}




//////////////////////////////////////////////////////////////////////////////
//
//          Basic Detect Pouch and load Inventory script v1.0
//
//          12/31/2016 Bandor Beningborough
//
//          This script is the foundation for any Feudalism script that needs
//          to check if a user is wearing a pouch and load their inventory
//          items.
//
//          Use it then modify it with the specifics for your new object
//
//          Design note: due to the limited number of key-value pairs in the 
//          experience database, if each inventory item had its own key-value
//          pair, this system would use far too many pairs. There would be one
//          for every item times the number of players. With 200 items and 500
//          players that would be 100,000 keys. So, instead, we combine all
//          of the inventory items into 2 matched lists. One for the name of the
//          item and one for the quantity the user has of the item. We ensure
//          that both lists are updated so that indexes match between them
//
//////////////////////////////////////////////////////////////////////////////

default
{
    state_entry()
    {     
        llMessageLinked(LINK_SET, 0, "hide", "");    
        llOwnerSay("Free memory: " + (string)llGetFreeMemory());
        llOwnerSay("Linkset data available: " + (string)llLinksetDataAvailable());  
        list params = llCSV2List(llGetObjectDesc());
        if (llGetListLength(params) == 2)
        {
                      
            gChannel = getRandomChannel();
            giveInputChannel = getRandomChannel();
            quantityInputChannel = getRandomChannel();      
            pouchCheck = TRUE;
            pouchIsWorn = FALSE;  
            objectName = llGetObjectName();
            reloadable_string = "yes";
            reloadable = TRUE;
            contentItem = llList2String(params, 0);
            securityMode = llList2String(params, 1);
//        llRegionSayTo(llGetOwner(), 0, objectName + " starting up.");               
            debug("starting... updateMeter");
            updateMeter();     
        }
        else
        {
            llOwnerSay( "Error: Description does not contain 2 fields. Field1: name for what this container holds (ie Corn Seeds or Wheat Berries). Field 2: security mode (all, group or owner.");
            return; 
        }         
    } 

    on_rez(integer start_param)
    {
        llResetScript();
    }   
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER) 
        {
            ownerChange();
        }        
    }  
    
    touch_start(integer total_number)
    {
        ToucherID = llDetectedKey(0);
        debug("Touched.");     
        if (securityMode == "all" || (securityMode == "group" && llSameGroup(ToucherID)) || (securityMode == "owner" && ToucherID == llGetOwner()))
        {                 
            vector pos = llDetectedPos(0);
            float dist = llVecDist(pos, llGetPos() );        
            if (dist <= 5.0)
            {                    
                pouchListener = llListen(itemChannel, "", "", "");
                pouchCheck = TRUE;
                pouchIsWorn = FALSE;
                llRegionSayTo(ToucherID, itemChannel, "detectPouch," + (string)llGetKey());  
                //llRegionSayTo(ToucherID, 0, "Detecting if pouch is worn, up to 5 times... ");
                pouchTimerCounter = 0; 
                llSetTimerEvent(1.0);   
            }  
            else
            {
                llRegionSayTo(ToucherID, 0, "You're too far away to try to operate the " + llGetObjectName() + "."); 
                llListenRemove(npcListener);             
            } 
        }
        else    
        {
            llRegionSayTo(ToucherID, 0, "You do not have permission to use this object. SecurityMode: " + securityMode);
            return; 
        }       
    }
    
    listen( integer channel, string name, key id, string message )
    {
        if (channel == itemChannel)
        {          
//llOwnerSay("Message from pouch received.");        
            llListenRemove(pouchListener);
            message = llToLower(message);
            list messageParms = llCSV2List(message);
            string action = llList2String(messageParms, 0);
            key fromKey = llList2Key(messageParms, 1);
            if (action == "pouchworn")
            {
                if (fromKey == ToucherID)
                {
                    //llRegionSayTo(ToucherID, 0, "Pouch is found.");                    
                    pouchIsWorn = TRUE; 
                    pouchCheck = FALSE;
                    llSetTimerEvent(0.0);
                    llRegionSayTo(ToucherID, 0, "This container only accepts " + llToLower(contentItem)); 
                    menuText = "\nThis container only accepts " + llToLower(contentItem) + ". \n\nWhat would you like to do?:\n";
                    gNames = ["Contents", "Take Item"];
                    gMenuPosition = 0;
                    Menu();                       
                }               
            }
            else
            {
                list params = llCSV2List(message);
                debug("Got response from pouch to check message: " + message);
                if (llGetListLength(params) == 2)
                {
                    debug("Found item: " + itemToAdd);
                    integer foundQuantity = (integer)llList2String(params,1);
                    debug("Found quantity: " + (string)foundQuantity);  
                    amountsButtons = [];
                    gNames = [];
                    if (foundQuantity >= 1)
                        amountsButtons += "1";
                    if (foundQuantity >= 2)
                        amountsButtons += "2";
                    if (foundQuantity >= 3)
                        amountsButtons += "3";
                    if (foundQuantity >= 5)
                        amountsButtons += "5";
                    if (foundQuantity >= 10)
                        amountsButtons += "10";
                    if (foundQuantity >= 20)
                        amountsButtons +="20";
                    if (foundQuantity >= 50)
                        amountsButtons += "50";
                    if (foundQuantity >= 100)
                        amountsButtons += "100";
                    amountsButtons += "All";  
                    gNames = amountsButtons;  
                    gMenuPosition = 0;            
                    menuText = "\nYou have " + (string)foundQuantity + " of " + itemToAdd + ". How many would you like to add?:\n";     
                    Menu();
                }                              
            }            
        }
        // test for channel 
        if (channel == gChannel)
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
                action = message;
                if (action == "add item")
                {
//llOwnerSay("Add Item");
                    //llRegionSayTo(ToucherID, 0, "Preparing container to receive items. You have 60 seconds to move items from a pouch or another storage container into this container.");
                    //state loadItem;
                    pouchListener = llListen(itemChannel, "", "", "");                    
                    llSetTimerEvent(10.0);                  
                    itemToAdd = llToLower(contentItem);   
                    llRegionSayTo(ToucherID, itemChannel, "check," + itemToAdd);                   
                }
                else if (action == "take item")
                {
//llOwnerSay("Take item");
                    state removeItem;    
                }
                else if (action == "contents")
                {
                    displayInventory();   
                } 
                else if (llListFindList(amountsButtons, [message]) != -1)            
                {
                    debug("Got amount to add: " + message);
                    amountToGive = (integer)message;
                    llRegionSayTo(ToucherID, itemChannel, "fTakeItem," + itemToAdd + "," + message);                    
                    addItem();  
                    state default;              
                }                              
            }
        }
    }   
    
    link_message(integer sender_num, integer num, string msg, key id)
    { 
        if (msg == "addMilk")
        {
            itemToAdd = "milk";
            amountToGive = num;
            addItem();   
        }
    }
    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(gLsn);
//llOwnerSay("Timer. PouchIsWorn= " + (string)pouchIsWorn);
//llOwnerSay("PouchCheck: " + (string)pouchCheck);
//llOwnerSay("PouchTimerCounter: " + (string)pouchTimerCounter);        
        llSetTimerEvent(0.0);
        if (pouchIsWorn != TRUE)
        {
            //llRegionSayTo(ToucherID, 0, "Detecting your Fedualism Pouch...");
            if (pouchTimerCounter < 4)
            {
                if (pouchCheck)
                {
                    llSetTimerEvent(1.0);
                }
            }
            else
            {
                llRegionSayTo(ToucherID, 0, "Your pouch is not being worn. You must wear a Feudalism pouch before you can use this object.");
                pouchCheck = FALSE;
                llListenRemove(pouchListener);                
            }
            pouchTimerCounter++;
        } 
    }   
}

state loadItem
{
// used to load items into the storage chest. Using a state to ensure nothing else can happen and TOUCHING only allowed in the default state.
    state_entry()
    {
        debug("State LoadItem");
//llOwnerSay("state entry loadItem");                      
        receiveListener = llListen(containerChannel, "", "", "");                                         
        llSetTimerEvent(60.0);
        // send store message to pouch, which then handles asking you which item to add and how many
        llRegionSayTo(ToucherID, itemChannel, "store," + (string)llGetKey());
    }  
    
    listen( integer channel, string name, key id, string message )
    {       
//llOwnerSay("Chest load item state, listen, channel: " + (string) channel + "name: " + name + ", id: " + (string) id + ", message " + message);  
        if (channel == containerChannel)
        {      
            llListenRemove(receiveListener);            
            llSetTimerEvent(0.0);            
            message = llToLower(message); 
            debug("Listen. message: " + message);
            list messageParms = llCSV2List(message);
            integer numberOfParms = llGetListLength(messageParms);
            if (numberOfParms > 0)
                action = llList2String(messageParms, 0);
            if (numberOfParms > 1)
                itemToAdd = llToLower(llList2String(messageParms, 1));
            if (numberOfParms > 2)
                quantityToAdd = llList2String(messageParms, 2);  
            if (action == "cgiveitem")
            {
                // got a give message
                addItem();
            }        
        }
        state default;  
    }    
    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(giveListener);        
        llListenRemove(quantityListener); 
        state default;       
    }       
}

state removeItem
{
// used to remove items from the storage chest. Using a state to ensure nothing else can happen and TOUCHING only allowed in the default state.
    state_entry()
    {
//llOwnerSay("state entry takeItem"); 
        contentsQuantity = (integer)llLinksetDataRead(llToLower(contentItem));
        if (contentsQuantity > 0)
        {
            // the container has at least one item  
            llRegionSayTo(ToucherID, 0, "You want to remove milk from this container."); 
            giveListener = llListen(quantityInputChannel, "", ToucherID, "");      
            llSetTimerEvent(30.0);
            llTextBox(ToucherID, "The container has " + (string)contentsQuantity + " of item milk.\nHow many do you want to remove?", quantityInputChannel);                            
        }
        else
        {   
            llRegionSayTo(ToucherID, 0, "Strangely, the container has 0 of that item. Pick a different item.");                               
        } 
    }  

    listen( integer channel, string name, key id, string message )
    {       
        if (channel == quantityInputChannel) 
        {
//llOwnerSay("message received on quantityInputChannel");               
            llListenRemove(quantityListener);   
            contentsName = "milk";   
            contentsQuantity = (integer)llLinksetDataRead(llToLower(contentItem));   
            debug("Remove item. contentsQuantity = " + (string)contentsQuantity);      
            amountToGive = (integer)message;
            if (amountToGive <= 0)
            {
                // IS NOT A POSITIVE INTEGER
                llRegionSayTo(ToucherID, 0, "Sorry, you did not enter a positive amount to remove. Try again.");
            }            
            else
            {             
                if (amountToGive <= contentsQuantity) 
                {
//llOwnerSay("got here");                    
                    llRegionSayTo(ToucherID, itemChannel, "fGiveItem,milk," + (string)amountToGive);           
                    contentsQuantity -= amountToGive;
                    llRegionSayTo(ToucherID, 0, "You took " + (string)amountToGive + " of milk.");
                    llLinksetDataWrite("milk", (string)contentsQuantity);                      
                    if (contentsQuantity <= 0)
                    {
                        llRegionSayTo(ToucherID, 0, "You took all of the remaining amount of item milk.");
                        llLinksetDataDelete("milk");
                    }
                    else 
                    {
                        llRegionSayTo(ToucherID, 0, "The " + objectName + " still has " + (string)contentsQuantity + " left.");
                    }  
                }
                else 
                {
                    llRegionSayTo(ToucherID, 0, "The " + objectName + " doesn't have that much. Try again.");
                }    
                    
            }
            updateMeter();
            state default;
        }
    }    
    
    timer()
    {
        llSetTimerEvent(0.0);      
        llListenRemove(quantityListener);     
        state default;   
    }       
}

