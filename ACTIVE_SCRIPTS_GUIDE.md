# Feudalism 4 - Active Scripts Guide

## ✅ ACTIVE SCRIPTS (Use These)

### All 4 scripts go in the **ROOT PRIM** of your linkset:

1. **`Feudalism 4 - Combined HUD Controller.lsl`** ⭐
   - Main controller
   - Handles rotation between Players HUD and Setup HUD
   - Manages MOAP communication
   - Routes messages between components

2. **`Feudalism 4 - Players HUD Main.lsl`**
   - Core game logic
   - Calculates health, stamina, mana from stats
   - Handles game modes, resting, resource updates

3. **`Feudalism 4 - Players HUD Data Manager.lsl`**
   - Manages local data storage (LinksetData/LSD)
   - Syncs with Firestore via Combined HUD Controller
   - Handles save/load operations

4. **`Feudalism 4 - Players HUD UI Manager.lsl`**
   - Visual display updates
   - Handles touch events (buttons, menus)
   - Updates textures for health/stamina/mana spheres and XP bar

## 📦 PRIMS NEEDED

### Required Prim:
- **`setup_moap`** - Child prim (NO SCRIPT NEEDED)
  - This is just a prim that will rotate
  - Face 4 must be set to "Media" texture type
  - The Combined HUD Controller will configure the MOAP URL automatically
  - This prim rotates to show/hide the Setup HUD

### All Other Prims:
- See `HUD_SETUP_GUIDE.md` for the complete list of prim names needed

## ❌ DEPRECATED SCRIPTS (Do NOT Use)

These have been moved to the `Deprecated` folder:

- `Feudalism 4 - Players HUD Firestore Bridge.lsl` - Replaced by Combined HUD Controller
- `Feudalism 4 - Setup HUD.lsl` - Functionality merged into Combined HUD Controller
- `Feudalism 4 - Gameplay HUD Main.lsl` - Old approach, not used
- `Feudalism 4 - Gameplay HUD Component.lsl` - Old approach, not used
- `Feudalism 4 - Helper Prim.lsl` - Old approach
- `Feudalism 4 - Main Controller.lsl` - Old approach
- `Feudalism 4 - POC Helper Prim.lsl` - Proof of concept, not used
- `Feudalism 4 - POC Main Controller.lsl` - Proof of concept, not used

## 🔧 SETUP CHECKLIST

- [ ] Create a linkset with all required prims (see HUD_SETUP_GUIDE.md)
- [ ] Name one child prim `setup_moap`
- [ ] Set Face 4 of `setup_moap` to "Media" texture type
- [ ] Place all 4 active scripts in the ROOT PRIM
- [ ] Link all prims together
- [ ] Wear the HUD and test

## 📝 NOTES

- **NO script goes in the `setup_moap` prim** - it's just a prim that rotates
- The Combined HUD Controller handles all MOAP communication (no Firestore Bridge needed)
- All scripts communicate via `llMessageLinked` within the linkset
- The `setup_moap` prim is automatically configured by the Combined HUD Controller

