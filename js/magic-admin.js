// ============================================================================
// Feudalism 4 — Magic CMS Admin UI (P1)
// Extends App after load. Contract: Magic CMS Firestore Schema.md
// ============================================================================

(function () {
    'use strict';

    function esc(v) {
        if (typeof UI !== 'undefined' && UI.escapeHtml) {
            return UI.escapeHtml(String(v == null ? '' : v));
        }
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function catalogTitle(name) {
        const map = {
            domains: 'Domains',
            kinds: 'Kinds',
            damageTypes: 'Damage Types',
            visualEffects: 'Visual Effects',
            runes: 'Runes',
            spells: 'Spells'
        };
        return map[name] || name;
    }

    function downloadText(filename, text, mime) {
        const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function parseCsv(text) {
        const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
            .filter((l) => l.trim() !== '');
        if (!lines.length) return { headers: [], rows: [] };
        const headers = splitCsvLine(lines[0]);
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const fields = splitCsvLine(lines[i]);
            const obj = {};
            for (let h = 0; h < headers.length; h++) {
                obj[headers[h]] = fields[h] != null ? fields[h] : '';
            }
            rows.push(obj);
        }
        return { headers: headers, rows: rows };
    }

    function splitCsvLine(line) {
        const out = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line.charAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (line.charAt(i + 1) === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                out.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur);
        return out;
    }

    function csvEscape(val) {
        const str = String(val == null ? '' : val);
        if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    const MagicAdmin = {
        _magicTab: 'spells',

        async showMagicManagement(tabName) {
            const adminContent = UI.elements.adminContent;
            if (!adminContent) return;
            this._magicTab = tabName || this._magicTab || 'spells';
            UI.showLoading(adminContent, 'Loading Magic CMS...');

            const tabs = [
                ['spells', 'Spells'],
                ['domains', 'Domains'],
                ['kinds', 'Kinds'],
                ['damageTypes', 'Damage Types'],
                ['visualEffects', 'Visual Effects'],
                ['runes', 'Runes']
            ];

            let tabHtml = tabs.map(([id, label]) => {
                const active = this._magicTab === id;
                return `<button class="btn ${active ? 'btn-primary' : 'btn-secondary'}" data-magic-tab="${id}" style="margin: 0;">${label}</button>`;
            }).join(' ');

            let body = '';
            try {
                if (this._magicTab === 'spells') {
                    body = await this._renderMagicSpellsPanel();
                } else {
                    body = await this._renderMagicFlatPanel(this._magicTab);
                }
            } catch (error) {
                body = `<p style="color: var(--error);">Error: ${esc(error.message)}</p>`;
            }

            adminContent.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); flex-wrap: wrap; gap: var(--space-sm);">
                    <h2 style="margin: 0;">Magic CMS</h2>
                    <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
                        <button class="btn btn-secondary" id="btn-magic-seed">🌱 Seed Defaults</button>
                    </div>
                </div>
                <p class="info-text" style="margin-bottom: var(--space-sm);">
                    Registry: <code>feud4/magic/{collection}/{id}</code>. Runtime play uses LSD cache later (lazy GET). Authoring only here.
                </p>
                <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-bottom: var(--space-md);">${tabHtml}</div>
                <div id="magic-cms-body">${body}</div>
            `;

            adminContent.querySelectorAll('[data-magic-tab]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    this.showMagicManagement(btn.getAttribute('data-magic-tab'));
                });
            });

            document.getElementById('btn-magic-seed')?.addEventListener('click', async () => {
                const confirmed = await UI.showConfirmDialog({
                    title: 'Seed magic defaults?',
                    message: 'Writes starter domains, kinds, damage types, VFX, runes, and seed spells. Existing ids are skipped.',
                    confirmLabel: 'Seed'
                });
                if (!confirmed) return;
                UI.showToast('Seeding Magic CMS…', 'info');
                const result = await API.seedMagicDefaults({ overwrite: false });
                if (result.success) {
                    const s = result.data || {};
                    UI.showToast(`Seeded — created ${s.created || 0}, updated ${s.updated || 0}, skipped ${s.skipped || 0}`, 'success');
                    this.showMagicManagement(this._magicTab);
                } else {
                    UI.showToast('Seed failed: ' + result.error, 'error');
                }
            });

            this._bindMagicPanelHandlers();
        },

        async _renderMagicFlatPanel(collectionName) {
            const result = await API.getMagicCatalog(collectionName);
            if (!result.success) {
                return `<p style="color: var(--error);">Failed to load: ${esc(result.error)}</p>`;
            }
            const items = result.data.items || [];
            this._magicCache = this._magicCache || {};
            this._magicCache[collectionName] = items;

            let rows = '';
            const isRunes = collectionName === 'runes';
            if (!items.length) {
                rows = `<tr><td colspan="${isRunes ? 6 : 5}" style="text-align:center;padding:var(--space-lg);color:var(--text-muted);">No ${esc(catalogTitle(collectionName))} yet. Seed defaults or create one.</td></tr>`;
            } else {
                items.forEach((item) => {
                    rows += `
                        <tr>
                            <td><code>${esc(item.id)}</code></td>
                            <td>${esc(item.name)}</td>
                            ${isRunes ? `<td>${esc(item.purpose || '')}</td>` : ''}
                            <td>${esc(item.sortOrder != null ? item.sortOrder : '')}</td>
                            <td>${item.disabled ? '<span style="color:var(--error);">Disabled</span>' : '<span style="color:var(--success);">Active</span>'}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" data-magic-action="edit" data-magic-id="${esc(item.id)}">Edit</button>
                                <button class="btn btn-sm ${item.disabled ? 'btn-success' : 'btn-warning'}" data-magic-action="toggle" data-magic-id="${esc(item.id)}">${item.disabled ? 'Enable' : 'Disable'}</button>
                                <button class="btn btn-sm btn-danger" data-magic-action="delete" data-magic-id="${esc(item.id)}">Delete</button>
                            </td>
                        </tr>`;
                });
            }

            return `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);flex-wrap:wrap;gap:var(--space-sm);">
                    <h3 style="margin:0;">${esc(catalogTitle(collectionName))}</h3>
                    <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
                        <button class="btn btn-secondary" id="btn-magic-export">📥 Export CSV</button>
                        <label class="btn btn-secondary" style="cursor:pointer;margin:0;">
                            📤 Import CSV
                            <input type="file" id="file-magic-import" accept=".csv,application/json" style="display:none;">
                        </label>
                        <button class="btn btn-primary" id="btn-magic-create">➕ Create</button>
                    </div>
                </div>
                <div class="admin-table-container" style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%;border-collapse:collapse;">
                        <thead><tr><th>ID</th><th>Name</th>${isRunes ? '<th>Purpose</th>' : ''}<th>Sort</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        },

        async _renderMagicSpellsPanel() {
            const result = await API.getSpells();
            if (!result.success) {
                return `<p style="color: var(--error);">Failed to load spells: ${esc(result.error)}</p>`;
            }
            const spells = result.data.spells || [];
            this._magicCache = this._magicCache || {};
            this._magicCache.spells = spells;

            let rows = '';
            if (!spells.length) {
                rows = `<tr><td colspan="8" style="text-align:center;padding:var(--space-lg);color:var(--text-muted);">No spells yet. Seed defaults or create one.</td></tr>`;
            } else {
                spells.forEach((sp) => {
                    rows += `
                        <tr>
                            <td>${esc(sp.name)}</td>
                            <td><code>${esc(sp.id)}</code></td>
                            <td>${esc(sp.domainId)}</td>
                            <td>${esc(sp.kindId)}</td>
                            <td>${esc(sp.cr)}</td>
                            <td>${esc(sp.manaCost)}</td>
                            <td>${sp.isCantrip ? 'Yes' : 'No'}</td>
                            <td>${sp.disabled ? '<span style="color:var(--error);">Disabled</span>' : '<span style="color:var(--success);">Active</span>'}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" data-magic-action="edit" data-magic-id="${esc(sp.id)}">Edit</button>
                                <button class="btn btn-sm ${sp.disabled ? 'btn-success' : 'btn-warning'}" data-magic-action="toggle" data-magic-id="${esc(sp.id)}">${sp.disabled ? 'Enable' : 'Disable'}</button>
                                <button class="btn btn-sm btn-danger" data-magic-action="delete" data-magic-id="${esc(sp.id)}">Delete</button>
                            </td>
                        </tr>`;
                });
            }

            return `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);flex-wrap:wrap;gap:var(--space-sm);">
                    <h3 style="margin:0;">Spells</h3>
                    <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
                        <button class="btn btn-secondary" id="btn-magic-export">📥 Export JSON</button>
                        <label class="btn btn-secondary" style="cursor:pointer;margin:0;">
                            📤 Import JSON
                            <input type="file" id="file-magic-import" accept="application/json,.json" style="display:none;">
                        </label>
                        <button class="btn btn-primary" id="btn-magic-create">➕ Create Spell</button>
                    </div>
                </div>
                <div class="admin-table-container" style="overflow-x:auto;">
                    <table class="admin-table" style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th>Name</th><th>ID</th><th>Domain</th><th>Kind</th><th>CR</th><th>Mana</th><th>Cantrip</th><th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        },

        _bindMagicPanelHandlers() {
            const collection = this._magicTab;
            document.getElementById('btn-magic-create')?.addEventListener('click', () => {
                if (collection === 'spells') this.showMagicSpellForm(null);
                else this.showMagicFlatForm(collection, null);
            });
            document.getElementById('btn-magic-export')?.addEventListener('click', () => {
                if (collection === 'spells') this.exportMagicSpellsJson();
                else this.exportMagicCatalogCsv(collection);
            });
            document.getElementById('file-magic-import')?.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (collection === 'spells') await this.importMagicSpellsJson(file);
                else await this.importMagicCatalogCsv(collection, file);
                e.target.value = '';
            });

            const body = document.getElementById('magic-cms-body');
            if (!body) return;
            body.querySelectorAll('[data-magic-action]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const action = btn.getAttribute('data-magic-action');
                    const id = btn.getAttribute('data-magic-id');
                    const items = (this._magicCache && this._magicCache[collection]) || [];
                    const item = items.find((x) => x.id === id);
                    if (action === 'edit') {
                        if (collection === 'spells') this.showMagicSpellForm(item || { id: id });
                        else this.showMagicFlatForm(collection, item || { id: id });
                        return;
                    }
                    if (action === 'toggle') {
                        const result = await API.setMagicDisabled(collection, id, !(item && item.disabled));
                        if (result.success) {
                            UI.showToast('Updated', 'success');
                            this.showMagicManagement(collection);
                        } else {
                            UI.showToast('Failed: ' + result.error, 'error');
                        }
                        return;
                    }
                    if (action === 'delete') {
                        const confirmed = await UI.showConfirmDialog({
                            title: 'Delete?',
                            message: `Delete ${collection} "${id}"? This cannot be undone.`,
                            confirmLabel: 'Delete',
                            danger: true
                        });
                        if (!confirmed) return;
                        const result = collection === 'spells'
                            ? await API.deleteSpell(id)
                            : await API.deleteMagicDoc(collection, id);
                        if (result.success) {
                            UI.showToast('Deleted', 'success');
                            this.showMagicManagement(collection);
                        } else {
                            UI.showToast('Failed: ' + result.error, 'error');
                        }
                    }
                });
            });
        },

        showMagicFlatForm(collectionName, item) {
            const adminContent = UI.elements.adminContent;
            if (!adminContent) return;
            const isEdit = !!(item && item.id);
            const data = item || {};
            let extra = '';
            if (collectionName === 'domains') {
                extra = `
                    <div class="form-group"><label>Color</label><input id="magic-color" value="${esc(data.color || '')}" placeholder="#c45c26"></div>
                    <div class="form-group"><label>Icon</label><input id="magic-icon" value="${esc(data.icon || '')}"></div>
                    <div class="form-group"><label>Aliases (comma-separated)</label><input id="magic-aliases" value="${esc((data.aliases || []).join(', '))}"></div>`;
            } else if (collectionName === 'kinds') {
                extra = `<div class="form-group"><label>Menu group</label><input id="magic-menu-group" value="${esc(data.menuGroup || '')}"></div>`;
            } else if (collectionName === 'runes') {
                extra = `
                    <div class="form-group"><label>Purpose</label><input id="magic-purpose" value="${esc(data.purpose || '')}" placeholder="fire; separate part split; detection"></div>
                    <div class="form-group"><label>Meaning</label><input id="magic-meaning" value="${esc(data.meaning || '')}"></div>
                    <div class="form-group"><label>Category id</label><input id="magic-category" value="${esc(data.categoryId || '')}" placeholder="elemental|force|structural|octave|trigger|conceptual|high_imperial"></div>
                    <div class="form-group"><label>Construction roles (comma-separated)</label><input id="magic-roles" value="${esc((data.constructionRoles || []).join(', '))}" placeholder="concept, force, structure, framework, octave, trigger, link, amplify"></div>
                    <div class="form-group"><label>Octave tie</label><input id="magic-octave" value="${esc(data.octaveTie || '')}" placeholder="1–6 or all"></div>
                    <div class="form-group"><label>Symbol cue</label><input id="magic-symbol" value="${esc(data.symbolCue || '')}"></div>
                    <div class="form-group"><label>Texture UUID</label><input id="magic-texture" value="${esc(data.textureUuid || '')}"></div>
                    <div class="form-group"><label>Tags (comma-separated)</label><input id="magic-tags" value="${esc((data.tags || []).join(', '))}"></div>
                    <div class="form-group"><label>Domain notes (JSON object)</label><textarea id="magic-domain-notes" rows="3">${esc(JSON.stringify(data.domainNotes || {}, null, 2))}</textarea></div>`;
            } else if (collectionName === 'visualEffects') {
                const emitters = (API.MAGIC_VFX_EMITTERS || []).map((e) =>
                    `<option value="${e}" ${data.emitter === e ? 'selected' : ''}>${e}</option>`).join('');
                extra = `
                    <div class="form-group"><label>Emitter</label><select id="magic-emitter">${emitters}</select></div>
                    <div class="form-group"><label>Duration (sec)</label><input type="number" step="0.1" id="magic-duration" value="${esc(data.durationSec != null ? data.durationSec : 0)}"></div>
                    <div class="form-group"><label><input type="checkbox" id="magic-follow" ${data.followAvatar !== false ? 'checked' : ''}> Follow avatar</label></div>
                    <div class="form-group"><label>Notes</label><textarea id="magic-notes" rows="2">${esc(data.notes || '')}</textarea></div>`;
            } else if (collectionName === 'damageTypes') {
                extra = `
                    <div class="form-group"><label>Resisted by (comma-separated ward ids)</label><input id="magic-resisted" value="${esc((data.resistedBy || []).join(', '))}"></div>
                    <div class="form-group"><label>Default DoT VFX id</label><input id="magic-dot-vfx" value="${esc(data.dotDefaultVfxId || '')}"></div>`;
            }

            adminContent.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
                    <h2>${isEdit ? 'Edit' : 'Create'} ${esc(catalogTitle(collectionName))}</h2>
                    <button class="btn btn-secondary" id="btn-magic-back">← Back</button>
                </div>
                <form id="magic-flat-form">
                    <div class="form-group">
                        <label>ID ${isEdit ? '(read-only)' : ''}</label>
                        <input id="magic-id" value="${esc(data.id || '')}" ${isEdit ? 'readonly' : ''} required placeholder="lowercase_slug">
                    </div>
                    <div class="form-group"><label>Name *</label><input id="magic-name" value="${esc(data.name || '')}" required></div>
                    <div class="form-group"><label>Description</label><textarea id="magic-description" rows="3">${esc(data.description || '')}</textarea></div>
                    <div class="form-group"><label>Sort order</label><input type="number" id="magic-sort" value="${esc(data.sortOrder != null ? data.sortOrder : 100)}"></div>
                    <div class="form-group"><label><input type="checkbox" id="magic-disabled" ${data.disabled ? 'checked' : ''}> Disabled</label></div>
                    ${extra}
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create'}</button>
                </form>`;

            document.getElementById('btn-magic-back')?.addEventListener('click', () => this.showMagicManagement(collectionName));
            document.getElementById('magic-flat-form')?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const payload = {
                    id: document.getElementById('magic-id').value,
                    name: document.getElementById('magic-name').value,
                    description: document.getElementById('magic-description').value,
                    sortOrder: parseInt(document.getElementById('magic-sort').value, 10) || 100,
                    disabled: document.getElementById('magic-disabled').checked
                };
                if (collectionName === 'domains') {
                    payload.color = document.getElementById('magic-color')?.value || '';
                    payload.icon = document.getElementById('magic-icon')?.value || '';
                    payload.aliases = String(document.getElementById('magic-aliases')?.value || '')
                        .split(',').map((s) => s.trim()).filter(Boolean);
                } else if (collectionName === 'kinds') {
                    payload.menuGroup = document.getElementById('magic-menu-group')?.value || '';
                } else if (collectionName === 'runes') {
                    payload.purpose = document.getElementById('magic-purpose')?.value || '';
                    payload.meaning = document.getElementById('magic-meaning')?.value || '';
                    payload.categoryId = document.getElementById('magic-category')?.value || '';
                    payload.constructionRoles = String(document.getElementById('magic-roles')?.value || '')
                        .split(',').map((s) => s.trim()).filter(Boolean);
                    payload.octaveTie = document.getElementById('magic-octave')?.value || '';
                    payload.symbolCue = document.getElementById('magic-symbol')?.value || '';
                    payload.textureUuid = document.getElementById('magic-texture')?.value || '';
                    payload.tags = String(document.getElementById('magic-tags')?.value || '')
                        .split(',').map((s) => s.trim()).filter(Boolean);
                    try {
                        payload.domainNotes = JSON.parse(document.getElementById('magic-domain-notes')?.value || '{}');
                    } catch (e) {
                        UI.showToast('Domain notes must be valid JSON', 'error');
                        return;
                    }
                } else if (collectionName === 'visualEffects') {
                    payload.emitter = document.getElementById('magic-emitter')?.value || 'effect_prim';
                    payload.durationSec = parseFloat(document.getElementById('magic-duration')?.value || '0') || 0;
                    payload.followAvatar = !!document.getElementById('magic-follow')?.checked;
                    payload.notes = document.getElementById('magic-notes')?.value || '';
                } else if (collectionName === 'damageTypes') {
                    payload.resistedBy = String(document.getElementById('magic-resisted')?.value || '')
                        .split(',').map((s) => s.trim()).filter(Boolean);
                    payload.dotDefaultVfxId = document.getElementById('magic-dot-vfx')?.value || '';
                }
                const result = isEdit
                    ? await API.updateMagicDoc(collectionName, data.id, payload)
                    : await API.createMagicDoc(collectionName, payload);
                if (result.success) {
                    UI.showToast(isEdit ? 'Saved' : 'Created', 'success');
                    this.showMagicManagement(collectionName);
                } else {
                    UI.showToast('Failed: ' + result.error, 'error');
                }
            });
        },

        async showMagicSpellForm(spell) {
            const adminContent = UI.elements.adminContent;
            if (!adminContent) return;
            UI.showLoading(adminContent, 'Loading spell editor…');

            const [domainsRes, kindsRes, vfxRes, runesRes] = await Promise.all([
                API.getMagicCatalog('domains'),
                API.getMagicCatalog('kinds'),
                API.getMagicCatalog('visualEffects'),
                API.getMagicCatalog('runes')
            ]);
            const domains = (domainsRes.success && domainsRes.data.items) || [];
            const kinds = (kindsRes.success && kindsRes.data.items) || [];
            const vfx = (vfxRes.success && vfxRes.data.items) || [];
            const runes = (runesRes.success && runesRes.data.items) || [];

            const isEdit = !!(spell && spell.id);
            const sp = API.normalizeSpellDocument(spell?.id || '', spell || {});
            const domainOpts = domains.map((d) =>
                `<option value="${esc(d.id)}" ${sp.domainId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
            const kindOpts = kinds.map((k) =>
                `<option value="${esc(k.id)}" ${sp.kindId === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
            const vfxOpts = (selected) => ['<option value="">(none)</option>'].concat(
                vfx.map((v) => `<option value="${esc(v.id)}" ${selected === v.id ? 'selected' : ''}>${esc(v.name)} (${esc(v.id)})</option>`)
            ).join('');

            const timingOpts = (API.MAGIC_DELIVERY_TIMINGS || []).map((t) =>
                `<option value="${t}" ${sp.delivery.timing === t ? 'selected' : ''}>${t}</option>`).join('');
            const triggerOpts = (API.MAGIC_TRIGGER_MODES || []).map((t) =>
                `<option value="${t}" ${sp.delivery.trigger.mode === t ? 'selected' : ''}>${t}</option>`).join('');
            const targetOpts = (API.MAGIC_TARGET_MODES || []).map((t) =>
                `<option value="${t}" ${sp.delivery.target.mode === t ? 'selected' : ''}>${t}</option>`).join('');
            const originOpts = (API.MAGIC_TARGET_ORIGINS || []).map((t) =>
                `<option value="${t}" ${sp.delivery.target.origin === t ? 'selected' : ''}>${t}</option>`).join('');
            const protectOpts = (API.MAGIC_PROTECTION_RESPONSES || []).map((t) =>
                `<option value="${t}" ${sp.counters.protectionDefault === t ? 'selected' : ''}>${t}</option>`).join('');

            adminContent.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
                    <h2>${isEdit ? 'Edit' : 'Create'} Spell</h2>
                    <button class="btn btn-secondary" id="btn-magic-back">← Back</button>
                </div>
                <form id="magic-spell-form" style="display:flex;flex-direction:column;gap:var(--space-md);">
                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Identity</strong></legend>
                        <div class="form-group"><label>ID ${isEdit ? '(read-only)' : ''}</label>
                            <input id="sp-id" value="${esc(sp.id)}" ${isEdit ? 'readonly' : ''} required placeholder="mage_light"></div>
                        <div class="form-group"><label>Name *</label><input id="sp-name" value="${esc(sp.name)}" required></div>
                        <div class="form-group"><label>Summary</label><input id="sp-summary" value="${esc(sp.summary)}"></div>
                        <div class="form-group"><label>Description</label><textarea id="sp-description" rows="3">${esc(sp.description)}</textarea></div>
                        <div class="form-group"><label>Domain</label><select id="sp-domain">${domainOpts}</select></div>
                        <div class="form-group"><label>Kind</label><select id="sp-kind">${kindOpts}</select></div>
                        <div class="form-group"><label>CR</label><input type="number" id="sp-cr" value="${esc(sp.cr)}" min="1"></div>
                        <div class="form-group"><label>Tags (comma-separated)</label><input id="sp-tags" value="${esc((sp.tags || []).join(', '))}"></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-cantrip" ${sp.isCantrip ? 'checked' : ''}> Cantrip</label></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-disabled" ${sp.disabled ? 'checked' : ''}> Disabled</label></div>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Economy</strong></legend>
                        <div class="form-group"><label>Mana cost</label><input type="number" id="sp-mana" value="${esc(sp.manaCost)}" min="0"></div>
                        <div class="form-group"><label>Stamina fatigue</label><input type="number" id="sp-fatigue" value="${esc(sp.staminaFatigue)}" min="0"></div>
                        <div class="form-group"><label>Cast components (JSON array)</label>
                            <textarea id="sp-comp-cast" rows="2">${esc(JSON.stringify(sp.componentsCast || []))}</textarea></div>
                        <div class="form-group"><label>Bind components (JSON array)</label>
                            <textarea id="sp-comp-bind" rows="2">${esc(JSON.stringify(sp.componentsBind || []))}</textarea></div>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Delivery</strong></legend>
                        <div class="form-group"><label>Timing</label><select id="sp-timing">${timingOpts}</select></div>
                        <div class="form-group"><label>Delay (sec)</label><input type="number" step="0.1" id="sp-delay" value="${esc(sp.delivery.delaySec)}"></div>
                        <div class="form-group"><label>Trigger mode</label><select id="sp-trigger">${triggerOpts}</select></div>
                        <div class="form-group"><label>Proximity (m)</label><input type="number" step="0.1" id="sp-prox" value="${esc(sp.delivery.trigger.proximityMeters)}"></div>
                        <div class="form-group"><label>Arming delay (sec)</label><input type="number" step="0.1" id="sp-arm" value="${esc(sp.delivery.trigger.armingDelaySec)}"></div>
                        <div class="form-group"><label>Target mode</label><select id="sp-target">${targetOpts}</select></div>
                        <div class="form-group"><label>Origin</label><select id="sp-origin">${originOpts}</select></div>
                        <div class="form-group"><label>Radius (m)</label><input type="number" step="0.1" id="sp-radius" value="${esc(sp.delivery.target.radiusMeters)}"></div>
                        <div class="form-group"><label>Max targets</label><input type="number" id="sp-maxt" value="${esc(sp.delivery.target.maxTargets)}"></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-include-caster" ${sp.delivery.target.includeCaster ? 'checked' : ''}> Include caster</label></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-los" ${sp.delivery.target.requiresLos ? 'checked' : ''}> Requires LoS</label></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-proj" ${sp.delivery.projectile.enabled ? 'checked' : ''}> Projectile enabled</label></div>
                        <div class="form-group"><label>Projectile rez object</label><input id="sp-proj-obj" value="${esc(sp.delivery.projectile.rezObject)}"></div>
                        <div class="form-group"><label>Projectile speed</label><input type="number" step="0.1" id="sp-proj-speed" value="${esc(sp.delivery.projectile.speed)}"></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-proj-arc" ${sp.delivery.projectile.arc ? 'checked' : ''}> Arc</label></div>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Effects (JSON array)</strong></legend>
                        <textarea id="sp-effects" rows="8">${esc(JSON.stringify(sp.effects || [], null, 2))}</textarea>
                        <small>Types: damage, heal, resource, animation, rez, buff, debuff, state_flag, reveal</small>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Presentation</strong></legend>
                        <div class="form-group"><label>Cast VFX</label><select id="sp-cast-vfx">${vfxOpts(sp.presentation.castVfxId)}</select></div>
                        <div class="form-group"><label>Impact VFX</label><select id="sp-impact-vfx">${vfxOpts(sp.presentation.impactVfxId)}</select></div>
                        <div class="form-group"><label>Projectile VFX</label><select id="sp-proj-vfx">${vfxOpts(sp.presentation.projectileVfxId)}</select></div>
                        <div class="form-group"><label>Cast sound</label><input id="sp-snd-cast" value="${esc(sp.presentation.audio.castSound)}"></div>
                        <div class="form-group"><label>Impact sound</label><input id="sp-snd-impact" value="${esc(sp.presentation.audio.impactSound)}"></div>
                        <div class="form-group"><label>Loop sound</label><input id="sp-snd-loop" value="${esc(sp.presentation.audio.loopSound)}"></div>
                        <div class="form-group"><label>Rune ids (comma-separated)</label>
                            <input id="sp-runes" value="${esc((sp.presentation.runeIds || []).join(', '))}" placeholder="${esc(runes.map((r) => r.id).join(', '))}"></div>
                        <div class="form-group"><label><input type="checkbox" id="sp-rune-display" ${sp.presentation.runeDisplay ? 'checked' : ''}> Show runes</label></div>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Binding</strong></legend>
                        ${['wand', 'staff', 'scroll', 'objectEnchant', 'armor', 'weapon'].map((k) =>
                            `<label style="margin-right:1em;"><input type="checkbox" id="sp-bind-${k}" ${sp.binding[k] ? 'checked' : ''}> ${k}</label>`
                        ).join('')}
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Detection</strong></legend>
                        <div class="form-group"><label>Examine</label><textarea id="sp-det-examine" rows="2">${esc(sp.detection.examine)}</textarea></div>
                        <div class="form-group"><label>Magesight</label><textarea id="sp-det-magesight" rows="2">${esc(sp.detection.magesight)}</textarea></div>
                        <div class="form-group"><label>Assay</label><textarea id="sp-det-assay" rows="2">${esc(sp.detection.assay)}</textarea></div>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Counters</strong></legend>
                        <div class="form-group"><label><input type="checkbox" id="sp-dispellable" ${sp.counters.dispellable ? 'checked' : ''}> Dispellable</label></div>
                        <div class="form-group"><label>Dispel CR</label><input type="number" id="sp-dispel-cr" value="${esc(sp.counters.dispelCr)}"></div>
                        <div class="form-group"><label>Dispel risk</label><input id="sp-dispel-risk" value="${esc(sp.counters.dispelRisk)}"></div>
                        <div class="form-group"><label>Protection default</label><select id="sp-prot-default">${protectOpts}</select></div>
                        <div class="form-group"><label>Protection by ward (JSON object)</label>
                            <textarea id="sp-prot-ward" rows="3">${esc(JSON.stringify(sp.counters.protectionByWard || {}, null, 2))}</textarea></div>
                    </fieldset>

                    <fieldset class="panel" style="padding:var(--space-md);">
                        <legend><strong>Advanced</strong></legend>
                        <div class="form-group"><label>Compiled payload</label><input id="sp-payload" value="${esc(sp.compiledPayload)}" placeholder="TYPE|dmg|HP|Anim|PARTICLE"></div>
                        <p class="info-text">contentVersion auto-bumps on save (currently ${esc(sp.contentVersion)}).</p>
                    </fieldset>

                    <button type="submit" class="btn btn-primary">${isEdit ? 'Save Spell' : 'Create Spell'}</button>
                </form>`;

            document.getElementById('btn-magic-back')?.addEventListener('click', () => this.showMagicManagement('spells'));
            document.getElementById('magic-spell-form')?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                let effects;
                let componentsCast;
                let componentsBind;
                let protectionByWard;
                try {
                    effects = JSON.parse(document.getElementById('sp-effects').value || '[]');
                    componentsCast = JSON.parse(document.getElementById('sp-comp-cast').value || '[]');
                    componentsBind = JSON.parse(document.getElementById('sp-comp-bind').value || '[]');
                    protectionByWard = JSON.parse(document.getElementById('sp-prot-ward').value || '{}');
                } catch (e) {
                    UI.showToast('Invalid JSON in effects/components/protection: ' + e.message, 'error');
                    return;
                }
                const payload = {
                    id: document.getElementById('sp-id').value,
                    name: document.getElementById('sp-name').value,
                    summary: document.getElementById('sp-summary').value,
                    description: document.getElementById('sp-description').value,
                    domainId: document.getElementById('sp-domain').value,
                    kindId: document.getElementById('sp-kind').value,
                    cr: parseInt(document.getElementById('sp-cr').value, 10) || 1,
                    isCantrip: document.getElementById('sp-cantrip').checked,
                    disabled: document.getElementById('sp-disabled').checked,
                    tags: String(document.getElementById('sp-tags').value || '').split(',').map((s) => s.trim()).filter(Boolean),
                    manaCost: parseInt(document.getElementById('sp-mana').value, 10) || 0,
                    staminaFatigue: parseInt(document.getElementById('sp-fatigue').value, 10) || 0,
                    componentsCast: componentsCast,
                    componentsBind: componentsBind,
                    delivery: {
                        timing: document.getElementById('sp-timing').value,
                        delaySec: parseFloat(document.getElementById('sp-delay').value) || 0,
                        trigger: {
                            mode: document.getElementById('sp-trigger').value,
                            proximityMeters: parseFloat(document.getElementById('sp-prox').value) || 0,
                            armingDelaySec: parseFloat(document.getElementById('sp-arm').value) || 0
                        },
                        target: {
                            mode: document.getElementById('sp-target').value,
                            origin: document.getElementById('sp-origin').value,
                            radiusMeters: parseFloat(document.getElementById('sp-radius').value) || 0,
                            maxTargets: parseInt(document.getElementById('sp-maxt').value, 10) || 1,
                            includeCaster: document.getElementById('sp-include-caster').checked,
                            requiresLos: document.getElementById('sp-los').checked
                        },
                        projectile: {
                            enabled: document.getElementById('sp-proj').checked,
                            rezObject: document.getElementById('sp-proj-obj').value,
                            speed: parseFloat(document.getElementById('sp-proj-speed').value) || 0,
                            arc: document.getElementById('sp-proj-arc').checked
                        }
                    },
                    effects: effects,
                    presentation: {
                        castVfxId: document.getElementById('sp-cast-vfx').value,
                        impactVfxId: document.getElementById('sp-impact-vfx').value,
                        projectileVfxId: document.getElementById('sp-proj-vfx').value,
                        audio: {
                            castSound: document.getElementById('sp-snd-cast').value,
                            impactSound: document.getElementById('sp-snd-impact').value,
                            loopSound: document.getElementById('sp-snd-loop').value
                        },
                        runeIds: String(document.getElementById('sp-runes').value || '').split(',').map((s) => s.trim()).filter(Boolean),
                        runeDisplay: document.getElementById('sp-rune-display').checked
                    },
                    binding: {
                        wand: document.getElementById('sp-bind-wand').checked,
                        staff: document.getElementById('sp-bind-staff').checked,
                        scroll: document.getElementById('sp-bind-scroll').checked,
                        objectEnchant: document.getElementById('sp-bind-objectEnchant').checked,
                        armor: document.getElementById('sp-bind-armor').checked,
                        weapon: document.getElementById('sp-bind-weapon').checked
                    },
                    detection: {
                        examine: document.getElementById('sp-det-examine').value,
                        magesight: document.getElementById('sp-det-magesight').value,
                        assay: document.getElementById('sp-det-assay').value
                    },
                    counters: {
                        dispellable: document.getElementById('sp-dispellable').checked,
                        dispelCr: parseInt(document.getElementById('sp-dispel-cr').value, 10) || 0,
                        dispelRisk: document.getElementById('sp-dispel-risk').value,
                        protectionDefault: document.getElementById('sp-prot-default').value,
                        protectionByWard: protectionByWard
                    },
                    compiledPayload: document.getElementById('sp-payload').value
                };

                const result = isEdit
                    ? await API.updateSpell(sp.id, payload)
                    : await API.createSpell(payload);
                if (result.success) {
                    UI.showToast(isEdit ? 'Spell saved' : 'Spell created', 'success');
                    this.showMagicManagement('spells');
                } else {
                    UI.showToast('Failed: ' + result.error, 'error');
                }
            });
        },

        exportMagicCatalogCsv(collectionName) {
            const items = (this._magicCache && this._magicCache[collectionName]) || [];
            let headers = ['id', 'name', 'description', 'sortOrder', 'disabled'];
            if (collectionName === 'domains') headers = headers.concat(['color', 'icon', 'aliases']);
            if (collectionName === 'kinds') headers = headers.concat(['menuGroup']);
            if (collectionName === 'runes') headers = headers.concat(['purpose', 'meaning', 'textureUuid', 'tags', 'domainNotes', 'categoryId', 'constructionRoles', 'octaveTie', 'symbolCue']);
            if (collectionName === 'visualEffects') headers = headers.concat(['emitter', 'durationSec', 'followAvatar', 'notes']);
            if (collectionName === 'damageTypes') headers = headers.concat(['resistedBy', 'dotDefaultVfxId']);

            const rows = items.map((item) => {
                const map = {
                    id: item.id,
                    name: item.name,
                    description: item.description || '',
                    sortOrder: item.sortOrder != null ? item.sortOrder : 100,
                    disabled: item.disabled ? 'true' : 'false',
                    color: item.color || '',
                    icon: item.icon || '',
                    aliases: Array.isArray(item.aliases) ? item.aliases.join('|') : '',
                    menuGroup: item.menuGroup || '',
                    purpose: item.purpose || '',
                    meaning: item.meaning || '',
                    textureUuid: item.textureUuid || '',
                    tags: Array.isArray(item.tags) ? item.tags.join('|') : '',
                    domainNotes: JSON.stringify(item.domainNotes || {}),
                    categoryId: item.categoryId || '',
                    constructionRoles: Array.isArray(item.constructionRoles) ? item.constructionRoles.join('|') : '',
                    octaveTie: item.octaveTie || '',
                    symbolCue: item.symbolCue || '',
                    emitter: item.emitter || '',
                    durationSec: item.durationSec != null ? item.durationSec : 0,
                    followAvatar: item.followAvatar !== false ? 'true' : 'false',
                    notes: item.notes || '',
                    resistedBy: Array.isArray(item.resistedBy) ? item.resistedBy.join('|') : '',
                    dotDefaultVfxId: item.dotDefaultVfxId || ''
                };
                return headers.map((h) => csvEscape(map[h])).join(',');
            });
            const csv = [headers.join(',')].concat(rows).join('\n');
            const date = new Date().toISOString().split('T')[0];
            downloadText(`magic_${collectionName}_${date}.csv`, csv, 'text/csv;charset=utf-8;');
            UI.showToast('Exported CSV', 'success');
        },

        async importMagicCatalogCsv(collectionName, file) {
            try {
                const text = await file.text();
                const parsed = parseCsv(text);
                let created = 0;
                let updated = 0;
                for (let i = 0; i < parsed.rows.length; i++) {
                    const row = parsed.rows[i];
                    const id = API.normalizeMagicSlug(row.id || row.slug || row.name);
                    if (!id) continue;
                    const payload = {
                        id: id,
                        name: row.name || id,
                        description: row.description || '',
                        sortOrder: parseInt(row.sortOrder, 10) || 100,
                        disabled: String(row.disabled || '').toLowerCase() === 'true'
                    };
                    if (collectionName === 'domains') {
                        payload.color = row.color || '';
                        payload.icon = row.icon || '';
                        payload.aliases = String(row.aliases || '').split('|').map((s) => s.trim()).filter(Boolean);
                    } else if (collectionName === 'kinds') {
                        payload.menuGroup = row.menuGroup || '';
                    } else if (collectionName === 'runes') {
                        payload.purpose = row.purpose || '';
                        payload.meaning = row.meaning || '';
                        payload.textureUuid = row.textureUuid || '';
                        payload.tags = String(row.tags || '').split('|').map((s) => s.trim()).filter(Boolean);
                        try { payload.domainNotes = JSON.parse(row.domainNotes || '{}'); } catch (e) { payload.domainNotes = {}; }
                        payload.categoryId = row.categoryId || '';
                        payload.constructionRoles = String(row.constructionRoles || '').split('|').map((s) => s.trim()).filter(Boolean);
                        payload.octaveTie = row.octaveTie != null ? String(row.octaveTie) : '';
                        payload.symbolCue = row.symbolCue || '';
                    } else if (collectionName === 'visualEffects') {
                        payload.emitter = row.emitter || 'effect_prim';
                        payload.durationSec = parseFloat(row.durationSec) || 0;
                        payload.followAvatar = String(row.followAvatar || 'true').toLowerCase() !== 'false';
                        payload.notes = row.notes || '';
                    } else if (collectionName === 'damageTypes') {
                        payload.resistedBy = String(row.resistedBy || '').split('|').map((s) => s.trim()).filter(Boolean);
                        payload.dotDefaultVfxId = row.dotDefaultVfxId || '';
                    }
                    const existing = await API._magicCol(collectionName).doc(id).get();
                    if (existing.exists) {
                        await API.updateMagicDoc(collectionName, id, payload);
                        updated++;
                    } else {
                        await API.createMagicDoc(collectionName, payload);
                        created++;
                    }
                }
                UI.showToast(`Import done — created ${created}, updated ${updated}`, 'success');
                this.showMagicManagement(collectionName);
            } catch (error) {
                UI.showToast('Import failed: ' + error.message, 'error');
            }
        },

        exportMagicSpellsJson() {
            const spells = (this._magicCache && this._magicCache.spells) || [];
            const cleaned = spells.map((sp) => {
                const copy = Object.assign({}, sp);
                delete copy.createdAt;
                delete copy.updatedAt;
                return copy;
            });
            const date = new Date().toISOString().split('T')[0];
            downloadText(`spells_export_${date}.json`, JSON.stringify(cleaned, null, 2), 'application/json');
            UI.showToast('Exported spells JSON', 'success');
        },

        async importMagicSpellsJson(file) {
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const list = Array.isArray(data) ? data : (data.spells || []);
                let created = 0;
                let updated = 0;
                for (let i = 0; i < list.length; i++) {
                    const row = list[i];
                    const id = API.normalizeMagicSlug(row.id || row.name);
                    if (!id) continue;
                    const existing = await API._magicCol('spells').doc(id).get();
                    if (existing.exists) {
                        await API.updateSpell(id, row);
                        updated++;
                    } else {
                        await API.createSpell(Object.assign({}, row, { id: id }));
                        created++;
                    }
                }
                UI.showToast(`Import done — created ${created}, updated ${updated}`, 'success');
                this.showMagicManagement('spells');
            } catch (error) {
                UI.showToast('Import failed: ' + error.message, 'error');
            }
        },

        /**
         * Collect magic policy from Universe Rules tab fields.
         */
        collectUniverseMagicFromForm(fallbackUniverse) {
            const enabledEl = document.getElementById('universe-magic-enabled')
                || document.getElementById('universe-mana-enabled');
            const enabled = enabledEl ? !!enabledEl.checked : (fallbackUniverse?.manaEnabled !== false);
            const selected = [];
            document.querySelectorAll('#universe-magic-domains input[type="checkbox"][data-domain-id]').forEach((cb) => {
                if (cb.checked) selected.push(cb.getAttribute('data-domain-id'));
            });
            let aliases = {};
            const aliasEl = document.getElementById('universe-magic-aliases');
            if (aliasEl && aliasEl.value.trim()) {
                const lines = aliasEl.value.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const eq = line.indexOf('=');
                    if (eq === -1) continue;
                    const key = API.normalizeMagicSlug(line.substring(0, eq));
                    const val = line.substring(eq + 1).trim();
                    if (key && val) aliases[key] = val;
                }
            } else if (fallbackUniverse && fallbackUniverse.magic && fallbackUniverse.magic.domainAliases) {
                aliases = Object.assign({}, fallbackUniverse.magic.domainAliases);
            }
            // If domain checkboxes not in DOM, preserve existing / undefined
            const domainsPresent = !!document.getElementById('universe-magic-domains');
            const magic = {
                enabled: enabled,
                allowedDomains: domainsPresent ? selected : (
                    fallbackUniverse?.magic?.allowedDomains != null
                        ? fallbackUniverse.magic.allowedDomains
                        : undefined
                ),
                domainAliases: aliases
            };
            if (magic.allowedDomains === undefined) {
                delete magic.allowedDomains;
            }
            return {
                manaEnabled: enabled,
                magic: magic
            };
        }
    };

    function install() {
        if (typeof App === 'undefined' || !App || App.__magicAdminInstalled) {
            return false;
        }
        Object.assign(App, MagicAdmin);
        App.__magicAdminInstalled = true;
        if (window.simpleDebug) {
            window.simpleDebug('Magic admin UI installed', 'info');
        }
        return true;
    }

    if (!install()) {
        document.addEventListener('DOMContentLoaded', function () {
            install();
        });
        // App may finish constructing after this script in the load chain —
        // retry shortly if needed.
        setTimeout(install, 0);
        setTimeout(install, 250);
    }
})();
