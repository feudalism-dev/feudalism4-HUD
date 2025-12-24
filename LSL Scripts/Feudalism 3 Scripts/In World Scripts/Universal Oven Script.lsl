integer debugMode = FALSE;
integer RECIPECHANNEL = -99001;
integer fireChannel =  -1084924;
integer fireHandle;
integer PLAYERHUDCHANNEL = -77770;
integer recipeListener;
integer itemChannel = -454545;
integer pouchListener;
integer pouchCheck = FALSE;
integer pouchIsWorn = FALSE;
float menuTimer = 30.0;
float startTime;
float duration;
float endTime;
string recipeName;

string noun = "oven";
string verb = "cook";
string verbing = "cooking"; 
string stuff = "ingredients"; 
string instructions = "recipe";  
float cookTime = 20.0;
integer fireIsOn = FALSE;
integer fireCheck = FALSE;

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
integer MAX_ALLOWED = 100;

key ToucherID;
integer toucherCrafting;
integer craftingLoaded = FALSE;
integer CRAFTING = 4;
key transGetConsumableItem;
key transGetStats;
string transKey;


// ingredients management
string name;
string filename;
list categories;
string category;
list ingredientNames;
list ingredientFilenames;
list ingredientCategories;
list ingredientAmounts;
integer numberOfIngredients;
integer numberOfIngredientMessages;
list inventoryItems;
list inventoryQuantities;
integer hasRequiredItems = FALSE;
integer numFound = 0;

list gNames = [];  // Your list of potential menu choices
integer gMenuPosition;  // Index number of the first button on the current page
integer gLsn;   // Dialog Listen Handle


// %%% Static parameters for reading card config: you may change these, but don't have to.
integer ConfigRequired          = FALSE;        // whether to fail if no config cards
string  ConfigNotecardSuffix    = "config";       // string identifying config notecards
float   ConfigTimeout           = 60.0;         // seconds to wait for slow server
 
 
// Globals for reading card config
list    ConfigCards;        // list of names of config notecards
integer ConfigCardIndex;    // index of next card to read

debug(string message)
{
    if (debugMode)
        llOwnerSay(message);   
}

integer next_card()
{
    if (ConfigCardIndex >= llGetListLength(ConfigCards)) {
        ConfigCards = [];
        return (FALSE);
    }
 
    notecardLine = 0;
    notecardName = llList2String(ConfigCards, ConfigCardIndex);
    ConfigCardIndex++;
    //notecardQueryId = llGetNotecardLine(ConfigCardName, ConfigLineIndex);
    notecardQueryId = llGetNotecardLine(notecardName, notecardLine);     
    return (TRUE);
}

getWords()
{

    string description = llGetObjectDesc();
    list descTerms = llCSV2List(description);
    if (llGetListLength(descTerms) == 5)
    {
        noun = llList2String(descTerms, 0);
        verb = llList2String(descTerms, 1);
        verbing = llList2String(descTerms, 2); 
        stuff = llList2String(descTerms, 3);
        instructions = llList2String(descTerms, 4);
    } 
    else
    {
        noun = "oven";
        verb = "cook";
        verbing = "cooking"; 
        stuff = "ingredients";  
        instructions = "recipe";  
        llOwnerSay("The object is missing the terms list so will be configured as an oven. To change it, set the description with the following strings separated by commas: <noun for what this object is>,<verb for what it does>,<verb ending in -ing for what it does,<word for the ingredients used>,<word for the recipes>");
        llOwnerSay("For example: oven,cook,cooking,ingredients,recipe\nor cauldron,brew,brewing,ingredients,formula");              
    }   
}

