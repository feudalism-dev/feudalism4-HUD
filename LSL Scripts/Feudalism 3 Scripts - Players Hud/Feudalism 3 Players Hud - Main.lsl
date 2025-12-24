
// values for loading character data
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

integer baseHealth = 100;
integer baseStamina = 100;

// main listener
integer PLAYERHUDCHANNEL = -77770;
integer meterChannel = -77777;
integer weaponChannel = -77771;
integer weaponChannel2 = -77773;
integer hudListenHandle;
string action;

// combat related
key attackerID;
integer attackerFighting;
integer attackerAttackBonus;
vector attackerPos;
string attackerWeaponType;
integer attackerBaseDamage;
string attackerHand;

list bodyParts = ["head","neck","upper torso", "lower torso", "right arm", "left arm", "upper leg", "lower leg", "foot"];
list armorTypes = ["none", "cloth", "fur", "leather", "chainmail", "ring male", "scale mail", "brigandine", "plate", "shield"];
list armorValues = [0,1,2,3,4,5,6,7,8];
list armorWeightByType = [0,0,1,1,2,2,2,3,4,0];
list armorWeightByPart = [1.0, 0.5, 2.8, 1.0, 1.0, 1.0, 1.25, 1.25, 1.1];
list myArmor;

list weaponTypeList = ["dagger","knife","short sword","longsword", "bastard sword","two handed sword","great sword","polearm","spear","dual swords","fists","club","mace","two handed mace","hand axe", "battle axe"];
list weaponDamageList = [4,3,5,6,8,9,12,6,4,5,2,5,6,10,7,11];
string mode = "roleplay";
integer enemyXPEarned;
integer isPassedOut = FALSE;
integer permissionGranted = FALSE;
integer tempXP;
key transGetToSetMyXP;
key transSetMode;
key transSetMyXP;
key transSetMyHealth;
key transSetMyStamina;
key transGetEnemyStats;
list enemyStats;
integer enemyStatsLoaded = FALSE;
integer isResting = FALSE;
string animationState = "start";
integer timerCounter = 0;
integer primaryWeaponIsActive;
integer secondaryWeaponIsActive;

resetHealthStamina()
{
    integer wasOut = isPassedOut;
    if (mode == "roleplay")
    {
        baseHealth = (llList2Integer(myStats, ATHLETICS) + llList2Integer(myStats, AGILITY) + llList2Integer(myStats, ENDURANCE)) * 20;          
        baseStamina = (llList2Integer(myStats, ENDURANCE) + llList2Integer(myStats, WILL) + llList2Integer(myStats, ATHLETICS)) * 20; 
    }
    else if (mode == "tournament")
    {
        baseHealth = 100;
        baseStamina = 100;
    }
    currentHealth = baseHealth;
    currentStamina = baseStamina;
    llRegionSayTo(llGetOwner(), meterChannel, "clearImpairment,0");       
    llRegionSayTo(llGetOwner(), meterChannel, "clearPoison");  
    myCondition = "normal";  
    llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth);
    writeHealth();
    llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseHealth);
    writeStamina(); 
    llSay(0, llGetDisplayName(llGetOwner()) + " has reset the Feudalism RPG meter.");
    if (wasOut)
    {
        wakeUp();     
    }
}


gainXP(integer xpToGain)
{
    tempXP = xpToGain;  
    llMessageLinked(LINK_THIS, tempXP, "set xp display", "");                               
    transGetToSetMyXP = llReadKeyValue((string)llGetOwner() + "_xp");         
}

passOut()
{
    isPassedOut = TRUE;
    llRequestExperiencePermissions(llGetOwner(), "");
    llSay(0, llGetDisplayName(llGetOwner()) + " has fallen unconscious.");   
}

