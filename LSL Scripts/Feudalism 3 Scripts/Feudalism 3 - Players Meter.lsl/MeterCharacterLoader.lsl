string myName;
string myTitle;
string myGender;
list myStats;
integer myXP;
integer currentHealth;
integer currentStamina;
string myClass;
integer impairmentLevel;
string myCondition;
integer characterLoaded = FALSE;
integer timerCount = 0;
integer experienceFailed = FALSE;
string mySpecies;

key transGetMyName;
key transGetMyStats;
key transGetMySpecies;
key transGetMyXP;
key transGetMyHealth;
key transGetMyStamina;
key transGetMyClass;
key transGetImpairment;
key transGetCondition;
key transSetMyName;
key transSetMyHealth;
key transSetMyStamina;
key transSetMyXP;
key transSetImpairment;
key transSetCondition;
key transGetMyGender;
key transGetMyTitle;


default
{

    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay("Character loader: " + msg);
        if (msg == "load character")
        {
//llOwnerSay("MSG = load character");            
            characterLoaded = FALSE;
            timerCount = 0;
            experienceFailed = FALSE;
            llOwnerSay("Checking for your character in the database.");                      
            transGetMyName = llReadKeyValue((string)llGetOwner() + "_name");                    
            llSetTimerEvent(1.0);
        }
    }
    
    dataserver(key t, string value)
    {
        if (t == transGetMyName)
        {
//llOwnerSay("Load name.");            
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Name loaded.");                
                // the key-value pair was successfully read
                myName =  llGetSubString(value, 2, -1);                
                transGetMyStats = llReadKeyValue((string)llGetOwner() + "_stats");
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    transSetCondition = llUpdateKeyValue((string)llGetOwner() + "_name", " ", FALSE, "");
                }
                else
                {
                    llOwnerSay("Failed to read user name: " + llGetExperienceErrorMessage(error));
                    experienceFailed = TRUE;
                    timerCount = 11;
                }
            }
        } 
        if (t == transSetMyName)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                transGetMyStats = llReadKeyValue((string)llGetOwner() + "_stats");
            }
            else
            {
                timerCount = 11;  
                experienceFailed = TRUE; 
            }           
        }                
        if (t == transGetMyStats)
        {
//llOwnerSay("Load Stats");            
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Stats loaded.");
                // the key-value pair was successfully read
                myStats = llCSV2List(llGetSubString(value, 2, -1));
                transGetMyHealth = llReadKeyValue((string)llGetOwner() + "_health");                
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);                
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    llOwnerSay("You have not created a character. Use the setup hud then try again.");
                }
                else
                {                
                    llOwnerSay("Failed to read user stats: " + llGetExperienceErrorMessage((integer)llGetSubString(value, 2, -1)));
                    experienceFailed = TRUE;
                }
                timerCount = 11;
            }
        }    
        if (t == transGetMyHealth)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Health loaded.");                
                // the key-value pair was successfully read
                currentHealth =  (integer)llGetSubString(value, 2, -1);
                transGetMyStamina = llReadKeyValue((string)llGetOwner() + "_stamina");                                          
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    llOwnerSay("Failed to read user health: " + llGetExperienceErrorMessage(error));                    
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
                else
                {
                    llOwnerSay("Failed to read user health: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }            
        }           
        if (t == transGetMyStamina)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Stamina loaded.");                
                // the key-value pair was successfully read
                currentStamina =  (integer)llGetSubString(value, 2, -1);
                transGetMyClass = llReadKeyValue((string)llGetOwner() + "_class");  
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    llOwnerSay("Failed to read user stamina: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
                else
                {
                    llOwnerSay("Failed to read user stamina: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }            
        }        
        if (t == transGetMyClass)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Class loaded.");                
                // the key-value pair was successfully read
                myClass =  llGetSubString(value, 2, -1);
//llOwnerSay("Class loaded: " + myClass);                 
                transGetImpairment = llReadKeyValue((string)llGetOwner() + "_impairmentLevel");                              
            }
            else
            {
                llOwnerSay("Failed to read user class: " + llGetExperienceErrorMessage((integer)llGetSubString(value, 2, -1)));
                timerCount = 11;
                experienceFailed = TRUE;
            }            
        }                         
        if (t == transGetImpairment)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Impairment loaded.");                
                // the key-value pair was successfully read
                impairmentLevel = (integer)llGetSubString(value, 2, -1);
                transGetCondition = llReadKeyValue((string)llGetOwner() + "_condition");                                       
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    llOwnerSay("Failed to read user impairment: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
                else
                {
                    llOwnerSay("Failed to read user impairment: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }
        }                  
        if (t == transGetCondition)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Condition loaded.");                
                // the key-value pair was successfully read
                myCondition = llGetSubString(value, 2, -1); 
                transGetMyGender = llReadKeyValue((string)llGetOwner() + "_gender");            
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    transSetCondition = llUpdateKeyValue((string)llGetOwner() + "_condition", "normal", FALSE, "");
                }
                else
                {
                    llOwnerSay("Failed to read user condition: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }
        } 
        if (t == transSetCondition)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                //characterLoaded = TRUE;
            }
            else
            {
                timerCount = 11;  
                experienceFailed = TRUE; 
            }           
        }  
        if (t == transGetMyGender)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Gender loaded.");                
                // the key-value pair was successfully read
                myGender = llGetSubString(value, 2, -1); 
                transGetMyTitle = llReadKeyValue((string)llGetOwner() + "_title");               
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    //transSetCondition = llUpdateKeyValue((string)llGetOwner() + "_condition", "normal", FALSE, "");
                }
                else
                {
                    llOwnerSay("Failed to read user condition: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }
        }   
        if (t == transGetMyTitle)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Title loaded.");                
                // the key-value pair was successfully read
                myTitle = llGetSubString(value, 2, -1);  
                transGetMySpecies = llReadKeyValue((string)llGetOwner() + "_species");               
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    llOwnerSay("Failed to read user condition: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
                else
                {
                    llOwnerSay("Failed to read user condition: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }
        }
        if (t == transGetMySpecies)
        {
//llOwnerSay("Load name.");            
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
//llOwnerSay("Name loaded.");                
                // the key-value pair was successfully read
                mySpecies =  llGetSubString(value, 2, -1);  
                characterLoaded = TRUE;               
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                    llOwnerSay("Failed to read species: " + llGetExperienceErrorMessage(error));
                    experienceFailed = TRUE;
                    timerCount = 11;
            }
        }                            
    }
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (characterLoaded)
        {     
//llOwnerSay("Character loaded.");        
            // now i have to send the data back to the main hud
            llMessageLinked(LINK_THIS, 0, "name loaded", myName);            
            llMessageLinked(LINK_THIS, 0, "stats loaded", llList2CSV(myStats));
            llMessageLinked(LINK_THIS, currentHealth, "health loaded", "");
            llMessageLinked(LINK_THIS, currentStamina, "stamina loaded", "");
            llMessageLinked(LINK_THIS, impairmentLevel, "impairment loaded", "");
            llMessageLinked(LINK_THIS, 0, "condition loaded", myCondition);
            llMessageLinked(LINK_THIS, 0, "class loaded", myClass);            
            llMessageLinked(LINK_THIS, 0, "gender loaded", myGender);
            llMessageLinked(LINK_THIS, 0, "title loaded", myTitle);
            llMessageLinked(LINK_THIS, 0, "character loaded", "");  
            llMessageLinked(LINK_THIS, 0, "species loaded", mySpecies);
            if (experienceFailed)
                llMessageLinked(LINK_THIS, 0, "experience failed", "");
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
                llMessageLinked(LINK_ROOT, 0, "character load failed", "");    
            }                
        }
    }    

}
