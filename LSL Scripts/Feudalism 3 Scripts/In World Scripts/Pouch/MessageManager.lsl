integer DEBUG = FALSE;
integer pouchChannel = -454545;
integer PLAYERHUDCHANNEL = -77770;
string thisObject;

// declare placeholders for item name and value with default values
string itemToAdd = "";
string quantityToAdd = "";
string itemToRemove = "";
string quantityToRemove = "";
key sendTo;

string action = "";
integer pouchHandle;

debug(string message)
{
    if (DEBUG)
        llOwnerSay("Pouch. " + message);   
}

moveItem()
{
//llOwnerSay("Pouch moveItem()");
    llMessageLinked(LINK_THIS, 0, "move", sendTo);
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
        llRegionSayTo(llGetOwner(), 0, "You received " + quantityToAdd + " of item: " + itemToAdd);   
        llLinksetDataWrite(itemToAdd, (string)currentQuantity); 
    }    
    else
        llRegionSayTo(llGetOwner(), 0, "Sorry, your pouch is full and you cannot add any more items. Please move some items to a storage box.");
    pouchHandle = llListen(pouchChannel, "", NULL_KEY, "");
}

removeItem()
{
    itemToRemove = itemToAdd;
    quantityToRemove = quantityToAdd;
    string itemValue = llLinksetDataRead(itemToRemove);
    integer currentQuantity = 0;
    if (itemValue != "")
    {
        currentQuantity = (integer)itemValue;
        // item exists in inventory, get the currentQuantity
        if (currentQuantity > (integer)quantityToRemove)
        {
            currentQuantity -= (integer)quantityToRemove;
            llLinksetDataWrite(itemToRemove, (string)currentQuantity);
            llRegionSayTo(llGetOwner(), 0, "You removed " + quantityToRemove + " of item: " + itemToRemove + " from your inventory.");            
        }
        else if (currentQuantity == (integer)quantityToRemove)
        {
            llLinksetDataDelete(itemToRemove);   
            llRegionSayTo(llGetOwner(), 0, "You removed " + quantityToRemove + " of item: " + itemToRemove + " from your inventory.");            
        }
        else 
        {
            llRegionSayTo(llGetOwner(), 0, "Error: You do not have enough of the item named " + itemToRemove + " in your inventory.");
        }        
    } 
    pouchHandle = llListen(pouchChannel, "", NULL_KEY, "");
}

default
{
    state_entry()
    {
        llListenRemove(pouchHandle);
        thisObject = llGetObjectName();
        pouchHandle = llListen(pouchChannel, "", NULL_KEY, "");        
    }
    
    attach(key id)
    {
        if (id == NULL_KEY)
        {   
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterAction,pouch," + thisObject); 
            debug("pouch detaching");
        }  
        else
        {  
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "registerAction,pouch," + thisObject);         
            debug("pouch attaching.");   
            llRequestExperiencePermissions(llGetOwner(), "");
        } 
    }  

    changed(integer change)
    {
        if (change & CHANGED_OWNER) 
        {
            llListenRemove(pouchHandle);
            pouchHandle = llListen(pouchChannel, "", NULL_KEY, "");                        
        }        
    }

    touch_start(integer total_number)
    {
//        llSay(0, "Touched.");
    }
    
    listen( integer channel, string name, key id, string message )
    { 
        if (channel == pouchChannel)
        {  
            llListenRemove(pouchHandle);
//llOwnerSay("Pouch: listen, message: " + message + ", ID: " + (string)id + ", name: " +name);   
            message = llToLower(message); 
//llOwnerSay("Pouch: listen, message after to lower: " + message);
            list messageParms = llCSV2List(message);
            integer numberOfParms = llGetListLength(messageParms);
            if (numberOfParms > 0)
                action = llList2String(messageParms, 0);
            if (numberOfParms > 1 && action != "store")
                itemToAdd = llToLower(llList2String(messageParms, 1));
            if (numberOfParms > 2)
                quantityToAdd = llList2String(messageParms, 2);  
            if (action == "detectpouch")
                llRegionSayTo(llList2Key(messageParms, 1), pouchChannel, "pouchWorn," + (string)llGetOwner() + "," + "");
            else if (action == "fgiveitem")
                addItem();
            else if (action == "ftakeitem")
            {
                removeItem(); 
                llRegionSayTo(id, pouchChannel, "fgiveitem," + itemToAdd + "," + (string)quantityToAdd);
            }
            else if (action == "store" && numberOfParms > 1)
            {             
                sendTo = llList2Key(messageParms, 1); 
                moveItem();      
            }
            else if (action == "check")
            {
                if (itemToAdd != "")
                {
//llOwnerSay("Check for " + itemToAdd);                    
                    integer quantityFound = 0;
                    string tempQ = llLinksetDataRead(itemToAdd);
                    if (tempQ != "")
                       quantityFound = (integer)tempQ;
                    if (quantityFound < 0)
                        quantityFound = 0;                      
//llOwnerSay("Quantify of " + itemToAdd + " found: " + (string)quantityFound);                    
                        llRegionSayTo(id, pouchChannel, itemToAdd + "," + (string)quantityFound);    
                }            
            }
            else if (action == "contents")
                llMessageLinked(LINK_THIS, 0, "contents", "");        
            pouchHandle = llListen(pouchChannel, "", NULL_KEY, "");
        }
    } 
       
    timer()
    {
            llListenRemove(pouchHandle);
            pouchHandle = llListen(pouchChannel, "", NULL_KEY, "");   
    }      
}
