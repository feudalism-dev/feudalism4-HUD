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
integer numberToMake = 0;
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
    list params = llCSV2List(llGetObjectDesc());
    if (llGetListLength(params) == 2)
    {
        name = llList2String(params, 0);
        securityMode = llList2String(params,1);  
        //llSetLinkAlpha(LINK_ALL_OTHERS, 0.0, ALL_SIDES);
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
        name = llGetObjectDesc();
        llSetText("Grain Mill restarting...",<1.0,1.0,1.0>,1.0);    
                         // Check the notecard exists, and has been saved
        if (llGetInventoryKey(notecardName) == NULL_KEY)
        {
            llOwnerSay( "Notecard '" + notecardName + "' missing or unwritten");
            return;
        }
        notecardQueryId = llGetNotecardLine(notecardName, notecardLine); 
    }    
    else
    {
        llOwnerSay( "Error: Description does not contain 2 fields. Field1: name for what this mill is called). Field 2: security mode (all, group or owner.");
        return; 
    }    
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

integer loadRecipe(string recipeToLoad)
{
    // this function is used to parse a recipe and load the current values with its information including the ingredients and amounts required, yield, etc.
    debug("Load recipe.");
    integer result = FALSE;
    integer index = llListFindList(recipeNames, [recipeToLoad]);
    if (index != -1)
    {
        list recipe = llCSV2List(llList2String(recipes, index));
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
            llOwnerSay("The mill encountered an error processing the recipe for " + recipeName + ".");   
        } 
    }
    return result;
}

processXPError(integer errorCode, string fieldName)
{
    string errorMessage = "The mill reports the following error when loading " + fieldName + " data: "; 
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
                data = llStringTrim(data, STRING_TRIM);
                if (data != "" && llGetSubString(data, 0, 0) != "#")     
                {
                    recipes += data;
                    notecardQueryId = llGetNotecardLine(notecardName, notecardLine);
                }
            }
        }
    }    
}

state invalidSetup
{
    state_entry()
    {
        llSetText("Error! recipe configuration error. Touch to restart.",<1.0,0,0>,1.0);
        llOwnerSay("The Grain Mill failed to setup properly. Please fix the config file and click to restart.");   
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
        name = llGetObjectDesc();
        numberOfRecipes = llGetListLength(recipes);
        debug("Number of recipes: " + (string)numberOfRecipes);
        integer i = 0;
        string recipeCSV;
        list recipe;
        while (i < numberOfRecipes)
        {
            // load the recipeNames into recipeNames
            recipeCSV = llList2String(recipes, i);       
            recipe = llCSV2List(recipeCSV);
            recipeNames += llList2String(recipe, 0);  
            i++;
        } 
        state ready;     
//        if (llGetListLength(recipeNames) == numberOfRecipes) 
//        {          
//            if (loadRecipe())
//            {
//                state ready;             
//            }                   
//            else
//            {
               // llOwnerSay("Error: Description does not contain valid crop type.");
//                state invalidSetup;    
//            }                       
//        }
//        else
//        { 
//            llOwnerSay("Error: recipe names and number of recipes do not match.");
//            state invalidSetup;      
//        }       
    }   
}

