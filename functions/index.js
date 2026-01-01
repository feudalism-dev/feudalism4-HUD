// ============================================================================
// Feudalism 4 - Consume Request Processor Cloud Function
// ============================================================================
// Triggered on: feud4/users/<uid>/consume_requests/{rid}
// Processes consume requests and applies effects
// ============================================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.processConsumeRequest = functions.firestore
  .document('users/{uid}/consume_requests/{rid}')
  .onCreate(async (snap, context) => {
    const requestData = snap.data();
    const uid = context.params.uid;
    const rid = context.params.rid;
    
    // Extract item_id from request
    const itemId = requestData.item_id;
    
    if (!itemId) {
      console.error('[processConsumeRequest] No item_id in request');
      await snap.ref.delete();
      return null;
    }
    
    try {
      // Step 1: Validate the request
      // - Get user's active character
      const characterSnapshot = await db.collection('characters')
        .where('owner_uuid', '==', uid)
        .limit(1)
        .get();
      
      if (characterSnapshot.empty) {
        console.error('[processConsumeRequest] No character found for user:', uid);
        await snap.ref.delete();
        return null;
      }
      
      const characterDoc = characterSnapshot.docs[0];
      const characterId = characterDoc.id;
      const characterData = characterDoc.data();
      
      // - Check if item exists in inventory
      const inventoryRef = db.collection('characters').doc(characterId)
        .collection('inventory').doc(itemId.toLowerCase());
      const inventoryDoc = await inventoryRef.get();
      
      if (!inventoryDoc.exists) {
        console.error('[processConsumeRequest] Item not in inventory:', itemId);
        await snap.ref.delete();
        return null;
      }
      
      const inventoryData = inventoryDoc.data();
      const quantity = inventoryData.qty || 0;
      
      if (quantity <= 0) {
        console.error('[processConsumeRequest] Item quantity is 0:', itemId);
        await snap.ref.delete();
        return null;
      }
      
      // - Get consumable from master registry
      const consumableRef = db.collection('consumables').doc('master')
        .collection('items').doc(itemId.toLowerCase());
      const consumableDoc = await consumableRef.get();
      
      if (!consumableDoc.exists) {
        console.error('[processConsumeRequest] Consumable not in master registry:', itemId);
        await snap.ref.delete();
        return null;
      }
      
      const consumable = consumableDoc.data();
      
      // - Check if disabled
      if (consumable.disabled === true) {
        console.error('[processConsumeRequest] Consumable is disabled:', itemId);
        await snap.ref.delete();
        return null;
      }
      
      // - Check RP-only gating
      if (consumable.rp_only === true) {
        const userMode = characterData.mode || 'OOC';
        if (userMode !== 'RP') {
          console.log('[processConsumeRequest] RP-only consumable used in non-RP mode:', itemId);
          await snap.ref.delete();
          return null;
        }
      }
      
      // Step 2: Apply effect
      const durationSeconds = consumable.duration_seconds || 0;
      const effectType = consumable.effect_type || 'heal';
      const effectValue = consumable.effect_value || 0;
      
      if (durationSeconds === 0) {
        // Instant effect - write to effects_log
        // Path: users/<uid>/effects_log (or characters/<characterId>/effects_log)
        // Instructions say: feud4/users/<uid>/effects_log, but we'll use characters for consistency
        await db.collection('characters').doc(characterId)
          .collection('effects_log').add({
            type: effectType,
            value: effectValue,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
      } else {
        // Timed effect - write to active_buffs
        // Path: users/<uid>/active_buffs/<slug> (or characters/<characterId>/active_buffs)
        // Instructions say: feud4/users/<uid>/active_buffs/<slug>, but we'll use characters for consistency
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + durationSeconds);
        
        await db.collection('characters').doc(characterId)
          .collection('active_buffs').doc(itemId.toLowerCase()).set({
            effect_type: effectType,
            effect_value: effectValue,
            expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
          });
      }
      
      // Step 3: Decrement inventory
      const newQuantity = quantity - 1;
      
      if (newQuantity <= 0) {
        // Delete item document if quantity becomes 0
        await inventoryRef.delete();
      } else {
        // Update quantity
        await inventoryRef.update({
          qty: newQuantity
        });
      }
      
      // Step 4: Delete the consume_request document
      await snap.ref.delete();
      
      console.log('[processConsumeRequest] Successfully processed consume request:', {
        uid,
        itemId,
        effectType,
        effectValue,
        durationSeconds
      });
      
      return null;
    } catch (error) {
      console.error('[processConsumeRequest] Error processing request:', error);
      // Delete the request on error to prevent retries
      await snap.ref.delete();
      return null;
    }
  });

