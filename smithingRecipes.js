/**
 * Smithing recipe logic (catalog data lives in smithingStore.js).
 * Requirements match inventory items by display label (name after leading emoji).
 */

import { getSmithingSets, SMITH_KEY_TO_LOOT_SLOT } from './smithingStore.js';

function getItemDisplayLabel(item) {
    if (!item || typeof item !== 'object') return '';
    if (typeof item.displayName === 'string' && item.displayName.trim()) {
        return item.displayName.trim();
    }
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) return '';
    const spaceIdx = name.indexOf(' ');
    return spaceIdx >= 0 ? name.slice(spaceIdx + 1).trim() : name;
}

function itemMatchesRequirement(item, matchName) {
    if (!item || !matchName) return false;
    const needle = String(matchName).trim().toLowerCase();
    if (!needle) return false;
    const label = getItemDisplayLabel(item).toLowerCase();
    return label === needle;
}

export function countMatchingInventoryItems(inventory, matchName) {
    if (!Array.isArray(inventory)) return 0;
    let n = 0;
    for (const item of inventory) {
        if (itemMatchesRequirement(item, matchName)) {
            const q = (typeof item.quantity === 'number' && item.quantity >= 1) ? Math.floor(item.quantity) : 1;
            n += q;
        }
    }
    return n;
}

export function inventoryMeetsRequirements(inventory, requirements) {
    if (!Array.isArray(requirements) || requirements.length === 0) return true;
    for (const req of requirements) {
        const need = Math.max(0, parseInt(req.qty, 10) || 0);
        if (need === 0) continue;
        const have = countMatchingInventoryItems(inventory, req.matchName);
        if (have < need) return false;
    }
    return true;
}

export function consumeRequirementsFromInventory(inventory, requirements) {
    if (!Array.isArray(inventory)) return false;
    const needs = (requirements || []).map((r) => ({
        matchName: r.matchName,
        remaining: Math.max(0, parseInt(r.qty, 10) || 0)
    })).filter((r) => r.remaining > 0);

    for (const need of needs) {
        let remaining = need.remaining;
        for (let i = inventory.length - 1; i >= 0 && remaining > 0; i--) {
            if (!itemMatchesRequirement(inventory[i], need.matchName)) continue;
            const item = inventory[i];
            const q = (typeof item.quantity === 'number' && item.quantity >= 1) ? Math.floor(item.quantity) : 1;
            if (q <= remaining) {
                remaining -= q;
                inventory.splice(i, 1);
            } else {
                inventory[i] = { ...item, quantity: q - remaining };
                remaining = 0;
            }
        }
        if (remaining > 0) return false;
    }
    return true;
}

export function findSmithingRecipe(recipeId) {
    const id = String(recipeId || '').trim();
    if (!id) return null;
    for (const set of getSmithingSets()) {
        for (const recipe of set.recipes || []) {
            if (recipe.recipeId === id) return { set, recipe };
        }
    }
    return null;
}

export function getSmithingCatalogForClient(isAdmin) {
    return getSmithingSets().map((set) => ({
        setId: set.setId,
        setName: set.setName,
        setEmoji: set.setEmoji,
        recipes: (set.recipes || []).map((r) => {
            const row = {
                recipeId: r.recipeId,
                smithKey: r.smithKey,
                equipKey: r.equipKey,
                short: r.short,
                titleHint: r.titleHint,
                name: r.output.name,
                slotLabel: r.output.slotLabel,
                stats: Array.isArray(r.output.stats) ? r.output.stats.map((s) => ({ ...s })) : [],
                requirements: (r.requirements || []).map((req) => ({
                    matchName: req.matchName,
                    label: req.label || req.matchName,
                    qty: req.qty
                }))
            };
            if (r.output.armorIcon && typeof r.output.armorIcon === 'object' && r.output.armorIcon.part) {
                row.armorIcon = {
                    part: String(r.output.armorIcon.part),
                    frame: parseInt(r.output.armorIcon.frame, 10) || 0
                };
            }
            if (isAdmin) {
                row.adminEdit = {
                    setId: set.setId,
                    output: JSON.parse(JSON.stringify(r.output)),
                    requirements: (r.requirements || []).map((req) => ({ ...req }))
                };
            }
            return row;
        })
    }));
}

export function getRecipeOutputLootItem(recipe) {
    if (!recipe || !recipe.output) return null;
    const o = recipe.output;
    const slot = o.slot || SMITH_KEY_TO_LOOT_SLOT[recipe.smithKey] || 'none';
    const item = {
        name: o.name,
        displayName: o.displayName,
        slot,
        stats: Array.isArray(o.stats) ? o.stats.map((s) => ({ ...s })) : []
    };
    if (o.itemId != null) {
        const id = parseInt(o.itemId, 10);
        if (Number.isInteger(id) && id >= 1) item.itemId = id;
    }
    if (o.armorIcon && typeof o.armorIcon === 'object' && o.armorIcon.part) {
        const frame = parseInt(o.armorIcon.frame, 10);
        item.armorIcon = { part: String(o.armorIcon.part), frame: Number.isFinite(frame) ? frame : 0 };
    }
    return item;
}

export { SMITH_KEY_TO_LOOT_SLOT };
