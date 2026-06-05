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
    /** Firestore users/{uuid}.activeCharacter — last character chosen in Setup HUD */
    activeCharacterId: null,
    /** True when user owns or appears in universes/{id}/admins (even if role is still player). */
    hasDelegatedUniverseAccess: false,
    
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
    _userSessionKey() {
        return 'f4_user_' + (this.uuid || '');
    },

    _loadUserSession() {
        try {
            const raw = sessionStorage.getItem(this._userSessionKey());
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.data || (Date.now() - parsed.ts) > this._USER_SESSION_TTL_MS) {
                return null;
            }
            return parsed.data;
        } catch (e) {
            return null;
        }
    },

    _saveUserSession() {
        try {
            sessionStorage.setItem(this._userSessionKey(), JSON.stringify({
                ts: Date.now(),
                data: {
                    user: this.user,
                    role: this.role,
                    activeCharacter: this.activeCharacterId
                }
            }));
        } catch (e) { /* quota / private mode */ }
    },

    _maybeUpdateLastLoginThrottled(userRef) {
        const key = 'f4_last_login_write_' + this.uuid;
        let last = 0;
        try {
            last = parseInt(localStorage.getItem(key) || '0', 10);
        } catch (e) { /* ignore */ }
        if (Date.now() - last < this._LAST_LOGIN_WRITE_INTERVAL_MS) {
            return;
        }
        userRef.update({
            last_login: firebase.firestore.FieldValue.serverTimestamp(),
            firebase_uid: auth.currentUser?.uid || null,
            username: this.username || (this.user && this.user.username),
            display_name: this.displayName || (this.user && this.user.display_name)
        }).then(function () {
            try {
                localStorage.setItem(key, String(Date.now()));
            } catch (e) { /* ignore */ }
        }).catch(function (err) {
            console.warn('[API] throttled last_login update failed:', err);
        });
    },

    async syncUser() {
        if (!this.uuid) return;

        const cached = this._loadUserSession();
        if (cached && cached.user) {
            this.user = cached.user;
            this.role = cached.role || 'player';
            this.activeCharacterId = cached.activeCharacter || null;
            if (this.user.display_name) {
                this.displayName = this.user.display_name;
            }
            console.log('[API] User from session cache (0 reads):', this.role,
                this.activeCharacterId ? (' activeChar:' + this.activeCharacterId) : '');
            this._maybeUpdateLastLoginThrottled(db.collection('users').doc(this.uuid));
            return;
        }

        const userRef = db.collection('users').doc(this.uuid);
        const userDoc = await userRef.get();
        const isSuperAdmin = this.uuid === this.SUPER_ADMIN_UUID;

        if (userDoc.exists) {
            this.user = userDoc.data();

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
            this.activeCharacterId = this.user.activeCharacter || null;

            if (this.user.display_name) {
                this.displayName = this.user.display_name;
            }

            this._maybeUpdateLastLoginThrottled(userRef);
        } else {
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
            this.activeCharacterId = null;
            try {
                localStorage.setItem('f4_last_login_write_' + this.uuid, String(Date.now()));
            } catch (e) { /* ignore */ }
        }

        this._saveUserSession();
        console.log('User synced:', this.role, '- Display:', this.displayName,
            this.activeCharacterId ? (' activeChar:' + this.activeCharacterId) : '',
            isSuperAdmin ? '(Super Admin)' : '');
    },

    /**
     * Persist which character is active for this avatar (Setup HUD + meter).
     */
    async setActiveCharacter(characterId) {
        if (!this.uuid || !characterId) {
            return { success: false, error: 'Missing uuid or characterId' };
        }
        try {
            await db.collection('users').doc(this.uuid).update({
                activeCharacter: characterId,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.activeCharacterId = characterId;
            if (this.user) {
                this.user.activeCharacter = characterId;
            }
            this._saveUserSession();
            console.log('[API] activeCharacter saved:', characterId);
            return { success: true };
        } catch (error) {
            console.warn('[API] setActiveCharacter failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== TEMPLATES (Public Read) ====================

    /** When true, species/classes/genders/vocations load from bundled seed-data.js (0 Firestore reads). */
    _USE_STATIC_TEMPLATES: true,
    _forceFirestoreTemplates: false,

    _templateCache: {},
    _TEMPLATE_CACHE_TTL_MS: 30 * 60 * 1000,

    _USER_SESSION_TTL_MS: 30 * 60 * 1000,
    _LAST_LOGIN_WRITE_INTERVAL_MS: 60 * 60 * 1000,
    _LIST_CHARACTERS_TTL_MS: 5 * 60 * 1000,
    _listCharactersCache: null,
    _listCharactersCacheTs: 0,

    _getCachedTemplate(cacheKey) {
        const entry = this._templateCache[cacheKey];
        if (entry && (Date.now() - entry.ts) < this._TEMPLATE_CACHE_TTL_MS) {
            return entry.data;
        }
        return null;
    },

    _setCachedTemplate(cacheKey, data) {
        this._templateCache[cacheKey] = { ts: Date.now(), data: data };
    },

    _staticVocationList() {
        return [
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
            { id: 'general', name: 'Jack of All Trades', primary_stat: 'awareness', secondary_stat: 'will', applies_to: ['awareness', 'survival'] }
        ];
    },

    _loadTemplatesFromSeed(collectionName, mapDoc) {
        if (typeof F4_SEED_DATA === 'undefined') {
            return null;
        }
        let items = [];
        if (collectionName === 'species') {
            items = F4_SEED_DATA.getFullSpeciesData();
        } else if (collectionName === 'classes') {
            items = F4_SEED_DATA.getFullClassData();
        } else if (collectionName === 'genders') {
            items = F4_SEED_DATA.getGenderData();
        } else if (collectionName === 'vocations') {
            items = this._staticVocationList();
        } else {
            return null;
        }
        items = items.filter(function (row) {
            return row && row.enabled !== false;
        });
        if (mapDoc) {
            items = items.map(function (row) {
                return mapDoc({ id: row.id }, row);
            });
        } else {
            items = items.map(function (row) {
                return { id: row.id, ...row };
            });
        }
        return { success: true, data: items };
    },

    /** Static seed-data.js first; Firestore only when admin forces or seed missing. */
    async _loadTemplateCollection(collectionName, seedFn, mapDoc) {
        const cached = this._getCachedTemplate(collectionName);
        if (cached) {
            return cached;
        }

        if (this._USE_STATIC_TEMPLATES && !this._forceFirestoreTemplates) {
            const seeded = this._loadTemplatesFromSeed(collectionName, mapDoc);
            if (seeded && seeded.data && seeded.data.length > 0) {
                const result = { success: true, data: seeded.data };
                this._setCachedTemplate(collectionName, result);
                console.log('[API] ' + collectionName + ' from seed-data.js (0 Firestore reads)');
                return result;
            }
        }

        let snapshot = await db.collection(collectionName).get();
        if (snapshot.empty && seedFn) {
            console.log('[API] Seeding empty collection:', collectionName);
            await seedFn.call(this);
            await new Promise(function (resolve) { setTimeout(resolve, 500); });
            snapshot = await db.collection(collectionName).get();
        }

        const items = [];
        snapshot.forEach(function (doc) {
            const data = doc.data();
            if (data.enabled === false) {
                return;
            }
            items.push(mapDoc ? mapDoc(doc, data) : { id: doc.id, ...data });
        });

        const result = { success: true, data: items };
        this._setCachedTemplate(collectionName, result);
        return result;
    },

    /**
     * Get all species templates (single read + session cache)
     */
    async getSpecies() {
        try {
            const loaded = await this._loadTemplateCollection('species', this.seedDefaultSpecies, null);
            const species = loaded.data || [];
            console.log('[API] getSpecies:', species.length, 'reads: 1 collection get (cached 30m)');
            return { success: true, data: { species: species } };
        } catch (error) {
            console.error('getSpecies error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Standard class portrait path (files live under images/classes/Class_Overview_<id>.png)
     */
    normalizeClassImagePath(classId, image) {
        const id = (classId || '').trim();
        if (!id) {
            return image || '';
        }
        const standard = `classes/Class_Overview_${id}.png`;
        const raw = (image || '').trim();
        if (!raw || raw === `classes/${id}.png` || raw === `${id}.png` || raw.endsWith(`/${id}.png`)) {
            return standard;
        }
        if (raw.indexOf('Class_Overview_') !== -1) {
            return raw;
        }
        return standard;
    },

    /**
     * Get all class templates (single read + session cache)
     */
    async getClasses() {
        try {
            const self = this;
            const loaded = await this._loadTemplateCollection('classes', this.seedDefaultClasses, function (doc, data) {
                return {
                    id: doc.id,
                    ...data,
                    image: self.normalizeClassImagePath(doc.id, data.image)
                };
            });
            const classes = loaded.data || [];
            console.log('[API] getClasses:', classes.length, 'reads: 1 collection get (cached 30m)');
            return { success: true, data: { classes: classes } };
        } catch (error) {
            console.error('getClasses error:', error);
            return { success: false, error: error.message };
        }
    },

    normalizeUniverseClassOverrides(classOverrides) {
        const normalized = {};
        if (!classOverrides || typeof classOverrides !== 'object') {
            return normalized;
        }
        Object.keys(classOverrides).forEach((classId) => {
            const raw = classOverrides[classId];
            if (!raw || typeof raw !== 'object') {
                return;
            }
            const item = {};
            if (raw.enabled !== undefined) {
                item.enabled = !!raw.enabled;
            }
            if (raw.tier === 'beginner' || raw.tier === 'advanced') {
                item.tier = raw.tier;
            }
            if (Array.isArray(raw.prerequisites)) {
                item.prerequisites = raw.prerequisites
                    .map(p => String(p).trim())
                    .filter(p => p);
            }
            normalized[classId] = item;
        });
        return normalized;
    },

    mergeClassOverridesForUniverse(classTemplates, universeOverrides, defaultOverrides) {
        const defaults = this.normalizeUniverseClassOverrides(defaultOverrides);
        const overrides = this.normalizeUniverseClassOverrides(universeOverrides);
        return classTemplates.map((cls) => {
            const merged = { ...cls };
            const defaultOverride = defaults[cls.id] || {};
            const universeOverride = overrides[cls.id] || {};
            const effectiveOverride = { ...defaultOverride, ...universeOverride };

            const basePrereqs = Array.isArray(merged.prerequisites)
                ? merged.prerequisites
                : (merged.prerequisite ? [merged.prerequisite] : []);
            const prereqs = Array.isArray(effectiveOverride.prerequisites)
                ? effectiveOverride.prerequisites
                : basePrereqs;
            merged.prerequisites = prereqs;

            if (effectiveOverride.tier === 'beginner' || effectiveOverride.tier === 'advanced') {
                merged.tier = effectiveOverride.tier;
            } else {
                merged.tier = prereqs.length === 0 ? 'beginner' : 'advanced';
            }

            if (effectiveOverride.enabled !== undefined) {
                merged.enabled = !!effectiveOverride.enabled;
            } else if (merged.enabled === undefined) {
                merged.enabled = true;
            }

            return merged;
        });
    },

    async getUniverseClassConfiguration(universeId) {
        try {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            const universe = universeDoc.data();

            const classesResult = await this.getClasses();
            if (!classesResult.success) {
                return { success: false, error: classesResult.error || 'Failed to load classes' };
            }
            const classTemplates = classesResult.data.classes || [];

            let defaultOverrides = {};
            if (universeId !== 'default') {
                const defaultDoc = await db.collection('universes').doc('default').get();
                if (defaultDoc.exists) {
                    defaultOverrides = defaultDoc.data().classOverrides || {};
                }
            }

            const effectiveClasses = this.mergeClassOverridesForUniverse(
                classTemplates,
                universe.classOverrides || {},
                defaultOverrides
            );

            return {
                success: true,
                data: {
                    universe: { id: universeId, ...universe },
                    classes: effectiveClasses
                }
            };
        } catch (error) {
            console.error('getUniverseClassConfiguration error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get all vocation templates
     */
    async getVocations() {
        try {
            const loaded = await this._loadTemplateCollection('vocations', this.seedDefaultVocations, null);
            const vocations = loaded.data || [];
            return { success: true, data: { vocations: vocations } };
        } catch (error) {
            console.error('getVocations error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== CHARACTER CRUD =============================
    
    /**
     * List all characters for current user
     */
    async listCharacters(forceRefresh) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }

        if (!forceRefresh && this._listCharactersCache &&
            (Date.now() - this._listCharactersCacheTs) < this._LIST_CHARACTERS_TTL_MS) {
            console.log('[listCharacters] session cache:', this._listCharactersCache.length, '(0 reads)');
            return { success: true, data: { characters: this._listCharactersCache }, cached: true };
        }
        
        try {
            // SECURITY: Always filter by owner_uuid to ensure users can only access their own characters
            // Try with orderBy first, but fallback to simple query if index doesn't exist
            let snapshot;
            let usedOrderBy = false;
            
            try {
                snapshot = await db.collection('characters')
                    .where('owner_uuid', '==', this.uuid)
                    .orderBy('created_at', 'desc')
                    .get();
                usedOrderBy = true;
                console.log('[listCharacters] Query with orderBy succeeded');
            } catch (orderByError) {
                // If orderBy fails (likely missing index), try without it
                // Check error code or message for index-related errors
                const errorMessage = orderByError.message || String(orderByError);
                const isIndexError = orderByError.code === 'failed-precondition' || 
                                    errorMessage.includes('index') || 
                                    errorMessage.includes('Index') ||
                                    errorMessage.includes('requires an index');
                
                if (isIndexError) {
                    console.warn('[listCharacters] orderBy failed (missing index), trying without orderBy. Error:', errorMessage);
                    try {
                        snapshot = await db.collection('characters')
                            .where('owner_uuid', '==', this.uuid)
                            .get();
                        usedOrderBy = false;
                        console.log('[listCharacters] Fallback query without orderBy succeeded');
                    } catch (fallbackError) {
                        console.error('[listCharacters] Fallback query also failed:', fallbackError);
                        throw fallbackError;
                    }
                } else {
                    // Some other error, re-throw it
                    console.error('[listCharacters] orderBy failed with non-index error:', orderByError);
                    throw orderByError;
                }
            }
            
            const characters = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // SECURITY: Double-check ownership
                if (data.owner_uuid === this.uuid) {
                    characters.push({ id: doc.id, ...data });
                }
            });
            
            // Sort manually if we didn't use orderBy
            if (!usedOrderBy && characters.length > 1) {
                characters.sort((a, b) => {
                    // Handle Firestore Timestamp objects
                    let aTime = 0;
                    let bTime = 0;
                    
                    if (a.created_at) {
                        if (a.created_at.toMillis) {
                            aTime = a.created_at.toMillis();
                        } else if (a.created_at.seconds) {
                            aTime = a.created_at.seconds * 1000;
                        } else if (typeof a.created_at === 'number') {
                            aTime = a.created_at;
                        }
                    }
                    
                    if (b.created_at) {
                        if (b.created_at.toMillis) {
                            bTime = b.created_at.toMillis();
                        } else if (b.created_at.seconds) {
                            bTime = b.created_at.seconds * 1000;
                        } else if (typeof b.created_at === 'number') {
                            bTime = b.created_at;
                        }
                    }
                    
                    return bTime - aTime; // Descending order (newest first)
                });
            }
            
            this._listCharactersCache = characters;
            this._listCharactersCacheTs = Date.now();
            console.log(`[listCharacters] Found ${characters.length} character(s) for UUID: ${this.uuid}`);
            return { success: true, data: { characters } };
        } catch (error) {
            console.error('[listCharacters] Error:', error);
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
            // Multi-character: per-universe limits are enforced in saveCharacter via validateCharacterLimit.
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
                // Mana: use provided value (calculated in app.js based on has_mana and stats)
                // If has_mana is true, mana should be calculated from stats
                // If has_mana is false, mana should be { current: 0, base: 0, max: 0 }
                mana: charData.mana !== undefined ? charData.mana : (charData.has_mana ? { current: 50, base: 50, max: 50 } : { current: 0, base: 0, max: 0 }),
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
            this._listCharactersCache = null;
            this._listCharactersCacheTs = 0;

            const createdCharacter = { id: docRef.id, ...character };

            return {
                success: true,
                data: {
                    character: createdCharacter,
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
    async deleteCharacter(characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        if (!characterId) {
            return { success: false, error: 'No character ID provided' };
        }
        
        try {
            // Get character by ID
            const docRef = db.collection('characters').doc(characterId);
            const doc = await docRef.get();
            
            if (!doc.exists) {
                return { success: false, error: 'Character not found' };
            }
            
            // Verify ownership - SECURITY CHECK
            const character = doc.data();
            if (character.owner_uuid !== this.uuid) {
                return { success: false, error: 'Access denied - not your character' };
            }
            
            await docRef.delete();
            this._listCharactersCache = null;
            this._listCharactersCacheTs = 0;

            return {
                success: true,
                data: {
                    message: 'Character deleted successfully',
                    characterId: characterId
                }
            };
        } catch (error) {
            console.error('deleteCharacter error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update character by document ID (required for multi-character accounts).
     * @param {object} charData - Fields to update
     * @param {string} [characterId] - Firestore character doc id (falls back to charData.id)
     */
    async updateCharacter(charData, characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID' };
        }
        
        const targetId = characterId || charData.id;
        if (!targetId) {
            return { success: false, error: 'No character ID specified' };
        }
        
        try {
            const docRef = db.collection('characters').doc(targetId);
            let existing = null;

            if (this._listCharactersCache) {
                for (let i = 0; i < this._listCharactersCache.length; i++) {
                    if (this._listCharactersCache[i].id === targetId) {
                        existing = this._listCharactersCache[i];
                        break;
                    }
                }
            }

            if (!existing) {
                const doc = await docRef.get();
                if (!doc.exists) {
                    return { success: false, error: 'Character not found' };
                }
                existing = { id: doc.id, ...doc.data() };
            }

            if (existing.owner_uuid !== this.uuid) {
                return { success: false, error: 'Access denied - not your character' };
            }

            const updateData = {
                ...charData,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };

            delete updateData.owner_uuid;
            delete updateData.id;

            await docRef.update(updateData);

            const updatedCharacter = { ...existing, ...charData, id: targetId };
            if (this._listCharactersCache) {
                this._listCharactersCache = this._listCharactersCache.map(function (c) {
                    return c.id === targetId ? updatedCharacter : c;
                });
            }

            return {
                success: true,
                data: {
                    character: updatedCharacter,
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
    async changeClass(newClassId, classData, isFreeAdvance = false, characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID' };
        }
        
        try {
            const charResult = characterId
                ? await this.getCharacterById(characterId)
                : await this.getCharacter();
            if (!charResult.success) {
                return { success: false, error: 'No character found' };
            }
            
            const character = charResult.data.character;
            const universeId = character.universe_id || 'default';
            const universeDoc = await db.collection('universes').doc(universeId).get();
            const universe = universeDoc.exists ? universeDoc.data() : null;
            const classesResult = await this.getClasses();
            const allClasses = classesResult.success ? (classesResult.data.classes || []) : [];
            const canChange = this.canChangeToClass(character, classData, allClasses, { universe });
            if (!canChange.canChange) {
                return { success: false, error: canChange.reason || 'Cannot change to this class' };
            }

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
            
            const result = await this.updateCharacter(updateData, character.id);
            
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
     * Whether this universe enforces class stat_minimums (default: true).
     * @param {object|null} universe - Universe document data
     */
    enforceClassStatMinimums(universe) {
        if (!universe) {
            return true;
        }
        return universe.enforceClassStatMinimums !== false;
    },

    /**
     * Check if character can change to a class
     * @param {object} character - Character data
     * @param {object} classData - Class template data
     * @param {Array} allClasses - All class templates
     * @param {object} options - { enforceStatMinimums?: boolean, universe?: object }
     */
    canChangeToClass(character, classData, allClasses = [], options = {}) {
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
        
        const enforceStatMinimums = options.enforceStatMinimums !== undefined
            ? options.enforceStatMinimums
            : this.enforceClassStatMinimums(options.universe);

        // Check minimum stat requirements
        if (enforceStatMinimums && classData.stat_minimums) {
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
            const loaded = await this._loadTemplateCollection('genders', this.seedDefaultGenders, null);
            const genders = loaded.data || [];
            console.log('[API] getGenders:', genders.length, 'reads: 1 collection get (cached 30m)');
            return { success: true, data: { genders: genders } };
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
     * List users filtered by global role (e.g. universe_admin).
     * Full list: sys_admin / sim_admin. Universe admins may only query universe_admin
     * (so they cannot enumerate all players).
     */
    async listUsersByGlobalRole(role) {
        try {
            const validRoles = ['player', 'sim_admin', 'sys_admin', 'universe_admin'];
            if (!validRoles.includes(role)) {
                return { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
            }
            
            if (this.role === 'universe_admin') {
                if (role !== 'universe_admin') {
                    return { success: false, error: 'Unauthorized: You can only browse Universe Admin accounts' };
                }
            } else if (this.role !== 'sim_admin' && this.role !== 'sys_admin') {
                return { success: false, error: 'Unauthorized: Admin access required' };
            }
            
            const snapshot = await db.collection('users').where('role', '==', role).get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({ ...doc.data(), uuid: doc.id });
            });
            
            users.sort((a, b) => {
                const na = (a.display_name || a.username || a.uuid || '').toLowerCase();
                const nb = (b.display_name || b.username || b.uuid || '').toLowerCase();
                return na.localeCompare(nb);
            });
            
            return { success: true, data: { users } };
        } catch (error) {
            console.error('listUsersByGlobalRole error:', error);
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
     * Global species/classes/genders CRUD — not universe-scoped allowlists.
     * Universe admins may only change allowedClasses/Species/Genders on a universe document.
     */
    canManageGlobalTemplates() {
        if (this.uuid === this.SUPER_ADMIN_UUID) {
            return true;
        }
        return this.role === 'sys_admin' || this.role === 'sim_admin';
    },
    
    /**
     * Save a template (create or update)
     */
    async saveTemplate(type, id, templateData, isNew = false) {
        try {
            this._forceFirestoreTemplates = true;
            delete this._templateCache[type];

            if (!this.canManageGlobalTemplates()) {
                return { success: false, error: 'Unauthorized: Only system administrators can add or edit global templates' };
            }
            
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
            
                if (type === 'classes') {
                    sanitizedData.image = this.normalizeClassImagePath(id, sanitizedData.image);
                    if (sanitizedData.enabled === undefined) {
                        sanitizedData.enabled = true;
                    }
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
                
                if (type === 'classes') {
                    finalData.image = this.normalizeClassImagePath(id, finalData.image || sanitizedData.image);
                    if (finalData.enabled === undefined && sanitizedData.enabled !== undefined) {
                        finalData.enabled = !!sanitizedData.enabled;
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
            if (!this.canManageGlobalTemplates()) {
                return { success: false, error: 'Unauthorized: Only system administrators can delete global templates' };
            }
            
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
     * Scan Firestore for universes this UUID can manage (owner or admins subcollection).
     * Sets hasDelegatedUniverseAccess for players assigned on a universe without global role.
     */
    async refreshUniverseManagementAccess() {
        this.hasDelegatedUniverseAccess = false;
        if (!this.uuid) {
            return false;
        }
        if (this.uuid === this.SUPER_ADMIN_UUID || this.role === 'sys_admin' || this.role === 'sim_admin') {
            this.hasDelegatedUniverseAccess = true;
            return true;
        }
        if (this.role === 'universe_admin') {
            return true;
        }
        try {
            const ownedSnapshot = await db.collection('universes')
                .where('ownerAdminId', '==', this.uuid)
                .where('deleted', '==', false)
                .limit(1)
                .get();
            if (!ownedSnapshot.empty) {
                this.hasDelegatedUniverseAccess = true;
                return true;
            }
            const allSnapshot = await db.collection('universes')
                .where('deleted', '==', false)
                .get();
            for (const doc of allSnapshot.docs) {
                const adminDoc = await db.collection('universes').doc(doc.id)
                    .collection('admins').doc(this.uuid).get();
                if (adminDoc.exists) {
                    this.hasDelegatedUniverseAccess = true;
                    return true;
                }
            }
        } catch (error) {
            console.error('refreshUniverseManagementAccess error:', error);
        }
        return false;
    },

    /**
     * May open Universe Management (global universe_admin, sys roles, or per-universe admin).
     */
    canAccessUniverseManagement() {
        return this.canCreateUniverse() || this.hasDelegatedUniverseAccess;
    },
    
    /**
     * Check if user can create universes
     */
    canCreateUniverse() {
        return this.role === 'universe_admin' || this.role === 'sys_admin' || this.uuid === this.SUPER_ADMIN_UUID;
    },
    
    /**
     * Check if user can edit a specific universe (owner, delegated admins subcollection, or sys roles)
     * @param {string} universeId - Universe ID to check
     * @param {object} universe - Universe document data (optional, will fetch if not provided)
     */
    async canEditUniverse(universeId, universe = null) {
        // Super User and System Admin can edit any universe
        if (this.uuid === this.SUPER_ADMIN_UUID || this.role === 'sys_admin') {
            return true;
        }

        if (!universe) {
            const universeDoc = await db.collection('universes').doc(universeId).get();
            if (!universeDoc.exists) {
                return false;
            }
            universe = universeDoc.data();
        }

        if (universe.ownerAdminId === this.uuid) {
            return true;
        }

        const adminDoc = await db.collection('universes').doc(universeId)
            .collection('admins').doc(this.uuid).get();
        if (adminDoc.exists) {
            return true;
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
        
        return await this.canEditUniverse(universeId);
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
                active: universeData.active !== undefined ? universeData.active : true,
                visibility: universeData.visibility || 'public',
                
                acceptNewPlayers: universeData.acceptNewPlayers || 'open',
                signupKeyHash: universeData.signupKeyHash || '',
                
                characterLimit: universeData.characterLimit !== undefined ? universeData.characterLimit : 0,
                manaEnabled: universeData.manaEnabled !== undefined ? universeData.manaEnabled : true,
                
                allowedGenders: universeData.allowedGenders || [],
                allowedSpecies: universeData.allowedSpecies || [],
                allowedClasses: universeData.allowedClasses || [],
                classOverrides: this.normalizeUniverseClassOverrides(universeData.classOverrides || {}),
                enforceClassStatMinimums: universeData.enforceClassStatMinimums !== false,
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
            if (updateData.classOverrides !== undefined) {
                updateData.classOverrides = this.normalizeUniverseClassOverrides(updateData.classOverrides);
            }
            
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
            } else if (this.role === 'universe_admin' || this.hasDelegatedUniverseAccess) {
                const ownedSnapshot = await db.collection('universes')
                    .where('ownerAdminId', '==', this.uuid)
                    .where('deleted', '==', false).get();
                ownedSnapshot.forEach(doc => {
                    universes.push({ id: doc.id, ...doc.data() });
                });

                const allSnapshot = await db.collection('universes')
                    .where('deleted', '==', false).get();

                for (const doc of allSnapshot.docs) {
                    if (universes.find(u => u.id === doc.id)) {
                        continue;
                    }
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
            // Default + any non-deleted universe that is not explicitly inactive and accepts new players
            const universes = [];
            
            const defaultDoc = await db.collection('universes').doc('default').get();
            if (defaultDoc.exists) {
                const defaultData = defaultDoc.data();
                if (!defaultData.deleted) {
                    universes.push({ id: 'default', ...defaultData });
                }
            }
            
            const snapshot = await db.collection('universes')
                .where('deleted', '==', false)
                .get();
            
            snapshot.forEach(doc => {
                if (doc.id === 'default') {
                    return;
                }
                const data = doc.data();
                if (data.active === false) {
                    return;
                }
                if (data.acceptNewPlayers === 'closed') {
                    return;
                }
                universes.push({ id: doc.id, ...data });
            });
            
            universes.sort((a, b) => {
                if (a.id === 'default') return -1;
                if (b.id === 'default') return 1;
                const na = (a.name || a.id || '').toLowerCase();
                const nb = (b.name || b.id || '').toLowerCase();
                return na.localeCompare(nb);
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
            
            if (universe.allowedGenders && universe.allowedGenders.length > 0) {
                if (!universe.allowedGenders.includes(genderId)) {
                    errors.push(`Gender "${genderId}" is not allowed in this universe`);
                }
            }
            
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
            const classConfigResult = await this.getUniverseClassConfiguration(universeId);
            if (classConfigResult.success) {
                const effectiveClass = (classConfigResult.data.classes || []).find(c => c.id === classId);
                if (!effectiveClass || effectiveClass.enabled === false) {
                    errors.push(`Class "${classId}" is disabled in this universe`);
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
            let defaultClassOverrides = {};
            if (universeId !== 'default') {
                const defaultUniverseDoc = await db.collection('universes').doc('default').get();
                if (defaultUniverseDoc.exists) {
                    defaultClassOverrides = defaultUniverseDoc.data().classOverrides || {};
                }
            }
            allowedClasses = this.mergeClassOverridesForUniverse(
                allowedClasses,
                universe.classOverrides || {},
                defaultClassOverrides
            );
            
            // Filter by universe allowed lists (empty array = allow all)
            if (universe.allowedGenders && universe.allowedGenders.length > 0) {
                allowedGenders = allowedGenders.filter(g => universe.allowedGenders.includes(g.id));
            }
            
            if (universe.allowedSpecies && universe.allowedSpecies.length > 0) {
                allowedSpecies = allowedSpecies.filter(s => universe.allowedSpecies.includes(s.id));
            }
            
            const allowlistIds = (universe.allowedClasses && universe.allowedClasses.length > 0)
                ? new Set(universe.allowedClasses.map((id) => String(id)))
                : null;
            if (allowlistIds) {
                const overrides = universe.classOverrides || {};
                Object.keys(overrides).forEach((classId) => {
                    if (overrides[classId] && overrides[classId].enabled === true) {
                        allowlistIds.add(classId);
                    }
                });
                allowedClasses = allowedClasses.filter((c) => allowlistIds.has(c.id));
            }
            // Allowlist is authoritative: a class on allowedClasses still shows even if
            // classOverrides.enabled was saved false when the class was added later.
            allowedClasses = allowedClasses.filter((c) => {
                if (allowlistIds && allowlistIds.has(c.id)) {
                    return true;
                }
                return c.enabled !== false;
            });
            
            return { 
                success: true, 
                data: { 
                    genders: allowedGenders,
                    species: allowedSpecies,
                    classes: allowedClasses,
                    enforceClassStatMinimums: this.enforceClassStatMinimums(universe)
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
                    classOverrides: {},
                    enforceClassStatMinimums: true,
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
    // v2: Inventory is now stored in subcollection: characters/{characterId}/inventory/{itemId}
    
    /**
     * Get inventory page from subcollection (v2: paginated)
     * @param {string} characterId - The character document ID
     * @param {string} cursor - Last itemId from previous page (empty string for first page)
     * @param {number} pageSize - Number of items per page (default: 50, max: 100)
     * @returns {Promise<{success: boolean, data?: {items: Array, cursor: string, hasMore: boolean}, error?: string}>}
     */
    /**
     * Get inventory from character subcollection (Inventory v2)
     * Returns array of { id, qty } objects
     * @param {string} characterId - The character document ID
     */
    /**
     * Paginated inventory (Inventory v2) — one Firestore page per call, not full subcollection.
     * @param {string} characterId
     * @param {number|string} pageOrCursor - page 1 for first load, or last item doc id for next page
     * @param {number} pageSize
     * @returns {Promise<{ items, page, totalPages, hasMore, cursor }>}
     */
    async getInventoryPage(characterId, pageOrCursor = 1, pageSize = 50) {
        if (!characterId) {
            return { items: [], page: 1, totalPages: 0, hasMore: false, cursor: null };
        }

        const col = db.collection('characters').doc(characterId).collection('inventory');
        let query = col.orderBy(firebase.firestore.FieldPath.documentId()).limit(pageSize);

        const useCursor = typeof pageOrCursor === 'string' && pageOrCursor.length > 0 && pageOrCursor !== '1';
        if (useCursor) {
            const cursorRef = col.doc(pageOrCursor);
            const cursorSnap = await cursorRef.get();
            if (cursorSnap.exists) {
                query = col.orderBy(firebase.firestore.FieldPath.documentId()).startAfter(cursorSnap).limit(pageSize);
            }
        }

        const snapshot = await query.get();
        const items = [];
        let lastId = null;
        snapshot.forEach(function (doc) {
            const data = doc.data();
            items.push({
                id: doc.id,
                qty: data.qty != null ? data.qty : 0
            });
            lastId = doc.id;
        });

        const hasMore = snapshot.size >= pageSize;
        const pageNum = useCursor ? 0 : (typeof pageOrCursor === 'number' ? pageOrCursor : 1);
        console.log('[getInventoryPage] character:', characterId, 'items:', items.length, 'hasMore:', hasMore, 'reads:', snapshot.size);

        return {
            items: items,
            page: pageNum,
            totalPages: hasMore ? 0 : 1,
            hasMore: hasMore,
            cursor: lastId
        };
    },    
    /**
     * Get quantity of a specific item (v2: queries subcollection document directly)
     * @param {string} characterId - The character document ID
     * @param {string} name - Item name (will be normalized to lowercase)
     */
    async getItemQuantity(characterId, name) {
        if (!this.uuid) {
            console.error('[getItemQuantity] No UUID - access denied');
            return { success: false, error: 'No UUID - access denied' };
        }
        
        if (!characterId) {
            console.error('[getItemQuantity] No characterId provided');
            return { success: false, error: 'No characterId provided' };
        }
        
        if (!name || typeof name !== 'string') {
            return { success: false, error: 'Invalid item name' };
        }
        
        const normalizedName = name.toLowerCase().trim();
        
        try {
            // Query specific document: characters/{characterId}/inventory/{itemName}
            const doc = await db.collection('characters').doc(characterId)
                .collection('inventory').doc(normalizedName).get();
            
            if (!doc.exists) {
                return { success: true, data: { quantity: 0 } };
            }
            
            const data = doc.data();
            const quantity = data.qty || 0;
            
            return { success: true, data: { quantity } };
        } catch (error) {
            console.error('[getItemQuantity] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Check if required items are available (v2: uses batch queries on subcollection)
     * @param {string} characterId - The character document ID
     * @param {Array<{name: string, qty: number}>} items - Array of {name, qty} objects
     * @returns {Promise<{success: boolean, data?: {allAvailable: boolean, missing?: Array}, error?: string}>}
     */
    async checkItems(characterId, items) {
        if (!this.uuid) {
            console.error('[checkItems] No UUID - access denied');
            return { success: false, error: 'No UUID - access denied' };
        }
        
        if (!characterId) {
            console.error('[checkItems] No characterId provided');
            return { success: false, error: 'No characterId provided' };
        }
        
        if (!Array.isArray(items)) {
            return { success: false, error: 'Items must be an array' };
        }
        
        try {
            // Build batch of document reads
            const inventoryRef = db.collection('characters').doc(characterId).collection('inventory');
            const reads = items.map(item => {
                if (!item.name || typeof item.qty !== 'number') {
                    return null;
                }
                const normalizedName = item.name.toLowerCase().trim();
                return inventoryRef.doc(normalizedName).get();
            }).filter(read => read !== null);
            
            // Execute all reads in parallel
            const docs = await Promise.all(reads);
            
            const missing = [];
            items.forEach((item, index) => {
                if (!item.name || typeof item.qty !== 'number') {
                    return;
                }
                
                const normalizedName = item.name.toLowerCase().trim();
                const doc = docs[index];
                
                let available = 0;
                if (doc && doc.exists) {
                    const data = doc.data();
                    available = data.qty || 0;
                }
                
                if (available < item.qty) {
                    missing.push({
                        name: normalizedName,
                        required: item.qty,
                        available: available
                    });
                }
            });
            
            return {
                success: true,
                data: {
                    allAvailable: missing.length === 0,
                    missing: missing.length > 0 ? missing : undefined
                }
            };
        } catch (error) {
            console.error('[checkItems] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== CONSUMABLES API ===========================

  /**
   * Normalize consumable document (legacy effect_type/value → category + per-resource amounts).
   */
  normalizeConsumableData(id, data) {
    const raw = { id, ...data };
    const legacyType = (raw.effect_type || '').toLowerCase();
    let category = (raw.effect_category || '').toLowerCase();
    if (!['healing', 'poison', 'alcohol', 'intoxicant'].includes(category)) {
      const map = { heal: 'healing', healing: 'healing', poison: 'poison', alcohol: 'alcohol', intoxicant: 'intoxicant' };
      category = map[legacyType] || 'healing';
    }
    let effect_health = raw.effect_health;
    let effect_stamina = raw.effect_stamina;
    let effect_mana = raw.effect_mana;
    if (effect_health === undefined && effect_stamina === undefined && effect_mana === undefined) {
      const v = raw.effect_value || 0;
      if (legacyType === 'heal') effect_health = v;
      else if (legacyType === 'stamina') effect_stamina = v;
      else if (legacyType === 'mana') effect_mana = v;
    }
    return {
      ...raw,
      effect_category: category,
      effect_health: effect_health ?? 0,
      effect_stamina: effect_stamina ?? 0,
      effect_mana: effect_mana ?? 0,
      delay_seconds: raw.delay_seconds ?? 0,
      duration_seconds: raw.duration_seconds ?? 0,
      stackable: !!raw.stackable,
      max_stack: raw.stackable ? (raw.max_stack || 1) : 1
    };
  },

  formatConsumableEffectsSummary(c) {
    const parts = [];
    if (c.effect_health) parts.push(`HP ${c.effect_health > 0 ? '+' : ''}${c.effect_health}`);
    if (c.effect_stamina) parts.push(`STA ${c.effect_stamina > 0 ? '+' : ''}${c.effect_stamina}`);
    if (c.effect_mana) parts.push(`MP ${c.effect_mana > 0 ? '+' : ''}${c.effect_mana}`);
    const amounts = parts.length ? parts.join(', ') : 'none';
    const delay = c.delay_seconds ? `${c.delay_seconds}s delay` : 'instant';
    const dur = c.duration_seconds ? `${c.duration_seconds}s` : 'instant';
    return `${c.effect_category || 'healing'} — ${amounts} (${delay}, lasts ${dur})`;
  },
    
    /**
     * Get all consumables from master registry
     */
    async getConsumables() {
        try {
            // Path: feud4/consumables/master (feud4 is doc, consumables is subcollection, master is doc with consumables as subcollection)
            // Actually: feud4/consumables/master/{slug} - feud4 is collection, consumables is doc, master is subcollection
            const snapshot = await db.collection('feud4').doc('consumables')
                .collection('master').get();
            
            const consumables = [];
            snapshot.forEach(doc => {
                consumables.push(this.normalizeConsumableData(doc.id, doc.data()));
            });
            
            return { success: true, data: { consumables } };
        } catch (error) {
            console.error('[getConsumables] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create a new consumable
     */
    async createConsumable(consumableData) {
        try {
            const slug = consumableData.slug || consumableData.name.toLowerCase().replace(/\s+/g, '_');
            
            const consumable = {
                name: consumableData.name,
                description: consumableData.description || '',
                icon: consumableData.icon || '',
                effect_category: consumableData.effect_category || 'healing',
                effect_health: consumableData.effect_health ?? 0,
                effect_stamina: consumableData.effect_stamina ?? 0,
                effect_mana: consumableData.effect_mana ?? 0,
                delay_seconds: consumableData.delay_seconds ?? 0,
                duration_seconds: consumableData.duration_seconds ?? 0,
                stackable: consumableData.stackable || false,
                max_stack: consumableData.stackable ? (consumableData.max_stack || 1) : 1,
                rp_only: consumableData.rp_only || false,
                disabled: consumableData.disabled || false,
                effect_type: consumableData.effect_type || consumableData.effect_category || 'healing',
                effect_value: consumableData.effect_value ?? (
                    consumableData.effect_health || consumableData.effect_stamina || consumableData.effect_mana || 0
                )
            };
            
            await db.collection('feud4').doc('consumables')
                .collection('master').doc(slug).set(consumable);
            
            return { success: true, data: { id: slug, ...consumable } };
        } catch (error) {
            console.error('[createConsumable] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update an existing consumable
     */
    async updateConsumable(slug, consumableData) {
        try {
            const updateData = {};
            
            if (consumableData.name !== undefined) updateData.name = consumableData.name;
            if (consumableData.description !== undefined) updateData.description = consumableData.description;
            if (consumableData.icon !== undefined) updateData.icon = consumableData.icon;
            if (consumableData.duration_seconds !== undefined) updateData.duration_seconds = consumableData.duration_seconds;
            if (consumableData.delay_seconds !== undefined) updateData.delay_seconds = consumableData.delay_seconds;
            if (consumableData.effect_category !== undefined) updateData.effect_category = consumableData.effect_category;
            if (consumableData.effect_health !== undefined) updateData.effect_health = consumableData.effect_health;
            if (consumableData.effect_stamina !== undefined) updateData.effect_stamina = consumableData.effect_stamina;
            if (consumableData.effect_mana !== undefined) updateData.effect_mana = consumableData.effect_mana;
            if (consumableData.effect_type !== undefined) updateData.effect_type = consumableData.effect_type;
            if (consumableData.effect_value !== undefined) updateData.effect_value = consumableData.effect_value;
            if (consumableData.stackable !== undefined) {
                updateData.stackable = consumableData.stackable;
                // If stackable is false, force max_stack to 1
                if (!consumableData.stackable) {
                    updateData.max_stack = 1;
                } else if (consumableData.max_stack !== undefined) {
                    updateData.max_stack = consumableData.max_stack;
                }
            } else if (consumableData.max_stack !== undefined) {
                updateData.max_stack = consumableData.max_stack;
            }
            if (consumableData.rp_only !== undefined) updateData.rp_only = consumableData.rp_only;
            if (consumableData.disabled !== undefined) updateData.disabled = consumableData.disabled;
            
            await db.collection('feud4').doc('consumables')
                .collection('master').doc(slug).update(updateData);
            
            return { success: true };
        } catch (error) {
            console.error('[updateConsumable] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete a consumable
     */
    async deleteConsumable(slug) {
        try {
            await db.collection('feud4').doc('consumables')
                .collection('master').doc(slug).delete();
            
            return { success: true };
        } catch (error) {
            console.error('[deleteConsumable] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Request to consume an item (writes to consume_requests)
     * Path: feud4/users/<uid>/consume_requests/<auto-id>
     */
    async requestConsumeItem(uid, itemId) {
        try {
            // Path: feud4/users/<uid>/consume_requests/<auto-id>
            // Structure: feud4 (collection) -> users (doc) -> <uid> (subcollection) -> consume_requests (doc) -> requests (subcollection)
            // Actually: feud4/users/<uid>/consume_requests - feud4 is collection, users is doc, <uid> is subcollection, consume_requests is doc, requests is subcollection
            // Simplified: feud4/users/<uid>/consume_requests where feud4 is collection, users is doc, <uid> is subcollection
            await db.collection('feud4').doc('users').collection(uid)
                .doc('consume_requests').collection('requests').add({
                    item_id: itemId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            return { success: true };
        } catch (error) {
            console.error('[requestConsumeItem] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get active buffs for a character
     * Path: characters/<characterId>/active_buffs
     */
    async getActiveBuffs(uid) {
        try {
            // Path: feud4/users/<uid>/active_buffs/<slug>
            const snapshot = await db.collection('feud4').doc('users').collection(uid)
                .doc('active_buffs').collection('buffs').get();
            
            const buffs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const expiresAt = data.expires_at?.toDate();
                const now = new Date();
                
                // Only include non-expired buffs
                if (expiresAt && expiresAt > now) {
                    buffs.push(this.normalizeConsumableData(doc.id, {
                        name: data.name || doc.id,
                        icon: data.icon || '',
                        effect_category: data.effect_category,
                        effect_type: data.effect_type,
                        effect_value: data.effect_value,
                        effect_health: data.effect_health,
                        effect_stamina: data.effect_stamina,
                        effect_mana: data.effect_mana,
                        delay_seconds: data.delay_seconds,
                        duration_seconds: data.duration_seconds,
                        expires_at: expiresAt
                    }));
                }
            });
            
            return { success: true, data: { buffs } };
        } catch (error) {
            console.error('[getActiveBuffs] Error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Set up real-time listener for active buffs
     * Returns unsubscribe function
     */
    subscribeToActiveBuffs(uid, callback) {
        if (!uid) {
            return () => {};
        }
        
        // Path: feud4/users/<uid>/active_buffs/<slug>
        return db.collection('feud4').doc('users').collection(uid)
            .doc('active_buffs').collection('buffs')
            .onSnapshot((snapshot) => {
                const buffs = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const expiresAt = data.expires_at?.toDate();
                    const now = new Date();
                    
                    // Only include non-expired buffs
                    if (expiresAt && expiresAt > now) {
                        buffs.push(this.normalizeConsumableData(doc.id, {
                            name: data.name || doc.id,
                            icon: data.icon || '',
                            effect_category: data.effect_category,
                            effect_type: data.effect_type,
                            effect_value: data.effect_value,
                            effect_health: data.effect_health,
                            effect_stamina: data.effect_stamina,
                            effect_mana: data.effect_mana,
                            delay_seconds: data.delay_seconds,
                            duration_seconds: data.duration_seconds,
                            expires_at: expiresAt
                        }));
                    }
                });
                
                callback({ success: true, data: { buffs } });
            }, (error) => {
                console.error('[subscribeToActiveBuffs] Error:', error);
                callback({ success: false, error: error.message });
            });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    API.init();
});

