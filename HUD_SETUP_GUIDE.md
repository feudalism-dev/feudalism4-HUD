# Feudalism 4 - Combined HUD Setup Guide

This guide explains which scripts go in which prims and what prim names are required.

## Scripts Required

You need **4 scripts** total, all placed in the **ROOT PRIM** of your linkset:

1. **`Feudalism 4 - Combined HUD Controller.lsl`** ⭐ (Main controller)
2. **`Feudalism 4 - Players HUD Main.lsl`** (Core game logic)
3. **`Feudalism 4 - Players HUD Data Manager.lsl`** (Data storage & sync)
4. **`Feudalism 4 - Players HUD UI Manager.lsl`** (Visual display & touch handling)

## Prim Names Required

### Setup HUD (MOAP Interface)
- **`setup_moap`** - Child prim that contains the MOAP web interface
  - **Face 4** must be set up for MOAP (Media texture)
  - This prim will rotate 90° on Z-axis when Setup HUD is shown
  - Should be hidden (alpha 0) when not in use

### Optional Setup Button
- **`btn_setup`** - (Optional) Touch this prim to toggle Setup HUD
  - If you don't create this prim, you can use the Characters menu in Options instead

### Players HUD Display Prims

#### Resource Pools (Glass Spheres)
- **`rp_health`** - Health sphere (red liquid, textures: health0 to health100)
- **`rp_stamina`** - Stamina sphere (blue liquid, textures: stamina0 to stamina100)
- **`rp_mana`** - Mana sphere (green liquid, textures: mana0 to mana100)

#### Stat Display Prims
- **`rp_healthStatPrim`** - Shows current health number
- **`rp_staminaStatPrim`** - Shows current stamina number
- **`rp_manaStatPrim`** - Shows current mana number

#### Experience Bar
- **`rp_xpBar`** - XP progress bar (textures: xp0 to xp100)
- **`rp_xpText`** - Shows XP number (e.g., "1500 XP")

#### Action Slots
- **`rp_slot2`** through **`rp_slot10`** - Action slot buttons (9 slots total)
  - These are touchable prims for quick actions

#### Control Buttons
- **`rp_update`** - Hard reset button
- **`rp_options`** - Options menu button (opens menu with Characters option)
- **`rp_heart`** - Rest/heal menu button

#### Class Display (Optional)
- **`rp_class`** - Shows current class name

## Linkset Structure

```
Root Prim (LINK_ROOT)
├── All 4 scripts go here
├── setup_moap (child prim, face 4 = MOAP)
├── rp_health (child prim, glass sphere)
├── rp_stamina (child prim, glass sphere)
├── rp_mana (child prim, glass sphere)
├── rp_healthStatPrim (child prim, text display)
├── rp_staminaStatPrim (child prim, text display)
├── rp_manaStatPrim (child prim, text display)
├── rp_xpBar (child prim, progress bar)
├── rp_xpText (child prim, text display)
├── rp_slot2 through rp_slot10 (9 child prims, action buttons)
├── rp_update (child prim, button)
├── rp_options (child prim, button)
├── rp_heart (child prim, button)
└── rp_class (child prim, optional text display)
```

## Setup Steps

1. **Create your linkset** with all the named prims listed above
2. **Place all 4 scripts in the ROOT PRIM**
3. **Set up the MOAP prim**:
   - Name it `setup_moap`
   - Set Face 4 to "Media" texture type
   - The script will configure the MOAP URL automatically
4. **Position your prims**:
   - Position all Players HUD prims where you want them
   - Position `setup_moap` prim where you want the Setup HUD to appear
   - The script will handle rotation automatically
5. **Add textures**:
   - Ensure you have textures named: `health0` through `health100`, `stamina0` through `stamina100`, `mana0` through `mana100`, `xp0` through `xp100`
   - These should be in the root prim's inventory or the linkset's inventory

## How It Works

### First Time (No Character)
- HUD attaches → Detects no character data
- Automatically rotates `setup_moap` to 90° (face 4 visible)
- User creates character in MOAP interface
- After character creation, automatically rotates back to 0° (Players HUD)

### Subsequent Wears (Character Exists)
- HUD attaches → Detects character data
- Loads Players HUD immediately (no rotation)
- All resource pools, XP, and stats display correctly

### Opening Setup HUD Manually
- Touch `rp_options` → Select "Characters" → Select "Edit"
- OR touch `btn_setup` (if you created that prim)
- `setup_moap` rotates to 90° (face 4 visible)
- User edits character
- User closes Setup HUD → Rotates back to 0°

## Notes

- **All scripts must be in the ROOT PRIM** - they communicate via `llMessageLinked`
- The `setup_moap` prim is the only one that rotates
- Face 4 of `setup_moap` must be set to "Media" texture type
- Prim names are case-sensitive - use exact names listed above
- The HUD automatically handles rotation, visibility, and data loading

## Troubleshooting

If prims aren't found:
- Check that prim names match exactly (case-sensitive)
- Check that prims are linked to the root
- Look for error messages in chat: `[UI Manager] ERROR: Could not find prim named '...'`

If Setup HUD doesn't rotate:
- Verify `setup_moap` prim exists and is linked
- Check that the script found it: `[HUD] MOAP prim found at link X`
- Ensure face 4 is set to Media texture type

