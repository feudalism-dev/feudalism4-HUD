integer DEBUG = FALSE;
integer RECIPECHANNEL = -99001;
integer itemChannel = -454545;
integer waterChannel = -595225;
integer PLAYERHUDCHANNEL = -77770;
integer recipeListener;
integer pouchListener;
integer waterListener;
integer pouchCheck = FALSE;
integer pouchIsWorn = FALSE;
float menuTimer = 30.0;
float startTime;
float duration;
float endTime;
string recipeName;
integer itemGivePerClick;
integer touchCount;
integer maxCount = 9;
list successes = [];
float durationDelay = 100.0;
integer numPlants = 0;
string securityMode = "all";

key notecardQueryId;
string notecardName = "config";
 
integer notecardLine;
integer configLoaded = FALSE;
integer recipeLoaded = FALSE;
integer crLoaded = FALSE;
integer CR = -1;

list recipes;
integer numberOfRecipes;
list recipeNames;

key ToucherID;
integer toucherCrafting;
integer craftingLoaded = FALSE;
integer CRAFTING = 4;
key transGetConsumableItem;
key transGetStats;
string transKey;


// ingredients management
string name;
list ingredientNames;
list ingredientAmounts;
integer numberOfIngredients;

// inventory management
list itemNames;
list itemValues;
string itemsKVKey;
string itemsKVValue;
key transSetItemAmounts;
key transGetItemNames;
key transGetItemAmounts;
integer itemNamesLoaded = FALSE;
integer itemValuesLoaded = FALSE;

integer numberOfIngredientMessages;
list inventoryItems;
list inventoryQuantities;
integer hasRequiredItems = FALSE;
integer numberFound = 0;

debug (string message)
{
    if (DEBUG) llOwnerSay("Debug: " + message);   
}

integer getLinkNumber(integer linkNum)
{
    //debug("GetLinkNumber for " +(string)linkNum);
    integer numLinks = llGetNumberOfPrims(); // Get total number of links in the linkset
    integer i;
    
    for (i = 1; i <= numLinks; i++) // Iterate through all linked prims
    {
        string linkName = llGetLinkName(i);
        //debug("index = " +(string)i + ", linkName = " +linkName);
        if (linkName == (string)linkNum) // Check if the name matches
        {
            return i; // Return the matching link number
        }
    }
    
    return -1; // Return -1 if no match is found
}


string Float2String ( float num, integer places, integer rnd) { 
//allows string output of a float in a tidy text format
//rnd (rounding) should be set to TRUE for rounding, FALSE for no rounding
 
    if (rnd) {
        float f = llPow( 10.0, places );
        integer i = llRound(llFabs(num) * f);
        string s = "00000" + (string)i; // number of 0s is (value of max places - 1 )
        if(num < 0.0)
            return "-" + (string)( (integer)(i / f) ) + "." + llGetSubString( s, -places, -1);
        return (string)( (integer)(i / f) ) + "." + llGetSubString( s, -places, -1);
    }
    if (!places)
        return (string)((integer)num );
    if ( (places = (places - 7 - (places < 1) ) ) & 0x80000000)
        return llGetSubString((string)num, 0, places);
    return (string)num;
}