wakeUp()
{
    isPassedOut = FALSE;
    llRequestExperiencePermissions(llGetOwner(), "");
    llSay(0, llGetDisplayName(llGetOwner()) + " has regained consciousness.");     
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
writeHealth()
{ 
    transSetMyHealth = llUpdateKeyValue((string)llGetOwner() + "_health", (string)currentHealth, FALSE, "");     
}
writeStamina()
{
    transSetMyHealth = llUpdateKeyValue((string)llGetOwner() + "_stamina", (string)currentStamina, FALSE, "");        
}

integer doesWeaponDrop()
{
    integer result = FALSE;
    if (llFrand(100.0) > 70)
    {
        result = TRUE;    
    }
    
    return result;
}


processAttack() 
{
//llOwnerSay("Debug. Process attack.");

    integer defenseRoll;
    integer attackRoll;
    integer damage;
    string output;
    integer index;
    string hitLocation;
    integer armorDefBonus;
    integer atkBonus;
    integer defBonus;
    integer degreesOfSuccess; 
    integer maxAttack;
    integer maxDefense;
    
    integer defFighting = llList2Integer(myStats, FIGHTING);

    integer defDodgeBonus = llList2Integer(myStats, AGILITY);
    if (mode == "tournament")
    {
        defFighting = 5;
        defDodgeBonus = 5;  
        attackerFighting = 5;
        attackerAttackBonus = 5;  
    }
    maxDefense = defFighting * 20;    
    maxAttack = attackerFighting * 20;
//llOwnerSay("Debug. Def Fighting: " + (string)defFighting);
//llOwnerSay("Debug. Def Bonus: " + (string)defDodgeBonus);
//llOwnerSay("Debug. Attack Fighting: " + (string)defFighting);
//llOwnerSay("Debug. Attack Bonus: " + (string)attackerAttackBonus);
    atkBonus = attackerAttackBonus;     // save raw value for future use
    defBonus = defDodgeBonus;           // save raw value for future use
    vector myPos = llGetPos();
    float mySpeed = llVecMag(llList2Vector(llGetObjectDetails(llGetOwner(), [OBJECT_VELOCITY]), 0));
    float attackerSpeed = llVecMag(llList2Vector(llGetObjectDetails(attackerID, [OBJECT_VELOCITY]), 0));   
//llOwnerSay("MySpeed: " + (string)mySpeed + " meters/sec");
//llOwnerSay("AttackerSpeed: " + (string)attackerSpeed + " meters/sec");

// penalties and bonuses for speed of movement
    if (mySpeed > 3.2)
        defDodgeBonus += 5;
    if (attackerSpeed > 3.2)
        attackerAttackBonus -= 5;
        
// bonus for higher ground   
    if (attackerPos.z > myPos.z) 
    {
        ++attackerAttackBonus;
    } 
    else if (attackerPos.z < myPos.z) 
    {
        ++defDodgeBonus;    
    }
    
    if (impairmentLevel > 0)
        defDodgeBonus - impairmentLevel;
        
//llOwnerSay("Debug. Def Dodge Bonus " + (string)defDodgeBonus);
//llOwnerSay("Debug. Attack Bonus " + (string)attackerAttackBonus);        

    if (defDodgeBonus > 0)
        defenseRoll = rollDice(defFighting) + (integer)llFrand(defDodgeBonus) + 1;
    else 
        defDodgeBonus = 0;
    if (attackerAttackBonus > 0)               
        attackRoll = rollDice(attackerFighting) + (integer)llFrand(attackerAttackBonus);
    else
        attackerAttackBonus = 0;
    
//llOwnerSay("Debug. Defense Roll " + (string)defenseRoll);
//llOwnerSay("Debug. Attack Roll " + (string)attackRoll);   

    if (attackRoll > defenseRoll) 
    { // hit 
//llOwnerSay("You were successfully hit");  
        //if (mode == "roleplay")
        //{ 
            llRegionSayTo(attackerID, weaponChannel, "damageWeapon"); 
        //}
        degreesOfSuccess = ((attackRoll - defenseRoll) / 10) +1;
//llOwnerSay("Debug. Degrees of Success: " + (string)degreesOfSuccess);        
        
        hitLocation = whichPartHit();
        armorDefBonus = getArmorWorn(hitLocation);  
        if (primaryWeaponIsActive && secondaryWeaponIsActive && mode == "roleplay")  
            armorDefBonus++;   
        damage = (integer)llFrand(2 * attackerBaseDamage) + 1;
//llOwnerSay("Base damage: " + (string)damage);        
        damage -= (integer)llFrand(armorDefBonus) + 1; 
        damage -= (integer)llFrand(defBonus) +1;       
//llOwnerSay("Damage after defense bonus: " + (string)damage);  
        if ((float)maxAttack / (float)attackRoll >= 0.95)
        {
            if (degreesOfSuccess >= 6)
            {
                if (doesWeaponDrop())
                {
                    llRegionSayTo(llGetOwner(), weaponChannel, "drop"); 
                    llRegionSayTo(llGetOwner(), 0, "You were hit so badly, you dropped your primary weapon.");  
                }
            }          
        }      
        integer i = 1;
        while (i <= degreesOfSuccess)
        {        
            damage += ((integer)llFrand(atkBonus)) + 1;
//llOwnerSay("Damage after attack bonus: " + (string)damage);               
            i++;
        }   
        if (damage <= 0)
        {
            damage = 0;
            output = llGetDisplayName(attackerID);
            output += " hits ";
            output += llGetDisplayName(llGetOwner());
            output += ", but delivers no damage.";
//llOwnerSay("Debug. Final Damage: " + (string)damage);             
        }
        else 
        {
//llOwnerSay("Debug. Final Damage: " + (string)damage);                         
            currentHealth -= damage;             
            output = llGetDisplayName(attackerID);
            output += " hits ";
            output += llGetDisplayName(llGetOwner());
            output += " on the ";
            output += hitLocation;                    
            output += " for ";
            output += (string)damage;                    
            output += " points of damage.";
        }
        if (mode == "tournament")
            llSay(0, output);
        
        enemyXPEarned = 1;
        llRegionSayTo(attackerID, PLAYERHUDCHANNEL, "gainXP," + (string)enemyXPEarned);                    

        if (currentHealth <= 0 || currentStamina <= 0) 
        {        // you are knocked out    
            if (currentHealth < 0) currentHealth = 0;
            if (currentStamina < 0) currentStamina = 0; 
            passOut(); 
            // since you are knocked out, that means you lost. it means the other person won... calculate the loser XP bonus.
            // you get that. calculate the winner xp bonus.... the winner gets that via a message 
            gainXP(5);                 
            
            integer factor = 1;
            if (attackerFighting > defFighting) factor = factor / (attackerFighting - defFighting);
            else if (attackerFighting < defFighting) factor = defFighting - attackerFighting;
            enemyXPEarned = baseHealth * factor;
            llRegionSayTo(attackerID, PLAYERHUDCHANNEL, "gainXP," + (string)enemyXPEarned);                
            
        }
        llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth);
        llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseStamina);
        writeHealth();
        writeStamina();        
                    
    } else 
    { // no hit
        output = llGetDisplayName(attackerID);
        output += " swings at ";
        output += llGetDisplayName(llGetOwner());                    
        output += " but misses.";
        if (mode == "tournament")        
            llSay(0, output); 
        integer degreesOfFailure = ((defenseRoll - attackRoll) / 10) + 1;
//llOwnerSay("Debug. Degrees of Failure: " + (string)degreesOfFailure);
        if ((float)maxDefense / (float)defenseRoll <= 0.05)
        {
            if (degreesOfFailure >= 6)
            {
                if (doesWeaponDrop())
                {
                    if (attackerHand == "primary")
                        llRegionSayTo(attackerID, weaponChannel, "drop"); 
                    else
                        llRegionSayTo(attackerID, weaponChannel2, "drop");                 
                    llRegionSayTo(attackerID, 0, "You missed so badly, that you dropped your weapon!");        
                }
            }      
        }
    }
    //sendMyCombatStats();    // this will tell the other player you lost
}