Menu()
{
    integer Last;
    list Buttons;
    integer All = llGetListLength(gNames);
//llOwnerSay("Menu running.");    
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
    gLsn = llListen(RECIPECHANNEL,"","","");    
    llSetTimerEvent(menuTimer);
    llDialog(ToucherID," \nSelect an item to " + verb + " from the following list:",Buttons,RECIPECHANNEL);
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
    llSetText("",<1.0,1.0,1.0>,1.0);
    getWords();    
    configLoaded = FALSE;    
    recipes = [];
    recipeNames = [];
    toucherCrafting  = 0;
    craftingLoaded = FALSE;
    recipeLoaded = FALSE;
    crLoaded = FALSE;     
    CR = -1;    
    name = "";
    
    string item;
    ConfigCards = [];
    integer n = llGetInventoryNumber(INVENTORY_NOTECARD);
    while (n-- > 0) {
        item = llGetInventoryName(INVENTORY_NOTECARD, n);
        // Note: for simplicity, read cards with the "suffix" anywhere in the name
        if (llSubStringIndex(item, ConfigNotecardSuffix) != -1) {
            ConfigCards += [item];
        }
    }
    ConfigCardIndex = 0;
    if (next_card()) {
        llSetTimerEvent(ConfigTimeout);
    } else {
        llSetTimerEvent(0.0);
        configLoaded = TRUE;    
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

integer getCR(string itemText)
{
    return llAbs(llList2Integer(llCSV2List(itemText), 4));    
}

integer loadRecipe(string recipeName)
{
//llOwnerSay("loadRecipe started.");
    integer result = FALSE;
    integer recipeIndex = -1;
    list recipe = llCSV2List(llLinksetDataRead(recipeName));
//llOwnerSay("Recipe loading... recipe contents: " + llList2CSV(recipe));
    integer count = llGetListLength(recipe);
    integer i = 3;
    ingredientNames = [];
    ingredientAmounts = [];
    numberOfIngredients = 0;
    numberOfIngredientMessages = 0;
    CR = llList2Integer(recipe, 2);
//llOwnerSay("LoadRecipe(), CR: " + (string)CR);
    filename = llList2String(recipe,1);
//llOwnerSay("LoadReceipe(), Filename: " + filename);
    crLoaded == TRUE;
    name = "";
    while (i < count)
    {
        ingredientNames += llList2String(recipe, i);
        ingredientAmounts += llList2Integer(recipe, i+1);
        i += 2;
    } 
    numberOfIngredients = llGetListLength(ingredientNames);
    integer test = llGetListLength(ingredientAmounts);
//llOwnerSay("LoadRecipe(), Ingredients loaded: " + llList2CSV(ingredientNames));        
    if (numberOfIngredients = test)
    {
        name = recipeName;
        result = TRUE; 
//llOwnerSay("Success.");             
    } 
    else
    {
        llRegionSayTo(ToucherID, 0, "The " + noun + " encountered an error processing the " + instructions + " for " + recipeName + "."); 
    } 
    return result;
}

processXPError(integer errorCode, string fieldName)
{
    string errorMessage = "The " + noun + " reports the following error when loading " + fieldName + " data: "; 
    errorMessage += llGetExperienceErrorMessage(errorCode);      
    llOwnerSay(errorMessage);
    //llOwnerSay((string)errorCode);
}

default
{
    state_entry()
    {  
        llOwnerSay(noun + " is restarting.");
        init();
        if (configLoaded)
            state setup;
    }
    
    dataserver(key query_id, string data)
    {
        if (query_id == notecardQueryId)
        {
//llOwnerSay("Data: " + data);            
            if (data == EOF)
            {
//llOwnerSay("Got EOF");                
//                llRegionSayTo(ToucherID, 0"Done reading notecard.");
                if (! next_card())
                {
                    llSetTimerEvent(0.0);                    
                    configLoaded = TRUE;
                    state setup;
                }
            }
            else
            {
//llOwnerSay("Not EOF.");       
                notecardQueryId = llGetNotecardLine(notecardName, ++notecardLine);         
                // bump line number for reporting purposes and in preparation for reading next line
                data = llStringTrim(data, STRING_TRIM);    // chop off any leading or trailing blanks
//llOwnerSay("Data: " + data);                  
                if (data != "" && llGetSubString(data, 0, 0) != "#")     
                {
//llOwnerSay("Valid line.");
                    // DO THIS FOR EACH RECIPE LOADED
                    string recipeKeyName; //The first string to store the first field
                    string recipeKeyValue; //The second string to store the other fields
                    list fields = llCSV2List(data); //Convert the CSV data into a list of fields
//llOwnerSay("Fields read for recipe from notecard: " + llList2CSV(fields));
                    if (llGetListLength(fields) > 0) //Check if the list is not empty
                    {
                        recipeKeyName = llList2String(fields, 0); //Get the first field as the key name
                        //llOwnerSay("Loading recipe named: " + recipeKeyName);                        
                        fields = llDeleteSubList(fields, 0, 0); //Delete the first field from the list
                        recipeKeyValue = llList2CSV(fields); //Convert the remaining fields into a CSV string as the key value
                    }
                    integer freeMemory = llLinksetDataAvailable(); //Get the amount of free memory in bytes
                    integer keyLength = llStringLength(recipeKeyName); //Get the length of the key name in bytes
                    integer valueLength = llStringLength(recipeKeyValue); //Get the length of the key value in bytes
                    integer totalLength = keyLength + valueLength + 2; //Get the total length of the pair in bytes, adding 2 for the separator and terminator
                    if (totalLength <= freeMemory) 
                    { //Check if the pair fits in the free memory
                        if (numberOfRecipes < MAX_ALLOWED) 
                        {
                            llLinksetDataWrite(recipeKeyName, recipeKeyValue); //Write the pair to LinksetData
                            //llOwnerSay("Available memory for recipes: " + (string)llLinksetDataAvailable());
                            numberOfRecipes = llLinksetDataCountKeys();
                            //llOwnerSay("Number of recipes in memory: " + (string)numberOfRecipes);
                        }
                        else
                        {
                            llOwnerSay("You already have " + (string)numberOfRecipes + " loaded. Additional recipes will be ignored.");                       }
                    } else {
                        llOwnerSay("Not enough free memory to store recipe named " + recipeKeyName + ". Additional recipes will be ignored."); //Say an error message to the owner
                    }
                }
                else
                {
//llOwnerSay("Skipped line.");                    
                    // DO NOTHING
                }
            }
        }
    }    
}

state setup
{
    state_entry()
    {
//llOwnerSay("State SETUP: Number of Recipes: " + (string)numberOfRecipes);
        integer i = 0;
        string recipeName = "";
        list recipe;
        recipeNames = [];
        categories = [];
        llMessageLinked(LINK_ALL_OTHERS, 0, "hide", "");
        recipeNames = llLinksetDataListKeys(0, numberOfRecipes);
        while (i < numberOfRecipes)
        {
            // get the name of the recipe from the KeyName in the linkset Data
            recipeName = llList2String(recipeNames, i);
            // convert the CSV data into a list, from reading the linkset data using the recipeName as the key
            recipe = llCSV2List(llLinksetDataRead(recipeName));
            //get the category name, which is the first field of the CSV data
            string catName = llList2String(recipe, 0);
            // if the category name does not exist, add it to the categories list
            if (llListFindList(categories, [catName]) == -1)
            {
                categories += catName;
            }
            i++;
        }      
        llSay(0, "Feudalism " + noun + " is ready for use with " + (string)numberOfRecipes + " " + instructions + "s loaded.");
        llUnSit(ToucherID); 
        state ready; 
    }   
}

state ready
{
    state_entry()
    {
//llOwnerSay("state ready start");
        llOwnerSay(noun + " ready. Free Memory: " + (string)llGetFreeMemory());
        llMessageLinked(LINK_ALL_OTHERS, 0, "hide", "");      
        getWords();
        recipeLoaded = FALSE;
        ingredientNames = [];
        ingredientAmounts = [];
        numberOfIngredients = 0;
        numberOfIngredientMessages = 0;
        crLoaded = FALSE;   
        CR = -1;             
        name = "";
        ToucherID = NULL_KEY;               
    }
    
    touch_start(integer total_number)
    {
        llRegionSayTo(llDetectedKey(0), 0, "Sorry, you must sit on this to use it.");    
    }
    
    link_message(integer sender, integer num, string msg, key id)
    {
debug("msg: " + msg);
        if(num == 90060)
        {
            ToucherID = id;
            pouchIsWorn = FALSE;
            pouchCheck = TRUE;        
            craftingLoaded = FALSE;            
            pouchListener = llListen(itemChannel, "", NULL_KEY, "");
            llRegionSayTo(ToucherID, itemChannel, "detectPouch," + (string)llGetKey());  
            llRegionSayTo(ToucherID, 0, "Detecting if pouch is worn..."); 
            llSetTimerEvent(10.0);            
        }   
        if (num == 90065)
        {
            llSetTimerEvent(0.0);
            llListenRemove(recipeListener); 
            llUnSit(ToucherID); 
            state bounce;   
        } 
        if (msg == "Cook Stew")
        {

            llRegionSayTo(ToucherID, 0, "Checking to see if the fire is on.");
debug("Cook Stew menu selection.");                
            fireHandle = llListen(fireChannel, "","","");
            llWhisper(fireChannel,"checkfire");
            // check if pouch is worn
            llSetTimerEvent(10.0); 
        }
    }

    changed(integer change)
    { 
        if (change & CHANGED_INVENTORY)         
        {
            llSay(0,"The inventory has changed.");
            state default;
        }
    }
    

    listen( integer channel, string name, key id, string message )
    {   
//llOwnerSay("Message received: " + message);      
        if (channel == RECIPECHANNEL)
        {
          
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
            else if (message == "top")
            {
                llListenRemove(gLsn);
                gMenuPosition = 0;
                gNames = categories;
                Menu();                
            }
            else
            {
                if (llListFindList(categories, [message]) != -1)
                {
                    // the user selected a valid category
                    category = message;
//llOwnerSay("Category selected: " + category);                    
                    gMenuPosition = 0;
                    integer i = 0;
                    string recipeCSV;
                    list recipes = llLinksetDataListKeys(0, numberOfRecipes);
//llOwnerSay("Getting list of recipe keys from linkset database:" + (string)recipes);
                    gNames = [];  // clear the gNames list.
                    while (i < numberOfRecipes)
                    {
                        // check if a recipe is in the right category, then add it to the gNames list
                        string recipeName = llList2String(recipes, i);
//llOwnerSay("Checking recipe name " + recipeName + " for the right category");
                        recipeCSV = llLinksetDataRead(recipeName); // lookup recipe from database    
//llOwnerSay("Recipe data: " + recipeCSV);
                        list recipe = llCSV2List(recipeCSV);
                        // only use the ones where the category matches the menu choice (ie message)
                        if (llList2String(recipe, 0) == category)
                        {
//llOwnerSay("Category matched.");                            
                            gNames += recipeName;
                        }
                        else
                        {
//llOwnerSay("Category did not match.");                              
                        }
                        i++;
                    }                    
//llOwnerSay("gNames: " + llList2CSV(gNames));                    
                    gNames += "top";
                    Menu();                    
                }
                else
                {
                    // if message is not a category, it should be a recipe
//llOwnerSay("A message that is NOT a category appeared: Message: " + message);                    
//                    recipeName = llToLower(message);
                    recipeName = message;
                    recipeLoaded = FALSE;
                    recipeLoaded = loadRecipe(recipeName);
                    if (recipeLoaded)
                    {
                        state prepping;                
                    }                   
                    else
                    {
                        llRegionSayTo(ToucherID, 0, "Error: Please select another " + instructions + " .");    
                    }
                //Do whatever the selected button directs..... your choice
                }
            }                
        }
        else if (channel == fireChannel)
        {
debug("Listen: fire channel, message: " + message);            
            llSetTimerEvent(0.0);
            fireIsOn = FALSE;
            fireCheck = TRUE;
            if (message == "yes") 
            {
                llRegionSayTo(ToucherID, 0, "THe fire is on. You may cook. Select the category and recipe from the popup menu.");
                fireIsOn = TRUE;  
                fireCheck = FALSE;
                llListenRemove(gLsn);
                gMenuPosition = 0;
                gNames = categories;
//llOwnerSay("Prepare to display menu for categories.");                    
                Menu();               
            }
            else
            {
                llSetTimerEvent(0.0);
                llRegionSayTo(ToucherID, 0, "The fire is not started.  You must start the fire before you can cook.");
                pouchCheck = FALSE;
                llUnSit(ToucherID); 
                state bounce;
            }
        }
        else if (channel == itemChannel)
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
                    pouchIsWorn = TRUE; 
                    llSetTimerEvent(0.0);
                    pouchCheck = FALSE;
                    llRegionSayTo(ToucherID, 0, "Pouch found...");
                }               
            }
        }
    }  
    
    timer()
    {
        if (pouchCheck)
        {
            llSetTimerEvent(0.0);
            llRegionSayTo(ToucherID, 0, "Your pouch is not being worn. You must wear a Feudalism pouch before you can use this " + noun + ".");
            pouchCheck = FALSE;
            llUnSit(ToucherID); 
            state bounce;
        }
        else if (fireCheck)
        {
            llSetTimerEvent(0.0);
            llRegionSayTo(ToucherID, 0, "The fire is not started.  You must start the fire before you can cook.");
            pouchCheck = FALSE;
            llUnSit(ToucherID); 
            state bounce;            
        }
        else
        {
            llSetTimerEvent(0.0);
            llListenRemove(recipeListener); 
            llUnSit(ToucherID); 
            state bounce; 
        } 
    } 
}