init()
{
    debug("Initializing!");
    llSetText("",<1.0,1.0,1.0>,1.0);
    llSetLinkAlpha(LINK_ALL_OTHERS, 0.0, ALL_SIDES);
    configLoaded = FALSE;    
    recipes = [];
    recipeNames = [];
    toucherCrafting  = 0;
    craftingLoaded = FALSE;
    recipeLoaded = FALSE;
    crLoaded = FALSE;
    itemNames = [];
    itemValues = [];  
    itemNamesLoaded = FALSE;
    itemValuesLoaded = FALSE;  
    successes = [];    
    CR = -1;
    list params = llCSV2List(llGetObjectDesc());
    if (llGetListLength(params) == 2)
    {
        name = llList2String(params, 0);
        securityMode = llList2String(params,1);   
    }    
    else
    {
        llOwnerSay( "Error: Description does not contain 2 fields. Field1: name for what this field grows (ie Corn or Wheat). Field 2: security mode (all, group or owner.");
        return; 
    }
    // Check the notecard exists, and has been saved
    if (llGetInventoryKey(notecardName) == NULL_KEY)
    {
        llOwnerSay( "Error: Notecard '" + notecardName + "' missing or unwritten");
        return;
    }
    llSetText("Field restarting...",<1.0,1.0,1.0>,1.0);       
    notecardQueryId = llGetNotecardLine(notecardName, notecardLine);    
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

integer loadRecipe()
{
    debug("Load recipe.");
    integer result = FALSE;
    list recipe = llCSV2List(llList2String(recipes, 0));
    debug("Recipe: " + llList2CSV(recipe));
    integer count = llGetListLength(recipe);
    integer i = 3;
    ingredientNames = [];
    ingredientAmounts = [];
    numberOfIngredients = 0;
    recipeName = llList2String(recipe, 0);
    debug("recipeName: " + recipeName);
    CR = llList2Integer(recipe, 1);
    itemGivePerClick = llList2Integer(recipe,2);
    crLoaded == TRUE;
    while (i < count)
    {
        ingredientNames += llList2String(recipe, i);
        ingredientAmounts += llList2Integer(recipe, i+1);
        i += 2;
    } 
    numberOfIngredients = llGetListLength(ingredientNames);
    debug("IngredientNames: " + (string)ingredientNames);
    debug("IngredientAmounts: " + (string)ingredientAmounts);
    debug("Number of Ingredients: " + (string)numberOfIngredients);
    if (numberOfIngredients = llGetListLength(ingredientAmounts))
    {
        result = TRUE; 
//llOwnerSay("Success.");             
    } 
    else
    {
        llOwnerSay("The field encountered an error processing the recipe for " + recipeName + ".");   
    } 
    return result;
}

processXPError(integer errorCode, string fieldName)
{
    string errorMessage = "The field reports the following error when loading " + fieldName + " data: "; 
    errorMessage += llGetExperienceErrorMessage(errorCode);      
    llOwnerSay(errorMessage);
}

default
{
    state_entry()
    {   
        init();
    }
    
    dataserver(key query_id, string data)
    {
        if (query_id == notecardQueryId)
        {
            if (data == EOF)
            {

                configLoaded = TRUE;
                debug("Loaded config notecard.");
                state setup; // finished loading the configuration
            }
            else
            {
                // bump line number for reporting purposes and in preparation for reading next line
                ++notecardLine;
                recipes += data;
                notecardQueryId = llGetNotecardLine(notecardName, notecardLine);
            }
        }
    }    
}

state invalidSetup
{
    state_entry()
    {
        llSetText("Error! recipe configuration error. Touch to restart.",<1.0,0,0>,1.0);
        llOwnerSay("The farm field failed to setup properly. Please fix the config file and click to restart.");   
    }
    
    touch_start(integer total_number)
    {
        llResetScript();   
    }    
}

state setup
{
    state_entry()
    {
        debug("State setup.");
        if (DEBUG)
            durationDelay = 5.0;
        else
            durationDelay = 100.0;
        numberOfRecipes = llGetListLength(recipes);
        debug("Number of recipes: " + (string)numberOfRecipes);
        integer i = 0;
        string recipeCSV;
        list recipe;
        while (i < numberOfRecipes)
        {
            recipeCSV = llList2String(recipes, i);       
            recipe = llCSV2List(recipeCSV);
            recipeNames += llList2String(recipe, 0);  
            i++;
        }      
        if (llGetListLength(recipeNames) == numberOfRecipes) 
        {          
            if (loadRecipe())
            {
                state ready;             
            }                   
            else
            {
                llOwnerSay("Error: Description does not contain valid crop type.");
                state invalidSetup;    
            }                       
        }
        else
        { 
            llOwnerSay("Error: recipe names and number of recipes do not match.");
            state invalidSetup;      
        }       
    }   
}

state ready
{
    state_entry()
    {            
        debug("State ready.");
        debug("The field is ready for use.");
        llSetText(name + " field ready for planting",<1.0,1.0,1.0>,1.0);            
        ToucherID = NULL_KEY;             
    }

    touch_start(integer total_number)
    {
        pouchIsWorn = FALSE;
        pouchCheck = TRUE;
        numberFound = 0;
        craftingLoaded = FALSE;
        ToucherID = llDetectedKey(0);
        if (securityMode == "all" || (securityMode == "group" && llSameGroup(ToucherID)) || (securityMode == "owner" && ToucherID == llGetOwner()))
        {
            vector pos = llDetectedPos(0);
            float dist = llVecDist(pos, llGetPos() );        
            if (dist <= 15.0)
            {    
                // check if pouch is worn
                pouchListener = llListen(itemChannel, "", NULL_KEY, "");
                llRegionSayTo(ToucherID, itemChannel, "detectPouch," + (string)llGetKey());  
               debug("Detecting if pouch is worn..."); 
                llSetTimerEvent(5.0);        
            }  
            else
            {
                llRegionSayTo(ToucherID, 0, "You're too far away to try to cultivate the field."); 
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
//llOwnerSay("Message received: " + message);            
            llListenRemove(pouchListener);
            message = llToLower(message);
            list messageParms = llCSV2List(message);
            string action = llList2String(messageParms, 0);
            key fromKey = llList2Key(messageParms, 1);
            if (action == "pouchworn")
            {
                if (fromKey == ToucherID)
                {
                    llSetTimerEvent(0.0);
                    pouchIsWorn = TRUE; 
                    debug("Pouch found...");       
                    llSetTimerEvent(10.0);
                    transGetStats = llReadKeyValue((string)ToucherID + "_stats"); 
                }               
            }
        }           
    }
    
    dataserver(key t, string value)
    {      
        if (t == transGetStats)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                value = llGetSubString(value, 2, -1);
                list stats = llCSV2List(value);
                toucherCrafting = llList2Integer(stats, CRAFTING);
                debug("Crafting loaded: " +(string)toucherCrafting);
                state prepping;                    
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                processXPError(error, "stats");              
            }
        }              
    }    
    
    timer()
    {
        if (pouchCheck)
        {
            llSetTimerEvent(0.0);
            llRegionSayTo(ToucherID, 0, "Your pouch is not being worn. You must wear a Feudalism pouch before you can use this object.");
            pouchCheck = FALSE;
            state ready;
        }
        else
        {
            llSetTimerEvent(0.0);
            state ready;  
        } 
    } 
}