string whichPartHit() {
    string result;
    integer hitResult = (integer)llFrand(100) + 1;
    
    if (hitResult > 96) result = "head";
    else if (hitResult > 95) result = "neck";
    else if (hitResult > 75) result = "upper torso";
    else if (hitResult > 55) result = "lower torso";
    else if (hitResult > 43) result = "right arm";
    else if (hitResult > 30) result = "left arm";
    else if (hitResult > 15) result = "upper leg";
    else if (hitResult > 5)    result = "lower leg";
    else if (hitResult > 0) result = "foot";
    
    return result;
}

integer getArmorWorn(string location) 
{
    integer index;
    integer armorValue = 0;
    
    index = llListFindList(bodyParts, [location]);
    string type = llList2String(myArmor, index);
    index = llListFindList(armorTypes, [type]);
    armorValue = llList2Integer(armorValues, index);
//llOwnerSay("Armor Value: " + (string)armorValue);
    return armorValue;
}

//////////////////////////////////////////////////////////////////////////////
//
//          Root Script
//
//          1/3/2017 Bandor Beningborough
//
//          This script is the foundation for any Feudalism script.
//
//////////////////////////////////////////////////////////////////////////////

default
{
    state_entry()
    {              
        if (llGetAttached() != 0)
        {
            llOwnerSay(llGetObjectName() + " starting up.");
            state preRun;
        }
        else
        {
            llOwnerSay("The Feudalism RPG Hud must be worn. Please add it instead of rezzing it.");                
        }
    }
    
    on_rez(integer start_param)
    {
        llResetScript();
    }   
}

