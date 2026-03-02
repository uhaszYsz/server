// database.js
import sqlite3 from 'sqlite3';
import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import * as helpContent from './help-content.js';

// Password hashing configuration
const BCRYPT_ROUNDS = 10;

// Deprecated stats that should be removed
const DEPRECATED_STATS = ['damage', 'defence', 'defense', 'magic'];

// Helper function to clean deprecated stats and passive ability from user data
function cleanDeprecatedStats(user) {
    if (!user) return user;
    
    // Clean deprecated stats from user.stats
    if (user.stats && typeof user.stats === 'object') {
        DEPRECATED_STATS.forEach(stat => {
            delete user.stats[stat];
        });
    }
    
    // Clean deprecated stats from inventory items
    if (user.inventory && Array.isArray(user.inventory)) {
        user.inventory.forEach(item => {
            if (item.stats && Array.isArray(item.stats)) {
                item.stats = item.stats.filter(statEntry => !DEPRECATED_STATS.includes(statEntry.stat));
            }
        });
    }
    
    // Clean deprecated stats from equipment items
    if (user.equipment && typeof user.equipment === 'object') {
        Object.values(user.equipment).forEach(item => {
            if (item && item.stats && Array.isArray(item.stats)) {
                item.stats = item.stats.filter(statEntry => !DEPRECATED_STATS.includes(statEntry.stat));
            }
        });
    }
    
    // Remove passiveAbility field (deprecated system)
    delete user.passiveAbility;
    
    return user;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'users.db');

// Read hash secret from file (for HMAC-style Google ID hashing)
let HASH_SECRET = null;
try {
    const secretPath = path.join(__dirname, 'hashsecret.txt');
    HASH_SECRET = readFileSync(secretPath, 'utf8').trim();
    if (!HASH_SECRET || HASH_SECRET.length === 0) {
        throw new Error('Hash secret is empty');
    }
    console.log('✅ Hash secret loaded from hashsecret.txt');
} catch (error) {
    console.error('❌ Failed to load hash secret from hashsecret.txt:', error.message);
    console.error('⚠️  Server will exit - hash secret is required for security');
    process.exit(1);
}

let db = null;

// Initialize database
export function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
                return;
            }
            console.log('✅ Connected to SQLite database');
            
            // Enable foreign keys
            db.run("PRAGMA foreign_keys = ON", (err) => {
                if (err) {
                    console.warn('Warning: Could not enable foreign keys:', err);
                }
            });
            
            // Create users table first (other tables may reference it)
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    googleIdHash TEXT UNIQUE NOT NULL,
                    name TEXT,
                    stats TEXT NOT NULL DEFAULT '{}',
                    inventory TEXT NOT NULL DEFAULT '[]',
                    equipment TEXT NOT NULL DEFAULT '{}',
                    weaponData TEXT,
                    passiveAbility TEXT,
                    rank TEXT NOT NULL DEFAULT 'player',
                    verified TEXT
                )
            `, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('✅ Users table initialized');
                
                // Create forum tables
                db.run(`
                    CREATE TABLE IF NOT EXISTS forum_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    parent_id INTEGER,
                    description TEXT,
                    display_order INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                console.log('✅ Forum categories table initialized');
                
                db.run(`
                    CREATE TABLE IF NOT EXISTS forum_threads (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_id INTEGER NOT NULL,
                        title TEXT NOT NULL,
                        author TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        pinned INTEGER DEFAULT 0,
                        FOREIGN KEY (category_id) REFERENCES forum_categories(id)
                    )
                `, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('✅ Forum threads table initialized');
                    
                    // Add pinned column if it doesn't exist (migration for existing databases)
                    db.run(`ALTER TABLE forum_threads ADD COLUMN pinned INTEGER DEFAULT 0`, (err) => {
                        // Ignore error if column already exists
                        if (err && !err.message.includes('duplicate column name')) {
                            console.warn('Warning: Could not add pinned column:', err.message);
                        }
                    });
                    
                    db.run(`
                        CREATE TABLE IF NOT EXISTS forum_posts (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            thread_id INTEGER NOT NULL,
                            author TEXT NOT NULL,
                            content TEXT NOT NULL,
                            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (thread_id) REFERENCES forum_threads(id)
                        )
                    `, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        console.log('✅ Forum posts table initialized');
                        
                        // Create post_likes table to track which users liked which posts
                        // No foreign key to users table to avoid constraint issues when users table structure changes
                        db.run(`
                            CREATE TABLE IF NOT EXISTS forum_post_likes (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                post_id INTEGER NOT NULL,
                                googleId TEXT NOT NULL,
                                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (post_id) REFERENCES forum_posts(id),
                                UNIQUE(post_id, googleId)
                            )
                        `, (err) => {
                            if (err) {
                                console.error('Error creating forum_post_likes table:', err);
                            } else {
                                console.log('✅ Forum post likes table initialized');
                            }
                        });
                        
                        // Create post_dislikes table to track which users disliked which posts
                        // No foreign key to users table to avoid constraint issues when users table structure changes
                        db.run(`
                            CREATE TABLE IF NOT EXISTS forum_post_dislikes (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                post_id INTEGER NOT NULL,
                                googleId TEXT NOT NULL,
                                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (post_id) REFERENCES forum_posts(id),
                                UNIQUE(post_id, googleId)
                            )
                        `, (err) => {
                            if (err) {
                                console.error('Error creating forum_post_dislikes table:', err);
                            } else {
                                console.log('✅ Forum post dislikes table initialized');
                            }
                        });
                        
                        // Create stages table for user-uploaded levels
                        // Remove foreign key constraint to avoid issues when users table structure changes
                        db.run(`
                            CREATE TABLE IF NOT EXISTS stages (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                slug TEXT UNIQUE NOT NULL,
                                name TEXT NOT NULL,
                                data TEXT NOT NULL,
                                uploaded_by TEXT NOT NULL,
                                uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                            )
                        `, (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            console.log('✅ Stages table initialized');
                            
                            // Create campaign_levels table for campaign levels
                            // Remove foreign key constraint to avoid issues when users table structure changes
                            db.run(`
                                CREATE TABLE IF NOT EXISTS campaign_levels (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    slug TEXT UNIQUE NOT NULL,
                                    name TEXT NOT NULL,
                                    data TEXT NOT NULL,
                                    uploaded_by TEXT NOT NULL,
                                    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                                )
                            `, (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                console.log('✅ Campaign levels table initialized');
                                db.run(`ALTER TABLE campaign_levels ADD COLUMN times TEXT DEFAULT '[]'`, (err) => {
                                    if (err && !err.message.includes('duplicate column name')) {
                                        console.warn('Warning: Could not add campaign_levels.times column:', err.message);
                                    }
                                });
                                
                                // Create sessions table for authentication
                                db.run(`
                                    CREATE TABLE IF NOT EXISTS sessions (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        sessionId TEXT UNIQUE NOT NULL,
                                        userId INTEGER NOT NULL,
                                        googleId TEXT NOT NULL,
                                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                        expires_at TEXT NOT NULL,
                                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                                    )
                                `, (err) => {
                                    if (err) {
                                        console.error('Error creating sessions table:', err);
                                    } else {
                                        console.log('✅ Sessions table initialized');
                                    }
                                });
                                db.run(`
                                    CREATE TABLE IF NOT EXISTS leaderboards (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        stage_slug TEXT NOT NULL,
                                        time_seconds INTEGER NOT NULL,
                                        username TEXT NOT NULL DEFAULT '',
                                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    )
                                `, (err) => {
                                    if (err) {
                                        console.error('Error creating leaderboards table:', err);
                                    } else {
                                        console.log('✅ Leaderboards table initialized');
                                    }
                                });
                                db.run(`CREATE INDEX IF NOT EXISTS idx_leaderboards_stage_time ON leaderboards(stage_slug, time_seconds)`, (err) => {
                                    if (err) console.warn('Leaderboards index:', err?.message);
                                });
                                db.run(`
                                    CREATE TABLE IF NOT EXISTS items (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL,
                                        slot TEXT NOT NULL,
                                        codeChildren TEXT NOT NULL DEFAULT '[]'
                                    )
                                `, (err) => {
                                    if (err) {
                                        console.error('Error creating items table:', err);
                                    } else {
                                        console.log('✅ Items table initialized');
                                    }
                                });
                                
                                // Initialize default categories
                                initForumCategories().then(() => {
                                    resolve();
                                }).catch(err => {
                                    console.error('❌ Error during initForumCategories:', err);
                                    // Don't reject, just resolve so the server can start
                                    resolve();
                                });
                            });
                        });
                    });
                });
            });
            }); // Close users table callback
        });
    });
}


