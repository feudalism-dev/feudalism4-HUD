# Feudalism 4 - Gameplay HUD Design

## Overview

The **Gameplay HUD** is a persistent, always-visible in-world UI optimized for real-time gameplay. It's separate from the Setup HUD, which opens on-demand for character management.

## Design Philosophy

- **Always Visible**: Persistent UI elements that don't require opening/closing
- **Real-Time Updates**: Instant feedback via Firestore listeners
- **Minimal Footprint**: Compact, non-intrusive, positioned at screen edges
- **One-Click Actions**: Quick access to common gameplay functions
- **Visual Monitoring**: Gauges, meters, and status indicators

## UI Components

### 1. Resource Meters Bar (Top of Screen)
**Position**: Fixed at top center or top edge
**Components**:
- Health Sphere (Red liquid) - Always visible
- Stamina Sphere (Blue liquid) - Always visible  
- Mana Sphere (Green liquid) - Always visible
- Compact size: ~40px height each, side-by-side
- Current/Max values displayed below or on hover

**Layout Options**:
- Horizontal bar at top center
- Horizontal bar at top left
- Horizontal bar at top right

### 2. Action Bar (Positionable)
**Position**: User-configurable (Top/Bottom/Left/Right)
**Components**:
- 6-8 Action Slots (items/spells/buffs) - Larger than meters, clickable
- Quick Action Buttons:
  - 🎲 Roll Dice
  - 🎯 Target Player
  - 📋 Open Setup HUD
  - 😴 Rest
  - 🎭 Mode Toggle
  - ⚙️ Settings

**Layout Options**:
- Horizontal at bottom (default)
- Horizontal at top (below meters)
- Vertical on left side
- Vertical on right side

### 3. Status Indicators (Optional, Minimal)
- XP Progress (small bar, shows on hover)
- Buffs/Debuffs (small icons, tooltip on hover)
- Combat Status (if in combat)

## Technical Architecture

### File Structure
```
MOAP Interface/
  gameplay-hud.html      # Main gameplay HUD UI
  gameplay-hud.css       # Compact, optimized styles
  gameplay-hud.js        # Real-time update logic
  hud.html               # Setup HUD (existing)
```

### LSL Script
- New script: `Feudalism 4 - Gameplay HUD.lsl`
- Separate from Setup HUD script
- Loads `gameplay-hud.html` instead of `hud.html`
- Same communication protocol

### Real-Time Updates
**Firestore Listeners**:
```javascript
// Listen to character document changes
db.collection('characters')
  .where('owner_uuid', '==', uuid)
  .onSnapshot((snapshot) => {
    // Update resource meters instantly
    // Update action slots
    // Update status indicators
  });
```

**Update Frequency**:
- Resource pools: Real-time (on change)
- Action slots: Real-time (on change)
- XP: Real-time (on change)
- Buffs: Real-time (on change)

### Performance Optimizations
- Minimal DOM elements
- CSS transforms for animations (GPU-accelerated)
- Debounced updates for rapid changes
- Lazy loading of non-critical elements
- Efficient Firestore queries (single document listener)

## User Preferences

### Position Settings
- Resource Meters: Top Center / Top Left / Top Right
- Action Bar: Top / Bottom / Left / Right
- Save preferences to Firestore user document

### Visibility Settings
- Show/Hide resource meters
- Show/Hide action bar
- Show/Hide status indicators
- Compact mode (smaller sizes)

## Communication Protocol

### Gameplay HUD → LSL
Same as Setup HUD:
- `ANNOUNCE|message` - Chat announcements
- `ROLL|stat|dice|target|result|success` - Dice rolls
- `COMBAT|action|target|damage|effect` - Combat actions
- `REQUEST|action` - LSL requests

### LSL → Gameplay HUD
- Real-time updates via Firestore (preferred)
- Channel messages for instant notifications
- Status updates for combat/events

## Integration with Setup HUD

### Opening Setup HUD
- Button in Action Bar: "📋 Setup" or "⚙️ Menu"
- Opens Setup HUD in new MOAP prim (or replaces current)
- Gameplay HUD remains visible (or minimizes)

### Data Sync
- Both HUDs read from same Firestore document
- Changes in Setup HUD instantly reflect in Gameplay HUD
- No manual refresh needed

## Visual Design

### Resource Meters
- Glass spheres with liquid fill (same as Setup HUD)
- Compact size: 40-50px diameter
- Horizontal layout with labels below
- Color-coded: Red (Health), Blue (Stamina), Green (Mana)
- Low/Critical warnings (pulsing glow)

### Action Slots
- Square buttons: 60-70px
- Icon + name (or just icon in compact mode)
- Cooldown overlay when active
- Hover tooltips for details
- Visual feedback on click

### Action Bar
- Semi-transparent background
- Rounded corners
- Subtle shadow
- Smooth animations
- Responsive to screen size

## Implementation Phases

### Phase 1: Core Structure
1. Create `gameplay-hud.html` with basic layout
2. Create `gameplay-hud.css` with compact styles
3. Create `gameplay-hud.js` with Firestore listeners
4. Create LSL script for Gameplay HUD

### Phase 2: Resource Meters
1. Implement glass sphere meters
2. Real-time Firestore listener for resource updates
3. Position controls (top center/left/right)
4. Low/Critical warnings

### Phase 3: Action Bar
1. Action slots rendering
2. Quick action buttons
3. Position controls (top/bottom/left/right)
4. Click handlers for actions

### Phase 4: Integration
1. Button to open Setup HUD
2. Data sync between HUDs
3. User preferences storage
4. Settings panel

### Phase 5: Polish
1. Animations and transitions
2. Performance optimization
3. Responsive design
4. Accessibility features

## Best Practices for Second Life MOAP

1. **Single Prim**: Use one MOAP prim for entire gameplay HUD
2. **Fixed Positioning**: Use CSS `position: fixed` for screen-edge placement
3. **Minimal Scripts**: Keep JavaScript lightweight
4. **Efficient Updates**: Batch DOM updates, use requestAnimationFrame
5. **Fallback UI**: Show basic info if Firestore unavailable
6. **Error Handling**: Graceful degradation on connection issues

## Future Enhancements

- Combat log overlay
- Target player info panel
- Buff/debuff tracker
- Quest/objective tracker
- Chat integration
- Voice integration
- Gesture shortcuts
- Customizable hotkeys

