integer attachChannel;

integer PLAYERHUDCHANNEL = -77770;
integer weaponChannel = -77771;
integer sheathChannel = -77772;
integer NPC_CHANNEL = -453213492;

integer impairmentFound = FALSE;
integer impairmentLevel = 0;
key transGetImpairment;

integer permissionGranted = FALSE;

integer isDrawn = FALSE;
integer isAttached = FALSE;
integer standAnimFound = FALSE;
integer runAnimFound = FALSE;
string weaponName;
string weaponPosition;
string weaponType;
string description;
integer weaponHealth = 100;


vector dummyPos;

integer weaponListener;
integer numberOfAttackAnimations;

integer myMeleeWeaponDamage;
integer myMeleeWeaponSpeed;
integer myMeleeWeaponWeight;
float myMeleeWeaponMinRange;
float myMeleeWeaponMaxRange;

integer weaponIsActive = FALSE;
integer weaponIsDropped = FALSE;
list nearbyOpponents;
list nearbyOpponentsRange;
integer opponentInRange = FALSE;
integer scabbardAttached = FALSE;

integer drawTicks = 1;
integer sheathTicks = 3;
integer timerTicks;
string timerReason;

string keyName = "";
key transGetWeaponStats;
key transGetMyXP;
key transSetMyXP;
key transGetMyStats;
key transGetMyHealth;
key transGetMyStamina;
integer currentStamina;
integer currentHealth;

list myStats;
integer statsLoaded = FALSE;
integer weaponStatsLoaded = FALSE;
integer myFighting;
integer myAttackBonus;
integer myXP;

integer staminaFactor = 0;
integer alreadyAttached = FALSE;
integer detachMessageReceived = FALSE;

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

integer isBroken = FALSE;

damageWeapon()
{
    if (weaponType != "fists")
    {
        weaponHealth--;
        if (weaponHealth == 90)
            llOwnerSay("Your weapon has lost some of its edge.");
        if (weaponHealth == 80)
            llOwnerSay("Your weapon is getting duller.");
        if (weaponHealth == 70)
            llOwnerSay("Your weapon is getting duller.");
        if (weaponHealth == 60)
            llOwnerSay("Your weapon is getting duller.");   
        if (weaponHealth == 50)
            llOwnerSay("Your weapon is losing its ability to deal damage.");
        if (weaponHealth == 40)
            llOwnerSay("Your weapon is becoming useless.");                 
        if (weaponHealth == 30)
            llOwnerSay("Your weapon is badly damaged.");      
        if (weaponHealth == 20)
            llOwnerSay("Your weapon is critically damaged.");    
        if (weaponHealth == 50)
            llOwnerSay("Your weapon is about to break!");                              
        if (weaponHealth == 0)
        {
            isBroken = TRUE;
            llOwnerSay("Your weapon shatters into 100 pieces and is no longer usable. You will have to get another.");
            llDie();
        }
    }   
}

repairWeapon()
{
    if (weaponType != "fists" && weaponType != "improvised")
    {
        if (weaponHealth < 100)
        {
            weaponHealth++;
            if (weaponHealth == 100)
                llOwnerSay("Your weapon is perfectly repaired or sharpened and ready for use.");
            else if (weaponHealth == 90)
                llOwnerSay("Your weapon is almost perfect.");
            else if (weaponHealth == 80)
                llOwnerSay("Your weapon is getting better.");
            else if (weaponHealth == 70)
                llOwnerSay("Your weapon is getting better.");
            else if (weaponHealth == 60)
                llOwnerSay("Your weapon is getting better.");   
            else if (weaponHealth == 50)
                llOwnerSay("Your weapon is halfway repaired.");
            else if (weaponHealth == 40)
                llOwnerSay("Your weapon is still fairly damaged.");                 
            else if (weaponHealth == 30)
                llOwnerSay("Your weapon is still badly damaged.");      
            else if (weaponHealth == 20)
                llOwnerSay("Your weapon is still critically damaged.");    
            else if (weaponHealth == 50)
                llOwnerSay("Your weapon is still very clost to breaking!");                              
        }
    }   
}

dropWeapon()
{ 
    if (weaponIsActive && isDrawn && weaponIsDropped == FALSE)
    {        
        weaponIsDropped = TRUE;         
        llOwnerSay("Warning!!! You dropped your primary weapon! Better find it and pick it up quickly!");
        llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);    
        llRezObject("droppedWeapon", llGetPos() + <0.0,0.0,1.0>, <0.0,0.0,0.0>, <0.0,0.0,0.0,1.0>, 0);
        llSetTimerEvent(60.0);     
    }
}

