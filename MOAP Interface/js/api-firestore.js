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
        
        const userRef = db.collection('users').doc(this.uuid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            this.user = userDoc.data();
            this.role = this.user.role || 'player';
            
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
                role: 'player',
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                last_login: firebase.firestore.FieldValue.serverTimestamp(),
                firebase_uid: auth.currentUser?.uid || null,
                banned: false
            };
            
            await userRef.set(newUser);
            this.user = newUser;
            this.role = 'player';
        }
        
        console.log('User synced:', this.role, '- Display:', this.displayName);
    },
    
    // =========================== TEMPLATES (Public Read) ====================
    
    /**
     * Get all species templates
     */
    async getSpecies() {
        try {
            const snapshot = await db.collection('species').where('enabled', '==', true).get();
            
            if (snapshot.empty) {
                // Seed default species if none exist
                await this.seedDefaultSpecies();
                return this.getSpecies();
            }
            
            const species = [];
            snapshot.forEach(doc => {
                species.push({ id: doc.id, ...doc.data() });
            });
            
            return { success: true, data: { species } };
        } catch (error) {
            console.error('getSpecies error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get all class templates
     */
    async getClasses() {
        try {
            const snapshot = await db.collection('classes').where('enabled', '==', true).get();
            
            if (snapshot.empty) {
                await this.seedDefaultClasses();
                return this.getClasses();
            }
            
            const classes = [];
            snapshot.forEach(doc => {
                classes.push({ id: doc.id, ...doc.data() });
            });
            
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
     * Get character for current user
     */
    async getCharacter() {
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
            return { 
                success: true, 
                data: { 
                    character: { id: doc.id, ...doc.data() } 
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
        if (!this.uuid) {
            return { success: false, error: 'No UUID' };
        }
        
        try {
            // Check if character already exists
            const existing = await this.getCharacter();
            if (existing.success) {
                return { success: false, error: 'Character already exists' };
            }
            
            const character = {
                owner_uuid: this.uuid,
                name: charData.name || 'Unnamed',
                title: charData.title || '',
                gender: charData.gender || 'other',
                species_id: charData.species_id || 'human',
                class_id: charData.class_id || null,
                
                // Resource pools
                health: charData.health || 100,
                health_max: charData.health_max || 100,
                stamina: charData.stamina || 100,
                stamina_max: charData.stamina_max || 100,
                mana: charData.mana || 50,
                mana_max: charData.mana_max || 50,
                
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
            const xpCost = isFreeAdvance ? 0 : (classData.xp_cost || 0);
            
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
                result.data.message = isFreeAdvance 
                    ? `Advanced to ${classData.name}!`
                    : `Changed class to ${classData.name} (${xpCost} XP)`;
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
            xpCost: classData.xp_cost || 0,
            reason: ''
        };
        
        // Check prerequisite
        if (classData.prerequisite) {
            // Check if they've had this prerequisite class in their history (and not abandoned)
            const hasPrereq = (character.career_history || []).some(
                h => h.class_id === classData.prerequisite && !h.abandoned
            ) || character.class_id === classData.prerequisite;
            
            if (!hasPrereq) {
                result.reason = `Requires ${classData.prerequisite} class`;
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
            const snapshot = await db.collection('genders').where('enabled', '==', true).get();
            
            if (snapshot.empty) {
                await this.seedDefaultGenders();
                return this.getGenders();
            }
            
            const genders = [];
            snapshot.forEach(doc => {
                genders.push({ id: doc.id, ...doc.data() });
            });
            
            return { success: true, data: { genders } };
        } catch (error) {
            console.error('getGenders error:', error);
            return { success: false, error: error.message };
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
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    API.init();
});

