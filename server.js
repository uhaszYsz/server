// server.js
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Encoder } from 'msgpackr';
import * as db from './database.js';
import readline from 'readline';
import bcrypt from 'bcrypt';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import * as spritesDb from './spritesDatabase.js';

// Password hashing configuration
const BCRYPT_ROUNDS = 10; // Number of salt rounds (higher = more secure but slower)

// Initialize DOMPurify for XSS protection
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Input validation constants
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/; // Alphanumeric, underscore, hyphen only
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 100;
const CHAT_MESSAGE_MAX_LENGTH = 500;
const FORUM_TITLE_MAX_LENGTH = 200;
const FORUM_CONTENT_MAX_LENGTH = 10000;

// Input validation functions
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }
    const trimmed = username.trim();
    if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
        return { valid: false, error: `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters` };
    }
    if (!USERNAME_REGEX.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }
    return { valid: true, value: trimmed };
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }
    const trimmed = password.trim();
    if (trimmed.length < PASSWORD_MIN_LENGTH || trimmed.length > PASSWORD_MAX_LENGTH) {
        return { valid: false, error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters` };
    }
    return { valid: true, value: trimmed };
}

function validateChatMessage(message) {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: 'Message is required' };
    }
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Message cannot be empty' };
    }
    if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
        return { valid: false, error: `Message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or less` };
    }
    return { valid: true, value: trimmed };
}

function validateForumTitle(title) {
    if (!title || typeof title !== 'string') {
        return { valid: false, error: 'Title is required' };
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Title cannot be empty' };
    }
    if (trimmed.length > FORUM_TITLE_MAX_LENGTH) {
        return { valid: false, error: `Title must be ${FORUM_TITLE_MAX_LENGTH} characters or less` };
    }
    return { valid: true, value: trimmed };
}

function validateForumContent(content) {
    if (!content || typeof content !== 'string') {
        return { valid: false, error: 'Content is required' };
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Content cannot be empty' };
    }
    if (trimmed.length > FORUM_CONTENT_MAX_LENGTH) {
        return { valid: false, error: `Content must be ${FORUM_CONTENT_MAX_LENGTH} characters or less` };
    }
    return { valid: true, value: trimmed };
}

const msgpack = new Encoder({
    useRecords: false
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const levelsDirectory = path.join(__dirname, 'levels');
const weaponsDirectory = path.join(__dirname, 'weapons');
const DEFAULT_CAMPAIGN_LEVEL_FILE = 'lev.json'; // Default slug for campaign level

const MAX_LEVEL_NAME_LENGTH = 64;
const MAX_LEVEL_DATA_BYTES = 256 * 1024; // 256 KB
const LEVEL_SLUG_REGEX = /^[a-z0-9]+[a-z0-9-_]*$/;
const MAX_SPRITE_SIZE = 1024; // 1 KB max sprite size

await Promise.all([
    fs.mkdir(levelsDirectory, { recursive: true }),
    fs.mkdir(weaponsDirectory, { recursive: true })
]);

// Equipment slots
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'hat', 'amulet', 'ring', 'spellcard'];

// Available stats for items
const ITEM_STATS = ['maxHp', 'maxMp', 'MpRegen', 'critical', 'block', 'knockback', 'recovery', 'reload'];

const PASSIVE_ABILITIES = ['healing_aura', 'super_hit', 'bullet_cleanse'];

// Generate a random item for a given slot
function generateRandomItem(slotName) {
    // Get 2 random stats from the available stats (no duplicates)
    const availableStats = [...ITEM_STATS];
    const selectedStats = [];
    
    // Pick 2 random stats (prevent duplicates)
    for (let i = 0; i < 2; i++) {
        const randomIndex = Math.floor(Math.random() * availableStats.length);
        selectedStats.push(availableStats[randomIndex]);
        availableStats.splice(randomIndex, 1); // Remove selected stat to avoid duplicates
    }
    
    // Create stat bonuses array with +1 for each selected stat
    const statBonuses = selectedStats.map(stat => ({
        stat: stat,
        value: 1
    }));
    
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
        critical: 5,
        block: 5,
        knockback: 0,
        recovery: 0,
        reload: 0
    };
}

// Active ability IDs for spellcards
const ACTIVE_ABILITIES = ['shield', 'heal_zone', 'explosion'];

// Helper function to get display name for spellcard abilities
function getSpellcardDisplayName(abilityId) {
    const names = {
        'shield': 'Shield Spellcard',
        'heal_zone': 'Heal Zone Spellcard',
        'explosion': 'Explosion Spellcard'
    };
    return names[abilityId] || 'Spellcard';
}

// Initialize inventory and equipment for new players
function initializeInventoryAndEquipment() {
    const starterWeapon = {
        name: 'weapon',
        displayName: 'Sword',
        weaponFile: 'playa',
        stats: [] // Empty stats array
    };

    return {
        inventory: [starterWeapon], // Only sword in inventory for new users
        equipment: {
            weapon: null,
            armor: null,
            hat: null,
            amulet: null,
            ring: null,
            spellcard: null
        },
        weaponData: null,
        passiveAbility: null
    };
}

// Helper function to get display name for passive ability rings
function getPassiveAbilityDisplayName(abilityId) {
    const names = {
        'healing_aura': 'Healing Ring',
        'super_hit': 'Super Hit Ring',
        'bullet_cleanse': 'Cleanse Ring'
    };
    return names[abilityId] || abilityId;
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

    for (const client of clientsCollection) {
        if (!client || !client.username) continue;
        const user = await db.getUserByUsername(client.username);
        if (!user) continue;

        let userModified = false;

        // Migrate Sword items from 'test' to 'playa' before loading weapon data
        if (user.equipment && user.equipment.weapon) {
            if (user.equipment.weapon.weaponFile === 'test' && (user.equipment.weapon.displayName === 'Sword' || user.equipment.weapon.name === 'weapon')) {
                user.equipment.weapon.weaponFile = 'playa';
                userModified = true;
                console.log(`[buildRoomWeaponData] Migrated ${client.username}'s Sword from 'test' to 'playa'`);
            }
        }
        // Always reload weapon data if equipment weaponFile doesn't match weaponData slug
        if (user.equipment && user.equipment.weapon && user.equipment.weapon.weaponFile) {
            const slug = user.equipment.weapon.weaponFile;
            // Reload if weaponData doesn't exist, is empty, or slug doesn't match
            if (!user.weaponData || !user.weaponData.emitters || user.weaponData.emitters.length === 0 || user.weaponData.slug !== slug) {
                const weaponData = await loadWeaponDataBySlug(slug);
                if (weaponData) {
                    user.weaponData = { ...weaponData, slug };
                    userModified = true;
                    console.log(`[buildRoomWeaponData] Reloaded weapon data for ${client.username}: slug="${slug}", emitters=${weaponData.emitters?.length || 0}`);
                } else {
                    console.error(`[buildRoomWeaponData] Failed to load weapon data for ${client.username}: slug="${slug}"`);
                }
            }
        }

        data.push({
            username: client.username,
            playerId: client.id,
            weaponData: user.weaponData || null
        });
        
        // Save user if it was modified
        if (userModified) {
            await db.updateUser(client.username, user);
        }
    }

    return data;
}