// Hash a password
export async function hashPassword(password) {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Verify a password against a hash
export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Hash a Google ID deterministically with server secret (HMAC-style)
// Uses SHA-256 with secret salt for security - even if Google ID is intercepted,
// attacker cannot create valid hash without knowing the secret
export function hashGoogleId(googleId) {
    if (!HASH_SECRET) {
        throw new Error('Hash secret not loaded - cannot hash Google ID');
    }
    // Hash: secret + googleId (prevents attacker from using intercepted Google ID)
    return crypto.createHash('sha256').update(HASH_SECRET + googleId).digest('hex');
}

// Create a new user (requires googleId and name)
export function createUser(user) {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate required fields
            if (!user.googleId || !user.name) {
                reject(new Error('googleId and name are required'));
                return;
            }
            
            // Hash the Google ID before storing (for privacy)
            // Use deterministic hash (SHA-256) so we can look it up later
            const googleIdHash = hashGoogleId(user.googleId);
            
            const stmt = db.prepare(`
                INSERT INTO users (googleIdHash, name, stats, inventory, equipment, weaponData, passiveAbility, rank, verified)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                googleIdHash, // Hashed Google user ID (for privacy)
                user.name, // Display name
                JSON.stringify(user.stats || {}),
                JSON.stringify(user.inventory || []),
                JSON.stringify(user.equipment || {}),
                user.weaponData ? JSON.stringify(user.weaponData) : null,
                null, // passiveAbility always null (deprecated)
                user.rank || 'player',
                null, // verified always null (deprecated)
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );

            stmt.finalize();
        } catch (error) {
            reject(error);
        }
    });
}

// Get all users
export function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM users', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            // Parse JSON fields
            const users = rows.map(row => {
                const user = {
                    id: row.id,
                    name: row.name || null,
                    stats: JSON.parse(row.stats),
                    inventory: JSON.parse(row.inventory),
                    equipment: JSON.parse(row.equipment),
                    weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                    rank: row.rank || 'player'
                };
                return cleanDeprecatedStats(user);
            });

            resolve(users);
        });
    });
}

// Get user by name (for display purposes)
export function getUserByName(name) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE name = ?', [name], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                resolve(null);
                return;
            }

            // Parse JSON fields
            const user = {
                id: row.id,
                googleIdHash: row.googleIdHash,
                name: row.name || null,
                stats: JSON.parse(row.stats),
                inventory: JSON.parse(row.inventory),
                equipment: JSON.parse(row.equipment),
                weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                rank: row.rank || 'player'
            };

            resolve(cleanDeprecatedStats(user));
        });
    });
}

// Get user by id
export function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                resolve(null);
                return;
            }

            // Parse JSON fields
            const user = {
                id: row.id,
                googleIdHash: row.googleIdHash,
                name: row.name || null,
                stats: JSON.parse(row.stats),
                inventory: JSON.parse(row.inventory),
                equipment: JSON.parse(row.equipment),
                weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                rank: row.rank || 'player'
            };

            resolve(cleanDeprecatedStats(user));
        });
    });
}

// Get user by Google ID (lookup by hashed Google ID)
export function getUserByGoogleId(googleId) {
    // Hash the Google ID for lookup (deterministic hash)
    const googleIdHash = hashGoogleId(googleId);
    return getUserByGoogleIdHash(googleIdHash);
}

// Get user by Google ID Hash
export function getUserByGoogleIdHash(googleIdHash) {
    return new Promise((resolve, reject) => {
        try {
            db.get('SELECT * FROM users WHERE googleIdHash = ?', [googleIdHash], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                // Parse JSON fields
                const user = {
                    id: row.id,
                    googleIdHash: row.googleIdHash,
                    name: row.name || null,
                    stats: JSON.parse(row.stats),
                    inventory: JSON.parse(row.inventory),
                    equipment: JSON.parse(row.equipment),
                    weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                    rank: row.rank || 'player'
                };

                resolve(cleanDeprecatedStats(user));
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Get full raw user row by Google ID (all columns for "see my data" / GDPR-style export)
export function getUserRawByGoogleId(googleId) {
    const googleIdHash = hashGoogleId(googleId);
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE googleIdHash = ?', [googleIdHash], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                resolve(null);
                return;
            }
            const raw = {
                id: row.id,
                googleIdHash: row.googleIdHash,
                name: row.name || null,
                stats: row.stats ? JSON.parse(row.stats) : {},
                inventory: row.inventory ? JSON.parse(row.inventory) : [],
                equipment: row.equipment ? JSON.parse(row.equipment) : {},
                weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                passiveAbility: row.passiveAbility || null,
                rank: row.rank || 'player',
                verified: row.verified || null
            };
            resolve(raw);
        });
    });
}

// Verify user by Google ID (no email needed - ID token already verified by Google)
export function verifyUserByGoogleId(googleId) {
    return new Promise(async (resolve, reject) => {
        try {
            const user = await getUserByGoogleId(googleId);
            resolve(!!user);
        } catch (error) {
            reject(error);
        }
    });
}

// Get user by Google ID (returns user if exists)
// Email verification not needed - ID token already verified by Google
export function getUserByEmailAndGoogleId(email, googleId) {
    // Legacy function name kept for compatibility, but only uses googleId
    return getUserByGoogleId(googleId);
}

// Update user by googleId (uses hashed Google ID for lookup)
export function updateUser(googleId, userData) {
    return new Promise(async (resolve, reject) => {
        try {
            // Hash Google ID for lookup (deterministic hash)
            const googleIdHash = hashGoogleId(googleId);
            
            // Get existing name if not updating
            let nameToStore = userData.name || null;
            if (!nameToStore) {
                const existingUser = await getUserByGoogleId(googleId);
                nameToStore = existingUser ? existingUser.name : null;
            }
            
            const stmt = db.prepare(`
                UPDATE users 
                SET name = COALESCE(?, name),
                    stats = ?,
                    inventory = ?,
                    equipment = ?,
                    weaponData = ?,
                    passiveAbility = ?,
                    rank = ?,
                    verified = ?
                WHERE googleIdHash = ?
            `);

            stmt.run(
                nameToStore,
                JSON.stringify(userData.stats || {}),
                JSON.stringify(userData.inventory || []),
                JSON.stringify(userData.equipment || {}),
                userData.weaponData ? JSON.stringify(userData.weaponData) : null,
                null, // passiveAbility always null (deprecated)
                userData.rank || 'player',
                null, // verified always null (deprecated)
                googleIdHash,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );

            stmt.finalize();
        } catch (error) {
            reject(error);
        }
    });
}

// Update user name by googleId (uses hashed Google ID for lookup)
export function updateName(googleId, newName) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
                reject(new Error('Name is required and must be a non-empty string'));
                return;
            }
            
            const trimmedName = newName.trim();
            if (trimmedName.length > 20) {
                reject(new Error('Name must be 20 characters or less'));
                return;
            }
            
            // Hash Google ID for lookup (deterministic hash)
            const googleIdHash = hashGoogleId(googleId);
            
            db.run('UPDATE users SET name = ? WHERE googleIdHash = ?', [trimmedName, googleIdHash], function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint')) {
                        reject(new Error('Name is already taken'));
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(this.changes > 0);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Check if name exists
export function nameExists(name) {
    return new Promise((resolve, reject) => {
        if (!name || typeof name !== 'string') {
            resolve(false);
            return;
        }
        
        db.get('SELECT id FROM users WHERE name = ?', [name.trim()], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(!!row);
        });
    });
}

// Set user rank by googleId (uses hashed Google ID for lookup)
export function setUserRank(googleId, rank) {
    const googleIdHash = hashGoogleId(googleId);
    return setUserRankByHash(googleIdHash, rank);
}

// Set user rank by hashed googleId
export function setUserRankByHash(googleIdHash, rank) {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate rank
            const validRanks = ['player', 'moderator', 'admin'];
            if (!validRanks.includes(rank.toLowerCase())) {
                reject(new Error(`Invalid rank. Must be one of: ${validRanks.join(', ')}`));
                return;
            }
            
            db.run('UPDATE users SET rank = ? WHERE googleIdHash = ?', [rank.toLowerCase(), googleIdHash], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Delete user by googleId
export function deleteUser(googleId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Hash Google ID for lookup (deterministic hash)
            const googleIdHash = hashGoogleId(googleId);
            
            db.run('DELETE FROM users WHERE googleIdHash = ?', [googleIdHash], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Check if googleId exists (lookup by hashed Google ID)
export function googleIdExists(googleId) {
    return new Promise((resolve, reject) => {
        try {
            // Hash the Google ID for lookup (deterministic hash)
            const googleIdHash = hashGoogleId(googleId);
            
            db.get('SELECT id FROM users WHERE googleIdHash = ?', [googleIdHash], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(!!row);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Session management functions
// Create a new session
// Stores hashed Google ID (with secret) for security - even if session is stolen,
// attacker cannot use it without knowing the secret
export function createSession(userId, googleId) {
    return new Promise((resolve, reject) => {
        try {
            // Generate secure random session ID (32 bytes = 64 hex characters)
            const sessionId = crypto.randomBytes(32).toString('hex');
            
            // Hash Google ID with secret before storing (security: prevents use of intercepted Google ID)
            const hashedGoogleId = hashGoogleId(googleId);
            
            // Session expires in 30 days
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            const expiresAtStr = expiresAt.toISOString();
            
            db.run(
                'INSERT INTO sessions (sessionId, userId, googleId, expires_at) VALUES (?, ?, ?, ?)',
                [sessionId, userId, hashedGoogleId, expiresAtStr],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({
                        sessionId,
                        userId,
                        googleId, // Return plain googleId for client (not hashed)
                        expiresAt: expiresAtStr
                    });
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

// Validate a session ID and get user info
// If googleId is provided, hash it with secret and verify it matches the session's stored hash
// This prevents attackers from using intercepted Google IDs even if they steal the sessionId
export function validateSession(sessionId, googleId = null) {
    return new Promise((resolve, reject) => {
        try {
            const now = new Date().toISOString();
            db.get(
                `SELECT s.sessionId, s.userId, s.googleId, u.name, u.rank 
                 FROM sessions s 
                 INNER JOIN users u ON s.userId = u.id 
                 WHERE s.sessionId = ? AND s.expires_at > ?`,
                [sessionId, now],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (!row) {
                        resolve(null);
                        return;
                    }
                    
                    // If googleId was provided, hash it with secret and verify it matches the session's stored hash
                    if (googleId !== null) {
                        const hashedProvidedGoogleId = hashGoogleId(googleId);
                        if (row.googleId !== hashedProvidedGoogleId) {
                            // Session exists but hashed Google ID doesn't match - possible attack
                            resolve(null);
                            return;
                        }
                    }
                    
                    // Get plain Google ID from user's googleIdHash for return value
                    // Note: We can't reverse the hash, so we'll need to get it from the user lookup
                    // For now, return the stored hash (caller should not rely on this being plain)
                    resolve({
                        sessionId: row.sessionId,
                        userId: row.userId,
                        googleId: row.googleId, // This is actually the hashed version
                        name: row.name,
                        rank: row.rank || 'player'
                    });
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

// Delete a session
export function deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this.changes > 0);
        });
    });
}

// Delete all sessions for a user (by googleId)
// Hashes the Google ID with secret before deletion (sessions store hashed Google ID)
export function deleteUserSessions(googleId) {
    return new Promise((resolve, reject) => {
        try {
            const hashedGoogleId = hashGoogleId(googleId);
            db.run('DELETE FROM sessions WHERE googleId = ?', [hashedGoogleId], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Clean up expired sessions
export function cleanupExpiredSessions() {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run('DELETE FROM sessions WHERE expires_at <= ?', [now], function(err) {
            if (err) {
                reject(err);
                return;
            }
            if (this.changes > 0) {
                console.log(`[Sessions] Cleaned up ${this.changes} expired sessions`);
            }
            resolve(this.changes);
        });
    });
}

// Initialize default forum categories
function initForumCategories() {
    return new Promise((resolve, reject) => {
        // Get or create parent categories
        db.get('SELECT id FROM forum_categories WHERE name = ? AND parent_id IS NULL', ['Discussions'], (err, discussionsRow) => {
            if (err) {
                reject(err);
                return;
            }
            
            let discussionsId;
            if (discussionsRow) {
                discussionsId = discussionsRow.id;
                // Ensure Discussions is at the top
                db.run('UPDATE forum_categories SET display_order = 10 WHERE id = ?', [discussionsId]);
            } else {
                // Insert Discussions parent category
                db.run('INSERT INTO forum_categories (name, parent_id, description, display_order) VALUES (?, ?, ?, ?)', 
                    ['Discussions', null, 'General discussions', 10], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    discussionsId = this.lastID;
                    continueWithShared();
                });
                return;
            }
            
            continueWithShared();
            
            function continueWithShared() {
                db.get('SELECT id FROM forum_categories WHERE name = ? AND parent_id IS NULL', ['Shared'], (err, sharedRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    let sharedId;
                    if (sharedRow) {
                        sharedId = sharedRow.id;
                        // Ensure Shared is in the middle
                        db.run('UPDATE forum_categories SET display_order = 20 WHERE id = ?', [sharedId]);
                    } else {
                        db.run('INSERT INTO forum_categories (name, parent_id, description, display_order) VALUES (?, ?, ?, ?)', 
                            ['Shared', null, 'Shared content', 20], function(err) {
                            if (err) {
                                reject(err);
                                return;
                            }
                            sharedId = this.lastID;
                            continueWithManuals();
                        });
                        return;
                    }
                    
                    continueWithManuals();
                    
                    function continueWithManuals() {
                        db.get('SELECT id FROM forum_categories WHERE name = ? AND parent_id IS NULL', ['Manuals'], (err, manualsRow) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            let manualsId;
                            if (manualsRow) {
                                manualsId = manualsRow.id;
                                // Ensure Manuals is at the bottom
                                db.run('UPDATE forum_categories SET display_order = 30 WHERE id = ?', [manualsId]);
                            } else {
                                db.run('INSERT INTO forum_categories (name, parent_id, description, display_order) VALUES (?, ?, ?, ?)', 
                                    ['Manuals', null, 'Game manuals and documentation', 30], function(err) {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }
                                    manualsId = this.lastID;
                                    processAllSubcategories();
                                });
                                return;
                            }
                            
                            processAllSubcategories();
                            
                            function processAllSubcategories() {
                                // Update "Danmaku raiders general" to "General" if it exists
                                db.run('UPDATE forum_categories SET name = ?, display_order = ? WHERE name = ? AND parent_id = ?',
                                    ['General', 1, 'General', discussionsId], (err) => {
                                    if (err) {
                                        console.error('Error updating old category name:', err);
                                    }
                                });
                                    
                                // Delete Tutorials category if it exists (user doesn't want it)
                                db.run('DELETE FROM forum_categories WHERE name = ? AND parent_id = ?',
                                    ['Tutorials', discussionsId], (err) => {
                                        if (err) {
                                            console.error('Error deleting Tutorials category:', err);
                                        }
                                        
                                        // Define subcategories with order
                                        const subcategories = [
                                            { name: 'General', parent_id: discussionsId, description: 'General game discussions', order: 1 },
                                            { name: 'Help', parent_id: discussionsId, description: 'Ask questions here', order: 2 },
                                            { name: 'Bug reports', parent_id: discussionsId, description: 'Report bugs', order: 3 },
                                            { name: 'Levels', parent_id: sharedId, description: 'Share levels', order: 1 },
                                            { name: 'Objects', parent_id: sharedId, description: 'Share objects', order: 2 },
                                            { name: 'functions', parent_id: sharedId, description: 'Share functions', order: 3 },
                                            { name: 'Keywords', parent_id: manualsId, description: 'JavaScript keywords reference', order: 1 },
                                            { name: 'Built-in Variables', parent_id: manualsId, description: 'Manual for built-in variables', order: 2 },
                                            { name: 'Danmaku Helpers', parent_id: manualsId, description: 'Manual for danmaku helpers', order: 3 },
                                            { name: 'DragonBones', parent_id: manualsId, description: 'Manual for DragonBones', order: 4 },
                                            { name: 'JavaScript Stuff', parent_id: manualsId, description: 'Manual for JavaScript stuff', order: 5 }
                                        ];

                                        // Delete old granular JavaScript categories if they exist
                                        const oldCategories = ['Math Functions', 'Array Methods', 'String Methods', 'Number Methods', 'Global Functions', 'Array Constructor', 'String & Number Constructors'];
                                        for (const oldCat of oldCategories) {
                                            db.run('DELETE FROM forum_categories WHERE name = ? AND parent_id = ?', [oldCat, manualsId], (err) => {
                                                if (err && err.message.includes('FOREIGN KEY')) {
                                                    // If we can't delete it due to FK, just ignore it
                                                    console.warn(`[init] Could not delete old category ${oldCat} due to foreign key constraint`);
                                                }
                                            });
                                        }
                                    
                                    let processed = 0;
                                    const total = subcategories.length;
                                    
                                    if (total === 0) {
                                        resolve();
                                        return;
                                    }
                                    
                                    subcategories.forEach(cat => {
                                        // Check if category exists
                                        db.get('SELECT id FROM forum_categories WHERE name = ? AND parent_id = ?', 
                                            [cat.name, cat.parent_id], (err, row) => {
                                            if (err) {
                                                console.error('Error checking category:', err);
                                                processed++;
                                                if (processed === total) {
                                                    resolve();
                                                }
                                                return;
                                            }
                                            
                                            if (row) {
                                                const categoryId = row.id;
                                                // Update existing category
                                                db.run('UPDATE forum_categories SET description = ?, display_order = ? WHERE id = ?',
                                                    [cat.description, cat.order, categoryId], (err) => {
                                                    if (err) {
                                                        console.error('Error updating category:', err);
                                                    }
                                                    
                                                    // Initialize help threads for this category
                                                    initHelpThreads(cat.name, categoryId).then(() => {
                                                        processed++;
                                                        if (processed === total) {
                                                            resolve();
                                                        }
                                                    }).catch(err => {
                                                        console.error(`Error initializing help threads for ${cat.name}:`, err);
                                                        processed++;
                                                        if (processed === total) {
                                                            resolve();
                                                        }
                                                    });
                                                });
                                            } else {
                                                // Insert new category
                                                db.run('INSERT INTO forum_categories (name, parent_id, description, display_order) VALUES (?, ?, ?, ?)', 
                                                    [cat.name, cat.parent_id, cat.description, cat.order], function(err) {
                                                    if (err) {
                                                        console.error('Error inserting subcategory:', err);
                                                        processed++;
                                                        if (processed === total) {
                                                            resolve();
                                                        }
                                                        return;
                                                    }
                                                    
                                                    const categoryId = this.lastID;
                                                    // Initialize help threads for this category
                                                    initHelpThreads(cat.name, categoryId).then(() => {
                                                        processed++;
                                                        if (processed === total) {
                                                            resolve();
                                                        }
                                                    }).catch(err => {
                                                        console.error(`Error initializing help threads for ${cat.name}:`, err);
                                                        processed++;
                                                        if (processed === total) {
                                                            resolve();
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    });
                                });
                            }
                        });
                    }
                });
            }
        });
    });
}

// Helper to initialize help threads for a category
// On server start: always refresh first post content from help (replies preserved). Creates missing threads.
async function initHelpThreads(categoryName, categoryId) {
    const helpMap = {
        'Keywords': helpContent.specialKeywordsHelp, // Special keywords (background, def, etc.) + will add JavaScript keywords thread below
        'Built-in Variables': helpContent.builtInVariablesHelp,
        'Danmaku Helpers': helpContent.danmakuHelpersHelp,
        'DragonBones': helpContent.dragonBonesHelp,
        'JavaScript Stuff': [
            ...helpContent.javaScriptStuffHelp,
            ...helpContent.mathFunctionsHelp,
            ...helpContent.arrayMethodsHelp,
            ...helpContent.stringMethodsHelp,
            ...helpContent.numberMethodsHelp,
            ...helpContent.globalFunctionsHelp,
            ...helpContent.arrayConstructorHelp,
            ...helpContent.stringNumberConstructorsHelp
        ]
    };

    // Special case: Create "Keywords" thread for Keywords subcategory (in addition to special keywords)
    if (categoryName === 'Keywords') {
        const keywords = ['function', 'var', 'let', 'const', 'def', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'return', 'true', 'false', 'null', 'undefined', 'inBullet'];
        const keywordsContent = `[b]JavaScript Keywords:[/b]

${keywords.map(kw => `[b][color=#f59e0b]${kw}[/color][/b]`).join(', ')}`;
        
        await new Promise((resolve, reject) => {
            db.get('SELECT id FROM forum_threads WHERE category_id = ? AND title = ?', [categoryId, 'Keywords'], (err, thread) => {
                if (err) return reject(err);

                if (thread) {
                    // Refresh first post content from help (preserve replies)
                    db.get('SELECT id, author FROM forum_posts WHERE thread_id = ? ORDER BY id ASC LIMIT 1', [thread.id], (err, firstPost) => {
                        if (err) return reject(err);
                        if (firstPost && firstPost.author === 'system') {
                            db.run('UPDATE forum_posts SET content = ? WHERE id = ?', [keywordsContent, firstPost.id], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        } else if (!firstPost) {
                            db.run('INSERT INTO forum_posts (thread_id, author, content) VALUES (?, ?, ?)',
                                [thread.id, 'system', keywordsContent], (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                        } else {
                            resolve();
                        }
                    });
                } else {
                    db.run('INSERT INTO forum_threads (category_id, title, author) VALUES (?, ?, ?)',
                        [categoryId, 'Keywords', 'system'], function(err) {
                            if (err) return reject(err);
                            const threadId = this.lastID;
                            db.run('INSERT INTO forum_posts (thread_id, author, content) VALUES (?, ?, ?)',
                                [threadId, 'system', keywordsContent], (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                        });
                }
            });
        });
    }

    const items = helpMap[categoryName];
    if (!items) return;

    for (const item of items) {
        await new Promise((resolve, reject) => {
            const titleToUse = item.threadTitle || item.name;
            db.get('SELECT id, title FROM forum_threads WHERE category_id = ? AND (title = ? OR title = ?)', [categoryId, item.name, titleToUse], (err, thread) => {
                if (err) return reject(err);

                if (thread) {
                    const refreshFirstPost = () => {
                        db.get('SELECT id, author FROM forum_posts WHERE thread_id = ? ORDER BY id ASC LIMIT 1', [thread.id], (err, firstPost) => {
                            if (err) return reject(err);
                            if (firstPost && firstPost.author === 'system') {
                                // Always refresh first post content from help (replies preserved)
                                db.run('UPDATE forum_posts SET content = ? WHERE id = ?', [item.content, firstPost.id], (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            } else if (!firstPost) {
                                db.run('INSERT INTO forum_posts (thread_id, author, content) VALUES (?, ?, ?)',
                                    [thread.id, 'system', item.content], (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    });
                            } else {
                                resolve();
                            }
                        });
                    };
                    if (item.threadTitle && thread.title !== titleToUse) {
                        db.run('UPDATE forum_threads SET title = ? WHERE id = ?', [titleToUse, thread.id], (err) => {
                            if (err) return reject(err);
                            refreshFirstPost();
                        });
                    } else {
                        refreshFirstPost();
                    }
                } else {
                    db.run('INSERT INTO forum_threads (category_id, title, author) VALUES (?, ?, ?)',
                        [categoryId, titleToUse, 'system'], function(err) {
                            if (err) return reject(err);
                            const threadId = this.lastID;
                            db.run('INSERT INTO forum_posts (thread_id, author, content) VALUES (?, ?, ?)',
                                [threadId, 'system', item.content], (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                        });
                }
            });
        });
    }
}

// Forum functions
export function getForumCategories() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM forum_categories ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, display_order ASC, name ASC', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

export function getForumCategoryByName(name, parentId = null) {
    return new Promise((resolve, reject) => {
        const query = parentId !== null 
            ? 'SELECT * FROM forum_categories WHERE name = ? AND parent_id = ?'
            : 'SELECT * FROM forum_categories WHERE name = ? AND parent_id IS NULL';
        const params = parentId !== null ? [name, parentId] : [name];
        
        db.get(query, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

export function getForumThreads(categoryId, authorKeys = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const params = [categoryId];
            let authorClause = '';
            const keys = Array.isArray(authorKeys)
                ? authorKeys.filter(Boolean)
                : (authorKeys ? [authorKeys] : []);
            if (keys.length > 0) {
                const placeholders = keys.map(() => '?').join(',');
                authorClause = ` AND t.author IN (${placeholders})`;
                params.push(...keys);
            }

            db.all(`
                SELECT t.*, 
                       (SELECT content FROM forum_posts WHERE thread_id = t.id ORDER BY created_at ASC LIMIT 1) as first_post_content,
                       (SELECT COUNT(*) FROM forum_posts WHERE thread_id = t.id AND author != 'system') as post_count,
                       (SELECT MAX(created_at) FROM forum_posts WHERE thread_id = t.id) as last_post_date
                FROM forum_threads t
                WHERE t.category_id = ?
                ${authorClause}
                ORDER BY t.pinned DESC, t.updated_at DESC
            `, params, async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Look up author names and ranks for each thread
                const rowsWithAuthors = await Promise.all(rows.map(async (row) => {
                    if (row.author && row.author !== 'system') {
                        try {
                            const user = await getUserByGoogleIdHash(row.author);
                            if (!user) {
                                console.warn(`[getForumThreads] User not found for author hash: ${row.author.substring(0, 20)}...`);
                            }
                            return {
                                ...row,
                                author_name: user ? user.name : null,
                                author_rank: user ? (user.rank || 'player') : 'player'
                            };
                        } catch (err) {
                            console.error(`[getForumThreads] Error looking up author ${row.author.substring(0, 20)}...:`, err.message || err);
                            return {
                                ...row,
                                author_name: null,
                                author_rank: 'player'
                            };
                        }
                    } else {
                        return {
                            ...row,
                            author_name: row.author === 'system' ? 'System' : null,
                            author_rank: 'player'
                        };
                    }
                }));
                
                resolve(rowsWithAuthors);
            });
        } catch (error) {
            reject(error);
        }
    });
}

export function getForumFeedThreads(limit = 20, offset = 0) {
    return new Promise(async (resolve, reject) => {
        try {
            // Exclude Manuals category and all its subcategories (Keywords, Built-in Variables, etc.)
            db.all(`
                SELECT t.*, 
                       (SELECT content FROM forum_posts WHERE thread_id = t.id ORDER BY created_at ASC LIMIT 1) as first_post_content,
                       (SELECT COUNT(*) FROM forum_posts WHERE thread_id = t.id AND author != 'system') as post_count,
                       (SELECT MAX(created_at) FROM forum_posts WHERE thread_id = t.id) as last_post_date
                FROM forum_threads t
                INNER JOIN forum_categories c ON t.category_id = c.id
                WHERE t.category_id NOT IN (
                    SELECT id FROM forum_categories WHERE name = 'Manuals' AND parent_id IS NULL
                    UNION
                    SELECT id FROM forum_categories WHERE parent_id = (SELECT id FROM forum_categories WHERE name = 'Manuals' AND parent_id IS NULL)
                )
                ORDER BY t.updated_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset], async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Look up author names and ranks for each thread
                const rowsWithAuthors = await Promise.all(rows.map(async (row) => {
                    if (row.author && row.author !== 'system') {
                        try {
                            const user = await getUserByGoogleIdHash(row.author);
                            return {
                                ...row,
                                author_name: user ? user.name : null,
                                author_rank: user ? (user.rank || 'player') : 'player'
                            };
                        } catch (err) {
                            return {
                                ...row,
                                author_name: null,
                                author_rank: 'player'
                            };
                        }
                    } else {
                        return {
                            ...row,
                            author_name: row.author === 'system' ? 'System' : null,
                            author_rank: 'player'
                        };
                    }
                }));
                
                resolve(rowsWithAuthors);
            });
        } catch (error) {
            reject(error);
        }
    });
}

