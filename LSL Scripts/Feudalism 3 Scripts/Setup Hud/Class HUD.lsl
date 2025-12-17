integer DEBUG = FALSE;

integer listener;
integer hudChannel = -55667792;
integer meterChannel = -77777;

string myGender;
string keyName;
key trans = NULL_KEY;
string transReason = "none";
string filter;

string requestReason = "detach";

// variables used for game stats

list statNames = ["agility","animal handling","athletics","awareness","crafting","deception","endurance","entertaining","fighting",
"healing","influence","intelligence","knowledge","marksmanship","persuasion","stealth","survival","thievery","will","wisdom"];
list playerStats = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2];


// game Stats Constants

integer AGILITY = 0;
integer ANIMAL = 1;
integer ATHLETICS = 2;
integer AWARENESS = 3;
integer CRAFTING = 4;
integer DECEPTION = 5;
integer ENDURANCE = 6;
integer ENTERTAINING = 7;
integer FIGHTING = 8;
integer HEALING = 9;
integer INFLUENCE = 10;
integer INTELLIGENCE = 11;
integer KNOWLEDGE = 12;
integer MARKSMANSHIP = 13;
integer PERSUASION = 14;
integer STEALTH = 15;
integer SURVIVAL = 16;
integer THIEVERY = 17;
integer WILL = 18;
integer WISDOM = 19;

integer NUMBEROFSTATS = 20;

string myClass = "none";
integer classIndex = 0;
list thumbClassList;
integer availablePoints;

string selectedClass = "none";
string displayingClass = "academic"; // set to the name of the default class
string defaultClass = "academic";

//list classNames = [];

list classNames = ["academic", "adventurer", "advisor", "alchemist", "apothecary", "apprentice", "archer", "artillerist", "artisan", "artist", "assassin", "bailiff", "bandit", "barbarian", "bard", "beggar", "boatman", "bountyhunter", "burgher", "burglar", "castellan", "cavalry", "censor", "charlatan", "cleric", "coachman", "conartist", "courtesan", "courtier", "craftsman", "cultist", "cutpurse", "druid", "duelist", "enchanter", "engineer", "entertainer", "envoy", "executioner", "farmer", "fence", "footwizard", "forager", "forger", "guard", "healer", "hedgeknight", "hedgemage", "herald", "herbalist", "herder", "highwayman", "hunter", "interrogator", "investigator", "jailer", "knight", "lawyer", "mage", "marshal", "mercenary", "merchant", "messenger", "miner", "monk", "necromancer", "noble", "nun", "outlaw", "paladin", "peasant", "pedlar", "physician", "pirate", "pitfighter", "priest", "raider", "ranger", "rogue", "royalguard", "royal", "sage", "sailor", "scholar", "scout", "seer", "sentinel", "servant", "shadowmage", "shaman", "sheriff", "slave", "smith", "smuggler", "soldier", "sorcerer", "spearman", "spellmonger", "spy", "squire", "steward", "student", "swordmaster", "swornsword", "tavernhelp", "thaumaturge", "thief", "tribesman", "villager", "warden", "warlock", "warmage", "warrior", "watchman", "whisperer", "whore", "wildling", "witch", "witchhunter", "wizard", "woodsman", "yeoman", "zealot"];

integer numberClasses;
integer displayingClassThumbsPage = 0;
integer NUMBER_OF_THUMBS_PER_PAGE = 7;
list thumbClasses = ["academic","adventurer","advisor","alchemist","apothecary","apprentice","archer"];
integer numThumbs;
integer numPages;

// listeners

setThumbnails()
{
    string thumbImagePrefix = "Class_Overview_";
    string thumbLinkNamePrefix = "class_thumb";
    string thumbImageName;
    integer link;
    string thumbLinkName; 
    string className;
    thumbClassList = [];
    integer i = 0;
    while (i < NUMBER_OF_THUMBS_PER_PAGE)
    {
        if (classIndex < llGetListLength(classNames) && classIndex >= 0)
        {
        }
        else
        {
            classIndex = 0;
      
        }  
        className = llList2String(classNames, classIndex);
        thumbClassList += className;
        thumbImageName = thumbImagePrefix + className;
        thumbLinkName = thumbLinkNamePrefix + (string)(i + 1); // have to add 1 since the actual links are named 1-7 not 0-6
        link = getLinkNumberByName(thumbLinkName);        
        setLinkTextureFast(link, thumbImageName, 4);         
        classIndex++;          
        i++;    
    }
    thumbClasses = thumbClassList;
//    llOwnerSay("thumbs: " + llList2CSV(thumbClassList));
}

