// Mayor starter links loot "Butter Knife" to this server weapons row (loot editor weapon id).
export const STARTER_WEAPON_ITEM_ID = 1;

export function isButterKnifeLootRow(row) {
    if (!row || typeof row !== 'object') return false;
    const n = String(row.displayName || row.name || '').toLowerCase();
    return n.indexOf('butter knife') !== -1;
}

/**
 * Fix legacy mayor knives: set itemId to TestSword (etc.) and weapon1 slot. Returns true if user changed.
 */
export function repairButterKnifeLootOnUser(user, starterWeaponId = STARTER_WEAPON_ITEM_ID) {
    if (!user || !Number.isInteger(starterWeaponId) || starterWeaponId < 1) return false;
    let changed = false;

    const fixRow = (row) => {
        if (!isButterKnifeLootRow(row)) return;
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

/** One-shot batch migration (server console: buttermigrate). */
export async function migrateAllButterKnifeUsers(db) {
    const users = await db.getAllUsers();
    let usersChanged = 0;
    let knivesTouched = 0;

    const countKnives = (user) => {
        let n = 0;
        const tally = (row) => {
            if (isButterKnifeLootRow(row)) n++;
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