state bounce
{
    state_entry()
    {
        state ready;
    }
}

state prepping
{
    state_entry()
    {
//llOwnerSay("State prepping started.");
//llOwnerSay((string)ingredientNames);
//llOwnerSay((string)ingredientAmounts);
//llOwnerSay((string)numberOfIngredients); 
// change this so that BEFORE asking yess or no, check the inventory
        llRegionSayTo(ToucherID, 0,"Checking inventory for " + stuff + "s.");
        string output = "check,";                
        pouchListener = llListen(itemChannel, "", "", "");
        integer i = 0;        
        llSetTimerEvent(10.0);
        inventoryItems = [];
        inventoryQuantities = [];
        hasRequiredItems = FALSE;
        numberOfIngredients = 0;
        numberOfIngredientMessages = 0;
        numFound = 0;       
//llOwnerSay("State Prepping, state_entry(), Checking inventory for ingredients.");   
//llOwnerSay("State Prepping, state_entry(), Ingredients in recipe: " + llList2CSV(ingredientNames));     
        while (i < llGetListLength(ingredientNames))
        {                                         
            llRegionSayTo(ToucherID, 0, llList2String(ingredientNames, i) + ": " + (string)llList2Integer(ingredientAmounts, i));        
            llRegionSayTo(ToucherID, itemChannel, output + llList2String(ingredientNames, i));
            llSleep(0.1);                
            i++;
        }    
    }
    
    listen( integer channel, string name, key id, string message )
    {  
        if (channel == itemChannel)
        {
            list params = llCSV2List(message);
            if (llGetListLength(params) == 2)
            {
//llOwnerSay("Got item info from pouch: " + message);         
//llOwnerSay("Number of Ingredients at start: " + (string)numberOfIngredients);
                // inventory query returned
                // check if quantity is enough if so, continue, else stop listening and aboart
                string foundItem = llList2String(params, 0);
//llOwnerSay("Found item: " + foundItem);                
                integer foundQuantity = (integer)llList2String(params, 1);
//llOwnerSay("Found quantity: " + (string)foundQuantity);                
                integer recipeIndex = llListFindList(ingredientNames, [foundItem]);             
                if (recipeIndex != -1)
                {
                    numberOfIngredientMessages++;
                    string ingredientName = llList2String(ingredientNames, recipeIndex);
//llOwnerSay("Ingredient Name: " + ingredientName);                    
                    integer ingredientAmount = llList2Integer(ingredientAmounts, recipeIndex);  
//llOwnerSay("Ingredient Amount: " + (string)ingredientAmount);
                    if (foundQuantity >= ingredientAmount)
                    {
//llOwnerSay("Found quantity was greater than or equal to ingredient amount, so you have enough.");                        
                        numberOfIngredients++;
                        llRegionSayTo(ToucherID, 0, "You have enough of item: " + ingredientName);
//llOwnerSay("Listen, numberOfIngredients found: " + (string)numberOfIngredients);                        
                    }
                    else
                    {
//llOwnerSay("Found quantity was less than ingredient amount, so you do not have enough.");                        
                        llRegionSayTo(ToucherID, 0, "You have " + (string)foundQuantity + " of item " + foundItem + " but need " + (string)ingredientAmount + "."); 
                    }
                    if (numberOfIngredientMessages == llGetListLength(ingredientNames))
                    {
                        if (numberOfIngredients == llGetListLength(ingredientNames))
                        {
                            llSetTimerEvent(0.0);
                            // user has all required items, so ask if they want to make
                            hasRequiredItems = TRUE;
                            llRegionSayTo(ToucherID, 0, "You have enough of all the ingredients to make this recipe.");  
                            list buttons = ["Yes", "No"];
                            recipeListener = llListen(RECIPECHANNEL, "", ToucherID, "");        
                            llSetTimerEvent(menuTimer);
                            string dialogText = "\nYou have selected to " + verb + ": " + recipeName + "\n\n";
                            dialogText += "You have all of the ingredients to " + verb + " it?\n\nDo you wish to proceed?";
                            llDialog(ToucherID,dialogText,buttons, RECIPECHANNEL);                               
                        } 
                        else
                        {
                            llRegionSayTo(ToucherID, 0, "You do not have enough of all of the ingredients required for this recipe and cannot make it until you get all of the required items. Please gather more items and try again, or pick a different recipe.");
                            llSetTimerEvent(0.0);
                            llListenRemove(recipeListener);   
                            llListenRemove(pouchListener);   
                            llMessageLinked(LINK_SET,90000,"Stand","");
                            state ready;    
                        } 
                    }
                    
                      
                }
            }            
        }  
        if (channel == RECIPECHANNEL)
        {
            llListenRemove(recipeListener);
            llSetTimerEvent(0.0);
            string answer = llToLower(message);             
            if (answer == "yes")
            {
//llOwnerSay("State Prepping, Listen, Got a yes!");
//llOwnerSay("State Prepping, Listen, numberOfIngredients: " + (string)numberOfIngredients);
//llOwnerSay("IngredientNames: " + llList2CSV(ingredientNames));
//llOwnerSay("IngredientAmounts: " + llList2CSV(ingredientAmounts));
                llMessageLinked(LINK_SET,90000,verb,"");
                llMessageLinked(LINK_ALL_OTHERS, 0, "show", "");
                // TAKE INVENTORY STUFF HERE
                integer i = 0;
                while (i < numberOfIngredients)
                {
                    llRegionSayTo(ToucherID, itemChannel, "fTakeItem," + llList2String(ingredientNames, i) + "," + (string)llList2Integer(ingredientAmounts, i)); 
                    llSleep(0.1);
                    i++;
                }
                numberOfIngredients = 0;
//llOwnerSay("Ok, we're all set. Go to State Brewing");                
                state brewing;                
            }
            else
            {
                if (answer == "no")
                    llRegionSayTo(ToucherID, 0, "You have decided not to " + verb + " the item."); 
                llSetTimerEvent(0.0);
                llListenRemove(recipeListener);   
                llListenRemove(pouchListener);                
                //llUnSit(ToucherID); 
                state ready;             
            }
        } 
            
    }    
    

    
    timer()
    {
        llSetTimerEvent(0.0);
        llMessageLinked(LINK_SET,90000,"Stand","");
        llMessageLinked(LINK_ALL_OTHERS, 0, "show", "");
        llListenRemove(recipeListener);   
        llListenRemove(pouchListener);
        if (numberOfIngredientMessages < llGetListLength(ingredientNames))
            llRegionSayTo(ToucherID, 0, "Timeout received before receiving all items from your pouch contents. Try again later."); 
        else
            llRegionSayTo(ToucherID, 0, "Timeout received while attempting to check inventory contents. Try again later.");       
        //llUnSit(ToucherID); 
        state ready;
    }     
     
}

