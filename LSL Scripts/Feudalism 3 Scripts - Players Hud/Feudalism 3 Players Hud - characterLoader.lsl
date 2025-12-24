string myName;
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

key transGetMyName;
key transGetMyStats;
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


default
{

    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay(msg);
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
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myName =  llGetSubString(value, 2, -1);                
                transGetMyStats = llReadKeyValue((string)llGetOwner() + "_stats");
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    myName = " ";
                    transSetMyName = llUpdateKeyValue((string)llGetOwner() + "_name", (string)myName, FALSE, "");
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
                // the key-value pair was successfully read
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
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myStats = llCSV2List(llGetSubString(value, 2, -1));
                transGetMyXP = llReadKeyValue((string)llGetOwner() + "_xp");                 
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
        if (t == transGetMyXP)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myXP =  (integer)llGetSubString(value, 2, -1);
                transGetMyHealth = llReadKeyValue((string)llGetOwner() + "_health");
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    myXP = 0;
                    transSetCondition = llUpdateKeyValue((string)llGetOwner() + "_condition", (string)myXP, FALSE, "");
                }
                else
                {
                    llOwnerSay("Failed to read user xp: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }
        }
        if (t == transSetMyXP)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                transGetMyHealth = llReadKeyValue((string)llGetOwner() + "_health");
            } 
            else
            {
                timerCount = 11; 
                experienceFailed = TRUE; 
            }          
        }          
        if (t == transGetMyHealth)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                currentHealth =  (integer)llGetSubString(value, 2, -1);
                transGetMyStamina = llReadKeyValue((string)llGetOwner() + "_stamina");                                          
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    currentHealth = 0;
                    transSetMyHealth = llUpdateKeyValue((string)llGetOwner() + "_health", (string)currentHealth, FALSE, "");
                }
                else
                {
                    llOwnerSay("Failed to read user health: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }            
        } 
        if (t == transSetMyHealth)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                transGetMyStamina = llReadKeyValue((string)llGetOwner() + "_stamina");
            } 
            else
            {
                timerCount = 11;  
                experienceFailed = TRUE; 
            }          
        }            
        if (t == transGetMyStamina)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                currentStamina =  (integer)llGetSubString(value, 2, -1);
                transGetMyClass = llReadKeyValue((string)llGetOwner() + "_impairmentLevel");  
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                {
                    currentStamina = 0;
                    transSetMyStamina = llUpdateKeyValue((string)llGetOwner() + "_stamina", (string)currentStamina, FALSE, "");
                }
                else
                {
                    llOwnerSay("Failed to read user stamina: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }            
        } 
        if (t == transSetMyStamina)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                transGetMyClass = llReadKeyValue((string)llGetOwner() + "_class");
            } 
            else
            {
                timerCount = 11;  
                experienceFailed = TRUE; 
            }          
        }         
        if (t == transGetMyClass)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myClass =  llGetSubString(value, 2, -1);
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
                // the key-value pair was successfully read
                impairmentLevel = (integer)llGetSubString(value, 2, -1);
                transGetCondition = llReadKeyValue((string)llGetOwner() + "_condition");                                       
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                    transSetImpairment = llUpdateKeyValue((string)llGetOwner() + "_impairmentLevel", "0", FALSE, "");
                else
                {
                    llOwnerSay("Failed to read user impairment: " + llGetExperienceErrorMessage(error));
                    timerCount = 11;
                    experienceFailed = TRUE;
                }
            }
        } 
        if (t == transSetImpairment)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                transGetCondition = llReadKeyValue((string)llGetOwner() + "_condition");
            }
            else
            {
                timerCount = 11;  
                experienceFailed = TRUE; 
            }           
        }                  
        if (t == transGetCondition)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myCondition = llGetSubString(value, 2, -1); 
                characterLoaded = TRUE;               
            }
            else
            {
                integer error = (integer)llGetSubString(value, 2, -1);
                if (error = XP_ERROR_KEY_NOT_FOUND)
                    transSetCondition = llUpdateKeyValue((string)llGetOwner() + "_condition", "normal", FALSE, "");
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
                characterLoaded = TRUE;
            }
            else
            {
                timerCount = 11;  
                experienceFailed = TRUE; 
            }           
        }                               
    }
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (characterLoaded)
        {     
            // now i have to send the data back to the main hud
            llMessageLinked(LINK_ROOT, 0, "name loaded", myName);            
            llMessageLinked(LINK_ROOT, 0, "stats loaded", llList2CSV(myStats));
            llMessageLinked(LINK_ROOT, 0, "class loaded", myClass);              
            llMessageLinked(LINK_ROOT, myXP,"xp loaded", "");
            llMessageLinked(LINK_ROOT, currentHealth, "health loaded", "");
            llMessageLinked(LINK_ROOT, currentStamina, "stamina loaded", "");
            llMessageLinked(LINK_ROOT, impairmentLevel, "impairment loaded", "");
            llMessageLinked(LINK_ROOT, 0, "condition loaded", myCondition);
            llMessageLinked(LINK_ROOT, 0, "character loaded", "");  
            if (experienceFailed)
                llMessageLinked(LINK_ROOT, 0, "experience failed", "");
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
