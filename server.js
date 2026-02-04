// server.js
import { WebSocketServer } from 'ws';
import { promises as fs, readFileSync, existsSync } from 'fs';
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
import OpenAI from 'openai';
import express from 'express';
import https from 'https';
import { fork } from 'child_process';

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

// App files directory for OTA updates (should point to MyApplication/app/src/main/assets/www)
// You can set this to the actual path where your app files are located
const APP_FILES_DIRECTORY = path.join(__dirname, '..', 'MyApplication', 'app', 'src', 'main', 'assets', 'www');

const OPENAI_KEY_FILE = path.join(__dirname, 'oak.txt');
const OAUTH_CLIENT_ID_FILE = path.join(__dirname, 'oauth.txt');
let _openaiClient = null;
let _openaiApiKeyCached = null; // null = not loaded yet, '' = missing

// Google OAuth Web Client ID (read from oauth.txt)
let _googleClientIdCached = null; // null = not loaded yet, '' = missing
function loadGoogleClientId() {
    if (_googleClientIdCached !== null) return _googleClientIdCached;
    
    try {
        if (existsSync(OAUTH_CLIENT_ID_FILE)) {
            const fileContent = readFileSync(OAUTH_CLIENT_ID_FILE, 'utf8').trim();
            const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            // Look for a line that looks like a Google Client ID (ends with .apps.googleusercontent.com)
            for (const line of lines) {
                if (line.includes('.apps.googleusercontent.com')) {
                    _googleClientIdCached = line;
                    console.log('[GoogleAuth] Loaded Google Client ID from oauth.txt');
                    return _googleClientIdCached;
                }
            }
            
            // If no Google Client ID format found, use first non-empty line
            if (lines.length > 0 && lines[0]) {
                _googleClientIdCached = lines[0];
                console.log('[GoogleAuth] Loaded OAuth Client ID from oauth.txt (first line)');
                return _googleClientIdCached;
            }
        }
    } catch (error) {
        console.warn('[GoogleAuth] Error reading Google Client ID from oauth.txt:', error.message);
    }
    
    _googleClientIdCached = ''; // Mark as missing
    return _googleClientIdCached;
}
function loadOpenAIKeyOnce() {
    if (_openaiApiKeyCached !== null) return _openaiApiKeyCached;

    const envKey = process.env.OPENAI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
        _openaiApiKeyCached = envKey.trim();
        return _openaiApiKeyCached;
    }

    try {
        if (existsSync(OPENAI_KEY_FILE)) {
            const fileKey = String(readFileSync(OPENAI_KEY_FILE, 'utf8') || '').trim();
            if (fileKey) {
                _openaiApiKeyCached = fileKey;
                return _openaiApiKeyCached;
            }
        }
    } catch (_) {
        // ignore
    }

    _openaiApiKeyCached = '';
    return _openaiApiKeyCached;
}

function getOpenAIClient() {
    const apiKey = loadOpenAIKeyOnce();
    if (!apiKey) return null;
    if (_openaiClient) return _openaiClient;
    _openaiClient = new OpenAI({ apiKey });
    return _openaiClient;
}

// Helper function to verify code with OpenAI (returns verdict string)
async function verifyCodeWithOpenAI(code) {
    return null; // Code verification disabled
    const client = getOpenAIClient();
    if (!client) {
        return null; // No API key
    }

    const trimmed = String(code || '').trim();
    if (!trimmed) {
        return null;
    }

    // Basic payload cap to avoid abuse
    const MAX_CODE_CHARS = 20000;
    const safeCode = trimmed.length > MAX_CODE_CHARS ? trimmed.slice(0, MAX_CODE_CHARS) : trimmed;

    try {
        const userPrompt = `${safeCode}\n\n\nIs this code a hack or data theft attempt?`;
        const resp = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 50,
            messages: [
                {
                    role: 'system',
                    content:
                        'You review JavaScript code for security vulnerabilities and exploit attempts. ' +
                        'Is this code a hack or data theft attempt? ' +
                        'Respond with: [EMOJI] [30 char explanation]. ' +
                        'Format: "✅ Safe: [reason]" or "❌ Harmful: [reason]".'
                },
                { role: 'user', content: userPrompt }
            ]
        });

        let rawAnswer = resp?.choices?.[0]?.message?.content || '';
        // Extract emoji (first emoji found)
        const emojiMatch = rawAnswer.match(/[✅❌⚠️]/);
        const emoji = emojiMatch ? emojiMatch[0] : '⚠️';
        
        // Extract explanation (text after emoji, max 30 chars)
        let explanation = rawAnswer.replace(/[✅❌⚠️]\s*/, '').trim();
        if (!explanation || explanation.length === 0) {
            // Fallback: try to infer from content
            const lower = rawAnswer.toLowerCase();
            if (lower.includes('safe') && !lower.includes('unsafe')) {
                explanation = 'Safe code';
            } else if (lower.includes('unsafe') || lower.includes('danger') || lower.includes('risk')) {
                explanation = 'Unsafe code detected';
            } else {
                explanation = 'Unknown safety status';
            }
        }
        // Truncate to 30 chars
        explanation = explanation.length > 30 ? explanation.slice(0, 27) + '...' : explanation;
        
        return `${emoji} ${explanation}`;
    } catch (error) {
        console.error('[verifyCodeWithOpenAI] Failed:', error);
        return null;
    }
}

// Helper function to verify multiple codes in one message (for levels)
async function verifyMultipleCodesWithOpenAI(codes) {
    return null; // Code verification disabled
    const client = getOpenAIClient();
    if (!client) {
        return null; // No API key
    }

    if (!Array.isArray(codes) || codes.length === 0) {
        return null;
    }

    // Filter out empty codes and trim
    const validCodes = codes
        .map(code => String(code || '').trim())
        .filter(code => code.length > 0);

    if (validCodes.length === 0) {
        return null;
    }

    // Combine all codes with separators
    const combinedCode = validCodes
        .map((code, index) => `// Code ${index + 1}\n${code}`)
        .join('\n\n---\n\n');

    // Basic payload cap to avoid abuse
    const MAX_CODE_CHARS = 50000; // Higher limit for multiple codes
    const safeCode = combinedCode.length > MAX_CODE_CHARS ? combinedCode.slice(0, MAX_CODE_CHARS) : combinedCode;

    try {
        const userPrompt = `${safeCode}\n\n\nIs this code a hack or data theft attempt?`;
        const resp = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 50,
            messages: [
                {
                    role: 'system',
                    content:
                        'You review JavaScript code for security vulnerabilities and exploit attempts. ' +
                        'Is this code a hack or data theft attempt? ' +
                        'Respond with: [EMOJI] [30 char explanation]. ' +
                        'Format: "✅ Safe: [reason]" or "❌ Harmful: [reason]".'
                },
                { role: 'user', content: userPrompt }
            ]
        });

        let rawAnswer = resp?.choices?.[0]?.message?.content || '';
        // Extract emoji (first emoji found)
        const emojiMatch = rawAnswer.match(/[✅❌⚠️]/);
        const emoji = emojiMatch ? emojiMatch[0] : '⚠️';
        
        // Extract explanation (text after emoji, max 30 chars)
        let explanation = rawAnswer.replace(/[✅❌⚠️]\s*/, '').trim();
        if (!explanation || explanation.length === 0) {
            // Fallback: try to infer from content
            const lower = rawAnswer.toLowerCase();
            if (lower.includes('safe') && !lower.includes('unsafe')) {
                explanation = 'Safe code';
            } else if (lower.includes('unsafe') || lower.includes('danger') || lower.includes('risk')) {
                explanation = 'Unsafe code detected';
            } else {
                explanation = 'Unknown safety status';
            }
        }
        // Truncate to 30 chars
        explanation = explanation.length > 30 ? explanation.slice(0, 27) + '...' : explanation;
        
        return `${emoji} ${explanation}`;
    } catch (error) {
        console.error('[verifyMultipleCodesWithOpenAI] Failed:', error);
        return null;
    }
}

const MAX_LEVEL_NAME_LENGTH = 64;
const MAX_LEVEL_DATA_BYTES = 256 * 1024; // 256 KB
const LEVEL_SLUG_REGEX = /^[a-z0-9]+[a-z0-9-_]*$/;
const MAX_SPRITE_SIZE = 1024; // 1 KB max sprite size

await Promise.all([
    fs.mkdir(levelsDirectory, { recursive: true }),
    fs.mkdir(weaponsDirectory, { recursive: true })
]);

// Equipment slots
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'amulet', 'outfit', 'spellcard'];

// Available stats for items
const ITEM_STATS = ['maxHp', 'maxMp', 'MpRegen', 'critical', 'block', 'knockback', 'recovery', 'reload'];

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
// Session validation helper
async function validateSessionForRequest(ws, sessionId, googleId = null) {
    if (!sessionId) {
        return { valid: false, error: 'Session ID required' };
    }
    
    // Require googleId for session validation (security: bind session to Google ID)
    if (!googleId) {
        return { valid: false, error: 'Google ID required for session validation' };
    }
    
    const sessionInfo = await db.validateSession(sessionId, googleId);
    if (!sessionInfo) {
        return { valid: false, error: 'Invalid or expired session, or Google ID mismatch' };
    }
    
    // Update WebSocket with session info
    // Use the raw googleId parameter (already verified) instead of the hashed version from sessionInfo
    ws.googleId = googleId;
    ws.userId = sessionInfo.userId;
    ws.username = sessionInfo.name;
    ws.name = sessionInfo.name;
    ws.rank = sessionInfo.rank || 'player';
    ws.isAdmin = (sessionInfo.rank === 'admin');
    ws.sessionId = sessionId;
    // Note: ws.email is not set here during session restoration - it's only set during googleLogin
    // This is fine for most operations, but forum operations that require email verification will need re-authentication
    
    return { valid: true, user: sessionInfo };
}

// Verify Google ID token
async function verifyGoogleIdToken(idToken) {
    return new Promise((resolve, reject) => {
        if (!idToken) {
            resolve(null);
            return;
        }
        
        // Use Google's tokeninfo endpoint to verify the token
        const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.warn(`[GoogleAuth] Token verification failed with status ${res.statusCode}`);
                        resolve(null);
                        return;
                    }
                    
                    const tokenInfo = JSON.parse(data);
                    
                    // Verify the token is valid and has required fields
                    if (tokenInfo.error) {
                        console.warn(`[GoogleAuth] Token verification error: ${tokenInfo.error}`);
                        resolve(null);
                        return;
                    }
                    
                    // Check if token has expired
                    if (tokenInfo.exp) {
                        const expTime = parseInt(tokenInfo.exp) * 1000; // Convert to milliseconds
                        if (Date.now() >= expTime) {
                            console.warn('[GoogleAuth] Token has expired');
                            resolve(null);
                            return;
                        }
                    }
                    
                    // Verify audience (client ID) if we have it configured
                    const googleClientId = loadGoogleClientId();
                    if (googleClientId && tokenInfo.aud) {
                        // Verify the token was issued for our client ID
                        if (tokenInfo.aud !== googleClientId) {
                            console.warn(`[GoogleAuth] Token audience mismatch: expected ${googleClientId}, got ${tokenInfo.aud}`);
                            resolve(null);
                            return;
                        }
                    } else if (googleClientId) {
                        console.warn('[GoogleAuth] Token missing audience field');
                    }
                    
                    // Token is valid, return user info
                    resolve({
                        googleId: tokenInfo.sub || tokenInfo.user_id,
                        email: tokenInfo.email,
                        emailVerified: tokenInfo.email_verified === 'true',
                        name: tokenInfo.name,
                        picture: tokenInfo.picture
                    });
                } catch (error) {
                    console.error('[GoogleAuth] Error parsing token info:', error);
                    resolve(null);
                }
            });
        }).on('error', (error) => {
            console.error('[GoogleAuth] Error verifying token:', error);
            resolve(null);
        });
    });
}

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
            amulet: null,
            outfit: null,
            spellcard: null
        },
        weaponData: null
    };
}

