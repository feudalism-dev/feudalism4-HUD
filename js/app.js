// ============================================================================
// Feudalism 4 - Main Application
// ============================================================================
// Orchestrates the HUD interface, connecting API and UI modules
// ============================================================================

// Debug logging for SL browser (visible on page)
// Use var for SL browser compatibility
var DebugLog = {
    panel: null,
    content: null,
    enabled: true,
    maxLines: 50,
    lines: [],
    
    init() {
        this.panel = document.getElementById('debug-panel');
        this.content = document.getElementById('debug-content');
        var toggleBtn = document.getElementById('debug-toggle-btn');
        
        // Debug panel starts hidden
        if (this.panel) {
            this.panel.style.display = 'none';
            this.log('Debug panel initialized (hidden by default - click green dot to show)', 'info');
        } else {
            // If panel doesn't exist, create it (hidden)
            var newPanel = document.createElement('div');
            newPanel.id = 'debug-panel';
            newPanel.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 500px; max-height: 400px; background: rgba(0, 0, 0, 0.95); color: #0f0; font-family: monospace; font-size: 12px; padding: 15px; border: 3px solid #0f0; z-index: 99999; overflow-y: auto; display: none;';
            newPanel.innerHTML = '<div style="margin-bottom: 10px;"><strong>DEBUG LOG (Click green dot to hide)</strong></div><div id="debug-content"></div>';
            document.body.appendChild(newPanel);
            this.panel = newPanel;
            this.content = document.getElementById('debug-content');
        }
        
        // Setup toggle button (green dot in header)
        if (toggleBtn) {
            var self = this;
            toggleBtn.addEventListener('click', function() {
                if (self.panel.style.display === 'none') {
                    self.panel.style.display = 'block';
                    self.log('Debug panel shown', 'info');
                } else {
                    self.panel.style.display = 'none';
                }
            });
            this.log('Debug toggle button connected to green dot', 'info');
        } else {
            this.log('Warning: Debug toggle button not found in header', 'warn');
        }
        
        this.log('Debug system ready', 'info');
    },
    
    log(message, type = 'info') {
        if (!this.enabled) return;
        
        // Use simple debug if available (works immediately)
        if (window.simpleDebug) {
            window.simpleDebug(message, type);
            return;
        }
        
        var timestamp = new Date().toLocaleTimeString();
        var colors = {
            info: '#0f0',
            error: '#f00',
            warn: '#ff0',
            debug: '#0ff'
        };
        var color = colors[type] || '#0f0';
        
        var line = '[' + timestamp + '] <span style="color: ' + color + '">' + message + '</span>';
        this.lines.push(line);
        
        // Keep only last maxLines
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
        
        if (this.content) {
            this.content.innerHTML = this.lines.join('<br>');
            this.content.scrollTop = this.content.scrollHeight;
        }
        
        // Don't call console.log here to avoid recursion - DebugLog is fallback only
        // If simpleDebug exists, it already logged to console
    }
};

// Initialize debug panel immediately
if (typeof DebugLog !== 'undefined') {
    DebugLog.init();
} else {
    // Fallback: create debug panel inline if DebugLog not loaded yet
    window.addEventListener('DOMContentLoaded', function() {
        if (typeof DebugLog !== 'undefined') {
            DebugLog.init();
        }
    });
}

// Override console methods to also log to debug panel
// Use var and avoid spread operator for SL browser compatibility
var originalLog = console.log;
var originalError = console.error;
var originalWarn = console.warn;

console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    // Call original first to avoid recursion
    originalLog.apply(console, args);
    // Then update debug panel if available
    if (window.simpleDebug) {
        window.simpleDebug(args.join(' '), 'info');
    } else if (typeof DebugLog !== 'undefined' && DebugLog.enabled) {
        DebugLog.log(args.join(' '), 'info');
    }
};

console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    // Call original first to avoid recursion
    originalError.apply(console, args);
    // Then update debug panel if available
    if (window.simpleDebug) {
        window.simpleDebug('ERROR: ' + args.join(' '), 'error');
    } else if (typeof DebugLog !== 'undefined' && DebugLog.enabled) {
        DebugLog.log('ERROR: ' + args.join(' '), 'error');
    }
};

console.warn = function() {
    var args = Array.prototype.slice.call(arguments);
    // Call original first to avoid recursion
    originalWarn.apply(console, args);
    // Then update debug panel if available
    if (window.simpleDebug) {
        window.simpleDebug('WARN: ' + args.join(' '), 'warn');
    } else if (typeof DebugLog !== 'undefined' && DebugLog.enabled) {
        DebugLog.log('WARN: ' + args.join(' '), 'warn');
    }
};

