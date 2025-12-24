
integer PLAYERHUDCHANNEL = -77770;
integer hudListenHandle;

integer armorChannel = -77775;
string action;

list bodyParts = ["head","neck","upper torso", "lower torso", "right arm", "left arm", "upper leg", "lower leg", "foot"];
list armorTypes = ["none", "cloth", "fur", "leather", "chainmail", "ring male", "scale mail", "brigandine", "plate", "shield"];
list armorValues = [0,1,2,3,4,5,6,7,8];
list armorWeightByType = [0,0,1,1,2,2,2,3,4,0];
list armorWeightByPart = [1.0, 0.5, 2.8, 1.0, 1.0, 1.0, 1.25, 1.25, 1.1];
list armorWeights = [];
list armorHealth = [];
list shieldTypes = ["buckler", "round", "kite", "heater", "pavise"];
list shieldWeightByType = [1,4,3,2,5];
list shieldMaterials = ["leather", "wood", "rimmed", "bronze", "steel"];
list shieldWeightByMaterial = [1,2,3,4,5];

integer numberOfParts = 9;

list myArmor = ["none","none","none","none","none","none","none","none","none"];
list myArmorValues;
list myArmorWeights;
list myArmorHealth;
list myArmorCurrentHealth;
list armorAffected;

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

unSetActiveArmor() 
{
//llOwnerSay("Armor Manager: Unset Active Armor");
    myArmor = ["none","none","none","none","none","none","none","none","none"];
    llMessageLinked(LINK_ROOT, 0, "setArmor", llList2CSV(myArmor));    
}

setActiveArmor() 
{
    string part;
    string type;
    integer link;
    integer currentTypeIndex;
    integer newTypeIndex;
    integer i = 0;
    
//llOwnerSay("Armor Manager: Set Active Armor");    
    while (i < numberOfParts)
    {
        type = llList2String(armorAffected, i);
//llOwnerSay("Armor Message: type= " + type);        
        if (isValidArmorType(type) != -1)
        {
//llOwnerSay("Valid type");            
            // armor type is valid
            currentTypeIndex = llListFindList(armorTypes, [llList2String(myArmor, i)]);
//llOwnerSay("Current Type: " + llList2String(myArmor, i));
//llOwnerSay("Current type index: " + (string)currentTypeIndex);       
            newTypeIndex = llListFindList(armorTypes, [type]);
//llOwnerSay("New Type Index: " + (string)newTypeIndex);            
            if (newTypeIndex > currentTypeIndex)
            {
//llOwnerSay("New type of armor is better than existing.");            
                myArmor = llListReplaceList(myArmor, [type], i, i); 
            }
        }
        i++;
    }
    llMessageLinked(LINK_ROOT, 0, "setArmor", llList2CSV(myArmor));    
}

integer isValidArmorType(string typeToCheck)
{
    return llListFindList(armorTypes, [typeToCheck]);   
}


default
{
    
    state_entry() 
    {         
        llListenRemove(hudListenHandle);
        hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");
        myArmor = ["none","none","none","none","none","none","none","none","none"];
    }   
    
    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay(msg);
        if (msg == "checkArmor")
        {            
            unSetActiveArmor();
            llRegionSayTo(llGetOwner(), armorChannel, "checkArmor");
        }
    }
    
    listen( integer channel, string name, key id, string message ) {
        if (channel == PLAYERHUDCHANNEL) 
        {
            llListenRemove(hudListenHandle);
            list parsedMessage = llCSV2List(message);
//llOwnerSay("Armor Manager: message received - " + message);            
            action = llList2String(parsedMessage, 0);
            integer i = 0;
            armorAffected = [];
            while (i < (numberOfParts + 1))
            {
                armorAffected += llList2String(parsedMessage, i+1);
                i++;
            }
//llOwnerSay("Armor Affected: " + (string)armorAffected);            
            if (action == "registerArmor") 
            {        
                setActiveArmor();
            }           
            else if (action == "unregisterArmor")
            {                      
                unSetActiveArmor();          
            }                        
            hudListenHandle = llListen(PLAYERHUDCHANNEL, "", "", "");
        }     
    }
    
    touch_start(integer num_detected)
    {
        string touchAction = llGetLinkName(llDetectedLinkNumber(0));
        if (touchAction == "rp_armor") 
        {
            string text = "Armor worn: \n";
            text += "==========================\n";
            integer i = 0;
            while (i < numberOfParts)
            {
                text += llList2String(bodyParts, i) + ": ";
                text += llList2String(myArmor, i) + "\n";
                i++;
            }
            // the armor button was touched... rezz the armor display
            llRegionSayTo(llGetOwner(), 0, text);
        }                    
    }     
}