// Generate a random username
function generateRandomUsername() {
    const adjectives = ['Cool', 'Swift', 'Brave', 'Epic', 'Dark', 'Bright', 'Wild', 'Silent', 'Fierce', 'Mystic', 'Golden', 'Shadow', 'Storm', 'Fire', 'Ice', 'Thunder', 'Steel', 'Dragon', 'Wolf', 'Eagle'];
    const nouns = ['Warrior', 'Hunter', 'Guardian', 'Knight', 'Mage', 'Ranger', 'Rogue', 'Paladin', 'Assassin', 'Berserker', 'Sage', 'Bard', 'Druid', 'Shaman', 'Warlock', 'Archer', 'Monk', 'Priest', 'Necromancer', 'Sorcerer'];
    const numbers = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective}${noun}${numbers}`;
}

// Generate a unique random username (check if exists and regenerate if needed)
async function generateUniqueRandomUsername(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const randomName = generateRandomUsername();
        const exists = await db.nameExists(randomName);
        if (!exists) {
            return randomName;
        }
    }
    // If all attempts failed, add timestamp to make it unique
    const baseName = generateRandomUsername();
    return `${baseName}${Date.now().toString().slice(-6)}`;
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
        if (!client || !client.googleId) continue;
        const user = await db.getUserByGoogleId(client.googleId);
        if (!user) continue;

        let userModified = false;

        // Migrate Sword items from 'test' to 'playa' before loading weapon data
        if (user.equipment && user.equipment.weapon) {
            if (user.equipment.weapon.weaponFile === 'test' && (user.equipment.weapon.displayName === 'Sword' || user.equipment.weapon.name === 'weapon')) {
                user.equipment.weapon.weaponFile = 'playa';
                userModified = true;
                console.log(`[buildRoomWeaponData] Migrated ${user.name || client.googleId}'s Sword from 'test' to 'playa'`);
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
                    console.log(`[buildRoomWeaponData] Reloaded weapon data for ${user.name || client.googleId}: slug="${slug}", emitters=${weaponData.emitters?.length || 0}`);
                } else {
                    console.error(`[buildRoomWeaponData] Failed to load weapon data for ${user.name || client.googleId}: slug="${slug}"`);
                }
            }
        }

        data.push({
            username: user.name || client.googleId, // Use name for display
            playerId: client.id,
            weaponData: user.weaponData || null
        });
        
        // Save user if it was modified
        if (userModified) {
            await db.updateUser(client.googleId, user);
        }
    }

    return data;
}

async function buildPlayerInitDataForRoom(roomName, joiningClientId) {
    const payload = [];

    // Get the party of the joining client (if any)
    const joiningClientParty = joiningClientId ? findPartyByMemberId(joiningClientId) : null;

    for (const client of clients.values()) {
        if (!client || !client.googleId) continue;
        if (roomName && client.room !== roomName) continue;

        const user = await db.getUserByGoogleId(client.googleId);
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
            await db.updateUser(client.googleId, user);
        }
    }

    return payload;
}

// Initialize database
await db.initDatabase();
await spritesDb.initSpritesDatabase();

let globalTimer = Date.now();

// (Client verification feature removed)

// ============================================================================
// DDoS Protection - Application Level
// ============================================================================
// Note: Hosting provides network-level DDoS protection, but we need
// application-level protection for WebSocket-specific attacks

// Connection rate limiting per IP
const IP_CONNECTION_RATE_LIMIT = 30; // Max connections per IP per window
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

// Create Express HTTP server for file downloads
const httpApp = express();
const HTTP_PORT = 8082; // Update server port (8081 is used by admin-server.js)
const HTTPS_PORT = 443; // HTTPS port (standard HTTPS port)
const WS_PORT = 8080; // WebSocket port

// SSL Certificate paths (Let's Encrypt)
const SSL_CERT_PATH = '/etc/letsencrypt/live/szkodnik.com/fullchain.pem';
const SSL_KEY_PATH = '/etc/letsencrypt/live/szkodnik.com/privkey.pem';

// Check if SSL certificates exist
let sslOptions = null;
if (existsSync(SSL_CERT_PATH) && existsSync(SSL_KEY_PATH)) {
    try {
        sslOptions = {
            cert: readFileSync(SSL_CERT_PATH),
            key: readFileSync(SSL_KEY_PATH)
        };
        console.log('✅ SSL certificates loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load SSL certificates:', error.message);
        console.warn('⚠️  Server will run without HTTPS (insecure)');
    }
} else {
    console.warn('⚠️  SSL certificates not found. Server will run without HTTPS (insecure)');
    console.warn(`   Expected cert: ${SSL_CERT_PATH}`);
    console.warn(`   Expected key: ${SSL_KEY_PATH}`);
}

// Middleware
httpApp.use(express.json());

// Serve privacy policy
httpApp.get('/privacy-policy', (req, res) => {
    const privacyPolicyPath = path.join(__dirname, 'privacy-policy.html');
    if (existsSync(privacyPolicyPath)) {
        res.sendFile(privacyPolicyPath);
    } else {
        res.status(404).send('Privacy policy not found');
    }
});

// Also serve on /privacy (shorter URL)
httpApp.get('/privacy', (req, res) => {
    const privacyPolicyPath = path.join(__dirname, 'privacy-policy.html');
    if (existsSync(privacyPolicyPath)) {
        res.sendFile(privacyPolicyPath);
    } else {
        res.status(404).send('Privacy policy not found');
    }
});

// Calculate file hash (MD5) for version checking
async function calculateFileHash(filePath) {
    try {
        const content = await fs.readFile(filePath);
        return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
        return null;
    }
}

