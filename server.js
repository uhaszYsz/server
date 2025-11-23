// server.js
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Encoder } from 'msgpackr';

const msgpack = new Encoder({
    useRecords: false
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const registeredUsersPath = path.join(__dirname, 'registeredUsers.json');
const levelsDirectory = path.join(__dirname, 'levels');
const campaignLevelsDirectory = path.join(__dirname, 'campaignLevels');
const weaponsDirectory = path.join(__dirname, 'weapons');
const DEFAULT_CAMPAIGN_LEVEL_FILE = 'lev.json';

const MAX_LEVEL_NAME_LENGTH = 64;
const MAX_LEVEL_DATA_BYTES = 256 * 1024; // 256 KB
const LEVEL_SLUG_REGEX = /^[a-z0-9]+[a-z0-9-_]*$/;

await Promise.all([
    fs.mkdir(levelsDirectory, { recursive: true }),
    fs.mkdir(campaignLevelsDirectory, { recursive: true }),
    fs.mkdir(weaponsDirectory, { recursive: true })
]);

// Equipment slots
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'hat', 'ring', 'amulet'];

// Available stats for items
const ITEM_STATS = ['maxHp', 'maxMp', 'MpRegen', 'damage', 'defence', 'magic', 'critical', 'block', 'knockback'];

const PASSIVE_ABILITIES = ['healing_aura', 'super_hit', 'bullet_cleanse'];

// Generate a random item for a given slot
function generateRandomItem(slotName) {
    // Get 2 random stats from the available stats
    const availableStats = [...ITEM_STATS];
    const selectedStats = [];
    
    // Pick 2 random stats
    for (let i = 0; i < 2; i++) {
        const randomIndex = Math.floor(Math.random() * availableStats.length);
        selectedStats.push(availableStats[randomIndex]);
        availableStats.splice(randomIndex, 1); // Remove selected stat to avoid duplicates
    }
    
    // Create stat bonuses object with +1 for each selected stat
    const statBonuses = {};
    selectedStats.forEach(stat => {
        statBonuses[stat] = 1;
    });
    
    return {
        name: slotName,
        stats: statBonuses
    };
}

// Default stats for new players
function getDefaultStats() {
    return {
        maxHp: 100,
        maxMp: 50,
        MpRegen: 1.0,
        damage: 10,
        defence: 5,
        magic: 5,
        critical: 5,
        block: 5,
        knockback: 0
    };
}

// Initialize inventory and equipment for new players
function initializeInventoryAndEquipment() {
    const starterWeapon = {
        name: 'weapon',
        displayName: 'Sword',
        weaponFile: 'test',
        stats: {}
    };

    return {
        inventory: [starterWeapon],
        equipment: {
            weapon: null,
            armor: null,
            hat: null,
            ring: null,
            amulet: null
        },
        weaponData: null,
        passiveAbility: null
    };
}

function normalizeLevelName(rawName) {
    if (typeof rawName !== 'string') {
        throw new Error('Level name must be a string');
    }

    const trimmed = rawName.trim();
    if (!trimmed) {
        throw new Error('Level name cannot be empty');
    }

    if (trimmed.length > MAX_LEVEL_NAME_LENGTH) {
        throw new Error('Level name is too long');
    }

    return trimmed;
}

function ensureValidSlug(slug) {
    if (typeof slug !== 'string') {
        throw new Error('Invalid level identifier');
    }

    const normalized = slug.trim().toLowerCase();

    if (!normalized || normalized === '.' || normalized === '..') {
        throw new Error('Invalid level identifier');
    }

    if (normalized.length > MAX_LEVEL_NAME_LENGTH) {
        throw new Error('Invalid level identifier');
    }

    if (!LEVEL_SLUG_REGEX.test(normalized)) {
        throw new Error('Invalid level identifier');
    }

    return normalized;
}

function createLevelSlug(name) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_LEVEL_NAME_LENGTH);

    try {
        return ensureValidSlug(slug);
    } catch {
        throw new Error('Level name contains invalid characters');
    }
}

function sanitizeLevelPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid level payload');
    }

    const { data } = payload;
    const normalizedName = normalizeLevelName(payload.name);
    const slug = createLevelSlug(normalizedName);

    let serializedData;

    if (typeof data === 'string') {
        serializedData = data;
    } else {
        try {
            serializedData = JSON.stringify(data);
            payload.data = JSON.parse(serializedData);
        } catch (error) {
            throw new Error('Level data must be JSON serializable');
        }
    }

    if (Buffer.byteLength(serializedData, 'utf8') > MAX_LEVEL_DATA_BYTES) {
        throw new Error('Level data is too large');
    }

    return {
        fileName: slug,
        sanitizedPayload: {
            name: normalizedName,
            data: payload.data
        }
    };
}

function sanitizeWeaponPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid weapon payload');
    }

    const rawName = typeof payload.name === 'string' ? payload.name : 'Weapon';
    const normalizedName = normalizeLevelName(rawName);

    const weaponSection = (payload.weapon && typeof payload.weapon === 'object')
        ? payload.weapon
        : {};

    const emitters = Array.isArray(weaponSection.emitters) ? weaponSection.emitters : [];
    if (emitters.length > 500) {
        throw new Error('Weapon has too many emitters');
    }

    const sanitizedEmitters = emitters.map(emitter => {
        if (!emitter || typeof emitter !== 'object') {
            return null;
        }

        const x = Number(emitter.x);
        const y = Number(emitter.y);

        return {
            id: emitter.id ?? null,
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            autoCycles: Array.isArray(emitter.autoCycles) ? emitter.autoCycles : [],
            cycleCounters: (emitter.cycleCounters && typeof emitter.cycleCounters === 'object') ? emitter.cycleCounters : { onShoot: {}, onShotgun: {}, onStream: {} },
            start: emitter.start || null,
            current: emitter.current || null,
            loadedFrom: typeof emitter.loadedFrom === 'string' ? emitter.loadedFrom : null
        };
    }).filter(Boolean);

    const sanitized = {
        name: normalizedName,
        weapon: {
            emitters: sanitizedEmitters
        },
        timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString()
    };

    const serialized = JSON.stringify(sanitized);
    if (Buffer.byteLength(serialized, 'utf8') > 200 * 1024) {
        throw new Error('Weapon data is too large');
    }

    return sanitized;
}

async function loadWeaponDataBySlug(slug) {
    try {
        const validSlug = createLevelSlug(slug);
        const weaponPath = path.resolve(weaponsDirectory, `${validSlug}.json`);
        const relative = path.relative(weaponsDirectory, weaponPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('Invalid weapon path');
        }
        const contents = await fs.readFile(weaponPath, 'utf8');
        const parsed = JSON.parse(contents);
        return parsed.weapon || parsed;
    } catch (error) {
        console.error('Failed to load weapon data for slug', slug, error);
        return null;
    }
}

async function buildRoomWeaponData(clientsCollection) {
    const data = [];
    if (!clientsCollection) return data;
    let needsSave = false;

    for (const client of clientsCollection) {
        if (!client || !client.username) continue;
        const user = registeredUsers.find(u => u.username === client.username);
        if (!user) continue;

        if ((!user.weaponData || !user.weaponData.emitters || user.weaponData.emitters.length === 0) &&
            user.equipment && user.equipment.weapon && user.equipment.weapon.weaponFile) {
            const slug = user.equipment.weapon.weaponFile;
            const weaponData = await loadWeaponDataBySlug(slug);
            if (weaponData) {
                user.weaponData = { ...weaponData, slug };
                needsSave = true;
            }
        }

        data.push({
            username: client.username,
            playerId: client.id,
            weaponData: user.weaponData || null
        });
    }

    if (needsSave) {
        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
    }

    return data;
}

async function buildPlayerInitDataForRoom(roomName, joiningClientId) {
    const payload = [];
    let needsSave = false;

    // Get the party of the joining client (if any)
    const joiningClientParty = joiningClientId ? findPartyByMemberId(joiningClientId) : null;

    for (const client of clients.values()) {
        if (!client || !client.username) continue;
        if (roomName && client.room !== roomName) continue;

        const user = registeredUsers.find(u => u.username === client.username);
        if (!user) continue;

        // Check if this client is in the same party as the joining client
        const clientParty = findPartyByMemberId(client.id);
        const isInSameParty = joiningClientParty && clientParty && 
                              joiningClientParty.leader === clientParty.leader &&
                              joiningClientParty.members.has(client.id);

        // Always include id and username
        const entry = {
            id: client.id,
            username: client.username
        };

        // Only include weaponData and stats if in the same party
        if (isInSameParty) {
            if ((!user.weaponData || !user.weaponData.emitters || user.weaponData.emitters.length === 0) &&
                user.equipment && user.equipment.weapon && user.equipment.weapon.weaponFile) {
                const slug = user.equipment.weapon.weaponFile;
                const weaponData = await loadWeaponDataBySlug(slug);
                if (weaponData) {
                    user.weaponData = { ...weaponData, slug };
                    needsSave = true;
                }
            }

            entry.weaponData = user.weaponData || null;
            entry.stats = user.stats || null;
        }

        console.log('[RoomWeapons] Init payload entry:', {
            clientId: client.id,
            username: client.username,
            isInSameParty: isInSameParty,
            hasWeaponData: !!(entry.weaponData && entry.weaponData.emitters && entry.weaponData.emitters.length),
            hasStats: !!entry.stats
        });

        payload.push(entry);
    }

    if (needsSave) {
        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
    }

    return payload;
}

// Migrate existing users to have stats, inventory, and equipment if they don't have them
function migrateUserStats(user) {
    let needsSave = false;
    
    if (!user.stats) {
        user.stats = getDefaultStats();
        needsSave = true;
    }
    
    if (!user.inventory) {
        user.inventory = [];
        needsSave = true;
    }

    const hasWeaponItem = user.inventory.some(item => item && item.weaponFile);
    if (!hasWeaponItem) {
        user.inventory.push({
            name: 'weapon',
            displayName: 'Sword',
            weaponFile: 'test',
            stats: {}
        });
        needsSave = true;
    } else {
        user.inventory = user.inventory.map(item => {
            if (item && typeof item.weaponFile === 'string' && item.weaponFile === 'starter-sword') {
                return {
                    ...item,
                    weaponFile: 'test'
                };
            }
            return item;
        });
    }
    
    if (!user.equipment) {
        user.equipment = {
            weapon: null,
            armor: null,
            hat: null,
            ring: null,
            amulet: null
        };
        needsSave = true;
    } else if (user.equipment.weapon) {
        if (!user.equipment.weapon.weaponFile || user.equipment.weapon.weaponFile === 'starter-sword') {
            user.equipment.weapon.weaponFile = 'test';
            if (!user.equipment.weapon.displayName) {
                user.equipment.weapon.displayName = 'Sword';
            }
            needsSave = true;
        }
    }
    
    // Add weaponData field if it doesn't exist
    if (user.weaponData === undefined) {
        user.weaponData = null;
        needsSave = true;
    }

    if (user.equipment && user.equipment.weapon && user.equipment.weapon.weaponFile) {
        if (!user.weaponData || !user.weaponData.slug || user.weaponData.slug !== user.equipment.weapon.weaponFile) {
            needsSave = true;
        }
    }
    
    if (user.passiveAbility === undefined) {
        user.passiveAbility = null;
        needsSave = true;
    }
    
    return { user, needsSave };
}

