# Currency Flow Analysis & Fix

## Problem
Currency/stipends from Paychest were not being successfully added to Firestore. Currency should be stored as a map: `{gold, silver, copper}` but was not being written correctly.

## Flow Analysis

### Expected Flow:
1. **Paychest** (in-world) → Sends `PAYCHEST_PAYOUT` to HUD
2. **HUD Paychest** → Receives payout request, gets stipend data from Bridge
3. **Bridge Stipends** → Returns stipend data: `{gold, silver, copper}`
4. **HUD Paychest** → Sends `CHAR|UPDATE_CURRENCY|characterId|gold|silver|copper` to Bridge Main
5. **Bridge Main** → Routes to Bridge Characters (CHAR domain)
6. **Bridge Characters** → Updates currency in Firestore as map: `{gold, silver, copper}`

### Issues Found:

1. **Channel Mismatch**: Bridge Main was routing CHAR domain to `CHARACTER_CHANNEL (-454550)`, but Bridge Characters listens on `MODULE_CHANNEL (-777002)`

2. **Message Format Mismatch**: 
   - Bridge Main was sending: `command` and `payload` separately
   - Bridge Characters expects: Full message string `DOMAIN|COMMAND|PAYLOAD[|SENDERLINK]`

3. **Payload Parsing**: Bridge Characters was only extracting `parts[2]` as payload, but UPDATE_CURRENCY payload is multi-part: `characterId|gold|silver|copper`

## Fixes Applied

### 1. Bridge Main (`Feudalism 4 - Bridge - Main.lsl`)
- Added `MODULE_CHANNEL = -777002` constant
- Changed CHAR domain routing to use `MODULE_CHANNEL` instead of `CHARACTER_CHANNEL`
- Changed message format to send full message: `domain + "|" + command + "|" + payload + "|" + (string)senderLink`
- Added `UPDATE_CURRENCY` and `FORCE_STIPEND_PAYOUT` to `getDomainForCommand()` for proper routing
- Also fixed STIP and CLASS domain routing to use `MODULE_CHANNEL` and correct format

### 2. Bridge Characters (`Feudalism 4 - Bridge - Characters.lsl`)
- Updated `link_message` handler to accept both 3-part and 4+ part message formats
- Fixed payload extraction to handle multi-part payloads correctly
- Changed minimum parts check from `< 4` to `< 3` to support Bridge Main's 3-part format
- Improved senderLink extraction: defaults to `sender_num` but can extract from message if present

### 3. Currency Storage Format
The `updateCurrency()` function in Bridge Characters correctly writes to Firestore as:
```json
{
  "currency": {
    "gold": integerValue,
    "silver": integerValue,
    "copper": integerValue
  }
}
```

## Message Flow (After Fix)

1. **HUD Paychest** (line 500): `llMessageLinked(LINK_SET, 0, "CHAR|UPDATE_CURRENCY|" + characterId + "|" + gold + "|" + silver + "|" + copper, ...)`

2. **Bridge Main** receives on channel 0:
   - Parses: `domain="CHAR"`, `command="UPDATE_CURRENCY"`, `payload="characterId|gold|silver|copper"`
   - Routes to MODULE_CHANNEL: `"CHAR|UPDATE_CURRENCY|characterId|gold|silver|copper|senderLink"`

3. **Bridge Characters** receives on MODULE_CHANNEL:
   - Parses message into parts
   - Extracts payload: `"characterId|gold|silver|copper"` (from parts[2] to parts[length-2] if senderLink present)
   - Extracts senderLink from last part or uses sender_num
   - Routes to `updateCurrency()` handler

4. **updateCurrency()** function:
   - Gets current currency from Firestore (handles map format)
   - Adds deltas to existing values
   - Writes back to Firestore with updateMask: `currency.gold&currency.silver&currency.copper`

## Testing Recommendations

1. Test "Get Pay" button - should update currency in Firestore
2. Test "Admin Payout" - should update currency
3. Test "Give Pay to Player" - should update currency
4. Verify Firestore document shows currency as map: `{gold: X, silver: Y, copper: Z}`

## Notes

- The user mentioned they manually added the currency map structure to their character document - this is correct
- The MOAP UI now displays currency correctly as "X gold, Y silver, Z copper"
- Currency is stored correctly in Firestore as a map (verified in Bridge Characters lines 782-790)

