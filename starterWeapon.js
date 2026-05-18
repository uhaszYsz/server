/**
 * Mayor starter weapon wiring (two different names on purpose):
 *
 * 1) PLAYER LOOT (inventory / equipment JSON on `users` table)
 *    - Label shown in bag: "Butter Knife" (name / displayName) — cosmetic loot identity only.
 *    - `itemId` on that loot row = pointer into the `items` table (which script runs when equipped).
 *
 * 2) SERVER WEAPON DEFINITION (`items` table, loot editor "Weapon item id")
 *    - e.g. id 1 name "TestSword" — holds `codeChildren` (actual shoot type).
 *    - Never renamed to Butter Knife; buttermigrate does NOT touch `items`.
 *
 * `buttermigrate` finds loot rows whose *label* looks like the mayor knife, then sets `itemId`
 * to STARTER_WEAPON_ITEM_ID so shooting comes from TestSword (or whatever that row is).
 */
export const STARTER_WEAPON_ITEM_ID = 1;

/** Player loot label text only (not `items.name` / TestSword). */
export function lootRowSearchText(row) {
    if (!row || typeof row !== 'object') return '';
    const parts = [];
    if (row.name != null && String(row.name).trim()) parts.push(String(row.name));
    if (row.displayName != null && String(row.displayName).trim()) parts.push(String(row.displayName));
    return parts.join(' ').toLowerCase();
}

function lootRowLettersOnly(row) {
    return lootRowSearchText(row)
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** True if this inventory/equipment row is the mayor's Butter Knife loot (by label, not by shoot type). */
export function isButterKnifeLootRow(row) {
    if (!row || typeof row !== 'object') return false;
    const text = lootRowSearchText(row);
    if (text.includes('butter knife') || text.includes('butterknife')) return true;
    const letters = lootRowLettersOnly(row);
    if (letters.includes('butter') && letters.includes('knife')) return true;
    return false;
}

/** Broken grant: weapon loot slot but missing itemId link to `items` table. */
export function isLegacyUnlinkedMayorWeaponLoot(row) {
    if (!row || typeof row !== 'object') return false;
    if (isButterKnifeLootRow(row)) return true;
    const slot = String(row.slot || '').toLowerCase();
    if (slot !== 'weapon1' && slot !== 'weapon2' && slot !== 'weapon') return false;
    const id = row.itemId != null ? parseInt(row.itemId, 10) : NaN;
    if (Number.isInteger(id) && id >= 1) return false;
    const stats = row.stats;
    if (Array.isArray(stats) && stats.length > 0) return false;
    const letters = lootRowLettersOnly(row);
    if (!letters) return false;
    if (letters.includes('butter') || letters.includes('knife')) return true;
    return false;
}

export function isMayorStarterLootRow(row) {
    return isButterKnifeLootRow(row) || isLegacyUnlinkedMayorWeaponLoot(row);
}

/**
 * Fix player loot rows: keep Butter Knife label, set itemId → server weapon row (shoot type).
 * Does not modify `items` table or rename loot to TestSword.
 */
export function repairButterKnifeLootOnUser(user, starterWeaponId = STARTER_WEAPON_ITEM_ID) {
    if (!user || !Number.isInteger(starterWeaponId) || starterWeaponId < 1) return false;
    let changed = false;

    const fixRow = (row) => {
        if (!isMayorStarterLootRow(row)) return;
        if (Number(row.itemId) !== starterWeaponId) {
            row.itemId = starterWeaponId;
            changed = true;
        }
        const slot = row.slot != null ? String(row.slot) : '';
        if (!slot || slot === 'weapon') {
            row.slot = 'weapon1';
            changed = true;
        }
    };

    if (Array.isArray(user.inventory)) {
        for (let i = 0; i < user.inventory.length; i++) fixRow(user.inventory[i]);
    }
    if (user.equipment && typeof user.equipment === 'object') {
        fixRow(user.equipment.weapon1);
        fixRow(user.equipment.weapon2);
        fixRow(user.equipment.weapon);
    }
    return changed;
}

function describeLootRow(row, where, itemNamesById) {
    if (!row) return null;
    const itemId = row.itemId != null ? parseInt(row.itemId, 10) : NaN;
    const shootName = Number.isInteger(itemId) && itemId >= 1
        ? (itemNamesById.get(itemId) || '?')
        : null;
    return {
        where,
        lootLabel: row.displayName || row.name || '',
        slot: row.slot != null ? String(row.slot) : '',
        itemId: Number.isInteger(itemId) && itemId >= 1 ? itemId : null,
        shootTypeFromItemsTable: shootName,
        matches: isMayorStarterLootRow(row)
    };
}

/** Debug: player loot rows (not `items` table). */
export async function scanButterKnifeCandidates(db) {
    const users = await db.getAllUsers();
    const catalog = await db.getAllItems();
    const itemNamesById = new Map((catalog || []).map((it) => [it.id, it.name]));

    const hits = [];
    for (const user of users) {
        if (!user) continue;
        const userName = user.name || `user#${user.id}`;
        const rows = [];
        if (Array.isArray(user.inventory)) {
            for (let i = 0; i < user.inventory.length; i++) {
                const d = describeLootRow(user.inventory[i], `inventory[${i}]`, itemNamesById);
                if (d && (d.matches || (d.slot && d.slot.startsWith('weapon')))) rows.push(d);
            }
        }
        if (user.equipment) {
            ['weapon1', 'weapon2', 'weapon'].forEach((key) => {
                const d = describeLootRow(user.equipment[key], `equipment.${key}`, itemNamesById);
                if (d) rows.push(d);
            });
        }
        const matching = rows.filter((r) => r.matches);
        if (matching.length > 0 || rows.some((r) => r.slot.startsWith('weapon') && r.itemId == null)) {
            hits.push({ userName, rows, matching });
        }
    }
    return { usersTotal: users.length, hits, starterWeaponItemId: STARTER_WEAPON_ITEM_ID };
}

export async function migrateAllButterKnifeUsers(db) {
    const users = await db.getAllUsers();
    let usersChanged = 0;
    let knivesTouched = 0;

    const countKnives = (user) => {
        let n = 0;
        const tally = (row) => {
            if (isMayorStarterLootRow(row)) n++;
        };
        if (Array.isArray(user.inventory)) {
            for (let i = 0; i < user.inventory.length; i++) tally(user.inventory[i]);
        }
        if (user.equipment) {
            tally(user.equipment.weapon1);
            tally(user.equipment.weapon2);
            tally(user.equipment.weapon);
        }
        return n;
    };

    for (const user of users) {
        if (!user || !user.googleIdHash) continue;
        const before = countKnives(user);
        if (!repairButterKnifeLootOnUser(user)) continue;
        knivesTouched += before;
        usersChanged += 1;
        await db.updateUserByGoogleIdHash(user.googleIdHash, user);
    }

    return { usersTotal: users.length, usersChanged, knivesTouched };
}
