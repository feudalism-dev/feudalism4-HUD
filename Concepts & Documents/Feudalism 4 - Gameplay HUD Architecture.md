# Feudalism 4 - Gameplay HUD Architecture

## Second Life HUD Constraints & Considerations

### HUD Attach Points
Second Life provides specific attach points for HUDs:
- **HUD_CENTER_1** through **HUD_CENTER_4** - Center screen positions
- **HUD_TOP** - Top center
- **HUD_BOTTOM** - Bottom center  
- **HUD_LEFT** - Left side
- **HUD_RIGHT** - Right side
- **HUD_TOP_LEFT**, **HUD_TOP_RIGHT**, **HUD_BOTTOM_LEFT**, **HUD_BOTTOM_RIGHT** - Corners

### Screen Size Variations
- Common resolutions: 1024x768, 1280x1024, 1920x1080, 2560x1440, 4K
- UI must scale/adapt to different screen sizes
- MOAP prims have fixed pixel dimensions but can scale

### Prim Limitations
- Prim size affects MOAP display area
- Can't dynamically resize prims easily (requires script permissions)
- Multiple prims = more complexity but more flexibility

## Recommended Architecture: Master Controller + Modular HUDs

### Concept
A **Master Controller HUD** (small, invisible) that:
1. Manages attachment of other HUD elements
2. Handles communication between HUD components
3. Stores user preferences (positions, visibility)
4. Can rez/attach separate HUD prims to optimal attach points

### HUD Components

#### 1. Master Controller HUD
**Prim**: Small, invisible (or tiny icon)
**Attach Point**: HUD_BOTTOM_RIGHT (out of the way)
**Script**: `Feudalism 4 - Master Controller.lsl`
**Functions**:
- Initialize and attach other HUD components
- Manage user preferences
- Route communication between components
- Handle setup HUD opening

#### 2. Resource Meters HUD
**Prim**: Horizontal bar, ~512x64 pixels
**Attach Point**: HUD_TOP (or HUD_TOP_LEFT/TOP_RIGHT based on preference)
**Script**: `Feudalism 4 - Resource Meters.lsl`
**MOAP**: `resource-meters.html`
**Content**:
- Health sphere (red)
- Stamina sphere (blue)
- Mana sphere (green)
- Compact, always visible

#### 3. Action Bar HUD
**Prim**: Horizontal bar, ~512x128 pixels (or vertical ~128x512)
**Attach Point**: User configurable (HUD_BOTTOM, HUD_LEFT, HUD_RIGHT)
**Script**: `Feudalism 4 - Action Bar.lsl`
**MOAP**: `action-bar.html`
**Content**:
- 6-8 Action slots
- Quick action buttons
- Challenge Test button
- Settings button

#### 4. Setup HUD (Existing)
**Prim**: Larger, ~1024x768 pixels
**Attach Point**: HUD_CENTER_2 (opens on demand)
**Script**: `Feudalism 4 - Setup HUD.lsl` (existing)
**MOAP**: `hud.html` (existing)

## Alternative: Single Adaptive MOAP Prim

### Concept
One MOAP prim that adapts its layout based on:
- Attach point detection
- User preferences
- Screen size (via JavaScript)

### Implementation
- **Prim Size**: ~1024x256 (horizontal) or ~256x1024 (vertical)
- **Script**: Detects attach point, sets MOAP dimensions accordingly
- **CSS/JS**: Responsive layout that adapts to prim size
- **Layout Modes**:
  - **Horizontal Mode**: Meters top row, Action bar bottom row
  - **Vertical Mode**: Meters left column, Action bar right column
  - **Compact Mode**: Meters only, action bar on hover/click

### Pros/Cons
**Pros**:
- Single script, single object
- Easier to manage
- Less attachment complexity

**Cons**:
- Less flexible positioning
- Can't separate meters and action bar to different screen edges
- Fixed aspect ratio limitations

## Recommended Approach: Hybrid System

### Phase 1: Single Adaptive Prim (MVP)
Start with one MOAP prim that:
- Detects attach point
- Adapts layout (horizontal/vertical)
- Contains both meters and action bar
- User can choose attach point for optimal placement

### Phase 2: Modular System (Future)
If needed, evolve to:
- Master Controller + separate HUDs
- More granular positioning
- Independent visibility controls

## Challenge Test System (Not "Dice Rolls")

### Terminology
- **Challenge Test** (not "Dice Roll")
- **Challenge Rating (CR)** (not "Difficulty" or "DC")
- **Stat Test** (not "Roll Stat")
- **Success/Failure with Degrees** (not "Roll Result")

### UI Elements

#### Challenge Test Button
**Location**: Action Bar
**Icon**: 🎯 or ⚔️ or 🛡️
**Label**: "Challenge" or "Test"
**Action**: Opens Challenge Test dialog

#### Challenge Test Dialog
**Components**:
- Stat selector (dropdown)
- CR selector (1-9, with descriptions)
- "Attempt Challenge" button
- Results display (Success/Failure, Degrees)

**CR Descriptions**:
- CR 1: Trivial
- CR 2: Very Easy
- CR 3: Easy
- CR 4: Moderate
- CR 5: Challenging
- CR 6: Hard
- CR 7: Very Hard
- CR 8: Extreme
- CR 9: Nearly Impossible

#### In-World Challenge Objects
- Script: `Feudalism 4 - Challenge Object.lsl`
- Clickable object triggers challenge test
- Sends challenge request to HUD
- HUD processes test and returns result
- Object displays result/effect

## Required Images/Assets

### HUD Backgrounds
1. **resource-meters-bg.png** - Background for resource meters bar
   - Size: 512x64px
   - Style: Semi-transparent, medieval theme
   - Format: PNG with alpha

