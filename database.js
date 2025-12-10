// database.js
import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
                            
                            // Create stages table for user-uploaded levels
                            db.run(`
                                CREATE TABLE IF NOT EXISTS stages (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    slug TEXT UNIQUE NOT NULL,
                                    name TEXT NOT NULL,
                                    data TEXT NOT NULL,
                                    uploaded_by TEXT NOT NULL,
                                    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                    FOREIGN KEY (uploaded_by) REFERENCES users(username)
                                )
                            `, (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                console.log('✅ Stages table initialized');
                                
                                // Create campaign_levels table for campaign levels
                                db.run(`
                                    CREATE TABLE IF NOT EXISTS campaign_levels (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        slug TEXT UNIQUE NOT NULL,
                                        name TEXT NOT NULL,
                                        data TEXT NOT NULL,
                                        uploaded_by TEXT NOT NULL,
                                        uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                        FOREIGN KEY (uploaded_by) REFERENCES users(username)
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
    });
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
        // Add display_order column if it doesn't exist (SQLite will ignore if column exists)
        db.run('ALTER TABLE forum_categories ADD COLUMN display_order INTEGER DEFAULT 0', (err) => {
            // Ignore error if column already exists
            if (err && !err.message.includes('duplicate column')) {
                console.warn('Warning: Could not add display_order column:', err.message);
            }
            
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