export function getForumCategoryStats(categoryId, authorGoogleId = null) {
    return new Promise((resolve, reject) => {
        const rawKeys = Array.isArray(authorGoogleId)
            ? authorGoogleId.filter(Boolean)
            : (authorGoogleId ? [authorGoogleId] : []);
        const keys = rawKeys.map(id => hashGoogleId(String(id)));

        if (keys.length > 0) {
            const placeholders = keys.map(() => '?').join(',');
            db.get(`
                SELECT 
                    COUNT(DISTINCT t.id) as thread_count,
                    COUNT(CASE WHEN p.author != 'system' THEN p.id END) as total_post_count,
                    SUM(CASE WHEN p.author IN (${placeholders}) AND p.author != 'system' THEN 1 ELSE 0 END) as user_post_count
                FROM forum_threads t
                LEFT JOIN forum_posts p ON p.thread_id = t.id
                WHERE t.category_id = ?
            `, [...keys, categoryId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    threadCount: row.thread_count || 0,
                    totalPostCount: row.total_post_count || 0,
                    userPostCount: row.user_post_count || 0
                });
            });
            return;
        }

        db.get(`
            SELECT 
                COUNT(DISTINCT t.id) as thread_count,
                COUNT(CASE WHEN p.author != 'system' THEN p.id END) as total_post_count
            FROM forum_threads t
            LEFT JOIN forum_posts p ON p.thread_id = t.id
            WHERE t.category_id = ?
        `, [categoryId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({
                threadCount: row.thread_count || 0,
                totalPostCount: row.total_post_count || 0,
                userPostCount: 0
            });
        });
    });
}

