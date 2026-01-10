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
        
        // Always show debug panel - make it very visible
        if (this.panel) {
            this.panel.style.display = 'block';
            this.panel.style.visibility = 'visible';
            this.log('Debug panel initialized', 'info');
        } else {
            // If panel doesn't exist, create it
            var newPanel = document.createElement('div');
            newPanel.id = 'debug-panel';
            newPanel.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 500px; max-height: 400px; background: rgba(0, 0, 0, 0.95); color: #0f0; font-family: monospace; font-size: 12px; padding: 15px; border: 3px solid #0f0; z-index: 99999; overflow-y: auto; display: block !important;';
            newPanel.innerHTML = '<div style="margin-bottom: 10px;"><strong>DEBUG LOG</strong> <button id="debug-toggle">Hide</button></div><div id="debug-content"></div>';
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
        
        // Also log to console for Chrome
        var consoleMethod = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
        console[consoleMethod](message);
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
    originalLog.apply(console, args);
    if (window.simpleDebug) {
        window.simpleDebug(args.join(' '), 'info');
    } else if (typeof DebugLog !== 'undefined' && DebugLog.enabled) {
        DebugLog.log(args.join(' '), 'info');
    }
};

console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    originalError.apply(console, args);
    if (window.simpleDebug) {
        window.simpleDebug('ERROR: ' + args.join(' '), 'error');
    } else if (typeof DebugLog !== 'undefined' && DebugLog.enabled) {
        DebugLog.log('ERROR: ' + args.join(' '), 'error');
    }
};

