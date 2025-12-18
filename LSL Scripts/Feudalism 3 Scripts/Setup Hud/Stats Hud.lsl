integer DEBUG = FALSE;

integer listener;
integer hudChannel = -55667791;


string myGender;
string keyName;
key trans = NULL_KEY;
integer kvCreated = FALSE;

key transGetStats;
key transSetStats;
key transGetXP;
key transGetClass;
integer statsLoaded = FALSE;
integer xpLoaded = FALSE;
integer classLoaded = FALSE;



list statNames = ["agility","animal handling","athletics","awareness","crafting","deception","endurance","entertaining","fighting",
"healing","influence","intelligence","knowledge","marksmanship","persuasion","stealth","survival","thievery","will","wisdom"];
list playerStats = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];  // This is the starting value for the Player... all 2's
list statLinkNums;

list classNames = ["academic", "adventurer", "advisor", "alchemist", "apothecary", "apprentice", "archer", "artillerist", "artisan", "artist", "assassin", "bailiff", "bandit", "barbarian", "bard", "beggar", "boatman", "bountyhunter", "burgher", "burglar", "castellan", "cavalry", "censor", "charlatan", "cleric", "coachman", "conartist", "courtesan", "courtier", "craftsman", "cultist", "cutpurse", "druid", "duelist", "enchanter", "engineer", "entertainer", "envoy", "executioner", "farmer", "fence", "footwizard", "forager", "forger", "guard", "healer", "hedgeknight", "hedgemage", "herald", "herbalist", "herder", "highwayman", "hunter", "interrogator", "investigator", "jailer", "knight", "lawyer", "mage", "marshal", "mercenary", "merchant", "messenger", "miner", "monk", "necromancer", "noble", "nun", "outlaw", "paladin", "peasant", "pedlar", "physician", "pirate", "pitfighter", "priest", "raider", "ranger", "rogue", "royalguard", "royal", "sage", "sailor", "scholar", "scout", "seer", "sentinel", "servant", "shadowmage", "shaman", "sheriff", "slave", "smith", "smuggler", "soldier", "sorcerer", "spearman", "spellmonger", "spy", "squire", "steward", "student", "swordmaster", "swornsword", "tavernhelp", "thaumaturge", "thief", "tribesman", "villager", "warden", "warlock", "warmage", "warrior", "watchman", "whisperer", "whore", "wildling", "witch", "witchhunter", "wizard", "woodsman", "yeoman", "zealot"];

// define the list of stats max's by class

list myClassMaxStats;

integer startingPoints = 0;
integer availablePoints;

integer leftDigitIndex = -1;
integer rightDigitIndex = -1;
integer hundredDigitIndex = -1;
integer numberOfStats = 20;
integer classIsSet = FALSE;
string myClass = "adventurer";
integer myXPSpent = 0;
integer myXPToSpend = 0;
integer myXP = 0;

hideHud()
{
    llSetPos(llGetLocalPos() + <0,0,1>);      
}

showHud()
{
    llSetPos(<0,0,0>);      
    
}

integer getMaxStat(string myClass, integer statNumber)
{
    return llList2Integer(myClassMaxStats, statNumber);        
}           

setLinkTextureFast(integer link, string texture, integer face)
{
    // Obtain the current texture parameters and replace the texture only.
    // If we are going to apply the texture to ALL_SIDES, we need
    // to adjust the returned parameters in a loop, so that each face
    // keeps its current repeats, offsets and rotation.
    list Params = llGetLinkPrimitiveParams(link, [PRIM_TEXTURE, face]);
    integer idx;
    face *= face > 0; // Make it zero if it was ALL_SIDES
    // This part is tricky. The list returned by llGLPP has a 4 element stride
    // (texture, repeats, offsets, angle). But as we modify it, we add two
    // elements to each, so the completed part of the list has 6 elements per
    // stride.
    integer NumSides = llGetListLength(Params) / 4; // At this point, 4 elements per stride
    for (idx = 0; idx < NumSides; ++idx)
    {
        // The part we've completed has 6 elements per stride, thus the *6.
        Params = llListReplaceList(Params, [PRIM_TEXTURE, face++, texture], idx*6, idx*6);
    }
    llSetLinkPrimitiveParamsFast(link, Params);
}

