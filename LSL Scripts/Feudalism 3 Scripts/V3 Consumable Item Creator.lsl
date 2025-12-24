string description;
list parms;
string itemName;
string itemFullName;
string itemType;
integer itemHealthMod;
integer itemStaminaMod;

key ToucherID;
key transCreateItem;
key transGetSize;
key transKeyCount;
key transGetKeys;
key transKeyLookup;


integer keyCounter = 0;
integer numberOfKeys = 0;
integer keyIndex = 0;
integer keyIndex2 = 0;
list consumableItemsKeys;
integer currentKey2Lookup = 0;
string lookedUpKeyValue;
list consumableItemsValues;
integer numberOfConsumableItems;

 
default
{
    state_entry()
    {
        llSetText("Set the description with: \nitem name, \nrp name, \nitem type, \nhealth mod, \nstamina mod, \nthen touch object to register item in DB.", <1.0,1.0,1.0>, 1.0);  
        consumableItemsKeys = [];
    }
    
    touch_start(integer num) 
    { 
        ToucherID = llDetectedKey(0);
        llResetTime(); 
    }
    touch_end(integer num)
    {
        if ( llGetTime() > 0.8 ) 
        {
            // long touch
            keyIndex = 0;
            transGetSize = llDataSizeKeyValue( );
            transKeyCount = llKeyCountKeyValue( ); 
            keyCounter = 10;
            consumableItemsKeys = [];
            transGetKeys = llKeysKeyValue(keyIndex, keyCounter);
        }
        else 
        {
            description = llGetObjectDesc();
            parms = llCSV2List(description);
//llOwnerSay("Parms: " + (string)parms);   
            if (llGetListLength(parms) == 5)
            {
                itemName = llList2String(parms, 0);
                itemFullName = llList2String(parms, 1);                
                itemType = llList2String(parms, 2);
                itemHealthMod = llList2Integer(parms, 3);
                itemStaminaMod = llList2Integer(parms, 4);
//llOwnerSay("Item Full Name: " + itemFullName);
                if (itemType == "food" || itemType == "drink" || itemType == "alcohol" || itemType == "poison" || itemType == "potion")
                {
                    if (itemHealthMod >= -999 && itemHealthMod <= 999)
                    {
                        if (itemStaminaMod >= -999 && itemStaminaMod <= 999)
                        {
                            // valid mods
                            
                            llOwnerSay("Attempting to register the following item: " + itemName + ": " + itemFullName + " with HealthMod of " + (string)itemHealthMod + " and StaminaMod of " + (string)itemStaminaMod);  
                            transCreateItem = llUpdateKeyValue("consumableItem_" + itemName, itemName + "," + itemFullName + "," + itemType + "," + (string)itemHealthMod + "," + (string)itemStaminaMod, FALSE, ""); 
                        }
                        else llOwnerSay("Stamina mod was out of range.");
                    } 
                    else llOwnerSay("Health mod was out of range.");
                } 
                else llOwnerSay("Item type of " + itemType + " was invalid.");
            } 
            else llOwnerSay("There were not 5 parameters in the description.");     
        }
    }    
 
    dataserver(key t, string value)
    {
        if (t == transCreateItem)
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                llOwnerSay("New consumable item was successfully updated");
            }
            else
            {
                integer error = llList2Integer(result, 1);
                if(error == XP_ERROR_RETRY_UPDATE)
                    llOwnerSay("Key-value update failed, checked value is out of date");
                else
                    llOwnerSay("Key-value update failed: " + llGetExperienceErrorMessage(error) );
            }  
        }
        if ( t == transGetSize )
        {
            // our llDataSizeKeyValue transaction is done
            list result = llCSV2List( value );
            if ( llList2Integer( result, 0 ) == 1 )
            {
                // data size retrieved
                numberOfKeys = (integer)llList2String( result, 1 );
                llOwnerSay("Space in use: " + (string)numberOfKeys );
                llOwnerSay("Total space:  " + llList2String( result, 2 ) );
            }
            else
            {
                // data size check failed
                llOwnerSay("Key-value failed to check size: " + llList2String( result, 1 ) );
            }
        }
        if (t == transKeyCount)
        {
            // our llKeyCountKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // data size retrieved
                numberOfKeys = llList2Integer(result, 1);
                llOwnerSay("Keys in use: "+ (string)numberOfKeys );
            }
            else
            {
                // key count failed
                llOwnerSay("Key-value failed to count keys: " + llList2String(result, 1) );
            }
        }
        if (t == transGetKeys)
        {
            // our llKeysKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                if (keyIndex < numberOfKeys)
                {
                    //llSay(0, "Keys retrieved: "+(string)llGetSubString(value, 2, -1));
                    list keysReceived = llCSV2List((string)llGetSubString(value, 2, -1));
                    integer numKeys = llGetListLength(keysReceived);
                    //llOwnerSay("Number of keys Found this check: " + (string)numKeys);
                    //llOwnerSay("Keys found this check: " + (string)keysReceived);
                    integer i = 0;
                    while (i < numKeys)
                    {
                        string keyReceived = llList2String(keysReceived, i);
                        if (llSubStringIndex(keyReceived, "consumableItem") != -1)
                        {
                            consumableItemsKeys += keyReceived;
                            //llOwnerSay("Consumable Item Found: " + keyReceived);
                        }
                        i++;    
                    }
                    keyIndex += keyCounter;
                    transGetKeys = llKeysKeyValue(keyIndex, keyCounter); 
                }               
            }
            else if (llList2Integer(result, 1) == XP_ERROR_KEY_NOT_FOUND)
            {
                // no more keys
                //llOwnerSay("Keys Found: " + (string)consumableItemsKeys );
                // get values for keys, starting here
                keyIndex2 = 0;
                numberOfConsumableItems = llGetListLength(consumableItemsKeys);      
                llOwnerSay("Number of Consumable Items Found: " + (string)numberOfConsumableItems);         
                if (keyIndex2 < numberOfConsumableItems)
                {
                    string keyName = llList2String(consumableItemsKeys, keyIndex2);
                    //llOwnerSay("KeyName: " + keyName);
                    keyIndex2++;
                    transKeyLookup = llReadKeyValue(keyName);
                }
            }
            else
            {
                // keys request failed
               llOwnerSay("Key-value failed to request keys: " + llGetExperienceErrorMessage(llList2Integer(result, 1)) );
            }
        } 
        if (t == transKeyLookup)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                consumableItemsValues +=  llGetSubString(value, 2, -1);
                //llSay(0, "New key-value pair value: " + llGetSubString(value, 2, -1));
                if (keyIndex2 < numberOfConsumableItems)
                {
                    string keyName = llList2String(consumableItemsKeys, keyIndex2);
                    //llOwnerSay("KeyName: " + keyName);
                    keyIndex2++;
                    transKeyLookup = llReadKeyValue(keyName);
                } 
                else
                {
                    llOwnerSay("Current Saved Consumable Items List: ");
                    integer i = 0;
                    while (i < numberOfConsumableItems)
                    {
                        llOwnerSay(llList2String(consumableItemsValues, i));
                        i++;
                    }    
                }
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llOwnerSay("Key-value failed to read: " + llGetExperienceErrorMessage(error));
            }
        } 
        
        
    }
 
    timer()
    {
    }
}