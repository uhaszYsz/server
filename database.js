// database.js
import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

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
                        FOREIGN KEY (category_id) REFERENCES forum_categories(id)
                    )
                `, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('✅ Forum threads table initialized');
                    
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
                                
                                // Initialize default categories
                                initForumCategories().then(() => {
                                    resolve();
                                }).catch(reject);
                            });
                        });
                    });
                });
            });
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

// Create a new user (requires email, googleId, and name)
export function createUser(user) {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate required fields
            if (!user.email || !user.googleId || !user.name) {
                reject(new Error('Email, googleId, and name are required'));
                return;
            }
            
            // Hash the email before storing
            const hashedEmail = await hashPassword(user.email.toLowerCase().trim());
            
            // Generate name from email if not provided
            const name = user.name || user.email.split('@')[0] + '_google';
            
            const stmt = db.prepare(`
                INSERT INTO users (googleId, name, email, stats, inventory, equipment, weaponData, passiveAbility, rank, verified)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                user.googleId, // PRIMARY KEY - Google user ID
                name, // Display name
                hashedEmail, // Store hashed email
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
                    googleId: row.googleId,
                    name: row.name || null,
                    email: row.email, // Hashed email
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
                googleId: row.googleId,
                name: row.name || null,
                email: row.email || null, // Hashed email
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
                googleId: row.googleId,
                name: row.name || null,
                email: row.email || null, // Hashed email
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

