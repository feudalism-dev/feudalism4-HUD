// ============================================================================
// Feudalism 4 - Firestore API Module
// ============================================================================
// Direct Firestore access - no GAS middleware needed!
// ============================================================================

const API = {
    // Session data from LSL
    uuid: null,
    username: null,
    displayName: null,
    hudChannel: null,
    
    // User/role data
    role: 'player',
    user: null,
    
    /**
     * Initialize API - sign in anonymously using SL UUID as identifier
     */
    async init() {
        // Parse LSL parameters from URL
        const params = new URLSearchParams(window.location.search);
        this.uuid = params.get('uuid') || '';
        this.username = params.get('username') || '';
        this.displayName = params.get('displayname') || this.username || 'Unknown';
        this.hudChannel = parseInt(params.get('channel')) || 0;
        
        // SECURITY: Require UUID from LSL - without it, the app cannot function
        if (!this.uuid || this.uuid.trim() === '') {
            console.error('SECURITY: No UUID provided. This app requires LSL integration.');
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 20px; background: #1a1a1a; color: #fff; font-family: sans-serif;">
                    <h1 style="color: #ff6b6b;">⚠️ Access Denied</h1>
                    <p style="font-size: 1.2em;">This application can only be accessed through the Second Life HUD.</p>
                    <p style="color: #999;">Please attach the HUD in-world to access your character.</p>
                </div>
            `;
            return;
        }
        
        console.log('API initializing with LSL data:', {
            uuid: this.uuid,
            username: this.username,
            displayName: this.displayName,
            channel: this.hudChannel
        });
        
        // If we have a UUID from LSL, use it as a custom token basis
        // For now, use anonymous auth
        try {
            if (!auth.currentUser) {
                await auth.signInAnonymously();
                console.log('Signed in anonymously:', auth.currentUser.uid);
            }
            
            // If we have an SL UUID, store/update user document
            // This links the Firebase UID to the SL UUID for security
            if (this.uuid) {
                await this.syncUser();
            }
        } catch (error) {
            console.error('Auth error:', error);
        }
    },
    
    /**
     * Sync user data with Firestore
     */
    async syncUser() {
        if (!this.uuid) return;
        
        // IMPORTANT: UUID is the unique identifier - used as the Firestore document ID
        // Display name is ONLY for UI display purposes, never used for identification
        const userRef = db.collection('users').doc(this.uuid);
        const userDoc = await userRef.get();
        
        // Check if this is the super admin
        const isSuperAdmin = this.uuid === this.SUPER_ADMIN_UUID;
        
        if (userDoc.exists) {
            this.user = userDoc.data();
            
            // Ensure super admin always has sys_admin role
            if (isSuperAdmin && this.user.role !== 'sys_admin') {
                await userRef.update({
                    role: 'sys_admin',
                    is_super_admin: true,
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                this.user.role = 'sys_admin';
                this.user.is_super_admin = true;
            }
            
            this.role = this.user.role || 'player';
            
            // Update displayName from user document if available (UI display only, not used for identification)
            if (this.user.display_name) {
                this.displayName = this.user.display_name;
            }
            
            // Update last login and refresh name from LSL
            await userRef.update({
                last_login: firebase.firestore.FieldValue.serverTimestamp(),
                firebase_uid: auth.currentUser?.uid || null,
                username: this.username || this.user.username,
                display_name: this.displayName || this.user.display_name
            });
        } else {
            // Create new user
            const newUser = {
                uuid: this.uuid,
                username: this.username || this.uuid,
                display_name: this.displayName || 'New Player',
                role: isSuperAdmin ? 'sys_admin' : 'player',
                is_super_admin: isSuperAdmin,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                last_login: firebase.firestore.FieldValue.serverTimestamp(),
                firebase_uid: auth.currentUser?.uid || null,
                banned: false
            };
            
            await userRef.set(newUser);
            this.user = newUser;
            this.role = isSuperAdmin ? 'sys_admin' : 'player';
            // For new users, displayName is already set from URL params or default
        }
        
        console.log('User synced:', this.role, '- Display:', this.displayName, isSuperAdmin ? '(Super Admin)' : '');
    },
    
    // =========================== TEMPLATES (Public Read) ====================
    
    /**
     * Get all species templates
     */
    async getSpecies() {
        try {
            console.log('[DEBUG] getSpecies() called');
            // Try with enabled filter first
            console.log('[DEBUG] Querying species collection (enabled=true)...');
            let snapshot = await db.collection('species').where('enabled', '==', true).get();
            console.log('[DEBUG] Species query returned', snapshot.size, 'documents');
            DebugLog.log(`Species query returned ${snapshot.size} documents`, 'debug');
            
            // If empty, check if collection exists at all (might be seeding)
            if (snapshot.empty) {
                const allSnapshot = await db.collection('species').limit(1).get();
                if (allSnapshot.empty) {
                    // No species at all - seed them
                    console.log('No species found, seeding...');
                    await this.seedDefaultSpecies();
                    // Retry with a small delay
                    await new Promise(resolve => setTimeout(resolve, 500));
                    snapshot = await db.collection('species').where('enabled', '==', true).get();
                } else {
                    // Species exist but none are enabled - use all
                    snapshot = await db.collection('species').get();
                }
            }
            
            const species = [];
            snapshot.forEach(doc => {
                species.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('[DEBUG] getSpecies() returning', species.length, 'species');
            DebugLog.log(`getSpecies() returning ${species.length} species`, 'info');
            return { success: true, data: { species } };
        } catch (error) {
            console.error('getSpecies error:', error);
            DebugLog.log('getSpecies error: ' + error.message, 'error');
            // Fallback: try without enabled filter
            try {
                DebugLog.log('Trying species fallback (no filter)...', 'debug');
                const snapshot = await db.collection('species').get();
                const species = [];
                snapshot.forEach(doc => {
                    species.push({ id: doc.id, ...doc.data() });
                });
                DebugLog.log(`Species fallback returned ${species.length} species`, 'info');
                return { success: true, data: { species } };
            } catch (fallbackError) {
                DebugLog.log('Species fallback also failed: ' + fallbackError.message, 'error');
                return { success: false, error: error.message };
            }
        }
    },
    
    /**
     * Get all class templates
     */
    async getClasses() {
        try {
            console.log('[DEBUG] getClasses() called');
            console.log('[DEBUG] Querying classes collection (enabled=true)...');
            const snapshot = await db.collection('classes').where('enabled', '==', true).get();
            console.log('[DEBUG] Classes query returned', snapshot.size, 'documents');
            
            if (snapshot.empty) {
                await this.seedDefaultClasses();
                return this.getClasses();
            }
            
            const classes = [];
            snapshot.forEach(doc => {
                classes.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('[DEBUG] getClasses() returning', classes.length, 'classes');
            DebugLog.log(`getClasses() returning ${classes.length} classes`, 'info');
            return { success: true, data: { classes } };
        } catch (error) {
            console.error('getClasses error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get all vocation templates
     */
    async getVocations() {
        try {
            const snapshot = await db.collection('vocations').get();
            
            if (snapshot.empty) {
                await this.seedDefaultVocations();
                return this.getVocations();
            }
            
            const vocations = [];
            snapshot.forEach(doc => {
                vocations.push({ id: doc.id, ...doc.data() });
            });
            
            return { success: true, data: { vocations } };
        } catch (error) {
            console.error('getVocations error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== CHARACTER CRUD =============================
    
    /**
     * List all characters for current user
     */
    async listCharacters() {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        try {
            // SECURITY: Always filter by owner_uuid to ensure users can only access their own characters
            const snapshot = await db.collection('characters')
                .where('owner_uuid', '==', this.uuid)
                .orderBy('created_at', 'desc')
                .get();
            
            const characters = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // SECURITY: Double-check ownership
                if (data.owner_uuid === this.uuid) {
                    characters.push({ id: doc.id, ...data });
                }
            });
            
            return { success: true, data: { characters } };
        } catch (error) {
            console.error('listCharacters error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get character by ID for current user
     */
    async getCharacterById(characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        try {
            const doc = await db.collection('characters').doc(characterId).get();
            
            if (!doc.exists) {
                return { success: false, error: 'Character not found' };
            }
            
            const character = { id: doc.id, ...doc.data() };
            
            // SECURITY: Verify ownership
            if (character.owner_uuid !== this.uuid) {
                return { success: false, error: 'Access denied: Character ownership mismatch' };
            }
            
            return { success: true, data: { character } };
        } catch (error) {
            console.error('getCharacterById error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get character for current user (first character, for backward compatibility)
     */
    async getCharacter() {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        try {
            // SECURITY: Always filter by owner_uuid to ensure users can only access their own character
            const snapshot = await db.collection('characters')
                .where('owner_uuid', '==', this.uuid)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                return { success: false, error: 'No character found' };
            }
            
            const doc = snapshot.docs[0];
            let character = { id: doc.id, ...doc.data() };
            
            // SECURITY: Double-check that the character belongs to this user
            if (character.owner_uuid !== this.uuid) {
                console.error('SECURITY VIOLATION: Character owner_uuid does not match current user UUID');
                return { success: false, error: 'Access denied - character ownership mismatch' };
            }
            
            // Migration: Ensure character has universe_id (set to 'default' if missing)
            if (!character.universe_id) {
                try {
                    await doc.ref.update({
                        universe_id: 'default',
                        updated_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    character.universe_id = 'default';
                    console.log(`[Migration] Set universe_id='default' for character ${doc.id}`);
                } catch (migrationError) {
                    console.error('Failed to migrate character universe_id:', migrationError);
                    // Continue anyway - character will work with default universe_id logic
                    character.universe_id = 'default';
                }
            }
            
            return {
                success: true,
                data: {
                    character: character
                }
            };
        } catch (error) {
            console.error('getCharacter error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create a new character
     */
    async createCharacter(charData) {
        if (!this.uuid || this.uuid.trim() === '') {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        try {
            // Check if character already exists
            const existing = await this.getCharacter();
            if (existing.success) {
                return { success: false, error: 'Character already exists' };
            }
            
            // SECURITY: Always set owner_uuid to current user's UUID - cannot be overridden
            // Remove any attempt to set owner_uuid from charData
            if (charData.owner_uuid) {
                delete charData.owner_uuid;
            }
            
            const character = {
                owner_uuid: this.uuid,  // Force to current user's UUID
                universe_id: charData.universe_id || 'default',  // Default to default universe
                name: charData.name || 'Unnamed',
                title: charData.title || '',
                gender: charData.gender || 'other',
                species_id: charData.species_id || 'human',
                class_id: charData.class_id || null,
                
                // Resource pools (object structure: {current, base, max})
                health: charData.health || { current: 100, base: 100, max: 100 },
                stamina: charData.stamina || { current: 100, base: 100, max: 100 },
                mana: charData.mana || { current: 50, base: 50, max: 50 },
                has_mana: charData.has_mana !== undefined ? charData.has_mana : false,
                
                // Action slots for readied items/spells/buffs
                action_slots: charData.action_slots || [],
                
                // Mode (roleplay, tournament, ooc, afk)
                mode: charData.mode || 'roleplay',
                
                // XP and currency
                xp_total: 100,
                xp_available: 100,
                currency: 50,
                
                // Stats
                stats: charData.stats || this.getDefaultStats(),
                stats_at_class_start: charData.stats || this.getDefaultStats(), // Snapshot for tracking progress
                
                // Career history: array of { class_id, started_at, ended_at, maxed, stats_gained, abandoned }
                career_history: [],
                
                // Inventory
                inventory: [],
                
                // Timestamps
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('characters').add(character);
            
            return { 
                success: true, 
                data: { 
                    character: { id: docRef.id, ...character },
                    message: 'Character created!' 
                } 
            };
        } catch (error) {
            console.error('createCharacter error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete current character
     */
    async deleteCharacter() {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        try {
            // Find character by owner_uuid
            const snapshot = await db.collection('characters')
                .where('owner_uuid', '==', this.uuid)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                return { success: false, error: 'No character found' };
            }
            
            // Delete the character document
            const doc = snapshot.docs[0];
            await doc.ref.delete();
            
            return {
                success: true,
                data: {
                    message: 'Character deleted successfully'
                }
            };
        } catch (error) {
            console.error('deleteCharacter error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update character
     */
    async updateCharacter(charData) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID' };
        }
        
        try {
            const snapshot = await db.collection('characters')
                .where('owner_uuid', '==', this.uuid)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                return { success: false, error: 'No character found' };
            }
            
            const doc = snapshot.docs[0];
            const updateData = {
                ...charData,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Don't allow changing owner_uuid
            delete updateData.owner_uuid;
            delete updateData.id;
            
            await doc.ref.update(updateData);
            
            return { 
                success: true, 
                data: { 
                    character: { id: doc.id, ...doc.data(), ...updateData },
                    message: 'Character saved!' 
                } 
            };
        } catch (error) {
            console.error('updateCharacter error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Change character's class with career history tracking
     * @param {string} newClassId - The class to change to
     * @param {object} classData - The class template data
     * @param {boolean} isFreeAdvance - If true, no XP cost
     */
    async changeClass(newClassId, classData, isFreeAdvance = false) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID' };
        }
        
        try {
            const charResult = await this.getCharacter();
            if (!charResult.success) {
                return { success: false, error: 'No character found' };
            }
            
            const character = charResult.data.character;
            const currentClassId = character.class_id;
            // Support multiple prerequisites (array format)
            const prerequisites = Array.isArray(classData.prerequisites) ? classData.prerequisites : [];
            
            // Beginner classes (no prerequisites) always cost 0
            const isBeginnerClass = prerequisites.length === 0;
            const xpCost = isFreeAdvance ? 0 : (isBeginnerClass ? 0 : (classData.xp_cost || 0));
            
            // Check XP if not free advance
            if (!isFreeAdvance && xpCost > 0 && (character.xp_available || 0) < xpCost) {
                return { success: false, error: `Not enough XP. Need ${xpCost}, have ${character.xp_available || 0}` };
            }
            
            // Calculate if we gained any points in current class
            const startStats = character.stats_at_class_start || {};
            const currentStats = character.stats || {};
            let totalGained = 0;
            let isMaxed = true;
            
            // Get current class stat caps (if we have a current class)
            if (currentClassId) {
                const currentClassRef = await db.collection('classes').doc(currentClassId).get();
                const currentClassData = currentClassRef.exists ? currentClassRef.data() : null;
                
                for (const stat in currentStats) {
                    const start = startStats[stat] || 2;
                    const current = currentStats[stat] || 2;
                    totalGained += Math.max(0, current - start);
                    
                    // Check if any stat is below its cap
                    if (currentClassData?.stat_maximums?.[stat]) {
                        if (current < currentClassData.stat_maximums[stat]) {
                            isMaxed = false;
                        }
                    }
                }
            }
            
            // Build career history entry for old class
            const careerHistory = character.career_history || [];
            if (currentClassId) {
                const isAbandoned = totalGained === 0;
                
                if (!isAbandoned) {
                    // Only add to history if they gained at least 1 point
                    careerHistory.push({
                        class_id: currentClassId,
                        started_at: character.class_started_at || new Date().toISOString(),
                        ended_at: new Date().toISOString(),
                        maxed: isMaxed,
                        stats_gained: totalGained,
                        abandoned: false
                    });
                }
                // If abandoned (0 points gained), don't add to career history
            }
            
            // Prepare update
            const updateData = {
                class_id: newClassId,
                class_started_at: new Date().toISOString(),
                stats_at_class_start: { ...currentStats }, // Snapshot current stats
                career_history: careerHistory,
                xp_available: (character.xp_available || 0) - xpCost,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const result = await this.updateCharacter(updateData);
            
            if (result.success) {
                if (isFreeAdvance) {
                    result.data.message = `Advanced to ${classData.name}!`;
                } else if (xpCost === 0) {
                    result.data.message = `Changed class to ${classData.name} (Free)`;
                } else {
                    result.data.message = `Changed class to ${classData.name} (${xpCost} XP)`;
                }
                result.data.career_history = careerHistory;
            }
            
            return result;
        } catch (error) {
            console.error('changeClass error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Check if character can change to a class
     * @param {object} character - Character data
     * @param {object} classData - Class template data
     * @param {Array} allClasses - All class templates
     */
    canChangeToClass(character, classData, allClasses = []) {
        const result = {
            canChange: false,
            isFreeAdvance: false,
            xpCost: 0,
            reason: ''
        };
        
        // Support both single prerequisite (backward compat) and multiple prerequisites
        const prerequisites = classData.prerequisites || (classData.prerequisite ? [classData.prerequisite] : []);
        
        // Beginner classes (no prerequisites) always cost 0
        const isBeginnerClass = prerequisites.length === 0;
        if (!isBeginnerClass) {
            result.xpCost = classData.xp_cost || 0;
        }
        
        // Check prerequisites - character needs ANY one of them
        if (prerequisites.length > 0) {
            const careerHistory = character.career_history || [];
            const hasAnyPrereq = prerequisites.some(prereqId => {
                return character.class_id === prereqId ||
                    careerHistory.some(h => h.class_id === prereqId && !h.abandoned);
            });
            
            if (!hasAnyPrereq) {
                // Get prerequisite names for display
                const prereqNames = prerequisites
                    .map(id => allClasses.find(c => c.id === id)?.name || id)
                    .join(' or ');
                result.reason = `Requires one of: ${prereqNames}`;
                return result;
            }
        }
        
        // Check minimum stat requirements
        if (classData.stat_minimums) {
            const stats = character.stats || {};
            const missingStats = [];
            
            for (const [stat, minValue] of Object.entries(classData.stat_minimums)) {
                const currentValue = stats[stat] || 2; // Default stat value
                if (currentValue < minValue) {
                    // Format stat name (simple version - just capitalize and replace underscores)
                    const statName = stat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    missingStats.push(`${statName}: ${currentValue}/${minValue}`);
                }
            }
            
            if (missingStats.length > 0) {
                result.reason = `Stat requirements not met: ${missingStats.join(', ')}`;
                return result;
            }
        }
        
        // Check if this is a free advance from current class
        if (character.class_id) {
            const currentClass = allClasses.find(c => c.id === character.class_id);
            if (currentClass && (currentClass.free_advances || []).includes(classData.id)) {
                // Check if maxed current class
                const isMaxed = this.isClassMaxed(character, currentClass);
                if (isMaxed) {
                    result.isFreeAdvance = true;
                    result.xpCost = 0;
                }
            }
        }
        
        // Check XP
        if (!result.isFreeAdvance && result.xpCost > (character.xp_available || 0)) {
            result.reason = `Need ${result.xpCost} XP (have ${character.xp_available || 0})`;
            return result;
        }
        
        result.canChange = true;
        return result;
    },
    
    /**
     * Check if character has maxed their current class
     */
    isClassMaxed(character, classData) {
        if (!classData || !classData.stat_maximums) return false;
        
        const stats = character.stats || {};
        const caps = classData.stat_maximums;
        
        for (const stat in caps) {
            if ((stats[stat] || 2) < caps[stat]) {
                return false;
            }
        }
        return true;
    },
    
    /**
     * Get completed classes for character (classes they've maxed)
     */
    getCompletedClasses(character) {
        return (character.career_history || [])
            .filter(h => h.maxed && !h.abandoned)
            .map(h => h.class_id);
    },
    
    // =========================== DICE ROLLING ===============================
    
    /**
     * Roll exploding d20 pool (client-side for now)
     */
    rollExplodingD20Pool(poolSize) {
        poolSize = Math.max(1, Math.min(poolSize, 20));
        
        let total = 0;
        let allRolls = [];
        let explosions = 0;
        
        for (let i = 0; i < poolSize; i++) {
            let roll = Math.floor(Math.random() * 20) + 1;
            let subtotal = roll;
            allRolls.push(roll);
            
            while (roll === 20) {
                roll = Math.floor(Math.random() * 20) + 1;
                subtotal += roll;
                allRolls.push(roll);
                explosions++;
            }
            
            total += subtotal;
        }
        
        return { total, allRolls, explosions, poolSize };
    },
    
    /**
     * Perform a skill test
     */
    async rollTest(stat, difficulty = 10, modifier = 0) {
        try {
            const charResult = await this.getCharacter();
            if (!charResult.success) {
                return { success: false, error: 'No character' };
            }
            
            const character = charResult.data.character;
            const statValue = character.stats?.[stat] || 1;
            
            const roll = this.rollExplodingD20Pool(statValue);
            
            // Calculate vocation bonus (simplified for now)
            let vocationBonus = 0;
            // TODO: Look up vocation from class
            
            const finalResult = roll.total + vocationBonus + modifier;
            const success = finalResult >= difficulty;
            
            return {
                success: true,
                data: {
                    stat,
                    stat_value: statValue,
                    roll_total: roll.total,
                    all_rolls: roll.allRolls,
                    explosions: roll.explosions,
                    vocation_bonus: vocationBonus,
                    modifier,
                    final_result: finalResult,
                    difficulty,
                    margin: finalResult - difficulty,
                    success
                }
            };
        } catch (error) {
            console.error('rollTest error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== HELPERS ====================================
    
    getDefaultStats() {
        // Use F3 seed data if available
        if (typeof F4_SEED_DATA !== 'undefined') {
            return F4_SEED_DATA.getDefaultStats();
        }
        // Fallback: F3 stats all at 2
        return {
            agility: 2, animal_handling: 2, athletics: 2, awareness: 2, crafting: 2,
            deception: 2, endurance: 2, entertaining: 2, fighting: 2, healing: 2,
            influence: 2, intelligence: 2, knowledge: 2, marksmanship: 2, persuasion: 2,
            stealth: 2, survival: 2, thievery: 2, will: 2, wisdom: 2
        };
    },
    
    // =========================== SEED DATA ==================================
    // Uses F4_SEED_DATA from seed-data.js for 122 classes and 21 species
    
    async seedDefaultSpecies() {
        console.log('Seeding default species from F4 data...');
        
        if (typeof F4_SEED_DATA === 'undefined') {
            console.error('F4_SEED_DATA not loaded!');
            return;
        }
        
        const allSpecies = F4_SEED_DATA.getFullSpeciesData();
        console.log(`Seeding ${allSpecies.length} species...`);
        
        const batch = db.batch();
        allSpecies.forEach(sp => {
            const ref = db.collection('species').doc(sp.id);
            batch.set(ref, { ...sp, enabled: true });
        });
        await batch.commit();
        console.log('Species seeding complete!');
    },
    
    async seedDefaultClasses() {
        console.log('Seeding default classes from F4 data...');
        
        if (typeof F4_SEED_DATA === 'undefined') {
            console.error('F4_SEED_DATA not loaded!');
            return;
        }
        
        const allClasses = F4_SEED_DATA.getFullClassData();
        console.log(`Seeding ${allClasses.length} classes...`);
        
        // Firestore batch limit is 500, so we need to batch in chunks
        const batchSize = 450;
        for (let i = 0; i < allClasses.length; i += batchSize) {
            const chunk = allClasses.slice(i, i + batchSize);
            const batch = db.batch();
            chunk.forEach(cls => {
                const ref = db.collection('classes').doc(cls.id);
                batch.set(ref, { ...cls, enabled: true });
            });
            await batch.commit();
            console.log(`Committed batch ${Math.floor(i / batchSize) + 1}`);
        }
        console.log('Classes seeding complete!');
    },
    
    async seedDefaultGenders() {
        console.log('Seeding default genders...');
        
        if (typeof F4_SEED_DATA === 'undefined') {
            console.error('F4_SEED_DATA not loaded!');
            return;
        }
        
        const genders = F4_SEED_DATA.getGenderData();
        console.log(`Seeding ${genders.length} genders...`);
        
        const batch = db.batch();
        genders.forEach(g => {
            const ref = db.collection('genders').doc(g.id);
            batch.set(ref, { ...g, enabled: true });
        });
        await batch.commit();
        console.log('Gender seeding complete!');
    },
    
    async getGenders() {
        try {
            console.log('[DEBUG] getGenders() called');
            // Try with enabled filter first
            console.log('[DEBUG] Querying genders collection (enabled=true)...');
            let snapshot = await db.collection('genders').where('enabled', '==', true).get();
            console.log('[DEBUG] Genders query returned', snapshot.size, 'documents');
            
            // If empty, check if collection exists at all (might be seeding)
            if (snapshot.empty) {
                const allSnapshot = await db.collection('genders').limit(1).get();
                if (allSnapshot.empty) {
                    // No genders at all - seed them
                    console.log('No genders found, seeding...');
                    await this.seedDefaultGenders();
                    // Retry with a small delay
                    await new Promise(resolve => setTimeout(resolve, 500));
                    snapshot = await db.collection('genders').where('enabled', '==', true).get();
                } else {
                    // Genders exist but none are enabled - use all
                    snapshot = await db.collection('genders').get();
                }
            }
            
            const genders = [];
            snapshot.forEach(doc => {
                genders.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('[DEBUG] getGenders() returning', genders.length, 'genders');
            DebugLog.log(`getGenders() returning ${genders.length} genders`, 'info');
            return { success: true, data: { genders } };
        } catch (error) {
            console.error('getGenders error:', error);
            // Fallback: try without enabled filter
            try {
                const snapshot = await db.collection('genders').get();
                const genders = [];
                snapshot.forEach(doc => {
                    genders.push({ id: doc.id, ...doc.data() });
                });
                return { success: true, data: { genders } };
            } catch (fallbackError) {
                return { success: false, error: error.message };
            }
        }
    },
    
    async seedDefaultVocations() {
        console.log('Seeding default vocations...');
        // Create vocations based on unique vocation_ids from classes
        const vocations = [
            { id: 'combat', name: 'Combat Training', primary_stat: 'fighting', secondary_stat: 'endurance', applies_to: ['fighting', 'athletics'] },
            { id: 'stealth', name: 'Shadow Arts', primary_stat: 'stealth', secondary_stat: 'agility', applies_to: ['stealth', 'thievery'] },
            { id: 'magic', name: 'Arcane Studies', primary_stat: 'intelligence', secondary_stat: 'will', applies_to: ['knowledge', 'wisdom'] },
            { id: 'crafting', name: 'Master Crafting', primary_stat: 'crafting', secondary_stat: 'intelligence', applies_to: ['crafting', 'knowledge'] },
            { id: 'faith', name: 'Divine Calling', primary_stat: 'will', secondary_stat: 'wisdom', applies_to: ['healing', 'influence'] },
            { id: 'commerce', name: 'Trade Mastery', primary_stat: 'persuasion', secondary_stat: 'awareness', applies_to: ['persuasion', 'deception'] },
            { id: 'survival', name: 'Wilderness Lore', primary_stat: 'survival', secondary_stat: 'awareness', applies_to: ['survival', 'animal_handling'] },
            { id: 'entertainment', name: 'Performance Arts', primary_stat: 'entertaining', secondary_stat: 'persuasion', applies_to: ['entertaining', 'influence'] },
            { id: 'crime', name: 'Criminal Expertise', primary_stat: 'thievery', secondary_stat: 'deception', applies_to: ['thievery', 'stealth', 'deception'] },
            { id: 'healing', name: 'Healing Arts', primary_stat: 'healing', secondary_stat: 'knowledge', applies_to: ['healing', 'awareness'] },
            { id: 'hunting', name: 'Hunter\'s Instinct', primary_stat: 'marksmanship', secondary_stat: 'awareness', applies_to: ['marksmanship', 'survival'] },
            { id: 'scholarship', name: 'Academic Knowledge', primary_stat: 'knowledge', secondary_stat: 'intelligence', applies_to: ['knowledge', 'wisdom'] },
            { id: 'exploration', name: 'Wanderer\'s Path', primary_stat: 'awareness', secondary_stat: 'agility', applies_to: ['awareness', 'athletics', 'survival'] },
            { id: 'protection', name: 'Guardian\'s Duty', primary_stat: 'fighting', secondary_stat: 'awareness', applies_to: ['fighting', 'awareness'] },
            { id: 'dark_magic', name: 'Forbidden Arts', primary_stat: 'intelligence', secondary_stat: 'will', applies_to: ['knowledge', 'deception'] },
            { id: 'law', name: 'Legal Authority', primary_stat: 'influence', secondary_stat: 'knowledge', applies_to: ['influence', 'persuasion'] },
            { id: 'nobility', name: 'Noble Bearing', primary_stat: 'influence', secondary_stat: 'awareness', applies_to: ['influence', 'persuasion', 'entertaining'] },
            { id: 'general', name: 'Jack of All Trades', primary_stat: 'awareness', secondary_stat: 'will', applies_to: ['awareness', 'survival'] },
        ];
        
        const batch = db.batch();
        vocations.forEach(voc => {
            const ref = db.collection('vocations').doc(voc.id);
            batch.set(ref, voc);
        });
        await batch.commit();
    },
    
    createBaseStats(defaultValue, overrides = {}) {
        // Use F3 stat names
        const stats = {};
        const names = F4_SEED_DATA?.statNames || [
            'agility', 'animal_handling', 'athletics', 'awareness', 'crafting',
            'deception', 'endurance', 'entertaining', 'fighting', 'healing',
            'influence', 'intelligence', 'knowledge', 'marksmanship', 'persuasion',
            'stealth', 'survival', 'thievery', 'will', 'wisdom'
        ];
        names.forEach(s => stats[s] = overrides[s] !== undefined ? overrides[s] : defaultValue);
        return stats;
    },
    
    createStatCaps(defaultValue, overrides = {}) {
        return this.createBaseStats(defaultValue, overrides);
    },
    
    // =========================== ADMIN: USER MANAGEMENT =======================
    
    /**
     * Super Admin UUID - only this user can promote others to sys_admin
     */
    SUPER_ADMIN_UUID: '4d4e9fdc-41ae-42c3-bbc9-fc01ce159130',
    
    /**
     * List all users (admin only)
     */
    async listUsers() {
        try {
            if (this.role !== 'sim_admin' && this.role !== 'sys_admin') {
                return { success: false, error: 'Unauthorized: Admin access required' };
            }
            
            const snapshot = await db.collection('users').get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({ uuid: doc.id, ...doc.data() });
            });
            
            return { success: true, data: { users } };
        } catch (error) {
            console.error('listUsers error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Promote or demote a user
     * Only super admin can promote to sys_admin
     */
    async promoteUser(targetUUID, newRole) {
        try {
            if (this.role !== 'sim_admin' && this.role !== 'sys_admin') {
                return { success: false, error: 'Unauthorized: Admin access required' };
            }
            
            // Only super admin can promote to sys_admin
            if (newRole === 'sys_admin' && this.uuid !== this.SUPER_ADMIN_UUID) {
                return { success: false, error: 'Unauthorized: Only the Super Admin can create System Admins' };
            }
            
            // Only super admin can demote sys_admin
            const targetRef = db.collection('users').doc(targetUUID);
            const targetDoc = await targetRef.get();
            if (targetDoc.exists) {
                const currentRole = targetDoc.data().role;
                if (currentRole === 'sys_admin' && this.uuid !== this.SUPER_ADMIN_UUID) {
                    return { success: false, error: 'Unauthorized: Only the Super Admin can modify System Admins' };
                }
            }
            
            const validRoles = ['player', 'sim_admin', 'sys_admin', 'universe_admin'];
            if (!validRoles.includes(newRole)) {
                return { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
            }
            
            await targetRef.update({
                role: newRole,
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                promoted_by: this.uuid,
                promoted_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, data: { target_uuid: targetUUID, new_role: newRole } };
        } catch (error) {
            console.error('promoteUser error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Ban or unban a user
     */
    async banUser(targetUUID, banned) {
        try {
            if (this.role !== 'sim_admin' && this.role !== 'sys_admin') {
                return { success: false, error: 'Unauthorized: Admin access required' };
            }
            
            // Super admin cannot be banned
            if (targetUUID === this.SUPER_ADMIN_UUID) {
                return { success: false, error: 'Cannot ban the Super Admin' };
            }
            
            await db.collection('users').doc(targetUUID).update({
                banned: banned === true,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, data: { target_uuid: targetUUID, banned: banned === true } };
        } catch (error) {
            console.error('banUser error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Initialize super admin (call this once to set up the super admin)
     */
    async initializeSuperAdmin() {
        try {
            const superAdminRef = db.collection('users').doc(this.SUPER_ADMIN_UUID);
            const superAdminDoc = await superAdminRef.get();
            
            if (!superAdminDoc.exists) {
                // Create super admin user
                await superAdminRef.set({
                    uuid: this.SUPER_ADMIN_UUID,
                    username: 'Super Admin',
                    display_name: 'Super Admin',
                    role: 'sys_admin',
                    is_super_admin: true,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    last_login: firebase.firestore.FieldValue.serverTimestamp(),
                    banned: false
                });
                console.log('Super Admin created!');
            } else {
                // Update existing user to super admin
                await superAdminRef.update({
                    role: 'sys_admin',
                    is_super_admin: true,
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('Super Admin updated!');
            }
            
            return { success: true };
        } catch (error) {
            console.error('initializeSuperAdmin error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== ADMIN: TEMPLATE MANAGEMENT ===================
    
    /**
     * Save a template (create or update)
     */
    async saveTemplate(type, id, templateData, isNew = false) {
        try {
            if (!['species', 'classes', 'genders'].includes(type)) {
                throw new Error('Invalid template type');
            }
            
            // Ensure ID matches
            templateData.id = id;
            
            const ref = db.collection(type).doc(id);
            
            // Sanitize data before sending to Firestore (for both create and update)
            const sanitizedData = { ...templateData };
            
            // Ensure all array fields contain only strings
            if (Array.isArray(sanitizedData.prerequisites)) {
                sanitizedData.prerequisites = sanitizedData.prerequisites
                    .map(p => String(p).trim())
                    .filter(p => p);
            } else if (sanitizedData.prerequisites != null) {
                sanitizedData.prerequisites = [String(sanitizedData.prerequisites)].filter(p => p);
            } else {
                sanitizedData.prerequisites = [];
            }
            
            if (Array.isArray(sanitizedData.free_advances)) {
                sanitizedData.free_advances = sanitizedData.free_advances
                    .map(f => String(f).trim())
                    .filter(f => f);
            } else if (sanitizedData.free_advances != null) {
                sanitizedData.free_advances = [String(sanitizedData.free_advances)].filter(f => f);
            } else {
                sanitizedData.free_advances = [];
            }
            
            // Ensure stat objects are plain objects (not class instances)
            if (sanitizedData.stat_minimums && typeof sanitizedData.stat_minimums === 'object') {
                sanitizedData.stat_minimums = JSON.parse(JSON.stringify(sanitizedData.stat_minimums));
            }
            if (sanitizedData.stat_maximums && typeof sanitizedData.stat_maximums === 'object') {
                sanitizedData.stat_maximums = JSON.parse(JSON.stringify(sanitizedData.stat_maximums));
            }
            
            if (isNew) {
                // Check if already exists
                const existing = await ref.get();
                if (existing.exists) {
                    throw new Error(`A ${type.slice(0, -1)} with ID "${id}" already exists`);
                }
                await ref.set({
                    ...sanitizedData,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Use the already-sanitized data from above
                // Log the complete data structure before sending
                console.log(`[saveTemplate] Complete data structure for ${type}/${id}:`, JSON.stringify(sanitizedData, null, 2));
                
                // Validate each field type before sending
                const finalData = {};
                for (const [key, value] of Object.entries(sanitizedData)) {
                    // Skip Firestore-specific fields
                    if (key === 'created_at' || key === 'updated_at' || key === 'deleted_at') {
                        continue;
                    }
                    
                    // Validate and convert each field
                    if (Array.isArray(value)) {
                        finalData[key] = value.map(v => {
                            const str = String(v);
                            if (typeof v !== 'string') {
                                console.warn(`[saveTemplate] Converting non-string array element in ${key}:`, typeof v, v);
                            }
                            return str;
                        });
                    } else if (value === null || value === undefined) {
                        // Skip null/undefined
                        continue;
                    } else if (typeof value === 'object') {
                        // Deep clone objects to ensure they're plain
                        try {
                            finalData[key] = JSON.parse(JSON.stringify(value));
                        } catch (e) {
                            console.error(`[saveTemplate] Failed to clone object for ${key}:`, e, value);
                            finalData[key] = {};
                        }
                    } else {
                        // Primitive types - ensure they're the right type
                        if (key === 'enabled') {
                            finalData[key] = Boolean(value);
                        } else if (key === 'xp_cost') {
                            finalData[key] = Number(value) || 0;
                        } else {
                            finalData[key] = String(value);
                        }
                    }
                }
                
                // Add timestamp
                finalData.updated_at = firebase.firestore.FieldValue.serverTimestamp();
                
                console.log(`[saveTemplate] Final data to send for ${type}/${id}:`, JSON.stringify(finalData, (key, value) => {
                    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'FieldValue') {
                        return '[FieldValue]';
                    }
                    return value;
                }, 2));
                
                await ref.update(finalData);
            }
            
            return { success: true, data: { id } };
        } catch (error) {
            console.error(`saveTemplate error (${type}):`, error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete a template (actually just disables it)
     */
    async deleteTemplate(type, id) {
        try {
            if (!['species', 'classes', 'genders'].includes(type)) {
                throw new Error('Invalid template type');
            }
            
            const ref = db.collection(type).doc(id);
            await ref.update({
                enabled: false,
                deleted_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            console.error(`deleteTemplate error (${type}):`, error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== LSL COMMUNICATION ============================
    
    /**
     * Build an LSL command string
     * Commands use pipe-delimited format: COMMAND|param1|param2|...
     * These are sent via region chat on the hudChannel
     * 
     * Since MOAP can't directly chat in SL, these are stored for:
     * 1. User to manually copy/paste
     * 2. Future: External relay service
     * 3. Future: LSL HTTP polling
     */
    buildLSLCommand(command, ...params) {
        return [command, ...params].join('|');
    },
    
    /**
     * Queue an announcement for LSL
     * Returns the formatted command for display/relay
     */
    queueAnnouncement(message) {
        const cmd = this.buildLSLCommand('ANNOUNCE', message);
        console.log('LSL Command:', cmd);
        return cmd;
    },
    
    /**
     * Queue a roll announcement for LSL
     */
    queueRollAnnouncement(stat, diceStr, target, result, success) {
        const cmd = this.buildLSLCommand('ROLL', stat, diceStr, target, result, success ? 'true' : 'false');
        console.log('LSL Roll Command:', cmd);
        return cmd;
    },
    
    /**
     * Queue a combat announcement for LSL
     */
    queueCombatAnnouncement(action, target, damage, effect) {
        const cmd = this.buildLSLCommand('COMBAT', action, target || '', damage || '', effect || '');
        console.log('LSL Combat Command:', cmd);
        return cmd;
    },
    
    /**
     * Get current player display name
     */
    getDisplayName() {
        return this.displayName || this.username || 'Unknown';
    },
    
    // Keep compatibility with old interface
    async heartbeat() {
        return { success: true };
    },
    
    async logout() {
        await auth.signOut();
        return { success: true };
    },
    
    // =========================== UNIVERSE SYSTEM =============================
    
    /**
     * Check if user is Universe Admin
     */
    isUniverseAdmin() {
        return this.role === 'universe_admin';
    },
    
    /**
     * Check if user can create universes
     */
    canCreateUniverse() {
        return this.role === 'universe_admin' || this.role === 'sys_admin' || this.uuid === this.SUPER_ADMIN_UUID;
    },
    
    /**
     * Check if user can edit a specific universe
     * @param {string} universeId - Universe ID to check
     * @param {object} universe - Universe document data (optional, will fetch if not provided)
     */
    async canEditUniverse(universeId, universe = null) {
        // Super User and System Admin can edit any universe
        if (this.uuid === this.SUPER_ADMIN_UUID || this.role === 'sys_admin') {
            return true;
        }
        
        // Universe Admin can only edit universes they own
        if (this.role === 'universe_admin') {
            // Fetch universe if not provided
            if (!universe) {
                const universeDoc = await db.collection('universes').doc(universeId).get();
                if (!universeDoc.exists) {
                    return false;
                }
                universe = universeDoc.data();
            }
            
            // Check if user is the owner
            if (universe.ownerAdminId === this.uuid) {
                return true;
            }
            
            // Check if user is in the admins subcollection
            const adminDoc = await db.collection('universes').doc(universeId)
                .collection('admins').doc(this.uuid).get();
            if (adminDoc.exists) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * Check if user can delete a specific universe
     * @param {string} universeId - Universe ID to check
     */
    async canDeleteUniverse(universeId) {
        // Default Universe cannot be deleted
        if (universeId === 'default') {
            return false;
        }
        
        // Super User can delete anything (except default, handled above)
        if (this.uuid === this.SUPER_ADMIN_UUID) {
            return true;
        }
        
        // System Admin can delete any universe except default
        if (this.role === 'sys_admin') {
            return true;
        }
        
        // Universe Admin can only delete universes they own
        if (this.role === 'universe_admin') {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return false;
            }
            const universe = universeDoc.data();
            return universe.ownerAdminId === this.uuid;
        }
        
        return false;
    },
    
    /**
     * Check if user can assign admins to a specific universe
     * @param {string} universeId - Universe ID to check
     */
    async canAssignUniverseAdmin(universeId) {
        // Super User and System Admin can assign admins to any universe
        if (this.uuid === this.SUPER_ADMIN_UUID || this.role === 'sys_admin') {
            return true;
        }
        
        // Universe Admin can only assign admins to universes they own
        if (this.role === 'universe_admin') {
            return await this.canEditUniverse(universeId);
        }
        
        return false;
    },
    
    /**
     * Create a new universe
     */
    async createUniverse(universeData) {
        try {
            if (!this.canCreateUniverse()) {
                return { success: false, error: 'Unauthorized: Cannot create universes' };
            }
            
            // Validate required fields
            if (!universeData.name || !universeData.name.trim()) {
                return { success: false, error: 'Universe name is required' };
            }
            
            // Generate universe ID from name (lowercase, spaces to underscores)
            const universeId = universeData.id || universeData.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            
            // Check if universe already exists
            const existing = await db.collection('universes').doc(universeId).get();
            if (existing.exists) {
                return { success: false, error: 'Universe with this ID already exists' };
            }
            
            // Build universe document
            const universe = {
                name: universeData.name.trim(),
                description: universeData.description || '',
                theme: universeData.theme || '',
                roleplayType: universeData.roleplayType || '',
                imageUrl: universeData.imageUrl || '',
                groupSlurl: universeData.groupSlurl || '',
                welcomeSlurl: universeData.welcomeSlurl || '',
                landmarks: universeData.landmarks || [],
                contacts: universeData.contacts || [],
                maturityRating: universeData.maturityRating || 'general',
                
                ownerAdminId: this.uuid,
                active: universeData.active !== undefined ? universeData.active : false,
                visibility: universeData.visibility || 'public',
                
                acceptNewPlayers: universeData.acceptNewPlayers || 'open',
                signupKeyHash: universeData.signupKeyHash || '',
                
                characterLimit: universeData.characterLimit !== undefined ? universeData.characterLimit : 0,
                manaEnabled: universeData.manaEnabled !== undefined ? universeData.manaEnabled : true,
                
                allowedGenders: universeData.allowedGenders || [],
                allowedSpecies: universeData.allowedSpecies || [],
                allowedClasses: universeData.allowedClasses || [],
                allowedCareers: universeData.allowedCareers || [],
                
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                deleted: false
            };
            
            // Create universe document
            await db.collection('universes').doc(universeId).set(universe);
            
            // Create admin entry for owner
            await db.collection('universes').doc(universeId)
                .collection('admins').doc(this.uuid).set({
                    role: 'owner',
                    addedBy: this.uuid,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            return { 
                success: true, 
                data: { universe: { id: universeId, ...universe } } 
            };
        } catch (error) {
            console.error('createUniverse error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update a universe
     */
    async updateUniverse(universeId, updates) {
        try {
            if (!await this.canEditUniverse(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot edit this universe' };
            }
            
            // Default Universe can only be edited by System Admin or Super User
            if (universeId === 'default' && this.role !== 'sys_admin' && this.uuid !== this.SUPER_ADMIN_UUID) {
                return { success: false, error: 'Unauthorized: Default Universe can only be edited by System Admins' };
            }
            
            // Prevent changing ownerAdminId
            if (updates.ownerAdminId) {
                delete updates.ownerAdminId;
            }
            
            // Prevent changing Default Universe ID
            if (universeId === 'default') {
                // Default Universe must remain active
                updates.active = true;
                updates.deleted = false;
                
                // Only Super User can change maturityRating for default universe
                if (updates.maturityRating !== undefined && this.uuid !== this.SUPER_ADMIN_UUID) {
                    delete updates.maturityRating;
                }
            }
            
            // Update universe
            const updateData = {
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('universes').doc(universeId).update(updateData);
            
            // Fetch updated universe
            const updatedDoc = await db.collection('universes').doc(universeId).get();
            return { 
                success: true, 
                data: { universe: { id: updatedDoc.id, ...updatedDoc.data() } } 
            };
        } catch (error) {
            console.error('updateUniverse error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete a universe (soft delete, reassigns characters to default)
     */
    async deleteUniverse(universeId) {
        try {
            if (!await this.canDeleteUniverse(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot delete this universe' };
            }
            
            // Soft delete: set deleted flag
            await db.collection('universes').doc(universeId).update({
                deleted: true,
                active: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Reassign all characters in this universe to default universe
            const charactersSnapshot = await db.collection('characters')
                .where('universe_id', '==', universeId).get();
            
            const batch = db.batch();
            charactersSnapshot.forEach(doc => {
                batch.update(doc.ref, {
                    universe_id: 'default',
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            
            return { 
                success: true, 
                data: { 
                    universeId,
                    charactersReassigned: charactersSnapshot.size 
                } 
            };
        } catch (error) {
            console.error('deleteUniverse error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Migrate characters without universe_id to default universe
     * This is a one-time migration function that should be run after the universe system is implemented
     * @param {boolean} dryRun - If true, only reports what would be changed without making changes
     */
    async migrateCharactersToUniverse(dryRun = false) {
        try {
            // Only sys_admin and super admin can run migrations
            if (this.role !== 'sys_admin' && this.uuid !== this.SUPER_ADMIN_UUID) {
                return { success: false, error: 'Unauthorized: Only System Admins can run migrations' };
            }
            
            // Query all characters
            const snapshot = await db.collection('characters').get();
            let migratedCount = 0;
            const batch = db.batch();
            let batchCount = 0;
            const maxBatchSize = 500; // Firestore batch limit
            
            snapshot.forEach(doc => {
                const data = doc.data();
                // Check if character lacks universe_id or has it set to null/undefined
                if (!data.universe_id || data.universe_id === null || data.universe_id === undefined) {
                    if (!dryRun) {
                        batch.update(doc.ref, {
                            universe_id: 'default',
                            updated_at: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        batchCount++;
                        migratedCount++;
                        
                        // Commit batch if it reaches the limit
                        if (batchCount >= maxBatchSize) {
                            // Note: Can't commit partial batch in forEach, so we'll commit at the end
                            // If we need to handle large migrations, we'd need to refactor to process in chunks
                        }
                    } else {
                        migratedCount++;
                    }
                }
            });
            
            if (!dryRun && batchCount > 0) {
                await batch.commit();
            }
            
            return {
                success: true,
                data: {
                    charactersFound: snapshot.size,
                    charactersMigrated: migratedCount,
                    dryRun: dryRun,
                    message: dryRun 
                        ? `Would migrate ${migratedCount} characters to default universe`
                        : `Successfully migrated ${migratedCount} characters to default universe`
                }
            };
        } catch (error) {
            console.error('migrateCharactersToUniverse error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get a single universe
     */
    async getUniverse(universeId) {
        try {
            const doc = await db.collection('universes').doc(universeId).get();
            if (!doc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            
            const data = doc.data();
            // Don't return deleted universes
            if (data.deleted) {
                return { success: false, error: 'Universe not found' };
            }
            
            return { 
                success: true, 
                data: { universe: { id: doc.id, ...data } } 
            };
        } catch (error) {
            console.error('getUniverse error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * List universes that the current user can manage
     */
    async listUniversesForAdmin() {
        try {
            let universes = [];
            
            if (this.role === 'sys_admin' || this.uuid === this.SUPER_ADMIN_UUID) {
                // System Admin and Super User can see all universes
                const snapshot = await db.collection('universes')
                    .where('deleted', '==', false).get();
                snapshot.forEach(doc => {
                    universes.push({ id: doc.id, ...doc.data() });
                });
            } else if (this.role === 'universe_admin') {
                // Universe Admin can only see universes they own or are admin of
                // First, get universes where user is owner
                const ownedSnapshot = await db.collection('universes')
                    .where('ownerAdminId', '==', this.uuid)
                    .where('deleted', '==', false).get();
                ownedSnapshot.forEach(doc => {
                    universes.push({ id: doc.id, ...doc.data() });
                });
                
                // Then, get universes where user is in admins subcollection
                // (This requires a different approach - get all universes and filter)
                const allSnapshot = await db.collection('universes')
                    .where('deleted', '==', false).get();
                
                for (const doc of allSnapshot.docs) {
                    // Skip if already added (from owner query)
                    if (universes.find(u => u.id === doc.id)) {
                        continue;
                    }
                    
                    // Check if user is admin
                    const adminDoc = await db.collection('universes').doc(doc.id)
                        .collection('admins').doc(this.uuid).get();
                    if (adminDoc.exists) {
                        universes.push({ id: doc.id, ...doc.data() });
                    }
                }
            } else {
                return { success: false, error: 'Unauthorized: Admin access required' };
            }
            
            return { success: true, data: { universes } };
        } catch (error) {
            console.error('listUniversesForAdmin error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * List universes available for character creation
     */
    async listAvailableUniverses() {
        try {
            // Include Default Universe + all active universes that accept new players
            const universes = [];
            
            // Always include Default Universe
            const defaultDoc = await db.collection('universes').doc('default').get();
            if (defaultDoc.exists) {
                const defaultData = defaultDoc.data();
                if (!defaultData.deleted) {
                    universes.push({ id: 'default', ...defaultData });
                }
            }
            
            // Get all active universes that are not closed
            const snapshot = await db.collection('universes')
                .where('active', '==', true)
                .where('deleted', '==', false)
                .get();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                // Skip default (already added) and closed universes
                if (doc.id !== 'default' && data.acceptNewPlayers !== 'closed') {
                    universes.push({ id: doc.id, ...data });
                }
            });
            
            return { success: true, data: { universes } };
        } catch (error) {
            console.error('listAvailableUniverses error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Assign a Universe Admin to a universe
     */
    async assignUniverseAdmin(universeId, adminUuid, role = 'admin') {
        try {
            if (!await this.canAssignUniverseAdmin(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot assign admins to this universe' };
            }
            
            if (role !== 'owner' && role !== 'admin') {
                return { success: false, error: 'Invalid role. Must be "owner" or "admin"' };
            }
            
            // Verify user exists
            const userDoc = await db.collection('users').doc(adminUuid).get();
            if (!userDoc.exists) {
                return { success: false, error: 'User not found' };
            }
            
            // Add to admins subcollection
            await db.collection('universes').doc(universeId)
                .collection('admins').doc(adminUuid).set({
                    role: role,
                    addedBy: this.uuid,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // If role is owner, update universe ownerAdminId
            if (role === 'owner') {
                await db.collection('universes').doc(universeId).update({
                    ownerAdminId: adminUuid,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            return { success: true, data: { universeId, adminUuid, role } };
        } catch (error) {
            console.error('assignUniverseAdmin error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Remove a Universe Admin from a universe
     */
    async removeUniverseAdmin(universeId, adminUuid) {
        try {
            if (!await this.canAssignUniverseAdmin(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot remove admins from this universe' };
            }
            
            // Cannot remove owner
            const adminDoc = await db.collection('universes').doc(universeId)
                .collection('admins').doc(adminUuid).get();
            if (adminDoc.exists && adminDoc.data().role === 'owner') {
                return { success: false, error: 'Cannot remove the owner of a universe' };
            }
            
            await db.collection('universes').doc(universeId)
                .collection('admins').doc(adminUuid).delete();
            
            return { success: true, data: { universeId, adminUuid } };
        } catch (error) {
            console.error('removeUniverseAdmin error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get all admins for a universe
     */
    async getUniverseAdmins(universeId) {
        try {
            const snapshot = await db.collection('universes').doc(universeId)
                .collection('admins').get();
            
            const admins = [];
            snapshot.forEach(doc => {
                admins.push({ uuid: doc.id, ...doc.data() });
            });
            
            return { success: true, data: { admins } };
        } catch (error) {
            console.error('getUniverseAdmins error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Set universe active state
     */
    async setUniverseActiveState(universeId, active) {
        try {
            if (!await this.canEditUniverse(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot modify this universe' };
            }
            
            // Default Universe must always be active
            if (universeId === 'default' && !active) {
                return { success: false, error: 'Default Universe must always be active' };
            }
            
            await db.collection('universes').doc(universeId).update({
                active: active,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, data: { universeId, active } };
        } catch (error) {
            console.error('setUniverseActiveState error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Set signup key for a universe (hashes the key)
     */
    async setSignupKey(universeId, key) {
        try {
            if (!await this.canEditUniverse(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot modify this universe' };
            }
            
            // Simple hash function (for demo - use proper crypto in production)
            // In a real implementation, use crypto.subtle.digest for proper hashing
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                const char = key.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            const signupKeyHash = hash.toString();
            
            await db.collection('universes').doc(universeId).update({
                signupKeyHash: signupKeyHash,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, data: { universeId } };
        } catch (error) {
            console.error('setSignupKey error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Clear signup key for a universe
     */
    async clearSignupKey(universeId) {
        try {
            if (!await this.canEditUniverse(universeId)) {
                return { success: false, error: 'Unauthorized: Cannot modify this universe' };
            }
            
            await db.collection('universes').doc(universeId).update({
                signupKeyHash: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, data: { universeId } };
        } catch (error) {
            console.error('clearSignupKey error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Validate a signup key
     */
    async validateSignupKey(universeId, inputKey) {
        try {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            
            const universe = universeDoc.data();
            
            // If no key is set, validation passes
            if (!universe.signupKeyHash || universe.signupKeyHash === '') {
                return { success: true, data: { valid: true } };
            }
            
            // Hash the input key
            let hash = 0;
            for (let i = 0; i < inputKey.length; i++) {
                const char = inputKey.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            const inputHash = hash.toString();
            
            const valid = inputHash === universe.signupKeyHash;
            return { success: true, data: { valid } };
        } catch (error) {
            console.error('validateSignupKey error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Validate character limit for a universe
     */
    async validateCharacterLimit(universeId, playerUuid) {
        try {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            
            const universe = universeDoc.data();
            
            // 0 = unlimited
            if (universe.characterLimit === 0) {
                return { success: true, data: { allowed: true, currentCount: 0, limit: 0 } };
            }
            
            // Count existing characters for this player in this universe
            const snapshot = await db.collection('characters')
                .where('owner_uuid', '==', playerUuid)
                .where('universe_id', '==', universeId).get();
            
            const currentCount = snapshot.size;
            const allowed = currentCount < universe.characterLimit;
            
            return { 
                success: true, 
                data: { 
                    allowed, 
                    currentCount, 
                    limit: universe.characterLimit 
                } 
            };
        } catch (error) {
            console.error('validateCharacterLimit error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Validate identity options against universe allowed lists
     */
    async validateIdentityOptions(universeId, genderId, speciesId, classId) {
        try {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            
            const universe = universeDoc.data();
            const errors = [];
            
            // Gender is always allowed (no restrictions)
            
            // Check species
            if (universe.allowedSpecies && universe.allowedSpecies.length > 0) {
                if (!universe.allowedSpecies.includes(speciesId)) {
                    errors.push(`Species "${speciesId}" is not allowed in this universe`);
                }
            }
            
            // Check class
            if (universe.allowedClasses && universe.allowedClasses.length > 0) {
                if (!universe.allowedClasses.includes(classId)) {
                    errors.push(`Class "${classId}" is not allowed in this universe`);
                }
            }
            
            return { 
                success: true, 
                data: { 
                    valid: errors.length === 0,
                    errors 
                } 
            };
        } catch (error) {
            console.error('validateIdentityOptions error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get filtered identity options for a universe
     */
    async getFilteredIdentityOptions(universeId) {
        try {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            
            const universe = universeDoc.data();
            
            // Get all templates
            const [speciesResult, classesResult, gendersResult] = await Promise.all([
                this.getSpecies(),
                this.getClasses(),
                this.getGenders()
            ]);
            
            let allowedGenders = gendersResult.success ? gendersResult.data.genders : [];
            let allowedSpecies = speciesResult.success ? speciesResult.data.species : [];
            let allowedClasses = classesResult.success ? classesResult.data.classes : [];
            
            // Filter by universe allowed lists (empty array = allow all)
            if (universe.allowedGenders && universe.allowedGenders.length > 0) {
                allowedGenders = allowedGenders.filter(g => universe.allowedGenders.includes(g.id));
            }
            
            if (universe.allowedSpecies && universe.allowedSpecies.length > 0) {
                allowedSpecies = allowedSpecies.filter(s => universe.allowedSpecies.includes(s.id));
            }
            
            if (universe.allowedClasses && universe.allowedClasses.length > 0) {
                allowedClasses = allowedClasses.filter(c => universe.allowedClasses.includes(c.id));
            }
            
            return { 
                success: true, 
                data: { 
                    genders: allowedGenders,
                    species: allowedSpecies,
                    classes: allowedClasses
                } 
            };
        } catch (error) {
            console.error('getFilteredIdentityOptions error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Ensure Default Universe exists
     */
    async ensureDefaultUniverse() {
        try {
            const defaultDoc = await db.collection('universes').doc('default').get();
            
            if (!defaultDoc.exists) {
                // Create Default Universe
                const defaultUniverse = {
                    name: 'Default Universe',
                    description: 'The default universe for all characters',
                    theme: '',
                    roleplayType: '',
                    imageUrl: '',
                    groupSlurl: '',
                    welcomeSlurl: '',
                    landmarks: [],
                    contacts: [],
                    maturityRating: 'general',
                    
                    ownerAdminId: null,  // Only System Admin/Super User can edit
                    active: true,
                    visibility: 'public',
                    
                    acceptNewPlayers: 'open',
                    signupKeyHash: '',
                    
                    characterLimit: 0,  // Unlimited
                    manaEnabled: true,
                    
                    allowedGenders: [],  // Empty = allow all
                    allowedSpecies: [],  // Empty = allow all
                    allowedClasses: [],  // Empty = allow all
                    allowedCareers: [],  // Empty = allow all
                    
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    deleted: false
                };
                
                await db.collection('universes').doc('default').set(defaultUniverse);
                console.log('Default Universe created');
            }
            
            return { success: true };
        } catch (error) {
            console.error('ensureDefaultUniverse error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== INVENTORY API (READ-ONLY) =====================
    // Note: Inventory modifications are done via LSL → Firestore REST API
    // JS functions here are read-only for display in Setup HUD
    
    /**
     * Get full inventory as {itemName: quantity} map
     * Returns empty object if inventory doesn't exist
     */
    async getInventory() {
        if (!this.uuid) {
            console.error('[getInventory] No UUID - access denied');
            return { success: false, error: 'No UUID - access denied' };
        }
        
        try {
            console.log('[getInventory] Reading from users collection, UUID:', this.uuid);
            const userDoc = await db.collection('users').doc(this.uuid).get();
            
            if (!userDoc.exists) {
                console.log('[getInventory] User document does not exist');
                return { success: true, data: { inventory: {} } };
            }
            
            const userData = userDoc.data();
            console.log('[getInventory] User data keys:', Object.keys(userData || {}));
            console.log('[getInventory] User data:', userData);
            console.log('[getInventory] Inventory field:', userData?.inventory);
            console.log('[getInventory] Inventory field type:', typeof userData?.inventory);
            
            // Get inventory - Firebase JS SDK automatically converts mapValue to plain object
            let inventory = userData?.inventory || {};
            
            // Safety check: if inventory is null/undefined, use empty object
            if (!inventory || typeof inventory !== 'object') {
                console.warn('[getInventory] Inventory is not an object, using empty object');
                inventory = {};
            }
            
            // If inventory is an array (shouldn't happen), convert to object
            if (Array.isArray(inventory)) {
                console.warn('[getInventory] Inventory is an array, converting to object');
                inventory = {};
            }
            
            console.log('[getInventory] Final inventory:', inventory);
            console.log('[getInventory] Inventory keys:', Object.keys(inventory));
            console.log('[getInventory] Inventory entries:', Object.entries(inventory));
            console.log('[getInventory] Inventory banana value:', inventory.banana);
            
            return { success: true, data: { inventory } };
        } catch (error) {
            console.error('getInventory error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get quantity of a specific item
     * @param {string} name - Item name (will be normalized to lowercase)
     */
    async getItemQuantity(name) {
        if (!name || typeof name !== 'string') {
            return { success: false, error: 'Invalid item name' };
        }
        
        const normalizedName = name.toLowerCase().trim();
        const inventoryResult = await this.getInventory();
        
        if (!inventoryResult.success) {
            return inventoryResult;
        }
        
        const quantity = inventoryResult.data.inventory[normalizedName] || 0;
        return { success: true, data: { quantity } };
    },
    
    /**
     * Check if required items are available
     * @param {Array<{name: string, qty: number}>} items - Array of {name, qty} objects
     * @returns {Promise<{success: boolean, data?: {allAvailable: boolean, missing?: Array}, error?: string}>}
     */
    async checkItems(items) {
        if (!Array.isArray(items)) {
            return { success: false, error: 'Items must be an array' };
        }
        
        const inventoryResult = await this.getInventory();
        if (!inventoryResult.success) {
            return inventoryResult;
        }
        
        const inventory = inventoryResult.data.inventory;
        const missing = [];
        
        for (const item of items) {
            if (!item.name || typeof item.qty !== 'number') {
                return { success: false, error: 'Invalid item format - must have name (string) and qty (number)' };
            }
            
            const normalizedName = item.name.toLowerCase().trim();
            const available = inventory[normalizedName] || 0;
            
            if (available < item.qty) {
                missing.push({
                    name: normalizedName,
                    required: item.qty,
                    available: available
                });
            }
        }
        
        return {
            success: true,
            data: {
                allAvailable: missing.length === 0,
                missing: missing.length > 0 ? missing : undefined
            }
        };
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    API.init();
});