setPlayerStats()
{
    integer i = 0;
    while (i < numberOfStats)
    {
        integer statLinkNumber = llList2Integer(statLinkNums, i);
        setLinkTextureFast(statLinkNumber, llList2String(playerStats, i), 4);  
        i++;   
    }
}

integer getLinkNumberByName (string linkName)
{
    integer i = 0;                      
    while (i <= llGetNumberOfPrims()) 
    {      
       if (llGetLinkName(i) == linkName)
            return i;
    i++;
    } 
    return -1;  
}

calculateAP()
{
    myXPToSpend = 0;
    myXPSpent = 0;
    integer i = 0;
    while (i < numberOfStats)
    {
        integer statValue = llList2Integer(playerStats, i);
        while (statValue >= 2)
        {
            myXPSpent += (integer)llPow(2.0, (float)(statValue - 2)) * 1000;
            statValue--;
        }
        i++;    
    }
    myXPToSpend = (myXP + 20000) - myXPSpent;
    availablePoints = (myXPToSpend / 1000);
//llOwnerSay("AvailablePoints: " + (string)availablePoints);         
    if (availablePoints < 0)  // negative value indicates that the user spend more than earned... possible due to a bug that this code fixes
    {
        llOwnerSay("Due to a previous issue, you were able to spent more Available Points than you had earned with XP. Your Available Points are negative, but will be displayed as 0. You need to lower your stats until this error message goes away.");
        availablePoints = 0;
    } 
    setAvailablePoints();  
    
}

setAvailablePoints(){
    if (leftDigitIndex != -1 && rightDigitIndex != -1 && hundredDigitIndex != -1)
    {    
        integer tempPoints = availablePoints;
        string leftDigit;
        string rightDigit;
        string hundredDigit;
        if (availablePoints > 99)
        {
            if (availablePoints < 200)
            {
                hundredDigit = "1";
                tempPoints -= 100;
            }
            else if (availablePoints < 300)
            {
                hundredDigit = "2";  
                tempPoints -= 200;                              
            }
            else if (availablePoints < 400)
            {
                hundredDigit = "3";
                tempPoints -= 300;                                
            }
            else if (availablePoints < 500)
            {
                hundredDigit = "4";
                tempPoints -= 400;                                
            }
            else if (availablePoints < 600)
            {
                hundredDigit = "5";
                tempPoints -= 500;                                
            }
            else if (availablePoints < 700)
            {
                hundredDigit = "6";
                tempPoints -= 600;                                
            }
            else if (availablePoints < 800)
            {
                hundredDigit = "7";
                tempPoints -= 700;                                
            }
            else if (availablePoints < 900)
            {
                hundredDigit = "8";
                tempPoints -= 800;                                
            }
            else if (availablePoints < 1000)
            {
                hundredDigit = "9";
                tempPoints -= 800;                                
            }                            
            setLinkTextureFast(hundredDigitIndex, hundredDigit, 4);            
        }
        leftDigit = (string)((integer)tempPoints / 10);
        rightDigit = (string)(tempPoints % 10);
        setLinkTextureFast(leftDigitIndex, leftDigit, 4);                         // set the texture for the link using the link number found above
        setLinkTextureFast(rightDigitIndex, rightDigit, 4);   
    }
}

decrementStat(integer statIndex, integer linkNum) {
    integer stat = llList2Integer(playerStats, statIndex);
//    integer rewardForDecrease = (integer)llPow(2, stat - 2);
    if (stat > 1) {
        stat = stat - 1;
        playerStats = llListReplaceList(playerStats, [stat], statIndex, statIndex);
        
        //availablePoints += rewardForDecrease;
        calculateAP();
        setAvailablePoints();        
        setLinkTextureFast(linkNum, (string)stat, 4);
        string statName = llList2String(statNames, statIndex);
        llOwnerSay("You subtracted 1 point from " + statName + ". You have " + (string)availablePoints + " available.");        
    } else {
        llOwnerSay("You cannot set a value lower than 1.");    
    }
    
}