recoverWeapon()
{      
    llSetTimerEvent(0.0); 
    if (weaponIsDropped && isDrawn)
    {    
        llOwnerSay("Whew! You found your primary weapon and picked it back up.");   
        llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES);            
        weaponIsDropped = FALSE;                 
    }
}

getImpairmentLevel()
{
    keyName = (string)llGetOwner() + "_impairmentLevel";  
    transGetImpairment = llReadKeyValue(keyName); 
}

processXPError(integer errorCode, string fieldName)
{
    string errorMessage = "The Feudalism RPG Meter reports the following error when loading " + fieldName + " data: "; 
    errorMessage += llGetExperienceErrorMessage(errorCode);      
    llOwnerSay(errorMessage);
    //llOwnerSay((string)errorCode);
}

detectWeapon(key requester)
{
    getWeaponStats();
    llRegionSayTo(requester, NPC_CHANNEL, "weaponDetected," + weaponType + "," + (string)weaponHealth);
    //llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES);   
    //llRegionSayTo(llGetOwner(), sheathChannel, "draw");      
    //sheath();
}

releaseWeapon()
{
    llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);   
    llRegionSayTo(llGetOwner(), sheathChannel, "sheath");       
}

registerWeapon (string text) 
{
    llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "registerWeapon," + text);
    isAttached = TRUE;
}

unregisterWeapon () 
{
    llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterWeapon");  
    isAttached = FALSE;   
}

draw() 
{
    if (isDrawn == FALSE && weaponIsDropped == FALSE)
    {
        getWeaponStats();        
        //llRequestExperiencePermissions(llGetOwner(), "");
        llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);          

        if(llGetPermissions() & PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS)        
        {
            keyName = (string)llGetOwner() + "_stats";
            transGetMyStats = llReadKeyValue(keyName);            
            llTakeControls(CONTROL_LBUTTON | CONTROL_ML_LBUTTON, TRUE, FALSE);
            llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES);             
            llRegionSayTo(llGetOwner(), sheathChannel, "draw");            
            llPlaySound("sword_draw", 1.0);
            llStartAnimation("draw " + weaponPosition + "(" + weaponType + ")");            
            llSleep(0.5);
            llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES); 
            isDrawn = TRUE; 
            if (weaponType != "fists")
                llOwnerSay("Weapon health: " + (string)weaponHealth);
            //if (weaponType == "fists") llOwnerSay("You raise your fists ready to fight."); 
            weaponIsActive = TRUE;
            keyName = (string)llGetOwner() + "_stamina";
            transGetMyStamina = llReadKeyValue(keyName); 
            if (standAnimFound) llSetAnimationOverride("Standing", "stand(" + weaponType + ")");
            if (runAnimFound) llSetAnimationOverride("Running", "run(" + weaponType + ")"); 
            if (weaponStatsLoaded) 
            {                        
                llSensor("", "", (AGENT | ACTIVE), myMeleeWeaponMaxRange, PI/2);
                llSensorRepeat("", "", (AGENT | ACTIVE), myMeleeWeaponMaxRange, PI/2, 0.5);              
            }
            getImpairmentLevel();
        }
        else 
        {
            llOwnerSay("You do not have permission to use the weapon. Please grant permission and try again.");   
            //llRequestExperiencePermissions(llGetOwner(), "");
            llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);                 
        }
    }
}

sheath() 
{
    if (weaponIsDropped == FALSE)
    {
        llSensorRemove();    
        //llRequestExperiencePermissions(llGetOwner(), "");
        llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);  
        llResetAnimationOverride("ALL");       
        llReleaseControls( );
        llPlaySound("sword_sheath", 1.0);               
        isDrawn = FALSE;
        if (weaponType == "fists") llOwnerSay("You lower your fists and relaxe.");        
        weaponIsActive = FALSE;
        llStartAnimation("sheath " + weaponPosition + "(" + weaponType + ")");            
        llSleep(1.5);
        llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);
        llRegionSayTo(llGetOwner(), sheathChannel, "sheath");   
    } 
    else
    {
        llOwnerSay("Unable to sheath weapon while it is dropped. Pick it up first.");    
    }              
}

