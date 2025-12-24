
integer PLAYERHUDCHANNEL = -77770;
integer hudListenHandle;
integer weaponChannel = -77771;
integer sheathChannel = -77772;
integer weaponChannel2 = -77773;
integer sheathChannel2 = -77774;
string action;
string regWeaponName;
string regWeaponType;
string regWeaponPosition;
string regWeaponName2;
string regWeaponType2;
string regWeaponPosition2;
integer myMeleeWeaponDamage = 0;
integer myMeleeWeaponSpeed = 0;
integer myMeleeWeaponWeight = 0;
integer myMeleeWeaponMinRange = 0;
integer myMeleeWeaponMaxRange = 0;
integer myMeleeWeaponDamage2 = 0;
integer myMeleeWeaponSpeed2 = 0;
integer myMeleeWeaponWeight2 = 0;
integer myMeleeWeaponMinRange2 = 0;
integer myMeleeWeaponMaxRange2 = 0;
string myActiveMeleeWeapon;
integer meleeWeaponIsActive = FALSE;
integer meleeWeaponIsDrawn = FALSE;
string myActiveMeleeWeapon2;
integer meleeWeapon2IsActive = FALSE;
integer meleeWeapon2IsDrawn = FALSE;


list weaponTypeList = ["dagger","knife","short sword","longsword", "bastard sword","two handed sword","great sword","polearm","spear","dual swords","fists","club","mace","two handed mace","hand axe", "battle axe"];
list weaponSpeedList = [2,2,2,3,3,4,5,3,2,2,1,3,3,3,3,5];
list weaponWeightList = [1,1,2,3,4,5,9,4,2,6,1,3,5,8,3,10];
list weaponDamageList = [4,3,5,6,8,9,12,6,4,5,2,5,6,10,7,11];
list weaponMinRangeList = [0.0,0.0,0.1,0.65,0.77,0.72,0.85,1.5,1.2,0.75,0.0,0.2,0.8,1.0,0.5,0.7];
list weaponMaxRangeList = [1.0,1.0,1.3,1.6,2.0,1.9,3,3.5,3.2,1.5,0.8,1.2,1.4,1.6,1.4,1.7];

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
//debug("SetLinktextureFast, params: " + (string)Params);    
    llSetLinkPrimitiveParamsFast(link, Params);
}

unSetActiveWeapon() {
    integer link;
    llMessageLinked(LINK_ROOT, 0, "deactivatePrimaryWeapon", "");
//    llRegionSayTo(llGetOwner(), weaponChannel, "detach");   
//    llRegionSayTo(llGetOwner(), sheathChannel, "detach");              
    link = getLinkNumberByName("rp_slot0");    
    setLinkTextureFast(link, "active_none", 4);
    meleeWeaponIsActive = FALSE;
}

unSetActiveWeapon2() {
    integer link;    
    llMessageLinked(LINK_ROOT, 0, "deactivateSecondaryWeapon", "");    
//    llRegionSayTo(llGetOwner(), weaponChannel2, "detach");  
//    llRegionSayTo(llGetOwner(), sheathChannel2, "detach");              
    link = getLinkNumberByName("rp_slot1");    
    setLinkTextureFast(link, "active_none", 4);
    meleeWeapon2IsActive = FALSE;
}

setActiveWeapon(string name, string type, string position) {
    integer link;
    integer index;
    
    index = llListFindList(weaponTypeList, [type]);
    if (index != -1) 
    {            // found weapon type
        llMessageLinked(LINK_ROOT, 0, "activatePrimaryWeapon", "");    
        myActiveMeleeWeapon = type;    
        myMeleeWeaponDamage = llList2Integer(weaponDamageList, index);
        myMeleeWeaponSpeed = llList2Integer(weaponSpeedList, index);
        myMeleeWeaponWeight = llList2Integer(weaponWeightList, index);
        myMeleeWeaponMinRange = llList2Integer(weaponMinRangeList, index);
        myMeleeWeaponMaxRange = llList2Integer(weaponMaxRangeList, index);        
        
        link = getLinkNumberByName("rp_slot0");       
        setLinkTextureFast(link, myActiveMeleeWeapon + " active", 4);  
        llSetLinkAlpha(link, 1.0, 4);    
        meleeWeaponIsActive = TRUE;
        llRegionSayTo(llGetOwner(), weaponChannel, "sheath");                    
        meleeWeaponIsDrawn = FALSE;
        if (myActiveMeleeWeapon != "fists") 
        {        
            //llOwnerSay("You have put a " + regWeaponName + " on your " + regWeaponPosition + ".");
        } 
        else
        {
            //llOwnerSay("You have fists and you're not afraid to use them.");            
        }
    }
    else
    {
        llOwnerSay("RP Hud could not find data for type of weapon attached.");
    }
}

