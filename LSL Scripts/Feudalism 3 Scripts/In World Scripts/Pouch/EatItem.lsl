integer PLAYERHUDCHANNEL = -77770;

string itemType;
integer itemHealthMod;
integer itemStaminaMod;
integer foundConsumable;

string itemsKVKey;
string itemsKVValue;
key thisContainerID;

integer maxItemCount = 100;

key trans = NULL_KEY;
key transGetConsumable = NULL_KEY;
string transReason = "none";

list tempKeys;
list tempValues;

string itemToEat;


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
        if (msg == "eat")
        {
            itemToEat = (string)id;
            transGetConsumable = llReadKeyValue("consumableItem_" + itemToEat);       
        }
    }

    dataserver(key t, string value)
    { 
        if (t == transGetConsumable)
        {
            foundConsumable = FALSE;
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                string itemDesc = llGetSubString(value, 2, -1);
                list itemParms = llCSV2List(itemDesc);
                itemHealthMod = llList2Integer(itemParms, 3);
                itemStaminaMod = llList2Integer(itemParms, 4);
                foundConsumable = TRUE;
                integer currentQuantity = (integer)llLinksetDataRead(itemToEat);
                if (currentQuantity > 0)
                {
                    currentQuantity--;
                    llLinksetDataWrite(itemToEat, (string)currentQuantity);
                    llRegionSayTo(llGetOwner(), 0, "You consume one " + itemToEat + " from your pouch.");   
                }
                else
                {
                    llRegionSayTo(llGetOwner(), 0, "You do not have any items named " + itemToEat + " in your inventory to consume one.");                                        
                }
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llRegionSayTo(llGetOwner(), 0, "The item you used is not registered as consumable in the Feudalism database and so nothing happens. To have the item registered, talk to a Feudalism RPG admin.");
                foundConsumable = FALSE;
            }
            if (foundConsumable)
            {
                if (itemHealthMod != 0)            
                    llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "changeHealth," + (string)itemHealthMod); 
                    //llRegionSayTo(toucherID, 0, "changeHealth," + (string)itemHealthMod);
                if (itemStaminaMod != 0)            
                    llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "changeStamina," + (string)itemStaminaMod); 
                    //llRegionSayTo(toucherID, 0, "changeStamina," + (string)itemStaminaMod);
            }             
        }     
    }    // end of dataserver                               
}
