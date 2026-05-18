// Mayor starter links loot "Butter Knife" to this server weapons row (loot editor weapon id).
export const STARTER_WEAPON_ITEM_ID = 1;

/** Combine name + displayName (emoji in name is fine — we match substrings, not exact titles). */
export function lootRowSearchText(row) {
    if (!row || typeof row !== 'object') return '';
    const parts = [];
    if (row.name != null && String(row.name).trim()) parts.push(String(row.name));
    if (row.displayName != null && String(row.displayName).trim()) parts.push(String(row.displayName));
    return parts.join(' ').toLowerCase();
}

/** Letters/digits only, for loose matching (strips ⚔️ etc.). */
function lootRowLettersOnly(row) {
    return lootRowSearchText(row)
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function isButterKnifeLootRow(row) {
    if (!row || typeof row !== 'object') return false;
    const text = lootRowSearchText(row);
    if (text.includes('butter knife') || text.includes('butterknife')) return true;
    const letters = lootRowLettersOnly(row);
    if (letters.includes('butter') && letters.includes('knife')) return true;
    return false;
}

/** Old mayor grants: weapon slot, no itemId, empty stats, name hints knife/butter/starter. */
export function isLegacyMayorStarterWeaponRow(row) {
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
    if (letters.includes('starter') && letters.includes('weapon')) return true;
    return false;
}

export function isMayorStarterWeaponRow(row) {
    return isButterKnifeLootRow(row) || isLegacyMayorStarterWeaponRow(row);
}

/**
 * Fix legacy mayor knives: set itemId to TestSword (etc.) and weapon1 slot. Returns true if user changed.
 */
export function repairButterKnifeLootOnUser(user, starterWeaponId = STARTER_WEAPON_ITEM_ID) {
    if (!user || !Number.isInteger(starterWeaponId) || starterWeaponId < 1) return false;
    let changed = false;

    const fixRow = (row) => {
        if (!isMayorStarterWeaponRow(row)) return;
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

function describeLootRow(row, where) {
    if (!row) return null;
    return {
        where,
        name: row.name != null ? String(row.name) : '',
        displayName: row.displayName != null ? String(row.displayName) : '',
        slot: row.slot != null ? String(row.slot) : '',
        itemId: row.itemId != null ? row.itemId : null,
        matches: isMayorStarterWeaponRow(row)
    };
}

/** Debug: print weapon rows that might be mayor knives (buttermigrate scan). */
export function scanButterKnifeCandidates(db) {
    return db.getAllUsers().then((users) => {
        const hits = [];
        for (const user of users) {
            if (!user) continue;
            const userName = user.name || `user#${user.id}`;
            const rows = [];
            if (Array.isArray(user.inventory)) {
                for (let i = 0; i < user.inventory.length; i++) {
                    const d = describeLootRow(user.inventory[i], `inventory[${i}]`);
                    if (d && (d.matches || d.slot.startsWith('weapon'))) rows.push(d);
                }
            }
            if (user.equipment) {
                ['weapon1', 'weapon2', 'weapon'].forEach((key) => {
                    const d = describeLootRow(user.equipment[key], `equipment.${key}`);
                    if (d) rows.push(d);
                });
            }
            const matching = rows.filter((r) => r.matches);
            if (matching.length > 0 || rows.some((r) => r.slot.startsWith('weapon') && (r.itemId == null || r.itemId === ''))) {
                hits.push({ userName, googleIdHash: user.googleIdHash, rows, matching });
            }
        }
        return { usersTotal: users.length, hits };
    });
}

/** One-shot batch migration (server console: buttermigrate). */
export async function migrateAllButterKnifeUsers(db) {
    const users = await db.getAllUsers();
    let usersChanged = 0;
    let knivesTouched = 0;

    const countKnives = (user) => {
        let n = 0;
        const tally = (row) => {
            if (isMayorStarterWeaponRow(row)) n++;
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
