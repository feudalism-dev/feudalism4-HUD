integer PLAYERHUDCHANNEL = -77770;

integer itemChannel = -454545;
integer pouchChannel = -777786;
integer dropInputChannel = -454546;
integer useInputChannel = -454549;
integer giveInputChannel = -454547;
integer giveToInputChannel = -454548;
integer listen_handle;
list messageParms;
string action;
string itemName;
integer itemValue;
list itemNames;
list itemValues;
integer currentQuantity = 0;

// for loading the consumable item data
string itemType;
integer itemHealthMod;
integer itemStaminaMod;
integer foundConsumable;

key toucherID;
string itemToDrop;
string itemToGive;
string itemToUse;
string giveToName;
key giveToKey;
integer amountToGive;
list integers = ["0","1","2","3","4","5","6","7","8","9"];
integer awarenessLevel;

// variables for sensor on give    
// range and arc for the sensor
float range = 5.0;
float arc = PI;
 
list avatarsKeys;
list avatarsNames;
list avatarsDisplayNames;
list avatarNamesTruncated;
list avatarDisplayNamesTruncated;


// input dialog variables
integer dropListener;
integer useListener;
integer giveListener;
integer giveToListener;
integer  gListener;
integer pouchListener;

integer AWARENESS = 3;
integer THIEVERY = 17;

// variables for the experience
key trans = NULL_KEY;
key transGetConsumable;
string transReason = "none";
integer kvCreated = FALSE;
string itemsKVKey;
string itemsKVValue;

list tempKeys;
list tempValues;
key thisContainerID;
list otherPlayerStats;
list myPlayerStats;
integer otherPlayerThievery;
integer myAwareness;
integer myGold;
integer mySilver;
integer myCopper;
integer totalCoins;
float chanceOfGold;
float chanceOfSilver;
float chanceOfCopper;


integer getQuantityFromItemName(string item)
{
    return llList2Integer(itemValues, llListFindList(itemNames, [item]));
}

giveItem(key recipient, string item, integer amount, integer myQuantity)
{   
    if (myQuantity > amount) 
    {
        myQuantity -= amount;    
    } 
    else 
    { 
        myQuantity = 0;
    }   
    llRegionSayTo(recipient, itemChannel, "fGiveItem," + item + "," + (string)amount);
    integer giveItemIndex =  llListFindList(itemNames, [item]);
    itemValues = llListReplaceList(itemValues, [myQuantity], giveItemIndex, giveItemIndex);  
    transReason = "updateKey";
    trans = llUpdateKeyValue(itemsKVKey, llList2CSV(itemNames), FALSE, "");                      
//llRegionSayTo(llGetOwner(), 0, "You gave " + (string)amountToGive + " of item " + itemToGive + " to " + giveToName + ".");
//llRegionSayTo(llGetOwner(), 0, "You now have " + (string)currentQuantity + " left.");    
}

