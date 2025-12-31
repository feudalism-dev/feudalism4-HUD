// ============================================================================
// Feudalism 4 - API Communication Module
// ============================================================================
// Handles all communication with the Google Apps Script backend
// ============================================================================

const API = {
    // Google Apps Script Web App URL
    GAS_URL: 'https://script.google.com/macros/s/AKfycbxKDnCMgxIrquXtE5_YZnDcEUVitUAE92lJ-ZRc1mxyj9ilEcUND_kei7KK35VD0Amr/exec',
    
    // Session data (populated from URL params)
    uuid: null,
    token: null,
    role: 'player',
    hudChannel: null,
    
    /**
     * Initialize API with session data from URL parameters
     */
    init() {
        const params = new URLSearchParams(window.location.search);
        this.uuid = params.get('uuid') || '';
        this.token = params.get('token') || '';
        this.role = params.get('role') || 'player';
        this.hudChannel = params.get('channel') || '';
        
        console.log('API initialized', { uuid: this.uuid, role: this.role });
    },
    
    /**
     * Make a request to the GAS backend
     * @param {string} action - The API action to call
     * @param {object} data - Additional data to send
     * @returns {Promise<object>} - The response data
     */
    async request(action, data = {}) {
        try {
            const payload = {
                action: action,
                uuid: this.uuid,
                token: this.token,
                data: data
            };
            
            console.log('API Request:', action, payload);
            
            // GAS requires special handling for CORS
            // Use Content-Type: text/plain to avoid preflight
            const response = await fetch(this.GAS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload),
                redirect: 'follow'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('API Response:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }
            
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // =========================== AUTH ===================================
    
    /**
     * Send heartbeat to keep session alive
     */
    async heartbeat() {
        return this.request('auth.heartbeat');
    },
    
    /**
     * Logout and invalidate session
     */
    async logout() {
        return this.request('auth.logout');
    },
    
    // =========================== CHARACTER ==============================
    
    /**
     * Get current character data
     */
    async getCharacter() {
        return this.request('character.get');
    },
    
    /**
     * Create a new character
     * @param {object} charData - Character creation data
     */
    async createCharacter(charData) {
        return this.request('character.create', charData);
    },
    
    /**
     * Update character data
     * @param {object} charData - Fields to update
     */
    async updateCharacter(charData) {
        return this.request('character.update', charData);
    },
    
    /**
     * Delete current character
     */
    async deleteCharacter() {
        return this.request('character.delete');
    },
    
    // =========================== TEMPLATES ==============================
    
    /**
     * Get all species templates
     */
    async getSpecies() {
        return this.request('templates.species');
    },
    
    /**
     * Get all class templates
     */
    async getClasses() {
        return this.request('templates.classes');
    },
    
    /**
     * Get all vocation templates
     */
    async getVocations() {
        return this.request('templates.vocations');
    },
    
    // =========================== GAME MECHANICS =========================
    
    /**
     * Perform a skill test
     * @param {string} stat - The stat to test
     * @param {number} difficulty - Target number
     * @param {number} modifier - Optional modifier
     */
    async rollTest(stat, difficulty = 10, modifier = 0) {
        return this.request('roll.test', {
            stat: stat,
            difficulty: difficulty,
            modifier: modifier
        });
    },
    
    // =========================== ADMIN ==================================
    
    /**
     * List all users (admin only)
     */
    async listUsers() {
        return this.request('admin.users.list');
    },
    
    /**
     * Promote/demote a user (sys_admin only)
     * @param {string} targetUUID - User to modify
     * @param {string} newRole - New role to assign
     */
    async promoteUser(targetUUID, newRole) {
        return this.request('admin.users.promote', {
            target_uuid: targetUUID,
            role: newRole
        });
    },
    
    /**
     * Ban or unban a user (admin only)
     * @param {string} targetUUID - User to modify
     * @param {boolean} banned - Ban status
     */
    async banUser(targetUUID, banned = true) {
        return this.request('admin.users.ban', {
            target_uuid: targetUUID,
            banned: banned
        });
    },
    
    /**
     * Award XP to a character (admin only)
     * @param {string} targetUUID - Character owner UUID
     * @param {number} amount - XP amount (can be negative)
     * @param {string} reason - Reason for award
     */
    async awardXP(targetUUID, amount, reason = '') {
        return this.request('admin.xp.award', {
            target_uuid: targetUUID,
            amount: amount,
            reason: reason
        });
    },
    
    /**
     * Create a new template (sys_admin only)
     * @param {string} type - 'species', 'classes', or 'vocations'
     * @param {object} template - Template data
     */
    async createTemplate(type, template) {
        return this.request('admin.templates.create', {
            type: type,
            template: template
        });
    },
    
    /**
     * Update a template (sys_admin only)
     * @param {string} type - Template type
     * @param {object} template - Updated template data
     */
    async updateTemplate(type, template) {
        return this.request('admin.templates.update', {
            type: type,
            template: template
        });
    },
    
    /**
     * Delete a template (sys_admin only)
     * @param {string} type - Template type
     * @param {string} templateId - ID of template to delete
     */
    async deleteTemplate(type, templateId) {
        return this.request('admin.templates.delete', {
            type: type,
            template_id: templateId
        });
    },
    
    // =========================== LSL COMMUNICATION ======================
    
    /**
     * Send a command to the LSL script via URL protocol
     * Note: Limited functionality, used for simple notifications
     * @param {string} command - Command to send
     * @param {object} data - Additional data
     */
    sendToLSL(command, data = {}) {
        // This uses the secondlife:// URL protocol
        // Limited in what can be sent back to LSL from MOAP
        const payload = encodeURIComponent(JSON.stringify({
            cmd: command,
            ...data
        }));
        
        // Attempt to communicate via URL change
        // This has limitations in MOAP context
        console.log('Send to LSL:', command, data);
        
        // Alternative: Use llOpenURL callback
        // window.location.href = `secondlife:///app/callback/${payload}`;
    },
    
    /**
     * Check if running in Second Life MOAP context
     */
    isInSL() {
        // Check for SL-specific indicators
        return navigator.userAgent.includes('SecondLife') || 
               window.location.search.includes('uuid=');
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    API.init();
});

