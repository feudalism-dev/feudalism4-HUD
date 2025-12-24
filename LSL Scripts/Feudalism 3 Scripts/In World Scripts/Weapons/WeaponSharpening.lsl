integer NPC_CHANNEL = -453213492;       // the msg_channel for the npc .. change this for each npc you use
integer PLAYERHUDCHANNEL = -77770;      // the main feudalism player hud listen channel
integer itemChannel = -454545;          // the channel the pouch listens on
integer weaponChannel = -77771;
integer npcListener;                    // listener that the npc uses
integer pouchCheck;                     // flag if a pouch detection test is in progress
integer pouchIsWorn;                    // flag if pouch is found and is on
integer itemsFound;                     // flag if items were found in the item inventory
float menuTimer = 60.0;                 // timer for menu timeouts
string itemsKVKey;                      // this is the string used to access the item inventory keys
string itemsKVValue;                    // this is the string used to access the item inventory values
key transGetItemKeys;                   // key returned from llReadKeyValues for the item inventory keys
key transGetItemValues;                 // key returned from llReadKeyValues for the item inventory values
key transUpdateItemKeys;                // key returned from llUpdateKey for the item inventory keys
key transUpdateItemValues;              // key returned from llUpdateKey for the item inventory values
string itemName;                        // a specific item name
integer itemValue;                      // the value of the item named with item name
list itemNames;                         // the list of names of items in item inventory
list itemValues;                        // the list of values of items in the item inventory
list tempKeys;                          // temporary holder for the item keys prior to loading into the itemKeys list
list tempValues;                        // temporary holder for the item values prior to loading into the itemValues list
integer pouchTimerCounter;              // varialble to count how many times the timer has fired... errors out after 5 times

key ToucherID;                          // id of person touching object

string choreName;
float xpTimer = 60.0;
integer xpToGive = 2;
integer timerCounter = 0;
integer maxTicks = 60;
key av;
integer detectionCounter = 0;
integer weaponDetected = FALSE;
string weaponType;
integer startingHealth;
integer currentHealth;
integer msg_channel = -2222;
integer sharpeningLimit = 20;

tearDown()
{
//    llRegionSay(msg_channel, "detach," + (string)av); 
//    llStopSound();
    //llStopAnimation("Whetstone");
//llSay(0, "detach," + (string)av);     
//    llRegionSayTo(av, weaponChannel, "release");   
//    llRegionSayTo(av, weaponChannel, "sheath");              
//    llUnSit(av);      
}

//////////////////////////////////////////////////////////////////////////////
//
//          Basic Detect Pouch and load Inventory script v1.0
//
//          12/31/2016 Bandor Beningborough
//
//          This script is the foundation for any Feudalism script that needs
//          to check if a user is wearing a pouch and load their inventory
//          items.
//
//          Use it then modify it with the specifics for your new object
//
//          Design note: due to the limited number of key-value pairs in the 
//          experience database, if each inventory item had its own key-value
//          pair, this system would use far too many pairs. There would be one
//          for every item times the number of players. With 200 items and 500
//          players that would be 100,000 keys. So, instead, we combine all
//          of the inventory items into 2 matched lists. One for the name of the
//          item and one for the quantity the user has of the item. We ensure
//          that both lists are updated so that indexes match between them
//
//////////////////////////////////////////////////////////////////////////////

default
{
    state_entry()
    {
        llStopSound();
//llOwnerSay("State Idle:");
        //llSitTarget(<-1.313943, 0.526307, -0.397627>,<0.000000, 0.000000, -0.795619, 0.605797>);      
        choreName = llGetObjectDesc();
        if (choreName == "")
            choreName = "working";           
    }

    touch_start(integer total_number)
    {
        llRegionSayTo(llDetectedKey(0), 0, "You need to sit on this to use it.");
    }

    link_message(integer sender, integer num, string msg, key id){
        if(num==90060){
            av = id;
            llRegionSayTo(av, 0,"Welcome, "+llGetDisplayName(id));
            state detectWeapons;
        }
        if(num==90065){
            llRegionSayTo(av, 0,"Goodbye, "+llGetDisplayName(id));
            llResetScript();
        }        
    }
    
    
}