async function buildPlayerInitDataForRoom(roomName, joiningClientId) {
    const payload = [];

    // Get the party of the joining client (if any)
    const joiningClientParty = joiningClientId ? findPartyByMemberId(joiningClientId) : null;

    for (const client of clients.values()) {
        if (!client || !client.username) continue;
        if (roomName && client.room !== roomName) continue;

        const user = await db.getUserByUsername(client.username);
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

        let userModified = false;

        // Only include weaponData and stats if in the same party
        if (isInSameParty) {
            // Migrate Sword items from 'test' to 'playa' before loading weapon data
            if (user.equipment && user.equipment.weapon) {
                if (user.equipment.weapon.weaponFile === 'test' && (user.equipment.weapon.displayName === 'Sword' || user.equipment.weapon.name === 'weapon')) {
                    user.equipment.weapon.weaponFile = 'playa';
                    userModified = true;
                    console.log(`[buildPlayerInitData] Migrated ${client.username}'s Sword from 'test' to 'playa'`);
                }
            }
            // Always reload weapon data if equipment weaponFile doesn't match weaponData slug
            if (user.equipment && user.equipment.weapon && user.equipment.weapon.weaponFile) {
                const slug = user.equipment.weapon.weaponFile;
                // Reload if weaponData doesn't exist, is empty, or slug doesn't match
                if (!user.weaponData || !user.weaponData.emitters || user.weaponData.emitters.length === 0 || user.weaponData.slug !== slug) {
                    const weaponData = await loadWeaponDataBySlug(slug);
                    if (weaponData) {
                        user.weaponData = { ...weaponData, slug };
                        userModified = true;
                        console.log(`[buildPlayerInitData] Reloaded weapon data for ${client.username}: slug="${slug}", emitters=${weaponData.emitters?.length || 0}`);
                    } else {
                        console.error(`[buildPlayerInitData] Failed to load weapon data for ${client.username}: slug="${slug}"`);
                    }
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
        
        // Save user if it was modified
        if (userModified) {
            await db.updateUser(client.username, user);
        }
    }

    return payload;
}

// Initialize database
await db.initDatabase();
await spritesDb.initSpritesDatabase();

let globalTimer = Date.now();

// ============================================================================
// Client Authentication - Verify legitimate game client
// ============================================================================
// Challenge-response system: Server sends a random challenge, client must respond with correct hash
// This is more secure than a static secret, but still not perfect (determined attackers can reverse engineer)

const CLIENT_SECRET_REQUIRED = true; // Set to false to disable client verification (for testing)
const CLIENT_SECRET_KEY = 'game_client_secret_2024_secure_token_v1'; // Shared secret key (change to random string)

// Track pending challenges and verified clients
const pendingChallenges = new Map(); // ws.id -> {challenge, timestamp}
const verifiedClients = new Set(); // Set of ws.id that have verified
const CHALLENGE_TIMEOUT_MS = 10000; // 10 seconds to respond to challenge

// Generate a random challenge
function generateChallenge() {
    return crypto.randomBytes(16).toString('hex');
}

// Compute expected response: HMAC-SHA256(challenge + timestamp, secret)
function computeExpectedResponse(challenge, timestamp) {
    const hmac = crypto.createHmac('sha256', CLIENT_SECRET_KEY);
    hmac.update(challenge + timestamp);
    return hmac.digest('hex');
}

// Verify client response to challenge
function verifyClientChallenge(ws, challenge, timestamp, response) {
    if (!CLIENT_SECRET_REQUIRED) {
        verifiedClients.add(ws.id);
        return true; // Client verification disabled
    }
    
    // Check if challenge exists and is not expired
    const pending = pendingChallenges.get(ws.id);
    if (!pending || pending.challenge !== challenge) {
        return false; // Invalid challenge
    }
    
    const now = Date.now();
    if (now - pending.timestamp > CHALLENGE_TIMEOUT_MS) {
        pendingChallenges.delete(ws.id);
        return false; // Challenge expired
    }
    
    // Verify response matches expected hash
    const expectedResponse = computeExpectedResponse(challenge, timestamp);
    if (response === expectedResponse) {
        verifiedClients.add(ws.id);
        pendingChallenges.delete(ws.id);
        return true;
    }
    
    return false;
}

// Send challenge to client
function sendChallenge(ws) {
    const challenge = generateChallenge();
    const timestamp = Date.now();
    pendingChallenges.set(ws.id, { challenge, timestamp });
    
    ws.send(msgpack.encode({
        type: 'clientChallenge',
        challenge: challenge,
        timestamp: timestamp
    }));
}

// Check if client is verified
function isClientVerified(ws) {
    if (!CLIENT_SECRET_REQUIRED) {
        return true; // Client verification disabled
    }
    
    return verifiedClients.has(ws.id);
}

// ============================================================================
// DDoS Protection - Application Level
// ============================================================================
// Note: Hosting provides network-level DDoS protection, but we need
// application-level protection for WebSocket-specific attacks

// Connection rate limiting per IP
const IP_CONNECTION_RATE_LIMIT = 5; // Max connections per IP per window
const IP_CONNECTION_WINDOW_MS = 60000; // 1 minute window
const ipConnectionAttempts = new Map(); // IP -> {count, resetTime}

// Message rate limiting per connection
const MESSAGE_RATE_LIMIT = 100; // Max messages per connection per window
const MESSAGE_RATE_WINDOW_MS = 1000; // 1 second window
const connectionMessageCounts = new Map(); // ws.id -> {count, resetTime}

// Maximum concurrent connections
const MAX_CONCURRENT_CONNECTIONS = 1000;

// Blocked IPs (manually blocked or auto-blocked for abuse)
const blockedIPs = new Set();

// Connection timeout (close idle connections after this time)
const CONNECTION_TIMEOUT_MS = 300000; // 5 minutes

// Helper function to get client IP
function getClientIP(req) {
    // Check X-Forwarded-For header (if behind proxy)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    // Fallback to socket remote address
    return req.socket.remoteAddress || 'unknown';
}

// Check if IP is rate limited for connections
function checkIPConnectionRateLimit(ip) {
    if (blockedIPs.has(ip)) {
        return { allowed: false, reason: 'IP is blocked' };
    }
    
    const now = Date.now();
    const record = ipConnectionAttempts.get(ip);
    
    if (!record || now > record.resetTime) {
        // First connection or window expired, start new window
        ipConnectionAttempts.set(ip, {
            count: 1,
            resetTime: now + IP_CONNECTION_WINDOW_MS
        });
        return { allowed: true };
    }
    
    if (record.count >= IP_CONNECTION_RATE_LIMIT) {
        // Rate limit exceeded - auto-block for 1 hour
        blockedIPs.add(ip);
        console.warn(`⚠️  IP ${ip} exceeded connection rate limit, auto-blocked for 1 hour`);
        // Auto-unblock after 1 hour
        setTimeout(() => {
            blockedIPs.delete(ip);
            console.log(`✅ Auto-unblocked IP ${ip} after 1 hour`);
        }, 3600000);
        return { allowed: false, reason: 'Connection rate limit exceeded' };
    }
    
    record.count++;
    return { allowed: true };
}

// Check if connection is rate limited for messages
function checkMessageRateLimit(wsId) {
    const now = Date.now();
    const record = connectionMessageCounts.get(wsId);
    
    if (!record || now > record.resetTime) {
        // First message or window expired, start new window
        connectionMessageCounts.set(wsId, {
            count: 1,
            resetTime: now + MESSAGE_RATE_WINDOW_MS
        });
        return { allowed: true };
    }
    
    if (record.count >= MESSAGE_RATE_LIMIT) {
        return { allowed: false, reason: 'Message rate limit exceeded' };
    }
    
    record.count++;
    return { allowed: true };
}

// Clean up message rate limit records when connection closes
function cleanupMessageRateLimit(wsId) {
    connectionMessageCounts.delete(wsId);
}

// ============================================================================

// Create WebSocket server on port 8080, listening on all interfaces
const wss = new WebSocketServer({ 
    port: 8080,
    host: '0.0.0.0' // Listen on all network interfaces
});
console.log('✅ WebSocket server running on ws://0.0.0.0:8080 (accessible from all IPs)');
console.log('🛡️  DDoS protection enabled:');
console.log(`   - Max connections per IP: ${IP_CONNECTION_RATE_LIMIT} per ${IP_CONNECTION_WINDOW_MS/1000}s`);
console.log(`   - Max messages per connection: ${MESSAGE_RATE_LIMIT} per ${MESSAGE_RATE_WINDOW_MS}ms`);
console.log(`   - Max concurrent connections: ${MAX_CONCURRENT_CONNECTIONS}`);
console.log(`   - Connection timeout: ${CONNECTION_TIMEOUT_MS/1000}s`);

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

// Initialize lobby rooms for each campaign level on server startup
async function initializeCampaignLevelLobbies() {
    try {
        // Load campaign levels from database
        const campaignLevels = await db.getAllCampaignLevels();
        
        console.log(`📋 Found ${campaignLevels.length} campaign level(s) - creating lobby rooms...`);
        
        for (const level of campaignLevels) {
            const roomName = `lobby_${level.slug}`;
            
            // Create lobby room for this campaign level
            rooms.set(roomName, {
                type: 'lobby',
                level: `${level.slug}.json`, // Keep .json extension for compatibility
                clients: new Set()
            });
            
            console.log(`  ✅ Created lobby room: "${roomName}" for level "${level.name}" (${level.slug})`);
        }
        
        if (campaignLevels.length === 0) {
            console.log(`  ℹ️  No campaign levels found in database`);
        } else {
            console.log(`✅ Initialized ${campaignLevels.length} campaign level lobby room(s)`);
        }
    } catch (error) {
        console.error('❌ Failed to initialize campaign level lobbies:', error);
    }
}

// Initialize campaign level lobbies on server startup
await initializeCampaignLevelLobbies();

// Helper function to join player to "main" campaign lobby
async function joinFirstCampaignLobby(ws) {
    try {
        // Look for campaign level with name "main" (slug will be "main")
        const mainLevel = await db.getCampaignLevelBySlug('main');
        if (!mainLevel) {
            console.log('ℹ️  No "main" campaign level found, skipping auto-join');
            return;
        }
        
        const roomName = `lobby_main`;
        
        // Remove from old room if any
        if (ws.room && rooms.has(ws.room)) {
            const oldRoom = rooms.get(ws.room);
            oldRoom.clients.delete(ws);
        }
        
        // Create lobby room if it doesn't exist
        if (!rooms.has(roomName)) {
            rooms.set(roomName, {
                type: 'lobby',
                level: `${mainLevel.slug}.json`,
                clients: new Set()
            });
        }
        
        const updatedRoom = rooms.get(roomName);
        if (!updatedRoom.clients) {
            updatedRoom.clients = new Set();
        }
        updatedRoom.clients.add(ws);
        ws.room = roomName;
        
        const roomData = rooms.get(roomName);
        
        // Get the actual level name from database
        let levelName = null;
        if (roomData.level) {
            try {
                const levelData = await loadCampaignLevelByName(roomData.level);
                levelName = levelData?.name || levelData?.data?.name || null;
            } catch (error) {
                // If we can't load the level, use the filename without .json
                levelName = roomData.level.replace('.json', '');
            }
        }
        
        // Send room update to the joining client
        ws.send(msgpack.encode({ 
            type: 'roomUpdate', 
            room: roomName, 
            roomType: roomData.type, 
            level: roomData.level ?? null,
            levelName: levelName,
            autoJoined: true // Flag to indicate this was an auto-join
        }));
        
        // Send player init data to the joining client (so they see existing players)
        if (ws.username) {
            const initPayload = await buildPlayerInitDataForRoom(roomName, ws.id);
            if (initPayload.length > 0) {
                ws.send(msgpack.encode({
                    type: 'playerInitData',
                    players: initPayload
                }));
            }
            
            // Send room weapon data to the joining client
            const weaponPayload = await buildRoomWeaponData(roomData.clients ? [...roomData.clients] : []);
            if (weaponPayload.length > 0) {
                ws.send(msgpack.encode({
                    type: 'roomWeaponData',
                    roomWeaponData: weaponPayload
                }));
            }
        }
        
        // Notify other clients in the room that a new player joined
        const openState = ws.OPEN ?? ws.constructor?.OPEN ?? 1;
        for (const client of roomData.clients) {
            if (client !== ws && client && client.readyState === openState && client.username) {
                // Send the new player's data to existing clients
                const newPlayerData = await buildPlayerInitDataForRoom(roomName, ws.id);
                if (newPlayerData.length > 0) {
                    // Find the new player's data in the payload
                    const newPlayer = newPlayerData.find(p => p.id === ws.id);
                    if (newPlayer) {
                        client.send(msgpack.encode({
                            type: 'playerInitData',
                            players: [newPlayer]
                        }));
                    }
                }
            }
        }
        
        console.log(`✅ Auto-joined ${ws.username || 'client'} to "main" campaign lobby: ${roomName} (level: ${mainLevel.name})`);
    } catch (error) {
        console.error('❌ Failed to join first campaign lobby:', error);
    }
}

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

    // Remove .json extension if present to get slug
    const slug = trimmed.endsWith('.json') ? trimmed.slice(0, -5) : trimmed;
    
    if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
        throw new Error('Invalid level file name');
    }

    // Load from database
    const level = await db.getCampaignLevelBySlug(slug);
    if (!level) {
        return null;
    }

    // Return in the same format as before for compatibility
    return {
        name: level.name,
        data: level.data
    };
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
        // No level specified - send error instead of using default
        if (leaderClient.readyState === openState) {
            leaderClient.send(msgpack.encode({ type: 'error', message: 'No level specified for game room.' }));
        }
        return;
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
        roomEntry = { type: 'game', level: resolvedLevelFile || null, clients: new Set(), startTime: null };
    } else {
        roomEntry.type = 'game';
        roomEntry.level = resolvedLevelFile || null;
        if (!roomEntry.clients) {
            roomEntry.clients = new Set();
        }
        // Reset start time when creating a new game (room might be reused)
        roomEntry.startTime = null;
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

wss.on('connection', (ws, req) => {
  // Get client IP
  const clientIP = getClientIP(req);
  
  // Check connection rate limit
  const rateLimitCheck = checkIPConnectionRateLimit(clientIP);
  if (!rateLimitCheck.allowed) {
    console.warn(`⚠️  Connection rejected from ${clientIP}: ${rateLimitCheck.reason}`);
    ws.close(1008, rateLimitCheck.reason);
    return;
  }
  
  // Check maximum concurrent connections
  if (clients.size >= MAX_CONCURRENT_CONNECTIONS) {
    console.warn(`⚠️  Connection rejected from ${clientIP}: Server at capacity (${MAX_CONCURRENT_CONNECTIONS} connections)`);
    ws.close(1013, 'Server at capacity');
    return;
  }
  
  // Assign client ID and store connection
  ws.id = nextClientId++;
  ws.room = null; // Track which room the client is in
  ws.clientIP = clientIP; // Store IP for logging
  ws.lastMessageTime = Date.now(); // Track last message time for timeout
  clients.set(ws.id, ws);
  
  console.log(`✅ Client connected: ID=${ws.id}, IP=${clientIP}, Total clients: ${clients.size}`);
  
  // Set connection timeout - close idle connections
  const timeoutId = setTimeout(() => {
    if (ws.readyState === ws.OPEN) {
      const idleTime = Date.now() - ws.lastMessageTime;
      if (idleTime >= CONNECTION_TIMEOUT_MS) {
        console.log(`⏱️  Closing idle connection: ID=${ws.id}, IP=${clientIP}, Idle: ${Math.round(idleTime/1000)}s`);
        ws.close(1000, 'Connection timeout');
      }
    }
  }, CONNECTION_TIMEOUT_MS);
  
  // Clear timeout on close
  ws.on('close', () => {
    clearTimeout(timeoutId);
    cleanupMessageRateLimit(ws.id);
    verifiedClients.delete(ws.id);
    pendingChallenges.delete(ws.id);
  });
  
  // Send challenge immediately on connection
  if (CLIENT_SECRET_REQUIRED) {
    sendChallenge(ws);
  } else {
    // If verification disabled, mark as verified immediately
    verifiedClients.add(ws.id);
  }
  
  ensurePartyForClient(ws);

  ws.on('message', async (message) => {
    // Check message rate limit
    const messageRateCheck = checkMessageRateLimit(ws.id);
    if (!messageRateCheck.allowed) {
      console.warn(`⚠️  Message rate limit exceeded: ID=${ws.id}, IP=${ws.clientIP}`);
      ws.close(1008, 'Message rate limit exceeded');
      return;
    }
    
    // Update last message time
    ws.lastMessageTime = Date.now();
    
    // Check message size (prevent large message attacks)
    const MAX_MESSAGE_SIZE = 300 * 1024; // 300 KB
    if (message.length > MAX_MESSAGE_SIZE) {
      console.warn(`⚠️  Message too large: ID=${ws.id}, IP=${ws.clientIP}, Size: ${message.length} bytes`);
      ws.close(1009, 'Message too large');
      return;
    }
    
    try {
      const data = msgpack.decode(message);
      
      // Handle client challenge response
      if (data.type === 'clientChallengeResponse') {
        const { challenge, timestamp, response } = data;
        if (verifyClientChallenge(ws, challenge, timestamp, response)) {
          console.log(`✅ Client verified: ID=${ws.id}, IP=${ws.clientIP}`);
          ws.send(msgpack.encode({ type: 'clientVerified' }));
          return; // Don't process further
        } else {
          console.warn(`⚠️  Invalid client challenge response: ID=${ws.id}, IP=${ws.clientIP}`);
          ws.close(1008, 'Invalid client - not a legitimate game client');
          return;
        }
      }
      
      // For all other messages (except login/register), verify client is legitimate
      if (data.type !== 'login' && data.type !== 'quickRegister' && !isClientVerified(ws)) {
        // If not verified and not already sent challenge, send one
        if (!pendingChallenges.has(ws.id)) {
          sendChallenge(ws);
        }
        console.warn(`⚠️  Unverified client attempted to send message: ID=${ws.id}, IP=${ws.clientIP}, Type=${data.type}`);
        // Don't close connection, just ignore the message (client should respond to challenge)
        return;
      }
      
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
        await db.createUser(newUser);
        ws.username = username; // Store username
        ws.rank = 'player'; // Default rank for new users
        ws.isAdmin = false; // New users are not admin
        ws.send(msgpack.encode({ type: 'registerSuccess', username, password }));
        // Auto-join first campaign lobby
        await joinFirstCampaignLobby(ws);
      } else if (data.type === 'login') {
        // Validate username and password
        if (!data.username || !data.password) {
            ws.send(msgpack.encode({ type: 'error', message: 'Username and password required' }));
            return;
        }
        
        const usernameValidation = validateUsername(data.username);
        if (!usernameValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: usernameValidation.error }));
            return;
        }
        
        const passwordValidation = validatePassword(data.password);
        if (!passwordValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: passwordValidation.error }));
            return;
        }
        
        const user = await db.findUser(usernameValidation.value, passwordValidation.value);
        if (user) {
            ws.username = user.username; // Store username on successful login
            ws.rank = user.rank || 'player'; // Set rank from user data
            ws.isAdmin = (ws.rank === 'admin'); // Set admin flag based on rank
            ws.send(msgpack.encode({ 
                type: 'loginSuccess', 
                username: ws.username,
                rank: ws.rank
            }));
            const party = ensurePartyForClient(ws);
            broadcastPartyUpdate(party);
            // Auto-join first campaign lobby
            await joinFirstCampaignLobby(ws);
        } else {
            ws.send(msgpack.encode({ type: 'loginFail' }));
        }
      } else if (data.type === 'getPlayerData') {
        // Send current player data to client
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        const user = await db.getUserByUsername(ws.username);
        if (user) {
            let userDataChanged = false;
            // Migrate Sword items from 'test' to 'playa' on login
            if (user.equipment && user.equipment.weapon) {
                if (user.equipment.weapon.weaponFile === 'starter-sword' || 
                    (user.equipment.weapon.weaponFile === 'test' && (user.equipment.weapon.displayName === 'Sword' || user.equipment.weapon.name === 'weapon'))) {
                    user.equipment.weapon.weaponFile = 'playa';
                    userDataChanged = true;
                    console.log(`[Login] Migrated ${ws.username}'s equipped Sword from '${user.equipment.weapon.weaponFile === 'starter-sword' ? 'starter-sword' : 'test'}' to 'playa'`);
                }
                if (!user.equipment.weapon.displayName) {
                    user.equipment.weapon.displayName = 'Sword';
                    userDataChanged = true;
                }
                const slug = user.equipment.weapon.weaponFile || 'playa';
                if (!user.weaponData || user.weaponData.slug !== slug) {
                    let weaponData = await loadWeaponDataBySlug(slug);
                    if (!weaponData && slug !== 'playa') {
                        console.log(`[Login] Failed to load weapon "${slug}" for ${ws.username}, trying 'playa'`);
                        weaponData = await loadWeaponDataBySlug('playa');
                        user.equipment.weapon.weaponFile = 'playa';
                        userDataChanged = true;
                    }
                    if (weaponData) {
                        user.weaponData = { ...weaponData, slug: user.equipment.weapon.weaponFile || 'playa' };
                        userDataChanged = true;
                        console.log(`[Login] Loaded weapon data for ${ws.username}: slug="${user.equipment.weapon.weaponFile}", emitters=${weaponData.emitters?.length || 0}`);
                    } else {
                        console.error(`[Login] Failed to load weapon data for ${ws.username}: slug="${slug}"`);
                    }
                }
            }
            if (userDataChanged) {
                await db.updateUser(ws.username, user);
            }
            ws.send(msgpack.encode({
                type: 'playerData',
                playerData: {
                    stats: user.stats,
                    inventory: user.inventory,
                    equipment: user.equipment,
                    passiveAbility: user.passiveAbility || null,
                    verified: user.verified !== undefined ? user.verified : 0
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
        
        const user = await db.getUserByUsername(ws.username);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        // Authorization check: user can only equip items for themselves
        if (user.username !== ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Permission denied' }));
            return;
        }
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
        const oldItem = user.equipment[slotName];
        if (oldItem) {
            user.inventory.push(oldItem);
            // If unequipping a ring with passive ability, clear passive ability
            if (slotName === 'ring' && oldItem.passiveAbility) {
                user.passiveAbility = null;
            }
        }
        
        // Sanitize weapon file slug if present
        if (item.weaponFile && typeof item.weaponFile === 'string') {
            try {
                item.weaponFile = createLevelSlug(item.weaponFile);
            } catch {
                // If it's a Sword, default to 'playa', otherwise 'test'
                const isSword = item.displayName === 'Sword' || item.name === 'weapon';
                item.weaponFile = createLevelSlug(isSword ? 'playa' : 'test');
            }
        } else if (slotName === 'weapon') {
            // If weapon slot and no weaponFile, set based on displayName
            const isSword = item.displayName === 'Sword' || item.name === 'weapon';
            item.weaponFile = isSword ? 'playa' : 'test';
        }

        // If Sword item has 'test' weaponFile, change to 'playa' BEFORE equipping
        if (slotName === 'weapon' && (item.displayName === 'Sword' || item.name === 'weapon')) {
            if (!item.weaponFile || item.weaponFile === 'test') {
                item.weaponFile = 'playa';
            }
        }

        // Equip the new item (after all weaponFile updates)
        user.equipment[slotName] = item;

        // If equipping a ring, set passive ability based on ring's passiveAbility property
        if (slotName === 'ring') {
            if (item.passiveAbility) {
                user.passiveAbility = item.passiveAbility;
            } else {
                // If equipping a ring without passiveAbility, clear passive ability
                user.passiveAbility = null;
            }
        }

        if (slotName === 'weapon') {
            const weaponFile = item.weaponFile || 'playa';
            // Always reload weapon data when equipping a weapon to ensure it matches the weaponFile
            const weaponData = await loadWeaponDataBySlug(weaponFile);
            if (weaponData) {
                user.weaponData = { ...weaponData, slug: weaponFile };
                console.log(`[EquipItem] User ${ws.username} equipped weapon with file "${weaponFile}", loaded ${weaponData.emitters?.length || 0} emitters`);
            } else {
                console.error(`[EquipItem] Failed to load weapon data for slug "${weaponFile}"`);
            }
        }
        
        // Recalculate stats (base stats + equipment bonuses)
        const baseStats = getDefaultStats();
        Object.keys(baseStats).forEach(statKey => {
            user.stats[statKey] = baseStats[statKey];
        });
        
        // Apply equipment bonuses
        Object.values(user.equipment).forEach(equippedItem => {
            if (equippedItem && Array.isArray(equippedItem.stats)) {
                equippedItem.stats.forEach(statEntry => {
                    const stat = statEntry.stat;
                    const value = statEntry.value;
                    if (user.stats[stat] !== undefined) {
                        user.stats[stat] += value;
                    }
                });
            }
        });
        
        // Save to database
        await db.updateUser(ws.username, user);
        
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
        
        console.log(`[EquipItem] User ${ws.username} equipped ${slotName}`);
      } else if (data.type === 'rerollItem') {
        // Handle rerolling item stats
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        const user = await db.getUserByUsername(ws.username);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        // Authorization check: user can only reroll items for themselves
        if (user.username !== ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Permission denied' }));
            return;
        }
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
        
        // Validate item has stats array with at least 2 stats
        if (!Array.isArray(item.stats) || item.stats.length < 2) {
            ws.send(msgpack.encode({ type: 'error', message: 'Item must have at least 2 stats to reroll' }));
            return;
        }
        
        // Keep first stat, reroll the rest
        const firstStat = item.stats[0];
        const rerollCount = item.stats.length - 1;
        
        // Get available stats excluding the first stat
        const availableStats = ITEM_STATS.filter(stat => stat !== firstStat.stat);
        
        // Reroll remaining stats (duplicates allowed, but not same as first stat)
        const rerolledStats = [];
        for (let i = 0; i < rerollCount; i++) {
            const randomIndex = Math.floor(Math.random() * availableStats.length);
            const selectedStat = availableStats[randomIndex];
            // Value is 1 for rerolled stats (not 2x like first stat)
            rerolledStats.push({
                stat: selectedStat,
                value: 1
            });
        }
        
        // Update item stats: keep first, replace rest
        item.stats = [firstStat, ...rerolledStats];
        
        // Save to database
        await db.updateUser(ws.username, user);
        
        // Send success response with updated player data
        ws.send(msgpack.encode({
            type: 'rerollSuccess',
            playerData: {
                stats: user.stats,
                inventory: user.inventory,
                equipment: user.equipment,
                passiveAbility: user.passiveAbility || null
            }
        }));
        
        console.log(`[RerollItem] User ${ws.username} rerolled stats for item at index ${inventoryIndex}`);
      } else if (data.type === 'partyInvite') {
        console.log
        (`User ${ws.username} equipped ${item.name} in ${slotName} slot`);
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

        const user = await db.getUserByUsername(ws.username);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        // Authorization check: user can only set passive ability for themselves
        if (user.username !== ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Permission denied' }));
            return;
        }

        user.passiveAbility = abilityId;

        await db.updateUser(ws.username, user);

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

        // Only allow joining campaign lobby rooms that exist
        // Campaign lobbies start with 'lobby_' and must have a corresponding campaign level in the database
        if (room.startsWith('lobby_')) {
          const levelSlug = room.replace('lobby_', '').replace('.json', '');
          
          // Check if campaign level exists in database
          try {
            const level = await db.getCampaignLevelBySlug(levelSlug);
            if (!level) {
              // Campaign level doesn't exist - reject join
              ws.send(msgpack.encode({ type: 'error', message: `Campaign level "${levelSlug}" not found` }));
              return;
            }
            
            // Create lobby room if it doesn't exist
            if (!rooms.has(room)) {
              rooms.set(room, {
                type: 'lobby',
                level: `${level.slug}.json`,
                clients: new Set()
              });
            }
            
            const updatedRoom = rooms.get(room);
            if (!updatedRoom.clients) {
              updatedRoom.clients = new Set();
            }
            updatedRoom.clients.add(ws);
            ws.room = room;

            const roomData = rooms.get(room);
            
            // Get the actual level name from database
            let levelName = null;
            if (roomData.level) {
                try {
                    const levelData = await loadCampaignLevelByName(roomData.level);
                    levelName = levelData?.name || levelData?.data?.name || null;
                } catch (error) {
                    // If we can't load the level, use the filename without .json
                    levelName = roomData.level.replace('.json', '');
                }
            }
            
            ws.send(msgpack.encode({ 
                type: 'roomUpdate', 
                room: room, 
                roomType: roomData.type, 
                level: roomData.level ?? null,
                levelName: levelName
            }));
            console.log(`Client joined campaign lobby room: ${room} (level: ${level.name})`);
            
            // Handle game room logic if needed
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
          } catch (error) {
            console.error(`Error checking campaign level for room ${room}:`, error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to join lobby room' }));
            return;
          }
        } else {
          // Not a campaign lobby - don't create room, just reject
          ws.send(msgpack.encode({ type: 'error', message: 'Only campaign lobby rooms are allowed' }));
          return;
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
              username: ws.username || null, // Include username so clients can identify their own data
              data: data.text,
              targetTime: targetTime
            }));
          }
        }
      } else if (data.type === 'blockShield' && ws.room) {
        // Broadcast block shield instantly to all clients in the room (no buffering)
        const room = rooms.get(ws.room);
        if (!room) return;
        const roomClients = room.clients;

        for (const client of roomClients) {
          if (client.readyState === ws.OPEN) {
            client.send(msgpack.encode({
              type: 'blockShield',
              x: data.x,
              y: data.y,
              playerId: ws.id
            }));
          }
        }
      } else if (data.type === 'abilityActivation' && ws.room) {
        // Broadcast ability activation to all clients in the room
        const room = rooms.get(ws.room);
        if (!room) return;
        const roomClients = room.clients;

        for (const client of roomClients) {
          if (client.readyState === ws.OPEN) {
            client.send(msgpack.encode({
              type: 'abilityActivation',
              abilityId: data.abilityId,
              timestamp: data.timestamp,
              playerId: ws.id
            }));
          }
        }
      } else if (data.type === 'playerHit' && ws.room) {
        // Leader sends player hit message - forward to the hit player
        const room = rooms.get(ws.room);
        if (!room) return;
        
        // Find the target player by username
        const targetUsername = data.playerId;
        for (const client of room.clients) {
            if (client.username === targetUsername && client.readyState === ws.OPEN) {
                client.send(msgpack.encode({
                    type: 'playerHit',
                    playerId: data.playerId,
                    damage: data.damage,
                    knockbackTime: data.knockbackTime,
                    knockbackPower: data.knockbackPower,
                    knockbackDirX: data.knockbackDirX,
                    knockbackDirY: data.knockbackDirY
                }));
                break; // Only send to the target player
            }
        }
      } else if (data.type === 'playerDamageReport' && ws.room) {
        const room = rooms.get(ws.room);
        if (!room) return;
        const party = findPartyByMemberId(ws.id);
        if (!party) return;
        
        // Check if fun mode is enabled (default to false)
        // We'll determine this by checking if hp is in the message (fun mode ON sends hp, fun mode OFF doesn't)
        const funModeEnabled = data.hp !== undefined;
        
        if (funModeEnabled) {
            // Fun mode ON: Broadcast to everyone directly
            for (const client of room.clients) {
                if (client.readyState === ws.OPEN) {
                    client.send(msgpack.encode({
                        type: 'playerDamageReport',
                        playerId: ws.username || data.playerId,
                        damage: data.damage,
                        hp: data.hp,
                        knockbackDirX: data.knockbackDirX,
                        knockbackDirY: data.knockbackDirY
                    }));
                }
            }
        } else {
            // Fun mode OFF: 
            // If leader sent this (with hp field), it's the broadcast - send to everyone
            // Otherwise, forward to leader for processing
            if (party.leader === ws.id && data.hp !== undefined) {
                // Leader is broadcasting with authoritative HP - send to everyone
                for (const client of room.clients) {
                    if (client.readyState === ws.OPEN) {
                        client.send(msgpack.encode({
                            type: 'playerDamageReport',
                            playerId: data.playerId,
                            damage: data.damage,
                            hp: data.hp,
                            knockbackDirX: data.knockbackDirX,
                            knockbackDirY: data.knockbackDirY
                        }));
                    }
                }
            } else {
                // Forward to leader for processing (leader will send broadcast with hp)
                const leaderClient = clients.get(party.leader);
                if (leaderClient && leaderClient.readyState === ws.OPEN) {
                    leaderClient.send(msgpack.encode({
                        type: 'playerDamageReport',
                        playerId: ws.username || data.playerId,
                        damage: data.damage,
                        currentHp: data.currentHp,
                        knockbackDirX: data.knockbackDirX,
                        knockbackDirY: data.knockbackDirY
                    }));
                }
            }
        }
      } else if (data.type === 'playerHpUpdate' && ws.room) {
        // Leader sends HP update - broadcast to all party members
        const party = findPartyByMemberId(ws.id);
        if (!party || party.leader !== ws.id) return; // Only leader can send HP updates
        
        const room = rooms.get(ws.room);
        if (!room) return;
        
        // Broadcast to all party members
        for (const memberId of party.members) {
            const memberClient = clients.get(memberId);
            if (memberClient && memberClient.readyState === ws.OPEN && memberClient.room === ws.room) {
                memberClient.send(msgpack.encode({
                    type: 'playerHpUpdate',
                    players: data.players
                }));
            }
        }
      } else if (data.type === 'partyLoadLevel') {
        const party = findPartyByMemberId(ws.id);
        if (party && party.leader === ws.id) {
            console.log(`[PartyLoadLevel] leader=${ws.username || ws.id} stageDataBytes=${JSON.stringify(data.stageData || {}).length}`);
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

        // Use loaded stage data if available, otherwise use the requested level file
        const requestedLevel = typeof data.level === 'string' && data.level.trim()
            ? data.level.trim()
            : DEFAULT_CAMPAIGN_LEVEL_FILE;

        try {
            console.log(`[PartyStartLevel] leader=${ws.username || ws.id} hasStageData=${party.stageData ? 'yes' : 'no'} requestedLevel=${requestedLevel}`);
            if (party.stageData) {
                // Use the stage data that was loaded earlier (from local or server)
                await sendPartyToGameRoom(party, { stageData: party.stageData, levelFileName: null });
                // Clear the stage data after using it
                delete party.stageData;
            } else {
                // No stage data loaded, use the level file
                await sendPartyToGameRoom(party, { levelFileName: requestedLevel });
            }
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
                // Only auto-join game room if pendingLevelFileName was set (from a different flow)
                // For partyLoadLevel, we just load the stage but stay in lobby until partyStartLevel is called
                if (levelFileForParty) {
                    delete party.pendingLevelFileName;
                    delete party.stageData;
                    await sendPartyToGameRoom(party, { stageData: stageDataForParty, levelFileName: levelFileForParty });
                }
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

        // If the party already has stage data loaded (leader used partyLoadLevel), send it to the new member
        if (inviterParty.stageData) {
            const newMemberClient = clients.get(ws.id);
            if (newMemberClient) {
                const openState = newMemberClient.OPEN ?? newMemberClient.constructor?.OPEN ?? 1;
                if (newMemberClient.readyState === openState) {
                    newMemberClient.send(msgpack.encode({
                        type: 'stageData',
                        stageData: inviterParty.stageData
                    }));
                }
            }
        }

        broadcastPartyUpdate(inviterParty);
      } else if (data.type === 'chatMessage') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Validate and sanitize message
        const messageValidation = validateChatMessage(data.message);
        if (!messageValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: messageValidation.error }));
            return;
        }
        
        // Sanitize message to prevent XSS
        const sanitizedMessage = purify.sanitize(messageValidation.value, {
            ALLOWED_TAGS: [], // No HTML tags allowed
            ALLOWED_ATTR: []
        });
        
        const room = rooms.get(ws.room);
        if (!room) return;
        const roomClients = room.clients;

        for (const client of roomClients) {
            if (client.readyState === ws.OPEN) {
                client.send(msgpack.encode({
                    type: 'chatMessage',
                    username: ws.username,
                    message: sanitizedMessage
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
      } else if (data.type === 'enemyRemoved') {
        // Team leader sends instant "enemy dead" message - broadcast to all clients in room
        const party = findPartyByMemberId(ws.id);
        if (party && party.leader === ws.id && data.id !== undefined) { // Only leader can remove enemies
            const room = rooms.get(ws.room);
            if (room) {
                const roomClients = room.clients;
                for (const client of roomClients) {
                    if (client.readyState === ws.OPEN) {
                        // Send to all clients including the leader (for consistency)
                        client.send(msgpack.encode({ type: 'enemyRemoved', id: data.id }));
                    }
                }
            }
        }
      } else if (data.type === 'enemyEscapeRandomX') {
        // Team leader sends random X value for escaping enemy - broadcast to all clients in room
        const party = findPartyByMemberId(ws.id);
        if (party && party.leader === ws.id && data.enemyId !== undefined && data.randomX !== undefined) {
            const room = rooms.get(ws.room);
            if (room) {
                const roomClients = room.clients;
                for (const client of roomClients) {
                    if (client.readyState === ws.OPEN) {
                        // Send to all clients including the leader (for consistency)
                        client.send(msgpack.encode({ type: 'enemyEscapeRandomX', enemyId: data.enemyId, randomX: data.randomX }));
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
        
        const user = await db.getUserByUsername(ws.username);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
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
        
        // Save to database
        await db.updateUser(ws.username, user);
        
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

            // Check if level already exists and is owned by this user
            const existingLevel = await db.getStageBySlug(fileName);
            console.log(`[uploadedLevel] Level "${fileName}": existingLevel=${!!existingLevel}, ownedBy=${existingLevel?.uploadedBy}, uploader=${uploaderUsername}, overwrite=${!!data.overwrite}, description="${data.description || ''}"`);
            
            if (existingLevel && existingLevel.uploadedBy === uploaderUsername) {
                // Level exists and is owned by this user - ask for confirmation unless overwrite flag is set
                if (!data.overwrite) {
                    ws.send(msgpack.encode({
                        type: 'levelExistsConfirm',
                        slug: fileName,
                        name: sanitizedPayload.name,
                        existingName: existingLevel.name,
                        destination: 'server'
                    }));
                    return;
                }
                // Overwrite confirmed - update existing level
                await db.updateStage(fileName, sanitizedPayload.name, sanitizedPayload.data);
                console.log(`[uploadedLevel] Level "${fileName}" overwritten - no forum thread created`);
                // Don't create forum thread for overwrites
            } else {
                // New level or owned by different user - create new
                await db.createStage(fileName, sanitizedPayload.name, sanitizedPayload.data, uploaderUsername);
                console.log(`[uploadedLevel] Level "${fileName}" created - attempting to create forum thread...`);
                
                // Automatically create a forum thread for new uploaded level
                try {
                // Get "Shared" parent category
                let sharedCategory = await db.getForumCategoryByName('Shared', null);
                if (!sharedCategory) {
                    // Fallback: try to find it by getting all categories
                    const allCategories = await db.getForumCategories();
                    sharedCategory = allCategories.find(cat => cat.name === 'Shared' && cat.parent_id === null);
                    if (!sharedCategory) {
                        console.error('❌ "Shared" category not found when creating forum thread for level');
                        console.error('Available categories:', allCategories.map(c => `${c.name} (parent: ${c.parent_id})`).join(', '));
                    }
                }
                
                if (sharedCategory) {
                    console.log(`[uploadedLevel] Found "Shared" category (ID: ${sharedCategory.id})`);
                    // Get "Levels" subcategory under "Shared"
                    let levelsCategory = await db.getForumCategoryByName('Levels', sharedCategory.id);
                    if (!levelsCategory) {
                        // Fallback: try to find it by getting all categories
                        const allCategories = await db.getForumCategories();
                        levelsCategory = allCategories.find(cat => cat.name === 'Levels' && cat.parent_id === sharedCategory.id);
                        if (!levelsCategory) {
                            console.error(`❌ "Levels" category not found under "Shared" (parent ID: ${sharedCategory.id}) when creating forum thread for level`);
                            console.error('Available subcategories:', allCategories.filter(c => c.parent_id === sharedCategory.id).map(c => c.name).join(', '));
                        }
                    }
                    
                    if (levelsCategory) {
                        console.log(`[uploadedLevel] Found "Levels" category (ID: ${levelsCategory.id})`);
                        // Create thread with level name as title
                        const threadTitle = sanitizedPayload.name || fileName;
                        console.log(`[uploadedLevel] Creating forum thread: title="${threadTitle}", author="${uploaderUsername}", categoryId=${levelsCategory.id}`);
                        const threadId = await db.createForumThread(levelsCategory.id, threadTitle, uploaderUsername);
                        console.log(`[uploadedLevel] Forum thread created with ID: ${threadId}`);
                        
                        // Create first post with description (if provided) followed by [level]slug[/level] BBCode
                        let postContent = '';
                        if (data.description && data.description.trim()) {
                            postContent = data.description.trim() + '\n\n[level]' + fileName + '[/level]';
                            console.log(`[uploadedLevel] Post content includes description: "${data.description.trim()}"`);
                        } else {
                            postContent = `[level]${fileName}[/level]`;
                            console.log(`[uploadedLevel] Post content has no description`);
                        }
                        await db.createForumPost(threadId, uploaderUsername, postContent);
                        console.log(`[uploadedLevel] Forum post created for thread ID: ${threadId}`);
                        
                        console.log(`✅ Auto-created forum thread for level: "${threadTitle}" (thread ID: ${threadId}, category ID: ${levelsCategory.id})`);
                    } else {
                        console.error(`[uploadedLevel] "Levels" category not found - cannot create forum thread`);
                    }
                } else {
                    console.error(`[uploadedLevel] "Shared" category not found - cannot create forum thread`);
                }
                } catch (forumError) {
                    // Don't fail the level upload if forum thread creation fails
                    console.error('❌ Failed to create forum thread for uploaded level:', forumError);
                    console.error('Error stack:', forumError.stack);
                }
            }

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

            if (!uploaderUsername) {
                throw new Error('Unable to determine uploader username');
            }

            // Check if level already exists and is owned by this user
            const existingLevel = await db.getCampaignLevelBySlug(fileName);
            if (existingLevel && existingLevel.uploadedBy === uploaderUsername) {
                // Level exists and is owned by this user - ask for confirmation unless overwrite flag is set
                if (!data.overwrite) {
                    ws.send(msgpack.encode({
                        type: 'levelExistsConfirm',
                        slug: fileName,
                        name: sanitizedPayload.name,
                        existingName: existingLevel.name,
                        destination: 'campaign'
                    }));
                    return;
                }
                // Overwrite confirmed - update existing level
                await db.updateCampaignLevel(fileName, sanitizedPayload.name, sanitizedPayload.data);
                // Don't create/update lobby room for overwrites (it already exists)
            } else {
                // New level or owned by different user - create new
                await db.createCampaignLevel(fileName, sanitizedPayload.name, sanitizedPayload.data, uploaderUsername);
                
                // Update lobby rooms if needed (only for new levels)
                const roomName = `lobby_${fileName}`;
                if (!rooms.has(roomName)) {
                    rooms.set(roomName, {
                        type: 'lobby',
                        level: `${fileName}.json`,
                        clients: new Set()
                    });
                    console.log(`✅ Created lobby room for new campaign level: "${roomName}"`);
                }
            }

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
            // Get levels from database
            const stages = await db.getAllStages();
            const levels = stages.map(stage => ({
                name: stage.name,
                slug: stage.slug,
                updatedAt: stage.uploadedAt,
                uploadedBy: stage.uploadedBy
            }));

            levels.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

            ws.send(msgpack.encode({
                type: 'levelsList',
                levels
            }));
        } catch (error) {
            console.error('Failed to list levels', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list levels' }));
        }
      } else if (data.type === 'uploadSprite') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const { filename, data: fileData } = data;
            
            if (!filename || !fileData) {
                throw new Error('Filename and file data are required');
            }

            // Validate filename (must be GIF or PNG)
            if (!filename.toLowerCase().endsWith('.gif') && !filename.toLowerCase().endsWith('.png')) {
                throw new Error('Only GIF and PNG files are allowed');
            }

            // Validate filename format (alphanumeric, underscore, hyphen, dot)
            if (!/^[a-zA-Z0-9_.-]+\.(gif|png)$/i.test(filename)) {
                throw new Error('Invalid filename format');
            }

            // Decode base64 data
            const buffer = Buffer.from(fileData, 'base64');
            const fileSize = buffer.length;

            // Check file size (1 KB max)
            if (fileSize > MAX_SPRITE_SIZE) {
                throw new Error(`File size exceeds ${MAX_SPRITE_SIZE} bytes limit`);
            }

            // Validate file format based on extension
            const isGIF = filename.toLowerCase().endsWith('.gif');
            const isPNG = filename.toLowerCase().endsWith('.png');
            
            if (isGIF) {
                // Check GIF signature: "GIF87a" or "GIF89a"
                if (buffer[0] !== 0x47 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x38) {
                    throw new Error('Invalid GIF file format');
                }
            } else if (isPNG) {
                // Check PNG signature
                if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
                    throw new Error('Invalid PNG file format');
                }
            }

            // Check if sprite already exists
            const existingSprite = await spritesDb.getSpriteByFilename(filename);
            if (existingSprite) {
                throw new Error('Sprite with this filename already exists');
            }

            // Save to sprites database with base64 data
            await spritesDb.createSprite(filename, ws.username, fileSize, fileData);

            ws.send(msgpack.encode({
                type: 'uploadSpriteSuccess',
                filename,
                fileSize
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to upload sprite' }));
        }
      } else if (data.type === 'listSprites') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const page = data.page || 1;
            const pageSize = 120; // 8x15 grid = 120 sprites per page
            const onlyMine = data.onlyMine === true;
            const uploadedBy = onlyMine ? ws.username : null;
            
            const sprites = await spritesDb.getSprites(page, pageSize, uploadedBy);
            const totalCount = await spritesDb.getSpriteCount(uploadedBy);
            const totalPages = Math.ceil(totalCount / pageSize);

            ws.send(msgpack.encode({
                type: 'spritesList',
                sprites: sprites.map(sprite => ({
                    filename: sprite.filename,
                    uploadedBy: sprite.uploaded_by,
                    uploadedAt: sprite.uploaded_at,
                    fileSize: sprite.file_size,
                    data: sprite.data // base64 string
                })),
                page,
                totalPages,
                totalCount
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list sprites' }));
        }
      } else if (data.type === 'getSprite') {
        try {
            const { filename } = data;
            if (!filename) throw new Error('Filename is required');
            
            const sprite = await spritesDb.getSpriteByFilename(filename);
            if (!sprite) throw new Error('Sprite not found');
            
            ws.send(msgpack.encode({
                type: 'getSpriteResponse',
                filename: sprite.filename,
                data: sprite.data // base64 string
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to get sprite' }));
        }
      } else if (data.type === 'getSprites') {
        try {
            const { filenames } = data;
            if (!filenames || !Array.isArray(filenames)) throw new Error('Filenames array is required');
            
            const sprites = [];
            for (const filename of filenames) {
                const sprite = await spritesDb.getSpriteByFilename(filename);
                if (sprite) {
                    sprites.push({
                        filename: sprite.filename,
                        data: sprite.data
                    });
                }
            }
            
            ws.send(msgpack.encode({
                type: 'getSpritesResponse',
                sprites: sprites
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to get sprites' }));
        }
      } else if (data.type === 'listCampaignLevels') {
        // Admin only - list all campaign levels
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const campaignLevels = await db.getAllCampaignLevels();
            const levels = campaignLevels.map(level => ({
                name: level.name,
                slug: level.slug,
                uploadedBy: level.uploadedBy,
                uploadedAt: level.uploadedAt
            }));

            // Sort by name
            levels.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

            ws.send(msgpack.encode({
                type: 'campaignLevelsList',
                levels
            }));
        } catch (error) {
            console.error('Failed to list campaign levels', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list campaign levels' }));
        }
      } else if (data.type === 'deleteCampaignLevel') {
        // Admin only - delete campaign level
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        // Check if user is admin (rank === 'admin')
        if (ws.rank !== 'admin') {
            ws.send(msgpack.encode({ type: 'error', message: 'Admin privileges required' }));
            return;
        }

        try {
            const slug = data.slug;
            if (!slug) {
                ws.send(msgpack.encode({ type: 'error', message: 'Level slug is required' }));
                return;
            }

            // Delete from database
            const deleted = await db.deleteCampaignLevel(slug);
            if (deleted) {
                // Also remove the lobby room if it exists
                const roomName = `lobby_${slug}`;
                if (rooms.has(roomName)) {
                    rooms.delete(roomName);
                    console.log(`✅ Removed lobby room for deleted campaign level: "${roomName}"`);
                }

                ws.send(msgpack.encode({
                    type: 'deleteCampaignLevelSuccess',
                    slug: slug
                }));
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Level not found' }));
            }
        } catch (error) {
            console.error('Failed to delete campaign level', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to delete campaign level' }));
        }
      } else if (data.type === 'listLobbyRooms') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const lobbyRooms = [];
            for (const [roomName, roomData] of rooms.entries()) {
                if (roomData.type === 'lobby' && roomName.startsWith('lobby_')) {
                    // Try to get level name from the level file
                    let levelName = roomData.level || 'Unknown';
                    if (roomData.level) {
                        try {
                            const levelData = await loadCampaignLevelByName(roomData.level);
                            levelName = levelData.name || levelData.data?.name || roomData.level;
                        } catch (error) {
                            // Use filename if we can't load the level
                            levelName = roomData.level.replace('.json', '');
                        }
                    }
                    
                    lobbyRooms.push({
                        roomName: roomName,
                        level: roomData.level,
                        levelName: levelName,
                        playerCount: roomData.clients ? roomData.clients.size : 0
                    });
                }
            }

            // Sort by level name
            lobbyRooms.sort((a, b) => a.levelName.localeCompare(b.levelName));

            ws.send(msgpack.encode({
                type: 'lobbyRoomsList',
                rooms: lobbyRooms
            }));
        } catch (error) {
            console.error('Failed to list lobby rooms', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list lobby rooms' }));
        }
      } else if (data.type === 'getLevel') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const identifier = typeof data.slug === 'string' ? data.slug : data.name;
            const slug = ensureValidSlug(identifier);

            // Try to get level from regular stages first
            let stage = await db.getStageBySlug(slug);
            
            // If not found, try campaign levels
            if (!stage) {
                const campaignLevel = await db.getCampaignLevelBySlug(slug);
                if (campaignLevel) {
                    // Convert campaign level to stage format
                    stage = {
                        name: campaignLevel.name,
                        data: campaignLevel.data,
                        uploadedBy: campaignLevel.uploadedBy,
                        uploadedAt: campaignLevel.uploadedAt
                    };
                }
            }
            
            if (!stage) {
                throw new Error('Level not found on server');
            }

            // Format level data to match expected structure
            const levelData = {
                name: stage.name,
                data: stage.data,
                uploadedBy: stage.uploadedBy,
                uploadedAt: stage.uploadedAt
            };

            ws.send(msgpack.encode({
                type: 'levelData',
                level: levelData
            }));
        } catch (error) {
            console.error('Failed to load level', error);
            if (error.message === 'Level not found on server') {
                ws.send(msgpack.encode({ type: 'error', message: 'Level not found on server' }));
            } else {
                ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to load level' }));
            }
        }
      } else if (data.type === 'gameReady') {
        // Handle game ready message from party leader to start timer
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        // Find the party this player belongs to
        const party = findPartyByMemberId(ws.id);
        if (!party || party.leader !== ws.id) {
            console.warn(`Non-leader ${ws.username} tried to send gameReady`);
            return; // Only leader can send ready
        }

        // Get the game room
        const room = ws.room ? rooms.get(ws.room) : null;
        if (!room || room.type !== 'game') {
            console.warn(`Party leader ${ws.username} sent gameReady but not in a game room`);
            return;
        }

        // Set start time for this game room (only if not already set)
        if (!room.startTime) {
            room.startTime = Date.now();
            console.log(`⏱️ Game room ${ws.room} started timer at ${room.startTime}`);
        }
      } else if (data.type === 'raidCompleted') {
        // Only accept raid completion from party leader
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        // Find the party this player belongs to
        const party = findPartyByMemberId(ws.id);
        if (!party || party.leader !== ws.id) {
            console.warn(`Non-leader ${ws.username} tried to report raid completion`);
            return; // Only leader can report completion
        }

        // Get all party members in the same room
        const room = ws.room ? rooms.get(ws.room) : null;
        if (!room) {
            console.warn(`Party leader ${ws.username} reported completion but not in a room`);
            return;
        }

        // Calculate server-side elapsed time
        let serverTime = null;
        if (room.startTime) {
            const elapsedMs = Date.now() - room.startTime;
            serverTime = Math.round(elapsedMs / 1000); // Convert to seconds
            console.log(`⏱️ Game room ${ws.room} completed in ${serverTime} seconds (server time)`);
        } else {
            console.warn(`⚠️ Game room ${ws.room} completed but no start time was recorded`);
        }

        // Get stats from leader's message
        const stats = data.stats || null;

        // Generate loot for each party member and add to their inventory
        const lootForPlayers = {};
        let inventoryUpdated = false;
        
        for (const memberId of party.members) {
            const memberClient = clients.get(memberId);
            if (memberClient && memberClient.username && room.clients.has(memberClient)) {
                // Generate random loot: any equipment slot (except weapon)
                const lootTypes = ['armor', 'hat', 'amulet', 'ring', 'spellcard'];
                const randomIndex = Math.floor(Math.random() * lootTypes.length);
                const itemType = lootTypes[randomIndex];
                console.log(`[LootGeneration] Random index: ${randomIndex}, Selected type: ${itemType}`);
                
                // Create loot item based on type
                let lootItem = {
                    name: itemType,
                    stats: [] // Default to empty stats
                };
                
                // Set display name and special properties based on item type
                if (itemType === 'ring') {
                    // Random passive ability for ring (no stats)
                    const randomPassiveAbility = PASSIVE_ABILITIES[Math.floor(Math.random() * PASSIVE_ABILITIES.length)];
                    lootItem.displayName = getPassiveAbilityDisplayName(randomPassiveAbility);
                    lootItem.passiveAbility = randomPassiveAbility;
                } else if (itemType === 'spellcard') {
                    // Random active ability for spellcard (no stats)
                    const randomActiveAbility = ACTIVE_ABILITIES[Math.floor(Math.random() * ACTIVE_ABILITIES.length)];
                    lootItem.displayName = getSpellcardDisplayName(randomActiveAbility);
                    lootItem.activeAbility = randomActiveAbility;
                } else {
                    // Regular items (armor, hat, amulet) - have stats
                    const displayNames = {
                        armor: 'Armor',
                        hat: 'Hat',
                        amulet: 'Amulet'
                    };
                    lootItem.displayName = displayNames[itemType] || itemType;
                    
                    // Determine number of slots based on item type
                    const slotCounts = {
                        armor: 3,
                        hat: 2,
                        amulet: 1
                    };
                    const slotCount = slotCounts[itemType];
                    
                    // Generate stats for the item
                    const availableStats = [...ITEM_STATS];
                    const stats = [];
                    
                    for (let i = 0; i < slotCount; i++) {
                        const randomIndex = Math.floor(Math.random() * availableStats.length);
                        const selectedStat = availableStats[randomIndex];
                        availableStats.splice(randomIndex, 1); // Remove to prevent duplicates
                        
                        // First stat gets 2x bonus, others get 1x
                        const value = i === 0 ? 2 : 1;
                        stats.push({
                            stat: selectedStat,
                            value: value
                        });
                    }
                    
                    lootItem.stats = stats;
                }
                
                lootForPlayers[memberClient.username] = lootItem;
                
                // Add loot item to player's inventory
                const user = await db.getUserByUsername(memberClient.username);
                if (user) {
                    if (!user.inventory) {
                        user.inventory = [];
                    }
                    user.inventory.push(lootItem);
                    await db.updateUser(memberClient.username, user);
                    inventoryUpdated = true;
                    const itemDesc = itemType === 'ring' ? `${lootItem.displayName} (${itemType})` : 
                                   itemType === 'spellcard' ? `${lootItem.displayName} (${itemType})` : 
                                   itemType;
                    if (lootItem.stats && lootItem.stats.length > 0) {
                        const firstStat = lootItem.stats[0].stat;
                        console.log(`📦 Added ${itemDesc} to ${memberClient.username}'s inventory with ${lootItem.stats.length} stats (${firstStat} +${lootItem.stats[0].value})`);
                    } else {
                        console.log(`📦 Added ${itemDesc} to ${memberClient.username}'s inventory`);
                    }
                }
            }
        }
        
        // Inventories are already saved to database in the loop above
        if (inventoryUpdated) {
            console.log(`💾 Saved updated inventories to database`);
        }

        // Send loot and stats to each party member
        for (const memberId of party.members) {
            const memberClient = clients.get(memberId);
            if (memberClient && memberClient.username && memberClient.readyState === ws.OPEN) {
                const playerLoot = lootForPlayers[memberClient.username];
                if (playerLoot) {
                    // Create stats object with server-calculated time
                    const statsWithServerTime = stats ? { ...stats } : {};
                    if (serverTime !== null) {
                        statsWithServerTime.serverTime = serverTime;
                    }
                    
                    memberClient.send(msgpack.encode({
                        type: 'raidLoot',
                        loot: playerLoot,
                        stats: statsWithServerTime // Include stats with server time
                    }));
                    // Get first stat for logging
                    const firstStat = Array.isArray(playerLoot.stats) && playerLoot.stats.length > 0 
                        ? playerLoot.stats[0].stat 
                        : 'unknown';
                    console.log(`🎁 Sent loot to ${memberClient.username}: ${playerLoot.name} with ${firstStat}`);
                }
            }
        }

        // Delete game room after sending stats and loot (and adding items to inventory)
        if (room && room.type === 'game' && ws.room) {
            rooms.delete(ws.room);
            console.log(`🗑️ Deleted game room: ${ws.room}`);
        }

        console.log(`✅ Raid completed in room ${ws.room} by party led by ${ws.username}`);
      } else if (data.type === 'changeUsername') {
        if (!ws.username) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Not logged in' }));
            }
            return;
        }

        // Validate username
        const usernameValidation = validateUsername(data.newUsername);
        if (!usernameValidation.valid) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: usernameValidation.error }));
            }
            return;
        }

        // Check if username already exists
        const existingUser = await db.usernameExists(usernameValidation.value);
        if (existingUser) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Username already taken' }));
            }
            return;
        }

        // Get current user - authorization check: user can only change their own username
        const user = await db.getUserByUsername(ws.username);
        if (!user) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'User not found' }));
            }
            return;
        }
        
        // Additional authorization check: ensure ws.username matches the user being modified
        if (user.username !== ws.username) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Permission denied' }));
            }
            return;
        }

        // Update username in database
        try {
            await db.updateUsername(ws.username, usernameValidation.value);
            ws.username = usernameValidation.value; // Update WebSocket username
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ 
                    type: 'changeUsernameSuccess', 
                    newUsername: usernameValidation.value 
                }));
            }
        } catch (error) {
            console.error('Failed to save username change', error);
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Failed to save username' }));
            }
        }
      } else if (data.type === 'googleOAuth') {
        // Handle Google OAuth login
        if (!data.credential) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'error', message: 'Google credential is required' }));
            }
            return;
        }

        try {
            // Verify Google token by decoding JWT (basic verification)
            // In production, you should verify the token signature with Google's public keys
            const tokenParts = data.credential.split('.');
            if (tokenParts.length !== 3) {
                throw new Error('Invalid token format');
            }

            // Decode the payload (base64url decode)
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString('utf-8'));
            
            // Verify token is not expired
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                throw new Error('Token has expired');
            }

            // Extract Google user information
            const googleId = payload.sub; // Google user ID
            const email = payload.email;
            const name = payload.name || email.split('@')[0];
            const picture = payload.picture || null;

            if (!googleId || !email) {
                throw new Error('Invalid token: missing user information');
            }

            console.log(`🔐 Google OAuth login attempt: GoogleId=${googleId}, Email=${email}`);

            // Check if user exists by Google ID first
            let user = await db.getUserByGoogleId(googleId);
            
            // If not found by Google ID, check by email
            if (!user) {
                user = await db.getUserByEmail(email);
                
                // If found by email, update with Google ID
                if (user) {
                    console.log(`✅ Found existing user by email: ${user.username}, updating with Google ID`);
                    user.googleId = googleId;
                    await db.updateUser(user.username, user);
                }
            }

            // If user doesn't exist, create new account
            if (!user) {
                // Generate username from email (remove @domain, replace dots with underscores)
                let baseUsername = email.split('@')[0].replace(/\./g, '_');
                let username = baseUsername;
                let counter = 1;
                
                // Ensure username is unique
                while (await db.getUserByUsername(username)) {
                    username = `${baseUsername}${counter}`;
                    counter++;
                }

                // Validate username
                const usernameValidation = validateUsername(username);
                if (!usernameValidation.valid) {
                    // Fallback to a generated username
                    username = `user_${googleId.substring(0, 8)}`;
                } else {
                    username = usernameValidation.value;
                }

                console.log(`📝 Creating new Google user: Username=${username}, Email=${email}`);

                // Create new user with Google credentials
                const newUser = {
                    username: username,
                    password: crypto.randomBytes(32).toString('hex'), // Random password (not used for Google auth)
                    stats: { maxHp: 100, maxMp: 50, hp: 100, mp: 50 },
                    inventory: [],
                    equipment: { weapon: null },
                    weaponData: null,
                    passiveAbility: null,
                    rank: 'player',
                    verified: 1, // Google accounts are automatically verified
                    googleId: googleId,
                    email: email
                };

                await db.createUser(newUser);
                user = await db.getUserByUsername(username);
                
                if (!user) {
                    throw new Error('Failed to create user account');
                }
            }

            // Log user in
            ws.username = user.username;
            ws.rank = user.rank || 'player';
            ws.isAdmin = (ws.rank === 'admin');

            console.log(`✅ Google OAuth login successful: Username=${user.username}, Email=${email}`);

            // Send success response
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({
                    type: 'loginSuccess',
                    username: user.username,
                    rank: user.rank,
                    email: user.email,
                    isGoogleAuth: true
                }));
            }

            // Auto-join first campaign lobby
            const party = ensurePartyForClient(ws);
            broadcastPartyUpdate(party);
            await joinFirstCampaignLobby(ws);

        } catch (error) {
            console.error('❌ Google OAuth error:', error);
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({
                    type: 'error',
                    message: `Google login failed: ${error.message}`
                }));
            }
        }
      } else if (data.type === 'getForumCategories') {
        try {
            const categories = await db.getForumCategories();
            // Get stats for each category
            const categoriesWithStats = await Promise.all(categories.map(async (cat) => {
                if (cat.parent_id) {
                    // Only get stats for subcategories (not parent categories)
                    const stats = await db.getForumCategoryStats(cat.id);
                    return {
                        ...cat,
                        threadCount: stats.threadCount,
                        totalPostCount: stats.totalPostCount
                    };
                }
                return cat;
            }));
            ws.send(msgpack.encode({ type: 'forumCategories', categories: categoriesWithStats }));
        } catch (error) {
            console.error('Failed to get forum categories', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to get forum categories' }));
        }
      } else if (data.type === 'getForumThreads') {
        if (!data.categoryId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Category ID required' }));
            return;
        }
        try {
            const threads = await db.getForumThreads(data.categoryId);
            
            // Get like counts for the first post of each thread
            const threadsWithLikes = await Promise.all(threads.map(async (thread) => {
                // Get first post (oldest) for this thread
                const posts = await db.getForumPosts(thread.id);
                if (posts && posts.length > 0) {
                    const firstPost = posts[0]; // First post is the main thread post
                    const likeCount = await db.getPostLikeCount(firstPost.id);
                    return { ...thread, likeCount };
                }
                return { ...thread, likeCount: 0 };
            }));
            
            ws.send(msgpack.encode({ type: 'forumThreads', threads: threadsWithLikes }));
        } catch (error) {
            console.error('Failed to get forum threads', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to get forum threads' }));
        }
      } else if (data.type === 'getForumThread') {
        if (!data.threadId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Thread ID required' }));
            return;
        }
        try {
            const thread = await db.getForumThread(data.threadId);
            if (!thread) {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread not found' }));
                return;
            }
            const posts = await db.getForumPosts(data.threadId);
            
            // Get like info for all posts
            const postIds = posts.map(p => p.id);
            const likeInfo = await db.getPostLikeInfo(postIds, ws.username || null);
            
            // Add like info to posts
            const postsWithLikes = posts.map(post => ({
                ...post,
                likeCount: likeInfo.counts[post.id] || 0,
                userLiked: likeInfo.userLikes[post.id] || false
            }));
            
            ws.send(msgpack.encode({ type: 'forumThread', thread, posts: postsWithLikes }));
        } catch (error) {
            console.error('Failed to get forum thread', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to get forum thread' }));
        }
      } else if (data.type === 'createForumThread') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (!data.categoryId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Category ID required' }));
            return;
        }
        
        // Validate and sanitize title
        const titleValidation = validateForumTitle(data.title);
        if (!titleValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: titleValidation.error }));
            return;
        }
        
        // Validate and sanitize content
        const contentValidation = validateForumContent(data.content);
        if (!contentValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: contentValidation.error }));
            return;
        }
        
        // Sanitize title and content to prevent XSS
        const sanitizedTitle = purify.sanitize(titleValidation.value, {
            ALLOWED_TAGS: [], // No HTML tags allowed in title
            ALLOWED_ATTR: []
        });
        
        const sanitizedContent = purify.sanitize(contentValidation.value, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre'], // Allow basic formatting
            ALLOWED_ATTR: []
        });
        
        try {
            const threadId = await db.createForumThread(data.categoryId, sanitizedTitle, ws.username);
            // Create the first post with the thread content
            await db.createForumPost(threadId, ws.username, sanitizedContent);
            ws.send(msgpack.encode({ type: 'forumThreadCreated', threadId }));
        } catch (error) {
            console.error('Failed to create forum thread', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to create forum thread' }));
        }
      } else if (data.type === 'createForumPost') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (!data.threadId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Thread ID required' }));
            return;
        }
        
        // Validate and sanitize content
        const contentValidation = validateForumContent(data.content);
        if (!contentValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: contentValidation.error }));
            return;
        }
        
        // Sanitize content to prevent XSS
        const sanitizedContent = purify.sanitize(contentValidation.value, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre'], // Allow basic formatting
            ALLOWED_ATTR: []
        });
        
        try {
            const postId = await db.createForumPost(data.threadId, ws.username, sanitizedContent);
            ws.send(msgpack.encode({ type: 'forumPostCreated', postId }));
        } catch (error) {
            console.error('Failed to create forum post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to create forum post' }));
        }
      } else if (data.type === 'deleteForumThread') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (!data.threadId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Thread ID required' }));
            return;
        }
        try {
            // Get thread to check ownership
            const thread = await db.getForumThread(data.threadId);
            if (!thread) {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread not found' }));
                return;
            }
            
            // Check permissions: admin can delete any thread, others can only delete their own
            const isAdmin = ws.rank === 'admin';
            const isOwner = thread.author === ws.username;
            
            if (!isAdmin && !isOwner) {
                ws.send(msgpack.encode({ type: 'error', message: 'Permission denied' }));
                return;
            }
            
            const deleted = await db.deleteForumThread(data.threadId);
            if (deleted) {
                ws.send(msgpack.encode({ type: 'forumThreadDeleted', threadId: data.threadId }));
                console.log(`✅ Thread ${data.threadId} deleted by ${ws.username} (${isAdmin ? 'admin' : 'owner'})`);
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete thread' }));
            }
        } catch (error) {
            console.error('Failed to delete forum thread', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete forum thread' }));
        }
      } else if (data.type === 'deleteForumPost') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            // Get post to check ownership
            const post = await db.getForumPostById(data.postId);
            if (!post) {
                ws.send(msgpack.encode({ type: 'error', message: 'Post not found' }));
                return;
            }
            
            // Check permissions: admin can delete any post, others can only delete their own
            const isAdmin = ws.rank === 'admin';
            const isOwner = post.author === ws.username;
            
            if (!isAdmin && !isOwner) {
                ws.send(msgpack.encode({ type: 'error', message: 'Permission denied' }));
                return;
            }
            
            const deleted = await db.deleteForumPost(data.postId);
            if (deleted) {
                ws.send(msgpack.encode({ type: 'forumPostDeleted', postId: data.postId, threadId: post.thread_id }));
                console.log(`✅ Post ${data.postId} deleted by ${ws.username} (${isAdmin ? 'admin' : 'owner'})`);
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete post' }));
            }
        } catch (error) {
            console.error('Failed to delete forum post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete forum post' }));
        }
      } else if (data.type === 'verifyUser') {
        if (!data.username || !data.password) {
            ws.send(msgpack.encode({ type: 'error', message: 'Username and password required' }));
            return;
        }
        
        // Validate username and password
        const usernameValidation = validateUsername(data.username);
        if (!usernameValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: usernameValidation.error }));
            return;
        }
        
        const passwordValidation = validatePassword(data.password);
        if (!passwordValidation.valid) {
            ws.send(msgpack.encode({ type: 'error', message: passwordValidation.error }));
            return;
        }
        
        try {
            // verifyUser now uses password hashing internally
            const verified = await db.verifyUser(usernameValidation.value, passwordValidation.value);
            if (verified) {
                ws.send(msgpack.encode({ type: 'userVerified', success: true }));
                console.log(`✅ User "${usernameValidation.value}" verified successfully`);
            } else {
                ws.send(msgpack.encode({ type: 'userVerified', success: false, message: 'Invalid username or password' }));
            }
        } catch (error) {
            console.error('Failed to verify user', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to verify user' }));
        }
      } else if (data.type === 'likeForumPost') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            const liked = await db.likePost(data.postId, ws.username);
            const likeCount = await db.getPostLikeCount(data.postId);
            ws.send(msgpack.encode({ 
                type: 'forumPostLiked', 
                postId: data.postId,
                likeCount: likeCount,
                liked: liked
            }));
        } catch (error) {
            console.error('Failed to like post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to like post' }));
        }
      } else if (data.type === 'unlikeForumPost') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            const unliked = await db.unlikePost(data.postId, ws.username);
            const likeCount = await db.getPostLikeCount(data.postId);
            ws.send(msgpack.encode({ 
                type: 'forumPostUnliked', 
                postId: data.postId,
                likeCount: likeCount,
                unliked: unliked
            }));
        } catch (error) {
            console.error('Failed to unlike post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to unlike post' }));
        }
      }

    } catch (err) {
      console.error('Invalid message', err);
      ws.send(msgpack.encode({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log(`❌ Client disconnected: ID=${ws.id}, Total clients: ${clients.size - 1}`);
    clients.delete(ws.id);
    
    // Clean up client verification and rate limiting
    verifiedClients.delete(ws.id);
    pendingChallenges.delete(ws.id);
    cleanupMessageRateLimit(ws.id);
    
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
      
      // Notify other clients that this player has disconnected
      for (const client of room.clients) {
        if (client.readyState === ws.OPEN) {
          client.send(msgpack.encode({ type: 'playerDisconnect', id: ws.id }));
        }
      }
    }
  });
});