// Get user by googleId (primary lookup - googleId is now UNIQUE)
export function getUserByGoogleId(googleId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE googleId = ?', [googleId], (err, row) => {
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
                googleId: row.googleId,
                name: row.name || null,
                email: row.email || null, // Hashed email
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

// Verify user by email and googleId (matches client memory data)
// Gets user by googleId first, then verifies email hash matches
export function verifyUserByEmailAndGoogleId(email, googleId) {
    return new Promise(async (resolve, reject) => {
        try {
            // First get user by googleId
            const user = await getUserByGoogleId(googleId);
            
            if (!user) {
                resolve(false);
                return;
            }
            
            // Verify email hash matches (bcrypt comparison)
            if (!user.email) {
                resolve(false);
                return;
            }
            
            const emailMatches = await verifyPassword(email.toLowerCase().trim(), user.email);
            resolve(emailMatches);
        } catch (error) {
            reject(error);
        }
    });
}

// Get user by email and googleId (returns user if verification passes)
export function getUserByEmailAndGoogleId(email, googleId) {
    return new Promise(async (resolve, reject) => {
        try {
            const isValid = await verifyUserByEmailAndGoogleId(email, googleId);
            if (!isValid) {
                resolve(null);
                return;
            }
            
            // Verification passed, return the user
            const user = await getUserByGoogleId(googleId);
            resolve(user);
        } catch (error) {
            reject(error);
        }
    });
}

// Update user by googleId
export function updateUser(googleId, userData) {
    return new Promise(async (resolve, reject) => {
        try {
            // If email is being updated, hash it first
            let emailToStore = null;
            if (userData.email) {
                emailToStore = await hashPassword(userData.email.toLowerCase().trim());
            } else {
                // No email update, get existing email from database
                const existingUser = await getUserByGoogleId(googleId);
                emailToStore = existingUser ? existingUser.email : null;
            }
            
            // Get existing name if not updating
            let nameToStore = userData.name || null;
            if (!nameToStore) {
                const existingUser = await getUserByGoogleId(googleId);
                nameToStore = existingUser ? existingUser.name : null;
            }
            
            const stmt = db.prepare(`
                UPDATE users 
                SET name = COALESCE(?, name),
                    email = COALESCE(?, email),
                    stats = ?,
                    inventory = ?,
                    equipment = ?,
                    weaponData = ?,
                    passiveAbility = ?,
                    rank = ?,
                    verified = ?
                WHERE googleId = ?
            `);

            stmt.run(
                nameToStore,
                emailToStore,
                JSON.stringify(userData.stats || {}),
                JSON.stringify(userData.inventory || []),
                JSON.stringify(userData.equipment || {}),
                userData.weaponData ? JSON.stringify(userData.weaponData) : null,
                null, // passiveAbility always null (deprecated)
                userData.rank || 'player',
                null, // verified always null (deprecated)
                googleId,
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

// Update user name by googleId
export function updateName(googleId, newName) {
    return new Promise((resolve, reject) => {
        if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
            reject(new Error('Name is required and must be a non-empty string'));
            return;
        }
        
        const trimmedName = newName.trim();
        if (trimmedName.length > 20) {
            reject(new Error('Name must be 20 characters or less'));
            return;
        }
        
        db.run('UPDATE users SET name = ? WHERE googleId = ?', [trimmedName, googleId], function(err) {
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
    });
}

// Check if name exists
export function nameExists(name) {
    return new Promise((resolve, reject) => {
        if (!name || typeof name !== 'string') {
            resolve(false);
            return;
        }
        
        db.get('SELECT googleId FROM users WHERE name = ?', [name.trim()], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(!!row);
        });
    });
}

// Set user rank by googleId
export function setUserRank(googleId, rank) {
    return new Promise((resolve, reject) => {
        // Validate rank
        const validRanks = ['player', 'moderator', 'admin'];
        if (!validRanks.includes(rank.toLowerCase())) {
            reject(new Error(`Invalid rank. Must be one of: ${validRanks.join(', ')}`));
            return;
        }
        
        db.run('UPDATE users SET rank = ? WHERE googleId = ?', [rank.toLowerCase(), googleId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Delete user by googleId
export function deleteUser(googleId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM users WHERE googleId = ?', [googleId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Check if googleId exists
export function googleIdExists(googleId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT googleId FROM users WHERE googleId = ?', [googleId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(!!row);
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
            } else {
                // Insert Discussions parent category
                db.run('INSERT INTO forum_categories (name, parent_id, description) VALUES (?, ?, ?)', 
                    ['Discussions', null, 'General discussions'], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    discussionsId = this.lastID;
                    continueWithSubcategories();
                });
                return;
            }
            
            continueWithSubcategories();
            
            function continueWithSubcategories() {
                db.get('SELECT id FROM forum_categories WHERE name = ? AND parent_id IS NULL', ['Shared'], (err, sharedRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    let sharedId;
                    if (sharedRow) {
                        sharedId = sharedRow.id;
                    } else {
                        db.run('INSERT INTO forum_categories (name, parent_id, description) VALUES (?, ?, ?)', 
                            ['Shared', null, 'Shared content'], function(err) {
                            if (err) {
                                reject(err);
                                return;
                            }
                            sharedId = this.lastID;
                            processSubcategories();
                        });
                        return;
                    }
                    
                    processSubcategories();
                    
                    function processSubcategories() {
                        // Update "Danmaku raiders general" to "General" if it exists
                        db.run('UPDATE forum_categories SET name = ?, display_order = ? WHERE name = ? AND parent_id = ?',
                            ['General', 1, 'Danmaku raiders general', discussionsId], (err) => {
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
                                { name: 'Help', parent_id: discussionsId, description: 'Get help', order: 2 },
                                { name: 'Bug reports', parent_id: discussionsId, description: 'Report bugs', order: 3 },
                                { name: 'Levels', parent_id: sharedId, description: 'Share levels', order: 1 },
                                { name: 'Objects', parent_id: sharedId, description: 'Share objects', order: 2 },
                                { name: 'functions', parent_id: sharedId, description: 'Share functions', order: 3 }
                            ];
                            
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
                                        if (processed === total) resolve();
                                        return;
                                    }
                                    
                                    if (row) {
                                        // Update existing category
                                        db.run('UPDATE forum_categories SET description = ?, display_order = ? WHERE id = ?',
                                            [cat.description, cat.order, row.id], (err) => {
                                            if (err) {
                                                console.error('Error updating category:', err);
                                            }
                                            processed++;
                                            if (processed === total) resolve();
                                        });
                                    } else {
                                        // Insert new category
                                        db.run('INSERT INTO forum_categories (name, parent_id, description, display_order) VALUES (?, ?, ?, ?)', 
                                            [cat.name, cat.parent_id, cat.description, cat.order], (err) => {
                                            if (err) {
                                                console.error('Error inserting subcategory:', err);
                                            }
                                            processed++;
                                            if (processed === total) resolve();
                                        });
                                    }
                                });
                            });
                        });
                    }
                });
            }
        });
    });
}

