integer debugMode = FALSE;
//Unity 2 arrow names

//"arrow-lbow";
//"arrow-norm";
//"arrow-scrm";
//"arrow";

// primus arrow names
//
// Primus Arrow 3.5

// spellfire arrow

// "05sfcsdtmk"   longbow
// "04sfcsdtmk"   normal
// "02sfcsdtmk"    screamer

// dcs2
//
// "arrow"

// A&D Spellfire arrows
// 04sfcsdtmk)<SF>( Arrow
// blood/spark prim
// Target Arrow

// sz
// Sniper Arrow
// Normal Arrow
// Target Arrow
// Fire Arrow


// gm
// Normal Arrow
// Smoke Arrow
// Smoke Bomb
integer meleeCR;
string killedBy;
integer PLAYERHUDCHANNEL = -77770;
integer weaponChannel = -77771;
integer DUMMYCHANNEL = -88880;
integer attackListener;

integer MARKSMANSHIP = 13;
integer FIGHTING = 8;
list stats;  
integer beenHit = FALSE;
vector myPos;
vector shooterPos;
float distance;
integer tempMarksmanship = 2;
string animalName;
integer baseHealth = 100;
integer resetDelay = 30;
integer currentHealth;
integer damagePerHit;
integer meleeDamage;
integer myXP = 0;
integer xpEarned = 3;
key hitByKey = NULL_KEY;

string keyName = "";      
string transReason = "";      
key trans = NULL_KEY; 
string name = "";
string arrowType = "";        
string hitByName = "";        
key transGetWeaponStats;

string activeText = "";
key attacker;
key lastAttacker;
string attackerName;
integer underAttack = FALSE;
key attackFrom;
integer attackFighting;
integer attackBonus;

// random location management
list locations;
list rotations;
integer numberOfLocations = 0;
vector currentPosition;
rotation currentRotation;
integer MAX_LOCATIONS = 40;

integer isActive = FALSE;

string displayText;

debug(string message)
{
    if (debugMode)
        llOwnerSay(message);   
}

processArrowHit()
{
llOwnerSay("Process Arrow Hit");
    damagePerHit += rollDice(tempMarksmanship);
    if (isActive && arrowType != "other") 
    {
        integer type = llDetectedType(0);
        if (type == ACTIVE || type == (ACTIVE | SCRIPTED))
        {
            myPos = llGetPos();
            list details = llGetObjectDetails(hitByKey, [OBJECT_POS]);
            shooterPos =  llList2Vector(details, 0);
            distance =llVecDist(myPos, shooterPos);
            if (!beenHit)
            {
                llMessageLinked(LINK_ALL_OTHERS,0,"show,1","");
                llMessageLinked(LINK_ALL_OTHERS,0,"hide,2","");
            }
            else
            {
                llMessageLinked(LINK_ALL_OTHERS,0,"show,1","");
                llMessageLinked(LINK_ALL_OTHERS,0,"show,2","");
            }
            if (arrowType == "longbow")
            {
                damagePerHit += 5;
            }
            else 
            {
                damagePerHit += 4;
            }
            if (distance < 50.0) damagePerHit++;
            if (distance < 20.0) damagePerHit++;
            if (distance < 10.0) damagePerHit++;
            llRegionSayTo(hitByKey, 0, animalName + " hit by a " + arrowType + " arrow from " + hitByName + " at a range of " + (string)distance  + " meters away for " + (string)damagePerHit + " points of damage.");            
            currentHealth -= damagePerHit;  
            displayText = animalName + ": health: " + (string)currentHealth + " CR: " + (string)meleeCR;
            llSetText(displayText, <1.0,1.0,1.0>, 1.0);                      
            if (currentHealth <= 0)
            {              
                killedBy = "arrow";                      
                state dead;               
            }
            llRegionSayTo(hitByKey, 0, "Health remaining: " + (string)currentHealth);             
        }
    }    
}

