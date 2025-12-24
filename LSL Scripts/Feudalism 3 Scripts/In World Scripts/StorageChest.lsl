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

key ToucherID;                          // id of person touching object

// description loading values
string objectName;
integer maxQuantity;
string reloadable_string = "yes";
integer reloadable = TRUE;
string loaderRights = "owner";
string userRights = "owner";

// manager, and user management values
list loaders;
list users;
list bannedUsers;
integer managerListener;
integer MANAGERCHANNEL = 0;

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

displayInventory()
{
    integer i = 0;
    integer NUM_KEYS = llLinksetDataCountKeys();
    list keys = [];
    integer j = 0;
    string itemKey;
    string itemValue;
    string pouchID = llGetObjectDesc();
    if (pouchID != ""  && pouchID != "(Put Container ID Here)")
        llRegionSayTo(llGetOwner(), 0, "Container with ID " + pouchID + " contents\n==========================================");
    else
        llRegionSayTo(llGetOwner(), 0, "Container contents\n==========================================");
    while (i < NUM_KEYS)
    {
        keys = llLinksetDataListKeys(i, 10);
        while (j < 10)
        {
            itemKey = llList2String(keys, j);
            itemValue = llLinksetDataRead(itemKey);
            if (itemKey)
                llRegionSayTo(llGetOwner(), 0, itemKey + ": " + itemValue);
            j++;   
        }
        i += 10;
    }
    llRegionSayTo(llGetOwner(), 0, "End of Contents");
}

ownerChange()
{
    gChannel = getRandomChannel();
    giveInputChannel = getRandomChannel();
    quantityInputChannel = getRandomChannel();      
    pouchCheck = TRUE;
    pouchIsWorn = FALSE;        
    llRegionSayTo(llGetOwner(), 0, llGetObjectName() + " starting up.");
    loaders = [llToLower(llKey2Name(llGetOwner()))];
    users = [llToLower(llKey2Name(llGetOwner()))];
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
    string text = "\nThis is a reloadable, multi-item storage chest. \n\nPick an action:\n";
        
    llDialog(ToucherID,text,Buttons,gChannel);
}

addItem()
{  
//llOwnerSay("addItem()"); 
    string itemValue = llLinksetDataRead(itemToAdd);
    integer currentQuantity = 0;
    integer stringLength = llStringLength(itemToAdd) + llStringLength(quantityToAdd);
    stringLength *= 2;
    integer availableData = llLinksetDataAvailable();
    if (availableData - stringLength > 0)
    {
        if (itemValue != "")
        {
            // item exists in inventory, get the currentQuantity 
            currentQuantity = (integer)itemValue;
            if (currentQuantity >= 0)
                currentQuantity = (integer)itemValue + (integer)quantityToAdd;   
        }
        else
        {
            currentQuantity = (integer)quantityToAdd;
        }
        llRegionSayTo(llGetOwner(), 0, "You gave " + quantityToAdd + " of item: " + itemToAdd + " to container named: " + llGetObjectName() + " with container id of " + llGetObjectDesc() );   
        llLinksetDataWrite(itemToAdd, (string)currentQuantity); 
    }    
    else
        llRegionSayTo(llGetOwner(), 0, "Sorry, this storage container is full and you cannot add any more items. Please move some items to a storage box.");
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
        llOwnerSay("Free memory: " + (string)llGetFreeMemory());
        llOwnerSay("Linkset data available: " + (string)llLinksetDataAvailable());    
        gChannel = getRandomChannel();
        giveInputChannel = getRandomChannel();
        quantityInputChannel = getRandomChannel();      
        pouchCheck = TRUE;
        pouchIsWorn = FALSE;  
        objectName = llGetObjectName();
        reloadable_string = "yes";
        reloadable = TRUE;
        loaderRights = "owner";
        userRights = "owner";
//        llRegionSayTo(llGetOwner(), 0, objectName + " starting up.");              
        loaders = [llToLower(llKey2Name(llGetOwner()))];
        users = [llToLower(llKey2Name(llGetOwner()))];        
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
        if (ToucherID == llGetOwner())
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
                    gNames = ["Contents", "Load Item","Remove Item"];
                    gMenuPosition = 0;
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
                if (action == "load item")
                {
//llOwnerSay("Load item");
                    llRegionSayTo(llGetOwner(), 0, "Preparing chest to receive items. You have 60 seconds to move items from a pouch or another storage container into this container.");
                    state loadItem;
                }
                else if (action == "remove item")
                {
//llOwnerSay("Take item");
                    state removeItem;    
                }
                else if (action == "contents")
                {
                    displayInventory();   
                }               
            }
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
//llOwnerSay("state entry loadItem");                      
        receiveListener = llListen(containerChannel, "", "", "");                                         
        llSetTimerEvent(60.0);
        llRegionSayTo(llGetOwner(), itemChannel, "store," + (string)llGetKey());
    }  
    
    listen( integer channel, string name, key id, string message )
    {       
//llOwnerSay("Chest load item state, listen, channel: " + (string) channel + "name: " + name + ", id: " + (string) id + ", message " + message);  
        if (channel == containerChannel)
        {      
            llListenRemove(receiveListener);            
            llSetTimerEvent(0.0);            
            if (llGetOwnerKey(id) == llGetOwner())
            {
                message = llToLower(message); 
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
                    addItem();
                }
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

            llSetTimerEvent(30.0);                
            giveListener = llListen(giveInputChannel, "", ToucherID, "");     
            llTextBox(ToucherID, "Enter the name of the item to remove.", giveInputChannel); 
    }  

    listen( integer channel, string name, key id, string message )
    {       
        if (channel == giveInputChannel)
        {          
            message = llToLower(message);  
            // check if the entered name exists in the container's inventory         
            contentsName = message;
            string tempQuantity = llLinksetDataRead(contentsName);
            if (tempQuantity != "")
            {
                // it does               
                llListenRemove(giveListener);                 
                // check to see how many of the items are in the container's inventory
                contentsQuantity = (integer)llLinksetDataRead(contentsName);
                if (contentsQuantity > 0)
                {
                    // the container has at least one item  
                    llRegionSayTo(ToucherID, 0, "You want to remove " + contentsName + " from this container."); 
                    giveListener = llListen(quantityInputChannel, "", ToucherID, "");      
                    llSetTimerEvent(30.0);
                    llTextBox(ToucherID, "The container has " + (string)contentsQuantity + " of item " + contentsName + ".\nHow many do you want to remove?", quantityInputChannel);                            
                }
                else
                {   
                    llRegionSayTo(ToucherID, 0, "Strangely, the container has 0 of that item. Pick a different item.");                               
                }               

            }
            else
            {
                llRegionSayTo(ToucherID, 0, "The item you named is not found in the container. Try again.");   
            }


        }
        else if (channel == quantityInputChannel) 
        {
//llOwnerSay("message received on quantityInputChannel");               
            llListenRemove(quantityListener);               
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
                    llRegionSayTo(ToucherID, itemChannel, "fGiveItem," + contentsName + "," + (string)amountToGive);           
                    contentsQuantity -= amountToGive;
                    llRegionSayTo(ToucherID, 0, "You took " + (string)amountToGive + " of item " + contentsName + ".");
                    llLinksetDataWrite(contentsName, (string)contentsQuantity);                      
                    if (contentsQuantity <= 0)
                    {
                        llRegionSayTo(ToucherID, 0, "You took all of the remaining amount of item " + contentsName + ".");
                        llLinksetDataDelete(contentsName);
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

