integer DEBUG = FALSE;

integer listener;
integer modeListener;
integer meterChannel = -77777;
integer meterModeChannel = -7777777;
integer PLAYERHUDCHANNEL = -77770;
//integer genderChannel = -55667789;
string mySpecies;
string myName;
string myGender;
string myTitle;
integer myHealth;
integer myStamina;
string myClass;
string myCondition;
list myStats;
string keyName;
key transSetImpairment;
key transSetPoison;
key transGetPoison;
key transGetMode;
integer timerCount;
integer characterLoaded = FALSE;
integer experienceFailed = FALSE;
integer impairmentFound = FALSE;
integer impairmentLevel = 0;
string poisonText = "none";
string poisonName;
integer poisonAmount;
integer poisonFrequency;
string poisonRPText;
// poison data has the following formatP
// name
// amount of health it damages
// how many seconds between damages -- in ticks of 5 seconds length
integer poisonTickCounter = 0;

integer poisonFound;
integer isPoisoned = FALSE;

string BLOCK = "▇";
string HEART = "❤";
string STAR = "★";
string displayHeader = "";
string displayHealthbarText = "";
string displayStaminabarText = "";
string displayRPText = "";


string mode;
string healthbarMode = "hide";

integer permissionGranted = FALSE;

setPoison()
{ 
    transSetPoison = llUpdateKeyValue((string)llGetOwner() + "_poisoned", poisonText, FALSE, "");     
}

getPoison()
{
    keyName = (string)llGetOwner() + "_poisoned";  
    transGetPoison = llReadKeyValue(keyName); 
}

addImpairment()
{
    if (impairmentLevel >= 8) impairmentLevel = 9;
    else impairmentLevel++;
    llOwnerSay("Impairment level set to " + (string)impairmentLevel);
    setImpairment();    
    setDisplay();
    //llRequestPermissions(llGetOwner(),  PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);   
    transSetImpairment = llUpdateKeyValue((string)llGetOwner() + "_impairment", (string)impairmentLevel, FALSE, "");
}

remImpairment()
{
    if (impairmentLevel > 0) 
    {
        impairmentLevel--;
        if (impairmentLevel > 0)
        {
            llOwnerSay("Impairment level set to " + (string)impairmentLevel);          
        }
        else
        {
            llOwnerSay("You are no longer impaired.");             
        }
    }
    else 
    {
        impairmentLevel = 0;
    }
  
    setImpairment();      
    setDisplay();
    llRequestPermissions(llGetOwner(),  PERMISSION_OVERRIDE_ANIMATIONS);    
}

clearImpairment()
{
    if (impairmentLevel > 0)
    {
        impairmentLevel = 0;
        setImpairment();   
        llOwnerSay("You are no longer impaired.");       
        setDisplay();
        llRequestPermissions(llGetOwner(),  PERMISSION_OVERRIDE_ANIMATIONS);
    }
}

setImpairment()
{
    keyName = (string)llGetOwner() + "_impairmentLevel";  
    transSetImpairment = llUpdateKeyValue(keyName, (string)impairmentLevel, FALSE, "");     
}

processXPError(integer errorCode, string fieldName)
{
    string errorMessage = "The Feudalism RPG Meter reports the following error when loading " + fieldName + " data: "; 
    errorMessage += llGetExperienceErrorMessage(errorCode);      
    llOwnerSay(errorMessage);
    //llOwnerSay((string)errorCode);
}

string setHealthBar()
{
    string returnString = "\n";    
    returnString += HEART + ": ";
    integer i = 0;
    integer temp;
    if (myHealth <= 100)
        temp = myHealth / 10;
    else if (myHealth <= 200)
        temp = myHealth / 20;
    else if (myHealth <= 300)
        temp = myHealth / 30;
    else if (myHealth <= 400)
        temp = myHealth / 40;
    else if (myHealth <=500)
        temp = myHealth / 50;
    else if (myHealth <= 600)
        temp = myHealth / 60;

    while (i < temp)
    {
        returnString += BLOCK;
        i++;
    }
    returnString += " " + (string)myHealth + "\n";
    return returnString;
    
}

