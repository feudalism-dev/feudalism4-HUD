// ============================================================================
// Feudalism 4 - Vault (In-World Object)
// ============================================================================
// Vault object that notifies HUD when player is nearby
// ============================================================================

// Communication channel
integer HUD_CHANNEL = -77770;

// =========================== MAIN STATE =====================================

default {
    touch_start(integer num_detected) {
        key toucher = llDetectedKey(0);
        
        // Send VAULT_NEARBY message to toucher's HUD
        string vaultUUID = (string)llGetKey();
        llRegionSayTo(toucher, HUD_CHANNEL, "VAULT_NEARBY," + vaultUUID);
    }
}