state preRun
{
    state_entry()
    {
        //llOwnerSay(llGetObjectName() + " is ready for use.");
        state loading;
    }    
}

state loading
{

    state_entry()
    {
//llOwnerSay("State idle.");
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
        if (msg == "class loaded")
        {
            //llOwnerSay("Name loaded. " + (string)id);
            myClass = (string)id;
        }         
        if (msg == "xp loaded")
        {
            //llOwnerSay("XP loaded. " + (string)num);
            myXP = num;
            llMessageLinked(LINK_THIS, myXP, "set xp display", "");            
        }
        if (msg == "health loaded")
        {
            //llOwnerSay("Health loaded. " + (string)num);
            currentHealth = num;
            llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth); 
        } 
        if (msg == "stamina loaded")
        {
            //llOwnerSay("Stamina loaded. " + (string)num);
            currentStamina = num;
            llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseStamina);             
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
        if (msg == "experience failed")
        {
            experienceFailed = TRUE;
            state experienceFailure;
        } 
    }  
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (characterLoaded)
        {
            resetHealthStamina();
            state loaded;           
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


state loaded  // use this as the standard idle state
{
        state_entry()
    {
//llOwnerSay("State loaded.");
        if (isPassedOut)
            wakeUp();
        llListenRemove(hudListenHandle);
        hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");
        llMessageLinked(LINK_ROOT, 0, "check weapon", "");
        llMessageLinked(LINK_ROOT, 0, "checkArmor", "");        
    }
    
    on_rez(integer start_param)
    {
        if (llGetAttached() == 0)
        {
            llOwnerSay("You cannot rezz the hud. Please wear it.");   
        }
        else
        {
            llOwnerSay("You attached the hud."); 
            llResetScript();           
        }
    }   
    
    attach(key id)
    {
        if (id)
        {                
        }
        else
        {
            llOwnerSay("You removed the hud.");    
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
    
    listen( integer channel, string name, key id, string message ) 
    {
        if (channel == PLAYERHUDCHANNEL) 
        {
            llListenRemove(hudListenHandle);
            list parsedMessage = llCSV2List(message);            
            action = llList2String(parsedMessage, 0);
            if (action == "broadcastAttack")
            {
//llOwnerSay("Debug. Got Broadcast Attack message: " + message);                
                attackerID =  llList2Key(parsedMessage,1);
                attackerFighting = llList2Integer(parsedMessage,2);
                attackerAttackBonus = llList2Integer(parsedMessage,3);
                attackerPos = llList2Vector(parsedMessage, 4);
                attackerWeaponType = llList2String(parsedMessage,5); 
                attackerBaseDamage = llList2Integer(parsedMessage,6); 
                attackerHand = llList2String(parsedMessage,7);   
                processAttack();           
            }
            if (action == "setStamina")
            {
                currentStamina = llList2Integer(parsedMessage,1);
                if (currentStamina <= 0) 
                {
                    currentStamina = 0;
                    passOut(); 
                }
                else if (currentStamina > baseStamina) 
                {
                    currentStamina = baseStamina;
                }
                llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseHealth);
                writeStamina();
            } 
            if (action == "changeHealth")
            {        
                integer healthChange = llList2Integer(parsedMessage,1);
//llOwnerSay("Change health received."); 
                if (currentHealth <=0 && healthChange > 0)
                    wakeUp();         
                currentHealth += healthChange;
                if (currentHealth <= 0) 
                {
                    currentHealth = 0;
                    passOut();                     
                }
                else if (currentHealth >= baseHealth) 
                {
                    currentHealth = baseHealth; 
                }
                llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth);                
                writeHealth();
            }      
            if (action == "changeStamina")
            {
//llOwnerSay("Change stamina received.");    
                integer staminaChange = llList2Integer(parsedMessage,1); 
                if (currentStamina <= 0 && staminaChange > 0)
                    wakeUp();      
                if (staminaChange > 0) 
                {
                    llRegionSayTo(llGetOwner(), meterChannel, "remImpairment,0");  
                }
                currentStamina +=staminaChange;        
                if (currentStamina > baseStamina) 
                {
                    currentStamina = baseStamina;
                }
                else if (currentStamina < 0)
                {
                    currentStamina = 0;
                    passOut();
                }
                llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseHealth);
                writeStamina();                              
            } 
            if (action == "gainXP")
            {
                integer xpToGain = llList2Integer(parsedMessage,1);
                gainXP(xpToGain);
            }                                                
        hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", ""); 
        }       
    }    
    
    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay(msg);
        msg = llToLower(msg);        
        
        if (msg == "reset character")
        {
            resetHealthStamina();    
        } 
        if (msg == "rest")
        {
//llOwnerSay("Got message: rest");            
            state resting;    
        }
        if (msg == "tournament mode")
        {
            mode = "tournament";
            transSetMode = llUpdateKeyValue((string)llGetOwner() + "_mode", mode, FALSE, "");
            resetHealthStamina();
        }   
        if (msg == "roleplay mode")
        {
            mode = "roleplay";
            transSetMode = llUpdateKeyValue((string)llGetOwner() + "_mode", mode, FALSE, "");            
            resetHealthStamina();
        }   
        if (msg == "ooc mode")
        {
            mode = "ooc";
            transSetMode = llUpdateKeyValue((string)llGetOwner() + "_mode", mode, FALSE, "");            
        }   
        if (msg == "afk mode")
        {
            mode = "afk";
            transSetMode = llUpdateKeyValue((string)llGetOwner() + "_mode", mode, FALSE, "");            
        }   
        if (msg == "* mode")
        {
            mode = "*";
            transSetMode = llUpdateKeyValue((string)llGetOwner() + "_mode", mode, FALSE, "");            
        }
        if (msg == "hard reset")
        {
            state loading;    
        }  
        if (msg == "activatePrimaryWeapon")
        {
            primaryWeaponIsActive = TRUE;
        }                      
        if (msg == "deactivatePrimaryWeapon")
        {
            primaryWeaponIsActive = FALSE;
        } 
        if (msg == "activateSecondaryWeapon")
        {
            secondaryWeaponIsActive = TRUE;
        }                      
        if (msg == "deactivatePrimaryWeapon")
        {
            secondaryWeaponIsActive = FALSE;
        }    
        if (msg == "setarmor")
        {
            myArmor =  llCSV2List((string)id);  
//llOwnerSay("Main HUD, my armor: " +(string)myArmor);            
        }                
        if (msg == "changestamina")
        {
                if (currentStamina <= 0 && num > 0)
                    wakeUp();      
                if (num > 0) 
                {
                    llRegionSayTo(llGetOwner(), meterChannel, "remImpairment,0");  
                }
                currentStamina += num;        
                if (currentStamina > baseStamina) 
                {
                    currentStamina = baseStamina;
                }
                else if (currentStamina < 0)
                {
                    currentStamina = 0;
                    passOut();
                }
                llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseHealth);
                writeStamina();                                          
        }
                                                                                 
    }      

    dataserver(key t, string value)
    {
        if (t == transGetEnemyStats)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                enemyStats = llCSV2List(llGetSubString(value, 2, -1));
               // llOwnerSay("Your stats were successfully read from the database."); 
                enemyStatsLoaded = TRUE;                               
            }
        }         
        if (t == transGetToSetMyXP)
        {
            // our llReadKeyValue transaction is done
//llOwnerSay("Your XP was obtained from the DB.");            
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myXP =  (integer)llGetSubString(value, 2, -1); 
                myXP += tempXP;                  
                tempXP = 0;      
                // ADD XP CHANGE
                transSetMyXP = llUpdateKeyValue((string)llGetOwner() + "_xp", (string)myXP, FALSE, "");                  
            }            
        }         
        if (t == transSetMyXP)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                llMessageLinked(LINK_THIS, myXP, "set xp display", "");                                                          
            }           
        }                                              
    }    
    collision_start(integer numDetected)
    {    
        key collisionObjectKey = llDetectedKey(0);
        string collisionObjectName = llDetectedName(0);
        integer collisionBaseDamage;
        string collisionWeaponType;
        collisionObjectName = llToLower(collisionObjectName);
        list collisionSourceDetails = llGetObjectDetails(collisionObjectKey, [OBJECT_OWNER]);
        key collisionSourceID = llList2Key(collisionSourceDetails, 0);
        enemyStatsLoaded = FALSE;
        transGetEnemyStats = llReadKeyValue((string)collisionSourceID + "_stats");
        string collisionSourceName = llGetDisplayName(collisionSourceID);
        integer gotHit = FALSE;
        integer myAgility = llList2Integer(myStats, ATHLETICS);  
        integer enemyMarksmanship = 2;    
        //if (llSubStringIndex(collisionObjectName, "dtmk") != -1)
        //{
            // spellfire damage. the first 2 digits are the amount disabling all spellfire prim based damage
            
            //collisionBaseDamage = (integer)llGetSubString(collisionObjectName, 0, 1);
            //collisionWeaponType = "unclear";
            //gotHit = TRUE;
            //llOwnerSay("You have been hit for " + (string)collisionBaseDamage + " points of damage by " + collisionSourceName + " with a legacy weapon.");                
        //}
       //else 
       if (llSubStringIndex(collisionObjectName, "arrow") != -1)
        {
            if (llSubStringIndex(collisionObjectName, "barrow") == -1)
            {
                collisionBaseDamage = 5;   
                collisionWeaponType = "arrow";   
                gotHit = TRUE; 
                if (enemyStatsLoaded)
                {
                    enemyMarksmanship = llList2Integer(enemyStats, MARKSMANSHIP);
                }
                integer enemyRoll = rollDice(enemyMarksmanship);
                integer myRoll = rollDice(myAgility);
                if (enemyRoll > myRoll)
                {
//                    collisionBaseDamage += ((enemyRoll - myRoll) / 10) + 1;
//  I think that dividing by 10 reduces the damage too much. Let's try it without it for a while and see.
                    collisionBaseDamage += (enemyRoll - myRoll);
                }
                else if (enemyRoll < myRoll)
                {
                    // then the damage needs to go down 1 point for each 10 points it is lower
//                    collisionBaseDamage -= ((myRoll - enemyRoll) / 10) + 1;  
//  I think that dividing by 10 reduces the damage too much. Let's try it without it for a while and see.
                    collisionBaseDamage -= (myRoll - enemyRoll); 
                    if (collisionBaseDamage <= 0)
                        collisionBaseDamage = 1;  
                }
                else
                {
                    // they are equal so do nothing damage will just be the original collisionBaseDamage   
                }
                llOwnerSay("You have been shot with an arrow for " + (string)collisionBaseDamage + " points of damage by " + collisionSourceName + "."); 
            }                       
        }
        else if (llSubStringIndex(collisionObjectName, "fcobject") != -1)
        {        
            list objectParms = llCSV2List(collisionObjectName);
            if (llGetListLength(objectParms) == 3)
            {
                gotHit = TRUE;
                collisionBaseDamage = llList2Integer(objectParms,2);
                llOwnerSay("You were struck by a " + llList2String(objectParms,1) + " for " + (string)collisionBaseDamage + " points of damage by " + collisionSourceName + ".");
            }    
        }
        if (gotHit)
        {
            if (currentHealth > collisionBaseDamage)
            {
                currentHealth -= collisionBaseDamage;   
                llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth);              
                writeHealth();                    
            }
            else
            {
                currentHealth = 0;
                llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth);     
                writeHealth();            
                passOut();                  
                gainXP(5);                
            }
        }
    } 
    
    experience_permissions(key target_id)
    {  
        if (isPassedOut == TRUE)
            llStartAnimation("Fall Down");
        else 
            llStopAnimation("Fall Down");      
    }
         
       
}