string setStaminaBar()
{
    string returnString = "";    
    returnString += STAR + ": ";
    integer i = 0;
    integer temp;
    if (myStamina <= 100)
        temp = myStamina / 10;
    else if (myStamina <= 200)
        temp = myStamina / 20;
    else if (myStamina <= 300)
        temp = myStamina / 30;
    else if (myStamina <= 400)
        temp = myStamina / 40;
    else if (myStamina <=500)
        temp = myStamina / 50;
    else if (myStamina <= 600)
        temp = myStamina / 60;
    while (i < temp)
    {
        returnString += BLOCK;
        i++;
    }
    returnString += " " + (string)myStamina; 
    return returnString;                  
}


string showRP()
{
//llOwnerSay("Show RP");  
    displayHeader = "";
    displayRPText = myName + "\n" + myTitle + "\n" + mySpecies + ", " + myGender + ", " + myClass + "\n";
     
    if (healthbarMode == "show")
    {
        displayHealthbarText = setHealthBar(); 
        displayStaminabarText = setStaminaBar();  
        return displayRPText + displayHealthbarText + displayStaminabarText;              
    }
    else
    {
        return displayRPText;  
    }
}

string showTournament()
{
//llOwnerSay("Show Tournament");
    displayHeader = "*** TOURNAMENT MODE ***\n \n";
    displayRPText = myName + "\n" + myTitle + "\n";  
    if (healthbarMode == "show")                  
    {
        displayHealthbarText = setHealthBar(); 
        displayStaminabarText = setStaminaBar();
        return displayHeader + displayRPText + displayHealthbarText + displayStaminabarText;        
    }
    else
    {
        return displayHeader + displayRPText;
    }    
}

string showOOC()
{
//llOwnerSay("Show OOC");     
    displayHeader = "*** OOC ***\n \n";
    displayRPText = "";
    displayHealthbarText = ""; 
    displayStaminabarText = "";
    return displayHeader;   
}

string showAFK()
{
//llOwnerSay("Show AFK");     
    displayHeader = "*** AFK ***\n \n";
    displayRPText = "";
    displayHealthbarText = ""; 
    displayStaminabarText = "";
    return displayHeader;   
}

string showNone()
{
//llOwnerSay("Show OOC");     
    displayHeader = "";
    displayRPText = "";
    displayHealthbarText = ""; 
    displayStaminabarText = "";
    return "";   
}

setDisplay()
{
    string textToDisplay = "";  
//llOwnerSay("Update Display");
    if (isPoisoned)
    {
        textToDisplay += "*** POISONED ***\n";     
    }
    if (impairmentLevel > 0) 
    {                      
        textToDisplay += "*** IMPAIRED ***\n";
        llRequestPermissions(llGetOwner(),  PERMISSION_OVERRIDE_ANIMATIONS);       
    }
    if (mode == "roleplay") textToDisplay += showRP();
    else if (mode == "tournament") textToDisplay += showTournament();
    else if (mode == "ooc") textToDisplay += showOOC();
    else if (mode == "afk") textToDisplay += showAFK();
    else if (mode == "none") textToDisplay += showNone();
    llSetText(textToDisplay, <1.0,1.0,1.0>, 1.0);
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
        llSetText("", <1.0,1.0,1.0>, 1.0);
        llOwnerSay(llGetObjectName() + " starting up.");
        state loading;
    }
    
    on_rez(integer start_param)
    {
        llResetScript();
    }     
}

