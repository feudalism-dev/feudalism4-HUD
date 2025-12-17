// ============================================================================
// Feudalism 4 - Main Application
// ============================================================================
// Orchestrates the HUD interface, connecting API and UI modules
// ============================================================================

const App = {
    // Application state
    state: {
        character: null,
        species: [],
        classes: [],
        vocations: [],
        currentSpecies: null,
        currentClass: null,
        currentVocation: null,
        pendingChanges: {},
        isNewCharacter: false
    },
    
    /**
     * Initialize the application
     */
    async init() {
        console.log('Feudalism 4 HUD initializing...');
        
        // Initialize modules
        API.init();
        UI.init();
        
        // Update UI based on role
        UI.updateRoleUI(API.role);
        
        // Load initial data
        await this.loadData();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Start heartbeat
        this.startHeartbeat();
        
        console.log('Feudalism 4 HUD ready');
    },
    
    /**
     * Load all necessary data from server
     */
    async loadData() {
        try {
            UI.setConnectionStatus(true);
            
            // Load templates in parallel
            const [speciesResult, classesResult, vocationsResult] = await Promise.all([
                API.getSpecies(),
                API.getClasses(),
                API.getVocations()
            ]);
            
            this.state.species = speciesResult.data.species || [];
            this.state.classes = classesResult.data.classes || [];
            this.state.vocations = vocationsResult.data.vocations || [];
            
            console.log('Templates loaded:', {
                species: this.state.species.length,
                classes: this.state.classes.length,
                vocations: this.state.vocations.length
            });
            
            // Try to load existing character
            try {
                const charResult = await API.getCharacter();
                this.state.character = charResult.data.character;
                this.state.isNewCharacter = false;
                console.log('Character loaded:', this.state.character);
            } catch (error) {
                // No character exists, prepare for creation
                console.log('No existing character, ready for creation');
                this.state.isNewCharacter = true;
                this.state.character = this.createDefaultCharacter();
            }
            
            // Render UI
            this.renderAll();
            
        } catch (error) {
            console.error('Failed to load data:', error);
            UI.setConnectionStatus(false);
            UI.showToast('Failed to connect to server', 'error');
        }
    },
    
    /**
     * Create a default character template for new characters
     */
    createDefaultCharacter() {
        return {
            name: '',
            title: '',
            gender: 'unspecified',
            species_id: 'human',
            class_id: 'commoner',
            xp_total: 100,
            xp_available: 100,
            currency: 50,
            stats: this.getDefaultStats(),
            inventory: []
        };
    },
    
    /**
     * Get default stats object
     */
    getDefaultStats() {
        const statNames = [
            'fighting', 'agility', 'awareness', 'strength', 'endurance',
            'will', 'intellect', 'charisma', 'perception', 'stealth',
            'crafting', 'survival', 'medicine', 'arcana', 'faith',
            'persuasion', 'intimidation', 'athletics', 'acrobatics', 'luck'
        ];
        const stats = {};
        statNames.forEach(stat => stats[stat] = 1);
        return stats;
    },
    
    /**
     * Render all UI components
     */
    renderAll() {
        const char = this.state.character;
        
        // Find current species, class, and vocation
        this.state.currentSpecies = this.state.species.find(s => s.id === char?.species_id);
        this.state.currentClass = this.state.classes.find(c => c.id === char?.class_id);
        this.state.currentVocation = this.state.currentClass ? 
            this.state.vocations.find(v => v.id === this.state.currentClass.vocation_id) : null;
        
        // Render species gallery
        UI.renderSpeciesGallery(this.state.species, char?.species_id);
        
        // Render career gallery
        UI.renderCareerGallery(this.state.classes, char?.class_id, char);
        
        // Render current career
        UI.renderCurrentCareer(this.state.currentClass, this.state.currentVocation);
        
        // Apply species base stats if new character
        let stats = char?.stats || this.getDefaultStats();
        if (this.state.isNewCharacter && this.state.currentSpecies?.base_stats) {
            stats = { ...this.state.currentSpecies.base_stats };
            this.state.character.stats = stats;
        }
        
        // Get stat caps (minimum of species and class caps)
        const caps = this.calculateStatCaps();
        
        // Render stats grid
        UI.renderStatsGrid(stats, caps, char?.xp_available || 0);
        
        // Render vocation
        UI.renderVocation(this.state.currentVocation, stats);
        
        // Render character summary
        UI.renderCharacterSummary(char, this.state.currentSpecies, this.state.currentClass);
        
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
        
        // Roll button
        UI.elements.btnRoll?.addEventListener('click', () => this.showRollDialog());
        
        // Refresh button
        UI.elements.btnRefresh?.addEventListener('click', () => this.loadData());
        
        // Admin buttons
        document.querySelectorAll('.admin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.showAdminPanel(e.target.dataset.admin);
            });
        });
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
     * Show roll dialog
     */
    showRollDialog() {
        const stats = Object.keys(this.state.character?.stats || {});
        
        const content = `
            <h2>Skill Test</h2>
            <div class="form-group">
                <label for="roll-stat">Stat to Test</label>
                <select id="roll-stat">
                    ${stats.map(s => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="roll-difficulty">Difficulty (DC)</label>
                <input type="number" id="roll-difficulty" value="10" min="1" max="100">
            </div>
            <button class="action-btn primary" id="btn-execute-roll">🎲 Roll!</button>
            <div id="roll-result" style="margin-top: 16px;"></div>
        `;
        
        UI.showModal(content);
        
        // Bind roll button
        document.getElementById('btn-execute-roll')?.addEventListener('click', async () => {
            const stat = document.getElementById('roll-stat').value;
            const difficulty = parseInt(document.getElementById('roll-difficulty').value) || 10;
            
            try {
                const result = await API.rollTest(stat, difficulty);
                const data = result.data;
                
                document.getElementById('roll-result').innerHTML = `
                    <div class="roll-result-box" style="background: var(--bg-dark); padding: 16px; border-radius: 8px;">
                        <p><strong>Rolls:</strong> [${data.all_rolls.join(', ')}]</p>
                        <p><strong>Base Total:</strong> ${data.roll_total}</p>
                        ${data.vocation_bonus > 0 ? `<p><strong>Vocation (${data.vocation_name}):</strong> +${data.vocation_bonus}</p>` : ''}
                        <p><strong>Final Result:</strong> ${data.final_result} vs DC ${data.difficulty}</p>
                        <p style="font-size: 1.5rem; color: ${data.success ? 'var(--success)' : 'var(--error)'}">
                            ${data.success ? '✓ SUCCESS' : '✗ FAILURE'} (${data.margin >= 0 ? '+' : ''}${data.margin})
                        </p>
                        ${data.explosions > 0 ? `<p>💥 ${data.explosions} explosion${data.explosions > 1 ? 's' : ''}!</p>` : ''}
                        ${data.peasants_prayer ? `<p>🙏 Peasant's Prayer!</p>` : ''}
                    </div>
                `;
            } catch (error) {
                UI.showToast('Roll failed: ' + error.message, 'error');
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
            
            adminContent.innerHTML = `
                <h3>User Management (${users.length} users)</h3>
                <div class="user-list" style="max-height: 400px; overflow-y: auto;">
                    ${users.map(u => `
                        <div class="user-row" style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border-color);">
                            <span>${u.username} (${u.role})</span>
                            <div>
                                ${u.uuid !== API.uuid ? `
                                    <select class="role-select" data-uuid="${u.uuid}" style="margin-right: 8px;">
                                        <option value="player" ${u.role === 'player' ? 'selected' : ''}>Player</option>
                                        <option value="sim_admin" ${u.role === 'sim_admin' ? 'selected' : ''}>Sim Admin</option>
                                        ${API.role === 'sys_admin' ? `<option value="sys_admin" ${u.role === 'sys_admin' ? 'selected' : ''}>Sys Admin</option>` : ''}
                                    </select>
                                    <button class="ban-btn action-btn" data-uuid="${u.uuid}" data-banned="${!u.banned}">
                                        ${u.banned ? 'Unban' : 'Ban'}
                                    </button>
                                ` : '(You)'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Bind role change events
            adminContent.querySelectorAll('.role-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    try {
                        await API.promoteUser(e.target.dataset.uuid, e.target.value);
                        UI.showToast('Role updated', 'success');
                    } catch (error) {
                        UI.showToast('Failed: ' + error.message, 'error');
                    }
                });
            });
            
            // Bind ban buttons
            adminContent.querySelectorAll('.ban-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    try {
                        await API.banUser(e.target.dataset.uuid, e.target.dataset.banned === 'true');
                        UI.showToast('User updated', 'success');
                        this.showUserManagement(); // Refresh
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
     * Show template manager
     */
    showTemplateManager(type) {
        const adminContent = UI.elements.adminContent;
        const templates = this.state[type] || [];
        
        adminContent.innerHTML = `
            <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Templates</h3>
            <div class="template-list" style="max-height: 400px; overflow-y: auto;">
                ${templates.map(t => `
                    <div class="template-row" style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border-color);">
                        <span><strong>${t.name}</strong> (${t.id})</span>
                        <div>
                            <button class="action-btn edit-template" data-type="${type}" data-id="${t.id}">Edit</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="action-btn primary" id="btn-new-template" style="margin-top: 16px;">+ New ${type.slice(0, -1)}</button>
        `;
        
        // Note: Full template editing would require more complex UI
        // This is a placeholder for the concept
        UI.showToast('Template editing coming soon', 'info');
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
    }
};

// =========================== GLOBAL CALLBACKS ===========================

/**
 * Called when a species is selected in the gallery
 */
window.onSpeciesSelected = function(speciesId) {
    if (!App.state.character) return;
    
    App.state.character.species_id = speciesId;
    App.state.pendingChanges.species_id = speciesId;
    
    // Apply species base stats if new character
    const species = App.state.species.find(s => s.id === speciesId);
    if (App.state.isNewCharacter && species?.base_stats) {
        App.state.character.stats = { ...species.base_stats };
    }
    
    App.renderAll();
    UI.showToast(`Selected: ${species?.name || speciesId}`, 'info', 1500);
};

/**
 * Called when a class is selected in the gallery
 */
window.onClassSelected = function(classId) {
    if (!App.state.character) return;
    
    const classTemplate = App.state.classes.find(c => c.id === classId);
    if (!classTemplate) return;
    
    // Check XP cost
    if (classTemplate.xp_cost > 0 && App.state.character.xp_available < classTemplate.xp_cost) {
        UI.showToast(`Insufficient XP. Need ${classTemplate.xp_cost}, have ${App.state.character.xp_available}`, 'warning');
        return;
    }
    
    App.state.character.class_id = classId;
    App.state.pendingChanges.class_id = classId;
    
    App.renderAll();
    UI.showToast(`Career: ${classTemplate.name}`, 'info', 1500);
};

/**
 * Called when a gender is selected
 */
window.onGenderSelected = function(gender) {
    if (!App.state.character) return;
    
    App.state.character.gender = gender;
    App.state.pendingChanges.gender = gender;
    App.renderAll();
};

// Bind gender buttons to global handler
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-gender]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            window.onGenderSelected(e.target.dataset.gender);
        });
    });
});

