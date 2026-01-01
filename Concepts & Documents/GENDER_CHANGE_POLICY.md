# Identity Change Policies

## 1. Gender: Can Be Changed At Will

**RULE**: Gender changes are allowed at any time.

### Implementation Details

- **UI**: Gender selection buttons are always available and enabled in the Character tab
- **Backend**: Gender changes are saved immediately when "Save Character" is clicked
- **No Validation**: There are no checks or restrictions preventing gender changes
- **No Cooldown**: Gender can be changed multiple times without any time restrictions
- **No Mechanical Impact**: Gender has no mechanical impact on gameplay
- **No Universe Restrictions**: Universe restrictions do not apply to gender

### Technical Implementation

- Gender is included in both `createCharacter()` and `updateCharacter()` API calls
- The `onGenderSelected()` function updates the character state immediately
- Gender selection is saved to Firestore along with other character data
- No backend validation prevents or restricts gender changes

### Requirements

- **This behavior must remain unchanged**: Gender must always remain freely changeable

---

## 2. Species: NOT Changeable By Players

**RULE**: Species changes are NOT allowed under normal circumstances.

### Core Principles

- **Players cannot change species**: Players have NO ability to change species through the HUD
- **No UI for species change**: There is no UI functionality that allows players to change species
- **No backend endpoint for species change**: No player-accessible API endpoints allow species changes
- **Only Admin/Manual Changes**: Only a Super User or System Admin may change species manually in Firestore
- **This rule must not be altered or generalized**: These restrictions are permanent and must not be weakened

### Exception: Disallowed Species in Universe

**IMPORTANT**: If a character's current species becomes disallowed in their universe:

- **The species remains valid and playable**: The character continues using their current species
- **NO forced change**: The system does NOT force a species change
- **NO automatic change**: The system does NOT automatically reassign a different species
- **NO UI prompt**: Players are NOT prompted to change species
- **Character remains playable**: The character can continue playing with their current (disallowed) species

### What NOT To Implement

**DO NOT implement any of the following:**

- ❌ No UI for species change
- ❌ No backend endpoint for species change  
- ❌ No automatic species reassignment
- ❌ No "fallback species" logic
- ❌ No "species migration" logic
- ❌ No forced species changes when species becomes disallowed
- ❌ No prompts or notifications asking players to change species

### Rationale

Species changes are permanently restricted because:
- **Game mechanics depend on species**: Resource pool calculations (health, stamina, mana), stat modifiers, and other mechanical elements are fundamentally based on species
- **Balance integrity**: Allowing species changes would enable stat/mechanical optimization that undermines game balance
- **Character identity**: Species is a core, permanent aspect of character identity (unlike gender)

### Technical Implementation

- `species_id` is included in `createCharacter()` calls
- `species_id` is **NOT** included in `updateCharacter()` calls (players cannot change it)
- Species selection UI may be visible for new character creation only
- Any species selection for existing characters updates local state but is NOT saved to Firestore

