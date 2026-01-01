Feudalism 4 – Universe Career Management UI (MOAP Setup HUD)
Design Specification for Cursor
This UI pattern applies to careers, classes, species, and genders — but we’ll describe it using careers as the example.

1. Where This UI Lives
Inside the MOAP Setup HUD, under the Admin → Universe Management section.
When a Universe Admin selects a universe to edit, they see tabs:
- Profile
- Identity
- Careers
- Classes
- Species
- Genders
- Items (future)
- Rules
- Access
- Admins
The Careers tab is what we’re defining here.

2. Career Management UI Layout
2.1 Universe Selector (Top of Page)
A dropdown:
[ Select Universe ▼ ]


- Shows only universes the UA owns.
- When a universe is selected, the page loads its current allowed careers.

2.2 Two‑Panel Layout
Panel A — Included Careers (Top Panel)
Shows all careers currently allowed in the selected universe.
Included Careers:
[✓] Warrior
[✓] Mage
[✓] Farmer
[✓] Bard


- Each entry has a checkbox.
- Unchecking removes it from the universe’s allowed list.
- If the UA unchecks everything, the universe has zero allowed careers (valid but unusual).
Panel B — Excluded Careers (Bottom Panel)
Shows all careers that exist globally but are not included in this universe.
Excluded Careers:
[ ] Assassin
[ ] Merchant
[ ] Priest
[ ] Alchemist


- Checking a box adds it to the universe’s allowed list.

3. Admin Button (Top‑Right of Career Page)
A button:
[ ADMIN ]


This opens a small admin panel with:
- “Add New Career”
- “Edit Selected Career”
- “Delete Career” (System Admin only)
- “Refresh Career List”
This panel is for global career management, not universe‑specific.
Universe Admins can use careers but cannot create or delete them unless they are also System Admins.

4. Save Workflow
At the bottom of the page:
[ Save Changes ]


When clicked:
- HUD gathers all checked careers.
- HUD writes to Firestore:
universes/{universeId}/allowedCareers = [list of careerIds]


- HUD reloads the page to reflect the updated lists.

5. Behavior Rules
5.1 No Forced Changes for Existing Characters
- Changing allowed careers affects new characters only.
- Existing characters keep their career even if it becomes excluded.
5.2 No Automatic Recalculation
- No stats or abilities are recalculated when careers are added/removed.
5.3 UA Permissions
- UA can only edit universes they own.
- UA cannot modify the Default Universe.
- System Admin can edit any universe.

6. Cursor Implementation Notes
Cursor must implement:
6.1 Firestore Reads
- Fetch global career list from careers collection.
- Fetch universe’s allowed careers from universes/{id}/allowedCareers.
6.2 UI Rendering
- Split global careers into two lists:
- Included (checked)
- Excluded (unchecked)
6.3 Checkbox Logic
- Checking adds careerId to allowed list.
- Unchecking removes careerId.
6.4 Save Logic
- Write updated array to Firestore.
- Redraw UI.
6.5 Role Enforcement
- Only UA for that universe or System Admin may edit.
- Admin role (non‑UA) cannot edit.

7. Optional Enhancements (Future)
7.1 Search Bar
Useful when there are many careers.
7.2 Sorting
Alphabetical or by category.
7.3 Career Details Panel
Clicking a career shows:
- Description
- Icon
- Tags
- Stat modifiers (if any)
7.4 Bulk Actions
- “Select All”
- “Deselect All”

8. Summary (What Cursor Must Build)
Cursor must implement:
- A Universe Selector
- Two‑panel checkbox UI:
- Included careers (checked)
- Excluded careers (unchecked)
- Save button that updates Firestore
- Admin button for global career management
- Role enforcement
- Automatic UI redraw after save
This pattern must be reused for:
- Careers
- Classes
- Species
- Genders