incrementStat(integer statIndex, integer linkNum) {
    integer stat = llList2Integer(playerStats, statIndex);
    integer costOfIncrease = (integer)llPow(2, stat - 1);

    if (availablePoints >= costOfIncrease) {
        if (stat < 9) {

        integer max = getMaxStat(myClass, statIndex);
//llOwnerSay("Class= " + myClass + "Stat= " + (string)stat + " Max= " + (string)max);
            if (stat < max)
            {
                stat = stat + 1;
                playerStats = llListReplaceList(playerStats, [stat], statIndex, statIndex);
                //availablePoints -= costOfIncrease;
                calculateAP();
                setAvailablePoints();
                setLinkTextureFast(linkNum, (string)stat, 4); 
                string statName = llList2String(statNames, statIndex);              
                llOwnerSay("You added 1 point to " + statName + ". You have " + (string)availablePoints + " available."); 
                llOwnerSay("Your class of " + myClass + " sets the maximum value for this stat to be " + (string)max + " .");                   
            }
            else 
            {
                llOwnerSay("Your class of " + myClass + " sets the maximum value for this stat to be " + (string)max + " .");    
            }    
        } else {
            llOwnerSay("You cannot set a value higher than 9.");    
        }    
    } else {
        llOwnerSay("You do not have enough available points.");    
    }
}


//////////////////////////////////////////////////////////////////////////////////////
//
//
//
//         MAIN SCRIP STARTS HERE
//
//
//
//////////////////////////////////////////////////////////////////////////////////////

// Default state can do any init you need that doesn't require configuration.


 
default
{
    state_entry()
    {
//        filter = llLinksetDataRead("filter");
//        llOwnerSay("Filter: " + filter);
//        if (filter == "all")
//            classNames = classNames_all;  
        llOwnerSay("Free memory: " + (string)llGetFreeMemory( )); 
    }     
    
    on_rez(integer start_parameter)
    {   // Start listening for a message from rezzer
//llOwnerSay("Stats HUD has been rezzed");

        llRequestExperiencePermissions(llGetOwner(), "");
        llSetTimerEvent(60.0);        
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
//llOwnerSay("Experience permissions accepted");   
        llSetTimerEvent(0.0); 
        llAttachToAvatarTemp(ATTACH_HUD_CENTER_1);
        //llOwnerSay("Stats Hud Attached");
        if (llGetAttached() == 0)
        {   // Attaching failed  
//llOwnerSay("Attaching failed.");              
           // llDie();
        }
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
        llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }
 
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {
            llSetTimerEvent(0.0);
            // From this point, the object can start doing whatever it needs to do.
            hideHud();
            state running;
        }
        else
        {
            // llOwnerSay("No longer attached");
            llDie();
        }
    }
 
    timer()
    {   // Use a timer to catch no permissions response
         //llOwnerSay("Permissions timer expired");
        llDie();
    }
} 
 
