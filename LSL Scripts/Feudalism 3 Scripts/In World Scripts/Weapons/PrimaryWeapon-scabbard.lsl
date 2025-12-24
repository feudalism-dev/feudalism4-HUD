
integer PLAYERHUDCHANNEL = -77770;
integer weaponChannel = -77771;
integer sheathChannel = -77772;
integer detachMessageReceived = FALSE;

integer isDrawn = FALSE;

integer sheathListener;

draw() {
    if (isDrawn == FALSE) {
        llSetLinkAlpha(LINK_ALL_OTHERS, 0.0, ALL_SIDES);            
        isDrawn = TRUE;
    }
}

sheath() {
    if (isDrawn == TRUE) {
        llSetLinkAlpha(LINK_ALL_OTHERS, 1.0, ALL_SIDES);            
        isDrawn = FALSE;
    }        
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

integer listener;
integer msg_channel;
integer position;
integer isAttached = FALSE;

default
{
    on_rez(integer start_parameter)
    {   // Start listening for a message from rezzer
        llSetTimerEvent(60.0);
        string description = llGetObjectDesc();
        llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);         
        if (description != "")
        {
            if (description == "back")
                position = ATTACH_BACK;
            else if (description == "left hip")
                position = ATTACH_LHIP;
            else if (description == "right hip")
                position = ATTACH_RHIP;
        }
            
        msg_channel = start_parameter;
        listener = llListen(start_parameter, "", NULL_KEY, "");
    }
 
    listen(integer channel, string name, key id, string text)
    {   // Listen for the message from the rezzer with the target agent key
        if (channel == msg_channel)
        {   // Ask for the experience permission
            list msg = llParseString2List(text, ["|"], []);
            isAttached = FALSE;
            llRequestExperiencePermissions((key)llList2String(msg, 1), "");
            llListenRemove(listener);
            llSetTimerEvent(10.0);
        }
    }
 
    experience_permissions(key target_id)
    {   // Permissions granted, so attach to the AV
        llAttachToAvatarTemp(position);
        llSetLinkAlpha(LINK_SET, 1.0, ALL_SIDES); 
        if (llGetAttached() == 0)
        {   // Attaching failed
            llDie();
        }
    }
 
    experience_permissions_denied( key agent_id, integer reason )
    {   // Permissions denied, so go away
        llDie();
    }
 
    attach( key id )
    {   // Attached or detached from the avatar
        if (id)
        {
//llOwnerSay("State default, attach, id = TRUE");  
            isAttached = TRUE;          
            llSetTimerEvent(0.0);
            // From this point, the object can start doing whatever it needs to do.
            state running;
        }
        else
        {
//llOwnerSay("State default, attach, id = FALSE");            
            //llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterWeapon");            
            llDie();
        }
    }
 
    timer()
    {   // Use a timer to catch no permissions response
        if (isAttached == FALSE)
            llDie();
    }
}
 
// This state starts when permissions are granted and the object is properly attached
state running
{
    state_entry()
    {
        llListenRemove(sheathListener);
        sheathListener = llListen(sheathChannel, "", "", "");
        detachMessageReceived = FALSE;
    }
    
    on_rez(integer start_parameter)
    {   

    }
 
    attach( key id )
    {   // Attached or detached from the avatar    
        if (id)
        {
//llOwnerSay("Scabbard, state running, attach, ID = TRUE");            
            // this happens when the weapon attaches... should call registerWeapon
                llListenRemove(sheathListener);
                sheathListener = llListen(sheathChannel, "", "", "");
                sheath(); 
        }
        else
        {
//llOwnerSay("Scabbard, state running, attach, ID = FALSE");            
            // llOwnerSay("No longer attached");
            // this happens when the weapon detaches... should unregister the weapon
            if (detachMessageReceived == FALSE)
            {         
//llOwnerSay("Scabbard, state running, attach, ID = FALSE, detachMessageReceived = FALSE");                   
                // if there is no detach message, then this happens because someone TOOK OFF the scabbard,
                // in that case, we need to tell the blade to detach
                //llRegionSayTo(llGetOwner(), PLAYERHUDCHANNEL, "unregisterWeapon");  
                llRegionSayTo(llGetOwner(), weaponChannel, "detach"); 
                llDie();                
            }
            else
            {
//llOwnerSay("Scabbard, state running, attach, ID = FALSE, detachMessageReceived = TRUE");                                                         // this happens when someone took off the scabbard and we just are detaching as a result 
                llDie();
                         
            }
        }
    }   
    
    listen( integer channel, string name, key id, string message ) 
    {
//llOwnerSay("Sheath. Message received: " + message); 
        detachMessageReceived = FALSE;       
        if (channel == sheathChannel) {        
            llListenRemove(sheathListener);       
            if (message == "draw") draw();
            if (message == "sheath") sheath();
            if (message == "detach")
            {
                detachMessageReceived = TRUE;
                llDetachFromAvatar();
            }
        }
        sheathListener = llListen(sheathChannel, "", "", "");     
    }     

    touch_start(integer total_number)
    {
        //llSay(0, "Touched.");
    }
}