let registeredUsers = [];
try {
    const data = await fs.readFile(registeredUsersPath);
    registeredUsers = JSON.parse(data);
    // Migrate existing users to include stats, inventory, and equipment
    let needsSave = false;
    registeredUsers = registeredUsers.map(user => {
        const { user: migratedUser, needsSave: userNeedsSave } = migrateUserStats(user);
        if (userNeedsSave) needsSave = true;
        return migratedUser;
    });
    // Save migrated data back if any migration occurred
    if (needsSave) {
        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
    }
} catch (error) {
    if (error.code === 'ENOENT') {
        await fs.writeFile(registeredUsersPath, JSON.stringify([]));
    } else {
        throw error;
    }
}

let globalTimer = Date.now();

// Create WebSocket server on port 8080
const wss = new WebSocketServer({ port: 8080 });
console.log('✅ WebSocket server running on ws://localhost:8080');

// Server tick
setInterval(() => {
    globalTimer = Date.now();
    // Future server-side logic can go here
}, 33.3);

// Store rooms as a Map: roomName -> {type: 'lobby'|'game', clients: Set}
const rooms = new Map();
let nextClientId = 1;
const clients = new Map(); // Map to store clients by ID
const parties = new Map(); // Map to store parties

function findPartyByMemberId(memberId) {
    for (const party of parties.values()) {
        if (party.members.has(memberId)) {
            return party;
        }
    }
    return null;
}

function ensurePartyForClient(client) {
    let party = findPartyByMemberId(client.id);
    if (!party) {
        party = { leader: client.id, members: new Set([client.id]) };
        parties.set(client.id, party);
    }
    return party;
}

function broadcastPartyUpdate(party) {
    if (!party) return;
    const partyDetails = {
        leader: clients.get(party.leader)?.username || null,
        members: [...party.members].map(id => clients.get(id)?.username).filter(Boolean)
    };

    for (const memberId of party.members) {
        const memberClient = clients.get(memberId);
        if (memberClient && memberClient.readyState === (memberClient.OPEN ?? memberClient.constructor?.OPEN)) {
            memberClient.send(msgpack.encode({ type: 'partyUpdate', party: partyDetails }));
        }
    }
}

async function loadCampaignLevelByName(levelFileName) {
    if (!levelFileName || typeof levelFileName !== 'string') {
        return null;
    }

    const trimmed = levelFileName.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
        throw new Error('Invalid level file name');
    }

    const levelFilePath = path.join(campaignLevelsDirectory, trimmed);
    const fileContents = await fs.readFile(levelFilePath, 'utf8');
    return JSON.parse(fileContents);
}

async function sendPartyToGameRoom(party, options = {}) {
    const leaderClient = clients.get(party.leader);
    if (!leaderClient) {
        return;
    }

    const openState = leaderClient.OPEN ?? leaderClient.constructor?.OPEN ?? 1;
    const {
        levelFileName: requestedLevelFile = null,
        stageData: providedStageData = null
    } = options;

    let resolvedLevelFile = requestedLevelFile;
    if (resolvedLevelFile && typeof resolvedLevelFile === 'string') {
        resolvedLevelFile = resolvedLevelFile.trim();
    }

    let resolvedStageData = providedStageData;
    if (!resolvedStageData && resolvedLevelFile) {
        try {
            const levelFileContents = await loadCampaignLevelByName(resolvedLevelFile);
            resolvedStageData = levelFileContents?.data || levelFileContents;
        } catch (error) {
            console.error(`Failed to load campaign level "${resolvedLevelFile}":`, error);
            resolvedLevelFile = null;
        }
    }

    if (!resolvedStageData && !resolvedLevelFile) {
        resolvedLevelFile = DEFAULT_CAMPAIGN_LEVEL_FILE;
    }

    if (!resolvedStageData && resolvedLevelFile) {
        try {
            const levelFileContents = await loadCampaignLevelByName(resolvedLevelFile);
            resolvedStageData = levelFileContents?.data || levelFileContents;
        } catch (error) {
            console.error(`Failed to load campaign level "${resolvedLevelFile}":`, error);
            if (leaderClient.readyState === openState) {
                leaderClient.send(msgpack.encode({ type: 'error', message: 'Unable to load level data for game room.' }));
            }
            return;
        }
    }

    const gameRoomName = leaderClient.username;
    let roomEntry = rooms.get(gameRoomName);
    if (!roomEntry) {
        roomEntry = { type: 'game', level: resolvedLevelFile || DEFAULT_CAMPAIGN_LEVEL_FILE, clients: new Set() };
    } else {
        roomEntry.type = 'game';
        roomEntry.level = resolvedLevelFile || DEFAULT_CAMPAIGN_LEVEL_FILE;
        if (!roomEntry.clients) {
            roomEntry.clients = new Set();
        }
    }
    rooms.set(gameRoomName, roomEntry);

    if (resolvedStageData) {
        for (const memberId of party.members) {
            const memberClient = clients.get(memberId);
            if (memberClient && memberClient.readyState === openState) {
                memberClient.send(msgpack.encode({
                    type: 'stageData',
                    stageData: resolvedStageData
                }));
            }
        }
    }

    for (const memberId of party.members) {
        const memberClient = clients.get(memberId);
        if (memberClient && memberClient.readyState === openState) {
            memberClient.send(msgpack.encode({
                type: 'joinGameRoom',
                roomName: gameRoomName,
                level: resolvedLevelFile || null
            }));
        }
    }
}