processAttack(list weaponStats)
{
debug("processAttack");
    integer weaponDamage = llList2Integer(weaponStats, 0);
    integer weaponSpeed = llList2Integer(weaponStats, 1);
    integer weaponWeight = llList2Integer(weaponStats, 2);
    float weaponMinRange = llList2Float(weaponStats, 3);
    float weaponMaxRange = llList2Float(weaponStats, 4);  

    integer attackRoll = rollDice(attackFighting);
    integer defenseRoll = rollDice(meleeCR);
    
    if (attackRoll > defenseRoll)
    {   
        // scored a hit on the animal
        meleeDamage = weaponDamage + attackBonus + (integer)llFrand(attackFighting) - 1;
debug("Attacker: " + (string)attacker); 
        llRegionSayTo(attacker, 0, "You hit the " + animalName + " for " + (string)meleeDamage + " points of damage."); 
        currentHealth -= meleeDamage;  
        displayText = animalName + ": health: " + (string)currentHealth + " CR: " + (string)meleeCR;
        llSetText(displayText, <1.0,1.0,1.0>, 1.0);               
        if (currentHealth <= 0)
        {
            hitByKey = attacker;
            killedBy = "melee";
            state dead;
        }

    }
    else
    {
        llRegionSayTo(attacker, 0, "You either didn't hit the animal or hit but did no damage.");        
    }
    llListenRemove(attackListener);        
    attackListener = llListen(PLAYERHUDCHANNEL, "", NULL_KEY, "");                    
   
      
}