/**
 * Called when a stat is changed
 */
window.onStatChange = function(stat, action) {
    if (!App.state.character) return;
    
    const currentValue = App.state.character.stats[stat] || 1;
    const caps = App.calculateStatCaps();
    const max = caps[stat] || 9;
    
    if (action === 'increase') {
        if (currentValue >= max) {
            UI.showToast('Stat at maximum', 'warning');
            return;
        }
        
        const cost = (currentValue + 1) * 10;
        if (App.state.character.xp_available < cost) {
            UI.showToast(`Need ${cost} XP`, 'warning');
            return;
        }
        
        App.state.character.stats[stat] = currentValue + 1;
        App.state.character.xp_available -= cost;
        App.state.pendingChanges.stats = App.state.character.stats;
        
    } else if (action === 'decrease') {
        // Only allow decrease to species base or 1
        const speciesBase = App.state.currentSpecies?.base_stats?.[stat] || 1;
        if (currentValue <= speciesBase) {
            UI.showToast('Cannot decrease below species base', 'warning');
            return;
        }
        
        // Refund XP
        const refund = currentValue * 10;
        App.state.character.stats[stat] = currentValue - 1;
        App.state.character.xp_available += refund;
        App.state.pendingChanges.stats = App.state.character.stats;
    }
    
    App.renderAll();
};

// =========================== INITIALIZATION =============================

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

