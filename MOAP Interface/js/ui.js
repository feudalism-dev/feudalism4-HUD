// ============================================================================
// Feudalism 4 - UI Components Module
// ============================================================================
// Handles UI rendering and interactions
// ============================================================================

const UI = {
    // Cached DOM elements
    elements: {},
    
    // Species icons mapping
    speciesIcons: {
        'human': '👤',
        'elf': '🧝',
        'dwarf': '⛏️',
        'halfling': '🍀',
        'gnome': '🔧',
        'dragonborn': '🐉',
        'half-elf': '🧝‍♂️',
        'half-orc': '👹',
        'tiefling': '😈',
        'drow': '🌑',
        'demon': '👿',
        'imp': '🦇',
        'werewolf': '🐺',
        'vampire': '🧛',
        'shapeshifter': '🦎',
        'alka_alon': '✨',
        'karshak_alon': '🌘',
        'enshadowed': '👤',
        'gurvani': '🌲',
        'merfolk': '🧜',
        'fairy': '🧚'
    },
    
    // Class icons mapping
    classIcons: {
        'commoner': '🏠',
        'soldier': '⚔️',
        'squire': '🛡️',
        'knight': '🗡️',
        'scout': '🏹',
        'merchant': '💰',
        'smith': '🔨',
        'scholar': '📚',
        'mage': '🔮',
        'priest': '✝️',
        'thief': '🗝️',
        'default': '⚔️'
    },
    
    /**
     * Initialize UI and cache DOM elements
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    },
    
    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Header
            userRole: document.getElementById('user-role'),
            connectionStatus: document.getElementById('connection-status'),
            
            // Tabs
            tabNav: document.querySelector('.tab-nav'),
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            adminTab: document.getElementById('admin-tab'),
            
            // Character tab
            charName: document.getElementById('char-name'),
            charTitle: document.getElementById('char-title'),
            genderGallery: document.getElementById('gender-gallery'),
            genderBtns: document.querySelectorAll('[data-gender]'),
            speciesGallery: document.getElementById('species-gallery'),
            charSummary: document.getElementById('char-summary'),
            
            // Stats tab
            xpAvailable: document.getElementById('xp-available'),
            statsGrid: document.getElementById('stats-grid'),
            vocationDisplay: document.getElementById('vocation-display'),
            
            // Career tab
            currentCareer: document.getElementById('current-career'),
            careerGallery: document.getElementById('career-gallery'),
            careerPath: document.getElementById('career-path'),
            
            // Players HUD tab
            resourceBars: document.getElementById('resource-bars'),
            healthValue: document.getElementById('health-value'),
            staminaValue: document.getElementById('stamina-value'),
            manaValue: document.getElementById('mana-value'),
            actionSlots: document.getElementById('action-slots'),
            btnAddActionSlot: document.getElementById('btn-add-action-slot'),
            btnRest: document.getElementById('btn-rest'),
            btnReset: document.getElementById('btn-reset'),
            btnMode: document.getElementById('btn-mode'),
            
            // Inventory tab
            currencyAmount: document.getElementById('currency-amount'),
            inventoryGrid: document.getElementById('inventory-grid'),
            
            // Admin tab
            adminContent: document.getElementById('admin-content'),
            
            // Footer
            btnSave: document.getElementById('btn-save'),
            btnRoll: document.getElementById('btn-roll'),
            btnRefresh: document.getElementById('btn-refresh'),
            
            // Modal
            modal: document.getElementById('modal'),
            modalBody: document.getElementById('modal-body'),
            modalClose: document.querySelector('.modal-close'),
            
            // Toast
            toastContainer: document.getElementById('toast-container')
        };
    },
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tab navigation
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Gender selection
        this.elements.genderBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectGender(e.target.dataset.gender);
            });
        });
        
        // Modal close
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },
    
    // =========================== TAB MANAGEMENT =========================
    
    /**
     * Switch to a specific tab
     * @param {string} tabId - ID of tab to show
     */
    switchTab(tabId) {
        // Update tab buttons
        this.elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        // Update tab content
        this.elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
        
        // Load inventory when inventory tab is shown
        if (tabId === 'inventory' && typeof App !== 'undefined' && App.loadInventory) {
            App.loadInventory();
        }
    },
    
    /**
     * Show/hide admin tab based on role
     * @param {string} role - User role
     */
    updateRoleUI(role) {
        const isAdmin = role === 'sim_admin' || role === 'sys_admin' || role === 'universe_admin';
        
        // Show/hide admin tab
        if (this.elements.adminTab) {
            this.elements.adminTab.classList.toggle('hidden', !isAdmin);
        }
        
        // Update role badge
        if (this.elements.userRole) {
            this.elements.userRole.textContent = this.formatRole(role);
            this.elements.userRole.classList.toggle('admin', isAdmin);
        }
    },
    
    /**
     * Format role for display
     */
    formatRole(role) {
        const roleNames = {
            'player': 'Player',
            'sim_admin': 'Sim Admin',
            'sys_admin': 'System Admin'
        };
        return roleNames[role] || role;
    },
    
    // =========================== SPECIES GALLERY ========================
    
    /**
     * Render species selection gallery with images
     * @param {Array} species - Array of species templates
     * @param {string} selectedId - Currently selected species ID
     */
    renderSpeciesGallery(species, selectedId = null) {
        console.log('[DEBUG] renderSpeciesGallery() called with', species?.length || 0, 'species');
        if (!this.elements.speciesGallery) {
            console.log('[DEBUG] renderSpeciesGallery() - speciesGallery element not found!');
            return;
        }
        
        this.elements.speciesGallery.innerHTML = species.map(sp => {
            const icon = sp.icon || this.speciesIcons[sp.id] || '👤';
            const hasImage = sp.image ? true : false;
            
            return `
                <div class="gallery-card ${sp.id === selectedId ? 'selected' : ''}" 
                     data-species-id="${sp.id}"
                     title="${sp.description || ''}">
                    ${hasImage ? `
                        <div class="card-image">
                            <img src="${sp.image.startsWith('images/') ? sp.image : 'images/' + sp.image}" alt="${sp.name}" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <span class="card-icon-fallback" style="display:none;">${icon}</span>
                        </div>
                    ` : `
                        <div class="card-icon">${icon}</div>
                    `}
                    <div class="card-name">${sp.name}</div>
                </div>
            `;
        }).join('');
        
        // Bind click events - show detail modal
        this.elements.speciesGallery.querySelectorAll('.gallery-card').forEach(card => {
            card.addEventListener('click', () => {
                const speciesId = card.dataset.speciesId;
                const speciesData = App.state.species.find(s => s.id === speciesId);
                if (speciesData) {
                    this.showSpeciesDetailModal(speciesData);
                }
            });
        });
    },
    
    /**
     * Show species detail modal with large image, stat ranges, and resource pools
     * @param {object} species - Species data object
     */
    showSpeciesDetailModal(species) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        if (!modal || !modalBody) return;
        
        const icon = species.icon || this.speciesIcons[species.id] || '👤';
        const imagePath = species.image ? 
            (species.image.startsWith('images/') ? species.image : 'images/' + species.image) : null;
        
        const isSelected = App.state.character?.species_id === species.id;
        
        // Build stat bonuses HTML
        const baseStats = species.base_stats || {};
        const statBonuses = Object.entries(baseStats)
            .filter(([stat, val]) => val > 2)
            .map(([stat, val]) => `<span class="stat-bonus">+${val - 2} ${this.formatStatName(stat)}</span>`)
            .join('');
        
        // Build stat limits HTML (minimums and maximums)
        const statMins = species.stat_minimums || {};
        const statMaxs = species.stat_maximums || {};
        const statLimitsHtml = [
            ...Object.entries(statMins).map(([stat, val]) => 
                `<span class="stat-min">${this.formatStatName(stat)} min: ${val}</span>`),
            ...Object.entries(statMaxs).map(([stat, val]) => 
                `<span class="stat-max">${this.formatStatName(stat)} max: ${val}</span>`)
        ].join('');
        
        // Resource pools
        const health = species.health || 100;
        const stamina = species.stamina || 100;
        const mana = species.mana || 50;
        
        modalBody.innerHTML = `
            <div class="species-detail">
                <div class="species-detail-image">
                    ${imagePath ? `
                        <img src="${imagePath}" alt="${species.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="species-detail-icon-fallback" style="display:none;">${icon}</div>
                    ` : `
                        <div class="species-detail-icon">${icon}</div>
                    `}
                </div>
                <div class="species-detail-info">
                    <h2 class="species-detail-name">${species.name}</h2>
                    <p class="species-detail-description">${species.description || 'No description available.'}</p>
                    
                    <div class="species-resources">
                        <h4>Resource Pools</h4>
                        <div class="resource-bars">
                            <div class="resource-item health">
                                <span class="resource-label">❤️ Health</span>
                                <div class="resource-bar">
                                    <div class="resource-fill" style="width: ${health}%; background: var(--crimson);"></div>
                                </div>
                                <span class="resource-value">${health}</span>
                            </div>
                            <div class="resource-item stamina">
                                <span class="resource-label">⚡ Stamina</span>
                                <div class="resource-bar">
                                    <div class="resource-fill" style="width: ${stamina}%; background: var(--gold);"></div>
                                </div>
                                <span class="resource-value">${stamina}</span>
                            </div>
                            <div class="resource-item mana">
                                <span class="resource-label">✨ Mana</span>
                                <div class="resource-bar">
                                    <div class="resource-fill" style="width: ${mana}%; background: var(--azure);"></div>
                                </div>
                                <span class="resource-value">${mana}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${statBonuses ? `
                        <div class="species-stat-bonuses">
                            <h4>Starting Stat Bonuses</h4>
                            <div class="stat-bonuses-grid">${statBonuses}</div>
                        </div>
                    ` : ''}
                    
                    ${statLimitsHtml ? `
                        <div class="species-stat-limits">
                            <h4>Stat Limits</h4>
                            <div class="stat-limits-grid">${statLimitsHtml}</div>
                        </div>
                    ` : ''}
                    
                    <div class="species-detail-actions">
                        <button class="action-btn primary species-select-btn" data-species-id="${species.id}">
                            ${isSelected ? '✓ Selected' : '✓ Select This Species'}
                        </button>
                        <button class="action-btn modal-cancel-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Bind select button
        modalBody.querySelector('.species-select-btn')?.addEventListener('click', () => {
            this.selectSpecies(species.id);
            if (typeof window.onSpeciesSelected === 'function') {
                window.onSpeciesSelected(species.id);
            }
            this.hideModal();
            this.showToast(`Selected: ${species.name}`, 'success', 2000);
        });
        
        // Bind cancel button
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
            this.hideModal();
        });
        
        modal.classList.remove('hidden');
    },
    
    /**
     * Hide the modal
     */
    hideModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },
    
    /**
     * Select a species in the gallery
     * @param {string} speciesId - Species ID to select
     */
    selectSpecies(speciesId) {
        this.elements.speciesGallery?.querySelectorAll('.gallery-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.speciesId === speciesId);
        });
    },
    
    // =========================== CAREER GALLERY =========================
    
    /**
     * Render career/class gallery with images, showing locked/completed status
     * @param {Array} classes - Array of class templates
     * @param {string} currentClassId - Currently selected class ID
     * @param {object} character - Character data for prerequisite checking
     */
    renderCareerGallery(classes, currentClassId, character = null) {
        console.log('[DEBUG] renderCareerGallery() called with', classes?.length || 0, 'classes');
        if (!this.elements.careerGallery) {
            console.log('[DEBUG] renderCareerGallery() - careerGallery element not found!');
            return;
        }
        
        // Check if character has no class (new character)
        const hasNoClass = !character || !character.class_id || character.class_id === 'commoner' || character.class_id === '';
        
        // Get completed classes from character history
        const completedClasses = character ? (API.getCompletedClasses?.(character) || []) : [];
        const careerHistory = character?.career_history || [];
        
        // List of classes that require mana
        const manaRequiredClasses = [
            'cleric', 'cultist', 'druid', 'enchanter', 'footwizard', 'hedgemage', 
            'mage', 'necromancer', 'priest', 'seer', 'shadowmage', 'shaman', 
            'sorcerer', 'spellmonger', 'thaumaturge', 'warlock', 'warmage', 
            'witch', 'wizard'
        ];
        
        // Check if character has mana
        const hasMana = character?.has_mana === true;
        
        // Separate classes into beginner and advanced, filtering mana-required classes
        const beginnerClasses = [];
        const advancedClasses = [];
        
        classes.forEach(cls => {
            // Filter out mana-required classes if character doesn't have mana
            if (manaRequiredClasses.includes(cls.id) && !hasMana) {
                return; // Skip this class
            }
            
            const prerequisites = cls.prerequisites || (cls.prerequisite ? [cls.prerequisite] : []);
            const isBeginnerClass = prerequisites.length === 0;
            
            if (isBeginnerClass) {
                beginnerClasses.push(cls);
            } else {
                advancedClasses.push(cls);
            }
        });
        
        // If character has no class, show beginner classes first, then grayed-out advanced classes
        if (hasNoClass) {
            const beginnerHtml = beginnerClasses.length > 0 ? `
                <div class="career-section">
                    <h3 class="section-title" style="margin-bottom: var(--space-md); color: var(--gold-light); font-size: 1.2em;">
                        🎓 Beginner Classes
                    </h3>
                    <div class="gallery-grid">
                        ${this.renderClassCards(beginnerClasses, currentClassId, character, completedClasses, careerHistory)}
                    </div>
                </div>
            ` : '';
            
            const advancedHtml = advancedClasses.length > 0 ? `
                <div class="career-section" style="margin-top: var(--space-lg); opacity: 0.5;">
                    <h3 class="section-title" style="margin-bottom: var(--space-md); color: var(--text-muted); font-size: 1.1em;">
                        🔒 Advanced Classes (Select a Beginner Class first)
                    </h3>
                    <div class="gallery-grid" style="pointer-events: none;">
                        ${this.renderClassCards(advancedClasses, currentClassId, character, completedClasses, careerHistory, true)}
                    </div>
                </div>
            ` : '';
            
            // Add class to indicate sections are present
            this.elements.careerGallery.classList.add('career-gallery-with-sections');
            this.elements.careerGallery.innerHTML = beginnerHtml + advancedHtml;
        } else {
            // Character has a class - show all classes normally
            // Remove sections class if it exists
            this.elements.careerGallery.classList.remove('career-gallery-with-sections');
            // Render directly into the gallery (no wrapper div needed - career-gallery is already a grid)
            this.elements.careerGallery.innerHTML = this.renderClassCards(classes, currentClassId, character, completedClasses, careerHistory);
        }
        
        // Bind click events - locked cards open modal too (to show requirements)
        this.elements.careerGallery.querySelectorAll('.gallery-card').forEach(card => {
            card.addEventListener('click', () => {
                const classId = card.dataset.classId;
                const classData = App.state.classes.find(c => c.id === classId);
                if (classData) {
                    this.showClassDetailModal(classData, character);
                }
            });
        });
    },
    
    /**
     * Render class cards (helper function for renderCareerGallery)
     */
    renderClassCards(classes, currentClassId, character, completedClasses, careerHistory, forceDisabled = false) {
        // List of classes that require mana
        const manaRequiredClasses = [
            'cleric', 'cultist', 'druid', 'enchanter', 'footwizard', 'hedgemage', 
            'mage', 'necromancer', 'priest', 'seer', 'shadowmage', 'shaman', 
            'sorcerer', 'spellmonger', 'thaumaturge', 'warlock', 'warmage', 
            'witch', 'wizard'
        ];
        
        const hasMana = character?.has_mana === true;
        
        return classes.map(cls => {
            // Check if this class requires mana and character doesn't have it
            const requiresMana = manaRequiredClasses.includes(cls.id);
            const manaLocked = requiresMana && !hasMana;
            
            const isSelected = cls.id === currentClassId;
            const isLocked = character ? !this.checkPrerequisites(cls, character) : false;
            const isCompleted = completedClasses.includes(cls.id);
            const wasVisited = careerHistory.some(h => h.class_id === cls.id);
            const icon = cls.icon || this.classIcons[cls.id] || this.classIcons.default;
            const hasImage = cls.image ? true : false;
            // Support both single prerequisite (backward compat) and multiple prerequisites
            const prerequisites = cls.prerequisites || (cls.prerequisite ? [cls.prerequisite] : []);
            const isBeginnerClass = prerequisites.length === 0;
            
            // If forceDisabled or mana-locked, treat as locked
            const isDisabled = forceDisabled || isLocked || manaLocked;
            
            // Determine card classes
            const cardClasses = [
                'gallery-card', 'career-card',
                isSelected ? 'selected' : '',
                isDisabled ? 'locked' : '',
                isCompleted ? 'completed' : '',
                wasVisited && !isCompleted ? 'visited' : '',
                isBeginnerClass ? 'beginner' : ''
            ].filter(Boolean).join(' ');
            
            // Build tooltip
            let tooltip = cls.description || '';
            if (manaLocked) {
                tooltip = '🔒 This class requires magical ability. Your species did not receive mana.';
            } else if (isLocked) {
                tooltip = '🔒 Prerequisites not met. ' + (tooltip || '');
            } else if (isDisabled && !manaLocked) {
                tooltip = 'Select a Beginner Class first';
            }
            
            return `
                <div class="${cardClasses}${isDisabled ? ' disabled' : ''}" 
                     data-class-id="${cls.id}"
                     title="${tooltip}"
                     style="${isDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    ${hasImage ? `
                        <div class="card-image">
                            <img src="${cls.image.startsWith('images/') ? cls.image : 'images/' + cls.image}" alt="${cls.name}" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <span class="card-icon-fallback" style="display:none;">${icon}</span>
                            ${isDisabled ? '<span class="card-lock-overlay">🔒</span>' : ''}
                            ${isCompleted ? '<span class="card-complete-overlay">✓</span>' : ''}
                        </div>
                    ` : `
                        <div class="card-icon">${icon}</div>
                    `}
                    <div class="card-name">${cls.name}</div>
                    <div class="card-desc">${isDisabled ? 'Locked' : (isBeginnerClass ? 'Free' : (cls.xp_cost ? cls.xp_cost + ' XP' : 'Free'))}</div>
                </div>
            `;
        }).join('');
    },
    
    /**
     * Show class detail modal with prerequisites, free advances, and cost info
     * @param {object} cls - Class data object
     * @param {object} character - Current character for prereq checking
     */
    showClassDetailModal(cls, character = null) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        if (!modal || !modalBody) return;
        
        const icon = cls.icon || this.classIcons[cls.id] || this.classIcons.default;
        const imagePath = cls.image ? 
            (cls.image.startsWith('images/') ? cls.image : 'images/' + cls.image) : null;
        
        const isSelected = App.state.character?.class_id === cls.id;
        const allClasses = App.state.classes || [];
        
        // Check if player can change to this class
        const isBeginnerClass = !cls.prerequisite || cls.prerequisite === null;
        const defaultXpCost = isBeginnerClass ? 0 : (cls.xp_cost || 0);
        const canChangeInfo = character && typeof API !== 'undefined' && API.canChangeToClass 
            ? API.canChangeToClass(character, cls, allClasses)
            : { canChange: true, isFreeAdvance: false, xpCost: defaultXpCost, reason: '' };
        
        // Check if player has completed this class before
        const completedClasses = character ? API.getCompletedClasses(character) : [];
        const isCompleted = completedClasses.includes(cls.id);
        
        // Get prerequisites (support both single and multiple)
        const prerequisites = cls.prerequisites || (cls.prerequisite ? [cls.prerequisite] : []);
        const prereqNames = prerequisites
            .map(id => allClasses.find(c => c.id === id)?.name || id)
            .filter(Boolean);
        
        // Get free advance class names
        const freeAdvanceNames = (cls.free_advances || [])
            .map(id => allClasses.find(c => c.id === id)?.name || id)
            .slice(0, 5); // Limit to 5 for display
        
        // Format stat minimums for display
        const statMinHtml = cls.stat_minimums ? Object.entries(cls.stat_minimums)
            .map(([stat, min]) => `<span class="stat-min-requirement" style="color: var(--gold-light);">${this.formatStatName(stat)}: ${min}+</span>`)
            .join('') : '';
        
        // Format stat maximums for display
        const statMaxHtml = cls.stat_maximums ? Object.entries(cls.stat_maximums)
            .filter(([stat, max]) => max < 9)  // Only show limited stats
            .map(([stat, max]) => `<span class="stat-cap">${this.formatStatName(stat)}: ${max}</span>`)
            .join('') : '';
        
        modalBody.innerHTML = `
            <div class="species-detail class-detail">
                <div class="species-detail-image">
                    ${imagePath ? `
                        <img src="${imagePath}" alt="${cls.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="species-detail-icon-fallback" style="display:none;">${icon}</div>
                    ` : `
                        <div class="species-detail-icon">${icon}</div>
                    `}
                    ${isCompleted ? '<div class="class-completed-badge">✓ Mastered</div>' : ''}
                </div>
                <div class="species-detail-info">
                    <h2 class="species-detail-name">${cls.name}</h2>
                    ${prerequisites.length === 0 ? '<span class="class-badge beginner">Beginner Class</span>' : ''}
                    <p class="species-detail-description">${cls.description || 'No description available.'}</p>
                    
                    <div class="class-requirements">
                        ${prereqNames.length > 0 ? `
                            <div class="class-prereq">
                                <span class="prereq-label">🔗 Prerequisites (any one):</span>
                                <div class="prereq-list" style="display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-xs);">
                                    ${prereqNames.map(name => `<span class="prereq-value" style="background: var(--bg-dark); padding: 2px 8px; border-radius: 4px;">${name}</span>`).join(' or ')}
                                </div>
                            </div>
                        ` : `
                            <div class="class-prereq none">
                                <span class="prereq-label">🔓 Prerequisites:</span>
                                <span class="prereq-value">None (Beginner)</span>
                            </div>
                        `}
                        
                        <div class="class-cost-info">
                            <span class="cost-label">💰 Cost to Switch:</span>
                            ${canChangeInfo.isFreeAdvance ? `
                                <span class="cost-value free">FREE (Maxed Current Class)</span>
                            ` : `
                                <span class="cost-value">${canChangeInfo.xpCost || 0} XP</span>
                            `}
                        </div>
                    </div>
                    
                    ${freeAdvanceNames.length > 0 ? `
                        <div class="class-advances">
                            <h4>🎓 Free Advances (when maxed)</h4>
                            <div class="advance-list">
                                ${freeAdvanceNames.map(n => `<span class="advance-tag">${n}</span>`).join('')}
                                ${cls.free_advances.length > 5 ? `<span class="advance-more">+${cls.free_advances.length - 5} more</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${statMinHtml ? `
                        <div class="class-detail-stats">
                            <h4>📊 Minimum Stat Requirements</h4>
                            <div class="stat-caps-grid" style="margin-bottom: var(--space-md);">${statMinHtml}</div>
                        </div>
                    ` : ''}
                    
                    ${statMaxHtml ? `
                        <div class="class-detail-stats">
                            <h4>📈 Stat Caps</h4>
                            <div class="stat-caps-grid">${statMaxHtml}</div>
                        </div>
                    ` : ''}
                    
                    <div class="species-detail-actions">
                        ${!canChangeInfo.canChange ? `
                            <button class="action-btn disabled" disabled>🔒 ${canChangeInfo.reason || 'Cannot Select'}</button>
                        ` : isSelected ? `
                            <button class="action-btn disabled" disabled>✓ Current Class</button>
                        ` : `
                            <button class="action-btn primary class-select-btn" data-class-id="${cls.id}">
                                ${canChangeInfo.isFreeAdvance ? '🎓 Advance FREE' : `⚔️ Switch (${canChangeInfo.xpCost} XP)`}
                            </button>
                        `}
                        <button class="action-btn modal-cancel-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Bind select button
        modalBody.querySelector('.class-select-btn')?.addEventListener('click', async () => {
            if (typeof window.onClassSelected === 'function') {
                await window.onClassSelected(cls.id, canChangeInfo.isFreeAdvance);
            }
            this.hideModal();
        });
        
        // Bind cancel button
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
            this.hideModal();
        });
        
        modal.classList.remove('hidden');
    },
    
    /**
     * Check if character meets class prerequisites
     * Supports both single prerequisite (backward compat) and multiple prerequisites
     */
    checkPrerequisites(classTemplate, character) {
        // Support both single prerequisite (backward compat) and multiple prerequisites
        const prerequisites = classTemplate.prerequisites || (classTemplate.prerequisite ? [classTemplate.prerequisite] : []);
        
        // Beginner classes have no prerequisites
        if (prerequisites.length === 0) return true;
        
        // Check if character has had ANY of the prerequisite classes (current or in history)
        const careerHistory = character.career_history || [];
        const hasAnyPrereq = prerequisites.some(prereqId => {
            return character.class_id === prereqId ||
                careerHistory.some(h => h.class_id === prereqId && !h.abandoned);
        });
        
        return hasAnyPrereq;
    },
    
    /**
     * Update current career display with career path
     */
    renderCurrentCareer(classTemplate, vocation, character = null) {
        if (!this.elements.currentCareer) return;
        
        if (!classTemplate) {
            this.elements.currentCareer.innerHTML = '<p class="placeholder-text">No career selected...</p>';
            return;
        }
        
        // Build career path HTML
        const careerPathHtml = this.buildCareerPathHtml(character, classTemplate);
        
        this.elements.currentCareer.innerHTML = `
            <div class="current-career-header">
                <div class="career-icon">${this.classIcons[classTemplate.id] || this.classIcons.default}</div>
                <div class="career-info">
                    <h3>${classTemplate.name}</h3>
                    <p class="career-desc">${classTemplate.description || ''}</p>
                    ${vocation ? `<p class="vocation-preview">Vocation: ${vocation.name}</p>` : ''}
                </div>
            </div>
            ${careerPathHtml}
        `;
    },
    
    /**
     * Build career path visualization HTML
     */
    buildCareerPathHtml(character, currentClass) {
        if (!character) return '';
        
        const careerHistory = character.career_history || [];
        const allClasses = App.state.classes || [];
        
        if (careerHistory.length === 0 && !currentClass) {
            return '<div class="career-path empty"><p>No career history yet</p></div>';
        }
        
        // Build path nodes
        const nodes = careerHistory.map(entry => {
            const classData = allClasses.find(c => c.id === entry.class_id);
            const icon = classData?.icon || this.classIcons[entry.class_id] || '❓';
            const name = classData?.name || entry.class_id;
            
            return `
                <div class="career-path-node ${entry.maxed ? 'maxed' : ''} ${entry.abandoned ? 'abandoned' : ''}"
                     title="${name}${entry.maxed ? ' (Mastered)' : ''}${entry.abandoned ? ' (Abandoned)' : ''}">
                    <span class="node-icon">${icon}</span>
                    ${entry.maxed ? '<span class="node-badge">✓</span>' : ''}
                </div>
                <div class="career-path-arrow">→</div>
            `;
        }).join('');
        
        // Add current class
        const currentNode = currentClass ? `
            <div class="career-path-node current" title="${currentClass.name} (Current)">
                <span class="node-icon">${currentClass.icon || this.classIcons[currentClass.id] || '❓'}</span>
                <span class="node-badge current">★</span>
            </div>
        ` : '';
        
        return `
            <div class="career-path-container">
                <h4>Career Path</h4>
                <div class="career-path">
                    ${nodes}
                    ${currentNode}
                </div>
            </div>
        `;
    },
    
    // =========================== STATS GRID =============================
    
    /**
     * Render stats grid with exponential point costs
     * @param {object} stats - Current stat values
     * @param {object} caps - Stat maximums from class/species
     * @param {number} availablePoints - Available points for spending
     */
    renderStatsGrid(stats, caps = {}, availablePoints = 0) {
        if (!this.elements.statsGrid) return;
        
        // F3 stat names in order
        const statNames = (typeof F4_SEED_DATA !== 'undefined') ? F4_SEED_DATA.statNames : [
            'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
            'deception', 'endurance', 'entertaining', 'fighting', 'healing',
            'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
            'stealth', 'survival', 'thievery', 'will', 'wisdom'
        ];
        
        this.elements.statsGrid.innerHTML = statNames.map(stat => {
            const value = stats[stat] || 2;
            const max = Math.min(caps[stat] || 9, 9);
            const costToIncrease = this.getStatPointCost(value);
            const canIncrease = value < max && availablePoints >= costToIncrease;
            const canDecrease = value > 1;
            
            return `
                <div class="stat-row" data-stat="${stat}">
                    <span class="stat-name">${this.formatStatName(stat)}</span>
                    <div class="stat-controls">
                        <button class="stat-btn" data-action="decrease" ${!canDecrease ? 'disabled' : ''} title="Refund: ${this.getStatPointCost(value - 1)} pts">−</button>
                        <span class="stat-value">${value}</span>
                        <span class="stat-max">/${max}</span>
                        <button class="stat-btn" data-action="increase" ${!canIncrease ? 'disabled' : ''} title="Cost: ${costToIncrease} pts">+</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update points display (renamed from XP)
        if (this.elements.xpAvailable) {
            this.elements.xpAvailable.textContent = availablePoints;
        }
        
        // Bind stat button events
        this.elements.statsGrid.querySelectorAll('.stat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('.stat-row');
                const stat = row.dataset.stat;
                const action = e.target.dataset.action;
                
                if (typeof window.onStatChange === 'function') {
                    window.onStatChange(stat, action);
                }
            });
        });
    },
    
    /**
     * Get point cost to increase stat from current level
     * Exponential: 2^(level-1) - so 1, 2, 4, 8, 16, 32, 64, 128
     */
    getStatPointCost(fromLevel) {
        if (fromLevel < 1) return 0;
        return Math.pow(2, fromLevel - 1);
    },
    
    /**
     * Format stat name for display
     * Abbreviates long stat names to fit in the UI
     */
    formatStatName(stat) {
        // Abbreviate long stat names for display
        const abbreviations = {
            'marksmanship': 'Marksman'
        };
        
        // Check if we have an abbreviation for this stat
        if (abbreviations[stat]) {
            return abbreviations[stat];
        }
        
        // Default: capitalize first letter and replace underscores with spaces
        return stat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    
    // =========================== RESOURCE BARS (PLAYERS HUD) ===========
    
    /**
     * Render resource spheres (Health, Stamina, Mana) with liquid fill
     */
    renderResourceBars(character) {
        if (!this.elements.resourceBars || !character) return;
        
        const health = character.health || { current: 100, max: 100 };
        const stamina = character.stamina || { current: 100, max: 100 };
        const mana = character.mana || { current: 50, max: 50 };
        
        // Update health sphere (RED)
        const healthPercent = Math.max(0, Math.min(100, (health.current / health.max) * 100));
        this.elements.healthValue.textContent = `${health.current} / ${health.max}`;
        const healthLiquid = document.getElementById('health-liquid');
        if (healthLiquid) {
            healthLiquid.style.height = `${healthPercent}%`;
        }
        const healthBar = this.elements.resourceBars.querySelector('.health-bar');
        if (healthBar) {
            healthBar.classList.remove('low', 'critical');
            if (healthPercent < 25) {
                healthBar.classList.add('critical');
            } else if (healthPercent < 50) {
                healthBar.classList.add('low');
            }
        }
        
        // Update stamina sphere (BLUE)
        const staminaPercent = Math.max(0, Math.min(100, (stamina.current / stamina.max) * 100));
        this.elements.staminaValue.textContent = `${stamina.current} / ${stamina.max}`;
        const staminaLiquid = document.getElementById('stamina-liquid');
        if (staminaLiquid) {
            staminaLiquid.style.height = `${staminaPercent}%`;
        }
        const staminaBar = this.elements.resourceBars.querySelector('.stamina-bar');
        if (staminaBar) {
            staminaBar.classList.remove('low', 'critical');
            if (staminaPercent < 25) {
                staminaBar.classList.add('critical');
            } else if (staminaPercent < 50) {
                staminaBar.classList.add('low');
            }
        }
        
        // Update mana sphere (GREEN)
        const manaPercent = Math.max(0, Math.min(100, (mana.current / mana.max) * 100));
        this.elements.manaValue.textContent = `${mana.current} / ${mana.max}`;
        const manaLiquid = document.getElementById('mana-liquid');
        if (manaLiquid) {
            manaLiquid.style.height = `${manaPercent}%`;
        }
        const manaBar = this.elements.resourceBars.querySelector('.mana-bar');
        if (manaBar) {
            manaBar.classList.remove('low', 'critical');
            if (manaPercent < 25) {
                manaBar.classList.add('critical');
            } else if (manaPercent < 50) {
                manaBar.classList.add('low');
            }
        }
    },
    
    /**
     * Calculate XP milestone (nonlinear scaling)
     * XP milestones increase exponentially: 100, 250, 500, 1000, 2000, 4000, 8000, etc.
     */
    calculateXPMilestone(xp) {
        if (xp < 100) return { current: xp, next: 100, progress: xp / 100 };
        if (xp < 250) return { current: xp, next: 250, progress: (xp - 100) / 150 };
        if (xp < 500) return { current: xp, next: 500, progress: (xp - 250) / 250 };
        if (xp < 1000) return { current: xp, next: 1000, progress: (xp - 500) / 500 };
        if (xp < 2000) return { current: xp, next: 2000, progress: (xp - 1000) / 1000 };
        if (xp < 4000) return { current: xp, next: 4000, progress: (xp - 2000) / 2000 };
        if (xp < 8000) return { current: xp, next: 8000, progress: (xp - 4000) / 4000 };
        if (xp < 16000) return { current: xp, next: 16000, progress: (xp - 8000) / 8000 };
        if (xp < 32000) return { current: xp, next: 32000, progress: (xp - 16000) / 16000 };
        // Beyond 32000, use linear progression with larger steps
        const base = 32000;
        const step = 16000;
        const level = Math.floor((xp - base) / step);
        const next = base + (level + 1) * step;
        return { current: xp, next: next, progress: ((xp - base) % step) / step };
    },
    
    /**
     * Render XP progress bar with nonlinear scaling
     */
    renderXPProgress(character) {
        if (!character) return;
        
        const xpCurrent = document.getElementById('xp-current');
        const xpNextMilestone = document.getElementById('xp-next-milestone');
        const xpPercentage = document.getElementById('xp-percentage');
        const xpProgressFill = document.getElementById('xp-progress-fill');
        const xpMilestoneText = document.getElementById('xp-milestone-text');
        
        if (!xpCurrent || !xpNextMilestone || !xpPercentage || !xpProgressFill || !xpMilestoneText) return;
        
        const totalXP = character.xp_total || 0;
        const milestone = this.calculateXPMilestone(totalXP);
        
        const progressPercent = Math.max(0, Math.min(100, milestone.progress * 100));
        
        xpCurrent.textContent = totalXP.toLocaleString();
        xpNextMilestone.textContent = milestone.next.toLocaleString();
        xpPercentage.textContent = `${Math.round(progressPercent)}%`;
        xpProgressFill.style.width = `${progressPercent}%`;
        
        const remaining = milestone.next - totalXP;
        if (remaining > 0) {
            xpMilestoneText.textContent = `${remaining.toLocaleString()} XP until next milestone`;
        } else {
            xpMilestoneText.textContent = 'Milestone reached!';
        }
    },
    
    // =========================== VOCATION DISPLAY =======================
    
    /**
     * Render vocation bonus display
     */
    renderVocation(vocation, stats) {
        if (!this.elements.vocationDisplay) return;
        
        if (!vocation) {
            this.elements.vocationDisplay.innerHTML = '<p class="placeholder-text">Select a class to see your vocation...</p>';
            return;
        }
        
        const primaryValue = stats[vocation.primary_stat] || 0;
        const secondaryValue = stats[vocation.secondary_stat] || 0;
        const bonus = primaryValue + secondaryValue;
        
        this.elements.vocationDisplay.innerHTML = `
            <div class="vocation-name">${vocation.name}</div>
            <div class="vocation-formula">
                ${this.formatStatName(vocation.primary_stat)} (${primaryValue}) + 
                ${this.formatStatName(vocation.secondary_stat)} (${secondaryValue})
            </div>
            <div class="vocation-value">+${bonus}</div>
            <div class="vocation-applies">Applies to: ${vocation.applies_to?.join(', ') || 'N/A'}</div>
        `;
    },
    
    // =========================== GENDER SELECTION =======================
    
    /**
     * Render gender selection gallery with images
     */
    renderGenderSelection(genders, selectedGender) {
        console.log('[DEBUG] renderGenderSelection() called with', genders?.length || 0, 'genders');
        if (!this.elements.genderGallery) {
            console.log('[DEBUG] renderGenderSelection() - genderGallery element not found!');
            return;
        }
        
        if (!genders || genders.length === 0) {
            console.log('[DEBUG] renderGenderSelection() - No genders, showing loading spinner');
            this.elements.genderGallery.innerHTML = '<div class="loading-spinner">Loading genders...</div>';
            return;
        }
        
        this.elements.genderGallery.innerHTML = genders.map(gender => {
            const icon = gender.icon || '👤';
            const imagePath = gender.image ? 
                (gender.image.startsWith('images/') ? gender.image : 'images/' + gender.image) : null;
            const isSelected = selectedGender === gender.id;
            
            return `
                <button class="choice-btn gender-btn ${isSelected ? 'selected' : ''}" 
                        data-gender="${gender.id}" 
                        title="${gender.description || gender.name}">
                    ${imagePath ? `
                        <div class="gender-image-container">
                            <img src="${imagePath}" alt="${gender.name}" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <span class="gender-icon-fallback" style="display:none;">${icon}</span>
                        </div>
                    ` : `
                        <span class="gender-icon">${icon}</span>
                    `}
                    <span class="gender-label">${gender.name}</span>
                </button>
            `;
        }).join('');
        
        // Re-bind click events - open modal instead of direct selection
        this.elements.genderGallery.querySelectorAll('[data-gender]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const genderBtn = e.target.closest('[data-gender]');
                if (genderBtn) {
                    const genderId = genderBtn.dataset.gender;
                    const genderData = genders.find(g => g.id === genderId);
                    if (genderData) {
                        this.showGenderDetailModal(genderData);
                    }
                }
            });
        });
    },
    
    /**
     * Show gender detail modal with large image
     * @param {object} gender - Gender data object
     */
    showGenderDetailModal(gender) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        if (!modal || !modalBody) return;
        
        const icon = gender.icon || '👤';
        const imagePath = gender.image ? 
            (gender.image.startsWith('images/') ? gender.image : 'images/' + gender.image) : null;
        
        const isSelected = App.state.character?.gender === gender.id;
        
        modalBody.innerHTML = `
            <div class="species-detail gender-detail">
                <div class="species-detail-image">
                    ${imagePath ? `
                        <img src="${imagePath}" alt="${gender.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="species-detail-icon-fallback" style="display:none;">${icon}</div>
                    ` : `
                        <div class="species-detail-icon">${icon}</div>
                    `}
                </div>
                <div class="species-detail-info">
                    <h2 class="species-detail-name">${gender.name}</h2>
                    <p class="species-detail-description">${gender.description || 'No description available.'}</p>
                    
                    <div class="species-detail-actions">
                        <button class="action-btn primary gender-select-btn" data-gender-id="${gender.id}">
                            ${isSelected ? '✓ Selected' : '✓ Select This Gender'}
                        </button>
                        <button class="action-btn modal-cancel-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Bind select button
        modalBody.querySelector('.gender-select-btn')?.addEventListener('click', () => {
            if (typeof window.onGenderSelected === 'function') {
                window.onGenderSelected(gender.id);
            }
            this.hideModal();
            this.showToast(`Selected: ${gender.name}`, 'success', 2000);
        });
        
        // Bind cancel button
        modalBody.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
            this.hideModal();
        });
        
        modal.classList.remove('hidden');
    },
    
    /**
     * Select a gender (update visual state)
     */
    selectGender(gender) {
        if (this.elements.genderGallery) {
            this.elements.genderGallery.querySelectorAll('[data-gender]').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.gender === gender);
            });
        }
    },
    
    // =========================== CHARACTER SUMMARY ======================
    
    /**
     * Update character summary panel
     */
    async renderCharacterSummary(character, species, classTemplate) {
        if (!this.elements.charSummary) return;
        
        if (!character) {
            this.elements.charSummary.innerHTML = '<p class="placeholder-text">Create your character above...</p>';
            return;
        }
        
        // Load universe info if character has universe_id
        let universeName = null;
        if (character && character.universe_id) {
            try {
                const universeResult = await API.getUniverse(character.universe_id);
                if (universeResult.success) {
                    universeName = universeResult.data.universe.name;
                }
            } catch (error) {
                console.error('Failed to load universe info:', error);
            }
        }
        
        this.elements.charSummary.innerHTML = `
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">Name:</span>
                    <span class="summary-value">${character.name || 'Unnamed'}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Title:</span>
                    <span class="summary-value">${character.title || 'None'}</span>
                </div>
                ${universeName ? `
                <div class="summary-item">
                    <span class="summary-label">Universe:</span>
                    <span class="summary-value">${universeName}</span>
                </div>
                ` : ''}
                <div class="summary-item">
                    <span class="summary-label">Species:</span>
                    <span class="summary-value">${species?.name || 'Unknown'}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Career:</span>
                    <span class="summary-value">${classTemplate?.name || 'None'}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Points:</span>
                    <span class="summary-value">${typeof window.calculateAvailablePoints === 'function' ? window.calculateAvailablePoints(character) : 0} available</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">XP Earned:</span>
                    <span class="summary-value">${character.xp_total || 0}</span>
                </div>
            </div>
        `;
    },
    
    // =========================== MODAL ==================================
    
    /**
     * Show modal with content
     * @param {string} content - HTML content for modal
     */
    showModal(content) {
        if (!this.elements.modal || !this.elements.modalBody) return;
        
        this.elements.modalBody.innerHTML = content;
        this.elements.modal.classList.remove('hidden');
    },
    
    /**
     * Close the modal
     */
    closeModal() {
        if (!this.elements.modal) return;
        this.elements.modal.classList.add('hidden');
    },
    
    /**
     * Hide modal (alias for closeModal)
     */
    hideModal() {
        this.closeModal();
    },
    
    // =========================== TOAST NOTIFICATIONS ====================
    
    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'info', duration = 3000) {
        if (!this.elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    /**
     * Set connection status indicator
     * @param {boolean} online - Connection status
     */
    setConnectionStatus(online) {
        if (!this.elements.connectionStatus) return;
        this.elements.connectionStatus.classList.toggle('online', online);
    },
    
    // =========================== LOADING STATES =========================
    
    /**
     * Show loading state in a container
     * @param {HTMLElement} container - Container element
     * @param {string} message - Loading message
     */
    showLoading(container, message = 'Loading...') {
        if (!container) return;
        container.innerHTML = `<div class="loading-spinner">${message}</div>`;
    },
    
    /**
     * Show error state in a container
     * @param {HTMLElement} container - Container element
     * @param {string} message - Error message
     */
    showError(container, message = 'An error occurred') {
        if (!container) return;
        container.innerHTML = `<p class="placeholder-text" style="color: var(--error);">⚠️ ${message}</p>`;
    },
    
    // =========================== ACTION SLOTS ===========================
    
    /**
     * Render action slots
     */
    renderActionSlots(character) {
        if (!this.elements.actionSlots) return;
        
        const slots = character?.action_slots || [];
        const maxSlots = 12; // Maximum number of action slots
        
        // Generate slot HTML
        let html = '';
        for (let i = 0; i < maxSlots; i++) {
            const slot = slots[i];
            if (slot) {
                // Slot has an item/spell/buff
                const slotType = slot.type || 'item'; // 'item', 'spell', 'buff'
                const icon = slot.icon || '⚔️';
                const name = slot.name || 'Unknown';
                const cooldown = slot.cooldown || 0;
                
                html += `
                    <div class="action-slot ${slotType} ${cooldown > 0 ? 'on-cooldown' : ''}" 
                         data-slot-index="${i}" 
                         data-slot-id="${slot.id || ''}">
                        ${cooldown > 0 ? `<div class="action-slot-cooldown">${cooldown}s</div>` : ''}
                        <div class="action-slot-icon">${icon}</div>
                        <div class="action-slot-name">${name}</div>
                    </div>
                `;
            } else {
                // Empty slot
                html += `
                    <div class="action-slot empty" data-slot-index="${i}">
                    </div>
                `;
            }
        }
        
        this.elements.actionSlots.innerHTML = html;
        
        // Bind click events
        this.elements.actionSlots.querySelectorAll('.action-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const index = parseInt(slot.dataset.slotIndex);
                if (slot.classList.contains('empty')) {
                    // Open dialog to add item/spell/buff
                    this.showAddActionSlotDialog(index);
                } else {
                    // Activate/use the item/spell/buff
                    this.activateActionSlot(index, slot.dataset.slotId);
                }
            });
        });
    },
    
    /**
     * Show dialog to add item/spell/buff to action slot
     */
    showAddActionSlotDialog(slotIndex) {
        const content = `
            <h2>Add to Action Slot</h2>
            <div class="form-group">
                <label>Type</label>
                <select id="action-slot-type">
                    <option value="item">Item</option>
                    <option value="spell">Spell</option>
                    <option value="buff">Buff</option>
                </select>
            </div>
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="action-slot-name" placeholder="Enter name...">
            </div>
            <div class="form-group">
                <label>Icon (emoji or text)</label>
                <input type="text" id="action-slot-icon" placeholder="⚔️" maxlength="2">
            </div>
            <button class="action-btn primary" id="btn-confirm-action-slot">Add</button>
        `;
        
        this.showModal(content);
        
        document.getElementById('btn-confirm-action-slot')?.addEventListener('click', () => {
            const type = document.getElementById('action-slot-type').value;
            const name = document.getElementById('action-slot-name').value;
            const icon = document.getElementById('action-slot-icon').value || '⚔️';
            
            if (!name) {
                this.showToast('Please enter a name', 'warning');
                return;
            }
            
            // Add to character's action slots
            if (!App.state.character.action_slots) {
                App.state.character.action_slots = [];
            }
            
            App.state.character.action_slots[slotIndex] = {
                id: `slot_${Date.now()}`,
                type: type,
                name: name,
                icon: icon,
                cooldown: 0
            };
            
            this.renderActionSlots(App.state.character);
            this.hideModal();
            this.showToast(`Added ${name} to action slot`, 'success');
        });
    },
    
    /**
     * Activate an action slot
     */
    activateActionSlot(slotIndex, slotId) {
        const slot = App.state.character?.action_slots?.[slotIndex];
        if (!slot) return;
        
        if (slot.cooldown > 0) {
            this.showToast(`${slot.name} is on cooldown (${slot.cooldown}s remaining)`, 'warning');
            return;
        }
        
        // TODO: Implement actual activation logic
        // This will depend on the type (item, spell, buff)
        this.showToast(`Activated ${slot.name}`, 'success');
        
        // Example: Set cooldown (this would be based on the item/spell/buff properties)
        slot.cooldown = 5; // 5 second cooldown
        this.renderActionSlots(App.state.character);
        
        // Countdown cooldown
        const cooldownInterval = setInterval(() => {
            slot.cooldown--;
            this.renderActionSlots(App.state.character);
            if (slot.cooldown <= 0) {
                clearInterval(cooldownInterval);
            }
        }, 1000);
    },
    
    // =========================== INVENTORY DISPLAY ========================
    
    /**
     * Render inventory list (read-only)
     * @param {Object} inventory - Inventory object {itemName: quantity}
     */
    renderInventory(inventory) {
        if (!this.elements.inventoryGrid) {
            console.warn('[renderInventory] Inventory grid element not found');
            return;
        }
        
        console.log('[renderInventory] Received inventory:', inventory);
        console.log('[renderInventory] Inventory type:', typeof inventory);
        console.log('[renderInventory] Inventory is array?', Array.isArray(inventory));
        console.log('[renderInventory] Inventory keys:', inventory ? Object.keys(inventory) : 'null/undefined');
        
        if (!inventory || Object.keys(inventory).length === 0) {
            console.log('[renderInventory] Inventory is empty or null');
            this.elements.inventoryGrid.innerHTML = '<p class="placeholder-text">Your inventory is empty...</p>';
            return;
        }
        
        // Sort items alphabetically by name
        const items = Object.entries(inventory)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Build simple list HTML
        let html = '<div style="display: flex; flex-direction: column; gap: var(--space-xs);">';
        html += '<div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-md); padding: var(--space-sm); background: var(--bg-medium); border-radius: 4px; font-weight: bold; border-bottom: 2px solid var(--border-color);">';
        html += '<div>Item</div>';
        html += '<div style="text-align: right;">Quantity</div>';
        html += '</div>';
        
        items.forEach(item => {
            html += `<div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-md); padding: var(--space-sm); border-bottom: 1px solid var(--border-color);">`;
            html += `<div style="word-break: break-word;">${item.name}</div>`;
            html += `<div style="text-align: right; font-weight: 500;">${item.quantity}</div>`;
            html += `</div>`;
        });
        
        html += '</div>';
        this.elements.inventoryGrid.innerHTML = html;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});

