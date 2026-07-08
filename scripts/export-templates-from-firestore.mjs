#!/usr/bin/env node
/**
 * Export classes / species / genders / vocations from Firestore to MOAP Interface/data/
 * for GitHub Pages CDN. Use after Admin CSV imports (source of truth = Firestore).
 *
 * Usage:
 *   node "MOAP Interface/scripts/export-templates-from-firestore.mjs"
 *   node "MOAP Interface/scripts/export-templates-from-firestore.mjs" --version 4.2.34-tpl-20260708
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const moapRoot = join(__dirname, '..');
const dataDir = join(moapRoot, 'data');

const PROJECT_ID = 'feudalism4-rpg';
const FIRESTORE_BASE =
    'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

function readBuildLabel() {
    const argIdx = process.argv.indexOf('--version');
    if (argIdx !== -1 && process.argv[argIdx + 1]) {
        return process.argv[argIdx + 1];
    }
    const hudHtml = readFileSync(join(moapRoot, 'hud.html'), 'utf8');
    const m = hudHtml.match(/HUD_BUILD_LABEL\s*=\s*'([^']+)'/);
    const base = m ? m[1] : '4.0.0';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 12);
    return base + '-tpl-' + stamp;
}

function normalizeClassImagePath(classId, image) {
    const id = (classId || '').trim();
    if (!id) {
        return image || '';
    }
    const standard = 'classes/Class_Overview_' + id + '.png';
    const raw = (image || '').trim();
    if (!raw || raw === 'classes/' + id + '.png' || raw === id + '.png' || raw.endsWith('/' + id + '.png')) {
        return standard;
    }
    if (raw.indexOf('Class_Overview_') !== -1) {
        return raw;
    }
    return standard;
}

function normalizeClassTemplate(row) {
    const out = Object.assign({}, row);
    let prereqs = [];
    if (Array.isArray(out.prerequisites)) {
        prereqs = out.prerequisites.map(function (p) { return String(p).trim(); }).filter(Boolean);
    } else if (out.prerequisites != null && String(out.prerequisites).trim()) {
        const raw = String(out.prerequisites).trim();
        const sep = raw.indexOf(';') >= 0 ? ';' : ',';
        prereqs = raw.split(sep).map(function (p) { return p.trim(); }).filter(Boolean);
    } else if (out.prerequisite != null && String(out.prerequisite).trim()) {
        prereqs = [String(out.prerequisite).trim()];
    }
    out.prerequisites = prereqs;
    delete out.prerequisite;
    if (out.id) {
        out.image = normalizeClassImagePath(out.id, out.image);
    }
    return out;
}

function staticVocationList() {
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
        { id: 'hunting', name: "Hunter's Instinct", primary_stat: 'marksmanship', secondary_stat: 'awareness', applies_to: ['marksmanship', 'survival'] },
        { id: 'scholarship', name: 'Academic Knowledge', primary_stat: 'knowledge', secondary_stat: 'intelligence', applies_to: ['knowledge', 'wisdom'] },
        { id: 'exploration', name: "Wanderer's Path", primary_stat: 'awareness', secondary_stat: 'agility', applies_to: ['awareness', 'athletics', 'survival'] },
        { id: 'protection', name: "Guardian's Duty", primary_stat: 'fighting', secondary_stat: 'awareness', applies_to: ['fighting', 'awareness'] },
        { id: 'dark_magic', name: 'Forbidden Arts', primary_stat: 'intelligence', secondary_stat: 'will', applies_to: ['knowledge', 'deception'] },
        { id: 'law', name: 'Legal Authority', primary_stat: 'influence', secondary_stat: 'knowledge', applies_to: ['influence', 'persuasion'] },
        { id: 'nobility', name: 'Noble Bearing', primary_stat: 'influence', secondary_stat: 'awareness', applies_to: ['influence', 'persuasion', 'entertaining'] },
        { id: 'general', name: 'Jack of All Trades', primary_stat: 'awareness', secondary_stat: 'will', applies_to: ['awareness', 'survival'] }
    ];
}

function decodeFirestoreValue(value) {
    if (value == null || typeof value !== 'object') {
        return value;
    }
    if ('stringValue' in value) {
        return value.stringValue;
    }
    if ('booleanValue' in value) {
        return value.booleanValue;
    }
    if ('integerValue' in value) {
        return parseInt(value.integerValue, 10);
    }
    if ('doubleValue' in value) {
        return value.doubleValue;
    }
    if ('nullValue' in value) {
        return null;
    }
    if ('timestampValue' in value) {
        return value.timestampValue;
    }
    if ('mapValue' in value) {
        const fields = value.mapValue.fields || {};
        const obj = {};
        Object.keys(fields).forEach(function (key) {
            obj[key] = decodeFirestoreValue(fields[key]);
        });
        return obj;
    }
    if ('arrayValue' in value) {
        const values = value.arrayValue.values || [];
        return values.map(decodeFirestoreValue);
    }
    return null;
}

function decodeFirestoreDocument(doc) {
    const name = doc.name || '';
    const id = name.split('/').pop();
    const fields = doc.fields || {};
    const data = { id: id };
    Object.keys(fields).forEach(function (key) {
        data[key] = decodeFirestoreValue(fields[key]);
    });
    return data;
}

async function fetchCollection(collectionName) {
    const items = [];
    let pageToken = '';
    do {
        const url = new URL(FIRESTORE_BASE + '/' + collectionName);
        url.searchParams.set('pageSize', '300');
        if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
        }
        const res = await fetch(url.toString());
        if (!res.ok) {
            const body = await res.text();
            throw new Error('Firestore ' + collectionName + ' HTTP ' + res.status + ': ' + body.slice(0, 200));
        }
        const json = await res.json();
        (json.documents || []).forEach(function (doc) {
            items.push(decodeFirestoreDocument(doc));
        });
        pageToken = json.nextPageToken || '';
    } while (pageToken);
    return items;
}

function sortByName(items) {
    return items.slice().sort(function (a, b) {
        const na = String(a.name || a.id || '').toLowerCase();
        const nb = String(b.name || b.id || '').toLowerCase();
        return na.localeCompare(nb);
    });
}

function writeJson(path, data) {
    writeFileSync(path, JSON.stringify(data) + '\n', 'utf8');
}

const version = readBuildLabel();
const versionSlug = version.replace(/[^a-zA-Z0-9]/g, '');

console.log('[export-templates-from-firestore] fetching from', PROJECT_ID, '...');

const [classesRaw, speciesRaw, gendersRaw, vocationsRaw] = await Promise.all([
    fetchCollection('classes'),
    fetchCollection('species'),
    fetchCollection('genders'),
    fetchCollection('vocations')
]);

const classes = sortByName(classesRaw
    .filter(function (row) { return row.enabled !== false; })
    .map(normalizeClassTemplate));

const species = sortByName(speciesRaw.filter(function (row) { return row.enabled !== false; }));
const genders = sortByName(gendersRaw.filter(function (row) { return row.enabled !== false; }));
const vocations = vocationsRaw.length > 0
    ? sortByName(vocationsRaw.filter(function (row) { return row.enabled !== false; }))
    : staticVocationList();

mkdirSync(dataDir, { recursive: true });

const paths = {
    classes: 'data/classes.v' + versionSlug + '.json',
    species: 'data/species.v' + versionSlug + '.json',
    genders: 'data/genders.v' + versionSlug + '.json',
    vocations: 'data/vocations.v' + versionSlug + '.json'
};

writeJson(join(moapRoot, paths.classes), classes);
writeJson(join(moapRoot, paths.species), species);
writeJson(join(moapRoot, paths.genders), genders);
writeJson(join(moapRoot, paths.vocations), vocations);

const manifest = {
    version: version,
    generated: new Date().toISOString(),
    source: 'firestore',
    classes: paths.classes,
    species: paths.species,
    genders: paths.genders,
    vocations: paths.vocations
};

writeJson(join(dataDir, 'manifest.json'), manifest);

console.log('[export-templates-from-firestore] version:', version);
console.log('  classes:', classes.length, '->', paths.classes);
console.log('  species:', species.length, '->', paths.species);
console.log('  genders:', genders.length, '->', paths.genders);
console.log('  vocations:', vocations.length, '->', paths.vocations);
console.log('  manifest -> data/manifest.json');
