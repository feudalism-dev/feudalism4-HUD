# Feudalism 4 - Dynamic Helper Prim Architecture

## Overview

A **Main Controller HUD** that dynamically rezzes, positions, and manages **Helper Prim HUDs** (similar to AVsitter's helper prim system). Each helper prim is a lightweight MOAP display that gets its content URL from the main HUD.

## Architecture

### Main Controller HUD
**Prim**: Small, minimal (0.01m cube or small icon)
**Attach Point**: HUD_BOTTOM_RIGHT (out of the way, or invisible)
**Script**: `Feudalism 4 - Main Controller.lsl`
**Functions**:
- Rezzes helper prims on demand
- Sets helper prim attach points
- Resizes helper prims dynamically
- Feeds MOAP URLs to helper prims
- Manages helper prim lifecycle (rez/derez)
- Stores user preferences
- Routes communication between components

### Helper Prim HUDs
**Type**: Simple prims (box or custom shape)
**Scripts**: Minimal or scriptless (MOAP handles interaction)
**MOAP**: Gets URL from main controller
**Lifecycle**: Rezzed when needed, derezzed when hidden

## Helper Prim Components

### 1. Resource Meters Helper
**Prim**: Horizontal bar
**Default Size**: 0.5m x 0.05m x 0.01m
**Attach Point**: HUD_TOP (or user preference)
**MOAP URL**: `gameplay-hud.html?component=meters&uuid={uuid}&channel={channel}`
**Content**: Health, Stamina, Mana spheres

### 2. Action Bar Helper
**Prim**: Horizontal or vertical bar
**Default Size**: 
- Horizontal: 0.5m x 0.1m x 0.01m
- Vertical: 0.1m x 0.5m x 0.01m
**Attach Point**: HUD_BOTTOM (or user preference)
**MOAP URL**: `gameplay-hud.html?component=actions&uuid={uuid}&channel={channel}`
**Content**: Action slots + quick buttons

### 3. Status Bar Helper (Optional)
**Prim**: Small bar
**Default Size**: 0.3m x 0.03m x 0.01m
**Attach Point**: HUD_TOP_LEFT or HUD_TOP_RIGHT
**MOAP URL**: `gameplay-hud.html?component=status&uuid={uuid}&channel={channel}`
**Content**: XP progress, buffs, combat status

## Main Controller Script Logic

### Rezzing Helper Prims

```lsl
// Rez resource meters helper
rezResourceMeters() {
    vector rezPos = llGetPos() + <0, 0, 2>; // Above main HUD
    rotation rezRot = llGetRot();
    
    // Rez helper prim
    llRezObject("Resource Meters Helper", rezPos, ZERO_VECTOR, rezRot, 0);
    
    // Wait for rez, then configure
    // (handled in object_rez event)
}

object_rez(key id) {
    // Identify which helper was rezzed
    string name = llKey2Name(id);
    
    if (name == "Resource Meters Helper") {
        // Configure resource meters helper
        configureResourceMeters(id);
    }
    else if (name == "Action Bar Helper") {
        // Configure action bar helper
        configureActionBar(id);
    }
}
```

### Configuring Helper Prims

```lsl
configureResourceMeters(key helperKey) {
    // Set attach point
    llRegionSayTo(helperKey, CONTROL_CHANNEL, "ATTACH|HUD_TOP");
    
    // Set size
    llRegionSayTo(helperKey, CONTROL_CHANNEL, "SIZE|0.5|0.05|0.01");
    
    // Set MOAP URL
    string moapUrl = MOAP_BASE_URL + "/gameplay-hud.html";
    moapUrl += "?component=meters";
    moapUrl += "&uuid=" + llEscapeURL(ownerUUID);
    moapUrl += "&channel=" + (string)hudChannel;
    llRegionSayTo(helperKey, CONTROL_CHANNEL, "MOAP|" + moapUrl);
}
```

### Helper Prim Script (Minimal)

```lsl
// Feudalism 4 - Helper Prim.lsl
// Minimal script for helper prims

integer CONTROL_CHANNEL = -77769; // Communication with main controller
integer listenHandle;

default {
    state_entry() {
        listenHandle = llListen(CONTROL_CHANNEL, "", NULL_KEY, "");
    }
    
    listen(integer channel, string name, key id, string message) {
        list parts = llParseString2List(message, ["|"], []);
        string cmd = llList2String(parts, 0);
        
        if (cmd == "ATTACH") {
            integer attachPoint = (integer)llList2String(parts, 1);
            llAttachToAvatarTemp(attachPoint);
        }
        else if (cmd == "SIZE") {
            float x = (float)llList2String(parts, 1);
            float y = (float)llList2String(parts, 2);
            float z = (float)llList2String(parts, 3);
            llSetScale(<x, y, z>);
        }
        else if (cmd == "MOAP") {
            string url = llList2String(parts, 1);
            setMOAPUrl(url);
        }
        else if (cmd == "DEREZ") {
            llDie();
        }
    }
    
    setMOAPUrl(string url) {
        llSetPrimMediaParams(4, [
            PRIM_MEDIA_CURRENT_URL, url,
            PRIM_MEDIA_HOME_URL, url,
            PRIM_MEDIA_AUTO_PLAY, TRUE,
            PRIM_MEDIA_AUTO_SCALE, TRUE,
            PRIM_MEDIA_WIDTH_PIXELS, 512,
            PRIM_MEDIA_HEIGHT_PIXELS, 64,
            PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER
        ]);
    }
    
    attach(key id) {
        if (id == NULL_KEY) {
            llDie(); // Die when detached
        }
    }
}
```

## Communication Flow

### Main Controller → Helper Prim
**Channel**: -77769 (CONTROL_CHANNEL)
**Commands**:
- `ATTACH|{attach_point}` - Attach helper to specified point
- `SIZE|{x}|{y}|{z}` - Resize helper prim
- `MOAP|{url}` - Set MOAP URL
- `DEREZ` - Remove helper prim

### Helper Prim → Main Controller
**Channel**: -77770 (PLAYERHUDCHANNEL, same as F3)
**Commands**:
- `HELPER_READY|{component_name}` - Helper is ready
- `HELPER_ERROR|{component_name}|{error}` - Helper error

### Helper Prim ↔ Firestore
- Each helper prim's MOAP directly connects to Firestore
- Real-time listeners for component-specific data
- No need to route through main controller

## User Preferences

### Firestore: `users/{uuid}/preferences`
```json
{
  "hud_preferences": {
    "resource_meters": {
      "visible": true,
      "attach_point": "HUD_TOP",
      "size": {"x": 0.5, "y": 0.05, "z": 0.01},
      "position_offset": {"x": 0, "y": 0, "z": 0}
    },
    "action_bar": {
      "visible": true,
      "attach_point": "HUD_BOTTOM",
      "orientation": "horizontal",
      "size": {"x": 0.5, "y": 0.1, "z": 0.01}
    }
  }
}
```

## Advantages of This Approach

### 1. **Optimal Positioning**
- Each component can be at its ideal attach point
- Meters at top, action bar at bottom (no compromise)
- Can position independently

### 2. **Dynamic Sizing**
- Resize each prim independently
- Adjust based on content or user preference
- No fixed aspect ratio constraints

### 3. **Selective Visibility**
- Show/hide components individually
- Rez only what's needed
- Save attachment slots when hidden

### 4. **Flexibility**
- Easy to add new helper prims (status bar, combat log, etc.)
- Can reposition without reattaching main HUD
- User can manually adjust positions if needed

### 5. **Performance**
- Helper prims can be scriptless (MOAP handles interaction)
- Or minimal scripts (just configuration)
- Main controller handles coordination

### 6. **Modularity**
- Each component is independent
- Can update components separately
- Easier to maintain and debug

## Implementation Steps

### Phase 1: Main Controller
1. Create main controller prim
2. Implement rez logic
3. Implement helper configuration
4. Store/load user preferences

### Phase 2: Helper Prim Template
1. Create helper prim object (in inventory)
2. Add minimal script (or scriptless)
3. Test rez and configuration

### Phase 3: Resource Meters Helper
1. Create `gameplay-hud.html?component=meters`
2. Implement Firestore listeners
3. Test positioning and sizing

### Phase 4: Action Bar Helper
1. Create `gameplay-hud.html?component=actions`
2. Implement action slots
3. Test positioning and sizing

### Phase 5: Integration
1. Settings panel in main controller
2. User preference storage
3. Dynamic show/hide controls

## Helper Prim Object Creation

### In Second Life Inventory

1. **Create Helper Prim Object**
   - Create new prim (box)
   - Name: "Resource Meters Helper" (or "Action Bar Helper")
   - Add script: `Feudalism 4 - Helper Prim.lsl`
   - Set to "Copy" permissions
   - Place in main HUD's inventory

2. **Main Controller Inventory Structure**
   ```
   Feudalism 4 - Main Controller HUD
   ├── Scripts
   │   └── Feudalism 4 - Main Controller.lsl
   ├── Objects
   │   ├── Resource Meters Helper
   │   │   └── Feudalism 4 - Helper Prim.lsl
   │   └── Action Bar Helper
   │       └── Feudalism 4 - Helper Prim.lsl
   └── Textures (optional)
   ```

## MOAP URL Parameters

### Component-Specific URLs

**Resource Meters**:
```
gameplay-hud.html?component=meters&uuid={uuid}&channel={channel}&attach=HUD_TOP
```

**Action Bar**:
```
gameplay-hud.html?component=actions&uuid={uuid}&channel={channel}&attach=HUD_BOTTOM
```

**Status Bar** (optional):
```
gameplay-hud.html?component=status&uuid={uuid}&channel={channel}&attach=HUD_TOP_LEFT
```

### JavaScript Component Detection

```javascript
// In gameplay-hud.js
const params = new URLSearchParams(window.location.search);
const component = params.get('component'); // 'meters', 'actions', 'status'

if (component === 'meters') {
    // Render only resource meters
    renderResourceMeters();
} else if (component === 'actions') {
    // Render only action bar
    renderActionBar();
} else if (component === 'status') {
    // Render only status indicators
    renderStatusBar();
}
```

## Lifecycle Management

### Initialization
1. User attaches main controller HUD
2. Main controller loads user preferences
3. Main controller rezzes visible helper prims
4. Helper prims configure themselves
5. Helper prims load MOAP content

### Updates
1. User changes preference (e.g., hide action bar)
2. Main controller sends `DEREZ` to action bar helper
3. Action bar helper removes itself
4. Preference saved to Firestore

### Cleanup
1. User detaches main controller
2. Main controller sends `DEREZ` to all helpers
3. All helpers remove themselves
4. (Or helpers auto-die on detach)

## Comparison: Single Prim vs. Dynamic Helpers

| Feature | Single Prim | Dynamic Helpers |
|---------|-------------|-----------------|
| **Positioning** | Compromised (one attach point) | Optimal (each at ideal point) |
| **Sizing** | Fixed aspect ratio | Independent sizing |
| **Visibility** | Show/hide via CSS | Rez/derez prims |
| **Complexity** | Simpler | More complex |
| **Attachment Slots** | 1 | 2-3 (when visible) |
| **Flexibility** | Limited | High |
| **Performance** | Single MOAP | Multiple MOAPs |

## Recommendation

**Use Dynamic Helper Prim approach** because:
- Solves positioning problems elegantly
- More flexible for future expansion
- Better user experience (optimal placement)
- Similar complexity to modular system but more elegant
- Can start simple and add helpers as needed

## Next Steps

1. Create main controller script
2. Create helper prim template script
3. Create helper prim objects (in inventory)
4. Build component-specific MOAP pages
5. Test rez and configuration flow