attack() 
{
    //llRequestExperiencePermissions(llGetOwner(), "");
 llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);         
    if (isDrawn == FALSE) 
    {
        draw();
        weaponIsActive = TRUE;
    }
//llOwnerSay("ATTACK. weaponIsDropped: " + (string)weaponIsDropped);    
    if (weaponIsActive && statsLoaded  && currentStamina > 0 && weaponIsDropped == FALSE) 
    {             
//llOwnerSay("Debug. Attack. Play animation");        
        playAttackAnimation();  

        if (opponentInRange == TRUE)
        {           
//llOwnerSay("Debug. Attack. Opponent is in range.");        
            integer i = 0;
            integer attackBonus = llList2Integer(myStats, ATHLETICS) - impairmentLevel;
            if (impairmentLevel > 0)
                attackBonus - impairmentLevel;
                
            integer newDamage = myMeleeWeaponDamage;
            if (weaponType != "fists")
                newDamage = llRound(myMeleeWeaponDamage * (weaponHealth / 100.0));
                
            while (i < llGetListLength(nearbyOpponents))
            {
//llOwnerSay("Send attack message");                              
                llRegionSayTo(llList2Key(nearbyOpponents, i), PLAYERHUDCHANNEL, "broadcastAttack," + (string)llGetOwner() + "," + llList2String(myStats, FIGHTING) + "," + (string)attackBonus + "," + (string)llGetPos() + "," + weaponType + "," + (string)newDamage);
                i++;
            }
            
            integer staminaLoss;
            if (staminaFactor > myMeleeWeaponWeight)
            {
                staminaFactor -= myMeleeWeaponWeight;    
            }
            else
            {
                staminaFactor = 0;
                if (myMeleeWeaponWeight > llList2Integer(myStats, ATHLETICS))
                {
                    staminaLoss = myMeleeWeaponWeight - ATHLETICS;
                }    
                else
                {
                    staminaLoss = 1;    
                }
                if (currentStamina > staminaLoss)
                {
                    currentStamina -= staminaLoss;   
                }
                else
                {
                    currentStamina = 0;    
                }   
            }
            llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "setStamina," + (string)currentStamina);
            keyName = (string)llGetOwner() + "_stamina";
            transGetMyStamina = llReadKeyValue(keyName);              
            weaponIsActive = FALSE;
            llSetTimerEvent(0.5 * myMeleeWeaponSpeed);
       }
    }
    else 
    {
        llOwnerSay("Weapon is not active. Cannot attack."); // only during testing    
    }
}

playAttackAnimation() 
{

        //llRequestExperiencePermissions(llGetOwner(), ""); 
        llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);          
        float numAnims = (float)numberOfAttackAnimations;
        integer animNumber = (integer)llFrand(numAnims) + 1;
        string attackAnimationName = "atk" + (string)animNumber + "(" + weaponType + ")";
        llPlaySound("sword_hit", 1.0);
        llStartAnimation(attackAnimationName); 
        //llSleep(0.61);   
        //llSetTimerEvent(0.61); // why is this?
        //llPlaySound("sword_hit", 1.0);            
}

getWeaponStats()
{
    description = llGetObjectDesc();
    if (description != "")
    {
        list tempList = llCSV2List(description);
        if (llGetListLength(tempList) == 3)
        {
            weaponName = llList2String(tempList, 0);
            weaponType = llList2String(tempList, 1);
            weaponPosition = llList2String(tempList, 2);
            transGetWeaponStats = llReadKeyValue(weaponType);                
        }    
    }  
    else
    {
       llOwnerSay("The description on this weapon does not include the required parameters: weapon name, weapon typle, sheath position.");      
    }      
}

loadAnimations()
{
    numberOfAttackAnimations = 0;
    integer numAnims = llGetInventoryNumber(INVENTORY_ANIMATION);
    integer i =0;
    string animName;
    while (i < numAnims)
    {
        animName = llGetInventoryName(INVENTORY_ANIMATION, i);
        if (llSubStringIndex(animName, "atk") > -1) 
        {
            numberOfAttackAnimations++;
        }
        else if (llSubStringIndex(animName, "stand") > -1)
        {
            standAnimFound = TRUE;
        }
        else if (llSubStringIndex(animName, "run") > -1)
        {
            runAnimFound = TRUE;
        }
        i++;    
    }          
}