2. **action-bar-bg.png** - Background for action bar
   - Size: 512x128px (horizontal) or 128x512px (vertical)
   - Style: Semi-transparent, matches meters
   - Format: PNG with alpha

### Icons (16x16 or 32x32px)
1. **icon-health.png** - Health indicator icon
2. **icon-stamina.png** - Stamina indicator icon
3. **icon-mana.png** - Mana indicator icon
4. **icon-challenge.png** - Challenge test icon
5. **icon-target.png** - Target player icon
6. **icon-setup.png** - Open setup HUD icon
7. **icon-rest.png** - Rest action icon
8. **icon-mode.png** - Mode toggle icon
9. **icon-settings.png** - Settings icon

### UI Elements
1. **glass-sphere-overlay.png** - Overlay for resource spheres (optional)
2. **action-slot-bg.png** - Background for action slots
3. **button-bg.png** - Background for action buttons

## HUD Construction Guide

### Option A: Single Adaptive Prim

#### Prim Setup
1. Create a single prim (box)
2. Size: 0.5m x 0.1m x 0.01m (adjustable)
3. Texture: Transparent or subtle background
4. Add script: `Feudalism 4 - Gameplay HUD.lsl`

#### Script Logic
```lsl
// Detect attach point
integer attachPoint = llGetAttached();
// Set MOAP dimensions based on attach point
if (attachPoint == ATTACH_HUD_TOP || attachPoint == ATTACH_HUD_BOTTOM) {
    // Horizontal layout: 1024x256
    MOAP_WIDTH = 1024;
    MOAP_HEIGHT = 256;
} else {
    // Vertical layout: 256x1024
    MOAP_WIDTH = 256;
    MOAP_HEIGHT = 1024;
}
```

#### HTML/CSS
- Responsive layout using CSS Grid/Flexbox
- Media queries for different prim sizes
- JavaScript detects prim dimensions and adjusts layout

### Option B: Master Controller + Separate HUDs

#### Master Controller Prim
1. Create tiny prim (0.01m cube)
2. Make invisible (transparent texture, alpha 0)
3. Attach to HUD_BOTTOM_RIGHT
4. Add script: `Feudalism 4 - Master Controller.lsl`

#### Resource Meters Prim
1. Create horizontal bar prim
2. Size: 0.5m x 0.05m x 0.01m
3. Attach to HUD_TOP (or user preference)
4. Add script: `Feudalism 4 - Resource Meters.lsl`

#### Action Bar Prim
1. Create bar prim (horizontal or vertical)
2. Size: 0.5m x 0.1m x 0.01m (or 0.1m x 0.5m x 0.01m)
3. Attach to HUD_BOTTOM (or user preference)
4. Add script: `Feudalism 4 - Action Bar.lsl`

## Communication Protocol

### Between HUD Components
**Channel**: -77770 (PLAYERHUDCHANNEL, same as F3)
**Format**: Pipe-delimited commands

**Commands**:
- `RESOURCE_UPDATE|health|current|max` - Update resource meter
- `ACTION_TRIGGER|slot_index` - Trigger action slot
- `CHALLENGE_REQUEST|stat|cr` - Request challenge test
- `CHALLENGE_RESULT|success|degrees|message` - Challenge test result
- `OPEN_SETUP` - Open setup HUD
- `PREFERENCE_UPDATE|key|value` - Update user preference

### Between HUD and In-World Objects
**Channel**: -77770 (same channel)
**Format**: Pipe-delimited

**From Object to HUD**:
- `CHALLENGE_OBJECT|stat|cr|object_key|object_name` - Challenge from object

**From HUD to Object**:
- `CHALLENGE_RESULT|object_key|success|degrees|message` - Result to object

## User Preferences Storage

### Firestore Document: `users/{uuid}/preferences`
```json
{
  "hud_preferences": {
    "resource_meters": {
      "visible": true,
      "position": "top_center",
      "size": "normal"
    },
    "action_bar": {
      "visible": true,
      "position": "bottom",
      "orientation": "horizontal",
      "size": "normal"
    },
    "compact_mode": false
  }
}
```

## Implementation Priority

### Phase 1: MVP (Single Adaptive Prim)
1. Create `gameplay-hud.html` with responsive layout
2. Create `gameplay-hud.css` with adaptive styles
3. Create `gameplay-hud.js` with Firestore listeners
4. Create `Feudalism 4 - Gameplay HUD.lsl` script
5. Implement Challenge Test system (not "dice")
6. Basic images/assets

### Phase 2: Polish
1. User preferences system
2. Position controls
3. Visibility toggles
4. Animations and transitions

### Phase 3: Advanced (If Needed)
1. Master Controller system
2. Separate HUD components
3. In-world challenge object script
4. Advanced customization

## Screen Size Adaptation Strategy

### CSS Approach
```css
/* Base layout for 1024x256 (horizontal) */
.gameplay-hud {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
}

/* Adapt for vertical (256x1024) */
@media (max-width: 300px) {
  .gameplay-hud {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }
}
```

### JavaScript Detection
```javascript
// Detect prim dimensions from MOAP
const primWidth = window.innerWidth;
const primHeight = window.innerHeight;

if (primWidth > primHeight) {
  // Horizontal layout
  document.body.classList.add('layout-horizontal');
} else {
  // Vertical layout
  document.body.classList.add('layout-vertical');
}
```

## Next Steps

1. **Decide on architecture**: Single adaptive prim vs. modular system
2. **Create image assets list**: Define exact sizes and styles needed
3. **Build MVP**: Start with single adaptive prim approach
4. **Test in-world**: Verify attach points, sizing, visibility
5. **Iterate**: Adjust based on user feedback