state loading
{

    state_entry()
    {
//llOwnerSay("State loading.");
        characterLoaded = FALSE;
        timerCount = 0;
        experienceFailed = FALSE;
        llMessageLinked(LINK_THIS, 0, "load character", "");
        llSetTimerEvent(1.0);
    }
    
    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay(msg);
        msg = llToLower(msg);
        if (msg == "character loaded")
        {
            llOwnerSay("Character successfully loaded. ");
            characterLoaded = TRUE;
        }
        if (msg == "name loaded")
        {
            //llOwnerSay("Name loaded. " + (string)id);
            myName = (string)id;
        }     
        if (msg == "stats loaded")
        {
            //llOwnerSay("Stats loaded. " + (string)id);
            myStats = llCSV2List((string)id);
        }
        if (msg == "health loaded")
        {
            //llOwnerSay("Health loaded. " + (string)num);
            myHealth = num;
        } 
        if (msg == "stamina loaded")
        {
            //llOwnerSay("Stamina loaded. " + (string)num);
            myStamina = num;            
        } 
        if (msg == "impairment loaded")
        {
            //llOwnerSay("Impairment level loaded. " + (string)num);
            impairmentLevel = num;
        }                                    
        if (msg == "condition loaded")
        {
            //llOwnerSay("Condition loaded. " + (string)id);
            myCondition = (string)id;
            experienceFailed = FALSE;
        }
        if (msg == "title loaded")
        {
            //llOwnerSay("Condition loaded. " + (string)id);
            myTitle = (string)id;
            experienceFailed = FALSE;
        }  
        if (msg == "gender loaded")
        {
            //llOwnerSay("Condition loaded. " + (string)id);
            myGender = (string)id;
            experienceFailed = FALSE;
        } 
        if (msg == "class loaded")
        {
            //llOwnerSay("Condition loaded. " + (string)id);
            myClass = (string)id;
            experienceFailed = FALSE;
        } 
        if (msg == "species loaded")
        {
            //llOwnerSay("Condition loaded. " + (string)id);
            mySpecies = (string)id;
            experienceFailed = FALSE;
        } 
        if (msg == "experience failed")
        {
            experienceFailed = TRUE;
            state experienceFailure;
        } 
    }  
    
    timer()
    {
        llSetTimerEvent(0.0);
//llOwnerSay("Timer hit.");        
        if (characterLoaded)
        {
//llOwnerSay("Main... all character stats loaded.");            
            //resetHealthStamina();
            state loadPoison;           
        }
        else
        {
            if (timerCount < 10)
            {
                timerCount++;   
                llSetTimerEvent(1.0); 
            }
            else
            {
                state experienceFailure;    
            }                
        }
    }       
}

state experienceFailure
{
    state_entry()
    {
//llOwnerSay("State experience Failed.");
        llOwnerSay("This object cannot operate due to experience permissions not being set or allowed.");
        llRequestExperiencePermissions(llGetOwner(), "");
        llSetTimerEvent(30.0);
    }
    
    on_rez(integer start_param)
    {
        if (llGetAttached() == 0)
        {
            llOwnerSay("You cannot rezz the hud. Please wear it.");   
        }
        else
        {
            llResetScript(); 
        }
    }    
    
    changed(integer change)
    {
        if (change & CHANGED_REGION) //note that it's & and not &&... it's bitwise!
        {
            llOwnerSay("You changed regions. Resetting.");
            llResetScript(); 
        }
        else if (change & CHANGED_TELEPORT) //note that it's & and not &&... it's bitwise!
        {
            llOwnerSay("You teleported. Resetting.");
            llResetScript(); 
        }
        if (change & CHANGED_OWNER)
        {
            llOwnerSay("Hud changed owners. Resetting.");            
            llResetScript();   
        }
    }   
    
    timer()
    {
        llSetTimerEvent(0.0);
        llRequestExperiencePermissions(llGetOwner(), "");    
    } 
    
    experience_permissions(key target_id)
    {   
        llResetScript();
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   
        llSetTimerEvent(30.0);
    }    
}