state detectWeapons
{
    state_entry()
    {
        detectionCounter = 0;
        weaponDetected = FALSE;
        npcListener = llListen(NPC_CHANNEL, "", NULL_KEY, "");
        llSetTimerEvent(1.0);
        llRegionSayTo(av, weaponChannel, "detect");        
    }
    
    link_message(integer sender, integer num, string msg, key id){
        if(num==90065){
            llRegionSayTo(av, 0,"Goodbye, "+llGetDisplayName(id));
            llResetScript();
        } 
        if(msg=="Sharpen"){
            state sharpening;
        }               
    }    
    
    listen(integer channel, string name, key id, string message)
    {
//llOwnerSay("Sharpener: " + message);        
        if (channel == NPC_CHANNEL)
        {
            //llOwnerSay(message);
            message = llToLower(message);
            list parms = llCSV2List(message);
            if (llGetListLength(parms) == 3)
            {
                if (llList2String(parms, 0) == "weapondetected")
                {
                    weaponDetected = TRUE;
                    weaponType = llList2String(parms, 1);
                    startingHealth = llList2Integer(parms, 2);
                    currentHealth = startingHealth;
//llRegionSayTo(av, weaponChannel, "damageWeapon"); 
//currentHealth -= 1;
                    llRegionSayTo(av, 0, "Weapon Health: " + (string)currentHealth);                     
                    
                    
                    if (currentHealth >= sharpeningLimit)
                    {
                        if (currentHealth < 100)
                        {
                            llSetTimerEvent(0.0);  
                            llRegionSayTo(av, 0, "Your weapon needs sharpening.");     
                            if (currentHealth < 90)
                                llRegionSayTo(av, 0, "Your weapons is really dull. You would go faster using a grindstone.");  
                            //llRegionSayTo(av, weaponChannel, "draw"); 
                            //state sharpening;                                
                        } 
                        else
                        {
                            llRegionSayTo(av, 0, "Your weapon does not need sharpening.");
                            tearDown();
                            state default;                            
                        }
                                   
                    }
                    else
                    {
                        llRegionSayTo(av, 0, "Your weapon is too damaged to sharpen. You must find a weaponsmith to fix it.");
                        tearDown();
                        state default;                         
                    } 
                     
                }   
            }
        }
        llListenRemove(npcListener);
    }    
    
    
    timer()
    {
        llSetTimerEvent(0.0);
        if (weaponDetected == FALSE)
        {
            if (detectionCounter < 5)
            {
                detectionCounter++;
                llSetTimerEvent(1.0);
            }
            else
            {
                llRegionSayTo(av, 0, "You do not appear to be wearing a weapon. Come back when you are.");
                tearDown();            
                state default;  
            }
        }
        
    }
} 

state sharpening
{
    
        state_entry()
    {
        llMessageLinked(LINK_SET,90000,weaponType,"");
        llRegionSayTo(av, weaponChannel, "draw"); 
        timerCounter = 0;
        llSetTimerEvent(xpTimer); 
        llLoopSound("Sharpening Knife", 1.0); 
    }
    
    link_message(integer sender, integer num, string msg, key id){
        if(num==90065){
            llRegionSayTo(av, 0,"Goodbye, "+llGetDisplayName(id));
            llResetScript();
        }        
    }    
    
    timer()
    {
        llSetTimerEvent(0.0);     
        if (currentHealth < 100)
        {
            //llRegionSayTo(av, weaponChannel, "draw");             
            llRegionSayTo(av, weaponChannel, "sharpen");   
            llRegionSayTo(av, 0, "You patiently drag the whetstone against the blade.");
            currentHealth++;          
            llRegionSayTo(av, PLAYERHUDCHANNEL, "gainXP," +  (string)xpToGive);
            llRegionSayTo(av, 0, "You gain " + (string)xpToGive + " xp for " + choreName);
            if (currentHealth < 100)
                llSetTimerEvent(xpTimer);
            else
            {
                
                llRegionSayTo(av, weaponChannel, "sheath");
                llRegionSayTo(av, 0, "Your weapon is fully sharpened.");   
                llResetScript();            }
        }
        else
        {
            //llRegionSayTo(av, 0, "Your weapon is razor sharp.");
            tearDown();
            state default;
        }
        llRegionSayTo(av, 0, "Weapon Health: " + (string)currentHealth);         
    }
} 