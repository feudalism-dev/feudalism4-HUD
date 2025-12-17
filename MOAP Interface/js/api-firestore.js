// ============================================================================
// Feudalism 4 - Firestore API Module
// ============================================================================
// Direct Firestore access - no GAS middleware needed!
// ============================================================================

const API = {
    // Session data
    uuid: null,
    token: null,
    role: 'player',
    hudChannel: null,
    user: null,
    
    /**
     * Initialize API - sign in anonymously using SL UUID as identifier
     */
    async init() {
        const params = new URLSearchParams(window.location.search);
        this.uuid = params.get('uuid') || '';
        this.hudChannel = params.get('channel') || '';
        
        console.log('API initializing with UUID:', this.uuid);
        
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
            
            // Update last login
            await userRef.update({
                last_login: firebase.firestore.FieldValue.serverTimestamp(),
                firebase_uid: auth.currentUser?.uid || null
            });
        } else {
            // Create new user
            const newUser = {
                uuid: this.uuid,
                username: this.uuid, // Will be updated from SL
                display_name: 'New Player',
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
        
        console.log('User synced:', this.role);
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
                gender: charData.gender || 'unspecified',
                species_id: charData.species_id || 'human',
                class_id: charData.class_id || 'commoner',
                xp_total: 100,
                xp_available: 100,
                currency: 50,
                stats: charData.stats || this.getDefaultStats(),
                inventory: [],
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
        return {
            fighting: 1, agility: 1, awareness: 1, strength: 1, endurance: 1,
            will: 1, intellect: 1, charisma: 1, perception: 1, stealth: 1,
            crafting: 1, survival: 1, medicine: 1, arcana: 1, faith: 1,
            persuasion: 1, intimidation: 1, athletics: 1, acrobatics: 1, luck: 1
        };
    },
    
    // =========================== SEED DATA ==================================
    
    async seedDefaultSpecies() {
        console.log('Seeding default species...');
        const species = [
            { id: 'human', name: 'Human', description: 'Versatile and adaptable.', base_stats: this.createBaseStats(2), stat_caps: this.createStatCaps(9), abilities: [], allowed_classes: ['commoner', 'soldier', 'squire', 'merchant', 'scholar', 'priest'], enabled: true },
            { id: 'elf', name: 'Elf', description: 'Graceful and long-lived.', base_stats: this.createBaseStats(2, { agility: 3, awareness: 3, intellect: 3, strength: 1, endurance: 1 }), stat_caps: this.createStatCaps(9, { agility: 10, awareness: 10, arcana: 10, strength: 7, endurance: 7 }), abilities: ['Low-Light Vision'], allowed_classes: ['commoner', 'scout', 'mage', 'scholar'], enabled: true },
            { id: 'dwarf', name: 'Dwarf', description: 'Stout and resilient craftsmen.', base_stats: this.createBaseStats(2, { strength: 3, endurance: 3, crafting: 3, agility: 1 }), stat_caps: this.createStatCaps(9, { strength: 10, endurance: 10, crafting: 10, agility: 7, arcana: 6 }), abilities: ['Darkvision'], allowed_classes: ['commoner', 'soldier', 'smith', 'merchant'], enabled: true },
            { id: 'halfling', name: 'Halfling', description: 'Small but lucky.', base_stats: this.createBaseStats(2, { agility: 3, luck: 4, stealth: 3, strength: 1 }), stat_caps: this.createStatCaps(9, { luck: 12, stealth: 10, strength: 6 }), abilities: ['Lucky'], allowed_classes: ['commoner', 'scout', 'merchant', 'thief'], enabled: true },
        ];
        
        const batch = db.batch();
        species.forEach(sp => {
            const ref = db.collection('species').doc(sp.id);
            batch.set(ref, sp);
        });
        await batch.commit();
    },
    
    async seedDefaultClasses() {
        console.log('Seeding default classes...');
        const classes = [
            { id: 'commoner', name: 'Commoner', description: 'Starting career.', vocation_id: 'common_sense', stat_minimums: {}, stat_maximums: this.createStatCaps(5), prerequisites: {}, exit_careers: ['soldier', 'scout', 'merchant', 'smith', 'scholar', 'thief'], xp_cost: 0, enabled: true },
            { id: 'soldier', name: 'Soldier', description: 'Trained fighter.', vocation_id: 'martial_training', stat_minimums: { fighting: 2, strength: 2 }, stat_maximums: this.createStatCaps(7, { fighting: 8, strength: 8, endurance: 8 }), prerequisites: { required_classes: ['commoner'] }, exit_careers: ['squire', 'sergeant'], xp_cost: 100, enabled: true },
            { id: 'squire', name: 'Squire', description: 'Knight in training.', vocation_id: 'squires_duty', stat_minimums: { fighting: 3, agility: 2 }, stat_maximums: this.createStatCaps(7, { fighting: 8, agility: 7 }), prerequisites: { required_classes: ['soldier'] }, exit_careers: ['knight'], xp_cost: 200, enabled: true },
            { id: 'knight', name: 'Knight', description: 'Mounted warrior.', vocation_id: 'knights_prowess', stat_minimums: { fighting: 5, agility: 3, strength: 4 }, stat_maximums: this.createStatCaps(9, { fighting: 10, intimidation: 9 }), prerequisites: { required_classes: ['squire'] }, exit_careers: ['champion', 'lord'], xp_cost: 500, enabled: true },
            { id: 'scout', name: 'Scout', description: 'Wilderness expert.', vocation_id: 'wilderness_wisdom', stat_minimums: { perception: 2, survival: 2 }, stat_maximums: this.createStatCaps(7, { perception: 8, stealth: 8, survival: 8 }), prerequisites: { required_classes: ['commoner'] }, exit_careers: ['ranger', 'spy'], xp_cost: 100, enabled: true },
            { id: 'merchant', name: 'Merchant', description: 'Trader and negotiator.', vocation_id: 'traders_eye', stat_minimums: { charisma: 2, intellect: 2 }, stat_maximums: this.createStatCaps(7, { charisma: 8, persuasion: 8 }), prerequisites: { required_classes: ['commoner'] }, exit_careers: ['guild_master'], xp_cost: 100, enabled: true },
        ];
        
        const batch = db.batch();
        classes.forEach(cls => {
            const ref = db.collection('classes').doc(cls.id);
            batch.set(ref, cls);
        });
        await batch.commit();
    },
    
    async seedDefaultVocations() {
        console.log('Seeding default vocations...');
        const vocations = [
            { id: 'common_sense', name: 'Common Sense', primary_stat: 'awareness', secondary_stat: 'luck', applies_to: ['survival', 'perception'] },
            { id: 'martial_training', name: 'Martial Training', primary_stat: 'fighting', secondary_stat: 'strength', applies_to: ['fighting', 'athletics'] },
            { id: 'squires_duty', name: "Squire's Duty", primary_stat: 'fighting', secondary_stat: 'charisma', applies_to: ['fighting', 'persuasion'] },
            { id: 'knights_prowess', name: "Knight's Prowess", primary_stat: 'fighting', secondary_stat: 'awareness', applies_to: ['fighting', 'intimidation'] },
            { id: 'wilderness_wisdom', name: 'Wilderness Wisdom', primary_stat: 'survival', secondary_stat: 'perception', applies_to: ['survival', 'stealth', 'perception'] },
            { id: 'traders_eye', name: "Trader's Eye", primary_stat: 'charisma', secondary_stat: 'perception', applies_to: ['persuasion', 'perception'] },
        ];
        
        const batch = db.batch();
        vocations.forEach(voc => {
            const ref = db.collection('vocations').doc(voc.id);
            batch.set(ref, voc);
        });
        await batch.commit();
    },
    
    createBaseStats(defaultValue, overrides = {}) {
        const stats = {};
        const names = ['fighting', 'agility', 'awareness', 'strength', 'endurance', 'will', 'intellect', 'charisma', 'perception', 'stealth', 'crafting', 'survival', 'medicine', 'arcana', 'faith', 'persuasion', 'intimidation', 'athletics', 'acrobatics', 'luck'];
        names.forEach(s => stats[s] = overrides[s] !== undefined ? overrides[s] : defaultValue);
        return stats;
    },
    
    createStatCaps(defaultValue, overrides = {}) {
        return this.createBaseStats(defaultValue, overrides);
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

