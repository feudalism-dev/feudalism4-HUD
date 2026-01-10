// ============================================================================
// Feudalism 4 - Gameplay HUD JavaScript
// ============================================================================
// Component-based gameplay HUD with real-time Firestore updates
// ============================================================================

// Get component type from URL
const params = new URLSearchParams(window.location.search);
const component = params.get('component') || 'meters';
const uuid = params.get('uuid') || '';
const channel = params.get('channel') || '';

// db and auth are global variables initialized in firebase-config.js
// DO NOT redeclare them here as it would shadow the global variables

// Character data
let character = null;
let unsubscribe = null;

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    console.log('[Gameplay HUD] Initializing component:', component);
    console.log('[Gameplay HUD] UUID:', uuid);
    
    if (!uuid) {
        showError('No UUID provided');
        return;
    }
    
    // Initialize Firebase (use existing config from firebase-config.js)
    try {
        // Firebase is already initialized in firebase-config.js
        // db and auth are already set as global variables
        // Just verify they're available
        if (!db || !auth) {
            throw new Error('Firebase not initialized - db or auth not available');
        }
        
        // Sign in anonymously
        await auth.signInAnonymously();
        console.log('[Gameplay HUD] Signed in anonymously');
        
        // Load character data
        await loadCharacter();
        
        // Render component
        renderComponent();
        
    } catch (error) {
        console.error('[Gameplay HUD] Initialization error:', error);
        showError('Failed to initialize: ' + error.message);
    }
}

// ============================================================================
// Character Data Loading
// ============================================================================

async function loadCharacter() {
    try {
        const snapshot = await db.collection('characters')
            .where('owner_uuid', '==', uuid)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            console.warn('[Gameplay HUD] No character found');
            return;
        }
        
        const doc = snapshot.docs[0];
        character = { id: doc.id, ...doc.data() };
        
        // Ensure resource pools are objects
        if (typeof character.health !== 'object') {
            character.health = { current: 100, max: 100 };
        }
        if (typeof character.stamina !== 'object') {
            character.stamina = { current: 100, max: 100 };
        }
        if (typeof character.mana !== 'object') {
            character.mana = { current: 50, max: 50 };
        }
        
        console.log('[Gameplay HUD] Character loaded:', character);
        
        // Set up real-time listener
        setupRealtimeListener(doc.ref);
        
    } catch (error) {
        console.error('[Gameplay HUD] Load character error:', error);
        showError('Failed to load character: ' + error.message);
    }
}

function setupRealtimeListener(charRef) {
    // Listen for real-time updates
    unsubscribe = charRef.onSnapshot((doc) => {
        if (doc.exists) {
            character = { id: doc.id, ...doc.data() };
            
            // Ensure resource pools are objects
            if (typeof character.health !== 'object') {
                character.health = { current: 100, max: 100 };
            }
            if (typeof character.stamina !== 'object') {
                character.stamina = { current: 100, max: 100 };
            }
            if (typeof character.mana !== 'object') {
                character.mana = { current: 50, max: 50 };
            }
            
            // Update component display
            renderComponent();
        }
    }, (error) => {
        console.error('[Gameplay HUD] Realtime listener error:', error);
    });
}

// ============================================================================
// Component Rendering
// ============================================================================

function renderComponent() {
    const root = document.getElementById('gameplay-hud-root');
    if (!root) return;
    
    if (component === 'meters') {
        renderResourceMeters(root);
    } else if (component === 'actions') {
        renderActionBar(root);
    } else if (component === 'status') {
        renderStatusBar(root);
    } else {
        root.innerHTML = '<p>Unknown component: ' + component + '</p>';
    }
}

