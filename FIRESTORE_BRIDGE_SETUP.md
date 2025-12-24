# Firestore Bridge Setup Guide

## Architecture Changes

The Players HUD now communicates with Firestore using **HTTP/JSON requests directly from LSL**, not through MOAP scripts. This allows the Players HUD to work independently without requiring the Setup HUD to be open.

### What Changed

1. **Created `Feudalism 4 - Players HUD Firestore Bridge.lsl`**
   - Handles all HTTP/JSON communication with the backend
   - Uses `llHTTPRequest` to communicate directly with Firestore backend
   - Communicates with Data Manager via `link_message`

2. **Updated `Feudalism 4 - Players HUD Data Manager.lsl`**
   - Now sends load/save requests to Firestore Bridge instead of Combined HUD Controller
   - Uses `link_message` to communicate with Firestore Bridge

3. **Updated `Feudalism 4 - Combined HUD Controller.lsl`**
   - Removed character data polling from MOAP
   - Removed dependency on MOAP for loading/saving character data
   - MOAP is now only used for Setup HUD UI (which is fine)

## Required Configuration

The Firestore Bridge script needs a backend API endpoint to communicate with. You have three options:

### Option 1: Google Apps Script (Recommended - Original Design)

1. Create a Google Apps Script project
2. Deploy as Web App (Execute as: Me, Access: Anyone)
3. Update `Feudalism 4 - Players HUD Firestore Bridge.lsl`:
   ```lsl
   string BACKEND_API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   ```

### Option 2: Firebase Cloud Functions

1. Create a Cloud Function HTTP endpoint
2. Deploy to Firebase
3. Update `Feudalism 4 - Players HUD Firestore Bridge.lsl`:
   ```lsl
   string BACKEND_API_URL = "https://us-central1-feudalism4-rpg.cloudfunctions.net/api";
   ```

### Option 3: Direct Firestore REST API (Complex)

Requires handling OAuth2 authentication tokens, which is complex in LSL. Not recommended.

## API Protocol

The backend API should accept POST requests with this JSON format:

### Request Format
```json
{
  "action": "auth.login" | "character.get" | "character.update",
  "uuid": "avatar-uuid",
  "token": "session-token (for authenticated requests)",
  "data": { /* action-specific data */ }
}
```

### Response Format
```json
{
  "success": true,
  "action": "original-action",
  "token": "session-token (for auth.login)",
  "data": { /* response data */ },
  "error": null
}
```

### Actions

- **`auth.login`**: Authenticate and get session token
  - Request: `{"action": "auth.login", "uuid": "...", "username": "...", "displayname": "..."}`
  - Response: `{"success": true, "action": "auth.login", "token": "..."}`

- **`character.get`**: Get character data
  - Request: `{"action": "character.get", "uuid": "...", "token": "..."}`
  - Response: `{"success": true, "action": "character.get", "data": {...}}`

- **`character.update`**: Save character data
  - Request: `{"action": "character.update", "uuid": "...", "token": "...", "data": "stats:...|health:...|..."}`
  - Response: `{"success": true, "action": "character.update"}`

## Data Format

The character data is sent as a pipe-delimited string:
```
stats:1,2,3,...|health:current|base|max|stamina:...|mana:...|xp:100|class:warrior
```

The backend should parse this format and save to Firestore appropriately.

## Where to Place the Firestore Bridge Script

The `Feudalism 4 - Players HUD Firestore Bridge.lsl` script can be placed in **any prim of your HUD linkset**. Since it uses `llMessageLinked(LINK_SET, ...)` to communicate with the Data Manager, it will work regardless of which prim contains it.

**Recommended placement:**
- **Root prim** (prim 1) - Simplest, everything in one place
- **Or a dedicated child prim** - If you prefer to organize scripts by function

**Important:** The script must be in the **same linkset** as:
- `Feudalism 4 - Players HUD Data Manager.lsl`
- `Feudalism 4 - Combined HUD Controller.lsl`
- Other HUD scripts

The scripts communicate via `link_message`, which only works within the same linkset.

## Current Status

⚠️ **The Firestore Bridge script is created but needs `BACKEND_API_URL` to be configured before it will work.**

Until a backend API is set up:
- The Players HUD will load from LSD (local storage) only
- Data will not sync to/from Firestore automatically
- Opening the Setup HUD will still work and can save data to Firestore via MOAP

## Next Steps

1. Choose and set up a backend API (GAS or Cloud Functions)
2. Update `BACKEND_API_URL` in `Feudalism 4 - Players HUD Firestore Bridge.lsl`
3. Test authentication and character data loading/saving
4. Verify that the Players HUD works independently of the Setup HUD

