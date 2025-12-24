# Feudalism 4 HUD Merge Instructions

## Overview
This document explains how to merge the Setup HUD and Players HUD into a single linkset that rotates between views.

## Architecture

### Single Linkset with Two Views:
1. **Players HUD View** (Default): Traditional LSL HUD with health/stamina/mana spheres
2. **Setup HUD View** (On Demand): MOAP interface for character creation/editing

### How It Works:
- The linkset contains all Players HUD prims (rp_health, rp_stamina, rp_mana, etc.)
- A separate child prim named `setup_moap` contains the MOAP interface
- When Setup HUD is invoked, the `setup_moap` prim rotates 90 degrees to face the user
- When Setup HUD is closed, the `setup_moap` prim rotates back 90 degrees and is hidden
- All communication happens via `link_message` within the linkset (no region say needed)

## Linkset Setup Instructions

### Step 1: Prepare Your Linkset

1. **Root Prim**: "Feudalism Hud v1.0 - no scripts"
   - Keep this as-is (contains background textures)
   - DO NOT add any scripts to this prim
   - DO NOT make this prim transparent

2. **Players HUD Prims** (already exist):
   - `rp_health` - Health globe
   - `rp_stamina` - Stamina globe
   - `rp_mana` - Mana globe
   - `rp_healthStatPrim` - Health text
   - `rp_staminaStatPrim` - Stamina text
   - `rp_manaStatPrim` - Mana text
   - `rp_xpBar` - XP progress bar
   - `rp_xpText` - XP text
   - `rp_class` - Class display
   - Other Players HUD elements (action slots, buttons, etc.)

3. **Add MOAP Prim** (NEW):
   - Create a new child prim
   - Name it: `setup_moap`
   - Size it appropriately for MOAP (e.g., 0.5 x 0.4 x 0.01)
   - Position it initially rotated 90 degrees away from view (or hidden)
   - Enable MOAP on face 4
   - Set initial alpha to 0.0 (hidden)

4. **Add Setup Button** (Optional):
   - Create a small button prim
   - Name it: `btn_setup`
   - Position it where you want the setup button
   - This will toggle the Setup HUD when touched

### Step 2: Script Setup

1. **Remove Old Scripts**:
   - Remove `Feudalism 4 - Players HUD Main.lsl` (replaced by Combined HUD Controller)
   - Remove `Feudalism 4 - Players HUD Firestore Bridge.lsl` (no longer needed)
   - Remove `Feudalism 4 - Setup HUD.lsl` (functionality merged)

2. **Add New Scripts**:
   - Add `Feudalism 4 - Combined HUD Controller.lsl` to the root prim (or any prim)
   - Keep `Feudalism 4 - Players HUD Data Manager.lsl` (updated to use link_message)
   - Keep `Feudalism 4 - Players HUD UI Manager.lsl` (no changes needed)

### Step 3: Configure the Combined HUD Controller

Edit the configuration at the top of `Feudalism 4 - Combined HUD Controller.lsl`:

```lsl
// MOAP Prim Name (child prim that contains the MOAP interface)
string MOAP_PRIM_NAME = "setup_moap";  // Change if your prim has a different name

// Button to toggle Setup HUD (touch this prim to open/close Setup HUD)
string SETUP_BUTTON_NAME = "btn_setup";  // Change if your button has a different name, or set to "" to disable
```

## How Rotation Works

### Initial State (Players HUD View):
- `setup_moap` prim is hidden (alpha = 0.0)
- `setup_moap` prim is rotated 90 degrees away from view
- Players HUD elements are visible and functional

### When Setup HUD is Activated:
1. `setup_moap` prim rotates 90 degrees to face the user
2. `setup_moap` prim becomes visible (alpha = 1.0)
3. MOAP interface loads automatically
4. Players HUD elements remain visible behind it (or can be hidden if desired)

### When Setup HUD is Closed:
1. `setup_moap` prim rotates back 90 degrees
2. `setup_moap` prim becomes hidden (alpha = 0.0)
3. MOAP interface is cleared
4. Players HUD view is restored

## Communication Flow

### Loading Character Data:
1. Data Manager → Combined HUD Controller: `link_message("request character data")`
2. Combined HUD Controller → MOAP: Activates Setup HUD (if not active)
3. MOAP → Firestore: Loads character data
4. MOAP → Combined HUD Controller: `CHARACTER_DATA|...` via channel
5. Combined HUD Controller → Data Manager: `link_message("CHARACTER_DATA", data)`
6. Data Manager → Players HUD: Saves to LSD and notifies

### Saving Character Data:
1. Data Manager → Combined HUD Controller: `link_message("sync to firestore", data)`
2. Combined HUD Controller → MOAP: Activates Setup HUD (if not active) and sends sync request
3. MOAP → Firestore: Saves character data
4. MOAP → Combined HUD Controller: Confirmation (optional)

## Benefits of This Approach

1. **No Separate HUD Needed**: Everything is in one linkset
2. **No Firestore Bridge**: Setup HUD already has MOAP/Firestore access
3. **Simpler Communication**: All via `link_message` (no region say)
4. **Better Performance**: No network overhead for internal communication
5. **Cleaner Architecture**: Single source of truth for character data

## Testing Checklist

- [ ] MOAP prim rotates correctly when Setup HUD is activated
- [ ] MOAP prim hides correctly when Setup HUD is closed
- [ ] Players HUD elements remain functional when Setup HUD is active
- [ ] Character data loads from Firestore correctly
- [ ] Character data saves to Firestore correctly
- [ ] Background prim is never made transparent
- [ ] Globe prims (rp_health, rp_stamina, rp_mana) display correctly
- [ ] Setup button toggles Setup HUD (if using button)

## Troubleshooting

### MOAP Prim Not Rotating:
- Check that the prim is named exactly `setup_moap`
- Verify the prim is a child prim (not root)
- Check script logs for "MOAP prim not found" errors

### MOAP Not Loading:
- Verify MOAP is enabled on face 4 of the `setup_moap` prim
- Check that the MOAP URL is correct in the script
- Ensure the prim is visible (alpha = 1.0) when Setup HUD is active

### Background Prim Being Made Transparent:
- The Combined HUD Controller should never affect the root prim
- Only the `setup_moap` prim should be rotated/hidden
- Check that no other scripts are setting alpha on the root prim