// Server console command handler
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
});

rl.on('line', async (input) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return;
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (command === 'rang' && parts.length === 3) {
    const username = parts[1];
    const rank = parts[2].toLowerCase();

    // Validate rank
    const validRanks = ['player', 'moderator', 'admin'];
    if (!validRanks.includes(rank)) {
      console.log(`❌ Invalid rank: "${rank}". Must be one of: ${validRanks.join(', ')}`);
      return;
    }

    try {
      // Check if user exists
      const user = await db.getUserByUsername(username);
      if (!user) {
        console.log(`❌ User "${username}" not found.`);
        return;
      }

      // Update user rank
      const updated = await db.setUserRank(username, rank);
      if (updated) {
        console.log(`✅ Set rank of "${username}" to "${rank}".`);

        // Update rank for all connected clients with this username
        let updatedCount = 0;
        for (const client of clients.values()) {
          if (client.username === username) {
            client.rank = rank;
            client.isAdmin = (rank === 'admin');
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          console.log(`✅ Updated rank for ${updatedCount} connected client(s).`);
        }
      } else {
        console.log(`❌ Failed to update rank for "${username}".`);
      }
    } catch (error) {
      console.error(`❌ Error setting rank:`, error.message);
    }
  } else if (command === 'blockip' && parts.length === 2) {
    const ip = parts[1];
    blockedIPs.add(ip);
    console.log(`✅ Blocked IP: ${ip}`);
    
    // Disconnect all connections from this IP
    let disconnectedCount = 0;
    for (const client of clients.values()) {
      if (client.clientIP === ip && client.readyState === client.OPEN) {
        client.close(1008, 'IP blocked by administrator');
        disconnectedCount++;
      }
    }
    if (disconnectedCount > 0) {
      console.log(`✅ Disconnected ${disconnectedCount} connection(s) from ${ip}`);
    }
  } else if (command === 'unblockip' && parts.length === 2) {
    const ip = parts[1];
    if (blockedIPs.delete(ip)) {
      console.log(`✅ Unblocked IP: ${ip}`);
    } else {
      console.log(`ℹ️  IP ${ip} was not blocked`);
    }
  } else if (command === 'listblocked') {
    if (blockedIPs.size === 0) {
      console.log('ℹ️  No IPs are currently blocked');
    } else {
      console.log(`\nBlocked IPs (${blockedIPs.size}):`);
      for (const ip of blockedIPs) {
        console.log(`  - ${ip}`);
      }
      console.log('');
    }
  } else if (command === 'migratepass') {
    console.log('🔄 Starting password migration (plain text -> bcrypt hash)...');
    try {
      const result = await db.migrateAllPasswords();
      console.log(`✅ Migration completed: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors} errors`);
    } catch (error) {
      console.error('❌ Password migration failed:', error);
    }
  } else if (command === 'help' || command === '?') {
    console.log('\nAvailable server console commands:');
    console.log('  rang <username> <rank>  - Set user rank (player, moderator, admin)');
    console.log('  blockip <ip>           - Block an IP address');
    console.log('  unblockip <ip>         - Unblock an IP address');
    console.log('  listblocked            - List all blocked IPs');
    console.log('  migratepass            - Migrate all plain text passwords to bcrypt hashes');
    console.log('  help                   - Show this help message');
    console.log('');
  } else {
    console.log(`❌ Unknown command: "${command}". Type "help" for available commands.`);
  }
});

console.log('✅ Server console ready. Type "help" for available commands.');