state loadPoison
{
   
    state_entry()
    {
//llOwnerSay("State idle.");
        getPoison();
        transGetMode = llReadKeyValue((string)llGetOwner() + "_mode");
    } 
        
    on_rez(integer start_parameter)
    {  
        // any time the script is rezzed or attached, reset it
        llResetScript();         
    }
    
    dataserver(key t, string value)
    {
        
        if (t == transGetPoison)
        {
            poisonName = "";
            poisonAmount = -1;
            poisonFrequency = -1;
            poisonRPText = "";
            poisonText = "none";
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                poisonText = llGetSubString(value, 2, -1);
                poisonFound = TRUE;
                if (poisonText != "none")
                {
                    isPoisoned = TRUE;
                    list poisonList = llCSV2List(poisonText);
                    if (llGetListLength(poisonList) == 4)
                    {
                        poisonName = llList2String(poisonList, 0);
                        poisonAmount = llList2Integer(poisonList, 1);
                        poisonFrequency = llList2Integer(poisonList, 2);
                        poisonRPText = llList2String(poisonList, 3);
                    }
                }
                poisonFound = TRUE;                               
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("Your stats do not exist or could not be found.");
                if (error != XP_ERROR_KEY_NOT_FOUND)
                {
//llOwnerSay("Not found error = " + (string)XP_ERROR_NOT_FOUND);
//llOwnerSay("Error reading impairment level. Error code: " + (string)error);                    
                    processXPError(error, "Poison"); 
                    state experienceFailure;
                }
                else 
                {
                    if (poisonName == "") 
                    {
                        poisonText = "none";
                    }
                    else
                    {
                        poisonText = poisonName + "," + (string)poisonAmount + "," + (string)poisonFrequency + "," + poisonRPText;
                        setPoison();
                    }
                }
                poisonFound = FALSE;
            }
        } 
        
        if (t == transSetPoison)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                //setXP();
                poisonFound = TRUE; // force it true on successful setting
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
//llOwnerSay("Error writing impairment level.");                  
                if (error != XP_ERROR_NONE) processXPError(error, "Poison");
                state experienceFailure;
            }            
        } 
        if (t == transGetMode)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                mode = llGetSubString(value, 2, -1);   
                state running;                                            
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("Your stats do not exist or could not be found.");
                if (error != XP_ERROR_KEY_NOT_FOUND)
                {
//llOwnerSay("Not found error = " + (string)XP_ERROR_NOT_FOUND);
//llOwnerSay("Error reading impairment level. Error code: " + (string)error);                    
                    processXPError(error, "Mode"); 
                    mode = "roleplay";                    
                }
                mode = "roleplay";
                state running;                 
            }
        }                                     
    }      
} 
 
