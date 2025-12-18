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
    },
    
    /**
     * Show/hide admin tab based on role
     * @param {string} role - User role
     */
    updateRoleUI(role) {
        const isAdmin = role === 'sim_admin' || role === 'sys_admin';
        
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
        if (!this.elements.speciesGallery) return;
        
        this.elements.speciesGallery.innerHTML = species.map(sp => {
            const icon = sp.icon || this.speciesIcons[sp.id] || '👤';
            const hasImage = sp.image ? true : false;
            
            return `
                <div class="gallery-card ${sp.id === selectedId ? 'selected' : ''}" 
                     data-species-id="${sp.id}"
                     title="${sp.description || ''}">
                    ${hasImage ? `
                        <div class="card-image">
                            <img src="images/${sp.image}" alt="${sp.name}" 
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
        
        // Bind click events
        this.elements.speciesGallery.querySelectorAll('.gallery-card').forEach(card => {
            card.addEventListener('click', () => {
                const speciesId = card.dataset.speciesId;
                this.selectSpecies(speciesId);
                // Trigger callback in app.js
                if (typeof window.onSpeciesSelected === 'function') {
                    window.onSpeciesSelected(speciesId);
                }
            });
        });
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
     * Render career/class gallery with images
     * @param {Array} classes - Array of class templates
     * @param {string} currentClassId - Currently selected class ID
     * @param {object} character - Character data for prerequisite checking
     */
    renderCareerGallery(classes, currentClassId, character = null) {
        if (!this.elements.careerGallery) return;
        
        this.elements.careerGallery.innerHTML = classes.map(cls => {
            const isSelected = cls.id === currentClassId;
            const isLocked = character ? !this.checkPrerequisites(cls, character) : false;
            const icon = cls.icon || this.classIcons[cls.id] || this.classIcons.default;
            const hasImage = cls.image ? true : false;
            
            return `
                <div class="gallery-card career-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" 
                     data-class-id="${cls.id}"
                     title="${cls.description || ''}">
                    ${hasImage ? `
                        <div class="card-image">
                            <img src="images/${cls.image}" alt="${cls.name}" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <span class="card-icon-fallback" style="display:none;">${icon}</span>
                        </div>
                    ` : `
                        <div class="card-icon">${icon}</div>
                    `}
                    <div class="card-name">${cls.name}</div>
                    <div class="card-desc">${cls.xp_cost ? cls.xp_cost + ' XP' : 'Free'}</div>
                </div>
            `;
        }).join('');
        
        // Bind click events
        this.elements.careerGallery.querySelectorAll('.gallery-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const classId = card.dataset.classId;
                if (typeof window.onClassSelected === 'function') {
                    window.onClassSelected(classId);
                }
            });
        });
    },
    
    /**
     * Check if character meets class prerequisites
     */
    checkPrerequisites(classTemplate, character) {
        if (!classTemplate.prerequisites) return true;
        
        const prereqs = classTemplate.prerequisites;
        
        // Check required classes
        if (prereqs.required_classes?.length > 0) {
            if (!prereqs.required_classes.includes(character.class_id)) {
                return false;
            }
        }
        
        // Check required species
        if (prereqs.required_species?.length > 0) {
            if (!prereqs.required_species.includes(character.species_id)) {
                return false;
            }
        }
        
        return true;
    },
    
    /**
     * Update current career display
     */
    renderCurrentCareer(classTemplate, vocation) {
        if (!this.elements.currentCareer) return;
        
        if (!classTemplate) {
            this.elements.currentCareer.innerHTML = '<p class="placeholder-text">No career selected...</p>';
            return;
        }
        
        this.elements.currentCareer.innerHTML = `
            <div class="career-icon">${this.classIcons[classTemplate.id] || this.classIcons.default}</div>
            <div class="career-info">
                <h3>${classTemplate.name}</h3>
                <p class="career-desc">${classTemplate.description || ''}</p>
                ${vocation ? `<p class="vocation-preview">Vocation: ${vocation.name}</p>` : ''}
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
     */
    formatStatName(stat) {
        return stat.charAt(0).toUpperCase() + stat.slice(1);
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
     * Select a gender
     */
    selectGender(gender) {
        this.elements.genderBtns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.gender === gender);
        });
    },
    
    // =========================== CHARACTER SUMMARY ======================
    
    /**
     * Update character summary panel
     */
    renderCharacterSummary(character, species, classTemplate) {
        if (!this.elements.charSummary) return;
        
        if (!character) {
            this.elements.charSummary.innerHTML = '<p class="placeholder-text">Create your character above...</p>';
            return;
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
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});