setNewPosition()
{
    integer index = 0;    
    if (numberOfLocations > 0)
    {
        index = (integer)llFrand(numberOfLocations) + 1;    
        currentPosition = llList2Vector(locations, index-1);
        currentRotation = llList2Rot(rotations, index-1);    
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

string getArrowType(string name)
{
    name = llToLower(name);
    if (name == "arrow-lbow" || name == "05sfcsdtmk")
    {
        return "longbow";   
    }
    else if (llSubStringIndex(name, "arrow") != -1)
    {
        return "arrow";    
    }
    else return "other";
       
}


default
{
    state_entry()
    {     
        beenHit = FALSE;
        string description = llGetObjectDesc();
        list descriptionParms = llCSV2List(description);
        llSay(0,"Setting up Feudalism 3 Practice Dummy.");
        killedBy = "";
        if (llGetListLength(descriptionParms) == 4)
        {
            animalName = llList2String(descriptionParms, 0);
            baseHealth = llList2Integer(descriptionParms, 1);
            currentHealth = baseHealth;
            resetDelay = llList2Integer(descriptionParms, 2);
            meleeCR = llList2Integer(descriptionParms, 3);
            llSay(0,"Animal name: " + animalName);
            llSay(0,"Base health: " + (string)baseHealth);
            llSay(0,"Melee CR: " + (string)meleeCR);
            llSay(0,"Feudalism 3 Practice Dummy ready.");
            displayText = animalName + ": health: " + (string)currentHealth + " CR: " + (string)meleeCR;
            llSetText(displayText, <1.0,1.0,1.0>, 1.0);
            llSetLinkAlpha(LINK_THIS, 1.0, ALL_SIDES); 
            currentPosition = llGetPos();
            currentRotation = llGetRot();
            //locations = [currentPosition]; 
            //rotations = [currentRotation]; 
            //llSay(0,"Set starting position to " + (string)currentPosition);    
            numberOfLocations = 0;   
            underAttack = FALSE;
            attacker = NULL_KEY;
            attackerName = "";                          
            state running;
        }
        else 
        llSay(0,"Error: the description must include 4 fields separated by commas: name of dummy, health of dummy, how long to wait to reset dummy after kill, CR of hitting the dummy with a melee weapon. In the format: dummy1,100,60,4");

    }
    
}

state running
{
    state_entry()
    {
        string anim = llGetInventoryName(INVENTORY_ANIMATION,0);
        if (anim != "")
            llStartObjectAnimation(anim);
        llMessageLinked(LINK_ALL_OTHERS,0,"hide,1","");
        llMessageLinked(LINK_ALL_OTHERS,0,"hide,2","");           
        //llOwnerSay("Animal is resetting.");
        currentHealth = baseHealth;
        killedBy = "";        
        underAttack = FALSE;
        attacker = NULL_KEY;
        attackerName = "";            
        //vector newPos = getNewPosition();
        //llOwnerSay("newPos: " +(string)newPos);
        //llSetRegionPos(newPos);
        llSay(0,"Moving to stored position.");
        llSetRegionPos(currentPosition);
        llSetRot(currentRotation);        
        displayText = animalName + ": health: " + (string)currentHealth + " CR: " + (string)meleeCR;
        llSetText(displayText, <1.0,1.0,1.0>, 1.0);
        attackListener = llListen(PLAYERHUDCHANNEL, "", NULL_KEY, "");
        llSetLinkAlpha(LINK_THIS, 1.0, ALL_SIDES);         
        isActive = TRUE;
    }
    
    on_rez(integer num)
    {  
    }

    touch_start(integer num) 
    { 
        llResetTime(); 
    }
    
    touch_end(integer num)
    {
        if ( llGetTime() > 0.8 ) 
        {
            if (llGetOwner() == llDetectedKey(0) )
            {
                if (numberOfLocations < MAX_LOCATIONS)
                {
                    locations += llGetPos();
                    rotations += llGetRot();
                    llSay(0,"New location #" + (string)(numberOfLocations+1) + " stored for random appearance. You may have up to " + (string)MAX_LOCATIONS + ".");
                    numberOfLocations++;
                    llSay(0,"Moving back to to stored position #1.");
                    currentPosition = llList2Vector(locations,0);
                    currentRotation = llList2Rot(rotations,0);
                    llSetRegionPos(currentPosition);
                    llSetRot(currentRotation);                      
                }
            }            
        }
//        else
//        {
            // short touch    
            
//            if (underAttack == FALSE)
//            {
//                if (attacker != NULL_KEY) lastAttacker = attacker;
//                attacker = llDetectedKey(0);
//                //keyName = (string)attacker + "_stats";      
//                //transReason = "getMeleeStats";      
//                //trans = llReadKeyValue(keyName);                 
//                attackerName = llGetDisplayName(attacker);
//                llRegionSayTo(llDetectedKey(0), 0, "You have 5 minutes to kill this //animal.");
//                underAttack = TRUE;
//                llListenRemove(attackListener);
//                attackListener = llListen(PLAYERHUDCHANNEL, "", NULL_KEY, "");
//                //activeText = attackerName + " is attacking this animal.";
//                if (lastAttacker != NULL_KEY)
//                {
//                    llRegionSayTo(lastAttacker, weaponChannel, "dummyRemove," + //(string)llGetKey());                
//                }
//                llRegionSayTo(attacker, weaponChannel, "dummyAdd," + (string)llGetKey() + //"," + (string)llGetPos());
//               // llSetText(activeText, <1.0,1.0,1.0>, 1.0); 
//                llSetTimerEvent(300.0); // set timer for 5 minutes.. if you haven't killed //the animal by then reset toucher  
//            }   
//            else
//            {
//                llRegionSayTo(llDetectedKey(0), 0, "The animal is in use. Try again later.");    
//            }                    
            
//        }
    }
    
    listen( integer channel, string name, key id, string message )
    {
        if (channel == PLAYERHUDCHANNEL)
        {
            
            llListenRemove(attackListener);
        // llRegionSayTo(dummyKey, DUMMYCHANNEL, "dummyAttack," + (string)llGetOwner() + "," + llList2String(myStats, FIGHTING) + "," + llList2String(myStats, AWARENESS) + "," + (string)llGetPos() + "," + weaponType);
debug("Listen, Message: " + message);
            attacker = llGetOwnerKey(id);
            list attackParms = llCSV2List(message);
debug("attackParms: " + (string)attackParms);
debug("Pos: " + llList2String(attackParms,4));        
            string act = llList2String(attackParms, 0);
            attackFrom = llList2Key(attackParms, 1);
            attackFighting = llList2Integer(attackParms, 2);
            attackBonus = llList2Integer(attackParms, 3);
            vector attackPos = (vector)llList2String(attackParms,4);
            string attackWT = llList2String(attackParms, 5);
       
debug("Message received by dummy. " + act);        
            if (act == "broadcastAttack")
            {
                 transGetWeaponStats = llReadKeyValue(attackWT);    
            }    
            attackListener = llListen(PLAYERHUDCHANNEL, "", attacker, "");    
        
        }       
    }    
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (underAttack)
        {
            llListenRemove(attackListener);
            llResetScript();
        }
    } 

    
    collision_start(integer numberOfCollisions)
    {
        integer i = 0;
        damagePerHit = 0;
        name = llDetectedName(0);
        arrowType = getArrowType(name);        
        key tempKey = llDetectedOwner(0);
        if (tempKey != hitByKey)
        {
            hitByKey = llDetectedOwner(0);
            hitByName = llGetDisplayName(hitByKey);        
            keyName = (string)hitByKey + "_stats";      
            transReason = "getStats";      
            trans = llReadKeyValue(keyName);        
        }
        else
            processArrowHit();
    }
    dataserver(key t, string value)
    {
            
        if (t == trans && transReason == "getStats")
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                list tempStats = llCSV2List( llGetSubString(value, 2, -1));
                tempMarksmanship = llList2Integer(tempStats, MARKSMANSHIP);
                processArrowHit();                
                //llRegionSayTo(hitByKey, 0, "Your xp was read from the database.");                    
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llRegionSayTo(hitByKey, 0, "Your xp was not found in the database and may not have been saved yet.");                       
                //myXP = 0;
            }
                //llRegionSayTo(hitByKey, 0, "You earned " + (string)xpEarned + " XP for this kill.");     
                //myXP += xpEarned;
                //transReason = "updateXP";
                //trans = llUpdateKeyValue(keyName, (string)myXP, FALSE, "");             
        trans = NULL_KEY;
        transReason = "none";  
        } 

        else if (t == transGetWeaponStats)
        {
            // our llReadKeyValue transaction is done
            if (llGetSubString(value, 0, 0) == "1")
            {
                // the key-value pair was successfully read
                list tempWeaponStats = llCSV2List(llGetSubString(value, 2, -1));
                if (llGetListLength(tempWeaponStats) == 5)
                { 
debug("transGetWeaponStats, call processAttack");
                   processAttack(tempWeaponStats); 
                }
                //llOwnerSay("Your weapon's stats were successfully read from the database."); 
                          
            }
            else
            {
                // the key-value pair failed to read
                integer error =  (integer)llGetSubString(value, 2, -1);
                //llOwnerSay("The stats for your weapon could not be loaded, please check with the vendor.");
            }             
        }                 
                         
    }   
    

    
    
     
}

