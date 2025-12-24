# Feudalism 4 - Proof of Concept Setup Instructions

## Overview
This POC tests the dynamic helper prim concept: a main HUD that rezzes, configures, and attaches helper prims to different locations.

## Setup Steps

### Step 1: Create Helper Prim Object

1. **Create a new prim** in Second Life
2. **Shape**: Box (default)
3. **Size**: 0.5m x 0.05m x 0.01m (will be resized by script)
4. **Name**: "Helper Prim" (exact name, case-sensitive)
5. **Texture**: Transparent or subtle background
6. **Add Script**: 
   - Copy `Feudalism 4 - POC Helper Prim.lsl` into the prim
7. **Permissions**: Set to "Copy" (so it can be placed in inventory)
8. **Take into inventory**

### Step 2: Create Main Controller HUD

1. **Create a new prim** in Second Life
2. **Shape**: Box (default)
3. **Size**: 0.1m x 0.1m x 0.01m (small, can be made invisible)
4. **Name**: "Feudalism 4 - POC Main Controller"
5. **Add Script**: 
   - Copy `Feudalism 4 - POC Main Controller.lsl` into the prim
6. **Add Helper Prim to Inventory**:
   - Right-click Main Controller prim
   - Edit → Content tab
   - Drag "Helper Prim" from your inventory into the Content folder
   - Make sure it's named exactly "Helper Prim"
7. **Permissions**: Set to "Copy" (optional, for sharing)

### Step 3: Test the POC

1. **Attach Main Controller**:
   - Right-click Main Controller prim
   - Attach to HUD → Choose any attach point (e.g., HUD_BOTTOM_RIGHT)
   
2. **Watch the console**:
   - Main Controller will say "[POC] Rezzing helper prims..."
   - You should see 3 helper prims rez above the main controller
   - Each helper will configure itself and attach to different points:
     - Helper 1 → HUD_TOP (Resource Meters)
     - Helper 2 → HUD_BOTTOM (Action Bar)
     - Helper 3 → HUD_LEFT (Status Bar)

3. **Check the helpers**:
   - Each helper should attach to its designated point
   - Each helper should display MOAP content
   - You should see:
     - Top: Resource meters (Health, Stamina, Mana spheres)
     - Bottom: Action bar (slots + buttons)
     - Left: Status bar (XP progress)

4. **Test interaction**:
   - Touch Main Controller to remove all helpers
   - Touch again to rez new ones

## Expected Behavior

### Main Controller
- Rezzes 3 helper prims when attached
- Configures each helper with:
  - Attach point (TOP, BOTTOM, LEFT)
  - Size (appropriate for component)
  - MOAP URL (with component parameter)
- Tracks active helpers
- Removes helpers on detach

### Helper Prims
- Start invisible
- Receive configuration commands
- Attach to specified point
- Resize to specified dimensions
- Load MOAP content
- Become visible when configured
- Auto-die on detach or DEREZ command

## Troubleshooting

### Helpers Don't Rez
- Check Main Controller has "Helper Prim" in inventory
- Check name matches exactly: "Helper Prim"
- Check permissions (should be Copy)
- Check script is running (look for error messages)

### Helpers Don't Attach
- Check attach point constants are correct
- Check helper script is listening on CONTROL_CHANNEL
- Check helper received ATTACH command (look for chat messages)

### MOAP Doesn't Load
- Check MOAP_BASE_URL is correct
- Check helper received MOAP command
- Check browser permissions in SL viewer
- Check prim has MOAP enabled on face 4

### Helpers in Wrong Position
- Check attach point values in Main Controller script
- Verify helpers are receiving correct ATTACH commands
- Check helper prims are actually attaching (not just rezzing)

## Next Steps After POC

If POC works:
1. Build full `gameplay-hud.html` with proper component rendering
2. Add Firestore real-time listeners
3. Implement action slot functionality
4. Add Challenge Test system
5. Add user preferences storage
6. Polish UI and animations

If POC has issues:
1. Debug communication between Main Controller and Helpers
2. Verify MOAP URL passing works
3. Test attach point detection
4. Check prim sizing logic

## Notes

- This is a **proof of concept** - minimal functionality
- Real-time updates will be added in full version
- User preferences will be added in full version
- Error handling is minimal for POC
- Some features are placeholders (e.g., "Open Setup HUD")