// Recursively get all files in a directory with their hashes
async function getFileManifest(dir, baseDir = dir) {
    const manifest = {};
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            
            if (entry.isDirectory()) {
                const subManifest = await getFileManifest(fullPath, baseDir);
                Object.assign(manifest, subManifest);
            } else if (entry.isFile()) {
                const hash = await calculateFileHash(fullPath);
                if (hash) {
                    manifest[relativePath] = {
                        hash,
                        size: (await fs.stat(fullPath)).size
                    };
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }
    
    return manifest;
}

// Endpoint: Get update manifest (list of all files with hashes)
httpApp.get('/api/app/update/manifest', async (req, res) => {
    try {
        if (!existsSync(APP_FILES_DIRECTORY)) {
            return res.status(404).json({ error: 'App files directory not found' });
        }
        
        const manifest = await getFileManifest(APP_FILES_DIRECTORY);
        res.json({ manifest, timestamp: Date.now() });
    } catch (error) {
        console.error('Error generating manifest:', error);
        res.status(500).json({ error: 'Failed to generate manifest' });
    }
});

// Endpoint: Check for updates (compare client manifest with server)
httpApp.post('/api/app/update/check', async (req, res) => {
    try {
        if (!existsSync(APP_FILES_DIRECTORY)) {
            return res.status(404).json({ error: 'App files directory not found' });
        }
        
        const clientManifest = req.body.manifest || {};
        const serverManifest = await getFileManifest(APP_FILES_DIRECTORY);
        
        // Find files that need updating
        const filesToUpdate = [];
        for (const [filePath, serverFile] of Object.entries(serverManifest)) {
            const clientFile = clientManifest[filePath];
            if (!clientFile || clientFile.hash !== serverFile.hash) {
                filesToUpdate.push(filePath);
            }
        }
        
        // Find files that exist on server but not on client
        for (const filePath of Object.keys(serverManifest)) {
            if (!clientManifest[filePath]) {
                filesToUpdate.push(filePath);
            }
        }
        
        res.json({
            needsUpdate: filesToUpdate.length > 0,
            filesToUpdate,
            totalFiles: Object.keys(serverManifest).length
        });
    } catch (error) {
        console.error('Error checking updates:', error);
        res.status(500).json({ error: 'Failed to check updates' });
    }
});

// Endpoint: Download a specific file
httpApp.get('/api/app/update/file/:filePath(*)', async (req, res) => {
    try {
        const filePath = req.params.filePath;
        
        // Security: prevent path traversal
        if (filePath.includes('..') || path.isAbsolute(filePath)) {
            return res.status(400).json({ error: 'Invalid file path' });
        }
        
        const fullPath = path.join(APP_FILES_DIRECTORY, filePath);
        
        // Ensure file is within app files directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedBase = path.resolve(APP_FILES_DIRECTORY);
        if (!resolvedPath.startsWith(resolvedBase)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return res.status(400).json({ error: 'Not a file' });
        }
        
        // Set appropriate headers
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        
        // Stream file
        const fileStream = await fs.readFile(fullPath);
        res.send(fileStream);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Endpoint: Download multiple files as ZIP (for batch updates)
httpApp.post('/api/app/update/download-batch', async (req, res) => {
    try {
        const { files } = req.body;
        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'Files array required' });
        }
        
        // For now, return file list - client can download individually
        // In production, you might want to create a ZIP file
        res.json({
            files: files.map(filePath => ({
                path: filePath,
                url: `/api/app/update/file/${encodeURIComponent(filePath)}`
            }))
        });
    } catch (error) {
        console.error('Error preparing batch download:', error);
        res.status(500).json({ error: 'Failed to prepare batch download' });
    }
});

// HTTP/HTTPS servers disabled - only WSS WebSocket server runs

// Create WebSocket server - WSS only (secure)
let wss;
let wssHttpsServer = null;

if (sslOptions) {
    // Create HTTPS server for WSS
    wssHttpsServer = https.createServer(sslOptions);
    wssHttpsServer.listen(WS_PORT, '0.0.0.0', () => {
        console.log(`✅ HTTPS server for WSS running on port ${WS_PORT}`);
        
        // Start the Database Admin Server as a background process
        const adminServerPath = path.join(__dirname, 'admin-server.js');
        const adminServer = fork(adminServerPath);
        
        adminServer.on('error', (err) => {
            console.error('❌ Failed to start Database Admin Server:', err);
        });
        
        adminServer.on('exit', (code) => {
            if (code !== 0) {
                console.error(`❌ Database Admin Server exited with code ${code}`);
            }
        });
        
        console.log('🚀 Database Admin Server started automatically');
    });
    
    // Create WSS (WebSocket Secure) server
    wss = new WebSocketServer({ 
        server: wssHttpsServer
    });
    
    console.log(`✅ WebSocket Secure (WSS) server created`);
    console.log(`   Server will listen on wss://0.0.0.0:${WS_PORT} (accessible from all IPs)`);
    console.log(`   Connect at: wss://szkodnik.com:${WS_PORT}`);
    
    // Attach connection handler - function is hoisted so this works even though it's defined later
    // Handler will be attached after function definition below to ensure it's ready
} else {
    console.error('❌ SSL options not available - WSS server cannot start');
    console.error('   Please configure SSL certificates to run WSS server');
    process.exit(1);
}
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
            clientId: ws.id,
            clientUsername: ws.username || null,
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
    const leaderClient = clients.get(party.leader);
    const partyDetails = {
        leader: leaderClient?.username ?? (party.leader != null ? `Guest_${party.leader}` : null),
        members: [...party.members].map(id => {
            const client = clients.get(id);
            return client?.username ?? `Guest_${id}`;
        })
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

// Shared connection handler for both WSS and WS fallback
function handleWebSocketConnection(ws, req) {
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
  });
  
  // (Verification removed)  
  
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
      
      // Validate session if sessionId is provided (for authenticated requests)
      // Require both sessionId and googleId for security (bind session to Google ID)
      if (data.sessionId && typeof data.sessionId === 'string') {
        const googleId = data.id || null; // Get googleId from request
        const sessionValidation = await validateSessionForRequest(ws, data.sessionId, googleId);
        if (!sessionValidation.valid) {
          // Session invalid - send error and don't process request
          // Only send error for non-login requests (to avoid loop)
          if (data.type !== 'googleLogin') {
            ws.send(msgpack.encode({ 
              type: 'error', 
              message: sessionValidation.error || 'Invalid session',
              sessionExpired: true
            }));
            return;
          }
        }
      }
      
      // (Verification removed)
      
      if (data.type === 'getPlayerData') {
        // Send current player data to client
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        const user = await db.getUserByGoogleId(ws.googleId);
        if (user) {
            let userDataChanged = false;
            // Migrate Sword items from 'test' to 'playa' on login
            if (user.equipment && user.equipment.weapon) {
                if (user.equipment.weapon.weaponFile === 'starter-sword' || 
                    (user.equipment.weapon.weaponFile === 'test' && (user.equipment.weapon.displayName === 'Sword' || user.equipment.weapon.name === 'weapon'))) {
                    user.equipment.weapon.weaponFile = 'playa';
                    userDataChanged = true;
                    console.log(`[Login] Migrated ${user.name || ws.googleId}'s equipped Sword from '${user.equipment.weapon.weaponFile === 'starter-sword' ? 'starter-sword' : 'test'}' to 'playa'`);
                }
                if (!user.equipment.weapon.displayName) {
                    user.equipment.weapon.displayName = 'Sword';
                    userDataChanged = true;
                }
                const slug = user.equipment.weapon.weaponFile || 'playa';
                if (!user.weaponData || user.weaponData.slug !== slug) {
                    let weaponData = await loadWeaponDataBySlug(slug);
                    if (!weaponData && slug !== 'playa') {
                        console.log(`[Login] Failed to load weapon "${slug}" for ${user.name || ws.googleId}, trying 'playa'`);
                        weaponData = await loadWeaponDataBySlug('playa');
                        user.equipment.weapon.weaponFile = 'playa';
                        userDataChanged = true;
                    }
                    if (weaponData) {
                        user.weaponData = { ...weaponData, slug: user.equipment.weapon.weaponFile || 'playa' };
                        userDataChanged = true;
                        console.log(`[Login] Loaded weapon data for ${user.name || ws.googleId}: slug="${user.equipment.weapon.weaponFile}", emitters=${weaponData.emitters?.length || 0}`);
                    } else {
                        console.error(`[Login] Failed to load weapon data for ${user.name || ws.googleId}: slug="${slug}"`);
                    }
                }
            }
            if (userDataChanged) {
                await db.updateUser(ws.googleId, user);
            }
            ws.send(msgpack.encode({
                type: 'playerData',
                playerData: {
                    username: user.name,
                    name: user.name,
                    stats: user.stats,
                    inventory: user.inventory,
                    equipment: user.equipment
                }
            }));
        } else {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
        }
      } else if (data.type === 'debugGiveLoot') {
        // Debug: Generate and give random loot to player
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        const user = await db.getUserByGoogleId(ws.googleId);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        // Generate random loot: any equipment slot (except weapon)
        const lootTypes = ['armor', 'amulet', 'outfit', 'spellcard'];
        const randomIndex = Math.floor(Math.random() * lootTypes.length);
        const itemType = lootTypes[randomIndex];
        
        // Create loot item based on type
        let lootItem = {
            name: itemType,
            stats: [] // Default to empty stats
        };
        
        // Set display name and special properties based on item type
        if (itemType === 'outfit') {
            // Outfit has no stats
            lootItem.displayName = 'Outfit';
            lootItem.stats = [];
        } else if (itemType === 'spellcard') {
            // Random active ability for spellcard (no stats)
            const randomActiveAbility = ACTIVE_ABILITIES[Math.floor(Math.random() * ACTIVE_ABILITIES.length)];
            lootItem.displayName = getSpellcardDisplayName(randomActiveAbility);
            lootItem.activeAbility = randomActiveAbility;
        } else {
            // Regular items (armor, amulet) - have stats
            const displayNames = {
                armor: 'Armor',
                amulet: 'Amulet'
            };
            lootItem.displayName = displayNames[itemType] || itemType;
            
            // Determine number of slots based on item type
            const slotCounts = {
                armor: 2,
                amulet: 1
            };
            const slotCount = slotCounts[itemType] || 0;
            
            // Generate stats for the item (only if slotCount > 0)
            if (slotCount > 0) {
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
            } else {
                // Items with 0 slot count have no stats
                lootItem.stats = [];
            }
        }
        
        // Add loot item to player's inventory
        if (!user.inventory) {
            user.inventory = [];
        }
        user.inventory.push(lootItem);
        await db.updateUser(ws.googleId, user);
        
        // Send loot back to client
        ws.send(msgpack.encode({
            type: 'raidLoot',
            loot: lootItem,
            stats: null // No stats for debug loot
        }));
        
        const itemDesc = itemType === 'spellcard' ? `${lootItem.displayName} (${itemType})` : itemType;
        if (lootItem.stats && lootItem.stats.length > 0) {
            const firstStat = lootItem.stats[0].stat;
            console.log(`[DebugGiveLoot] Added ${itemDesc} to ${ws.username || ws.googleId}'s inventory with ${lootItem.stats.length} stats (${firstStat} +${lootItem.stats[0].value})`);
        } else {
            console.log(`[DebugGiveLoot] Added ${itemDesc} to ${ws.username || ws.googleId}'s inventory`);
        }
      } else if (data.type === 'equipItem') {
        // Handle equipping an item
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        const user = await db.getUserByGoogleId(ws.googleId);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        // Authorization check: user can only equip items for themselves
        if (db.hashGoogleId(ws.googleId) !== user.googleIdHash) {
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
        
        // Apply equipment bonuses (only from armor and amulet)
        const statContributingSlots = ['armor', 'amulet'];
        statContributingSlots.forEach(slotName => {
            const equippedItem = user.equipment[slotName];
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
        await db.updateUser(ws.googleId, user);
        
        // Send success response with updated player data
        ws.send(msgpack.encode({
            type: 'equipSuccess',
            playerData: {
                stats: user.stats,
                inventory: user.inventory,
                equipment: user.equipment
            }
        }));
        
        console.log(`[EquipItem] User ${ws.username} equipped ${slotName}`);
      } else if (data.type === 'rerollItem') {
        // Handle rerolling item stats
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        const user = await db.getUserByGoogleId(ws.googleId);
        if (!user) {
            ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
            return;
        }
        
        // Authorization check: user can only reroll items for themselves
        if (db.hashGoogleId(ws.googleId) !== user.googleIdHash) {
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
        await db.updateUser(ws.googleId, user);
        
        // Send success response with updated player data
        ws.send(msgpack.encode({
            type: 'rerollSuccess',
            playerData: {
                stats: user.stats,
                inventory: user.inventory,
                equipment: user.equipment
            }
        }));
        
        console.log(`[RerollItem] User ${ws.username} rerolled stats for item at index ${inventoryIndex}`);
      } else if (data.type === 'join') {
        const { room } = data;

        // Remove from old room if any
        if (ws.room && rooms.has(ws.room)) {
          const oldRoom = rooms.get(ws.room);
          oldRoom.clients.delete(ws);
          if (oldRoom.lobbyPositions) oldRoom.lobbyPositions.delete(ws.id);
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
                clients: new Set(),
                lobbyPositions: new Map() // clientId -> { x, y } (destination only, for new joiners)
              });
            }
            
            const updatedRoom = rooms.get(room);
            if (!updatedRoom.clients) {
              updatedRoom.clients = new Set();
            }
            if (!updatedRoom.lobbyPositions) {
              updatedRoom.lobbyPositions = new Map();
            }
            const DEFAULT_LOBBY_X = 90;
            const DEFAULT_LOBBY_Y = 80;
            updatedRoom.lobbyPositions.set(ws.id, { x: DEFAULT_LOBBY_X, y: DEFAULT_LOBBY_Y });
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
                levelName: levelName,
                clientId: ws.id,
                clientUsername: ws.username || null
            }));
            console.log(`Client joined campaign lobby room: ${room} (level: ${level.name})`);

            // Send list of all players already in lobby: position = destination of their last move click (or default)
            if (roomData.type === 'lobby') {
              const DEFAULT_X = 90;
              const DEFAULT_Y = 80;
              const players = [];
              for (const client of roomData.clients) {
                const pos = roomData.lobbyPositions && roomData.lobbyPositions.get(client.id);
                const x = (pos && typeof pos.x === 'number') ? pos.x : DEFAULT_X;
                const y = (pos && typeof pos.y === 'number') ? pos.y : DEFAULT_Y;
                players.push({
                  id: client.id,
                  username: client.username || null,
                  x,
                  y
                });
              }
              ws.send(msgpack.encode({ type: 'lobbyPlayersPositions', players }));
              // Notify existing clients so the new joiner appears instantly (at default position)
              const newPlayerPayload = [{ id: ws.id, username: ws.username || null, x: DEFAULT_X, y: DEFAULT_Y }];
              const openState = ws.OPEN ?? ws.constructor?.OPEN ?? 1;
              for (const client of roomData.clients) {
                if (client !== ws && client.readyState === openState) {
                  client.send(msgpack.encode({ type: 'lobbyPlayersPositions', players: newPlayerPayload }));
                }
              }
            }
            
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
          // Allow joining an existing game room (created by sendPartyToGameRoom)
          const existingRoom = rooms.get(room);
          if (existingRoom && existingRoom.type === 'game') {
            if (!existingRoom.clients) existingRoom.clients = new Set();
            existingRoom.clients.add(ws);
            ws.room = room;

            let levelName = null;
            if (existingRoom.level) {
              try {
                const levelData = await loadCampaignLevelByName(existingRoom.level);
                levelName = levelData?.name || levelData?.data?.name || existingRoom.level.replace('.json', '');
              } catch (e) {
                levelName = existingRoom.level.replace('.json', '');
              }
            }

            ws.send(msgpack.encode({
              type: 'roomUpdate',
              room: room,
              roomType: 'game',
              level: existingRoom.level ?? null,
              levelName: levelName,
              clientId: ws.id,
              clientUsername: ws.username || null
            }));
            console.log(`Client joined game room: ${room} (level: ${existingRoom.level})`);

            const initPayload = await buildPlayerInitDataForRoom(room, ws.id);
            if (initPayload.length > 0) {
              ws.send(msgpack.encode({ type: 'playerInitData', players: initPayload }));
            }
            const weaponPayload = await buildRoomWeaponData(existingRoom.clients ? [...existingRoom.clients] : []);
            if (weaponPayload.length > 0) {
              const openState = ws.OPEN ?? ws.constructor?.OPEN ?? 1;
              for (const client of existingRoom.clients) {
                if (client && client.readyState === openState) {
                  client.send(msgpack.encode({ type: 'roomWeaponData', roomWeaponData: weaponPayload }));
                }
              }
            }
            return;
          }
          ws.send(msgpack.encode({ type: 'error', message: 'Only campaign lobby rooms are allowed' }));
          return;
        }
      }

      // When a client sends a message to their room
      else if (data.type === 'message' && ws.room) {
        const room = rooms.get(ws.room);
        if (!room) return;
        const roomClients = room.clients;

        const text = data.text || {};
        const isLobbyMove = typeof text.startX === 'number' && typeof text.startY === 'number' &&
          typeof text.destX === 'number' && typeof text.destY === 'number';

        if (isLobbyMove && room.lobbyPositions) {
          room.lobbyPositions.set(ws.id, { x: text.destX, y: text.destY });
        }

        const payload = { ...text };
        if (isLobbyMove) {
          payload.startTime = globalTimer;
        }

        const targetTime = globalTimer + 1000;

        for (const client of roomClients) {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(msgpack.encode({
              type: 'playerUpdate',
              id: ws.id,
              username: ws.username || null,
              data: payload,
              targetTime: targetTime
            }));
          }
        }
      } else if (data.type === 'codeObjectSync' && ws.room) {
        const party = findPartyByMemberId(ws.id);
        if (!party || party.leader !== ws.id) return;
        const room = rooms.get(ws.room);
        if (!room) return;
        const targetTime = globalTimer + 1000;
        const batches = Array.isArray(data.batches) ? data.batches : [];
        for (const client of room.clients) {
          if (client.readyState === ws.OPEN) {
            client.send(msgpack.encode({
              type: 'codeObjectSync',
              targetTime,
              batches
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
        // Allow non-logged-in users to invite: use a guest identity so party accept can find the inviter
        if (!ws.username) {
            ws.username = 'Guest_' + ws.id;
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
        ws.send(msgpack.encode({ type: 'partyInviteSent', targetUsername: normalizedTarget, yourUsername: ws.username }));
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
        // Allow both registered and guest players to send chat (guests use display name Guest_<id>)
        const displayName = ws.username || `Guest_${ws.id}`;

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
                    username: displayName,
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
        
        const user = await db.getUserByGoogleId(ws.googleId);
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
        await db.updateUser(ws.googleId, user);
        
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
            const uploaderGoogleId = ws.googleId;
            const weaponSlug = createLevelSlug(sanitizedWeapon.name);
            const targetPath = path.resolve(weaponsDirectory, `${weaponSlug}.json`);
            const relativePath = path.relative(weaponsDirectory, targetPath);

            if (relativePath.startsWith('..') || relativePath.includes(`${path.sep}..`)) {
                throw new Error('Invalid weapon name');
            }

            const payloadToStore = {
                ...sanitizedWeapon,
                uploadedBy: uploaderGoogleId,
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
            const uploaderGoogleId = ws.googleId;
            let forumThreadId = null;
            let forumPostId = null;

            if (!uploaderGoogleId) {
                throw new Error('Unable to determine uploader googleId');
            }

            // Check if level already exists and is owned by this user
            const existingLevel = await db.getStageBySlug(fileName);
            console.log(`[uploadedLevel] Level "${fileName}": existingLevel=${!!existingLevel}, ownedBy=${existingLevel?.uploadedBy}, uploader=${uploaderGoogleId}, overwrite=${!!data.overwrite}, description="${data.description || ''}"`);
            
            if (existingLevel && existingLevel.uploadedBy === uploaderGoogleId) {
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
                await db.createStage(fileName, sanitizedPayload.name, sanitizedPayload.data, uploaderGoogleId);
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
                        console.log(`[uploadedLevel] Creating forum thread: title="${threadTitle}", author="${uploaderGoogleId}", categoryId=${levelsCategory.id}`);
                        const threadId = await db.createForumThread(levelsCategory.id, threadTitle, uploaderGoogleId);
                        console.log(`[uploadedLevel] Forum thread created with ID: ${threadId}`);
                        forumThreadId = threadId;
                        
                        // Create first post with description (if provided) followed by [level]slug[/level] BBCode
                        let postContent = '';
                        if (data.description && data.description.trim()) {
                            postContent = data.description.trim() + '\n\n[level]' + fileName + '[/level]';
                            console.log(`[uploadedLevel] Post content includes description: "${data.description.trim()}"`);
                        } else {
                            postContent = `[level]${fileName}[/level]`;
                            console.log(`[uploadedLevel] Post content has no description`);
                        }
                        forumPostId = await db.createForumPost(threadId, uploaderGoogleId, postContent);
                        console.log(`[uploadedLevel] Forum post created for thread ID: ${threadId}`);
                        
                        // Verify all codeObjects in the stage
                        try {
                            let stageData = sanitizedPayload.data;
                            
                            // If data is a string, parse it
                            if (typeof stageData === 'string') {
                                try {
                                    stageData = JSON.parse(stageData);
                                } catch (parseErr) {
                                    console.error('[uploadedLevel] Failed to parse stage data as JSON:', parseErr);
                                    stageData = null;
                                }
                            }
                            
                            if (stageData && typeof stageData === 'object' && stageData.codeObjects && Array.isArray(stageData.codeObjects)) {
                                console.log(`[uploadedLevel] Found ${stageData.codeObjects.length} codeObjects to verify`);
                                
                                // Collect all codes from codeObjects
                                const allCodes = [];
                                const codeObjectNames = [];
                                
                                for (const codeObjectEntry of stageData.codeObjects) {
                                    // Handle both [name, code] array format and object format
                                    let objectName, code;
                                    if (Array.isArray(codeObjectEntry) && codeObjectEntry.length >= 2) {
                                        [objectName, code] = codeObjectEntry;
                                    } else if (codeObjectEntry && typeof codeObjectEntry === 'object') {
                                        objectName = codeObjectEntry.name || codeObjectEntry.key || 'Unknown';
                                        code = codeObjectEntry.code || codeObjectEntry.value || '';
                                    } else {
                                        console.log(`[uploadedLevel] Skipping invalid codeObject entry:`, codeObjectEntry);
                                        continue;
                                    }
                                    
                                    if (!code || typeof code !== 'string' || !code.trim()) {
                                        console.log(`[uploadedLevel] Skipping empty codeObject: ${objectName}`);
                                        continue;
                                    }
                                    
                                    allCodes.push(code.trim());
                                    codeObjectNames.push(objectName);
                                }
                                
                                // Verify all codes in one message
                                if (allCodes.length > 0) {
                                    try {
                                        console.log(`[uploadedLevel] Verifying ${allCodes.length} codeObjects in one message (total ${allCodes.reduce((sum, c) => sum + c.length, 0)} chars)`);
                                        const verdict = await verifyMultipleCodesWithOpenAI(allCodes);
                                        if (verdict) {
                                            // Create single verification post for all codeObjects
                                            const codeObjectsList = codeObjectNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
                                            const verificationPost = `**Code Objects (${codeObjectNames.length}):**\n${codeObjectsList}\n\n${verdict}`;
                                            await db.createForumPost(threadId, 'system', verificationPost);
                                            console.log(`[uploadedLevel] Verification post created for ${codeObjectNames.length} codeObjects`);
                                        } else {
                                            console.log(`[uploadedLevel] Verification skipped for ${codeObjectNames.length} codeObjects (no API key or error)`);
                                        }
                                    } catch (codeVerifyErr) {
                                        console.error(`[uploadedLevel] Failed to verify codeObjects:`, codeVerifyErr);
                                    }
                                }
                            } else {
                                if (!stageData) {
                                    console.log(`[uploadedLevel] Stage data is null or invalid`);
                                } else if (!stageData.codeObjects) {
                                    console.log(`[uploadedLevel] No codeObjects property in stage data`);
                                } else if (!Array.isArray(stageData.codeObjects)) {
                                    console.log(`[uploadedLevel] codeObjects exists but is not an array (type: ${typeof stageData.codeObjects})`);
                                }
                            }
                        } catch (codeObjectsError) {
                            // Don't fail the level upload if code verification fails
                            console.error('[uploadedLevel] Error verifying codeObjects (non-fatal):', codeObjectsError);
                            console.error('[uploadedLevel] Error stack:', codeObjectsError.stack);
                        }
                        
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

            // If we didn't create a thread this time (overwrite) or creation failed,
            // try to find the existing forum post/thread by [level]slug[/level].
            if (!forumThreadId || !forumPostId) {
                try {
                    const found = await db.findForumPostByLevelSlug(fileName);
                    if (found) {
                        forumThreadId = found.threadId;
                        forumPostId = found.postId;
                    }
                } catch (e) {
                    console.warn('[uploadedLevel] Failed to find forum post by level slug:', e?.message || e);
                }
            }

            ws.send(msgpack.encode({
                type: 'uploadedLevelSuccess',
                name: sanitizedPayload.name,
                uploadedBy: ws.name || uploaderGoogleId, // Display name in response
                slug: fileName,
                forumThreadId: forumThreadId || null,
                forumPostId: forumPostId || null
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

        // Verify user is admin before allowing campaign upload
        if (ws.rank !== 'admin') {
            ws.send(msgpack.encode({ type: 'error', message: 'Only administrators can upload campaign levels' }));
            return;
        }

        try {
            const levelPayload = data.level ?? { name: data.name, data: data.data };
            const { fileName, sanitizedPayload } = sanitizeLevelPayload(levelPayload);
            const uploaderGoogleId = ws.googleId;

            if (!uploaderGoogleId) {
                throw new Error('Unable to determine uploader googleId');
            }

            // Check if level already exists and is owned by this user
            const existingLevel = await db.getCampaignLevelBySlug(fileName);
            if (existingLevel && existingLevel.uploadedBy === uploaderGoogleId) {
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
                await db.createCampaignLevel(fileName, sanitizedPayload.name, sanitizedPayload.data, uploaderGoogleId);
                
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
                uploadedBy: ws.name || uploaderGoogleId, // Display name in response
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
            const { filename, data: fileData, folderPath, description } = data;
            
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
            
            // Decode base64 data first (needed for validation)
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
                // Reject 1x1 (or tiny) PNGs so sprites don't appear as a single color when drawn
                if (buffer.length >= 24) {
                    const width = buffer.readUInt32BE(16);
                    const height = buffer.readUInt32BE(20);
                    if (width < 2 || height < 2) {
                        throw new Error('Sprite must be at least 2x2 pixels. Use Resize in Sprite Creator to enlarge the canvas.');
                    }
                }
            }
            
            // Get user's id for folder path (work only with IDs)
            if (!ws.userId) {
                throw new Error('Not logged in');
            }
            const userId = ws.userId.toString(); // Convert to string for folder path
            
            // Check if user is admin or moderator and wants to upload to root
            const isAdminOrModerator = ws.rank === 'admin' || ws.rank === 'moderator';
            const wantsRootUpload = (description && description.includes('/root')) || 
                                   (folderPath && (folderPath === '/root' || folderPath.includes('/root')));
            
            // Validate and normalize folder path
            let normalizedFolderPath = folderPath || '';
            // Remove leading/trailing slashes and normalize
            normalizedFolderPath = normalizedFolderPath.replace(/^\/+|\/+$/g, '');
            // Validate folder path format (alphanumeric, underscore, hyphen, slash)
            if (normalizedFolderPath && !/^[a-zA-Z0-9_\/-]+$/.test(normalizedFolderPath)) {
                throw new Error('Invalid folder path format');
            }
            
            // Build final folder path
            let finalFolderPath;
            if (isAdminOrModerator && wantsRootUpload) {
                // Admin/Moderator with /root marker: upload to global root folder (empty string)
                finalFolderPath = '';
                console.log(`[uploadSprite] Admin/Moderator ${ws.username} uploading to root folder`);
            } else if (!normalizedFolderPath) {
                // Empty folder path = user's root folder (not global root)
                finalFolderPath = userId;
            } else {
                // Non-empty folder path = create folder inside user's folder
                // Remove any leading userId/ if present (security: always use current user's ID)
                if (normalizedFolderPath.startsWith(userId + '/')) {
                    normalizedFolderPath = normalizedFolderPath.substring(userId.length + 1);
                }
                finalFolderPath = `${userId}/${normalizedFolderPath}`;
            }
            
            // Check if sprite already exists in this folder
            const existingSprite = await spritesDb.getSpriteByFilename(filename, finalFolderPath);
            if (existingSprite) {
                console.log(`[uploadSprite] Sprite already exists: filename=${filename}, folderPath=${finalFolderPath}`);
                throw new Error('Sprite with this filename already exists in this folder');
            }

            // Save to sprites database with base64 data
            await spritesDb.createSprite(filename, ws.username, fileSize, fileData, finalFolderPath);
            
            console.log(`[uploadSprite] User ${ws.username} uploaded sprite "${filename}" to folder "${finalFolderPath}"`);

            ws.send(msgpack.encode({
                type: 'uploadSpriteSuccess',
                filename,
                folderPath: finalFolderPath,
                fileSize
            }));
        } catch (error) {
            console.error(`[uploadSprite] Error uploading sprite:`, error);
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
            const folderPath = data.folderPath !== undefined ? data.folderPath : null;
            const uploadedBy = onlyMine ? ws.username : null;
            
            const sprites = await spritesDb.getSprites(page, pageSize, uploadedBy, folderPath);
            const totalCount = await spritesDb.getSpriteCount(uploadedBy, folderPath);
            const totalPages = Math.ceil(totalCount / pageSize);

            ws.send(msgpack.encode({
                type: 'spritesList',
                sprites: sprites.map(sprite => ({
                    filename: sprite.filename,
                    folderPath: sprite.folder_path || '',
                    uploadedBy: sprite.uploaded_by,
                    uploadedAt: sprite.uploaded_at,
                    fileSize: sprite.file_size,
                    data: sprite.data // base64 string
                })),
                page,
                totalPages,
                totalCount,
                folderPath: folderPath
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to list sprites' }));
        }
      } else if (data.type === 'deleteSprite') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        try {
            const { filename, folderPath } = data;
            if (!filename || typeof filename !== 'string') {
                ws.send(msgpack.encode({ type: 'error', message: 'Filename is required' }));
                return;
            }
            const normalizedFolderPath = (folderPath != null && folderPath !== undefined) ? String(folderPath) : '';
            const sprite = await spritesDb.getSpriteByFilename(filename, normalizedFolderPath);
            if (!sprite) {
                ws.send(msgpack.encode({ type: 'error', message: 'Sprite not found' }));
                return;
            }
            // Uploader can delete their own sprite; admin/moderator can delete any sprite
            const isAdminOrModerator = ws.rank === 'admin' || ws.rank === 'moderator';
            if (sprite.uploaded_by !== ws.username && !isAdminOrModerator) {
                ws.send(msgpack.encode({ type: 'error', message: 'You can only delete your own sprites' }));
                return;
            }
            const deleted = await spritesDb.deleteSprite(filename, normalizedFolderPath);
            if (!deleted) {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete sprite' }));
                return;
            }
            ws.send(msgpack.encode({
                type: 'deleteSpriteSuccess',
                filename,
                folderPath: normalizedFolderPath
            }));
        } catch (error) {
            console.error('[deleteSprite] Error:', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to delete sprite' }));
        }
      } else if (data.type === 'renameSprite') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        if (ws.rank !== 'admin') {
            ws.send(msgpack.encode({ type: 'error', message: 'Only admins can rename sprites' }));
            return;
        }
        try {
            const { filename, folderPath, newFilename } = data;
            if (!filename || typeof filename !== 'string' || !newFilename || typeof newFilename !== 'string') {
                ws.send(msgpack.encode({ type: 'error', message: 'Filename and newFilename are required' }));
                return;
            }
            const normalizedFolderPath = (folderPath != null && folderPath !== undefined) ? String(folderPath) : '';
            if (!/^[a-zA-Z0-9_.-]+\.(gif|png)$/i.test(newFilename)) {
                ws.send(msgpack.encode({ type: 'error', message: 'Invalid new filename. Use only letters, numbers, underscore, hyphen; must end with .png or .gif' }));
                return;
            }
            const sprite = await spritesDb.getSpriteByFilename(filename, normalizedFolderPath);
            if (!sprite) {
                ws.send(msgpack.encode({ type: 'error', message: 'Sprite not found' }));
                return;
            }
            const existing = await spritesDb.getSpriteByFilename(newFilename, normalizedFolderPath);
            if (existing) {
                ws.send(msgpack.encode({ type: 'error', message: 'A sprite with that name already exists in this folder' }));
                return;
            }
            const updated = await spritesDb.updateSpriteFilename(filename, normalizedFolderPath, newFilename);
            if (!updated) {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to rename sprite' }));
                return;
            }
            ws.send(msgpack.encode({
                type: 'renameSpriteSuccess',
                filename,
                newFilename,
                folderPath: normalizedFolderPath
            }));
        } catch (error) {
            console.error('[renameSprite] Error:', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to rename sprite' }));
        }
      } else if (data.type === 'listSpriteFolders') {
        if (!ws.username) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }

        try {
            const { parentPath } = data;
            const normalizedParentPath = parentPath || '';
            
            const subfolders = await spritesDb.getSubfolders(normalizedParentPath);
            
            // Look up usernames for user IDs in folder paths
            const foldersWithUsernames = await Promise.all(subfolders.map(async (folder) => {
                const pathParts = folder.folder_path.split('/');
                const userId = pathParts[0]; // First part is always the user ID
                
                // Get username for this user ID
                let username = userId; // Default to user ID if user not found
                try {
                    const user = await db.getUserById(parseInt(userId, 10));
                    if (user && user.name) {
                        username = user.name;
                    }
                } catch (err) {
                    // If user lookup fails, use user ID as fallback
                    console.warn(`[listSpriteFolders] Failed to get username for user ID ${userId}:`, err.message);
                }
                
                return {
                    ...folder,
                    username: username
                };
            }));
            
            ws.send(msgpack.encode({
                type: 'spriteFoldersList',
                folders: foldersWithUsernames,
                parentPath: normalizedParentPath
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to list folders' }));
        }
      } else if (data.type === 'getSprite') {
        try {
            let { filename, folderPath } = data;
            if (!filename) throw new Error('Filename is required');
            const requestKey = filename; // Echo back so client can cache under requested path
            // Parse "folderPath/filename.png" into folderPath and filename (so drawSprite("@userId/sprite.png") works)
            if (typeof filename === 'string' && filename.includes('/')) {
                const parts = filename.split('/');
                filename = parts.pop();
                folderPath = parts.join('/');
            }
            const sprite = await spritesDb.getSpriteByFilename(filename, folderPath || '');
            if (!sprite) throw new Error('Sprite not found');
            
            ws.send(msgpack.encode({
                type: 'getSpriteResponse',
                filename: sprite.filename,
                folderPath: sprite.folder_path || '',
                data: sprite.data, // base64 string
                requestKey: requestKey // So client caches under e.g. "userId/sprite.png"
            }));
        } catch (error) {
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to get sprite' }));
        }
      } else if (data.type === 'getSprites') {
        try {
            const { filenames } = data;
            if (!filenames || !Array.isArray(filenames)) throw new Error('Filenames array is required');
            
            const sprites = [];
            for (const filenameOrPath of filenames) {
                // Parse filename - could be "filename.png" or "folder/path/filename.png"
                let filename = filenameOrPath;
                let folderPath = '';
                
                // If it contains a slash, treat as folder path
                if (filenameOrPath.includes('/')) {
                    const parts = filenameOrPath.split('/');
                    filename = parts.pop();
                    folderPath = parts.join('/');
                }
                
                const sprite = await spritesDb.getSpriteByFilename(filename, folderPath);
                if (sprite) {
                    sprites.push({
                        filename: sprite.filename,
                        folderPath: sprite.folder_path || '',
                        data: sprite.data,
                        requestKey: filenameOrPath // So client caches under e.g. "userId/sprite.png"
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
        // Allow unregistered players to list and switch lobbies
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
        // Allow unregistered users to import levels (level data is public on the forum)
        // Removed authentication check: if (!ws.username)

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
                const lootTypes = ['armor', 'amulet', 'outfit', 'spellcard'];
                const randomIndex = Math.floor(Math.random() * lootTypes.length);
                const itemType = lootTypes[randomIndex];
                console.log(`[LootGeneration] Random index: ${randomIndex}, Selected type: ${itemType}`);
                
                // Create loot item based on type
                let lootItem = {
                    name: itemType,
                    stats: [] // Default to empty stats
                };
                
                // Set display name and special properties based on item type
                if (itemType === 'outfit') {
                    // Outfit has no stats
                    lootItem.displayName = 'Outfit';
                    lootItem.stats = [];
                } else if (itemType === 'spellcard') {
                    // Random active ability for spellcard (no stats)
                    const randomActiveAbility = ACTIVE_ABILITIES[Math.floor(Math.random() * ACTIVE_ABILITIES.length)];
                    lootItem.displayName = getSpellcardDisplayName(randomActiveAbility);
                    lootItem.activeAbility = randomActiveAbility;
                } else {
                    // Regular items (armor, amulet) - have stats
                    const displayNames = {
                        armor: 'Armor',
                        amulet: 'Amulet'
                    };
                    lootItem.displayName = displayNames[itemType] || itemType;
                    
                    // Determine number of slots based on item type
                    const slotCounts = {
                        armor: 2,
                        amulet: 1
                    };
                    const slotCount = slotCounts[itemType] || 0;
                    
                    // Generate stats for the item (only if slotCount > 0)
                    if (slotCount > 0) {
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
                    } else {
                        // Items with 0 slot count have no stats
                        lootItem.stats = [];
                    }
                }
                
                lootForPlayers[memberClient.googleId] = lootItem;
                
                // Add loot item to player's inventory
                const user = await db.getUserByGoogleId(memberClient.googleId);
                if (user) {
                    if (!user.inventory) {
                        user.inventory = [];
                    }
                    user.inventory.push(lootItem);
                    await db.updateUser(memberClient.googleId, user);
                    inventoryUpdated = true;
                    const itemDesc = itemType === 'spellcard' ? `${lootItem.displayName} (${itemType})` : 
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
      } else if (data.type === 'changeUsername' || data.type === 'changeName') {
        // Handle both changeUsername (legacy) and changeName message types
        if (!ws.googleId) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Not logged in' }));
            }
            return;
        }

        const newName = data.newUsername || data.name || data.username;
        if (!newName || typeof newName !== 'string') {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Name is required' }));
            }
            return;
        }

        const trimmedName = newName.trim();
        if (trimmedName.length === 0 || trimmedName.length > 20) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Name must be between 1 and 20 characters' }));
            }
            return;
        }

        // Validate name format (alphanumeric, underscore, hyphen only)
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Name can only contain letters, numbers, underscores, and hyphens' }));
            }
            return;
        }

        try {
            // Check if name already exists
            const nameExists = await db.nameExists(trimmedName);
            if (nameExists) {
                const existingUser = await db.getUserByName(trimmedName);
                if (existingUser && existingUser.googleId !== ws.googleId) {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Name is already taken' }));
                    }
                    return;
                }
            }

            // Update name in database
            const updated = await db.updateName(ws.googleId, trimmedName);
            if (updated) {
                // Update WebSocket properties
                ws.username = trimmedName;
                ws.name = trimmedName;
                
                if (ws.readyState === ws.OPEN) {
                    ws.send(msgpack.encode({ 
                        type: 'changeUsernameSuccess', 
                        newUsername: trimmedName,
                        name: trimmedName // Also send name for compatibility
                    }));
                }
                console.log(`✅ User ${ws.googleId} changed name to: ${trimmedName}`);
            } else {
                if (ws.readyState === ws.OPEN) {
                    ws.send(msgpack.encode({ type: 'changeUsernameError', message: 'Failed to update name' }));
                }
            }
        } catch (error) {
            console.error('Failed to save name change', error);
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'changeUsernameError', message: error.message || 'Failed to save name' }));
            }
        }
      } else if (data.type === 'deleteAccount') {
        // Handle account deletion
        if (!ws.googleId) {
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'deleteAccountError', message: 'Not logged in' }));
            }
            return;
        }

        try {
            // Delete user from database
            const deleted = await db.deleteUser(ws.googleId);
            if (deleted) {
                console.log(`✅ Account deleted: ${ws.googleId} (${ws.name || 'unknown'})`);
                
                if (ws.readyState === ws.OPEN) {
                    ws.send(msgpack.encode({ 
                        type: 'deleteAccountSuccess',
                        message: 'Account deleted successfully'
                    }));
                }
                
                // Close the connection after sending success message
                setTimeout(() => {
                    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
                        ws.close();
                    }
                }, 500);
            } else {
                if (ws.readyState === ws.OPEN) {
                    ws.send(msgpack.encode({ type: 'deleteAccountError', message: 'Failed to delete account' }));
                }
            }
        } catch (error) {
            console.error('Failed to delete account', error);
            if (ws.readyState === ws.OPEN) {
                ws.send(msgpack.encode({ type: 'deleteAccountError', message: error.message || 'Failed to delete account' }));
            }
        }
      } else if (data.type === 'getForumCategories') {
        try {
            const categories = await db.getForumCategories();
            let filterAuthorKeys = null;
            if (data.filterUsername && typeof data.filterUsername === 'string' && data.filterUsername.trim()) {
                const raw = data.filterUsername.trim();
                const user = await db.getUserByName(raw);
                const keys = [raw, user && (user.googleIdHash || user.username || user.name)].filter(Boolean);
                // Also include any other common identifier fields if present
                if (user && user.googleIdHash) keys.push(user.googleIdHash);
                if (user && user.username) keys.push(user.username);
                if (user && user.name) keys.push(user.name);
                filterAuthorKeys = [...new Set(keys)];
            }
            // Get stats for each category
            const categoriesWithStats = await Promise.all(categories.map(async (cat) => {
                if (cat.parent_id) {
                    // Only get stats for subcategories (not parent categories)
                    const stats = await db.getForumCategoryStats(cat.id, filterAuthorKeys);
                    return {
                        ...cat,
                        threadCount: stats.threadCount,
                        totalPostCount: stats.totalPostCount,
                        userPostCount: stats.userPostCount
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
            let authorKeys = null;
            if (data.filterUsername && typeof data.filterUsername === 'string' && data.filterUsername.trim()) {
                const raw = data.filterUsername.trim();
                const user = await db.getUserByName(raw);
                const keys = [raw];
                if (user && user.googleIdHash) keys.push(user.googleIdHash);
                if (user && user.username) keys.push(user.username);
                if (user && user.name) keys.push(user.name);
                authorKeys = [...new Set(keys)];
            }

            const threads = await db.getForumThreads(data.categoryId, authorKeys);
            
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
            const likeInfo = await db.getPostLikeInfo(postIds, ws.googleId || null);
            
            // Get dislike info for all posts
            const dislikeInfo = await db.getPostDislikeInfo(postIds, ws.googleId || null);
            
            // Add like and dislike info to posts
            const postsWithLikes = posts.map(post => ({
                ...post,
                likeCount: likeInfo.counts[post.id] || 0,
                userLiked: likeInfo.userLikes[post.id] || false,
                dislikeCount: dislikeInfo.counts[post.id] || 0,
                userDisliked: dislikeInfo.userDislikes[post.id] || false
            }));
            
            ws.send(msgpack.encode({ type: 'forumThread', thread, posts: postsWithLikes }));
        } catch (error) {
            console.error('Failed to get forum thread', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to get forum thread' }));
        }
      } else if (data.type === 'verifySharedCode') {
        // Verify shared forum code via OpenAI (server-side only)
        try {
            console.log('[verifySharedCode] Request received:', {
                fromClient: ws && ws.id,
                hasAuth: !!ws.googleId,
                codeIndex: data && data.codeIndex,
                codeLen: (data && typeof data.code === 'string') ? data.code.length : 0
            });

            const requestId = (data && typeof data.requestId === 'string') ? data.requestId : null;
            const codeIndex = (data && Number.isFinite(Number(data.codeIndex))) ? Number(data.codeIndex) : null;

            const code = (data && typeof data.code === 'string') ? data.code : '';
            if (!code.trim()) {
                ws.send(msgpack.encode({
                    type: 'forumCodeVerificationResult',
                    requestId,
                    codeIndex,
                    ok: false,
                    error: 'No code provided'
                }));
                return;
            }

            // Use the shared verification function (uses prompt 1)
            const answer = await verifyCodeWithOpenAI(code);
            
            if (!answer) {
                ws.send(msgpack.encode({
                    type: 'forumCodeVerificationResult',
                    requestId,
                    codeIndex,
                    ok: false,
                    error: 'Server missing OpenAI key or verification failed'
                }));
                return;
            }

            console.log('[verifySharedCode] Response ready:', { codeIndex, answerLen: answer.length });
            ws.send(msgpack.encode({
                type: 'forumCodeVerificationResult',
                requestId,
                codeIndex,
                ok: true,
                answer
            }));
        } catch (error) {
            console.error('[verifySharedCode] Failed:', error);
            ws.send(msgpack.encode({
                type: 'forumCodeVerificationResult',
                requestId: (data && typeof data.requestId === 'string') ? data.requestId : null,
                codeIndex: (data && Number.isFinite(Number(data.codeIndex))) ? Number(data.codeIndex) : null,
                ok: false,
                error: error?.message || 'Verification failed'
            }));
        }
      } else if (data.type === 'reverifyThreadCodes') {
        // Re-verify all code blocks in a thread (admin only)
        try {
            const isAdmin = ws.rank === 'admin';
            if (!isAdmin) {
                ws.send(msgpack.encode({ type: 'error', message: 'Only admins can re-verify code' }));
                return;
            }

            const threadId = data.threadId;
            const systemPostId = data.systemPostId;

            if (!threadId || !systemPostId) {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread ID and system post ID required' }));
                return;
            }

            // Get all posts in the thread
            const threadPosts = await db.getForumPosts(threadId);
            if (!threadPosts || threadPosts.length === 0) {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread not found' }));
                return;
            }

            // Extract all code blocks from all posts (except system posts)
            const codeBlocks = [];
            threadPosts.forEach(post => {
                if (post.author === 'system') return; // Skip system posts
                
                const codeMatches = post.content.match(/\[code\]([\s\S]*?)\[\/code\]/gi);
                if (codeMatches) {
                    codeMatches.forEach(match => {
                        const codeMatch = match.match(/\[code\]([\s\S]*?)\[\/code\]/i);
                        if (codeMatch && codeMatch[1]) {
                            codeBlocks.push(codeMatch[1].trim());
                        }
                    });
                }
            });

            if (codeBlocks.length === 0) {
                ws.send(msgpack.encode({ type: 'error', message: 'No code blocks found in thread' }));
                return;
            }

            // Verify all code blocks and collect results
            const verificationResults = [];
            for (const code of codeBlocks) {
                const verdict = await verifyCodeWithOpenAI(code);
                verificationResults.push(verdict || '⚠️ Unknown');
            }

            // Combine results: if any is harmful, mark as harmful; otherwise use first result
            const hasHarmful = verificationResults.some(r => r && r.includes('❌'));
            const finalVerdict = hasHarmful 
                ? verificationResults.find(r => r && r.includes('❌')) || verificationResults[0] || '⚠️ Unknown'
                : verificationResults[0] || '✅ Safe: verified';

            // Update the system post with new verification result
            await db.updateForumPost(systemPostId, finalVerdict);

            console.log(`[reverifyThreadCodes] Re-verified ${codeBlocks.length} code blocks in thread ${threadId}, verdict: ${finalVerdict}`);

            // Send success response and reload thread
            ws.send(msgpack.encode({
                type: 'reverifyThreadCodesResult',
                ok: true,
                threadId: threadId
            }));
        } catch (error) {
            console.error('[reverifyThreadCodes] Failed:', error);
            ws.send(msgpack.encode({
                type: 'reverifyThreadCodesResult',
                ok: false,
                error: error?.message || 'Re-verification failed'
            }));
        }
      } else if (data.type === 'googleLogin') {
        // Handle Google login with proper authentication
        try {
            let verifiedGoogleId = null;
            
            // If ID token is provided, verify it with Google
            let tokenInfo = null;
            if (data.idToken) {
                console.log('[GoogleLogin] Verifying ID token with Google...');
                tokenInfo = await verifyGoogleIdToken(data.idToken);
                
                if (tokenInfo) {
                    // Token verified successfully
                    verifiedGoogleId = tokenInfo.googleId;
                    console.log(`[GoogleLogin] Token verified: ${verifiedGoogleId}`);
                } else {
                    console.warn('[GoogleLogin] Token verification failed');
                    ws.send(msgpack.encode({ type: 'error', message: 'Invalid authentication token' }));
                    return;
                }
            } else {
                // Fallback: Use provided ID (less secure, but allows older clients)
                if (!data.id) {
                    ws.send(msgpack.encode({ type: 'error', message: 'ID token or Google ID required' }));
                    return;
                }
                console.warn('[GoogleLogin] No ID token provided, using fallback verification');
                verifiedGoogleId = data.id;
            }
            
            // Get email from tokenInfo (if available) or from data
            const userEmail = (tokenInfo && tokenInfo.email) || data.email || null;
            
            // Check if user exists by googleId (lookup uses hashed Google ID)
            let user = await db.getUserByGoogleId(verifiedGoogleId);
            
            if (!user) {
                // User doesn't exist, create new user with random username
                try {
                    const defaultStats = getDefaultStats();
                    const { inventory, equipment, weaponData } = initializeInventoryAndEquipment();
                    
                    // Generate a unique random username
                    const randomName = await generateUniqueRandomUsername();
                    
                    await db.createUser({
                        googleId: verifiedGoogleId,
                        name: randomName,
                        stats: defaultStats,
                        inventory: inventory,
                        equipment: equipment,
                        weaponData: weaponData
                    });
                    console.log(`✅ Created new Google user: ${verifiedGoogleId} with random name: ${randomName}`);
                    
                    // Get the newly created user
                    user = await db.getUserByGoogleId(verifiedGoogleId);
                } catch (createErr) {
                    console.error('Failed to create Google user:', createErr);
                    console.error('Create error details:', createErr.message, createErr.stack);
                    ws.send(msgpack.encode({ type: 'error', message: 'Failed to create account: ' + createErr.message }));
                    return;
                }
            }
            
            if (!user) {
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
            
            // Create a session for this login
            const session = await db.createSession(user.id, verifiedGoogleId);
            
            // Set authentication data on WebSocket
            ws.googleId = verifiedGoogleId; // Set Google ID for uploads and other operations
            ws.email = userEmail; // Set email for forum operations (required for createForumThread)
            ws.username = user.name;
            ws.name = user.name;
            ws.userId = user.id;
            ws.sessionId = session.sessionId; // Store session ID on WebSocket
            ws.rank = user.rank || 'player';
            ws.isAdmin = (ws.rank === 'admin');
            
            // Send login success with session ID
            ws.send(msgpack.encode({
                type: 'loginSuccess',
                username: user.name,
                name: user.name,
                rank: user.rank || 'player',
                sessionId: session.sessionId // Send session ID to client
            }));
            
            console.log(`✅ Google login successful: ${user.name} (${verifiedGoogleId}) - Session: ${session.sessionId.substring(0, 16)}...`);
        } catch (error) {
            console.error('Google login error:', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Login failed: ' + error.message }));
        }
      } else if (data.type === 'checkVerification') {
        // Check verification status (legacy support - now just checks if user has valid session)
        console.log(
            '[checkVerification] Received checkVerification request from client',
            ws.id,
            'hasSessionId:',
            ws.sessionId ? 'present' : 'missing',
            'hasUserId:',
            ws.userId ? 'present' : 'missing',
            'data.sessionId:',
            data.sessionId ? 'present' : 'missing',
            'data.id:',
            data.id ? 'present' : 'missing'
        );
        
        try {
            // First, try to restore session if sessionId is provided in the request
            // Require both sessionId and googleId for security
            if (data.sessionId && typeof data.sessionId === 'string' && data.id) {
                const sessionValidation = await validateSessionForRequest(ws, data.sessionId, data.id);
                if (sessionValidation.valid) {
                    console.log('[checkVerification] Session restored from request, verification passed');
                    ws.send(msgpack.encode({ type: 'verificationResult', verified: true }));
                    return;
                }
            }
            
            // If we have session ID on WebSocket, verification is automatic (ID token was already verified)
            if (ws.sessionId && ws.userId) {
                console.log('[checkVerification] User has valid session on WebSocket, verification passed');
                ws.send(msgpack.encode({ type: 'verificationResult', verified: true }));
                return;
            }
            
            // Fallback: If no session but have googleId, verify user exists
            if (data && data.id) {
                const user = await db.getUserByGoogleId(data.id);
                const isValid = !!user;
                console.log('[checkVerification] User lookup by googleId result:', isValid, user ? `(user: ${user.name})` : '');
                ws.send(msgpack.encode({ type: 'verificationResult', verified: isValid }));
                return;
            }
            
            console.log('[checkVerification] No session or googleId, returning false');
            ws.send(msgpack.encode({ type: 'verificationResult', verified: false }));
        } catch (error) {
            console.error('[checkVerification] Error:', error);
            ws.send(msgpack.encode({ type: 'verificationResult', verified: false }));
        }
      } else if (data.type === 'restoreSession') {
        // Restore session from session ID - requires both sessionId and googleId for security
        if (!data.sessionId || typeof data.sessionId !== 'string') {
            ws.send(msgpack.encode({ type: 'error', message: 'Session ID required' }));
            return;
        }
        
        if (!data.id) {
            ws.send(msgpack.encode({ type: 'error', message: 'Google ID required for session restoration' }));
            return;
        }
        
        try {
            const sessionValidation = await validateSessionForRequest(ws, data.sessionId, data.id);
            if (!sessionValidation.valid) {
                ws.send(msgpack.encode({ 
                    type: 'error', 
                    message: sessionValidation.error || 'Invalid session',
                    sessionExpired: true
                }));
                return;
            }
            
            // Get user data
            const user = await db.getUserByGoogleIdHash(sessionValidation.user.googleId);
            if (!user) {
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
            
            // Send session restored
            ws.send(msgpack.encode({
                type: 'sessionRestored',
                username: user.name,
                name: user.name,
                rank: user.rank || 'player',
                sessionId: data.sessionId
            }));
            
            console.log(`✅ Session restored: ${user.name} (${user.googleIdHash})`);
        } catch (error) {
            console.error('Session restore error:', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to restore session' }));
        }
      } else if (data.type === 'changeName') {
        // Change user display name
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
            return;
        }
        
        if (!data.name || typeof data.name !== 'string') {
            ws.send(msgpack.encode({ type: 'error', message: 'Name is required' }));
            return;
        }
        
        const trimmedName = data.name.trim();
        if (trimmedName.length === 0 || trimmedName.length > 20) {
            ws.send(msgpack.encode({ type: 'error', message: 'Name must be between 1 and 20 characters' }));
            return;
        }
        
        // Validate name format (alphanumeric, underscore, hyphen only)
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
            ws.send(msgpack.encode({ type: 'error', message: 'Name can only contain letters, numbers, underscores, and hyphens' }));
            return;
        }
        
        try {
            // Check if name is already taken
            const nameExists = await db.nameExists(trimmedName);
            if (nameExists) {
                const existingUser = await db.getUserByName(trimmedName);
                if (existingUser && existingUser.googleId !== ws.googleId) {
                    ws.send(msgpack.encode({ type: 'error', message: 'Name is already taken' }));
                    return;
                }
            }
            
            // Update name
            const updated = await db.updateName(ws.googleId, trimmedName);
            if (updated) {
                // Update WebSocket properties
                ws.username = trimmedName;
                ws.name = trimmedName;
                
                // Update user in database
                const user = await db.getUserByGoogleId(ws.googleId);
                if (user) {
                    await db.updateUser(ws.googleId, user);
                }
                
                ws.send(msgpack.encode({
                    type: 'nameChanged',
                    name: trimmedName,
                    message: 'Name changed successfully'
                }));
                
                console.log(`✅ User ${ws.googleId} changed name to: ${trimmedName}`);
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to update name' }));
            }
        } catch (error) {
            console.error('Change name error:', error);
            ws.send(msgpack.encode({ type: 'error', message: error.message || 'Failed to change name' }));
        }
      } else if (data.type === 'createForumThread') {
        console.log('[createForumThread] Received request:', { 
            categoryId: data.categoryId, 
            title: data.title ? data.title.substring(0, 50) : 'none',
            contentLength: data.content ? data.content.length : 0,
            googleId: ws.googleId ? 'present' : 'missing',
            name: ws.name || 'none'
        });
        
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            console.error('[createForumThread] User not logged in - no googleId');
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[createForumThread] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            // Verify user exists by Google ID
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[createForumThread] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[createForumThread] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.categoryId) {
            console.error('[createForumThread] Category ID missing');
            ws.send(msgpack.encode({ type: 'error', message: 'Category ID required' }));
            return;
        }

        // Restriction: Only admins can create threads in Manuals subcategories
        try {
            const categories = await db.getForumCategories();
            const category = categories.find(c => c.id === data.categoryId);
            if (category && category.parent_id) {
                const parent = categories.find(p => p.id === category.parent_id);
                if (parent && parent.name === 'Manuals' && !ws.isAdmin) {
                    console.warn(`[createForumThread] Non-admin user ${ws.name} attempted to create thread in Manuals subcategory: ${category.name}`);
                    ws.send(msgpack.encode({ type: 'error', message: 'Only administrators can create threads in Manuals subcategories' }));
                    return;
                }
            }
        } catch (catErr) {
            console.error('[createForumThread] Error checking category restriction:', catErr);
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
            console.log('[createForumThread] Creating thread in category:', data.categoryId);
            // Use ws.name (username) if available, otherwise fallback to googleId for lookup
            const authorId = ws.name || ws.username || ws.googleId;
            const threadId = await db.createForumThread(data.categoryId, sanitizedTitle, ws.googleId);
            console.log('[createForumThread] Thread created with ID:', threadId, 'author stored as googleId:', ws.googleId, 'display name:', ws.name);
            
            // Create the first post with the thread content
            await db.createForumPost(threadId, ws.googleId, sanitizedContent);
            console.log('[createForumThread] First post created for thread:', threadId);
            
            // Auto-verify code for Objects/Functions categories
            try {
                const category = await db.getForumCategories().then(cats => cats.find(c => c.id === data.categoryId));
                if (category && (category.name === 'Objects' || category.name === 'functions' || category.name === 'Functions')) {
                    // Extract code from BBCode [code]...[/code]
                    const codeMatch = sanitizedContent.match(/\[code\]([\s\S]*?)\[\/code\]/i);
                    if (codeMatch && codeMatch[1]) {
                        const extractedCode = codeMatch[1].trim();
                        console.log('[createForumThread] Extracted code for verification, length:', extractedCode.length);
                        
                        const verdict = await verifyCodeWithOpenAI(extractedCode);
                        if (verdict) {
                            // Create second post with ChatGPT verdict (just emoji)
                            await db.createForumPost(threadId, 'system', verdict);
                            console.log('[createForumThread] Verification post created with verdict:', verdict);
                        } else {
                            console.log('[createForumThread] Verification skipped (no API key or error)');
                        }
                    }
                }
            } catch (verifyErr) {
                // Don't fail thread creation if verification fails
                console.error('[createForumThread] Verification error (non-fatal):', verifyErr);
            }
            
            ws.send(msgpack.encode({ type: 'forumThreadCreated', threadId }));
            console.log('[createForumThread] Success response sent for thread:', threadId);
        } catch (error) {
            console.error('[createForumThread] Failed to create forum thread:', error);
            console.error('[createForumThread] Error stack:', error.stack);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to create forum thread: ' + error.message }));
        }
      } else if (data.type === 'createForumPost') {
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[createForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[createForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[createForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
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
            const postId = await db.createForumPost(data.threadId, ws.googleId, sanitizedContent);
            ws.send(msgpack.encode({ type: 'forumPostCreated', postId }));
        } catch (error) {
            console.error('Failed to create forum post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to create forum post' }));
        }
      } else if (data.type === 'deleteForumThread') {
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[createForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[createForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[createForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.threadId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Thread ID required' }));
            return;
        }
        try {
            // Get thread to check ownership (author column stores googleId)
            const thread = await db.getForumThread(data.threadId);
            if (!thread) {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread not found' }));
                return;
            }
            
            // Ensure we have valid data
            if (!thread.author) {
                console.error(`[deleteForumThread] Thread ${data.threadId} has no author field`);
                ws.send(msgpack.encode({ type: 'error', message: 'Invalid thread data' }));
                return;
            }
            
            if (!ws.googleId) {
                console.error(`[deleteForumThread] ws.googleId is not set for user trying to delete thread ${data.threadId}`);
                ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
                return;
            }
            
            // Check permissions: admin can delete any thread, others can only delete their own
            // Note: thread.author stores googleId, not display name
            const isAdmin = ws.rank === 'admin';
            const threadAuthor = String(thread.author || '').trim();
            const userGoogleId = String(ws.googleId || '').trim();
            const isOwner = threadAuthor === userGoogleId && threadAuthor !== '';
            
            console.log(`[deleteForumThread] Thread ID: ${data.threadId}, Thread author: "${threadAuthor}", User googleId: "${userGoogleId}", isOwner: ${isOwner}, isAdmin: ${isAdmin}, ws.rank: ${ws.rank}`);
            
            if (!isAdmin && !isOwner) {
                ws.send(msgpack.encode({ type: 'error', message: 'Permission denied: You can only delete your own threads' }));
                return;
            }
            
            const deleted = await db.deleteForumThread(data.threadId);
            if (deleted) {
                ws.send(msgpack.encode({ type: 'forumThreadDeleted', threadId: data.threadId }));
                console.log(`✅ Thread ${data.threadId} deleted by ${ws.name || ws.googleId} (${isAdmin ? 'admin' : 'owner'})`);
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete thread' }));
            }
        } catch (error) {
            console.error('Failed to delete forum thread', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete forum thread' }));
        }
      } else if (data.type === 'pinForumThread') {
        // Only admins can pin threads
        if (!ws.isAdmin) {
            ws.send(msgpack.encode({ type: 'error', message: 'Only administrators can pin threads' }));
            return;
        }
        
        if (!data.threadId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Thread ID required' }));
            return;
        }
        
        try {
            const pinned = await db.pinForumThread(data.threadId);
            if (pinned) {
                ws.send(msgpack.encode({ type: 'forumThreadPinned', threadId: data.threadId }));
                // Reload threads for the category
                const thread = await db.getForumThread(data.threadId);
                if (thread) {
                    // Notify all clients to reload threads for this category
                    const categoryId = thread.category_id;
                    clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.send(msgpack.encode({ type: 'forumThreadsReload', categoryId }));
                        }
                    });
                }
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread not found or could not be pinned' }));
            }
        } catch (error) {
            console.error('[pinForumThread] Error:', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to pin thread: ' + error.message }));
        }
      } else if (data.type === 'unpinForumThread') {
        // Only admins can unpin threads
        if (!ws.isAdmin) {
            ws.send(msgpack.encode({ type: 'error', message: 'Only administrators can unpin threads' }));
            return;
        }
        
        if (!data.threadId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Thread ID required' }));
            return;
        }
        
        try {
            const unpinned = await db.unpinForumThread(data.threadId);
            if (unpinned) {
                ws.send(msgpack.encode({ type: 'forumThreadUnpinned', threadId: data.threadId }));
                // Reload threads for the category
                const thread = await db.getForumThread(data.threadId);
                if (thread) {
                    // Notify all clients to reload threads for this category
                    const categoryId = thread.category_id;
                    clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.send(msgpack.encode({ type: 'forumThreadsReload', categoryId }));
                        }
                    });
                }
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Thread not found or could not be unpinned' }));
            }
        } catch (error) {
            console.error('[unpinForumThread] Error:', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to unpin thread: ' + error.message }));
        }
      } else if (data.type === 'deleteForumPost') {
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[createForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[createForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[createForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            // Get post to check ownership (author column stores googleId)
            const post = await db.getForumPostById(data.postId);
            if (!post) {
                ws.send(msgpack.encode({ type: 'error', message: 'Post not found' }));
                return;
            }
            
            // Ensure we have valid data
            if (!post.author) {
                console.error(`[deleteForumPost] Post ${data.postId} has no author field`);
                ws.send(msgpack.encode({ type: 'error', message: 'Invalid post data' }));
                return;
            }
            
            if (!ws.googleId) {
                console.error(`[deleteForumPost] ws.googleId is not set for user trying to delete post ${data.postId}`);
                ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
                return;
            }
            
            // Check permissions: admin can delete any post, others can only delete their own
            // Note: post.author stores googleId, not display name
            const isAdmin = ws.rank === 'admin';
            const postAuthor = String(post.author || '').trim();
            const userGoogleId = String(ws.googleId || '').trim();
            const isOwner = postAuthor === userGoogleId && postAuthor !== '';
            
            console.log(`[deleteForumPost] Post ID: ${data.postId}, Post author: "${postAuthor}", User googleId: "${userGoogleId}", isOwner: ${isOwner}, isAdmin: ${isAdmin}, ws.rank: ${ws.rank}`);
            
            if (!isAdmin && !isOwner) {
                ws.send(msgpack.encode({ type: 'error', message: 'Permission denied: You can only delete your own posts' }));
                return;
            }
            
            const deleted = await db.deleteForumPost(data.postId);
            if (deleted) {
                ws.send(msgpack.encode({ type: 'forumPostDeleted', postId: data.postId, threadId: post.thread_id }));
                console.log(`✅ Post ${data.postId} deleted by ${ws.name || ws.googleId} (${isAdmin ? 'admin' : 'owner'})`);
            } else {
                ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete post' }));
            }
        } catch (error) {
            console.error('Failed to delete forum post', error);
            console.error('Error stack:', error.stack);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to delete forum post: ' + error.message }));
        }
      } else if (data.type === 'likeForumPost') {
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[createForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[createForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[createForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            // likePost expects googleId as second parameter, not username
            const liked = await db.likePost(data.postId, ws.googleId);
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
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[createForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[createForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[createForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            // unlikePost expects googleId as second parameter, not username
            const unliked = await db.unlikePost(data.postId, ws.googleId);
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
      } else if (data.type === 'dislikeForumPost') {
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[dislikeForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[dislikeForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[dislikeForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            // dislikePost expects googleId as second parameter, not username
            const disliked = await db.dislikePost(data.postId, ws.googleId);
            const dislikeCount = await db.getPostDislikeCount(data.postId);
            ws.send(msgpack.encode({ 
                type: 'forumPostDisliked', 
                postId: data.postId,
                dislikeCount: dislikeCount,
                disliked: disliked
            }));
        } catch (error) {
            console.error('Failed to dislike post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to dislike post' }));
        }
      } else if (data.type === 'undislikeForumPost') {
        // Verify user is authenticated (googleId is set during Google login)
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        // Verify user exists (we already have googleId from login, just verify user exists)
        try {
            if (!ws.googleId) {
                console.error('[undislikeForumPost] Missing googleId');
                ws.send(msgpack.encode({ type: 'error', message: 'Not authenticated' }));
                return;
            }
            
            const user = await db.getUserByGoogleId(ws.googleId);
            if (!user) {
                console.error('[undislikeForumPost] User not found for googleId:', ws.googleId.substring(0, 20) + '...');
                ws.send(msgpack.encode({ type: 'error', message: 'User not found' }));
                return;
            }
        } catch (verifyErr) {
            console.error('[undislikeForumPost] Verification error:', verifyErr);
            ws.send(msgpack.encode({ type: 'error', message: 'Authentication failed' }));
            return;
        }
        if (!data.postId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID required' }));
            return;
        }
        try {
            // undislikePost expects googleId as second parameter, not username
            const undisliked = await db.undislikePost(data.postId, ws.googleId);
            const dislikeCount = await db.getPostDislikeCount(data.postId);
            ws.send(msgpack.encode({ 
                type: 'forumPostUndisliked', 
                postId: data.postId,
                dislikeCount: dislikeCount,
                undisliked: undisliked
            }));
        } catch (error) {
            console.error('Failed to undislike post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to undislike post' }));
        }
      } else if (data.type === 'editForumPost') {
        // Verify user is authenticated
        if (!ws.googleId) {
            ws.send(msgpack.encode({ type: 'error', message: 'Not logged in' }));
            return;
        }
        
        if (!data.postId || !data.content) {
            ws.send(msgpack.encode({ type: 'error', message: 'Post ID and content required' }));
            return;
        }

        try {
            // Get post to check ownership
            const post = await db.getForumPostById(data.postId);
            if (!post) {
                ws.send(msgpack.encode({ type: 'error', message: 'Post not found' }));
                return;
            }

            const isAdmin = ws.rank === 'admin';
            const isOwner = post.author === ws.googleId;
            const isSystemPost = post.author === 'system';

            // Allow edit if user is owner OR if user is admin (even for system posts)
            if (!isOwner && !(isAdmin)) {
                ws.send(msgpack.encode({ type: 'error', message: 'Permission denied' }));
                return;
            }

            // Validate and sanitize content
            const contentValidation = validateForumContent(data.content);
            if (!contentValidation.valid) {
                ws.send(msgpack.encode({ type: 'error', message: contentValidation.error }));
                return;
            }
            
            const sanitizedContent = purify.sanitize(contentValidation.value, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre'],
                ALLOWED_ATTR: []
            });

            await db.updateForumPost(data.postId, sanitizedContent);
            ws.send(msgpack.encode({ type: 'forumPostUpdated', postId: data.postId }));
            console.log(`✅ Post ${data.postId} updated by ${ws.name || ws.googleId} (isAdmin: ${isAdmin})`);
        } catch (error) {
            console.error('Failed to edit forum post', error);
            ws.send(msgpack.encode({ type: 'error', message: 'Failed to edit forum post' }));
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
    
    // Clean up rate limiting
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
      if (room.lobbyPositions) room.lobbyPositions.delete(ws.id);

      // Notify other clients that this player has disconnected
      for (const client of room.clients) {
        if (client.readyState === ws.OPEN) {
          client.send(msgpack.encode({ type: 'playerDisconnect', id: ws.id }));
        }
      }
    }
  });
}

// Attach connection handler to WSS server (after function is defined)
if (wss) {
    wss.on('connection', handleWebSocketConnection);
    console.log('✅ Connection handler attached to WSS server');
} else {
    console.error('❌ WSS server not initialized - cannot attach connection handler');
}

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
    const name = parts[1];
    const rank = parts[2].toLowerCase();

    // Validate rank
    const validRanks = ['player', 'moderator', 'admin'];
    if (!validRanks.includes(rank)) {
      console.log(`❌ Invalid rank: "${rank}". Must be one of: ${validRanks.join(', ')}`);
      return;
    }

    try {
      // Check if user exists by name
      const user = await db.getUserByName(name);
      if (!user) {
        console.log(`❌ User "${name}" not found.`);
        return;
      }

      // Update user rank by googleIdHash
      const updated = await db.setUserRankByHash(user.googleIdHash, rank);
      if (updated) {
        console.log(`✅ Set rank of "${name}" to "${rank}".`);

        // Update rank for all connected clients with this googleId
        let updatedCount = 0;
        for (const client of clients.values()) {
          if (client.googleId && db.hashGoogleId(client.googleId) === user.googleIdHash) {
            client.rank = rank;
            client.isAdmin = (rank === 'admin');
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          console.log(`✅ Updated rank for ${updatedCount} connected client(s).`);
        }
      } else {
        console.log(`❌ Failed to update rank for "${name}".`);
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