integer isOneHanded(string type)
{
    integer result = FALSE;
    if (type == "longsword") result = TRUE;
    if (type == "dagger") result = TRUE;
    if (type == "knife") result = TRUE;
    if (type == "hand axe") result = TRUE;
    if (type == "mace") result = TRUE;
    if (type == "short sword") result = TRUE;
    if (type == "bastard sword") result = TRUE;
    if (type == "club") result = TRUE;    
    return result;
}

attachScabbard()
{
//llOwnerSay("Primary Weapon, Attach, Attaching.");              
            list AttachedUUIDs = llGetAttachedList(llGetOwner());
//llOwnerSay("AttachedUUIDs: " + llDumpList2String(AttachedUUIDs,"\n") );   
            integer i;
            alreadyAttached = FALSE;
            integer numLHFound = 0;
            integer numRHFound = 0;
            while (i < llGetListLength(AttachedUUIDs) )
            {
                list temp = llGetObjectDetails(llList2Key(AttachedUUIDs,i),[OBJECT_ATTACHED_POINT, OBJECT_NAME]);
//llOwnerSay("attachment found: " + llDumpList2String(temp, "|"));
                integer attachPoint = llList2Integer(temp,0);
                string name = llList2String(temp, 1);
                integer tempIndex = llSubStringIndex(name, "Feudalism");
//llOwnerSay("Name: " + name + ", index: " + (string)tempIndex);  
//llOwnerSay("Attach point: " + (string)attachPoint);                              
                if (tempIndex != -1)
                {
                    // -1 means feudaulism wasn't in the name, so ignore it.. thus, only do the following
                    // for attachmens that DO include the name "feudalism
                    if (attachPoint == ATTACH_RHAND)
                        numRHFound++;
                    else if (attachPoint == ATTACH_LHAND)
                        numLHFound++;
                }
                ++i;
            }
            integer secondaryIsActive = FALSE;
            if (numLHFound)
                secondaryIsActive = TRUE;
            integer handed = 2;
            if (isOneHanded(weaponType))
                handed = 1;
            if (handed == 1 || (handed == 2 && secondaryIsActive == FALSE))
            {
                if (numRHFound == 1)
                {
                    if (permissionGranted)
                    {
                        attachChannel = llRound(llFrand(-1000));
                        llRezObject("scabbard", llGetPos(), ZERO_VECTOR, ZERO_ROTATION, attachChannel);
                    }
                    else
                    {
                        llOwnerSay("Failed to grant permissions to experience. Unable to rezz scabbard and register weapon. Try again later.");   
                    }
                }
                else
                {
                    llRegionSayTo(llGetOwner(), 0, "You already have a primary weapon attached to your right hand. Detach it before attempting to attach a new one.");
                    alreadyAttached = TRUE;
                    llDetachFromAvatar();   
                }
            } 
            else  if (handed == 2 && secondaryIsActive == TRUE)
            {
                 llRegionSayTo(llGetOwner(), 0, "You are attempting to attach a 2 handed weapon and your left hand is full. Detach what is in your left hand and try again.");
                 alreadyAttached = TRUE;
                 llDetachFromAvatar();                      
            }                     
            // this happens when the weapon attaches... should call registerWeapon
    
}

default
{
    state_entry()
    {
        llOwnerSay(llGetObjectName() + " starting up.");
        state preRun;
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
        llOwnerSay(llGetObjectName() + " is ready for use.");
        state idle;
    }    
}

