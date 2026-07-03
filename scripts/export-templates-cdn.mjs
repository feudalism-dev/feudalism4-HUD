#!/usr/bin/env node
/**
 * Export classes / species / genders / vocations to MOAP Interface/data/
 * for GitHub Pages CDN (Phase B). Run before deploy or after template edits.
 *
 * Usage:
 *   node MOAP Interface/scripts/export-templates-cdn.mjs
 *   node MOAP Interface/scripts/export-templates-cdn.mjs --version 4.2.19
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const moapRoot = join(__dirname, '..');
const dataDir = join(moapRoot, 'data');

function readBuildLabel() {
    const argIdx = process.argv.indexOf('--version');
    if (argIdx !== -1 && process.argv[argIdx + 1]) {
        return process.argv[argIdx + 1];
    }
    const hudHtml = readFileSync(join(moapRoot, 'hud.html'), 'utf8');
    const m = hudHtml.match(/HUD_BUILD_LABEL\s*=\s*'([^']+)'/);
    if (m) {
        return m[1];
    }
    return new Date().toISOString().slice(0, 10).replace(/-/g, '.');
}

function normalizeClassImagePath(classId, image) {
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
        { id: 'hunting', name: 'Hunter\'s Instinct', primary_stat: 'marksmanship', secondary_stat: 'awareness', applies_to: ['marksmanship', 'survival'] },
        { id: 'scholarship', name: 'Academic Knowledge', primary_stat: 'knowledge', secondary_stat: 'intelligence', applies_to: ['knowledge', 'wisdom'] },
        { id: 'exploration', name: 'Wanderer\'s Path', primary_stat: 'awareness', secondary_stat: 'agility', applies_to: ['awareness', 'athletics', 'survival'] },
        { id: 'protection', name: 'Guardian\'s Duty', primary_stat: 'fighting', secondary_stat: 'awareness', applies_to: ['fighting', 'awareness'] },
        { id: 'dark_magic', name: 'Forbidden Arts', primary_stat: 'intelligence', secondary_stat: 'will', applies_to: ['knowledge', 'deception'] },
        { id: 'law', name: 'Legal Authority', primary_stat: 'influence', secondary_stat: 'knowledge', applies_to: ['influence', 'persuasion'] },
        { id: 'nobility', name: 'Noble Bearing', primary_stat: 'influence', secondary_stat: 'awareness', applies_to: ['influence', 'persuasion', 'entertaining'] },
        { id: 'general', name: 'Jack of All Trades', primary_stat: 'awareness', secondary_stat: 'will', applies_to: ['awareness', 'survival'] }
    ];
}

function loadSeedData() {
    const code = readFileSync(join(moapRoot, 'js', 'seed-data.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(code, sandbox);
    const seed = sandbox.window.F4_SEED_DATA;
    if (!seed) {
        throw new Error('F4_SEED_DATA not found in seed-data.js');
    }
    return seed;
}

function writeJson(path, data) {
    writeFileSync(path, JSON.stringify(data) + '\n', 'utf8');
}

const version = readBuildLabel();
const versionSlug = version.replace(/\./g, '');
const seed = loadSeedData();

const classes = seed.getFullClassData().map(function (row) {
    return Object.assign({}, row, {
        image: normalizeClassImagePath(row.id, row.image)
    });
});
const species = seed.getFullSpeciesData();
const genders = seed.getGenderData();
const vocations = staticVocationList();

mkdirSync(dataDir, { recursive: true });

const paths = {
    classes: `data/classes.v${versionSlug}.json`,
    species: `data/species.v${versionSlug}.json`,
    genders: `data/genders.v${versionSlug}.json`,
    vocations: `data/vocations.v${versionSlug}.json`
};

writeJson(join(moapRoot, paths.classes), classes);
writeJson(join(moapRoot, paths.species), species);
writeJson(join(moapRoot, paths.genders), genders);
writeJson(join(moapRoot, paths.vocations), vocations);

const manifest = {
    version: version,
    generated: new Date().toISOString(),
    source: 'seed-data.js',
    classes: paths.classes,
    species: paths.species,
    genders: paths.genders,
    vocations: paths.vocations
};

writeJson(join(dataDir, 'manifest.json'), manifest);

console.log('[export-templates-cdn] version:', version);
console.log('  classes:', classes.length, '->', paths.classes);
console.log('  species:', species.length, '->', paths.species);
console.log('  genders:', genders.length, '->', paths.genders);
console.log('  vocations:', vocations.length, '->', paths.vocations);
console.log('  manifest -> data/manifest.json');