processPickPocket(integer thievery, integer awareness)
{   
//llSay(0, "Thievery: " + (string)thievery);
//llSay(0, "Awareness: " + (string)awareness);
    integer thieveryTest = rollDice(thievery);
//llSay(0, "Thievery Test Result: " + (string)thieveryTest);    
    integer awarenessTest = rollDice(awareness + awarenessLevel);
//llSay(0, "Awareness Test Result: " + (string)awarenessTest);    
    integer numberOfCoinsStolen = 0;
    integer goldStolen = 0;
    integer silverStolen = 0;
    integer copperStolen = 0;
    integer detectedChance = 50;
    
    llRegionSayTo(toucherID, 0, "Attempting to steal coins from pouch.");
    
    myGold = llList2Integer(itemValues,llListFindList(itemNames, ["gold coin"]));
    mySilver = llList2Integer(itemValues, llListFindList(itemNames, ["silver coin"]));
    myCopper = llList2Integer(itemValues, llListFindList(itemNames, ["copper coin"]));
    totalCoins = myGold + mySilver + myCopper;
    if (totalCoins > 0)
    {    
        chanceOfGold = (float)myGold / (float)totalCoins;
        chanceOfSilver = (float)mySilver / (float)totalCoins;
        chanceOfCopper = (float)myCopper / (float)totalCoins;  
    }      
    
    if (thieveryTest >= awarenessTest)
    //if (TRUE)
        {
//llSay(0, "Successful theft.");            
           // successful theft
           // get a random number of coins between 1 and 10 for each 10 points of success
           
           integer successAmount = (thieveryTest - awarenessTest);
//llSay(0, "Success amount: " + (string)successAmount);
           integer i = 0;

           while  (i < successAmount)       // iterate by 10s and get cumulative number of coins
           {
               numberOfCoinsStolen = numberOfCoinsStolen + (integer)(llFrand(10.0) + 1);
               i += 10;
               detectedChance -= 10;
           }
//llSay(0, "Number of coins stolen: " + (string)numberOfCoinsStolen);           
           detectedChance -= successAmount;
           if (detectedChance < 0) detectedChance = 0;
           
           
           i = 0;
           while (i < numberOfCoinsStolen)  // iterate through all coins and determine type and how many
           {
               string typeOfCoinStolen = getTypeOfCoinStolen();
               if (typeOfCoinStolen == "gold") goldStolen++;
               else if (typeOfCoinStolen == "silver") silverStolen++;
               else if (typeOfCoinStolen == "copper") copperStolen++;  
               else {}                      
               i++;    
           }
           
           if (goldStolen > 0 && myGold >= goldStolen) 
           {
                amountToGive = goldStolen;
                itemToGive = "gold coin";
//llSay(0, "Gold Stolen: " + (string)itemToGive);                
                giveItem(toucherID, itemToGive, amountToGive, myGold);                          
           }
           if (silverStolen > 0 && mySilver >= silverStolen) 
           {
                currentQuantity = mySilver;
                amountToGive = silverStolen;
                itemToGive = "silver coin";
//llSay(0, "Silver Stolen: " + (string)itemToGive);                
                giveItem(toucherID, itemToGive, amountToGive, mySilver);                                
           }
           if (copperStolen > 0 && myCopper >= copperStolen) 
           {
                currentQuantity = myCopper;
                amountToGive = copperStolen;
                itemToGive = "copper coin";
//llSay(0, "Copper Stolen: " + (string)itemToGive);                
                giveItem(toucherID, itemToGive, amountToGive, myCopper);                                  
           }                    
                    
    }
    else if (thieveryTest < awarenessTest)
    {
        integer failureAmount = awarenessTest - thieveryTest;
        detectedChance += failureAmount;
        if (detectedChance > 100) detectedChance = 100;        
        // failed theft
        transReason = "";   
        trans = NULL_KEY;                     
    }
    else 
    {
        // tie do nothing   
        transReason = "";   
        trans = NULL_KEY;  
    }

    integer detectionTest = (integer)(llFrand(100.0) + 1);
    integer detectionLevel = (detectedChance - detectionTest) / 10;
    if (detectionLevel == 0)
    {
        llRegionSayTo(llGetOwner(), 0, "You feel uncomfortable but don't know why.");
        llRegionSayTo(toucherID, 0, "You almost got detected.");
        awarenessLevel--;
        if (awarenessLevel < 0) awarenessLevel = 0;
    }
    else if (detectionLevel == 1)
    {
        llRegionSayTo(llGetOwner(), 0, "You feel a slight tugging on your pouch.");
        llRegionSayTo(toucherID, 0, "You were clumsy and the person felt it.");
    }   
        else if (detectionLevel == 2)
    {
        llRegionSayTo(llGetOwner(), 0, "You feel a tugging on your pouch and hear coins jingling.");
        llRegionSayTo(toucherID, 0, "You were really clumsy and the person may suspect they are being robbed.");
    }  
    else if (detectionLevel == 3)
    {
        llRegionSayTo(llGetOwner(), 0, "You feel someone trying to steal from your pouch, but you don't see who.");
        llRegionSayTo(toucherID, 0, "You attempt was so bad, the person knows someone tried to rob them.");
        awarenessLevel++;
    } 
    else if (detectionLevel == 4)
    {
        llRegionSayTo(llGetOwner(), 0, "You notice " + llGetDisplayName(toucherID) + "trying to steal from your pouch.");
        llRegionSayTo(toucherID, 0, "Oh no! You were seen stealing from the pouch and the owner knows it was you!");
        awarenessLevel++;
    } 
    else if (detectionLevel >= 5)
    {
        llRegionSayTo(llGetOwner(), 0, "You see " + llGetDisplayName(toucherID) + "trying to steal from your pouch and so does anyone else near you");
        llRegionSayTo(toucherID, 0, "Busted! Everybody near you saw you attempting to steal from the pouch.");
        llSay(0,llGetDisplayName(toucherID) + " is poorly attempting to pick " + llGetDisplayName(llGetOwner()) + "'s pocket!");
        awarenessLevel++;
    } 
               
//                DO CHALLENGE HERE
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

string getTypeOfCoinStolen()
{

    float typeOfCoin = llFrand(1.0); // randomly determine the type of coin from 0 to 1
    if (typeOfCoin <= chanceOfCopper) return "copper"; // if the number is with the range fro copper
    else if (typeOfCoin <= (chanceOfCopper + chanceOfSilver)) return "silver"; // or silver
    else if (typeOfCoin <= 1.0) return "gold";  // or gold
    else return "none";
}

string StringTruncate(string text, integer length)
{
    if (length < llStringLength(text))
        return llGetSubString(text, 0, length - 2) + "…";
 
    // else
        return text;
}

default
{
    state_entry()
    {
        
        // LoadItemsFromKV(); 
    }
    
    on_rez(integer start_param)
    {
        awarenessLevel = 0;   
    }

    touch_start(integer total_number)
    {
        toucherID = llDetectedKey(0);
        if (toucherID != llGetOwner())
        {
            // PUT THINGS WHEN SOMEONE ELSE CLICKS THE POUCH
            // if I don't have money don't do anything
            vector pos = llDetectedPos(0);
            float dist = llVecDist(pos, llGetPos() );
            if (dist <= 3.0)
            {
                float time = llGetAndResetTime();
                if (time > 30.0) 
                {
                    transReason = "readOthersStats"; 
                    trans = llReadKeyValue((string)toucherID + "_stats");  // check to see if the stats key/value exists             
                    llSetTimerEvent(30.0);  
                }
                else
                {
                    llRegionSayTo(toucherID, 0, "Too many clicks on this pouch within the last 30 seconds. Try again later."); 
                }
            } 
            else
            {
                llRegionSayTo(toucherID, 0, "You're too far away to try to steal from this pouch.");   
            } 
        }     
    }
    
    dataserver(key t, string value)
    { 
        if (t == trans && transReason == "readOthersStats")
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                value = llGetSubString(value, 2, -1);
                //llRegionSayTo(llGetOwner(), 0, "Your stats were read from the database.");
                //kvCreated = TRUE;
                list readStats = llCSV2List(value);
                otherPlayerStats = [];
                //playerStats = [];
                integer i = 0;
                while (i < 20) 
                {
                    otherPlayerStats = otherPlayerStats + llList2Integer(readStats, i);
                    i++;
                }
                otherPlayerThievery = llList2Integer(otherPlayerStats, THIEVERY);
                transReason = "readMyStats";   
                trans = llReadKeyValue((string)llGetOwner() + "_stats");  // check to see if the stats key/value exists           
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llRegionSayTo(llGetOwner(), 0, "Your stats have not been saved to the database yet.");
                transReason = "none";
                trans = NULL_KEY;                
            }

        }  
        else if (t == trans && transReason == "readMyStats")  // these needs to be done in REAL TIME in case there are changes
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                value = llGetSubString(value, 2, -1);
                //llRegionSayTo(llGetOwner(), 0, "Your stats were read from the database.");
                //kvCreated = TRUE;
                list readStats = llCSV2List(value); // store the value returned in readStats
                myPlayerStats = [];
                integer i = 0;
                while (i < 20) // instead of just copying it, parse out the items one by one
                {
                    myPlayerStats = myPlayerStats + llList2Integer(readStats, i);
                    i++;
                }
                myAwareness = llList2Integer(myPlayerStats, AWARENESS); // set my awareness value
                if (otherPlayerThievery < 1)
                    otherPlayerThievery = 1;
                if (myAwareness < 1)
                    myAwareness = 1;
                processPickPocket(otherPlayerThievery, myAwareness);  
 
                transReason = "none";
                trans = NULL_KEY;                        
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llRegionSayTo(llGetOwner(), 0, "Your stats have not been saved to the database yet.");
                transReason = "none";
                trans = NULL_KEY;                
            }

        }         
        else if (t == trans && transReason == "readKeyRead")
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                value = llGetSubString(value, 2, -1);;
                tempKeys = llCSV2List(value);
               //llRegionSayTo(llGetOwner(), 0, "tempKeys: " + (string)tempKeys);    // here i replace this with update the ky and values            
                transReason = "readValueRead";
                trans = llReadKeyValue(itemsKVValue);  // check to see if the stats key/value exists