state brewing
{
    state_entry()
    {
//llOwnerSay("State Brewing started.");
        transGetStats = llReadKeyValue((string)ToucherID + "_stats");  
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
                startTime = llGetAndResetTime();
                duration = (CR + 1) * cookTime;
                string output = verbing + " item. Time left = " + (string)((integer)(duration - llGetTime())) + " seconds";
                llRegionSayTo(ToucherID, 0, output);   
                llSetText(output, <1.0,1.0,1.0>, 1.0);
                llSetTimerEvent(1.0);                
//llOwnerSay("Crafting: " + (string)toucherCrafting);                       
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
//llOwnerSay("Brewing, timer hit.");
        llSetTimerEvent(0.0);
        if (llGetTime() >= duration)
        {
//llOwnerSay("Brewing: toucherCrafting = " + (string)toucherCrafting);
            integer craftResult = rollDice(toucherCrafting);
//llOwnerSay("Brewing: crafterResult = " + (string)craftResult);            
            integer CR_result = rollDice(CR);
//llOwnerSay("Brewing: CR target: " + (string)CR_result);
            llSetText("",<1.0,1.0,1.0>,1.0);
            if (craftResult >= CR_result)
            {
                // brewing is successful
                llRegionSayTo(ToucherID, 0,"You successfully made " + recipeName + ". Sending you a " + filename + ".");   
                state full; 
            }  
            else
            {
                // brewing failed
                llRegionSayTo(ToucherID, 0,"You fail to " + verb + " a " + filename + ".");               
                state failed;              
            }            
        }
        else
        {
            string output = verbing + "... Time left = " + (string)((integer)(duration - llGetTime())) + " seconds";
            //llRegionSayTo(ToucherID, 0, output);
            llSetText(output, <1.0,1.0,1.0>, 1.0);
            llSetTimerEvent(1.0); 
        }
    }
    
    
    
    
     
}


state failed
{
    state_entry()
    {
        llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP," + (string)(CR+1));
        llMessageLinked(LINK_ALL_OTHERS, 0, "hide", "");
        llUnSit(ToucherID); 
        state ready;
    }   
}

state full
{
    state_entry()
    {
        llRegionSayTo(ToucherID, PLAYERHUDCHANNEL, "gainXP," + (string)((CR+1)*10));
//llOwnerSay("Giving item: " + filename);   
        if (llToLower(filename) == "pouch")   
            llRegionSayTo(ToucherID, itemChannel, "fGiveItem," + name + ",1");
        else
            llGiveInventory(ToucherID, filename);
        llMessageLinked(LINK_ALL_OTHERS, 0, "hide", "");
        llUnSit(ToucherID);
        state ready;
    }
 
}