setClassThumbsPage(integer page) {
    
    integer i = 0;
    string thumbImagePrefix = "Class_Overview_";
    string thumbLinkNamePrefix = "class_thumb";
    string className;
    string thumbImageName;
    integer startingIndexForClassNames;
    integer currentIndexForClassNames;
    integer link;
    string thumbLinkName;

    thumbClasses = [];
    startingIndexForClassNames = NUMBER_OF_THUMBS_PER_PAGE * (page);        
    while (i < NUMBER_OF_THUMBS_PER_PAGE) {
        currentIndexForClassNames = startingIndexForClassNames + i;
        className = llList2String(classNames, currentIndexForClassNames);
        thumbClasses += className;
        if (className == "none")
        {
            thumbImageName = thumbImagePrefix + "none";
        }
        thumbImageName = thumbImagePrefix + className;
        thumbLinkName = thumbLinkNamePrefix + (string)(i + 1); // have to add 1 since the actual links are named 1-7 not 0-6
        link = getLinkNumberByName(thumbLinkName);        
        setLinkTextureFast(link, thumbImageName, 4);    
        i++;        
    }
}

setDisplayingClass(string className) {
    string classImagePrefix = "Class_Overview_";
    string classImageName;
    string classTextImagePrefix = "classText_";    
    string classTextImageName;
    integer link;
//llOwnerSay("SetDisplayingClass: " + className);    
    if (className == "none")
    {
        classImageName = classImagePrefix + "none";
        classTextImageName = classTextImagePrefix + "none";
    }
    else
    {
        classImageName = classImagePrefix + className;
        classTextImageName = classTextImagePrefix + className;
    }
    link = getLinkNumberByName("class_image");
    setLinkTextureFast(link, classImageName, 4);    
    link = getLinkNumberByName("class_text");
    setLinkTextureFast(link, classTextImageName, 4);
    displayingClass = className;
    link = getLinkNumberByName("class_selected");
    if (displayingClass == selectedClass || className == "none") {
        llSetLinkAlpha(link, 1.0, ALL_SIDES);        
    } else {
        llSetLinkAlpha(link, 0.0, ALL_SIDES);    
    }
    
}

