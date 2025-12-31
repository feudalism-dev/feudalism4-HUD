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
        var toggle = document.getElementById('debug-toggle');
        
        // Debug panel is hidden by default
        if (this.panel) {
            this.panel.style.display = 'none';
            this.log('Debug panel initialized (hidden by default)', 'info');
        } else {
            // If panel doesn't exist, create it
            var newPanel = document.createElement('div');
            newPanel.id = 'debug-panel';
            newPanel.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 500px; max-height: 400px; background: rgba(0, 0, 0, 0.95); color: #0f0; font-family: monospace; font-size: 12px; padding: 15px; border: 3px solid #0f0; z-index: 99999; overflow-y: auto; display: none;';
            newPanel.innerHTML = '<div style="margin-bottom: 10px;"><strong>DEBUG LOG</strong> <button id="debug-toggle">Show</button></div><div id="debug-content"></div>';
            document.body.appendChild(newPanel);
            this.panel = newPanel;
            this.content = document.getElementById('debug-content');
        }
        
        if (toggle) {
            var self = this;
            toggle.addEventListener('click', function() {
                if (self.panel.style.display === 'none') {
                    self.panel.style.display = 'block';
                    toggle.textContent = 'Hide';
                } else {
                    self.panel.style.display = 'none';
                    toggle.textContent = 'Show';
                }
            });
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
        vocations: [],
        genders: [],
        currentSpecies: null,
        currentClass: null,
        currentVocation: null,
        currentUniverse: null,
        selectedUniverseId: 'default',
        selectedCharacterId: null,
        pendingChanges: {},
        isNewCharacter: false
    },
    
    // LSL integration state
    lsl: {
        uuid: null,
        username: null,
        displayName: null,
        channel: null,
        connected: false
    },
    
    /**
     * Initialize the application
     */
    async init() {
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
        
        // If LSL requested data, ensure we broadcast it (even if character was already loaded)
        if (requestData === '1') {
            if (this.state.character) {
                console.log('[Players HUD] Character found - broadcasting character data in response to LSL request');
                this.broadcastCharacterToPlayersHUD(this.state.character);
                
                // Update URL with character data so LSL can read it
                // Use replaceState to avoid reload, then LSL will poll and see the updated URL
                setTimeout(() => {
                    try {
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
                            console.log('[Players HUD] Using currentClass.id as fallback: ' + classId);
                        }
                        if (!classId) {
                            console.warn('[Players HUD] WARNING: class_id is empty! character.class_id=' + this.state.character.class_id + ', currentClass=' + (this.state.currentClass ? this.state.currentClass.id : 'null'));
                        } else {
                            console.log('[Players HUD] Including class in JSON: ' + classId);
                        }
                        
                        // Build character data as JSON object
                        const characterJSON = {
                            class_id: classId,
                            stats: this.state.character.stats || {},
                            health: this.state.character.health || { current: 0, base: 0, max: 0 },
                            stamina: this.state.character.stamina || { current: 0, base: 0, max: 0 },
                            mana: this.state.character.mana || { current: 0, base: 0, max: 0 },
                            xp_total: this.state.character.xp_total || 0,
                            has_mana: this.state.character.has_mana || false,
                            species_factors: this.state.character.species_factors || { health_factor: 25, stamina_factor: 25, mana_factor: 25 }
                        };
                        
                        // Convert to JSON string and encode for URL
                        const jsonString = JSON.stringify(characterJSON);
                        const currentUrl = new URL(window.location.href);
                        const encodedData = encodeURIComponent(jsonString);
                        currentUrl.searchParams.set('char_data', encodedData);
                        currentUrl.searchParams.set('char_data_ts', Date.now().toString());
                        
                        // Update URL without reloading - LSL will poll and see this
                        window.history.replaceState({}, '', currentUrl.toString());
                        console.log('[Players HUD] Updated URL with character data as JSON (length: ' + jsonString.length + ')');
                        console.log('[Players HUD] Character data in URL: ' + encodedData.substring(0, 100) + '...');
                    } catch (e) {
                        console.error('[Players HUD] Failed to update URL with character data:', e);
                    }
                }, 1000);  // Wait 1 second for character to be fully loaded
            } else {
                console.log('[Players HUD] No character found - cannot send character data to LSL');
            }
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
     * Load all necessary data from server
     */
    async loadData() {
        try {
            DebugLog.log('loadData() called', 'debug');
            UI.setConnectionStatus(true);
            
            DebugLog.log('Starting API calls...', 'debug');
            const startTime = Date.now();
            
            // SL browser compatibility: Use sequential calls instead of Promise.all
            // Promise.all() may not work reliably in SL's embedded browser
            let speciesResult, classesResult, vocationsResult, gendersResult;
            
            if (window.IS_SL_BROWSER) {
                DebugLog.log('Using sequential API calls for SL browser compatibility', 'debug');
                DebugLog.log('Loading species...', 'info');
                speciesResult = await API.getSpecies();
                DebugLog.log('Loading classes...', 'info');
                classesResult = await API.getClasses();
                DebugLog.log('Loading vocations...', 'info');
                vocationsResult = await API.getVocations();
                DebugLog.log('Loading genders...', 'info');
                gendersResult = await API.getGenders();
            } else {
                DebugLog.log('Using parallel API calls (Promise.all)', 'debug');
                // Load templates in parallel for regular browsers
                [speciesResult, classesResult, vocationsResult, gendersResult] = await Promise.all([
                    API.getSpecies(),
                    API.getClasses(),
                    API.getVocations(),
                    API.getGenders()
                ]);
            }
            
            const loadTime = Date.now() - startTime;
            DebugLog.log(`API calls completed in ${loadTime}ms`, 'debug');
            DebugLog.log(`Species: ${speciesResult.success ? 'OK' : 'FAIL'} (${speciesResult.data?.species?.length || 0} items)`, speciesResult.success ? 'info' : 'error');
            DebugLog.log(`Classes: ${classesResult.success ? 'OK' : 'FAIL'} (${classesResult.data?.classes?.length || 0} items)`, classesResult.success ? 'info' : 'error');
            DebugLog.log(`Genders: ${gendersResult.success ? 'OK' : 'FAIL'} (${gendersResult.data?.genders?.length || 0} items)`, gendersResult.success ? 'info' : 'error');
            if (speciesResult.error) DebugLog.log('Species error: ' + speciesResult.error, 'error');
            if (classesResult.error) DebugLog.log('Classes error: ' + classesResult.error, 'error');
            if (gendersResult.error) DebugLog.log('Genders error: ' + gendersResult.error, 'error');
            
            // Check for errors
            if (!speciesResult.success) {
                console.error('Failed to load species:', speciesResult.error);
            }
            if (!classesResult.success) {
                console.error('Failed to load classes:', classesResult.error);
            }
            if (!vocationsResult.success) {
                console.error('Failed to load vocations:', vocationsResult.error);
            }
            if (!gendersResult.success) {
                console.error('Failed to load genders:', gendersResult.error);
            }
            
            this.state.species = speciesResult.data?.species || [];
            this.state.classes = classesResult.data?.classes || [];
            this.state.vocations = vocationsResult.data?.vocations || [];
            this.state.genders = gendersResult.data?.genders || [];
            
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
                const charsResult = await API.listCharacters();
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
                    
                    // If user has multiple characters, show selector
                    if (characters.length > 1) {
                        await this.loadCharacterSelector(characters);
                    }
                    
                    // Load first character by default (or selected character)
                    const characterId = this.state.selectedCharacterId || characters[0].id;
                    const charResult = await API.getCharacterById(characterId);
                    
                    if (charResult.success) {
                        const character = charResult.data.character;
                        
                        // SECURITY: Double-check ownership before using character data
                        if (character.owner_uuid !== API.uuid) {
                            console.error('SECURITY VIOLATION: Character owner_uuid does not match current user');
                            UI.showToast('Access denied: Character ownership mismatch', 'error');
                            this.state.character = null;
                            this.state.isNewCharacter = true;
                        } else {
                            this.state.character = character;
                            this.state.isNewCharacter = false;
                            
                            // Ensure resource pools are properly structured
                            if (!this.state.character.health || typeof this.state.character.health !== 'object') {
                                this.state.character.health = { current: 100, base: 100, max: 100 };
                            }
                            if (!this.state.character.stamina || typeof this.state.character.stamina !== 'object') {
                                this.state.character.stamina = { current: 100, base: 100, max: 100 };
                            }
                            if (!this.state.character.mana || typeof this.state.character.mana !== 'object') {
                                this.state.character.mana = { current: 50, base: 50, max: 50 };
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
                            
                            console.log('Character loaded:', this.state.character);
                            
                            // Load inventory (Inventory v2 - pagination)
                            const pageSize = 50;
                            const page = 1;
                            const result = await API.getInventoryPage(this.state.character.id, page, pageSize);
                            const items = result.items || [];
                            this.state.inventory = items;
                            
                            // Broadcast character data to Players HUD via Setup HUD
                            // This happens automatically when character loads
                            this.broadcastCharacterToPlayersHUD(this.state.character);
                        }
                    }
                } else {
                    // No character found - ready for creation
                    console.log('[loadData] No characters found in result. charsResult.data:', charsResult.data);
                    this.state.character = null;
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
            DebugLog.log('renderAll() completed', 'debug');
            
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
                this.state.character = this.createDefaultCharacter();
                this.state.character.universe_id = universeId;
                
                // Switch to Character tab and show universe selection
                UI.switchTab('character');
                await this.renderAll();
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
        
        // Build URL with credentials
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        params.set('uuid', API.uuid);
        if (API.username) params.set('username', API.username);
        if (API.displayName) params.set('displayname', API.displayName);
        if (API.hudChannel) params.set('channel', API.hudChannel.toString());
        
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
     * Load character selector dropdown
     */
    async loadCharacterSelector(characters) {
        const selector = document.getElementById('character-selector');
        if (!selector) return;
        
        selector.innerHTML = '';
        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = `${char.name || 'Unnamed'} (${char.universe_id || 'default'})`;
            if (char.id === this.state.selectedCharacterId || (!this.state.selectedCharacterId && characters.indexOf(char) === 0)) {
                option.selected = true;
                this.state.selectedCharacterId = char.id;
            }
            selector.appendChild(option);
        });
        
        selector.style.display = characters.length > 1 ? 'block' : 'none';
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
                            this.state.selectedUniverseId = e.target.value;
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
                            // Re-render to update filtered identity options
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
     * Create a default character template for new characters
     */
    createDefaultCharacter() {
        const defaultStats = this.getDefaultStats();
        const species = this.state.species.find(s => s.id === 'human') || { 
            health_factor: 25, 
            stamina_factor: 25, 
            mana_factor: 25,
            mana_chance: 10 
        };
        
        // Roll for mana based on species chance
        const hasMana = this.rollManaChance(species);
        
        // Calculate base resource pools from stats with species factors
        const baseHealth = this.calculateHealth(defaultStats, species);
        const baseStamina = this.calculateStamina(defaultStats, species);
        const baseMana = this.calculateMana(defaultStats, species, hasMana);
        
        return {
            name: '',
            title: '',
            gender: 'unspecified',
            species_id: 'human',
            class_id: 'commoner',
            xp_total: 100,
            xp_available: 100,
            currency: 50,
            stat_points_available: 5,  // Starting stat points to allocate
            stats: defaultStats,
            inventory: [],
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
     * Get default stats object
     * All stats start at 2 (matching F3 system)
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
     * Render all UI components
     */
    async renderAll() {
        DebugLog.log('renderAll() called', 'debug');
        DebugLog.log(`State: ${this.state.species.length} species, ${this.state.classes.length} classes, ${this.state.genders.length} genders`, 'debug');
        const char = this.state.character;
        
        // Show/hide new character banner
        const newCharBanner = document.getElementById('new-character-banner');
        if (newCharBanner) {
            // Show banner if no character exists in Firestore (isNewCharacter is true)
            // This means the character hasn't been saved yet
            const shouldShow = this.state.isNewCharacter;
            newCharBanner.style.display = shouldShow ? 'block' : 'none';
        }
        
        // Show/hide universe selection (only for new characters)
        const universeGroup = document.getElementById('universe-selection-group');
        if (universeGroup) {
            universeGroup.style.display = this.state.isNewCharacter ? 'block' : 'none';
            
            // Load available universes if showing
            if (this.state.isNewCharacter) {
                this.loadAvailableUniverses();
            }
        }
        
        // Find current species, class, and vocation (use full lists for lookup)
        this.state.currentSpecies = this.state.species.find(s => s.id === char?.species_id);
        this.state.currentClass = this.state.classes.find(c => c.id === char?.class_id);
        this.state.currentVocation = this.state.currentClass ? 
            this.state.vocations.find(v => v.id === this.state.currentClass.vocation_id) : null;
        
        // Filter identity options by universe
        let filteredGenders = this.state.genders;
        let filteredSpecies = this.state.species;
        let filteredClasses = this.state.classes;
        
        if (char && char.universe_id) {
            // Get filtered options for the character's universe
            const filteredResult = await API.getFilteredIdentityOptions(char.universe_id);
            if (filteredResult.success) {
                filteredGenders = filteredResult.data.genders;
                filteredSpecies = filteredResult.data.species;
                filteredClasses = filteredResult.data.classes;
            }
        } else if (this.state.isNewCharacter && this.state.selectedUniverseId) {
            // For new characters, filter by selected universe
            const filteredResult = await API.getFilteredIdentityOptions(this.state.selectedUniverseId);
            if (filteredResult.success) {
                filteredGenders = filteredResult.data.genders;
                filteredSpecies = filteredResult.data.species;
                filteredClasses = filteredResult.data.classes;
            }
        }
        
        // Render gender selection
        DebugLog.log(`Rendering gender selection with ${filteredGenders.length} genders`, 'debug');
        UI.renderGenderSelection(filteredGenders, char?.gender);
        
        // Render species gallery
        DebugLog.log(`Rendering species gallery with ${filteredSpecies.length} species`, 'debug');
        UI.renderSpeciesGallery(filteredSpecies, char?.species_id);
        
        // Render career gallery
        DebugLog.log(`Rendering career gallery with ${filteredClasses.length} classes`, 'debug');
        UI.renderCareerGallery(filteredClasses, char?.class_id, char);
        
        // Render current career with career path
        UI.renderCurrentCareer(this.state.currentClass, this.state.currentVocation, char);
        
        // Get current stats (don't override on every render - that was wiping manual changes)
        let stats = char?.stats || this.getDefaultStats();
        
        // Get stat caps (minimum of species and class caps)
        const caps = this.calculateStatCaps();
        
        // Calculate available points using the F3-style exponential system
        const availablePoints = char ? window.calculateAvailablePoints(char) : 20;
        
        // Render stats grid with points
        UI.renderStatsGrid(stats, caps, availablePoints);
        
        // Render vocation
        UI.renderVocation(this.state.currentVocation, stats);
        
        // Render character summary
        await UI.renderCharacterSummary(char, this.state.currentSpecies, this.state.currentClass);
        
        // Recalculate resource pools based on current stats before rendering
        if (char) {
            this.recalculateResourcePools();
            // Broadcast updated character data to Players HUD so globes update
            this.broadcastCharacterToPlayersHUD(char);
        }
        
        // Render Players HUD (resource bars, XP progress, and action slots)
        UI.renderResourceBars(char);
        UI.renderXPProgress(char);
        UI.renderActionSlots(char);
        
        // Render inventory (Inventory v2 - subcollection)
        UI.renderInventory(this.state.inventory);
        
        // Load and render inventory if inventory tab is active
        const inventoryTab = document.getElementById('tab-inventory');
        if (inventoryTab && inventoryTab.classList.contains('active')) {
            await this.loadInventory();
        }
        
        // Update active mode button in Options tab
        const currentMode = char?.mode || 'roleplay';
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
        
        // Update form fields
        if (char) {
            UI.elements.charName.value = char.name || '';
            UI.elements.charTitle.value = char.title || '';
            UI.selectGender(char.gender || 'unspecified');
            UI.elements.currencyAmount.textContent = char.currency || 0;
        }
    },
    
    /**
     * Load and display inventory (read-only) for the current character's universe
     */
    async loadInventory() {
        try {
            // Get character ID from current character
            const characterId = this.state.character?.id;
            
            if (!characterId) {
                console.warn('[loadInventory] No character selected');
                if (UI.elements.inventoryGrid) {
                    UI.elements.inventoryGrid.innerHTML = '<p class="placeholder-text">Select or create a character to view inventory.</p>';
                }
                return;
            }
            
            const pageSize = 50;
            const page = 1;
            console.log('[loadInventory] Calling API.getInventoryPage() for character:', characterId, 'page:', page);
            const result = await API.getInventoryPage(characterId, page, pageSize);
            const items = result.items || [];
            console.log('[loadInventory] Items:', items);
            
            // getInventoryPage returns { items, page, totalPages }
            if (Array.isArray(items)) {
                console.log('[loadInventory] Success! Items count:', items.length);
                this.state.inventory = items;
                UI.renderInventory(items);
            } else {
                console.error('[loadInventory] getInventoryPage did not return items array');
                if (UI.elements.inventoryGrid) {
                    UI.elements.inventoryGrid.innerHTML = '<p class="placeholder-text" style="color: var(--error);">Failed to load inventory: Invalid response format</p>';
                }
            }
        } catch (error) {
            console.error('[loadInventory] Error loading inventory:', error);
            if (UI.elements.inventoryGrid) {
                UI.elements.inventoryGrid.innerHTML = '<p class="placeholder-text" style="color: var(--error);">Error loading inventory</p>';
            }
        }
    },
    
    /**
     * Drop a single item (remove 1 quantity)
     * @param {string} itemId - Item ID to drop
     * @param {number} quantity - Quantity to drop (default 1)
     */
    async dropItem(itemId, quantity = 1) {
        if (!this.state.character || !this.state.character.id) {
            console.warn('[dropItem] No character selected');
            return;
        }
        
        if (!itemId) {
            console.warn('[dropItem] No item ID provided');
            return;
        }
        
        try {
            console.log('[dropItem] Dropping', quantity, 'of', itemId);
            const result = await API.removeItem(this.state.character.id, itemId, quantity);
            
            if (result.success) {
                // Refresh inventory
                await this.loadInventory();
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast(`Dropped ${quantity} ${itemId}`, 'success', 2000);
                }
            } else {
                console.error('[dropItem] Failed:', result.error);
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast(`Failed to drop item: ${result.error}`, 'error', 3000);
                }
            }
        } catch (error) {
            console.error('[dropItem] Error:', error);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Error dropping item', 'error', 3000);
            }
        }
    },
    
    /**
     * Remove an item completely (remove full quantity)
     * @param {string} itemId - Item ID to remove
     * @param {number} quantity - Full quantity to remove
     */
    async removeItem(itemId, quantity) {
        if (!this.state.character || !this.state.character.id) {
            console.warn('[removeItem] No character selected');
            return;
        }
        
        if (!itemId) {
            console.warn('[removeItem] No item ID provided');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            console.warn('[removeItem] Invalid quantity');
            return;
        }
        
        try {
            console.log('[removeItem] Removing', quantity, 'of', itemId);
            const result = await API.removeItem(this.state.character.id, itemId, quantity);
            
            if (result.success) {
                // Refresh inventory
                await this.loadInventory();
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast(`Deleted ${itemId}`, 'success', 2000);
                }
            } else {
                console.error('[removeItem] Failed:', result.error);
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast(`Failed to delete item: ${result.error}`, 'error', 3000);
                }
            }
        } catch (error) {
            console.error('[removeItem] Error:', error);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Error deleting item', 'error', 3000);
            }
        }
    },
    
    /**
     * Bulk delete all checked items
     */
    async bulkDeleteItems() {
        if (!this.state.character || !this.state.character.id) {
            console.warn('[bulkDeleteItems] No character selected');
            return;
        }
        
        // Get all checked items
        const checkedBoxes = document.querySelectorAll('.inventory-item-checkbox:checked');
        if (checkedBoxes.length === 0) {
            console.warn('[bulkDeleteItems] No items selected');
            return;
        }
        
        const itemsToDelete = [];
        checkedBoxes.forEach(checkbox => {
            const itemId = checkbox.dataset.itemId;
            const itemQty = parseInt(checkbox.dataset.itemQty || '0', 10);
            if (itemId && itemQty > 0) {
                itemsToDelete.push({ id: itemId, qty: itemQty });
            }
        });
        
        if (itemsToDelete.length === 0) {
            console.warn('[bulkDeleteItems] No valid items to delete');
            return;
        }
        
        try {
            console.log('[bulkDeleteItems] Deleting', itemsToDelete.length, 'items');
            
            // Delete all items sequentially
            let successCount = 0;
            let failCount = 0;
            
            for (const item of itemsToDelete) {
                const result = await API.removeItem(this.state.character.id, item.id, item.qty);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.error('[bulkDeleteItems] Failed to delete', item.id, ':', result.error);
                }
            }
            
            // Refresh inventory
            await this.loadInventory();
            
            // Show result toast
            if (typeof UI !== 'undefined' && UI.showToast) {
                if (failCount === 0) {
                    UI.showToast(`Deleted ${successCount} item(s)`, 'success', 2000);
                } else {
                    UI.showToast(`Deleted ${successCount} item(s), ${failCount} failed`, 'warning', 3000);
                }
            }
        } catch (error) {
            console.error('[bulkDeleteItems] Error:', error);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Error during bulk delete', 'error', 3000);
            }
        }
    },
    
    /**
     * Calculate combined stat caps from species and class
     */
    calculateStatCaps() {
        const caps = {};
        const statNames = Object.keys(this.getDefaultStats());
        
        statNames.forEach(stat => {
            const speciesCap = this.state.currentSpecies?.stat_caps?.[stat] || 9;
            const classCap = this.state.currentClass?.stat_maximums?.[stat] || 9;
            caps[stat] = Math.min(speciesCap, classCap);
        });
        
        return caps;
    },
    
    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        // Character name input
        UI.elements.charName?.addEventListener('input', async (e) => {
            this.state.character.name = e.target.value;
            this.state.pendingChanges.name = e.target.value;
            await this.renderAll();
        });
        
        // Character title input
        UI.elements.charTitle?.addEventListener('input', async (e) => {
            this.state.character.title = e.target.value;
            this.state.pendingChanges.title = e.target.value;
            await this.renderAll();
        });
        
        // Save button
        UI.elements.btnSave?.addEventListener('click', () => this.saveCharacter());
        
        // Challenge Test button (renamed from "Roll")
        UI.elements.btnRoll?.addEventListener('click', () => this.showChallengeTestDialog());
        
        // Refresh button
        UI.elements.btnRefresh?.addEventListener('click', () => this.loadData());
        
        // Players HUD buttons
        UI.elements.btnRest?.addEventListener('click', () => this.handleRest());
        UI.elements.btnReset?.addEventListener('click', () => this.handleResetResources());
        UI.elements.btnMode?.addEventListener('click', () => this.showModeDialog());
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
        
        // Character selector dropdown
        document.getElementById('character-selector')?.addEventListener('change', async (e) => {
            const characterId = e.target.value;
            if (characterId) {
                this.state.selectedCharacterId = characterId;
                await this.loadData();
            }
        });
        
        document.getElementById('btn-edit-character-options')?.addEventListener('click', () => {
            // Switch to Character tab
            UI.switchTab('character');
        });
        
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.handleModeChange(mode);
            });
        });
        
        // Display options
        document.getElementById('btn-show-bars')?.addEventListener('click', () => {
            this.handleShowBars();
        });
        
        document.getElementById('btn-hide-bars')?.addEventListener('click', () => {
            this.handleHideBars();
        });
        
        // Quick actions
        document.getElementById('btn-ooc-reset')?.addEventListener('click', () => {
            this.handleOOCReset();
        });
        
        document.getElementById('btn-ic-rest')?.addEventListener('click', () => {
            this.handleICRest();
        });
        
        document.getElementById('btn-stop-resting')?.addEventListener('click', () => {
            this.handleStopResting();
        });
    },
    
    // exitSetupHUD() and sendCloseSetupMessage() removed - exit button no longer exists
    // Use rp_options prim in Second Life to toggle Setup HUD visibility
    
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
        const hasMana = this.state.character.has_mana !== undefined ? this.state.character.has_mana : this.rollManaChance(species);
        
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
            // Update max values, keep current if it's valid
            this.state.character.health.max = baseHealth;
            this.state.character.health.base = baseHealth;
            if (this.state.character.health.current > baseHealth) {
                this.state.character.health.current = baseHealth;
            }
        }
        
        if (!this.state.character.stamina) {
            this.state.character.stamina = { current: baseStamina, base: baseStamina, max: baseStamina };
        } else {
            this.state.character.stamina.max = baseStamina;
            this.state.character.stamina.base = baseStamina;
            if (this.state.character.stamina.current > baseStamina) {
                this.state.character.stamina.current = baseStamina;
            }
        }
        
        if (!this.state.character.mana) {
            this.state.character.mana = { current: baseMana, base: baseMana, max: baseMana };
        } else {
            this.state.character.mana.max = baseMana;
            this.state.character.mana.base = baseMana;
            if (this.state.character.mana.current > baseMana) {
                this.state.character.mana.current = baseMana;
            }
        }
    },
    
    /**
     * Handle Rest action (restore health/stamina over time)
     */
    handleRest() {
        if (!this.state.character) return;
        
        UI.showToast('Resting... (+1 Health/Stamina every 5 seconds)', 'info');
        
        // TODO: Implement actual rest mechanics with timer
        // For now, just restore a small amount
        if (this.state.character.health.current < this.state.character.health.max) {
            this.state.character.health.current = Math.min(
                this.state.character.health.max,
                this.state.character.health.current + 10
            );
        }
        if (this.state.character.stamina.current < this.state.character.stamina.max) {
            this.state.character.stamina.current = Math.min(
                this.state.character.stamina.max,
                this.state.character.stamina.current + 10
            );
        }
        
        UI.renderResourceBars(this.state.character);
    },
    
    /**
     * Handle Reset Resources action (full restore)
     */
    handleResetResources() {
        if (!this.state.character) return;
        
        if (!confirm('Reset all resources to maximum? This will restore Health, Stamina, and Mana to full.')) {
            return;
        }
        
        this.state.character.health.current = this.state.character.health.max;
        this.state.character.stamina.current = this.state.character.stamina.max;
        this.state.character.mana.current = this.state.character.mana.max;
        
        UI.renderResourceBars(this.state.character);
        UI.showToast('Resources reset to maximum', 'success');
    },
    
    /**
     * Show mode selection dialog
     */
    showModeDialog() {
        const currentMode = this.state.character?.mode || 'roleplay';
        const modes = [
            { id: 'roleplay', name: 'Roleplay', icon: '🎭' },
            { id: 'tournament', name: 'Tournament', icon: '⚔️' },
            { id: 'ooc', name: 'OOC', icon: '💬' },
            { id: 'afk', name: 'AFK', icon: '😴' }
        ];
        
        const content = `
            <h2>Change Mode</h2>
            <div class="mode-selection">
                ${modes.map(mode => `
                    <button class="action-btn ${currentMode === mode.id ? 'primary' : ''}" 
                            data-mode="${mode.id}" 
                            style="width: 100%; margin-bottom: var(--space-sm);">
                        ${mode.icon} ${mode.name}
                    </button>
                `).join('')}
            </div>
        `;
        
        UI.showModal(content);
        
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.state.character.mode = mode;
                this.state.pendingChanges.mode = mode;
                UI.hideModal();
                UI.showToast(`Mode changed to ${modes.find(m => m.id === mode)?.name}`, 'success');
            });
        });
    },
    
    /**
     * Handle mode change from Options tab
     */
    handleModeChange(mode) {
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
     * Handle OOC reset
     */
    handleOOCReset() {
        if (!confirm('Reset character resources? This will restore Health, Stamina, and Mana to maximum.')) {
            return;
        }
        this.sendToLSL('OOC_RESET', {});
        UI.showToast('Character resources reset', 'success');
    },
    
    /**
     * Handle IC rest
     */
    handleICRest() {
        this.sendToLSL('IC_REST', {});
        UI.showToast('Resting...', 'info');
    },
    
    /**
     * Handle stop resting
     */
    handleStopResting() {
        this.sendToLSL('STOP_RESTING', {});
        UI.showToast('Stopped resting', 'info');
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
        
        // Build command message for LSL
        let message = command;
        if (data && Object.keys(data).length > 0) {
            const dataStr = Object.entries(data).map(([k, v]) => k + ":" + v).join(",");
            message += "|" + dataStr;
        }
        
        // Store command in URL so LSL can poll for it
        try {
            const currentUrl = new URL(window.location.href);
            const encodedCmd = encodeURIComponent(message);
            currentUrl.searchParams.set('lsl_cmd', encodedCmd);
            currentUrl.searchParams.set('lsl_cmd_ts', Date.now().toString());
            
            // Update URL without reloading
            window.history.replaceState({}, '', currentUrl.toString());
            console.log('[LSL] Command stored in URL:', command);
        } catch (e) {
            console.error('[LSL] Failed to store command in URL:', e);
        }
    },
    
    /**
     * Save character to server
     */
    async saveCharacter() {
        try {
            const char = this.state.character;
            
            // Validate character
            if (!char.name || char.name.trim() === '') {
                UI.showToast('Please enter a character name', 'warning');
                return;
            }
            
            if (!char.species_id) {
                UI.showToast('Please select a species', 'warning');
                return;
            }
            
            UI.showToast('Saving...', 'info', 1000);
            
            // Determine if this is a new character or an update
            // Check if character has an ID - if it does, it's an existing character
            const isNewCharacter = this.state.isNewCharacter && !char.id;
            
            if (isNewCharacter) {
                // Validate universe selection
                if (!this.state.selectedUniverseId) {
                    UI.showToast('Please select a universe', 'warning');
                    return;
                }
                
                // Get universe to check registration code and other settings
                const universeResult = await API.getUniverse(this.state.selectedUniverseId);
                if (!universeResult.success) {
                    UI.showToast('Failed to load universe data', 'error');
                    return;
                }
                const universe = universeResult.data.universe;
                
                // Validate registration code if required
                if (universe.registrationCode && universe.registrationCode.trim() !== '') {
                    const registrationInput = document.getElementById('universe-registration-code');
                    const registrationCode = registrationInput ? registrationInput.value.trim() : '';
                    if (!registrationCode) {
                        UI.showToast('Registration code is required for this universe', 'warning');
                        return;
                    }
                    if (universe.registrationCode !== registrationCode) {
                        UI.showToast('Invalid registration code', 'error');
                        return;
                    }
                }
                
                // Validate character limit
                const limitCheck = await API.validateCharacterLimit(this.state.selectedUniverseId, API.uuid);
                if (!limitCheck.success || !limitCheck.data.allowed) {
                    UI.showToast(`Character limit reached for this universe (${limitCheck.data.currentCount}/${limitCheck.data.limit})`, 'error');
                    return;
                }
                
                // Validate identity options against universe allowed lists
                const identityCheck = await API.validateIdentityOptions(
                    this.state.selectedUniverseId,
                    char.gender,
                    char.species_id,
                    char.class_id
                );
                if (!identityCheck.success || !identityCheck.data.valid) {
                    UI.showToast('Selected identity options are not allowed in this universe: ' + identityCheck.data.errors.join(', '), 'error');
                    return;
                }
                
                // Get species to check mana rule (only if universe allows mana)
                const species = this.state.species.find(s => s.id === char.species_id);
                const hasMana = universe.manaEnabled && species && App.rollManaChance(species);
                
                // Create new character
                console.log('[saveCharacter] Creating new character with data:', {
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    species_id: char.species_id,
                    class_id: char.class_id,
                    universe_id: this.state.selectedUniverseId,
                    has_mana: hasMana
                });
                
                const result = await API.createCharacter({
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    species_id: char.species_id,
                    class_id: char.class_id,
                    universe_id: this.state.selectedUniverseId,
                    has_mana: hasMana
                });
                
                console.log('[saveCharacter] createCharacter result:', result);
                
                if (!result) {
                    UI.showToast('Failed to create character: No response from server', 'error');
                    console.error('[saveCharacter] createCharacter returned null/undefined');
                    return;
                }
                
                if (!result.success) {
                    UI.showToast('Failed to create character: ' + (result.error || 'Unknown error'), 'error');
                    console.error('[saveCharacter] createCharacter failed:', result.error);
                    return;
                }
                
                if (!result.data) {
                    UI.showToast('Failed to create character: Invalid response from server (no data)', 'error');
                    console.error('[saveCharacter] createCharacter returned success but no data:', result);
                    return;
                }
                
                if (!result.data.character) {
                    UI.showToast('Failed to create character: Invalid response from server (no character)', 'error');
                    console.error('[saveCharacter] createCharacter returned success but no character:', result);
                    return;
                }
                
                this.state.character = result.data.character;
                this.state.isNewCharacter = false;
                this.state.selectedCharacterId = result.data.character.id; // Set selected character ID
                UI.showToast('Character created!', 'success');
            } else {
                // Update existing character
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
                
                const result = await API.updateCharacter({
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    stats: char.stats,
                    class_id: classId
                });
                
                console.log('[saveCharacter] updateCharacter result:', result);
                
                if (!result) {
                    UI.showToast('Failed to update character: No response from server', 'error');
                    console.error('[saveCharacter] updateCharacter returned null/undefined');
                    return;
                }
                
                if (!result.success) {
                    UI.showToast('Failed to update character: ' + (result.error || 'Unknown error'), 'error');
                    console.error('[saveCharacter] updateCharacter failed:', result.error);
                    return;
                }
                
                if (!result.data) {
                    UI.showToast('Failed to update character: Invalid response from server (no data)', 'error');
                    console.error('[saveCharacter] updateCharacter returned success but no data:', result);
                    return;
                }
                
                if (!result.data.character) {
                    UI.showToast('Failed to update character: Invalid response from server (no character)', 'error');
                    console.error('[saveCharacter] updateCharacter returned success but no character:', result);
                    return;
                }
                
                this.state.character = result.data.character;
                // Update currentClass after save to ensure it's in sync
                if (this.state.character.class_id) {
                    this.state.currentClass = this.state.classes.find(c => c.id === this.state.character.class_id);
                }
                UI.showToast('Character saved!', 'success');
                
                // Force update CHARACTER_DATA in URL after save to ensure LSL gets the class
                // Wait a moment for state to update, then trigger heartbeat
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
                            xp_total: this.state.character.xp_total || 0,
                            has_mana: this.state.character.has_mana || false,
                            species_factors: this.state.character.species_factors || { health_factor: 25, stamina_factor: 25, mana_factor: 25 }
                        };
                        
                        // Convert to JSON string and encode for URL
                        const jsonString = JSON.stringify(characterJSON);
                        const currentUrl = new URL(window.location.href);
                        const encodedData = encodeURIComponent(jsonString);
                        currentUrl.searchParams.set('char_data', encodedData);
                        currentUrl.searchParams.set('char_data_ts', Date.now().toString());
                        window.history.replaceState({}, '', currentUrl.toString());
                        console.log('[Save] Updated CHARACTER_DATA in URL as JSON with class: ' + classId);
                    }
                }, 500);
            }
            
            this.state.pendingChanges = {};
            await this.renderAll();
            
        } catch (error) {
            console.error('Save failed:', error);
            UI.showToast('Failed to save: ' + error.message, 'error');
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
     * Show admin panel
     */
    showAdminPanel(panel) {
        const adminContent = UI.elements.adminContent;
        if (!adminContent) return;
        
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
            case 'vocations':
                this.showTemplateManager('vocations');
                break;
            case 'xp':
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
    showXPAward() {
        const adminContent = UI.elements.adminContent;
        
        adminContent.innerHTML = `
            <h3>Award XP</h3>
            <div class="form-group">
                <label for="xp-target">Target Player UUID</label>
                <input type="text" id="xp-target" placeholder="Enter player UUID...">
            </div>
            <div class="form-group">
                <label for="xp-amount">XP Amount (negative to deduct)</label>
                <input type="number" id="xp-amount" value="100">
            </div>
            <div class="form-group">
                <label for="xp-reason">Reason</label>
                <input type="text" id="xp-reason" placeholder="Reason for award...">
            </div>
            <button class="action-btn primary" id="btn-award-xp">⭐ Award XP</button>
        `;
        
        document.getElementById('btn-award-xp')?.addEventListener('click', async () => {
            const target = document.getElementById('xp-target').value;
            const amount = parseInt(document.getElementById('xp-amount').value);
            const reason = document.getElementById('xp-reason').value;
            
            if (!target || !amount) {
                UI.showToast('Please fill in all fields', 'warning');
                return;
            }
            
            try {
                await API.awardXP(target, amount, reason);
                UI.showToast(`Awarded ${amount} XP!`, 'success');
            } catch (error) {
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
        
        // Check permissions
        if (!API.canCreateUniverse()) {
            UI.showError(adminContent, 'Unauthorized: You do not have permission to manage universes.');
            return;
        }
        
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
                    <button class="btn btn-primary" id="btn-create-universe">➕ Create Universe</button>
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
                    if (confirm('Are you sure you want to delete this universe? All characters in this universe will be reassigned to the Default Universe.')) {
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
     * @param {string} type - 'careers', 'classes', 'species', or 'genders'
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
                <button class="tab-btn" data-tab="careers">Careers</button>
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
            case 'careers':
                await this.showUniverseCareersTab(tabContent, universeId, universe, isEdit);
                break;
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
                    Identity options are now managed in separate tabs: Careers, Classes, Species, and Genders.
                </p>
            </div>
        `;
    },
    
    /**
     * Careers Tab - Two-panel checkbox UI
     */
    async showUniverseCareersTab(container, universeId, universe, isEdit) {
        if (!isEdit) {
            container.innerHTML = '<p style="color: var(--text-muted);">Save the universe first to manage careers.</p>';
            return;
        }
        
        // Get universes the user can manage (for selector)
        const universesResult = await API.listUniversesForAdmin();
        const userUniverses = universesResult.success ? universesResult.data.universes.filter(u => 
            u.ownerAdminId === API.uuid || API.role === 'sys_admin' || API.uuid === API.SUPER_ADMIN_UUID
        ) : [];
        
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
        const userUniverses = universesResult.success ? universesResult.data.universes.filter(u => 
            u.ownerAdminId === API.uuid || API.role === 'sys_admin' || API.uuid === API.SUPER_ADMIN_UUID
        ) : [];
        
        // Get all classes
        const classesResult = await API.getClasses();
        const allClasses = classesResult.success ? classesResult.data.classes : [];
        
        // Get allowed classes for this universe
        const allowedClasses = universe?.allowedClasses || [];
        
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
                <button class="btn btn-secondary" id="btn-class-admin" style="margin-top: 24px;">ADMIN</button>
            </div>
            
            <div id="universe-classes-panels"></div>
            
            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="btn-save-classes">Save Changes</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Render two-panel UI
        this.renderUniverseIdentityPanels('classes', allClasses, allowedClasses, 'universe-classes-panels');
        
        // Bind universe selector
        document.getElementById('universe-class-selector')?.addEventListener('change', async (e) => {
            const selectedUniverseId = e.target.value;
            const result = await API.getUniverse(selectedUniverseId);
            if (result.success) {
                const selectedUniverse = result.data.universe;
                this.renderUniverseIdentityPanels('classes', allClasses, selectedUniverse.allowedClasses || [], 'universe-classes-panels');
                this.currentUniverseId = selectedUniverseId;
                this.currentUniverseData = selectedUniverse;
            }
        });
        
        // Bind save button
        document.getElementById('btn-save-classes')?.addEventListener('click', async () => {
            const checked = this.getCheckedItems('universe-allowed-classes');
            const result = await API.updateUniverse(this.currentUniverseId, { allowedClasses: checked });
            if (result.success) {
                UI.showToast('Classes updated!', 'success');
                // Reload universe data
                const reloadResult = await API.getUniverse(this.currentUniverseId);
                if (reloadResult.success) {
                    this.currentUniverseData = reloadResult.data.universe;
                    this.renderUniverseIdentityPanels('classes', allClasses, this.currentUniverseData.allowedClasses || [], 'universe-classes-panels');
                }
            } else {
                UI.showToast('Failed to update classes: ' + result.error, 'error');
            }
        });
        
        // Bind admin button
        document.getElementById('btn-class-admin')?.addEventListener('click', () => {
            this.showTemplateManager('classes');
        });
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
        const userUniverses = universesResult.success ? universesResult.data.universes.filter(u => 
            u.ownerAdminId === API.uuid || API.role === 'sys_admin' || API.uuid === API.SUPER_ADMIN_UUID
        ) : [];
        
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
        const userUniverses = universesResult.success ? universesResult.data.universes.filter(u => 
            u.ownerAdminId === API.uuid || API.role === 'sys_admin' || API.uuid === API.SUPER_ADMIN_UUID
        ) : [];
        
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
     */
    async saveUniverseFromTabs(universeId) {
        try {
            // Collect data from all tabs
            const name = document.getElementById('universe-name')?.value.trim();
            if (!name) {
                UI.showToast('Name is required', 'warning');
                return;
            }
            
            const universeData = {
                name: name,
                description: document.getElementById('universe-description')?.value.trim() || '',
                theme: document.getElementById('universe-theme')?.value.trim() || '',
                roleplayType: document.getElementById('universe-roleplay-type')?.value.trim() || '',
                imageUrl: document.getElementById('universe-image-url')?.value.trim() || '',
                groupSlurl: document.getElementById('universe-group-slurl')?.value.trim() || '',
                welcomeSlurl: document.getElementById('universe-welcome-slurl')?.value.trim() || '',
                maturityRating: document.getElementById('universe-maturity-rating')?.value || 'general',
                visibility: document.getElementById('universe-visibility')?.value || 'public',
                acceptNewPlayers: document.getElementById('universe-accept-new-players')?.value || 'open',
                characterLimit: parseInt(document.getElementById('universe-character-limit')?.value) || 0,
                manaEnabled: document.getElementById('universe-mana-enabled')?.checked !== false
            };
            
            // Handle active state (not for default universe)
            if (universeId !== 'default') {
                universeData.active = document.getElementById('universe-active')?.checked !== false;
            }
            
            // Handle signup key
            const signupKey = document.getElementById('universe-signup-key')?.value.trim();
            
            // For default universe, only include maturityRating if user is Super User
            if (universeId === 'default' && API.uuid !== API.SUPER_ADMIN_UUID) {
                delete universeData.maturityRating;
            }
            
            let result;
            if (universeId) {
                // Update existing
                if (signupKey) {
                    await API.setSignupKey(universeId, signupKey);
                } else if (document.getElementById('universe-accept-new-players')?.value !== 'key') {
                    await API.clearSignupKey(universeId);
                }
                
                result = await API.updateUniverse(universeId, universeData);
            } else {
                // Create new
                universeData.active = false;
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
            // Collect form data
            const name = document.getElementById('universe-name').value.trim();
            if (!name) {
                UI.showToast('Name is required', 'warning');
                return;
            }
            
            // Collect allowed lists (empty array if all checked, array of IDs if some unchecked)
            const allGenderIds = Array.from(document.querySelectorAll('.universe-allowed-gender')).map(cb => cb.value);
            const checkedGenderIds = Array.from(document.querySelectorAll('.universe-allowed-gender:checked')).map(cb => cb.value);
            const allowedGenders = checkedGenderIds.length === allGenderIds.length ? [] : checkedGenderIds;
            
            const allSpeciesIds = Array.from(document.querySelectorAll('.universe-allowed-species')).map(cb => cb.value);
            const checkedSpeciesIds = Array.from(document.querySelectorAll('.universe-allowed-species:checked')).map(cb => cb.value);
            const allowedSpecies = checkedSpeciesIds.length === allSpeciesIds.length ? [] : checkedSpeciesIds;
            
            const allClassIds = Array.from(document.querySelectorAll('.universe-allowed-classes')).map(cb => cb.value);
            const checkedClassIds = Array.from(document.querySelectorAll('.universe-allowed-classes:checked')).map(cb => cb.value);
            const allowedClasses = checkedClassIds.length === allClassIds.length ? [] : checkedClassIds;
            
            const universeData = {
                name: name,
                description: document.getElementById('universe-description').value.trim(),
                theme: document.getElementById('universe-theme').value.trim(),
                roleplayType: document.getElementById('universe-roleplay-type').value.trim(),
                imageUrl: document.getElementById('universe-image-url').value.trim(),
                groupSlurl: document.getElementById('universe-group-slurl').value.trim(),
                welcomeSlurl: document.getElementById('universe-welcome-slurl').value.trim(),
                maturityRating: document.getElementById('universe-maturity-rating')?.value || 'general',
                visibility: document.getElementById('universe-visibility').value,
                acceptNewPlayers: document.getElementById('universe-accept-new-players').value,
                characterLimit: parseInt(document.getElementById('universe-character-limit').value) || 0,
                manaEnabled: document.getElementById('universe-mana-enabled').checked,
                allowedGenders: allowedGenders,
                allowedSpecies: allowedSpecies,
                allowedClasses: allowedClasses,
                allowedCareers: [] // TODO: Add careers when implemented
            };
            
            // Handle signup key
            const signupKey = document.getElementById('universe-signup-key').value.trim();
            
            // For default universe, only include maturityRating if user is Super User
            if (universeId === 'default' && API.uuid !== API.SUPER_ADMIN_UUID) {
                delete universeData.maturityRating;
            }
            
            // Handle active state (not for default universe)
            if (universeId !== 'default') {
                universeData.active = document.getElementById('universe-active').checked;
            }
            
            let result;
            if (universeId) {
                // Update existing
                // Handle signup key separately if provided
                if (signupKey) {
                    await API.setSignupKey(universeId, signupKey);
                } else if (document.getElementById('universe-accept-new-players').value !== 'key') {
                    // Clear key if not using key access
                    await API.clearSignupKey(universeId);
                }
                
                result = await API.updateUniverse(universeId, universeData);
            } else {
                // Create new
                universeData.active = false; // New universes are inactive by default
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
                    if (confirm('Remove this admin from the universe?')) {
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
     * Show dialog to add universe admin
     */
    async showAddUniverseAdminDialog(universeId) {
        const uuid = prompt('Enter the UUID of the user to add as admin:');
        if (!uuid || !uuid.trim()) return;
        
        const role = confirm('Make this user the owner? (OK = Owner, Cancel = Admin)') ? 'owner' : 'admin';
        
        try {
            const result = await API.assignUniverseAdmin(universeId, uuid.trim(), role);
            if (result.success) {
                UI.showToast('Admin added successfully', 'success');
                this.loadUniverseAdmins(universeId);
            } else {
                UI.showToast('Failed to add admin: ' + result.error, 'error');
            }
        } catch (error) {
            UI.showToast('Error adding admin: ' + error.message, 'error');
        }
    },
    
    /**
     * Show template manager for species, classes, or genders
     */
    async showTemplateManager(type) {
        const adminContent = UI.elements.adminContent;
        UI.showLoading(adminContent, `Loading ${type}...`);
        
        try {
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
            
            adminContent.innerHTML = `
                <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                    <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Management (${templates.length})</h3>
                    <div style="display: flex; gap: var(--space-sm);">
                        ${type === 'classes' ? `
                            <button class="action-btn" id="btn-sync-free-advances" title="Sync free advances with prerequisites">🔄 Sync Free Advances</button>
                            <button class="action-btn" id="btn-export-${type}" title="Export to CSV">📥 Export CSV</button>
                            <label class="action-btn" for="file-input-${type}" style="cursor: pointer;" title="Import from CSV">
                                📤 Import CSV
                                <input type="file" id="file-input-${type}" accept=".csv" style="display: none;">
                            </label>
                        ` : ''}
                        <button class="action-btn primary" id="btn-new-${type}">+ New ${typeSingular}</button>
                    </div>
                </div>
                ${type === 'classes' ? `
                <div style="background: var(--bg-dark); padding: var(--space-sm); border-radius: 4px; margin-bottom: var(--space-md); font-size: 0.9em; color: var(--text-secondary);">
                    <strong>📝 CSV Format Note:</strong> When editing prerequisites or free_advances, use <strong>semicolons (;)</strong> to separate multiple values, not commas. 
                    Example: <code>courtier;scholar;monk</code> (not <code>courtier,scholar,monk</code>)
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
            
            // Export CSV button (classes only)
            if (type === 'classes') {
                document.getElementById(`btn-export-${type}`)?.addEventListener('click', () => {
                    this.exportClassesToCSV(templates);
                });
                
                // Sync Free Advances button
                document.getElementById('btn-sync-free-advances')?.addEventListener('click', () => {
                    this.syncFreeAdvances(templates);
                });
                
                // Import CSV button
                const fileInput = document.getElementById(`file-input-${type}`);
                if (fileInput) {
                    fileInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            this.importClassesFromCSV(file);
                            // Reset input so same file can be selected again
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
                    if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
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
                    <button class="action-btn edit-template" data-type="${type}" data-id="${template.id}">✏️ Edit</button>
                    <button class="action-btn delete-template" data-type="${type}" data-id="${template.id}" style="background: var(--error);">🗑️ Delete</button>
                </div>
            </div>
        `;
    },
    
    /**
     * Show template editor modal
     */
    showTemplateEditor(type, template) {
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
        const s = species || { 
            id: '', name: '', icon: '', description: '', image: '',
            stat_minimums: {}, stat_maximums: {}, base_stats: {},
            health: 100, stamina: 100, mana: 50
        };
        
        const statNames = F4_SEED_DATA.statNames || [];
        
        return `
            <div class="form-group">
                <label>ID (unique identifier)</label>
                <input type="text" id="template-id" value="${s.id}" ${species ? 'readonly' : ''} 
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
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="template-description" rows="3" 
                          placeholder="Description..." style="width: 100%;">${s.description || ''}</textarea>
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
        const c = cls || {
            id: '', name: '', icon: '', description: '', image: '',
            vocation_id: '', stat_maximums: {},
            prerequisite: null, free_advances: [], xp_cost: 0
        };
        
        const allClasses = this.state.classes || [];
        const allVocations = this.state.vocations || [];
        
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
                       placeholder="classes/id.png" style="width: 100%;">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="template-description" rows="3" 
                          placeholder="Description..." style="width: 100%;">${c.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Vocation</label>
                <select id="template-vocation-id" style="width: 100%;">
                    <option value="">None</option>
                    ${allVocations.map(v => `<option value="${v.id}" ${c.vocation_id === v.id ? 'selected' : ''}>${v.name}</option>`).join('')}
                </select>
            </div>
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
                <textarea id="template-stat-minimums" rows="3" 
                          placeholder='{"fighting": 3, "endurance": 2}' style="width: 100%; font-family: monospace;">${JSON.stringify(c.stat_minimums || {}, null, 2)}</textarea>
                <small style="color: var(--text-muted);">Stats character must have at or above these values to qualify for this class</small>
            </div>
            <div class="form-group">
                <label>Stat Maximums (JSON object) - Stat caps in this class</label>
                <textarea id="template-stat-maximums" rows="4" 
                          placeholder='{"fighting": 7, "endurance": 6}' style="width: 100%; font-family: monospace;">${JSON.stringify(c.stat_maximums || {}, null, 2)}</textarea>
            </div>
        `;
    },
    
    /**
     * Save template (create or update)
     */
    async saveTemplate(type, existingTemplate) {
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
                
                // Parse JSON fields
                try {
                    templateData.base_stats = JSON.parse(document.getElementById('template-base-stats')?.value || '{}');
                    templateData.stat_minimums = JSON.parse(document.getElementById('template-stat-minimums')?.value || '{}');
                    templateData.stat_maximums = JSON.parse(document.getElementById('template-stat-maximums')?.value || '{}');
                } catch (e) {
                    UI.showToast('Invalid JSON in stat fields', 'error');
                    return;
                }
            } else if (type === 'classes') {
                templateData.vocation_id = document.getElementById('template-vocation-id')?.value || '';
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
            
            // Confirm import
            const confirmed = confirm(
                `Import ${classes.length} classes?\n\n` +
                `This will update existing classes and create new ones.\n` +
                `Classes not in the CSV will remain unchanged.`
            );
            
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
            
            const confirmed = confirm(
                `Update ${updates.length} classes?\n\n` +
                `Preview:\n${preview}${more}\n\n` +
                `This will add classes that require each class as a prerequisite to their free_advances.`
            );
            
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
        if (!character || !this.lsl.channel) {
            return; // No character or no channel available
        }
        
        // Build character data as JSON object
        // Get class_id - check both character.class_id and currentClass.id
        let classId = character.class_id || "";
        if (!classId && this.state.currentClass) {
            classId = this.state.currentClass.id || "";
            console.log('[Broadcast] Using currentClass.id as fallback: ' + classId);
        }
        if (!classId) {
            console.warn('[Broadcast] WARNING: class_id is empty! character.class_id=' + character.class_id + ', currentClass=' + (this.state.currentClass ? this.state.currentClass.id : 'null'));
        } else {
            console.log('[Broadcast] Including class in JSON: ' + classId);
        }
        
        // Create JSON object with all character data
        const characterJSON = {
            class_id: classId,
            stats: character.stats || {},
            health: character.health || { current: 0, base: 0, max: 0 },
            stamina: character.stamina || { current: 0, base: 0, max: 0 },
            mana: character.mana || { current: 0, base: 0, max: 0 },
            xp_total: character.xp_total || 0,
            has_mana: character.has_mana || false,
            species_factors: character.species_factors || { health_factor: 25, stamina_factor: 25, mana_factor: 25 }
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(characterJSON);
        console.log('[Players HUD Sync] Broadcasting character data as JSON:', jsonString);
        
        // Encode JSON in URL so LSL can read it via llGetPrimMediaParams
        // LSL will poll the MOAP URL and extract the data
        try {
            const currentUrl = new URL(window.location.href);
            // Encode the JSON (URL-encode it)
            const encodedData = encodeURIComponent(jsonString);
            currentUrl.searchParams.set('char_data', encodedData);
            currentUrl.searchParams.set('char_data_ts', Date.now().toString());
            
            // Update URL - this will be detected by LSL polling
            window.history.replaceState({}, '', currentUrl.toString());
            console.log('[Players HUD Sync] Character data encoded as JSON in URL for LSL to read');
            
            // Also try to send via llRegionSay if available (some MOAP implementations expose this)
            if (window.llRegionSay && typeof window.llRegionSay === 'function') {
                try {
                    window.llRegionSay(this.lsl.channel, message);
                    console.log('[Players HUD Sync] Character data sent via llRegionSay');
                } catch (e) {
                    console.log('[Players HUD Sync] llRegionSay not available, using URL polling only');
                }
            }
        } catch (e) {
            console.log('[Players HUD Sync] URL update failed:', e);
        }
        
        // Also update hash as backup signal
        try {
            window.location.hash = 'char_data_' + Date.now();
        } catch (e) {
            console.log('[Players HUD Sync] Hash update not available');
        }
        
        console.log('[Players HUD Sync] Character data ready - LSL will retrieve via URL polling');
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
    App.state.character.species_id = speciesId;
    App.state.pendingChanges.species_id = speciesId;
    
    // Get species data
    const species = App.state.species.find(s => s.id === speciesId);
    
    // Only reset stats to species base when species CHANGES on a new character
    if (App.state.isNewCharacter && species?.base_stats && speciesId !== previousSpeciesId) {
        // Apply species base_stats (this includes bonuses and penalties)
        // Start with default stats, then apply species overrides
        const defaultStats = App.getDefaultStats();
        const speciesStats = species.base_stats || {};
        
        // Merge: use species base_stats where provided, otherwise use defaults
        const mergedStats = { ...defaultStats };
        Object.keys(speciesStats).forEach(stat => {
            mergedStats[stat] = speciesStats[stat];
        });
        
        App.state.character.stats = mergedStats;
        App.state.pendingChanges.stats = mergedStats;
        UI.showToast(`Stats set to ${species.name} base values`, 'info', 2000);
    }
    
    // Update species factors and roll mana for new characters
    if (App.state.isNewCharacter && species) {
        // Store species factors for LSL
        App.state.character.species_factors = {
            health_factor: species.health_factor || 25,
            stamina_factor: species.stamina_factor || 25,
            mana_factor: species.mana_factor || 25
        };
        
        // Roll for mana based on species chance (only for new characters and if universe allows mana)
        // Get universe to check manaEnabled
        let universeManaEnabled = true;
        if (App.state.isNewCharacter && App.state.selectedUniverseId) {
            const universeResult = await API.getUniverse(App.state.selectedUniverseId);
            if (universeResult.success) {
                universeManaEnabled = universeResult.data.universe.manaEnabled !== false;
            }
        }
        
        const hasMana = universeManaEnabled && App.rollManaChance(species);
        App.state.character.has_mana = hasMana;
        
        if (hasMana && universeManaEnabled) {
            // Show prominent notification for mana
            UI.showModal(`
                <div class="modal-content">
                    <h2 class="modal-title" style="color: #10b981;">✨ Magical Ability Unlocked!</h2>
                    <p class="modal-text" style="font-size: 1.1em; margin: var(--space-md) 0;">
                        As a <strong>${species.name}</strong>, you have been blessed with magical ability!
                    </p>
                    <p class="modal-text">
                        Your character has <strong style="color: #10b981;">mana</strong> and will be able to select an <strong>arcane career</strong>.
                    </p>
                    <p class="modal-text" style="color: var(--text-muted); font-size: 0.9em;">
                        You can now learn and use spells. Classes that require mana will be available to you.
                    </p>
                    <div class="modal-actions">
                        <button class="btn btn-primary modal-ok-btn">Excellent!</button>
                    </div>
                </div>
            `);
            document.querySelector('.modal-ok-btn')?.addEventListener('click', () => UI.closeModal());
        } else if (!hasMana && universeManaEnabled) {
            // Show notification that they did NOT get mana
            UI.showModal(`
                <div class="modal-content">
                    <h2 class="modal-title" style="color: #ef4444;">❌ No Magical Ability</h2>
                    <p class="modal-text" style="font-size: 1.1em; margin: var(--space-md) 0;">
                        As a <strong>${species.name}</strong>, you did <strong style="color: #ef4444;">not</strong> gain magical ability.
                    </p>
                    <p class="modal-text">
                        Your character does <strong>not have mana</strong> and <strong>cannot select an arcane career</strong>.
                    </p>
                    <p class="modal-text" style="color: var(--text-muted); font-size: 0.9em; margin-top: var(--space-md);">
                        If you want to pursue an arcane career, try creating a <strong>NEW CHARACTER</strong> again until you get one with mana.
                    </p>
                    <div class="modal-actions">
                        <button class="btn btn-primary modal-ok-btn">Understood</button>
                    </div>
                </div>
            `);
            document.querySelector('.modal-ok-btn')?.addEventListener('click', () => UI.closeModal());
        } else {
            // Universe doesn't allow mana
            UI.showToast(`${species.name} - This universe does not allow magical abilities.`, 'info', 2000);
        }
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
    
    const classTemplate = App.state.classes.find(c => c.id === classId);
    if (!classTemplate) return;
    
    // For new characters without a class, just set it directly
    if (!App.state.character.class_id && App.state.isNewCharacter) {
        App.state.character.class_id = classId;
        App.state.character.stats_at_class_start = { ...App.state.character.stats };
        App.state.character.class_started_at = new Date().toISOString();
        App.state.pendingChanges.class_id = classId;
        App.state.pendingChanges.stats_at_class_start = { ...App.state.character.stats };
        App.state.pendingChanges.class_started_at = App.state.character.class_started_at;
        
        await App.renderAll();
        UI.showToast(`Class selected: ${classTemplate.name}`, 'success', 1500);
        return;
    }
    
    // For existing characters, use the changeClass API for career tracking
    try {
        const result = await API.changeClass(classId, classTemplate, isFreeAdvance);
        
        if (result.success) {
            // Reload character to get updated career history
            const charResult = await API.getCharacter();
            if (charResult.success) {
                App.state.character = charResult.data.character;
            }
            App.state.currentClass = classTemplate;
            App.state.pendingChanges = {};
            
            await App.renderAll();
            UI.showToast(result.data.message, 'success', 2000);
        } else {
            UI.showToast(result.error || 'Failed to change class', 'error');
        }
    } catch (error) {
        console.error('Class change error:', error);
        UI.showToast('Error changing class', 'error');
    }
};

/**
 * Called when a gender is selected
 */
window.onGenderSelected = async function(gender) {
    if (!App.state.character) return;
    
    App.state.character.gender = gender;
    App.state.pendingChanges.gender = gender;
    
    // Update visual selection
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gender === gender);
    });
    
    await App.renderAll();
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
 * Calculate point cost to increase from current level
 * Uses exponential formula: 2^(level-1)
 * Level 1→2: 1pt, 2→3: 2pt, 3→4: 4pt, etc.
 */
window.getStatPointCost = function(fromLevel) {
    return Math.pow(2, fromLevel - 1);
};

/**
 * Calculate total points spent on a stat at a given level
 * Sum of costs from level 2 to current level
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
 * Calculate available points from XP
 * Base: 20 points (20000 XP equivalent)
 * Conversion: 1000 XP = 1 point
 */
window.calculateAvailablePoints = function(character) {
    const BASE_POINTS = 20; // Everyone starts with 20 points
    const XP_PER_POINT = 1000;
    
    // Calculate points from earned XP
    const earnedXP = character.xp_total || 0;
    const earnedPoints = Math.floor(earnedXP / XP_PER_POINT);
    
    // Calculate points spent on stats
    let pointsSpent = 0;
    const stats = character.stats || {};
    for (const stat in stats) {
        const level = stats[stat] || 2;
        pointsSpent += window.getStatTotalCost(level);
    }
    
    return BASE_POINTS + earnedPoints - pointsSpent;
};

/**
 * Called when a stat is changed
 */
window.onStatChange = async function(stat, action) {
    if (!App.state.character) return;
    
    const currentValue = App.state.character.stats[stat] || 2;
    const caps = App.calculateStatCaps();
    const max = Math.min(caps[stat] || 9, 9);
    
    // Calculate available points
    const availablePoints = window.calculateAvailablePoints(App.state.character);
    
    if (action === 'increase') {
        if (currentValue >= max) {
            UI.showToast(`Stat capped at ${max} for your class`, 'warning');
            return;
        }
        
        const cost = window.getStatPointCost(currentValue);
        if (availablePoints < cost) {
            UI.showToast(`Need ${cost} points (have ${availablePoints})`, 'warning');
            return;
        }
        
        App.state.character.stats[stat] = currentValue + 1;
        App.state.pendingChanges.stats = App.state.character.stats;
        UI.showToast(`+1 ${stat} (cost: ${cost} pts)`, 'info', 1500);
        
    } else if (action === 'decrease') {
        // Can lower ANY stat to 1 (not species base in F4)
        if (currentValue <= 1) {
            UI.showToast('Cannot go below 1', 'warning');
            return;
        }
        
        const refund = window.getStatPointCost(currentValue - 1);
        App.state.character.stats[stat] = currentValue - 1;
        App.state.pendingChanges.stats = App.state.character.stats;
        UI.showToast(`-1 ${stat} (refund: ${refund} pts)`, 'info', 1500);
    }
    
    await App.renderAll();
};

// =========================== INITIALIZATION =============================

// Initialize app when DOM is ready
// Use regular function instead of arrow function for SL browser compatibility
document.addEventListener('DOMContentLoaded', function() {
    if (typeof App !== 'undefined' && typeof App.init === 'function') {
        App.init();
    } else {
        if (window.simpleDebug) {
            window.simpleDebug('ERROR: App.init not available on DOMContentLoaded', 'error');
        }
    }
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function() {
        if (typeof App !== 'undefined' && typeof App.init === 'function') {
            App.init();
        }
    }, 100);
}

