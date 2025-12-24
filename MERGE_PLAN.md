# Feudalism 4 HUD Merge Plan

## Overview
Merge Setup HUD and Players HUD into a single linkset that rotates 90 degrees to switch between:
- **Players HUD View**: Traditional LSL HUD with health/stamina/mana spheres
- **Setup HUD View**: MOAP interface for character creation/editing

## Linkset Structure

### Required Prims:
1. **Root Prim** (or main prim): "Feudalism Hud v1.0 - no scripts"
   - Contains background textures for globes
   - Should NOT be rotated or made transparent
   
2. **Players HUD Elements** (child prims):
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

3. **Setup HUD MOAP Prim** (child prim):
   - Named: `setup_moap` or similar
   - Has MOAP enabled on face 4
   - Initially hidden or rotated away
   - Only visible when in Setup mode

## Rotation Strategy

### Option 1: Rotate Entire Linkset (Simpler)
- Rotate the entire linkset 90 degrees around Z-axis when switching to Setup mode
- Rotate back 90 degrees when returning to Players HUD mode
- **Pros**: Simple, all prims rotate together
- **Cons**: Background prim also rotates (may need adjustment)

### Option 2: Rotate Only MOAP Prim (Better)
- Keep Players HUD elements fixed
- Rotate only the MOAP prim 90 degrees to face user when Setup mode activated
- Hide MOAP prim when in Players HUD mode
- **Pros**: Background and Players HUD elements stay in place
- **Cons**: Need to manage MOAP prim visibility/rotation separately

**Recommendation**: Option 2 - Rotate only MOAP prim

## Script Changes Required

### 1. Create Combined HUD Controller Script
- Merge Setup HUD functionality into Players HUD Main
- Add rotation functions
- Add mode switching (Players HUD mode vs Setup HUD mode)
- Handle MOAP prim visibility and rotation

### 2. Update Players HUD Data Manager
- Remove Firestore Bridge dependency
- Communicate directly with integrated Setup HUD script
- Use link_message instead of region say

### 3. Update UI Manager
- No changes needed (already handles Players HUD display)

### 4. Remove Firestore Bridge Script
- No longer needed since Setup HUD is integrated

## Implementation Steps

### Step 1: Linkset Setup
1. Create/keep root prim with background
2. Add all Players HUD child prims (rp_health, rp_stamina, etc.)
3. Add MOAP prim as child prim named `setup_moap`
4. Enable MOAP on face 4 of `setup_moap` prim
5. Initially hide or rotate `setup_moap` prim away

### Step 2: Script Integration
1. Add Setup HUD functions to Players HUD Main script
2. Add rotation/visibility functions
3. Add touch handler to toggle between modes
4. Update Data Manager to use link_message

### Step 3: MOAP Configuration
1. MOAP prim should be hidden when in Players HUD mode
2. MOAP prim should be visible and rotated to face user in Setup mode
3. MOAP should auto-load when made visible

## Touch/Command to Toggle

### Option A: Touch specific prim
- Touch a prim named `btn_setup` or `rp_setup` to open Setup HUD
- Touch again or close button in MOAP to return

### Option B: Touch anywhere on HUD
- Touch any prim to toggle (may interfere with other touch handlers)

### Option C: Chat command
- Type "/hud setup" to open Setup HUD
- Type "/hud close" or close in MOAP to return

**Recommendation**: Option A - Dedicated button prim