// Use var instead of const for SL browser compatibility
// Wrap App creation in try-catch to catch any errors
var App;
try {
    if (window.simpleDebug) {
        window.simpleDebug('Starting App object creation...', 'info');
    }
    App = {
    // Application state
    state: {
        character: null,
        species: [],
        classes: [],
        filteredClasses: [],
        enforceClassStatMinimums: true,
        vocations: [],
        genders: [],
        templatesLoaded: false,
        currentSpecies: null,
        currentClass: null,
        currentVocation: null,
        inventoryPagination: null,  // { cursor: '', hasMore: false, items: [] }
        currentUniverse: null,
        selectedUniverseId: 'default',
        selectedCharacterId: null,
        pendingChanges: {},
        statsFloor: null,
        isNewCharacter: false,
        creationInProgress: false,
        lastAutoSaveMessage: '',
        dirty: false,  // UX 2: Track unsaved changes
        econSessionActive: false,  // AP/XP edits this session override stale URL params
        creationStepHints: {
            name: 'Enter your character\'s name and optional title, then click <strong>Next »</strong>. Use <strong>Save Progress</strong> anytime.',
            gender: 'Click a <strong>portrait</strong> below to view details, then press <strong>Select This Gender</strong>.',
            species: 'Click a <strong>species card</strong> below to view details, then press <strong>Select This Species</strong>.',
            stats: 'Allocate all stat points (Available Points must reach 0), then click <strong>Next »</strong>.',
            career: 'Click a <strong>class card</strong> to view details and select your starting class, then click <strong>Finish</strong>.'
        }
    },
    
    // LSL integration state
    lsl: {
        uuid: null,
        username: null,
        displayName: null,
        channel: null,
        connected: false
    },

    _starterProvisionAttempted: false,
    _starterProvisionPromise: null,
    _pendingAutoHideSetup: false,
    _initialized: false,
    _initPromise: null,
    _loadCharacterSelectorQueue: Promise.resolve(),
    _eventHandlersBound: false,

    /**
     * Drop duplicate character rows (same Firestore doc id).
     */
    _getCharacterDocId(char) {
        if (!char) {
            return '';
        }
        const raw = char.id || char.characterId || char.character_id || '';
        return String(raw).trim();
    },

    _normalizeUniverseId(value) {
        if (value === undefined || value === null) {
            return 'default';
        }
        if (typeof value !== 'string') {
            return 'default';
        }
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === 'JSON_INVALID' || trimmed === 'null') {
            return 'default';
        }
        return trimmed;
    },

    _clearSelectOptions(selector) {
        if (!selector) {
            return;
        }
        // CEF-139: innerHTML on <select> does not reliably remove options — use DOM API
        while (selector.firstChild) {
            selector.removeChild(selector.firstChild);
        }
    },

    dedupeCharactersById(characters) {
        const seen = {};
        const out = [];
        if (!characters || !characters.length) {
            return out;
        }
        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const id = this._getCharacterDocId(char);
            if (!id || seen[id]) {
                continue;
            }
            seen[id] = true;
            out.push(char);
        }
        return out;
    },

    /**
     * Format currency for display (gold, silver, copper)
     * @param {number} gold - Gold amount
     * @param {number} silver - Silver amount
     * @param {number} copper - Copper amount
     * @returns {string} Formatted currency string
     */
    formatCurrency(gold, silver, copper) {
        const parts = [];
        if (gold > 0) parts.push(gold + ' gold');
        if (silver > 0) parts.push(silver + ' silver');
        if (copper > 0) parts.push(copper + ' copper');
        return parts.length > 0 ? parts.join(', ') : '0';
    },
    
    /**
     * Initialize the application
     */
    async init() {
        if (this._initialized) {
            return;
        }
        if (this._initPromise) {
            return this._initPromise;
        }
        this._initPromise = this._runInitInternal();
        try {
            await this._initPromise;
            this._initialized = true;
        } finally {
            this._initPromise = null;
        }
    },

    async _runInitInternal() {
        if (window.simpleDebug) {
            window.simpleDebug('========================================', 'debug');
            window.simpleDebug('Feudalism 4 HUD initializing...', 'debug');
            window.simpleDebug('URL: ' + window.location.href, 'debug');
        }
        DebugLog.log('========================================', 'debug');
        DebugLog.log('Feudalism 4 HUD initializing...', 'debug');
        DebugLog.log('User Agent: ' + navigator.userAgent, 'debug');
        DebugLog.log('URL: ' + window.location.href, 'debug');
        
        // SECURITY: Check if UUID is present - if not, API.init() will show error page
        var params = new URLSearchParams(window.location.search);
        var uuid = params.get('uuid') || '';
        var activeCharFromUrl = params.get('active_char') || '';
        
        DebugLog.log('UUID from URL: ' + uuid, 'debug');
        
        if (!uuid || uuid.trim() === '') {
            DebugLog.log('SECURITY: No UUID in URL parameters. Access denied.', 'error');
            // API.init() will show the error page, so we can return early
            return;
        }
        
        // Initialize modules
        DebugLog.log('Calling API.init()...', 'debug');
        await API.init();
        DebugLog.log('API.init() completed', 'debug');
        
        // Ensure Default Universe exists
        await API.ensureDefaultUniverse();
        
        // SECURITY: Verify UUID is still set after API init (in case it was cleared)
        if (!API.uuid || API.uuid !== uuid) {
            console.error('SECURITY: UUID mismatch or missing after API init');
            return;
        }
        
        UI.init();
        
        // Remove EXIT button if it exists (safety check for deployed versions)
        const exitBtn = document.getElementById('btn-exit-setup');
        if (exitBtn) {
            exitBtn.remove();
            console.log('[App] Removed EXIT button');
        }
        
        // Initialize debug panel (if not already initialized)
        if (typeof DebugLog !== 'undefined' && !DebugLog.panel) {
            DebugLog.init();
        }
        if (typeof DebugLog !== 'undefined') {
            DebugLog.log('HUD initializing...', 'info');
        }
        
        // Store LSL data for quick access
        // NOTE: UUID is the unique identifier - all queries and security checks use UUID, not displayName
        this.lsl.uuid = API.uuid;
        this.lsl.username = API.username;
        this.lsl.displayName = API.displayName; // Display name is UI-only, never used for identification
        this.lsl.channel = API.hudChannel;
        this.lsl.connected = !!API.uuid;
        
        // MOAP: keyboard + short URL (must run before heavy render / URL sync)
        if (typeof UI !== 'undefined') {
            if (UI.installMoapInputFix) UI.installMoapInputFix();
            if (UI.cleanMoapUrlParams) UI.cleanMoapUrlParams();
        }
        
        // Setup "Open in Browser" link
        this.setupOpenInBrowserLink();
        
        // Initialize super admin if this is the super admin UUID
        if (API.uuid === API.SUPER_ADMIN_UUID) {
            await API.initializeSuperAdmin();
            console.log('Super Admin initialized');
        }
        
        // Update displayName from user document if available (UI display only, syncUser() may have updated it)
        if (API.user && API.user.display_name) {
            this.lsl.displayName = API.user.display_name;
            API.displayName = API.user.display_name;
        }
        
        // Update header with player name
        this.updatePlayerInfo();
        
        // Detect per-universe admin assignments (may still have role player in users doc)
        await API.refreshUniverseManagementAccess();

        // Restore last selected character (URL from LSL, session, or Firestore users.activeCharacter)
        this.resolveInitialCharacterId(activeCharFromUrl);

        // Update UI based on role
        UI.updateRoleUI(API.role);
        
        // Check if LSL is requesting character data
        const requestData = params.get('request_data');
        if (requestData === '1') {
            console.log('[Players HUD] LSL requesting character data - will broadcast after load');
        }
        
        // Load initial data
        DebugLog.log('About to call loadData()...', 'debug');
        await this.loadData();
        DebugLog.log('loadData() completed', 'debug');
        
        // If LSL requested data, refresh stat cache when character is ready
        if (requestData === '1' && this.state.character) {
            console.log('[Players HUD] Character found — caching stats for Players HUD');
            this.cacheHudStatsForPlayers(this.state.character);
        }
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Start heartbeat
        this.startHeartbeat();
        
        console.log('Feudalism 4 HUD ready for:', this.lsl.displayName);
    },
    
    /**
     * Update player info display in header
     */
    updatePlayerInfo() {
        const headerInfo = document.querySelector('.header-info');
        if (headerInfo && this.lsl.displayName) {
            // Add player name display
            let playerName = headerInfo.querySelector('.player-name');
            if (!playerName) {
                playerName = document.createElement('span');
                playerName.className = 'player-name';
                headerInfo.insertBefore(playerName, headerInfo.firstChild);
            }
            playerName.textContent = this.lsl.displayName;
            playerName.title = `UUID: ${this.lsl.uuid}\nChannel: ${this.lsl.channel}`;
        }
    },
    
    /**
     * Load species/classes/vocations/genders once per session (API layer caches 30m).
     */
    async ensureTemplatesLoaded(forceReload) {
        if (forceReload) {
            API.invalidateTemplateCache();
        }
        if (!forceReload && this.state.templatesLoaded && this.state.species.length > 0 && this.state.classes.length > 0) {
            return { success: true, cached: true };
        }

        let speciesResult, classesResult, vocationsResult, gendersResult;
        if (window.IS_SL_BROWSER) {
            speciesResult = await API.getSpecies();
            classesResult = await API.getClasses();
            vocationsResult = await API.getVocations();
            gendersResult = await API.getGenders();
        } else {
            [speciesResult, classesResult, vocationsResult, gendersResult] = await Promise.all([
                API.getSpecies(),
                API.getClasses(),
                API.getVocations(),
                API.getGenders()
            ]);
        }

        if (!speciesResult.success || !classesResult.success || !gendersResult.success) {
            return { success: false };
        }

        this.state.species = speciesResult.data?.species || [];
        this.state.classes = classesResult.data?.classes || [];
        this.state.vocations = vocationsResult.data?.vocations || [];
        this.state.genders = gendersResult.data?.genders || [];
        this.state.templatesLoaded = true;
        return { success: true, cached: false };
    },

    /**
     * Use character row from listCharacters() when it already has full document fields.
     */
    characterFromList(characters, characterId) {
        if (!characters || !characterId) {
            return null;
        }
        for (let i = 0; i < characters.length; i++) {
            if (characters[i].id === characterId) {
                return characters[i];
            }
        }
        return null;
    },

    /**
     * Load all necessary data from server
     */
    async loadData(options) {
        if (options === undefined) {
            options = {};
        }
        const forceRefresh = !!options.forceRefresh;
        try {
            DebugLog.log('loadData() called', 'debug');
            UI.setConnectionStatus(true);
            
            DebugLog.log('Starting API calls...', 'debug');
            const startTime = Date.now();
            
            const templateLoad = await this.ensureTemplatesLoaded(false);
            if (!templateLoad.success) {
                UI.showToast('Failed to load game templates', 'error');
                return;
            }
            if (templateLoad.cached) {
                console.log('[loadData] Templates from session cache');
            }
            
            console.log('Templates loaded:', {
                species: this.state.species.length,
                classes: this.state.classes.length,
                vocations: this.state.vocations.length,
                genders: this.state.genders.length
            });
            
            // If collections are empty, they might need seeding
            if (this.state.species.length === 0) {
                console.warn('No species found - collections may need seeding');
            }
            if (this.state.classes.length === 0) {
                console.warn('No classes found - collections may need seeding');
            }
            if (this.state.genders.length === 0) {
                console.warn('No genders found - collections may need seeding');
            }
            
            // SECURITY: Verify UUID is present before loading character data
            if (!API.uuid || API.uuid.trim() === '') {
                console.error('SECURITY: Cannot load character data without UUID');
                UI.showToast('Access denied: No UUID provided', 'error');
                this.state.character = null;
                this.state.isNewCharacter = true;
                return;
            }
            
            // Try to load existing characters
            // SECURITY: listCharacters() validates owner_uuid matches API.uuid
            try {
                console.log('[loadData] Loading characters for UUID:', API.uuid);
                const charsResult = await API.listCharacters(forceRefresh);
                console.log('[loadData] listCharacters result:', charsResult);
                
                if (!charsResult.success) {
                    console.error('[loadData] listCharacters failed:', charsResult.error);
                    UI.showToast('Failed to load characters: ' + (charsResult.error || 'Unknown error'), 'error');
                    this.state.character = null;
                    this.state.isNewCharacter = true;
                    return;
                }
                
                if (charsResult.data && charsResult.data.characters && charsResult.data.characters.length > 0) {
                    console.log('[loadData] Found', charsResult.data.characters.length, 'character(s)');
                    const characters = charsResult.data.characters;
                    
                    // UX 2: Always load character selector (shows even with 1 character)
                    await this.loadCharacterSelector(characters);
                    
                    // Load selected / active / first character
                    const characterId = this.pickCharacterIdToLoad(characters);
                    let character = this.characterFromList(characters, characterId);
                    if (!character && characterId) {
                        const charResult = await API.getCharacterById(characterId);
                        if (charResult.success) {
                            character = charResult.data.character;
                        } else if (characters.length > 0) {
                            console.warn('[loadData] Could not load', characterId, '- using first roster entry');
                            character = characters[0];
                            this.state.selectedCharacterId = character.id;
                        } else {
                            UI.showToast('Failed to load character', 'error');
                            return;
                        }
                    } else if (character) {
                        console.log('[loadData] Using character from listCharacters (saved 1 doc read)');
                    }
                    
                    if (character) {
                        
                        // SECURITY: Double-check ownership before using character data
                        if (character.owner_uuid !== API.uuid) {
                            console.error('SECURITY VIOLATION: Character owner_uuid does not match current user');
                            UI.showToast('Access denied: Character ownership mismatch', 'error');
                            this.state.character = null;
                            this.state.isNewCharacter = true;
                        } else {
                            this.state.character = character;
                            if (!this.state.creationInProgress) {
                                this.state.isNewCharacter = false;
                            }
                            this.state.selectedCharacterId = character.id; // Ensure selected ID is set
                            this.captureStatsFloor(this.state.character);
                            
                            // Load universe data for the character
                            if (character.universe_id) {
                                const universeResult = await API.getUniverse(character.universe_id);
                                if (universeResult.success) {
                                    this.state.currentUniverse = universeResult.data.universe;
                                }
                            }
                            
                            // UX 2: Update UI indicators after character loads
                            this.updateStatusIndicator();
                            this.updateStepGuide();
                            
                            // Ensure resource pools are properly structured
                            if (!this.state.character.health || typeof this.state.character.health !== 'object') {
                                this.state.character.health = { current: 100, base: 100, max: 100 };
                            }
                            if (!this.state.character.stamina || typeof this.state.character.stamina !== 'object') {
                                this.state.character.stamina = { current: 100, base: 100, max: 100 };
                            }
                            // Initialize mana - if missing, will be recalculated by recalculateResourcePools()
                            if (!this.state.character.mana || typeof this.state.character.mana !== 'object') {
                                // Don't set default here - let recalculateResourcePools() calculate it based on stats
                                this.state.character.mana = { current: 0, base: 0, max: 0 };
                            }
                            
                            // Initialize action_slots if missing
                            if (!this.state.character.action_slots) {
                                this.state.character.action_slots = [];
                            }
                            
                            // Initialize mode if missing
                            if (!this.state.character.mode) {
                                this.state.character.mode = 'roleplay';
                            }
                            
                            // Recalculate resource pools to ensure they're correct
                            this.recalculateResourcePools();
                            
                            if (UI.populateIdentityForm) {
                                UI.populateIdentityForm(this.state.character, this.state.pendingRegistrationCode);
                            }
                            
                            console.log('Character loaded:', this.state.character);

                            // Gameplay XP/pools are authoritative in HUD KVP; Firestore is often stale
                            this.initEconFromUrl();
                            this.mergePoolsFromUrl();
                            const hadMoapDraft = this.restoreMoapSessionDraft();
                            if (!hadMoapDraft) {
                                this.migrateLegacyEconIfNeeded();
                            }
                            if (window.reconcileStaleApBalance(this.state.character)) {
                                window.updateEconUrlParams(
                                    window.getEconSpent(this.state.character),
                                    window.getApBalance(this.state.character)
                                );
                            }
                            
                            // Setup / UPDATE: pull stats from Firestore into Players HUD LSD cache
                            await this.cacheHudStatsForPlayers(this.state.character);
                            
                            // Load and set up buffs listener
                            await this.loadBuffs();
                            this.setupBuffsListener();
                        }
                    }
                } else {
                    // No character found — auto-provision starter in default universe when possible
                    console.log('[loadData] No characters found in result. charsResult.data:', charsResult.data);
                    const provisioned = await this.ensureStarterCharacter();
                    if (provisioned) {
                        console.log('[loadData] Starter character provisioned — reloading roster');
                        await this.loadData();
                        return;
                    }
                    this.state.character = null;
                    this.state.selectedCharacterId = null;
                    
                    // UX 2: Update UI indicators when no character
                    await this.loadCharacterSelector([]); // Empty array to show "Create New" option
                    this.updateStatusIndicator();
                    this.updateStepGuide();
                    this.state.isNewCharacter = true;
                    console.log('No existing character, ready for creation');
                }
            } catch (error) {
                // Error loading characters - log it but don't assume no character exists
                console.error('[loadData] Error loading characters:', error);
                console.error('[loadData] Error stack:', error.stack);
                UI.showToast('Error loading character data: ' + error.message, 'error');
                // Don't set isNewCharacter = true here - let the user try to refresh
                // Instead, try to load using getCharacter() as fallback
                try {
                    console.log('[loadData] Trying fallback: getCharacter()');
                    const fallbackResult = await API.getCharacter();
                    if (fallbackResult.success && fallbackResult.data.character) {
                        console.log('[loadData] Fallback getCharacter() succeeded');
                        this.state.character = fallbackResult.data.character;
                        this.state.isNewCharacter = false;
                        this.captureStatsFloor(this.state.character);
                    } else {
                        console.log('[loadData] Fallback getCharacter() failed:', fallbackResult.error);
                        this.state.character = null;
                        this.state.isNewCharacter = true;
                    }
                } catch (fallbackError) {
                    console.error('[loadData] Fallback getCharacter() also failed:', fallbackError);
                    this.state.character = null;
                    this.state.isNewCharacter = true;
                }
            }
            
            // Render UI
            DebugLog.log('Calling renderAll()...', 'debug');
            await this.renderAll();
            if (typeof window.restoreMoapTabFromUrl === 'function') {
                window.restoreMoapTabFromUrl();
            }
            DebugLog.log('renderAll() completed', 'debug');
            this.setupOpenInBrowserLink();
            
        } catch (error) {
            DebugLog.log('loadData() ERROR: ' + error.message, 'error');
            DebugLog.log('Stack: ' + (error.stack || 'N/A'), 'error');
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            UI.setConnectionStatus(false);
            UI.showToast(`Failed to connect: ${error.message || 'Unknown error'}`, 'error');
            
            // Show more details in console for debugging
            if (error.code) {
                console.error('Firebase error code:', error.code);
            }
        }
    },
    
    /**
     * Show new character dialog with universe selection
     */
    async showNewCharacterDialog() {
        try {
            // Load available universes
            const result = await API.listAvailableUniverses();
            if (!result.success) {
                UI.showToast('Failed to load universes', 'error');
                return;
            }
            
            const universes = result.data.universes;
            
            // Build universe selection HTML
            let universeOptions = '';
            universes.forEach(universe => {
                const requiresCode = universe.registrationCode && universe.registrationCode.trim() !== '';
                universeOptions += `<option value="${universe.id}" data-requires-code="${requiresCode}">${universe.name}${requiresCode ? ' (Requires Code)' : ''}</option>`;
            });
            
            // Show modal with universe selection
            UI.showModal(`
                <div class="modal-content">
                    <h2 class="modal-title">Create New Character</h2>
                    <p class="modal-text">Select a universe for your new character:</p>
                    <div class="form-group" style="margin: var(--space-md) 0;">
                        <label for="new-char-universe">Universe</label>
                        <select id="new-char-universe" style="width: 100%; padding: var(--space-xs) var(--space-sm); background: var(--bg-medium); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                            ${universeOptions}
                        </select>
                    </div>
                    <div id="new-char-registration-group" class="form-group" style="display: none; margin: var(--space-md) 0;">
                        <label for="new-char-registration-code">Registration Code</label>
                        <input type="text" id="new-char-registration-code" placeholder="Enter registration code..." style="width: 100%; padding: var(--space-xs) var(--space-sm); background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <small style="color: var(--text-muted); display: block; margin-top: var(--space-xxs);">This universe requires a registration code</small>
                    </div>
                    <div class="modal-actions" style="display: flex; gap: var(--space-sm); justify-content: flex-end; margin-top: var(--space-lg);">
                        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
                        <button class="btn-primary" id="btn-create-new-character">Create Character</button>
                    </div>
                </div>
            `);
            
            // Handle universe selection change
            const universeSelect = document.getElementById('new-char-universe');
            const registrationGroup = document.getElementById('new-char-registration-group');
            const registrationInput = document.getElementById('new-char-registration-code');
            
            universeSelect.onchange = () => {
                const selectedOption = universeSelect.options[universeSelect.selectedIndex];
                const requiresCode = selectedOption.dataset.requiresCode === 'true';
                registrationGroup.style.display = requiresCode ? 'block' : 'none';
                if (!requiresCode) {
                    registrationInput.value = '';
                }
            };
            
            // Trigger initial check
            universeSelect.onchange();
            
            // Handle create button
            document.getElementById('btn-create-new-character').onclick = async () => {
                const universeId = universeSelect.value;
                const registrationCode = registrationInput.value.trim();
                
                // Validate registration code if required
                if (registrationGroup.style.display !== 'none') {
                    if (!registrationCode) {
                        UI.showToast('Registration code is required', 'warning');
                        return;
                    }
                    
                    // Verify registration code
                    const universeResult = await API.getUniverse(universeId);
                    if (!universeResult.success) {
                        UI.showToast('Failed to verify universe', 'error');
                        return;
                    }
                    
                    const universe = universeResult.data.universe;
                    if (universe.registrationCode !== registrationCode) {
                        UI.showToast('Invalid registration code', 'error');
                        return;
                    }
                }
                
                // Check character limit
                const limitCheck = await API.validateCharacterLimit(universeId, API.uuid);
                if (!limitCheck.success || !limitCheck.data.allowed) {
                    UI.showToast(`Character limit reached for this universe (${limitCheck.data.currentCount}/${limitCheck.data.limit})`, 'error');
                    return;
                }
                
                // Close modal and start character creation
                UI.closeModal();
                this.state.selectedUniverseId = universeId;
                this.state.isNewCharacter = true;
                this.state.creationInProgress = true;
                this.state.character = this.createDefaultCharacter();
                this.state.character.universe_id = universeId;
                this.captureStatsFloor(this.state.character);
                
                // Load universe data for mana checks
                const universeResult = await API.getUniverse(universeId);
                if (universeResult.success) {
                    this.state.currentUniverse = universeResult.data.universe;
                }

                const pageRegistrationInput = document.getElementById('universe-registration-code');
                if (pageRegistrationInput && registrationCode) {
                    pageRegistrationInput.value = registrationCode;
                }

                await this.applyUniverseIdentityDefaults({ force: true });
                
                if (UI.populateIdentityForm) {
                    UI.populateIdentityForm(this.state.character, registrationCode);
                }
                
                // Update character selector with temp option
                this.updateCharacterSelectorWithTemp();
                
                // Switch to Character tab and show universe selection
                UI.switchTab('character');
                await this.renderAll();
                this.navigateToStep('name');
                this.updateCreationNavigation();
                setTimeout(() => document.getElementById('char-name')?.focus(), 200);
            };
        } catch (error) {
            console.error('Failed to show new character dialog:', error);
            UI.showToast('Failed to load universe data', 'error');
        }
    },
    
    /**
     * Setup "Open in Browser" link with credentials
     */
    setupOpenInBrowserLink() {
        const link = document.getElementById('open-in-browser-link');
        if (!link) return;
        
        // Only show if we have credentials (UUID is required)
        if (!API.uuid || API.uuid.trim() === '') {
            link.style.display = 'none';
            return;
        }
        
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        const current = new URLSearchParams(window.location.search);
        params.set('uuid', API.uuid);
        if (API.username) params.set('username', API.username);
        if (API.displayName) params.set('displayname', API.displayName);
        if (API.hudChannel) params.set('channel', API.hudChannel.toString());

        // Carry HUD gameplay + selection params so browser matches in-world Setup
        const carryKeys = [
            'active_char', 'xp_lifetime', 'xp_total', 'xp_spent', 'ap_balance',
            'health_pipe', 'stamina_pipe', 'mana_pipe', 'moap_tab'
        ];
        carryKeys.forEach((key) => {
            const v = current.get(key);
            if (v) {
                params.set(key, v);
            }
        });
        if (!params.has('active_char')) {
            const charId = this.state.selectedCharacterId
                || this.state.character?.id
                || current.get('active_char');
            if (charId) {
                params.set('active_char', charId);
            }
        }
        const char = this.state.character;
        if (char) {
            if (!params.has('xp_lifetime')) {
                const life = char.xp_lifetime || char.xp_total;
                if (life) {
                    params.set('xp_lifetime', String(life));
                }
            }
            if (!params.has('xp_spent') && char.xp_spent != null) {
                params.set('xp_spent', String(char.xp_spent));
            }
            if (!params.has('ap_balance') && char.ap_balance != null) {
                params.set('ap_balance', String(char.ap_balance));
            }
            const poolToPipe = function (pool) {
                if (!pool || typeof pool !== 'object') {
                    return null;
                }
                const c = pool.current != null ? pool.current : (pool.base != null ? pool.base : 0);
                const b = pool.base != null ? pool.base : c;
                const m = pool.max != null ? pool.max : b;
                return c + '|' + b + '|' + m;
            };
            if (!params.has('health_pipe')) {
                const pipe = poolToPipe(char.health);
                if (pipe) {
                    params.set('health_pipe', pipe);
                }
            }
            if (!params.has('stamina_pipe')) {
                const pipe = poolToPipe(char.stamina);
                if (pipe) {
                    params.set('stamina_pipe', pipe);
                }
            }
            if (!params.has('mana_pipe')) {
                const pipe = poolToPipe(char.mana);
                if (pipe) {
                    params.set('mana_pipe', pipe);
                }
            }
        }

        const fullUrl = baseUrl + '?' + params.toString();
        link.href = fullUrl;
        link.style.display = 'inline-block';
    },
    
    /**
     * Open Setup HUD in external browser
     */
    openInBrowser() {
        const link = document.getElementById('open-in-browser-link');
        if (!link || !link.href) return;
        
        // Open in new window/tab
        window.open(link.href, '_blank', 'noopener,noreferrer');
    },
    
    /**
     * Update step guide panel with progress markers (UX 2)
     */
    getCreationSteps() {
        const char = this.state.character;
        const availablePoints = char ? window.getApBalance(char) : 0;
        return [
            { id: 'name', name: 'Name/Title', complete: !!(char && char.name && char.name.trim()) },
            { id: 'gender', name: 'Gender', complete: !!(char && char.gender) },
            { id: 'species', name: 'Species', complete: !!(char && char.species_id) },
            { id: 'stats', name: 'Stats', complete: !!(char && availablePoints === 0) },
            { id: 'career', name: 'Classes', complete: !!(char && char.class_id) }
        ];
    },

    isInCreationFlow() {
        const char = this.state.character;
        return !!(char && (this.state.creationInProgress || !char.id || this.state.isNewCharacter));
    },

    getCurrentCreationStepId(steps) {
        const list = steps || this.getCreationSteps();
        const firstOpen = list.findIndex(s => !s.complete);
        if (firstOpen === -1) {
            return list[list.length - 1].id;
        }
        return list[firstOpen].id;
    },

    validateCreationStep(stepId) {
        const char = this.state.character;
        if (!char) {
            return { ok: false, message: 'Start by creating a new character.' };
        }
        switch (stepId) {
            case 'name':
                if (!char.name || !char.name.trim()) {
                    return { ok: false, message: 'Please enter a character name.' };
                }
                return { ok: true };
            case 'gender':
                if (!char.gender) {
                    return { ok: false, message: 'Please select a gender — click a portrait below.' };
                }
                return { ok: true };
            case 'species':
                if (!char.species_id) {
                    return { ok: false, message: 'Please select a species — click a card below.' };
                }
                return { ok: true };
            case 'stats': {
                const pts = window.getApBalance(char);
                if (pts !== 0) {
                    return { ok: false, message: `You have ${pts} Available Point(s) left to spend (or buy more with XP).` };
                }
                return { ok: true };
            }
            case 'career':
                if (!char.class_id) {
                    return { ok: false, message: 'Please select a starting class.' };
                }
                return { ok: true };
            default:
                return { ok: true };
        }
    },

    updateCreationNavigation() {
        const hintEl = document.getElementById('creation-step-hint');
        const backBtn = document.getElementById('btn-creation-back');
        const nextBtn = document.getElementById('btn-creation-next');
        const inCreation = this.isInCreationFlow();

        document.querySelectorAll('.tab-step-hint').forEach(el => {
            el.style.display = 'none';
        });

        const stepGuidePanel = document.querySelector('.step-guide-panel');
        if (stepGuidePanel) {
            stepGuidePanel.classList.toggle('creation-active', inCreation);
        }
        if (backBtn) {
            backBtn.style.display = inCreation ? 'inline-block' : 'none';
        }
        if (nextBtn) {
            nextBtn.style.display = inCreation ? 'inline-block' : 'none';
        }

        if (!inCreation) {
            if (hintEl) hintEl.style.display = 'none';
            document.querySelectorAll('.step-item').forEach(item => item.classList.remove('step-item-current'));
            return;
        }

        const steps = this.getCreationSteps();
        const currentId = this.getCurrentCreationStepId(steps);
        const currentIndex = steps.findIndex(s => s.id === currentId);

        if (hintEl) {
            hintEl.style.display = 'block';
            hintEl.innerHTML = this.state.creationStepHints[currentId] || '';
        }

        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.toggle('step-item-current', item.dataset.step === currentId);
        });

        document.querySelectorAll(`.tab-step-hint[data-creation-step="${currentId}"]`).forEach(el => {
            el.style.display = 'block';
        });

        if (backBtn) {
            backBtn.disabled = currentIndex <= 0;
            backBtn.style.opacity = currentIndex <= 0 ? '0.5' : '1';
        }

        if (nextBtn) {
            const nextStep = steps[currentIndex + 1];
            if (currentIndex >= steps.length - 1 || steps.every(s => s.complete)) {
                nextBtn.textContent = 'Finish ✓';
            } else if (nextStep) {
                nextBtn.textContent = 'Next: ' + nextStep.name + ' »';
            } else {
                nextBtn.textContent = 'Next »';
            }
        }
    },

    async goToNextCreationStep() {
        const steps = this.getCreationSteps();
        const currentId = this.getCurrentCreationStepId(steps);
        const validation = this.validateCreationStep(currentId);
        if (!validation.ok) {
            UI.showToast(validation.message, 'warning');
            this.navigateToStep(currentId);
            return;
        }

        const saved = await this.saveCharacter({ draft: true, silent: true });
        if (saved === false) {
            return;
        }

        const currentIndex = steps.findIndex(s => s.id === currentId);

        if (currentIndex >= steps.length - 1) {
            for (let i = 0; i < steps.length; i++) {
                const stepCheck = this.validateCreationStep(steps[i].id);
                if (!stepCheck.ok) {
                    UI.showToast(stepCheck.message, 'warning');
                    this.navigateToStep(steps[i].id);
                    return;
                }
            }
            await this.saveCharacter({ draft: false });
            return;
        }

        const nextStep = steps[currentIndex + 1];
        this.navigateToStep(nextStep.id);
        this.updateStepGuide();
        UI.showToast('Now: ' + nextStep.name, 'info', 2000);
    },

    goToPrevCreationStep() {
        const steps = this.getCreationSteps();
        const currentId = this.getCurrentCreationStepId(steps);
        const currentIndex = steps.findIndex(s => s.id === currentId);
        if (currentIndex <= 0) {
            return;
        }
        const prevStep = steps[currentIndex - 1];
        this.navigateToStep(prevStep.id);
        this.updateStepGuide();
    },

    updateStepGuide() {
        const steps = this.getCreationSteps();
        
        steps.forEach((step, index) => {
            const stepItem = document.querySelector(`.step-item[data-step="${step.id}"]`);
            if (stepItem) {
                const marker = stepItem.querySelector('.step-marker');
                if (marker) {
                    const currentIndex = steps.findIndex(s => !s.complete);
                    const isCurrent = (currentIndex === -1 && index === steps.length - 1) || currentIndex === index;
                    
                    if (step.complete) {
                        marker.textContent = '✓';
                        marker.style.color = '#10b981';
                    } else if (isCurrent) {
                        marker.textContent = '●';
                        marker.style.color = '#3b82f6';
                    } else {
                        marker.textContent = '○';
                        marker.style.color = '#6b7280';
                    }
                }
                
                stepItem.style.cursor = 'pointer';
                stepItem.onclick = () => this.navigateToStep(step.id);
            }
        });

        this.updateCreationNavigation();
    },
    
    /**
     * Navigate to a specific step (UX 2)
     */
    navigateToStep(stepId) {
        const char = this.state.character;
        if (!char && stepId !== 'name') {
            return;
        }
        
        switch(stepId) {
            case 'name':
            case 'gender':
            case 'species':
                // Navigate to Character tab
                UI.switchTab('character');
                // Then scroll to the specific section
                if (stepId === 'name') {
                    document.getElementById('char-name')?.focus();
                } else if (stepId === 'gender') {
                    setTimeout(() => {
                        document.querySelector('#tab-character .gender-gallery')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                } else if (stepId === 'species') {
                    setTimeout(() => {
                        document.querySelector('#tab-character #species-gallery')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
                break;
            case 'stats':
                UI.switchTab('stats');
                break;
            case 'career':
                UI.switchTab('career');
                break;
        }
    },
    
    /**
     * Update status indicator and save button state (UX 2)
     */
    updateStatusIndicator() {
        const statusBadge = document.getElementById('character-status');
        const statusText = document.getElementById('status-text');
        const saveBtn = document.getElementById('btn-save-character');
        const inCreation = this.isInCreationFlow();
        
        if (!statusBadge || !statusText) return;
        
        if (!this.state.character) {
            statusText.textContent = 'No Character';
            statusBadge.style.background = 'rgba(107, 114, 128, 0.3)';
            statusBadge.style.color = '#9ca3af';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
                saveBtn.textContent = '💾 Save Character';
            }
        } else if (inCreation) {
            statusText.textContent = this.state.character.id ? 'Draft Saved' : 'Creating Character';
            statusBadge.style.background = 'rgba(59, 130, 246, 0.35)';
            statusBadge.style.color = '#93c5fd';
            statusBadge.style.border = '1px solid rgba(59, 130, 246, 0.5)';
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
                saveBtn.textContent = '💾 Save Progress';
            }
        } else if (this.state.dirty) {
            statusText.textContent = 'Unsaved Changes';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.3)';
            statusBadge.style.color = '#fca5a5';
            statusBadge.style.border = '1px solid rgba(239, 68, 68, 0.5)';
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
                saveBtn.textContent = '💾 Save Character';
            }
        } else {
            const autoMsg = this.state.lastAutoSaveMessage;
            statusText.textContent = autoMsg ? autoMsg : 'Saved';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.3)';
            statusBadge.style.color = '#6ee7b7';
            statusBadge.style.border = 'none';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
                saveBtn.title = autoMsg
                    ? 'This change was already saved automatically'
                    : 'No unsaved changes';
                saveBtn.textContent = '💾 Save Character';
            }
        }
    },
    
    /**
     * Show unsaved changes warning modal (UX 2)
     */
    async showUnsavedChangesModal() {
        return new Promise((resolve) => {
            const modalContent = `
                <h2>You have unsaved changes</h2>
                <p>Save to apply changes to your character. Unsaved changes will be lost if you leave.</p>
                <div style="display: flex; gap: var(--space-md); margin-top: var(--space-lg);">
                    <button class="action-btn primary" id="unsaved-save-btn">Save Changes</button>
                    <button class="action-btn secondary" id="unsaved-discard-btn">Discard Changes</button>
                    <button class="action-btn" id="unsaved-cancel-btn">Cancel</button>
                </div>
            `;
            
            UI.showModal('Unsaved Changes', modalContent);
            
            document.getElementById('unsaved-save-btn')?.addEventListener('click', async () => {
                await this.saveCharacter();
                UI.hideModal();
                resolve(true);
            }, { once: true });
            
            document.getElementById('unsaved-discard-btn')?.addEventListener('click', () => {
                this.discardChanges();
                UI.hideModal();
                resolve(true);
            }, { once: true });
            
            document.getElementById('unsaved-cancel-btn')?.addEventListener('click', () => {
                UI.hideModal();
                resolve(false);
            }, { once: true });
        });
    },
    
    /**
     * Discard unsaved changes (UX 2)
     */
    discardChanges() {
        this.state.dirty = false;
        if (this.state.selectedCharacterId) {
            this.loadData();
        }
        this.updateStatusIndicator();
    },
    
    /**
     * Handle delete character button click
     */
    async handleDeleteCharacter() {
        const selector = document.getElementById('character-selector');
        let selectedId = this.state.selectedCharacterId;
        if (selector && selector.value && selector.value !== '__create_new__' && selector.value !== '__temp__' && selector.value !== '') {
            selectedId = selector.value;
        }
        
        // Can't delete if no valid character selected
        if (!selectedId || selectedId === '__create_new__') {
            UI.showToast('No character selected to delete', 'warning');
            return;
        }
        
        // MOAP overlay confirm — never window.confirm (unsupported in SL CEF-139)
        let charName = 'this character';
        if (selector) {
            let i;
            for (i = 0; i < selector.options.length; i++) {
                if (selector.options[i].value === selectedId) {
                    charName = selector.options[i].textContent.trim();
                    break;
                }
            }
        } else if (this.state.character && this.state.character.id === selectedId && this.state.character.name) {
            charName = this.state.character.name;
        }
        const confirmed = await UI.showConfirmDialog({
            title: 'Delete character?',
            message: 'Delete "' + charName + '"?\n\nID: ' + selectedId + '\n\nThis cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true,
            allowBackdropCancel: false
        });
        if (!confirmed) {
            return;
        }
        
        try {
            UI.showToast('Deleting character...', 'info', 1000);
            
            const result = await API.deleteCharacter(selectedId);
            
            if (result.success) {
                UI.showToast('Character deleted successfully', 'success');
                
                // Clear state
                this.state.character = null;
                this.state.selectedCharacterId = null;
                this.state.isNewCharacter = true;
                if (API.activeCharacterId === selectedId) {
                    API.activeCharacterId = null;
                }
                try {
                    sessionStorage.removeItem(this.getActiveCharacterStorageKey());
                } catch (e) { /* ignore */ }
                
                // Reload data to refresh character list
                await this.loadData({ forceRefresh: true });
            } else {
                UI.showToast('Failed to delete character: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error deleting character:', error);
            UI.showToast('Error deleting character: ' + error.message, 'error');
        }
    },
    
    /**
     * Load character selector dropdown (UX 2: Updated for new structure)
     */
    async loadCharacterSelector(characters) {
        const self = this;
        const build = function() {
            self._buildCharacterSelector(self.dedupeCharactersById(characters || []));
        };
        this._loadCharacterSelectorQueue = this._loadCharacterSelectorQueue.then(build, build);
        return this._loadCharacterSelectorQueue;
    },

    _buildCharacterSelector(characters) {
        const selector = document.getElementById('character-selector');
        const noCharMessage = document.getElementById('no-character-message');
        if (!selector) return;
        
        this._clearSelectOptions(selector);
        
        const addedIds = {};
        // If no characters, add a disabled placeholder as the default selection
        if (characters.length === 0) {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '(No characters)';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            selector.appendChild(placeholderOption);
        }
        
        // Add "Create New Character" option
        const createOption = document.createElement('option');
        createOption.value = '__create_new__';
        createOption.textContent = '➕ Create New Character';
        selector.appendChild(createOption);
        
        // Group characters by universe
        const byUniverse = {};
        characters.forEach(char => {
            const universe = this._normalizeUniverseId(char.universe_id);
            if (!byUniverse[universe]) {
                byUniverse[universe] = [];
            }
            byUniverse[universe].push(char);
        });
        
        // Add characters grouped by universe
        Object.keys(byUniverse).sort().forEach(universe => {
            if (Object.keys(byUniverse).length > 1) {
                // Add universe group header
                const groupOption = document.createElement('option');
                groupOption.value = '';
                groupOption.textContent = `── ${universe} ──`;
                groupOption.disabled = true;
                selector.appendChild(groupOption);
            }
            
            byUniverse[universe].forEach(char => {
                const docId = this._getCharacterDocId(char);
                if (!docId || addedIds[docId]) {
                    return;
                }
                addedIds[docId] = true;
                const option = document.createElement('option');
                option.value = docId;
                option.textContent = char.name || 'Unnamed';
                if (docId === this.state.selectedCharacterId) {
                    option.selected = true;
                } else if (!this.state.selectedCharacterId && characters.indexOf(char) === 0) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });
        });
        
        // Show/hide "no character" message and hero callout
        const noCharHero = document.getElementById('no-character-hero');
        if (noCharMessage) {
            noCharMessage.style.display = characters.length === 0 ? 'block' : 'none';
        }
        if (noCharHero) {
            noCharHero.style.display = characters.length === 0 ? 'block' : 'none';
        }
        
        selector.style.display = 'block'; // Always show in new design
        
        // Show/hide delete button based on selection
        this.updateDeleteButtonVisibility();
        
        // Update status indicator after selector is populated
        if (characters.length > 0) {
            // Status will be updated when character actually loads
            // But if we have characters, status shouldn't say "No Character"
            if (!this.state.character && this.state.selectedCharacterId) {
                // We have a selected ID but character not loaded yet - that's OK
            }
        }
    },
    
    /**
     * Update delete button visibility based on selected character
     */
    updateDeleteButtonVisibility() {
        const deleteBtn = document.getElementById('btn-delete-character');
        const selectedId = this.state.selectedCharacterId;
        
        if (deleteBtn) {
            // Show button only if a real character is selected (not __create_new__ or empty)
            if (selectedId && selectedId !== '__create_new__') {
                deleteBtn.style.display = 'block';
            } else {
                deleteBtn.style.display = 'none';
            }
        }
    },
    
    /**
     * Load available universes for character creation
     */
    async loadAvailableUniverses() {
        try {
            const result = await API.listAvailableUniverses();
            if (result.success) {
                const select = document.getElementById('char-universe');
                if (select) {
                    select.innerHTML = '';
                    result.data.universes.forEach(universe => {
                        const option = document.createElement('option');
                        option.value = universe.id;
                        option.textContent = universe.name;
                        option.dataset.requiresCode = (universe.registrationCode && universe.registrationCode.trim() !== '') ? 'true' : 'false';
                        if (universe.id === this.state.selectedUniverseId || (universe.id === 'default' && !this.state.selectedUniverseId)) {
                            option.selected = true;
                            this.state.selectedUniverseId = universe.id;
                        }
                        select.appendChild(option);
                    });
                    
                    // Add change listener if not already added
                    if (!select.hasAttribute('data-listener-added')) {
                        select.setAttribute('data-listener-added', 'true');
                        select.onchange = async (e) => {
                            const newUniverseId = e.target.value;
                            this.state.selectedUniverseId = newUniverseId;
                            if (this.state.character) {
                                this.state.character.universe_id = newUniverseId;
                            }
                            const selectedOption = e.target.options[e.target.selectedIndex];
                            const requiresCode = selectedOption.dataset.requiresCode === 'true';
                            const registrationGroup = document.getElementById('universe-registration-group');
                            const registrationInput = document.getElementById('universe-registration-code');
                            if (registrationGroup) {
                                registrationGroup.style.display = requiresCode ? 'block' : 'none';
                                if (registrationInput && !requiresCode) {
                                    registrationInput.value = '';
                                }
                            }
                            const universeResult = await API.getUniverse(newUniverseId);
                            if (universeResult.success) {
                                this.state.currentUniverse = universeResult.data.universe;
                            }
                            await this.applyUniverseIdentityDefaults({ force: true });
                            await this.renderAll();
                        };
                    }
                    
                    // Trigger initial check for registration code requirement
                    if (select.value) {
                        const selectedOption = select.options[select.selectedIndex];
                        const requiresCode = selectedOption.dataset.requiresCode === 'true';
                        const registrationGroup = document.getElementById('universe-registration-group');
                        if (registrationGroup) {
                            registrationGroup.style.display = requiresCode ? 'block' : 'none';
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load universes:', error);
        }
    },
    
    /**
     * Update character selector with temporary "New Character (unsaved)" option
     */
    updateCharacterSelectorWithTemp() {
        const selector = document.getElementById('character-selector');
        if (!selector) return;
        
        // Remove any existing temp option first
        const existingTemp = selector.querySelector('option[value="__temp__"]');
        if (existingTemp) {
            existingTemp.remove();
        }
        
        // Add temp option at the top (after "Create New" option)
        const tempOption = document.createElement('option');
        tempOption.value = '__temp__';
        tempOption.textContent = '✏️ New Character (unsaved)';
        tempOption.selected = true;
        
        // Insert after "Create New" option (which should be first)
        if (selector.children.length > 0) {
            // Insert after first option
            if (selector.children.length > 1) {
                selector.insertBefore(tempOption, selector.children[1]);
            } else {
                selector.appendChild(tempOption);
            }
        } else {
            selector.appendChild(tempOption);
        }
    },
    
    /**
     * Auto-create a playable starter character for first-time players (default universe).
     * Returns true when a new Firestore character was created and synced to the HUD.
     */
    async ensureStarterCharacter() {
        if (this._starterProvisionPromise) {
            return this._starterProvisionPromise;
        }
        if (this._starterProvisionAttempted) {
            return false;
        }

        this._starterProvisionPromise = this._ensureStarterCharacterInternal();
        try {
            return await this._starterProvisionPromise;
        } finally {
            this._starterProvisionPromise = null;
        }
    },

    async _ensureStarterCharacterInternal() {
        this._starterProvisionAttempted = true;

        if (!API.uuid || API.uuid.trim() === '') {
            return false;
        }

        const universeId = 'default';
        this.state.selectedUniverseId = universeId;

        try {
            const universeResult = await API.getUniverse(universeId);
            if (!universeResult.success || !universeResult.data || !universeResult.data.universe) {
                console.warn('[Starter] Default universe unavailable — manual creation required');
                return false;
            }
            const universe = universeResult.data.universe;
            if (universe.registrationCode && universe.registrationCode.trim() !== '') {
                console.warn('[Starter] Default universe requires registration code — skipping auto-provision');
                return false;
            }

            const limitCheck = await API.validateCharacterLimit(universeId, API.uuid);
            if (!limitCheck.success || !limitCheck.data || !limitCheck.data.allowed) {
                console.warn('[Starter] Character limit reached — manual creation required');
                return false;
            }

            const template = this.createDefaultCharacter();
            let starterName = (API.displayName || this.lsl.displayName || '').trim();
            if (!starterName) {
                starterName = 'Traveler';
            }

            const species = this.state.species.find(function (s) { return s.id === 'human'; }) || {
                health_factor: 25,
                stamina_factor: 25,
                mana_factor: 25,
                mana_chance: 10
            };
            const stats = template.stats || this.getDefaultStats();
            const hasMana = false;
            const baseHealth = this.calculateHealth(stats, species);
            const baseStamina = this.calculateStamina(stats, species);
            const baseMana = this.calculateMana(stats, species, hasMana);

            console.log('[Starter] Auto-provisioning character for', API.uuid, 'name:', starterName);

            const result = await API.createCharacter({
                name: starterName,
                title: '',
                gender: 'other',
                species_id: 'human',
                class_id: null,
                universe_id: universeId,
                has_mana: hasMana,
                health: { current: baseHealth, base: baseHealth, max: baseHealth },
                stamina: { current: baseStamina, base: baseStamina, max: baseStamina },
                mana: { current: baseMana, base: baseMana, max: baseMana },
                stats: stats,
                mode: 'roleplay',
                provisional: true
            });

            if (!result || !result.success || !result.data || !result.data.character) {
                console.error('[Starter] createCharacter failed:', result && result.error);
                return false;
            }

            const character = result.data.character;
            this.state.character = character;
            this.state.selectedCharacterId = character.id;
            this.state.isNewCharacter = false;
            this.state.creationInProgress = false;
            this.state.currentUniverse = universe;
            this.recalculateResourcePools();

            if (API.setActiveCharacter) {
                await API.setActiveCharacter(character.id);
            }

            this._pendingAutoHideSetup = true;
            await this.pushCharacterToPlayersHUD(character.id);
            this.scheduleBroadcastToPlayersHUD(character);

            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast(
                    'Welcome! A starter character was created so you can play right away. Open Setup anytime to change name, species, and class.',
                    'success',
                    10000
                );
            }

            console.log('[Starter] Provisioned character', character.id);
            return true;
        } catch (error) {
            console.error('[Starter] ensureStarterCharacter error:', error);
            return false;
        }
    },

    /**
     * Create a default character template for new characters
     */
    createDefaultCharacter() {
        const defaultStats = this.getNewCharacterStats();
        const species = this.state.species.find(s => s.id === 'human') || { 
            health_factor: 25, 
            stamina_factor: 25, 
            mana_factor: 25,
            mana_chance: 10 
        };
        
        // Roll for mana based on species chance
        const hasMana = false;
        
        // Calculate base resource pools from stats with species factors
        const baseHealth = this.calculateHealth(defaultStats, species);
        const baseStamina = this.calculateStamina(defaultStats, species);
        const baseMana = this.calculateMana(defaultStats, species, hasMana);
        
        return {
            name: '',
            title: '',
            gender: null,
            species_id: null,
            class_id: null,
            currency: 50,
            ap_balance: 0,
            xp_lifetime: 0,
            xp_spent: 0,
            stats: defaultStats,
            // Store species factors for LSL calculations
            species_factors: {
                health_factor: species.health_factor || 25,
                stamina_factor: species.stamina_factor || 25,
                mana_factor: species.mana_factor || 25
            },
            has_mana: hasMana,  // Store whether character has mana
            health: {
                current: baseHealth,
                base: baseHealth,
                max: baseHealth
            },
            stamina: {
                current: baseStamina,
                base: baseStamina,
                max: baseStamina
            },
            mana: {
                current: baseMana,
                base: baseMana,
                max: baseMana
            },
            action_slots: [] // Array of readied items/spells/buffs
        };
    },
    
    /**
     * Calculate Health from stats and species
     * Formula: (Agility + Athletics) × health_factor
     */
    calculateHealth(stats, species = null) {
        if (!stats) return 100;
        const agility = stats.agility || 2;
        const athletics = stats.athletics || 2;
        const factor = species?.health_factor || 25;
        return (agility + athletics) * factor;
    },
    
    /**
     * Calculate Stamina from stats and species
     * Formula: (Endurance + Will) × stamina_factor
     */
    calculateStamina(stats, species = null) {
        if (!stats) return 100;
        const endurance = stats.endurance || 2;
        const will = stats.will || 2;
        const factor = species?.stamina_factor || 25;
        return (endurance + will) * factor;
    },
    
    /**
     * Calculate Mana from stats and species (only if character has mana)
     * Formula: (Wisdom + Intelligence) × mana_factor
     * Returns 0 if character doesn't have mana
     */
    calculateMana(stats, species = null, hasMana = true) {
        if (!stats || !hasMana) return 0;
        const wisdom = stats.wisdom || 2;
        const intelligence = stats.intelligence || 2;
        const factor = species?.mana_factor || 25;
        return (wisdom + intelligence) * factor;
    },
    
    /**
     * Determine if character has mana based on species chance
     * @param {object} species - Species data with mana_chance
     * @returns {boolean} - True if character has mana
     */
    rollManaChance(species) {
        if (!species) return false;
        const chance = species.mana_chance || 0;
        if (chance >= 100) return true;
        if (chance <= 0) return false;
        return Math.random() * 100 < chance;
    },
    
    /**
     * New character stats — all start at 1 (XP economy v2).
     */
    getNewCharacterStats() {
        const statNames = (typeof F4_SEED_DATA !== 'undefined' && F4_SEED_DATA.statNames)
            ? F4_SEED_DATA.statNames
            : [
                'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
                'deception', 'endurance', 'entertaining', 'fighting', 'healing',
                'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
                'stealth', 'survival', 'thievery', 'will', 'wisdom'
            ];
        const stats = {};
        statNames.forEach(function (stat) {
            stats[stat] = 1;
        });
        return stats;
    },

    /**
     * Get default stats object (legacy templates / display — still 2 for species defaults).
     */
    getDefaultStats() {
        // Use F3 stat names from seed data if available
        if (typeof F4_SEED_DATA !== 'undefined') {
            return F4_SEED_DATA.getDefaultStats();
        }
        // Fallback
        const statNames = [
            'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
            'deception', 'endurance', 'entertaining', 'fighting', 'healing',
            'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
            'stealth', 'survival', 'thievery', 'will', 'wisdom'
        ];
        const stats = {};
        statNames.forEach(stat => stats[stat] = 2);
        return stats;
    },
    
    /**
     * Universe ID used for creation filtering (dropdown wins for unsaved drafts).
     */
    getActiveUniverseId() {
        const char = this.state.character;
        if (this.state.isNewCharacter && char && !char.id) {
            return this.state.selectedUniverseId || char.universe_id || null;
        }
        if (char?.universe_id) {
            return char.universe_id;
        }
        if (this.state.isNewCharacter && this.state.selectedUniverseId) {
            return this.state.selectedUniverseId;
        }
        return null;
    },

    /**
     * Load filtered identity options for the active universe.
     */
    async getFilteredIdentityForCreation() {
        const universeId = this.getActiveUniverseId();
        if (!universeId) {
            return {
                universeId: null,
                genders: [],
                species: [],
                classes: []
            };
        }
        const result = await API.getFilteredIdentityOptions(universeId);
        if (result.success) {
            return {
                universeId,
                genders: result.data.genders,
                species: result.data.species,
                classes: result.data.classes,
                enforceClassStatMinimums: result.data.enforceClassStatMinimums !== false
            };
        }
        return {
            universeId,
            genders: this.state.genders,
            species: this.state.species,
            classes: this.state.classes,
            enforceClassStatMinimums: API.enforceClassStatMinimums(this.state.currentUniverse)
        };
    },

    /**
     * Pick a sensible default class from an allowed list (beginner, non-arcane if no mana).
     */
    pickDefaultClassId(classes, character) {
        if (!classes || classes.length === 0) {
            return null;
        }
        const manaRequiredClasses = [
            'cleric', 'cultist', 'druid', 'enchanter', 'footwizard', 'hedgemage',
            'mage', 'necromancer', 'priest', 'seer', 'shadowmage', 'shaman',
            'sorcerer', 'spellmonger', 'spellsinger', 'thaumaturge', 'warlock', 'warmage',
            'witch', 'wizard'
        ];
        const hasMana = character?.has_mana === true;
        const enforceStatMins = this.state.enforceClassStatMinimums !== false;
        const allClasses = classes;
        const classOptions = {
            enforceStatMinimums: enforceStatMins,
            universe: this.state.currentUniverse
        };
        const beginner = classes.filter(cls => {
            if (manaRequiredClasses.includes(cls.id) && !hasMana) {
                return false;
            }
            const prerequisites = cls.prerequisites || (cls.prerequisite ? [cls.prerequisite] : []);
            if (prerequisites.length !== 0) {
                return false;
            }
            if (character && typeof API !== 'undefined' && API.canChangeToClass) {
                return API.canChangeToClass(character, cls, allClasses, classOptions).canChange;
            }
            return true;
        });
        if (beginner.length > 0) {
            return beginner[0].id;
        }
        return classes[0].id;
    },

    /**
     * Apply species-derived fields after species change.
     */
    applySpeciesToCharacter(char, species) {
        if (!char || !species) {
            return;
        }
        const manaEnabled = this.state.currentUniverse?.manaEnabled !== false;
        const speciesCanUseMagic = manaEnabled && ((species.mana || 0) > 0 || (species.mana_chance || 0) > 0);
        if (!speciesCanUseMagic) {
            char.has_mana = false;
        } else if (char.has_mana !== true) {
            char.has_mana = false;
        }
        char.species_factors = {
            health_factor: species.health_factor || 25,
            stamina_factor: species.stamina_factor || 25,
            mana_factor: species.mana_factor || 25
        };
        this.recalculateResourcePools();
    },

    /**
     * Ensure gender/species/class are allowed for the active universe.
     */
    async applyUniverseIdentityDefaults(options = {}) {
        const { force = false, filtered = null } = options;
        const char = this.state.character;
        if (!char) {
            return false;
        }

        let genders;
        let species;
        let classes;
        if (filtered) {
            genders = filtered.genders;
            species = filtered.species;
            classes = filtered.classes;
        } else {
            const result = await this.getFilteredIdentityForCreation();
            genders = result.genders;
            species = result.species;
            classes = result.classes;
        }

        let changed = false;

        if (genders.length > 0 && char.gender && (force || !genders.some(g => g.id === char.gender))) {
            char.gender = genders[0].id;
            changed = true;
        }

        if (species.length > 0 && char.species_id && (force || !species.some(s => s.id === char.species_id))) {
            char.species_id = species[0].id;
            this.applySpeciesToCharacter(char, species[0]);
            changed = true;
        }

        if (classes.length > 0 && char.class_id && (force || !classes.some(c => c.id === char.class_id))) {
            char.class_id = this.pickDefaultClassId(classes, char) || classes[0].id;
            changed = true;
        }

        if (char.universe_id !== this.getActiveUniverseId() && this.getActiveUniverseId()) {
            char.universe_id = this.getActiveUniverseId();
            changed = true;
        }

        return changed;
    },

    /**
     * Update the universe restriction notice on the Character tab.
     */
    updateUniverseFilterNotice(filteredGenders, filteredSpecies, filteredClasses) {
        const noticeEl = document.getElementById('universe-filter-notice');
        if (!noticeEl) {
            return;
        }
        const universe = this.state.currentUniverse;
        const universeName = universe?.name || this.getActiveUniverseId() || 'this universe';
        const totalG = this.state.genders.length;
        const totalS = this.state.species.length;
        const totalC = this.state.classes.length;
        const restricted = (
            (totalG > 0 && filteredGenders.length < totalG) ||
            (totalS > 0 && filteredSpecies.length < totalS) ||
            (totalC > 0 && filteredClasses.length < totalC)
        );
        if (restricted) {
            noticeEl.textContent =
                `Showing options allowed in ${universeName} ` +
                `(${filteredGenders.length} genders, ${filteredSpecies.length} species, ${filteredClasses.length} classes). ` +
                'Change universe below to see a different set.';
        } else {
            noticeEl.textContent =
                `All identity options are available in ${universeName}. Change universe below if you meant to join a different world.`;
        }
    },

    /**
     * Render all UI components
     */
    async renderAll() {
        DebugLog.log('renderAll() called', 'debug');
        DebugLog.log(`State: ${this.state.species.length} species, ${this.state.classes.length} classes, ${this.state.genders.length} genders`, 'debug');
        const char = this.state.character;
        
        // UX 2: Update status indicator and step guide
        this.updateStatusIndicator();
        this.updateStepGuide();
        
        // UX 2: Show/hide no character message, hero panel, and step guide panel
        const noCharMessage = document.getElementById('no-character-message');
        const noCharHero = document.getElementById('no-character-hero');
        const stepGuidePanel = document.querySelector('.step-guide-panel');
        
        if (char) {
            // Has character (new or existing) - show step guide, hide "no character" message and hero
            if (noCharMessage) noCharMessage.style.display = 'none';
            if (noCharHero) noCharHero.style.display = 'none';
            if (stepGuidePanel) stepGuidePanel.style.display = 'block';
        } else {
            // No character - show "no character" message and hero, hide step guide
            if (noCharMessage) noCharMessage.style.display = 'block';
            if (noCharHero) noCharHero.style.display = 'block';
            if (stepGuidePanel) stepGuidePanel.style.display = 'none';
        }
        
        // Show/hide new character banner
        const newCharBanner = document.getElementById('new-character-banner');
        if (newCharBanner) {
            // Show banner if no character exists in Firestore (isNewCharacter is true)
            // This means the character hasn't been saved yet
            const shouldShow = this.state.isNewCharacter;
            newCharBanner.style.display = shouldShow ? 'block' : 'none';
        }
        
        // Show/hide universe selection (only for new unsaved characters)
        const universeGroup = document.getElementById('universe-selection-group');
        const identitySection = document.getElementById('character-identity-section');
        const identityReady = !!char;
        const identityGateMessage =
            'Click Create New Character and choose a universe to begin identity selection.';

        if (identitySection) {
            identitySection.style.display = identityReady ? 'block' : 'none';
        }

        if (universeGroup) {
            const showUniverse = identityReady && this.state.isNewCharacter && !char?.id;
            universeGroup.style.display = showUniverse ? 'block' : 'none';
            if (showUniverse) {
                await this.loadAvailableUniverses();
            }
        }
        
        // Filter identity options by universe (only after creation draft exists)
        let filteredGenders = [];
        let filteredSpecies = [];
        let filteredClasses = [];
        const universeManaEnabled = this.state.currentUniverse?.manaEnabled !== false;

        if (identityReady) {
            const universeId = this.getActiveUniverseId();
            if (universeId) {
                if (!this.state.currentUniverse || this.state.currentUniverse.id !== universeId) {
                    const universeResult = await API.getUniverse(universeId);
                    if (universeResult.success) {
                        this.state.currentUniverse = universeResult.data.universe;
                    }
                }
                const filteredResult = await API.getFilteredIdentityOptions(universeId);
                if (filteredResult.success) {
                    filteredGenders = filteredResult.data.genders;
                    filteredSpecies = filteredResult.data.species;
                    filteredClasses = filteredResult.data.classes;
                    this.state.enforceClassStatMinimums = filteredResult.data.enforceClassStatMinimums !== false;
                } else {
                    filteredGenders = this.state.genders;
                    filteredSpecies = this.state.species;
                    filteredClasses = this.state.classes;
                }
            } else {
                filteredGenders = this.state.genders;
                filteredSpecies = this.state.species;
                filteredClasses = this.state.classes;
            }

            await this.applyUniverseIdentityDefaults({
                force: false,
                filtered: {
                    genders: filteredGenders,
                    species: filteredSpecies,
                    classes: filteredClasses
                }
            });

            if (this.state.isNewCharacter && !char.id) {
                this.updateUniverseFilterNotice(filteredGenders, filteredSpecies, filteredClasses);
            } else {
                const noticeEl = document.getElementById('universe-filter-notice');
                if (noticeEl) {
                    noticeEl.textContent = '';
                }
            }
        }
        this.state.filteredClasses = filteredClasses;

        // Look up selections from filtered lists first (summary matches visible options)
        this.state.currentSpecies = filteredSpecies.find(s => s.id === char?.species_id)
            || this.state.species.find(s => s.id === char?.species_id)
            || null;
        this.state.currentClass = filteredClasses.find(c => c.id === char?.class_id)
            || this.state.classes.find(c => c.id === char?.class_id)
            || null;
        this.state.currentVocation = this.state.currentClass ?
            this.state.vocations.find(v => v.id === this.state.currentClass.vocation_id) : null;
        
        // Render gender selection
        DebugLog.log(`Rendering gender selection with ${filteredGenders.length} genders`, 'debug');
        UI.renderGenderSelection(
            identityReady ? filteredGenders : [],
            char?.gender,
            identityReady ? undefined : identityGateMessage
        );
        
        // Render species gallery
        DebugLog.log(`Rendering species gallery with ${filteredSpecies.length} species`, 'debug');
        UI.renderSpeciesGallery(
            identityReady ? filteredSpecies : [],
            char?.species_id,
            universeManaEnabled,
            identityReady ? undefined : identityGateMessage
        );
        
        // Render career gallery
        DebugLog.log(`Rendering career gallery with ${filteredClasses.length} classes`, 'debug');
        const activeClassId = char?.class_id || this.state.currentClass?.id || null;
        UI.renderCareerGallery(
            identityReady ? filteredClasses : [],
            activeClassId,
            char,
            identityReady ? undefined : identityGateMessage
        );
        
        // Render current career with career path
        UI.renderCurrentCareer(this.state.currentClass, this.state.currentVocation, char);
        
        // Get current stats (don't override on every render - that was wiping manual changes)
        let stats = char?.stats || this.getDefaultStats();
        
        // Get stat caps (minimum of species and class caps)
        const caps = this.calculateStatCaps();
        
        // Calculate available points using the F3-style exponential system
        const availablePoints = char ? window.getApBalance(char) : 0;
        
        // Render stats grid with points
        UI.renderStatsGrid(stats, caps, availablePoints, this.state.statsFloor || {});
        
        // Render vocation
        UI.renderVocation(this.state.currentVocation, stats);
        
        // Recalculate pools, then overlay HUD KVP gameplay values before summary/bars
        if (char) {
            this.recalculateResourcePools();
            this.mergePoolsFromUrl();
        }
        
        // Render character summary
        await UI.renderCharacterSummary(char, this.state.currentSpecies, this.state.currentClass);
        this.updateMagicOptInPanel();
        
        // Render Players HUD (resource bars, XP progress, and action slots)
        UI.renderResourceBars(char);
        UI.renderXPProgress(char);
        UI.renderActionSlots(char);
        
        // Update active mode button in Options tab
        const currentMode = char?.mode || 'roleplay';
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
    },
    
    /**
     * Load and display active buffs
     */
    async loadBuffs() {
        if (!API.uuid) {
            return;
        }
        
        try {
            const result = await API.getActiveBuffs(API.uuid);
            if (result.success) {
                UI.renderBuffs(result.data.buffs || []);
            }
        } catch (error) {
            console.error('[loadBuffs] Error:', error);
        }
    },
    
    /**
     * Set up real-time listener for buffs
     */
    setupBuffsListener() {
        // Unsubscribe from previous listener if exists
        if (this.buffsUnsubscribe) {
            this.buffsUnsubscribe();
            this.buffsUnsubscribe = null;
        }
        
        if (!API.uuid) {
            return;
        }
        
        this.buffsUnsubscribe = API.subscribeToActiveBuffs(
            API.uuid,
            (result) => {
                if (result.success) {
                    UI.renderBuffs(result.data.buffs || []);
                }
            }
        );
    },
    
    /**
     * Calculate combined stat caps from species and class
     */
    calculateStatCaps() {
        const caps = {};
        const statNames = Object.keys(this.getDefaultStats());
        const char = this.state.character;
        const noClass = !char || !char.class_id;

        statNames.forEach(stat => {
            if (noClass) {
                caps[stat] = 2;
                return;
            }
            const speciesCap = this.state.currentSpecies?.stat_caps?.[stat] || 9;
            const classCap = this.state.currentClass?.stat_maximums?.[stat] || 9;
            caps[stat] = Math.min(speciesCap, classCap);
        });

        return caps;
    },

    /**
     * Snapshot saved stat values for this session — decreases cannot go below this floor until Save.
     */
    captureStatsFloor(char) {
        if (!char) {
            this.state.statsFloor = null;
            return;
        }
        const merged = window.getMergedCharacterStatsForPoints(char);
        this.state.statsFloor = Object.assign({}, merged.stats);
    },

    getMoapDraftStorageKey(characterId) {
        return 'f4_moap_draft_' + (characterId || '');
    },

    /**
     * Preserve unsaved stats + AP across MOAP full-page reloads (pushEconToHud / stats_csv sync).
     */
    persistMoapSessionDraft(forcePersist) {
        const char = this.state.character;
        if (!char || !char.id || !char.stats) {
            return;
        }
        if (!forcePersist && !this.state.dirty && !this.state.econSessionActive) {
            return;
        }
        try {
            const payload = {
                stats: Object.assign({}, char.stats),
                ap_balance: window.getApBalance(char),
                xp_spent: window.getEconSpent(char),
                xp_lifetime: window.getEconLifetime(char),
                updated: Date.now()
            };
            sessionStorage.setItem(this.getMoapDraftStorageKey(char.id), JSON.stringify(payload));
        } catch (e) { /* ignore */ }
    },

    restoreMoapSessionDraft() {
        const char = this.state.character;
        if (!char || !char.id) {
            return false;
        }
        try {
            const raw = sessionStorage.getItem(this.getMoapDraftStorageKey(char.id));
            if (!raw) {
                return false;
            }
            const draft = JSON.parse(raw);
            if (!draft || !draft.stats) {
                return false;
            }
            char.stats = Object.assign({}, draft.stats);
            if (draft.ap_balance != null) {
                char.ap_balance = draft.ap_balance;
            }
            if (draft.xp_spent != null) {
                char.xp_spent = draft.xp_spent;
            }
            if (draft.xp_lifetime != null) {
                char.xp_lifetime = draft.xp_lifetime;
            }
            if (typeof App.state.econ === 'undefined' || !App.state.econ) {
                App.state.econ = {};
            }
            App.state.econ.ap_balance = char.ap_balance;
            App.state.econ.xp_spent = char.xp_spent;
            App.state.econ.xp_lifetime = char.xp_lifetime;
            App.state.econSessionActive = true;
            window.updateEconUrlParams(char.xp_spent, char.ap_balance);
            return true;
        } catch (e) {
            return false;
        }
    },

    clearMoapSessionDraft(characterId) {
        const id = characterId || (this.state.character && this.state.character.id);
        if (!id) {
            return;
        }
        try {
            sessionStorage.removeItem(this.getMoapDraftStorageKey(id));
        } catch (e) { /* ignore */ }
    },
    
    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        if (this._eventHandlersBound) {
            return;
        }
        this._eventHandlersBound = true;
        // Character name/title — do not call renderAll() on each keystroke (breaks MOAP text input)
        UI.elements.charName?.addEventListener('input', (e) => {
            this.onCharacterTextFieldInput('name', e.target.value);
        });
        
        UI.elements.charTitle?.addEventListener('input', (e) => {
            this.onCharacterTextFieldInput('title', e.target.value);
        });

        const registrationInput = document.getElementById('universe-registration-code');
        registrationInput?.addEventListener('input', (e) => {
            this.state.pendingRegistrationCode = e.target.value;
            this.state.dirty = true;
            this.updateStatusIndicator();
        });
        
        // Save button (draft while creating; full save when editing existing)
        UI.elements.btnSave?.addEventListener('click', () => {
            const draft = this.isInCreationFlow();
            this.saveCharacter({ draft: draft });
        });

        document.getElementById('btn-creation-next')?.addEventListener('click', () => this.goToNextCreationStep());
        document.getElementById('btn-creation-back')?.addEventListener('click', () => this.goToPrevCreationStep());

        document.getElementById('char-has-mana')?.addEventListener('change', (e) => {
            this.handleMagicOptInToggle(e.target.checked);
        });

        let buyQty = 1;
        const buyQtyEl = document.getElementById('buy-points-qty');
        const refreshBuyCost = function () {
            const costEl = document.getElementById('buy-points-cost');
            if (costEl && buyQtyEl) {
                costEl.textContent = '(' + (buyQty * (window.XP_PER_AP || 1000)).toLocaleString() + ' XP)';
                buyQtyEl.textContent = String(buyQty);
            }
        };
        document.getElementById('buy-points-minus')?.addEventListener('click', function () {
            if (buyQty > 1) {
                buyQty -= 1;
                refreshBuyCost();
            }
        });
        document.getElementById('buy-points-plus')?.addEventListener('click', function () {
            buyQty += 1;
            refreshBuyCost();
        });
        document.getElementById('buy-points-ok')?.addEventListener('click', function () {
            if (window.buyPointsWithXp && window.buyPointsWithXp(buyQty)) {
                // pushEconToHud navigates — page reloads; do not renderAll here
            }
        });
        refreshBuyCost();
        
        // Challenge Test button (renamed from "Roll")
        UI.elements.btnRoll?.addEventListener('click', () => this.showChallengeTestDialog());
        
        // Refresh button
        UI.elements.btnRefresh?.addEventListener('click', () => this.loadData());
        
        UI.elements.btnAddActionSlot?.addEventListener('click', () => {
            // Find first empty slot
            const slots = this.state.character?.action_slots || [];
            let emptyIndex = slots.findIndex(s => !s);
            if (emptyIndex === -1) emptyIndex = slots.length;
            if (emptyIndex >= 12) {
                UI.showToast('Maximum 12 action slots', 'warning');
                return;
            }
            UI.showAddActionSlotDialog(emptyIndex);
        });
        
        // Admin buttons
        document.querySelectorAll('.admin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.showAdminPanel(e.target.dataset.admin);
            });
        });
        
        // New Character button in navigation bar
        document.getElementById('btn-new-character-nav')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
        });
        
        // Hero callout "Create New Character" button
        document.getElementById('btn-create-new-hero')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
        });
        
        // New Character link in banner
        document.getElementById('new-character-link')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
        });
        
        // Open in Browser link - use click handler for MOAP browser compatibility
        document.getElementById('open-in-browser-link')?.addEventListener('click', (e) => {
            const link = e.currentTarget;
            if (link && link.href && link.href !== '#' && link.href !== window.location.href) {
                // Try window.open first (works in regular browsers)
                const newWindow = window.open(link.href, '_blank', 'noopener,noreferrer');
                // If window.open was blocked or failed, fall back to navigating
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    // For MOAP browsers that don't support window.open, try direct navigation
                    // This will at least show the URL so user can copy it
                    console.log('window.open failed, URL is:', link.href);
                    // In MOAP, we might need to use llOpenURL via secondlife:// protocol
                    // But for now, just prevent default and show the URL
                    e.preventDefault();
                    // Show the URL in an alert or copy to clipboard if possible
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(link.href).then(() => {
                            UI.showToast('URL copied to clipboard! Paste it in your browser.', 'info', 3000);
                        }).catch(() => {
                            UI.showToast('URL: ' + link.href, 'info', 5000);
                        });
                    } else {
                        UI.showToast('URL: ' + link.href, 'info', 5000);
                    }
                } else {
                    e.preventDefault(); // Prevent default navigation since window.open worked
                }
            } else {
                e.preventDefault();
                UI.showToast('Link not ready yet', 'warning');
            }
        });
        
        // New Character button (old location - keep for compatibility)
        document.getElementById('btn-new-character')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
        });
        
        // Options tab buttons
        document.getElementById('btn-new-character-options')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
        });
        
        // Character selector dropdown (UX 2: Updated for new structure)
        // Delete character button
        document.getElementById('btn-delete-character')?.addEventListener('click', async () => {
            await this.handleDeleteCharacter();
        });
        
        document.getElementById('character-selector')?.addEventListener('change', async (e) => {
            const value = e.target.value;
            if (value === '__create_new__') {
                // Handle "Create New Character" option
                await this.showNewCharacterDialog();
                // Reset selector to temp character if it was created, or back to current/placeholder
                const tempOption = e.target.querySelector('option[value="__temp__"]');
                if (tempOption) {
                    e.target.value = '__temp__';
                } else if (this.state.selectedCharacterId) {
                    e.target.value = this.state.selectedCharacterId;
                } else {
                    // Reset to placeholder (empty string)
                    e.target.selectedIndex = 0;
                }
            } else if (value === '__temp__') {
                // User selected the temp character again - do nothing
                return;
            } else if (value) {
                // If switching away from unsaved temp character, discard it without warning
                if (this.state.isNewCharacter && !this.state.character?.id) {
                    this.state.isNewCharacter = false;
                    this.state.character = null;
                    this.state.dirty = false;
                    // Remove temp option from selector
                    const tempOption = e.target.querySelector('option[value="__temp__"]');
                    if (tempOption) tempOption.remove();
                }
                // Handle character selection - check for unsaved changes
                else if (this.state.dirty) {
                    const shouldProceed = await this.showUnsavedChangesModal();
                    if (!shouldProceed) {
                        // Reset selector
                        e.target.value = this.state.selectedCharacterId || '__temp__';
                        return;
                    }
                }
                await this.rememberSelectedCharacter(value);
                this.state.dirty = false;
                await this.loadData();
                if (this.state.character && this.state.character.id === value) {
                    await this.pushCharacterToPlayersHUD(value);
                }
                this.updateStepGuide();
                this.updateDeleteButtonVisibility();
            }
        });
        
        document.getElementById('btn-edit-character-options')?.addEventListener('click', () => {
            // Switch to Character tab
            UI.switchTab('character');
        });
        
        // Game mode changes: use rp_heart on the Players HUD (not MOAP).
        
        // Display options
        document.getElementById('btn-show-bars')?.addEventListener('click', () => {
            this.handleShowBars();
        });
        
        document.getElementById('btn-hide-bars')?.addEventListener('click', () => {
            this.handleHideBars();
        });
    },
    
    // exitSetupHUD() and sendCloseSetupMessage() removed - exit button no longer exists
    // Use rp_options prim in Second Life to toggle Setup HUD visibility
    
    /**
     * Whether this character's species and universe allow opting in to magic.
     */
    canOptInToMagic(species, universe) {
        const u = universe || this.state.currentUniverse;
        const manaEnabled = u?.manaEnabled !== false;
        if (!manaEnabled || !species) {
            return false;
        }
        return (species.mana || 0) > 0 || (species.mana_chance || 0) > 0;
    },

    /**
     * Show/hide and sync the Magic opt-in checkbox on the Character tab.
     */
    updateMagicOptInPanel() {
        const panel = document.getElementById('magic-opt-in-panel');
        const checkbox = document.getElementById('char-has-mana');
        const hint = document.getElementById('magic-opt-in-hint');
        const char = this.state.character;
        if (!panel || !checkbox) {
            return;
        }
        const species = this.state.currentSpecies
            || this.state.species.find(s => s.id === char?.species_id);
        const canOptIn = this.canOptInToMagic(species, this.state.currentUniverse);
        if (!char || !canOptIn) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = '';
        checkbox.checked = char.has_mana === true;
        if (hint) {
            const universeBlocks = this.state.currentUniverse?.manaEnabled === false;
            hint.textContent = universeBlocks
                ? 'This universe does not support magic.'
                : 'Opt in to arcane abilities for this character. Off by default until you enable it.';
        }
    },

    /**
     * Toggle has_mana from the Character tab checkbox.
     */
    handleMagicOptInToggle(enabled) {
        if (!this.state.character) {
            return;
        }
        const species = this.state.currentSpecies
            || this.state.species.find(s => s.id === this.state.character.species_id);
        if (!this.canOptInToMagic(species, this.state.currentUniverse)) {
            this.state.character.has_mana = false;
            this.updateMagicOptInPanel();
            return;
        }
        if (!enabled && this.state.character.class_id) {
            const manaRequiredClasses = [
                'cleric', 'cultist', 'druid', 'enchanter', 'footwizard', 'hedgemage',
                'mage', 'necromancer', 'priest', 'seer', 'shadowmage', 'shaman',
                'sorcerer', 'spellmonger', 'thaumaturge', 'warlock', 'warmage',
                'witch', 'wizard'
            ];
            if (manaRequiredClasses.includes(this.state.character.class_id)) {
                UI.showToast('Remove or change your arcane class before disabling magic.', 'warning');
                this.updateMagicOptInPanel();
                return;
            }
        }
        this.state.character.has_mana = enabled;
        this.state.pendingChanges.has_mana = enabled;
        this.recalculateResourcePools();
        this.state.pendingChanges.mana = this.state.character.mana;
        this.state.dirty = true;
        this.updateStatusIndicator();
        UI.renderResourceBars(this.state.character);
    },

    /**
     * Recalculate resource pools (Health, Stamina, Mana) from stats and species
     */
    recalculateResourcePools() {
        if (!this.state.character || !this.state.character.stats) return;
        
        const stats = this.state.character.stats;
        const species = this.state.species.find(s => s.id === this.state.character.species_id);
        
        // Use stored factors if available, otherwise get from species
        const healthFactor = this.state.character.species_factors?.health_factor || species?.health_factor || 25;
        const staminaFactor = this.state.character.species_factors?.stamina_factor || species?.stamina_factor || 25;
        const manaFactor = this.state.character.species_factors?.mana_factor || species?.mana_factor || 25;
        const hasMana = this.state.character.has_mana === true;
        
        // Create species object with factors for calculation
        const speciesForCalc = species ? {
            ...species,
            health_factor: healthFactor,
            stamina_factor: staminaFactor,
            mana_factor: manaFactor
        } : null;
        
        const baseHealth = this.calculateHealth(stats, speciesForCalc);
        const baseStamina = this.calculateStamina(stats, speciesForCalc);
        const baseMana = this.calculateMana(stats, speciesForCalc, hasMana);
        
        // Initialize resource pools if they don't exist
        if (!this.state.character.health) {
            this.state.character.health = { current: baseHealth, base: baseHealth, max: baseHealth };
        } else {
            const oldCurrent = this.state.character.health.current ?? 0;
            const oldMax = this.state.character.health.max || this.state.character.health.base || 0;
            this.state.character.health.max = baseHealth;
            this.state.character.health.base = baseHealth;
            if (oldMax > 0 && oldCurrent >= oldMax) {
                this.state.character.health.current = baseHealth;
            } else if (oldCurrent > baseHealth) {
                this.state.character.health.current = baseHealth;
            }
        }
        
        if (!this.state.character.stamina) {
            this.state.character.stamina = { current: baseStamina, base: baseStamina, max: baseStamina };
        } else {
            const oldCurrent = this.state.character.stamina.current ?? 0;
            const oldMax = this.state.character.stamina.max || this.state.character.stamina.base || 0;
            this.state.character.stamina.max = baseStamina;
            this.state.character.stamina.base = baseStamina;
            if (oldMax > 0 && oldCurrent >= oldMax) {
                this.state.character.stamina.current = baseStamina;
            } else if (oldCurrent > baseStamina) {
                this.state.character.stamina.current = baseStamina;
            }
        }
        
        // Handle mana - convert from number to object if needed, then recalculate
        if (!hasMana) {
            this.state.character.has_mana = false;
            this.state.character.mana = { current: 0, base: 0, max: 0 };
        } else if (!this.state.character.mana || typeof this.state.character.mana !== 'object') {
            // If mana is missing or a number, create object with calculated value
            this.state.character.mana = { current: baseMana, base: baseMana, max: baseMana };
        } else {
            // Mana exists as object - update max and base
            const oldCurrent = this.state.character.mana.current || 0;
            const oldMax = this.state.character.mana.max || 0;
            this.state.character.mana.max = baseMana;
            this.state.character.mana.base = baseMana;
            // If max changed or current is invalid, set current to max (like health/stamina on first load)
            if (baseMana > 0 && (oldCurrent <= 0 || oldMax !== baseMana || oldCurrent > baseMana)) {
                this.state.character.mana.current = baseMana;
            } else {
                // Preserve current value only if it's valid
                this.state.character.mana.current = oldCurrent > baseMana ? baseMana : oldCurrent;
            }
        }
    },
    
    /**
     * Handle mode change from Options tab
     */
    async handleModeChange(mode) {
        // Update local state
        if (this.state.character) {
            this.state.character.mode = mode;
            this.state.pendingChanges.mode = mode;
        }
        
        // Send to LSL via channel
        this.sendToLSL('MODE', { mode: mode });
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        const modeNames = {
            'tournament': 'Tournament',
            'roleplay': 'Roleplay',
            'ooc': 'OOC',
            'afk': 'AFK',
            'none': '*'
        };
        
        UI.showToast(`Mode set to ${modeNames[mode] || mode}`, 'success');
        
        // Save mode to Firestore immediately
        if (this.state.character && this.state.character.id) {
            try {
                const result = await API.updateCharacter({ mode: mode }, this.state.character.id);
                if (result.success) {
                    console.log('[Mode] Saved mode to Firestore:', mode);
                } else {
                    console.error('[Mode] Failed to save mode:', result.error);
                }
            } catch (error) {
                console.error('[Mode] Failed to save mode to Firestore:', error);
            }
        }
    },
    
    /**
     * Handle show bars
     */
    handleShowBars() {
        this.sendToLSL('SHOW_BARS', {});
        UI.showToast('Health and stamina bars will be shown', 'success');
    },
    
    /**
     * Handle hide bars
     */
    handleHideBars() {
        this.sendToLSL('HIDE_BARS', {});
        UI.showToast('Health and stamina bars will be hidden', 'success');
    },
    
    /**
     * history.replaceState breaks keyboard input in SL MOAP while a field is focused.
     */
    safeHistoryReplaceState(urlString) {
        if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
            return false;
        }
        try {
            window.history.replaceState({}, '', urlString);
            return true;
        } catch (e) {
            console.warn('[MOAP] safeHistoryReplaceState failed:', e);
            return false;
        }
    },
    
    /**
     * Storage key for last character chosen in Setup HUD (per avatar).
     */
    getActiveCharacterStorageKey() {
        return 'f4_active_character_' + (API.uuid || '');
    },

    /**
     * Resolve which character to load on MOAP open (not just first in list).
     * Setup HUD selection (session / Firestore) wins over Players HUD URL param.
     */
    resolveInitialCharacterId(activeCharFromUrl) {
        const storageKey = this.getActiveCharacterStorageKey();
        let id = null;
        try {
            id = sessionStorage.getItem(storageKey);
        } catch (e) { /* MOAP may block storage */ }
        if (!id && API.activeCharacterId) {
            id = API.activeCharacterId;
        }
        if (!id && activeCharFromUrl) {
            id = activeCharFromUrl;
        }
        if (id) {
            this.state.selectedCharacterId = id;
            console.log('[Character] Initial selection:', id);
        }
    },

    /**
     * Pick character document id when loading roster from Firestore.
     * Always honor explicit Setup selection even if roster cache is briefly stale.
     */
    pickCharacterIdToLoad(characters) {
        const preferred = this.state.selectedCharacterId
            || API.activeCharacterId
            || null;
        if (preferred) {
            return preferred;
        }
        if (!characters || characters.length === 0) {
            return null;
        }
        return characters[0].id;
    },

    syncActiveCharToUrl(characterId) {
        if (!characterId) {
            return;
        }
        try {
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get('active_char') === characterId) {
                return;
            }
            currentUrl.searchParams.set('active_char', characterId);
            this.safeHistoryReplaceState(currentUrl.toString());
        } catch (e) { /* ignore */ }
    },

    async rememberSelectedCharacter(characterId) {
        if (!characterId) {
            return;
        }
        this.state.selectedCharacterId = characterId;
        API.activeCharacterId = characterId;
        this.syncActiveCharToUrl(characterId);
        try {
            sessionStorage.setItem(this.getActiveCharacterStorageKey(), characterId);
        } catch (e) { /* ignore */ }
        if (API.setActiveCharacter) {
            const result = await API.setActiveCharacter(characterId);
            if (!result.success) {
                console.warn('[Character] Firestore activeCharacter save failed:', result.error);
            }
        }
    },

    /**
     * Merge HUD gameplay economy from URL params (KVP authoritative).
     */
    initEconFromUrl() {
        const char = this.state.character;
        if (!char) {
            return;
        }
        let lifetime = 0;
        let spent = 0;
        let ap = 0;
        try {
            const params = new URLSearchParams(window.location.search);
            const urlLife = parseInt(params.get('xp_lifetime'), 10);
            const urlLegacy = parseInt(params.get('xp_total'), 10);
            const urlSpent = parseInt(params.get('xp_spent'), 10);
            const urlAp = parseInt(params.get('ap_balance'), 10);
            if (!isNaN(urlLife) && urlLife >= 0) {
                lifetime = urlLife;
            } else if (!isNaN(urlLegacy) && urlLegacy >= 0) {
                lifetime = urlLegacy;
            }
            if (!isNaN(urlSpent) && urlSpent >= 0) {
                spent = urlSpent;
            }
            if (!this.state.econSessionActive && !isNaN(urlAp) && urlAp >= 0) {
                ap = urlAp;
            } else {
                const sessionAp = (App.state.econ && App.state.econ.ap_balance != null)
                    ? parseInt(App.state.econ.ap_balance, 10) : NaN;
                const charAp = parseInt(char.ap_balance, 10);
                if (!isNaN(sessionAp) && sessionAp >= 0) {
                    ap = sessionAp;
                } else if (!isNaN(charAp) && charAp >= 0) {
                    ap = charAp;
                } else {
                    ap = 0;
                }
            }
        } catch (e) { /* ignore */ }
        const allowFirestoreEcon = !window.hasHudEconInUrl();
        if (lifetime === 0 && allowFirestoreEcon) {
            const docLife = parseInt(char.xp_total, 10);
            if (!isNaN(docLife) && docLife > 0) {
                lifetime = docLife;
            }
        }
        if (spent === 0 && lifetime > 0 && allowFirestoreEcon) {
            const docAvail = parseInt(char.xp_available, 10);
            if (!isNaN(docAvail) && docAvail >= 0 && docAvail <= lifetime) {
                spent = lifetime - docAvail;
            }
        }
        char.xp_lifetime = lifetime;
        char.xp_spent = spent;
        char.ap_balance = ap;
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = lifetime;
        App.state.econ.xp_spent = spent;
        App.state.econ.ap_balance = ap;
    },

    /**
     * Parse HUD pool pipe (current|base|max) from LSD/KVP.
     */
    parsePoolPipe(pipeStr) {
        if (!pipeStr || typeof pipeStr !== 'string') {
            return null;
        }
        const parts = pipeStr.split('|');
        if (parts.length < 3) {
            return null;
        }
        const current = parseInt(parts[0], 10);
        const base = parseInt(parts[1], 10);
        const max = parseInt(parts[2], 10);
        if (isNaN(current) || isNaN(base) || isNaN(max)) {
            return null;
        }
        return { current, base, max };
    },

    /**
     * Merge gameplay health/stamina/mana from Setup HUD URL (KVP authoritative).
     */
    mergePoolsFromUrl() {
        const char = this.state.character;
        if (!char) {
            return;
        }
        try {
            const params = new URLSearchParams(window.location.search);
            ['health', 'stamina', 'mana'].forEach((key) => {
                const pipe = params.get(key + '_pipe');
                const parsed = this.parsePoolPipe(pipe);
                if (parsed) {
                    char[key] = parsed;
                }
            });
        } catch (e) { /* ignore */ }
    },

    /**
     * One-time legacy AP migration from old derived formula (veterans).
     */
    migrateLegacyEconIfNeeded() {
        const char = this.state.character;
        if (!char || char._econMigrated) {
            return;
        }
        const ap = char.ap_balance || 0;
        const lifetime = char.xp_lifetime || 0;
        if (ap === 0 && lifetime > 0 && typeof window.calculateLegacyAvailablePoints === 'function') {
            const legacyAp = window.calculateLegacyAvailablePoints(char);
            if (legacyAp > 0) {
                char.ap_balance = legacyAp;
                App.state.econ.ap_balance = legacyAp;
                console.log('[XP] Migrated legacy AP balance (MOAP session):', legacyAp);
            }
        }
        char._econMigrated = true;
    },

    getSpeciesStartingXp(speciesId) {
        if (!speciesId) {
            return 0;
        }
        const species = (this.state.species || []).find(function (s) {
            return s.id === speciesId;
        });
        return Math.max(0, parseInt(species && species.starting_xp, 10) || 0);
    },

    /**
     * 20-stat CSV for Players HUD LSD (same order as LSL stat indices).
     */
    statsCsvFromChar(char) {
        if (!char || !char.stats) {
            return '';
        }
        const statNames = [
            'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
            'deception', 'endurance', 'entertaining', 'fighting', 'healing',
            'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
            'stealth', 'survival', 'thievery', 'will', 'wisdom'
        ];
        return statNames.map(function (s, idx) {
            if (char.stats[s] != null) {
                return char.stats[s];
            }
            const numKey = String(idx);
            if (char.stats[numKey] != null) {
                return char.stats[numKey];
            }
            return 1;
        }).join(',');
    },

    /**
     * Write stats into Players HUD LSD only — no Bridge fetch.
     * Retries if MOAP input is focused (history.replaceState is blocked).
     */
    syncStatsToPlayersHUD(char) {
        if (!char) {
            return;
        }
        if (typeof MoapDialogs !== 'undefined' && MoapDialogs.isActive && MoapDialogs.isActive()) {
            this.scheduleSyncStatsToPlayersHUD(char);
            return;
        }
        const csv = this.statsCsvFromChar(char);
        if (!csv) {
            console.warn('[Players HUD Sync] statsCsvFromChar empty — char.stats missing?');
            return;
        }
        const parts = csv.split(',');
        console.log('[Players HUD Sync] stats_csv crafting[idx4]=' + parts[4] + ' len=' + parts.length);

        if (this._lastStatsCsvSynced === csv) {
            return;
        }

        try {
            const currentUrl = new URL(window.location.href);
            const urlCsv = currentUrl.searchParams.get('stats_csv');
            if (urlCsv === csv) {
                this._lastStatsCsvSynced = csv;
                return;
            }
        } catch (e) { /* ignore */ }

        if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
            console.log('[Players HUD Sync] stats_csv deferred (form focused) — will retry');
            this.scheduleSyncStatsToPlayersHUD(char);
            return;
        }

        try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('stats_csv', csv);
            currentUrl.searchParams.set('stats_csv_ts', Date.now().toString());
            this._lastStatsCsvSynced = csv;
            if (typeof App !== 'undefined' && App.persistMoapSessionDraft) {
                App.persistMoapSessionDraft(true);
            }
            // Full navigation — SL reads PRIM_MEDIA_CURRENT_URL; replaceState alone is invisible to LSL
            console.log('[Players HUD Sync] Navigating MOAP URL with stats_csv');
            window.location.assign(currentUrl.toString());
        } catch (e) {
            console.error('[Players HUD Sync] stats_csv URL update failed:', e);
        }
    },

    _syncStatsScheduleTimer: null,

    scheduleSyncStatsToPlayersHUD(char) {
        if (!char) {
            return;
        }
        const self = this;
        if (self._syncStatsScheduleTimer) {
            clearTimeout(self._syncStatsScheduleTimer);
        }
        self._syncStatsScheduleTimer = setTimeout(function () {
            self._syncStatsScheduleTimer = null;
            if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
                self.scheduleSyncStatsToPlayersHUD(char);
                return;
            }
            self.syncStatsToPlayersHUD(char);
        }, 300);
    },

    /**
     * Setup open / save: push stats into Players HUD LSD (LOAD_CHARACTER + UPDATE_STATS).
     */
    async cacheHudStatsForPlayers(char) {
        if (!char || !char.id) {
            return;
        }
        this.scheduleSyncStatsToPlayersHUD(char);
        await this.pushCharacterToPlayersHUD(char.id);
        // One deferred pass — only if URL still lacks matching stats_csv (avoids reload loops)
        const self = this;
        setTimeout(function () {
            try {
                const csv = self.statsCsvFromChar(char);
                const urlCsv = new URL(window.location.href).searchParams.get('stats_csv');
                if (csv && urlCsv !== csv) {
                    self.scheduleSyncStatsToPlayersHUD(char);
                }
            } catch (e) { /* ignore */ }
        }, 2000);
    },

    /**
     * Build pipe-safe payload from loaded Firestore character (MOAP → LSL).
     * LSL bridge HTTP cannot use Firebase auth; MOAP must push identity and pools.
     */
    buildCharacterSyncPayload(characterId, charOverride) {
        const data = { characterId: characterId };
        let char = charOverride;
        if (!char && this.state.character && this.state.character.id === characterId) {
            char = this.state.character;
        }
        if (!char && API._listCharactersCache) {
            char = this.characterFromList(API._listCharactersCache, characterId);
        }
        if (!char) {
            return data;
        }
        if (char.name != null && char.name !== '') {
            data.name = char.name;
        }
        if (char.title != null) {
            data.title = char.title;
        }
        if (char.gender) {
            data.gender = char.gender;
        }
        if (char.species_id) {
            data.species_id = char.species_id;
            const startingXp = this.getSpeciesStartingXp(char.species_id);
            if (startingXp > 0 && (!char.xp_lifetime || char.xp_lifetime === 0)) {
                data.starting_xp = startingXp;
            }
        }
        if (char.class_id) {
            data.class_id = char.class_id;
        }
        if (char.mode) {
            data.mode = char.mode;
        }
        if (char.stats) {
            data.stats = this.statsCsvFromChar(char);
        }
        if (char.id) {
            data.xp_lifetime = window.getEconLifetime(char);
            data.xp_spent = window.getEconSpent(char);
            data.ap_balance = window.getApBalance(char);
        }
        const pool = function (p) {
            if (!p) {
                return null;
            }
            const cur = p.current != null ? p.current : 0;
            const base = p.base != null ? p.base : cur;
            const max = p.max != null ? p.max : base;
            return cur + '|' + base + '|' + max;
        };
        const healthStr = pool(char.health);
        if (healthStr) {
            data.health = healthStr;
        }
        const staminaStr = pool(char.stamina);
        if (staminaStr) {
            data.stamina = staminaStr;
        }
        const manaStr = pool(char.mana);
        if (manaStr) {
            data.mana = manaStr;
        }
        if (this._pendingAutoHideSetup) {
            data.auto_hide_setup = 'TRUE';
            this._pendingAutoHideSetup = false;
        }
        return data;
    },

    /**
     * Load a character into the Players HUD (LSD + meter) after Setup HUD selection or save.
     */
    async pushCharacterToPlayersHUD(characterId) {
        if (!characterId || !API.uuid) {
            return;
        }
        if (!this.lsl.channel) {
            console.error('[Players HUD Sync] No HUD channel — re-open Setup HUD from the attachment');
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('HUD channel missing. Close and reopen Setup HUD.', 'error');
            }
            return;
        }
        await this.rememberSelectedCharacter(characterId);
        let char = (this.state.character && this.state.character.id === characterId)
            ? this.state.character
            : this.characterFromList(API._listCharactersCache || [], characterId);
        if (!char || !char.name) {
            const charResult = await API.getCharacterById(characterId);
            if (charResult.success && charResult.data && charResult.data.character) {
                char = charResult.data.character;
            }
        }
        const payload = this.buildCharacterSyncPayload(characterId, char);
        if (!payload.name) {
            console.warn('[Players HUD Sync] LOAD_CHARACTER missing name — meter may show Loading until Bridge fetch');
        }
        console.log('[Players HUD Sync] Switching HUD character:', payload);
        this.sendToLSL('LOAD_CHARACTER', payload);
        try {
            const currentUrl = new URL(window.location.href);
            if (char && char.name) {
                currentUrl.searchParams.set('char_name', char.name);
            }
            if (char && char.title != null) {
                currentUrl.searchParams.set('char_title', char.title);
            }
            this.safeHistoryReplaceState(currentUrl.toString());
        } catch (e) { /* ignore */ }
    },

    /**
     * Send message to LSL via channel
     * Since JavaScript can't use llRegionSay directly, we use a workaround:
     * Update the URL with the command, and LSL will poll for it
     */
    sendToLSL(command, data) {
        if (!this.lsl.channel) {
            console.error('[LSL] No channel available');
            return;
        }
        
        console.log('[LSL] Sending command:', command, data);
        
        // Build command message for LSL (pipe-separated — MOAP parses with llParseString2List(msg, ["|"], []))
        let message = command;
        if (data && Object.keys(data).length > 0) {
            const parts = Object.entries(data).map(function (entry) {
                return entry[0] + ":" + encodeURIComponent(String(entry[1]));
            });
            message += "|" + parts.join("|");
        }
        
        // Store command in URL so LSL can poll for it
        try {
            const currentUrl = new URL(window.location.href);
            const encodedCmd = encodeURIComponent(message);
            currentUrl.searchParams.set('lsl_cmd', encodedCmd);
            currentUrl.searchParams.set('lsl_cmd_ts', Date.now().toString());
            
            if (!this.safeHistoryReplaceState(currentUrl.toString())) {
                console.log('[LSL] Command deferred (form field focused):', command);
            } else {
                console.log('[LSL] Command stored in URL:', command);
            }
        } catch (e) {
            console.error('[LSL] Failed to store command in URL:', e);
        }
    },
    
    /**
     * Save character to server
     */
    applyPendingClassXpChargeAfterSave() {
        const pendingCost = this.state.pendingClassXpCost;
        if (!pendingCost || pendingCost <= 0 || !this.state.character) {
            return;
        }
        const unused = window.getUnusedXp(this.state.character);
        if (unused < pendingCost) {
            UI.showToast('Class saved but need ' + pendingCost + ' XP (have ' + unused + ' unused)', 'warning', 4000);
            return;
        }
        this.state.character.xp_spent = window.getEconSpent(this.state.character) + pendingCost;
        this.state.econSessionActive = true;
        if (App.state.econ) {
            App.state.econ.xp_spent = this.state.character.xp_spent;
        }
        delete this.state.pendingClassXpCost;
        window.updateEconUrlParams(this.state.character.xp_spent, this.state.character.ap_balance);
        setTimeout(function () {
            window.pushEconToHud();
        }, 600);
    },

    async saveCharacter(options) {
        if (options === undefined) {
            options = {};
        }
        const draft = !!options.draft;
        const silent = !!options.silent;

        try {
            const char = this.state.character;
            if (!char) {
                if (!silent) UI.showToast('No character to save', 'warning');
                return false;
            }

            if (!char.name || char.name.trim() === '') {
                if (!silent) UI.showToast('Please enter a character name', 'warning');
                return false;
            }

            if (!draft) {
                if (!char.gender) {
                    UI.showToast('Please select a gender', 'warning');
                    return false;
                }
                if (!char.species_id) {
                    UI.showToast('Please select a species', 'warning');
                    return false;
                }
            }
            
            if (!silent) {
                UI.showToast(draft ? 'Saving progress...' : 'Saving...', 'info', 1000);
            }
            
            // Determine if this is a new character or an update
            // Check if character has an ID - if it does, it's an existing character
            const isNewCharacter = this.state.isNewCharacter && !char.id;
            
            if (isNewCharacter) {
                if (!this.state.selectedUniverseId) {
                    if (!silent) UI.showToast('Please select a universe', 'warning');
                    return false;
                }
                
                const universeResult = await API.getUniverse(this.state.selectedUniverseId);
                if (!universeResult.success) {
                    if (!silent) UI.showToast('Failed to load universe data', 'error');
                    return false;
                }
                const universe = universeResult.data.universe;
                
                if (universe.registrationCode && universe.registrationCode.trim() !== '') {
                    const registrationInput = document.getElementById('universe-registration-code');
                    const registrationCode = registrationInput ? registrationInput.value.trim() : '';
                    if (!registrationCode) {
                        if (!silent) UI.showToast('Registration code is required for this universe', 'warning');
                        return false;
                    }
                    if (universe.registrationCode !== registrationCode) {
                        if (!silent) UI.showToast('Invalid registration code', 'error');
                        return false;
                    }
                }
                
                const limitCheck = await API.validateCharacterLimit(this.state.selectedUniverseId, API.uuid);
                if (!limitCheck.success || !limitCheck.data.allowed) {
                    if (!silent) {
                        UI.showToast(`Character limit reached for this universe (${limitCheck.data.currentCount}/${limitCheck.data.limit})`, 'error');
                    }
                    return false;
                }

                const saveGender = char.gender || 'other';
                const saveSpeciesId = char.species_id || 'human';

                if (char.gender && char.species_id) {
                    const identityCheck = await API.validateIdentityOptions(
                        this.state.selectedUniverseId,
                        saveGender,
                        saveSpeciesId,
                        char.class_id || null
                    );
                    if (!identityCheck.success || !identityCheck.data.valid) {
                        if (!silent) {
                            UI.showToast('Selected identity options are not allowed in this universe: ' + identityCheck.data.errors.join(', '), 'error');
                        }
                        return false;
                    }
                } else if (!draft) {
                    if (!silent) UI.showToast('Please select gender and species before finishing', 'warning');
                    return false;
                }
                
                const species = this.state.species.find(s => s.id === saveSpeciesId);
                const hasMana = char.has_mana === true;
                
                // Calculate mana based on stats if has_mana is true
                // Use character stats if available, otherwise use default stats (all 2s)
                const stats = char.stats || this.getDefaultStats();
                let manaPool = { current: 0, base: 0, max: 0 };
                if (hasMana && species) {
                    const manaFactor = species.mana_factor || 25;
                    const wisdom = stats.wisdom || 2;
                    const intelligence = stats.intelligence || 2;
                    const baseMana = (wisdom + intelligence) * manaFactor;
                    manaPool = { current: baseMana, base: baseMana, max: baseMana };
                }
                
                // Create new character
                console.log('[saveCharacter] Creating new character with data:', {
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    species_id: char.species_id,
                    class_id: char.class_id,
                    universe_id: this.state.selectedUniverseId,
                    has_mana: hasMana,
                    mana: manaPool
                });
                
                const result = await API.createCharacter({
                    name: char.name,
                    title: char.title || '',
                    gender: saveGender,
                    species_id: saveSpeciesId,
                    class_id: char.class_id || null,
                    universe_id: this.state.selectedUniverseId,
                    has_mana: hasMana,
                    mana: manaPool,
                    stats: char.stats
                });
                
                console.log('[saveCharacter] createCharacter result:', result);
                
                if (!result) {
                    if (!silent) UI.showToast('Failed to create character: No response from server', 'error');
                    return false;
                }
                
                if (!result.success) {
                    if (!silent) UI.showToast('Failed to create character: ' + (result.error || 'Unknown error'), 'error');
                    return false;
                }
                
                if (!result.data || !result.data.character) {
                    if (!silent) UI.showToast('Failed to create character: Invalid response from server', 'error');
                    return false;
                }
                
                this.state.character = result.data.character;
                this.state.selectedCharacterId = result.data.character.id;
                this.state.dirty = false;
                this.applyPendingClassXpChargeAfterSave();
                await this.rememberSelectedCharacter(result.data.character.id);
                if (draft) {
                    this.state.isNewCharacter = true;
                    this.state.creationInProgress = true;
                    if (!silent) UI.showToast('Progress saved', 'success');
                } else {
                    this.state.isNewCharacter = false;
                    this.state.creationInProgress = false;
                    if (!silent) UI.showToast('Character created!', 'success');
                }
                this.updateStatusIndicator();
                this.updateStepGuide();
                await this.loadData({ forceRefresh: true });
                return true;
            } else {
                // Update existing character (must target the selected doc, not "first" character)
                const characterId = char.id || this.state.selectedCharacterId;
                if (!characterId) {
                    if (!silent) UI.showToast('Cannot save: character has no ID. Use Create New Character for a new slot.', 'warning');
                    return false;
                }
                
                // Ensure class_id is included - use currentClass.id as fallback
                let classId = char.class_id;
                if (!classId && this.state.currentClass) {
                    classId = this.state.currentClass.id;
                    console.log('[Save] Using currentClass.id as fallback for class_id: ' + classId);
                    char.class_id = classId;  // Update character state too
                }
                if (!classId) {
                    console.warn('[Save] WARNING: class_id is empty when saving character!');
                } else {
                    console.log('[Save] Saving class_id: ' + classId);
                }
                
                console.log('[saveCharacter] Updating character with data:', {
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    stats: char.stats,
                    class_id: classId
                });
                
                const savedAp = window.getApBalance(char);
                const savedSpent = window.getEconSpent(char);
                
                const result = await API.updateCharacter({
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    species_id: char.species_id,
                    stats: char.stats,
                    class_id: classId,
                    has_mana: char.has_mana,
                    mana: char.mana,
                    health: char.health,
                    stamina: char.stamina
                }, characterId);
                
                console.log('[saveCharacter] updateCharacter result:', result);
                
                if (!result) {
                    if (!silent) UI.showToast('Failed to update character: No response from server', 'error');
                    return false;
                }
                
                if (!result.success) {
                    if (!silent) UI.showToast('Failed to update character: ' + (result.error || 'Unknown error'), 'error');
                    return false;
                }
                
                if (!result.data || !result.data.character) {
                    if (!silent) UI.showToast('Failed to update character: Invalid response from server', 'error');
                    return false;
                }
                
                this.state.character = result.data.character;
                this.state.character.ap_balance = savedAp;
                this.state.character.xp_spent = savedSpent;
                if (typeof App.state.econ === 'undefined' || !App.state.econ) {
                    App.state.econ = {};
                }
                App.state.econ.ap_balance = savedAp;
                App.state.econ.xp_spent = savedSpent;
                App.state.econSessionActive = true;
                this.applyPendingClassXpChargeAfterSave();
                const finalSpent = window.getEconSpent(this.state.character);
                this.state.selectedCharacterId = result.data.character.id;
                await this.rememberSelectedCharacter(result.data.character.id);
                if (draft) {
                    this.state.isNewCharacter = true;
                    this.state.creationInProgress = true;
                } else {
                    this.state.isNewCharacter = false;
                    this.state.creationInProgress = false;
                }
                if (this.state.character.class_id) {
                    this.state.currentClass = this.state.classes.find(c => c.id === this.state.character.class_id);
                }
                this.state.dirty = false;
                if (!silent) {
                    UI.showToast(draft ? 'Progress saved' : 'Character saved!', 'success');
                }
                this.updateStatusIndicator();
                this.updateStepGuide();
                this.clearMoapSessionDraft(characterId);
                App.state.econSessionActive = true;
                window.updateEconUrlParams(finalSpent, savedAp);
                window.pushEconToHud();
                await this.cacheHudStatsForPlayers(this.state.character);
                window.pushEconToHud();
                await this.loadData({ forceRefresh: true });
                if (this.state.character) {
                    this.state.character.ap_balance = savedAp;
                    this.state.character.xp_spent = finalSpent;
                    App.state.econ.ap_balance = savedAp;
                    App.state.econ.xp_spent = finalSpent;
                    App.state.econSessionActive = true;
                    window.reconcileStaleApBalance(this.state.character);
                }
                this.captureStatsFloor(this.state.character);
                window.updateEconUrlParams(
                    window.getEconSpent(this.state.character),
                    window.getApBalance(this.state.character)
                );
                window.pushEconToHud();

                setTimeout(() => {
                    if (this.state.character) {
                        // Trigger the heartbeat update manually
                        const stats = this.state.character.stats || {};
                        const statsList = [
                            stats.agility || 2, stats.animal_handling || 2, stats.athletics || 2,
                            stats.awareness || 2, stats.crafting || 2, stats.deception || 2,
                            stats.endurance || 2, stats.entertaining || 2, stats.fighting || 2,
                            stats.healing || 2, stats.influence || 2, stats.intelligence || 2,
                            stats.knowledge || 2, stats.marksmanship || 2, stats.persuasion || 2,
                            stats.stealth || 2, stats.survival || 2, stats.thievery || 2,
                            stats.will || 2, stats.wisdom || 2
                        ];
                        // Get class_id - check both character.class_id and currentClass.id
                        let classId = this.state.character.class_id || "";
                        if (!classId && this.state.currentClass) {
                            classId = this.state.currentClass.id || "";
                            console.log('[Save] Using currentClass.id as fallback: ' + classId);
                        }
                        if (!classId) {
                            console.warn('[Save] WARNING: class_id is empty! character.class_id=' + this.state.character.class_id + ', currentClass=' + (this.state.currentClass ? this.state.currentClass.id : 'null'));
                        } else {
                            console.log('[Save] Including class in JSON: ' + classId);
                        }
                        
                        // Build character data as JSON object
                        const characterJSON = {
                            class_id: classId,
                            stats: this.state.character.stats || {},
                            health: this.state.character.health || { current: 0, base: 0, max: 0 },
                            stamina: this.state.character.stamina || { current: 0, base: 0, max: 0 },
                            mana: this.state.character.mana || { current: 0, base: 0, max: 0 },
                            xp_lifetime: this.state.character.xp_lifetime || 0,
                            xp_spent: this.state.character.xp_spent || 0,
                            ap_balance: this.state.character.ap_balance || 0,
                            has_mana: this.state.character.has_mana || false,
                            species_factors: this.state.character.species_factors || { health_factor: 25, stamina_factor: 25, mana_factor: 25 }
                        };
                        
                        // Convert to JSON string and encode for URL
                        const jsonString = JSON.stringify(characterJSON);
                        const currentUrl = new URL(window.location.href);
                        const encodedData = encodeURIComponent(jsonString);
                        currentUrl.searchParams.set('char_data', encodedData);
                        currentUrl.searchParams.set('char_data_ts', Date.now().toString());
                        if (this.safeHistoryReplaceState(currentUrl.toString())) {
                            console.log('[Save] Updated CHARACTER_DATA in URL as JSON with class: ' + classId);
                        }
                    }
                }, 500);
                return true;
            }
            
            this.state.pendingChanges = {};
            await this.renderAll();
            return true;
            
        } catch (error) {
            console.error('Save failed:', error);
            if (!silent) UI.showToast('Failed to save: ' + error.message, 'error');
            return false;
        }
    },
    
    /**
     * Show Challenge Test dialog (not "dice roll")
     */
    showChallengeTestDialog() {
        const stats = Object.keys(this.state.character?.stats || {});
        
        // Challenge Rating (CR) options with descriptive labels
        const crOptions = [
            { value: 1, label: 'Trivial' },
            { value: 2, label: 'Very Easy' },
            { value: 3, label: 'Easy' },
            { value: 4, label: 'Moderate' },
            { value: 5, label: 'Challenging' },
            { value: 6, label: 'Hard' },
            { value: 7, label: 'Very Hard' },
            { value: 8, label: 'Extreme' },
            { value: 9, label: 'Nearly Impossible' }
        ];
        
        const content = `
            <h2>Challenge Test</h2>
            <p class="info-text">Test your character's ability against a Challenge Rating (CR)</p>
            <div class="form-group">
                <label for="challenge-stat">Stat to Test</label>
                <select id="challenge-stat">
                    ${stats.map(s => `<option value="${s}">${UI.formatStatName(s)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="challenge-cr">Challenge Rating (CR)</label>
                <select id="challenge-cr">
                    ${crOptions.map(opt => `<option value="${opt.value}">CR ${opt.value} - ${opt.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label><input type="checkbox" id="challenge-announce" checked> Announce result in local chat</label>
            </div>
            <button class="action-btn primary" id="btn-execute-challenge">⚔️ Attempt Challenge</button>
            <div id="challenge-result" style="margin-top: 16px;"></div>
        `;
        
        UI.showModal(content);
        
        // Set default CR to 5 (Challenging)
        const crSelect = document.getElementById('challenge-cr');
        if (crSelect) {
            crSelect.value = '5';
        }
        
        // Bind challenge button
        document.getElementById('btn-execute-challenge')?.addEventListener('click', async () => {
            const stat = document.getElementById('challenge-stat').value;
            const cr = parseInt(document.getElementById('challenge-cr').value) || 5;
            const shouldAnnounce = document.getElementById('challenge-announce').checked;
            
            try {
                const result = await API.rollTest(stat, cr); // Uses same backend, but terminology is "Challenge Test"
                const data = result.data;
                
                // Calculate degrees of success/failure
                const degrees = Math.abs(data.margin);
                const degreesText = degrees === 0 ? 'Marginal' : 
                                   degrees <= 2 ? 'Minor' :
                                   degrees <= 5 ? 'Moderate' :
                                   degrees <= 10 ? 'Major' : 'Extreme';
                
                // Build result display (no mention of "dice" or "rolls")
                let resultHtml = `
                    <div class="challenge-result-box" style="background: var(--bg-dark); padding: 16px; border-radius: 8px;">
                        <p><strong>Stat Tested:</strong> ${UI.formatStatName(stat)} (Value: ${data.stat_value})</p>
                        <p><strong>Challenge Rating:</strong> CR ${cr}</p>
                        <p><strong>Result:</strong> ${data.final_result}</p>
                        ${data.vocation_bonus > 0 ? `<p><strong>Vocation Bonus:</strong> +${data.vocation_bonus}</p>` : ''}
                        <p style="font-size: 1.5rem; color: ${data.success ? 'var(--success)' : 'var(--error)'}; margin-top: 12px;">
                            ${data.success ? '✓ SUCCESS' : '✗ FAILURE'}
                        </p>
                        <p style="color: ${data.success ? 'var(--emerald)' : 'var(--crimson)'}; font-weight: 600;">
                            ${degreesText} ${data.success ? 'Success' : 'Failure'} (${data.margin >= 0 ? '+' : ''}${data.margin} margin)
                        </p>
                    </div>
                `;
                
                // Add LSL announcement info (no dice terminology)
                if (shouldAnnounce) {
                    const announcement = `⚔️ ${App.lsl.displayName} attempts ${UI.formatStatName(stat)} challenge (CR ${cr}): ${data.success ? '✅ SUCCESS' : '❌ FAILURE'} - ${degreesText} ${data.success ? 'success' : 'failure'}`;
                    const lslCmd = API.queueRollAnnouncement(stat, '', cr, data.final_result, data.success);
                    
                    resultHtml += `
                        <div style="margin-top: 12px; padding: 12px; background: var(--bg-darker); border-radius: 4px; font-size: 0.9rem;">
                            <p style="color: var(--text-muted); margin-bottom: 8px;">📢 Chat Announcement:</p>
                            <p style="font-family: monospace; word-break: break-all;">${announcement}</p>
                            <button class="action-btn" onclick="navigator.clipboard.writeText('${announcement.replace(/'/g, "\\'")}'); UI.showToast('Copied!', 'success', 1000);" style="margin-top: 8px;">
                                📋 Copy to Clipboard
                            </button>
                        </div>
                    `;
                }
                
                document.getElementById('challenge-result').innerHTML = resultHtml;
            } catch (error) {
                UI.showToast('Challenge test failed: ' + error.message, 'error');
            }
        });
    },
    
    /**
     * Global template CRUD (species/classes/genders collections) — not universe allowlists.
     */
    canManageGlobalTemplates() {
        if (API.uuid === API.SUPER_ADMIN_UUID) {
            return true;
        }
        return API.role === 'sys_admin' || API.role === 'sim_admin';
    },

    /**
     * Show admin panel
     */
    showAdminPanel(panel) {
        const adminContent = UI.elements.adminContent;
        if (!adminContent) return;

        const globalTemplatePanels = ['species', 'classes', 'genders'];
        if (globalTemplatePanels.includes(panel) && !this.canManageGlobalTemplates()) {
            UI.showToast(
                'Use Universe Management → edit a universe → Classes/Species/Genders to choose what that universe allows.',
                'warning'
            );
            this.showUniverseManagement();
            return;
        }
        
        switch (panel) {
            case 'users':
                this.showUserManagement();
                break;
            case 'universes':
                this.showUniverseManagement();
                break;
            case 'species':
                this.showTemplateManager('species');
                break;
            case 'classes':
                this.showTemplateManager('classes');
                break;
            case 'genders':
                this.showTemplateManager('genders');
                break;
            // case 'vocations': // removed from admin UI — redundant with classes until vocation system is used
            //     this.showTemplateManager('vocations');
            //     break;
            case 'consumables':
                this.showConsumablesManagement();
                break;
            case 'xp':
                this.showXPAward();
                break;
            case 'givecoins':
                this.showGiveCoins();
                break;
            case 'giveitem':
                this.showXPAward();
                break;
            default:
                adminContent.innerHTML = '<p class="placeholder-text">Select an admin function...</p>';
        }
    },
    
    /**
     * Show user management panel
     */
    async showUserManagement() {
        const adminContent = UI.elements.adminContent;
        UI.showLoading(adminContent, 'Loading users...');
        
        try {
            const result = await API.listUsers();
            const users = result.data.users || [];
            
            const isSuperAdmin = API.uuid === API.SUPER_ADMIN_UUID;
            
            adminContent.innerHTML = `
                <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                    <h3>User Management (${users.length} users)</h3>
                    ${isSuperAdmin ? '<span style="color: var(--gold); font-weight: bold;">👑 Super Admin</span>' : ''}
                </div>
                <div class="user-list" style="max-height: 500px; overflow-y: auto;">
                    ${users.map(u => {
                        const isCurrentUser = u.uuid === API.uuid;
                        const isSuperAdminUser = u.uuid === API.SUPER_ADMIN_UUID;
                        const canPromoteToSysAdmin = isSuperAdmin && !isCurrentUser;
                        
                        return `
                        <div class="user-row" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-md); border-bottom: 1px solid var(--border-color);">
                            <div>
                                <strong style="color: var(--gold-light);">${u.display_name || u.username || u.uuid}</strong>
                                ${isSuperAdminUser ? ' 👑' : ''}
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                    ${u.username ? `${u.username} • ` : ''}${u.role || 'player'}${u.banned ? ' <span style="color: var(--error);">[BANNED]</span>' : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: var(--space-sm); align-items: center;">
                                ${isCurrentUser ? '<span style="color: var(--text-muted);">(You)</span>' : `
                                    <select class="role-select" data-uuid="${u.uuid}" style="padding: var(--space-xs) var(--space-sm); background: var(--bg-medium); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                                        <option value="player" ${u.role === 'player' ? 'selected' : ''}>Player</option>
                                        <option value="sim_admin" ${u.role === 'sim_admin' ? 'selected' : ''}>Sim Admin</option>
                                        <option value="universe_admin" ${u.role === 'universe_admin' ? 'selected' : ''}>Universe Admin</option>
                                        ${canPromoteToSysAdmin ? `<option value="sys_admin" ${u.role === 'sys_admin' ? 'selected' : ''}>Sys Admin</option>` : ''}
                                    </select>
                                    ${!isSuperAdminUser ? `
                                        <button class="ban-btn action-btn" data-uuid="${u.uuid}" data-banned="${!u.banned}" style="background: ${u.banned ? 'var(--success)' : 'var(--error)'};">
                                            ${u.banned ? 'Unban' : 'Ban'}
                                        </button>
                                    ` : '<span style="color: var(--text-muted); font-size: 0.85rem;">Protected</span>'}
                                `}
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
            
            // Bind role change events
            adminContent.querySelectorAll('.role-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const targetUUID = e.target.dataset.uuid;
                    const newRole = e.target.value;
                    
                    try {
                        const result = await API.promoteUser(targetUUID, newRole);
                        if (result.success) {
                            UI.showToast('Role updated', 'success');
                            this.showUserManagement(); // Refresh to show updated roles
                        } else {
                            UI.showToast(result.error || 'Failed to update role', 'error');
                            // Reset dropdown to previous value
                            const user = users.find(u => u.uuid === targetUUID);
                            if (user) {
                                e.target.value = user.role || 'player';
                            }
                        }
                    } catch (error) {
                        UI.showToast('Failed: ' + error.message, 'error');
                        // Reset dropdown
                        const user = users.find(u => u.uuid === targetUUID);
                        if (user) {
                            e.target.value = user.role || 'player';
                        }
                    }
                });
            });
            
            // Bind ban buttons
            adminContent.querySelectorAll('.ban-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const targetUUID = e.target.dataset.uuid;
                    const banned = e.target.dataset.banned === 'true';
                    
                    try {
                        const result = await API.banUser(targetUUID, banned);
                        if (result.success) {
                            UI.showToast(`User ${banned ? 'banned' : 'unbanned'}`, 'success');
                            this.showUserManagement(); // Refresh
                        } else {
                            UI.showToast(result.error || 'Failed to update user', 'error');
                        }
                    } catch (error) {
                        UI.showToast('Failed: ' + error.message, 'error');
                    }
                });
            });
            
        } catch (error) {
            UI.showError(adminContent, 'Failed to load users: ' + error.message);
        }
    },
    
    /**
     * Show XP award panel
     */
    /**
     * Show consumables management panel
     */
    async showConsumablesManagement() {
        const adminContent = UI.elements.adminContent;
        if (!adminContent) return;
        
        UI.showLoading(adminContent, 'Loading consumables...');
        
        try {
            const result = await API.getConsumables();
            if (!result.success) {
                UI.showError(adminContent, 'Failed to load consumables: ' + result.error);
                return;
            }
            
            const consumables = result.data.consumables || [];
            
            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); flex-wrap: wrap; gap: var(--space-sm);">
                    <h2 style="margin: 0;">Consumables Management</h2>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
                        <button class="btn btn-secondary" id="btn-export-consumables">📥 Export CSV</button>
                        <label class="btn btn-secondary" style="cursor: pointer; margin: 0;">
                            📤 Import CSV
                            <input type="file" id="file-input-consumables" accept=".csv" style="display: none;">
                        </label>
                        <button class="btn btn-primary" id="btn-create-consumable">➕ Create Consumable</button>
                    </div>
                </div>
                <p class="info-text" style="margin-bottom: var(--space-md);">
                    Registry path: <code>feud4/consumables/master/{slug}</code> — one document per item.
                    Slug must match personal inventory item id. Effects: fixed (<code>+10</code>) or dice (<code>1D</code>, <code>3D+5</code>, <code>-2D-5</code>).
                </p>
                <div class="admin-table-container" style="overflow-x: auto;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Effect</th>
                                <th>Timing</th>
                                <th>Stackable</th>
                                <th>RP Only</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            if (consumables.length === 0) {
                html += `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: var(--space-lg); color: var(--text-muted);">
                            No consumables found. Create one to get started.
                        </td>
                    </tr>
                `;
            } else {
                consumables.forEach(consumable => {
                    const effectDesc = API.formatConsumableEffectsSummary(consumable);
                    const durationDesc = (consumable.delay_seconds ? `${consumable.delay_seconds}s delay → ` : '')
                        + (consumable.duration_seconds ? `${consumable.duration_seconds}s` : 'instant');
                    html += `
                        <tr>
                            <td>${consumable.name || consumable.id}</td>
                            <td>${effectDesc}</td>
                            <td>${durationDesc}</td>
                            <td>${consumable.stackable ? 'Yes' : 'No'}</td>
                            <td>${consumable.rp_only ? 'Yes' : 'No'}</td>
                            <td>${consumable.disabled ? '<span style="color: var(--error);">Disabled</span>' : '<span style="color: var(--success);">Active</span>'}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" data-consumable-id="${consumable.id}" data-action="edit">Edit</button>
                                <button class="btn btn-sm ${consumable.disabled ? 'btn-success' : 'btn-warning'}" data-consumable-id="${consumable.id}" data-action="toggle">${consumable.disabled ? 'Enable' : 'Disable'}</button>
                                <button class="btn btn-sm btn-danger" data-consumable-id="${consumable.id}" data-action="delete">Delete</button>
                            </td>
                        </tr>
                    `;
                });
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            adminContent.innerHTML = html;
            
            // Bind event handlers
            document.getElementById('btn-create-consumable')?.addEventListener('click', () => {
                this.showConsumableForm();
            });

            document.getElementById('btn-export-consumables')?.addEventListener('click', () => {
                this.exportConsumablesToCSV(consumables);
            });

            document.getElementById('file-input-consumables')?.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    await this.importConsumablesFromCSV(file);
                    e.target.value = '';
                }
            });
            
            document.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const consumableId = e.target.closest('[data-consumable-id]').dataset.consumableId;
                    const consumable = consumables.find(c => c.id === consumableId);
                    if (consumable) {
                        this.showConsumableForm(consumable);
                    }
                });
            });
            
            document.querySelectorAll('[data-action="toggle"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const consumableId = e.target.closest('[data-consumable-id]').dataset.consumableId;
                    const consumable = consumables.find(c => c.id === consumableId);
                    if (consumable) {
                        const result = await API.updateConsumable(consumableId, {
                            disabled: !consumable.disabled
                        });
                        if (result.success) {
                            UI.showToast(`Consumable ${consumable.disabled ? 'enabled' : 'disabled'}`, 'success');
                            this.showConsumablesManagement();
                        } else {
                            UI.showToast('Failed: ' + result.error, 'error');
                        }
                    }
                });
            });
            
            document.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const consumableId = e.target.closest('[data-consumable-id]').dataset.consumableId;
                    const confirmed = await UI.showConfirmDialog({
                        title: 'Delete consumable?',
                        message: `Delete consumable "${consumableId}"? This cannot be undone.`,
                        confirmLabel: 'Delete',
                        danger: true
                    });
                    if (confirmed) {
                        const result = await API.deleteConsumable(consumableId);
                        if (result.success) {
                            UI.showToast('Consumable deleted', 'success');
                            this.showConsumablesManagement();
                        } else {
                            UI.showToast('Failed: ' + result.error, 'error');
                        }
                    }
                });
            });
            
        } catch (error) {
            UI.showError(adminContent, 'Error: ' + error.message);
        }
    },
    
    /**
     * Show consumable form (create or edit)
     */
    showConsumableForm(consumable = null) {
        const adminContent = UI.elements.adminContent;
        if (!adminContent) return;
        
        if (consumable) {
            consumable = API.normalizeConsumableData(consumable.id, consumable);
        }
        const isEdit = consumable !== null;
        const slug = consumable?.id || '';
        const esc = (v) => UI.escapeHtml(String(v ?? ''));
        const cat = consumable?.effect_category || 'healing';
        
        adminContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <h2>${isEdit ? 'Edit' : 'Create'} Consumable</h2>
                <button class="btn btn-secondary" id="btn-back-consumables">← Back</button>
            </div>
            <form id="consumable-form">
                <div class="form-group">
                    <label for="consumable-slug">Slug (ID) ${isEdit ? '(read-only)' : ''}</label>
                    <input type="text" id="consumable-slug" value="${esc(slug)}" ${isEdit ? 'readonly' : ''} placeholder="e.g., aged red wine" required>
                    <small>Lowercase; must match inventory item slug exactly.</small>
                </div>
                <div class="form-group">
                    <label for="consumable-name">Display name *</label>
                    <input type="text" id="consumable-name" value="${esc(consumable?.name || '')}" placeholder="Aged Red Wine" required>
                </div>
                <div class="form-group">
                    <label for="consumable-description">Description</label>
                    <textarea id="consumable-description" rows="3" placeholder="Restores health...">${esc(consumable?.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="consumable-icon">Icon filename (optional)</label>
                    <input type="text" id="consumable-icon" value="${esc(consumable?.icon || '')}" placeholder="aged_red_wine.png">
                </div>
                <div class="form-group">
                    <label for="consumable-effect-category">Effect category *</label>
                    <select id="consumable-effect-category" required>
                        <option value="food" ${cat === 'food' ? 'selected' : ''}>Food (EAT)</option>
                        <option value="beverage" ${cat === 'beverage' ? 'selected' : ''}>Beverage (DRINK)</option>
                        <option value="healing" ${cat === 'healing' ? 'selected' : ''}>Healing</option>
                        <option value="poison" ${cat === 'poison' ? 'selected' : ''}>Poison</option>
                        <option value="antidote" ${cat === 'antidote' ? 'selected' : ''}>Antidote</option>
                        <option value="alcohol" ${cat === 'alcohol' ? 'selected' : ''}>Alcohol</option>
                        <option value="intoxicant" ${cat === 'intoxicant' ? 'selected' : ''}>Intoxicant</option>
                    </select>
                    <small id="consumable-category-help"></small>
                </div>
                <div class="form-group" id="poison-id-group" style="display: none;">
                    <label for="consumable-poison-id">Poison ID</label>
                    <input type="text" id="consumable-poison-id" value="${esc(consumable?.poison_id || slug)}" placeholder="nightshade">
                    <small>Stable id for antidote matching. Defaults to slug if blank.</small>
                </div>
                <div class="form-group" id="cures-poison-group" style="display: none;">
                    <label for="consumable-cures-poison">Cures poison IDs</label>
                    <input type="text" id="consumable-cures-poison" value="${esc(consumable?.cures_poison || '')}" placeholder="nightshade, bad_ale">
                    <small>Comma-separated poison_id values this antidote removes.</small>
                </div>
                <fieldset id="consumable-resource-fieldset" style="border: 1px solid var(--border-color); padding: var(--space-md); margin-bottom: var(--space-md); border-radius: 4px;">
                    <legend id="consumable-resource-legend" style="padding: 0 var(--space-xs);">Resource changes</legend>
                    <div class="form-group">
                        <label for="consumable-effect-health">Health</label>
                        <input type="text" id="consumable-effect-health" value="${esc(consumable?.effect_health ?? consumable?.effect_value ?? '0')}" placeholder="0, 1D, 3D+5, +10">
                    </div>
                    <div class="form-group">
                        <label for="consumable-effect-stamina">Stamina</label>
                        <input type="text" id="consumable-effect-stamina" value="${esc(consumable?.effect_stamina ?? '0')}" placeholder="0, 1D, +5">
                    </div>
                    <div class="form-group">
                        <label for="consumable-effect-mana">Mana</label>
                        <input type="text" id="consumable-effect-mana" value="${esc(consumable?.effect_mana ?? '0')}" placeholder="0, 1D">
                    </div>
                    <small>Dice uses d20 per die. Plain number or +N is fixed. Examples: <code>1D</code>, <code>3D+5</code>, <code>-2D-5</code>, <code>+10</code>.</small>
                </fieldset>
                <div class="form-group" id="consumable-timing-group">
                    <label for="consumable-delay">Delay (seconds)</label>
                    <input type="number" id="consumable-delay" value="${consumable?.delay_seconds ?? 0}" min="0" required>
                    <small id="consumable-delay-help">Time after drinking before health/stamina/mana change applies (0 = immediate).</small>
                </div>
                <div class="form-group" id="consumable-duration-group">
                    <label for="consumable-duration">Duration (seconds)</label>
                    <input type="number" id="consumable-duration" value="${consumable?.duration_seconds ?? 0}" min="0" required>
                    <small id="consumable-duration-help">How long the effect stays active on the buff bar after it applies (0 = instant, no buff icon).</small>
                </div>
                <div class="form-group" id="consumable-stackable-group">
                    <label>
                        <input type="checkbox" id="consumable-stackable" ${consumable?.stackable ? 'checked' : ''}>
                        Stackable effects
                    </label>
                    <small>If checked, drinking again while an effect is active adds another application (e.g. second wine stacks penalties). Unchecked replaces the existing effect for this item.</small>
                </div>
                <div class="form-group" id="max-stack-group" style="${consumable?.stackable ? '' : 'display: none;'}">
                    <label for="consumable-max-stack">Max Stack *</label>
                    <input type="number" id="consumable-max-stack" value="${consumable?.max_stack || 1}" min="1" required>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="consumable-rp-only" ${consumable?.rp_only ? 'checked' : ''}>
                        RP Only (usable only in RP mode)
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="consumable-disabled" ${consumable?.disabled ? 'checked' : ''}>
                        Disabled
                    </label>
                </div>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Consumable</button>
            </form>
        `;
        
        // Show/hide max_stack based on stackable
        document.getElementById('consumable-stackable')?.addEventListener('change', (e) => {
            const maxStackGroup = document.getElementById('max-stack-group');
            if (maxStackGroup) {
                maxStackGroup.style.display = e.target.checked ? 'block' : 'none';
                if (!e.target.checked) {
                    document.getElementById('consumable-max-stack').value = '1';
                }
            }
        });

        const syncConsumableCategoryUI = () => {
            const category = document.getElementById('consumable-effect-category')?.value || 'healing';
            const isInstant = category === 'food' || category === 'beverage';
            const timingGroup = document.getElementById('consumable-timing-group');
            const durationGroup = document.getElementById('consumable-duration-group');
            const stackableGroup = document.getElementById('consumable-stackable-group');
            const legend = document.getElementById('consumable-resource-legend');
            const categoryHelp = document.getElementById('consumable-category-help');
            const poisonGroup = document.getElementById('poison-id-group');
            const curesGroup = document.getElementById('cures-poison-group');
            if (poisonGroup) {
                poisonGroup.style.display = category === 'poison' ? '' : 'none';
            }
            if (curesGroup) {
                curesGroup.style.display = category === 'antidote' ? '' : 'none';
            }
            if (isInstant) {
                if (timingGroup) timingGroup.style.display = 'none';
                if (durationGroup) durationGroup.style.display = 'none';
                if (stackableGroup) stackableGroup.style.display = 'none';
                document.getElementById('consumable-delay').value = '0';
                document.getElementById('consumable-duration').value = '0';
                if (legend) legend.textContent = 'Resource changes (rolled on each use; instant)';
                if (categoryHelp) {
                    categoryHelp.textContent = category === 'food'
                        ? 'Food is eaten — instant effect every time.'
                        : 'Beverage is drunk — instant effect every time.';
                }
            } else {
                if (timingGroup) timingGroup.style.display = '';
                if (durationGroup) durationGroup.style.display = '';
                if (stackableGroup) stackableGroup.style.display = '';
                if (legend) legend.textContent = 'Resource changes (rolled once after delay)';
                if (categoryHelp) {
                    categoryHelp.textContent = 'Alcohol/intoxicant apply impairment while active. Poison/antidote use meta fields above.';
                }
            }
        };
        document.getElementById('consumable-effect-category')?.addEventListener('change', syncConsumableCategoryUI);
        syncConsumableCategoryUI();
        
        // Back button
        document.getElementById('btn-back-consumables')?.addEventListener('click', () => {
            this.showConsumablesManagement();
        });
        
        // Form submit
        document.getElementById('consumable-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const slug = document.getElementById('consumable-slug').value.trim();
            const name = document.getElementById('consumable-name').value.trim();
            const description = document.getElementById('consumable-description').value.trim();
            const icon = document.getElementById('consumable-icon').value.trim();
            const effectCategory = document.getElementById('consumable-effect-category').value;
            const isInstant = effectCategory === 'food' || effectCategory === 'beverage';
            let delaySeconds = parseInt(document.getElementById('consumable-delay').value, 10) || 0;
            let duration = parseInt(document.getElementById('consumable-duration').value, 10) || 0;
            if (isInstant) {
                delaySeconds = 0;
                duration = 0;
            }
            const effectHealth = document.getElementById('consumable-effect-health').value.trim() || '0';
            const effectStamina = document.getElementById('consumable-effect-stamina').value.trim() || '0';
            const effectMana = document.getElementById('consumable-effect-mana').value.trim() || '0';
            const poisonId = document.getElementById('consumable-poison-id').value.trim();
            const curesPoison = document.getElementById('consumable-cures-poison').value.trim();
            const stackable = document.getElementById('consumable-stackable').checked;
            const maxStack = stackable ? (parseInt(document.getElementById('consumable-max-stack').value, 10) || 1) : 1;
            const rpOnly = document.getElementById('consumable-rp-only').checked;
            const disabled = document.getElementById('consumable-disabled').checked;
            
            if (!name || delaySeconds < 0 || duration < 0 || maxStack < 1) {
                UI.showToast('Please fill in all required fields correctly', 'warning');
                return;
            }
            
            const payload = {
                name,
                description,
                icon,
                effect_category: effectCategory,
                effect_health: effectHealth,
                effect_stamina: effectStamina,
                effect_mana: effectMana,
                poison_id: poisonId,
                cures_poison: curesPoison,
                delay_seconds: delaySeconds,
                duration_seconds: duration,
                effect_type: effectCategory,
                stackable,
                max_stack: maxStack,
                rp_only: rpOnly,
                disabled
            };
            
            try {
                let result;
                if (isEdit) {
                    result = await API.updateConsumable(slug, payload);
                } else {
                    result = await API.createConsumable({ slug, ...payload });
                }
                
                if (result.success) {
                    UI.showToast(`Consumable ${isEdit ? 'updated' : 'created'}`, 'success');
                    this.showConsumablesManagement();
                } else {
                    UI.showToast('Failed: ' + result.error, 'error');
                }
            } catch (error) {
                UI.showToast('Error: ' + error.message, 'error');
            }
        });
    },

    exportConsumablesToCSV(consumables) {
        try {
            const headers = [
                'slug', 'name', 'description', 'icon', 'effect_category',
                'effect_health', 'effect_stamina', 'effect_mana',
                'poison_id', 'cures_poison',
                'delay_seconds', 'duration_seconds', 'stackable', 'max_stack', 'rp_only', 'disabled'
            ];
            const rows = (consumables || []).map(c => {
                const row = [
                    c.id || '',
                    c.name || '',
                    (c.description || '').replace(/"/g, '""'),
                    c.icon || '',
                    c.effect_category || '',
                    c.effect_health ?? '0',
                    c.effect_stamina ?? '0',
                    c.effect_mana ?? '0',
                    c.poison_id || '',
                    c.cures_poison || '',
                    c.delay_seconds ?? 0,
                    c.duration_seconds ?? 0,
                    c.stackable ? 'true' : 'false',
                    c.max_stack ?? 1,
                    c.rp_only ? 'true' : 'false',
                    c.disabled ? 'true' : 'false'
                ];
                return row.map((field, index) => {
                    const str = String(field);
                    if (index === 2 || str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                }).join(',');
            });
            const csvContent = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', `consumables_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            UI.showToast('Consumables exported to CSV', 'success');
        } catch (error) {
            console.error('[exportConsumablesToCSV]', error);
            UI.showToast('Failed to export: ' + error.message, 'error');
        }
    },

    parseConsumableCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    },

    async importConsumablesFromCSV(file) {
        try {
            UI.showToast('Reading consumables CSV...', 'info');
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) {
                UI.showToast('CSV must have a header row and at least one data row', 'warning');
                return;
            }
            const headers = this.parseConsumableCSVLine(lines[0]).map(h => h.trim().toLowerCase());
            const slugIdx = headers.indexOf('slug');
            const nameIdx = headers.indexOf('name');
            if (slugIdx < 0 || nameIdx < 0) {
                UI.showToast('CSV must include slug and name columns', 'warning');
                return;
            }
            const col = (name) => headers.indexOf(name);
            let imported = 0;
            let failed = 0;
            for (let i = 1; i < lines.length; i++) {
                const cells = this.parseConsumableCSVLine(lines[i]);
                const slug = (cells[slugIdx] || '').trim().toLowerCase();
                const name = (cells[nameIdx] || '').trim();
                if (!slug || !name) {
                    failed++;
                    continue;
                }
                const get = (colName, fallback = '') => {
                    const idx = col(colName);
                    return idx >= 0 ? (cells[idx] || '').trim() : fallback;
                };
                const data = {
                    slug,
                    name,
                    description: get('description'),
                    icon: get('icon'),
                    effect_category: get('effect_category', 'healing'),
                    effect_health: get('effect_health', '0'),
                    effect_stamina: get('effect_stamina', '0'),
                    effect_mana: get('effect_mana', '0'),
                    poison_id: get('poison_id'),
                    cures_poison: get('cures_poison'),
                    delay_seconds: parseInt(get('delay_seconds', '0'), 10) || 0,
                    duration_seconds: parseInt(get('duration_seconds', '0'), 10) || 0,
                    stackable: get('stackable', 'false').toLowerCase() === 'true',
                    max_stack: parseInt(get('max_stack', '1'), 10) || 1,
                    rp_only: get('rp_only', 'false').toLowerCase() === 'true',
                    disabled: get('disabled', 'false').toLowerCase() === 'true'
                };
                const existing = await db.collection('feud4').doc('consumables').collection('master').doc(slug).get();
                const result = existing.exists
                    ? await API.updateConsumable(slug, data)
                    : await API.createConsumable(data);
                if (result.success) {
                    imported++;
                } else {
                    failed++;
                    console.error('[importConsumablesFromCSV]', slug, result.error);
                }
            }
            UI.showToast(`Import complete: ${imported} saved${failed ? `, ${failed} failed` : ''}`, imported ? 'success' : 'warning');
            this.showConsumablesManagement();
        } catch (error) {
            console.error('[importConsumablesFromCSV]', error);
            UI.showToast('Failed to import: ' + error.message, 'error');
        }
    },
    
    showXPAward() {
        const adminContent = UI.elements.adminContent;
        
        adminContent.innerHTML = `
            <h3>⭐ Award XP / Give Items</h3>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">Grant XP via Firestore, or give inventory items to an online player via their HUD (Experience KVP).</p>
            
            <h4 style="margin-top: var(--space-lg); color: var(--gold-light);">Award XP</h4>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-md); font-size: 0.95em;">Enter a character ID or player UUID.</p>
            <div class="form-group">
                <label for="xp-target">Target Character ID or Player UUID</label>
                <input type="text" id="xp-target" placeholder="Enter character ID or player UUID...">
            </div>
            <div class="form-group">
                <label for="xp-amount">XP Amount</label>
                <input type="number" id="xp-amount" value="100" min="1">
            </div>
            <div class="form-group">
                <label for="xp-reason">Reason (Optional)</label>
                <input type="text" id="xp-reason" placeholder="Quest completion, roleplay excellence, etc...">
            </div>
            <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg);">
                <button class="action-btn primary" id="btn-award-xp">⭐ Award XP</button>
                <button class="action-btn secondary" id="btn-clear-xp">Clear XP Form</button>
            </div>
            <div id="xp-result" style="margin-bottom: var(--space-lg);"></div>
            
            <hr style="border: none; border-top: 1px solid var(--border-color); margin: var(--space-lg) 0;">
            
            <h4 style="color: var(--gold-light);">Give Item (in-world inventory)</h4>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-md); font-size: 0.95em;">Player must be online with HUD attached. Items go to Experience KVP inventory (not Firestore).</p>
            <div class="form-group">
                <label for="item-target">Target Player UUID</label>
                <input type="text" id="item-target" placeholder="Second Life UUID of the player...">
            </div>
            <div class="form-group">
                <label for="item-name">Item slug</label>
                <input type="text" id="item-name" placeholder="e.g. health_potion, iron_ore">
                <small style="color: var(--text-muted);">Lowercase item id. Not for gold/silver/copper coins — use Give Coins.</small>
            </div>
            <div class="form-group">
                <label for="item-amount">Quantity</label>
                <input type="number" id="item-amount" value="1" min="1">
            </div>
            <div class="form-group">
                <label for="item-reason">Reason (Optional)</label>
                <input type="text" id="item-reason" placeholder="Event prize, compensation, etc...">
            </div>
            <div style="display: flex; gap: var(--space-sm);">
                <button class="action-btn primary" id="btn-give-item">📦 Give Item via HUD</button>
                <button class="action-btn secondary" id="btn-clear-item">Clear Item Form</button>
            </div>
            <div id="item-result" style="margin-top: var(--space-md);"></div>
        `;
        
        const clearXpForm = () => {
            document.getElementById('xp-target').value = '';
            document.getElementById('xp-amount').value = '100';
            document.getElementById('xp-reason').value = '';
            document.getElementById('xp-result').innerHTML = '';
        };
        
        const clearItemForm = () => {
            document.getElementById('item-target').value = '';
            document.getElementById('item-name').value = '';
            document.getElementById('item-amount').value = '1';
            document.getElementById('item-reason').value = '';
            document.getElementById('item-result').innerHTML = '';
        };
        
        document.getElementById('btn-clear-xp')?.addEventListener('click', clearXpForm);
        document.getElementById('btn-clear-item')?.addEventListener('click', clearItemForm);
        
        document.getElementById('btn-award-xp')?.addEventListener('click', async () => {
            const target = document.getElementById('xp-target').value.trim();
            const amount = parseInt(document.getElementById('xp-amount').value);
            const reason = document.getElementById('xp-reason').value.trim();
            
            if (!target || !amount || amount <= 0) {
                UI.showToast('Please enter valid target and positive XP amount', 'warning');
                return;
            }
            
            const resultDiv = document.getElementById('xp-result');
            resultDiv.innerHTML = '<p style="color: var(--text-muted);">Granting XP...</p>';
            
            try {
                const result = await API.awardXP(target, amount, reason);
                if (result.success) {
                    resultDiv.innerHTML = `
                        <div style="padding: var(--space-md); background: var(--success-bg); border: 1px solid var(--success); border-radius: 4px;">
                            <p style="color: var(--success); font-weight: bold;">✅ Successfully granted ${amount} XP!</p>
                            ${result.data?.newTotal ? `<p style="color: var(--text-secondary);">New Total: ${result.data.newTotal} XP</p>` : ''}
                        </div>
                    `;
                    UI.showToast(`Awarded ${amount} XP!`, 'success');
                    // Clear target for next grant
                    document.getElementById('xp-target').value = '';
                    document.getElementById('xp-reason').value = '';
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div style="padding: var(--space-md); background: var(--error-bg); border: 1px solid var(--error); border-radius: 4px;">
                        <p style="color: var(--error); font-weight: bold;">❌ Failed to award XP</p>
                        <p style="color: var(--text-secondary);">${error.message}</p>
                    </div>
                `;
                UI.showToast('Failed: ' + error.message, 'error');
            }
        });

        document.getElementById('btn-give-item')?.addEventListener('click', () => {
            const target = document.getElementById('item-target').value.trim();
            const itemName = document.getElementById('item-name').value.trim().toLowerCase();
            const amount = parseInt(document.getElementById('item-amount').value, 10) || 1;
            const reason = document.getElementById('item-reason').value.trim();

            if (!target || !itemName) {
                UI.showToast('Enter target UUID and item slug', 'warning');
                return;
            }
            if (amount <= 0) {
                UI.showToast('Quantity must be positive', 'warning');
                return;
            }
            const blockedItems = ['gold coin', 'silver coin', 'copper coin'];
            if (blockedItems.includes(itemName)) {
                UI.showToast('Use Give Coins for currency', 'error');
                return;
            }

            const resultDiv = document.getElementById('item-result');
            resultDiv.innerHTML = '<p style="color: var(--text-muted);">Sending to player HUD...</p>';

            this.sendToLSL('ADMIN_GIVE_ITEM', {
                target_uuid: target,
                item_name: itemName,
                amount: String(amount),
                reason: reason
            });

            resultDiv.innerHTML = `
                <div style="padding: var(--space-md); background: var(--success-bg); border: 1px solid var(--success); border-radius: 4px;">
                    <p style="color: var(--success); font-weight: bold;">✅ Sent ${amount}× ${itemName} to HUD channel</p>
                    <p style="color: var(--text-secondary); font-size: 0.9em;">Player must be online with HUD attached.${reason ? ' Reason: ' + reason : ''}</p>
                </div>
            `;
            UI.showToast(`Gave ${amount}× ${itemName} via HUD`, 'success');
            document.getElementById('item-target').value = '';
            document.getElementById('item-name').value = '';
            document.getElementById('item-amount').value = '1';
            document.getElementById('item-reason').value = '';
        });
    },
    
    showGiveItem() {
        this.showXPAward();
    },
    
    /**
     * Show Give Coins admin panel
     */
    showGiveCoins() {
        const adminContent = UI.elements.adminContent;
        
        adminContent.innerHTML = `
            <h3>💰 Give Coins</h3>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">Grant currency to a character. Enter gold, silver, and/or copper amounts.</p>
            <div class="form-group">
                <label for="coins-target">Target Character ID or Player UUID</label>
                <input type="text" id="coins-target" placeholder="Enter character ID or player UUID...">
                <small style="color: var(--text-muted);">Character ID (preferred) or Second Life UUID</small>
            </div>
            <div class="form-group">
                <label for="coins-gold">Gold</label>
                <input type="number" id="coins-gold" value="0" min="0">
            </div>
            <div class="form-group">
                <label for="coins-silver">Silver</label>
                <input type="number" id="coins-silver" value="0" min="0">
            </div>
            <div class="form-group">
                <label for="coins-copper">Copper</label>
                <input type="number" id="coins-copper" value="0" min="0">
            </div>
            <div class="form-group">
                <label for="coins-reason">Reason (Optional)</label>
                <input type="text" id="coins-reason" placeholder="Compensation, event prize, etc...">
            </div>
            <div style="display: flex; gap: var(--space-sm);">
                <button class="action-btn primary" id="btn-give-coins">💰 Give Coins</button>
                <button class="action-btn secondary" id="btn-clear-coins">Clear</button>
            </div>
            <div id="coins-result" style="margin-top: var(--space-md);"></div>
        `;
        
        const clearForm = () => {
            document.getElementById('coins-target').value = '';
            document.getElementById('coins-gold').value = '0';
            document.getElementById('coins-silver').value = '0';
            document.getElementById('coins-copper').value = '0';
            document.getElementById('coins-reason').value = '';
            document.getElementById('coins-result').innerHTML = '';
        };
        
        document.getElementById('btn-clear-coins')?.addEventListener('click', clearForm);
        
        document.getElementById('btn-give-coins')?.addEventListener('click', async () => {
            const target = document.getElementById('coins-target').value.trim();
            const gold = parseInt(document.getElementById('coins-gold').value) || 0;
            const silver = parseInt(document.getElementById('coins-silver').value) || 0;
            const copper = parseInt(document.getElementById('coins-copper').value) || 0;
            const reason = document.getElementById('coins-reason').value.trim();
            
            if (!target) {
                UI.showToast('Please enter a target character ID or UUID', 'warning');
                return;
            }
            
            if (gold <= 0 && silver <= 0 && copper <= 0) {
                UI.showToast('Please enter at least one positive currency amount', 'warning');
                return;
            }
            
            const resultDiv = document.getElementById('coins-result');
            resultDiv.innerHTML = '<p style="color: var(--text-muted);">Giving coins...</p>';
            
            try {
                const result = await API.giveCoins(target, gold, silver, copper, reason);
                if (result.success) {
                    const amountText = [];
                    if (gold > 0) amountText.push(`${gold} gold`);
                    if (silver > 0) amountText.push(`${silver} silver`);
                    if (copper > 0) amountText.push(`${copper} copper`);
                    
                    resultDiv.innerHTML = `
                        <div style="padding: var(--space-md); background: var(--success-bg); border: 1px solid var(--success); border-radius: 4px;">
                            <p style="color: var(--success); font-weight: bold;">✅ Successfully gave ${amountText.join(', ')}!</p>
                        </div>
                    `;
                    UI.showToast(`Gave ${amountText.join(', ')}!`, 'success');
                    // Clear target for next grant
                    document.getElementById('coins-target').value = '';
                    document.getElementById('coins-gold').value = '0';
                    document.getElementById('coins-silver').value = '0';
                    document.getElementById('coins-copper').value = '0';
                    document.getElementById('coins-reason').value = '';
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div style="padding: var(--space-md); background: var(--error-bg); border: 1px solid var(--error); border-radius: 4px;">
                        <p style="color: var(--error); font-weight: bold;">❌ Failed to give coins</p>
                        <p style="color: var(--text-secondary);">${error.message}</p>
                    </div>
                `;
                UI.showToast('Failed: ' + error.message, 'error');
            }
        });
    },
    
    /**
     * Show universe management panel
     */
    async showUniverseManagement() {
        const adminContent = UI.elements.adminContent;
        if (!adminContent) return;
        
        if (!API.canAccessUniverseManagement()) {
            UI.showError(adminContent, 'Unauthorized: You do not have permission to manage universes.');
            return;
        }

        const canCreateNew = API.canCreateUniverse();
        
        UI.showLoading(adminContent, 'Loading universes...');
        
        try {
            const result = await API.listUniversesForAdmin();
            if (!result.success) {
                UI.showError(adminContent, 'Failed to load universes: ' + result.error);
                return;
            }
            
            const universes = result.data.universes || [];
            
            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                    <h2>Universe Management</h2>
                    ${canCreateNew ? '<button class="btn btn-primary" id="btn-create-universe">➕ Create Universe</button>' : ''}
                </div>
                <div class="admin-table-container" style="overflow-x: auto;">
                    <table class="admin-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Theme</th>
                                <th>Status</th>
                                <th>Access</th>
                                <th>Owner</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            if (universes.length === 0) {
                html += `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: var(--space-lg); color: var(--text-muted);">
                            No universes found. Create one to get started.
                        </td>
                    </tr>
                `;
            } else {
                // Build rows with permission checks
                for (const universe of universes) {
                    const isDefault = universe.id === 'default';
                    const canEdit = await API.canEditUniverse(universe.id, universe);
                    const canDelete = !isDefault && await API.canDeleteUniverse(universe.id);
                    
                    html += `
                        <tr>
                            <td><strong>${universe.name || universe.id}</strong>${isDefault ? ' <span style="color: var(--text-muted);">(Default)</span>' : ''}</td>
                            <td>${universe.theme || '-'}</td>
                            <td>
                                <span style="color: ${universe.active ? 'var(--success)' : 'var(--text-muted)'};">
                                    ${universe.active ? '✓ Active' : '○ Inactive'}
                                </span>
                            </td>
                            <td>${universe.acceptNewPlayers || 'open'}</td>
                            <td>${universe.ownerAdminId || 'System'}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" data-universe-id="${universe.id}" data-action="edit" ${!canEdit ? 'disabled title="You cannot edit this universe"' : ''}>
                                    ✏️ Edit
                                </button>
                                ${canDelete ? `
                                    <button class="btn btn-sm btn-danger" data-universe-id="${universe.id}" data-action="delete">
                                        🗑️ Delete
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                }
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            adminContent.innerHTML = html;
            
            // Bind create button
            document.getElementById('btn-create-universe')?.addEventListener('click', () => {
                this.showUniverseEditor(null);
            });
            
            // Bind edit/delete buttons
            adminContent.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const universeId = e.target.closest('[data-universe-id]').dataset.universeId;
                    this.showUniverseEditor(universeId);
                });
            });
            
            adminContent.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const universeId = e.target.closest('[data-universe-id]').dataset.universeId;
                    const confirmed = await UI.showConfirmDialog({
                        title: 'Delete universe?',
                        message: 'Are you sure you want to delete this universe? All characters in this universe will be reassigned to the Default Universe.',
                        confirmLabel: 'Delete',
                        danger: true
                    });
                    if (confirmed) {
                        const result = await API.deleteUniverse(universeId);
                        if (result.success) {
                            UI.showToast(`Universe deleted. ${result.data.charactersReassigned || 0} characters reassigned to Default Universe.`, 'success');
                            this.showUniverseManagement();
                        } else {
                            UI.showToast('Failed to delete universe: ' + result.error, 'error');
                        }
                    }
                });
            });
        } catch (error) {
            UI.showError(adminContent, 'Failed to load universes: ' + error.message);
        }
    },
    
    /**
     * Render two-panel checkbox UI for universe identity management
     * @param {string} type - 'classes', 'species', or 'genders' (and legacy 'careers' if re-enabled)
     * @param {Array} allItems - All available items globally
     * @param {Array} allowedItems - Items currently allowed in universe (empty array = allow all)
     * @param {string} containerId - ID of container element
     */
    renderUniverseIdentityPanels(type, allItems, allowedItems, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Determine if empty array means "allow all" (true) or "allow none" (false)
        const emptyMeansAll = allowedItems.length === 0 || (allowedItems.length === 0 && allItems.length > 0);
        
        // Split items into included and excluded
        const included = [];
        const excluded = [];
        
        allItems.forEach(item => {
            if (emptyMeansAll || allowedItems.includes(item.id)) {
                included.push(item);
            } else {
                excluded.push(item);
            }
        });
        
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const checkboxClass = `universe-allowed-${type}`;
        
        let html = `
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                <!-- Panel A: Included Items -->
                <div class="panel" style="padding: var(--space-md);">
                    <h3>Included ${typeLabel}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: var(--space-sm);">
                        These ${type} are currently allowed in this universe.
                    </p>
                    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); padding: var(--space-xs); border-radius: 4px;">
                        ${included.length === 0 ? `
                            <p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">
                                No ${type} included. All ${type} are allowed by default.
                            </p>
                        ` : included.map(item => `
                            <label style="display: block; padding: 6px; cursor: pointer; border-radius: 4px; transition: background 0.2s;" 
                                   onmouseover="this.style.background='var(--bg-hover)'" 
                                   onmouseout="this.style.background=''">
                                <input type="checkbox" value="${item.id}" class="${checkboxClass}" checked>
                                <span style="margin-left: 8px;">${item.name || item.id}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Panel B: Excluded Items -->
                <div class="panel" style="padding: var(--space-md);">
                    <h3>Excluded ${typeLabel}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: var(--space-sm);">
                        These ${type} are not allowed in this universe.
                    </p>
                    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); padding: var(--space-xs); border-radius: 4px;">
                        ${excluded.length === 0 ? `
                            <p style="color: var(--text-muted); text-align: center; padding: var(--space-md);">
                                All ${type} are included.
                            </p>
                        ` : excluded.map(item => `
                            <label style="display: block; padding: 6px; cursor: pointer; border-radius: 4px; transition: background 0.2s;" 
                                   onmouseover="this.style.background='var(--bg-hover)'" 
                                   onmouseout="this.style.background=''">
                                <input type="checkbox" value="${item.id}" class="${checkboxClass}">
                                <span style="margin-left: 8px;">${item.name || item.id}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Bind checkbox change handlers to move items between panels
        container.querySelectorAll(`.${checkboxClass}`).forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                // Re-render panels when checkbox state changes
                this.renderUniverseIdentityPanels(type, allItems, this.getCheckedItems(checkboxClass), containerId);
            });
        });
    },
    
    /**
     * Get checked items from checkboxes
     * @param {string} checkboxClass - CSS class of checkboxes
     * @returns {Array} Array of checked item IDs
     */
    getCheckedItems(checkboxClass) {
        const allCheckboxes = Array.from(document.querySelectorAll(`.${checkboxClass}`));
        const checked = Array.from(document.querySelectorAll(`.${checkboxClass}:checked`));
        
        // If all are checked, return empty array (means "allow all")
        if (checked.length === allCheckboxes.length) {
            return [];
        }
        
        return checked.map(cb => cb.value);
    },
    
    /**
     * Show universe editor (create or edit) - TABBED VERSION
     */
    async showUniverseEditor(universeId) {
        const adminContent = UI.elements.adminContent;
        if (!adminContent) return;
        
        const isEdit = universeId !== null;
        let universe = null;
        
        if (isEdit) {
            UI.showLoading(adminContent, 'Loading universe...');
            const result = await API.getUniverse(universeId);
            if (!result.success) {
                UI.showError(adminContent, 'Failed to load universe: ' + result.error);
                return;
            }
            universe = result.data.universe;
            
            // Check permissions
            const canEdit = await API.canEditUniverse(universeId);
            if (!canEdit) {
                UI.showError(adminContent, 'Unauthorized: You cannot edit this universe.');
                return;
            }
            
            // Check if Default Universe
            if (universeId === 'default' && API.role !== 'sys_admin' && API.uuid !== API.SUPER_ADMIN_UUID) {
                UI.showError(adminContent, 'Unauthorized: Only System Admins can edit the Default Universe.');
                return;
            }
        } else {
            // Creating new universe - check permission
            if (!API.canCreateUniverse()) {
                UI.showError(adminContent, 'Unauthorized: You cannot create universes.');
                return;
            }
        }
        
        // Load templates for allowed lists
        const [speciesResult, classesResult, gendersResult] = await Promise.all([
            API.getSpecies(),
            API.getClasses(),
            API.getGenders()
        ]);
        
        const allSpecies = speciesResult.success ? speciesResult.data.species : [];
        const allClasses = classesResult.success ? classesResult.data.classes : [];
        const allGenders = gendersResult.success ? gendersResult.data.genders : [];
        
        // Build tabbed interface HTML
        let html = `
            <div style="margin-bottom: var(--space-md);">
                <button class="btn btn-secondary" id="btn-universe-back">← Back to List</button>
            </div>
            <h2>${isEdit ? 'Edit Universe' : 'Create Universe'}</h2>
            
            <!-- Tab Navigation -->
            <div class="tab-nav" style="display: flex; gap: var(--space-xs); border-bottom: 2px solid var(--border-color); margin-bottom: var(--space-md); flex-wrap: wrap;">
                <button class="tab-btn active" data-tab="profile">Profile</button>
                <button class="tab-btn" data-tab="identity">Identity</button>
                <!-- Careers tab removed: it duplicated the Classes list (getClasses); allowedCareers was not enforced in validation. Re-enable when vocations/careers are a distinct template type. -->
                <!-- <button class="tab-btn" data-tab="careers">Careers</button> -->
                <button class="tab-btn" data-tab="classes">Classes</button>
                <button class="tab-btn" data-tab="species">Species</button>
                <button class="tab-btn" data-tab="genders">Genders</button>
                <button class="tab-btn" data-tab="rules">Rules</button>
                <button class="tab-btn" data-tab="access">Access</button>
                ${isEdit ? '<button class="tab-btn" data-tab="admins">Admins</button>' : ''}
            </div>
            
            <!-- Tab Content Container -->
            <div id="universe-tab-content" style="min-height: 400px;">
                <!-- Content will be loaded dynamically -->
            </div>
            
            <!-- Actions (always visible) -->
            <div style="display: flex; gap: var(--space-sm); justify-content: flex-end; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--border-color);">
                <button type="button" class="btn btn-secondary" id="btn-universe-cancel">Cancel</button>
                <button type="button" class="btn btn-primary" id="btn-universe-save">${isEdit ? 'Save Changes' : 'Create Universe'}</button>
            </div>
        `;
        
        adminContent.innerHTML = html;
        
        // Store universe data for tab functions
        this.currentUniverseData = universe;
        this.currentUniverseId = universeId;
        this.isEditingUniverse = isEdit;
        
        // Load and show Profile tab by default
        await this.showUniverseTab('profile', universeId, universe, isEdit);
        
        // Bind tab navigation
        adminContent.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                // Remove active class from all tabs
                adminContent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Load tab content
                const tabName = btn.dataset.tab;
                await this.showUniverseTab(tabName, universeId, universe, isEdit);
            });
        });
        
        // Bind save button
        document.getElementById('btn-universe-save')?.addEventListener('click', async () => {
            await this.saveUniverseFromTabs(universeId);
        });
        
        // Bind cancel/back buttons
        document.getElementById('btn-universe-back')?.addEventListener('click', () => {
            this.showUniverseManagement();
        });
        document.getElementById('btn-universe-cancel')?.addEventListener('click', () => {
            this.showUniverseManagement();
        });
        
        // Load admins if editing (for Admins tab)
        if (isEdit) {
            const canAssign = await API.canAssignUniverseAdmin(universeId);
            this.canAssignUniverseAdmin = canAssign;
        }
        
    },
    
    /**
     * Show content for a specific universe editor tab
     */
    async showUniverseTab(tabName, universeId, universe, isEdit) {
        const tabContent = document.getElementById('universe-tab-content');
        if (!tabContent) return;
        
        switch(tabName) {
            case 'profile':
                await this.showUniverseProfileTab(tabContent, universeId, universe, isEdit);
                break;
            case 'identity':
                await this.showUniverseIdentityTab(tabContent, universeId, universe, isEdit);
                break;
            // case 'careers': // removed from UI — same data as Classes until careers/vocations split exists
            //     await this.showUniverseCareersTab(tabContent, universeId, universe, isEdit);
            //     break;
            case 'classes':
                await this.showUniverseClassesTab(tabContent, universeId, universe, isEdit);
                break;
            case 'species':
                await this.showUniverseSpeciesTab(tabContent, universeId, universe, isEdit);
                break;
            case 'genders':
                await this.showUniverseGendersTab(tabContent, universeId, universe, isEdit);
                break;
            case 'rules':
                await this.showUniverseRulesTab(tabContent, universeId, universe, isEdit);
                break;
            case 'access':
                await this.showUniverseAccessTab(tabContent, universeId, universe, isEdit);
                break;
            case 'admins':
                await this.showUniverseAdminsTab(tabContent, universeId, universe, isEdit);
                break;
        }
    },
    
    /**
     * Profile Tab - Basic information and SL integration
     */
    async showUniverseProfileTab(container, universeId, universe, isEdit) {
        let html = `
            <form id="universe-profile-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
                <!-- Basic Info -->
                <div class="panel" style="padding: var(--space-md);">
                    <h3>Basic Information</h3>
                    <div class="form-group">
                        <label for="universe-name">Name *</label>
                        <input type="text" id="universe-name" value="${universe?.name || ''}" required style="width: 100%; padding: var(--space-xs);">
                    </div>
                    <div class="form-group">
                        <label for="universe-description">Description</label>
                        <textarea id="universe-description" rows="3" style="width: 100%; padding: var(--space-xs);">${universe?.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="universe-theme">Theme</label>
                        <input type="text" id="universe-theme" value="${universe?.theme || ''}" style="width: 100%; padding: var(--space-xs);">
                    </div>
                    <div class="form-group">
                        <label for="universe-roleplay-type">Roleplay Type</label>
                        <input type="text" id="universe-roleplay-type" value="${universe?.roleplayType || ''}" style="width: 100%; padding: var(--space-xs);">
                    </div>
                    <div class="form-group">
                        <label for="universe-image-url">Image URL (1024x1024)</label>
                        <input type="text" id="universe-image-url" value="${universe?.imageUrl || ''}" style="width: 100%; padding: var(--space-xs);">
                    </div>
                    <div class="form-group">
                        <label for="universe-maturity-rating">Maturity Rating</label>
                        <select id="universe-maturity-rating" style="width: 100%; padding: var(--space-xs);" ${universeId === 'default' && API.uuid !== API.SUPER_ADMIN_UUID ? 'disabled' : ''}>
                            <option value="general" ${(universe?.maturityRating || 'general') === 'general' ? 'selected' : ''}>General</option>
                            <option value="moderate" ${universe?.maturityRating === 'moderate' ? 'selected' : ''}>Moderate</option>
                            <option value="adult" ${universe?.maturityRating === 'adult' ? 'selected' : ''}>Adult</option>
                        </select>
                        ${universeId === 'default' && API.uuid !== API.SUPER_ADMIN_UUID ? '<small style="color: var(--text-muted); display: block; margin-top: var(--space-xs);">Only Super User can change maturity rating for the default universe.</small>' : ''}
                    </div>
                </div>
                
                <!-- SL Integration -->
                <div class="panel" style="padding: var(--space-md);">
                    <h3>Second Life Integration</h3>
                    <div class="form-group">
                        <label for="universe-group-slurl">Group SLURL</label>
                        <input type="text" id="universe-group-slurl" value="${universe?.groupSlurl || ''}" style="width: 100%; padding: var(--space-xs);">
                    </div>
                    <div class="form-group">
                        <label for="universe-welcome-slurl">Welcome SLURL</label>
                        <input type="text" id="universe-welcome-slurl" value="${universe?.welcomeSlurl || ''}" style="width: 100%; padding: var(--space-xs);">
                    </div>
                </div>
            </form>
        `;
        
        container.innerHTML = html;
    },
    
    /**
     * Identity Tab - Combined identity options (legacy, kept for backward compatibility)
     */
    async showUniverseIdentityTab(container, universeId, universe, isEdit) {
        container.innerHTML = `
            <div class="panel" style="padding: var(--space-md);">
                <p style="color: var(--text-muted);">
                    Identity options are now managed in separate tabs: Classes, Species, and Genders.
                </p>
            </div>
        `;
    },
    
    /*
     * Careers tab — REMOVED FROM UI (2026): duplicated Classes (same getClasses() list); allowedCareers
     * was not used in validateIdentityOptions(). Restore when careers/vocations are a distinct template.
     *
    async showUniverseCareersTab(container, universeId, universe, isEdit) {
        if (!isEdit) {
            container.innerHTML = '<p style="color: var(--text-muted);">Save the universe first to manage careers.</p>';
            return;
        }
        
        // Get universes the user can manage (for selector)
        const universesResult = await API.listUniversesForAdmin();
        const userUniverses = universesResult.success ? universesResult.data.universes : [];
        
        // Get all careers (for now, using classes as careers - TODO: implement careers collection)
        const classesResult = await API.getClasses();
        const allCareers = classesResult.success ? classesResult.data.classes : [];
        
        // Get allowed careers for this universe
        const allowedCareers = universe?.allowedCareers || [];
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <div class="form-group" style="flex: 1; margin-right: var(--space-md);">
                    <label for="universe-career-selector">Select Universe</label>
                    <select id="universe-career-selector" style="width: 100%; padding: var(--space-xs);">
                        ${userUniverses.map(u => `
                            <option value="${u.id}" ${u.id === universeId ? 'selected' : ''}>${u.name || u.id}</option>
                        `).join('')}
                    </select>
                </div>
                <button class="btn btn-secondary" id="btn-career-admin" style="margin-top: 24px;">ADMIN</button>
            </div>
            
            <div id="universe-careers-panels"></div>
            
            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="btn-save-careers">Save Changes</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Render two-panel UI
        this.renderUniverseIdentityPanels('careers', allCareers, allowedCareers, 'universe-careers-panels');
        
        // Bind universe selector
        document.getElementById('universe-career-selector')?.addEventListener('change', async (e) => {
            const selectedUniverseId = e.target.value;
            const result = await API.getUniverse(selectedUniverseId);
            if (result.success) {
                const selectedUniverse = result.data.universe;
                this.renderUniverseIdentityPanels('careers', allCareers, selectedUniverse.allowedCareers || [], 'universe-careers-panels');
                this.currentUniverseId = selectedUniverseId;
                this.currentUniverseData = selectedUniverse;
            }
        });
        
        // Bind save button
        document.getElementById('btn-save-careers')?.addEventListener('click', async () => {
            const checked = this.getCheckedItems('universe-allowed-careers');
            const result = await API.updateUniverse(this.currentUniverseId, { allowedCareers: checked });
            if (result.success) {
                UI.showToast('Careers updated!', 'success');
                // Reload universe data
                const reloadResult = await API.getUniverse(this.currentUniverseId);
                if (reloadResult.success) {
                    this.currentUniverseData = reloadResult.data.universe;
                    this.renderUniverseIdentityPanels('careers', allCareers, this.currentUniverseData.allowedCareers || [], 'universe-careers-panels');
                }
            } else {
                UI.showToast('Failed to update careers: ' + result.error, 'error');
            }
        });
        
        // Bind admin button (placeholder for now)
        document.getElementById('btn-career-admin')?.addEventListener('click', () => {
            UI.showToast('Career admin panel coming soon', 'info');
        });
    },
    */
    
    /**
     * Classes Tab - Two-panel checkbox UI
     */
    async showUniverseClassesTab(container, universeId, universe, isEdit) {
        if (!isEdit) {
            container.innerHTML = '<p style="color: var(--text-muted);">Save the universe first to manage classes.</p>';
            return;
        }
        
        // Get universes the user can manage (for selector)
        const universesResult = await API.listUniversesForAdmin();
        const userUniverses = universesResult.success ? universesResult.data.universes : [];
        const classConfigResult = await API.getUniverseClassConfiguration(universeId);
        const allClasses = classConfigResult.success ? classConfigResult.data.classes : [];
        const showGlobalClassAdmin = this.canManageGlobalTemplates();
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <div class="form-group" style="flex: 1; margin-right: var(--space-md);">
                    <label for="universe-class-selector">Select Universe</label>
                    <select id="universe-class-selector" style="width: 100%; padding: var(--space-xs);">
                        ${userUniverses.map(u => `
                            <option value="${u.id}" ${u.id === universeId ? 'selected' : ''}>${u.name || u.id}</option>
                        `).join('')}
                    </select>
                </div>
                ${showGlobalClassAdmin ? '<button class="btn btn-secondary" id="btn-class-admin" style="margin-top: 24px;">ADMIN</button>' : ''}
            </div>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: var(--space-sm);">
                Configure class availability and relationships for this universe.
                ${universeId === 'default'
                    ? ' These become baseline defaults for other universes.'
                    : ' Overrides here apply on top of Default Universe settings.'}
            </p>
            <p style="color: #10b981; font-size: 0.85rem; margin-bottom: var(--space-sm);">
                <strong>Universe → Classes tab</strong> (not Species/Genders).
                Scroll the table below; click <strong>Edit</strong> on a row for tier and prerequisites.
                ${typeof window !== 'undefined' && window.HUD_BUILD_LABEL ? `(UI: ${window.HUD_BUILD_LABEL})` : ''}
            </p>
            
            <div class="panel" style="padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md);">
                <label style="display: flex; align-items: flex-start; gap: var(--space-sm); cursor: pointer;">
                    <input type="checkbox" id="universe-enforce-class-stat-mins"
                        ${universe?.enforceClassStatMinimums !== false ? 'checked' : ''}
                        style="margin-top: 3px;">
                    <span>
                        <strong>Enforce class stat minimums</strong>
                        <span style="display: block; color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;">
                            When unchecked, players in this universe may select any allowed class without meeting
                            minimum stat requirements (Setup HUD and class changes).
                        </span>
                    </span>
                </label>
            </div>

            <div id="universe-classes-builder"></div>

            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="btn-save-classes">Save Changes</button>
            </div>
        `;

        container.innerHTML = html;
        this.currentUniverseClassRows = allClasses;
        this.currentUniverseClassOverrides = { ...(this.currentUniverseData?.classOverrides || {}) };
        
        this.initUniverseClassBuilderState(allClasses, this.currentUniverseData);
        this.renderUniverseClassBuilderRows(allClasses, this.currentUniverseData);
        
        // Bind universe selector
        document.getElementById('universe-class-selector')?.addEventListener('change', async (e) => {
            const selectedUniverseId = e.target.value;
            const result = await API.getUniverse(selectedUniverseId);
            if (result.success) {
                const selectedUniverse = result.data.universe;
                this.currentUniverseId = selectedUniverseId;
                this.currentUniverseData = selectedUniverse;
                const cfg = await API.getUniverseClassConfiguration(selectedUniverseId);
                this.currentUniverseClassRows = cfg.success ? cfg.data.classes : [];
                this.currentUniverseClassOverrides = { ...(selectedUniverse.classOverrides || {}) };
                this.initUniverseClassBuilderState(this.currentUniverseClassRows, selectedUniverse);
                this.renderUniverseClassBuilderRows(this.currentUniverseClassRows, selectedUniverse);
                const enforceCheckbox = document.getElementById('universe-enforce-class-stat-mins');
                if (enforceCheckbox) {
                    enforceCheckbox.checked = selectedUniverse.enforceClassStatMinimums !== false;
                }
            }
        });

        // Bind save button
        document.getElementById('btn-save-classes')?.addEventListener('click', async () => {
            const classConfig = this.collectUniverseClassBuilderState();
            const enforceEl = document.getElementById('universe-enforce-class-stat-mins');
            const result = await API.updateUniverse(this.currentUniverseId, {
                allowedClasses: classConfig.allowedClasses,
                classOverrides: classConfig.classOverrides,
                enforceClassStatMinimums: enforceEl ? enforceEl.checked : true
            });
            if (result.success) {
                UI.showToast('Classes updated!', 'success');
                // Reload universe data
                const reloadResult = await API.getUniverse(this.currentUniverseId);
                if (reloadResult.success) {
                    this.currentUniverseData = reloadResult.data.universe;
                    const cfg = await API.getUniverseClassConfiguration(this.currentUniverseId);
                    this.currentUniverseClassRows = cfg.success ? cfg.data.classes : [];
                    this.currentUniverseClassOverrides = { ...(this.currentUniverseData.classOverrides || {}) };
                    this.initUniverseClassBuilderState(this.currentUniverseClassRows, this.currentUniverseData);
                    this.renderUniverseClassBuilderRows(this.currentUniverseClassRows, this.currentUniverseData);
                }
            } else {
                UI.showToast('Failed to update classes: ' + result.error, 'error');
            }
        });
        
        if (showGlobalClassAdmin) {
            document.getElementById('btn-class-admin')?.addEventListener('click', () => {
                this.showTemplateManager('classes');
            });
        }
    },

    initUniverseClassBuilderState(allClasses, universeData) {
        const allowedSet = new Set((universeData?.allowedClasses || []).map(id => String(id)));
        const hasAllowlist = allowedSet.size > 0;
        const draft = {};
        allClasses.forEach((cls) => {
            const prerequisites = Array.isArray(cls.prerequisites) ? [...cls.prerequisites] : [];
            const tier = cls.tier || (prerequisites.length === 0 ? 'beginner' : 'advanced');
            const enabled = hasAllowlist ? allowedSet.has(cls.id) : cls.enabled !== false;
            draft[cls.id] = {
                enabled,
                tier: tier === 'beginner' ? 'beginner' : 'advanced',
                prerequisites: tier === 'beginner' ? [] : prerequisites.filter(p => p && p !== cls.id)
            };
        });
        this.universeClassBuilderDraft = draft;
    },

    formatUniverseClassPrereqSummary(classId, prerequisiteIds, allClasses) {
        if (!prerequisiteIds || prerequisiteIds.length === 0) {
            return '<span style="color:var(--text-muted);">None</span>';
        }
        const names = prerequisiteIds.map((id) => {
            const c = allClasses.find(x => x.id === id);
            return c ? (c.name || c.id) : id;
        });
        return names.join(', ');
    },

    openUniverseClassEditModal(classId) {
        const allClasses = this.currentUniverseClassRows || [];
        const cls = allClasses.find(c => c.id === classId);
        if (!cls) return;
        const draft = this.universeClassBuilderDraft?.[classId] || {
            enabled: true,
            tier: 'beginner',
            prerequisites: []
        };
        const classOptions = allClasses
            .filter(c => c.id !== classId)
            .map(c => {
                const selected = draft.prerequisites.includes(c.id);
                return `<option value="${c.id}" ${selected ? 'selected' : ''}>${c.name || c.id}</option>`;
            })
            .join('');

        const content = `
            <h2 style="margin-bottom: var(--space-sm);">Edit Class: ${cls.name || cls.id}</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: var(--space-md);">
                Set tier and prerequisites for this class in the selected universe.
            </p>
            <div class="form-group">
                <label for="universe-class-edit-tier">Tier</label>
                <select id="universe-class-edit-tier" style="width: 100%; padding: var(--space-xs);">
                    <option value="beginner" ${draft.tier === 'beginner' ? 'selected' : ''}>Beginner</option>
                    <option value="advanced" ${draft.tier === 'advanced' ? 'selected' : ''}>Advanced</option>
                </select>
            </div>
            <div class="form-group" id="universe-class-edit-prereq-group" style="${draft.tier === 'beginner' ? 'display:none;' : ''}">
                <label for="universe-class-edit-prereqs">Prerequisites (hold Ctrl/Cmd to select multiple)</label>
                <select id="universe-class-edit-prereqs" multiple size="8" style="width: 100%; padding: var(--space-xs); min-height: 140px;">
                    ${classOptions}
                </select>
            </div>
            <div style="display: flex; gap: var(--space-sm); justify-content: flex-end; margin-top: var(--space-lg);">
                <button type="button" class="btn btn-secondary" id="universe-class-edit-cancel">Cancel</button>
                <button type="button" class="btn btn-primary" id="universe-class-edit-save">Apply</button>
            </div>
        `;
        UI.showModal(content);

        const tierEl = document.getElementById('universe-class-edit-tier');
        const prereqGroup = document.getElementById('universe-class-edit-prereq-group');
        const prereqEl = document.getElementById('universe-class-edit-prereqs');

        tierEl?.addEventListener('change', () => {
            const isBeginner = tierEl.value === 'beginner';
            if (prereqGroup) {
                prereqGroup.style.display = isBeginner ? 'none' : '';
            }
            if (isBeginner && prereqEl) {
                Array.from(prereqEl.options).forEach(opt => { opt.selected = false; });
            }
        });

        document.getElementById('universe-class-edit-cancel')?.addEventListener('click', () => {
            UI.closeModal();
        }, { once: true });

        document.getElementById('universe-class-edit-save')?.addEventListener('click', () => {
            const tier = tierEl?.value === 'beginner' ? 'beginner' : 'advanced';
            let prerequisites = [];
            if (tier === 'advanced' && prereqEl) {
                prerequisites = Array.from(prereqEl.selectedOptions)
                    .map(o => o.value)
                    .filter(v => v && v !== classId);
            }
            if (!this.universeClassBuilderDraft) {
                this.universeClassBuilderDraft = {};
            }
            const rowDraft = this.universeClassBuilderDraft[classId] || { enabled: true };
            this.universeClassBuilderDraft[classId] = {
                ...rowDraft,
                tier,
                prerequisites
            };
            UI.closeModal();
            this.renderUniverseClassBuilderRows(allClasses, this.currentUniverseData);
            UI.showToast('Class settings updated (click Save Changes to persist)', 'info');
        }, { once: true });
    },

    renderUniverseClassBuilderRows(allClasses, universeData) {
        const container = document.getElementById('universe-classes-builder');
        if (!container) return;
        if (!this.universeClassBuilderDraft) {
            this.initUniverseClassBuilderState(allClasses, universeData);
        }

        const rows = allClasses
            .slice()
            .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
            .map((cls) => {
                const draft = this.universeClassBuilderDraft[cls.id] || {
                    enabled: true,
                    tier: 'beginner',
                    prerequisites: []
                };
                const tierLabel = draft.tier === 'beginner' ? 'Beginner' : 'Advanced';
                const prereqSummary = this.formatUniverseClassPrereqSummary(
                    cls.id,
                    draft.prerequisites,
                    allClasses
                );
                return `
                    <tr data-class-id="${cls.id}">
                        <td>
                            <strong>${cls.name || cls.id}</strong>
                            <div style="font-size:0.8rem;color:var(--text-muted);">${cls.id}</div>
                        </td>
                        <td style="text-align:center;">
                            <input type="checkbox" class="universe-class-enabled" ${draft.enabled ? 'checked' : ''}>
                        </td>
                        <td>${tierLabel}</td>
                        <td style="font-size:0.9rem;">${prereqSummary}</td>
                        <td style="text-align:right;">
                            <button type="button" class="btn btn-secondary universe-class-edit-btn" data-class-id="${cls.id}" style="padding:4px 10px;font-size:0.85rem;">Edit</button>
                        </td>
                    </tr>
                `;
            }).join('');

        container.innerHTML = `
            <div class="admin-table-container universe-classes-scroll" style="max-height: min(55vh, 480px); overflow-y: auto; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                <table class="admin-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Class</th>
                            <th style="width:70px;">On</th>
                            <th style="width:90px;">Tier</th>
                            <th>Prerequisites</th>
                            <th style="width:80px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: var(--space-xs);">
                Use <strong>Edit</strong> per class to set tier and prerequisites. Scroll the list to see all classes.
            </p>
        `;

        container.querySelectorAll('.universe-class-enabled').forEach((checkbox) => {
            checkbox.addEventListener('change', (e) => {
                const row = e.target.closest('tr[data-class-id]');
                const classId = row?.dataset.classId;
                if (!classId || !this.universeClassBuilderDraft[classId]) return;
                this.universeClassBuilderDraft[classId].enabled = e.target.checked;
            });
        });

        container.querySelectorAll('.universe-class-edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const classId = btn.dataset.classId;
                if (classId) {
                    this.openUniverseClassEditModal(classId);
                }
            });
        });
    },

    collectUniverseClassBuilderState() {
        const draft = this.universeClassBuilderDraft || {};
        const classIds = Object.keys(draft);
        let allowedClasses = [];
        const classOverrides = {};
        classIds.forEach((classId) => {
            const row = draft[classId];
            const enabled = row.enabled === true;
            const tier = row.tier === 'beginner' ? 'beginner' : 'advanced';
            let prerequisites = Array.isArray(row.prerequisites) ? [...row.prerequisites] : [];
            if (tier === 'beginner') {
                prerequisites = [];
            } else {
                prerequisites = prerequisites.filter(v => v && v !== classId);
            }
            if (enabled) {
                allowedClasses.push(classId);
            }
            classOverrides[classId] = {
                enabled,
                tier,
                prerequisites
            };
        });
        if (classIds.length > 0 && allowedClasses.length === classIds.length) {
            allowedClasses = [];
        }
        return { allowedClasses, classOverrides };
    },
    
    /**
     * Species Tab - Two-panel checkbox UI
     */
    async showUniverseSpeciesTab(container, universeId, universe, isEdit) {
        if (!isEdit) {
            container.innerHTML = '<p style="color: var(--text-muted);">Save the universe first to manage species.</p>';
            return;
        }
        
        // Get universes the user can manage (for selector)
        const universesResult = await API.listUniversesForAdmin();
        const userUniverses = universesResult.success ? universesResult.data.universes : [];
        
        // Get all species
        const speciesResult = await API.getSpecies();
        const allSpecies = speciesResult.success ? speciesResult.data.species : [];
        
        // Get allowed species for this universe
        const allowedSpecies = universe?.allowedSpecies || [];
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <div class="form-group" style="flex: 1; margin-right: var(--space-md);">
                    <label for="universe-species-selector">Select Universe</label>
                    <select id="universe-species-selector" style="width: 100%; padding: var(--space-xs);">
                        ${userUniverses.map(u => `
                            <option value="${u.id}" ${u.id === universeId ? 'selected' : ''}>${u.name || u.id}</option>
                        `).join('')}
                    </select>
                </div>
                <button class="btn btn-secondary" id="btn-species-admin" style="margin-top: 24px;">ADMIN</button>
            </div>
            
            <div id="universe-species-panels"></div>
            
            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="btn-save-species">Save Changes</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Render two-panel UI
        this.renderUniverseIdentityPanels('species', allSpecies, allowedSpecies, 'universe-species-panels');
        
        // Bind universe selector
        document.getElementById('universe-species-selector')?.addEventListener('change', async (e) => {
            const selectedUniverseId = e.target.value;
            const result = await API.getUniverse(selectedUniverseId);
            if (result.success) {
                const selectedUniverse = result.data.universe;
                this.renderUniverseIdentityPanels('species', allSpecies, selectedUniverse.allowedSpecies || [], 'universe-species-panels');
                this.currentUniverseId = selectedUniverseId;
                this.currentUniverseData = selectedUniverse;
            }
        });
        
        // Bind save button
        document.getElementById('btn-save-species')?.addEventListener('click', async () => {
            const checked = this.getCheckedItems('universe-allowed-species');
            const result = await API.updateUniverse(this.currentUniverseId, { allowedSpecies: checked });
            if (result.success) {
                UI.showToast('Species updated!', 'success');
                // Reload universe data
                const reloadResult = await API.getUniverse(this.currentUniverseId);
                if (reloadResult.success) {
                    this.currentUniverseData = reloadResult.data.universe;
                    this.renderUniverseIdentityPanels('species', allSpecies, this.currentUniverseData.allowedSpecies || [], 'universe-species-panels');
                }
            } else {
                UI.showToast('Failed to update species: ' + result.error, 'error');
            }
        });
        
        // Bind admin button
        document.getElementById('btn-species-admin')?.addEventListener('click', () => {
            this.showTemplateManager('species');
        });
    },
    
    /**
     * Genders Tab - Two-panel checkbox UI
     */
    async showUniverseGendersTab(container, universeId, universe, isEdit) {
        if (!isEdit) {
            container.innerHTML = '<p style="color: var(--text-muted);">Save the universe first to manage genders.</p>';
            return;
        }
        
        // Get universes the user can manage (for selector)
        const universesResult = await API.listUniversesForAdmin();
        const userUniverses = universesResult.success ? universesResult.data.universes : [];
        
        // Get all genders
        const gendersResult = await API.getGenders();
        const allGenders = gendersResult.success ? gendersResult.data.genders : [];
        
        // Get allowed genders for this universe
        const allowedGenders = universe?.allowedGenders || [];
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <div class="form-group" style="flex: 1; margin-right: var(--space-md);">
                    <label for="universe-gender-selector">Select Universe</label>
                    <select id="universe-gender-selector" style="width: 100%; padding: var(--space-xs);">
                        ${userUniverses.map(u => `
                            <option value="${u.id}" ${u.id === universeId ? 'selected' : ''}>${u.name || u.id}</option>
                        `).join('')}
                    </select>
                </div>
                <button class="btn btn-secondary" id="btn-gender-admin" style="margin-top: 24px;">ADMIN</button>
            </div>
            
            <div id="universe-genders-panels"></div>
            
            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="btn-save-genders">Save Changes</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Render two-panel UI
        this.renderUniverseIdentityPanels('genders', allGenders, allowedGenders, 'universe-genders-panels');
        
        // Bind universe selector
        document.getElementById('universe-gender-selector')?.addEventListener('change', async (e) => {
            const selectedUniverseId = e.target.value;
            const result = await API.getUniverse(selectedUniverseId);
            if (result.success) {
                const selectedUniverse = result.data.universe;
                this.renderUniverseIdentityPanels('genders', allGenders, selectedUniverse.allowedGenders || [], 'universe-genders-panels');
                this.currentUniverseId = selectedUniverseId;
                this.currentUniverseData = selectedUniverse;
            }
        });
        
        // Bind save button
        document.getElementById('btn-save-genders')?.addEventListener('click', async () => {
            const checked = this.getCheckedItems('universe-allowed-genders');
            const result = await API.updateUniverse(this.currentUniverseId, { allowedGenders: checked });
            if (result.success) {
                UI.showToast('Genders updated!', 'success');
                // Reload universe data
                const reloadResult = await API.getUniverse(this.currentUniverseId);
                if (reloadResult.success) {
                    this.currentUniverseData = reloadResult.data.universe;
                    this.renderUniverseIdentityPanels('genders', allGenders, this.currentUniverseData.allowedGenders || [], 'universe-genders-panels');
                }
            } else {
                UI.showToast('Failed to update genders: ' + result.error, 'error');
            }
        });
        
        // Bind admin button
        document.getElementById('btn-gender-admin')?.addEventListener('click', () => {
            this.showTemplateManager('genders');
        });
    },
    
    /**
     * Rules Tab - Limits and mana settings
     */
    async showUniverseRulesTab(container, universeId, universe, isEdit) {
        let html = `
            <form id="universe-rules-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
                <div class="panel" style="padding: var(--space-md);">
                    <h3>Limits</h3>
                    <div class="form-group">
                        <label for="universe-character-limit">Character Limit (0 = unlimited)</label>
                        <input type="number" id="universe-character-limit" value="${universe?.characterLimit !== undefined ? universe.characterLimit : 0}" min="0" style="width: 100%; padding: var(--space-xs);">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="universe-mana-enabled" ${universe?.manaEnabled !== false ? 'checked' : ''}>
                            Mana Enabled
                        </label>
                    </div>
                </div>
            </form>
        `;
        
        container.innerHTML = html;
    },
    
    /**
     * Access Tab - Visibility and signup settings
     */
    async showUniverseAccessTab(container, universeId, universe, isEdit) {
        let html = `
            <form id="universe-access-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
                <div class="panel" style="padding: var(--space-md);">
                    <h3>Access Control</h3>
                    <div class="form-group">
                        <label for="universe-visibility">Visibility</label>
                        <select id="universe-visibility" style="width: 100%; padding: var(--space-xs);">
                            <option value="public" ${universe?.visibility === 'public' ? 'selected' : ''}>Public</option>
                            <option value="private" ${universe?.visibility === 'private' ? 'selected' : ''}>Private</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="universe-accept-new-players">Accept New Players</label>
                        <select id="universe-accept-new-players" style="width: 100%; padding: var(--space-xs);">
                            <option value="open" ${universe?.acceptNewPlayers === 'open' ? 'selected' : ''}>Open</option>
                            <option value="key" ${universe?.acceptNewPlayers === 'key' ? 'selected' : ''}>Key Required</option>
                            <option value="closed" ${universe?.acceptNewPlayers === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="universe-signup-key">Signup Key (leave empty to clear)</label>
                        <input type="text" id="universe-signup-key" placeholder="Enter new key or leave empty" style="width: 100%; padding: var(--space-xs);">
                        <small style="color: var(--text-muted);">${isEdit && universe?.acceptNewPlayers === 'key' ? 'Enter a new key to change it, or leave empty to remove key requirement' : 'Only used if "Key Required" is selected'}</small>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="universe-active" ${universe?.active !== false ? 'checked' : ''} ${universeId === 'default' ? 'disabled' : ''}>
                            Active (available for character creation)
                        </label>
                        ${universeId === 'default' ? '<small style="color: var(--text-muted);">Default Universe must always be active</small>' : ''}
                    </div>
                </div>
            </form>
        `;
        
        container.innerHTML = html;
    },
    
    /**
     * Admins Tab - Universe admin management
     */
    async showUniverseAdminsTab(container, universeId, universe, isEdit) {
        if (!isEdit) {
            container.innerHTML = '<p style="color: var(--text-muted);">Save the universe first to manage admins.</p>';
            return;
        }
        
        let html = `
            <div class="panel" style="padding: var(--space-md);">
                <h3>Universe Admins</h3>
                <div id="universe-admins-list">
                    <p style="color: var(--text-muted);">Loading admins...</p>
                </div>
                <div id="universe-admin-actions" style="margin-top: var(--space-md); display: none;">
                    <button type="button" class="btn btn-secondary" id="btn-add-universe-admin">➕ Add Admin</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Load admins
        await this.loadUniverseAdmins(universeId);
        
        // Show/hide add admin button based on permissions
        const canAssign = this.canAssignUniverseAdmin || await API.canAssignUniverseAdmin(universeId);
        const adminActions = document.getElementById('universe-admin-actions');
        if (adminActions) {
            adminActions.style.display = canAssign ? 'block' : 'none';
            if (canAssign) {
                document.getElementById('btn-add-universe-admin')?.addEventListener('click', () => {
                    this.showAddUniverseAdminDialog(universeId);
                });
            }
        }
    },
    
    /**
     * Save universe from all tabs
     * Only one tab's markup is in the DOM at a time — merge visible fields with currentUniverseData.
     */
    async saveUniverseFromTabs(universeId) {
        try {
            const u = this.currentUniverseData || {};
            
            const pick = (id, fallback) => {
                const el = document.getElementById(id);
                if (!el) return fallback;
                if (el.type === 'checkbox') return el.checked;
                return typeof el.value === 'string' ? el.value.trim() : el.value;
            };
            
            const nameEl = document.getElementById('universe-name');
            let name = '';
            if (nameEl) name = (nameEl.value || '').trim();
            if (!name) name = (u.name && String(u.name).trim()) || '';
            if (!name) {
                UI.showToast('Name is required', 'warning');
                return;
            }
            
            const universeData = {
                name,
                description: pick('universe-description', u.description ?? '') ?? '',
                theme: pick('universe-theme', u.theme ?? '') ?? '',
                roleplayType: pick('universe-roleplay-type', u.roleplayType ?? '') ?? '',
                imageUrl: pick('universe-image-url', u.imageUrl ?? '') ?? '',
                groupSlurl: pick('universe-group-slurl', u.groupSlurl ?? '') ?? '',
                welcomeSlurl: pick('universe-welcome-slurl', u.welcomeSlurl ?? '') ?? '',
                maturityRating: pick('universe-maturity-rating', u.maturityRating || 'general') || 'general',
                visibility: pick('universe-visibility', u.visibility || 'public') || 'public',
                acceptNewPlayers: pick('universe-accept-new-players', u.acceptNewPlayers || 'open') || 'open',
                characterLimit: (() => {
                    const el = document.getElementById('universe-character-limit');
                    if (!el) return parseInt(String(u.characterLimit !== undefined ? u.characterLimit : 0), 10) || 0;
                    return parseInt(el.value, 10) || 0;
                })(),
                manaEnabled: pick('universe-mana-enabled', u.manaEnabled !== false)
            };
            
            if (universeId !== 'default') {
                const ac = document.getElementById('universe-active');
                universeData.active = ac ? ac.checked : (u.active !== false);
            }
            
            const signupKey = pick('universe-signup-key', '') || '';
            
            // For default universe, only include maturityRating if user is Super User
            if (universeId === 'default' && API.uuid !== API.SUPER_ADMIN_UUID) {
                delete universeData.maturityRating;
            }
            
            let result;
            if (universeId) {
                // Update existing
                if (signupKey) {
                    await API.setSignupKey(universeId, signupKey);
                } else if (universeData.acceptNewPlayers !== 'key') {
                    await API.clearSignupKey(universeId);
                }
                
                result = await API.updateUniverse(universeId, universeData);
            } else {
                // Create new — active already set from Profile tab (universe-active checkbox)
                result = await API.createUniverse(universeData);
                
                if (signupKey && result.success) {
                    await API.setSignupKey(result.data.universe.id, signupKey);
                }
            }
            
            if (result.success) {
                UI.showToast(universeId ? 'Universe updated!' : 'Universe created!', 'success');
                this.showUniverseManagement();
            } else {
                UI.showToast('Failed to save universe: ' + result.error, 'error');
            }
        } catch (error) {
            UI.showToast('Error saving universe: ' + error.message, 'error');
        }
    },
    
    /**
     * Save universe (create or update)
     */
    async saveUniverse(universeId) {
        try {
            const u = this.currentUniverseData || {};
            const pick = (id, fallback) => {
                const el = document.getElementById(id);
                if (!el) return fallback;
                if (el.type === 'checkbox') return el.checked;
                return typeof el.value === 'string' ? el.value.trim() : el.value;
            };
            
            const nameEl = document.getElementById('universe-name');
            let name = nameEl ? (nameEl.value || '').trim() : '';
            if (!name) name = (u.name && String(u.name).trim()) || '';
            if (!name) {
                UI.showToast('Name is required', 'warning');
                return;
            }
            
            // Collect allowed lists from open admin tabs, or preserve existing values
            const collectAllowedList = (checkboxClass, existing) => {
                const boxes = document.querySelectorAll(`.${checkboxClass}`);
                if (boxes.length === 0) {
                    return existing || [];
                }
                return this.getCheckedItems(checkboxClass);
            };

            const allowedGenders = collectAllowedList('universe-allowed-genders', u.allowedGenders);
            const allowedSpecies = collectAllowedList('universe-allowed-species', u.allowedSpecies);
            let allowedClasses = collectAllowedList('universe-allowed-classes', u.allowedClasses);
            let classOverrides = u.classOverrides || {};
            const classBuilderRows = document.querySelectorAll('#universe-classes-builder tr[data-class-id]');
            if (classBuilderRows.length > 0) {
                const classConfig = this.collectUniverseClassBuilderState();
                allowedClasses = classConfig.allowedClasses;
                classOverrides = classConfig.classOverrides;
            }
            const enforceStatMinsEl = document.getElementById('universe-enforce-class-stat-mins');
            
            const universeData = {
                name,
                description: pick('universe-description', u.description ?? '') ?? '',
                theme: pick('universe-theme', u.theme ?? '') ?? '',
                roleplayType: pick('universe-roleplay-type', u.roleplayType ?? '') ?? '',
                imageUrl: pick('universe-image-url', u.imageUrl ?? '') ?? '',
                groupSlurl: pick('universe-group-slurl', u.groupSlurl ?? '') ?? '',
                welcomeSlurl: pick('universe-welcome-slurl', u.welcomeSlurl ?? '') ?? '',
                maturityRating: pick('universe-maturity-rating', u.maturityRating || 'general') || 'general',
                visibility: pick('universe-visibility', u.visibility || 'public') || 'public',
                acceptNewPlayers: pick('universe-accept-new-players', u.acceptNewPlayers || 'open') || 'open',
                characterLimit: (() => {
                    const el = document.getElementById('universe-character-limit');
                    if (!el) return parseInt(String(u.characterLimit !== undefined ? u.characterLimit : 0), 10) || 0;
                    return parseInt(el.value, 10) || 0;
                })(),
                manaEnabled: pick('universe-mana-enabled', u.manaEnabled !== false),
                allowedGenders: allowedGenders,
                allowedSpecies: allowedSpecies,
                allowedClasses: allowedClasses,
                classOverrides: classOverrides,
                ...(enforceStatMinsEl
                    ? { enforceClassStatMinimums: enforceStatMinsEl.checked }
                    : {})
            };
            
            const signupKey = pick('universe-signup-key', '') || '';
            
            // For default universe, only include maturityRating if user is Super User
            if (universeId === 'default' && API.uuid !== API.SUPER_ADMIN_UUID) {
                delete universeData.maturityRating;
            }
            
            // Handle active state (not for default universe)
            if (universeId !== 'default') {
                const ac = document.getElementById('universe-active');
                universeData.active = ac ? ac.checked : (u.active !== false);
            }
            
            let result;
            if (universeId) {
                // Update existing
                // Handle signup key separately if provided
                if (signupKey) {
                    await API.setSignupKey(universeId, signupKey);
                } else if (universeData.acceptNewPlayers !== 'key') {
                    // Clear key if not using key access
                    await API.clearSignupKey(universeId);
                }
                
                result = await API.updateUniverse(universeId, universeData);
            } else {
                // Create new — active already set above from Profile checkbox when universeId !== 'default'
                result = await API.createUniverse(universeData);
                
                // Set signup key if provided
                if (signupKey && result.success) {
                    await API.setSignupKey(result.data.universe.id, signupKey);
                }
            }
            
            if (result.success) {
                UI.showToast(universeId ? 'Universe updated!' : 'Universe created!', 'success');
                this.showUniverseManagement();
            } else {
                UI.showToast('Failed to save universe: ' + result.error, 'error');
            }
        } catch (error) {
            UI.showToast('Error saving universe: ' + error.message, 'error');
        }
    },
    
    /**
     * Load and display universe admins
     */
    async loadUniverseAdmins(universeId) {
        const adminsList = document.getElementById('universe-admins-list');
        if (!adminsList) return;
        
        try {
            const result = await API.getUniverseAdmins(universeId);
            if (!result.success) {
                adminsList.innerHTML = '<p style="color: var(--error);">Failed to load admins</p>';
                return;
            }
            
            const admins = result.data.admins || [];
            const canAssign = await API.canAssignUniverseAdmin(universeId);
            
            if (admins.length === 0) {
                adminsList.innerHTML = '<p style="color: var(--text-muted);">No admins assigned</p>';
                return;
            }
            
            let html = '<table style="width: 100%; border-collapse: collapse;"><thead><tr><th>UUID</th><th>Role</th><th>Actions</th></tr></thead><tbody>';
            
            admins.forEach(admin => {
                const isOwner = admin.role === 'owner';
                html += `
                    <tr>
                        <td>${admin.uuid}</td>
                        <td><strong>${admin.role}</strong></td>
                        <td>
                            ${!isOwner && canAssign ? `
                                <button class="btn btn-sm btn-danger" data-admin-uuid="${admin.uuid}" data-action="remove-admin">
                                    Remove
                                </button>
                            ` : '<span style="color: var(--text-muted);">-</span>'}
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            adminsList.innerHTML = html;
            
            // Bind remove buttons
            adminsList.querySelectorAll('[data-action="remove-admin"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const adminUuid = e.target.closest('[data-admin-uuid]').dataset.adminUuid;
                    const confirmed = await UI.showConfirmDialog({
                        title: 'Remove admin?',
                        message: 'Remove this admin from the universe?',
                        confirmLabel: 'Remove',
                        danger: true
                    });
                    if (confirmed) {
                        const result = await API.removeUniverseAdmin(universeId, adminUuid);
                        if (result.success) {
                            UI.showToast('Admin removed', 'success');
                            this.loadUniverseAdmins(universeId);
                        } else {
                            UI.showToast('Failed to remove admin: ' + result.error, 'error');
                        }
                    }
                });
            });
        } catch (error) {
            adminsList.innerHTML = '<p style="color: var(--error);">Error loading admins: ' + error.message + '</p>';
        }
    },
    
    /**
     * Show dialog to add universe admin (choose from global Universe Admin accounts)
     */
    async showAddUniverseAdminDialog(universeId) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        if (!modal || !modalBody) {
            UI.showToast('Dialog unavailable', 'error');
            return;
        }
        
        modalBody.innerHTML = `
            <div class="admin-form">
                <h3 style="margin-bottom: var(--space-md);">Add universe admin</h3>
                <p style="color: var(--text-secondary); font-size: 0.95em; margin-bottom: var(--space-md);">
                    Choose someone who already has the <strong>Universe Admin</strong> role (from User Management),
                    or enter their account UUID manually if they have a Feudalism user record.
                </p>
                <div id="add-universe-admin-loading" style="color: var(--text-muted);">Loading Universe Admins…</div>
                <div id="add-universe-admin-form" class="hidden">
                    <div class="form-group">
                        <label for="add-universe-admin-select">Universe Admin accounts</label>
                        <select id="add-universe-admin-select" style="width: 100%;">
                            <option value="">— Select —</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="add-universe-admin-uuid">Or enter UUID manually</label>
                        <input type="text" id="add-universe-admin-uuid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style="width: 100%; font-family: monospace;">
                    </div>
                    <div class="form-group">
                        <label>Universe role</label>
                        <div style="display: flex; gap: var(--space-md); flex-wrap: wrap;">
                            <label><input type="radio" name="universe-admin-level" value="admin" checked> Admin (this universe)</label>
                            <label><input type="radio" name="universe-admin-level" value="owner"> Owner (transfers universe ownership)</label>
                        </div>
                    </div>
                    <div class="form-actions" style="display: flex; gap: var(--space-md); margin-top: var(--space-lg);">
                        <button type="button" class="action-btn primary" id="btn-confirm-add-universe-admin">Add</button>
                        <button type="button" class="action-btn modal-cancel-btn">Cancel</button>
                    </div>
                </div>
                <p id="add-universe-admin-error" class="hidden" style="color: var(--error); margin-top: var(--space-sm);"></p>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        const loadingEl = document.getElementById('add-universe-admin-loading');
        const formEl = document.getElementById('add-universe-admin-form');
        const errEl = document.getElementById('add-universe-admin-error');
        const selectEl = document.getElementById('add-universe-admin-select');
        
        try {
            const result = await API.listUsersByGlobalRole('universe_admin');
            if (!result.success) {
                loadingEl.textContent = '';
                if (errEl) {
                    errEl.classList.remove('hidden');
                    errEl.textContent = result.error || 'Could not load users';
                }
                return;
            }
            
            const users = result.data?.users || [];
            loadingEl.classList.add('hidden');
            formEl?.classList.remove('hidden');
            
            if (selectEl) {
                users.forEach((u) => {
                    const label = u.display_name || u.username || u.uuid || u.id || 'Unknown';
                    const opt = document.createElement('option');
                    opt.value = u.uuid || u.id;
                    opt.textContent = `${label} (${u.uuid || u.id})`;
                    selectEl.appendChild(opt);
                });
                if (users.length === 0) {
                    const opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = 'No accounts with Universe Admin role — use UUID below or promote in User Management';
                    opt.disabled = true;
                    selectEl.appendChild(opt);
                }
            }
        } catch (e) {
            loadingEl.textContent = '';
            if (errEl) {
                errEl.classList.remove('hidden');
                errEl.textContent = e.message || String(e);
            }
            return;
        }
        
        const closeModal = () => modal.classList.add('hidden');
        
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', closeModal);
        
        modalBody.querySelector('#btn-confirm-add-universe-admin')?.addEventListener('click', async () => {
            const manual = document.getElementById('add-universe-admin-uuid')?.value.trim() || '';
            const sel = document.getElementById('add-universe-admin-select')?.value.trim() || '';
            const uuid = manual || sel;
            const level = modalBody.querySelector('input[name="universe-admin-level"]:checked')?.value || 'admin';
            const uRole = level === 'owner' ? 'owner' : 'admin';
            
            if (!uuid) {
                UI.showToast('Choose a user or enter a UUID', 'warning');
                return;
            }
            
            try {
                const assignResult = await API.assignUniverseAdmin(universeId, uuid, uRole);
                if (assignResult.success) {
                    UI.showToast('Admin added successfully', 'success');
                    closeModal();
                    this.loadUniverseAdmins(universeId);
                } else {
                    UI.showToast('Failed to add admin: ' + assignResult.error, 'error');
                }
            } catch (error) {
                UI.showToast('Error adding admin: ' + error.message, 'error');
            }
        });
    },
    
    /**
     * Show template manager for species, classes, or genders
     */
    async showTemplateManager(type) {
        if (!this.canManageGlobalTemplates()) {
            UI.showToast('Only system administrators can manage global class/species/gender templates.', 'warning');
            this.showUniverseManagement();
            return;
        }

        const adminContent = UI.elements.adminContent;
        UI.showLoading(adminContent, `Loading ${type}...`);
        
        try {
            API.invalidateTemplateCache(type);
            // Reload templates to ensure we have latest data
            let templates = [];
            if (type === 'species') {
                const result = await API.getSpecies();
                templates = result.data?.species || [];
                this.state.species = templates;
            } else if (type === 'classes') {
                const result = await API.getClasses();
                templates = result.data?.classes || [];
                this.state.classes = templates;
            } else if (type === 'genders') {
                const result = await API.getGenders();
                templates = result.data?.genders || [];
                this.state.genders = templates;
            } else {
                templates = this.state[type] || [];
            }
            
            const typeSingular = type.slice(0, -1); // Remove 's' for singular
            const canManageGlobal = this.canManageGlobalTemplates();
            
            adminContent.innerHTML = `
                <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                    <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Management (${templates.length})</h3>
                    ${canManageGlobal ? `<div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
                        ${type === 'classes' ? `
                            <button class="action-btn" id="btn-sync-free-advances" title="Sync free advances with prerequisites">🔄 Sync Free Advances</button>
                        ` : ''}
                        <button class="action-btn" id="btn-export-${type}" title="Export to CSV">📥 Export CSV</button>
                        <label class="action-btn" for="file-input-${type}" style="cursor: pointer;" title="Import from CSV">
                            📤 Import CSV
                            <input type="file" id="file-input-${type}" accept=".csv" style="display: none;">
                        </label>
                        <button class="action-btn primary" id="btn-new-${type}">+ New ${typeSingular}</button>
                    </div>` : '<span style="color: var(--text-muted); font-size: 0.9rem;">Use Universe Management → Classes tab to choose allowed classes per universe.</span>'}
                </div>
                ${type === 'classes' && canManageGlobal ? `
                <div style="background: var(--bg-dark); padding: var(--space-sm); border-radius: 4px; margin-bottom: var(--space-md); font-size: 0.9em; color: var(--text-secondary);">
                    <strong>📝 CSV Format Note:</strong> When editing prerequisites or free_advances, use <strong>semicolons (;)</strong> to separate multiple values, not commas. 
                    Example: <code>courtier;scholar;monk</code> (not <code>courtier,scholar,monk</code>)
                </div>
                ` : ''}
                ${type === 'species' && canManageGlobal ? `
                <div style="background: var(--bg-dark); padding: var(--space-sm); border-radius: 4px; margin-bottom: var(--space-md); font-size: 0.9em; color: var(--text-secondary);">
                    <strong>📝 CSV:</strong> <code>base_stats</code>, <code>stat_minimums</code>, and <code>stat_maximums</code> are JSON objects. Portrait files still go under <code>images/species/&lt;id&gt;.png</code> on GitHub Pages (full MOAP deploy).
                </div>
                ` : ''}
                ${type === 'genders' && canManageGlobal ? `
                <div style="background: var(--bg-dark); padding: var(--space-sm); border-radius: 4px; margin-bottom: var(--space-md); font-size: 0.9em; color: var(--text-secondary);">
                    <strong>📝 CSV:</strong> Portrait files go under <code>images/genders/&lt;id&gt;.png</code> on GitHub Pages (full MOAP deploy).
                </div>
                ` : ''}
                <div class="admin-search" style="margin-bottom: var(--space-md);">
                    <input type="text" id="search-${type}" placeholder="Search ${type}..." 
                           style="width: 100%; padding: var(--space-sm); background: var(--bg-medium); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                </div>
                <div class="template-list" style="max-height: 500px; overflow-y: auto;">
                    ${templates.length === 0 ? `<p class="placeholder-text">No ${type} found.</p>` : ''}
                    ${templates.map(t => this.renderTemplateRow(type, t)).join('')}
                </div>
            `;
            
            // Search functionality
            const searchInput = document.getElementById(`search-${type}`);
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const rows = adminContent.querySelectorAll('.template-row');
                    rows.forEach(row => {
                        const text = row.textContent.toLowerCase();
                        row.style.display = text.includes(query) ? '' : 'none';
                    });
                });
            }
            
            if (canManageGlobal) {
                document.getElementById(`btn-export-${type}`)?.addEventListener('click', () => {
                    if (type === 'classes') {
                        this.exportClassesToCSV(templates);
                    } else if (type === 'species') {
                        this.exportSpeciesToCSV(templates);
                    } else if (type === 'genders') {
                        this.exportGendersToCSV(templates);
                    }
                });

                if (type === 'classes') {
                    document.getElementById('btn-sync-free-advances')?.addEventListener('click', () => {
                        this.syncFreeAdvances(templates);
                    });
                }

                const fileInput = document.getElementById(`file-input-${type}`);
                if (fileInput) {
                    fileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            if (type === 'classes') {
                                this.importClassesFromCSV(file);
                            } else if (type === 'species') {
                                this.importSpeciesFromCSV(file);
                            } else if (type === 'genders') {
                                this.importGendersFromCSV(file);
                            }
                            e.target.value = '';
                        }
                    });
                }
            }
            
            // New template button
            document.getElementById(`btn-new-${type}`)?.addEventListener('click', () => {
                this.showTemplateEditor(type, null);
            });
            
            // Bind edit/delete buttons
            adminContent.querySelectorAll('.edit-template').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const template = templates.find(t => t.id === id);
                    if (template) {
                        this.showTemplateEditor(type, template);
                    }
                });
            });
            
            adminContent.querySelectorAll('.delete-template').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    const name = templates.find(t => t.id === id)?.name || id;
                    const confirmed = await UI.showConfirmDialog({
                        title: 'Delete template?',
                        message: `Are you sure you want to delete "${name}"? This cannot be undone.`,
                        confirmLabel: 'Delete',
                        danger: true
                    });
                    if (confirmed) {
                        try {
                            await API.deleteTemplate(type, id);
                            UI.showToast(`Deleted ${name}`, 'success');
                            this.showTemplateManager(type); // Refresh
                        } catch (error) {
                            UI.showToast('Failed: ' + error.message, 'error');
                        }
                    }
                });
            });

            adminContent.querySelectorAll('.clone-template').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const cloneType = e.currentTarget.dataset.type;
                    const id = e.currentTarget.dataset.id;
                    const template = templates.find(t => t.id === id);
                    if (!template) return;
                    if (cloneType === 'classes') {
                        this.showClassCloneEditor(template);
                    } else if (cloneType === 'species') {
                        this.showSpeciesCloneEditor(template);
                    }
                });
            });
            
        } catch (error) {
            UI.showError(adminContent, `Failed to load ${type}: ${error.message}`);
        }
    },
    
    /**
     * Render a template row for admin list
     */
    renderTemplateRow(type, template) {
        const icon = template.icon || (type === 'species' ? '🐉' : type === 'classes' ? '⚔️' : '⚧');
        const imagePreview = template.image ? 
            `<img src="${template.image.startsWith('images/') ? template.image : 'images/' + template.image}" 
                  style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; margin-right: 8px;" 
                  onerror="this.style.display='none';">` : '';
        
        return `
            <div class="template-row" data-id="${template.id}" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-md); border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; flex: 1;">
                    ${imagePreview}
                    <span style="font-size: 1.2rem; margin-right: 8px;">${icon}</span>
                    <div>
                        <strong style="color: var(--gold-light);">${template.name || template.id}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">ID: ${template.id}</div>
                        ${template.description ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">${template.description.substring(0, 60)}${template.description.length > 60 ? '...' : ''}</div>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: var(--space-sm);">
                    ${this.canManageGlobalTemplates() ? `
                    ${type === 'classes' || type === 'species'
                        ? `<button class="action-btn clone-template" data-type="${type}" data-id="${template.id}" title="Clone (JSON editor)">📋 Clone</button>`
                        : ''}
                    <button class="action-btn edit-template" data-type="${type}" data-id="${template.id}">✏️ Edit</button>
                    <button class="action-btn delete-template" data-type="${type}" data-id="${template.id}" style="background: var(--error);">🗑️ Delete</button>
                    ` : '<span style="color: var(--text-muted); font-size: 0.85rem;">View only</span>'}
                </div>
            </div>
        `;
    },

    getStandardClassImagePath(classId) {
        const id = (classId || '').trim();
        return id ? `classes/Class_Overview_${id}.png` : '';
    },

    buildUniformClassStatObject(value) {
        const stats = {};
        const names = (typeof F4_SEED_DATA !== 'undefined' && F4_SEED_DATA.statNames)
            ? F4_SEED_DATA.statNames
            : [];
        names.forEach(stat => { stats[stat] = value; });
        return stats;
    },

    getDefaultClassStatMinimums() {
        return this.buildUniformClassStatObject(2);
    },

    getDefaultClassStatMaximums() {
        return this.buildUniformClassStatObject(9);
    },

    wireClassFormImagePathSync(isNewClass) {
        const idInput = document.getElementById('template-id');
        const imageInput = document.getElementById('template-image');
        if (!idInput || !imageInput) return;

        const syncImage = () => {
            const id = idInput.value.trim();
            if (id && isNewClass) {
                imageInput.value = this.getStandardClassImagePath(id);
            }
        };

        idInput.addEventListener('input', syncImage);
        idInput.addEventListener('change', syncImage);
    },

    getStandardSpeciesImagePath(speciesId) {
        const id = (speciesId || '').trim();
        return id ? `species/${id}.png` : '';
    },

    prepareSpeciesClonePayload(sourceSpecies) {
        const clone = JSON.parse(JSON.stringify(sourceSpecies));
        delete clone._id;
        delete clone.createdAt;
        delete clone.updatedAt;
        delete clone.created_at;
        delete clone.updated_at;
        return clone;
    },

    /** New species editor: stats/resources copied from Human when available. */
    getDefaultNewSpeciesBaseline() {
        const human = (this.state.species || []).find(sp => sp.id === 'human');
        if (!human) {
            return null;
        }
        const b = JSON.parse(JSON.stringify(human));
        b.id = '';
        b.name = '';
        b.icon = '';
        b.description = '';
        b.image = '';
        return b;
    },

    wireSpeciesFormImagePathSync(isNewSpecies) {
        const idInput = document.getElementById('template-id');
        const imageInput = document.getElementById('template-image');
        if (!idInput || !imageInput) return;

        const syncImage = () => {
            const id = idInput.value.trim();
            if (id && isNewSpecies) {
                imageInput.value = this.getStandardSpeciesImagePath(id);
            }
        };

        idInput.addEventListener('input', syncImage);
        idInput.addEventListener('change', syncImage);
    },

    applySpeciesCloneIdNameToJson() {
        const textarea = document.getElementById('clone-species-json');
        const idInput = document.getElementById('clone-species-id');
        const nameInput = document.getElementById('clone-species-name');
        const hint = document.getElementById('clone-species-image-hint');
        if (!textarea || !idInput) return;

        try {
            const data = JSON.parse(textarea.value);
            const id = idInput.value.trim();
            const name = nameInput?.value.trim();
            if (id) {
                data.id = id;
                data.image = this.getStandardSpeciesImagePath(id);
            }
            if (name) {
                data.name = name;
            }
            textarea.value = JSON.stringify(data, null, 2);
            if (hint) {
                hint.textContent = data.image || '(set a species ID)';
            }
        } catch (e) {
            UI.showToast('Fix JSON before applying ID/name', 'warning');
        }
    },

    showSpeciesCloneEditor(sourceSpecies) {
        if (!this.canManageGlobalTemplates()) {
            UI.showToast('Only system administrators can create global species templates.', 'warning');
            return;
        }
        if (!sourceSpecies?.id) {
            UI.showToast('Invalid source species', 'error');
            return;
        }

        const suggestedId = `${sourceSpecies.id}_copy`;
        const payload = this.prepareSpeciesClonePayload(sourceSpecies);
        payload.id = suggestedId;
        payload.name = `${sourceSpecies.name || sourceSpecies.id} (Copy)`;
        payload.image = this.getStandardSpeciesImagePath(suggestedId);
        payload.enabled = payload.enabled !== false;
        payload.health = parseInt(payload.health, 10) || 100;
        payload.stamina = parseInt(payload.stamina, 10) || 100;
        const manaNum = parseInt(payload.mana, 10);
        payload.mana = Number.isNaN(manaNum) ? 50 : manaNum;
        payload.base_stats = payload.base_stats && typeof payload.base_stats === 'object' ? payload.base_stats : {};
        payload.stat_minimums = payload.stat_minimums && typeof payload.stat_minimums === 'object' ? payload.stat_minimums : {};
        payload.stat_maximums = payload.stat_maximums && typeof payload.stat_maximums === 'object' ? payload.stat_maximums : {};

        delete payload.prerequisites;
        delete payload.free_advances;
        delete payload.prerequisite;
        delete payload.vocation_id;
        delete payload.xp_cost;

        const modalBody = document.getElementById('modal-body');
        if (!modalBody) return;

        const jsonPreview = JSON.stringify(payload, null, 2)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;');

        modalBody.innerHTML = `
            <div class="admin-form">
                <h2 style="margin-bottom: var(--space-sm);">Clone Species</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-md); font-size: 0.95em;">
                    Based on <strong style="color: var(--gold-light);">${sourceSpecies.name || sourceSpecies.id}</strong>
                    (<code>${sourceSpecies.id}</code>). Edit the JSON, then save. Image path is set to
                    <code>species/&lt;id&gt;.png</code> on save (add files under <code>images/species/</code> in the public repo).
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-md);">
                    <div class="form-group" style="margin: 0;">
                        <label>New species ID</label>
                        <input type="text" id="clone-species-id" value="${suggestedId}" placeholder="e.g., frost_elf" style="width: 100%;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>New display name</label>
                        <input type="text" id="clone-species-name" value="${payload.name}" style="width: 100%;">
                    </div>
                </div>
                <div style="margin-bottom: var(--space-sm);">
                    <button type="button" class="action-btn" id="btn-apply-species-clone-id-name">Apply ID &amp; name to JSON</button>
                    <small style="color: var(--text-muted); margin-left: var(--space-sm);">
                        Image: <code id="clone-species-image-hint">${payload.image}</code>
                    </small>
                </div>
                <div class="form-group">
                    <label>Species JSON (edit freely)</label>
                    <textarea id="clone-species-json" rows="18"
                        style="width: 100%; font-family: monospace; font-size: 0.85em; line-height: 1.4;">${jsonPreview}</textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: var(--space-md); margin-top: var(--space-lg);">
                    <button class="action-btn primary" id="btn-save-species-clone">💾 Save as new species</button>
                    <button class="action-btn modal-cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('modal').classList.remove('hidden');

        document.getElementById('btn-apply-species-clone-id-name')?.addEventListener('click', () => {
            this.applySpeciesCloneIdNameToJson();
        });
        document.getElementById('clone-species-id')?.addEventListener('change', () => {
            this.applySpeciesCloneIdNameToJson();
        });
        document.getElementById('clone-species-name')?.addEventListener('change', () => {
            this.applySpeciesCloneIdNameToJson();
        });
        document.getElementById('btn-save-species-clone')?.addEventListener('click', async () => {
            await this.saveSpeciesClone();
        });
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });
    },

    async saveSpeciesClone() {
        const idInput = document.getElementById('clone-species-id')?.value.trim();
        const nameInput = document.getElementById('clone-species-name')?.value.trim();
        const jsonRaw = document.getElementById('clone-species-json')?.value.trim();

        if (!jsonRaw) {
            UI.showToast('JSON is empty', 'warning');
            return;
        }

        let templateData;
        try {
            templateData = JSON.parse(jsonRaw);
        } catch (e) {
            UI.showToast('Invalid JSON: ' + e.message, 'error');
            return;
        }

        const id = idInput || templateData.id;
        const name = nameInput || templateData.name;

        if (!id || !name) {
            UI.showToast('ID and name are required', 'warning');
            return;
        }

        if (this.state.species.some(sp => sp.id === id)) {
            UI.showToast(`Species ID "${id}" already exists`, 'warning');
            return;
        }

        templateData.id = id;
        templateData.name = name;
        templateData.icon = templateData.icon != null ? String(templateData.icon).trim() : '';
        templateData.description = templateData.description != null ? String(templateData.description).trim() : '';
        templateData.image = this.getStandardSpeciesImagePath(id);
        templateData.enabled = templateData.enabled !== false;
        templateData.health = parseInt(templateData.health, 10) || 100;
        templateData.stamina = parseInt(templateData.stamina, 10) || 100;
        templateData.mana = parseInt(templateData.mana, 10);
        if (Number.isNaN(templateData.mana)) {
            templateData.mana = 50;
        }

        const parseObj = (val, label) => {
            if (val == null) return {};
            if (typeof val === 'string') {
                try {
                    return JSON.parse(val);
                } catch (e) {
                    UI.showToast(`${label} must be valid JSON`, 'error');
                    return null;
                }
            }
            return typeof val === 'object' ? val : {};
        };

        const base = parseObj(templateData.base_stats, 'base_stats');
        const smin = parseObj(templateData.stat_minimums, 'stat_minimums');
        const smax = parseObj(templateData.stat_maximums, 'stat_maximums');
        if (base === null || smin === null || smax === null) return;

        templateData.base_stats = base;
        templateData.stat_minimums = smin;
        templateData.stat_maximums = smax;

        delete templateData.prerequisites;
        delete templateData.free_advances;
        delete templateData.prerequisite;
        delete templateData.vocation_id;
        delete templateData.xp_cost;

        try {
            await API.saveTemplate('species', id, templateData, true);
            UI.showToast(`Created species "${name}"`, 'success');
            document.getElementById('modal').classList.add('hidden');

            const result = await API.getSpecies();
            this.state.species = result.data?.species || [];
            this.showTemplateManager('species');
            await this.renderAll();
        } catch (error) {
            UI.showToast('Failed to save: ' + error.message, 'error');
        }
    },

    prepareClassClonePayload(sourceClass) {
        const clone = JSON.parse(JSON.stringify(sourceClass));
        delete clone._id;
        delete clone.createdAt;
        delete clone.updatedAt;
        delete clone.created_at;
        delete clone.updated_at;
        return clone;
    },

    applyClassCloneIdNameToJson() {
        const textarea = document.getElementById('clone-class-json');
        const idInput = document.getElementById('clone-class-id');
        const nameInput = document.getElementById('clone-class-name');
        const hint = document.getElementById('clone-class-image-hint');
        if (!textarea || !idInput) return;

        try {
            const data = JSON.parse(textarea.value);
            const id = idInput.value.trim();
            const name = nameInput?.value.trim();
            if (id) {
                data.id = id;
                data.image = this.getStandardClassImagePath(id);
            }
            if (name) {
                data.name = name;
            }
            textarea.value = JSON.stringify(data, null, 2);
            if (hint) {
                hint.textContent = data.image || '(set a class ID)';
            }
        } catch (e) {
            UI.showToast('Fix JSON before applying ID/name', 'warning');
        }
    },

    showClassCloneEditor(sourceClass) {
        if (!this.canManageGlobalTemplates()) {
            UI.showToast('Only system administrators can create global class templates.', 'warning');
            return;
        }
        if (!sourceClass?.id) {
            UI.showToast('Invalid source class', 'error');
            return;
        }

        const suggestedId = `${sourceClass.id}_copy`;
        const payload = this.prepareClassClonePayload(sourceClass);
        payload.id = suggestedId;
        payload.name = `${sourceClass.name || sourceClass.id} (Copy)`;
        payload.image = this.getStandardClassImagePath(suggestedId);
        payload.enabled = payload.enabled !== false;

        const modalBody = document.getElementById('modal-body');
        if (!modalBody) return;

        const jsonPreview = JSON.stringify(payload, null, 2)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;');

        modalBody.innerHTML = `
            <div class="admin-form">
                <h2 style="margin-bottom: var(--space-sm);">Clone Class</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-md); font-size: 0.95em;">
                    Based on <strong style="color: var(--gold-light);">${sourceClass.name || sourceClass.id}</strong>
                    (<code>${sourceClass.id}</code>). Edit the JSON, then save. Image path is set to
                    <code>classes/Class_Overview_&lt;id&gt;.png</code> on save (add files under <code>images/classes/</code> in the public repo later).
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-md);">
                    <div class="form-group" style="margin: 0;">
                        <label>New class ID</label>
                        <input type="text" id="clone-class-id" value="${suggestedId}" placeholder="e.g., knight_captain" style="width: 100%;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label>New display name</label>
                        <input type="text" id="clone-class-name" value="${payload.name}" style="width: 100%;">
                    </div>
                </div>
                <div style="margin-bottom: var(--space-sm);">
                    <button type="button" class="action-btn" id="btn-apply-clone-id-name">Apply ID &amp; name to JSON</button>
                    <small style="color: var(--text-muted); margin-left: var(--space-sm);">
                        Image: <code id="clone-class-image-hint">${payload.image}</code>
                    </small>
                </div>
                <div class="form-group">
                    <label>Class JSON (edit freely)</label>
                    <textarea id="clone-class-json" rows="18"
                        style="width: 100%; font-family: monospace; font-size: 0.85em; line-height: 1.4;">${jsonPreview}</textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: var(--space-md); margin-top: var(--space-lg);">
                    <button class="action-btn primary" id="btn-save-class-clone">💾 Save as new class</button>
                    <button class="action-btn modal-cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        document.getElementById('modal').classList.remove('hidden');

        document.getElementById('btn-apply-clone-id-name')?.addEventListener('click', () => {
            this.applyClassCloneIdNameToJson();
        });
        document.getElementById('clone-class-id')?.addEventListener('change', () => {
            this.applyClassCloneIdNameToJson();
        });
        document.getElementById('clone-class-name')?.addEventListener('change', () => {
            this.applyClassCloneIdNameToJson();
        });
        document.getElementById('btn-save-class-clone')?.addEventListener('click', async () => {
            await this.saveClassClone();
        });
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });
    },

    async saveClassClone() {
        const idInput = document.getElementById('clone-class-id')?.value.trim();
        const nameInput = document.getElementById('clone-class-name')?.value.trim();
        const jsonRaw = document.getElementById('clone-class-json')?.value.trim();

        if (!jsonRaw) {
            UI.showToast('JSON is empty', 'warning');
            return;
        }

        let templateData;
        try {
            templateData = JSON.parse(jsonRaw);
        } catch (e) {
            UI.showToast('Invalid JSON: ' + e.message, 'error');
            return;
        }

        const id = idInput || templateData.id;
        const name = nameInput || templateData.name;

        if (!id || !name) {
            UI.showToast('ID and name are required', 'warning');
            return;
        }

        if (this.state.classes.some(c => c.id === id)) {
            UI.showToast(`Class ID "${id}" already exists`, 'warning');
            return;
        }

        templateData.id = id;
        templateData.name = name;
        templateData.image = this.getStandardClassImagePath(id);
        templateData.enabled = templateData.enabled !== false;

        if (typeof templateData.prerequisites === 'string') {
            templateData.prerequisites = templateData.prerequisites.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (!Array.isArray(templateData.prerequisites)) {
            templateData.prerequisites = templateData.prerequisite ? [templateData.prerequisite] : [];
        }
        delete templateData.prerequisite;

        if (typeof templateData.free_advances === 'string') {
            templateData.free_advances = templateData.free_advances.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (!Array.isArray(templateData.free_advances)) {
            templateData.free_advances = [];
        }

        templateData.xp_cost = parseInt(templateData.xp_cost, 10) || 0;

        if (typeof templateData.stat_minimums === 'string') {
            try {
                templateData.stat_minimums = JSON.parse(templateData.stat_minimums);
            } catch (e) {
                UI.showToast('stat_minimums must be a JSON object', 'error');
                return;
            }
        }
        if (typeof templateData.stat_maximums === 'string') {
            try {
                templateData.stat_maximums = JSON.parse(templateData.stat_maximums);
            } catch (e) {
                UI.showToast('stat_maximums must be a JSON object', 'error');
                return;
            }
        }
        templateData.stat_minimums = templateData.stat_minimums || {};
        templateData.stat_maximums = templateData.stat_maximums || {};

        try {
            await API.saveTemplate('classes', id, templateData, true);
            UI.showToast(`Created class "${name}"`, 'success');
            document.getElementById('modal').classList.add('hidden');

            const result = await API.getClasses();
            this.state.classes = result.data?.classes || [];
            this.showTemplateManager('classes');
            await this.renderAll();
        } catch (error) {
            UI.showToast('Failed to save: ' + error.message, 'error');
        }
    },
    
    /**
     * Show template editor modal
     */
    showTemplateEditor(type, template) {
        if (!this.canManageGlobalTemplates()) {
            UI.showToast('Only system administrators can add or edit global templates.', 'warning');
            return;
        }
        const isNew = !template;
        const typeSingular = type.slice(0, -1);
        
        // Build form based on type
        let formHtml = '';
        
        if (type === 'genders') {
            formHtml = this.buildGenderForm(template);
        } else if (type === 'species') {
            formHtml = this.buildSpeciesForm(template);
        } else if (type === 'classes') {
            formHtml = this.buildClassForm(template);
        }
        
        const modalBody = document.getElementById('modal-body');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="admin-form">
                <h2 style="margin-bottom: var(--space-lg);">${isNew ? 'New' : 'Edit'} ${typeSingular.charAt(0).toUpperCase() + typeSingular.slice(1)}</h2>
                ${formHtml}
                <div class="form-actions" style="display: flex; gap: var(--space-md); margin-top: var(--space-lg);">
                    <button class="action-btn primary" id="btn-save-template">💾 Save</button>
                    <button class="action-btn modal-cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
        
        // Save button
        document.getElementById('btn-save-template')?.addEventListener('click', async () => {
            await this.saveTemplate(type, template);
        });
        
        // Cancel button
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });

        if (type === 'classes') {
            this.wireClassFormImagePathSync(isNew);
        } else if (type === 'species') {
            this.wireSpeciesFormImagePathSync(isNew);
        }
    },
    
    /**
     * Build gender form
     */
    buildGenderForm(gender) {
        const g = gender || { id: '', name: '', icon: '', description: '', image: '' };
        return `
            <div class="form-group">
                <label>ID (unique identifier)</label>
                <input type="text" id="template-id" value="${g.id}" ${gender ? 'readonly' : ''} 
                       placeholder="e.g., male, female" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="template-name" value="${g.name || ''}" 
                       placeholder="Display name" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Icon (emoji or character)</label>
                <input type="text" id="template-icon" value="${g.icon || ''}" 
                       placeholder="e.g., ♂, ♀, ⚧" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Image Path</label>
                <input type="text" id="template-image" value="${g.image || ''}" 
                       placeholder="genders/id.png (relative to images/)" style="width: 100%;">
                <small style="color: var(--text-muted);">Path relative to images/ folder</small>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="template-description" rows="3" 
                          placeholder="Description..." style="width: 100%;">${g.description || ''}</textarea>
            </div>
        `;
    },
    
    /**
     * Build species form
     */
    buildSpeciesForm(species) {
        const isEditing = !!species;
        const s = isEditing
            ? species
            : this.getDefaultNewSpeciesBaseline() || {
                  id: '',
                  name: '',
                  icon: '',
                  description: '',
                  image: '',
                  stat_minimums: {},
                  stat_maximums: {},
                  base_stats: {},
                  health: 100,
                  stamina: 100,
                  mana: 50
              };

        const statNames = F4_SEED_DATA.statNames || [];
        
        return `
            <div class="form-group">
                <label>ID (unique identifier)</label>
                <input type="text" id="template-id" value="${s.id}" ${isEditing ? 'readonly' : ''} 
                       placeholder="e.g., human, elf" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="template-name" value="${s.name || ''}" 
                       placeholder="Display name" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Icon</label>
                <input type="text" id="template-icon" value="${s.icon || ''}" 
                       placeholder="e.g., 👤, 🧝" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Image Path</label>
                <input type="text" id="template-image" value="${s.image || ''}" 
                       placeholder="species/id.png" style="width: 100%;">
                <small style="color: var(--text-muted);">Defaults to species/&lt;id&gt;.png when you enter the species ID (new species).</small>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="template-description" rows="3" 
                          placeholder="Description..." style="width: 100%;">${s.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Starting XP (new characters only)</label>
                <input type="number" id="template-starting-xp" value="${s.starting_xp != null ? s.starting_xp : 0}" min="0" step="1000" style="width: 100%;">
                <small style="color: var(--text-muted);">Bonus XP seeded in HUD KVP at creation. Default 0.</small>
            </div>
            <div class="form-group">
                <label>Resource Pools</label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm);">
                    <div>
                        <label style="font-size: 0.85rem;">Health</label>
                        <input type="number" id="template-health" value="${s.health || 100}" min="1" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-size: 0.85rem;">Stamina</label>
                        <input type="number" id="template-stamina" value="${s.stamina || 100}" min="1" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-size: 0.85rem;">Mana</label>
                        <input type="number" id="template-mana" value="${s.mana || 50}" min="0" style="width: 100%;">
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Base Stats (JSON object)</label>
                <textarea id="template-base-stats" rows="4" 
                          placeholder='{"agility": 3, "awareness": 3}' style="width: 100%; font-family: monospace;">${JSON.stringify(s.base_stats || {}, null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label>Stat Minimums (JSON object)</label>
                <textarea id="template-stat-minimums" rows="3" 
                          placeholder='{"agility": 3}' style="width: 100%; font-family: monospace;">${JSON.stringify(s.stat_minimums || {}, null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label>Stat Maximums (JSON object)</label>
                <textarea id="template-stat-maximums" rows="3" 
                          placeholder='{"endurance": 7}' style="width: 100%; font-family: monospace;">${JSON.stringify(s.stat_maximums || {}, null, 2)}</textarea>
            </div>
        `;
    },
    
    /**
     * Build class form
     */
    buildClassForm(cls) {
        const defaultStatMinimums = this.getDefaultClassStatMinimums();
        const defaultStatMaximums = this.getDefaultClassStatMaximums();
        const c = cls || {
            id: '', name: '', icon: '', description: '', image: '',
            vocation_id: '',
            stat_minimums: defaultStatMinimums,
            stat_maximums: defaultStatMaximums,
            prerequisite: null, free_advances: [], xp_cost: 0
        };

        const statMinimumsJson = JSON.stringify(
            cls ? (c.stat_minimums || {}) : defaultStatMinimums,
            null,
            2
        );
        const statMaximumsJson = JSON.stringify(
            cls ? (c.stat_maximums || {}) : defaultStatMaximums,
            null,
            2
        );
        
        return `
            <div class="form-group">
                <label>ID (unique identifier)</label>
                <input type="text" id="template-id" value="${c.id}" ${cls ? 'readonly' : ''} 
                       placeholder="e.g., peasant, knight" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="template-name" value="${c.name || ''}" 
                       placeholder="Display name" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Icon</label>
                <input type="text" id="template-icon" value="${c.icon || ''}" 
                       placeholder="e.g., ⚔️, 🛡️" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Image Path</label>
                <input type="text" id="template-image" value="${c.image || ''}" 
                       placeholder="classes/your_class_id.png" style="width: 100%;">
                <small style="color: var(--text-muted);">Defaults to classes/Class_Overview_&lt;id&gt;.png when you enter the class ID (new classes).</small>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="template-description" rows="3" 
                          placeholder="Description..." style="width: 100%;">${c.description || ''}</textarea>
            </div>
            <!-- Vocation picker removed: vocations unused/redundant with classes. class.vocation_id preserved on save when editing. -->
            <div class="form-group">
                <label>Prerequisites (comma-separated class IDs, or leave empty for beginner)</label>
                <input type="text" id="template-prerequisites" 
                       value="${(c.prerequisites || (c.prerequisite ? [c.prerequisite] : [])).join(', ')}" 
                       placeholder="soldier, guard, warrior (any one qualifies)" 
                       style="width: 100%;">
                <small style="color: var(--text-muted);">Character needs ANY one of these classes. Leave empty for beginner class.</small>
            </div>
            <div class="form-group">
                <label>XP Cost</label>
                <input type="number" id="template-xp-cost" value="${c.xp_cost || 0}" min="0" 
                       placeholder="0 for free" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Free Advances (comma-separated class IDs)</label>
                <input type="text" id="template-free-advances" value="${(c.free_advances || []).join(', ')}" 
                       placeholder="farmer, villager" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Stat Minimums (JSON object) - Required stats to qualify</label>
                <textarea id="template-stat-minimums" rows="8" 
                          placeholder='{"fighting": 2, "endurance": 2}' style="width: 100%; font-family: monospace;">${statMinimumsJson}</textarea>
                <small style="color: var(--text-muted);">Stats character must have at or above these values to qualify for this class. New classes default to 2 in every stat.</small>
            </div>
            <div class="form-group">
                <label>Stat Maximums (JSON object) - Stat caps in this class</label>
                <textarea id="template-stat-maximums" rows="8" 
                          placeholder='{"fighting": 9, "endurance": 9}' style="width: 100%; font-family: monospace;">${statMaximumsJson}</textarea>
                <small style="color: var(--text-muted);">New classes default to 9 in every stat.</small>
            </div>
        `;
    },
    
    /**
     * Save template (create or update)
     */
    async saveTemplate(type, existingTemplate) {
        if (!this.canManageGlobalTemplates()) {
            UI.showToast('Only system administrators can add or edit global templates.', 'warning');
            return;
        }
        try {
            const isNew = !existingTemplate;
            const id = document.getElementById('template-id').value.trim();
            const name = document.getElementById('template-name').value.trim();
            
            if (!id || !name) {
                UI.showToast('ID and Name are required', 'warning');
                return;
            }
            
            let templateData = {
                id: id,
                name: name,
                icon: document.getElementById('template-icon')?.value.trim() || '',
                description: document.getElementById('template-description')?.value.trim() || '',
                image: document.getElementById('template-image')?.value.trim() || '',
                enabled: true
            };
            
            // Type-specific fields
            if (type === 'genders') {
                // Gender is simple - already done
            } else if (type === 'species') {
                templateData.health = parseInt(document.getElementById('template-health')?.value) || 100;
                templateData.stamina = parseInt(document.getElementById('template-stamina')?.value) || 100;
                templateData.mana = parseInt(document.getElementById('template-mana')?.value) || 50;
                templateData.starting_xp = parseInt(document.getElementById('template-starting-xp')?.value) || 0;
                
                // Parse JSON fields
                try {
                    templateData.base_stats = JSON.parse(document.getElementById('template-base-stats')?.value || '{}');
                    templateData.stat_minimums = JSON.parse(document.getElementById('template-stat-minimums')?.value || '{}');
                    templateData.stat_maximums = JSON.parse(document.getElementById('template-stat-maximums')?.value || '{}');
                } catch (e) {
                    UI.showToast('Invalid JSON in stat fields', 'error');
                    return;
                }
                templateData.image = this.getStandardSpeciesImagePath(id);
            } else if (type === 'classes') {
                // Vocation picker removed from admin UI — preserve existing vocation_id when editing a class
                if (existingTemplate?.vocation_id) {
                    templateData.vocation_id = existingTemplate.vocation_id;
                }
                const prereqsInput = document.getElementById('template-prerequisites')?.value.trim();
                if (prereqsInput) {
                    templateData.prerequisites = prereqsInput.split(',').map(s => s.trim()).filter(s => s);
                    // Remove old single prerequisite field for consistency
                    delete templateData.prerequisite;
                } else {
                    templateData.prerequisites = [];
                    templateData.prerequisite = null;
                }
                templateData.xp_cost = parseInt(document.getElementById('template-xp-cost')?.value) || 0;
                
                const freeAdvances = document.getElementById('template-free-advances')?.value.trim();
                templateData.free_advances = freeAdvances ? freeAdvances.split(',').map(s => s.trim()).filter(s => s) : [];
                
                try {
                    templateData.stat_minimums = JSON.parse(document.getElementById('template-stat-minimums')?.value || '{}');
                    templateData.stat_maximums = JSON.parse(document.getElementById('template-stat-maximums')?.value || '{}');
                } catch (e) {
                    UI.showToast('Invalid JSON in stat fields', 'error');
                    return;
                }
                templateData.image = this.getStandardClassImagePath(id);
            }
            
            await API.saveTemplate(type, id, templateData, isNew);
            
            UI.showToast(`${isNew ? 'Created' : 'Updated'} ${name}`, 'success');
            document.getElementById('modal').classList.add('hidden');
            
            // Refresh the template list
            this.showTemplateManager(type);
            
            // Reload app state if needed
            if (type === 'species') {
                const result = await API.getSpecies();
                this.state.species = result.data?.species || [];
            } else if (type === 'classes') {
                const result = await API.getClasses();
                this.state.classes = result.data?.classes || [];
            } else if (type === 'genders') {
                const result = await API.getGenders();
                this.state.genders = result.data?.genders || [];
            }
            
            // Re-render UI
            await this.renderAll();
            
        } catch (error) {
            UI.showToast('Failed to save: ' + error.message, 'error');
        }
    },
    
    /**
     * Export classes to CSV format
     */
    exportClassesToCSV(classes) {
        try {
            // Define CSV columns
            const headers = [
                'id', 'name', 'icon', 'description', 'image', 'vocation_id',
                'prerequisites', 'xp_cost', 'free_advances', 'stat_minimums', 'stat_maximums', 'enabled'
            ];
            
            // Convert classes to CSV rows
            const rows = classes.map(cls => {
                // Always quote list fields (prerequisites, free_advances) since they use semicolons
                const prerequisitesStr = (cls.prerequisites || (cls.prerequisite ? [cls.prerequisite] : [])).join(';');
                const freeAdvancesStr = (cls.free_advances || []).join(';');
                
                const row = [
                    cls.id || '',
                    cls.name || '',
                    cls.icon || '',
                    (cls.description || '').replace(/"/g, '""'), // Escape quotes
                    cls.image || '',
                    cls.vocation_id || '',
                    prerequisitesStr, // Semicolon-separated list (will be quoted)
                    cls.xp_cost || 0,
                    freeAdvancesStr, // Semicolon-separated list (will be quoted)
                    JSON.stringify(cls.stat_minimums || {}), // JSON string
                    JSON.stringify(cls.stat_maximums || {}), // JSON string
                    cls.enabled !== false ? 'true' : 'false'
                ];
                
                // Wrap fields in quotes and escape internal quotes
                // Always quote prerequisites and free_advances (they contain semicolons)
                return row.map((field, index) => {
                    const str = String(field);
                    const isListField = index === 6 || index === 8; // prerequisites or free_advances
                    if (isListField || str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                }).join(',');
            });
            
            // Combine headers and rows
            const csvContent = [headers.join(','), ...rows].join('\n');
            
            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `classes_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            UI.showToast('Classes exported to CSV', 'success');
        } catch (error) {
            console.error('Export error:', error);
            UI.showToast('Failed to export: ' + error.message, 'error');
        }
    },
    
    /**
     * Import classes from CSV file
     */
    async importClassesFromCSV(file) {
        try {
            UI.showToast('Reading CSV file...', 'info');
            
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                UI.showToast('CSV file is empty or invalid', 'error');
                return;
            }
            
            // Parse headers
            const headers = this.parseCSVLine(lines[0]);
            const expectedHeaders = ['id', 'name', 'icon', 'description', 'image', 'vocation_id',
                'prerequisites', 'xp_cost', 'free_advances', 'stat_minimums', 'stat_maximums', 'enabled'];
            
            // Validate headers
            const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                UI.showToast(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
                return;
            }
            
            // Parse data rows
            const classes = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                
                // Debug: Log parsed values for problematic rows
                if (i === 10 || values.length !== headers.length) { // Row 11 (0-indexed = 10), or mismatched columns
                    console.log(`[CSV Debug] Row ${i + 1} parsed ${values.length} values:`, values);
                    console.log(`[CSV Debug] Row ${i + 1} expected ${headers.length} headers:`, headers);
                    console.log(`[CSV Debug] Row ${i + 1} raw line:`, lines[i]);
                }
                
                if (values.length !== headers.length) {
                    console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping.`);
                    continue;
                }
                
                const classData = {};
                headers.forEach((header, index) => {
                    const value = values[index] || '';
                    
                    switch (header) {
                        case 'id':
                        case 'name':
                        case 'icon':
                        case 'description':
                        case 'image':
                        case 'vocation_id':
                            // Simple string fields - just assign the value
                            classData[header] = value || '';
                            break;
                        case 'prerequisites':
                            // Accept semicolons (preferred) or commas as separators
                            // First, check what type of value we have
                            if (Array.isArray(value)) {
                                // Already an array - use it directly
                                classData[header] = value.map(v => String(v).trim()).filter(v => v);
                            } else if (value) {
                                // Ensure value is a string and trim it
                                const valueStr = String(value).trim();
                                // Only process if the value is not empty
                                if (valueStr) {
                                    // Debug: Log the raw value to see what we're getting (only for prerequisites field)
                                    if (i <= 3) {
                                        console.log(`[CSV Parse] Row ${i + 1} (${classData.id || 'unknown'}) prerequisites:`, {
                                            raw: value,
                                            type: typeof value,
                                            string: valueStr,
                                            length: valueStr.length
                                        });
                                    }
                                    
                                    // Prefer semicolon (export format), but accept comma if no semicolon found
                                    const hasSemicolon = valueStr.includes(';');
                                    const hasComma = valueStr.includes(',');
                                    const separator = hasSemicolon ? ';' : ',';
                                    
                                    // Only warn if:
                                    // 1. There are commas AND no semicolons
                                    // 2. The field is not empty (valueStr is truthy)
                                    // 3. It doesn't contain quotes (might be from a misparsed quoted field)
                                    // 4. It's not too long (might be from a misparsed description)
                                    if (!hasSemicolon && hasComma && valueStr && !valueStr.includes('"') && valueStr.length < 100) {
                                        console.warn(`Row ${i + 1} (${classData.id || 'unknown'}): prerequisites uses commas instead of semicolons. Value: "${valueStr}". Please use semicolons (;) in the future.`);
                                    }
                                    
                                    // Ensure valueStr is actually a string before splitting
                                    if (typeof valueStr !== 'string') {
                                        console.error(`Row ${i + 1} (${classData.id || 'unknown'}): prerequisites value is not a string:`, typeof valueStr, valueStr);
                                        classData[header] = [];
                                    } else {
                                        try {
                                            const splitResult = valueStr.split(separator);
                                            classData[header] = splitResult.map(s => {
                                                if (typeof s !== 'string') {
                                                    console.warn(`Row ${i + 1}: Non-string element in prerequisites split:`, typeof s, s);
                                                    return String(s).trim();
                                                }
                                                return s.trim();
                                            }).filter(s => s);
                                        } catch (error) {
                                            console.error(`Row ${i + 1} (${classData.id || 'unknown'}): Error splitting prerequisites:`, error, valueStr);
                                            classData[header] = [];
                                        }
                                    }
                                } else {
                                    classData[header] = [];
                                }
                            } else {
                                classData[header] = [];
                            }
                            // Remove old single prerequisite field if it exists
                            delete classData.prerequisite;
                            break;
                        case 'prerequisite':
                            // Legacy field name - map to prerequisites array
                            if (value && !classData.prerequisites) {
                                classData.prerequisites = Array.isArray(value) ? value : [String(value).trim()].filter(v => v);
                            }
                            break;
                        case 'xp_cost':
                            classData[header] = parseInt(value) || 0;
                            break;
                        case 'free_advances':
                            // Accept semicolons (preferred) or commas as separators
                            // First, check what type of value we have
                            if (Array.isArray(value)) {
                                // Already an array - use it directly
                                classData[header] = value.map(v => String(v).trim()).filter(v => v);
                            } else if (value) {
                                // Ensure value is a string
                                const valueStr = String(value);
                                if (valueStr.trim()) {
                                    const hasSemicolon = valueStr.includes(';');
                                    const hasComma = valueStr.includes(',');
                                    const separator = hasSemicolon ? ';' : ',';
                                    
                                    // Only warn if there are commas AND no semicolons
                                    if (!hasSemicolon && hasComma) {
                                        console.warn(`Row ${i + 1} (${classData.id || 'unknown'}): free_advances uses commas instead of semicolons. Please use semicolons (;) in the future.`);
                                    }
                                    
                                    // Ensure valueStr is actually a string before splitting
                                    if (typeof valueStr !== 'string') {
                                        console.error(`Row ${i + 1} (${classData.id || 'unknown'}): free_advances value is not a string:`, typeof valueStr, valueStr);
                                        classData[header] = [];
                                    } else {
                                        try {
                                            const splitResult = valueStr.split(separator);
                                            classData[header] = splitResult.map(s => {
                                                if (typeof s !== 'string') {
                                                    console.warn(`Row ${i + 1}: Non-string element in free_advances split:`, typeof s, s);
                                                    return String(s).trim();
                                                }
                                                return s.trim();
                                            }).filter(s => s);
                                        } catch (error) {
                                            console.error(`Row ${i + 1} (${classData.id || 'unknown'}): Error splitting free_advances:`, error, valueStr);
                                            classData[header] = [];
                                        }
                                    }
                                } else {
                                    classData[header] = [];
                                }
                            } else {
                                classData[header] = [];
                            }
                            break;
                        case 'stat_minimums':
                            try {
                                classData[header] = value ? JSON.parse(value) : {};
                            } catch (e) {
                                console.warn(`Invalid JSON in stat_minimums for row ${i + 1}:`, value);
                                classData[header] = {};
                            }
                            break;
                        case 'stat_maximums':
                            try {
                                classData[header] = value ? JSON.parse(value) : {};
                            } catch (e) {
                                console.warn(`Invalid JSON in stat_maximums for row ${i + 1}:`, value);
                                classData[header] = {};
                            }
                            break;
                        case 'enabled':
                            classData[header] = value.toLowerCase() === 'true' || value === '1';
                            break;
                    }
                });
                
                // Validate required fields
                if (!classData.id || !classData.name) {
                    console.warn(`Row ${i + 1} missing id or name. Skipping.`);
                    continue;
                }
                
                classes.push(classData);
            }
            
            if (classes.length === 0) {
                UI.showToast('No valid classes found in CSV', 'error');
                return;
            }
            
            const confirmed = await UI.showConfirmDialog({
                title: 'Import classes?',
                message:
                    `Import ${classes.length} classes?\n\n` +
                    `This will update existing classes and create new ones.\n` +
                    `Classes not in the CSV will remain unchanged.`,
                confirmLabel: 'Import'
            });
            if (!confirmed) return;
            
            UI.showToast(`Importing ${classes.length} classes...`, 'info');
            
            // Import classes using API
            let imported = 0;
            let errors = 0;
            const errorDetails = [];
            
            for (const cls of classes) {
                try {
                    // Ensure prerequisites is an array (handle edge cases)
                    if (!Array.isArray(cls.prerequisites)) {
                        if (typeof cls.prerequisites === 'string' && cls.prerequisites.trim()) {
                            try {
                                const separator = cls.prerequisites.includes(';') ? ';' : ',';
                                const splitResult = cls.prerequisites.split(separator);
                                cls.prerequisites = splitResult.map(s => {
                                    if (typeof s !== 'string') {
                                        return String(s).trim();
                                    }
                                    return s.trim();
                                }).filter(s => s);
                            } catch (e) {
                                console.error(`Error processing prerequisites for ${cls.id}:`, e, cls.prerequisites);
                                cls.prerequisites = [];
                            }
                        } else if (cls.prerequisites != null) {
                            // Try to convert to string if it's not null/undefined
                            try {
                                const valueStr = String(cls.prerequisites);
                                if (valueStr.trim()) {
                                    const separator = valueStr.includes(';') ? ';' : ',';
                                    const splitResult = valueStr.split(separator);
                                    cls.prerequisites = splitResult.map(s => {
                                        if (typeof s !== 'string') {
                                            return String(s).trim();
                                        }
                                        return s.trim();
                                    }).filter(s => s);
                                } else {
                                    cls.prerequisites = [];
                                }
                            } catch (e) {
                                console.warn(`Could not parse prerequisites for ${cls.id}:`, e, cls.prerequisites);
                                cls.prerequisites = [];
                            }
                        } else {
                            cls.prerequisites = [];
                        }
                    }
                    
                    // Ensure free_advances is an array
                    if (!Array.isArray(cls.free_advances)) {
                        if (typeof cls.free_advances === 'string' && cls.free_advances.trim()) {
                            try {
                                const separator = cls.free_advances.includes(';') ? ';' : ',';
                                const splitResult = cls.free_advances.split(separator);
                                cls.free_advances = splitResult.map(s => {
                                    if (typeof s !== 'string') {
                                        return String(s).trim();
                                    }
                                    return s.trim();
                                }).filter(s => s);
                            } catch (e) {
                                console.error(`Error processing free_advances for ${cls.id}:`, e, cls.free_advances);
                                cls.free_advances = [];
                            }
                        } else if (cls.free_advances != null) {
                            // Try to convert to string if it's not null/undefined
                            try {
                                const valueStr = String(cls.free_advances);
                                if (valueStr.trim()) {
                                    const separator = valueStr.includes(';') ? ';' : ',';
                                    const splitResult = valueStr.split(separator);
                                    cls.free_advances = splitResult.map(s => {
                                        if (typeof s !== 'string') {
                                            return String(s).trim();
                                        }
                                        return s.trim();
                                    }).filter(s => s);
                                } else {
                                    cls.free_advances = [];
                                }
                            } catch (e) {
                                console.warn(`Could not parse free_advances for ${cls.id}:`, e, cls.free_advances);
                                cls.free_advances = [];
                            }
                        } else {
                            cls.free_advances = [];
                        }
                    }
                    
                    // Debug: Log what we're about to save
                    console.log(`[IMPORT] Saving ${cls.id}:`, {
                        prerequisites: cls.prerequisites,
                        prerequisitesType: typeof cls.prerequisites,
                        prerequisitesIsArray: Array.isArray(cls.prerequisites),
                        fullClass: cls
                    });
                    
                    const result = await API.saveTemplate('classes', cls.id, cls, false);
                    if (result.success) {
                        imported++;
                        console.log(`✓ Imported ${cls.id}: prerequisites=${JSON.stringify(cls.prerequisites)}`);
                    } else {
                        errors++;
                        errorDetails.push(`${cls.id}: ${result.error}`);
                        console.error(`✗ Failed to import ${cls.id}:`, result.error);
                    }
                } catch (error) {
                    errors++;
                    errorDetails.push(`${cls.id}: ${error.message}`);
                    console.error(`Error importing ${cls.id}:`, error);
                }
            }
            
            let message = `Import complete! ${imported} classes imported`;
            if (errors > 0) {
                message += `, ${errors} errors`;
                if (errorDetails.length > 0 && errorDetails.length <= 5) {
                    message += `:\n${errorDetails.join('\n')}`;
                }
            }
            UI.showToast(message, errors > 0 ? 'warning' : 'success');
            
            if (errors > 0 && errorDetails.length > 0) {
                console.error('Import errors:', errorDetails);
            }
            
            // Refresh the template list
            this.showTemplateManager('classes');
            
            // Reload app state
            const result = await API.getClasses();
            this.state.classes = result.data?.classes || [];
            await this.renderAll();
            
        } catch (error) {
            console.error('Import error:', error);
            UI.showToast('Failed to import: ' + error.message, 'error');
        }
    },

    /**
     * Trigger browser download of CSV content
     */
    downloadCsvFile(filename, csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    /**
     * Format one CSV row; quote JSON columns and fields with commas/quotes/newlines
     */
    formatCsvRow(fields, jsonColumnIndexes) {
        const jsonSet = {};
        (jsonColumnIndexes || []).forEach((i) => { jsonSet[i] = true; });
        return fields.map((field, index) => {
            const str = String(field);
            if (jsonSet[index] || str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',');
    },

    parseJsonCsvField(value, fallback) {
        if (!value || !String(value).trim()) {
            return fallback || {};
        }
        try {
            return JSON.parse(value);
        } catch (e) {
            throw new Error('Invalid JSON: ' + String(value).substring(0, 80));
        }
    },

    /**
     * Export species templates to CSV
     */
    exportSpeciesToCSV(speciesList) {
        try {
            const headers = [
                'id', 'name', 'icon', 'description', 'image', 'starting_xp',
                'health', 'stamina', 'mana', 'base_stats', 'stat_minimums', 'stat_maximums', 'enabled'
            ];
            const jsonCols = [9, 10, 11];
            const rows = speciesList.map((sp) => {
                return this.formatCsvRow([
                    sp.id || '',
                    sp.name || '',
                    sp.icon || '',
                    (sp.description || '').replace(/"/g, '""'),
                    sp.image || '',
                    sp.starting_xp != null ? sp.starting_xp : 0,
                    sp.health != null ? sp.health : 100,
                    sp.stamina != null ? sp.stamina : 100,
                    sp.mana != null ? sp.mana : 50,
                    JSON.stringify(sp.base_stats || {}),
                    JSON.stringify(sp.stat_minimums || {}),
                    JSON.stringify(sp.stat_maximums || {}),
                    sp.enabled !== false ? 'true' : 'false'
                ], jsonCols);
            });
            const csvContent = [headers.join(','), ...rows].join('\n');
            this.downloadCsvFile(`species_export_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
            UI.showToast('Species exported to CSV', 'success');
        } catch (error) {
            console.error('exportSpeciesToCSV', error);
            UI.showToast('Failed to export: ' + error.message, 'error');
        }
    },

    /**
     * Import species templates from CSV
     */
    async importSpeciesFromCSV(file) {
        try {
            UI.showToast('Reading species CSV...', 'info');
            const text = await file.text();
            const lines = text.split('\n').filter((line) => line.trim());
            if (lines.length < 2) {
                UI.showToast('CSV file is empty or invalid', 'error');
                return;
            }
            const headers = this.parseCSVLine(lines[0]);
            const expectedHeaders = [
                'id', 'name', 'icon', 'description', 'image', 'starting_xp',
                'health', 'stamina', 'mana', 'base_stats', 'stat_minimums', 'stat_maximums', 'enabled'
            ];
            const missingHeaders = expectedHeaders.filter((h) => !headers.includes(h));
            if (missingHeaders.length > 0) {
                UI.showToast('Missing required columns: ' + missingHeaders.join(', '), 'error');
                return;
            }
            const speciesRows = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length !== headers.length) {
                    console.warn(`Species row ${i + 1}: column count mismatch, skipping`);
                    continue;
                }
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                if (!row.id || !row.name) {
                    continue;
                }
                speciesRows.push({
                    id: row.id.trim(),
                    name: row.name.trim(),
                    icon: row.icon || '',
                    description: row.description || '',
                    image: row.image || this.getStandardSpeciesImagePath(row.id.trim()),
                    starting_xp: parseInt(row.starting_xp, 10) || 0,
                    health: parseInt(row.health, 10) || 100,
                    stamina: parseInt(row.stamina, 10) || 100,
                    mana: parseInt(row.mana, 10) || 50,
                    base_stats: this.parseJsonCsvField(row.base_stats, {}),
                    stat_minimums: this.parseJsonCsvField(row.stat_minimums, {}),
                    stat_maximums: this.parseJsonCsvField(row.stat_maximums, {}),
                    enabled: row.enabled !== 'false'
                });
            }
            if (speciesRows.length === 0) {
                UI.showToast('No valid species found in CSV', 'error');
                return;
            }
            const confirmed = await UI.showConfirmDialog({
                title: 'Import species?',
                message: `Import ${speciesRows.length} species?\n\nUpdates existing IDs and creates new ones. Others unchanged.`,
                confirmLabel: 'Import'
            });
            if (!confirmed) {
                return;
            }
            API.invalidateTemplateCache('species');
            const existingResult = await API.getSpecies();
            const existingIds = new Set((existingResult.data?.species || []).map((s) => s.id));
            let imported = 0;
            let errors = 0;
            for (const sp of speciesRows) {
                try {
                    const isNew = !existingIds.has(sp.id);
                    const result = await API.saveTemplate('species', sp.id, sp, isNew);
                    if (result.success) {
                        imported++;
                        existingIds.add(sp.id);
                    } else {
                        errors++;
                        console.error('importSpeciesFromCSV', sp.id, result.error);
                    }
                } catch (err) {
                    errors++;
                    console.error('importSpeciesFromCSV', sp.id, err);
                }
            }
            UI.showToast(`Species import: ${imported} saved${errors ? `, ${errors} failed` : ''}`, imported ? 'success' : 'warning');
            this.showTemplateManager('species');
        } catch (error) {
            console.error('importSpeciesFromCSV', error);
            UI.showToast('Failed to import: ' + error.message, 'error');
        }
    },

    /**
     * Export gender templates to CSV
     */
    exportGendersToCSV(genders) {
        try {
            const headers = ['id', 'name', 'icon', 'description', 'image', 'enabled'];
            const rows = genders.map((g) => {
                return this.formatCsvRow([
                    g.id || '',
                    g.name || '',
                    g.icon || '',
                    (g.description || '').replace(/"/g, '""'),
                    g.image || '',
                    g.enabled !== false ? 'true' : 'false'
                ], []);
            });
            const csvContent = [headers.join(','), ...rows].join('\n');
            this.downloadCsvFile(`genders_export_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
            UI.showToast('Genders exported to CSV', 'success');
        } catch (error) {
            console.error('exportGendersToCSV', error);
            UI.showToast('Failed to export: ' + error.message, 'error');
        }
    },

    /**
     * Import gender templates from CSV
     */
    async importGendersFromCSV(file) {
        try {
            UI.showToast('Reading genders CSV...', 'info');
            const text = await file.text();
            const lines = text.split('\n').filter((line) => line.trim());
            if (lines.length < 2) {
                UI.showToast('CSV file is empty or invalid', 'error');
                return;
            }
            const headers = this.parseCSVLine(lines[0]);
            const expectedHeaders = ['id', 'name', 'icon', 'description', 'image', 'enabled'];
            const missingHeaders = expectedHeaders.filter((h) => !headers.includes(h));
            if (missingHeaders.length > 0) {
                UI.showToast('Missing required columns: ' + missingHeaders.join(', '), 'error');
                return;
            }
            const genderRows = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length !== headers.length) {
                    continue;
                }
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                if (!row.id || !row.name) {
                    continue;
                }
                genderRows.push({
                    id: row.id.trim(),
                    name: row.name.trim(),
                    icon: row.icon || '',
                    description: row.description || '',
                    image: row.image || ('genders/' + row.id.trim() + '.png'),
                    enabled: row.enabled !== 'false'
                });
            }
            if (genderRows.length === 0) {
                UI.showToast('No valid genders found in CSV', 'error');
                return;
            }
            const confirmed = await UI.showConfirmDialog({
                title: 'Import genders?',
                message: `Import ${genderRows.length} genders?\n\nUpdates existing IDs and creates new ones. Others unchanged.`,
                confirmLabel: 'Import'
            });
            if (!confirmed) {
                return;
            }
            API.invalidateTemplateCache('genders');
            const existingResult = await API.getGenders();
            const existingIds = new Set((existingResult.data?.genders || []).map((g) => g.id));
            let imported = 0;
            let errors = 0;
            for (const g of genderRows) {
                try {
                    const isNew = !existingIds.has(g.id);
                    const result = await API.saveTemplate('genders', g.id, g, isNew);
                    if (result.success) {
                        imported++;
                        existingIds.add(g.id);
                    } else {
                        errors++;
                        console.error('importGendersFromCSV', g.id, result.error);
                    }
                } catch (err) {
                    errors++;
                    console.error('importGendersFromCSV', g.id, err);
                }
            }
            UI.showToast(`Gender import: ${imported} saved${errors ? `, ${errors} failed` : ''}`, imported ? 'success' : 'warning');
            this.showTemplateManager('genders');
        } catch (error) {
            console.error('importGendersFromCSV', error);
            UI.showToast('Failed to import: ' + error.message, 'error');
        }
    },
    
    /**
     * Parse a CSV line handling quoted fields
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add last field
        result.push(current.trim());
        
        return result;
    },
    
    /**
     * Sync free advances: ensure each class's free_advances includes all classes that require it as a prerequisite
     */
    async syncFreeAdvances(classes) {
        try {
            UI.showToast('Analyzing prerequisites...', 'info');
            
            // Build reverse index: for each class, which classes require it
            const prerequisiteMap = {}; // { prerequisiteClassId: [classes that require it] }
            
            classes.forEach(cls => {
                // Support both single prerequisite (backward compat) and multiple prerequisites
                const prerequisites = cls.prerequisites || (cls.prerequisite ? [cls.prerequisite] : []);
                
                prerequisites.forEach(prereqId => {
                    if (!prerequisiteMap[prereqId]) {
                        prerequisiteMap[prereqId] = [];
                    }
                    prerequisiteMap[prereqId].push(cls.id);
                });
            });
            
            // Update each class's free_advances
            let updated = 0;
            let skipped = 0;
            const updates = [];
            
            for (const cls of classes) {
                const requiredClasses = prerequisiteMap[cls.id] || [];
                const currentFreeAdvances = cls.free_advances || [];
                
                // Merge: keep existing free advances, add any missing ones from prerequisites
                const newFreeAdvances = [...new Set([...currentFreeAdvances, ...requiredClasses])].sort();
                
                // Check if update is needed
                const currentSorted = [...currentFreeAdvances].sort();
                const needsUpdate = JSON.stringify(currentSorted) !== JSON.stringify(newFreeAdvances);
                
                if (needsUpdate) {
                    updates.push({
                        id: cls.id,
                        name: cls.name,
                        old: currentFreeAdvances,
                        new: newFreeAdvances
                    });
                } else {
                    skipped++;
                }
            }
            
            if (updates.length === 0) {
                UI.showToast('All free advances are already synced!', 'success');
                return;
            }
            
            // Show preview
            const preview = updates.slice(0, 5).map(u => 
                `${u.name}: ${u.old.length} → ${u.new.length}`
            ).join('\n');
            const more = updates.length > 5 ? `\n... and ${updates.length - 5} more` : '';
            
            const confirmed = await UI.showConfirmDialog({
                title: 'Sync free advances?',
                message:
                    `Update ${updates.length} classes?\n\n` +
                    `Preview:\n${preview}${more}\n\n` +
                    `This will add classes that require each class as a prerequisite to their free_advances.`,
                confirmLabel: 'Update'
            });
            if (!confirmed) return;
            
            UI.showToast(`Updating ${updates.length} classes...`, 'info');
            
            // Apply updates
            for (const update of updates) {
                try {
                    const cls = classes.find(c => c.id === update.id);
                    if (cls) {
                        await API.saveTemplate('classes', update.id, {
                            ...cls,
                            free_advances: update.new
                        }, false);
                        updated++;
                    }
                } catch (error) {
                    console.error(`Failed to update ${update.id}:`, error);
                }
            }
            
            UI.showToast(
                `Sync complete! Updated ${updated} classes, ${skipped} already correct.`,
                'success'
            );
            
            // Refresh the template list
            this.showTemplateManager('classes');
            
            // Reload app state
            const result = await API.getClasses();
            this.state.classes = result.data?.classes || [];
            await this.renderAll();
            
        } catch (error) {
            console.error('Sync free advances error:', error);
            UI.showToast('Failed to sync: ' + error.message, 'error');
        }
    },
    
    /**
     * Handle name/title typing without full UI re-render (MOAP-safe).
     */
    onCharacterTextFieldInput(field, value) {
        if (!this.state.character) return;
        if (field === 'name') {
            this.state.character.name = value;
            this.state.pendingChanges.name = value;
        } else if (field === 'title') {
            this.state.character.title = value;
            this.state.pendingChanges.title = value;
        }
        this.state.dirty = true;
        this.state.lastAutoSaveMessage = '';
        this.updateStatusIndicator();
        this.updateStepGuide();
        UI.renderCharacterSummary(
            this.state.character,
            this.state.currentSpecies,
            this.state.currentClass
        );
    },

    _broadcastScheduleTimer: null,

    /**
     * Debounced Players HUD sync — avoids history.replaceState on every keystroke.
     */
    scheduleBroadcastToPlayersHUD(character) {
        if (!character) return;
        const self = this;
        if (self._broadcastScheduleTimer) {
            clearTimeout(self._broadcastScheduleTimer);
        }
        self._broadcastScheduleTimer = setTimeout(function() {
            self._broadcastScheduleTimer = null;
            if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
                self.scheduleBroadcastToPlayersHUD(character);
                return;
            }
            self.broadcastCharacterToPlayersHUD(character);
        }, 500);
    },

    /**
     * Start session heartbeat
     */
    startHeartbeat() {
        // Send heartbeat every 4 minutes
        setInterval(async () => {
            try {
                await API.heartbeat();
                UI.setConnectionStatus(true);
            } catch (error) {
                console.warn('Heartbeat failed:', error);
                UI.setConnectionStatus(false);
            }
        }, 4 * 60 * 1000);
    },
    
    /**
     * Broadcast character data to Players HUD via LSL
     * This allows the Players HUD to sync its local data with Firestore
     */
    broadcastCharacterToPlayersHUD(character) {
        if (!character || !character.id) {
            return;
        }
        if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
            this.scheduleBroadcastToPlayersHUD(character);
            return;
        }
        this.pushCharacterToPlayersHUD(character.id);
    }
};  // End of App object

} catch (e) {
    if (window.simpleDebug) {
        window.simpleDebug('ERROR creating App object: ' + e.message, 'error');
        window.simpleDebug('Stack: ' + (e.stack || 'N/A'), 'error');
        window.simpleDebug('Line: ' + (e.lineNumber || 'N/A'), 'error');
    }
    console.error('App creation error:', e);
    // Create minimal App to prevent further errors
    App = {
        state: { character: null, species: [], classes: [], vocations: [], genders: [] },
        init: function() {
            if (window.simpleDebug) {
                window.simpleDebug('App.init() called but App is in error state', 'error');
            }
        },
        renderAll: function() {},
        loadData: function() { return Promise.resolve(); }
    };
}

// =========================== GLOBAL CALLBACKS ===========================

/**
 * Called when a species is selected in the gallery
 */
window.onSpeciesSelected = async function(speciesId) {
    if (!App.state.character) return;
    
    const previousSpeciesId = App.state.character.species_id;
    
    // Get species data
    const species = App.state.species.find(s => s.id === speciesId);
    if (!species) return;
    
    // For new characters, check if mana is available and let user choose
    if (App.state.isNewCharacter) {
        // Get universe to check if mana is enabled
        const universe = App.state.currentUniverse;
        const universeManaEnabled = universe?.manaEnabled || false;
        
        // Check if this species can use magic (universe allows mana AND species has mana pool > 0)
        const speciesManaPool = species.mana || 0;
        const speciesCanUseMagic = universeManaEnabled && speciesManaPool > 0;
        
        if (speciesCanUseMagic) {
            // Use species base mana pool
            const manaAmount = species.mana || 0;
            
            // Show choice dialog - ask user if they want to be magically gifted
            UI.showModal(`
                <div class="modal-content">
                    <h2 class="modal-title">Species Selected: ${species.name}</h2>
                    <div class="modal-text" style="text-align: center; padding: var(--space-md);">
                        <p style="font-size: 1.1em; margin-bottom: var(--space-md);">
                            ✨ <strong>Your choice of species is allowed to use magic.</strong>
                        </p>
                        <p style="font-size: 1em; margin-bottom: var(--space-md);">
                            Do you want your character to be <strong>magically gifted</strong>?
                        </p>
                        <div style="text-align: left; background: var(--bg-secondary); padding: var(--space-md); border-radius: var(--border-radius); margin: var(--space-md) 0;">
                            <p style="margin: 0 0 var(--space-sm) 0;"><strong>If Yes:</strong></p>
                            <ul style="margin: 0 0 var(--space-md) var(--space-md); padding: 0;">
                                <li>Your character will have <strong>${manaAmount} mana points</strong></li>
                                <li>You can select <strong>arcane-related classes</strong></li>
                                <li>You can learn and cast <strong>spells</strong></li>
                            </ul>
                            <p style="margin: 0 0 var(--space-sm) 0;"><strong>If No:</strong></p>
                            <ul style="margin: 0; padding: 0 0 0 var(--space-md);">
                                <li>Your character will focus on <strong>non-magical abilities</strong></li>
                                <li>Arcane classes will <strong>not be available</strong></li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-actions" style="display: flex; gap: var(--space-sm); justify-content: center; margin-top: var(--space-lg);">
                        <button class="btn-secondary" id="btn-no-mana">No</button>
                        <button class="btn-primary" id="btn-yes-mana">Yes</button>
                    </div>
                </div>
            `);
            
            // Store the species and mana amount temporarily
            App.state.pendingManaResult = { manaAmount, speciesId };
            
            // Function to finalize species selection with mana choice
            const finalizeSpeciesSelection = (hasMana) => {
                App.state.character.species_id = speciesId;
                App.state.character.has_mana = hasMana;
                
                if (hasMana) {
                    App.state.character.mana = { current: manaAmount, base: manaAmount, max: manaAmount };
                } else {
                    App.state.character.mana = { current: 0, base: 0, max: 0 };
                }
                
                // Store species factors for LSL
                App.state.character.species_factors = {
                    health_factor: species.health_factor || 25,
                    stamina_factor: species.stamina_factor || 25,
                    mana_factor: species.mana_factor || 25
                };
                
                App.state.pendingChanges.species_id = speciesId;
                App.state.pendingChanges.has_mana = hasMana;
                App.state.pendingChanges.mana = App.state.character.mana;
                App.state.pendingChanges.species_factors = App.state.character.species_factors;
                
                // Mark as dirty and update save button
                App.state.dirty = true;
                App.updateStatusIndicator();
                
                // Clear pending mana result
                App.state.pendingManaResult = null;
                
                UI.hideModal();
                UI.showToast(`Selected: ${species.name}${hasMana ? ' (with mana!)' : ''}`, 'success', 3000);
                
                // Reset stats to this species' default line (F3 zero-sum budget)
                if (speciesId !== previousSpeciesId) {
                    const mergedStats = window.getSpeciesDefaultStats(speciesId);
                    App.state.character.stats = mergedStats;
                    App.state.pendingChanges.stats = mergedStats;
                    UI.showToast(`Stats set to ${species.name} base values`, 'info', 2000);
                }
                
                // Re-render to update UI
                App.renderAll();
            };
            
            // Bind Yes button - user wants magic
            document.getElementById('btn-yes-mana')?.addEventListener('click', () => {
                finalizeSpeciesSelection(true);
            });
            
            // Bind No button - user doesn't want magic
            document.getElementById('btn-no-mana')?.addEventListener('click', () => {
                finalizeSpeciesSelection(false);
            });
        } else {
            // Species cannot use magic (either universe doesn't allow it or species has 0% chance)
            // Show simple confirmation and proceed without mana
            UI.showModal(`
                <div class="modal-content">
                    <h2 class="modal-title">Species Selected: ${species.name}</h2>
                    <div class="modal-text" style="text-align: center; padding: var(--space-md);">
                        ${!universeManaEnabled 
                            ? '<p>ℹ️ This universe does not support magic.</p>' 
                            : '<p>ℹ️ This species cannot use magic.</p>'}
                        <p>Your character will focus on non-magical abilities.</p>
                    </div>
                    <div class="modal-actions" style="display: flex; gap: var(--space-sm); justify-content: center; margin-top: var(--space-lg);">
                        <button class="btn-primary" id="btn-accept-species-no-magic">Accept</button>
                    </div>
                </div>
            `);
            
            // Bind accept button
            document.getElementById('btn-accept-species-no-magic')?.addEventListener('click', () => {
                App.state.character.species_id = speciesId;
                App.state.character.has_mana = false;
                App.state.character.mana = { current: 0, base: 0, max: 0 };
                
                // Store species factors for LSL
                App.state.character.species_factors = {
                    health_factor: species.health_factor || 25,
                    stamina_factor: species.stamina_factor || 25,
                    mana_factor: species.mana_factor || 25
                };
                
                App.state.pendingChanges.species_id = speciesId;
                App.state.pendingChanges.has_mana = false;
                App.state.pendingChanges.mana = App.state.character.mana;
                App.state.pendingChanges.species_factors = App.state.character.species_factors;
                
                // Mark as dirty and update save button
                App.state.dirty = true;
                App.updateStatusIndicator();
                
                UI.hideModal();
                UI.showToast(`Selected: ${species.name}`, 'success', 3000);
                
                // Reset stats to this species' default line (F3 zero-sum budget)
                if (speciesId !== previousSpeciesId) {
                    const mergedStats = window.getSpeciesDefaultStats(speciesId);
                    App.state.character.stats = mergedStats;
                    App.state.pendingChanges.stats = mergedStats;
                    UI.showToast(`Stats set to ${species.name} base values`, 'info', 2000);
                }
                
                // Re-render to update UI
                App.renderAll();
            });
        }
        
        return; // Don't proceed with normal selection flow
    }
    
    // For existing characters, proceed normally (just update the species)
    App.state.character.species_id = speciesId;
    App.state.pendingChanges.species_id = speciesId;
    
    // Mark as dirty and update save button
    App.state.dirty = true;
    App.updateStatusIndicator();
    
    // Update species factors for existing characters
    if (species) {
        App.state.character.species_factors = {
            health_factor: species.health_factor || 25,
            stamina_factor: species.stamina_factor || 25,
            mana_factor: species.mana_factor || 25
        };
        App.state.pendingChanges.species_factors = App.state.character.species_factors;
    }
    
    // Recalculate resource pools with new species modifiers
    App.recalculateResourcePools();
    
    // Recalculate resource pools based on current stats
    App.recalculateResourcePools();
    
    await App.renderAll();
    UI.showToast(`Selected: ${species?.name || speciesId}`, 'info', 1500);
};

/**
 * Called when a class is selected in the gallery
 * @param {string} classId - The class to change to
 * @param {boolean} isFreeAdvance - Whether this is a free advancement
 */
window.onClassSelected = async function(classId, isFreeAdvance = false) {
    if (!App.state.character) return;
    
    const classTemplate = (App.state.filteredClasses || []).find(c => c.id === classId)
        || App.state.classes.find(c => c.id === classId);
    if (!classTemplate) return;

    if (classId === App.state.character.class_id) {
        UI.showToast(`Already ${classTemplate.name}`, 'info', 1500);
        return;
    }

    const allClasses = (App.state.filteredClasses && App.state.filteredClasses.length > 0)
        ? App.state.filteredClasses
        : (App.state.classes || []);
    const classOptions = {
        enforceStatMinimums: App.state.enforceClassStatMinimums !== false,
        universe: App.state.currentUniverse
    };
    const canChange = API.canChangeToClass(App.state.character, classTemplate, allClasses, classOptions);
    if (!canChange.canChange) {
        UI.showToast(canChange.reason || 'Cannot select this class', 'warning', 3500);
        return;
    }

    // Creation wizard: pick class locally, save via Save Progress / Finish (not changeClass)
    if (App.isInCreationFlow()) {
        App.state.character.class_id = classId;
        App.state.character.stats_at_class_start = { ...App.state.character.stats };
        App.state.character.class_started_at = new Date().toISOString();
        App.state.currentClass = classTemplate;
        App.state.pendingChanges.class_id = classId;
        App.state.pendingChanges.stats_at_class_start = { ...App.state.character.stats };
        App.state.pendingChanges.class_started_at = App.state.character.class_started_at;
        if (canChange.xpCost > 0) {
            App.state.pendingClassXpCost = canChange.xpCost;
        } else {
            delete App.state.pendingClassXpCost;
        }
        App.state.dirty = true;
        App.updateStatusIndicator();
        App.updateStepGuide();
        await App.renderAll();
        const costHint = canChange.isFreeAdvance
            ? ' (free advance)'
            : (canChange.xpCost > 0 ? ` — ${canChange.xpCost} XP on save` : '');
        UI.showToast(`Class selected: ${classTemplate.name}${costHint} — save your progress`, 'success', 2500);
        return;
    }
    
    // Existing character: changeClass saves immediately (career tracking + XP)
    const characterId = App.state.character.id;
    if (!characterId) {
        App.state.character.class_id = classId;
        App.state.currentClass = classTemplate;
        App.state.pendingChanges.class_id = classId;
        App.state.dirty = true;
        App.updateStatusIndicator();
        await App.renderAll();
        UI.showToast(`Class selected: ${classTemplate.name}`, 'success');
        return;
    }

    const costLabel = canChange.isFreeAdvance
        ? 'FREE (maxed current class)'
        : (canChange.xpCost > 0 ? `${canChange.xpCost} XP` : 'Free');
    const unusedXp = window.getUnusedXp ? window.getUnusedXp(App.state.character) : 0;
    const confirmed = await UI.showConfirmDialog({
        title: 'Change class?',
        message: `Switch to ${classTemplate.name}?\n\nCost: ${costLabel}` +
            (canChange.xpCost > 0 && !canChange.isFreeAdvance ? `\nUnused XP: ${unusedXp}` : ''),
        confirmLabel: canChange.xpCost > 0 && !canChange.isFreeAdvance
            ? `Pay ${canChange.xpCost} XP`
            : 'Confirm',
        cancelLabel: 'Cancel',
        allowBackdropCancel: true
    });
    if (!confirmed) {
        return;
    }

    try {
        const result = await API.changeClass(classId, classTemplate, canChange.isFreeAdvance, characterId, {
            xp_lifetime: App.state.character.xp_lifetime,
            xp_spent: App.state.character.xp_spent,
            ap_balance: App.state.character.ap_balance
        });
        
        if (result.success) {
            const xpCharged = result.data.xpCost || 0;
            if (xpCharged > 0) {
                App.state.character.xp_spent = window.getEconSpent(App.state.character) + xpCharged;
                App.state.econSessionActive = true;
                if (App.state.econ) {
                    App.state.econ.xp_spent = App.state.character.xp_spent;
                }
            }
            const savedSpent = App.state.character.xp_spent;
            const savedLife = App.state.character.xp_lifetime;
            const savedAp = App.state.character.ap_balance;
            const charResult = await API.getCharacterById(characterId);
            if (charResult.success) {
                App.state.character = charResult.data.character;
                App.state.character.xp_lifetime = savedLife;
                App.state.character.xp_spent = savedSpent;
                App.state.character.ap_balance = savedAp;
            }
            App.state.currentClass = classTemplate;
            App.state.pendingChanges = {};
            App.state.dirty = false;
            App.state.lastAutoSaveMessage = result.data.message || 'Class updated';
            App.updateStatusIndicator();
            await App.renderAll();
            if (xpCharged > 0) {
                UI.showToast('Syncing XP spend to HUD...', 'info', 1500);
                window.pushEconToHud();
            }
            await App.cacheHudStatsForPlayers(App.state.character);
            UI.showToast((result.data.message || 'Class updated') + ' — saved to server', 'success', 3500);
        } else {
            UI.showToast(result.error || 'Could not change class', 'warning', 4000);
        }
    } catch (error) {
        console.error('Class change error:', error);
        UI.showToast('Error changing class — please try again', 'error');
    }
};

/**
 * Called when a gender is selected
 */
window.onGenderSelected = async function(gender) {
    if (!App.state.character) return;
    
    App.state.character.gender = gender;
    App.state.pendingChanges.gender = gender;
    
    // Mark as dirty and update save button
    App.state.dirty = true;
    App.updateStatusIndicator();
    
    // Update visual selection
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gender === gender);
    });
    
    await App.renderAll();
    App.scheduleBroadcastToPlayersHUD(App.state.character);
};

// Bind gender buttons to global handler
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-gender]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Handle click on child elements
            const genderBtn = e.target.closest('[data-gender]');
            if (genderBtn) {
                window.onGenderSelected(genderBtn.dataset.gender);
            }
        });
    });
});

/**
 * Get the minimum allowed value for a stat based on species bonuses
 * Formula: 1 + species bonus for that stat
 * Example: Elf with +2 Agility can lower Agility to 3 (1 base + 2 bonus)
 */
window.getStatMinimum = function(character, statName) {
    if (!character) return 1;
    
    const speciesId = character.species_id;
    const species = App.state.species?.find(s => s.id === speciesId);
    const speciesBaseStats = species?.base_stats || {};
    const speciesBase = speciesBaseStats[statName] || 2; // Default is 2
    
    // Minimum is: 1 + (species_base - 2)
    // Example: species_base=4 means bonus of +2, so minimum is 1+2=3
    return Math.max(1, 1 + (speciesBase - 2));
};

/**
 * Calculate point cost to increase from current level
 * Uses exponential formula: 2^(level-1)
 * Level 1→2: 1pt, 2→3: 2pt, 3→4: 4pt, etc.
 */
window.getStatPointCost = function(fromLevel) {
    return Math.pow(2, fromLevel - 1);
};

/**
 * Calculate total point cost of a stat at a given level (F3 / Stats Hud).
 * Sum of costs from level 1 up to current level (2→3 costs 2, all 2s cost 1 each).
 */
window.getStatTotalCost = function(level) {
    if (level <= 1) return 0;
    let total = 0;
    for (let l = 1; l < level; l++) {
        total += Math.pow(2, l - 1);
    }
    return total;
};

/**
 * Default stat line for a species (all 2s, merged with species base_stats).
 */
window.getSpeciesDefaultStats = function(speciesId) {
    const defaultStats = App.getDefaultStats();
    if (!speciesId || speciesId === 'human') {
        return defaultStats;
    }
    const species = App.state.species?.find(s => s.id === speciesId);
    const speciesStats = species?.base_stats || {};
    const merged = { ...defaultStats };
    Object.keys(speciesStats).forEach(stat => {
        merged[stat] = speciesStats[stat];
    });
    return merged;
};

/**
 * Point budget for a species' default stat line (20 for human = all 2s).
 * Matches F3's 20000 XP starter pool when defaults are applied.
 */
window.getSpeciesStatBudget = function(speciesId) {
    const defaults = window.getSpeciesDefaultStats(speciesId || 'human');
    let total = 0;
    for (const stat in defaults) {
        total += window.getStatTotalCost(defaults[stat] || 2);
    }
    return total;
};

/**
 * Canonical 20-stat map for point math (named keys, numeric fallback, species defaults).
 */
window.getMergedCharacterStatsForPoints = function(character) {
    const speciesId = String(character.species_id || 'human').toLowerCase();
    const defaults = window.getSpeciesDefaultStats(speciesId);
    const statNames = (typeof F4_SEED_DATA !== 'undefined' && F4_SEED_DATA.statNames)
        ? F4_SEED_DATA.statNames
        : Object.keys(defaults);
    const raw = character.stats || {};
    const merged = {};

    statNames.forEach(function (stat, idx) {
        let val = raw[stat];
        if (val == null && raw[String(idx)] != null) {
            val = raw[String(idx)];
        }
        if (val == null) {
            val = defaults[stat] || 2;
        }
        val = parseInt(val, 10);
        if (isNaN(val) || val < 1) {
            val = defaults[stat] || 2;
        }
        merged[stat] = val;
    });

    return { speciesId: speciesId, defaults: defaults, stats: merged };
};

/**
 * XP economy v2 — KVP authoritative via HUD URL roundtrip.
 */
window.XP_PER_AP = 1000;

/** True when Setup was opened from HUD with KVP economy in the URL. */
window.hasHudEconInUrl = function () {
    try {
        const p = new URLSearchParams(window.location.search);
        return p.has('xp_lifetime') || p.has('xp_total');
    } catch (e) {
        return false;
    }
};

/** True when HUD passed live pool pipes on the Setup URL. */
window.hasHudPoolsInUrl = function () {
    try {
        const p = new URLSearchParams(window.location.search);
        return p.has('health_pipe') || p.has('stamina_pipe') || p.has('mana_pipe');
    } catch (e) {
        return false;
    }
};

window.getEconFromUrl = function () {
    let lifetime = 0;
    let spent = 0;
    let ap = 0;
    try {
        const params = new URLSearchParams(window.location.search);
        const urlLife = parseInt(params.get('xp_lifetime'), 10);
        const urlLegacy = parseInt(params.get('xp_total'), 10);
        const urlSpent = parseInt(params.get('xp_spent'), 10);
        const urlAp = parseInt(params.get('ap_balance'), 10);
        if (!isNaN(urlLife) && urlLife >= 0) {
            lifetime = urlLife;
        } else if (!isNaN(urlLegacy) && urlLegacy >= 0) {
            lifetime = urlLegacy;
        }
        if (!isNaN(urlSpent) && urlSpent >= 0) {
            spent = urlSpent;
        }
        if (!isNaN(urlAp) && urlAp >= 0) {
            ap = urlAp;
        }
    } catch (e) { /* ignore */ }
    return { xp_lifetime: lifetime, xp_spent: spent, ap_balance: ap };
};

window.syncEconToCharacter = function (character) {
    if (!character) {
        return;
    }
    if (character.xp_lifetime == null) {
        character.xp_lifetime = 0;
    }
    if (character.xp_spent == null) {
        character.xp_spent = 0;
    }
    if (character.ap_balance == null) {
        character.ap_balance = 0;
    }
};

window.getEconLifetime = function (character) {
    window.syncEconToCharacter(character);
    let lifetime = Math.max(0, parseInt(character.xp_lifetime, 10) || 0);
    const url = window.getEconFromUrl();
    if (url.xp_lifetime > lifetime) {
        lifetime = url.xp_lifetime;
        character.xp_lifetime = lifetime;
    }
    if (lifetime === 0 && !window.hasHudEconInUrl()) {
        const legacy = parseInt(character.xp_total, 10);
        if (!isNaN(legacy) && legacy > 0) {
            lifetime = legacy;
            character.xp_lifetime = legacy;
        }
    }
    return lifetime;
};

window.getEconSpent = function (character) {
    window.syncEconToCharacter(character);
    let spent = Math.max(0, parseInt(character.xp_spent, 10) || 0);
    if (typeof App !== 'undefined' && App.state.econSessionActive && App.state.econ
        && App.state.econ.xp_spent != null && !isNaN(parseInt(App.state.econ.xp_spent, 10))) {
        spent = Math.max(0, parseInt(App.state.econ.xp_spent, 10));
        character.xp_spent = spent;
        return spent;
    }
    const url = window.getEconFromUrl();
    if (url.xp_spent > spent) {
        spent = url.xp_spent;
        character.xp_spent = spent;
    }
    if (spent === 0 && !window.hasHudEconInUrl()) {
        const lifetime = window.getEconLifetime(character);
        const docAvail = parseInt(character.xp_available, 10);
        if (lifetime > 0 && !isNaN(docAvail) && docAvail >= 0 && docAvail <= lifetime) {
            spent = lifetime - docAvail;
            character.xp_spent = spent;
        }
    }
    return spent;
};

window.getApBalance = function (character) {
    if (!character) {
        return 0;
    }
    window.syncEconToCharacter(character);
    let ap = Math.max(0, parseInt(character.ap_balance, 10) || 0);
    if (typeof App !== 'undefined' && App.state.econSessionActive && App.state.econ
        && App.state.econ.ap_balance != null && !isNaN(parseInt(App.state.econ.ap_balance, 10))) {
        ap = Math.max(0, parseInt(App.state.econ.ap_balance, 10));
        character.ap_balance = ap;
    }
    return ap;
};

/** Species starting AP budget (human bonus only — v2 stores remainder in ap_balance KVP field). */
window.getSpeciesStartingAp = function (character) {
    if (!character || character.species_id !== 'human') {
        return 0;
    }
    return 10;
};

/**
 * Fix stale KVP ap_balance when Firestore stats prove AP was spent but HUD still shows starting bonus.
 * Skips when xp_spent > 0 (player bought AP or paid class XP from the XP pool).
 */
window.reconcileStaleApBalance = function (character) {
    if (!character || !character.stats || !character.species_id) {
        return false;
    }
    if (window.getEconSpent(character) > 0) {
        return false;
    }
    const spentAbove = window.calculatePointsSpentAboveDefault(character);
    if (spentAbove <= 0) {
        return false;
    }
    const currentAp = window.getApBalance(character);
    const startingAp = window.getSpeciesStartingAp(character);
    if (startingAp <= 0 || currentAp !== startingAp) {
        return false;
    }
    const corrected = Math.max(0, startingAp - spentAbove);
    if (corrected >= currentAp) {
        return false;
    }
    character.ap_balance = corrected;
    if (typeof App !== 'undefined') {
        if (!App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.ap_balance = corrected;
        App.state.econSessionActive = true;
    }
    console.log('[XP] Reconciled stale AP balance:', currentAp, '→', corrected, '(stats prove', spentAbove, 'AP spent)');
    return true;
};

window.updateEconUrlParams = function (spent, ap) {
    try {
        const currentUrl = new URL(window.location.href);
        if (ap != null && !isNaN(ap)) {
            currentUrl.searchParams.set('ap_balance', String(ap));
        }
        if (spent != null && !isNaN(spent)) {
            currentUrl.searchParams.set('xp_spent', String(spent));
        }
        if (typeof App !== 'undefined' && App.safeHistoryReplaceState) {
            App.safeHistoryReplaceState(currentUrl.toString());
        } else {
            window.history.replaceState({}, '', currentUrl.toString());
        }
    } catch (e) { /* ignore */ }
};

window.getUnusedXp = function (character) {
    const lifetime = window.getEconLifetime(character);
    const spent = window.getEconSpent(character);
    return Math.max(0, lifetime - spent);
};

window.getMoapActiveTab = function () {
    const btn = document.querySelector('nav.tab-nav .tab-btn.active');
    if (btn && btn.dataset && btn.dataset.tab) {
        return btn.dataset.tab;
    }
    return 'stats';
};

window.restoreMoapTabFromUrl = function () {
    try {
        const tab = new URLSearchParams(window.location.search).get('moap_tab');
        if (tab && typeof UI !== 'undefined' && UI.switchTab) {
            UI.switchTab(tab);
        }
    } catch (e) { /* ignore */ }
};

window._econPushTimer = null;

window.schedulePushEconToHud = function () {
    if (window._econPushTimer) {
        clearTimeout(window._econPushTimer);
    }
    window._econPushTimer = setTimeout(function () {
        window._econPushTimer = null;
        window.pushEconToHud();
    }, 400);
};

window.pushEconToHud = function () {
    const char = App.state.character;
    if (!char) {
        return false;
    }
    if (typeof App !== 'undefined' && App.persistMoapSessionDraft) {
        App.persistMoapSessionDraft(true);
    }
    if (typeof MoapDialogs !== 'undefined' && MoapDialogs.isActive && MoapDialogs.isActive()) {
        window.schedulePushEconToHud();
        return false;
    }
    if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
        window.schedulePushEconToHud();
        return false;
    }
    try {
        const currentUrl = new URL(window.location.href);
        const spentStr = String(window.getEconSpent(char));
        const apStr = String(window.getApBalance(char));
        const ts = Date.now().toString();
        currentUrl.searchParams.set('xp_spent', spentStr);
        currentUrl.searchParams.set('ap_balance', apStr);
        currentUrl.searchParams.set('econ_ts', ts);
        currentUrl.searchParams.set('moap_tab', window.getMoapActiveTab());
        if (char.id) {
            currentUrl.searchParams.set('active_char', char.id);
        }
        currentUrl.searchParams.set('lsl_cmd', 'UPDATE_ECON|' + spentStr + '|' + apStr + '|' + ts);
        currentUrl.searchParams.set('lsl_cmd_ts', ts);
        // Full navigation — SL reads face-4 media URL via llGetLinkMedia
        window.location.assign(currentUrl.toString());
        return true;
    } catch (e) {
        console.error('[XP] pushEconToHud failed:', e);
    }
    return false;
};

window.spendXpForClass = function (xpCost) {
    const char = App.state.character;
    if (!char || xpCost <= 0) {
        return true;
    }
    const unused = window.getUnusedXp(char);
    if (unused < xpCost) {
        return false;
    }
    char.xp_spent = window.getEconSpent(char) + xpCost;
    window.pushEconToHud();
    return true;
};

window.buyPointsWithXp = function (pointCount) {
    const char = App.state.character;
    if (!char) {
        return false;
    }
    const n = parseInt(pointCount, 10);
    if (isNaN(n) || n <= 0) {
        UI.showToast('Enter a positive number of points', 'warning');
        return false;
    }
    const xpCost = n * window.XP_PER_AP;
    const unused = window.getUnusedXp(char);
    if (unused < xpCost) {
        UI.showToast('Need ' + xpCost + ' unused XP (have ' + unused + ')', 'warning');
        return false;
    }
    char.xp_spent = window.getEconSpent(char) + xpCost;
    char.ap_balance = window.getApBalance(char) + n;
    App.state.econSessionActive = true;
    if (App.state.econ) {
        App.state.econ.ap_balance = char.ap_balance;
        App.state.econ.xp_spent = char.xp_spent;
    }
    if (App.state.dirty && App.state.pendingChanges && App.state.pendingChanges.stats) {
        UI.showToast('Buying points — your unsaved stat changes are kept for this session.', 'info', 2500);
    }
    if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Syncing ' + xpCost + ' XP spend to HUD...', 'info', 2000);
    }
    window.pushEconToHud();
    return true;
};

/** Legacy formula — migration only */
window.calculateLegacyAvailablePoints = function (character) {
    if (!character) {
        return 0;
    }
    const XP_PER_POINT = 1000;
    const HUMAN_STARTING_BONUS = 10;
    const merged = window.getMergedCharacterStatsForPoints(character);
    const speciesBonus = (merged.speciesId === 'human') ? HUMAN_STARTING_BONUS : 0;
    const earnedXP = window.getEconLifetime(character);
    const earnedPoints = Math.floor(earnedXP / XP_PER_POINT);
    const spentAboveDefault = window.calculatePointsSpentAboveDefault(character);
    return Math.max(0, speciesBonus + earnedPoints - spentAboveDefault);
};

window.getAuthoritativeXpTotal = function (character) {
    return window.getEconLifetime(character);
};

window.calculateAvailablePoints = function (character) {
    return window.getApBalance(character);
};

/**
 * Points spent above this species' default stat line (refunds if lowered below default).
 */
window.calculatePointsSpentAboveDefault = function(character) {
    const merged = window.getMergedCharacterStatsForPoints(character);
    const defaults = merged.defaults;
    const stats = merged.stats;
    let spentAbove = 0;

    for (const stat in stats) {
        const current = stats[stat];
        const defaultLevel = defaults[stat] || 2;
        spentAbove += window.getStatTotalCost(current) - window.getStatTotalCost(defaultLevel);
    }

    return spentAbove;
};

/**
 * Saved stat floor for this session (value when character was loaded / last saved).
 */
window.getStatSavedFloor = function(statName) {
    const floor = App.state.statsFloor;
    if (!floor || floor[statName] == null) {
        return 1;
    }
    return floor[statName];
};

/**
 * Called when a stat is changed (+ / −). Session-only until Save Character.
 */
window.onStatChange = async function(stat, action) {
    if (!App.state.character) return;
    
    const currentValue = App.state.character.stats[stat] || 1;
    const caps = App.calculateStatCaps();
    const max = Math.min(caps[stat] || 9, 9);
    const savedFloor = window.getStatSavedFloor(stat);
    let availablePoints = window.getApBalance(App.state.character);
    
    if (action === 'decrease') {
        if (currentValue <= savedFloor) {
            UI.showToast('Cannot lower below saved value (' + savedFloor + ')', 'warning');
            return;
        }
        const refund = window.getStatPointCost(currentValue - 1);
        App.state.character.stats[stat] = currentValue - 1;
        App.state.character.ap_balance = availablePoints + refund;
        App.state.pendingChanges.stats = App.state.character.stats;
        App.state.pendingChanges.ap_balance = App.state.character.ap_balance;
        App.state.econSessionActive = true;
        if (App.state.econ) {
            App.state.econ.ap_balance = App.state.character.ap_balance;
        }
        window.updateEconUrlParams(null, App.state.character.ap_balance);
        UI.showToast(`−1 ${stat} (refund: ${refund} AP)`, 'info', 1500);
    } else if (action === 'increase') {
        if (!App.state.character.class_id && currentValue >= 2) {
            UI.showToast('Select a class to raise stats above 2', 'warning');
            return;
        }
        if (currentValue >= max) {
            UI.showToast(`Stat capped at ${max} for your class`, 'warning');
            return;
        }
        
        const cost = window.getStatPointCost(currentValue);
        if (availablePoints < cost) {
            UI.showToast(`Need ${cost} AP (have ${availablePoints})`, 'warning');
            return;
        }
        
        App.state.character.stats[stat] = currentValue + 1;
        App.state.character.ap_balance = availablePoints - cost;
        App.state.pendingChanges.stats = App.state.character.stats;
        App.state.pendingChanges.ap_balance = App.state.character.ap_balance;
        App.state.econSessionActive = true;
        if (App.state.econ) {
            App.state.econ.ap_balance = App.state.character.ap_balance;
        }
        window.updateEconUrlParams(null, App.state.character.ap_balance);
        UI.showToast(`+1 ${stat} (cost: ${cost} AP)`, 'info', 1500);
    } else {
        return;
    }
    
    App.state.dirty = true;
    App.updateStatusIndicator();
    if (typeof App.persistMoapSessionDraft === 'function') {
        App.persistMoapSessionDraft();
    }

    await App.renderAll();
};

// =========================== INITIALIZATION =============================

// App.init() is invoked from hud.html after scripts finish loading (async chain).

