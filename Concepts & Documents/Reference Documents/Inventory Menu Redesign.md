You must update the existing HUD inventory manager script to use the redesigned VIEW/MENU system. 
Do NOT create new files. Modify only the script that handles the rp_inventory button.

===========================================================
1. OVERVIEW
===========================================================

Replace the old SL dialog menu:
- "View Items"
- "Drop Item"
- "Close"

with a two-layer system:

LAYER 1 — VIEW (text listing)
LAYER 2 — MENU (item actions)

===========================================================
2. VIEW LAYER (TEXT LISTING)
===========================================================

When the user clicks the rp_inventory button:

1. Request the current inventory page from the Bridge (already implemented).
2. When the page arrives, print a formatted list to chat:

Example:
[Inventory Page 1/3]
1. Banana (6)
2. Iron Ore (12)
3. Leather (4)
4. Rope (1)

3. After printing the list, show a dialog with ONLY these buttons:

- "Next Page"
- "Prev Page"
- "Search"
- "Select Item"
- "Close"

Rules:
- Do NOT show item names in dialog buttons.
- Do NOT show quantities in dialog buttons.
- Do NOT show more than these 5 buttons.

===========================================================
3. PAGINATION
===========================================================

"Next Page" → request next page from Bridge  
"Prev Page" → request previous page from Bridge  

When the new page arrives:
- print the list again
- show the same 5-button VIEW menu

===========================================================
4. SEARCH
===========================================================

When the user clicks "Search":
- open a text input listener
- user types a search term
- send search request to Bridge
- when results arrive, display them using the same VIEW format
- show the same 5-button VIEW menu

===========================================================
5. SELECT ITEM
===========================================================

When the user clicks "Select Item":
- open a text input listener
- user enters a number (1, 2, 3, etc.)
- lookup the item in the current page array
- open the ITEM MENU for that item

===========================================================
6. ITEM MENU (ACTION LAYER)
===========================================================

When an item is selected, show a dialog:

[Item Name]
Qty: <number>

Buttons:
- "Consume"
- "Drop"
- "Back"

Rules:
- "Back" returns to the VIEW menu (same page).
- "Consume" triggers the existing consume logic.
- "Drop" triggers the existing drop logic.

===========================================================
7. LSL RULES (MANDATORY)
===========================================================

- No ternary operators
- No break or continue
- No void return types
- No nested functions
- No functions inside default state
- No new states (use variables to track modes)
- Functions must appear above default
- Minimal listeners, always removed after use

===========================================================
8. DO NOT CHANGE ANYTHING ELSE
===========================================================

- Do NOT modify the Bridge
- Do NOT modify Firestore logic
- Do NOT modify MOVE protocol
- Do NOT rename variables
- Do NOT refactor unrelated code
- Do NOT create new scripts

===========================================================
END OF INSTRUCTIONS
===========================================================