state prepping
{
    state_entry()
    {
        debug("State Prepping."); 
        llSetText(name + "field being worked... checking for required items.",<1.0,1.0,1.0>,1.0);   
        llRegionSayTo(ToucherID, 0,"You are attempting to prepare " + name + " for planting. Let's check your inventory for all of the following required items: ");            
        pouchListener = llListen(itemChannel, "", "", "");
        integer i = 0;        
        llSetTimerEvent(10.0);
        inventoryItems = [];
        inventoryQuantities = [];
        hasRequiredItems = FALSE;
        // numberOfIngredients = 0;  // note the numberOfIngredients is already set by the loadRecipe function
        numberOfIngredientMessages = 0;
        debug("Sending check request to pouch for each item.");
        while (i < numberOfIngredients)
        {                           
            string itemToCheck = llList2String(ingredientNames, i);   
            debug("ItemToCheck: " + itemToCheck);
            integer amountToCheck = llList2Integer(ingredientAmounts, i);  
            llRegionSayTo(ToucherID, 0, itemToCheck + ": " + (string)amountToCheck);             
            if (itemToCheck == "water")
            {
                waterListener = llListen(waterChannel, "", "", "");
                llRegionSayTo(ToucherID, waterChannel, "check," + "water");                
            }
            else
            {        
                llRegionSayTo(ToucherID, itemChannel, "check," + itemToCheck);
            }
            llSleep(0.1);                
            i++;
        } 
        llSetTimerEvent(10.0);
        debug("listen for replies from pouch...");
}    
    listen( integer channel, string name, key id, string message )
    {    
        debug("Listen. message: " + message);    
        if (channel == RECIPECHANNEL)
        {
            llListenRemove(recipeListener);
            llSetTimerEvent(0.0);
            string answer = llToLower(message);             
            if (answer == "yes")
            {
                llRegionSayTo(ToucherID, 0, "Taking required items from your inventory...");
//llOwnerSay("itemskvkey: " + itemsKVKey);
//llOwnerSay("itemskvvalue: " + itemsKVValue);
debug("Ok, so you had all the ingredients and selected yes. Taking items.");  
                              
                //transGetItemNames = llReadKeyValue(itemsKVKey);
                //transGetItemAmounts = llReadKeyValue(itemsKVValue);
                
                integer i = 0;
                while (i < numberOfIngredients)
                {
                    string itemToTake = llList2String(ingredientNames, i);
                    integer amountToTake = llList2Integer(ingredientAmounts, i);
                    if (itemToTake == "water")
                        llRegionSayTo(ToucherID, waterChannel, "bTakeItem," + "water" + "," + (string)amountToTake);
                    else
                        llRegionSayTo(ToucherID, itemChannel, "fTakeItem," + itemToTake + "," + (string)amountToTake);
                    llSleep(0.1);
                    i++;   
                }    
                numberOfIngredients = 0;
                state processing;            
                // do nothing... wait for all values to get received.                 
            }
            else
            {
                state ready;             
            }
        } 
        if (channel == itemChannel || channel == waterChannel)
        {
            list params = llCSV2List(message);
            if (llGetListLength(params) == 2)
            {
                string foundItem = llList2String(params, 0);
                debug("Found item: " + foundItem);
                integer foundQuantity = (integer)llList2String(params,1);
                debug("Found quantity: " + (string)foundQuantity);
                integer recipeIndex = llListFindList(ingredientNames, [foundItem]);
                if (recipeIndex != -1)
                {
                    numberOfIngredientMessages++; // how many of the requested checks have come back
                    string ingredientName = llList2String(ingredientNames, recipeIndex);
                    integer ingredientAmount = (integer)llList2String(ingredientAmounts, recipeIndex);
                    if (foundQuantity >= ingredientAmount)
                    {
                        numberFound++; // how many of the required ingredients does user have sufficient amount of
                        llRegionSayTo(ToucherID, 0, "You have enough of item: " + foundItem);   
                    }
                    else
                    {
                        llRegionSayTo(ToucherID, 0, "You have " + (string)foundQuantity + " of item " + foundItem + " but need " + (string)ingredientAmount + "."); 
                    }
                    debug("numberOfIngredientMessages: " + (string)numberOfIngredientMessages + ", Number of Ingredients: " +(string)numberOfIngredients);                     
                    if (numberOfIngredientMessages == numberOfIngredients)
                    {
                        debug("NumberFound: " + (string)numberFound + ", Number of Ingredients: " +(string)numberOfIngredients); 
                        if (numberFound == numberOfIngredients)
                        {    
                            llSetTimerEvent(0.0);                                              
                            list buttons = ["Yes", "No"];
                            recipeListener = llListen(RECIPECHANNEL, "", ToucherID, "");        
                            llSetTimerEvent(menuTimer);
                            string dialogText = "\nYou have all of the required items needed to plant: " + name + "\n\n";
                            dialogText += "\nDo you want to plant it?\n";
                            llDialog(ToucherID,dialogText,buttons, RECIPECHANNEL);                              
                        }  
                        else
                        {
//                        / ok, we got responses on all the ingredients  but you're missing at least one... in future add ability to store ingredients
                            llRegionSayTo(ToucherID, 0, "Since you don't have all the necessary ingredients, please go gather some more and try again once you have everything you need.");
                            state ready;                             
                        }
                        numberFound = 0; 
                    } 
                    else
                    {
                        debug("Need to receive more responses.");   
                    }   
                }                   
            }   
        }
    }        
    
    timer()
    {
        llSetTimerEvent(0.0);
        llListenRemove(recipeListener);   
        state ready; 
    }     
}

