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
     * Bridge mode: Experience KVP f4active_{owner}. Legacy: Firestore users.activeCharacter.
     */
    async setActiveCharacter(characterId) {
        if (!this.uuid || !characterId) {
            return { success: false, error: 'Missing uuid or characterId' };
        }
        if (this.shouldDiscardFirestoreGameplay()) {
            try {
                await F4BridgeHud.waitForBridgeReady(10000);
                const res = await F4Bridge.setActiveCharacter(characterId);
                if (!res || !res.ok) {
                    return { success: false, error: (res && res.error) || 'set_active_failed' };
                }
                this.activeCharacterId = characterId;
                if (this.user) {
                    this.user.activeCharacter = characterId;
                }
                this._saveUserSession();
                console.log('[API] activeCharacter saved via bridge:', characterId);
                return { success: true };
            } catch (error) {
                console.warn('[API] setActiveCharacter bridge failed:', error);
                return { success: false, error: error.message || String(error) };
            }
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

    /** Seed-data.js is the runtime catalog; Firestore only when admin forces refresh. */
    _USE_STATIC_TEMPLATES: true,

    _templateSessionKey(cacheKey) {
        var ver = '';
        try {
            ver = sessionStorage.getItem('f4_cdn_tpl_version') || '';
        } catch (e) { /* ignore */ }
        if (!ver) {
            ver = (typeof window !== 'undefined' && window.HUD_BUILD_LABEL) ? window.HUD_BUILD_LABEL : 'seed';
        }
        return 'f4_tpl_' + cacheKey + '_' + String(ver).replace(/\./g, '');
    },

    _clearCdnRawCache() {
        var ver = '';
        try {
            ver = sessionStorage.getItem('f4_cdn_tpl_version') || '';
        } catch (e) { /* ignore */ }
        var slug = String(ver).replace(/\./g, '');
        var self = this;
        ['classes', 'species', 'genders', 'vocations'].forEach(function (k) {
            try {
                sessionStorage.removeItem('f4_cdn_raw_' + k + '_' + slug);
            } catch (e) { /* ignore */ }
        });
        try {
            sessionStorage.removeItem('f4_cdn_tpl_version');
        } catch (e) { /* ignore */ }
        this._cdnManifestCache = null;
        this._cdnManifestFetchPromise = null;
    },

    invalidateTemplateCache(collectionName) {
        if (collectionName) {
            delete this._templateCache[collectionName];
            try {
                sessionStorage.removeItem(this._templateSessionKey(collectionName));
            } catch (e) { /* ignore */ }
            return;
        }
        this._templateCache = {};
        var self = this;
        ['classes', 'species', 'genders', 'vocations'].forEach(function (k) {
            try {
                sessionStorage.removeItem(self._templateSessionKey(k));
            } catch (e) { /* ignore */ }
        });
        this._clearCdnRawCache();
    },

    /** After admin CSV import — prefer Firestore over stale CDN for this browser session. */
    markTemplatesImportedFromFirestore() {
        try {
            sessionStorage.setItem('f4_force_firestore_templates', String(Date.now()));
        } catch (e) { /* ignore */ }
        this.invalidateTemplateCache();
    },

    _shouldForceFirestoreTemplates(options) {
        if (options && options.forceFirestore) {
            return true;
        }
        try {
            var ts = sessionStorage.getItem('f4_force_firestore_templates');
            if (!ts) {
                return false;
            }
            var age = Date.now() - parseInt(ts, 10);
            return !isNaN(age) && age >= 0 && age < (24 * 60 * 60 * 1000);
        } catch (e) {
            return false;
        }
    },

    /**
     * Canonical prerequisites array for a class template (CSV/Firestore/CDN/legacy).
     */
    normalizeClassTemplate(classData) {
        if (!classData || typeof classData !== 'object') {
            return classData;
        }
        var out = Object.assign({}, classData);
        var prereqs = [];
        if (Array.isArray(out.prerequisites)) {
            prereqs = out.prerequisites
                .map(function (p) { return String(p).trim(); })
                .filter(function (p) { return !!p; });
        } else if (out.prerequisites != null && String(out.prerequisites).trim()) {
            var raw = String(out.prerequisites).trim();
            var sep = raw.indexOf(';') >= 0 ? ';' : ',';
            prereqs = raw.split(sep)
                .map(function (p) { return p.trim(); })
                .filter(function (p) { return !!p; });
        } else if (out.prerequisite != null && String(out.prerequisite).trim()) {
            prereqs = [String(out.prerequisite).trim()];
        }
        out.prerequisites = prereqs;
        delete out.prerequisite;
        if (out.id) {
            out.image = this.normalizeClassImagePath(out.id, out.image);
        }
        return out;
    },

    _cdnManifestCache: null,
    _cdnManifestFetchPromise: null,

    _cdnDataUrl(relativePath) {
        var path = (relativePath || '').replace(/^\//, '');
        if (typeof window === 'undefined' || !window.location) {
            return path;
        }
        var base = window.location.pathname.replace(/\/[^/]*$/, '/');
        if (base === '/') {
            base = './';
        }
        return base + path;
    },

    async _fetchCdnManifest() {
        if (this._cdnManifestCache) {
            return this._cdnManifestCache;
        }
        if (this._cdnManifestFetchPromise) {
            return this._cdnManifestFetchPromise;
        }
        var self = this;
        this._cdnManifestFetchPromise = fetch(this._cdnDataUrl('data/manifest.json'), { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('manifest HTTP ' + res.status);
                }
                return res.json();
            })
            .then(function (manifest) {
                self._cdnManifestCache = manifest;
                if (manifest && manifest.version) {
                    try {
                        sessionStorage.setItem('f4_cdn_tpl_version', manifest.version);
                    } catch (e) { /* ignore */ }
                }
                return manifest;
            })
            .catch(function (err) {
                console.warn('[API] CDN manifest unavailable:', err.message);
                return null;
            });
        return this._cdnManifestFetchPromise;
    },

    _processCdnTemplateItems(items, mapDoc) {
        items = (items || []).filter(function (row) {
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

    async _loadTemplatesFromCdn(collectionName, mapDoc) {
        var manifest = await this._fetchCdnManifest();
        if (!manifest || !manifest[collectionName]) {
            return null;
        }
        var relPath = manifest[collectionName];
        var version = manifest.version || 'cdn';
        var slug = String(version).replace(/\./g, '');
        var rawKey = 'f4_cdn_raw_' + collectionName + '_' + slug;

        try {
            var raw = sessionStorage.getItem(rawKey);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.length) {
                    return this._processCdnTemplateItems(parsed, mapDoc);
                }
            }
        } catch (e) { /* ignore */ }

        try {
            var res = await fetch(this._cdnDataUrl(relPath), { cache: 'default' });
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            var items = await res.json();
            try {
                sessionStorage.setItem(rawKey, JSON.stringify(items));
            } catch (e) { /* quota */ }
            return this._processCdnTemplateItems(items, mapDoc);
        } catch (err) {
            console.warn('[API] CDN ' + collectionName + ' fetch failed:', err.message);
            return null;
        }
    },

    _mergeTemplateMaps(baselineById, firestoreById) {
        const merged = {};
        const ids = {};
        Object.keys(baselineById).forEach(function (id) {
            ids[id] = true;
        });
        Object.keys(firestoreById).forEach(function (id) {
            ids[id] = true;
        });
        Object.keys(ids).forEach(function (id) {
            if (firestoreById[id]) {
                merged[id] = firestoreById[id];
            } else if (baselineById[id]) {
                merged[id] = baselineById[id];
            }
        });
        const items = [];
        Object.keys(merged).forEach(function (id) {
            items.push(merged[id]);
        });
        items.sort(function (a, b) {
            const na = (a.name || a.id || '').toLowerCase();
            const nb = (b.name || b.id || '').toLowerCase();
            return na.localeCompare(nb);
        });
        return items;
    },

    _indexTemplatesById(items) {
        const byId = {};
        (items || []).forEach(function (item) {
            if (item && item.id) {
                byId[item.id] = item;
            }
        });
        return byId;
    },

    _templateCache: {},
    _TEMPLATE_CACHE_TTL_MS: 30 * 60 * 1000,

    _USER_SESSION_TTL_MS: 30 * 60 * 1000,
    _LAST_LOGIN_WRITE_INTERVAL_MS: 60 * 60 * 1000,
    _LIST_CHARACTERS_TTL_MS: 30 * 60 * 1000,
    _listCharactersCache: null,
    _listCharactersCacheTs: 0,
    _createCharacterInFlight: null,

    _dedupeCharactersById(characters) {
        const seen = {};
        const out = [];
        if (!characters || !characters.length) {
            return out;
        }
        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const raw = char && (char.id || char.characterId || char.character_id || '');
            const id = String(raw).trim();
            if (!id || seen[id]) {
                continue;
            }
            seen[id] = true;
            out.push(this.sanitizeRosterCharacter(char));
        }
        return out;
    },

    _getCachedTemplate(cacheKey) {
        var entry = this._templateCache[cacheKey];
        if (entry && (Date.now() - entry.ts) < this._TEMPLATE_CACHE_TTL_MS) {
            return entry.data;
        }
        try {
            var raw = sessionStorage.getItem(this._templateSessionKey(cacheKey));
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.data && parsed.ts &&
                    (Date.now() - parsed.ts) < this._TEMPLATE_CACHE_TTL_MS) {
                    this._templateCache[cacheKey] = { ts: parsed.ts, data: parsed.data };
                    return parsed.data;
                }
            }
        } catch (e) { /* quota / private mode */ }
        return null;
    },

    _setCachedTemplate(cacheKey, data) {
        var ts = Date.now();
        this._templateCache[cacheKey] = { ts: ts, data: data };
        try {
            sessionStorage.setItem(this._templateSessionKey(cacheKey), JSON.stringify({
                ts: ts,
                data: data
            }));
        } catch (e) { /* quota */ }
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

    /** CDN/seed baseline + Firestore overlay (admin edits and new templates). */
    async _loadTemplateCollection(collectionName, seedFn, mapDoc, options) {
        options = options || {};
        var forceFirestore = this._shouldForceFirestoreTemplates(options);
        var self = this;

        if (!forceFirestore) {
            await this._fetchCdnManifest();
        }

        var cached = this._getCachedTemplate(collectionName);
        if (cached) {
            console.log('[API] ' + collectionName + ': cached (' + (cached.data ? cached.data.length : 0) + ', 0 reads)');
            return cached;
        }

        var baselineItems = [];

        if (!forceFirestore) {
            var cdnLoaded = await this._loadTemplatesFromCdn(collectionName, mapDoc);
            if (cdnLoaded && cdnLoaded.data && cdnLoaded.data.length > 0) {
                baselineItems = cdnLoaded.data;
                console.log('[API] ' + collectionName + ': CDN baseline ' + baselineItems.length);
            }
        }

        if (baselineItems.length === 0) {
            var seeded = this._loadTemplatesFromSeed(collectionName, mapDoc);
            if (seeded && seeded.data) {
                baselineItems = seeded.data;
                console.log('[API] ' + collectionName + ': seed baseline ' + baselineItems.length);
            }
        }

        var snapshot = await db.collection(collectionName).get();
        if (snapshot.empty && seedFn && baselineItems.length === 0) {
            console.log('[API] Seeding empty collection:', collectionName);
            await seedFn.call(this);
            await new Promise(function (resolve) { setTimeout(resolve, 500); });
            snapshot = await db.collection(collectionName).get();
            if (baselineItems.length === 0) {
                seeded = this._loadTemplatesFromSeed(collectionName, mapDoc);
                if (seeded && seeded.data) {
                    baselineItems = seeded.data;
                }
            }
        }

        var firestoreById = {};
        snapshot.forEach(function (doc) {
            var data = doc.data();
            if (data.enabled === false) {
                return;
            }
            var mapped = mapDoc ? mapDoc(doc, data) : { id: doc.id, ...data };
            firestoreById[doc.id] = mapped;
        });

        var baselineById = this._indexTemplatesById(baselineItems);
        var items = this._mergeTemplateMaps(baselineById, firestoreById);

        var result = { success: true, data: items };
        this._setCachedTemplate(collectionName, result);
        console.log('[API] ' + collectionName + ': ' + items.length + ' merged (baseline '
            + baselineItems.length + ', firestore ' + snapshot.size + ' reads)');
        return result;
    },

    /**
     * Get all species templates (single read + session cache)
     */
    async getSpecies(options) {
        options = options || {};
        try {
            const loaded = await this._loadTemplateCollection('species', this.seedDefaultSpecies, null, options);
            const species = loaded.data || [];
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
    async getClasses(options) {
        options = options || {};
        try {
            const self = this;
            const loaded = await this._loadTemplateCollection('classes', this.seedDefaultClasses, function (doc, data) {
                return self.normalizeClassTemplate({
                    id: doc.id,
                    ...data
                });
            }, options);
            const classes = (loaded.data || []).map(function (cls) {
                return self.normalizeClassTemplate(cls);
            });
            return { success: true, data: { classes: classes } };
        } catch (error) {
            console.error('getClasses error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Universe allowlist: empty array = allow all catalog entries.
     */
    normalizeUniverseAllowlist(checkedIds, allItems) {
        const checked = (checkedIds || []).filter(Boolean);
        const total = (allItems || []).length;
        if (total === 0 || checked.length === 0) {
            return [];
        }
        if (checked.length >= total) {
            return [];
        }
        return checked;
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
    async getVocations(options) {
        options = options || {};
        try {
            const loaded = await this._loadTemplateCollection('vocations', this.seedDefaultVocations, null, options);
            const vocations = loaded.data || [];
            return { success: true, data: { vocations: vocations } };
        } catch (error) {
            console.error('getVocations error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // =========================== CHARACTER CRUD =============================

    /**
     * Character identity/gameplay is Experience KVP only (via HUD HTTP-IN bridge).
     * Firestore holds templates/universes/users — never mint character docs there.
     */
    experienceUnavailableError() {
        return 'Unable to Connect to Second Life Experience Database. Unable to manage character at this time. If this problem persists, please contact Feudalism Support.';
    },

    experienceUnavailableResult() {
        return { success: false, error: this.experienceUnavailableError() };
    },

    async requireExperienceBridge(timeoutMs) {
        const ms = timeoutMs || 12000;
        if (typeof F4BridgeHud === 'undefined' || !F4BridgeHud.waitForBridgeReady) {
            return this.experienceUnavailableResult();
        }
        try {
            await F4BridgeHud.waitForBridgeReady(ms);
            return { success: true };
        } catch (error) {
            console.error('[requireExperienceBridge]', error);
            return this.experienceUnavailableResult();
        }
    },
    
    /**
     * List all characters for current user
     */
    async listCharacters(forceRefresh) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }

        if (!forceRefresh && this._listCharactersCache &&
            (Date.now() - this._listCharactersCacheTs) < this._LIST_CHARACTERS_TTL_MS) {
            console.log('[listCharacters] memory cache:', this._listCharactersCache.length, '(0 reads)');
            return { success: true, data: { characters: this._dedupeCharactersById(this._listCharactersCache) }, cached: true };
        }

        // Never hydrate roster from sessionStorage when not in bridge mode — that can
        // resurrect Firestore orphans as if they were KVP characters.
        if (this.uuid) {
            try {
                sessionStorage.removeItem('f4_roster_' + this.uuid);
            } catch (e) { /* ignore */ }
        }

        const bridgeGate = await this.requireExperienceBridge(10000);
        if (!bridgeGate.success) {
            return bridgeGate;
        }
        try {
            const res = await F4Bridge.listCharacters();
            if (!res || !res.ok) {
                return { success: false, error: (res && res.error) || this.experienceUnavailableError() };
            }
            const ownerUuid = this.uuid;
            const characters = (res.characters || []).map(function (c) {
                return API.sanitizeRosterCharacter(Object.assign({ owner_uuid: ownerUuid }, c));
            });
            const deduped = this._dedupeCharactersById(characters);
            this._listCharactersCache = deduped;
            this._listCharactersCacheTs = Date.now();
            if (this.uuid) {
                try {
                    sessionStorage.setItem('f4_roster_' + this.uuid, JSON.stringify({ characters: deduped }));
                } catch (e) { /* ignore */ }
            }
            console.log('[listCharacters] bridge roster:', deduped.length);
            return { success: true, data: { characters: deduped } };
        } catch (error) {
            console.error('[listCharacters] bridge error:', error);
            return this.experienceUnavailableResult();
        }
    },
    
    /**
     * Get character by ID for current user
     */
    async getCharacterById(characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }

        let fromCache = null;
        if (this._listCharactersCache) {
            for (let i = 0; i < this._listCharactersCache.length; i++) {
                if (this._listCharactersCache[i].id === characterId) {
                    fromCache = this._listCharactersCache[i];
                    break;
                }
            }
        }
        if (!fromCache) {
            const listed = await this.listCharacters(true);
            if (!listed.success) {
                return listed;
            }
            if (listed.data && listed.data.characters) {
                for (let j = 0; j < listed.data.characters.length; j++) {
                    if (listed.data.characters[j].id === characterId) {
                        fromCache = listed.data.characters[j];
                        break;
                    }
                }
            }
        }
        if (!fromCache) {
            return { success: false, error: 'Character not found' };
        }
        return {
            success: true,
            data: { character: this.sanitizeRosterCharacter(Object.assign({ owner_uuid: this.uuid }, fromCache)) }
        };
    },
    
    /**
     * Get character for current user (first / active from Experience roster)
     */
    async getCharacter() {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }

        const listed = await this.listCharacters(false);
        if (!listed.success) {
            return listed;
        }
        const characters = (listed.data && listed.data.characters) ? listed.data.characters : [];
        if (!characters.length) {
            return { success: false, error: 'No character found' };
        }
        let character = characters[0];
        const preferId = this.activeCharacterId
            || (this.user && this.user.activeCharacter)
            || '';
        if (preferId) {
            for (let i = 0; i < characters.length; i++) {
                if (characters[i].id === preferId) {
                    character = characters[i];
                    break;
                }
            }
        }
        return {
            success: true,
            data: {
                character: this.sanitizeRosterCharacter(Object.assign({ owner_uuid: this.uuid }, character))
            }
        };
    },
    
    /**
     * Create a new character (Experience KVP via HUD bridge only — never Firestore)
     */
    async createCharacter(charData) {
        if (!this.uuid || this.uuid.trim() === '') {
            return { success: false, error: 'No UUID - access denied' };
        }

        if (this._createCharacterInFlight) {
            console.warn('[createCharacter] Reusing in-flight create (prevents duplicate docs)');
            return this._createCharacterInFlight;
        }

        this._createCharacterInFlight = this._createCharacterImpl(charData);
        try {
            return await this._createCharacterInFlight;
        } finally {
            this._createCharacterInFlight = null;
        }
    },

    async _createCharacterImpl(charData) {
        const bridgeGate = await this.requireExperienceBridge(12000);
        if (!bridgeGate.success) {
            return bridgeGate;
        }
        try {
            const res = await F4Bridge.createCharacter(charData || {});
            if (!res || !res.ok || !res.character) {
                return {
                    success: false,
                    error: (res && res.error) || this.experienceUnavailableError()
                };
            }
            const createdCharacter = this.sanitizeRosterCharacter(
                Object.assign({ owner_uuid: this.uuid }, res.character)
            );
            if (!this._listCharactersCache) {
                this._listCharactersCache = [];
            }
            this._listCharactersCache.unshift(createdCharacter);
            this._listCharactersCache = this._dedupeCharactersById(this._listCharactersCache);
            this._listCharactersCacheTs = Date.now();
            if (this.uuid) {
                try {
                    sessionStorage.setItem(
                        'f4_roster_' + this.uuid,
                        JSON.stringify({ characters: this._listCharactersCache })
                    );
                } catch (e) { /* quota */ }
            }
            this.activeCharacterId = createdCharacter.id;
            if (this.user) {
                this.user.activeCharacter = createdCharacter.id;
            }
            this._saveUserSession();
            console.log('[createCharacter] bridge created:', createdCharacter.id);
            return {
                success: true,
                data: {
                    character: createdCharacter,
                    message: 'Character created!'
                }
            };
        } catch (error) {
            console.error('createCharacter bridge error:', error);
            return this.experienceUnavailableResult();
        }
    },
    
    /**
     * Delete character (Experience KVP via HUD bridge only)
     */
    async deleteCharacter(characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID - access denied' };
        }
        
        if (!characterId) {
            return { success: false, error: 'No character ID provided' };
        }

        const bridgeGate = await this.requireExperienceBridge(10000);
        if (!bridgeGate.success) {
            return bridgeGate;
        }
        try {
            const res = await F4Bridge.deleteCharacter(characterId);
            if (!res || !res.ok) {
                return {
                    success: false,
                    error: (res && res.error) || this.experienceUnavailableError()
                };
            }
            if (this._listCharactersCache) {
                this._listCharactersCache = this._listCharactersCache.filter(function (c) {
                    return c.id !== characterId;
                });
            }
            this._listCharactersCacheTs = Date.now();
            if (this.uuid) {
                try {
                    sessionStorage.setItem(
                        'f4_roster_' + this.uuid,
                        JSON.stringify({ characters: this._listCharactersCache || [] })
                    );
                } catch (e) { /* ignore */ }
            }
            if (this.activeCharacterId === characterId) {
                this.activeCharacterId = null;
                if (this.user) {
                    this.user.activeCharacter = null;
                }
                this._saveUserSession();
            }
            console.log('[deleteCharacter] bridge deleted:', characterId);
            return {
                success: true,
                data: {
                    message: 'Character deleted successfully',
                    characterId: characterId
                }
            };
        } catch (error) {
            console.error('deleteCharacter bridge error:', error);
            return this.experienceUnavailableResult();
        }
    },
    
    /**
     * Bridge updateIdent rewrites the whole f4char_ blob. Partial patches
     * (has_mana / mode / class only) must merge onto the cached character or
     * F4Bridge fills missing fields with Unnamed/other/human and wipes identity.
     */
    findCachedCharacter(characterId) {
        if (!characterId) {
            return null;
        }
        let i;
        let list = this._listCharactersCache;
        if (list) {
            for (i = 0; i < list.length; i++) {
                if (list[i].id === characterId) {
                    return list[i];
                }
            }
        }
        if (this.uuid) {
            try {
                const raw = sessionStorage.getItem('f4_roster_' + this.uuid);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    list = parsed && parsed.characters;
                    if (list && list.length) {
                        for (i = 0; i < list.length; i++) {
                            if (list[i].id === characterId) {
                                return list[i];
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        }
        return null;
    },

    mergeCharacterForBridgeUpdate(existing, patch, targetId) {
        const base = existing ? Object.assign({}, existing) : {};
        const merged = Object.assign({}, base, patch || {}, { id: targetId });
        if (merged.owner_uuid == null && this.uuid) {
            merged.owner_uuid = this.uuid;
        }
        return merged;
    },

    async updateCharacter(charData, characterId) {
        if (!this.uuid) {
            return { success: false, error: 'No UUID' };
        }
        
        const targetId = characterId || charData.id;
        if (!targetId) {
            return { success: false, error: 'No character ID specified' };
        }

        const bridgeGate = await this.requireExperienceBridge(10000);
        if (!bridgeGate.success) {
            return bridgeGate;
        }
        try {
            const existing = this.findCachedCharacter(targetId);
            const payload = this.mergeCharacterForBridgeUpdate(existing, charData, targetId);
            const res = await F4Bridge.updateCharacter(payload, targetId);
            if (!res || !res.ok || !res.character) {
                return {
                    success: false,
                    error: (res && res.error) || this.experienceUnavailableError()
                };
            }
            const updatedCharacter = this.sanitizeRosterCharacter(
                Object.assign({ owner_uuid: this.uuid }, payload, res.character, { id: targetId })
            );
            if (this._listCharactersCache) {
                this._listCharactersCache = this._listCharactersCache.map(function (c) {
                    return c.id === targetId ? updatedCharacter : c;
                });
            } else {
                this._listCharactersCache = [updatedCharacter];
            }
            if (this.uuid) {
                try {
                    sessionStorage.setItem(
                        'f4_roster_' + this.uuid,
                        JSON.stringify({ characters: this._listCharactersCache || [updatedCharacter] })
                    );
                } catch (e) { /* ignore */ }
            }
            console.log('[updateCharacter] bridge updated:', targetId);
            return {
                success: true,
                data: {
                    character: updatedCharacter,
                    message: 'Character saved!'
                }
            };
        } catch (error) {
            console.error('updateCharacter bridge error:', error);
            return this.experienceUnavailableResult();
        }
    },
    
    /**
     * Change character's class with career history tracking
    /**
     * Change character's class with career history tracking
     * @param {string} newClassId - The class to change to
     * @param {object} classData - The class template data
     * @param {boolean} isFreeAdvance - If true, no XP cost
     */
    async changeClass(newClassId, classData, isFreeAdvance = false, characterId, econOverride) {
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
            if (this.shouldDiscardFirestoreGameplay()) {
                this.discardFirestoreGameplayFields(character);
                if (!econOverride || !econOverride.stats) {
                    return {
                        success: false,
                        error: 'Gameplay stats must come from your HUD. Save Stats, then try again.'
                    };
                }
                if (econOverride.xp_lifetime != null) {
                    character.xp_lifetime = econOverride.xp_lifetime;
                }
                if (econOverride.xp_spent != null) {
                    character.xp_spent = econOverride.xp_spent;
                }
                if (econOverride.ap_balance != null) {
                    character.ap_balance = econOverride.ap_balance;
                }
                character.stats = { ...econOverride.stats };
            } else if (econOverride && econOverride.stats) {
                if (econOverride.xp_lifetime != null) {
                    character.xp_lifetime = econOverride.xp_lifetime;
                }
                if (econOverride.xp_spent != null) {
                    character.xp_spent = econOverride.xp_spent;
                }
                if (econOverride.ap_balance != null) {
                    character.ap_balance = econOverride.ap_balance;
                }
                character.stats = { ...econOverride.stats };
            }
            const gameplayStats = character.stats;
            const universeId = character.universe_id || 'default';
            const classConfigResult = await this.getUniverseClassConfiguration(universeId);
            const universe = classConfigResult.success
                ? classConfigResult.data.universe
                : null;
            const effectiveClasses = classConfigResult.success
                ? (classConfigResult.data.classes || [])
                : [];
            const effectiveClassData = effectiveClasses.find(c => c.id === newClassId) || classData;
            let allClasses = effectiveClasses;
            if (allClasses.length === 0) {
                const classesResult = await this.getClasses();
                allClasses = classesResult.success ? (classesResult.data.classes || []) : [];
            }

            const canChange = this.canChangeToClass(character, effectiveClassData, allClasses, {
                universe,
                enforceStatMinimums: this.enforceClassStatMinimums(universe),
                gameplayStats: gameplayStats
            });
            if (!canChange.canChange) {
                return { success: false, error: canChange.reason || 'Cannot change to this class' };
            }

            const xpCost = canChange.xpCost;
            const isFreeAdvanceEffective = canChange.isFreeAdvance;
            const currentClassId = character.class_id;
            
            // Calculate if we gained any points in current class
            const startStats = character.stats_at_class_start || {};
            const currentStats = gameplayStats;
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
            const paidSwitch = !isFreeAdvanceEffective && xpCost > 0;
            if (currentClassId && currentClassId !== newClassId) {
                const isAbandoned = totalGained === 0 && !paidSwitch;
                
                if (!isAbandoned) {
                    careerHistory.push({
                        class_id: currentClassId,
                        started_at: character.class_started_at || new Date().toISOString(),
                        ended_at: new Date().toISOString(),
                        maxed: isMaxed,
                        stats_gained: totalGained,
                        abandoned: false
                    });
                }
            }
            
            // Prepare update — class_id / career snapshot / history only.
            // Live stats stay in Experience KVP (f4stats); never write stats to Firestore.
            const updateData = {
                class_id: newClassId,
                class_started_at: new Date().toISOString(),
                stats_at_class_start: { ...currentStats },
                career_history: careerHistory,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const result = await this.updateCharacter(updateData, character.id);
            
            if (result.success) {
                if (isFreeAdvanceEffective) {
                    result.data.message = `Advanced to ${effectiveClassData.name}!`;
                } else if (xpCost === 0) {
                    result.data.message = `Changed class to ${effectiveClassData.name} (Free)`;
                } else {
                    result.data.message = `Changed class to ${effectiveClassData.name} (${xpCost} XP)`;
                }
                result.data.career_history = careerHistory;
                result.data.xpCost = xpCost;
                result.data.isFreeAdvance = isFreeAdvanceEffective;
                result.data.class_id = newClassId;
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

        if (character && classData && character.class_id === classData.id) {
            result.canChange = true;
            return result;
        }
        
        // Support both single prerequisite (backward compat) and multiple prerequisites
        const prerequisites = classData.prerequisites || (classData.prerequisite ? [classData.prerequisite] : []);
        
        // Beginner classes (no prerequisites, or universe tier override) cost 0
        const isBeginnerClass = prerequisites.length === 0 || classData.tier === 'beginner';
        if (!isBeginnerClass) {
            result.xpCost = classData.xp_cost || 0;
        }

        const universe = options.universe;
        if (universe) {
            const allowlist = universe.allowedClasses;
            if (allowlist && allowlist.length > 0) {
                const overrides = universe.classOverrides || {};
                const enabledViaOverride = overrides[classData.id] && overrides[classData.id].enabled === true;
                if (!allowlist.includes(classData.id) && !enabledViaOverride) {
                    result.reason = `${classData.name || classData.id} is not available in this universe`;
                    return result;
                }
            }
            if (classData.enabled === false) {
                result.reason = `${classData.name || classData.id} is disabled in this universe`;
                return result;
            }
        }
        
        // Creation / starter grant: first class may ignore career prerequisites and XP cost.
        const creationStartingClass = options.creationStartingClass === true
            || options.starterClassGrant === true;

        // Check prerequisites - character needs ANY one of them
        if (prerequisites.length > 0 && !creationStartingClass) {
            const careerHistory = character.career_history || [];
            const hasAnyPrereq = prerequisites.some(prereqId => {
                return character.class_id === prereqId ||
                    careerHistory.some(h => h.class_id === prereqId && !h.abandoned);
            });
            
            if (!hasAnyPrereq) {
                const prereqNames = prerequisites
                    .map(id => allClasses.find(c => c.id === id)?.name || id)
                    .join(' or ');
                result.reason = `Requires one of: ${prereqNames}`;
                return result;
            }
        }

        if (creationStartingClass) {
            result.xpCost = 0;
            result.isFreeAdvance = true;
        }
        
        const enforceStatMinimums = options.enforceStatMinimums !== undefined
            ? options.enforceStatMinimums
            : this.enforceClassStatMinimums(options.universe);

        // Check minimum stat requirements (still apply unless starter grant)
        if (!creationStartingClass && enforceStatMinimums && classData.stat_minimums) {
            const stats = this.getGameplayStatsForClassCheck(character, options);
            const missingStats = [];
            
            for (const [stat, minValue] of Object.entries(classData.stat_minimums)) {
                const currentValue = stats[stat] != null ? stats[stat] : 2;
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
                const isMaxed = this.isClassMaxed(character, currentClass, options);
                if (isMaxed) {
                    result.isFreeAdvance = true;
                    result.xpCost = 0;
                }
            }
        }
        
        // Check XP (unused = lifetime - spent, from MOAP/KVP)
        const lifetime = character.xp_lifetime != null ? character.xp_lifetime : 0;
        const spent = character.xp_spent != null ? character.xp_spent : 0;
        const unusedXp = Math.max(0, lifetime - spent);
        if (!result.isFreeAdvance && result.xpCost > unusedXp) {
            result.reason = `Need ${result.xpCost} XP (have ${unusedXp} unused)`;
            return result;
        }
        
        result.canChange = true;
        return result;
    },
    
    /**
     * Check if character has maxed their current class
     */
    /**
     * Drop Firestore stats/roster on read — live data is Experience KVP / HUD only.
     * f4_bridge=1 in the URL means Experience authority even before sl_cap is ready.
     * Never fall back to Firestore characters when Setup HUD is in bridge mode
     * (that resurrected wiped KVP rosters and treated avatar UUIDs as characters).
     */
    shouldDiscardFirestoreGameplay() {
        try {
            if (new URLSearchParams(window.location.search).get('f4_bridge') === '1') {
                return true;
            }
        } catch (e) { /* ignore */ }
        if (typeof F4Bridge !== 'undefined' && typeof F4Bridge.isBridgeMode === 'function'
            && F4Bridge.isBridgeMode()) {
            return true;
        }
        return typeof F4BridgeHud !== 'undefined' && F4BridgeHud.isEnabled();
    },

    discardFirestoreGameplayFields(character) {
        if (!character) {
            return;
        }
        // Do not seed factory all-1s — that line must only come from KVP/HUD session or explicit creation confirm.
        delete character.stats;
        character.xp_total = 0;
        character.xp_available = 0;
        character.xp_lifetime = 0;
        character.xp_spent = 0;
        character.ap_balance = 0;
    },

    sanitizeRosterCharacter(character) {
        if (!character) {
            return character;
        }
        const c = Object.assign({}, character);
        if (this.shouldDiscardFirestoreGameplay()) {
            this.discardFirestoreGameplayFields(c);
        }
        // Coerce has_mana — Firestore/bridge may send true, 1, "1", or "true".
        // Setup class gates used === true and treated "1" as no mana.
        const hm = c.has_mana;
        c.has_mana = (hm === true || hm === 1 || hm === '1' || hm === 'true');
        return c;
    },

    /**
     * Gameplay stat line for class gates — MOAP session / HUD URL only (never Firestore).
     */
    getGameplayStatsForClassCheck(character, options) {
        if (options && options.gameplayStats) {
            return options.gameplayStats;
        }
        if (typeof window !== 'undefined' && typeof window.getMergedCharacterStatsForPoints === 'function') {
            return window.getMergedCharacterStatsForPoints(character).stats;
        }
        return {};
    },

    isClassMaxed(character, classData, options) {
        if (!classData || !classData.stat_maximums) return false;
        
        const stats = this.getGameplayStatsForClassCheck(character, options);
        const caps = classData.stat_maximums;
        
        for (const stat in caps) {
            if ((stats[stat] != null ? stats[stat] : 2) < caps[stat]) {
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
    
    getNewCharacterStats() {
        if (typeof F4_SEED_DATA !== 'undefined' && F4_SEED_DATA.statNames) {
            const stats = {};
            F4_SEED_DATA.statNames.forEach(function (stat) {
                stats[stat] = 1;
            });
            return stats;
        }
        return {
            agility: 1, animal_handling: 1, athletics: 1, awareness: 1, crafting: 1,
            deception: 1, endurance: 1, entertaining: 1, fighting: 1, healing: 1,
            influence: 1, intelligence: 1, knowledge: 1, marksmanship: 1, persuasion: 1,
            stealth: 1, survival: 1, thievery: 1, will: 1, wisdom: 1
        };
    },

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
    
    async getGenders(options) {
        options = options || {};
        try {
            const loaded = await this._loadTemplateCollection('genders', this.seedDefaultGenders, null, options);
            const genders = loaded.data || [];
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
            this.invalidateTemplateCache(type);

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
                
                const existing = await ref.get();
                if (!existing.exists) {
                    const createData = { ...finalData };
                    delete createData.prerequisite;
                    if (type === 'classes' && createData.enabled === undefined) {
                        createData.enabled = true;
                    }
                    createData.created_at = firebase.firestore.FieldValue.serverTimestamp();
                    await ref.set(createData);
                } else {
                    if (type === 'classes') {
                        finalData.prerequisite = firebase.firestore.FieldValue.delete();
                    }
                    await ref.update(finalData);
                }
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
            
            this.invalidateTemplateCache(type);
            
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
                magic: universeData.magic || {
                    enabled: universeData.manaEnabled !== undefined ? !!universeData.manaEnabled : true,
                    domainAliases: {}
                },
                
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

            let currentCount = 0;
            if (this.shouldDiscardFirestoreGameplay()) {
                const listed = await this.listCharacters(true);
                if (!listed.success) {
                    return { success: false, error: listed.error || 'list_failed' };
                }
                const chars = (listed.data && listed.data.characters) ? listed.data.characters : [];
                currentCount = chars.filter(function (c) {
                    return (c.universe_id || 'default') === universeId;
                }).length;
            } else {
                const snapshot = await db.collection('characters')
                    .where('owner_uuid', '==', playerUuid)
                    .where('universe_id', '==', universeId).get();
                currentCount = snapshot.size;
            }
            
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
            
            // Check class (only when a class is already chosen)
            if (classId) {
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
     * Emergency character universe migrate helpers.
     * Super Admin UUID or Sys Admin role.
     */
    isSuperAdminUser() {
        return this.uuid === this.SUPER_ADMIN_UUID;
    },

    canMigrateCharacterUniverse() {
        return this.isSuperAdminUser() || this.role === 'sys_admin';
    },

    /**
     * List Firestore character docs for an owner (Sys Admin / Super Admin).
     * Note: KVP is gameplay authority; this uses Firestore checkpoints for admin tooling.
     */
    async adminListCharactersByOwner(ownerUuid) {
        try {
            if (!this.canMigrateCharacterUniverse()) {
                return { success: false, error: 'Unauthorized: Sys Admin or Super Admin only' };
            }
            ownerUuid = String(ownerUuid || '').trim().toLowerCase();
            if (!ownerUuid || ownerUuid.length !== 36) {
                return { success: false, error: 'Enter a valid owner avatar UUID' };
            }
            const snapshot = await db.collection('characters')
                .where('owner_uuid', '==', ownerUuid)
                .get();
            const characters = [];
            snapshot.forEach(doc => {
                characters.push(Object.assign({ id: doc.id }, doc.data()));
            });
            characters.sort((a, b) => {
                const na = (a.name || a.id || '').toLowerCase();
                const nb = (b.name || b.id || '').toLowerCase();
                return na.localeCompare(nb);
            });
            return { success: true, data: { characters, ownerUuid } };
        } catch (error) {
            console.error('adminListCharactersByOwner error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Load any character doc by id (Sys Admin / Super Admin).
     */
    async adminGetCharacterById(characterId) {
        try {
            if (!this.canMigrateCharacterUniverse()) {
                return { success: false, error: 'Unauthorized: Sys Admin or Super Admin only' };
            }
            characterId = String(characterId || '').trim();
            if (!characterId) {
                return { success: false, error: 'Character ID required' };
            }
            const doc = await db.collection('characters').doc(characterId).get();
            if (!doc.exists) {
                return { success: false, error: 'Character not found in Firestore (KVP-only chars need Character Admin Tool)' };
            }
            return { success: true, data: { character: Object.assign({ id: doc.id }, doc.data()) } };
        } catch (error) {
            console.error('adminGetCharacterById error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Build rematch plan for moving a character into a destination universe.
     */
    async adminPlanUniverseMigrate(characterId, newUniverseId) {
        try {
            if (!this.canMigrateCharacterUniverse()) {
                return { success: false, error: 'Unauthorized: Sys Admin or Super Admin only' };
            }
            const charResult = await this.adminGetCharacterById(characterId);
            if (!charResult.success) {
                return charResult;
            }
            const character = charResult.data.character;
            newUniverseId = String(newUniverseId || '').trim();
            if (!newUniverseId) {
                return { success: false, error: 'Destination universe required' };
            }
            const filtered = await this.getFilteredIdentityOptions(newUniverseId);
            if (!filtered.success) {
                return filtered;
            }
            const universeDoc = await db.collection('universes').doc(newUniverseId).get();
            if (!universeDoc.exists) {
                return { success: false, error: 'Universe not found' };
            }
            const universe = Object.assign({ id: universeDoc.id }, universeDoc.data());
            const genderId = character.gender || '';
            const speciesId = character.species_id || '';
            const classId = character.class_id || '';

            const genderOk = !genderId || this._idAllowedInUniverseList(
                genderId, universe.allowedGenders, filtered.data.genders
            );
            const speciesOk = !speciesId || this._idAllowedInUniverseList(
                speciesId, universe.allowedSpecies, filtered.data.species
            );
            let classOk = true;
            if (classId) {
                classOk = this._idAllowedInUniverseList(
                    classId, universe.allowedClasses, filtered.data.classes
                );
                if (classOk) {
                    const cfg = await this.getUniverseClassConfiguration(newUniverseId);
                    if (cfg.success) {
                        const eff = (cfg.data.classes || []).find(c => c.id === classId);
                        classOk = !!(eff && eff.enabled !== false);
                    }
                }
            }

            let limit = null;
            try {
                const destUniverse = universe;
                const lim = parseInt(String(destUniverse.characterLimit != null ? destUniverse.characterLimit : 0), 10) || 0;
                if (lim > 0 && character.owner_uuid) {
                    const sameUni = await db.collection('characters')
                        .where('owner_uuid', '==', character.owner_uuid)
                        .where('universe_id', '==', newUniverseId)
                        .get();
                    let count = 0;
                    sameUni.forEach(function (doc) {
                        if (doc.id !== character.id) {
                            count++;
                        }
                    });
                    limit = {
                        allowed: count < lim,
                        currentCount: count,
                        limit: lim
                    };
                }
            } catch (limitErr) {
                console.warn('adminPlanUniverseMigrate limit check:', limitErr);
            }

            return {
                success: true,
                data: {
                    character,
                    universe,
                    current: {
                        universe_id: character.universe_id || '',
                        gender: genderId,
                        species_id: speciesId,
                        class_id: classId
                    },
                    needs: {
                        gender: !genderOk,
                        species: !speciesOk,
                        class: !classOk
                    },
                    options: {
                        genders: filtered.data.genders || [],
                        species: filtered.data.species || [],
                        classes: filtered.data.classes || []
                    },
                    limit: limit,
                    manaEnabled: universe.manaEnabled !== false
                }
            };
        } catch (error) {
            console.error('adminPlanUniverseMigrate error:', error);
            return { success: false, error: error.message };
        }
    },

    _idAllowedInUniverseList(id, allowlist, filteredItems) {
        if (!id) {
            return true;
        }
        if (allowlist && allowlist.length > 0 && allowlist.indexOf(id) === -1) {
            return false;
        }
        if (filteredItems && filteredItems.length > 0) {
            return filteredItems.some(function (item) {
                return item && item.id === id && item.enabled !== false;
            });
        }
        return true;
    },

    /**
     * Apply emergency universe migrate (Super Admin). Writes Firestore checkpoint.
     * Returns kvpPaste line for Character Admin Tool Experience sync.
     */
    async adminMigrateCharacterUniverse(characterId, patch) {
        try {
            if (!this.canMigrateCharacterUniverse()) {
                return { success: false, error: 'Unauthorized: Sys Admin or Super Admin only' };
            }
            characterId = String(characterId || '').trim();
            patch = patch || {};
            const newUniverseId = String(patch.universe_id || '').trim();
            if (!characterId || !newUniverseId) {
                return { success: false, error: 'Character ID and destination universe are required' };
            }

            const plan = await this.adminPlanUniverseMigrate(characterId, newUniverseId);
            if (!plan.success) {
                return plan;
            }
            const character = plan.data.character;
            let gender = patch.gender != null ? String(patch.gender).trim() : (character.gender || '');
            let speciesId = patch.species_id != null
                ? String(patch.species_id).trim()
                : (character.species_id || '');
            let classId = patch.class_id != null
                ? String(patch.class_id).trim()
                : (character.class_id || '');

            if (plan.data.needs.gender && !patch.gender) {
                return { success: false, error: 'Pick a gender allowed in the destination universe' };
            }
            if (plan.data.needs.species && !patch.species_id) {
                return { success: false, error: 'Pick a species allowed in the destination universe' };
            }
            if (plan.data.needs.class && !patch.class_id) {
                return { success: false, error: 'Pick a class allowed in the destination universe' };
            }

            const identityCheck = await this.validateIdentityOptions(
                newUniverseId, gender || 'other', speciesId || 'human', classId || undefined
            );
            if (!identityCheck.success || !identityCheck.data.valid) {
                return {
                    success: false,
                    error: 'Identity not allowed in destination: '
                        + ((identityCheck.data && identityCheck.data.errors)
                            ? identityCheck.data.errors.join('; ')
                            : (identityCheck.error || 'invalid'))
                };
            }

            const updateData = {
                universe_id: newUniverseId,
                gender: gender,
                species_id: speciesId,
                class_id: classId || character.class_id || '',
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                admin_universe_migrate: {
                    by: this.uuid,
                    at: firebase.firestore.FieldValue.serverTimestamp(),
                    from: character.universe_id || '',
                    to: newUniverseId
                }
            };

            await db.collection('characters').doc(characterId).update(updateData);

            const kvpPaste = [
                newUniverseId,
                gender || '',
                speciesId || '',
                classId || ''
            ].join('|');

            return {
                success: true,
                data: {
                    characterId,
                    owner_uuid: character.owner_uuid || '',
                    name: character.name || '',
                    updated: updateData,
                    kvpPaste,
                    message: 'Firestore character updated. Apply the same values in Character Admin → KVP Identity → Paste Migrate (Experience KVP is authoritative).'
                }
            };
        } catch (error) {
            console.error('adminMigrateCharacterUniverse error:', error);
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
            // Empty allowedClasses = full catalog. classOverrides.enabled only applies with an allowlist.
            
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
    
    // =========================== INVENTORY API (REMOVED) =====================
    // Gameplay inventory is Experience KVP only. Use the HUD I button in-world.
    
    async getInventoryPage() {
        console.warn('[API] getInventoryPage is disabled — inventory is Experience KVP only');
        return { items: [], page: 1, totalPages: 0, hasMore: false, cursor: null };
    },

    async getItemQuantity() {
        console.warn('[API] getItemQuantity is disabled — inventory is Experience KVP only');
        return { success: true, data: { quantity: 0 } };
    },

    async checkItems() {
        console.warn('[API] checkItems is disabled — inventory is Experience KVP only');
        return { success: true, data: { allAvailable: false, missing: [] } };
    },

    // =========================== CONSUMABLES API ===========================

  CONSUMABLE_CATEGORIES: ['food', 'beverage', 'healing', 'poison', 'antidote', 'alcohol', 'intoxicant'],

  normalizeEffectExpr(value) {
    if (value === undefined || value === null || value === '') {
      return '0';
    }
    return String(value).trim();
  },

  normalizeCuresPoison(value) {
    if (!value) {
      return '';
    }
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim().toLowerCase()).filter(Boolean).join(',');
    }
    return String(value).split(/[,;]/).map(v => v.trim().toLowerCase()).filter(Boolean).join(',');
  },

  isInstantConsumableCategory(category) {
    const c = (category || '').toLowerCase();
    return c === 'food' || c === 'beverage';
  },

  /**
   * Normalize consumable document (legacy effect_type/value → category + per-resource expressions).
   */
  normalizeConsumableData(id, data) {
    const raw = { id, ...data };
    const legacyType = (raw.effect_type || '').toLowerCase();
    let category = (raw.effect_category || '').toLowerCase();
    if (!this.CONSUMABLE_CATEGORIES.includes(category)) {
      const map = {
        heal: 'healing', healing: 'healing', food: 'food', beverage: 'beverage', drink: 'beverage',
        poison: 'poison', antidote: 'antidote', alcohol: 'alcohol', intoxicant: 'intoxicant'
      };
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
    const poison_id = (raw.poison_id || (category === 'poison' ? id : '') || '').toLowerCase();
    return {
      ...raw,
      effect_category: category,
      effect_health: this.normalizeEffectExpr(effect_health ?? 0),
      effect_stamina: this.normalizeEffectExpr(effect_stamina ?? 0),
      effect_mana: this.normalizeEffectExpr(effect_mana ?? 0),
      poison_id,
      cures_poison: this.normalizeCuresPoison(raw.cures_poison),
      delay_seconds: this.isInstantConsumableCategory(category) ? 0 : (raw.delay_seconds ?? 0),
      duration_seconds: this.isInstantConsumableCategory(category) ? 0 : (raw.duration_seconds ?? 0),
      stackable: !!raw.stackable,
      max_stack: raw.stackable ? (raw.max_stack || 1) : 1
    };
  },

  formatConsumableEffectsSummary(c) {
    const fmt = (expr) => {
      const s = this.normalizeEffectExpr(expr);
      if (s === '0') return '';
      return s;
    };
    const parts = [];
    const h = fmt(c.effect_health);
    const s = fmt(c.effect_stamina);
    const m = fmt(c.effect_mana);
    if (h) parts.push(`HP ${h}`);
    if (s) parts.push(`STA ${s}`);
    if (m) parts.push(`MP ${m}`);
    const amounts = parts.length ? parts.join(', ') : 'none';
    const cat = (c.effect_category || '').toLowerCase();
    if (cat === 'antidote' && c.cures_poison) {
      return `antidote — cures ${c.cures_poison}${amounts !== 'none' ? '; ' + amounts : ''}`;
    }
    if (cat === 'poison' && c.poison_id) {
      return `poison (${c.poison_id}) — ${amounts}`;
    }
    if (cat === 'food' || cat === 'beverage') {
      return `${cat} — ${amounts} (instant, every use)`;
    }
    const delay = c.delay_seconds ? `${c.delay_seconds}s delay` : 'instant';
    const dur = c.duration_seconds ? `${c.duration_seconds}s` : 'instant';
    return `${cat || 'healing'} — ${amounts} (${delay}, lasts ${dur})`;
  },

  buildConsumableDocument(consumableData, slug) {
    const category = (consumableData.effect_category || 'healing').toLowerCase();
    const instant = this.isInstantConsumableCategory(category);
    return {
      name: consumableData.name,
      description: consumableData.description || '',
      icon: consumableData.icon || '',
      effect_category: category,
      effect_health: this.normalizeEffectExpr(consumableData.effect_health ?? '0'),
      effect_stamina: this.normalizeEffectExpr(consumableData.effect_stamina ?? '0'),
      effect_mana: this.normalizeEffectExpr(consumableData.effect_mana ?? '0'),
      poison_id: category === 'poison'
        ? (consumableData.poison_id || slug || '').toLowerCase()
        : (consumableData.poison_id || ''),
      cures_poison: category === 'antidote'
        ? this.normalizeCuresPoison(consumableData.cures_poison)
        : '',
      delay_seconds: instant ? 0 : (consumableData.delay_seconds ?? 0),
      duration_seconds: instant ? 0 : (consumableData.duration_seconds ?? 0),
      stackable: consumableData.stackable || false,
      max_stack: consumableData.stackable ? (consumableData.max_stack || 1) : 1,
      rp_only: consumableData.rp_only || false,
      disabled: consumableData.disabled || false,
      effect_type: consumableData.effect_type || category,
      effect_value: consumableData.effect_value ?? 0
    };
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
            const slug = (consumableData.slug || consumableData.name.toLowerCase().replace(/\s+/g, '_')).trim();
            const consumable = this.buildConsumableDocument(consumableData, slug);
            
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
            if (consumableData.effect_health !== undefined) updateData.effect_health = this.normalizeEffectExpr(consumableData.effect_health);
            if (consumableData.effect_stamina !== undefined) updateData.effect_stamina = this.normalizeEffectExpr(consumableData.effect_stamina);
            if (consumableData.effect_mana !== undefined) updateData.effect_mana = this.normalizeEffectExpr(consumableData.effect_mana);
            if (consumableData.poison_id !== undefined) updateData.poison_id = (consumableData.poison_id || '').toLowerCase();
            if (consumableData.cures_poison !== undefined) updateData.cures_poison = this.normalizeCuresPoison(consumableData.cures_poison);
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

            if (updateData.effect_category === 'food' || updateData.effect_category === 'beverage'
                || consumableData.effect_category === 'food' || consumableData.effect_category === 'beverage') {
                updateData.delay_seconds = 0;
                updateData.duration_seconds = 0;
            }
            
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
    },

    // ========================================================================
    // Magic CMS (P1) — feud4/magic/{domains|kinds|runes|visualEffects|damageTypes|spells}
    // Contract: Concepts & Documents/Magic CMS Firestore Schema.md
    // LSD runtime cache keys (for later bridge): magic_spell_{id}, _ver, _ts; magic_cache_ttl
    // ========================================================================

    MAGIC_CATALOGS: ['domains', 'kinds', 'damageTypes', 'visualEffects', 'runes', 'spells'],

    MAGIC_DELIVERY_TIMINGS: ['instant', 'delayed', 'channeled'],
    MAGIC_TRIGGER_MODES: ['none', 'proximity', 'touch', 'collision', 'timer', 'manual'],
    MAGIC_TARGET_MODES: ['self', 'targeted', 'targeted_aoe', 'caster_aoe', 'projectile_aoe', 'touch', 'object'],
    MAGIC_TARGET_ORIGINS: ['caster', 'target', 'impact', 'object'],
    MAGIC_EFFECT_TYPES: ['damage', 'heal', 'resource', 'animation', 'rez', 'buff', 'debuff', 'state_flag', 'reveal'],
    MAGIC_RESOURCES: ['HP', 'STAMINA', 'MANA'],
    MAGIC_PROTECTION_RESPONSES: ['block', 'reduce_50', 'reduce_25', 'ignore'],
    MAGIC_VFX_EMITTERS: ['effect_prim', 'projectile', 'world', 'moap'],

    _magicRoot() {
        return db.collection('feud4').doc('magic');
    },

    _magicCol(collectionName) {
        return this._magicRoot().collection(collectionName);
    },

    normalizeMagicSlug(raw) {
        let s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
        s = s.replace(/[^a-z0-9_]/g, '');
        while (s.indexOf('__') !== -1) {
            s = s.split('__').join('_');
        }
        if (s.charAt(0) === '_') s = s.substring(1);
        if (s && s.charAt(s.length - 1) === '_') s = s.substring(0, s.length - 1);
        return s;
    },

    async ensureMagicParent() {
        const ref = this._magicRoot();
        const snap = await ref.get();
        if (!snap.exists) {
            await ref.set({
                schemaVersion: 1,
                notes: 'Feudalism magic CMS registry',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        return { success: true };
    },

    resolveUniverseMagic(universe) {
        const u = universe || {};
        let enabled;
        if (u.magic && typeof u.magic.enabled === 'boolean') {
            enabled = u.magic.enabled;
        } else {
            enabled = u.manaEnabled !== false;
        }
        let allowedDomains = null;
        if (u.magic && Array.isArray(u.magic.allowedDomains)) {
            allowedDomains = u.magic.allowedDomains.slice();
        }
        const domainAliases = (u.magic && u.magic.domainAliases && typeof u.magic.domainAliases === 'object')
            ? Object.assign({}, u.magic.domainAliases)
            : {};
        return {
            enabled: !!enabled,
            allowedDomains: allowedDomains,
            domainAliases: domainAliases
        };
    },

    async getUniverseMagic(universeId) {
        try {
            const result = await this.getUniverse(universeId);
            if (!result.success) return result;
            return {
                success: true,
                data: {
                    magic: this.resolveUniverseMagic(result.data.universe),
                    universe: result.data.universe
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async updateUniverseMagic(universeId, magic) {
        try {
            const enabled = !!(magic && magic.enabled);
            const payload = {
                enabled: enabled,
                allowedDomains: Array.isArray(magic && magic.allowedDomains)
                    ? magic.allowedDomains.map((d) => this.normalizeMagicSlug(d)).filter(Boolean)
                    : [],
                domainAliases: (magic && magic.domainAliases && typeof magic.domainAliases === 'object')
                    ? magic.domainAliases
                    : {}
            };
            return await this.updateUniverse(universeId, {
                magic: payload,
                manaEnabled: enabled
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    normalizeMagicCatalogDoc(collectionName, id, data) {
        const d = data || {};
        const base = {
            id: id,
            name: d.name || id,
            description: d.description || '',
            disabled: !!d.disabled,
            sortOrder: d.sortOrder != null ? Number(d.sortOrder) : 100,
            createdAt: d.createdAt || null,
            updatedAt: d.updatedAt || null
        };
        if (collectionName === 'domains') {
            return Object.assign(base, {
                aliases: Array.isArray(d.aliases) ? d.aliases : [],
                color: d.color || '',
                icon: d.icon || ''
            });
        }
        if (collectionName === 'kinds') {
            return Object.assign(base, {
                menuGroup: d.menuGroup || ''
            });
        }
        if (collectionName === 'runes') {
            return Object.assign(base, {
                meaning: d.meaning || '',
                textureUuid: d.textureUuid || '',
                tags: Array.isArray(d.tags) ? d.tags : [],
                domainNotes: (d.domainNotes && typeof d.domainNotes === 'object') ? d.domainNotes : {}
            });
        }
        if (collectionName === 'visualEffects') {
            return Object.assign(base, {
                emitter: d.emitter || 'effect_prim',
                durationSec: d.durationSec != null ? Number(d.durationSec) : 0,
                followAvatar: d.followAvatar !== false,
                notes: d.notes || ''
            });
        }
        if (collectionName === 'damageTypes') {
            return Object.assign(base, {
                resistedBy: Array.isArray(d.resistedBy) ? d.resistedBy : [],
                dotDefaultVfxId: d.dotDefaultVfxId || d.dotDefaultVfx || ''
            });
        }
        return base;
    },

    buildMagicCatalogDocument(collectionName, data, id) {
        const slug = this.normalizeMagicSlug(id || data.id || data.name);
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const doc = {
            id: slug,
            name: (data.name || slug).trim(),
            description: data.description || '',
            disabled: !!data.disabled,
            sortOrder: data.sortOrder != null ? Number(data.sortOrder) : 100,
            updatedAt: now
        };
        if (!data._skipCreatedAt) {
            doc.createdAt = data.createdAt || now;
        }
        if (collectionName === 'domains') {
            doc.aliases = Array.isArray(data.aliases) ? data.aliases : [];
            doc.color = data.color || '';
            doc.icon = data.icon || '';
        } else if (collectionName === 'kinds') {
            doc.menuGroup = data.menuGroup || '';
        } else if (collectionName === 'runes') {
            doc.meaning = data.meaning || '';
            doc.textureUuid = data.textureUuid || '';
            doc.tags = Array.isArray(data.tags) ? data.tags : [];
            doc.domainNotes = (data.domainNotes && typeof data.domainNotes === 'object')
                ? data.domainNotes
                : {};
        } else if (collectionName === 'visualEffects') {
            doc.emitter = data.emitter || 'effect_prim';
            doc.durationSec = data.durationSec != null ? Number(data.durationSec) : 0;
            doc.followAvatar = data.followAvatar !== false;
            doc.notes = data.notes || '';
        } else if (collectionName === 'damageTypes') {
            doc.resistedBy = Array.isArray(data.resistedBy) ? data.resistedBy : [];
            doc.dotDefaultVfxId = data.dotDefaultVfxId || '';
        }
        return doc;
    },

    defaultSpellDocument() {
        return {
            domainId: 'universal',
            kindId: 'utility',
            cr: 1,
            isCantrip: false,
            manaCost: 0,
            staminaFatigue: 0,
            componentsCast: [],
            componentsBind: [],
            tags: [],
            disabled: false,
            schemaVersion: 1,
            contentVersion: 1,
            delivery: {
                timing: 'instant',
                delaySec: 0,
                trigger: { mode: 'none', proximityMeters: 0, armingDelaySec: 0 },
                target: {
                    mode: 'self',
                    origin: 'caster',
                    radiusMeters: 0,
                    maxTargets: 1,
                    includeCaster: true,
                    requiresLos: false
                },
                projectile: { enabled: false, rezObject: '', speed: 0, arc: false }
            },
            effects: [],
            presentation: {
                castVfxId: '',
                impactVfxId: '',
                projectileVfxId: '',
                audio: { castSound: '', impactSound: '', loopSound: '' },
                runeIds: [],
                runeDisplay: false
            },
            binding: {
                wand: false,
                staff: false,
                scroll: true,
                objectEnchant: false,
                armor: false,
                weapon: false
            },
            detection: { examine: '', magesight: '', assay: '' },
            counters: {
                dispellable: true,
                dispelCr: 0,
                dispelRisk: '',
                protectionDefault: 'ignore',
                protectionByWard: {}
            },
            compiledPayload: ''
        };
    },

    normalizeSpellDocument(id, raw) {
        const d = Object.assign({}, this.defaultSpellDocument(), raw || {});
        const delivery = Object.assign({}, this.defaultSpellDocument().delivery, d.delivery || {});
        delivery.trigger = Object.assign({}, this.defaultSpellDocument().delivery.trigger, (d.delivery && d.delivery.trigger) || {});
        delivery.target = Object.assign({}, this.defaultSpellDocument().delivery.target, (d.delivery && d.delivery.target) || {});
        delivery.projectile = Object.assign({}, this.defaultSpellDocument().delivery.projectile, (d.delivery && d.delivery.projectile) || {});
        const presentation = Object.assign({}, this.defaultSpellDocument().presentation, d.presentation || {});
        presentation.audio = Object.assign({}, this.defaultSpellDocument().presentation.audio, (d.presentation && d.presentation.audio) || {});
        const binding = Object.assign({}, this.defaultSpellDocument().binding, d.binding || {});
        const detection = Object.assign({}, this.defaultSpellDocument().detection, d.detection || {});
        const counters = Object.assign({}, this.defaultSpellDocument().counters, d.counters || {});
        if (d.counters && d.counters.protection && !d.counters.protectionDefault) {
            counters.protectionDefault = d.counters.protection.default || counters.protectionDefault;
            counters.protectionByWard = d.counters.protection.byWard || counters.protectionByWard || {};
        }
        return {
            id: id,
            name: d.name || id,
            summary: d.summary || '',
            description: d.description || '',
            domainId: d.domainId || 'universal',
            kindId: d.kindId || 'utility',
            cr: d.cr != null ? Number(d.cr) : 1,
            isCantrip: !!d.isCantrip,
            tags: Array.isArray(d.tags) ? d.tags : [],
            disabled: !!d.disabled,
            schemaVersion: d.schemaVersion != null ? Number(d.schemaVersion) : 1,
            contentVersion: d.contentVersion != null ? Number(d.contentVersion) : 1,
            manaCost: d.manaCost != null ? Number(d.manaCost) : 0,
            staminaFatigue: d.staminaFatigue != null ? Number(d.staminaFatigue) : 0,
            componentsCast: Array.isArray(d.componentsCast) ? d.componentsCast : [],
            componentsBind: Array.isArray(d.componentsBind) ? d.componentsBind : [],
            delivery: delivery,
            effects: Array.isArray(d.effects) ? d.effects : [],
            presentation: presentation,
            binding: binding,
            detection: detection,
            counters: counters,
            compiledPayload: d.compiledPayload || '',
            createdAt: d.createdAt || null,
            updatedAt: d.updatedAt || null
        };
    },

    buildSpellDocument(data, id) {
        const slug = this.normalizeMagicSlug(id || data.id || data.name);
        const normalized = this.normalizeSpellDocument(slug, data);
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const contentVersion = data.contentVersion != null
            ? Number(data.contentVersion)
            : (normalized.contentVersion || 1);
        return {
            id: slug,
            name: normalized.name,
            summary: normalized.summary,
            description: normalized.description,
            domainId: this.normalizeMagicSlug(normalized.domainId),
            kindId: this.normalizeMagicSlug(normalized.kindId),
            cr: Number(normalized.cr) || 1,
            isCantrip: !!normalized.isCantrip,
            tags: normalized.tags,
            disabled: !!normalized.disabled,
            schemaVersion: 1,
            contentVersion: contentVersion,
            manaCost: Number(normalized.manaCost) || 0,
            staminaFatigue: Number(normalized.staminaFatigue) || 0,
            componentsCast: normalized.componentsCast,
            componentsBind: normalized.componentsBind,
            delivery: normalized.delivery,
            effects: normalized.effects,
            presentation: normalized.presentation,
            binding: normalized.binding,
            detection: normalized.detection,
            counters: normalized.counters,
            compiledPayload: normalized.compiledPayload || '',
            createdAt: data.createdAt || now,
            updatedAt: now
        };
    },

    async getMagicCatalog(collectionName) {
        try {
            if (this.MAGIC_CATALOGS.indexOf(collectionName) === -1) {
                return { success: false, error: 'Unknown magic catalog: ' + collectionName };
            }
            const snapshot = await this._magicCol(collectionName).get();
            const items = [];
            snapshot.forEach((doc) => {
                if (collectionName === 'spells') {
                    items.push(this.normalizeSpellDocument(doc.id, doc.data()));
                } else {
                    items.push(this.normalizeMagicCatalogDoc(collectionName, doc.id, doc.data()));
                }
            });
            items.sort((a, b) => {
                const so = (a.sortOrder || 100) - (b.sortOrder || 100);
                if (so !== 0) return so;
                return String(a.name || a.id).localeCompare(String(b.name || b.id));
            });
            return { success: true, data: { items: items, collection: collectionName } };
        } catch (error) {
            console.error('[getMagicCatalog]', collectionName, error);
            return { success: false, error: error.message };
        }
    },

    async getSpells() {
        const result = await this.getMagicCatalog('spells');
        if (!result.success) return result;
        return { success: true, data: { spells: result.data.items } };
    },

    async getSpell(spellId) {
        try {
            const id = this.normalizeMagicSlug(spellId);
            const snap = await this._magicCol('spells').doc(id).get();
            if (!snap.exists) {
                return { success: false, error: 'Spell not found' };
            }
            return { success: true, data: { spell: this.normalizeSpellDocument(snap.id, snap.data()) } };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async createMagicDoc(collectionName, data) {
        try {
            if (this.MAGIC_CATALOGS.indexOf(collectionName) === -1) {
                return { success: false, error: 'Unknown magic catalog: ' + collectionName };
            }
            await this.ensureMagicParent();
            if (collectionName === 'spells') {
                return await this.createSpell(data);
            }
            const slug = this.normalizeMagicSlug(data.id || data.slug || data.name);
            if (!slug) {
                return { success: false, error: 'Valid id/slug required' };
            }
            const existing = await this._magicCol(collectionName).doc(slug).get();
            if (existing.exists) {
                return { success: false, error: 'Document already exists: ' + slug };
            }
            const doc = this.buildMagicCatalogDocument(collectionName, data, slug);
            await this._magicCol(collectionName).doc(slug).set(doc);
            return { success: true, data: { id: slug, item: this.normalizeMagicCatalogDoc(collectionName, slug, doc) } };
        } catch (error) {
            console.error('[createMagicDoc]', collectionName, error);
            return { success: false, error: error.message };
        }
    },

    async updateMagicDoc(collectionName, id, data) {
        try {
            if (this.MAGIC_CATALOGS.indexOf(collectionName) === -1) {
                return { success: false, error: 'Unknown magic catalog: ' + collectionName };
            }
            if (collectionName === 'spells') {
                return await this.updateSpell(id, data);
            }
            const slug = this.normalizeMagicSlug(id);
            const updateData = Object.assign({}, this.buildMagicCatalogDocument(collectionName, Object.assign({}, data, { id: slug }), slug));
            delete updateData.createdAt;
            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await this._magicCol(collectionName).doc(slug).set(updateData, { merge: true });
            return { success: true };
        } catch (error) {
            console.error('[updateMagicDoc]', collectionName, error);
            return { success: false, error: error.message };
        }
    },

    async deleteMagicDoc(collectionName, id) {
        try {
            const slug = this.normalizeMagicSlug(id);
            await this._magicCol(collectionName).doc(slug).delete();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async setMagicDisabled(collectionName, id, disabled) {
        return await this.updateMagicDoc(collectionName, id, { disabled: !!disabled });
    },

    async createSpell(spellData) {
        try {
            await this.ensureMagicParent();
            const slug = this.normalizeMagicSlug(spellData.id || spellData.slug || spellData.name);
            if (!slug) {
                return { success: false, error: 'Valid spell id required' };
            }
            const existing = await this._magicCol('spells').doc(slug).get();
            if (existing.exists) {
                return { success: false, error: 'Spell already exists: ' + slug };
            }
            const doc = this.buildSpellDocument(Object.assign({}, spellData, { contentVersion: 1 }), slug);
            await this._magicCol('spells').doc(slug).set(doc);
            return { success: true, data: { id: slug, spell: this.normalizeSpellDocument(slug, doc) } };
        } catch (error) {
            console.error('[createSpell]', error);
            return { success: false, error: error.message };
        }
    },

    async updateSpell(spellId, spellData) {
        try {
            const slug = this.normalizeMagicSlug(spellId);
            const current = await this._magicCol('spells').doc(slug).get();
            if (!current.exists) {
                return { success: false, error: 'Spell not found' };
            }
            const prev = current.data() || {};
            const nextVersion = (prev.contentVersion != null ? Number(prev.contentVersion) : 1) + 1;
            const merged = Object.assign({}, prev, spellData, {
                id: slug,
                contentVersion: nextVersion,
                createdAt: prev.createdAt || firebase.firestore.FieldValue.serverTimestamp()
            });
            const doc = this.buildSpellDocument(merged, slug);
            await this._magicCol('spells').doc(slug).set(doc);
            return { success: true, data: { id: slug, spell: this.normalizeSpellDocument(slug, doc) } };
        } catch (error) {
            console.error('[updateSpell]', error);
            return { success: false, error: error.message };
        }
    },

    async deleteSpell(spellId) {
        return await this.deleteMagicDoc('spells', spellId);
    },

    _magicSeedPayload() {
        const domains = [
            { id: 'universal', name: 'Universal', sortOrder: 0, description: 'Utilities and cantrips usable wherever magic is on.', color: '#8899aa' },
            { id: 'elemental', name: 'Elemental', sortOrder: 10, description: 'Fire, water, air, earth expressions of power.', color: '#c45c26' },
            { id: 'divine', name: 'Divine', sortOrder: 20, description: 'Faith, deities, or pure intent-as-action.', color: '#c9a227' },
            { id: 'green', name: 'Green', sortOrder: 30, description: 'Growth, beasts, vitality.', color: '#3d8b4a' },
            { id: 'shadow', name: 'Shadow', sortOrder: 40, description: 'Concealment, fear, umbral power.', color: '#4a3a5c' },
            { id: 'enchantment', name: 'Enchantment', sortOrder: 50, description: 'Binding spells into objects and matrices.', color: '#6b5b95' },
            { id: 'war', name: 'War', sortOrder: 60, description: 'Battlefield force, disruption, tactics.', color: '#8b2e2e' },
            { id: 'mental', name: 'Mental', sortOrder: 70, description: 'Charm, confusion, telepathy-lite.', color: '#5b7c99' }
        ];
        const kinds = [
            { id: 'utility', name: 'Utility', menuGroup: 'Utility', sortOrder: 10 },
            { id: 'damage', name: 'Damage', menuGroup: 'Combat', sortOrder: 20 },
            { id: 'healing', name: 'Healing', menuGroup: 'Support', sortOrder: 30 },
            { id: 'augmentation', name: 'Augmentation', menuGroup: 'Support', sortOrder: 40 },
            { id: 'curse', name: 'Curse', menuGroup: 'Combat', sortOrder: 50 },
            { id: 'ward', name: 'Ward', menuGroup: 'Support', sortOrder: 60 },
            { id: 'illusion', name: 'Illusion', menuGroup: 'Utility', sortOrder: 70 },
            { id: 'augury', name: 'Augury', menuGroup: 'Utility', sortOrder: 80, description: 'Divination, detection, assay, foresight.' },
            { id: 'enchantment', name: 'Enchantment', menuGroup: 'Craft', sortOrder: 90 },
            { id: 'summoning', name: 'Summoning', menuGroup: 'Advanced', sortOrder: 100 },
            { id: 'transmutation', name: 'Transmutation', menuGroup: 'Advanced', sortOrder: 110 }
        ];
        const damageTypes = [
            { id: 'fire', name: 'Fire', resistedBy: ['ward_fire', 'ward_elemental'], dotDefaultVfxId: 'PARTICLE_FLAME_WRAP' },
            { id: 'kinetic', name: 'Kinetic', resistedBy: ['ward_kinetic'], dotDefaultVfxId: '' },
            { id: 'arcane', name: 'Arcane', resistedBy: ['ward_universal'], dotDefaultVfxId: '' },
            { id: 'poison', name: 'Poison', resistedBy: ['ward_poison'], dotDefaultVfxId: 'PARTICLE_TOXIC_HAZE' },
            { id: 'holy', name: 'Holy', resistedBy: ['ward_divine'], dotDefaultVfxId: '' },
            { id: 'shadow', name: 'Shadow', resistedBy: ['ward_shadow'], dotDefaultVfxId: '' }
        ];
        const visualEffects = [
            { id: 'PARTICLE_SHOCKWAVE', name: 'Shockwave Ring', emitter: 'effect_prim', durationSec: 2, notes: 'Concussive ring' },
            { id: 'PARTICLE_SPARK_IMPACT', name: 'Spark Impact', emitter: 'effect_prim', durationSec: 1, notes: 'Kinetic spark burst' },
            { id: 'PARTICLE_TOXIC_HAZE', name: 'Toxic Haze', emitter: 'effect_prim', durationSec: 4, notes: 'Nausea / poison haze' },
            { id: 'PARTICLE_FLAME_WRAP', name: 'Flame Wrap', emitter: 'effect_prim', durationSec: 3, notes: 'Dense flame envelope' },
            { id: 'PARTICLE_CASTER_FLAME_BURST', name: 'Caster Flame Burst', emitter: 'effect_prim', durationSec: 1.5, notes: 'Caster cast flourish' },
            { id: 'PARTICLE_FIREBALL', name: 'Fireball Projectile', emitter: 'projectile', durationSec: 0, notes: 'Projectile trail' },
            { id: 'PARTICLE_FIREBALL_DETONATE', name: 'Fireball Detonate', emitter: 'world', durationSec: 2, notes: 'Impact detonation' },
            { id: 'PARTICLE_MAGE_LIGHT', name: 'Mage Light', emitter: 'world', durationSec: 0, notes: 'Hovering light object FX' }
        ];
        const runes = [
            { id: 'eos', name: 'Eos', meaning: 'Light', tags: ['light', 'reveal'], domainNotes: { elemental: 'Photomantic focus', divine: 'Revelation' } },
            { id: 'bela', name: 'Bela', meaning: 'Binding', tags: ['bind', 'enchant'], domainNotes: { enchantment: 'Matrix anchor' } },
            { id: 'selan', name: 'Selan', meaning: 'Release', tags: ['release', 'dispel'], domainNotes: { universal: 'Unweave' } }
        ];
        const spells = [
            {
                id: 'mage_light',
                name: 'Mage Light',
                summary: 'Conjure a hovering light.',
                description: 'A simple luminous construct that brightens the area around the caster.',
                domainId: 'universal',
                kindId: 'utility',
                cr: 1,
                isCantrip: true,
                tags: ['light', 'utility'],
                manaCost: 5,
                effects: [{ type: 'rez', rezObject: 'F4 Spell - Mage Light', durationSec: 300 }],
                presentation: {
                    castVfxId: 'PARTICLE_MAGE_LIGHT',
                    impactVfxId: '',
                    projectileVfxId: '',
                    audio: { castSound: '', impactSound: '', loopSound: '' },
                    runeIds: ['eos'],
                    runeDisplay: true
                },
                binding: { wand: true, staff: true, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A minor light-working.',
                    magesight: 'Simple luminous weave; utility, non-hostile.',
                    assay: 'Mage Light — Universal utility; creates a light object.'
                },
                counters: { dispellable: true, dispelCr: 2, dispelRisk: '', protectionDefault: 'ignore', protectionByWard: {} }
            },
            {
                id: 'concussive_blast',
                name: 'Concussive Blast',
                summary: 'A short-range kinetic shockwave.',
                description: 'Force blooms outward from the caster in a brutal pulse.',
                domainId: 'war',
                kindId: 'damage',
                cr: 4,
                tags: ['kinetic', 'aoe'],
                manaCost: 20,
                delivery: {
                    timing: 'instant',
                    delaySec: 0,
                    trigger: { mode: 'none', proximityMeters: 0, armingDelaySec: 0 },
                    target: { mode: 'caster_aoe', origin: 'caster', radiusMeters: 5, maxTargets: 8, includeCaster: false, requiresLos: false },
                    projectile: { enabled: false, rezObject: '', speed: 0, arc: false }
                },
                effects: [
                    { type: 'damage', resource: 'HP', amount: 25, damageTypeId: 'kinetic', repeat: { enabled: false, ticks: 0, intervalSec: 0, amount: 0, vfxId: '', vfxScale: 1 } },
                    { type: 'animation', anim: 'Fall Down', durationSec: 3 }
                ],
                presentation: {
                    castVfxId: 'PARTICLE_SHOCKWAVE',
                    impactVfxId: 'PARTICLE_SHOCKWAVE',
                    projectileVfxId: '',
                    audio: { castSound: '', impactSound: '', loopSound: '' },
                    runeIds: [],
                    runeDisplay: false
                },
                binding: { wand: true, staff: true, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A spell of raw force.',
                    magesight: 'Compressed kinetic weave; burst-pattern from caster.',
                    assay: 'Concussive Blast — War damage; caster AoE; knocks prone.'
                },
                compiledPayload: 'CONCUSSIVE_BLAST|25|HP|Fall Down|PARTICLE_SHOCKWAVE'
            },
            {
                id: 'kinetic_strike',
                name: 'Kinetic Strike',
                summary: 'A focused bolt of force.',
                description: 'A tight spear of kinetic energy that impacts a single target.',
                domainId: 'war',
                kindId: 'damage',
                cr: 3,
                tags: ['kinetic', 'projectile'],
                manaCost: 12,
                delivery: {
                    timing: 'instant',
                    delaySec: 0,
                    trigger: { mode: 'none', proximityMeters: 0, armingDelaySec: 0 },
                    target: { mode: 'targeted', origin: 'target', radiusMeters: 0, maxTargets: 1, includeCaster: false, requiresLos: true },
                    projectile: { enabled: true, rezObject: 'F4 Spell Projectile - Kinetic', speed: 20, arc: false }
                },
                effects: [
                    { type: 'damage', resource: 'HP', amount: 15, damageTypeId: 'kinetic', repeat: { enabled: false, ticks: 0, intervalSec: 0, amount: 0, vfxId: '', vfxScale: 1 } }
                ],
                presentation: {
                    castVfxId: '',
                    impactVfxId: 'PARTICLE_SPARK_IMPACT',
                    projectileVfxId: 'PARTICLE_SPARK_IMPACT',
                    audio: { castSound: '', impactSound: '', loopSound: '' },
                    runeIds: [],
                    runeDisplay: false
                },
                binding: { wand: true, staff: true, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A piercing force cantrip-like working.',
                    magesight: 'Linear kinetic lance; single-target.',
                    assay: 'Kinetic Strike — War damage; projectile; single target.'
                },
                compiledPayload: 'KINETIC_STRIKE|15|HP|NONE|PARTICLE_SPARK_IMPACT'
            },
            {
                id: 'nausea_curse',
                name: 'Nausea Curse',
                summary: 'Sicken a target, draining stamina.',
                description: 'A mental/corporeal curse that floods the target with nausea.',
                domainId: 'mental',
                kindId: 'curse',
                cr: 5,
                tags: ['curse', 'stamina'],
                manaCost: 18,
                delivery: {
                    timing: 'instant',
                    delaySec: 0,
                    trigger: { mode: 'none', proximityMeters: 0, armingDelaySec: 0 },
                    target: { mode: 'targeted', origin: 'target', radiusMeters: 0, maxTargets: 1, includeCaster: false, requiresLos: true },
                    projectile: { enabled: false, rezObject: '', speed: 0, arc: false }
                },
                effects: [
                    { type: 'resource', resource: 'STAMINA', amount: -40, damageTypeId: 'poison', repeat: { enabled: false, ticks: 0, intervalSec: 0, amount: 0, vfxId: '', vfxScale: 1 } },
                    { type: 'animation', anim: 'Vomiting', durationSec: 4 }
                ],
                presentation: {
                    castVfxId: '',
                    impactVfxId: 'PARTICLE_TOXIC_HAZE',
                    projectileVfxId: '',
                    audio: { castSound: '', impactSound: '', loopSound: '' },
                    runeIds: [],
                    runeDisplay: false
                },
                binding: { wand: true, staff: false, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A spiteful sickness-working.',
                    magesight: 'Twisted mental-corporeal weave; fatigue-oriented.',
                    assay: 'Nausea Curse — Mental curse; drains stamina; vomiting.'
                },
                compiledPayload: 'NAUSEA_CURSE|40|STAMINA|Vomiting|PARTICLE_TOXIC_HAZE'
            },
            {
                id: 'fire_engulf',
                name: 'Fire Engulf',
                summary: 'Wrap a target in clinging flame.',
                description: 'Immediate burns followed by lingering fire damage.',
                domainId: 'elemental',
                kindId: 'damage',
                cr: 6,
                tags: ['fire', 'dot'],
                manaCost: 28,
                delivery: {
                    timing: 'instant',
                    delaySec: 0,
                    trigger: { mode: 'none', proximityMeters: 0, armingDelaySec: 0 },
                    target: { mode: 'targeted', origin: 'target', radiusMeters: 0, maxTargets: 1, includeCaster: false, requiresLos: true },
                    projectile: { enabled: false, rezObject: '', speed: 0, arc: false }
                },
                effects: [
                    {
                        type: 'damage',
                        resource: 'HP',
                        amount: 30,
                        damageTypeId: 'fire',
                        repeat: { enabled: true, ticks: 3, intervalSec: 3, amount: 6, vfxId: 'PARTICLE_FLAME_WRAP', vfxScale: 0.4 }
                    },
                    { type: 'animation', anim: 'Burn_Agony', durationSec: 2 }
                ],
                presentation: {
                    castVfxId: 'PARTICLE_CASTER_FLAME_BURST',
                    impactVfxId: 'PARTICLE_FLAME_WRAP',
                    projectileVfxId: '',
                    audio: { castSound: '', impactSound: '', loopSound: '' },
                    runeIds: ['eos'],
                    runeDisplay: true
                },
                binding: { wand: true, staff: true, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A spell of clinging flame.',
                    magesight: 'Thermic weave designed to linger on flesh.',
                    assay: 'Fire Engulf — Elemental damage; DoT flame wrap.'
                },
                counters: {
                    dispellable: false,
                    dispelCr: 0,
                    dispelRisk: '',
                    protectionDefault: 'reduce_50',
                    protectionByWard: { ward_fire: 'block', ward_elemental: 'reduce_50' }
                },
                compiledPayload: 'FIRE_ENGULF|30|HP_DOT|Burn_Agony|PARTICLE_FLAME_WRAP'
            },
            {
                id: 'magesight',
                name: 'Magesight',
                summary: 'Perceive magical weaves.',
                description: 'Reveals the presence and general nature of magic on people and objects.',
                domainId: 'universal',
                kindId: 'augury',
                cr: 2,
                isCantrip: true,
                tags: ['augury', 'detect'],
                manaCost: 4,
                effects: [{ type: 'reveal', revealTier: 'magesight' }],
                binding: { wand: false, staff: true, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A sensing cantrip.',
                    magesight: 'Meta — this is the sight itself.',
                    assay: 'Magesight — Universal augury; unlocks magesight detection tier.'
                }
            },
            {
                id: 'assay_spell',
                name: 'Assay Spell',
                summary: 'Analyze a magical weave in detail.',
                description: 'Thaumaturgical analysis that identifies spell identity, domain, kind, and dispel notes.',
                domainId: 'universal',
                kindId: 'augury',
                cr: 4,
                tags: ['augury', 'assay'],
                manaCost: 10,
                effects: [{ type: 'reveal', revealTier: 'assay' }],
                binding: { wand: false, staff: true, scroll: true, objectEnchant: false, armor: false, weapon: false },
                detection: {
                    examine: 'A scholarly analysis working.',
                    magesight: 'Precision sensing lattice.',
                    assay: 'Assay Spell — Universal augury; unlocks assay detection tier.'
                }
            },
            {
                id: 'fire_trap',
                name: 'Fire Trap',
                summary: 'Enchant an object to burn a toucher.',
                description: 'A waiting thermic weave bound to a latch, lid, or surface. Triggers on touch.',
                domainId: 'elemental',
                kindId: 'enchantment',
                cr: 7,
                tags: ['trap', 'fire', 'object'],
                manaCost: 0,
                componentsBind: [{ itemSlug: 'sulfur_pinch', qty: 2 }, { itemSlug: 'fire_oil', qty: 1 }],
                delivery: {
                    timing: 'instant',
                    delaySec: 0,
                    trigger: { mode: 'touch', proximityMeters: 0, armingDelaySec: 2 },
                    target: { mode: 'object', origin: 'object', radiusMeters: 1.5, maxTargets: 1, includeCaster: false, requiresLos: false },
                    projectile: { enabled: false, rezObject: '', speed: 0, arc: false }
                },
                effects: [
                    { type: 'damage', resource: 'HP', amount: 20, damageTypeId: 'fire', repeat: { enabled: true, ticks: 2, intervalSec: 2, amount: 5, vfxId: 'PARTICLE_FLAME_WRAP', vfxScale: 0.35 } }
                ],
                presentation: {
                    castVfxId: '',
                    impactVfxId: 'PARTICLE_FLAME_WRAP',
                    projectileVfxId: '',
                    audio: { castSound: '', impactSound: '', loopSound: '' },
                    runeIds: ['bela', 'eos'],
                    runeDisplay: true
                },
                binding: { wand: false, staff: false, scroll: false, objectEnchant: true, armor: false, weapon: false },
                detection: {
                    examine: 'The object looks ordinary, though the fittings are carefully made.',
                    magesight: 'A taut weave of heat and intent clings to the contact surface — a waiting spell, aggressive in nature.',
                    assay: 'Fire Trap — Elemental enchantment; trigger: touch; moderate potency; dispelling possible but risky.'
                },
                counters: {
                    dispellable: true,
                    dispelCr: 10,
                    dispelRisk: 'backlash_half',
                    protectionDefault: 'reduce_50',
                    protectionByWard: { ward_fire: 'block' }
                }
            }
        ];
        return { domains: domains, kinds: kinds, damageTypes: damageTypes, visualEffects: visualEffects, runes: runes, spells: spells };
    },

    async seedMagicDefaults(options) {
        const opts = options || {};
        const overwrite = !!opts.overwrite;
        try {
            await this.ensureMagicParent();
            await this._magicRoot().set({
                schemaVersion: 1,
                notes: 'Feudalism magic CMS registry',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            const seed = this._magicSeedPayload();
            const summary = { created: 0, skipped: 0, updated: 0, errors: [] };

            async function writeFlat(self, collectionName, rows) {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const id = self.normalizeMagicSlug(row.id);
                    const ref = self._magicCol(collectionName).doc(id);
                    const snap = await ref.get();
                    if (snap.exists && !overwrite) {
                        summary.skipped++;
                        continue;
                    }
                    const doc = self.buildMagicCatalogDocument(collectionName, Object.assign({}, row, { disabled: false }), id);
                    if (snap.exists) {
                        delete doc.createdAt;
                        doc.createdAt = snap.data().createdAt || firebase.firestore.FieldValue.serverTimestamp();
                        await ref.set(doc, { merge: true });
                        summary.updated++;
                    } else {
                        await ref.set(doc);
                        summary.created++;
                    }
                }
            }

            await writeFlat(this, 'domains', seed.domains);
            await writeFlat(this, 'kinds', seed.kinds);
            await writeFlat(this, 'damageTypes', seed.damageTypes);
            await writeFlat(this, 'visualEffects', seed.visualEffects);
            await writeFlat(this, 'runes', seed.runes);

            for (let i = 0; i < seed.spells.length; i++) {
                const row = seed.spells[i];
                const id = this.normalizeMagicSlug(row.id);
                const ref = this._magicCol('spells').doc(id);
                const snap = await ref.get();
                if (snap.exists && !overwrite) {
                    summary.skipped++;
                    continue;
                }
                const base = snap.exists ? Object.assign({}, snap.data(), row) : row;
                if (snap.exists && overwrite) {
                    base.contentVersion = (snap.data().contentVersion || 1) + 1;
                    base.createdAt = snap.data().createdAt;
                } else {
                    base.contentVersion = 1;
                }
                const doc = this.buildSpellDocument(base, id);
                await ref.set(doc);
                if (snap.exists) summary.updated++;
                else summary.created++;
            }

            return { success: true, data: summary };
        } catch (error) {
            console.error('[seedMagicDefaults]', error);
            return { success: false, error: error.message };
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    API.init();
});

