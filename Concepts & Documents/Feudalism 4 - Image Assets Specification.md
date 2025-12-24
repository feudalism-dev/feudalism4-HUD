# Feudalism 4 - Image Assets Specification

## Overview
This document defines all image assets needed for the Gameplay HUD, including dimensions, formats, and usage.

## Resource Meters Bar Assets

### 1. resource-meters-bg.png
**Purpose**: Background for the resource meters bar
**Dimensions**: 512 x 64 pixels
**Format**: PNG with alpha channel
**Style**: 
- Semi-transparent (70-80% opacity)
- Medieval/fantasy theme
- Subtle texture (parchment, leather, or metal)
- Rounded corners or decorative borders
**Usage**: Background layer behind resource spheres

### 2. resource-meters-frame.png (Optional)
**Purpose**: Decorative frame/border for meters bar
**Dimensions**: 512 x 64 pixels
**Format**: PNG with alpha channel
**Style**: Ornate border, corner decorations
**Usage**: Overlay on meters bar for visual polish

## Action Bar Assets

### 3. action-bar-bg-horizontal.png
**Purpose**: Background for horizontal action bar
**Dimensions**: 512 x 128 pixels
**Format**: PNG with alpha channel
**Style**: 
- Semi-transparent (70-80% opacity)
- Matches resource meters style
- Horizontal orientation
**Usage**: Background for action bar when positioned horizontally

### 4. action-bar-bg-vertical.png
**Purpose**: Background for vertical action bar
**Dimensions**: 128 x 512 pixels
**Format**: PNG with alpha channel
**Style**: 
- Semi-transparent (70-80% opacity)
- Matches resource meters style
- Vertical orientation
**Usage**: Background for action bar when positioned vertically

## Action Slot Assets

### 5. action-slot-bg.png
**Purpose**: Background for individual action slots
**Dimensions**: 64 x 64 pixels
**Format**: PNG with alpha channel
**Style**: 
- Square with rounded corners
- Subtle border/shadow
- Semi-transparent or solid (user preference)
**Usage**: Background for each action slot button

### 6. action-slot-bg-active.png
**Purpose**: Background for active/selected action slot
**Dimensions**: 64 x 64 pixels
**Format**: PNG with alpha channel
**Style**: 
- Highlighted/glowing version of action-slot-bg
- Gold or accent color border
**Usage**: Visual feedback when action slot is active

### 7. action-slot-bg-cooldown.png
**Purpose**: Overlay for action slot on cooldown
**Dimensions**: 64 x 64 pixels
**Format**: PNG with alpha channel
**Style**: 
- Darkened/desaturated overlay
- Optional: clock or timer icon
**Usage**: Visual indicator when action is on cooldown

## Button Assets

### 8. button-bg.png
**Purpose**: Background for quick action buttons
**Dimensions**: 64 x 32 pixels (or 32 x 64 for vertical)
**Format**: PNG with alpha channel
**Style**: 
- Rounded rectangle
- Subtle gradient or texture
- Border/shadow for depth
**Usage**: Background for action buttons (Challenge, Target, Setup, etc.)

### 9. button-bg-hover.png
**Purpose**: Hover state for buttons
**Dimensions**: 64 x 32 pixels (or 32 x 64 for vertical)
**Format**: PNG with alpha channel
**Style**: 
- Highlighted version of button-bg
- Slightly brighter or glowing
**Usage**: Visual feedback on button hover

### 10. button-bg-pressed.png
**Purpose**: Pressed/active state for buttons
**Dimensions**: 64 x 32 pixels (or 32 x 64 for vertical)
**Format**: PNG with alpha channel
**Style**: 
- Darkened or inset version
- Shows "pressed" state
**Usage**: Visual feedback on button click

## Icon Assets (32x32 pixels)

All icons should be:
- **Dimensions**: 32 x 32 pixels (or 16x16 for compact mode)
- **Format**: PNG with alpha channel
- **Style**: Simple, clear, recognizable at small sizes
- **Color**: Can be colored or monochrome (user preference)

### 11. icon-health.png
**Purpose**: Health resource icon
**Style**: Heart, red cross, or health symbol
**Color**: Red tones

### 12. icon-stamina.png
**Purpose**: Stamina resource icon
**Style**: Lightning bolt, energy symbol, or running figure
**Color**: Blue tones

### 13. icon-mana.png
**Purpose**: Mana resource icon
**Style**: Star, sparkle, or magic symbol
**Color**: Green tones

### 14. icon-challenge.png
**Purpose**: Challenge Test action icon
**Style**: Shield, target, or crossed swords
**Color**: Gold or accent color

### 15. icon-target.png
**Purpose**: Target player action icon
**Style**: Crosshairs, target, or eye
**Color**: Neutral or accent color

### 16. icon-setup.png
**Purpose**: Open Setup HUD icon
**Style**: Gear, menu, or settings symbol
**Color**: Neutral or accent color

