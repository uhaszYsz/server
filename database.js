// database.js
import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'users.db');
const registeredUsersPath = path.join(__dirname, 'registeredUsers.json');

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
            
            // Create users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password TEXT NOT NULL,
                    stats TEXT NOT NULL,
                    inventory TEXT NOT NULL,
                    equipment TEXT NOT NULL,
                    weaponData TEXT,
                    passiveAbility TEXT
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
}

// Migrate data from JSON to SQLite
export async function migrateFromJSON() {
    try {
        // Check if JSON file exists
        try {
            await fs.access(registeredUsersPath);
        } catch {
            console.log('ℹ️  No existing registeredUsers.json file found, skipping migration');
            return;
        }

        // Check if database already has users
        const existingUsers = await getAllUsers();
        if (existingUsers.length > 0) {
            console.log('ℹ️  Database already has users, skipping migration');
            return;
        }

        // Read JSON file
        const jsonData = await fs.readFile(registeredUsersPath, 'utf8');
        const users = JSON.parse(jsonData);

        if (!Array.isArray(users) || users.length === 0) {
            console.log('ℹ️  No users to migrate');
            return;
        }

        console.log(`📦 Migrating ${users.length} users from JSON to SQLite...`);

        // Insert users into database
        for (const user of users) {
            await createUser(user);
        }

        console.log(`✅ Successfully migrated ${users.length} users to SQLite`);
    } catch (error) {
        console.error('❌ Error during migration:', error);
        throw error;
    }
}

// Create a new user
export function createUser(user) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO users (username, password, stats, inventory, equipment, weaponData, passiveAbility)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            user.username,
            user.password,
            JSON.stringify(user.stats || {}),
            JSON.stringify(user.inventory || []),
            JSON.stringify(user.equipment || {}),
            user.weaponData ? JSON.stringify(user.weaponData) : null,
            user.passiveAbility || null,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );

        stmt.finalize();
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
            const users = rows.map(row => ({
                username: row.username,
                password: row.password,
                stats: JSON.parse(row.stats),
                inventory: JSON.parse(row.inventory),
                equipment: JSON.parse(row.equipment),
                weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                passiveAbility: row.passiveAbility || null
            }));

            resolve(users);
        });
    });
}

// Get user by username
export function getUserByUsername(username) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
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
                username: row.username,
                password: row.password,
                stats: JSON.parse(row.stats),
                inventory: JSON.parse(row.inventory),
                equipment: JSON.parse(row.equipment),
                weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                passiveAbility: row.passiveAbility || null
            };

            resolve(user);
        });
    });
}

// Find user by username and password
export function findUser(username, password) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
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
                username: row.username,
                password: row.password,
                stats: JSON.parse(row.stats),
                inventory: JSON.parse(row.inventory),
                equipment: JSON.parse(row.equipment),
                weaponData: row.weaponData ? JSON.parse(row.weaponData) : null,
                passiveAbility: row.passiveAbility || null
            };

            resolve(user);
        });
    });
}

// Update user
export function updateUser(username, userData) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE users 
            SET password = ?,
                stats = ?,
                inventory = ?,
                equipment = ?,
                weaponData = ?,
                passiveAbility = ?
            WHERE username = ?
        `);

        stmt.run(
            userData.password,
            JSON.stringify(userData.stats || {}),
            JSON.stringify(userData.inventory || []),
            JSON.stringify(userData.equipment || {}),
            userData.weaponData ? JSON.stringify(userData.weaponData) : null,
            userData.passiveAbility || null,
            username,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );

        stmt.finalize();
    });
}

// Update username
export function updateUsername(oldUsername, newUsername) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET username = ? WHERE username = ?', [newUsername, oldUsername], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Check if username exists
export function usernameExists(username) {
    return new Promise((resolve, reject) => {
        db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
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
        // Check if categories already exist
        db.get('SELECT COUNT(*) as count FROM forum_categories', (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row.count > 0) {
                resolve();
                return;
            }
            
            // Insert parent categories first
            db.run('INSERT INTO forum_categories (name, parent_id, description) VALUES (?, ?, ?)', 
                ['Discussions', null, 'General discussions'], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                const discussionsId = this.lastID;
                
                db.run('INSERT INTO forum_categories (name, parent_id, description) VALUES (?, ?, ?)', 
                    ['Shared', null, 'Shared content'], function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const sharedId = this.lastID;
                    
                    // Insert subcategories
                    const subcategories = [
                        { name: 'Danmaku raiders general', parent_id: discussionsId, description: 'General game discussions' },
                        { name: 'Bug reports', parent_id: discussionsId, description: 'Report bugs' },
                        { name: 'Help', parent_id: discussionsId, description: 'Get help' },
                        { name: 'Levels', parent_id: sharedId, description: 'Share levels' },
                        { name: 'Objects', parent_id: sharedId, description: 'Share objects' },
                        { name: 'functions', parent_id: sharedId, description: 'Share functions' }
                    ];
                    
                    let inserted = 0;
                    subcategories.forEach(cat => {
                        db.run('INSERT INTO forum_categories (name, parent_id, description) VALUES (?, ?, ?)', 
                            [cat.name, cat.parent_id, cat.description], (err) => {
                            if (err) {
                                console.error('Error inserting subcategory:', err);
                            }
                            inserted++;
                            if (inserted === subcategories.length) {
                                resolve();
                            }
                        });
                    });
                });
            });
        });
    });
}

// Forum functions
export function getForumCategories() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM forum_categories ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, name', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

export function getForumThreads(categoryId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT t.*, 
                   (SELECT COUNT(*) FROM forum_posts WHERE thread_id = t.id) as post_count,
                   (SELECT MAX(created_at) FROM forum_posts WHERE thread_id = t.id) as last_post_date
            FROM forum_threads t
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

export function getForumThread(threadId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM forum_threads WHERE id = ?', [threadId], (err, row) => {
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
        db.all('SELECT * FROM forum_posts WHERE thread_id = ? ORDER BY created_at ASC', [threadId], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
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

