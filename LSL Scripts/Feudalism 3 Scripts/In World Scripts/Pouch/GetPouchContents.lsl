key thisContainerID;

string itemToGive;

key trans = NULL_KEY;
string transReason = "none";

integer pouchChannel = -454545;
integer giveInputChannel = -454547;
integer giveToInputChannel = -454548;
integer giveQuantityChannel = -454550;

integer giveInputListener;
integer giveToListener;
integer giveQuantityListener;

// variables for sensor on give    
// range and arc for the sensor
float range = 5.0;
float arc = PI;
list avatarsKeys;
list avatarsNames;
list avatarsDisplayNames;
list avatarNamesTruncated;
list avatarDisplayNamesTruncated;

string giveToName;
string giveToKey;
integer currentQuantity;
integer amountToGive;

default
{
    state_entry()
    {
    }
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER) 
        {
        }        
    }    

    
    link_message(integer sender_num, integer num, string msg, key id)
    {
        if (msg == "give")
        {
            llSensor("","",AGENT,range,arc);          
        }
    }

   
    listen( integer channel, string name, key id, string message )
    {    
        if (channel == giveToInputChannel)
        {
            llListenRemove(giveToListener);
            integer idx = llListFindList(avatarDisplayNamesTruncated, [message]);
            if (idx != -1)
            {
                giveToName = llList2String(avatarsDisplayNames, idx);
                giveToKey = llList2Key(avatarsKeys, idx);
                llSetTimerEvent(30.0);                
                //llRegionSayTo(llGetOwner(), 0, "You want to give your item to " + giveToName);   
                giveInputListener = llListen(giveInputChannel, "", llGetOwner(), "");     
                llTextBox(llGetOwner(), "Enter the name of the item to give to " + giveToName, giveInputChannel);                     
            }
        } // end giveToInputChannel
        
        else if (channel == giveInputChannel)
        {
            llListenRemove(giveInputListener); 
            message = llToLower(message);  
            if (llGetSubString(message, -1, -1) == llUnescapeURL("%0A") ) message = llGetSubString(message, 0, -2);  
                       
            itemToGive = message;                      
            currentQuantity = (integer)llLinksetDataRead(itemToGive);
            if (currentQuantity > 0)
            {                 
                giveQuantityListener = llListen(giveQuantityChannel, "", llGetOwner(), "");      
                llSetTimerEvent(30.0);
                llTextBox(llGetOwner(), "You have " + (string)currentQuantity + " of item " + itemToGive + ".\nHow many of do you want to give to " + giveToName + "?", giveQuantityChannel);
            }
        } // end giveInputChannel
        
        else if (channel == giveQuantityChannel) 
        {
            if (llGetSubString(message, -1, -1) == llUnescapeURL("%0A") ) 
                message = llGetSubString(message, 0, -2);
                
            amountToGive = (integer)message;
            if (amountToGive < 1)
            {
                llRegionSayTo(llGetOwner(), 0, "Sorry, you cannot give less than 1. Try again.");         
            }
            else
            {
                if (amountToGive < currentQuantity) 
                {
                    currentQuantity -= amountToGive;
                    llLinksetDataWrite(itemToGive, (string)currentQuantity);     
                    llRegionSayTo(llGetOwner(), 0, "You gave " + (string)amountToGive + " of item " + itemToGive + " to " + giveToName + ".");
                    llRegionSayTo(llGetOwner(), 0, "You now have " + (string)currentQuantity + " left."); 
                } 
                else if (amountToGive == currentQuantity)
                {
                    currentQuantity = 0; 
                    llLinksetDataDelete(itemToGive);
                    llRegionSayTo(llGetOwner(), 0, "You gave " + (string)amountToGive + " of item " + itemToGive + " to " + giveToName + ".");
                    llRegionSayTo(llGetOwner(), 0, "You now have none left.");                     
                }   
                llRegionSayTo(giveToKey, pouchChannel, "fGiveItem," + itemToGive + "," + (string)amountToGive);              
            }              
        } // end giveQuantityChannel
    } // end listen
    
    sensor(integer total_number)
    {
        integer i;
        key tempId;
        avatarsKeys = [];
        avatarsNames = [];
        avatarsDisplayNames = [];
        avatarNamesTruncated = [];
        avatarDisplayNamesTruncated = [];
        i = 0;
        while ((i < total_number) && (i < 12))
        {
            tempId = llDetectedKey(i);
            avatarsKeys = avatarsKeys + tempId;
            avatarsNames = avatarsNames + llKey2Name(tempId);
            avatarsDisplayNames = avatarsDisplayNames + llGetDisplayName(tempId);            
            avatarNamesTruncated += llBase64ToString(llGetSubString(llStringToBase64(llKey2Name(tempId)), 0, 31));
            avatarDisplayNamesTruncated += llBase64ToString(llGetSubString(llStringToBase64(llGetDisplayName(tempId)), 0, 31));
            i = i+1;
        }  
        giveToListener = llListen(giveToInputChannel, "", llGetOwner(), "");      
        llSetTimerEvent(20.0); 
        llDialog(llGetOwner(),"Select a user to give items to: ",avatarDisplayNamesTruncated, giveToInputChannel);
    }    
    
    no_sensor()
    {
        llRegionSayTo(llGetOwner(), 0, "No avatars near enough to give items to.");
    }  
    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(giveInputListener);         
        llListenRemove(giveToListener);
        llListenRemove(giveQuantityListener);
        
    }      
}