setActiveWeapon2(string name, string type, string position) {
    integer link;
    integer index;
         
    index = llListFindList(weaponTypeList, [type]);
    if (index != -1) {            // found weapon type
        llMessageLinked(LINK_ROOT, 0, "activateSecondaryWeapon", "");      
        myActiveMeleeWeapon2 = type;    
        myMeleeWeaponDamage2 = llList2Integer(weaponDamageList, index);
        myMeleeWeaponSpeed2 = llList2Integer(weaponSpeedList, index);
        myMeleeWeaponWeight2 = llList2Integer(weaponWeightList, index);
        myMeleeWeaponMinRange2 = llList2Integer(weaponMinRangeList, index);
        myMeleeWeaponMaxRange2 = llList2Integer(weaponMaxRangeList, index);       
    
        link = getLinkNumberByName("rp_slot1");       
        setLinkTextureFast(link, myActiveMeleeWeapon2 + " active", 4);  
        llSetLinkAlpha(link, 1.0, 4);    
        meleeWeapon2IsActive = TRUE;
        llRegionSayTo(llGetOwner(), weaponChannel2, "sheath");                    
        meleeWeapon2IsDrawn = FALSE;
        if (myActiveMeleeWeapon2 != "fists") 
        {        
            //llOwnerSay("You have put a " + regWeaponName + " on your " + regWeaponPosition + ".");
        } 
        else
        {
            //llOwnerSay("You have fists and you're not afraid to use them.");            
        }
    }
    else
    {
        llOwnerSay("RP Hud could not find data for type of weapon attached.");
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

default
{
    
    state_entry() 
    {         
        llListenRemove(hudListenHandle);
        hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");
    }   
    
    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay(msg);
        if (msg == "check weapon")
        {            
            //unSetActiveWeapon();
            llRegionSayTo(llGetOwner(), weaponChannel, "check");
        }
    }
    
    listen( integer channel, string name, key id, string message ) {
        if (channel == PLAYERHUDCHANNEL) 
        {
            llListenRemove(hudListenHandle);
            list parsedMessage = llCSV2List(message);
            
            action = llList2String(parsedMessage, 0);
            if (action == "registerWeapon") 
            {
//llOwnerSay("Register Weapon");                
                regWeaponName = llList2String(parsedMessage, 1);
                regWeaponType = llList2String(parsedMessage, 2);
                regWeaponPosition = llList2String(parsedMessage, 3);                
                setActiveWeapon(regWeaponName, regWeaponType, regWeaponPosition);
            }
            if (action == "registerWeapon2") 
            {
                regWeaponName2 = llList2String(parsedMessage, 1);
                regWeaponType2 = llList2String(parsedMessage, 2);
                regWeaponPosition2 = llList2String(parsedMessage, 3);                
                setActiveWeapon2(regWeaponName2, regWeaponType2, regWeaponPosition2);
            }            
            else if (action == "unregisterWeapon")
            {              
                unSetActiveWeapon();
            }    
            else if (action == "unregisterWeapon2")
            {              
                unSetActiveWeapon2();
            }                      
            hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");
        }     
    }
    
    touch_start(integer num_detected)
    {
        string touchAction = llGetLinkName(llDetectedLinkNumber(0));
        if (touchAction == "rp_slot0") 
        {            // the Slot 0 button was pressed
            if (meleeWeaponIsDrawn) 
            {                    
                llRegionSayTo(llGetOwner(), weaponChannel, "sheath");                    
                meleeWeaponIsDrawn = FALSE;
            } 
            else 
            {
                llRegionSayTo(llGetOwner(), weaponChannel, "draw"); 
                meleeWeaponIsDrawn = TRUE;                    
            }
        }   
        if (touchAction == "rp_slot1") 
        {            // the Slot 0 button was pressed
            if (meleeWeapon2IsDrawn) 
            {                    
                llRegionSayTo(llGetOwner(), weaponChannel2, "sheath");                    
                meleeWeapon2IsDrawn = FALSE;
            } 
            else 
            {
                llRegionSayTo(llGetOwner(), weaponChannel2, "draw"); 
                meleeWeapon2IsDrawn = TRUE;                    
            }
        }                    
    }     
}