state ready
{
    state_entry()
    {            
        debug("State ready.");
        debug("The grain mill is ready for use.");
        llSetText(name + " is ready",<1.0,1.0,1.0>,1.0);            
        ToucherID = NULL_KEY;             
    }

    touch_start(integer total_number)
    {
        if (securityMode == "all" || (securityMode == "group" && llSameGroup(ToucherID)) || (securityMode == "owner" && ToucherID == llGetOwner()))
        {        
            llWhisper(-2121212, "stop");  
            debug("Touched!");
            pouchIsWorn = FALSE;
            pouchCheck = TRUE;
            numberFound = 0;
            craftingLoaded = FALSE;
            ToucherID = llDetectedKey(0);
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
                llRegionSayTo(ToucherID, 0, "You're too far away to use the grain mill."); 
            } 
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
        else if (channel == RECIPECHANNEL)
        {
            debug("Recipe selected: " + message);
            if (llListFindList(recipeNames, [message]) != -1)
            {
                if (loadRecipe(message))
                    state prepping;
            } 
            else
            {
                llOwnerSay("Error! Selected recipe not found!");   
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
                list buttons = recipeNames;
                recipeListener = llListen(RECIPECHANNEL, "", ToucherID, "");        
                llSetTimerEvent(menuTimer);
                string dialogText = "\nWhich kind of ground grain do you wish to produce?\n\n";
                llDialog(ToucherID,dialogText,buttons, RECIPECHANNEL); 
                //state prepping;                    
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
        llSetText(name + " being worked... checking for required items.",<1.0,1.0,1.0>,1.0);   
        llRegionSayTo(ToucherID, 0,"For every " + (string)llList2Integer(ingredientAmounts, 0) + " " + llList2String(ingredientNames, 0) + " you add to the Grain Mill, you will receive " + (string)itemGivePerClick + " " + recipeName);            
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
            llRegionSayTo(ToucherID, itemChannel, "check," + itemToCheck);
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
            if (answer == "Cancel")
                llResetScript();
            else
            {
                integer amountPerItem = llList2Integer(ingredientAmounts, 0);
                string itemToTake = llList2String(ingredientNames, 0); 
                numberToMake = 0;
                list checkList = llParseString2List(message, [], ["0","1","2","3","4","5","6","7","8","9"]);
                if (llList2String(checkList, 0) == message) 
                {
                    numberToMake = (integer)message;
                } 
                else 
                {
                    llOwnerSay("Invalid input, not a number: " + message);
                }            
                integer amountToTake = amountPerItem * numberToMake;
                if (amountToTake > 0)
                {
                    llRegionSayTo(ToucherID, 0, "Taking required items from your inventory...");
                    llRegionSayTo(ToucherID, itemChannel, "fTakeItem," + itemToTake + "," + (string)amountToTake);
                }
            }                     
            numberOfIngredients = 0;
            state processing;            
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
                        llRegionSayTo(ToucherID, 0, "You have " + (string)foundQuantity + " " + foundItem + ".");   
                    }
                    else
                    {
                        llRegionSayTo(ToucherID, 0, "You have " + (string)foundQuantity + " of item " + foundItem + " but need a minimum of " + (string)ingredientAmount + "."); 
                    }
                    debug("numberOfIngredientMessages: " + (string)numberOfIngredientMessages + ", Number of Ingredients: " +(string)numberOfIngredients);                     
                    if (numberOfIngredientMessages == numberOfIngredients)
                    {
                        debug("NumberFound: " + (string)numberFound + ", Number of Ingredients: " +(string)numberOfIngredients); 
                        if (numberFound == numberOfIngredients)
                        {    
                            llSetTimerEvent(0.0);                                          
                            list buttons = [];
                            integer amountNeeded = llList2Integer(ingredientAmounts, 0);
                            integer maxProduction = foundQuantity / amountNeeded;
                            buttons += "1";
                            if (2*amountNeeded < foundQuantity)
                                buttons += "2";
                            if (3 * amountNeeded < foundQuantity)
                                buttons += "3";
                            if (4 * amountNeeded < foundQuantity)
                                buttons += "4";
                            if (5 * amountNeeded < foundQuantity)
                                buttons += "5";
                            if (10 * amountNeeded < foundQuantity)
                                buttons += "10";
                            if (20 * amountNeeded < foundQuantity)
                                buttons += "20";
                            if (50 * amountNeeded < foundQuantity)
                                buttons += "50";
                            if (100 * amountNeeded < foundQuantity)
                                buttons += "100";
                            buttons += (string)maxProduction;
                            buttons += "Cancel";
                            recipeListener = llListen(RECIPECHANNEL, "", ToucherID, "");        
                            llSetTimerEvent(menuTimer);
                            string dialogText = "\nYou have enough of the required items to produce " + (string)(maxProduction*itemGivePerClick) + " " + recipeName + "\n\n";
                            dialogText += "\nHow many do you want to convert?\n";
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
        llWhisper(-2121212, "start");
        startTime = llGetAndResetTime();
        duration = CR * durationDelay; 
        successes = []; 
        llSetText("Producing " + recipeName + ". Time left = " + (string)((integer)(duration - llGetTime())) + " seconds", <1.0,1.0,1.0>, 1.0);
        llRegionSayTo(ToucherID, 0, "Drying seeds......");       
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
            debug("Rolling dice to see if you can successfully produce " + recipeName + "."); 
            llSetText("",<1.0,1.0,1.0>,1.0);   
            integer failCount = 0; 
            integer successCount = 0;  
            for (i = 0; i < numberToMake; i++)
            {
                //llRegionSayTo(ToucherID, 0,"Production started..."); 
                craftResult = rollDice(toucherCrafting);
                target = rollDice(CR) -10;
                debug("Target: " + (string)target + " You rolled: " +(string)craftResult);                   
                if (craftResult >= target)
                {  
                    debug("Success! index: " +(string)i);     
                    llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP," + (string)(CR*numberToMake));
                    llRegionSayTo(ToucherID, itemChannel, "fGiveItem," + recipeName + "," + (string)(itemGivePerClick)); 
                    successCount++;
                }
                else
                {
                    debug("Failure! index: " +(string)i);
                    failCount++;                    
                }  
            } 
            llRegionSayTo(ToucherID, 0,"You succeeded " + (string)successCount + " times.");                   
            if (failCount > 0)
               llRegionSayTo(ToucherID, 0,"You failed " + (string)failCount + " times.");             
            state waitToReset;  
        }
        else
        {
            llSetText("Working! Time left = " + (string)((integer)(duration - llGetTime())) + " seconds", <1.0,1.0,1.0>, 1.0);
            llSetTimerEvent(1.0); 
        }
    }
}

state waitToReset
{
    state_entry()
    {
        //llSetLinkAlpha(LINK_ALL_OTHERS, 0.0, ALL_SIDES);
        llWhisper(-2121212, "stop");        
        startTime = llGetAndResetTime();
        if (DEBUG)
            duration = 5.0;
        else
            duration = 60.0; 
        integer timeLeft = (integer)(duration - llGetTime());     
        llSetText("Mill resetting. Time left = " + (string)timeLeft + " seconds", <1.0,1.0,1.0>, 1.0);
        llSetTimerEvent(1.0);
    }    
    
    timer()
    {
        llSetTimerEvent(0.0);
        integer timeLeft = (integer)(duration - llGetTime());
        if (timeLeft >= 0)
        {
            llSetText("Mill resetting. Time left = " + (string)timeLeft + " seconds", <1.0,1.0,1.0>, 1.0);
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