state experienceFailure
{
    state_entry()
    {
//llOwnerSay("State experience Failed.");
        llOwnerSay("This object cannot operate due to experience permissions not being set or allowed.");
        //llRequestExperiencePermissions(llGetOwner(), "");
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

state idle
{
    state_entry()
    { 
//llOwnerSay("Entered state: idle.");    
        permissionGranted = FALSE;   
        weaponStatsLoaded = FALSE;   
        standAnimFound = FALSE;
        runAnimFound = FALSE;   
        scabbardAttached = FALSE;
        weaponHealth = 100;   
        //llRequestPermissions(ownerKey, PERMISSION_OVERRIDE_ANIMATIONS);   
        llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);         
             
        llSetTimerEvent(60.0);  
        llListenRemove(weaponListener); 
        weaponListener = llListen(weaponChannel, "", "", "");               
        getWeaponStats();
        loadAnimations();
        if(llGetAttached())   
        {                                        
            registerWeapon(description);   
            sheath();
            getImpairmentLevel();    
        }       
 
    }
 
     changed(integer change)
    {
        if (change & CHANGED_REGION) //note that it's & and not &&... it's bitwise!
        {
            //llOwnerSay("You changed regions.");
            if (llAgentInExperience(llGetOwner()) == 0)
            {
                llOwnerSay("You have entered a sim that does not run our feudalism rpg experience. Detaching weapons.");
                //unregisterWeapon();
                //llRegionSayTo(llGetOwner(), sheathChannel, "detach");                
                //llDetachFromAvatar();                                            
            }
        }
    } 
    
    on_rez(integer start_parameter)
    {   
        //permissionGranted = FALSE;       
        //llRequestExperiencePermissions(llGetOwner(), "");
        //llRequestPermissions(llGetOwner(), PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS);         
        llListenRemove(weaponListener); 
        weaponListener = llListen(weaponChannel, "", "", "");        
    }
    
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        //llOwnerSay("Permission granted.");
        permissionGranted = TRUE;
        if (scabbardAttached == FALSE)
            attachScabbard();
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
        llOwnerSay("Experience permissions were denied. You cannot use this weapon without accepting them.");
    }
 
    attach( key id )
    {   // Attached or detached from the avatar
//llOwnerSay("Primary Weapon, Attach");    
        if (id)
        {
            
            // check experience permissions
            llRequestExperiencePermissions(llGetOwner(), "");
        }
        else
        {
            unregisterWeapon(); 
//llOwnerSay("Primary Weapon, Attach, Detaching."); 
            // this happens when the weapon detaches... should unregister the weapon
            scabbardAttached =  FALSE;
            if (alreadyAttached == TRUE)
            {
//llOwnerSay("Weapon never rezzed the sheath or registered and is detaching.");                
                // never rezzed sheath, never registered
                isAttached = FALSE; 
                alreadyAttached = FALSE;   
            }
            else
            {
//llOwnerSay("Weapon has already rezzed sheath and has registered in hud. Starting detachment.");                 
                // this occurs if the detachment is done once the weapon is on and registered

                alreadyAttached = FALSE;
                isAttached = FALSE;
                llOwnerSay("Primary weapon is detaching.");                 
                if (detachMessageReceived == TRUE)
                {
                    // this means that the SHEATH sent a detach message to the blade, so don't send a detach to sheath
//llOwnerSay("Detaching because Detach Message Received from Sheath. Do not send back a detach to the sheath.");                
                    detachMessageReceived = FALSE;
                }
                else if (detachMessageReceived == FALSE)
                {
//llOwnerSay("Detaching due to manually detaching the blade. So send detach to sheath.");                        
                    llRegionSayTo(llGetOwner(), sheathChannel, "detach");
                }           
            }
        }
    }   
    
    listen( integer channel, string name, key id, string message ) {
        if (channel == weaponChannel) {        
            if (isAttached)
            {           
//llOwnerSay("Weapon says: " + message + " with description; " + description); 
//llOwnerSay("Weapon says: " + message + " from " + (string)id);
                llListenRemove(weaponListener);       
                if (message == "draw") draw();
                else if (message == "sheath") sheath();
                else if (message == "attack") attack();
                else if (message == "check") registerWeapon(description);
                else if (message == "drop") dropWeapon();
                else if (message == "recover") recoverWeapon();
                else if (message == "damageWeapon") damageWeapon();
                else if (message == "sharpen") repairWeapon();
                else if (message == "repairWeapon") repairWeapon();    
                else if (message == "detect") detectWeapon(id);
                else if (message == "release") releaseWeapon();    
                else if (message == "detach") 
                {
                    detachMessageReceived = TRUE;                 
                    unregisterWeapon();      
                    llDetachFromAvatar();                                      
                }
                weaponListener = llListen(weaponChannel, "", "", "");   
            }
        }  
    }
    
    control(key avatar, integer levels, integer edges)// do i really need this in the weapon, or should this be done in the hud and the weapon simply animates?
    {
        if (weaponIsActive)     // do not even recognize clicks if weapon is not active.. ie not ready 
        {      
            // mouse press
            if ((levels & CONTROL_ML_LBUTTON) && (edges & CONTROL_ML_LBUTTON)) 
            {   
                attack();                                     
            }         
        }
    }        

    touch_start(integer total_number)
    {
        //llSay(0, "Touched.");
    }
    
    timer()
    {   
        llSetTimerEvent(0.0);
        if (weaponIsDropped)
        {
            recoverWeapon();                      
        }
        else if (weaponIsActive == FALSE)
        {
            weaponIsActive = TRUE;
        }
    }
    
    sensor(integer num_detected)
    {      
        nearbyOpponents = [];
        nearbyOpponentsRange = [];
        opponentInRange = FALSE;
        float distance;
        integer i = 0;
        do 
        {
            distance = llVecDist(llGetPos(), llDetectedPos(i) );
            if (distance >= myMeleeWeaponMinRange && distance <= myMeleeWeaponMaxRange)
            {
                nearbyOpponents += llDetectedKey(i);
//llOwnerSay("Found: " + llDetectedName(i));             
                nearbyOpponentsRange += distance;
                opponentInRange = TRUE;           
            }
        }
        while(++i < num_detected);                     
    }
    no_sensor()
    {
        nearbyOpponents = [];
        nearbyOpponentsRange = [];        
        opponentInRange = FALSE;
    }
    
    object_rez(key id)
    {
        llRegionSay(attachChannel, "ATTACH|" + (string)llGetOwner());            
        //if (!weaponStatsLoaded) transGetWeaponStats = llReadKeyValue(weaponType);
        scabbardAttached = TRUE;
        llListenRemove(weaponListener); 
        weaponListener = llListen(weaponChannel, "", "", "");                                             
        registerWeapon(description);   
        sheath();
        getImpairmentLevel();    
    }    

    
    dataserver(key t, string value)
    {
        if (t == transGetImpairment)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                impairmentLevel = (integer)llGetSubString(value, 2, -1);
                impairmentFound = TRUE;                               
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
                    processXPError(error, "Impairment Level"); 
                }
                else 
                {
                    //setImpairment();
                }
                impairmentFound = FALSE;
            }
        } 
        
        
        if (t == transGetWeaponStats)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                list tempWeaponStats = llCSV2List(llGetSubString(value, 2, -1));
                if (llGetListLength(tempWeaponStats) == 5)
                {
                    myMeleeWeaponDamage = (integer)llList2String(tempWeaponStats, 0);
                    myMeleeWeaponSpeed = (integer)llList2String(tempWeaponStats, 1);
                    myMeleeWeaponWeight = (integer)llList2String(tempWeaponStats, 2);
                    myMeleeWeaponMinRange = (float)llList2String(tempWeaponStats, 3);
                    myMeleeWeaponMaxRange = (float)llList2String(tempWeaponStats, 4);                    
                    weaponStatsLoaded = TRUE;     
                }
                llOwnerSay("Your weapon's stats were successfully read from the database."); 
                          
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                llOwnerSay("The stats for your weapon could not be loaded, please check with the vendor.");              
            }
        } 
        else if (t == transGetMyStats)
        {          
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {              
                // the key-value pair was successfully read
                myStats =  llCSV2List(llGetSubString(value, 2, -1));
                staminaFactor = llList2Integer(myStats, ATHLETICS);
                statsLoaded = TRUE;
//llOwnerSay("fighting " + llList2String(myStats, FIGHTING));                
                //llOwnerSay("Your XP was successfully read from the database.");                                
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("You have not saved your stats. You must use the setup hud to create  your character for this RP hud to work.");
                //myXP = 0;               
            }            
        }         
        else if (t == transGetMyXP)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                myXP =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("Your XP was successfully read from the database.");                                
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("You have not saved your stats. You must use the setup hud to create  your character for this RP hud to work.");
                myXP = 0;
            }            
        }    
        else if (t == transGetMyHealth)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                currentHealth =  (integer)llGetSubString(value, 2, -1);
               // llOwnerSay("Your current health was successfully read from the database.");                                
            }
            else
            {
                // the key-value pair failed to read
                //integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("You have not saved your stats. You must use the setup hud to create  your character for this RP hud to work.");
                //currentHealth = baseHealth;               
            }            
        }    
        else if (t == transGetMyStamina)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                currentStamina =  (integer)llGetSubString(value, 2, -1);
               // llOwnerSay("Your current stamina was successfully read from the database.");                                
            }
            else
            {
                // the key-value pair failed to read
                //integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("You have not saved your stats. You must use the setup hud to create  your character for this RP hud to work.");
                //currentStamina = baseStamina;                      
            }            
        }                  
          
              
                        
    }       

    run_time_permissions(integer perm)
    {
        if (perm & PERMISSION_TAKE_CONTROLS | PERMISSION_TRIGGER_ANIMATION | PERMISSION_OVERRIDE_ANIMATIONS)
        {
            permissionGranted = TRUE;
        }
    }

}
