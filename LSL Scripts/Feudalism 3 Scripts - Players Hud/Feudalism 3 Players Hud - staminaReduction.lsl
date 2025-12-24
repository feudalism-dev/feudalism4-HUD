integer PLAYERHUDCHANNEL = -77770;

default
{
    state_entry()
    {
//llOwnerSay("Stamina Reduction");        
        llSetTimerEvent(600.0);
    }
    
    attach( key id)
    {
        if (id)
        {
            llSetTimerEvent(5.0);   
        }
    }

    timer()
    {
        llSetTimerEvent(0.0);   
//llOwnerSay("Timer hit.");             
        llMessageLinked(LINK_ROOT, -1, "changeStamina", ""); 
        llSetTimerEvent(600.0);
    }

}