state processing
{
    state_entry()
    {
        startTime = llGetAndResetTime();
        duration = CR * durationDelay; 
        successes = []; 
        llSetText("Growing. Time left = " + (string)((integer)(duration - llGetTime())) + " seconds", <1.0,1.0,1.0>, 1.0);
        llRegionSayTo(ToucherID, 0, "Planting and watering seeds......"); 
        llRegionSayTo(ToucherID, 0, "Growing crops...");        
        llSetTimerEvent(1.0);
    }  
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (llGetTime() >= duration)
        {
            integer i;
            integer craftResult = 0;
            integer target = 0;    
            debug("Rolling dice to see if you can successfully grow crops.");       
            for (i = 0; i< maxCount; i++)
            {
                craftResult = rollDice(toucherCrafting);
                target = rollDice(CR);
                debug("Attempt" +(string)(i + 1) + " Target: " + (string)target + " You rolled: " +(string)craftResult);
                llSetText("",<1.0,1.0,1.0>,1.0);
                integer linkNum = getLinkNumber(i);
                if (linkNum != -1)
                {
                    debug("Working on link number: " +(string)linkNum + " for linkNamed " +(string)i); 
                
                    if (craftResult >= target)
                    {
                        debug("Success! index: " +(string)i);
                        // brewing is successful
                        successes += i;
                        llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP," + (string)(CR*2));                       
                        llSetLinkAlpha(linkNum, 1.0, ALL_SIDES);                         
                    }  
                    else
                    {
                        // brewing failed
                        debug("Failure! index: " +(string)i);
                        llSetLinkAlpha(linkNum, 0.0, ALL_SIDES);                     
                        llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP," + (string)CR);                    
                    }
                }
                else
                {
                    debug("The link number did not match any plant's description.");   
                }
            }
            numPlants = llGetListLength(successes);  
            debug("Number of Plants: " +(string)numPlants);
            if (numPlants > 0)
            {    
                llRegionSayTo(ToucherID, 0,"You successfully grew " + (string)llGetListLength(successes) + " " + name + " plants.");  
                state harvestable; 
            }
            else
            {
                llRegionSayTo(ToucherID, 0,"You failed to grow any " + name + ".");  
                state waitToReset;  
            }           
        }
        else
        {
            llSetText("Growing. Time left = " + (string)((integer)(duration - llGetTime())) + " seconds", <1.0,1.0,1.0>, 1.0);
            llSetTimerEvent(1.0); 
        }
    }
}

