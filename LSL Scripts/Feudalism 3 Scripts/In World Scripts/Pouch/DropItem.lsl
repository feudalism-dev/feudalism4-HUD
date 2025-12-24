string itemKey;

dropItem()
{
    llLinksetDataDelete(itemKey);                     
    llRegionSayTo(llGetOwner(), 0, "You now have 0 quantity of item: " + itemKey);     
}                


default
{
    state_entry()
    {
        //
    }
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER) 
        {
            //
        }        
    }    

    
    link_message(integer sender_num, integer num, string msg, key id)
    {
//llOwnerSay("Pouch Drop Item script. Link Message hit.");
        if (msg == "drop")
        {
            itemKey = (string)id;
            dropItem();          
        }
    }
}
