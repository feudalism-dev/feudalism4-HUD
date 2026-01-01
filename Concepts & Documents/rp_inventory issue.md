I need you to analyze the rp_inventory → HUD inventory flow.

First, describe how the system SHOULD work, step by step, in the Feudalism 4 architecture. Use this exact expected flow:

EXPECTED INVENTORY FLOW:
1. Player triggers rp_inventory.
2. rp_inventory sends a request to the Firestore Bridge to fetch ONLY the inventory field.
3. Firestore Bridge fetches the inventory field from Firestore.
4. Firestore Bridge sends an atomic "inventory" message to LINK_SET.
5. Data Manager receives "inventory".
6. Data Manager parses the atomic inventory JSON/map.
7. Data Manager writes LSD keys:
   - <characterId>_inventory_list
   - <characterId>_inventory_<itemName>
8. Data Manager sends "inventory loaded".
9. HUD Inventory Controller receives "inventory loaded".
10. HUD Inventory Controller reads LSD keys and displays items.

After describing the expected flow, analyze the CURRENT implementation in the scripts and describe how it works right now. Be specific about:

- What rp_inventory actually sends
- What Firestore Bridge actually sends
- Whether Data Manager has an atomic "inventory" handler
- Whether Data Manager writes the correct LSD keys
- Whether Data Manager sends "inventory loaded"
- Whether HUD Inventory Controller listens for "inventory loaded"
- Whether HUD Inventory Controller reads the correct LSD keys (<characterId>_inventory_list)

Finally, compare the EXPECTED flow to the CURRENT flow and list all mismatches or missing steps. Do NOT fix anything yet. Only analyze and compare.