state running
{
    state_entry() 
    {
//llOwnerSay("Meter is ready.");
        llOwnerSay(llGetObjectName() + " is ready for use.");    
        listener = llListen(meterChannel, "", NULL_KEY, "");
        modeListener = llListen(meterModeChannel, "", NULL_KEY, ""); 
        if (impairmentLevel > 0) llRequestPermissions(llGetOwner(),  PERMISSION_OVERRIDE_ANIMATIONS); 
        setDisplay();           
    }    
             

    on_rez(integer start_parameter)
    {  
        // any time the script is rezzed or attached, reset it
        llResetScript();         
    }
    
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {            
        }
        else
        {
            llSetText("", <1.0,1.0,1.0>,1.0);
        }
    }
    
    changed(integer change)
    {
        if (change & CHANGED_REGION) //note that it's & and not &&... it's bitwise!
        {
//llOwnerSay("You changed regions.");
        }
        else if (change & CHANGED_TELEPORT) //note that it's & and not &&... it's bitwise!
        {
//llOwnerSay("You teleported.");
        }
        if (change & CHANGED_OWNER)
        {
//llOwnerSay("Hud changed owners. Resetting.");            
            llResetScript();   
        }
    } 
    
    listen(integer channel, string name, key id, string text)
    {   // Listen for the message from the rezzer with the target agent key

//llOwnerSay("Meter received message; " + text);     
        if (channel == meterChannel)
        {   // Ask for the experience permission
            //llListenRemove(listener);
//llOwnerSay("Meter received message; " + text);        
            list message = llCSV2List(text);            
            string action = llList2String(message, 0);
            string parameter = llList2String(message, 1);
            if (action == "reset")
            {
                poisonName = "";
                poisonAmount = -1;
                poisonFrequency = -1;
                poisonRPText = "";
                poisonText = "none";
                isPoisoned = FALSE;
                transSetPoison = llUpdateKeyValue((string)llGetOwner() + "_poisoned", poisonText, FALSE, "");  
                llSetTimerEvent(0.0);
                poisonTickCounter = 0;        
                clearImpairment();                                     
                llResetScript();
            }
            if (action == "title")
            {
                myTitle = parameter;
            }
            if (action == "species")
            {
                mySpecies = parameter;
            }            
            if (action == "name")
            {
                myName = parameter;
            }                     
            if (action == "gender")
            {
                myGender = parameter;
            }
            if (action == "class")
            {                    
                myClass = parameter;
            } 
            if (action == "health")
            {                    
                myHealth = (integer)parameter;
            } 
            if (action == "stamina")
            {                    
//llOwnerSay("My Stamina: " + (string)myStamina);            
                myStamina = (integer)parameter;
//llOwnerSay("My Stamina: " + (string)myStamina);                
            } 
            if (action == "addImpairment") 
            {
                addImpairment();            
            }
            if (action == "remImpairment") 
            {
                remImpairment();
            }
            if (action == "clearImpairment") 
            {                
                clearImpairment();                        
            }
            if (action == "addPoison")
            {
                poisonName = parameter;
                poisonAmount = llList2Integer(message, 2);
                poisonFrequency = llList2Integer(message, 3);
                poisonRPText = llList2String(message, 4);
                poisonText = poisonName + "," + (string)message + "," + (string)poisonFrequency + "," + poisonRPText;
                transSetPoison = llUpdateKeyValue((string)llGetOwner() + "_poisoned", poisonText, FALSE, "");
                isPoisoned = TRUE;
                poisonTickCounter = 0;
                llSetTimerEvent(5.0);
            }
            if (action == "clearPoison")
            {
                if (poisonName == parameter)
                {
                    poisonName = "";
                    poisonAmount = -1;
                    poisonFrequency = -1;
                    poisonRPText = "";
                    poisonText = "none";
                    isPoisoned = FALSE;
                    transSetPoison = llUpdateKeyValue((string)llGetOwner() + "_poisoned", poisonText, FALSE, "");  
                    llSetTimerEvent(0.0);
                    poisonTickCounter = 0;                  
                }
            }
            
            setDisplay();       
            listener = llListen(meterChannel, "", NULL_KEY, "");                    
        }
        if (channel == meterModeChannel)
        {   // Ask for the experience permission
            llListenRemove(modeListener);        
//llOwnerSay("Mode  message; " + text);        
            list message = llCSV2List(text);            
            string action = llList2String(message, 0);
            string parameter = llList2String(message, 1);
            if (action == "mode")
            {
                if (parameter == "tournament")
                {
                    //showTournament();   
                    mode = "tournament";                            
                }
                else if (parameter == "ooc")
                {
                    //showOOC();
                    mode = "ooc";                   
                }
                else if (parameter == "roleplay")
                {
                    //showRP(); 
                    mode = "roleplay";                                         
                }  
                else if (parameter == "afk")
                {
                    mode = "afk";   
                } 
                else if (parameter == "none")
                {
                    mode = "none";
                }
            }
            if (action == "healthbar")
            {
                if (parameter == "show")
                {   
                    healthbarMode = "show";                    
                    //displayHealthbarText = setHealthBar(); 
                    //displayStaminabarText = setStaminaBar();
                }
                else 
                {
                    healthbarMode = "hide";                   
                    //displayHealthbarText = ""; 
                    //displayStaminabarText = "";      
                }   
            }     
            setDisplay();       
            modeListener = llListen(meterModeChannel, "", NULL_KEY, "");                        
        }
                      
    } 
    
    touch_start(integer num_detected)
    {
    } 

    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        //llOwnerSay("Trying llAttachToAvatarTemp()");
        //llDetachFromAvatar();
       //llOwnerSay("Detaching from avatar.");
        llSetTimerEvent(0.0);
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   
        llSetText("Experience Permissions Denied", <1.0,1.0,1.0>, 1.0);    
    } 
    
    run_time_permissions(integer perm)
    {
        if (perm &  PERMISSION_OVERRIDE_ANIMATIONS)
        {
            if (impairmentLevel > 0)
            {
                llSetAnimationOverride( "Standing", "ao_drunk_stand_" + (string)impairmentLevel);
                llSetAnimationOverride( "Walking", "ao_drunk_walk_" + (string)impairmentLevel);
            }
            else
            {
                llResetAnimationOverride("ALL");    
            }
        }
    }      
 
    timer()
    {   
        llSetTimerEvent(0.0);  
        poisonTickCounter++;
        if (poisonFrequency > 0)
        {       
            if (poisonTickCounter == poisonFrequency)
            {
//llOwnerSay("Poison Amount: " + (string)poisonAmount);                
                llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "changeHealth," + (string)poisonAmount);
                poisonTickCounter = 0;
            }
        } 
        if (myHealth <= 0)
        {
            llSetTimerEvent(0.0);
        } 
        else
        {
            llSetTimerEvent(5.0);   
        }
        setDisplay(); 

    }    
    
 
    
}