wss.on('connection', (ws) => {
  ws.id = nextClientId++;
  ws.room = null; // Track which room the client is in
  clients.set(ws.id, ws);
  ensurePartyForClient(ws);

  ws.on('message', async (message) => {
    try {
      const data = msgpack.decode(message);
      
      if (data.type === 'quickRegister') {
        const username = `user-${Date.now()}`;
        const password = crypto.randomBytes(8).toString('hex');
        const inventoryData = initializeInventoryAndEquipment();
        const newUser = {
            username,
            password,
            stats: getDefaultStats(),
            inventory: inventoryData.inventory,
            equipment: inventoryData.equipment,
            weaponData: inventoryData.weaponData,
            passiveAbility: inventoryData.passiveAbility
        };
        registeredUsers.push(newUser);
        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
        ws.send(msgpack.encode({ type: 'registerSuccess', username, password }));
      } else if (data.type === 'login') {
        const user = registeredUsers.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            ws.username = user.username; // Store username on successful login
            ws.send(msgpack.encode({ 
                type: 'loginSuccess', 
                username: ws.username
            }));
            const party = ensurePartyForClient(ws);
            broadcastPartyUpdate(party);
        } else {
            ws.send(msgpack.encode({ type: 'loginFail' }));
        }
      } else if (data.type === 'getPlayerData') {
        // Send current player data to client
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        const user = registeredUsers.find(u => u.username === ws.username);
        if (user) {
            let userDataChanged = false;
            if (user.equipment && user.equipment.weapon) {
                if (user.equipment.weapon.weaponFile === 'starter-sword') {
                    user.equipment.weapon.weaponFile = 'playa';
                    userDataChanged = true;
                }
                if (!user.equipment.weapon.displayName) {
                    user.equipment.weapon.displayName = 'Sword';
                    userDataChanged = true;
                }
                const slug = user.equipment.weapon.weaponFile || 'playa';
                if (!user.weaponData || user.weaponData.slug !== slug) {
                    let weaponData = await loadWeaponDataBySlug(slug);
                    if (!weaponData && slug !== 'playa') {
                        weaponData = await loadWeaponDataBySlug('playa');
                        user.equipment.weapon.weaponFile = 'playa';
                    }
                    if (weaponData) {
                        user.weaponData = { ...weaponData, slug: user.equipment.weapon.weaponFile || 'playa' };
                        userDataChanged = true;
                    }
                }
            }
            if (userDataChanged) {
                await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
            }
            ws.send(msgpack.encode({
                type: 'playerData',
                playerData: {
                    stats: user.stats,
                    inventory: user.inventory,
                    equipment: user.equipment,
                    passiveAbility: user.passiveAbility || null
                }
            }));
        } else {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
        }
      } else if (data.type === 'equipItem') {
        // Handle equipping an item
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        const userIndex = registeredUsers.findIndex(u => u.username === ws.username);
        if (userIndex === -1) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        const user = registeredUsers[userIndex];
        const inventoryIndex = data.inventoryIndex;
        
        // Validate inventory index
        if (inventoryIndex === undefined || inventoryIndex < 0 || inventoryIndex >= user.inventory.length) {
            ws.send(msgpack.encode({ type: 'error', message: 'Invalid inventory index' }));
            return;
        }
        
        const item = user.inventory[inventoryIndex];
        if (!item) {
            ws.send(msgpack.encode({ type: 'error', message: 'Item not found in inventory' }));
            return;
        }
        
        // Determine slot from item name
        const slotName = item.name.toLowerCase();
        if (!EQUIPMENT_SLOTS.includes(slotName)) {
            ws.send(msgpack.encode({ type: 'error', message: 'Invalid equipment slot' }));
            return;
        }
        
        // Remove item from inventory
        user.inventory.splice(inventoryIndex, 1);
        
        // If there's already an item in that slot, move it back to inventory
        if (user.equipment[slotName]) {
            user.inventory.push(user.equipment[slotName]);
        }
        
        // Sanitize weapon file slug if present
        if (item.weaponFile && typeof item.weaponFile === 'string') {
            try {
                item.weaponFile = createLevelSlug(item.weaponFile);
            } catch {
                item.weaponFile = createLevelSlug('test');
            }
        }

        // Equip the new item
        user.equipment[slotName] = item;

        if (slotName === 'weapon') {
            const weaponData = await loadWeaponDataBySlug(item.weaponFile || 'test');
            if (weaponData) {
                user.weaponData = { ...weaponData, slug: item.weaponFile || 'test' };
            }
        }
        
        // Recalculate stats (base stats + equipment bonuses)
        const baseStats = getDefaultStats();
        Object.keys(baseStats).forEach(statKey => {
            user.stats[statKey] = baseStats[statKey];
        });
        
        // Apply equipment bonuses
        Object.values(user.equipment).forEach(equippedItem => {
            if (equippedItem && equippedItem.stats) {
                Object.entries(equippedItem.stats).forEach(([stat, bonus]) => {
                    if (user.stats[stat] !== undefined) {
                        user.stats[stat] += bonus;
                    }
                });
            }
        });
        
        // Save to file
        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
        
        // Send success response with updated player data
        ws.send(msgpack.encode({
            type: 'equipSuccess',
            playerData: {
                stats: user.stats,
                inventory: user.inventory,
                equipment: user.equipment,
                passiveAbility: user.passiveAbility || null
            }
        }));
        
        console.log(`User ${ws.username} equipped ${item.name} in ${slotName} slot`);
      } else if (data.type === 'setPassiveAbility') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        const abilityId = typeof data.ability === 'string' ? data.ability : null;
        if (abilityId !== null && !PASSIVE_ABILITIES.includes(abilityId)) {
            ws.send(msgpack.encode({ type: 'error', message: 'Invalid passive ability selection' }));
            return;
        }

        const userIndex = registeredUsers.findIndex(u => u.username === ws.username);
        if (userIndex === -1) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }

        const user = registeredUsers[userIndex];
        user.passiveAbility = abilityId;

        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));

        const payload = {
            stats: user.stats,
            inventory: user.inventory,
            equipment: user.equipment,
            passiveAbility: user.passiveAbility || null
        };

        ws.send(msgpack.encode({
            type: 'passiveAbilityUpdated',
            passiveAbility: user.passiveAbility || null,
            playerData: payload
        }));

        console.log(`User ${ws.username} set passive ability to ${user.passiveAbility || 'none'}`);
      } else if (data.type === 'join') {
        const { room } = data;

        // Remove from old room if any
        if (ws.room && rooms.has(ws.room)) {
          const oldRoom = rooms.get(ws.room);
          oldRoom.clients.delete(ws);
        }

        // Add to new room
        ws.room = room;
        if (!rooms.has(room)) {
          // Default room type is 'lobby'
          rooms.set(room, { type: 'lobby', level: DEFAULT_CAMPAIGN_LEVEL_FILE, clients: new Set() });
        }
        const updatedRoom = rooms.get(room);
        if (!updatedRoom.clients) {
          updatedRoom.clients = new Set();
        }
        if (updatedRoom.level === undefined) {
          updatedRoom.level = DEFAULT_CAMPAIGN_LEVEL_FILE;
        }
        updatedRoom.clients.add(ws);

        const roomData = rooms.get(room);
        ws.send(msgpack.encode({ type: 'roomUpdate', room: room, roomType: roomData.type, level: roomData.level ?? null }));
        console.log(`Client joined room: ${room} (type: ${roomData.type})`);

        if (roomData.type === 'game') {
            const initPayload = await buildPlayerInitDataForRoom(room, ws.id);
            if (initPayload.length > 0) {
                console.log(`[RoomWeapons] Sending playerInitData to ${ws.username} with ${initPayload.length} entries`);
                ws.send(msgpack.encode({
                    type: 'playerInitData',
                    players: initPayload
                }));
            }

            const weaponPayload = await buildRoomWeaponData(roomData.clients ? [...roomData.clients] : []);
            if (weaponPayload.length > 0) {
                const openState = ws.OPEN ?? ws.constructor?.OPEN ?? 1;
                for (const client of roomData.clients) {
                    if (client && client.readyState === openState) {
                        client.send(msgpack.encode({
                            type: 'roomWeaponData',
                            roomWeaponData: weaponPayload
                        }));
                    }
                }
            }
        }
      }

      // When a client sends a message to their room
      else if (data.type === 'message' && ws.room) {
        const room = rooms.get(ws.room);
        if (!room) return;
        const roomClients = room.clients;

        // Add timestamp for future delivery (server time + 1 second)
        const targetTime = globalTimer + 1000;

        // Broadcast to all clients in the same room INCLUDING the sender
        // This ensures consistent buffering behavior - everyone receives the same data with same delay
        for (const client of roomClients) {
          // Include the sender so they receive their own data back for buffer system
          if (client.readyState === ws.OPEN) {
            client.send(msgpack.encode({
              type: 'playerUpdate',
              id: ws.id,
              data: data.text,
              targetTime: targetTime
            }));
          }
        }
      } else if (data.type === 'partyLoadLevel') {
        const party = findPartyByMemberId(ws.id);
        if (party && party.leader === ws.id) {
            party.stageData = data.stageData;
            party.pendingStageConfirmations = new Set(party.members);

            for (const memberId of party.members) {
                const memberClient = clients.get(memberId);
                if (memberClient && memberClient.readyState === ws.OPEN) {
                    memberClient.send(msgpack.encode({ type: 'stageData', stageData: data.stageData }));
                }
            }
        }
      } else if (data.type === 'partyStartLevel') {
        const party = findPartyByMemberId(ws.id);
        if (!party) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'error', message: 'Party not found.' }));
            }
            return;
        }
        if (party.leader !== ws.id) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'error', message: 'Only the party leader can start the level.' }));
            }
            return;
        }

        const requestedLevel = typeof data.level === 'string' && data.level.trim()
            ? data.level.trim()
            : DEFAULT_CAMPAIGN_LEVEL_FILE;

        try {
            await sendPartyToGameRoom(party, { levelFileName: requestedLevel });
        } catch (error) {
            console.error('Failed to start level for party:', error);
        }
      } else if (data.type === 'stageDataReceived') {
        const party = findPartyByMemberId(ws.id);
        if (party && party.pendingStageConfirmations) {
            party.pendingStageConfirmations.delete(ws.id);

            if (party.pendingStageConfirmations.size === 0) {
                const stageDataForParty = party.stageData;
                const levelFileForParty = party.pendingLevelFileName ?? null;
                delete party.pendingStageConfirmations;
                delete party.stageData;
                delete party.pendingLevelFileName;
                await sendPartyToGameRoom(party, { stageData: stageDataForParty, levelFileName: levelFileForParty });
            }
        }
      } else if (data.type === 'partyInvite') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'You must be logged in to invite players.' }));
            return;
        }

        if (!data.targetUsername || typeof data.targetUsername !== 'string') {
            ws.send(msgpack.encode({ type: 'partyInviteError', message: 'Invalid target player.' }));
            return;
        }

        const normalizedTarget = data.targetUsername.trim();
        if (!normalizedTarget || normalizedTarget.toLowerCase() === 'system') {
            ws.send(msgpack.encode({ type: 'partyInviteError', message: 'Cannot invite that player.' }));
            return;
        }

        if (normalizedTarget === ws.username) {
            ws.send(msgpack.encode({ type: 'partyInviteError', message: 'You cannot invite yourself.' }));
            return;
        }

        const targetClient = [...clients.values()].find(c => c.username === normalizedTarget);
        if (!targetClient || targetClient.readyState !== ws.OPEN) {
            ws.send(msgpack.encode({ type: 'partyInviteError', message: `${normalizedTarget} is not online.` }));
            return;
        }

        targetClient.send(msgpack.encode({ type: 'partyInviteReceived', fromUsername: ws.username }));
        ws.send(msgpack.encode({ type: 'partyInviteSent', targetUsername: normalizedTarget }));
      } else if (data.type === 'partyAccept') {
        const inviterClient = [...clients.values()].find(c => c.username === data.fromUsername);
        if (!inviterClient) return;
        const inviterParty = findPartyByMemberId(inviterClient.id);
        if (!inviterParty) return;

        const currentParty = findPartyByMemberId(ws.id);
        if (currentParty) {
            currentParty.members.delete(ws.id);
            if (currentParty.members.size === 0) {
                parties.delete(currentParty.leader);
            } else if (currentParty.leader === ws.id) {
                currentParty.leader = currentParty.members.values().next().value;
                broadcastPartyUpdate(currentParty);
            }
        }

        inviterParty.members.add(ws.id);

        broadcastPartyUpdate(inviterParty);
      } else if (data.type === 'chatMessage') {
        const room = rooms.get(ws.room);
        if (!room || !ws.username) return;
        const roomClients = room.clients;

        for (const client of roomClients) {
            if (client.readyState === ws.OPEN) {
                client.send(msgpack.encode({
                    type: 'chatMessage',
                    username: ws.username,
                    message: data.message
                }));
            }
        }
      } else if (data.type === 'timeSync') {
        ws.send(msgpack.encode({
          type: 'timeSync',
          clientTime: data.clientTime,
          serverTime: globalTimer
        }));
      } else if (data.type === 'enemyCreated') {
        const party = findPartyByMemberId(ws.id);
        if (party && party.leader === ws.id) { // Only leader can spawn enemies
            for (const memberId of party.members) {
                if (memberId !== ws.id) { // Don't send back to the leader
                    const memberClient = clients.get(memberId);
                    if (memberClient && memberClient.readyState === ws.OPEN) {
                        memberClient.send(msgpack.encode({ type: 'enemyCreated', enemyData: data.enemyData }));
                    }
                }
            }
        }
      } else if (data.type === 'loadWeapon') {
        // Handle weapon loading - store weapon data in user profile
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        const userIndex = registeredUsers.findIndex(u => u.username === ws.username);
        if (userIndex === -1) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        const user = registeredUsers[userIndex];
        
        // Store weapon data
        const incomingWeapon = data.weaponData ? { ...data.weaponData } : null;
        if (!incomingWeapon || !Array.isArray(incomingWeapon.emitters)) {
            ws.send(msgpack.encode({ type: 'error', message: 'Invalid weapon data payload' }));
            return;
        }

        let incomingSlug = incomingWeapon.slug || (incomingWeapon.name ? createLevelSlug(incomingWeapon.name) : null);
        if (!incomingSlug && user.equipment?.weapon?.weaponFile) {
            incomingSlug = user.equipment.weapon.weaponFile;
        }
        if (incomingSlug) {
            incomingWeapon.slug = incomingSlug;
        }
        if (!incomingWeapon.name && user.equipment?.weapon?.displayName) {
            incomingWeapon.name = user.equipment.weapon.displayName;
        }

        user.weaponData = incomingWeapon;

        if (user.equipment && user.equipment.weapon) {
            user.equipment.weapon.weaponFile = incomingSlug || user.equipment.weapon.weaponFile || null;
            if (!user.equipment.weapon.displayName && incomingWeapon.name) {
                user.equipment.weapon.displayName = incomingWeapon.name;
            }
        }
        
        // Save to file
        await fs.writeFile(registeredUsersPath, JSON.stringify(registeredUsers, null, 2));
        
        // Send success response
        ws.send(msgpack.encode({
            type: 'loadWeaponSuccess',
            weaponData: user.weaponData
        }));
        
        console.log(`User ${ws.username} loaded weapon: ${data.weaponData.name}`);

        // Broadcast updated party weapon data to current room if in game
        if (ws.room) {
            const roomEntry = rooms.get(ws.room);
            if (roomEntry && roomEntry.type === 'game' && roomEntry.clients) {
                const weaponPayload = await buildRoomWeaponData(roomEntry.clients ? [...roomEntry.clients] : []);
                if (weaponPayload.length > 0) {
                    const openState = ws.OPEN ?? ws.constructor?.OPEN ?? 1;
                    for (const client of roomEntry.clients) {
                        if (client && client.readyState === openState) {
                            client.send(msgpack.encode({
                                type: 'roomWeaponData',
                                roomWeaponData: weaponPayload
                            }));
                        }
                    }
                }
            }
        }
      } else if (data.type === 'uploadedWeapon') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const sanitizedWeapon = sanitizeWeaponPayload(data.weapon);
            const uploaderUsername = ws.username;
            const weaponSlug = createLevelSlug(sanitizedWeapon.name);
            const targetPath = path.resolve(weaponsDirectory, `${weaponSlug}.json`);
            const relativePath = path.relative(weaponsDirectory, targetPath);

            if (relativePath.startsWith('..') || relativePath.includes(`${path.sep}..`)) {
                throw new Error('Invalid weapon name');
            }

            const payloadToStore = {
                ...sanitizedWeapon,
                uploadedBy: uploaderUsername,
                uploadedAt: new Date().toISOString()
            };

            await fs.writeFile(targetPath, JSON.stringify(payloadToStore, null, 2));

            ws.send(msgpack.encode({
                type: 'uploadedWeaponSuccess',
                name: sanitizedWeapon.name
            }));

            console.log(`User ${ws.username} uploaded weapon "${sanitizedWeapon.name}" to server`);
        } catch (error) {
            console.error('Weapon upload failed:', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to upload weapon' }));
        }
      } else if (data.type === 'listWeapons') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const files = await fs.readdir(weaponsDirectory);
            const weapons = [];

            for (const fileName of files) {
                if (!fileName.endsWith('.json')) continue;

                const slug = path.parse(fileName).name;
                let safeSlug;

                try {
                    safeSlug = ensureValidSlug(slug);
                } catch {
                    continue;
                }

                const filePath = path.resolve(weaponsDirectory, fileName);
                const relative = path.relative(weaponsDirectory, filePath);
                if (relative.startsWith('..') || path.isAbsolute(relative)) {
                    continue;
                }

                try {
                    const [fileContents, stats] = await Promise.all([
                        fs.readFile(filePath, 'utf8'),
                        fs.stat(filePath)
                    ]);

                    const parsed = JSON.parse(fileContents);
                    const weaponName = typeof parsed.name === 'string' ? parsed.name : safeSlug;
                    const emitters = Array.isArray(parsed.weapon?.emitters) ? parsed.weapon.emitters.length : 0;
                    const uploadedBy = typeof parsed.uploadedBy === 'string' ? parsed.uploadedBy : null;
                    const uploadedAt = typeof parsed.uploadedAt === 'string' ? parsed.uploadedAt : stats.mtime.toISOString();

                    weapons.push({
                        name: weaponName,
                        slug: safeSlug,
                        emitters,
                        uploadedBy,
                        uploadedAt
                    });
                } catch (error) {
                    console.error('Failed to process weapon file', fileName, error);
                }
            }

            weapons.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

            ws.send(msgpack.encode({
                type: 'weaponsList',
                weapons
            }));
        } catch (error) {
            console.error('Failed to list weapons', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list weapons' }));
        }
      } else if (data.type === 'getWeapon') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const identifier = typeof data.slug === 'string' ? data.slug : data.name;
            const slug = ensureValidSlug(identifier);
            const targetPath = path.resolve(weaponsDirectory, `${slug}.json`);
            const relative = path.relative(weaponsDirectory, targetPath);

            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                throw new Error('Invalid weapon identifier');
            }

            const fileContents = await fs.readFile(targetPath, 'utf8');
            const parsed = JSON.parse(fileContents);

            ws.send(msgpack.encode({
                type: 'weaponData',
                name: parsed.name || slug,
                weapon: parsed.weapon || { emitters: [] },
                uploadedBy: parsed.uploadedBy || null,
                uploadedAt: parsed.uploadedAt || null
            }));
        } catch (error) {
            console.error('Failed to load weapon', error);
            if (error.code === 'ENOENT') {
                ws.send(msgpack.encode({ type: 'error', message: 'Weapon not found on server' }));
            } else {
                ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to load weapon' }));
            }
        }
      } else if (data.type === 'uploadedLevel') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const levelPayload = data.level ?? { name: data.name, data: data.data };
            const { fileName, sanitizedPayload } = sanitizeLevelPayload(levelPayload);
            const uploaderUsername = ws.username;

            if (!uploaderUsername) {
                throw new Error('Unable to determine uploader username');
            }

            // Use level name-based filename instead of username-based
            // This allows players to upload multiple levels
            const targetPath = path.resolve(levelsDirectory, `${fileName}.json`);
            const pathWithinLevels = path.relative(levelsDirectory, targetPath);

            if (pathWithinLevels.startsWith('..') || pathWithinLevels.includes(path.sep + '..')) {
                throw new Error('Invalid level name');
            }

            const enrichedPayload = {
                ...sanitizedPayload,
                uploadedBy: uploaderUsername,
                uploadedAt: new Date().toISOString()
            };

            await fs.writeFile(targetPath, JSON.stringify(enrichedPayload, null, 2));

            ws.send(msgpack.encode({
                type: 'uploadedLevelSuccess',
                name: sanitizedPayload.name,
                uploadedBy: uploaderUsername
            }));
        } catch (error) {
            console.error('Failed to save level', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to save level' }));
        }
      } else if (data.type === 'uploadedCampaignLevel') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const levelPayload = data.level ?? { name: data.name, data: data.data };
            const { fileName, sanitizedPayload } = sanitizeLevelPayload(levelPayload);
            const uploaderUsername = ws.username;

            const targetPath = path.resolve(campaignLevelsDirectory, `${fileName}.json`);
            const pathWithinCampaign = path.relative(campaignLevelsDirectory, targetPath);

            if (pathWithinCampaign.startsWith('..') || pathWithinCampaign.includes(path.sep + '..')) {
                throw new Error('Invalid level name');
            }

            const enrichedPayload = {
                ...sanitizedPayload,
                uploadedBy: uploaderUsername,
                uploadedAt: new Date().toISOString()
            };

            await fs.writeFile(targetPath, JSON.stringify(enrichedPayload, null, 2));

            ws.send(msgpack.encode({
                type: 'uploadedLevelSuccess',
                name: sanitizedPayload.name,
                uploadedBy: uploaderUsername,
                campaign: true
            }));
        } catch (error) {
            console.error('Failed to save campaign level', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to save campaign level' }));
        }
      } else if (data.type === 'listLevels') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const files = await fs.readdir(levelsDirectory);
            const levels = [];

            for (const fileName of files) {
                if (!fileName.endsWith('.json')) continue;

                const slug = path.parse(fileName).name;
                let safeSlug;

                try {
                    safeSlug = ensureValidSlug(slug);
                } catch {
                    continue;
                }

                const filePath = path.resolve(levelsDirectory, fileName);
                const relative = path.relative(levelsDirectory, filePath);
                if (relative.startsWith('..') || path.isAbsolute(relative)) {
                    continue;
                }

                try {
                    const [fileContents, stats] = await Promise.all([
                        fs.readFile(filePath, 'utf8'),
                        fs.stat(filePath)
                    ]);

                    const parsed = JSON.parse(fileContents);
                    const levelName = typeof parsed.name === 'string' ? parsed.name : safeSlug;
                    const uploadedBy = typeof parsed.uploadedBy === 'string' ? parsed.uploadedBy : null;
                    const uploadedAt = typeof parsed.uploadedAt === 'string' ? parsed.uploadedAt : null;

                    levels.push({
                        name: levelName,
                        slug: safeSlug,
                        updatedAt: uploadedAt || stats.mtime.toISOString(),
                        uploadedBy
                    });
                } catch (error) {
                    console.error('Failed to process level file', fileName, error);
                }
            }

            levels.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

            ws.send(msgpack.encode({
                type: 'levelsList',
                levels
            }));
        } catch (error) {
            console.error('Failed to list levels', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list levels' }));
        }
      } else if (data.type === 'getLevel') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const identifier = typeof data.slug === 'string' ? data.slug : data.name;
            const slug = ensureValidSlug(identifier);
            const targetPath = path.resolve(levelsDirectory, `${slug}.json`);
            const relative = path.relative(levelsDirectory, targetPath);

            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                throw new Error('Invalid level identifier');
            }

            const fileContents = await fs.readFile(targetPath, 'utf8');
            const parsed = JSON.parse(fileContents);

            ws.send(msgpack.encode({
                type: 'levelData',
                level: parsed
            }));
        } catch (error) {
            console.error('Failed to load level', error);
            if (error.code === 'ENOENT') {
                ws.send(msgpack.encode({ type: 'error', message: 'Level not found on server' }));
            } else {
                ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to load level' }));
            }
        }
      }

    } catch (err) {
      console.error('Invalid message', err);
      ws.send(msgpack.encode({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws.id);
    
    // Handle party disconnection
    const party = findPartyByMemberId(ws.id);
    if (party) {
        party.members.delete(ws.id);
        
        // If the leader disconnected, transfer leadership to next member
        if (party.leader === ws.id && party.members.size > 0) {
            party.leader = party.members.values().next().value;
            
            // Notify party members of new leader
            const newLeaderUsername = clients.get(party.leader)?.username;
            const partyDetails = {
                leader: newLeaderUsername,
                members: [...party.members].map(id => clients.get(id)?.username).filter(Boolean)
            };
            
            for (const memberId of party.members) {
                const memberClient = clients.get(memberId);
                if (memberClient && memberClient.readyState === ws.OPEN) {
                    memberClient.send(msgpack.encode({ type: 'partyUpdate', party: partyDetails }));
                }
            }
        } else if (party.members.size === 0) {
            // Remove empty party
            parties.delete(party.leader);
        }
    }
    
    if (ws.room && rooms.has(ws.room)) {
      const room = rooms.get(ws.room);
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        rooms.delete(ws.room);
      }
      
      // Notify other clients that this player has disconnected
      for (const client of room.clients) {
        if (client.readyState === ws.OPEN) {
          client.send(msgpack.encode({ type: 'playerDisconnect', id: ws.id }));
        }
      }
    }
  });
});