function renderResourceMeters(container) {
    if (!character) {
        container.innerHTML = '<div id="component-meters"><p>Loading...</p></div>';
        return;
    }
    
    const health = character.health || { current: 100, max: 100 };
    const stamina = character.stamina || { current: 100, max: 100 };
    const mana = character.mana || { current: 50, max: 50 };
    
    const healthPercent = Math.max(0, Math.min(100, (health.current / health.max) * 100));
    const staminaPercent = Math.max(0, Math.min(100, (stamina.current / stamina.max) * 100));
    const manaPercent = Math.max(0, Math.min(100, (mana.current / mana.max) * 100));
    
    container.innerHTML = `
        <div id="component-meters">
            <div class="resource-meter">
                <div class="resource-meter-label">Health</div>
                <div class="resource-sphere">
                    <div class="resource-liquid health" style="height: ${healthPercent}%;"></div>
                </div>
                <div class="resource-value">${health.current}/${health.max}</div>
            </div>
            <div class="resource-meter">
                <div class="resource-meter-label">Stamina</div>
                <div class="resource-sphere">
                    <div class="resource-liquid stamina" style="height: ${staminaPercent}%;"></div>
                </div>
                <div class="resource-value">${stamina.current}/${stamina.max}</div>
            </div>
            <div class="resource-meter">
                <div class="resource-meter-label">Mana</div>
                <div class="resource-sphere">
                    <div class="resource-liquid mana" style="height: ${manaPercent}%;"></div>
                </div>
                <div class="resource-value">${mana.current}/${mana.max}</div>
            </div>
        </div>
    `;
}

function renderActionBar(container) {
    if (!character) {
        container.innerHTML = '<div id="component-actions"><p>Loading...</p></div>';
        return;
    }
    
    const slots = character.action_slots || [];
    const maxSlots = 6;
    
    let slotsHtml = '';
    for (let i = 0; i < maxSlots; i++) {
        const slot = slots[i];
        if (slot) {
            slotsHtml += `
                <div class="action-slot" data-slot-index="${i}">
                    <div class="action-slot-icon">${slot.icon || '⚔️'}</div>
                    <div class="action-slot-name">${slot.name || 'Item'}</div>
                </div>
            `;
        } else {
            slotsHtml += `<div class="action-slot empty" data-slot-index="${i}"></div>`;
        }
    }
    
    container.innerHTML = `
        <div id="component-actions">
            ${slotsHtml}
            <button class="action-btn" onclick="openSetupHUD()">⚙️ Setup</button>
            <button class="action-btn" onclick="showChallengeTest()">⚔️ Challenge</button>
        </div>
    `;
}

function renderStatusBar(container) {
    if (!character) {
        container.innerHTML = '<div id="component-status"><p>Loading...</p></div>';
        return;
    }
    
    const xp = character.xp_total || 0;
    const nextMilestone = calculateNextMilestone(xp);
    const progress = ((xp - (nextMilestone - 1000)) / 1000) * 100;
    
    container.innerHTML = `
        <div id="component-status">
            <div class="status-text">XP: ${xp}</div>
            <div class="xp-progress">
                <div class="xp-progress-fill" style="width: ${Math.max(0, Math.min(100, progress))}%;"></div>
            </div>
            <div class="status-text">Next: ${nextMilestone}</div>
        </div>
    `;
}

function calculateNextMilestone(xp) {
    if (xp < 100) return 100;
    if (xp < 250) return 250;
    if (xp < 500) return 500;
    if (xp < 1000) return 1000;
    if (xp < 2000) return 2000;
    if (xp < 4000) return 4000;
    if (xp < 8000) return 8000;
    return 16000;
}

// ============================================================================
// Actions
// ============================================================================

function openSetupHUD() {
    // TODO: Send command to main controller to open setup HUD
    console.log('[Gameplay HUD] Open Setup HUD requested');
    alert('Setup HUD will open in main controller');
}

function showChallengeTest() {
    // TODO: Show challenge test dialog
    console.log('[Gameplay HUD] Challenge Test requested');
    alert('Challenge Test dialog (coming soon)');
}

function showError(message) {
    const root = document.getElementById('gameplay-hud-root');
    if (root) {
        root.innerHTML = `<div style="padding: 16px; color: #ff6b6b; text-align: center;">⚠️ ${message}</div>`;
    }
}

// ============================================================================
// Initialize on load
// ============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