setSelectedClass() {
    integer link;
    
    link = getLinkNumberByName("class_selected");
    llSetLinkAlpha(link, 1.0, ALL_SIDES);  
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
        filter = llLinksetDataRead("filter");
//        llOwnerSay("Filter: " + filter);
//        if (filter == "all")
//            classNames = classNames_all;  
        setDisplayingClass("academic");  
        llOwnerSay("Free memory: " + (string)llGetFreeMemory( ));     
    }    
    
    on_rez(integer start_parameter)
    {   // Start listening for a message from rezzer
//llOwnerSay("Class HUD has been rezzed");

        llRequestExperiencePermissions(llGetOwner(), "");
        llSetTimerEvent(60.0);           
    }
    
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
llOwnerSay("Experience Permissions accepted");
        llSetTimerEvent(0.0);      
        llAttachToAvatarTemp(ATTACH_HUD_CENTER_1);
         //llOwnerSay("After llAttachToAvatarTemp() with llGetAttached() returning " + (string)llGetAttached());
        if (llGetAttached() == 0)
        {   // Attaching failed
            llDie();
        }
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
//llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }
 
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {
            llSetTimerEvent(0.0);
             //llOwnerSay("Now attached with a key " + (string)id + " and llGetAttached() returning " + (string)llGetAttached());
            // From this point, the object can start doing whatever it needs to do.
            state running;
        }
        else
        {
             //llOwnerSay("No longer attached");
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
llOwnerSay("State Running - Number of Classes: " + (string)llGetListLength(classNames));        
        classIndex = 0;
        setThumbnails();
        setDisplayingClass("academic");
        numThumbs = llGetListLength(classNames);
        if (numThumbs % 7)
            numPages = (numThumbs / 7)+1;
        else
            numPages = numThumbs /7;
        numPages--;
        //llOwnerSay("off and running!");
        listener = llListen(hudChannel, "", NULL_KEY, "");          
        DEBUG = (integer)llGetObjectDesc();
        //llOwnerSay("Bandor's RPG Class Selection Hud Starting .... please wait");  
                   
        //llOwnerSay("RP Hud Class Selection setup complete. Ready for use."); 
 
        keyName = (string)llGetOwner() + "_class";             
        trans = llReadKeyValue(keyName);  // check to see if the stats key/value exists
        transReason = "getClass";  
    }  
    
    on_rez(integer start_parameter)
    {   // Start listening for a message from rezzer
//llOwnerSay("Class HUD has been rezzed");
        
        requestReason = "rez";
        llRequestExperiencePermissions(llGetOwner(), "");
        llSetTimerEvent(60.0);          
    }
     
    
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {
            llSetTimerEvent(0.0);
//            setDisplayingClass("academic");  
             //llOwnerSay("Now attached with a key " + (string)id + " and llGetAttached() returning " + (string)llGetAttached());
            // From this point, the object can start doing whatever it needs to do.
            //state running;
        }
        else
        {
             //llOwnerSay("No longer attached");
            llDie();
        }
    }         
    
    listen(integer channel, string name, key id, string text)
    {   // Listen for the message from the rezzer with the target agent key
        if (channel == hudChannel)
        {   // Ask for the experience permission
                if (text == "KILL")
                {
                    requestReason = "detach";
                    llRequestExperiencePermissions(llGetOwner(), "");
                    llSetTimerEvent(60.0);  
                }
        }
    } 
    
    touch_start(integer num_detected)
    {
        string action = llGetLinkName(llDetectedLinkNumber(0));
        string stat = "";
        integer stringIndex;
        integer statXref;
        integer statLinkNum;
            
        if ( action == "class_next") 
        {
//llOwnerSay("On Click class index: " + (string)classIndex);            
            if (classIndex >= llGetListLength(classNames)) 
            {
                classIndex = 0;    
            }
//llOwnerSay("After Click class index: " + (string)classIndex);             
            setThumbnails();           
        } 
        else if ( action == "class_previous") 
        {
//llOwnerSay("On Click class index: " + (string)classIndex); 
            if (classIndex < 14)
                classIndex = llGetListLength(classNames) - (14 - classIndex);
            else            
                classIndex -= 14;
//llOwnerSay("After Click class index: " + (string)classIndex);                 
            setThumbnails();
        } 
        else if ( action == "class_select") 
        {
            if (displayingClass != "none")
            {
                myClass = displayingClass;
                selectedClass = displayingClass;
                setSelectedClass();
                transReason = "classUpdate";
                trans = llUpdateKeyValue(keyName, myClass, FALSE, ""); 
                llRegionSayTo(llGetOwner(), meterChannel, "class," + myClass);             
            }
         }
        else if ( action == "class_exit") 
        {
            requestReason = "detach";
            llRequestExperiencePermissions(llGetOwner(), "");
            llSetTimerEvent(60.0);              
        }         
        else if (action == "class_thumb1") 
        {
            setDisplayingClass(llList2String(thumbClasses, 0));                            
        }
        else if (action == "class_thumb2") 
        {       
            setDisplayingClass(llList2String(thumbClasses, 1));                    
        }
        else if (action == "class_thumb3") 
        {
            setDisplayingClass(llList2String(thumbClasses, 2));                    
        }
        else if (action == "class_thumb4") 
        {
            setDisplayingClass(llList2String(thumbClasses, 3));                    
        }
        else if (action == "class_thumb5") 
        {
            setDisplayingClass(llList2String(thumbClasses, 4));                    
        }
        else if (action == "class_thumb6") 
        {
            setDisplayingClass(llList2String(thumbClasses, 5));                    
        }
        else if (action == "class_thumb7") {
            setDisplayingClass(llList2String(thumbClasses, 6));                    
        }
        else 
        {
            // do nothing
        }            
    } 

    dataserver(key t, string value)
    {
        if (t == trans && transReason == "getClass")
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myClass =  llGetSubString(value, 2, -1);
                if (myClass != "none")
                {
                    selectedClass = myClass;
                    setDisplayingClass(myClass);
                    llOwnerSay("Your class of " + myClass + " was read from the database.");                                
                }
                else
                    setDisplayingClass("academic");
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("Your class was not found in the database and may not have been saved yet.");
                myClass = "none";
                selectedClass = "none";
                setDisplayingClass("academic");                
            }
            transReason = "none";
            trans = NULL_KEY;
        } 
        if (t == trans && transReason == "classUpdate")
        {
            // our llUpdateKeyValue transaction is done
            list result = llCSV2List(value);
            if (llList2Integer(result, 0) == 1)
            {
                // the key-value pair was successfully updated
                llOwnerSay("Your class of " + myClass + " was successfully saved to the database.");
            }
            else
            {
                integer error = llList2Integer(result, 1);
                if(error == XP_ERROR_RETRY_UPDATE)
                    llOwnerSay("Could not save your class to the database.");
                else
                    llOwnerSay("Could not save your class to the database.");
            }  
        }
        trans = NULL_KEY;
        transReason = "none";                         
    }  

    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        if (requestReason == "rez")
        {
            llSetTimerEvent(0.0);      
            llAttachToAvatarTemp(ATTACH_HUD_CENTER_1);
            requestReason = "detach";
             //llOwnerSay("After llAttachToAvatarTemp() with llGetAttached() returning " + (string)llGetAttached());
//            showHud();
            if (llGetAttached() == 0)
            {   // Attaching failed
                llDie();
            }                
        }
        else
        {            
            //llOwnerSay("Trying llAttachToAvatarTemp()");
            llDetachFromAvatar();
            //llOwnerSay("Detaching from avatar.");
            llSetTimerEvent(0.0);
        }
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
        //llOwnerSay("Denied experience permissions for " + (string)agent_id + " due to reason #" + (string) reason);
        llDie();
    }  
 
    timer()
    {   // Use a timer to catch no permissions response
        //llOwnerSay("Permissions timer expired");
        llDie();
    }    
    
    
    
}