state running
{
    state_entry() 
    {

        // set character stats to be default
        playerStats = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];
        myClass = "adventurer";
        myXP = 0;
        myXPSpent = 0;
        availablePoints = 0;

        // assume nothing has loaded        
        statsLoaded = FALSE;
        xpLoaded = FALSE;
        classLoaded = FALSE;
 


        // try to load everything              
        transGetStats = llReadKeyValue((string)llGetOwner() + "_stats");
        transGetXP = llReadKeyValue((string)llGetOwner() + "_xp");
        transGetClass = llReadKeyValue((string)llGetOwner() + "_class");
        llSetTimerEvent(2.0);
        
        listener = llListen(hudChannel, "", NULL_KEY, "");          
        DEBUG = (integer)llGetObjectDesc();
        statLinkNums = [];
        
        integer statIndex = 0;
        integer linkNumber;
        string linkName;
        integer numOfPrims = llGetNumberOfPrims();
 
         linkNumber = 0;
        // cycle through once to get the Available Stats Prims link numbers;
        while (linkNumber <=numOfPrims) {      
            linkName = llGetLinkName(linkNumber);
            if (linkName == "available left") 
            {
                leftDigitIndex = linkNumber;
            }
            else if (linkName == "available right")
            {
                rightDigitIndex = linkNumber;   
            } 
            else if (linkName == "available hundred")
            {
                hundredDigitIndex = linkNumber;    
            }
            linkNumber++;
        }
        

        while (statIndex <  numberOfStats)
        {   
            linkNumber = 0;
            while (linkNumber <= numOfPrims)
            {
                linkName = llGetLinkName(linkNumber);
                if (linkName == llList2String(statNames, statIndex))
                {
                    statLinkNums = statLinkNums + linkNumber; 
                    linkNumber = numOfPrims; // found for this cycle, so exit
                }
                else 
                {
                    linkNumber++;    
                }
            }
            statIndex++;
        }        
        llOwnerSay("Free memory: " + (string)llGetFreeMemory( )); 
        // now, if the stuff is loaded, set it up, otherwise, set a 5 second timer and do it in 
        // the timer event        
    }    
    
    attach(key id)
    {
        if (id == NULL_KEY)
        {   // if the object ever un-attaches, make sure it deletes itself
            // llOwnerSay("No longer attached");
            llDie();
        }
    }          
    
    listen(integer channel, string name, key id, string text)
    {   // Listen for the message from the rezzer with the target agent key
        if (channel == hudChannel)
        {   // Ask for the experience permission
            if (text == "HIDE")
            {
                hideHud();
            }
            else if (text == "SHOW")
            {
// everytime the menu loads, it has to recheck the xp and class as they could have changed.
                keyName = (string)llGetOwner() + "_class";             
                transGetClass = llReadKeyValue(keyName);  // check to see if the stats key/value exists              
                showHud();
          
            }
            else if (text == "KILL")
            {
                llRequestExperiencePermissions(llGetOwner(), "");
                llListenRemove(listener);                
                llSetTimerEvent(60.0); 
            }            
        }
    } 
       
    
    touch_start(integer num_detected)
    {
     //linkNum = llDetectedLinkNumber(0);                       // when someone touches one of the plus or minus buttons,
        string linkName = llGetLinkName(llDetectedLinkNumber(0));
        string stat = "";
        integer stringIndex;
        integer statXref;
        integer statLinkNum;
        if ((stringIndex = llSubStringIndex(linkName, ",plus")) != -1)
        {
            // this is INCREMENT
            stat = llGetSubString(linkName, 0, stringIndex-1);
            statXref = llListFindList(statNames, [stat]);
            if (statXref != -1)
            {
                statLinkNum = llList2Integer(statLinkNums, statXref); 
                //llOwnerSay("stat Xref: " + (string)statXref + ", statLinkNum: " + (string)statLinkNum + ", Stat" + stat);           
                incrementStat(statXref, statLinkNum);
            }
            
        }
        else if ((stringIndex = llSubStringIndex(linkName, ",minus")) != -1)
        {
            // this is DECREMENT
            stat = llGetSubString(linkName, 0, stringIndex-1);
            statXref = llListFindList(statNames, [stat]);
            if (statXref != -1)
            {            
                statLinkNum = llList2Integer(statLinkNums, statXref);  
                //llOwnerSay("stat Xref: " + (string)statXref + ", statLinkNum: " + (string)statLinkNum + ", Stat" + stat);                                
                decrementStat(statXref, statLinkNum);                         
            }                                             
        }
        else if (linkName == "stats_save")
        { 
           // save stats to experience
           //llOwnerSay("Save Experience");
           //llOwnerSay("ownerkey: " + (string)ownerKey + " stats: " + (string)llList2CSV(playerStats));
           // EXPERIENCE CODING
           // always use update, even the fist time as if the key does not exist, it will be created
            keyName = (string)llGetOwner() + "_stats";               
            transSetStats = llUpdateKeyValue(keyName, llList2CSV(playerStats), FALSE, "");
        }
        else if (linkName == "stats_exit" || linkName == "stats_cancel")
        {
            hideHud();                        
        }
        else 
        {
            // do nothing
           // llOwnerSay("Do nothing.");    
        }
                                                              
    
    } 
    
    link_message(integer source, integer num, string message, key id)
    {
        myClassMaxStats = llCSV2List(message);
    }    

    dataserver(key t, string value)
    {           
        if (t == transSetStats)
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                llOwnerSay("Your stats were successfully saved to the database.");
                statsLoaded = TRUE;
                hideHud();                
            }
            else
            {
                integer error = llList2Integer(result, 1);
                if(error == XP_ERROR_RETRY_UPDATE)
                    llOwnerSay("Could not save your stats to the database.");
                else
                    llOwnerSay("Could not save your stats to the database.");
            }        
        trans = NULL_KEY;            
        }
        
        else if (t == transGetClass)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myClass =  llGetSubString(value, 2, -1);
                llOwnerSay("Your class of " + myClass + " was read from the database and  the maximum limits for your stats have been set.");
                llMessageLinked(LINK_THIS, llListFindList(classNames, [myClass]), "getMaxStats", "");
                classLoaded = TRUE;                                
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                myClass = "adventurer";
                classLoaded = TRUE;
            }
            //keyName = (string)llGetOwner() + "_xp";      
            //transReason = "getXP";         
            //trans = llReadKeyValue(keyName);  // check to see if the stats key/value exists 
            trans = NULL_KEY;  
        }

        else if (t == transGetXP)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myXP =  (integer)llGetSubString(value, 2, -1);  
                xpLoaded = TRUE;                          
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                myXP = 0;
                xpLoaded = TRUE;
                //llOwnerSay("Your xp were not found in the database and may not have been saved yet.");
            }
           // keyName = (string)llGetOwner() + "_stats";      
           // transReason = "getStats";         
            //trans = llReadKeyValue(keyName);  // check to see if the stats key/value exists 
            trans = NULL_KEY;
        }
        
                
        else if (t == transGetStats)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read

                value = llGetSubString(value, 2, -1);
                llOwnerSay("Your stats were read from the database.");
                kvCreated = TRUE;
                list readStats = llCSV2List(value);
                list tempPlayerStats = [];
