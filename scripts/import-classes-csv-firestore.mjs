#!/usr/bin/env node
/**
 * Import classes CSV directly to Firestore (public write rules on classes collection).
 * Usage: node "MOAP Interface/scripts/import-classes-csv-firestore.mjs" "path/to/classes.csv"
 */

import { readFileSync } from 'fs';

const PROJECT_ID = 'feudalism4-rpg';
const FIRESTORE_BASE =
    'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
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

function parseClassRow(headers, values) {
    const classData = {};
    headers.forEach((header, index) => {
        const value = values[index] || '';
        switch (header) {
            case 'id':
            case 'name':
            case 'icon':
            case 'description':
            case 'image':
            case 'vocation_id':
                classData[header] = value || '';
                break;
            case 'prerequisites':
            case 'free_advances': {
                if (!value || !String(value).trim()) {
                    classData[header] = [];
                    break;
                }
                const valueStr = String(value).trim();
                const separator = valueStr.includes(';') ? ';' : ',';
                classData[header] = valueStr.split(separator).map((s) => s.trim()).filter(Boolean);
                break;
            }
            case 'xp_cost':
                classData[header] = parseInt(value, 10) || 0;
                break;
            case 'stat_minimums':
            case 'stat_maximums':
                try {
                    classData[header] = value ? JSON.parse(value) : {};
                } catch (e) {
                    classData[header] = {};
                }
                break;
            case 'enabled': {
                const ev = String(value || '').trim().toLowerCase();
                classData[header] = ev !== 'false' && ev !== '0';
                break;
            }
            default:
                break;
        }
    });
    if (!classData.id || !classData.name) {
        return null;
    }
    classData.enabled = classData.enabled !== false;
    classData.image = normalizeClassImagePath(classData.id, classData.image);
    classData.prerequisites = classData.prerequisites || [];
    classData.free_advances = classData.free_advances || [];
    classData.stat_minimums = classData.stat_minimums || {};
    classData.stat_maximums = classData.stat_maximums || {};
    classData.xp_cost = classData.xp_cost || 0;
    return classData;
}

function encodeFirestoreValue(value) {
    if (value === null || value === undefined) {
        return { nullValue: null };
    }
    if (typeof value === 'boolean') {
        return { booleanValue: value };
    }
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return { integerValue: String(value) };
        }
        return { doubleValue: value };
    }
    if (Array.isArray(value)) {
        return {
            arrayValue: {
                values: value.map((v) => encodeFirestoreValue(String(v)))
            }
        };
    }
    if (typeof value === 'object') {
        const fields = {};
        Object.keys(value).forEach((key) => {
            fields[key] = encodeFirestoreValue(value[key]);
        });
        return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
}

function encodeDocument(data) {
    const fields = {};
    Object.keys(data).forEach((key) => {
        if (key === 'id' || key === 'prerequisite') {
            return;
        }
        fields[key] = encodeFirestoreValue(data[key]);
    });
    return { fields };
}

async function upsertClass(cls) {
    const url = FIRESTORE_BASE + '/classes/' + encodeURIComponent(cls.id);
    const body = encodeDocument(cls);
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.error ? json.error.message : ('HTTP ' + res.status));
    }
    return json;
}

const csvPath = process.argv[2];
if (!csvPath) {
    console.error('Usage: node import-classes-csv-firestore.mjs <path-to-csv>');
    process.exit(1);
}

const text = readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter((line) => line.trim());
const headers = parseCSVLine(lines[0]);
const classes = [];

for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
        console.warn('Skipping row', i + 1, '- column mismatch');
        continue;
    }
    const row = parseClassRow(headers, values);
    if (row) {
        classes.push(row);
    }
}

console.log('[import-classes-csv-firestore] rows to import:', classes.length);

let ok = 0;
let fail = 0;
for (const cls of classes) {
    try {
        await upsertClass(cls);
        ok++;
        console.log('  ok', cls.id);
    } catch (e) {
        fail++;
        console.error('  FAIL', cls.id + ':', e.message);
    }
}

console.log('[import-classes-csv-firestore] done:', ok, 'ok,', fail, 'failed');
process.exit(fail > 0 ? 1 : 0);