export function getForumThread(threadId) {
    return new Promise(async (resolve, reject) => {
        try {
            db.get(`
                SELECT t.*
                FROM forum_threads t
                WHERE t.id = ?
            `, [threadId], async (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!row) {
                    resolve(null);
                    return;
                }
                
                // Look up author name and rank (row.author is hashed Google ID)
                if (row.author && row.author !== 'system') {
                    try {
                        const user = await getUserByGoogleIdHash(row.author);
                        resolve({
                            ...row,
                            author_name: user ? user.name : null,
                            author_rank: user ? (user.rank || 'player') : 'player'
                        });
                    } catch (err) {
                        console.error(`Error looking up author ${row.author}:`, err);
                        resolve({
                            ...row,
                            author_name: null,
                            author_rank: 'player'
                        });
                    }
                } else {
                    resolve({
                        ...row,
                        author_name: row.author === 'system' ? 'System' : null,
                        author_rank: 'player'
                    });
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

export function createForumThread(categoryId, title, authorGoogleId) {
    return new Promise((resolve, reject) => {
        const authorHash = hashGoogleId(String(authorGoogleId));
        db.run('INSERT INTO forum_threads (category_id, title, author) VALUES (?, ?, ?)', 
            [categoryId, title, authorHash], function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this.lastID);
        });
    });
}

export function getForumPosts(threadId) {
    return new Promise(async (resolve, reject) => {
        try {
            db.all(`
                SELECT p.*
                FROM forum_posts p
                WHERE p.thread_id = ?
                ORDER BY p.created_at ASC
            `, [threadId], async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Look up author names and ranks for each post
                const rowsWithAuthors = await Promise.all(rows.map(async (row) => {
                    if (row.author && row.author !== 'system') {
                        try {
                            const user = await getUserByGoogleIdHash(row.author);
                            return {
                                ...row,
                                author_name: user ? user.name : null,
                                author_rank: user ? (user.rank || 'player') : 'player'
                            };
                        } catch (err) {
                            console.error(`Error looking up author ${row.author}:`, err);
                            return {
                                ...row,
                                author_name: null,
                                author_rank: 'player'
                            };
                        }
                    } else {
                        return {
                            ...row,
                            author_name: row.author === 'system' ? 'System' : null,
                            author_rank: 'player'
                        };
                    }
                }));

                resolve(rowsWithAuthors);
            });
        } catch (error) {
            reject(error);
        }
    });
}

export function getForumPostById(postId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM forum_posts WHERE id = ?', [postId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

/** Count posts by user in a category that are replies (not the first post of each thread). author is stored as hash. */
export function countUserRepliesInCategory(googleId, categoryId) {
    return new Promise((resolve, reject) => {
        const authorHash = hashGoogleId(String(googleId));
        db.get(`
            SELECT COUNT(*) as cnt FROM forum_posts p
            INNER JOIN forum_threads t ON p.thread_id = t.id
            WHERE t.category_id = ? AND p.author = ?
            AND p.id <> (SELECT MIN(id) FROM forum_posts WHERE thread_id = p.thread_id)
        `, [categoryId, authorHash], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row ? row.cnt : 0);
        });
    });
}

export function createForumPost(threadId, authorGoogleId, content) {
    return new Promise((resolve, reject) => {
        const authorHash = hashGoogleId(String(authorGoogleId));
        db.run('INSERT INTO forum_posts (thread_id, author, content) VALUES (?, ?, ?)', 
            [threadId, authorHash, content], function(err) {
            if (err) {
                reject(err);
                return;
            }
            // Update thread updated_at
            db.run('UPDATE forum_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [threadId], (err) => {
                if (err) {
                    console.error('Error updating thread timestamp:', err);
                }
            });
            resolve(this.lastID);
        });
    });
}

// Find the first forum post/thread that references a level slug via [level]slug[/level]
export function findForumPostByLevelSlug(levelSlug) {
    return new Promise((resolve, reject) => {
        const needle = `[level]${levelSlug}[/level]`;
        db.get(
            `
            SELECT p.id as postId, p.thread_id as threadId
            FROM forum_posts p
            WHERE p.content LIKE ?
            ORDER BY p.created_at ASC
            LIMIT 1
            `,
            [`%${needle}%`],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row || null);
            }
        );
    });
}