### 17. icon-rest.png
**Purpose**: Rest action icon
**Style**: Bed, moon, or ZZZ symbol
**Color**: Neutral or accent color

### 18. icon-mode.png
**Purpose**: Mode toggle icon
**Style**: Theater masks, mode symbol, or toggle switch
**Color**: Neutral or accent color

### 19. icon-settings.png
**Purpose**: Settings/Preferences icon
**Style**: Gear, cog, or settings symbol
**Color**: Neutral or accent color

## Resource Sphere Assets (Optional Overlays)

### 20. glass-sphere-overlay.png
**Purpose**: Optional overlay for resource spheres
**Dimensions**: 64 x 64 pixels (or match sphere size)
**Format**: PNG with alpha channel
**Style**: 
- Glass/reflection effect
- Subtle highlights and shadows
- Optional: rim or border
**Usage**: Overlay on liquid-filled spheres for glass effect

## Status Indicator Assets

### 21. buff-icon-bg.png
**Purpose**: Background for buff/debuff icons
**Dimensions**: 24 x 24 pixels
**Format**: PNG with alpha channel
**Style**: 
- Small circular or square background
- Subtle border
**Usage**: Background for status effect icons

### 22. xp-bar-bg.png
**Purpose**: Background for XP progress bar
**Dimensions**: 200 x 8 pixels (or scalable)
**Format**: PNG with alpha channel
**Style**: 
- Thin bar background
- Subtle texture
**Usage**: Background for XP progress indicator

## UI Element Assets

### 23. divider-line.png
**Purpose**: Visual separator between UI sections
**Dimensions**: 512 x 2 pixels (or 2 x 512 for vertical)
**Format**: PNG with alpha channel
**Style**: 
- Subtle line or decorative divider
- Matches overall theme
**Usage**: Separator between meters and action bar

### 24. tooltip-bg.png
**Purpose**: Background for tooltips/hover info
**Dimensions**: 200 x 80 pixels (flexible)
**Format**: PNG with alpha channel
**Style**: 
- Semi-transparent dark background
- Rounded corners
- Subtle border
**Usage**: Tooltip popups on hover

## Master Controller Assets (If Using Modular System)

### 25. controller-icon.png
**Purpose**: Icon for master controller HUD (if visible)
**Dimensions**: 16 x 16 pixels
**Format**: PNG with alpha channel
**Style**: 
- Small, unobtrusive
- Optional: gear or control symbol
**Usage**: Tiny icon if controller needs to be visible

## Color Palette Reference

### Primary Colors
- **Health Red**: #8b1a1a (crimson) to #b32828 (crimson-light)
- **Stamina Blue**: #1a4a6b (azure) to #2a7a8b (lighter blue)
- **Mana Green**: #1a6b4a (emerald) to #28a06b (emerald-light)
- **Gold Accent**: #c9a227 (gold) to #e8c547 (gold-light)

### UI Colors
- **Background Dark**: #1a1612 (bg-dark)
- **Background Medium**: #2a2420 (bg-medium)
- **Text Primary**: #e8dcc8 (text-primary)
- **Border**: #4a4238 (border-color)

## File Organization

```
MOAP Interface/images/
  gameplay/
    resource-meters-bg.png
    resource-meters-frame.png (optional)
    action-bar-bg-horizontal.png
    action-bar-bg-vertical.png
    action-slot-bg.png
    action-slot-bg-active.png
    action-slot-bg-cooldown.png
    button-bg.png
    button-bg-hover.png
    button-bg-pressed.png
    icons/
      icon-health.png
      icon-stamina.png
      icon-mana.png
      icon-challenge.png
      icon-target.png
      icon-setup.png
      icon-rest.png
      icon-mode.png
      icon-settings.png
    overlays/
      glass-sphere-overlay.png (optional)
      buff-icon-bg.png
      xp-bar-bg.png
    ui/
      divider-line.png
      tooltip-bg.png
```

## Image Creation Guidelines

### Style Consistency
- All images should share a cohesive medieval/fantasy theme
- Use consistent color palette
- Maintain similar texture/pattern style
- Ensure readability at small sizes

### Optimization
- Use PNG-8 with alpha for simple graphics (smaller file size)
- Use PNG-24 with alpha for complex graphics (better quality)
- Optimize file sizes (aim for <50KB per image when possible)
- Consider using SVG for scalable icons (if browser support allows)

### Testing
- Test at actual display sizes (32x32, 64x64, etc.)
- Verify readability on different backgrounds
- Check alpha transparency rendering
- Test on different screen resolutions

## Alternative: CSS-Only Approach

If image creation is challenging, many of these can be replaced with:
- **CSS gradients** for backgrounds
- **CSS borders and shadows** for frames
- **Unicode/Emoji icons** for simple icons
- **CSS animations** for effects

This reduces asset creation but may have less visual polish.