state dead
{

    state_entry()
    {

        isActive = FALSE;
        underAttack = FALSE;
        currentHealth = 0;
        llRegionSayTo(hitByKey, 0, "Health remaining: " + (string)currentHealth); 
        llRegionSayTo(hitByKey, 0, animalName + " is dead, killed by " + llGetDisplayName(hitByKey) + ".");
        llSay(0, animalName + " is dead, killed by " + llGetDisplayName(hitByKey) + ".");
        if (killedBy == "arrow")
        {
            if (distance > 100) xpEarned++;
            if (distance > 200) xpEarned++;                                
        }
        else
        {
            xpEarned = meleeCR;    
        }
        llRegionSayTo(hitByKey, PLAYERHUDCHANNEL, "gainXP," + (string)xpEarned);
        llSetText("", <1.0,1.0,1.0>, 1.0);   
        llSetLinkAlpha(LINK_THIS, 0.0, ALL_SIDES);
         // Count of all items in prim's contents
//        integer count = llGetInventoryNumber(INVENTORY_OBJECT); 
//        string  itemName;
//        list items = [];
//        integer i = 0;
//        // llOwnerSay("count: " + (string)count);
//        while (i < count)
//        {
//            itemName = llGetInventoryName(INVENTORY_OBJECT, i);
//            items += itemName;
//            //llOwnerSay("ItemName: " + itemName);
//            llRezObject(itemName, llGetPos(), ZERO_VECTOR, ZERO_ROTATION, 0);
//            i++;
//        }             
//        //llRezObject(itemName, llGetPos(), ZERO_VECTOR, ZERO_ROTATION, 0);       
        llSetTimerEvent((float)resetDelay); 
    }

     timer()
    {
        hitByKey = NULL_KEY;
        tempMarksmanship = 2;
        name = "";
        arrowType = "";  
        setNewPosition();
        state running;
    }  
    
}    

