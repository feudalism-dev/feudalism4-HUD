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
        apFloor: null,
        xpSpentFloor: null,
        statsAbandonBaseline: null,
        isNewCharacter: false,
        creationInProgress: false,
        creationStepId: null,
        creationMaxStepIndex: 0,
        lastAutoSaveMessage: '',
        dirty: false,  // UX 2: Track unsaved changes
        statsPending: false,  // AP / stat grid edits not yet pushed to HUD LSD/KVP
        econSessionActive: false,  // AP/XP edits this session override stale URL params
        creationStepHints: {
            universe: 'Choose a <strong>universe</strong> (and registration code if required), then continue.',
            identity: 'Enter <strong>name</strong>, optional <strong>title</strong>, then pick <strong>gender</strong> and <strong>species</strong>. Confirm species for starting XP. Then continue to Stats.',
            stats: 'Spend XP/AP if you want — or leave them. Use <strong>Reset to defaults</strong> to undo spends. Then continue to Class.',
            class: 'Pick a <strong>starting class</strong>, then continue to Review.',
            review: 'Confirm your character, then <strong>Finish</strong> to save it — or <strong>Cancel creation</strong> to discard.'
        },
        awaitingWelcomeChoice: false
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
    _creationKvpSeeded: {},
    _hudGameplayHydrationGen: 0,

    isCreationKvpSeeded(charId) {
        if (!charId) {
            return false;
        }
        if (this._creationKvpSeeded && this._creationKvpSeeded[charId]) {
            return true;
        }
        try {
            return sessionStorage.getItem('f4_kvp_seeded_' + charId) === '1';
        } catch (e) {
            return false;
        }
    },

    markCreationKvpSeeded(charId) {
        if (!charId) {
            return;
        }
        if (!this._creationKvpSeeded) {
            this._creationKvpSeeded = {};
        }
        this._creationKvpSeeded[charId] = true;
        try {
            sessionStorage.setItem('f4_kvp_seeded_' + charId, '1');
        } catch (e) { /* ignore */ }
    },

    /** True when the Stats tab is active (read-only session polls only). */
    isMoapStatsTabActive() {
        return typeof window.getMoapActiveTab === 'function' && window.getMoapActiveTab() === 'stats';
    },

    /** True when the player has spent XP/AP or changed stats beyond the species-confirmed starter line. */
    hasEditedGameplay(char, statsCsvOpt) {
        if (!char) {
            return false;
        }
        if (this.state.statsPending) {
            return true;
        }
        const spent = window.getEconSpent(char);
        const ap = window.getApBalance(char);
        if (spent > 0 || ap > 0) {
            return true;
        }
        const csv = statsCsvOpt || this.statsCsvFromChar(char) || this._lastStatsCsvSynced || '';
        if (csv && !this.csvIsStarterDefault(csv)) {
            return true;
        }
        return false;
    },

    /**
     * Finish creation / setup_complete: always persist stats + econ to Experience KVP.
     */
    async finishCreationGameplayToKvp(char, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id || !this.isBridgeHudMode()) {
            return false;
        }
        const statsCsv = options.statsCsv || this.statsCsvFromChar(char);
        return await this.seedHudKvpGameplay(char, {
            statsCsv: statsCsv,
            allowStarterSeed: true,
            forceWrite: true,
            syncEcon: true,
            syncSlot: true,
            forceSlotSync: options.forceSlotSync === true,
            silent: options.silent !== false,
            showSuccess: !!options.showSuccess,
            xpLifetime: char.xp_lifetime
        });
    },

    /**
     * Write creation gameplay to Experience KVP: first save seeds starter line; later saves sync edits only.
     */
    async syncCreationGameplayToKvp(char, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id || !this.isBridgeHudMode() || !this.isInCreationFlow()) {
            return false;
        }
        const statsCsv = options.statsCsv || this.statsCsvFromChar(char);
        if (!statsCsv) {
            return false;
        }
        if (!this.isCreationKvpSeeded(char.id)) {
            if (this._lastBridgeSession && this._lastBridgeSession.ok
                && (this._lastBridgeSession.characterId || '') === char.id) {
                const sessionCsv = this._lastBridgeSession.stats_csv || '';
                if (sessionCsv && !this.csvIsStarterDefault(sessionCsv)) {
                    this.markCreationKvpSeeded(char.id);
                    return true;
                }
            }
            if (!this.shouldWriteStatsToKvp(char, statsCsv, {
                allowStarterSeed: true,
                forceFirstSeed: true
            })) {
                return false;
            }
            await this.pushCreationStarterToKvp(char, {
                statsCsv: statsCsv,
                forceSlotSync: true
            });
            return true;
        }
        if (this.hasEditedGameplay(char, statsCsv) || options.forceGameplaySync) {
            if (!this.shouldWriteStatsToKvp(char, statsCsv, {
                allowStarterSeed: true
            })) {
                return false;
            }
            return await this.seedHudKvpGameplay(char, {
                statsCsv: statsCsv,
                allowStarterSeed: true,
                syncEcon: true,
                silent: options.silent !== false,
                showSuccess: !!options.showSuccess
            });
        }
        return false;
    },

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

    /** True for Second Life avatar keys (8-4-4-4-12). Character mint ids are 32 hex without dashes. */
    isAvatarUuidKey(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }
        const s = value.trim().toLowerCase();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
    },

    /**
     * Experience / Firestore character document ids — never an avatar UUID.
     * Rejects blank-write garbage like "1,", owner-uuid-as-character ghosts,
     * and wire status tokens like "ident_list_ok" (empty-roster LSL slice bug).
     */
    isPlausibleCharacterId(id) {
        if (!id || typeof id !== 'string') {
            return false;
        }
        const s = id.trim();
        if (s.length < 8 || s.length > 64) {
            return false;
        }
        if (s.indexOf(',') >= 0 || s.indexOf('|') >= 0 || s.indexOf(';') >= 0) {
            return false;
        }
        if (/^ident_/i.test(s) || /_(ok|fail)$/i.test(s)) {
            return false;
        }
        if (/^(OK|ERR|PENDING|BRIDGE_)/i.test(s)) {
            return false;
        }
        if (this.isAvatarUuidKey(s)) {
            return false;
        }
        if (API.uuid && s.toLowerCase() === String(API.uuid).toLowerCase()) {
            return false;
        }
        return true;
    },

    filterPlausibleCharacters(characters) {
        const list = Array.isArray(characters) ? characters : [];
        const out = [];
        let i;
        for (i = 0; i < list.length; i++) {
            const c = list[i];
            if (!c || !this.isPlausibleCharacterId(c.id)) {
                console.warn('[loadData] Dropping non-character id from roster:', c && c.id);
                continue;
            }
            out.push(c);
        }
        return out;
    },

    clearStaleCharacterSelection() {
        this.state.selectedCharacterId = null;
        if (typeof API !== 'undefined') {
            API.activeCharacterId = null;
            if (API.user) {
                API.user.activeCharacter = null;
            }
        }
        try {
            sessionStorage.removeItem(this.getActiveCharacterStorageKey());
        } catch (e) { /* ignore */ }
        try {
            if (API.uuid) {
                sessionStorage.removeItem('f4_roster_' + API.uuid);
            }
        } catch (e2) { /* ignore */ }
        if (typeof API !== 'undefined') {
            API._listCharactersCache = [];
            API._listCharactersCacheTs = 0;
        }
    },

    /** True when character has no persisted universe (legacy KVP roster / migration gap). */
    characterMissingUniverse(char) {
        if (!char || !this.isPlausibleCharacterId(char.id)) {
            return false;
        }
        const u = char.universe_id;
        if (u === undefined || u === null) {
            return true;
        }
        if (typeof u !== 'string') {
            return true;
        }
        const trimmed = u.trim();
        return trimmed === '' || trimmed === 'JSON_INVALID' || trimmed === 'null';
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
        if (typeof UI.clearNativeTooltips === 'function') {
            UI.clearNativeTooltips(document);
        }
        
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
     * Load species/classes/vocations/genders once per session (seed + sessionStorage; 0 Firestore reads).
     */
    async ensureTemplatesLoaded(forceReload) {
        if (forceReload) {
            API.invalidateTemplateCache();
        }
        if (!forceReload && this.state.templatesLoaded && this.state.species.length > 0 && this.state.classes.length > 0) {
            return { success: true, cached: true };
        }

        const tplOpts = forceReload ? { forceFirestore: true } : {};
        let speciesResult, classesResult, vocationsResult, gendersResult;
        if (window.IS_SL_BROWSER) {
            speciesResult = await API.getSpecies(tplOpts);
            classesResult = await API.getClasses(tplOpts);
            vocationsResult = await API.getVocations(tplOpts);
            gendersResult = await API.getGenders(tplOpts);
        } else {
            [speciesResult, classesResult, vocationsResult, gendersResult] = await Promise.all([
                API.getSpecies(tplOpts),
                API.getClasses(tplOpts),
                API.getVocations(tplOpts),
                API.getGenders(tplOpts)
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
     * Read name/title from DOM into state before save (MOAP can drop input events).
     */
    flushIdentityFromForm() {
        const char = this.state.character;
        if (!char) {
            return;
        }
        const nameEl = UI.elements.charName || document.getElementById('char-name');
        const titleEl = UI.elements.charTitle || document.getElementById('char-title');
        if (nameEl && typeof nameEl.value === 'string') {
            const nameVal = nameEl.value;
            char.name = nameVal;
            if (!this.state.pendingChanges) {
                this.state.pendingChanges = {};
            }
            this.state.pendingChanges.name = nameVal;
        }
        if (titleEl && typeof titleEl.value === 'string') {
            const titleVal = titleEl.value;
            char.title = titleVal;
            if (!this.state.pendingChanges) {
                this.state.pendingChanges = {};
            }
            this.state.pendingChanges.title = titleVal;
        }
    },

    upsertCharacterInRosterCache(character) {
        if (!character || !this.isPlausibleCharacterId(character.id)) {
            return;
        }
        if (!API._listCharactersCache) {
            API._listCharactersCache = [];
        }
        let found = false;
        API._listCharactersCache = API._listCharactersCache.map(function (c) {
            if (c.id === character.id) {
                found = true;
                return Object.assign({}, character);
            }
            return c;
        });
        if (!found) {
            API._listCharactersCache.unshift(character);
        }
        if (API._dedupeCharactersById) {
            API._listCharactersCache = API._dedupeCharactersById(API._listCharactersCache);
        }
        API._listCharactersCacheTs = Date.now();
        if (API.uuid) {
            try {
                sessionStorage.setItem(
                    'f4_roster_' + API.uuid,
                    JSON.stringify({ characters: API._listCharactersCache })
                );
            } catch (e) { /* ignore */ }
        }
    },

    /**
     * Refresh UI after save without re-fetching templates or full loadData().
     */
    async refreshAfterCharacterSave(savedCharacter, options) {
        if (options === undefined) {
            options = {};
        }
        const inCreation = this.isInCreationFlow();
        this.flushIdentityFromForm();
        const identityPreserve = {
            name: (this.state.pendingChanges && this.state.pendingChanges.name != null)
                ? this.state.pendingChanges.name
                : (this.state.character && this.state.character.name != null)
                    ? this.state.character.name
                    : (savedCharacter && savedCharacter.name != null) ? savedCharacter.name : '',
            title: (this.state.pendingChanges && this.state.pendingChanges.title != null)
                ? this.state.pendingChanges.title
                : (this.state.character && this.state.character.title != null)
                    ? this.state.character.title
                    : (savedCharacter && savedCharacter.title != null) ? savedCharacter.title : '',
            gender: (this.state.character && this.state.character.gender)
                || (savedCharacter && savedCharacter.gender),
            species_id: (this.state.character && this.state.character.species_id)
                || (savedCharacter && savedCharacter.species_id)
        };
        if (savedCharacter) {
            this.upsertCharacterInRosterCache(savedCharacter);
        }
        const preSaveChar = this.state.character;
        const hudStats = preSaveChar?.stats
            ? Object.assign({}, preSaveChar.stats)
            : null;
        const hudAp = preSaveChar ? window.getApBalance(preSaveChar) : null;
        const hudSpent = preSaveChar ? window.getEconSpent(preSaveChar) : null;
        const hudLife = preSaveChar ? window.getEconLifetime(preSaveChar) : null;
        const hudStatsCsv = this._lastStatsCsvSynced || '';
        this.state.character = savedCharacter;
        if (typeof API !== 'undefined' && API.discardFirestoreGameplayFields) {
            API.discardFirestoreGameplayFields(this.state.character);
        }
        if (identityPreserve.name != null && identityPreserve.name !== '') {
            this.state.character.name = identityPreserve.name;
        }
        if (identityPreserve.title != null) {
            this.state.character.title = identityPreserve.title;
        }
        if (identityPreserve.gender) {
            this.state.character.gender = identityPreserve.gender;
        }
        if (identityPreserve.species_id) {
            this.state.character.species_id = identityPreserve.species_id;
        }
        let statsToRestore = hudStats;
        if (hudStatsCsv && this.statsObjectFromCsv(hudStatsCsv)) {
            const csvLooksAuthoritative = !this.csvIsStarterDefault(hudStatsCsv);
            const hudLooksFactory = !hudStats || this.csvIsStarterDefault(this.statsCsvFromChar({ stats: hudStats }));
            if (csvLooksAuthoritative || hudLooksFactory) {
                statsToRestore = this.statsObjectFromCsv(hudStatsCsv);
            }
        }
        if (statsToRestore) {
            this.state.character.stats = Object.assign({}, statsToRestore);
        } else if (inCreation && !this.state.character.stats) {
            this.state.character.stats = Object.assign({}, this.getNewCharacterStats());
        }
        if (inCreation) {
            if (this._bridgeSessionApplied && this._lastBridgeSession && savedCharacter.id) {
                this.applyBridgeSessionToCharacter(this.state.character, this._lastBridgeSession);
            } else {
                if (hudStats) {
                    this.state.character.stats = Object.assign({}, hudStats);
                }
                if (hudLife != null && hudLife > 0) {
                    this.state.character.xp_lifetime = hudLife;
                    this.state.character.xp_spent = hudSpent != null ? hudSpent : 0;
                    this.state.character.ap_balance = hudAp != null ? hudAp : 0;
                    this.state.character.xp_available = Math.max(0, hudLife - (hudSpent || 0));
                    if (typeof App.state.econ === 'undefined' || !App.state.econ) {
                        App.state.econ = {};
                    }
                    App.state.econ.xp_lifetime = hudLife;
                    App.state.econ.xp_spent = hudSpent || 0;
                    App.state.econ.ap_balance = hudAp || 0;
                    App.state.econSessionActive = true;
                } else if (this.state.character.species_id) {
                    this.applyCalculatedStarterEcon(this.state.character);
                }
            }
        } else {
            if (hudLife != null) {
                this.state.character.xp_lifetime = hudLife;
            }
            if (hudSpent != null) {
                this.state.character.xp_spent = hudSpent;
            }
            if (hudAp != null) {
                this.state.character.ap_balance = hudAp;
            }
        }
        if (!inCreation) {
            this.mergeStatsFromUrlIntoCharacter();
        }
        this.normalizeCharacterStats(this.state.character);
        this.state.selectedCharacterId = savedCharacter.id;
        this.syncActiveCharToUrl(savedCharacter.id);
        if (savedCharacter.class_id) {
            this.state.currentClass = this.state.classes.find(function (c) {
                return c.id === savedCharacter.class_id;
            });
        }
        if (savedCharacter.species_id) {
            this.state.currentSpecies = this.state.species.find(function (s) {
                return s.id === savedCharacter.species_id;
            });
        }
        if (options.refreshSelector !== false) {
            await this.loadCharacterSelector(API._listCharactersCache || [savedCharacter]);
        }
        this.updateStatusIndicator();
        this.updateStepGuide();
        if (options.render !== false) {
            await this.renderAll();
        }
        if (UI.populateIdentityForm) {
            UI.populateIdentityForm(this.state.character, this.state.pendingRegistrationCode);
        }
        if (this.isInCreationFlow()) {
            this.updateCreationNavigation();
        }
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
        let characterSwitch = !!options.characterSwitch;
        if (!characterSwitch) {
            try {
                const switchParams = new URLSearchParams(window.location.search);
                if (switchParams.get('moap_char_switch') === '1') {
                    characterSwitch = true;
                }
            } catch (switchErr) { /* ignore */ }
        }
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
                let charsResult = null;
                let usedRosterCache = false;
                const econSyncOnly = (function () {
                    try {
                        return new URLSearchParams(window.location.search).get('econ_sync') === '1';
                    } catch (e) {
                        return false;
                    }
                })();
                const rosterCacheKey = 'f4_roster_' + API.uuid;
                let preferredCharId = null;
                try {
                    preferredCharId = this.state.selectedCharacterId
                        || API.activeCharacterId
                        || new URLSearchParams(window.location.search).get('active_char')
                        || sessionStorage.getItem(this.getActiveCharacterStorageKey());
                } catch (e) { /* ignore */ }
                if (preferredCharId && !this.isPlausibleCharacterId(preferredCharId)) {
                    console.warn('[loadData] Ignoring avatar-UUID / garbage preferred id:', preferredCharId);
                    preferredCharId = null;
                    this.clearStaleCharacterSelection();
                }
                if (econSyncOnly && !forceRefresh) {
                    try {
                        const cached = sessionStorage.getItem(rosterCacheKey);
                        if (cached) {
                            const parsed = JSON.parse(cached);
                            const roster = parsed && parsed.characters ? parsed.characters : [];
                            const rosterHasPreferred = !preferredCharId || roster.some(function (c) {
                                return c.id === preferredCharId;
                            });
                            if (rosterHasPreferred) {
                                charsResult = { success: true, data: parsed };
                                usedRosterCache = true;
                                console.log('[loadData] Using session roster cache (econ sync reload)');
                            } else {
                                console.log('[loadData] Roster cache missing active character — refreshing from Firestore');
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
                if (!charsResult) {
                    charsResult = await API.listCharacters(forceRefresh);
                }
                if (charsResult.success && charsResult.data && !usedRosterCache) {
                    try {
                        sessionStorage.setItem(rosterCacheKey, JSON.stringify(charsResult.data));
                    } catch (e) { /* ignore */ }
                }
                console.log('[loadData] listCharacters result:', charsResult);
                const expectExisting = !!(preferredCharId && this.isPlausibleCharacterId(preferredCharId));
                let listTries = 0;
                while (expectExisting && listTries < 2 && (!charsResult || !charsResult.success
                    || !((charsResult.data && charsResult.data.characters) || []).length)) {
                    listTries++;
                    console.warn('[loadData] Roster missing for active character — retry', listTries);
                    await new Promise(function (resolve) { setTimeout(resolve, 1000); });
                    charsResult = await API.listCharacters(true);
                    console.log('[loadData] listCharacters retry result:', charsResult);
                }
                
                if (!charsResult || !charsResult.success) {
                    console.error('[loadData] listCharacters failed:', charsResult && charsResult.error);
                    if (expectExisting) {
                        UI.showToast('Could not read the character list. Keeping the active character. Do not create a new one.', 'warning');
                        charsResult = { success: true, data: { characters: [] } };
                    } else if (API.shouldDiscardFirestoreGameplay && API.shouldDiscardFirestoreGameplay()) {
                        this.state.character = null;
                        this.state.isNewCharacter = false;
                        this.state.creationInProgress = false;
                        this.state.creationStepId = null;
                        this.state.awaitingWelcomeChoice = true;
                        await this.loadCharacterSelector([]);
                        this.updateStatusIndicator();
                        this.updateStepGuide();
                        UI.showToast('Could not read the character list. Close Setup and open it again.', 'error');
                        console.log('[loadData] Bridge list failed — not showing new-player Welcome');
                        return;
                    } else {
                        UI.showToast('Failed to load characters: ' + ((charsResult && charsResult.error) || 'Unknown error'), 'error');
                        this.state.character = null;
                        this.state.isNewCharacter = true;
                        return;
                    }
                }
                
                let characters = (charsResult.data && charsResult.data.characters)
                    ? charsResult.data.characters.slice()
                    : [];
                console.log('[loadData] Found', characters.length, 'character(s) in roster');
                // HOTFIX 4.3.2+: never auto-delete roster rows. Keep every listed char.
                characters = await this.cleanupIncompleteCharacters(characters);
                characters = this.filterPlausibleCharacters(characters);
                if (!characters.length) {
                    const shell = await this.recoverActiveCharacterShell(preferredCharId);
                    if (shell) {
                        characters = [shell];
                        API._listCharactersCache = [shell];
                        API._listCharactersCacheTs = 0;
                        console.warn('[loadData] Roster empty — showing active character only', shell.id);
                        UI.showToast('Character list was empty. Showing the active character only. Close Setup and open it again before creating anyone new.', 'warning');
                    } else if (!(API.shouldDiscardFirestoreGameplay && API.shouldDiscardFirestoreGameplay())) {
                        const recovered = await this.recoverExistingCharactersWhenRosterEmpty(preferredCharId);
                        if (recovered && recovered.length) {
                            characters = this.filterPlausibleCharacters(recovered);
                            console.log('[loadData] Recovered', characters.length, 'existing character(s) — skipping Welcome');
                        }
                    } else {
                        console.log('[loadData] Experience roster empty — no active character to keep');
                    }
                }
                if (!characters.length) {
                    this.clearStaleCharacterSelection();
                    this.state.character = null;
                    this.state.isNewCharacter = false;
                    this.state.creationInProgress = false;
                    this.state.creationStepId = null;
                    this.state.awaitingWelcomeChoice = true;
                    await this.loadCharacterSelector([]);
                    this.updateStatusIndicator();
                    this.updateStepGuide();
                    console.log('[loadData] No existing characters — showing Welcome');
                } else {
                    this.state.awaitingWelcomeChoice = false;
                    if (preferredCharId && this.isPlausibleCharacterId(preferredCharId)
                        && !characters.some(function (c) { return c.id === preferredCharId; })) {
                        try {
                            const orphanResult = await API.getCharacterById(preferredCharId);
                            if (orphanResult.success && orphanResult.data && orphanResult.data.character
                                && this.isPlausibleCharacterId(orphanResult.data.character.id)) {
                                this.upsertCharacterInRosterCache(orphanResult.data.character);
                                characters = this.filterPlausibleCharacters(
                                    API._listCharactersCache || characters.concat([orphanResult.data.character])
                                );
                                console.log('[loadData] Merged missing roster entry for', preferredCharId);
                            }
                        } catch (orphanErr) {
                            console.warn('[loadData] Could not merge roster entry:', orphanErr);
                        }
                    }
                    
                    // UX 2: Always load character selector (shows even with 1 character)
                    await this.loadCharacterSelector(characters);
                    
                    // Load selected / active / first character
                    const characterId = this.pickCharacterIdToLoad(characters);
                    let character = this.characterFromList(characters, characterId);
                    if (!character && characterId) {
                        const charResult = await API.getCharacterById(characterId);
                        if (charResult.success) {
                            character = charResult.data.character;
                            this.upsertCharacterInRosterCache(character);
                            characters = API._listCharactersCache || characters.concat([character]);
                            await this.loadCharacterSelector(characters);
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
                            if (typeof API !== 'undefined' && API.discardFirestoreGameplayFields) {
                                API.discardFirestoreGameplayFields(this.state.character);
                            }
                            if (!this.state.creationInProgress) {
                                this.state.isNewCharacter = false;
                            }
                            this.state.selectedCharacterId = character.id; // Ensure selected ID is set

                            if (character.id && typeof this.urlHudEconBelongsToCharacter === 'function'
                                && !this.urlHudEconBelongsToCharacter(character.id)) {
                                this.clearStaleHudUrlParamsForCharacterSwitch(character.id);
                                this.syncActiveCharToUrl(character.id);
                            }
                            if (this.isBridgeHudMode() && character.id) {
                                this.reconcileHudSlotIfNeeded(character.id, { force: true }).catch(function (slotErr) {
                                    console.warn('[loadData] HUD slot reconcile:', slotErr);
                                });
                            }

                            if (this.isCharacterSetupIncomplete(character)) {
                                // Legacy / pre-flag characters: load and play; do not delete or force wizard
                                console.log('[loadData] Character missing setup_complete/class — loading anyway:', character.id);
                            }
                            if (this.characterMissingUniverse(this.state.character)) {
                                await this.promptUniverseRepairIfNeeded(this.state.character);
                                character = this.state.character || character;
                            }
                            if (character.universe_id) {
                                this.state.selectedUniverseId = character.universe_id;
                            }
                            
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

                            this._pendingHudHydration = {
                                characterSwitch: characterSwitch,
                                econSyncOnly: econSyncOnly
                            };
                        }
                    }
                    } // end: existing characters loaded
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
            
            // Render UI (restore tab before render so econ sync reload stays on Stats)
            if (typeof window.restoreMoapTabFromUrl === 'function') {
                window.restoreMoapTabFromUrl();
            }
            const econSyncReload = (function () {
                try {
                    return new URLSearchParams(window.location.search).get('econ_sync') === '1';
                } catch (e) {
                    return false;
                }
            })();
            if (econSyncReload) {
                DebugLog.log('Calling renderEconSyncRefresh()...', 'debug');
                this.renderEconSyncRefresh();
                DebugLog.log('renderEconSyncRefresh() completed — re-rendering galleries', 'debug');
            }
            DebugLog.log('Calling renderAll()...', 'debug');
            await this.renderAll();
            DebugLog.log('renderAll() completed', 'debug');

            const pendingHud = this._pendingHudHydration;
            this._pendingHudHydration = null;
            if (pendingHud && this.state.character && this.state.character.id) {
                if (this.isBridgeHudMode()) {
                    const openOnStatsTab = (function () {
                        try {
                            return new URLSearchParams(window.location.search).get('moap_tab') === 'stats';
                        } catch (e) {
                            return false;
                        }
                    })();
                    const needsBlockingHud = econSyncReload || openOnStatsTab;
                    if (needsBlockingHud) {
                        DebugLog.log('Blocking HUD KVP hydrate (stats tab / econ sync)', 'debug');
                        await this.hydrateHudGameplayFromBridge(this.state.character.id, pendingHud);
                    } else {
                        DebugLog.log('Scheduling background HUD KVP hydrate (galleries already rendered)', 'debug');
                        this.scheduleHudGameplayHydration(this.state.character.id, pendingHud);
                    }
                } else {
                    await this.applyHudGameplayHydrationResult(false, pendingHud);
                }
            }
            this.loadBuffs();
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
     * Forced universe pick for legacy characters missing universe_id in KVP.
     * Blocks dismiss until the player saves a universe.
     */
    async promptUniverseRepairIfNeeded(character) {
        if (!character || !this.isPlausibleCharacterId(character.id)) {
            return character;
        }
        if (character._rosterPartial) {
            return character;
        }
        // Avatar UUID stuck in name/id is a ghost — not a migratable character.
        if (this.isAvatarUuidKey(character.name) || this.isAvatarUuidKey(character.id)) {
            console.warn('[UniverseRepair] Skipping ghost character labeled with avatar UUID');
            return character;
        }
        if (!this.characterMissingUniverse(character)) {
            return character;
        }
        if (this._universeRepairInFlight) {
            return this._universeRepairInFlight;
        }
        this._universeRepairInFlight = this._runUniverseRepairModal(character);
        try {
            return await this._universeRepairInFlight;
        } finally {
            this._universeRepairInFlight = null;
        }
    },

    async _runUniverseRepairModal(character) {
        const self = this;
        const result = await API.listAvailableUniverses();
        if (!result.success || !result.data || !result.data.universes || !result.data.universes.length) {
            UI.showToast('Could not load universes — reopen Setup HUD to set character universe', 'error');
            return character;
        }
        const universes = result.data.universes;
        let universeOptions = '';
        universes.forEach(function (universe) {
            const requiresCode = universe.registrationCode && universe.registrationCode.trim() !== '';
            universeOptions += '<option value="' + universe.id + '" data-requires-code="'
                + (requiresCode ? 'true' : 'false') + '">' + (universe.name || universe.id)
                + (requiresCode ? ' (Requires Code)' : '') + '</option>';
        });
        let charLabel = (character.name && String(character.name).trim())
            ? String(character.name).trim()
            : '';
        if (!charLabel || self.isAvatarUuidKey(charLabel)) {
            charLabel = 'this character';
        }
        const safeLabel = charLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return new Promise(function (resolve) {
            UI.setModalCloseBlocked(true);
            UI.showModal(
                '<div class="modal-content">'
                + '<h2 class="modal-title">Universe required</h2>'
                + '<p class="modal-text">We lost the universe for <strong>'
                + safeLabel
                + '</strong> during a data migration. Please pick the correct universe so species, gender, and classes load properly.</p>'
                + '<div class="form-group" style="margin: var(--space-md) 0;">'
                + '<label for="repair-char-universe">Universe</label>'
                + '<select id="repair-char-universe" style="width: 100%; padding: var(--space-xs) var(--space-sm); background: var(--bg-medium); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">'
                + universeOptions
                + '</select></div>'
                + '<div id="repair-char-registration-group" class="form-group" style="display: none; margin: var(--space-md) 0;">'
                + '<label for="repair-char-registration-code">Registration Code</label>'
                + '<input type="text" id="repair-char-registration-code" placeholder="Enter registration code..." style="width: 100%; padding: var(--space-xs) var(--space-sm); background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">'
                + '<small style="color: var(--text-muted); display: block; margin-top: var(--space-xxs);">This universe requires a registration code</small>'
                + '</div>'
                + '<div class="modal-actions" style="display: flex; gap: var(--space-sm); justify-content: flex-end; margin-top: var(--space-lg);">'
                + '<button class="btn-primary" id="btn-repair-char-universe">Save universe</button>'
                + '</div></div>'
            );

            const universeSelect = document.getElementById('repair-char-universe');
            const registrationGroup = document.getElementById('repair-char-registration-group');
            const registrationInput = document.getElementById('repair-char-registration-code');
            const saveBtn = document.getElementById('btn-repair-char-universe');

            function syncCodeField() {
                const selectedOption = universeSelect.options[universeSelect.selectedIndex];
                const requiresCode = selectedOption && selectedOption.dataset.requiresCode === 'true';
                registrationGroup.style.display = requiresCode ? 'block' : 'none';
                if (!requiresCode) {
                    registrationInput.value = '';
                }
            }
            universeSelect.onchange = syncCodeField;
            syncCodeField();

            saveBtn.onclick = async function () {
                const universeId = universeSelect.value;
                if (!universeId) {
                    UI.showToast('Select a universe', 'warning');
                    return;
                }
                if (registrationGroup.style.display !== 'none') {
                    const registrationCode = registrationInput.value.trim();
                    if (!registrationCode) {
                        UI.showToast('Registration code is required', 'warning');
                        return;
                    }
                    const universeResult = await API.getUniverse(universeId);
                    if (!universeResult.success) {
                        UI.showToast('Failed to verify universe', 'error');
                        return;
                    }
                    if (universeResult.data.universe.registrationCode !== registrationCode) {
                        UI.showToast('Invalid registration code', 'error');
                        return;
                    }
                }

                saveBtn.disabled = true;
                UI.showToast('Saving universe...', 'info', 1200);
                const payload = {
                    id: character.id,
                    name: character.name || 'Unnamed',
                    title: character.title || '',
                    gender: character.gender || 'other',
                    species_id: character.species_id || 'human',
                    class_id: character.class_id || '',
                    universe_id: universeId,
                    has_mana: !!character.has_mana,
                    mode: character.mode || 'roleplay',
                    setup_complete: character.setup_complete === true,
                    currency: character.currency != null ? character.currency : 50
                };
                const saveResult = await API.updateCharacter(payload, character.id);
                if (!saveResult || !saveResult.success) {
                    saveBtn.disabled = false;
                    UI.showToast('Failed to save universe: ' + ((saveResult && saveResult.error) || 'Unknown error'), 'error');
                    return;
                }

                const updated = (saveResult.data && saveResult.data.character)
                    ? saveResult.data.character
                    : Object.assign({}, character, { universe_id: universeId });
                if (self.state.character && self.state.character.id === character.id) {
                    self.state.character = Object.assign({}, self.state.character, updated, {
                        universe_id: universeId
                    });
                }
                self.state.selectedUniverseId = universeId;
                const universeLoaded = await API.getUniverse(universeId);
                if (universeLoaded.success) {
                    self.state.currentUniverse = universeLoaded.data.universe;
                }
                if (API._listCharactersCache) {
                    API._listCharactersCache = API._listCharactersCache.map(function (c) {
                        if (c.id === character.id) {
                            return Object.assign({}, c, { universe_id: universeId });
                        }
                        return c;
                    });
                }
                UI.setModalCloseBlocked(false);
                UI.closeModal();
                UI.showToast('Universe saved', 'success', 2000);
                if (typeof self.loadCharacterSelector === 'function' && API._listCharactersCache) {
                    await self.loadCharacterSelector(API._listCharactersCache);
                }
                if (typeof self.renderAll === 'function') {
                    await self.renderAll();
                }
                resolve(self.state.character && self.state.character.id === character.id
                    ? self.state.character
                    : updated);
            };
        });
    },
    
    /**
     * Show new character dialog — Hybrid: start local wizard (universe first).
     */
    async showNewCharacterDialog() {
        try {
            if (this.state.dirty || this.state.statsPending) {
                const shouldProceed = await this.showUnsavedChangesModal();
                if (!shouldProceed) {
                    return;
                }
            }
            await this.startLocalCreationWizard();
            await this.loadAvailableUniverses();
            const universeGroup = document.getElementById('universe-selection-group');
            if (universeGroup) {
                universeGroup.style.display = 'block';
            }
            this.navigateToStep('universe');
        } catch (error) {
            console.error('Failed to start character creation:', error);
            UI.showToast('Failed to start character creation', 'error');
        }
    },
    
    /**
     * Update step guide panel with progress markers (UX 2)
     */
    getCreationStepStorageKey(characterId) {
        return 'f4_creation_step_' + (API.uuid || 'anon') + '_' + (characterId || 'new');
    },

    rememberCreationStep(stepId) {
        if (!stepId) {
            return;
        }
        const charId = this.state.character && this.state.character.id ? this.state.character.id : 'new';
        try {
            sessionStorage.setItem(this.getCreationStepStorageKey(charId), stepId);
        } catch (e) { /* ignore */ }
    },

    readRememberedCreationStep(characterId) {
        try {
            return sessionStorage.getItem(this.getCreationStepStorageKey(characterId || 'new'));
        } catch (e) {
            return null;
        }
    },

    clearRememberedCreationStep(characterId) {
        if (!characterId) {
            return;
        }
        try {
            sessionStorage.removeItem(this.getCreationStepStorageKey(characterId));
        } catch (e) { /* ignore */ }
    },

    isCharacterSetupIncomplete(char) {
        if (!char || !char.id) {
            return true;
        }
        if (char.setup_complete === false) {
            return true;
        }
        if (!char.class_id) {
            return true;
        }
        return false;
    },

    inferCreationStepFromCharacter(char) {
        if (!char) {
            return 'identity';
        }
        if (!char.name || !char.name.trim() || !char.gender || !char.species_id) {
            return 'identity';
        }
        if (!char.class_id) {
            return 'stats';
        }
        return 'class';
    },

    resumeCreationFlowIfNeeded(character) {
        // Hybrid: no durable incomplete resume — wizard is local-only until Finish
        if (this.state.creationInProgress && this.state.character && !this.state.character.id) {
            return true;
        }
        return false;
    },

    getCreationSteps() {
        const char = this.state.character;
        const universeOk = !!(this.state.selectedUniverseId || (char && char.universe_id));
        const identityComplete = !!(char && char.name && char.name.trim() && char.gender && char.species_id);
        const classComplete = !!(char && char.class_id);
        return [
            { id: 'universe', name: 'Universe', complete: universeOk },
            { id: 'identity', name: 'Character', complete: identityComplete },
            { id: 'stats', name: 'Stats', complete: !!(char && identityComplete && this.hasCreationGameplayReady(char)) },
            { id: 'class', name: 'Class', complete: classComplete },
            { id: 'review', name: 'Review', complete: false }
        ];
    },

    isInCreationFlow() {
        const char = this.state.character;
        return !!(char && (this.state.creationInProgress || !char.id || this.state.isNewCharacter));
    },

    isNewCharacterDraft() {
        const char = this.state.character;
        return !!(char && (this.state.creationInProgress || (this.state.isNewCharacter && !char.id)));
    },

    resetHudUrlForNewCharacterDraft() {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('stats_csv');
            url.searchParams.delete('stats_csv_ts');
            url.searchParams.delete('stats_char_id');
            url.searchParams.delete('econ_sync');
            url.searchParams.delete('econ_ts');
            url.searchParams.delete('xp_spent');
            url.searchParams.delete('ap_balance');
            url.searchParams.delete('xp_lifetime');
            url.searchParams.delete('xp_total');
            url.searchParams.delete('char_name');
            url.searchParams.delete('char_title');
            url.searchParams.delete('health_pipe');
            url.searchParams.delete('stamina_pipe');
            url.searchParams.delete('mana_pipe');
            this.safeHistoryReplaceState(url.toString());
        } catch (e) { /* ignore */ }
        this._lastStatsCsvSynced = null;
        this.state.statsPending = false;
        this.state.pendingChanges = {};
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = 0;
        App.state.econ.xp_spent = 0;
        App.state.econ.ap_balance = 0;
        App.state.econSessionActive = false;
    },

    resetDraftEconOnCharacter(char) {
        if (!char) {
            return;
        }
        char.xp_lifetime = 0;
        char.xp_spent = 0;
        char.ap_balance = 0;
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = 0;
        App.state.econ.xp_spent = 0;
        App.state.econ.ap_balance = 0;
        App.state.econSessionActive = false;
        window.updateEconUrlParams(0, 0);
    },

    getCurrentCreationStepId(steps) {
        const list = steps || this.getCreationSteps();
        if (this.isInCreationFlow() && this.state.creationStepId) {
            const known = list.find(function (s) { return s.id === this.state.creationStepId; }.bind(this));
            if (known) {
                return this.state.creationStepId;
            }
        }
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
            case 'universe': {
                const uid = this.state.selectedUniverseId || char.universe_id;
                if (!uid) {
                    return { ok: false, message: 'Please select a universe.' };
                }
                const regGroup = document.getElementById('universe-registration-group');
                if (regGroup && regGroup.style.display !== 'none') {
                    const codeEl = document.getElementById('universe-registration-code');
                    const code = codeEl ? codeEl.value.trim() : '';
                    const expected = this.state.currentUniverse && this.state.currentUniverse.registrationCode;
                    if (expected && expected.trim() && code !== expected.trim()) {
                        return { ok: false, message: 'Enter a valid registration code for this universe.' };
                    }
                }
                return { ok: true };
            }
            case 'identity':
                if (!char.name || !char.name.trim()) {
                    return { ok: false, message: 'Please enter a character name.' };
                }
                if (!char.gender) {
                    return { ok: false, message: 'Please select a gender — click a portrait below.' };
                }
                if (!char.species_id) {
                    return { ok: false, message: 'Please select a species — click a card below.' };
                }
                return { ok: true };
            case 'name':
            case 'gender':
            case 'species':
                return this.validateCreationStep('identity');
            case 'stats': {
                if (!char.species_id) {
                    return { ok: false, message: 'Select a species on the Character tab first.' };
                }
                if (!this.hasCreationGameplayReady(char)) {
                    this.applyCalculatedStarterGameplay(char);
                }
                // Local wizard: pending spends stay local until Finish — do not block Continue
                return { ok: true };
            }
            case 'class':
            case 'career':
                if (!char.class_id) {
                    return { ok: false, message: 'Please select a starting class.' };
                }
                return { ok: true };
            case 'review':
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
            const cancelBtnOut = document.getElementById('btn-cancel-creation');
            if (cancelBtnOut) {
                cancelBtnOut.style.display = 'none';
            }
            const nextBtnOut = document.getElementById('btn-creation-next');
            if (nextBtnOut) {
                nextBtnOut.style.display = 'none';
            }
            const backBtnOut = document.getElementById('btn-creation-back');
            if (backBtnOut) {
                backBtnOut.style.display = 'none';
            }
            const resetStatsBtnOut = document.getElementById('btn-reset-creation-stats');
            if (resetStatsBtnOut) {
                resetStatsBtnOut.style.display = 'none';
            }
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
            if (currentId === 'review' || currentIndex >= steps.length - 1) {
                nextBtn.textContent = 'Finish ✓';
            } else if (nextStep) {
                nextBtn.textContent = 'Continue: ' + nextStep.name + ' »';
            } else {
                nextBtn.textContent = 'Continue »';
            }
        }

        const cancelBtn = document.getElementById('btn-cancel-creation');
        if (cancelBtn) {
            cancelBtn.style.display = inCreation ? 'inline-block' : 'none';
        }
        const saveBtn = document.getElementById('btn-save-character');
        if (saveBtn && inCreation) {
            saveBtn.style.display = 'none';
        } else if (saveBtn && !inCreation) {
            saveBtn.style.display = '';
        }
        const resetStatsBtn = document.getElementById('btn-reset-creation-stats');
        if (resetStatsBtn) {
            resetStatsBtn.style.display = (inCreation && currentId === 'stats') ? 'inline-block' : 'none';
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

        this.flushIdentityFromForm();

        // Hybrid: keep everything local until Finish on Review — no draft mint
        if (currentId === 'identity' && this.state.character && this.state.character.species_id
            && !this.hasCreationGameplayReady(this.state.character)) {
            this.applyCalculatedStarterGameplay(this.state.character);
        }
        if (currentId === 'universe') {
            const uid = this.state.selectedUniverseId || (this.state.character && this.state.character.universe_id);
            if (uid && this.state.character) {
                this.state.character.universe_id = uid;
                this.state.selectedUniverseId = uid;
                const limitCheck = await API.validateCharacterLimit(uid, API.uuid);
                if (!limitCheck.success || !limitCheck.data.allowed) {
                    UI.showToast(
                        'Character limit reached for this universe ('
                        + limitCheck.data.currentCount + '/' + limitCheck.data.limit + ')',
                        'error'
                    );
                    return;
                }
                await this.applyUniverseIdentityDefaults({ force: true });
            }
        }

        const currentIndex = steps.findIndex(s => s.id === currentId);

        if (currentId === 'review' || currentIndex >= steps.length - 1) {
            const finished = await this.finishLocalCreation();
            if (finished) {
                this.updateCreationNavigation();
                this.updateStepGuide();
                this.updateStatusIndicator();
                this.updateSaveStatsButton();
                if (typeof this.renderCreationReview === 'function') {
                    this.renderCreationReview();
                }
                await this.renderAll();
            }
            return;
        }

        const nextStep = steps[currentIndex + 1];
        if (nextStep) {
            this.state.creationStepId = nextStep.id;
            this.state.creationMaxStepIndex = Math.max(this.state.creationMaxStepIndex || 0, currentIndex + 1);
            this.rememberCreationStep(nextStep.id);
        }
        this.navigateToStep(nextStep.id);
        this.updateStepGuide();
        if (nextStep.id === 'review') {
            this.renderCreationReview();
        }
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
        this.state.creationStepId = prevStep.id;
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
                    const currentIndex = steps.findIndex(s => s.id === this.getCurrentCreationStepId(steps));
                    const isCurrent = currentIndex === index;
                    
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
        if (!char && stepId !== 'identity' && stepId !== 'name' && stepId !== 'universe') {
            return;
        }

        const steps = this.getCreationSteps();
        const currentId = this.getCurrentCreationStepId(steps);
        // Hybrid creation: stats edits are local — no save/abandon gate between steps
        if (!this.isInCreationFlow() && currentId === 'stats' && stepId !== 'stats' && this.state.statsPending) {
            this.resolveUnsavedStatsPrompt().then((mayLeave) => {
                if (mayLeave) {
                    this.navigateToStepImmediate(stepId);
                }
            });
            return;
        }
        this.navigateToStepImmediate(stepId);
    },

    navigateToStepImmediate(stepId) {
        const char = this.state.character;
        if (!char && stepId !== 'identity' && stepId !== 'name' && stepId !== 'universe') {
            return;
        }

        const normalizedStep = (stepId === 'name' || stepId === 'gender' || stepId === 'species')
            ? 'identity'
            : ((stepId === 'career') ? 'class' : stepId);
        const steps = this.getCreationSteps();
        
        switch(normalizedStep) {
            case 'universe':
                UI.switchTab('character');
                break;
            case 'identity':
                UI.switchTab('character');
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
            case 'class':
                UI.switchTab('career');
                break;
            case 'review':
                UI.switchTab('character');
                this.renderCreationReview();
                break;
        }
        const identitySection = document.getElementById('character-identity-section');
        const universeGroup = document.getElementById('universe-selection-group');
        const reviewPanel = document.getElementById('creation-review-panel');
        if (this.isInCreationFlow()) {
            if (universeGroup) {
                universeGroup.style.display = (normalizedStep === 'universe') ? 'block' : 'none';
            }
            if (identitySection) {
                identitySection.style.display = (normalizedStep === 'identity') ? 'block' : 'none';
            }
            if (reviewPanel) {
                reviewPanel.style.display = (normalizedStep === 'review') ? 'block' : 'none';
            }
        }
        if (this.isInCreationFlow()) {
            this.state.creationStepId = normalizedStep;
            const idx = steps.findIndex(function (s) { return s.id === normalizedStep; });
            if (idx >= 0) {
                this.state.creationMaxStepIndex = Math.max(this.state.creationMaxStepIndex || 0, idx);
            }
            this.rememberCreationStep(normalizedStep);
            this.updateCreationNavigation();
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
                saveBtn.style.display = '';
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
                saveBtn.textContent = '💾 Save Character';
            }
        } else if (inCreation) {
            statusText.textContent = 'Creating Character';
            statusBadge.style.background = 'rgba(59, 130, 246, 0.35)';
            statusBadge.style.color = '#93c5fd';
            statusBadge.style.border = '1px solid rgba(59, 130, 246, 0.5)';
            if (saveBtn) {
                saveBtn.style.display = 'none';
            }
        } else if (this.state.dirty) {
            statusText.textContent = 'Unsaved Changes';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.3)';
            statusBadge.style.color = '#fca5a5';
            statusBadge.style.border = '1px solid rgba(239, 68, 68, 0.5)';
            if (saveBtn) {
                saveBtn.style.display = '';
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
                saveBtn.textContent = '💾 Save Character';
            }
        } else if (this.state.statsPending) {
            statusText.textContent = 'Unsaved Stats';
            statusBadge.style.background = 'rgba(251, 146, 60, 0.25)';
            statusBadge.style.color = '#fdba74';
            statusBadge.style.border = '1px solid rgba(251, 146, 60, 0.45)';
            if (saveBtn) {
                saveBtn.style.display = '';
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
                saveBtn.title = 'Use Save Stats on the Stats tab';
                saveBtn.textContent = '💾 Save Character';
            }
        } else {
            const autoMsg = this.state.lastAutoSaveMessage;
            statusText.textContent = autoMsg ? autoMsg : 'Saved';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.3)';
            statusBadge.style.color = '#6ee7b7';
            statusBadge.style.border = 'none';
            if (saveBtn) {
                saveBtn.style.display = '';
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.cursor = 'not-allowed';
                saveBtn.title = autoMsg
                    ? 'This change was already saved automatically'
                    : 'No unsaved changes';
                saveBtn.textContent = '💾 Save Character';
            }
        }

        const abandonCharBtn = document.getElementById('btn-abandon-character');
        if (abandonCharBtn) {
            const showCharAbandon = !!this.state.dirty && !!this.state.character && !inCreation;
            abandonCharBtn.style.display = showCharAbandon ? '' : 'none';
            abandonCharBtn.disabled = !showCharAbandon;
        }
    },

    /**
     * Snapshot stat/AP/XP baseline for Abandon — call before first pending edit in a session.
     */
    captureStatsFloorIfNeeded() {
        this.freezeAbandonBaselineBeforeEdit();
    },

    freezeAbandonBaselineBeforeEdit() {
        if (!this.state.statsPending && this.state.character) {
            this.captureAbandonBaseline(this.state.character);
        }
    },

    captureAbandonBaseline(char) {
        if (!char) {
            this.state.statsAbandonBaseline = null;
            this.state.statsFloor = null;
            this.state.apFloor = null;
            this.state.xpSpentFloor = null;
            return;
        }
        const merged = window.getMergedCharacterStatsForPoints(char);
        const ap = window.getApBalance(char);
        const xpSpent = window.getEconSpent(char);
        this.state.statsAbandonBaseline = {
            stats: Object.assign({}, merged.stats),
            ap_balance: ap,
            xp_spent: xpSpent
        };
        this.state.statsFloor = Object.assign({}, merged.stats);
        this.state.apFloor = ap;
        this.state.xpSpentFloor = xpSpent;
    },

    markStatsPending() {
        this.state.statsPending = true;
        this.state.econSessionActive = true;
        this.updateSaveStatsButton();
        this.updateStatusIndicator();
    },

    updateSaveStatsButton() {
        const btn = document.getElementById('btn-save-stats');
        const abandonBtn = document.getElementById('btn-abandon-stats');
        const pending = !!this.state.statsPending;
        const inCreation = this.isInCreationFlow();
        if (btn) {
            btn.style.display = '';
            btn.disabled = !pending;
            if (inCreation) {
                btn.textContent = 'Apply Changes';
                btn.title = pending
                    ? 'Keep these stats for creation (written to Experience when you Finish)'
                    : 'No stat or AP changes to apply';
            } else {
                btn.textContent = 'Save Stats';
                btn.title = pending
                    ? 'Apply AP, XP spent, and stat changes to your HUD'
                    : 'No stat or AP changes to save';
            }
        }
        if (abandonBtn) {
            if (inCreation) {
                // Creation: Apply Changes is enough — abandon stays available if they want to revert.
                abandonBtn.style.display = '';
                abandonBtn.disabled = !pending;
                abandonBtn.title = pending
                    ? 'Revert stat and AP changes since last Apply Changes'
                    : 'No stat or AP changes to abandon';
            } else {
                abandonBtn.style.display = '';
                abandonBtn.disabled = !pending;
                abandonBtn.title = pending
                    ? 'Revert stat and AP changes since last Save Stats'
                    : 'No stat or AP changes to abandon';
            }
        }
    },

    clearStatsPendingAfterHudSave() {
        this.state.statsPending = false;
        if (this.state.character) {
            this.captureAbandonBaseline(this.state.character);
            this.clearMoapSessionDraft(this.state.character.id);
        }
        this.updateSaveStatsButton();
        this.updateStatusIndicator();
    },
    async saveStatsToHud() {
        let char = this.state.character;
        if (!char) {
            UI.showToast('No character loaded', 'warning');
            return false;
        }
        if (!this.state.statsPending) {
            UI.showToast('No stat or AP changes to save', 'info', 1500);
            return false;
        }
        if (typeof MoapDialogs !== 'undefined' && MoapDialogs.isActive && MoapDialogs.isActive()) {
            UI.showToast(
                this.isInCreationFlow()
                    ? 'Close the dialog first, then Apply Changes'
                    : 'Close the dialog first, then Save Stats',
                'warning'
            );
            return false;
        }
        if (typeof UI !== 'undefined' && UI.isFormFieldFocused && UI.isFormFieldFocused()) {
            UI.showToast('Finish editing the text field first', 'warning');
            return false;
        }
        if (typeof this.persistMoapSessionDraft === 'function') {
            this.persistMoapSessionDraft(true);
        }
        if (this.isInCreationFlow()) {
            // Hybrid: Apply Changes = local only until Finish writes Experience KVP
            this.state.statsPending = false;
            this.captureAbandonBaseline(char);
            this.updateSaveStatsButton();
            this.updateStatusIndicator();
            UI.showToast('Changes applied — they save to Experience when you Finish', 'info', 2500);
            return true;
        }
        UI.showToast('Saving stats...', 'info', 2000);
        const savedAp = window.getApBalance(char);
        const savedSpent = window.getEconSpent(char);
        const csv = this.statsCsvFromChar(char);
        if (!csv) {
            UI.showToast('Could not build stats for HUD sync', 'error');
            return false;
        }
        if (this.isBridgeHudMode()) {
            try {
                await this.saveStatsToHudViaBridge(char, savedSpent, savedAp, csv);
                if (typeof UI !== 'undefined' && UI.renderStatsTab) {
                    UI.renderStatsTab(char);
                }
                this.updateSaveStatsButton();
                this.updateStatusIndicator();
                return true;
            } catch (e) {
                console.error('[Save Stats] bridge failed:', e);
                const errMsg = e && e.message ? String(e.message) : 'unknown';
                UI.showToast('Failed to save stats to HUD (bridge): ' + errMsg, 'error', 5000);
                return false;
            }
        }
        try {
            const currentUrl = new URL(window.location.href);
            const spentStr = String(savedSpent);
            const apStr = String(savedAp);
            const ts = Date.now().toString();
            currentUrl.searchParams.set('xp_spent', spentStr);
            currentUrl.searchParams.set('ap_balance', apStr);
            currentUrl.searchParams.set('econ_ts', ts);
            currentUrl.searchParams.set('stats_csv', csv);
            currentUrl.searchParams.set('stats_csv_ts', ts);
            currentUrl.searchParams.set('moap_tab', window.getMoapActiveTab());
            if (char.id) {
                currentUrl.searchParams.set('active_char', char.id);
                currentUrl.searchParams.set('stats_char_id', char.id);
            }
            const syncPayload = this.buildCharacterSyncPayload(char.id, char);
            const loadParts = Object.keys(syncPayload).map(function (key) {
                return key + ':' + encodeURIComponent(String(syncPayload[key]));
            });
            currentUrl.searchParams.set('lsl_cmd', 'LOAD_CHARACTER|' + loadParts.join('|'));
            currentUrl.searchParams.set('lsl_cmd_ts', ts);
            currentUrl.searchParams.set('econ_sync', '1');
            this._lastStatsCsvSynced = csv;
            UI.showToast('Saving stats to HUD...', 'info', 1200);
            window.location.assign(currentUrl.toString());
            return true;
        } catch (e) {
            console.error('[Save Stats] failed:', e);
            UI.showToast('Failed to save stats to HUD', 'error');
        }
        return false;
    },
    
    /**
     * Prompt when leaving the Stats tab with unsaved stat/AP edits.
     * @returns {Promise<boolean>} true if navigation may continue
     */
    async resolveUnsavedStatsPrompt() {
        if (!this.state.statsPending) {
            return true;
        }
        // Creation: auto-apply locally so Continue is not blocked by Save/Abandon
        if (this.isInCreationFlow()) {
            const ok = await this.saveStatsToHud();
            return ok !== false && !this.state.statsPending;
        }
        if (typeof MoapDialogs === 'undefined' || !MoapDialogs.showChoice) {
            return true;
        }
        const choice = await MoapDialogs.showChoice({
            title: 'Unsaved stat changes',
            message: 'You have stat or AP changes that are not saved to your HUD.\n\nSave them, abandon them, or stay on this tab.',
            buttons: [
                { id: 'stat-prompt-save', label: 'Save Stats', value: 'save', primary: true },
                { id: 'stat-prompt-abandon', label: 'Abandon Changes', value: 'abandon', danger: true },
                { id: 'stat-prompt-cancel', label: 'Cancel', value: 'cancel' }
            ]
        });
        if (choice === 'cancel' || choice == null) {
            return false;
        }
        if (choice === 'save') {
            const ok = await this.saveStatsToHud();
            return ok !== false && !this.state.statsPending;
        }
        if (choice === 'abandon') {
            this.abandonStatsChanges();
            return true;
        }
        return false;
    },

    async confirmLeaveCurrentTab(fromTab, toTab) {
        if (!fromTab || fromTab === toTab) {
            return true;
        }
        if (fromTab === 'stats' && toTab !== 'stats') {
            if (this.isInCreationFlow()) {
                // Soft gate: Apply Changes locally if pending; never force Save/Abandon dialog
                if (this.state.statsPending) {
                    await this.saveStatsToHud();
                }
                return true;
            }
            return this.resolveUnsavedStatsPrompt();
        }
        return true;
    },

    async saveAllPendingChanges() {
        if (this.state.statsPending) {
            const statsOk = await this.saveStatsToHud();
            if (!statsOk && this.state.statsPending) {
                return false;
            }
        }
        if (this.state.dirty) {
            const draft = this.isInCreationFlow();
            const saved = await this.saveCharacter({ draft: draft });
            if (saved === false) {
                return false;
            }
        }
        return true;
    },

    /**
     * Show unsaved changes warning modal (UX 2)
     * @returns {Promise<boolean>} true if caller may proceed (saved or abandoned)
     */
    async showUnsavedChangesModal() {
        const hasChar = !!this.state.dirty;
        const hasStats = !!this.state.statsPending;
        if (!hasChar && !hasStats) {
            return true;
        }
        if (typeof MoapDialogs === 'undefined' || !MoapDialogs.showChoice) {
            return false;
        }

        let message = '';
        if (hasChar && hasStats) {
            message = 'You have unsaved character edits and unsaved stat/AP changes.\n\nSave applies both. Abandon reverts everything to the last saved state.';
        } else if (hasStats) {
            message = 'You have stat or AP changes that are not saved to your HUD.\n\nSave applies them. Abandon reverts to the values from your last Save Stats.';
        } else {
            message = 'You have unsaved character changes.\n\nSave applies them to the cloud. Abandon reloads the last saved character.';
        }

        const choice = await MoapDialogs.showChoice({
            title: 'Unsaved Changes',
            message: message,
            buttons: [
                { id: 'unsaved-save-btn', label: 'Save Changes', value: 'save', primary: true },
                { id: 'unsaved-abandon-btn', label: 'Abandon Changes', value: 'abandon', danger: true },
                { id: 'unsaved-cancel-btn', label: 'Cancel', value: 'cancel' }
            ]
        });

        if (choice === 'cancel' || choice == null) {
            return false;
        }
        if (choice === 'save') {
            return this.saveAllPendingChanges();
        }
        if (choice === 'abandon') {
            this.abandonAllUnsavedChanges();
            return true;
        }
        return false;
    },

    abandonStatsChanges() {
        const char = this.state.character;
        if (!char || !this.state.statsPending) {
            return;
        }
        const baseline = this.state.statsAbandonBaseline;
        const floor = baseline ? baseline.stats : this.state.statsFloor;
        if (floor) {
            char.stats = Object.assign({}, floor);
        }
        const restoredAp = baseline
            ? baseline.ap_balance
            : (this.state.apFloor != null ? this.state.apFloor : (Math.max(0, parseInt(char.ap_balance, 10) || 0)));
        const restoredSpent = baseline
            ? baseline.xp_spent
            : (this.state.xpSpentFloor != null ? this.state.xpSpentFloor : window.getEconSpent(char));
        char.ap_balance = restoredAp;
        char.xp_spent = restoredSpent;
        if (!this.state.econ) {
            this.state.econ = {};
        }
        this.state.econ.ap_balance = restoredAp;
        this.state.econ.xp_spent = restoredSpent;
        if (typeof window.updateEconUrlParams === 'function') {
            window.updateEconUrlParams(restoredSpent, restoredAp);
        }
        this.state.statsPending = false;
        this.state.statsAbandonBaseline = null;
        this.state.econSessionActive = true;
        this.clearMoapSessionDraft(char.id);
        this.updateSaveStatsButton();
        this.updateStatusIndicator();
        const stats = char.stats || this.getDefaultStats();
        const caps = this.calculateStatCaps();
        if (typeof UI.renderEconDisplay === 'function') {
            UI.renderEconDisplay(char);
        }
        if (typeof UI.renderStatsGrid === 'function') {
            UI.renderStatsGrid(stats, caps, restoredAp, this.state.statsFloor || {});
        }
        UI.showToast('Stat changes abandoned', 'info', 2000);
    },

    abandonAllUnsavedChanges() {
        if (this.state.statsPending) {
            this.abandonStatsChanges();
        }
        this.discardCharacterChanges();
    },

    /**
     * Discard unsaved character edits (reload from cloud). Does not touch stats unless statsPending (use abandonAllUnsavedChanges).
     */
    discardCharacterChanges() {
        this.state.dirty = false;
        if (this.state.selectedCharacterId || this.state.character?.id) {
            this.loadData();
        }
        this.updateStatusIndicator();
    },

    /**
     * Discard unsaved changes (UX 2) — alias for abandon all
     */
    discardChanges() {
        this.abandonAllUnsavedChanges();
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
            const universe = this.characterMissingUniverse(char)
                ? '(needs universe)'
                : this._normalizeUniverseId(char.universe_id);
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
                } else if (!this.state.selectedCharacterId && characters.indexOf(char) === 0 && !this.state.creationInProgress) {
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

        if (this.state.selectedCharacterId && !addedIds[this.state.selectedCharacterId]) {
            const activeChar = (this.state.character && this.state.character.id === this.state.selectedCharacterId)
                ? this.state.character
                : this.characterFromList(characters, this.state.selectedCharacterId);
            if (activeChar && activeChar.id) {
                const option = document.createElement('option');
                option.value = activeChar.id;
                option.textContent = activeChar.name || 'Unnamed';
                option.selected = true;
                selector.appendChild(option);
            }
        }
        
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
     * HOTFIX 4.3.2: NEVER delete characters on load.
     * 4.3.1 deleted any roster row with setup_complete===false / no class_id — that wiped
     * existing players who never had the Hybrid flag. Keep every character with an id.
     * @returns {Promise<Array>} all listed characters (id required)
     */
    async cleanupIncompleteCharacters(characters) {
        const list = Array.isArray(characters) ? characters.slice() : [];
        const keep = [];
        let i;
        for (i = 0; i < list.length; i++) {
            const c = list[i];
            if (c && c.id) {
                keep.push(c);
            }
        }
        if (API._listCharactersCache) {
            API._listCharactersCache = keep.slice();
        }
        return keep;
    },

    /**
     * When f4roster_ is empty, still try to continue an existing character from HUD/session/active.
     * Never push Welcome if we can recover one.
     * @returns {Promise<Array|null>}
     */
    /**
     * One visible character from the HUD session or the URL when f4roster_ did not load.
     * Does not write KVP and must not open the new-player screen.
     */
    async recoverActiveCharacterShell(preferredCharId) {
        let id = (preferredCharId && this.isPlausibleCharacterId(preferredCharId)) ? preferredCharId : '';
        let name = '';
        let title = '';
        let gender = '';
        let speciesId = '';
        let hasMana = false;
        try {
            const params = new URLSearchParams(window.location.search);
            hasMana = params.get('has_mana') === '1';
            if (!id) {
                const fromUrl = params.get('active_char') || '';
                if (this.isPlausibleCharacterId(fromUrl)) {
                    id = fromUrl;
                }
            }
            name = params.get('char_name') || '';
            title = params.get('char_title') || '';
        } catch (e) { /* ignore */ }
        if (this.isBridgeHudMode() && typeof F4BridgeHud !== 'undefined' && F4BridgeHud.fetchSession) {
            try {
                if (F4BridgeHud.waitForBridgeReady) {
                    await F4BridgeHud.waitForBridgeReady(8000);
                }
                const session = await F4BridgeHud.fetchSession();
                if (session && session.ok && this.isPlausibleCharacterId(session.characterId)) {
                    if (!id) {
                        id = session.characterId;
                    }
                    if (!name || id === session.characterId) {
                        name = session.name || name;
                        title = session.title || title;
                        gender = session.gender || gender;
                        speciesId = session.species_id || speciesId;
                    }
                }
            } catch (sessionErr) {
                console.warn('[loadData] Active character shell session failed:', sessionErr);
            }
        }
        if (!id || !this.isPlausibleCharacterId(id)) {
            return null;
        }
        return {
            id: id,
            owner_uuid: API.uuid,
            name: name || 'Active character',
            title: title || '',
            gender: gender || 'other',
            species_id: speciesId || 'human',
            class_id: '',
            universe_id: '',
            setup_complete: true,
            has_mana: hasMana,
            _rosterPartial: true
        };
    },

    async recoverExistingCharactersWhenRosterEmpty(preferredCharId) {
        const recovered = [];
        const seen = {};
        const self = this;
        const pushChar = function (char) {
            if (!char || !self.isPlausibleCharacterId(char.id) || seen[char.id]) {
                return;
            }
            seen[char.id] = true;
            if (!char.owner_uuid && API.uuid) {
                char.owner_uuid = API.uuid;
            }
            recovered.push(char);
        };

        // Never invent a character from HUD LSD alone — that resurrects deleted chars.
        // Session / f4active_ may only supply a preferred id to verify against roster/KVP.
        // Never use the avatar UUID as a character id.
        if (preferredCharId && !this.isPlausibleCharacterId(preferredCharId)) {
            preferredCharId = null;
        }
        if (this.isBridgeHudMode()) {
            try {
                if (typeof F4BridgeHud !== 'undefined' && F4BridgeHud.waitForBridgeReady) {
                    await F4BridgeHud.waitForBridgeReady(10000);
                }
                if (typeof F4Bridge !== 'undefined' && F4Bridge.getActiveCharacter) {
                    const activeRes = await F4Bridge.getActiveCharacter();
                    if (activeRes && activeRes.ok && this.isPlausibleCharacterId(activeRes.characterId)) {
                        preferredCharId = preferredCharId || activeRes.characterId;
                    }
                }
                if (typeof F4BridgeHud !== 'undefined' && F4BridgeHud.fetchSession) {
                    const session = await F4BridgeHud.fetchSession();
                    if (session && session.ok && this.isPlausibleCharacterId(session.characterId)) {
                        preferredCharId = preferredCharId || session.characterId;
                    }
                }
            } catch (bridgeErr) {
                console.warn('[loadData] Bridge recover failed:', bridgeErr);
            }
        }

        const tryIds = [];
        if (preferredCharId && this.isPlausibleCharacterId(preferredCharId)) {
            tryIds.push(preferredCharId);
        }
        let ti;
        for (ti = 0; ti < tryIds.length; ti++) {
            const tryId = tryIds[ti];
            if (seen[tryId]) {
                continue;
            }
            try {
                const byId = await API.getCharacterById(tryId);
                if (byId.success && byId.data && byId.data.character) {
                    pushChar(byId.data.character);
                }
            } catch (idErr) {
                console.warn('[loadData] getCharacterById recover failed:', tryId, idErr);
            }
        }

        if (!recovered.length && !this.isBridgeHudMode()
            && !(API.shouldDiscardFirestoreGameplay && API.shouldDiscardFirestoreGameplay())) {
            try {
                const legacy = await API.getCharacter();
                if (legacy.success && legacy.data && legacy.data.character) {
                    pushChar(legacy.data.character);
                }
            } catch (legacyErr) {
                console.warn('[loadData] Firestore getCharacter recover failed:', legacyErr);
            }
        }

        if (!recovered.length) {
            return null;
        }
        let ri;
        for (ri = 0; ri < recovered.length; ri++) {
            this.upsertCharacterInRosterCache(recovered[ri]);
        }
        return recovered;
    },

    /**
     * Welcome gate when roster is empty — Play as starter or Create my own.
     */
    updateWelcomeEmptyRosterUI() {
        const welcome = document.getElementById('welcome-empty-roster');
        const noCharHero = document.getElementById('no-character-hero');
        const noCharMessage = document.getElementById('no-character-message');
        const stepGuidePanel = document.querySelector('.step-guide-panel');
        const reviewPanel = document.getElementById('creation-review-panel');
        const rosterLen = (API._listCharactersCache && API._listCharactersCache.length) || 0;
        // Never show Welcome if any character is loaded or listed — existing players must not recreate.
        const showWelcome = !!(this.state.awaitingWelcomeChoice
            && !this.state.character
            && !this.state.creationInProgress
            && rosterLen === 0);
        if (welcome) {
            welcome.style.display = showWelcome ? 'block' : 'none';
        }
        if (noCharHero) {
            noCharHero.style.display = 'none';
        }
        if (noCharMessage) {
            noCharMessage.style.display = showWelcome ? 'block' : 'none';
            if (showWelcome) {
                noCharMessage.innerHTML = '<strong>In order to play you must create a character.</strong> Choose an option below.';
            }
        }
        if (stepGuidePanel) {
            stepGuidePanel.style.display = (this.state.character || this.state.creationInProgress) ? 'block' : 'none';
        }
        if (reviewPanel && !this.isInCreationFlow()) {
            reviewPanel.style.display = 'none';
        }
    },

    /**
     * Mint a complete starter character (setup_complete=1, Adventurer). Explicit Welcome CTA only.
     */
    async playAsStarterCharacter() {
        if (this._starterProvisionPromise) {
            return this._starterProvisionPromise;
        }
        this._starterProvisionPromise = this._playAsStarterCharacterInternal();
        try {
            return await this._starterProvisionPromise;
        } finally {
            this._starterProvisionPromise = null;
        }
    },

    async _playAsStarterCharacterInternal() {
        if (!API.uuid || API.uuid.trim() === '') {
            UI.showToast('Waiting for HUD identity — try again in a moment', 'warning');
            return false;
        }

        // Do not mint a starter over an existing character (roster / loaded / recovered).
        const existingRoster = (API._listCharactersCache || []).filter(function (c) { return c && c.id; });
        if (this.state.character && this.state.character.id) {
            UI.showToast('You already have a character loaded. Use the character selector.', 'info', 4000);
            this.state.awaitingWelcomeChoice = false;
            this.updateWelcomeEmptyRosterUI();
            return false;
        }
        if (existingRoster.length > 0) {
            UI.showToast('You already have a character. Loading it instead of creating a starter.', 'info', 4000);
            this.state.awaitingWelcomeChoice = false;
            await this.loadData({ forceRefresh: true });
            return false;
        }

        const universeId = 'default';
        try {
            const universeResult = await API.getUniverse(universeId);
            if (!universeResult.success || !universeResult.data || !universeResult.data.universe) {
                UI.showToast('Default universe unavailable — create your own character instead', 'warning');
                await this.startLocalCreationWizard();
                return false;
            }
            const universe = universeResult.data.universe;
            if (universe.registrationCode && universe.registrationCode.trim() !== '') {
                UI.showToast('Default universe requires a code — create your own character instead', 'info');
                await this.startLocalCreationWizard();
                return false;
            }

            const limitCheck = await API.validateCharacterLimit(universeId, API.uuid);
            if (!limitCheck.success || !limitCheck.data || !limitCheck.data.allowed) {
                UI.showToast('Character limit reached — create your own in another universe if available', 'warning');
                await this.startLocalCreationWizard();
                return false;
            }

            let starterName = (API.displayName || this.lsl.displayName || '').trim();
            if (!starterName) {
                starterName = 'My First Character';
            }

            const speciesId = 'human';
            const classId = 'adventurer';
            const stats = this.getNewCharacterStats();
            const grant = this.getStartingXpGrant(speciesId);
            const species = this.state.species.find(function (s) { return s.id === speciesId; }) || {
                health_factor: 25,
                stamina_factor: 25,
                mana_factor: 25
            };
            const hasMana = false;
            const baseHealth = this.calculateHealth(stats, species);
            const baseStamina = this.calculateStamina(stats, species);
            const baseMana = this.calculateMana(stats, species, hasMana);

            UI.showToast('Creating your starter character…', 'info', 2000);

            const result = await API.createCharacter({
                name: starterName,
                title: '',
                gender: 'other',
                species_id: speciesId,
                class_id: classId,
                universe_id: universeId,
                has_mana: hasMana,
                health: { current: baseHealth, base: baseHealth, max: baseHealth },
                stamina: { current: baseStamina, base: baseStamina, max: baseStamina },
                mana: { current: baseMana, base: baseMana, max: baseMana },
                stats: stats,
                mode: 'roleplay',
                setup_complete: true,
                xp_lifetime: grant,
                xp_spent: 0,
                ap_balance: 0
            });

            if (!result || !result.success || !result.data || !result.data.character) {
                UI.showToast('Could not create starter: ' + ((result && result.error) || 'unknown'), 'error');
                return false;
            }

            const character = result.data.character;
            character.setup_complete = true;
            character.class_id = character.class_id || classId;
            character.xp_lifetime = grant;
            character.xp_spent = 0;
            character.ap_balance = 0;
            character.stats = stats;
            this.state.character = character;
            this.state.selectedCharacterId = character.id;
            this.state.isNewCharacter = false;
            this.state.creationInProgress = false;
            this.state.creationStepId = null;
            this.state.awaitingWelcomeChoice = false;
            this.state.currentUniverse = universe;
            if (typeof App.state.econ === 'undefined' || !App.state.econ) {
                App.state.econ = {};
            }
            App.state.econ.xp_lifetime = grant;
            App.state.econ.xp_spent = 0;
            App.state.econ.ap_balance = 0;
            App.state.econSessionActive = true;
            this.recalculateResourcePools();

            if (API.setActiveCharacter) {
                await API.setActiveCharacter(character.id);
            }
            this._pendingAutoHideSetup = true;
            if (this.isBridgeHudMode()) {
                await this.finishCreationGameplayToKvp(character, {
                    silent: true,
                    forceSlotSync: true
                });
            } else {
                await this.pushCharacterToPlayersHUD(character.id);
            }
            await this.rememberSelectedCharacter(character.id);
            UI.showToast('Welcome! Your starter character is ready. Customize anytime in Setup.', 'success', 4000);
            await this.loadData({ forceRefresh: true });
            return true;
        } catch (error) {
            console.error('[Hybrid] playAsStarterCharacter error:', error);
            UI.showToast('Starter create failed: ' + (error.message || error), 'error');
            return false;
        }
    },

    /**
     * Begin local-only creation wizard (no KVP until Finish).
     */
    async startLocalCreationWizard(options) {
        if (options === undefined) {
            options = {};
        }
        this.state.awaitingWelcomeChoice = false;
        this.state.priorActiveBeforeCreation = this.state.selectedCharacterId || (this.state.character && this.state.character.id) || null;
        this.state.selectedCharacterId = null;
        this.state.isNewCharacter = true;
        this.state.creationInProgress = true;
        this.state.creationStepId = 'universe';
        this.state.creationMaxStepIndex = 0;
        this.resetHudUrlForNewCharacterDraft();
        this.state.character = this.createDefaultCharacter();
        this.state.character.setup_complete = false;
        this.resetDraftEconOnCharacter(this.state.character);
        this.captureStatsFloor(this.state.character);
        // Clear stale name/title left in the form after deleting a prior character
        if (typeof UI !== 'undefined' && UI.populateIdentityForm) {
            UI.populateIdentityForm(this.state.character, '');
        }
        if (options.universeId) {
            this.state.selectedUniverseId = options.universeId;
            this.state.character.universe_id = options.universeId;
            const universeResult = await API.getUniverse(options.universeId);
            if (universeResult.success) {
                this.state.currentUniverse = universeResult.data.universe;
            }
            await this.applyUniverseIdentityDefaults({ force: true });
            this.state.creationStepId = 'identity';
            this.state.creationMaxStepIndex = 1;
        } else {
            this.state.selectedUniverseId = null;
            this.state.character.universe_id = '';
        }
        this.updateCharacterSelectorWithTemp();
        UI.switchTab('character');
        await this.renderAll();
        this.navigateToStep(this.state.creationStepId);
        this.updateCreationNavigation();
        if (this.state.creationStepId === 'identity') {
            setTimeout(function () {
                const el = document.getElementById('char-name');
                if (el) {
                    el.focus();
                }
            }, 200);
        }
    },

    /**
     * Cancel local creation — wipe draft; never leaves an incomplete KVP char.
     */
    async cancelCreationWizard() {
        const hadId = !!(this.state.character && this.state.character.id);
        if (hadId && API.deleteCharacter) {
            try {
                await API.deleteCharacter(this.state.character.id);
            } catch (e) {
                console.warn('[Hybrid] cancel delete failed', e);
            }
        }
        this.clearRememberedCreationStep(this.state.character && this.state.character.id);
        this.state.character = null;
        this.state.isNewCharacter = false;
        this.state.creationInProgress = false;
        this.state.creationStepId = null;
        this.state.creationMaxStepIndex = 0;
        this.state.dirty = false;
        this.state.statsPending = false;
        this.state.pendingChanges = {};
        this.resetHudUrlForNewCharacterDraft();

        const roster = (API._listCharactersCache || []).filter(function (c) {
            return c && c.id;
        });
        if (roster.length) {
            this.state.awaitingWelcomeChoice = false;
            const restoreId = this.state.priorActiveBeforeCreation || roster[0].id;
            this.state.priorActiveBeforeCreation = null;
            await this.rememberSelectedCharacter(restoreId);
            await this.loadData({ forceRefresh: true });
            UI.showToast('Character creation cancelled', 'info', 2500);
            return;
        }
        this.state.awaitingWelcomeChoice = true;
        this.state.selectedCharacterId = null;
        this.state.priorActiveBeforeCreation = null;
        await this.loadCharacterSelector([]);
        await this.renderAll();
        UI.showToast('Character creation cancelled', 'info', 2500);
    },

    /**
     * Stats page: reset XP / spent / AP / stats to species seed. Stay on Stats.
     */
    resetCreationStatsToDefaults() {
        const char = this.state.character;
        if (!char || !this.isInCreationFlow()) {
            return;
        }
        if (!char.species_id) {
            UI.showToast('Confirm a species on the Character step first', 'warning');
            return;
        }
        this.applyCalculatedStarterGameplay(char);
        this.captureAbandonBaseline(char);
        this.state.statsPending = false;
        this.state.dirty = true;
        this.refreshStatsTabFromCharacter();
        this.updateSaveStatsButton();
        this.updateStatusIndicator();
        UI.showToast('Stats reset to starting values', 'info', 2000);
    },

    /**
     * Finish local wizard — single complete mint.
     */
    async finishLocalCreation() {
        const char = this.state.character;
        if (!char) {
            return false;
        }
        const steps = this.getCreationSteps();
        let si;
        for (si = 0; si < steps.length; si++) {
            if (steps[si].id === 'review') {
                continue;
            }
            const check = this.validateCreationStep(steps[si].id);
            if (!check.ok) {
                UI.showToast(check.message, 'warning');
                this.navigateToStep(steps[si].id);
                return false;
            }
        }
        if (!char.class_id) {
            UI.showToast('Please select a starting class', 'warning');
            this.navigateToStep('class');
            return false;
        }
        this.flushIdentityFromForm();
        this.recalculateResourcePools();
        if (!this.hasCreationGameplayReady(char)) {
            this.applyCalculatedStarterGameplay(char);
        }
        // Ghost id from LSD / failed delete must not turn Finish into an identity-only update.
        if (char.id) {
            console.warn('[Hybrid] Finish mint — clearing ghost character id', char.id);
            delete char.id;
        }
        const saved = await this.saveCharacter({ draft: false, silent: false, completeMint: true });
        if (saved === false) {
            return false;
        }
        this.state.awaitingWelcomeChoice = false;
        this.state.creationInProgress = false;
        this.state.isNewCharacter = false;
        this.state.creationStepId = null;
        this.state.statsPending = false;
        this._pendingAutoHideSetup = true;
        // Exit creation chrome immediately (Cancel / Continue bar must not linger after SAVED)
        this.updateCreationNavigation();
        this.updateStatusIndicator();
        this.updateSaveStatsButton();
        return true;
    },

    renderCreationReview() {
        const panel = document.getElementById('creation-review-panel');
        const body = document.getElementById('creation-review-body');
        if (!panel || !body) {
            return;
        }
        const char = this.state.character;
        if (!char || !this.isInCreationFlow() || this.state.creationStepId !== 'review') {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        const gender = (this.state.genders || []).find(function (g) { return g.id === char.gender; });
        const species = (this.state.species || []).find(function (s) { return s.id === char.species_id; });
        const cls = (this.state.filteredClasses && this.state.filteredClasses.length
            ? this.state.filteredClasses
            : (this.state.classes || [])).find(function (c) { return c.id === char.class_id; });
        const life = Math.max(0, parseInt(char.xp_lifetime, 10) || 0);
        const spent = Math.max(0, parseInt(char.xp_spent, 10) || 0);
        const ap = Math.max(0, parseInt(char.ap_balance, 10) || 0);
        const unused = Math.max(0, life - spent);
        const stats = char.stats || {};
        const statKeys = Object.keys(stats);
        let statsHtml = '';
        let si;
        for (si = 0; si < statKeys.length; si++) {
            const key = statKeys[si];
            statsHtml += '<div class="review-stat"><span>' + key.replace(/_/g, ' ') + '</span><strong>' + stats[key] + '</strong></div>';
        }

        function resolveTemplateImageSrc(obj, kind) {
            if (!obj) {
                return '';
            }
            if (kind === 'class' && typeof UI !== 'undefined' && typeof UI.getClassImageSrc === 'function') {
                return UI.getClassImageSrc(obj) || '';
            }
            let path = obj.image || obj.image_url || obj.portrait || '';
            if (!path) {
                return '';
            }
            if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
                return path;
            }
            if (path.indexOf('images/') === 0) {
                return path;
            }
            return 'images/' + path;
        }

        function imgBlock(label, obj, fallback, kind) {
            const src = resolveTemplateImageSrc(obj, kind);
            const name = (obj && obj.name) || fallback || '—';
            if (src) {
                return '<div class="review-portrait">'
                    + '<img src="' + src + '" alt="' + name + '"'
                    + ' onerror="this.style.display=\'none\';'
                    + ' var fb=this.nextElementSibling; if(fb){fb.style.display=\'flex\';}">'
                    + '<div class="review-portrait-fallback" style="display:none;">' + label + ': <strong>' + name + '</strong></div>'
                    + '<div class="review-portrait-caption">' + label + ': <strong>' + name + '</strong></div>'
                    + '</div>';
            }
            return '<div class="review-portrait"><div class="review-portrait-fallback">' + label + ': <strong>' + name + '</strong></div></div>';
        }
        body.innerHTML =
            '<p class="review-lead">Click <strong>Finish</strong> to keep this character, or <strong>Cancel creation</strong> to discard it.</p>'
            + '<div class="review-portraits">'
            + imgBlock('Gender', gender, char.gender, 'gender')
            + imgBlock('Species', species, char.species_id, 'species')
            + imgBlock('Class', cls, char.class_id, 'class')
            + '</div>'
            + '<div class="review-identity"><strong>' + (char.name || 'Unnamed') + '</strong>'
            + (char.title ? ' <span class="review-title">— ' + char.title + '</span>' : '')
            + (char.has_mana ? ' · Magically gifted' : '')
            + '</div>'
            + '<div class="review-econ">Earned XP: <strong>' + life + '</strong> · Unused: <strong>' + unused
            + '</strong> · AP: <strong>' + ap + '</strong></div>'
            + '<div class="review-stats-grid">' + statsHtml + '</div>';
    },

    /**
     * Legacy no-op — auto-mint on wear removed. Use playAsStarterCharacter.
     */
    async ensureStarterCharacter() {
        return false;
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
            // Lifetime XP is seeded on Create / starter provision (20000 + species.starting_xp).
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
     * After buy AP / stat spend: refresh econ + stats grid only (no full character reload).
     */
    renderEconSyncRefresh() {
        const char = this.state.character;
        if (!char) {
            return;
        }
        if (typeof UI !== 'undefined' && typeof UI.clearNativeTooltips === 'function') {
            UI.clearNativeTooltips(document);
        }
        this.mergeUrlEconIntoCharacter();
        if (this.mergeStatsFromUrlIntoCharacter()) {
            this.captureAbandonBaseline(char);
            this.normalizeCharacterStats(char);
        }
        this.clearStatsPendingAfterHudSave();
        this.updateStatusIndicator();
        this.updateStepGuide();
        const stats = char.stats || this.getDefaultStats();
        const caps = this.calculateStatCaps();
        const availablePoints = window.getApBalance(char);
        if (typeof UI.renderEconDisplay === 'function') {
            UI.renderEconDisplay(char);
        }
        if (typeof UI.renderStatsGrid === 'function') {
            UI.renderStatsGrid(stats, caps, availablePoints, this.state.statsFloor || {});
        }
        UI.showToast('Stats saved to HUD', 'success', 2500);
        try {
            const u = new URL(window.location.href);
            if (u.searchParams.has('econ_sync')) {
                u.searchParams.delete('econ_sync');
                this.safeHistoryReplaceState(u.toString());
            }
        } catch (e) { /* ignore */ }
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
        this.updateWelcomeEmptyRosterUI();
        this.updateCreationNavigation();

        // UX 2: Show/hide no character message, hero panel, and step guide panel
        const noCharMessage = document.getElementById('no-character-message');
        const noCharHero = document.getElementById('no-character-hero');
        const stepGuidePanel = document.querySelector('.step-guide-panel');
        const inCreation = this.isInCreationFlow();
        const stepId = this.state.creationStepId;

        if (char && !this.state.awaitingWelcomeChoice) {
            if (noCharMessage && !this.state.awaitingWelcomeChoice) {
                noCharMessage.style.display = 'none';
            }
            if (noCharHero) noCharHero.style.display = 'none';
            if (stepGuidePanel) stepGuidePanel.style.display = 'block';
        } else if (!this.state.awaitingWelcomeChoice) {
            if (noCharMessage) noCharMessage.style.display = 'block';
            if (noCharHero) noCharHero.style.display = 'none';
            if (stepGuidePanel) stepGuidePanel.style.display = 'none';
        }
        
        // Show/hide new character banner
        const newCharBanner = document.getElementById('new-character-banner');
        if (newCharBanner) {
            newCharBanner.style.display = 'none';
        }
        
        // Universe / identity / review visibility during Hybrid creation
        const universeGroup = document.getElementById('universe-selection-group');
        const identitySection = document.getElementById('character-identity-section');
        const reviewPanel = document.getElementById('creation-review-panel');
        const identityReady = !!char;

        if (inCreation) {
            if (universeGroup) {
                const showUniverse = stepId === 'universe' || (!stepId && !char.universe_id);
                universeGroup.style.display = showUniverse ? 'block' : 'none';
                if (showUniverse) {
                    await this.loadAvailableUniverses();
                }
            }
            if (identitySection) {
                identitySection.style.display = (stepId === 'identity') ? 'block' : 'none';
            }
            if (reviewPanel) {
                reviewPanel.style.display = (stepId === 'review') ? 'block' : 'none';
                if (stepId === 'review') {
                    this.renderCreationReview();
                }
            }
        } else {
            if (identitySection) {
                identitySection.style.display = identityReady ? 'block' : 'none';
            }
            if (universeGroup) {
                universeGroup.style.display = 'none';
            }
            if (reviewPanel) {
                reviewPanel.style.display = 'none';
            }
        }
        
        // Filter identity options by universe (only after creation draft exists)
        let filteredGenders = [];
        let filteredSpecies = [];
        let filteredClasses = [];
        const universeManaEnabled = this.state.currentUniverse?.manaEnabled !== false;
        const identityGateMessage = this.state.awaitingWelcomeChoice
            ? 'Choose Play as Starter or Create New Character to begin.'
            : 'Start character creation to choose identity options.';

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
        const caps = this.calculateStatCaps();
        const availablePoints = char ? window.getApBalance(char) : 0;
        const stats = char?.stats || this.getDefaultStats();
        UI.renderStatsGrid(stats, caps, availablePoints, this.state.statsFloor || {});
        if (typeof UI.setStatsHudBanner === 'function') {
            UI.setStatsHudBanner(null);
        }
        
        // Render vocation
        const statsForVocation = char?.stats || this.getDefaultStats();
        UI.renderVocation(this.state.currentVocation, statsForVocation);
        
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
     * Load and display active buffs (one-shot GET; no realtime listener in Setup HUD).
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

    /** @deprecated Setup HUD no longer uses onSnapshot for buffs (Firestore read multiplier). */
    setupBuffsListener() {
        if (this.buffsUnsubscribe) {
            this.buffsUnsubscribe();
            this.buffsUnsubscribe = null;
        }
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
        this.captureAbandonBaseline(char);
    },

    getMoapDraftStorageKey(characterId) {
        return 'f4_moap_draft_' + (characterId || '');
    },

    /**
     * In-session draft only (same MOAP page life). Never survives setup close/reopen.
     */
    persistMoapSessionDraft(forcePersist) {
        const char = this.state.character;
        if (!char || !char.id || !char.stats) {
            return;
        }
        if (!forcePersist && !this.state.statsPending) {
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
            const params = new URLSearchParams(window.location.search);
            if (params.get('request_data') === '1') {
                this.clearMoapSessionDraft(char.id);
                return false;
            }
            if (params.get('econ_sync') === '1') {
                this.clearMoapSessionDraft(char.id);
                return false;
            }
            const raw = sessionStorage.getItem(this.getMoapDraftStorageKey(char.id));
            if (!raw) {
                return false;
            }
            const draft = JSON.parse(raw);
            if (!draft || !draft.stats) {
                return false;
            }
            char.stats = Object.assign({}, draft.stats);
            const urlHasLiveEconPush = (function () {
                try {
                    const p = new URLSearchParams(window.location.search);
                    return p.has('econ_ts') || p.get('econ_sync') === '1';
                } catch (e) {
                    return false;
                }
            })();
            if (!urlHasLiveEconPush) {
                if (draft.ap_balance != null) {
                    char.ap_balance = draft.ap_balance;
                }
                if (draft.xp_spent != null) {
                    char.xp_spent = draft.xp_spent;
                }
                if (draft.xp_lifetime != null) {
                    char.xp_lifetime = draft.xp_lifetime;
                }
            } else if (draft.ap_balance != null && (char.ap_balance || 0) < draft.ap_balance) {
                char.ap_balance = draft.ap_balance;
                if (draft.xp_spent != null) {
                    char.xp_spent = draft.xp_spent;
                }
            }
            if (typeof App.state.econ === 'undefined' || !App.state.econ) {
                App.state.econ = {};
            }
            App.state.econ.ap_balance = char.ap_balance;
            App.state.econ.xp_spent = char.xp_spent;
            App.state.econ.xp_lifetime = char.xp_lifetime;
            App.state.econSessionActive = true;
            if (!urlHasLiveEconPush) {
                window.updateEconUrlParams(char.xp_spent, char.ap_balance);
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /** Re-apply URL econ after draft merge — pushEconToHud navigation is authoritative. */
    mergeUrlEconIntoCharacter() {
        const char = this.state.character;
        if (!char) {
            return;
        }
        if (char.id && typeof this.urlHudEconBelongsToCharacter === 'function'
            && !this.urlHudEconBelongsToCharacter(char.id)) {
            return;
        }
        if (this.state.creationInProgress) {
            if (!char.id) {
                this.resetDraftEconOnCharacter(char);
                return;
            }
        }
        const url = window.getEconFromUrl();
        let changed = false;
        let params;
        let isLiveEconPush = false;
        try {
            params = new URLSearchParams(window.location.search);
            isLiveEconPush = params.has('econ_ts') || params.get('econ_sync') === '1';
        } catch (e) { /* ignore */ }
        if (!isNaN(url.xp_lifetime) && url.xp_lifetime > 0) {
            char.xp_lifetime = url.xp_lifetime;
            changed = true;
        }
        if (!isNaN(url.xp_spent) && url.xp_spent >= 0 && params && params.has('xp_spent')) {
            char.xp_spent = url.xp_spent;
            changed = true;
        }
        if (!isNaN(url.ap_balance) && url.ap_balance >= 0 && params && params.has('ap_balance')) {
            if (isLiveEconPush || url.ap_balance > 0 || !(char.ap_balance > 0)) {
                char.ap_balance = url.ap_balance;
                changed = true;
            }
        }
        if (!changed) {
            return;
        }
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = char.xp_lifetime;
        App.state.econ.xp_spent = char.xp_spent;
        App.state.econ.ap_balance = char.ap_balance;
        App.state.econSessionActive = true;
    },

    clearMoapSessionDraft(characterId) {
        const id = characterId || (this.state.character && this.state.character.id);
        if (!id) {
            return;
        }
        try {
            sessionStorage.removeItem(this.getMoapDraftStorageKey(id));
            localStorage.removeItem(this.getMoapDraftStorageKey(id));
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
                buyQty = 1;
                refreshBuyCost();
            }
        });
        document.getElementById('btn-save-stats')?.addEventListener('click', function () {
            if (typeof App.saveStatsToHud === 'function') {
                App.saveStatsToHud().catch(function (err) {
                    console.error('[Save Stats]', err);
                    UI.showToast('Save Stats failed', 'error');
                });
            }
        });
        document.getElementById('btn-refresh-stats-hud')?.addEventListener('click', function () {
            if (typeof App.refreshHudGameplayFromMoap === 'function') {
                App.refreshHudGameplayFromMoap({ showModal: true, forceRefresh: true }).then(function (ok) {
                    if (!ok && typeof UI !== 'undefined' && UI.showToast) {
                        UI.showToast(
                            'HUD refresh failed — Experience has no f4stats_/f4state_ for this character (or HUD slot mismatch). Use Save Stats, then try again.',
                            'warning',
                            6000
                        );
                    }
                });
            }
        });
        document.getElementById('btn-abandon-stats')?.addEventListener('click', function () {
            if (typeof App.abandonStatsChanges === 'function') {
                App.abandonStatsChanges();
            }
        });
        document.getElementById('btn-abandon-character')?.addEventListener('click', async function () {
            if (!App.state.dirty) {
                return;
            }
            if (typeof MoapDialogs !== 'undefined' && MoapDialogs.showConfirm) {
                const ok = await MoapDialogs.showConfirm({
                    title: 'Abandon character changes?',
                    message: 'Reload this character from the cloud and discard unsaved name, identity, and career edits.',
                    confirmLabel: 'Abandon Changes',
                    danger: true
                });
                if (!ok) {
                    return;
                }
            }
            if (typeof App.discardCharacterChanges === 'function') {
                App.discardCharacterChanges();
                UI.showToast('Character changes abandoned', 'info', 2000);
            }
        });

        if (!UI._switchTabWrapped && typeof UI.switchTab === 'function') {
            UI._switchTabWrapped = true;
            const origSwitchTab = UI.switchTab.bind(UI);
            UI.switchTab = async function (tabId) {
                const activeBtn = document.querySelector('.tab-btn.active');
                const currentTab = activeBtn ? activeBtn.dataset.tab : null;
                if (currentTab && currentTab !== tabId && typeof App.confirmLeaveCurrentTab === 'function') {
                    const allowed = await App.confirmLeaveCurrentTab(currentTab, tabId);
                    if (!allowed) {
                        return;
                    }
                }
                if (tabId === 'stats' && typeof App.prepareCreationStatsTab === 'function'
                    && typeof App.isInCreationFlow === 'function' && App.isInCreationFlow()) {
                    App._hudGameplayHydrationGen = (App._hudGameplayHydrationGen || 0) + 1;
                    origSwitchTab(tabId);
                    await App.prepareCreationStatsTab();
                    return;
                }
                if (tabId === 'stats' && typeof App.refreshHudGameplayFromMoap === 'function'
                    && App.isBridgeHudMode && App.isBridgeHudMode()) {
                    App._hudGameplayHydrationGen = (App._hudGameplayHydrationGen || 0) + 1;
                    origSwitchTab(tabId);
                    const cid = App.state.character && App.state.character.id;
                    if (cid) {
                        const statsLoaded = await App.refreshHudGameplayFromMoap({
                            showModal: false,
                            forceRefresh: false
                        });
                        if (!statsLoaded && typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                            UI.setStatsHudBanner('Could not refresh from HUD — try again or reattach the HUD.', 'warning');
                        }
                    } else if (typeof App.refreshStatsTabFromCharacter === 'function') {
                        App.refreshStatsTabFromCharacter();
                    }
                    return;
                }
                origSwitchTab(tabId);
                if (tabId === 'stats' && typeof App.refreshStatsTabFromCharacter === 'function') {
                    App.refreshStatsTabFromCharacter();
                }
            };
        }

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
        
        // Welcome / hero CTAs
        document.getElementById('btn-play-as-starter')?.addEventListener('click', () => {
            this.playAsStarterCharacter();
        });
        document.getElementById('btn-create-my-own')?.addEventListener('click', () => {
            this.startLocalCreationWizard();
        });
        document.getElementById('btn-create-new-hero')?.addEventListener('click', () => {
            this.startLocalCreationWizard();
        });
        document.getElementById('btn-cancel-creation')?.addEventListener('click', async () => {
            const ok = await UI.showConfirmDialog({
                title: 'Cancel character creation?',
                message: 'This discards your draft. Nothing is saved until you Finish.',
                confirmLabel: 'Cancel creation',
                cancelLabel: 'Keep creating'
            });
            if (ok) {
                await this.cancelCreationWizard();
            }
        });
        document.getElementById('btn-reset-creation-stats')?.addEventListener('click', () => {
            this.resetCreationStatsToDefaults();
        });
        
        // New Character link in banner
        document.getElementById('new-character-link')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
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
                else if (this.state.dirty || this.state.statsPending) {
                    const shouldProceed = await this.showUnsavedChangesModal();
                    if (!shouldProceed) {
                        // Reset selector
                        e.target.value = this.state.selectedCharacterId || '__temp__';
                        return;
                    }
                }
                const switchingFrom = this.state.selectedCharacterId || this.state.character?.id;
                const isCharacterSwitch = !!(switchingFrom && switchingFrom !== value);
                if (isCharacterSwitch) {
                    await this.reloadSetupHudForCharacterSwitch(value);
                    this.updateStepGuide();
                    this.updateDeleteButtonVisibility();
                    return;
                }
                await this.rememberSelectedCharacter(value);
                this.state.dirty = false;
                await this.loadData({ characterSwitch: false });
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
        this.sendToLSL('UPDATE_HAS_MANA', { has_mana: enabled ? '1' : '0' });
        try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('has_mana', enabled ? '1' : '0');
            this.safeHistoryReplaceState(currentUrl.toString());
        } catch (e) { /* ignore */ }
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
        if (id && !this.isPlausibleCharacterId(id)) {
            console.warn('[Character] Ignoring avatar-UUID selection:', id);
            this.clearStaleCharacterSelection();
            return;
        }
        if (id) {
            this.state.selectedCharacterId = id;
            console.log('[Character] Initial selection:', id);
        }
    },

    /**
     * Pick character document id when loading roster.
     * Preferred id wins only when it is still on the roster (never invent from avatar UUID).
     */
    pickCharacterIdToLoad(characters) {
        const preferred = this.state.selectedCharacterId
            || API.activeCharacterId
            || null;
        if (preferred && this.isPlausibleCharacterId(preferred) && characters && characters.length) {
            let i;
            for (i = 0; i < characters.length; i++) {
                if (characters[i].id === preferred) {
                    return preferred;
                }
            }
        }
        if (!characters || characters.length === 0) {
            return null;
        }
        return characters[0].id;
    },

    syncActiveCharToUrl(characterId) {
        if (!characterId || !this.isPlausibleCharacterId(characterId)) {
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
        if (!characterId || !this.isPlausibleCharacterId(characterId)) {
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
        if (char.id && typeof this.urlHudEconBelongsToCharacter === 'function'
            && !this.urlHudEconBelongsToCharacter(char.id)) {
            return;
        }
        if (this.state.creationInProgress) {
            if (!char.id) {
                this.resetDraftEconOnCharacter(char);
                return;
            }
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
            if (!isNaN(urlLife) && urlLife > 0) {
                lifetime = urlLife;
            } else if (!isNaN(urlLegacy) && urlLegacy > 0) {
                lifetime = urlLegacy;
            }
            if (!isNaN(urlSpent) && urlSpent >= 0) {
                spent = urlSpent;
            }
            if (!isNaN(urlAp) && urlAp >= 0) {
                ap = urlAp;
            }
        } catch (e) { /* ignore */ }
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
        // v2 economy: AP is bought with XP — never derive AP from lifetime XP.
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

    /** Base lifetime XP for every new character, plus species.starting_xp bonus. */
    getStartingXpGrant(speciesId) {
        const BASE_STARTING_XP = 20000;
        return BASE_STARTING_XP + this.getSpeciesStartingXp(speciesId || 'human');
    },

    /** True once Firestore draft exists (Save Progress completed at least once). */
    hasCreationProgressSaved() {
        const char = this.state.character;
        return !!(char && char.id && this.isInCreationFlow());
    },

    getEffectiveXpLifetime(char) {
        let life = 0;
        if (char && char.xp_lifetime != null) {
            life = Math.max(0, parseInt(char.xp_lifetime, 10) || 0);
        }
        if (typeof App !== 'undefined' && App.state && App.state.econ && App.state.econ.xp_lifetime != null) {
            life = Math.max(life, parseInt(App.state.econ.xp_lifetime, 10) || 0);
        }
        if (this._lastBridgeSession && this._lastBridgeSession.ok) {
            life = Math.max(life, parseInt(this._lastBridgeSession.xp_lifetime, 10) || 0);
        }
        return life;
    },

    /** True after species is confirmed and starter stats/XP are on the character object. */
    hasCreationStarterGameplay(char) {
        if (!char || !char.species_id || !char.stats) {
            return false;
        }
        const grant = this.getStartingXpGrant(char.species_id);
        return grant > 0 && this.getEffectiveXpLifetime(char) >= grant;
    },

    /**
     * Creation wizard: species chosen and gameplay is ready (starter grant, HUD session, or edited stats).
     */
    hasCreationGameplayReady(char) {
        if (!char || !char.species_id) {
            return false;
        }
        if (this.hasEditedGameplay(char)) {
            return true;
        }
        if (char.stats && this.hasCreationStarterGameplay(char)) {
            return true;
        }
        if (this._bridgeSessionApplied && this._lastBridgeSession && this._lastBridgeSession.ok) {
            const sessionLife = parseInt(this._lastBridgeSession.xp_lifetime, 10) || 0;
            const grant = this.getStartingXpGrant(char.species_id);
            if (grant > 0 && sessionLife >= grant) {
                return true;
            }
        }
        return false;
    },

    ensureCreationEconReady(char) {
        if (!char || !char.species_id || !this.isInCreationFlow()) {
            return false;
        }
        const grant = this.getStartingXpGrant(char.species_id);
        if (grant <= 0 || this.getEffectiveXpLifetime(char) >= grant) {
            return false;
        }
        if (!char.stats) {
            this.applyCalculatedStarterGameplay(char);
        } else {
            this.applyCalculatedStarterEcon(char);
        }
        return true;
    },

    /**
     * Guard all Experience KVP stat writes — never push factory lines or pre-session defaults.
     */
    shouldWriteStatsToKvp(char, csv, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id || !csv) {
            if (!char || !char.id) {
                console.warn('[KVP] blocked stats write — no character id (save progress first)');
            } else if (!csv) {
                console.warn('[KVP] blocked stats write — empty CSV');
            }
            return false;
        }
        if (options.forceWrite || options.userInitiated) {
            return true;
        }
        if (this.state.statsPending) {
            return true;
        }
        const factory = this.csvIsStarterDefault(csv);
        if (factory) {
            if (!options.allowStarterSeed) {
                console.warn('[KVP] blocked factory stats write — not an allowed starter seed');
                return false;
            }
            if (!this.isInCreationFlow()) {
                console.warn('[KVP] blocked factory stats write outside creation flow');
                return false;
            }
            if (this.isCreationKvpSeeded(char.id) && !options.forceFirstSeed) {
                console.warn('[KVP] blocked factory stats re-seed for', char.id);
                return false;
            }
            return true;
        }
        if (this.hasEditedGameplay(char, csv)) {
            return true;
        }
        console.warn('[KVP] blocked stats write — no pending edits and line is not a creation starter seed');
        return false;
    },

    syncStarterEconToMoapUrl(char) {
        if (!char) {
            return;
        }
        try {
            const url = new URL(window.location.href);
            const grant = char.xp_lifetime || this.getStartingXpGrant(char.species_id || 'human');
            url.searchParams.set('xp_lifetime', String(grant));
            url.searchParams.set('xp_spent', '0');
            url.searchParams.set('ap_balance', '0');
            this.safeHistoryReplaceState(url.toString());
        } catch (e) { /* ignore */ }
        if (typeof window.updateEconUrlParams === 'function') {
            window.updateEconUrlParams(0, 0);
        }
    },

    /**
     * After species is confirmed in creation: stats all 1s, starter XP, 0 spent/AP (local only).
     */
    applySpeciesConfirmedStarter(char) {
        if (!char || !char.species_id) {
            return false;
        }
        this.applyCalculatedStarterGameplay(char);
        this.state.statsPending = false;
        this.syncStarterEconToMoapUrl(char);
        this.captureStatsFloor(char);
        this.updateSaveStatsButton();
        return true;
    },

    /**
     * New-character gameplay from JS only — stats all 1s, XP from species lookup, 0 spent/AP.
     * Used for unsaved drafts and as the payload written to KVP on Save Progress.
     */
    applyCalculatedStarterGameplay(char) {
        if (!char) {
            return false;
        }
        const speciesId = char.species_id || 'human';
        const grant = this.getStartingXpGrant(speciesId);
        char.stats = Object.assign({}, this.getNewCharacterStats());
        char.xp_lifetime = grant > 0 ? grant : 0;
        char.xp_spent = 0;
        char.ap_balance = 0;
        char.xp_available = char.xp_lifetime;
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = char.xp_lifetime;
        App.state.econ.xp_spent = 0;
        App.state.econ.ap_balance = 0;
        App.state.econSessionActive = true;
        if (this.state.pendingChanges) {
            this.state.pendingChanges.stats = Object.assign({}, char.stats);
        }
        return true;
    },

    /**
     * Stats tab during creation: unsaved draft = values from species confirm; saved draft = pull KVP.
     */
    async prepareCreationStatsTab() {
        const char = this.state.character;
        if (!char) {
            return false;
        }
        if (!char.id) {
            if (char.species_id && !this.hasCreationGameplayReady(char)) {
                this.applySpeciesConfirmedStarter(char);
            }
            this.refreshStatsTabFromCharacter();
            if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                const ready = this.hasCreationGameplayReady(char);
                UI.setStatsHudBanner(
                    ready
                        ? 'Starter values from species — Continue when ready. Nothing is saved until Finish.'
                        : 'Select and confirm a species to receive starting XP and stats.',
                    ready ? 'info' : 'warning'
                );
            }
            return true;
        }
        this.ensureCreationEconReady(char);
        if (this.isBridgeHudMode()) {
            const loaded = await this.refreshHudGameplayFromMoap({
                showModal: false,
                forceRefresh: false,
                kvpAuthoritative: true,
                maxAttempts: 12
            });
            if (!loaded) {
                this.refreshStatsTabFromCharacter();
                if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                    UI.setStatsHudBanner(
                        'Could not confirm HUD KVP — values shown are from your last save in this session.',
                        'warning'
                    );
                }
            }
            return loaded;
        }
        this.refreshStatsTabFromCharacter();
        return true;
    },

    /** Recalculate starter XP from species only (preserve current stats). */
    applyCalculatedStarterEcon(char) {
        if (!char) {
            return false;
        }
        const grant = this.getStartingXpGrant(char.species_id || 'human');
        char.xp_lifetime = grant > 0 ? grant : 0;
        char.xp_spent = 0;
        char.ap_balance = 0;
        char.xp_available = char.xp_lifetime;
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = char.xp_lifetime;
        App.state.econ.xp_spent = 0;
        App.state.econ.ap_balance = 0;
        App.state.econSessionActive = true;
        return true;
    },

    /**
     * First-time creation KVP write — uses current char stats/XP (never hard-resets spent/AP).
     */
    async pushCreationStarterToKvp(char, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id || !this.isInCreationFlow()) {
            return false;
        }
        if (!char.stats && !options.statsCsv) {
            this.applyCalculatedStarterGameplay(char);
        } else if (!char.xp_lifetime || char.xp_lifetime <= 0) {
            this.applyCalculatedStarterEcon(char);
        }
        const spent = window.getEconSpent(char);
        const ap = window.getApBalance(char);
        const grant = char.xp_lifetime || this.getStartingXpGrant(char.species_id || 'human');
        if (!this.isBridgeHudMode()) {
            await this.pushCharacterToPlayersHUD(char.id);
            this.grantStartingXpToHud(char, { forceStarter: true, forceNavigate: true });
            this.markCreationKvpSeeded(char.id);
            return true;
        }
        try {
            await F4BridgeHud.waitForBridgeReady(12000);
        } catch (bridgeErr) {
            console.error('[KVP starter] bridge not ready:', bridgeErr);
            return false;
        }
        await this.ensureHudSlotForWrites(char.id, { force: !!options.forceSlotSync });
        const csv = options.statsCsv || this.statsCsvFromChar(char);
        if (!this.shouldWriteStatsToKvp(char, csv, {
            allowStarterSeed: true,
            forceFirstSeed: true
        })) {
            return false;
        }
        const statsRes = await F4Bridge.saveStats(csv, char.id, { allowStarter: true });
        if (!statsRes || !statsRes.ok) {
            console.warn('[KVP starter] save_stats failed:', statsRes);
            return false;
        }
        const econRes = await F4Bridge.saveEcon(spent, ap, char.id, grant, { allowSeed: true });
        if (!econRes || !econRes.ok) {
            console.warn('[KVP starter] save_econ failed:', econRes);
            return false;
        }
        this._lastStatsCsvSynced = csv;
        this._bridgeSessionApplied = true;
        this._lastBridgeSession = {
            ok: true,
            characterId: char.id,
            stats_csv: csv,
            xp_lifetime: String(grant),
            xp_spent: String(spent),
            ap_balance: String(ap),
            format: 'v4'
        };
        this.markCreationKvpSeeded(char.id);
        console.log('[KVP starter] wrote starter line for', char.id,
            'xp=' + grant, 'spent=' + spent, 'ap=' + ap);
        return true;
    },

    /**
     * Push pending_starting_xp into HUD LSD and refresh KVP so f4state_* gets the grant.
     * Never reduces existing lifetime XP (Character State applyPendingStartingXp enforces that).
     * @param {object} character
     * @param {{ forceNavigate?: boolean, forceStarter?: boolean }} options
     */
    grantStartingXpToHud(character, options) {
        if (options === undefined) {
            options = {};
        }
        if (!character || !character.id) {
            return;
        }
        if (this.isBridgeHudMode()) {
            return;
        }
        // Always keep new-economy characters at 0 AP until they Buy AP with XP.
        if (character.ap_balance == null || character.ap_balance === '') {
            character.ap_balance = 0;
        }
        const grant = this.getStartingXpGrant(character.species_id || 'human');
        if (grant <= 0) {
            return;
        }
        const current = Math.max(0, parseInt(character.xp_lifetime, 10) || 0);
        const forceStarter = !!options.forceStarter;
        if (!forceStarter) {
            return;
        }
        if (current > grant) {
            console.warn('[XP] Starter grant', grant, 'replacing session value', current);
        }
        character.xp_lifetime = grant;
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        App.state.econ.xp_lifetime = grant;
        if (App.state.econ.ap_balance == null) {
            App.state.econ.ap_balance = Math.max(0, parseInt(character.ap_balance, 10) || 0);
        }
        App.state.econSessionActive = true;
        if (options.forceNavigate && !this.isBridgeHudMode()) {
            try {
                const currentUrl = new URL(window.location.href);
                const message = 'SET_PENDING_STARTING_XP|amount:' + encodeURIComponent(String(grant))
                    + '|characterId:' + encodeURIComponent(String(character.id));
                currentUrl.searchParams.set('lsl_cmd', message);
                currentUrl.searchParams.set('lsl_cmd_ts', Date.now().toString());
                currentUrl.searchParams.set('xp_lifetime', String(grant));
                window.location.assign(currentUrl.toString());
                console.log('[XP] Seeded pending_starting_xp=' + grant + ' (navigate) for', character.id);
                return;
            } catch (e) {
                console.warn('[XP] location.assign failed for starting XP, falling back to sendToLSL', e);
            }
        }
        this.sendToLSL('SET_PENDING_STARTING_XP', {
            amount: String(grant),
            characterId: character.id
        });
        console.log('[XP] Seeded pending_starting_xp=' + grant + ' for', character.id);
    },

    /**
     * 20-stat CSV for Players HUD LSD (same order as LSL stat indices).
     */
    statsCsvFromChar(char) {
        if (!char) {
            return '';
        }
        let stats = char.stats;
        if (this.state.pendingChanges && this.state.pendingChanges.stats) {
            stats = Object.assign({}, stats || {}, this.state.pendingChanges.stats);
        }
        if (!stats) {
            return '';
        }
        const statNames = this.getStatNamesOrdered();
        return statNames.map(function (s, idx) {
            if (stats[s] != null) {
                return stats[s];
            }
            const numKey = String(idx);
            if (stats[numKey] != null) {
                return stats[numKey];
            }
            return 1;
        }).join(',');
    },

    getStatNamesOrdered() {
        return [
            'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
            'deception', 'endurance', 'entertaining', 'fighting', 'healing',
            'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
            'stealth', 'survival', 'thievery', 'will', 'wisdom'
        ];
    },

    isBridgeHudMode() {
        return typeof F4BridgeHud !== 'undefined' && F4BridgeHud.isEnabled();
    },

    snapshotGameplayFromCharacter(char) {
        if (!char) {
            return null;
        }
        const stats = char.stats ? Object.assign({}, char.stats) : null;
        const pendingStats = this.state.pendingChanges && this.state.pendingChanges.stats
            ? Object.assign({}, this.state.pendingChanges.stats)
            : null;
        return {
            stats: stats,
            pendingStats: pendingStats,
            statsCsv: this.statsCsvFromChar(char) || this._lastStatsCsvSynced || '',
            ap: window.getApBalance(char),
            spent: window.getEconSpent(char),
            life: window.getEconLifetime(char)
        };
    },

    restoreGameplayToCharacter(char, snapshot) {
        if (!char || !snapshot) {
            return;
        }
        let stats = snapshot.stats;
        if (snapshot.statsCsv && this.statsObjectFromCsv(snapshot.statsCsv)) {
            stats = this.statsObjectFromCsv(snapshot.statsCsv);
        } else if (snapshot.pendingStats) {
            stats = Object.assign({}, snapshot.pendingStats);
        }
        if (stats) {
            char.stats = Object.assign({}, stats);
            if (this.state.pendingChanges) {
                this.state.pendingChanges.stats = Object.assign({}, stats);
            }
        }
        if (snapshot.life != null) {
            char.xp_lifetime = snapshot.life;
        }
        if (snapshot.spent != null) {
            char.xp_spent = snapshot.spent;
        }
        if (snapshot.ap != null) {
            char.ap_balance = snapshot.ap;
        }
        if (snapshot.statsCsv) {
            this._lastStatsCsvSynced = snapshot.statsCsv;
        }
    },

    characterHasAuthoritativeGameplay(char) {
        if (!char) {
            return false;
        }
        const csv = this.statsCsvFromChar(char);
        if (csv && !this.csvIsStarterDefault(csv)) {
            return true;
        }
        const life = typeof window.getEconLifetime === 'function' ? window.getEconLifetime(char) : 0;
        const spent = typeof window.getEconSpent === 'function' ? window.getEconSpent(char) : 0;
        const ap = typeof window.getApBalance === 'function' ? window.getApBalance(char) : 0;
        return life > 0 || spent > 0 || ap > 0;
    },

    shouldDeferStatsDisplay(characterId) {
        if (!this.isBridgeHudMode()) {
            return false;
        }
        const cid = characterId || this.state.character?.id;
        if (!cid) {
            return false;
        }
        if (this.bridgeHasAuthoritativeHudData(cid)) {
            return false;
        }
        if (this._lastStatsCsvSynced && this.statsObjectFromCsv(this._lastStatsCsvSynced)
            && !this.csvIsStarterDefault(this._lastStatsCsvSynced)) {
            return false;
        }
        const char = this.state.character;
        const csv = char ? this.statsCsvFromChar(char) : '';
        if (csv && !this.csvIsStarterDefault(csv)) {
            return false;
        }
        if (this.isMoapStatsTabActive()) {
            return true;
        }
        return this.isAwaitingHudKvpUrl(cid);
    },

    bridgeSessionDebugSummary(session) {
        if (!session) {
            return 'session missing';
        }
        if (session.pending) {
            return 'PENDING|' + (session.error || 'stats');
        }
        if (!session.ok) {
            return session.error ? String(session.error) : 'session missing';
        }
        const csv = session.stats_csv || (session.stats && session.stats.csv) || '';
        const firstStat = csv ? csv.split(',')[0] : '';
        return 'fmt=' + (session.format || '?')
            + ' char=' + (session.characterId || '?')
            + ' name=' + (session.name || '(none)')
            + ' csvLen=' + csv.length
            + ' stat0=' + firstStat
            + ' xp=' + (session.xp_lifetime != null ? session.xp_lifetime : '?')
            + ' spent=' + (session.xp_spent != null ? session.xp_spent : '?')
            + ' ap=' + (session.ap_balance != null ? session.ap_balance : '?');
    },

    logHudCharacterPull(session, char, label) {
        const tag = label || 'HUD pull';
        const summary = this.bridgeSessionDebugSummary(session);
        console.log('[F4 Bridge] ' + tag + ': ' + summary);
        if (typeof window.simpleDebug === 'function') {
            window.simpleDebug('[F4 Bridge] ' + tag + ': ' + summary, 'info');
        }
        if (char && char.stats) {
            const keys = Object.keys(char.stats);
            const sample = keys.length ? (keys[0] + '=' + char.stats[keys[0]]) : 'no stats';
            console.log('[F4 Bridge] ' + tag + ' applied stats sample: ' + sample);
        }
    },

    csvIsFactoryOnes(csv) {
        if (!csv || typeof csv !== 'string') {
            return false;
        }
        const parts = csv.split(',');
        if (parts.length !== 20) {
            return false;
        }
        let idx;
        for (idx = 0; idx < parts.length; idx++) {
            if (parseInt(parts[idx], 10) !== 1) {
                return false;
            }
        }
        return true;
    },

    bridgeSessionEconReady(session) {
        if (!session || !session.ok) {
            return false;
        }
        const life = parseInt(session.xp_lifetime, 10) || 0;
        return life > 0;
    },

    bridgeSessionStatsReady(session) {
        if (!session || !session.ok) {
            return false;
        }
        const csv = session.stats_csv || (session.stats && session.stats.csv) || '';
        if (!csv || csv.split(',').length !== 20 || !this.statsObjectFromCsv(csv)) {
            return false;
        }
        const spent = parseInt(session.xp_spent, 10) || 0;
        if (spent > 0 && this.csvIsFactoryOnes(csv)) {
            return false;
        }
        return true;
    },

    bridgeSessionMissingStats(session) {
        if (!session || !session.ok) {
            return false;
        }
        const csv = session.stats_csv || '';
        return !csv || csv.split(',').length !== 20 || !this.statsObjectFromCsv(csv);
    },

    /**
     * Phase D: when bridge returns PENDING|stats, apply MOAP memory / last sync instead of endless polls.
     */
    applyCachedGameplayWhenPending(char, characterId) {
        if (!char || !characterId || char.id !== characterId) {
            return false;
        }
        if (this.restoreMoapSessionDraft()) {
            console.log('[F4 Bridge] applied MOAP session draft while KVP stats pending');
            return true;
        }
        if (this._lastStatsCsvSynced && this.statsObjectFromCsv(this._lastStatsCsvSynced)) {
            char.stats = this.statsObjectFromCsv(this._lastStatsCsvSynced);
            if (this.state.pendingChanges) {
                this.state.pendingChanges.stats = Object.assign({}, char.stats);
            }
            console.log('[F4 Bridge] applied _lastStatsCsvSynced while KVP stats pending');
            return true;
        }
        if (this._lastBridgeSession && this._lastBridgeSession.ok
            && (this._lastBridgeSession.characterId || '') === characterId) {
            this.applyBridgeSessionToCharacter(char, this._lastBridgeSession);
            console.log('[F4 Bridge] applied cached bridge session while KVP stats pending');
            return true;
        }
        if (this.hasCreationGameplayReady(char) || this.hasEditedGameplay(char)) {
            console.log('[F4 Bridge] using in-memory creation gameplay while KVP stats pending');
            return true;
        }
        return false;
    },

    bridgeHasAuthoritativeHudData(characterId) {
        if (!this._bridgeSessionApplied || !this._lastBridgeSession) {
            return false;
        }
        const sid = this._lastBridgeSession.characterId || '';
        const cid = characterId || this.state.character?.id || '';
        if (sid && cid && sid !== cid) {
            return false;
        }
        return this.bridgeSessionStatsReady(this._lastBridgeSession);
    },

    bridgeSessionHasGameplay(session) {
        return this.bridgeSessionStatsReady(session);
    },

    applyBridgeSessionToCharacter(char, session) {
        if (!char || !session || !session.ok) {
            return false;
        }
        if (session.characterId && char.id && session.characterId !== char.id) {
            console.warn('[F4 Bridge] ignoring session — HUD slot', session.characterId,
                '≠ Firestore character', char.id);
            return false;
        }
        const inCreation = this.isInCreationFlow();
        if (session.name && (!inCreation || !char.name || !String(char.name).trim())) {
            char.name = session.name;
        }
        if (session.title != null && session.title !== ''
            && (!inCreation || char.title == null || char.title === '')) {
            char.title = session.title;
        }
        if (session.gender && (!inCreation || !char.gender)) {
            char.gender = session.gender;
        }
        if (session.species_id && (!inCreation || !char.species_id)) {
            char.species_id = session.species_id;
        }
        const csv = session.stats_csv || (session.stats && session.stats.csv) || '';
        const spent = parseInt(session.xp_spent, 10) || 0;
        const localSpent = window.getEconSpent(char);
        const localEdited = this.hasEditedGameplay(char) || this.state.statsPending || !!this._lastStatsCsvSynced;
        if (localEdited && spent < localSpent) {
            console.warn('[F4 Bridge] ignoring stale KVP session — local spent', localSpent, '> session', spent);
            return false;
        }
        if (localEdited && spent === 0 && csv && this.csvIsFactoryOnes(csv)) {
            console.warn('[F4 Bridge] ignoring stale factory KVP session — local gameplay edits in memory');
            return false;
        }
        if (csv && this.statsObjectFromCsv(csv)) {
            const staleFactory = spent > 0 && this.csvIsFactoryOnes(csv);
            const factoryFromSession = this.csvIsFactoryOnes(csv) && spent === 0;
            const noLocalAuthority = !this._lastStatsCsvSynced
                && !this.urlHasAuthoritativeStats(char.id)
                && !this.state.statsPending;
            if (!staleFactory && !(factoryFromSession && noLocalAuthority && !inCreation)) {
                const stats = this.statsObjectFromCsv(csv);
                char.stats = stats;
                if (this.state.pendingChanges) {
                    this.state.pendingChanges.stats = Object.assign({}, stats);
                }
                if (!this.csvIsStarterDefault(csv)) {
                    this.markCreationKvpSeeded(char.id);
                }
            }
        }
        const life = parseInt(session.xp_lifetime, 10) || 0;
        const ap = parseInt(session.ap_balance, 10) || 0;
        if (typeof App.state.econ === 'undefined' || !App.state.econ) {
            App.state.econ = {};
        }
        char.xp_lifetime = life;
        char.xp_spent = spent;
        char.ap_balance = ap;
        char.xp_available = Math.max(0, life - spent);
        App.state.econ.xp_lifetime = life;
        App.state.econ.xp_spent = spent;
        App.state.econ.ap_balance = ap;
        App.state.econSessionActive = true;
        return true;
    },

    async ensureHudSlotForWrites(characterId, options) {
        if (options === undefined) {
            options = {};
        }
        if (!characterId || !this.isBridgeHudMode()) {
            return false;
        }
        if (!options.force && this._hudSlotSyncedCharId === characterId) {
            return true;
        }
        const ok = await this.ensureHudCharacterSlotSynced(characterId);
        if (ok) {
            this._hudSlotSyncedCharId = characterId;
        }
        return ok;
    },

    async ensureHudCharacterSlotSynced(characterId) {
        if (!characterId || !this.isBridgeHudMode()) {
            return false;
        }
        // Identity only — do NOT push stats/xp in LOAD_CHARACTER.
        // includeGameplay caused LSL to emit stats_loaded as if from EXP and
        // stacked with KVP pulls into MOAP reload / sync storms.
        const char = this.state.character;
        const payload = this.buildCharacterSyncPayload(characterId, char, { includeGameplay: false });
        const loadParts = Object.keys(payload).map(function (key) {
            return key + ':' + encodeURIComponent(String(payload[key]));
        });
        const loadCmd = 'LOAD_CHARACTER|' + loadParts.join('|');
        console.log('[F4 Bridge] syncing HUD LSD slot to', characterId);
        try {
            await this.sendToLSLViaBridge(loadCmd);
        } catch (syncErr) {
            console.warn('[F4 Bridge] LOAD_CHARACTER slot sync failed:', syncErr);
            return false;
        }
        await new Promise(function (resolve) { setTimeout(resolve, 2800); });
        return true;
    },

    async reconcileHudSlotIfNeeded(characterId, options) {
        if (options === undefined) {
            options = {};
        }
        if (!characterId || !this.isBridgeHudMode()) {
            return true;
        }
        try {
            await F4BridgeHud.waitForBridgeReady(options.bridgeTimeout || 10000);
            const session = await F4BridgeHud.fetchSession();
            const sid = session && session.characterId ? session.characterId : '';
            if (session && session.ok && sid === characterId) {
                this._hudSlotSyncedCharId = characterId;
                return true;
            }
            if (!options.force && this._hudSlotSyncedCharId === characterId) {
                return true;
            }
            console.warn('[F4 Bridge] HUD slot mismatch — wanted', characterId, 'HUD has', sid || '(none)');
            const synced = await this.ensureHudCharacterSlotSynced(characterId);
            if (synced) {
                this._hudSlotSyncedCharId = characterId;
                this.syncActiveCharToUrl(characterId);
            }
            return synced;
        } catch (reconcileErr) {
            console.warn('[F4 Bridge] reconcileHudSlotIfNeeded failed:', reconcileErr);
            return false;
        }
    },

    async refreshHudGameplayFromMoap(options) {
        const cid = this.state.character && this.state.character.id;
        if (!cid || !this.isBridgeHudMode()) {
            return false;
        }
        if (options === undefined) {
            options = {};
        }
        const forceRefresh = options.forceRefresh === true;
        const inCreation = this.isInCreationFlow();

        if (!forceRefresh) {
            const quickLoaded = await this.ensureBridgeGameplayLoaded(cid, {
                showModal: false,
                forceRefresh: false,
                kvpAuthoritative: options.kvpAuthoritative === true,
                maxAttempts: options.maxAttempts || 6
            });
            this.refreshStatsTabFromCharacter();
            if (quickLoaded) {
                if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                    const partial = this._lastBridgeSession && this.bridgeSessionMissingStats(this._lastBridgeSession);
                    if (partial) {
                        UI.setStatsHudBanner(
                            'XP loaded from KVP — f4stats record missing. Raise stats and use Save Stats.',
                            'warning'
                        );
                    } else {
                        UI.setStatsHudBanner(null);
                    }
                }
                return true;
            }
            if (this.hasEditedGameplay(this.state.character) || this._lastStatsCsvSynced) {
                if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                    UI.setStatsHudBanner(
                        'Showing your saved values — tap Refresh from HUD to pull from Experience KVP.',
                        'info'
                    );
                }
                return true;
            }
            if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                UI.setStatsHudBanner(
                    'Could not load gameplay from KVP — try Save Stats or Refresh from HUD.',
                    'warning'
                );
            }
            return false;
        }

        const loaded = await this.ensureBridgeGameplayLoaded(cid, {
            showModal: options.showModal !== false,
            forceRefresh: forceRefresh,
            kvpAuthoritative: options.kvpAuthoritative === true,
            maxAttempts: options.maxAttempts || (forceRefresh ? 18 : (inCreation ? 12 : 10))
        });
        this.refreshStatsTabFromCharacter();
        if (loaded && typeof UI !== 'undefined' && UI.setStatsHudBanner) {
            UI.setStatsHudBanner(null);
            return true;
        }
        if (this.hasEditedGameplay(this.state.character) || this._lastStatsCsvSynced) {
            if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                UI.setStatsHudBanner(
                    'Showing your saved values — tap Refresh from HUD to pull from Experience KVP.',
                    'info'
                );
            }
            return true;
        }
        return false;
    },

    /**
     * Apply bridge/KVP gameplay to character state after hydration (stats/XP only — not identity templates).
     */
    async applyHudGameplayHydrationResult(bridgeHydrated, options) {
        if (options === undefined) {
            options = {};
        }
        const char = this.state.character;
        if (!char || !char.id) {
            return;
        }
        const characterSwitch = !!options.characterSwitch;
        const econSyncOnly = !!options.econSyncOnly;
        const inCreationSaved = this.isInCreationFlow() && !!char.id;
        let hadMoapDraft = false;
        if (!bridgeHydrated) {
            if (!inCreationSaved) {
                this.initEconFromUrl();
                this.mergePoolsFromUrl();
                hadMoapDraft = this.restoreMoapSessionDraft();
                this.mergeUrlEconIntoCharacter();
                this.mergeStatsFromUrlIntoCharacter();
            } else if (!char.id) {
                this.applyCalculatedStarterGameplay(char);
            }
        } else {
            hadMoapDraft = this.restoreMoapSessionDraft();
            this.shadowLogBridgeVsUrl();
        }
        const awaitingHudKvp = this.isAwaitingHudKvpUrl(char.id);
        if (!awaitingHudKvp) {
            this.normalizeCharacterStats(char);
        } else if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Waiting for HUD KVP data...', 'info', 5000);
        }
        if (!hadMoapDraft) {
            this.migrateLegacyEconIfNeeded();
        }
        if (!econSyncOnly && !window.hasHudEconInUrl()
            && window.reconcileStaleApBalance(char)) {
            window.updateEconUrlParams(
                window.getEconSpent(char),
                window.getApBalance(char)
            );
        }
        this.captureAbandonBaseline(char);
        this.resumeCreationFlowIfNeeded(char);
        if (!econSyncOnly) {
            this.state.statsPending = false;
            this.updateSaveStatsButton();
        }
        const skipHudStatsPush = (function () {
            try {
                const params = new URLSearchParams(window.location.search);
                if (params.get('econ_sync') === '1') {
                    return true;
                }
                if (params.get('request_data') === '1' && App.urlHasAuthoritativeStats(char.id)) {
                    return true;
                }
                return App.urlHasAuthoritativeStats(char.id);
            } catch (e) {
                return false;
            }
        })();
        const onStatsTab = this.isMoapStatsTabActive();
        if (!this.isBridgeHudMode()) {
            if (!onStatsTab && !skipHudStatsPush && !this.state.statsPending && !awaitingHudKvp) {
                await this.cacheHudStatsForPlayers(char, {
                    syncStats: !characterSwitch
                });
            } else if (!onStatsTab && !this.state.statsPending && !awaitingHudKvp) {
                if (characterSwitch || !bridgeHydrated) {
                    await this.pushCharacterToPlayersHUD(char.id);
                }
            }
        }
        if (bridgeHydrated || onStatsTab) {
            this.refreshStatsTabFromCharacter();
        }
    },

    /**
     * Blocking KVP hydrate — only when Stats tab or econ_sync reload needs gameplay immediately.
     */
    async hydrateHudGameplayFromBridge(characterId, options) {
        if (!characterId || !this.isBridgeHudMode()) {
            return false;
        }
        if (options.characterSwitch) {
            await this.ensureHudCharacterSlotSynced(characterId);
        }
        const inCreationSaved = this.isInCreationFlow() && !!characterId;
        const bridgeHydrated = await this.ensureBridgeGameplayLoaded(characterId, {
            showModal: false,
            forceRefresh: !!options.characterSwitch,
            kvpAuthoritative: !!inCreationSaved,
            maxAttempts: options.characterSwitch ? 20 : (inCreationSaved ? 15 : 12)
        });
        await this.applyHudGameplayHydrationResult(bridgeHydrated, options);
        return bridgeHydrated;
    },

    /**
     * Background KVP hydrate — identity galleries already rendered from Firestore templates.
     */
    scheduleHudGameplayHydration(characterId, options) {
        if (!characterId || !this.isBridgeHudMode()) {
            return;
        }
        if (this.isMoapStatsTabActive()) {
            return;
        }
        const gen = ++this._hudGameplayHydrationGen;
        const self = this;
        (async function () {
            try {
                const bridgeHydrated = await self.ensureBridgeGameplayLoaded(characterId, {
                    showModal: false,
                    forceRefresh: false,
                    maxAttempts: 3
                });
                if (gen !== self._hudGameplayHydrationGen) {
                    return;
                }
                if (!self.state.character || self.state.character.id !== characterId) {
                    return;
                }
                if (bridgeHydrated) {
                    self.shadowLogBridgeVsUrl();
                }
            } catch (hydrateErr) {
                console.warn('[HUD hydration] background failed:', hydrateErr);
            }
        })();
    },

    /**
     * Fetch HUD gameplay via bridge pipe-line session (one CSV string + econ ints).
     */
    async ensureBridgeGameplayLoaded(characterId, options) {
        if (!this.isBridgeHudMode() || !characterId) {
            return false;
        }
        if (options === undefined) {
            options = {};
        }
        this._bridgeGameplayLoadAttempted = true;
        const showModal = options.showModal === true;
        const forceRefresh = options.forceRefresh === true;
        const maxAttempts = options.maxAttempts || (forceRefresh ? 18 : (showModal ? 12 : 15));
        let hideLoading = null;
        const debugLog = (typeof window.simpleDebug === 'function') ? window.simpleDebug : null;
        if (forceRefresh) {
            this._bridgeSessionApplied = false;
            this._lastBridgeSession = null;
        }
        if (showModal && typeof MoapDialogs !== 'undefined' && MoapDialogs.showLoading) {
            hideLoading = MoapDialogs.showLoading(forceRefresh ? 'Refreshing from HUD...' : 'Loading stats from HUD...');
        }
        try {
            await F4BridgeHud.waitForBridgeReady(8000);
            if (forceRefresh) {
                if (this.isInCreationFlow() || forceRefresh) {
                    try {
                        await this.ensureHudCharacterSlotSynced(characterId);
                    } catch (slotErr) {
                        console.warn('[F4 Bridge] proactive slot sync failed:', slotErr);
                    }
                }
                const nowMs = Date.now();
                if (!this._lastRefreshGameplayMs || (nowMs - this._lastRefreshGameplayMs) > 4000) {
                    this._lastRefreshGameplayMs = nowMs;
                    try {
                        await this.sendToLSLViaBridge('REFRESH_GAMEPLAY');
                    } catch (refreshErr) {
                        console.warn('[F4 Bridge] REFRESH_GAMEPLAY failed:', refreshErr);
                    }
                }
            }
            const preDelay = forceRefresh ? 2200 : 400;
            await new Promise(function (resolve) { setTimeout(resolve, preDelay); });
            let attempt = 0;
            let lastSession = null;
            let slotSyncSent = false;
            let pendingStreak = 0;
            const pendingGiveUp = options.pendingGiveUp || (forceRefresh ? 12 : 3);
            while (attempt < maxAttempts) {
                attempt += 1;
                try {
                    let session = await F4BridgeHud.fetchSession();
                    lastSession = session;
                    const char = this.state.character;
                    const summary = this.bridgeSessionDebugSummary(session);
                    if (debugLog) {
                        debugLog('[F4 Bridge] session ' + attempt + ': ' + summary, 'debug');
                    }
                    if (!session || !session.ok || !char) {
                        if (session && session.pending && !forceRefresh) {
                            pendingStreak += 1;
                            if (pendingStreak >= pendingGiveUp) {
                                if (this.applyCachedGameplayWhenPending(char, characterId)) {
                                    this.refreshStatsTabFromCharacter();
                                    if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                                        UI.setStatsHudBanner(
                                            'Using saved session values — Experience stats still loading or missing (f4stats).',
                                            'info'
                                        );
                                    }
                                    return true;
                                }
                            }
                        } else {
                            pendingStreak = 0;
                        }
                        await new Promise(function (resolve) { setTimeout(resolve, 400); });
                        continue;
                    }
                    pendingStreak = 0;
                    const sid = session.characterId || '';
                    if (sid && sid !== characterId) {
                        if (!slotSyncSent && (forceRefresh || this.isInCreationFlow())) {
                            slotSyncSent = true;
                            if (debugLog) {
                                debugLog('[F4 Bridge] HUD slot is ' + sid + ' wanted ' + characterId + ' — LOAD_CHARACTER', 'warn');
                            }
                            console.warn('[F4 Bridge] HUD slot mismatch — syncing', sid, '→', characterId);
                            await this.ensureHudCharacterSlotSynced(characterId);
                            this._hudSlotSyncedCharId = characterId;
                            this.syncActiveCharToUrl(characterId);
                            try {
                                await this.sendToLSLViaBridge('REFRESH_GAMEPLAY');
                            } catch (refreshErr2) {
                                console.warn('[F4 Bridge] REFRESH_GAMEPLAY after slot sync failed:', refreshErr2);
                            }
                            await new Promise(function (resolve) {
                                setTimeout(resolve, forceRefresh ? 2200 : 1800);
                            });
                            await new Promise(function (resolve) { setTimeout(resolve, 400); });
                            continue;
                        }
                        if (!forceRefresh) {
                            if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                                UI.setStatsHudBanner(
                                    'HUD is on a different character — switch in the roster or use Refresh from HUD.',
                                    'warning'
                                );
                            }
                            if (this.hasEditedGameplay(char) || this._lastStatsCsvSynced) {
                                this.refreshStatsTabFromCharacter();
                                return true;
                            }
                            return false;
                        }
                        await new Promise(function (resolve) { setTimeout(resolve, 400); });
                        continue;
                    }
                    this.applyBridgeSessionToCharacter(char, session);
                    if (this.bridgeSessionStatsReady(session)) {
                        const csv = session.stats_csv || '';
                        this._bridgeSessionApplied = true;
                        this._lastBridgeSession = session;
                        if (csv) {
                            this._lastStatsCsvSynced = csv;
                        }
                        if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                            UI.setStatsHudBanner(null);
                        }
                        this.logHudCharacterPull(session, char, 'hydrated');
                        console.log('[F4 Bridge] gameplay loaded: ' + summary);
                        return true;
                    }
                    if (this.bridgeSessionEconReady(session)) {
                        this._lastBridgeSession = session;
                        if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                            UI.setStatsHudBanner(
                                'XP loaded from KVP — waiting for stat line (f4stats)...',
                                'info'
                            );
                        }
                    }
                    if (debugLog) {
                        debugLog('[F4 Bridge] waiting for stats csv (attempt ' + attempt + ')', 'debug');
                    }
                } catch (err) {
                    console.warn('[F4 Bridge] session fetch failed:', err);
                }
                if (attempt < maxAttempts) {
                    await new Promise(function (resolve) { setTimeout(resolve, 400); });
                }
            }
            if (lastSession) {
                this.logHudCharacterPull(lastSession, this.state.character, 'timeout');
            }
            console.warn('[F4 Bridge] no HUD gameplay in session for', characterId, lastSession);
            if (forceRefresh) {
            if (!this._kvpRepairByChar) {
                this._kvpRepairByChar = {};
            }
            if (!this._kvpRepairByChar[characterId]) {
                this._kvpRepairByChar[characterId] = true;
                const repairChar = this.state.character;
                if (repairChar && repairChar.id === characterId && this.hasEditedGameplay(repairChar)) {
                    console.log('[F4 Bridge] KVP repair using local edited gameplay for', characterId);
                    const repaired = await this.seedHudKvpGameplay(repairChar, {
                        statsCsv: this.statsCsvFromChar(repairChar),
                        allowStarterSeed: false,
                        silent: true,
                        syncEcon: true
                    });
                    if (repaired) {
                        try {
                            await this.sendToLSLViaBridge('REFRESH_GAMEPLAY');
                        } catch (repairRefreshErr) {
                            console.warn('[F4 Bridge] REFRESH_GAMEPLAY after KVP repair failed:', repairRefreshErr);
                        }
                        await new Promise(function (resolve) { setTimeout(resolve, 1800); });
                        let repairAttempt = 0;
                        while (repairAttempt < 8) {
                            repairAttempt += 1;
                            try {
                                const repairedSession = await F4BridgeHud.fetchSession();
                                if (repairedSession && repairedSession.ok
                                    && this.bridgeSessionStatsReady(repairedSession)) {
                                    this.applyBridgeSessionToCharacter(repairChar, repairedSession);
                                    this._bridgeSessionApplied = true;
                                    this._lastBridgeSession = repairedSession;
                                    const repairCsv = repairedSession.stats_csv || '';
                                    if (repairCsv) {
                                        this._lastStatsCsvSynced = repairCsv;
                                    }
                                    console.log('[F4 Bridge] KVP repair succeeded for', characterId);
                                    return true;
                                }
                            } catch (repairFetchErr) {
                                console.warn('[F4 Bridge] session fetch after KVP repair failed:', repairFetchErr);
                            }
                            if (repairAttempt < 8) {
                                await new Promise(function (resolve) { setTimeout(resolve, 500); });
                            }
                        }
                    }
                }
            }
            }
            const fallbackChar = this.state.character;
            if (options.allowLocalFallback && fallbackChar && fallbackChar.id === characterId) {
                if (!fallbackChar.stats) {
                    fallbackChar.stats = Object.assign({}, this.getNewCharacterStats());
                }
                this.refreshStatsTabFromCharacter();
                if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                    UI.setStatsHudBanner('Using local starter stats — HUD sync still in progress.', 'info');
                }
                return true;
            }
            return false;
        } finally {
            if (hideLoading) {
                hideLoading();
            }
        }
    },

    refreshStatsTabFromCharacter() {
        const char = this.state.character;
        if (!char) {
            return;
        }
        if (this.isBridgeHudMode() && this.shouldDeferStatsDisplay(char.id)) {
            if (typeof UI !== 'undefined' && UI.setStatsHudBanner) {
                UI.setStatsHudBanner('Loading stats from Experience KVP...', 'info');
            }
            if (typeof UI !== 'undefined' && UI.renderEconDisplay) {
                UI.renderEconDisplay(char);
            }
            this.updateSaveStatsButton();
            this.updateStatusIndicator();
            return;
        }
        this.normalizeCharacterStats(char);
        if (typeof window.reconcileStaleApBalance === 'function') {
            window.reconcileStaleApBalance(char);
        }
        const stats = char.stats || this.getDefaultStats();
        const caps = this.calculateStatCaps();
        const ap = window.getApBalance(char);
        if (typeof UI !== 'undefined' && UI.renderEconDisplay) {
            UI.renderEconDisplay(char);
        }
        if (typeof UI !== 'undefined' && UI.renderStatsGrid) {
            UI.renderStatsGrid(stats, caps, ap, this.state.statsFloor || {});
        }
        this.updateSaveStatsButton();
        this.updateStatusIndicator();
    },

    shadowLogBridgeVsUrl() {
        if (!this._lastBridgeSession) {
            return;
        }
        const session = this._lastBridgeSession;
        let params;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (e) {
            return;
        }
        const diffs = [];
        const pushDiff = function (field, urlVal, bridgeVal) {
            if (urlVal !== '' && bridgeVal !== '' && String(urlVal) !== String(bridgeVal)) {
                diffs.push({ field: field, url: urlVal, bridge: bridgeVal });
            } else if (urlVal === '' && bridgeVal !== '') {
                diffs.push({ field: field, url: '(missing)', bridge: bridgeVal });
            }
        };
        pushDiff('stats_csv', params.get('stats_csv') || '', session.stats_csv || (session.stats && session.stats.csv) || '');
        pushDiff('xp_spent', params.get('xp_spent') || '', session.xp_spent != null ? session.xp_spent : (session.econ && session.econ.xp_spent));
        pushDiff('ap_balance', params.get('ap_balance') || '', session.ap_balance != null ? session.ap_balance : (session.econ && session.econ.ap_balance));
        pushDiff('health_pipe', params.get('health_pipe') || '', session.pools && session.pools.health);
        const shortUrlMode = params.get('f4_bridge') === '1' && !params.get('stats_csv');
        if (diffs.length) {
            if (shortUrlMode && diffs.every(function (d) { return d.url === '(missing)'; })) {
                console.log('[F4 Bridge] short URL mode — bridge session authoritative (' + diffs.length + ' fields not duplicated in URL)');
            } else {
                console.log('[F4 Bridge Shadow] URL vs bridge differences:', diffs);
            }
        } else {
            console.log('[F4 Bridge Shadow] URL and bridge agree');
        }
    },

    async saveStatsToHudViaBridge(char, savedSpent, savedAp, csv) {
        await F4BridgeHud.waitForBridgeReady(12000);
        if (!char || !char.id) {
            throw new Error('stats_write_no_character_id');
        }
        if (!csv) {
            throw new Error('stats_write_empty_csv');
        }
        if (!this.shouldWriteStatsToKvp(char, csv, { userInitiated: true })) {
            console.warn('[Save Stats] blocked by shouldWriteStatsToKvp', {
                charId: char && char.id,
                csvLen: csv ? csv.length : 0,
                statsPending: this.state.statsPending
            });
            throw new Error('stats_write_blocked');
        }
        await this.reconcileHudSlotIfNeeded(char.id, { force: true });
        // Creation / first seed must pass allow_starter — bleed guards reject unresolved writes.
        const allowStarter = this.isInCreationFlow() || !this.isCreationKvpSeeded(char.id);
        const statsRes = await F4Bridge.saveStats(csv, char && char.id ? char.id : undefined, {
            allowStarter: allowStarter
        });
        if (!statsRes || !statsRes.ok) {
            const errCode = (statsRes && statsRes.error) ? String(statsRes.error) : 'save_stats_failed';
            throw new Error(errCode);
        }
        this._lastStatsCsvSynced = csv;
        if (char && char.id) {
            this._hudSlotSyncedCharId = char.id;
            this.markCreationKvpSeeded(char.id);
        }
        let econWarning = '';
        try {
            const lifeArg = this.getEffectiveXpLifetime(char);
            const econRes = await F4Bridge.saveEcon(
                savedSpent,
                savedAp,
                char && char.id ? char.id : undefined,
                lifeArg > 0 ? lifeArg : undefined,
                { allowSeed: allowStarter }
            );
            if (!econRes || !econRes.ok) {
                econWarning = (econRes && econRes.error) ? String(econRes.error) : 'save_econ_failed';
                console.warn('[Save Stats] save_econ after stats:', econWarning);
                // Never leave raised stats with unspent XP — treat as hard failure.
                if (savedSpent > 0 || allowStarter) {
                    throw new Error('stats_saved_but_xp_spend_failed:' + econWarning);
                }
            }
        } catch (econErr) {
            const msg = econErr && econErr.message ? String(econErr.message) : 'save_econ_failed';
            if (msg.indexOf('stats_saved_but_xp_spend_failed:') === 0) {
                throw econErr;
            }
            econWarning = msg;
            console.warn('[Save Stats] save_econ error after stats saved:', econWarning);
            if (savedSpent > 0 || allowStarter) {
                throw new Error('stats_saved_but_xp_spend_failed:' + econWarning);
            }
        }
        if (this._lastBridgeSession) {
            this._lastBridgeSession.stats_csv = csv;
            this._lastBridgeSession.xp_spent = String(savedSpent);
            this._lastBridgeSession.ap_balance = String(savedAp);
            if (char.xp_lifetime != null) {
                this._lastBridgeSession.xp_lifetime = String(this.getEffectiveXpLifetime(char));
            }
            this._bridgeSessionApplied = true;
        }
        this.clearStatsPendingAfterHudSave();
        if (econWarning && typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Stats saved — XP/AP sync may still be finishing (' + econWarning + ')', 'warning', 4000);
        } else {
            UI.showToast('Stats saved to Experience (HUD)', 'success', 2000);
        }
        return true;
    },

    /**
     * Write f4stats_* (+ optional econ) to Experience KVP via bridge.
     * New characters need allowStarterSeed so the factory all-1s/2s line is still persisted.
     */
    async seedHudKvpGameplay(char, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id) {
            return false;
        }
        if (!this.isBridgeHudMode()) {
            if (!options.silent) {
                console.warn('[KVP seed] bridge mode not active — stats stay in Firestore only');
            }
            return false;
        }
        try {
            await F4BridgeHud.waitForBridgeReady(options.bridgeTimeout || 12000);
        } catch (bridgeErr) {
            console.error('[KVP seed] bridge not ready:', bridgeErr);
            if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('HUD bridge not ready — reattach and reopen Setup', 'error');
            }
            return false;
        }
        if (options.syncSlot === true) {
            await this.ensureHudSlotForWrites(char.id, { force: !!options.forceSlotSync });
        }
        const csv = options.statsCsv || this.statsCsvFromChar(char);
        if (!csv || csv.split(',').length !== 20) {
            if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Could not build stats for HUD storage', 'error');
            }
            return false;
        }
        const allowStarter = !!options.allowStarterSeed;
        const forceWrite = !!options.forceWrite;
        const nonFactory = !this.csvIsStarterDefault(csv);
        if (!nonFactory && !allowStarter && !forceWrite) {
            return false;
        }
        if (!this.shouldWriteStatsToKvp(char, csv, {
            allowStarterSeed: allowStarter,
            forceWrite: forceWrite,
            forceFirstSeed: forceWrite
        })) {
            return false;
        }
        try {
            const statsRes = await F4Bridge.saveStats(csv, char.id, {
                allowStarter: allowStarter || forceWrite
            });
            if (!statsRes || !statsRes.ok) {
                console.warn('[KVP seed] save_stats failed:', statsRes);
                if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast('Could not save stats to HUD storage (KVP)', 'error');
                }
                return false;
            }
            if (options.syncEcon !== false) {
                const lifeArg = options.xpLifetime != null ? options.xpLifetime : char.xp_lifetime;
                const econRes = await F4Bridge.saveEcon(
                    window.getEconSpent(char),
                    window.getApBalance(char),
                    char.id,
                    lifeArg,
                    {
                        allowSeed: allowStarter || forceWrite || !!options.allowSeed
                    }
                );
                if (!econRes || !econRes.ok) {
                    console.warn('[KVP seed] save_econ failed:', econRes);
                    if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                        UI.showToast('Stats saved but XP/AP did not persist — try Save Stats again', 'warning');
                    }
                    return false;
                }
            }
            await new Promise(function (resolve) { setTimeout(resolve, options.kvpSettleMs || 800); });
            this._lastStatsCsvSynced = csv;
            if (this._lastBridgeSession) {
                this._lastBridgeSession.stats_csv = csv;
            }
            if (char.id) {
                this.markCreationKvpSeeded(char.id);
            }
            console.log('[KVP seed] f4stats written for', char.id,
                nonFactory ? '(edited line)' : '(initial factory line)');
            if (options.showSuccess && typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Gameplay saved to HUD', 'success', 2000);
            }
            return true;
        } catch (err) {
            console.error('[KVP seed] bridge write failed:', err);
            if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Failed to save gameplay to HUD', 'error');
            }
            return false;
        }
    },

    async sendToLSLViaBridge(message) {
        const res = await F4Bridge.sendCommand(message);
        if (!res || !res.ok) {
            console.error('[F4 Bridge] command failed:', res);
            return false;
        }
        console.log('[F4 Bridge] command ok:', message.substring(0, 48));
        return true;
    },

    statsObjectFromCsv(csv) {
        if (!csv || typeof csv !== 'string') {
            return null;
        }
        const parts = csv.split(',');
        if (parts.length !== 20) {
            return null;
        }
        const statNames = this.getStatNamesOrdered();
        const stats = {};
        let idx;
        for (idx = 0; idx < statNames.length; idx++) {
            const val = parseInt(parts[idx], 10);
            stats[statNames[idx]] = (!isNaN(val) && val >= 0) ? val : 1;
        }
        return stats;
    },

    /**
     * Ensure character.stats uses named keys from HUD/KVP session (stats_csv / MOAP draft).
     */
    normalizeCharacterStats(char) {
        if (!char || typeof window.getMergedCharacterStatsForPoints !== 'function') {
            return;
        }
        if (!this.urlHasAuthoritativeStats(char.id)) {
            return;
        }
        const merged = window.getMergedCharacterStatsForPoints(char);
        if (merged && merged.stats) {
            char.stats = Object.assign({}, merged.stats);
        }
    },

    csvIsStarterDefault(csv) {
        if (!csv || typeof csv !== 'string') {
            return true;
        }
        const parts = csv.split(',');
        if (parts.length !== 20) {
            return false;
        }
        let idx;
        let allOnes = true;
        let allTwos = true;
        for (idx = 0; idx < parts.length; idx++) {
            const val = parseInt(parts[idx], 10);
            if (isNaN(val)) {
                return false;
            }
            if (val !== 1) {
                allOnes = false;
            }
            if (val !== 2) {
                allTwos = false;
            }
        }
        return allOnes || allTwos;
    },

    statsCharIdFromUrl() {
        try {
            return new URLSearchParams(window.location.search).get('stats_char_id') || '';
        } catch (e) {
            return '';
        }
    },

    /**
     * True when stats_csv in the MOAP URL belongs to the character being loaded.
     * Prevents roster switches from applying the previous slot's HUD stats.
     */
    urlStatsBelongToCharacter(characterId) {
        if (!characterId) {
            return false;
        }
        let csv = '';
        let statsCharId = '';
        let activeChar = '';
        try {
            const params = new URLSearchParams(window.location.search);
            csv = params.get('stats_csv') || '';
            statsCharId = params.get('stats_char_id') || '';
            activeChar = params.get('active_char') || '';
        } catch (e) {
            return false;
        }
        if (!csv || !this.statsObjectFromCsv(csv) || this.csvIsStarterDefault(csv)) {
            return false;
        }
        if (statsCharId) {
            return statsCharId === characterId;
        }
        // Legacy URLs (no stats_char_id): only trust on initial HUD open when active_char matches.
        return activeChar === characterId;
    },

    urlHudEconBelongsToCharacter(characterId) {
        if (!characterId) {
            return false;
        }
        try {
            const params = new URLSearchParams(window.location.search);
            const urlUuid = params.get('uuid') || '';
            if (typeof API !== 'undefined' && API.uuid && urlUuid && urlUuid !== API.uuid) {
                return false;
            }
            const econChar = params.get('econ_char_id')
                || params.get('stats_char_id')
                || '';
            const activeChar = params.get('active_char') || '';
            if (econChar) {
                return econChar === characterId;
            }
            if (activeChar) {
                return activeChar === characterId;
            }
        } catch (e) {
            return false;
        }
        return false;
    },

    urlHasAuthoritativeStats(characterId) {
        if (this.bridgeHasAuthoritativeHudData(characterId)) {
            return true;
        }
        try {
            const charId = characterId || this.state.character?.id || '';
            const csv = new URLSearchParams(window.location.search).get('stats_csv') || '';
            if (!this.statsObjectFromCsv(csv)) {
                return false;
            }
            if (this.csvIsStarterDefault(csv)) {
                return false;
            }
            if (charId && !this.urlStatsBelongToCharacter(charId)) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Strip HUD stats/econ URL params from the previous roster slot before loading another.
     */
    clearStaleHudUrlParamsForCharacterSwitch(targetCharacterId) {
        try {
            const url = new URL(window.location.href);
            const hadStats = url.searchParams.has('stats_csv');
            url.searchParams.delete('stats_csv');
            url.searchParams.delete('stats_csv_ts');
            url.searchParams.delete('stats_char_id');
            url.searchParams.delete('econ_sync');
            url.searchParams.delete('econ_ts');
            url.searchParams.delete('xp_spent');
            url.searchParams.delete('ap_balance');
            url.searchParams.delete('xp_lifetime');
            url.searchParams.delete('xp_total');
            url.searchParams.delete('econ_char_id');
            this.safeHistoryReplaceState(url.toString());
            if (hadStats) {
                console.log('[Character] Cleared stale HUD URL stats/econ for switch to', targetCharacterId);
            }
        } catch (e) { /* ignore */ }
        this._lastStatsCsvSynced = null;
        this.state.statsPending = false;
        this.state.pendingChanges = {};
    },

    /**
     * True while MOAP loaded before HUD pushed KVP gameplay into the URL (character switch / LOAD_CHARACTER).
     */
    isAwaitingHudKvpUrl(characterId) {
        const charId = characterId || this.state.character?.id || '';
        if (!charId) {
            return false;
        }
        if (this.isBridgeHudMode()) {
            if (this.bridgeHasAuthoritativeHudData(charId)) {
                return false;
            }
            if (!this._bridgeSessionApplied) {
                return true;
            }
        }
        try {
            const params = new URLSearchParams(window.location.search);
            const activeChar = params.get('active_char') || '';
            if (activeChar && activeChar !== charId) {
                return false;
            }
            const hasStats = this.urlHasAuthoritativeStats(charId);
            const hasEcon = typeof window.hasHudEconInUrl === 'function' && window.hasHudEconInUrl();
            if (hasStats && hasEcon) {
                return false;
            }
            if (params.get('moap_char_switch') === '1') {
                return true;
            }
            const lslCmd = decodeURIComponent(params.get('lsl_cmd') || '');
            if (lslCmd.indexOf('LOAD_CHARACTER') === 0) {
                return !hasStats || !hasEcon;
            }
        } catch (e) { /* ignore */ }
        return false;
    },

    /**
     * Build MOAP URL for roster switch: fresh cache-bust, active_char, optional LOAD_CHARACTER in URL (legacy).
     */
    buildCharacterSwitchReloadUrl(characterId, char, loadCmd) {
        const url = new URL(window.location.href);
        const stripKeys = [
            'stats_csv', 'stats_csv_ts', 'stats_char_id', 'econ_sync', 'econ_ts',
            'xp_spent', 'ap_balance', 'xp_lifetime', 'xp_total', 'lsl_cmd', 'lsl_cmd_ts',
            'health_pipe', 'stamina_pipe', 'mana_pipe', 'has_mana', 'char_name', 'char_title'
        ];
        stripKeys.forEach(function (key) {
            url.searchParams.delete(key);
        });
        url.searchParams.set('active_char', characterId);
        url.searchParams.set('moap_char_switch', '1');
        url.searchParams.set('request_data', '1');
        url.searchParams.set('t', String(Date.now()));
        if (loadCmd && !this.isBridgeHudMode()) {
            url.searchParams.set('lsl_cmd', loadCmd);
            url.searchParams.set('lsl_cmd_ts', String(Date.now()));
        }
        if (char && char.name) {
            url.searchParams.set('char_name', char.name);
        }
        if (char && char.title != null && char.title !== '') {
            url.searchParams.set('char_title', char.title);
        }
        const payload = this.buildCharacterSyncPayload(characterId, char);
        if (payload.has_mana != null) {
            url.searchParams.set('has_mana', String(payload.has_mana));
        }
        if (payload.health) {
            url.searchParams.set('health_pipe', payload.health);
        }
        if (payload.stamina) {
            url.searchParams.set('stamina_pipe', payload.stamina);
        }
        if (payload.mana) {
            url.searchParams.set('mana_pipe', payload.mana);
        }
        return url;
    },

    /**
     * Roster switch: push LOAD_CHARACTER to HUD, then full MOAP page reload.
     */
    async reloadSetupHudForCharacterSwitch(characterId) {
        if (!characterId) {
            return;
        }
        this._bridgeSessionApplied = false;
        this._lastBridgeSession = null;
        this._lastStatsCsvSynced = null;
        this._hudSlotSyncedCharId = null;
        this.state.dirty = false;
        this.state.statsPending = false;
        this.state.pendingChanges = {};
        await this.rememberSelectedCharacter(characterId);

        let char = this.characterFromList(API._listCharactersCache || [], characterId);
        if (!char || !char.name) {
            const charResult = await API.getCharacterById(characterId);
            if (charResult.success && charResult.data && charResult.data.character) {
                char = charResult.data.character;
                this.upsertCharacterInRosterCache(char);
            }
        }
        if (!char) {
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Could not load character', 'error');
            }
            return;
        }

        const payload = this.buildCharacterSyncPayload(characterId, char);
        const loadParts = Object.keys(payload).map(function (key) {
            return key + ':' + encodeURIComponent(String(payload[key]));
        });
        const loadCmd = 'LOAD_CHARACTER|' + loadParts.join('|');

        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast('Switching to ' + (char.name || 'character') + '...', 'info', 4000);
        }

        if (this.isBridgeHudMode()) {
            try {
                await this.sendToLSLViaBridge(loadCmd);
            } catch (bridgeErr) {
                console.error('[Character switch] bridge LOAD_CHARACTER failed:', bridgeErr);
            }
        }

        const reloadUrl = this.buildCharacterSwitchReloadUrl(characterId, char, loadCmd);
        console.log('[Character switch] reloading MOAP for', characterId, reloadUrl.toString());
        window.location.assign(reloadUrl.toString());
    },

    /**
     * Apply stats_csv from MOAP URL (Save Stats push or HUD EXP/LSD on setup open).
     * Gameplay stats live in Experience KVP; Firestore is fallback only.
     */
    mergeStatsFromUrlIntoCharacter() {
        const char = this.state.character;
        if (!char || !char.id) {
            return false;
        }
        if (!this.urlStatsBelongToCharacter(char.id)) {
            return false;
        }
        let csv = '';
        try {
            csv = new URLSearchParams(window.location.search).get('stats_csv') || '';
        } catch (e) {
            return false;
        }
        if (!csv) {
            return false;
        }
        const stats = this.statsObjectFromCsv(csv);
        if (!stats) {
            return false;
        }
        if (this.csvIsStarterDefault(csv)) {
            return false;
        }
        char.stats = stats;
        if (this.state.pendingChanges) {
            this.state.pendingChanges.stats = Object.assign({}, stats);
        }
        return true;
    },

    /**
     * Write stats into Players HUD LSD only — no Bridge fetch.
     * Retries if MOAP input is focused (history.replaceState is blocked).
     */
    syncStatsToPlayersHUD(char) {
        if (!char) {
            return;
        }
        if (this.isBridgeHudMode()) {
            return;
        }
        if (typeof MoapDialogs !== 'undefined' && MoapDialogs.isActive && MoapDialogs.isActive()) {
            this.scheduleSyncStatsToPlayersHUD(char);
            return;
        }
        let urlCsv = '';
        try {
            urlCsv = new URLSearchParams(window.location.search).get('stats_csv') || '';
        } catch (e) { /* ignore */ }
        if (this.urlHasAuthoritativeStats(char.id)) {
            const bridgeCsv = this._lastBridgeSession
                ? (this._lastBridgeSession.stats_csv
                    || (this._lastBridgeSession.stats && this._lastBridgeSession.stats.csv)
                    || '')
                : '';
            this._lastStatsCsvSynced = urlCsv || bridgeCsv || this.statsCsvFromChar(char) || '';
            return;
        }
        const csv = this.statsCsvFromChar(char);
        if (!csv) {
            console.warn('[Players HUD Sync] statsCsvFromChar empty — char.stats missing?');
            return;
        }
        if (this.csvIsStarterDefault(csv)) {
            console.warn('[Players HUD Sync] refusing to push factory all-1s/all-2s stats from Firestore');
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
            if (char.id) {
                currentUrl.searchParams.set('stats_char_id', char.id);
            }
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
     * Setup open / save: push identity (and optionally stats) into Players HUD LSD.
     * @param {object} char
     * @param {{ syncStats?: boolean }} options — syncStats false avoids location.assign on identity save
     */
    async cacheHudStatsForPlayers(char, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id) {
            return;
        }
        if (this.isBridgeHudMode()) {
            return;
        }
        const wantStatsSync = options.syncStats !== false;
        if (wantStatsSync && !this.urlHasAuthoritativeStats()) {
            this.scheduleSyncStatsToPlayersHUD(char);
        }
        if (options.pushCharacter !== false) {
            await this.pushCharacterToPlayersHUD(char.id);
        }
    },

    /**
     * Build pipe-safe payload from loaded Firestore character (MOAP → LSL).
     * LSL bridge HTTP cannot use Firebase auth; MOAP must push identity and pools.
     */
    buildCharacterSyncPayload(characterId, charOverride, options) {
        if (options === undefined) {
            options = {};
        }
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
        }
        if (char.class_id) {
            data.class_id = char.class_id;
        }
        const hm = char.has_mana;
        if (hm === true || hm === 1 || hm === '1' || hm === 'true') {
            data.has_mana = '1';
        } else {
            data.has_mana = '0';
        }
        const factors = char.species_factors;
        if (factors) {
            if (factors.health_factor != null) {
                data.health_factor = String(factors.health_factor);
            }
            if (factors.stamina_factor != null) {
                data.stamina_factor = String(factors.stamina_factor);
            }
            if (factors.mana_factor != null) {
                data.mana_factor = String(factors.mana_factor);
            }
        }
        if (char.mode) {
            data.mode = char.mode;
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
        let manaStr = pool(char.mana);
        if (char.has_mana === true && (!manaStr || manaStr === '0|0|0')) {
            if (typeof this.recalculateResourcePools === 'function') {
                this.recalculateResourcePools();
            }
            manaStr = pool(char.mana);
        }
        if (manaStr && (char.has_mana === true || manaStr !== '0|0|0')) {
            data.mana = manaStr;
        }
        if (this._pendingAutoHideSetup) {
            data.auto_hide_setup = 'TRUE';
            this._pendingAutoHideSetup = false;
        }
        if (options.includeGameplay && char) {
            const gameplayCsv = this.statsCsvFromChar(char);
            if (gameplayCsv && gameplayCsv.split(',').length === 20) {
                data.stats = gameplayCsv;
            }
            const life = this.getEffectiveXpLifetime(char);
            if (life > 0) {
                data.xp_lifetime = String(life);
            }
            data.xp_spent = String(window.getEconSpent(char));
            data.ap_balance = String(window.getApBalance(char));
        }
        return data;
    },

    /**
     * Load a character into the Players HUD (LSD + meter) after Setup HUD selection or save.
     */
    async pushCharacterToPlayersHUD(characterId, options) {
        if (options === undefined) {
            options = {};
        }
        if (!characterId || !API.uuid) {
            return;
        }
        if (this.isBridgeHudMode() && !options.forceHudPush) {
            console.log('[Players HUD Sync] bridge mode — skip LOAD_CHARACTER (session read only)');
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
        if (char && typeof this.recalculateResourcePools === 'function') {
            if (this.state.character && this.state.character.id === characterId) {
                this.recalculateResourcePools();
                char = this.state.character;
            }
        }
        const payload = this.buildCharacterSyncPayload(characterId, char);
        if (!payload.name) {
            console.warn('[Players HUD Sync] LOAD_CHARACTER missing name — meter may show Loading until Bridge fetch');
        }
        console.log('[Players HUD Sync] Switching HUD character:', payload);
        await this.sendToLSL('LOAD_CHARACTER', payload);
        try {
            const currentUrl = new URL(window.location.href);
            if (char && char.name) {
                currentUrl.searchParams.set('char_name', char.name);
            }
            if (char && char.title != null) {
                currentUrl.searchParams.set('char_title', char.title);
            }
            if (payload.has_mana != null) {
                currentUrl.searchParams.set('has_mana', String(payload.has_mana));
            }
            if (payload.health) {
                currentUrl.searchParams.set('health_pipe', payload.health);
            }
            if (payload.stamina) {
                currentUrl.searchParams.set('stamina_pipe', payload.stamina);
            }
            if (payload.mana) {
                currentUrl.searchParams.set('mana_pipe', payload.mana);
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

        if (this.isBridgeHudMode()) {
            return this.sendToLSLViaBridge(message);
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
     * Persist XP spent/AP to HUD Experience KVP (bridge) or legacy URL reload.
     */
    async persistEconToHud(char, options) {
        if (options === undefined) {
            options = {};
        }
        if (!char || !char.id) {
            return false;
        }
        const spent = window.getEconSpent(char);
        const ap = window.getApBalance(char);
        const life = window.getEconLifetime(char);
        if (this.isBridgeHudMode()) {
            try {
                await F4BridgeHud.waitForBridgeReady(options.bridgeTimeout || 12000);
                const econRes = await F4Bridge.saveEcon(spent, ap, char.id, life);
                if (!econRes || !econRes.ok) {
                    console.warn('[Econ] bridge save_econ failed:', econRes);
                    if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                        UI.showToast('Could not sync XP spend to HUD (bridge)', 'warning', 4000);
                    }
                    return false;
                }
                if (this._lastBridgeSession) {
                    this._lastBridgeSession.xp_spent = String(spent);
                    this._lastBridgeSession.ap_balance = String(ap);
                    this._lastBridgeSession.xp_lifetime = String(life);
                }
                window.updateEconUrlParams(spent, ap);
                return true;
            } catch (bridgeErr) {
                console.warn('[Econ] bridge save_econ error:', bridgeErr);
                if (!options.silent && typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast('Could not sync XP spend to HUD', 'warning', 4000);
                }
                return false;
            }
        }
        return window.pushEconToHudViaUrl(char);
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
        const self = this;
        setTimeout(function () {
            self.persistEconToHud(self.state.character, { silent: true }).catch(function (err) {
                console.warn('[Class XP] persistEconToHud failed:', err);
            });
        }, 600);
    },

    async saveCharacter(options) {
        if (options === undefined) {
            options = {};
        }
        const draft = !!options.draft;
        const silent = !!options.silent;

        try {
            this.flushIdentityFromForm();
            const char = this.state.character;
            if (!char) {
                if (!silent) UI.showToast('No character to save', 'warning');
                return false;
            }
            if (char._rosterPartial) {
                if (!silent) {
                    UI.showToast('Character list did not finish loading. Close Setup and open it again before saving.', 'warning');
                }
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
            
            // Determine if this is a new character or an update.
            // completeMint during creation always creates (ghost ids already cleared in finishLocalCreation).
            const useCreatePath = !char.id && (this.state.isNewCharacter || this.state.creationInProgress
                || options.completeMint === true);

            if (draft && useCreatePath) {
                if (!char.species_id) {
                    if (!silent) UI.showToast('Select a species before saving progress', 'warning');
                    return false;
                }
                if (!this.hasCreationGameplayReady(char)) {
                    if (!silent) UI.showToast('Confirm your species choice to set starting XP and stats before saving', 'warning');
                    return false;
                }
            }
            
            if (useCreatePath) {
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
                    const identityClassId = char.class_id || undefined;
                    const identityCheck = await API.validateIdentityOptions(
                        this.state.selectedUniverseId,
                        saveGender,
                        saveSpeciesId,
                        identityClassId
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
                
                const createPayload = {
                    name: char.name,
                    title: char.title || '',
                    gender: saveGender,
                    species_id: saveSpeciesId,
                    universe_id: this.state.selectedUniverseId || char.universe_id || 'default',
                    has_mana: hasMana,
                    mana: manaPool,
                    health: char.health,
                    stamina: char.stamina,
                    stats: this.statsCsvFromChar(char) || char.stats,
                    setup_complete: !draft,
                    xp_lifetime: char.xp_lifetime != null ? char.xp_lifetime : this.getStartingXpGrant(saveSpeciesId),
                    xp_spent: char.xp_spent != null ? char.xp_spent : 0,
                    ap_balance: char.ap_balance != null ? char.ap_balance : 0
                };
                if (char.class_id) {
                    createPayload.class_id = char.class_id;
                }
                // Hybrid: never mint incomplete drafts from the wizard
                if (draft && !char.id) {
                    if (!silent) {
                        UI.showToast('Continue through Review, then Finish to create your character', 'info', 3500);
                    }
                    return true;
                }

                // Always keep local gameplay across create — bridge reply is identity-only.
                const preservedGameplay = {
                    stats: char.stats ? Object.assign({}, char.stats) : null,
                    statsCsv: this.statsCsvFromChar(char) || '',
                    xp_lifetime: char.xp_lifetime,
                    xp_spent: char.xp_spent,
                    ap_balance: char.ap_balance,
                    has_mana: char.has_mana,
                    mana: char.mana ? Object.assign({}, char.mana) : null,
                    health: char.health ? Object.assign({}, char.health) : null,
                    stamina: char.stamina ? Object.assign({}, char.stamina) : null,
                    class_id: char.class_id || '',
                    setup_complete: !draft
                };

                const result = await API.createCharacter(createPayload);
                
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
                if (preservedGameplay.stats) {
                    this.state.character.stats = Object.assign({}, preservedGameplay.stats);
                }
                if (preservedGameplay.xp_lifetime != null && preservedGameplay.xp_lifetime > 0) {
                    this.state.character.xp_lifetime = preservedGameplay.xp_lifetime;
                    this.state.character.xp_spent = preservedGameplay.xp_spent != null ? preservedGameplay.xp_spent : 0;
                    this.state.character.ap_balance = preservedGameplay.ap_balance != null ? preservedGameplay.ap_balance : 0;
                    this.state.character.xp_available = Math.max(
                        0,
                        this.state.character.xp_lifetime - this.state.character.xp_spent
                    );
                    if (typeof App.state.econ === 'undefined' || !App.state.econ) {
                        App.state.econ = {};
                    }
                    App.state.econ.xp_lifetime = this.state.character.xp_lifetime;
                    App.state.econ.xp_spent = this.state.character.xp_spent;
                    App.state.econ.ap_balance = this.state.character.ap_balance;
                    App.state.econSessionActive = true;
                }
                if (preservedGameplay.has_mana != null) {
                    this.state.character.has_mana = preservedGameplay.has_mana;
                }
                if (preservedGameplay.mana) {
                    this.state.character.mana = Object.assign({}, preservedGameplay.mana);
                }
                if (preservedGameplay.health) {
                    this.state.character.health = Object.assign({}, preservedGameplay.health);
                }
                if (preservedGameplay.stamina) {
                    this.state.character.stamina = Object.assign({}, preservedGameplay.stamina);
                }
                if (preservedGameplay.class_id) {
                    this.state.character.class_id = preservedGameplay.class_id;
                }
                if (preservedGameplay.setup_complete) {
                    this.state.character.setup_complete = true;
                }
                this.state.dirty = false;
                // Starting class during creation is free — do not charge XP after mint
                if (!draft) {
                    delete this.state.pendingClassXpCost;
                }
                this.applyPendingClassXpChargeAfterSave();
                if (draft) {
                    await this.rememberSelectedCharacter(result.data.character.id);
                }
                if (draft) {
                    this.state.isNewCharacter = true;
                    this.state.creationInProgress = true;
                    this.rememberCreationStep(this.state.creationStepId || 'identity');
                    if (!silent) UI.showToast('Progress saved', 'success');
                } else {
                    this.state.isNewCharacter = false;
                    this.state.creationInProgress = false;
                    this.state.creationStepId = null;
                    this.clearRememberedCreationStep(result.data.character.id);
                    await this.rememberSelectedCharacter(result.data.character.id);
                    if (!silent) UI.showToast('Character created!', 'success');
                }
                this.updateStatusIndicator();
                this.updateStepGuide();
                const createdChar = this.state.character;
                if (draft) {
                    await this.syncCreationGameplayToKvp(createdChar, { silent: true });
                } else if (this.isBridgeHudMode() && createdChar) {
                    // Identity should have written f4stats_/f4state_ — re-sync and surface failures
                    // (silent seed hid missing gameplay KVP after "Character created!").
                    const gameplayOk = await this.finishCreationGameplayToKvp(createdChar, {
                        showSuccess: false,
                        silent: false,
                        forceSlotSync: true,
                        statsCsv: preservedGameplay.statsCsv || this.statsCsvFromChar(createdChar)
                    });
                    if (!gameplayOk && typeof UI !== 'undefined' && UI.showToast) {
                        UI.showToast(
                            'Character identity saved, but stats/XP did not write to Experience — use Save Stats, then Refresh from HUD',
                            'error',
                            7000
                        );
                    }
                } else {
                    await this.pushCharacterToPlayersHUD(result.data.character.id);
                    this.grantStartingXpToHud(createdChar, { forceStarter: true });
                }
                await this.refreshAfterCharacterSave(result.data.character);
                return true;
            } else {
                // Update existing character (must target the selected doc, not "first" character)
                const characterId = char.id;
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
                const gameplaySnapshot = this.snapshotGameplayFromCharacter(char);
                this.recalculateResourcePools();

                const updatePayload = {
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    species_id: char.species_id,
                    universe_id: char.universe_id || this.state.selectedUniverseId || 'default',
                    has_mana: char.has_mana,
                    mode: char.mode || 'roleplay',
                    mana: char.mana,
                    health: char.health,
                    stamina: char.stamina,
                    setup_complete: draft ? false : true,
                    currency: char.currency != null ? char.currency : 50
                };
                if (classId) {
                    updatePayload.class_id = classId;
                }

                const result = await API.updateCharacter(updatePayload, characterId);
                
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
                this.restoreGameplayToCharacter(this.state.character, gameplaySnapshot);
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
                    this.rememberCreationStep(this.state.creationStepId || this.inferCreationStepFromCharacter(this.state.character));
                    if (!silent) UI.showToast('Progress saved', 'success');
                } else {
                    this.state.isNewCharacter = false;
                    this.state.creationInProgress = false;
                    this.state.creationStepId = null;
                    this.clearRememberedCreationStep(result.data.character.id);
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
                this.captureStatsFloor(this.state.character);
                App.state.econSessionActive = true;
                if (this.state.character) {
                    this.state.character.ap_balance = savedAp;
                    this.state.character.xp_spent = finalSpent;
                    App.state.econ.ap_balance = savedAp;
                    App.state.econ.xp_spent = finalSpent;
                    App.state.econSessionActive = true;
                    window.reconcileStaleApBalance(this.state.character);
                }
                window.updateEconUrlParams(finalSpent, savedAp);
                this.clearMoapSessionDraft(characterId);
                const statsCsvNow = gameplaySnapshot.statsCsv || this.statsCsvFromChar(this.state.character);
                const shouldSyncStats = !this.csvIsStarterDefault(statsCsvNow)
                    || !!(gameplaySnapshot.pendingStats);
                const finishingSetup = !draft && updatePayload.setup_complete;
                if (draft && this.state.creationInProgress) {
                    await this.syncCreationGameplayToKvp(this.state.character, {
                        statsCsv: statsCsvNow,
                        silent: true
                    });
                } else if (this.isBridgeHudMode()) {
                    if (finishingSetup) {
                        await this.finishCreationGameplayToKvp(this.state.character, {
                            statsCsv: statsCsvNow,
                            showSuccess: !silent,
                            silent: silent
                        });
                    } else if (this.hasEditedGameplay(this.state.character, statsCsvNow)) {
                        await this.seedHudKvpGameplay(this.state.character, {
                            statsCsv: statsCsvNow,
                            allowStarterSeed: false,
                            syncEcon: true,
                            silent: true,
                            xpLifetime: this.state.character.xp_lifetime
                        });
                    }
                } else {
                    await this.pushCharacterToPlayersHUD(characterId);
                    if (finishingSetup) {
                        this.grantStartingXpToHud(this.state.character, { forceStarter: true });
                    }
                }
                await this.cacheHudStatsForPlayers(this.state.character, {
                    syncStats: shouldSyncStats && !this.isBridgeHudMode()
                });
                // Defer lsl_cmd cleanup — immediate cleanMoapUrlParams erased LOAD_CHARACTER before LSL poll.
                setTimeout(function () {
                    if (typeof UI !== 'undefined' && UI.cleanMoapUrlParams) {
                        UI.cleanMoapUrlParams();
                    }
                }, 8000);
                await this.refreshAfterCharacterSave(this.state.character);
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
                this.showGiveItemAdmin();
                break;
            case 'givecoins':
                this.showGiveCoins();
                break;
            case 'giveitem':
                this.showGiveItemAdmin();
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
                    const tickEvery = parseInt(consumable.tick_interval_seconds, 10) || 0;
                    let durationDesc = (consumable.delay_seconds ? `${consumable.delay_seconds}s delay → ` : '');
                    if (tickEvery > 0 && consumable.effect_category === 'poison' && consumable.antidote_id) {
                        durationDesc += `every ${tickEvery}s until ${consumable.antidote_id}`;
                    } else if (tickEvery > 0) {
                        durationDesc += `every ${tickEvery}s for ${consumable.duration_seconds || 0}s`;
                    } else {
                        durationDesc += consumable.duration_seconds ? `${consumable.duration_seconds}s` : 'instant';
                    }
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
                    <small>Stable id antidotes match. Defaults to the slug if blank.</small>
                </div>
                <div class="form-group" id="antidote-id-group" style="display: none;">
                    <label for="consumable-antidote-id">Antidote slug (optional)</label>
                    <input type="text" id="consumable-antidote-id" value="${esc(consumable?.antidote_id || '')}" placeholder="milk_thistle">
                    <small>If set, recurring damage continues until this item is used. Leave blank to stop recurring when Duration ends. A matching antidote can still end it early.</small>
                </div>
                <div class="form-group" id="cures-poison-group" style="display: none;">
                    <label for="consumable-cures-poison">Cures poison IDs</label>
                    <input type="text" id="consumable-cures-poison" value="${esc(consumable?.cures_poison || '')}" placeholder="nightshade, bad_ale">
                    <small>Comma-separated poison_id values this antidote removes, including their recurring ticks.</small>
                </div>
                <fieldset id="consumable-resource-fieldset" style="border: 1px solid var(--border-color); padding: var(--space-md); margin-bottom: var(--space-md); border-radius: 4px;">
                    <legend id="consumable-resource-legend" style="padding: 0 var(--space-xs);">One-time resource changes</legend>
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
                    <small id="consumable-resource-help">Dice uses d20 per die. Plain number or +N is fixed. Examples: <code>1D</code>, <code>3D+5</code>, <code>-2D-5</code>, <code>+10</code>.</small>
                </fieldset>
                <fieldset id="consumable-tick-fieldset" style="display: none; border: 1px solid var(--border-color); padding: var(--space-md); margin-bottom: var(--space-md); border-radius: 4px;">
                    <legend id="consumable-tick-legend" style="padding: 0 var(--space-xs);">Recurring effect (optional)</legend>
                    <div class="form-group">
                        <label for="consumable-tick-interval">Period (seconds)</label>
                        <input type="number" id="consumable-tick-interval" value="${consumable?.tick_interval_seconds ?? 0}" min="0">
                        <small>0 = no recurring effect. Otherwise health, stamina, and mana below are applied again on this period.</small>
                    </div>
                    <div class="form-group">
                        <label for="consumable-tick-health">Recurring health</label>
                        <input type="text" id="consumable-tick-health" value="${esc(consumable?.tick_health ?? '0')}" placeholder="0, -1D, -5">
                    </div>
                    <div class="form-group">
                        <label for="consumable-tick-stamina">Recurring stamina</label>
                        <input type="text" id="consumable-tick-stamina" value="${esc(consumable?.tick_stamina ?? '0')}" placeholder="0, -2">
                    </div>
                    <div class="form-group">
                        <label for="consumable-tick-mana">Recurring mana</label>
                        <input type="text" id="consumable-tick-mana" value="${esc(consumable?.tick_mana ?? '0')}" placeholder="0, +1D">
                    </div>
                    <small id="consumable-tick-help">Poison ticks should be negative. Antidote ticks should be positive recovery.</small>
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
            const isPoison = category === 'poison';
            const isAntidote = category === 'antidote';
            const isDot = isPoison || isAntidote;
            const timingGroup = document.getElementById('consumable-timing-group');
            const durationGroup = document.getElementById('consumable-duration-group');
            const stackableGroup = document.getElementById('consumable-stackable-group');
            const tickFieldset = document.getElementById('consumable-tick-fieldset');
            const legend = document.getElementById('consumable-resource-legend');
            const categoryHelp = document.getElementById('consumable-category-help');
            const durationHelp = document.getElementById('consumable-duration-help');
            const delayHelp = document.getElementById('consumable-delay-help');
            const poisonGroup = document.getElementById('poison-id-group');
            const antidoteGroup = document.getElementById('antidote-id-group');
            const curesGroup = document.getElementById('cures-poison-group');
            const antidoteId = (document.getElementById('consumable-antidote-id')?.value || '').trim();
            if (poisonGroup) poisonGroup.style.display = isPoison ? '' : 'none';
            if (antidoteGroup) antidoteGroup.style.display = isPoison ? '' : 'none';
            if (curesGroup) curesGroup.style.display = isAntidote ? '' : 'none';
            if (tickFieldset) tickFieldset.style.display = isDot ? '' : 'none';
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
                if (legend) {
                    legend.textContent = isPoison
                        ? 'One-time damage (applied once)'
                        : (isAntidote ? 'One-time recovery (applied once)' : 'Resource changes (rolled once after delay)');
                }
                if (delayHelp) {
                    delayHelp.textContent = isDot
                        ? 'Wait before the one-time change. Recurring ticks start after that, then repeat on the period.'
                        : 'Time after drinking before health/stamina/mana change applies (0 = immediate).';
                }
                if (durationHelp) {
                    if (isPoison && antidoteId) {
                        durationHelp.textContent = 'Ignored while an antidote slug is set. Recurring damage stops only when that antidote is used.';
                    } else if (isPoison) {
                        durationHelp.textContent = 'How long recurring ticks continue. 0 = one-time damage only. A matching antidote can still end it early.';
                    } else if (isAntidote) {
                        durationHelp.textContent = 'How long recurring recovery continues after the one-time recovery. 0 = one-time only.';
                    } else {
                        durationHelp.textContent = 'How long the effect stays active on the buff bar after it applies (0 = instant, no buff icon).';
                    }
                }
                if (categoryHelp) {
                    if (isPoison) {
                        categoryHelp.textContent = 'One-time damage, plus optional repeating damage. Name an antidote if the ticks should continue until it is taken.';
                    } else if (isAntidote) {
                        categoryHelp.textContent = 'Removes matching poisons, then applies one-time recovery and optional repeating recovery.';
                    } else {
                        categoryHelp.textContent = 'Alcohol/intoxicant apply impairment while active.';
                    }
                }
            }
        };
        document.getElementById('consumable-effect-category')?.addEventListener('change', syncConsumableCategoryUI);
        document.getElementById('consumable-antidote-id')?.addEventListener('input', syncConsumableCategoryUI);
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
            const isDot = effectCategory === 'poison' || effectCategory === 'antidote';
            let tickHealth = isDot ? (document.getElementById('consumable-tick-health').value.trim() || '0') : '0';
            let tickStamina = isDot ? (document.getElementById('consumable-tick-stamina').value.trim() || '0') : '0';
            let tickMana = isDot ? (document.getElementById('consumable-tick-mana').value.trim() || '0') : '0';
            let tickInterval = isDot ? (parseInt(document.getElementById('consumable-tick-interval').value, 10) || 0) : 0;
            const poisonId = document.getElementById('consumable-poison-id').value.trim();
            const antidoteId = effectCategory === 'poison'
                ? document.getElementById('consumable-antidote-id').value.trim().toLowerCase()
                : '';
            const curesPoison = document.getElementById('consumable-cures-poison').value.trim();
            if (tickInterval < 0) {
                UI.showToast('Recurring period cannot be negative', 'warning');
                return;
            }
            if (tickInterval > 0 && tickHealth === '0' && tickStamina === '0' && tickMana === '0') {
                UI.showToast('Set a recurring health, stamina, or mana amount, or set the period to 0', 'warning');
                return;
            }
            if (tickInterval > 0 && effectCategory === 'antidote' && duration <= 0) {
                UI.showToast('Recurring recovery needs a duration in seconds', 'warning');
                return;
            }
            if (tickInterval > 0 && effectCategory === 'poison' && !antidoteId && duration <= 0) {
                UI.showToast('Recurring poison needs a duration, or an antidote slug that stops it', 'warning');
                return;
            }
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
                tick_health: tickHealth,
                tick_stamina: tickStamina,
                tick_mana: tickMana,
                tick_interval_seconds: tickInterval,
                antidote_id: antidoteId,
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
                'tick_health', 'tick_stamina', 'tick_mana', 'tick_interval_seconds',
                'poison_id', 'antidote_id', 'cures_poison',
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
                    c.tick_health ?? '0',
                    c.tick_stamina ?? '0',
                    c.tick_mana ?? '0',
                    c.tick_interval_seconds ?? 0,
                    c.poison_id || '',
                    c.antidote_id || '',
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
                    tick_health: get('tick_health', '0'),
                    tick_stamina: get('tick_stamina', '0'),
                    tick_mana: get('tick_mana', '0'),
                    tick_interval_seconds: parseInt(get('tick_interval_seconds', '0'), 10) || 0,
                    poison_id: get('poison_id'),
                    antidote_id: get('antidote_id'),
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
    
    showGiveItemAdmin() {
        const adminContent = UI.elements.adminContent;
        
        adminContent.innerHTML = `
            <h3>📦 Give Items (HUD inventory)</h3>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">Gameplay XP is stored in Second Life Experience KVP only — use the in-world <strong>F4 Admin XP Tool</strong> to grant or fix XP. This panel gives inventory items to online players.</p>
            
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
        
        const clearItemForm = () => {
            document.getElementById('item-target').value = '';
            document.getElementById('item-name').value = '';
            document.getElementById('item-amount').value = '1';
            document.getElementById('item-reason').value = '';
            document.getElementById('item-result').innerHTML = '';
        };
        
        document.getElementById('btn-clear-item')?.addEventListener('click', clearItemForm);
        
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
        this.showGiveItemAdmin();
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
                <button type="button" 