console.warn = function() {
    var args = Array.prototype.slice.call(arguments);
    originalWarn.apply(console, args);
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
        
        // SECURITY: Verify UUID is still set after API init (in case it was cleared)
        if (!API.uuid || API.uuid !== uuid) {
            console.error('SECURITY: UUID mismatch or missing after API init');
            return;
        }
        
        UI.init();
        
        // Initialize debug panel (if not already initialized)
        if (typeof DebugLog !== 'undefined' && !DebugLog.panel) {
            DebugLog.init();
        }
        if (typeof DebugLog !== 'undefined') {
            DebugLog.log('HUD initializing...', 'info');
        }
        
        // Store LSL data for quick access
        this.lsl.uuid = API.uuid;
        this.lsl.username = API.username;
        this.lsl.displayName = API.displayName;
        this.lsl.channel = API.hudChannel;
        this.lsl.connected = !!API.uuid;
        
        // Initialize super admin if this is the super admin UUID
        if (API.uuid === API.SUPER_ADMIN_UUID) {
            await API.initializeSuperAdmin();
            console.log('Super Admin initialized');
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
                        const health = this.state.character.health || { current: 0, base: 0, max: 0 };
                        const stamina = this.state.character.stamina || { current: 0, base: 0, max: 0 };
                        const mana = this.state.character.mana || { current: 0, base: 0, max: 0 };
                        const factors = this.state.character.species_factors || { health_factor: 25, stamina_factor: 25, mana_factor: 25 };
                        
                        // Build compact character data string for URL
                        let charData = "CHARACTER_DATA|";
                        charData += "stats:" + statsList.join(",") + "|";
                        charData += "health:" + health.current + "," + health.base + "," + health.max + "|";
                        charData += "stamina:" + stamina.current + "," + stamina.base + "," + stamina.max + "|";
                        charData += "mana:" + mana.current + "," + mana.base + "," + mana.max + "|";
                        charData += "xp:" + (this.state.character.xp_total || 0) + "|";
                        charData += "class:" + (this.state.character.class_id || "") + "|";
                        charData += "factors:" + factors.health_factor + "," + factors.stamina_factor + "," + factors.mana_factor + "|";
                        charData += "has_mana:" + (this.state.character.has_mana ? "1" : "0");
                        
                        // Update current URL with character data (keep request_data for now)
                        const currentUrl = new URL(window.location.href);
                        const encodedData = encodeURIComponent(charData.substring(0, 1800));
                        currentUrl.searchParams.set('char_data', encodedData);
                        currentUrl.searchParams.set('char_data_ts', Date.now().toString());
                        
                        // Update URL without reloading - LSL will poll and see this
                        window.history.replaceState({}, '', currentUrl.toString());
                        console.log('[Players HUD] Updated URL with character data (length: ' + charData.length + ')');
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
            
            // Try to load existing character
            // SECURITY: getCharacter() validates owner_uuid matches API.uuid
            try {
                const charResult = await API.getCharacter();
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
                        
                        // Broadcast character data to Players HUD via Setup HUD
                        // This happens automatically when character loads
                        this.broadcastCharacterToPlayersHUD(this.state.character);
                    }
                } else {
                    // No character found - ready for creation
                    this.state.character = null;
                    this.state.isNewCharacter = true;
                    console.log('No existing character, ready for creation');
                }
            } catch (error) {
                // No character exists, prepare for creation
                console.log('No existing character, ready for creation');
                this.state.isNewCharacter = true;
                this.state.character = this.createDefaultCharacter();
            }
            
            // Render UI
            DebugLog.log('Calling renderAll()...', 'debug');
            this.renderAll();
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
    renderAll() {
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
        
        // Find current species, class, and vocation
        this.state.currentSpecies = this.state.species.find(s => s.id === char?.species_id);
        this.state.currentClass = this.state.classes.find(c => c.id === char?.class_id);
        this.state.currentVocation = this.state.currentClass ? 
            this.state.vocations.find(v => v.id === this.state.currentClass.vocation_id) : null;
        
        // Render gender selection
        DebugLog.log(`Rendering gender selection with ${this.state.genders.length} genders`, 'debug');
        UI.renderGenderSelection(this.state.genders, char?.gender);
        
        // Render species gallery
        DebugLog.log(`Rendering species gallery with ${this.state.species.length} species`, 'debug');
        UI.renderSpeciesGallery(this.state.species, char?.species_id);
        
        // Render career gallery
        DebugLog.log(`Rendering career gallery with ${this.state.classes.length} classes`, 'debug');
        UI.renderCareerGallery(this.state.classes, char?.class_id, char);
        
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
        UI.renderCharacterSummary(char, this.state.currentSpecies, this.state.currentClass);
        
        // Render Players HUD (resource bars, XP progress, and action slots)
        UI.renderResourceBars(char);
        UI.renderXPProgress(char);
        UI.renderActionSlots(char);
        
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
        UI.elements.charName?.addEventListener('input', (e) => {
            this.state.character.name = e.target.value;
            this.state.pendingChanges.name = e.target.value;
            this.renderAll();
        });
        
        // Character title input
        UI.elements.charTitle?.addEventListener('input', (e) => {
            this.state.character.title = e.target.value;
            this.state.pendingChanges.title = e.target.value;
            this.renderAll();
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
        
        // EXIT Setup HUD button
        document.getElementById('btn-exit-setup')?.addEventListener('click', () => {
            this.exitSetupHUD();
        });
        
        // New Character button (old location - keep for compatibility)
        document.getElementById('btn-new-character')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
        });
        
        // Options tab buttons
        document.getElementById('btn-new-character-options')?.addEventListener('click', () => {
            this.showNewCharacterDialog();
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
    
    /**
     * Exit Setup HUD - sends CLOSE_SETUP message to LSL
     */
    exitSetupHUD() {
        // Save any pending changes first
        if (Object.keys(this.state.pendingChanges).length > 0) {
            this.saveCharacter().then(() => {
                this.sendCloseSetupMessage();
            }).catch(() => {
                // Even if save fails, close the HUD
                this.sendCloseSetupMessage();
            });
        } else {
            this.sendCloseSetupMessage();
        }
    },
    
    /**
     * Send CLOSE_SETUP message to LSL
     * In MOAP, we use llRegionSay through a workaround
     * Store message in a way LSL can detect via URL polling or direct channel access
     */
    sendCloseSetupMessage() {
        if (!this.lsl.channel) {
            console.error('No LSL channel available');
            return;
        }
        
        // Try to send via the channel using the same mechanism as other messages
        // The Combined HUD Controller listens on hudChannel for CLOSE_SETUP
        // Note: In MOAP, JavaScript can't directly call llRegionSay, but we can
        // trigger it through URL changes that LSL can detect
        
        // Store the message for LSL to retrieve
        sessionStorage.setItem('lsl_close_setup', 'true');
        sessionStorage.setItem('lsl_close_setup_timestamp', Date.now().toString());
        
        // Update URL to signal LSL (if LSL is polling)
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('close_setup', Date.now().toString());
        
        try {
            window.history.replaceState({}, '', currentUrl.toString());
            console.log('[Exit Setup] CLOSE_SETUP message queued for LSL');
            
            // Also try direct communication if available (may not work in all MOAP implementations)
            // Some MOAP implementations allow JavaScript to send messages
            if (window.llRegionSay) {
                window.llRegionSay(this.lsl.channel, 'CLOSE_SETUP');
                console.log('[Exit Setup] CLOSE_SETUP sent directly via llRegionSay');
            }
        } catch (e) {
            console.log('[Exit Setup] Using fallback method');
        }
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
            
            if (this.state.isNewCharacter) {
                // Create new character
                const result = await API.createCharacter({
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    species_id: char.species_id,
                    class_id: char.class_id
                });
                
                this.state.character = result.data.character;
                this.state.isNewCharacter = false;
                UI.showToast('Character created!', 'success');
            } else {
                // Update existing character
                const result = await API.updateCharacter({
                    name: char.name,
                    title: char.title,
                    gender: char.gender,
                    stats: char.stats,
                    class_id: char.class_id
                });
                
                this.state.character = result.data.character;
                UI.showToast('Character saved!', 'success');
            }
            
            this.state.pendingChanges = {};
            this.renderAll();
            
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
            this.renderAll();
            
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
            this.renderAll();
            
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
            this.renderAll();
            
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
        
        // Build character data message for Players HUD
        const stats = character.stats || {};
        const statsList = [
            stats.agility || 2, stats.animal_handling || 2, stats.athletics || 2,
            stats.awareness || 2, stats.crafting || 2, stats.deception || 2,
            stats.endurance || 2, stats.entertaining || 2, stats.fighting || 2,
            stats.healing || 2, stats.influence || 2, stats.intelligence || 2,
            stats.knowledge || 2, stats.marksmanship || 2, stats.persuasion || 2,
            stats.stealth || 2, stats.survival || 2, stats.thievery || 2,
            stats.will || 2, stats.wisdom || 2
        ];
        
        const health = character.health || { current: 0, base: 0, max: 0 };
        const stamina = character.stamina || { current: 0, base: 0, max: 0 };
        const mana = character.mana || { current: 0, base: 0, max: 0 };
        
        // Format: CHARACTER_DATA|stats:...|health:current,base,max|stamina:...|mana:...|xp:...|class:...|modifiers:healthMod,staminaMod|has_mana:1|0
        let message = "CHARACTER_DATA|";
        message += "stats:" + statsList.join(",") + "|";
        message += "health:" + health.current + "," + health.base + "," + health.max + "|";
        message += "stamina:" + stamina.current + "," + stamina.base + "," + stamina.max + "|";
        message += "mana:" + mana.current + "," + mana.base + "," + mana.max + "|";
        message += "xp:" + (character.xp_total || 0) + "|";
        message += "class:" + (character.class_id || "") + "|";
        // Add species factors
        const factors = character.species_factors || { health_factor: 25, stamina_factor: 25, mana_factor: 25 };
        message += "factors:" + factors.health_factor + "," + factors.stamina_factor + "," + factors.mana_factor + "|";
        message += "has_mana:" + (character.has_mana ? "1" : "0");
        
        // Send via the channel (LSL will forward to Players HUD)
        // Note: JavaScript can't directly call llRegionSay, so we use a workaround
        // The Setup HUD LSL script will listen for this and forward it
        console.log('[Players HUD Sync] Broadcasting character data:', message);
        
        // In Second Life MOAP, we can't directly send to LSL channels from JavaScript
        // However, we can trigger a URL change that LSL can detect, or use llOpenURL
        // For now, we'll store the message in a way that the Setup HUD can retrieve it
        // The Setup HUD will poll or request this data when it receives a LOAD request
        
        // Send to LSL via the channel
        // Note: In Second Life MOAP, JavaScript can't directly call llRegionSay
        // However, we can use window.postMessage or a similar mechanism
        // The Combined HUD Controller listens on hudChannel and will receive this
        // For now, we'll use a workaround: store in a way LSL can detect
        
        // Store the message in sessionStorage
        sessionStorage.setItem('character_data_sync', message);
        sessionStorage.setItem('character_data_timestamp', Date.now().toString());
        
        // Encode character data in URL so LSL can read it via llGetPrimMediaParams
        // LSL will poll the MOAP URL and extract the data
        try {
            const currentUrl = new URL(window.location.href);
            // Encode the message (truncate if too long for URL)
            const encodedData = encodeURIComponent(message.substring(0, 2000)); // URL has limits
            currentUrl.searchParams.set('char_data', encodedData);
            currentUrl.searchParams.set('char_data_ts', Date.now().toString());
            
            // Update URL - this will be detected by LSL polling
            window.history.replaceState({}, '', currentUrl.toString());
            console.log('[Players HUD Sync] Character data encoded in URL for LSL to read');
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
};

// =========================== GLOBAL CALLBACKS ===========================

/**
 * Called when a species is selected in the gallery
 */
window.onSpeciesSelected = function(speciesId) {
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
        
        // Roll for mana based on species chance (only for new characters)
        const hasMana = App.rollManaChance(species);
        App.state.character.has_mana = hasMana;
        
        if (hasMana) {
            // Show prominent notification for mana
            UI.showModal(`
                <div class="modal-content">
                    <h2 class="modal-title" style="color: #10b981;">✨ Magical Ability Unlocked!</h2>
                    <p class="modal-text" style="font-size: 1.1em; margin: var(--space-md) 0;">
                        As a <strong>${species.name}</strong>, you have been blessed with magical ability!
                    </p>
                    <p class="modal-text">
                        You can now learn and use spells. Classes that require mana will be available to you.
                    </p>
                    <div class="modal-actions">
                        <button class="btn btn-primary modal-ok-btn">Excellent!</button>
                    </div>
                </div>
            `);
            document.querySelector('.modal-ok-btn')?.addEventListener('click', () => UI.hideModal());
        } else {
            UI.showToast(`${species.name} - You do not have magical ability.`, 'info', 2000);
        }
    }
    
    // Recalculate resource pools with new species modifiers
    App.recalculateResourcePools();
    }
    
    // Recalculate resource pools based on current stats
    App.recalculateResourcePools();
    
    App.renderAll();
    UI.showToast(`Selected: ${species?.name || speciesId}`, 'info', 1500);
};

// Close App object here
};
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
        
        App.renderAll();
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
            
            App.renderAll();
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
window.onGenderSelected = function(gender) {
    if (!App.state.character) return;
    
    App.state.character.gender = gender;
    App.state.pendingChanges.gender = gender;
    
    // Update visual selection
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gender === gender);
    });
    
    App.renderAll();
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
window.onStatChange = function(stat, action) {
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
    
    App.renderAll();
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