state experienceFailure
{
    state_entry()
    {
//llOwnerSay("State experience Failed.");
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
            llResetScript();
        }
        else if (change & CHANGED_TELEPORT) //note that it's & and not &&... it's bitwise!
        {
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

state resting
{
    state_entry() 
    {      
        isResting = TRUE; 
        animationState = "start";  
        llOwnerSay("You sit to rest and beging to recover.");
        llRequestExperiencePermissions(llGetOwner(), "");
        llSetTimerEvent(5.0);
    }
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {           
            llResetScript();   
        }
    }     
    
    experience_permissions(key target_id)
    {  
        if (isResting)
        {
            if (animationState == "start")
                llStartAnimation("sit_ground");
            else
            {
                llStopAnimation("sit_ground");
                state loaded;
            }
        }
        else
        {    
            if (isPassedOut == TRUE)
                llStartAnimation("Fall Down");
            else 
                llStopAnimation("Fall Down");
        }      
    }
    
    link_message(integer sender_num, integer num, string msg, key id)
    {
        msg = llToLower(msg);
        if (msg == "stop resting")
        {
//llOwnerSay("Got message: stop resting"); 
            animationState = "stop";
            isResting = TRUE;
            llRequestExperiencePermissions(llGetOwner(), "");              
        } 
        if (msg == "setarmor")
        {
            myArmor =  llCSV2List((string)id);         
        }            
        if (msg == "changestamina")
        {
                if (currentStamina <= 0 && num > 0)
                    wakeUp();      
                if (num > 0) 
                {
                    llRegionSayTo(llGetOwner(), meterChannel, "remImpairment,0");  
                }
                currentStamina += num;        
                if (currentStamina > baseStamina) 
                {
                    currentStamina = baseStamina;
                }
                else if (currentStamina < 0)
                {
                    currentStamina = 0;
                    passOut();
                }
                llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseHealth);
                writeStamina();                                          
        }              
    }        
    
    timer()
    {
        if (currentHealth == baseHealth && currentStamina == baseStamina)
        {
            isResting = TRUE;
            animationState = "stop"; 
            llOwnerSay("You are fully recovered.");
            llRequestExperiencePermissions(llGetOwner(), "");               
        }
        if (currentHealth < baseHealth) 
        {
            currentHealth++;
            llMessageLinked(LINK_THIS, currentHealth, "set health display", (string)baseHealth);
            writeHealth();
        }                
        if (currentStamina < baseStamina) 
        {
            currentStamina++;
            llMessageLinked(LINK_THIS, currentStamina, "set stamina display", (string)baseStamina);
            writeStamina();
            llRegionSayTo(llGetOwner(), meterChannel, "remImpairment,0");
        }
        llSetTimerEvent(5.0);         
    }              
}