//llRegionSayTo(llGetOwner(), 0, "Read Keys");                
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llRegionSayTo(llGetOwner(), 0, "Unable to find inventory, creating one...");        
                transReason = "updateKey";
                trans = llUpdateKeyValue(itemsKVKey, llList2CSV(itemNames), FALSE, "");                                          
                //llRegionSayTo(llGetOwner(), 0, "Your inventory has not been saved to the database yet.");
                kvCreated = FALSE;
                transReason = "none";
                trans = NULL_KEY;                
            }
        } 
        else if (t == trans && transReason == "readValueRead")
        {
            // our llReadKeyValue transaction is done
           // llRegionSayTo(llGetOwner(), 0, "Reading values got here.");
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                value = llGetSubString(value, 2, -1);
                //llRegionSayTo(llGetOwner(), 0, "Your item list was read from the database.");
                kvCreated = TRUE;
                tempValues = llCSV2List(value);            
                //llRegionSayTo(llGetOwner(), 0, "tempValues: " + (string)tempValues); // here i replace this with update the ky and values
                itemNames = tempKeys;
                itemValues = tempValues;
                transReason = "readOthersStats"; 
                trans = llReadKeyValue((string)toucherID + "_stats");  // check to see if the stats key/value exists             
                llSetTimerEvent(30.0);            
//llRegionSayTo(llGetOwner(), 0, "Read Values");                
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llRegionSayTo(llGetOwner(), 0, "Your inventory has not been saved to the database yet.");
                kvCreated = FALSE;
                transReason = "none";
                trans = NULL_KEY;                
            }

        }                  
        if (t == trans && transReason == "updateKey")
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                //llRegionSayTo(llGetOwner(), 0, "Your item names were successfully saved to the database.");                         
                transReason = "updateValue";
                trans = llUpdateKeyValue(itemsKVValue, llList2CSV(itemValues), FALSE, "");   
                //llRegionSayTo(llGetOwner(), 0, "Wrote keys: " + (string)itemValues);               
            }
            else
            {
                integer error = llList2Integer(result, 1);
                kvCreated = FALSE;
                if(error == XP_ERROR_RETRY_UPDATE)
                    llRegionSayTo(llGetOwner(), 0, "Could not save your stats to the database.");
                else
                    llRegionSayTo(llGetOwner(), 0, "Could not save your stats to the database.");
                trans = NULL_KEY;
                transReason = "none";                    
            }  
        }
        if (t == trans && transReason == "updateValue")
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                //llRegionSayTo(llGetOwner(), 0, "Your items were successfully saved to the database.");
                kvCreated = TRUE;               
            }
            else
            {
                integer error = llList2Integer(result, 1);
                kvCreated = FALSE;
                if(error == XP_ERROR_RETRY_UPDATE)
                    llRegionSayTo(llGetOwner(), 0, "Could not save your items to the database.");
                else
                    llRegionSayTo(llGetOwner(), 0, "Could not save your items to the database.");
                trans = NULL_KEY;
                transReason = "none";                    
            }  
        }        
    }  
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (awarenessLevel > 0)
        {
            awarenessLevel--;
            llSetTimerEvent(30.0);   
        }   
    }            
}