// Forum functions
export function getForumCategories() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM forum_categories ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, COALESCE(display_order, 999), name', (err, rows) => {
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

export function getForumThreads(categoryId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT t.*, 
                   (SELECT COUNT(*) FROM forum_posts WHERE thread_id = t.id) as post_count,
                   (SELECT MAX(created_at) FROM forum_posts WHERE thread_id = t.id) as last_post_date,
                   u.name as author_name,
                   COALESCE(u.rank, 'player') as author_rank
            FROM forum_threads t
            LEFT JOIN users u ON u.googleId = t.author
            WHERE t.category_id = ?
            ORDER BY t.updated_at DESC
        `, [categoryId], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

export function getForumCategoryStats(categoryId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                COUNT(DISTINCT t.id) as thread_count,
                COUNT(p.id) as total_post_count
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
                totalPostCount: row.total_post_count || 0
            });
        });
    });
}

export function getForumThread(threadId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT t.*, 
                   u.name as author_name,
                   COALESCE(u.rank, 'player') as author_rank
            FROM forum_threads t
            LEFT JOIN users u ON u.googleId = t.author
            WHERE t.id = ?
        `, [threadId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

export function createForumThread(categoryId, title, author) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO forum_threads (category_id, title, author) VALUES (?, ?, ?)', 
            [categoryId, title, author], function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this.lastID);
        });
    });
}

export function getForumPosts(threadId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT p.*, 
                   u.name as author_name,
                   COALESCE(u.rank, 'player') as author_rank
            FROM forum_posts p
            LEFT JOIN users u ON u.googleId = p.author
            WHERE p.thread_id = ?
            ORDER BY p.created_at ASC
        `, [threadId], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
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

export function createForumPost(threadId, author, content) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO forum_posts (thread_id, author, content) VALUES (?, ?, ?)', 
            [threadId, author, content], function(err) {
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

// Delete forum thread
export function deleteForumThread(threadId) {
    return new Promise((resolve, reject) => {
        // First delete all posts in the thread
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
            // Then delete the post
            db.run('DELETE FROM forum_posts WHERE id = ?', [postId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
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

// Like a post
export function likePost(postId, googleId) {
    return new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO forum_post_likes (post_id, googleId) VALUES (?, ?)', [postId, googleId], function(err) {
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
        db.run('DELETE FROM forum_post_likes WHERE post_id = ? AND googleId = ?', [postId, googleId], function(err) {
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

// Stage functions
export function createStage(slug, name, data, uploadedBy) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO stages (slug, name, data, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            slug,
            name,
            JSON.stringify(data),
            uploadedBy,
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

// Campaign level functions
export function createCampaignLevel(slug, name, data, uploadedBy) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO campaign_levels (slug, name, data, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            slug,
            name,
            JSON.stringify(data),
            uploadedBy,
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

            // Parse JSON data
            const level = {
                id: row.id,
                slug: row.slug,
                name: row.name,
                data: JSON.parse(row.data),
                uploadedBy: row.uploaded_by,
                uploadedAt: row.uploaded_at
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

            // Parse JSON data for each level
            const levels = rows.map(row => ({
                id: row.id,
                slug: row.slug,
                name: row.name,
                data: JSON.parse(row.data),
                uploadedBy: row.uploaded_by,
                uploadedAt: row.uploaded_at
            }));

            resolve(levels);
        });
    });
}

export function updateCampaignLevel(slug, name, data) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE campaign_levels 
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