//llOwnerSay((string)tempPlayerStats);                
                //playerStats = [];
                integer i = 0;
                while (i < numberOfStats) 
                {
                    tempPlayerStats = tempPlayerStats + llList2Integer(readStats, i);
                    i++;
                }
                //integer tempAvailablePoints = llList2Integer(readStats,20);
                playerStats = tempPlayerStats;
//llOwnerSay((string)playerStats);                   
                statsLoaded = TRUE;
                trans = NULL_KEY;
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                playerStats = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];
//llOwnerSay("Stats not loaded, setting defaults: " + (string)playerStats);                
                statsLoaded = TRUE;
            }
            trans = NULL_KEY;
        }        
        
    }
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
       // llOwnerSay("Trying llAttachToAvatarTemp()");
        llDetachFromAvatar();
       // llOwnerSay("Detaching from avatar.");
        llSetTimerEvent(0.0);
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
       // llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }  
 
    timer()
    {   // Use a timer to catch no permissions response
       // llOwnerSay("Permissions timer expired");
        llSetTimerEvent(0.0);
        
        if (statsLoaded) 
        {
            setPlayerStats(); 
            if (xpLoaded)
            {
                calculateAP();
                llOwnerSay("RP Stats Hud setup complete. Ready for use."); 
                llOwnerSay("You have " + (string)availablePoints + " points available to customize your character. Add or substract points from each stat to use all available points.");   

                         
            }
            else
            {
                llSetTimerEvent(2.0); 
            }
        }
        else 
        {
            llSetTimerEvent(2.0);
        }
    }    
    
    
    
}