// Delete forum thread
export function deleteForumThread(threadId) {
    return new Promise((resolve, reject) => {
        // First delete all likes for all posts in this thread
        db.run(`DELETE FROM forum_post_likes WHERE post_id IN (SELECT id FROM forum_posts WHERE thread_id = ?)`, [threadId], (err) => {
            if (err) {
                console.error('Error deleting thread post likes:', err);
            }
        });
        // Also delete all dislikes for all posts in this thread
        db.run(`DELETE FROM forum_post_dislikes WHERE post_id IN (SELECT id FROM forum_posts WHERE thread_id = ?)`, [threadId], (err) => {
            if (err) {
                console.error('Error deleting thread post dislikes:', err);
            }
        });
        // Then delete all posts in the thread
        db.run('DELETE FROM forum_posts WHERE thread_id = ?', [threadId], (err) => {
            if (err) {
                reject(err);
                return;
            }
            // Then delete the thread
            db.run('DELETE FROM forum_threads WHERE id = ?', [threadId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    });
}

// Delete forum post
export function deleteForumPost(postId) {
    return new Promise((resolve, reject) => {
        // First delete all likes for this post
        db.run('DELETE FROM forum_post_likes WHERE post_id = ?', [postId], (err) => {
            if (err) {
                console.error('Error deleting post likes:', err);
            }
        });
        // Also delete all dislikes for this post
        db.run('DELETE FROM forum_post_dislikes WHERE post_id = ?', [postId], (err) => {
            if (err) {
                console.error('Error deleting post dislikes:', err);
            }
        });
        // Then delete the post
        db.run('DELETE FROM forum_posts WHERE id = ?', [postId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Get like count for a post
export function getPostLikeCount(postId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM forum_post_likes WHERE post_id = ?', [postId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// Check if user has liked a postfdsfsfs
export function hasUserLikedPost(postId, googleId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM forum_post_likes WHERE post_id = ? AND googleId = ?', [postId, googleId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(!!row);
            }
        });
    });
}

// Like a post (store hashed Google ID)
export function likePost(postId, googleId) {
    return new Promise((resolve, reject) => {
        const hash = hashGoogleId(String(googleId));
        db.run('INSERT OR IGNORE INTO forum_post_likes (post_id, googleId) VALUES (?, ?)', [postId, hash], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Unlike a post
export function unlikePost(postId, googleId) {
    return new Promise((resolve, reject) => {
        const hash = hashGoogleId(String(googleId));
        db.run('DELETE FROM forum_post_likes WHERE post_id = ? AND googleId = ?', [postId, hash], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Update forum post content
export function updateForumPost(postId, content) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE forum_posts SET content = ? WHERE id = ?', 
            [content, postId], function(err) {
            if (err) {
                reject(err);
            } else {
                // Update thread updated_at timestamp
                db.get('SELECT thread_id FROM forum_posts WHERE id = ?', [postId], (err, row) => {
                    if (!err && row) {
                        db.run('UPDATE forum_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [row.thread_id], () => {});
                    }
                });
                resolve(this.changes > 0);
            }
        });
    });
}

// Pin a forum thread
export function pinForumThread(threadId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE forum_threads SET pinned = 1 WHERE id = ?', [threadId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Unpin a forum thread
export function unpinForumThread(threadId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE forum_threads SET pinned = 0 WHERE id = ?', [threadId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Get like counts and user likes for multiple posts
export function getPostLikeInfo(postIds, googleId) {
    return new Promise((resolve, reject) => {
        if (!postIds || postIds.length === 0) {
            resolve({ counts: {}, userLikes: {} });
            return;
        }
        const placeholders = postIds.map(() => '?').join(',');
        
        // Get like counts
        db.all(`SELECT post_id, COUNT(*) as count FROM forum_post_likes WHERE post_id IN (${placeholders}) GROUP BY post_id`, postIds, (err, countRows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const counts = {};
            postIds.forEach(id => counts[id] = 0);
            countRows.forEach(row => {
                counts[row.post_id] = row.count;
            });
            
            // Get user likes if googleId provided
            if (googleId) {
                db.all(`SELECT post_id FROM forum_post_likes WHERE post_id IN (${placeholders}) AND googleId = ?`, [...postIds, googleId], (err, likeRows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    const userLikes = {};
                    postIds.forEach(id => userLikes[id] = false);
                    likeRows.forEach(row => {
                        userLikes[row.post_id] = true;
                    });
                    
                    resolve({ counts, userLikes });
                });
            } else {
                const userLikes = {};
                postIds.forEach(id => userLikes[id] = false);
                resolve({ counts, userLikes });
            }
        });
    });
}

// Get dislike count for a post
export function getPostDislikeCount(postId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM forum_post_dislikes WHERE post_id = ?', [postId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// Check if user has disliked a post (googleId stored as hash)
export function hasUserDislikedPost(postId, googleId) {
    return new Promise((resolve, reject) => {
        const hash = hashGoogleId(String(googleId));
        db.get('SELECT * FROM forum_post_dislikes WHERE post_id = ? AND googleId = ?', [postId, hash], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(!!row);
            }
        });
    });
}

// Dislike a post (store hashed Google ID)
export function dislikePost(postId, googleId) {
    return new Promise((resolve, reject) => {
        const hash = hashGoogleId(String(googleId));
        db.run('INSERT OR IGNORE INTO forum_post_dislikes (post_id, googleId) VALUES (?, ?)', [postId, hash], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Undislike a post
export function undislikePost(postId, googleId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM forum_post_dislikes WHERE post_id = ? AND googleId = ?', [postId, googleId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Get dislike counts and user dislikes for multiple posts
export function getPostDislikeInfo(postIds, googleId) {
    return new Promise((resolve, reject) => {
        if (!postIds || postIds.length === 0) {
            resolve({ counts: {}, userDislikes: {} });
            return;
        }
        const placeholders = postIds.map(() => '?').join(',');
        
        // Get dislike counts
        db.all(`SELECT post_id, COUNT(*) as count FROM forum_post_dislikes WHERE post_id IN (${placeholders}) GROUP BY post_id`, postIds, (err, countRows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const counts = {};
            postIds.forEach(id => counts[id] = 0);
            countRows.forEach(row => {
                counts[row.post_id] = row.count;
            });
            
            // Get user dislikes if googleId provided (store uses hash)
            if (googleId) {
                const hash = hashGoogleId(String(googleId));
                db.all(`SELECT post_id FROM forum_post_dislikes WHERE post_id IN (${placeholders}) AND googleId = ?`, [...postIds, hash], (err, dislikeRows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    const userDislikes = {};
                    postIds.forEach(id => userDislikes[id] = false);
                    dislikeRows.forEach(row => {
                        userDislikes[row.post_id] = true;
                    });
                    
                    resolve({ counts, userDislikes });
                });
            } else {
                const userDislikes = {};
                postIds.forEach(id => userDislikes[id] = false);
                resolve({ counts, userDislikes });
            }
        });
    });
}

// Stage functions - store hashed Google ID in uploaded_by (never store raw Google ID)
export function createStage(slug, name, data, uploaderGoogleId) {
    return new Promise((resolve, reject) => {
        const uploadedByHash = hashGoogleId(String(uploaderGoogleId));
        const stmt = db.prepare(`
            INSERT INTO stages (slug, name, data, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            slug,
            name,
            JSON.stringify(data),
            uploadedByHash,
            new Date().toISOString(),
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );

        stmt.finalize();
    });
}

export function getStageBySlug(slug) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM stages WHERE slug = ?', [slug], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                resolve(null);
                return;
            }

            // Parse JSON data
            // uploaded_by stores hashed Google ID (return as-is for client; server uses it for userIdToUsername lookup)
            const stage = {
                id: row.id,
                slug: row.slug,
                name: row.name,
                data: JSON.parse(row.data),
                uploadedBy: row.uploaded_by,
                uploadedAt: row.uploaded_at
            };

            resolve(stage);
        });
    });
}

export function getAllStages() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM stages ORDER BY uploaded_at DESC', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            // Parse JSON data for each stage
            const stages = rows.map(row => ({
                id: row.id,
                slug: row.slug,
                name: row.name,
                data: JSON.parse(row.data),
                uploadedBy: row.uploaded_by,
                uploadedAt: row.uploaded_at
            }));

            resolve(stages);
        });
    });
}

export function updateStage(slug, name, data) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE stages 
            SET name = ?, data = ?
            WHERE slug = ?
        `);

        stmt.run(
            name,
            JSON.stringify(data),
            slug,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            }
        );

        stmt.finalize();
    });
}

export function deleteStage(slug) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM stages WHERE slug = ?', [slug], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Campaign level functions - store hashed Google ID in uploaded_by
// times: array of target times in seconds to beat (e.g. [155, 110, 90] for 2:35, 1:50, 1:30)
export function createCampaignLevel(slug, name, data, uploaderGoogleId, times = null) {
    return new Promise((resolve, reject) => {
        const uploadedByHash = hashGoogleId(String(uploaderGoogleId));
        const timesJson = JSON.stringify(Array.isArray(times) ? times : []);
        const stmt = db.prepare(`
            INSERT INTO campaign_levels (slug, name, data, uploaded_by, uploaded_at, times)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            slug,
            name,
            JSON.stringify(data),
            uploadedByHash,
            new Date().toISOString(),
            timesJson,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );

        stmt.finalize();
    });
}

export function getCampaignLevelBySlug(slug) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM campaign_levels WHERE slug = ?', [slug], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                resolve(null);
                return;
            }

            // Parse JSON data; times = array of target times in seconds
            let times = [];
            try {
                if (row.times != null && row.times !== '') times = JSON.parse(row.times);
                if (!Array.isArray(times)) times = [];
            } catch (_) {}
            const level = {
                id: row.id,
                slug: row.slug,
                name: row.name,
                data: JSON.parse(row.data),
                uploadedBy: row.uploaded_by,
                uploadedAt: row.uploaded_at,
                times
            };

            resolve(level);
        });
    });
}

export function getAllCampaignLevels() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM campaign_levels ORDER BY uploaded_at DESC', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            const levels = rows.map(row => {
                let times = [];
                try {
                    if (row.times != null && row.times !== '') times = JSON.parse(row.times);
                    if (!Array.isArray(times)) times = [];
                } catch (_) {}
                return {
                    id: row.id,
                    slug: row.slug,
                    name: row.name,
                    data: JSON.parse(row.data),
                    uploadedBy: row.uploaded_by,
                    uploadedAt: row.uploaded_at,
                    times
                };
            });

            resolve(levels);
        });
    });
}

export function updateCampaignLevel(slug, name, data, times = undefined) {
    return new Promise((resolve, reject) => {
        const setTimes = times !== undefined;
        const sql = setTimes
            ? `UPDATE campaign_levels SET name = ?, data = ?, times = ? WHERE slug = ?`
            : `UPDATE campaign_levels SET name = ?, data = ? WHERE slug = ?`;
        const stmt = db.prepare(sql);
        const args = setTimes
            ? [name, JSON.stringify(data), JSON.stringify(Array.isArray(times) ? times : []), slug]
            : [name, JSON.stringify(data), slug];
        stmt.run(...args, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        stmt.finalize();
    });
}

export function deleteCampaignLevel(slug) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM campaign_levels WHERE slug = ?', [slug], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Items table: weapon/equipment definitions with codeChildren (JSON array of { objectName, code })
export function getItemById(id) {
    return new Promise((resolve, reject) => {
        const numId = parseInt(id, 10);
        if (!Number.isInteger(numId) || numId < 1) {
            resolve(null);
            return;
        }
        db.get('SELECT id, name, slot, codeChildren FROM items WHERE id = ?', [numId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                resolve(null);
                return;
            }
            let codeChildren = [];
            try {
                codeChildren = typeof row.codeChildren === 'string' ? JSON.parse(row.codeChildren) : (row.codeChildren || []);
            } catch (e) {
                // invalid JSON
            }
            resolve({
                id: row.id,
                name: row.name,
                slot: row.slot,
                codeChildren: Array.isArray(codeChildren) ? codeChildren : []
            });
        });
    });
}

export function createItem(name, slot, codeChildren) {
    return new Promise((resolve, reject) => {
        const nameStr = typeof name === 'string' ? name.trim() : '';
        const slotStr = typeof slot === 'string' ? slot.trim() : 'weapon';
        const codeJson = Array.isArray(codeChildren) ? JSON.stringify(codeChildren) : '[]';
        if (!nameStr) {
            reject(new Error('Item name is required'));
            return;
        }
        db.run(
            'INSERT INTO items (name, slot, codeChildren) VALUES (?, ?, ?)',
            [nameStr, slotStr, codeJson],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

export function getItemsBySlot(slot) {
    return new Promise((resolve, reject) => {
        const slotStr = typeof slot === 'string' ? slot.trim() : 'weapon';
        db.all('SELECT id, name, slot, codeChildren FROM items WHERE slot = ? ORDER BY name', [slotStr], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            const items = (rows || []).map(row => {
                let codeChildren = [];
                try {
                    codeChildren = typeof row.codeChildren === 'string' ? JSON.parse(row.codeChildren) : (row.codeChildren || []);
                } catch (e) {}
                return {
                    id: row.id,
                    name: row.name,
                    slot: row.slot,
                    codeChildren: Array.isArray(codeChildren) ? codeChildren : []
                };
            });
            resolve(items);
        });
    });
}

// Leaderboards: one row per run (stage_slug = level identifier for campaign or uploaded level)

/** Returns this user's best (lowest) time for the stage, or null if none. */
export function getLeaderboardBestTimeForUser(stageSlug, username) {
    return new Promise((resolve, reject) => {
        if (!stageSlug) {
            resolve(null);
            return;
        }
        const slug = String(stageSlug).trim().toLowerCase();
        const name = typeof username === 'string' ? username.trim() : '';
        db.get(
            'SELECT id, time_seconds FROM leaderboards WHERE stage_slug = ? AND username = ? ORDER BY time_seconds ASC LIMIT 1',
            [slug, name],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? { id: row.id, time_seconds: row.time_seconds } : null);
            }
        );
    });
}

/** Deletes all leaderboard entries for this user on this stage. */
export function deleteLeaderboardEntriesForUser(stageSlug, username) {
    return new Promise((resolve, reject) => {
        if (!stageSlug) {
            resolve();
            return;
        }
        const slug = String(stageSlug).trim().toLowerCase();
        const name = typeof username === 'string' ? username.trim() : '';
        db.run('DELETE FROM leaderboards WHERE stage_slug = ? AND username = ?', [slug, name], function(err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export function insertLeaderboardEntry(stageSlug, timeSeconds, username) {
    return new Promise((resolve, reject) => {
        if (!stageSlug || typeof timeSeconds !== 'number' || timeSeconds < 0) {
            reject(new Error('Invalid leaderboard entry'));
            return;
        }
        const name = typeof username === 'string' ? username.trim() : '';
        db.run(
            'INSERT INTO leaderboards (stage_slug, time_seconds, username) VALUES (?, ?, ?)',
            [String(stageSlug).trim().toLowerCase(), Math.floor(timeSeconds), name],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

export function getLeaderboardTop10(stageSlug) {
    return new Promise((resolve, reject) => {
        if (!stageSlug) {
            resolve([]);
            return;
        }
        const slug = String(stageSlug).trim().toLowerCase();
        db.all(
            'SELECT id, stage_slug, time_seconds, username, created_at FROM leaderboards WHERE stage_slug = ? ORDER BY time_seconds ASC LIMIT 10',
            [slug],
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(r => ({
                    id: r.id,
                    stage_slug: r.stage_slug,
                    time_seconds: r.time_seconds,
                    username: r.username || '',
                    created_at: r.created_at
                })));
            }
        );
    });
}

/** Returns true if value looks like a raw Google ID (long numeric string), not a hash or sentinel. */
function isLikelyRawGoogleId(value) {
    if (value == null || typeof value !== 'string') return false;
    if (value === 'system' || value === 'Guest') return false;
    if (/^[a-f0-9]{64}$/i.test(value)) return false; // already hash
    return value.length >= 10 && /^\d+$/.test(value);
}

/**
 * One-time migration: replace raw Google IDs with hashes in stages, forum_threads, forum_posts, forum_post_likes, forum_post_dislikes.
 * Only run via explicit updateGoogleHash command; never called on startup.
 */
export function updateGoogleHashInDatabase() {
    return new Promise(async (resolve, reject) => {
        try {
            let stagesUpdated = 0, threadsUpdated = 0, postsUpdated = 0, likesUpdated = 0, dislikesUpdated = 0;

            // stages.uploaded_by
            const stageRows = await new Promise((res, rej) => {
                db.all('SELECT id, uploaded_by FROM stages', [], (err, rows) => { err ? rej(err) : res(rows || []); });
            });
            for (const row of stageRows) {
                if (isLikelyRawGoogleId(row.uploaded_by)) {
                    const hashed = hashGoogleId(row.uploaded_by);
                    await new Promise((res, rej) => {
                        db.run('UPDATE stages SET uploaded_by = ? WHERE id = ?', [hashed, row.id], err => err ? rej(err) : res());
                    });
                    stagesUpdated++;
                }
            }

            // forum_threads.author (skip system/Guest)
            const threadRows = await new Promise((res, rej) => {
                db.all('SELECT id, author FROM forum_threads', [], (err, rows) => { err ? rej(err) : res(rows || []); });
            });
            for (const row of threadRows) {
                if (isLikelyRawGoogleId(row.author)) {
                    const hashed = hashGoogleId(row.author);
                    await new Promise((res, rej) => {
                        db.run('UPDATE forum_threads SET author = ? WHERE id = ?', [hashed, row.id], err => err ? rej(err) : res());
                    });
                    threadsUpdated++;
                }
            }

            // forum_posts.author
            const postRows = await new Promise((res, rej) => {
                db.all('SELECT id, author FROM forum_posts', [], (err, rows) => { err ? rej(err) : res(rows || []); });
            });
            for (const row of postRows) {
                if (isLikelyRawGoogleId(row.author)) {
                    const hashed = hashGoogleId(row.author);
                    await new Promise((res, rej) => {
                        db.run('UPDATE forum_posts SET author = ? WHERE id = ?', [hashed, row.id], err => err ? rej(err) : res());
                    });
                    postsUpdated++;
                }
            }

            // forum_post_likes.googleId
            const likeRows = await new Promise((res, rej) => {
                db.all('SELECT id, post_id, googleId FROM forum_post_likes', [], (err, rows) => { err ? rej(err) : res(rows || []); });
            });
            for (const row of likeRows) {
                if (isLikelyRawGoogleId(row.googleId)) {
                    const hashed = hashGoogleId(row.googleId);
                    await new Promise((res, rej) => {
                        db.run('UPDATE forum_post_likes SET googleId = ? WHERE id = ?', [hashed, row.id], err => err ? rej(err) : res());
                    });
                    likesUpdated++;
                }
            }

            // forum_post_dislikes.googleId
            const dislikeRows = await new Promise((res, rej) => {
                db.all('SELECT id, post_id, googleId FROM forum_post_dislikes', [], (err, rows) => { err ? rej(err) : res(rows || []); });
            });
            for (const row of dislikeRows) {
                if (isLikelyRawGoogleId(row.googleId)) {
                    const hashed = hashGoogleId(row.googleId);
                    await new Promise((res, rej) => {
                        db.run('UPDATE forum_post_dislikes SET googleId = ? WHERE id = ?', [hashed, row.id], err => err ? rej(err) : res());
                    });
                    dislikesUpdated++;
                }
            }

            // campaign_levels.uploaded_by
            let campaignUpdated = 0;
            const campaignRows = await new Promise((res, rej) => {
                db.all('SELECT id, uploaded_by FROM campaign_levels', [], (err, rows) => { err ? rej(err) : res(rows || []); });
            });
            for (const row of campaignRows) {
                if (isLikelyRawGoogleId(row.uploaded_by)) {
                    const hashed = hashGoogleId(row.uploaded_by);
                    await new Promise((res, rej) => {
                        db.run('UPDATE campaign_levels SET uploaded_by = ? WHERE id = ?', [hashed, row.id], err => err ? rej(err) : res());
                    });
                    campaignUpdated++;
                }
            }

            console.log('[updateGoogleHash] Done. stages:', stagesUpdated, 'forum_threads:', threadsUpdated, 'forum_posts:', postsUpdated, 'likes:', likesUpdated, 'dislikes:', dislikesUpdated, 'campaign_levels:', campaignUpdated);
            resolve({ stagesUpdated, threadsUpdated, postsUpdated, likesUpdated, dislikesUpdated, campaignUpdated });
        } catch (err) {
            console.error('[updateGoogleHash] Error:', err);
            reject(err);
        }
    });
}

// Close database connection
export function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Database connection closed');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}
