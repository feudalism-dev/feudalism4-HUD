# Feudalism 4 - HUD Construction Guide

## Recommended Approach: Single Adaptive MOAP Prim

After analyzing Second Life constraints, the **Single Adaptive MOAP Prim** approach is recommended for MVP because:
- Simpler to manage (one script, one object)
- Easier for users (one attachment)
- Less attachment slot usage
- Can adapt layout based on attach point
- CSS/JavaScript can handle responsive design

## HUD Construction Steps

### Step 1: Create the Prim

1. **Create a new prim** in Second Life
2. **Shape**: Box (default)
3. **Size**: 
   - **Horizontal Mode**: 0.5m (width) x 0.1m (height) x 0.01m (depth)
   - **Vertical Mode**: 0.1m (width) x 0.5m (height) x 0.01m (depth)
   - Start with horizontal, script will adjust if needed
4. **Texture**: 
   - Transparent texture (or very subtle background)
   - Alpha: 0 (fully transparent) or very low (5-10%)
5. **Name**: "Feudalism 4 - Gameplay HUD"

### Step 2: Add the Script

1. **Add script**: `Feudalism 4 - Gameplay HUD.lsl`
2. **Script will**:
   - Detect attach point
   - Set MOAP dimensions accordingly
   - Load `gameplay-hud.html`
   - Handle communication

### Step 3: Configure MOAP Face

1. **Select the prim**
2. **Edit → Texture tab**
3. **Select face 4** (standard HUD face, or face 0 if different)
4. **Click "Media" button** (or use script to set automatically)
5. **Script handles MOAP setup automatically**

### Step 4: Attach as HUD

1. **Right-click prim → Attach to HUD**
2. **Choose attach point**:
   - **HUD_TOP** - For horizontal layout (meters + action bar stacked)
   - **HUD_BOTTOM** - For horizontal layout at bottom
   - **HUD_LEFT** - For vertical layout (meters + action bar side-by-side)
   - **HUD_RIGHT** - For vertical layout on right
3. **Script detects attach point and adjusts layout**

## Prim Sizing Logic

### Horizontal Layout (HUD_TOP or HUD_BOTTOM)
- **Prim Size**: 0.5m x 0.1m x 0.01m
- **MOAP Dimensions**: 1024 x 256 pixels
- **Layout**: 
  - Top row: Resource meters (Health, Stamina, Mana)
  - Bottom row: Action bar (slots + buttons)

### Vertical Layout (HUD_LEFT or HUD_RIGHT)
- **Prim Size**: 0.1m x 0.5m x 0.01m
- **MOAP Dimensions**: 256 x 1024 pixels
- **Layout**:
  - Left column: Resource meters (stacked)
  - Right column: Action bar (stacked)

### Compact Mode (Optional)
- **Prim Size**: 0.3m x 0.05m x 0.01m
- **MOAP Dimensions**: 512 x 128 pixels
- **Layout**: Meters only, action bar on hover/click

## Script Detection Logic

```lsl
// In script state_entry()
integer attachPoint = llGetAttached();

if (attachPoint == ATTACH_HUD_TOP || attachPoint == ATTACH_HUD_BOTTOM) {
    // Horizontal layout
    MOAP_WIDTH = 1024;
    MOAP_HEIGHT = 256;
    // Optionally resize prim
    llSetScale(<0.5, 0.1, 0.01>);
} else if (attachPoint == ATTACH_HUD_LEFT || attachPoint == ATTACH_HUD_RIGHT) {
    // Vertical layout
    MOAP_WIDTH = 256;
    MOAP_HEIGHT = 1024;
    // Optionally resize prim
    llSetScale(<0.1, 0.5, 0.01>);
} else {
    // Default to horizontal
    MOAP_WIDTH = 1024;
    MOAP_HEIGHT = 256;
}
```

## CSS Responsive Design

The HTML/CSS will adapt based on prim dimensions:

```css
/* Detect layout orientation */
.gameplay-hud {
  display: grid;
}

/* Horizontal layout (width > height) */
@media (min-width: 800px) {
  .gameplay-hud {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
  .resource-meters { /* Top row */ }
  .action-bar { /* Bottom row */ }
}

/* Vertical layout (height > width) */
@media (max-width: 400px) {
  .gameplay-hud {
    grid-template-columns: auto 1fr;
    grid-template-rows: 1fr;
  }
  .resource-meters { /* Left column */ }
  .action-bar { /* Right column */ }
}
```

## Alternative: Modular System (Future)

If single prim proves limiting, evolve to:

### Master Controller HUD
- **Prim**: Tiny cube (0.01m)
- **Attach Point**: HUD_BOTTOM_RIGHT
- **Script**: Manages other HUDs
- **Function**: Rezzes/attaches other components

### Resource Meters HUD (Separate)
- **Prim**: Horizontal bar (0.5m x 0.05m x 0.01m)
- **Attach Point**: HUD_TOP
- **Script**: Resource meters only
- **MOAP**: `resource-meters.html`

### Action Bar HUD (Separate)
- **Prim**: Bar (0.5m x 0.1m x 0.01m horizontal, or 0.1m x 0.5m x 0.01m vertical)
- **Attach Point**: User preference (HUD_BOTTOM, HUD_LEFT, HUD_RIGHT)
- **Script**: Action bar only
- **MOAP**: `action-bar.html`

### Communication
- All HUDs listen on same channel (-77770)
- Master Controller routes messages
- Firestore provides data sync

## User Instructions

### For Players

1. **Wear the HUD**: Attach "Feudalism 4 - Gameplay HUD" to your preferred attach point
2. **Choose Position**:
   - **Top**: Meters and actions stacked vertically
   - **Bottom**: Same layout, different position
   - **Left/Right**: Meters and actions side-by-side
3. **Customize**: Use Settings button to adjust visibility, size, etc.
4. **Open Setup**: Click "Setup" button to open full character management

### For Builders

1. **Create Challenge Objects**: Use `Feudalism 4 - Challenge Object.lsl`
2. **Configure**: Set stat, CR, and description in object description or script
3. **Place**: Object becomes clickable challenge test
4. **Players click**: Automatically triggers challenge test in their HUD

## Troubleshooting

### HUD Not Displaying
- Check prim has MOAP enabled on correct face
- Verify script is running (check script errors)
- Ensure prim is attached (not just in inventory)
- Check browser permissions in SL viewer

### Layout Wrong
- Verify attach point matches desired layout
- Check prim size matches script expectations
- Clear browser cache and reload

### Updates Not Showing
- Check Firestore connection
- Verify UUID in URL parameters
- Check browser console for errors

## Performance Considerations

### Prim Count
- **Single Prim**: Best performance, simplest
- **Multiple Prims**: More flexibility, slightly more overhead

### MOAP Performance
- Keep DOM elements minimal
- Use CSS transforms for animations (GPU-accelerated)
- Debounce rapid updates
- Use efficient Firestore queries

### Script Performance
- Minimal script logic (thin client)
- Most logic in JavaScript/Firestore
- Script mainly handles MOAP setup and communication