state harvestable
{
    state_entry()
    {
        llSetText("Field ready for harvest.", <1.0,1.0,1.0>,1.0);   
        touchCount = 0;
    }

    touch_start(integer total_number)
    {
        ToucherID = llDetectedKey(0);
        vector pos = llDetectedPos(0);
        float dist = llVecDist(pos, llGetPos() );        
        debug("Harvesting crops.");  
        debug("Before processing...");
        debug("TouchCount: " + (string)touchCount + ", NumPlants: " +(string)numPlants + ", Successes: " + llList2CSV(successes));
   
        if (dist <= 15.0)
        {              
            if (touchCount < numPlants)
            {
//                llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP," + (string)(CR));
                integer index = llList2Integer(successes, 0);
                debug("Removing plant#: " +(string)index);
                llRegionSayTo(ToucherID, itemChannel, "fGiveItem," + recipeName + "," + (string)itemGivePerClick); 
                llSleep(0.1);
                llRegionSayTo(ToucherID, itemChannel, "fGiveItem,stover," + (string)itemGivePerClick); 
                llSetLinkAlpha(getLinkNumber(index), 0.0, ALL_SIDES);    
                successes = llList2List(successes, 1, -1); 
                touchCount++;
                if (touchCount == numPlants)
                    state waitToReset; 
            }
            else
            {
                debug("All plants removed.");
                state waitToReset;                
            }
        }  
        else
        {
            llRegionSayTo(ToucherID, 0, "You're too far away to try to cultivate the field."); 
        }          
    }
    
    touch_end(integer blah)
    {
        debug("TouchCount: " + (string)touchCount + ", Successes: " + llList2CSV(successes));
    }
    
    
}

state waitToReset
{
    state_entry()
    {
        //llSetLinkAlpha(LINK_ALL_OTHERS, 0.0, ALL_SIDES);
        startTime = llGetAndResetTime();
        if (DEBUG)
            duration = 5.0;
        else
            duration = 60.0; 
        integer timeLeft = (integer)(duration - llGetTime());     
        llSetText("Field resetting. Time left = " + (string)timeLeft + " seconds", <1.0,1.0,1.0>, 1.0);
        llSetTimerEvent(1.0);
    }    
    
    timer()
    {
        llSetTimerEvent(0.0);
        integer timeLeft = (integer)(duration - llGetTime());
        if (timeLeft >= 0)
        {
            llSetText("Field resetting. Time left = " + (string)timeLeft + " seconds", <1.0,1.0,1.0>, 1.0);
        }
        if (timeLeft <= 0)
        {     
            llSetText("", <1.0,1.0,1.0>, 1.0);        
            llResetScript();
        }
        else
        {
            llSetTimerEvent(1.0);    
        }
    }
}
