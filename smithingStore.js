import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { BUILTIN_SMITHING_SETS } from './smithingBuiltinSets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, 'data', 'smithingCatalog.json');

export const SMITH_KEY_TO_LOOT_SLOT = {
    weapon: 'weapon1',
    head: 'helmet',
    body: 'chest',
    legs: 'legs',
    gloves: 'gloves',
    boots: 'boots'
};

const BOSS_SLOT_DEFS = [
    { smithKey: 'weapon', equipKey: 'weapon1', short: 'WPN', titleHint: 'Weapon', slot: 'weapon1', slotLabel: 'Weapon', emoji: '⚔️', piece: 'Blade' },
    { smithKey: 'head', equipKey: 'helmet', short: 'HEAD', titleHint: 'Helmet', slot: 'helmet', slotLabel: 'Helmet', emoji: '🪖', piece: 'Helm' },
    { smithKey: 'body', equipKey: 'chest', short: 'BODY', titleHint: 'Chest', slot: 'chest', slotLabel: 'Chest', emoji: '🛡️', piece: 'Mail' },
    { smithKey: 'legs', equipKey: 'legs', short: 'LEGS', titleHint: 'Legs', slot: 'legs', slotLabel: 'Legs', emoji: '👖', piece: 'Greaves' },
    { smithKey: 'gloves', equipKey: 'gloves', short: 'HAND', titleHint: 'Gloves', slot: 'gloves', slotLabel: 'Gloves', emoji: '🧤', piece: 'Gloves' },
    { smithKey: 'boots', equipKey: 'boots', short: 'BOOT', titleHint: 'Boots', slot: 'boots', slotLabel: 'Boots', emoji: '👢', piece: 'Boots' }
];

let sets = null;

function cloneSets(src) {
    return JSON.parse(JSON.stringify(src));
}

export function getSmithingSets() {
    if (!sets) {
        throw new Error('Smithing catalog not loaded — call loadSmithingCatalog() first');
    }
    return sets;
}

export async function loadSmithingCatalog() {
    if (sets) return sets;
    try {
        const raw = await fs.readFile(CATALOG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            sets = parsed;
        } else if (parsed && Array.isArray(parsed.sets)) {
            sets = parsed.sets;
        } else {
            throw new Error('Invalid smithing catalog shape');
        }
    } catch (err) {
        if (err && err.code !== 'ENOENT') {
            console.warn('[Smithing] Could not read catalog, using builtin default:', err.message);
        }
        sets = cloneSets(BUILTIN_SMITHING_SETS);
        await saveSmithingCatalog();
    }
    return sets;
}

export async function saveSmithingCatalog() {
    if (!sets) return;
    await fs.mkdir(path.dirname(CATALOG_PATH), { recursive: true });
    await fs.writeFile(CATALOG_PATH, JSON.stringify({ sets }, null, 2), 'utf8');
}

export function createBossSet() {
    const setId = 'boss_' + Date.now();
    const bossCount = sets.filter((s) => String(s.setId || '').startsWith('boss_')).length + 1;
    const set = {
        setId,
        setName: 'Boss ' + bossCount,
        setEmoji: '👹',
        recipes: BOSS_SLOT_DEFS.map((d) => ({
            recipeId: setId + '_' + d.smithKey,
            smithKey: d.smithKey,
            equipKey: d.equipKey,
            short: d.short,
            titleHint: d.titleHint,
            output: {
                name: d.emoji + ' Placeholder ' + d.piece,
                displayName: 'Placeholder ' + d.piece,
                slot: d.slot,
                slotLabel: d.slotLabel,
                stats: []
            },
            requirements: []
        }))
    };
    sets.push(set);
    return set;
}

export function isBossSmithingSetId(setId) {
    return String(setId || '').startsWith('boss_');
}

export function deleteBossSet(setId) {
    const sid = String(setId || '').trim();
    if (!isBossSmithingSetId(sid)) return false;
    const idx = sets.findIndex((s) => s.setId === sid);
    if (idx < 0) return false;
    sets.splice(idx, 1);
    return true;
}

export function renameBossSet(setId, setName) {
    const sid = String(setId || '').trim();
    const name = String(setName || '').trim();
    if (!isBossSmithingSetId(sid) || !name) return null;
    const set = sets.find((s) => s.setId === sid);
    if (!set) return null;
    set.setName = name.slice(0, 80);
    return set;
}

export function saveSmithingRecipe(setId, recipeId, patch) {
    const sid = String(setId || '').trim();
    const rid = String(recipeId || '').trim();
    const set = sets.find((s) => s.setId === sid);
    if (!set) return null;
    const recipe = (set.recipes || []).find((r) => r.recipeId === rid);
    if (!recipe) return null;
    if (patch && patch.output && typeof patch.output === 'object') {
        recipe.output = { ...recipe.output, ...patch.output };
    }
    if (patch && Array.isArray(patch.requirements)) {
        recipe.requirements = patch.requirements.map((req) => ({
            matchName: String(req.matchName || '').trim(),
            label: req.label != null ? String(req.label) : String(req.matchName || '').trim(),
            qty: Math.max(0, parseInt(req.qty, 10) || 0)
        })).filter((req) => req.matchName && req.qty > 0);
    }
    if (patch && patch.short != null) recipe.short = String(patch.short);
    if (patch && patch.titleHint != null) recipe.titleHint = String(patch.titleHint);
    return recipe;
}
