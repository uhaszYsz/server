// admin-server.js
// Separate HTTP server for database admin interface
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { readFileSync, existsSync } from 'fs';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const ADMIN_PORT = 8081;
const DB_PASS_FILE = path.join(__dirname, 'dbpass.txt');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Database backup logic
async function performBackup() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const databases = ['users.db', 'sprites.db'];

        for (const dbName of databases) {
            const sourcePath = path.join(__dirname, dbName);
            if (existsSync(sourcePath)) {
                const backupPath = path.join(BACKUP_DIR, `${dbName}.${timestamp}.bak`);
                await fs.copyFile(sourcePath, backupPath);
                console.log(`[Backup] Created backup: ${backupPath}`);
            }
        }

        // Clean up old backups (keep max 3 per database)
        for (const dbName of databases) {
            const files = await fs.readdir(BACKUP_DIR);
            const backups = files
                .filter(f => f.startsWith(dbName) && f.endsWith('.bak'))
                .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), mtime: 0 }));
            
            for (const b of backups) {
                const stats = await fs.stat(b.path);
                b.mtime = stats.mtimeMs;
            }

            backups.sort((a, b) => b.mtime - a.mtime);

            if (backups.length > 3) {
                const toDelete = backups.slice(3);
                for (const b of toDelete) {
                    await fs.unlink(b.path);
                    console.log(`[Backup] Deleted old backup: ${b.name}`);
                }
            }
        }
    } catch (error) {
        console.error('[Backup] Error during backup:', error);
    }
}

// Schedule backup every 24 hours
setInterval(performBackup, 24 * 60 * 60 * 1000);
// Perform initial backup on start
performBackup();

// Simple in-memory store for rate limiting
// In a production app, you might use Redis or a database
const loginAttempts = new Map();

// Session management (in-memory store)
// In production, use Redis or a database for distributed systems
const sessions = new Map(); // sessionToken -> { username, expiresAt }
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up expired sessions every hour

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (session.expiresAt < now) {
            sessions.delete(token);
        }
    }
}, SESSION_CLEANUP_INTERVAL);

const checkRateLimit = (ip) => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (!loginAttempts.has(ip)) {
        loginAttempts.set(ip, { count: 0, firstAttempt: now });
        return { allowed: true };
    }

    const attemptData = loginAttempts.get(ip);
    
    // Reset if an hour has passed
    if (now - attemptData.firstAttempt > oneHour) {
        attemptData.count = 0;
        attemptData.firstAttempt = now;
    }

    if (attemptData.count >= 5) {
        const timeLeft = Math.ceil((oneHour - (now - attemptData.firstAttempt)) / (60 * 1000));
        return { allowed: false, timeLeft };
    }

    return { allowed: true };
};

const recordAttempt = (ip, success) => {
    if (success) {
        loginAttempts.delete(ip); // Reset on success
        return;
    }
    
    const attemptData = loginAttempts.get(ip);
    if (attemptData) {
        attemptData.count++;
    }
};

// Middleware
app.use(express.json());

// Auth Middleware
const authMiddleware = (req, res, next) => {
    // Skip auth for the login page and its assets if any
    if (req.path === '/' || req.path === '/login' || req.path === '/api/login' || req.path === '/api/logout') {
        return next();
    }

    // Check if password is required
    if (existsSync(DB_PASS_FILE)) {
        // Check for session token first (preferred method)
        const sessionToken = req.headers['x-admin-session'] || req.cookies?.adminSession;
        
        if (sessionToken) {
            const session = sessions.get(sessionToken);
            if (session && session.expiresAt > Date.now()) {
                // Valid session - extend expiration
                session.expiresAt = Date.now() + SESSION_DURATION;
                return next();
            } else if (session) {
                // Expired session - remove it
                sessions.delete(sessionToken);
            }
        }
        
        // Fallback to legacy credential-based auth (for backward compatibility)
        const authHeader = req.headers['x-admin-auth'];
        if (authHeader) {
            const fileContent = readFileSync(DB_PASS_FILE, 'utf8').trim();
            const [correctLogin, correctPassword] = fileContent.split(/\s+/);
            
            if (authHeader === `${correctLogin}:${correctPassword}`) {
                return next();
            }
        }
        
        // No valid session or credentials
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
    
    // If dbpass.txt doesn't exist, allow access (as per current state)
    next();
};

app.use(authMiddleware);
app.use(express.static(__dirname));

// Serve the admin HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'db-admin.html'));
});

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (!existsSync(DB_PASS_FILE)) {
        return res.json({ success: true, message: 'No password set' });
    }

    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
        return res.status(429).json({ 
            error: `Too many login attempts. Please try again in ${rateLimit.timeLeft} minutes.` 
        });
    }

    try {
        const fileContent = readFileSync(DB_PASS_FILE, 'utf8').trim();
        const [correctLogin, correctPassword] = fileContent.split(/\s+/);

        if (username === correctLogin && password === correctPassword) {
            recordAttempt(ip, true);
            
            // Generate session token
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = Date.now() + SESSION_DURATION;
            
            sessions.set(sessionToken, {
                username: username,
                expiresAt: expiresAt
            });
            
            // Return session token instead of success flag
            res.json({ 
                success: true, 
                sessionToken: sessionToken,
                expiresAt: expiresAt
            });
        } else {
            recordAttempt(ip, false);
            res.status(401).json({ error: 'Invalid login or password' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error reading password file' });
    }
});

// Logout API
app.post('/api/logout', (req, res) => {
    const sessionToken = req.headers['x-admin-session'] || req.cookies?.adminSession;
    
    if (sessionToken && sessions.has(sessionToken)) {
        sessions.delete(sessionToken);
    }
    
    res.json({ success: true });
});

// Get list of tables for a database
app.get('/api/db/:database/tables', async (req, res) => {
    try {
        const { database } = req.params;
        let dbInstance = null;

        if (database === 'users') {
            // Access the users database through the database module
            // We need to get the raw db connection
            dbInstance = await getUsersDbInstance();
        } else if (database === 'sprites') {
            dbInstance = await getSpritesDbInstance();
        } else {
            return res.status(400).json({ error: 'Invalid database name. Use "users" or "sprites"' });
        }

        if (!dbInstance) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        // Get all tables
        const tables = await new Promise((resolve, reject) => {
            dbInstance.all(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.name));
                }
            );
        });

        res.json(tables);
    } catch (error) {
        console.error('Error getting tables:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get table data
app.get('/api/db/:database/table/:tableName', async (req, res) => {
    try {
        const { database, tableName } = req.params;
        let dbInstance = null;

        if (database === 'users') {
            dbInstance = await getUsersDbInstance();
        } else if (database === 'sprites') {
            dbInstance = await getSpritesDbInstance();
        } else {
            return res.status(400).json({ error: 'Invalid database name' });
        }

        if (!dbInstance) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        // Get table schema to get column names and primary key
        const schemaInfo = await new Promise((resolve, reject) => {
            dbInstance.all(`PRAGMA table_info(${escapeIdentifier(tableName)})`, (err, rows) => {
                if (err) reject(err);
                else {
                    const columns = rows.map(row => row.name);
                    // Find primary key (pk > 0 indicates primary key)
                    const primaryKeyColumn = rows.find(row => row.pk > 0);
                    const primaryKey = primaryKeyColumn ? primaryKeyColumn.name : 'rowid';
                    resolve({ columns, primaryKey });
                }
            });
        });
        
        const { columns, primaryKey } = schemaInfo;

        // Get all rows
        const rows = await new Promise((resolve, reject) => {
            dbInstance.all(`SELECT * FROM ${escapeIdentifier(tableName)}`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Parse JSON fields if needed
        const parsedRows = rows.map(row => {
            const parsed = { ...row };
            // Try to parse JSON fields for common column names
            columns.forEach(col => {
                if (typeof parsed[col] === 'string' && 
                    (col.includes('stats') || col.includes('inventory') || col.includes('equipment') || 
                     col.includes('data') || col.includes('weaponData'))) {
                    try {
                        parsed[col] = JSON.parse(parsed[col]);
                    } catch (e) {
                        // Not JSON, keep as string
                    }
                }
            });
            return parsed;
        });

        res.json({ columns, rows: parsedRows, primaryKey });
    } catch (error) {
        console.error('Error getting table data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Execute SQL query
app.post('/api/db/:database/query', async (req, res) => {
    try {
        const { database } = req.params;
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required' });
        }

        let dbInstance = null;

        if (database === 'users') {
            dbInstance = await getUsersDbInstance();
        } else if (database === 'sprites') {
            dbInstance = await getSpritesDbInstance();
        } else {
            return res.status(400).json({ error: 'Invalid database name' });
        }

        if (!dbInstance) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const trimmedQuery = query.trim().toUpperCase();
        const isSelect = trimmedQuery.startsWith('SELECT');
        const isInsert = trimmedQuery.startsWith('INSERT');
        const isUpdate = trimmedQuery.startsWith('UPDATE');
        const isDelete = trimmedQuery.startsWith('DELETE');

        if (isSelect) {
            // Execute SELECT query
            const result = await new Promise((resolve, reject) => {
                dbInstance.all(query, [], (err, rows) => {
                    if (err) reject(err);
                    else {
                        // Get column names from first row or from query result
                        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                        
                        // Parse JSON fields
                        const parsedRows = rows.map(row => {
                            const parsed = { ...row };
                            columns.forEach(col => {
                                if (typeof parsed[col] === 'string' && 
                                    (col.includes('stats') || col.includes('inventory') || col.includes('equipment') || 
                                     col.includes('data') || col.includes('weaponData'))) {
                                    try {
                                        parsed[col] = JSON.parse(parsed[col]);
                                    } catch (e) {
                                        // Not JSON, keep as string
                                    }
                                }
                            });
                            return parsed;
                        });
                        
                        resolve({ type: 'SELECT', columns, rows: parsedRows });
                    }
                });
            });

            res.json(result);
        } else if (isInsert || isUpdate || isDelete) {
            // Execute INSERT/UPDATE/DELETE query
            const result = await new Promise((resolve, reject) => {
                dbInstance.run(query, [], function(err) {
                    if (err) reject(err);
                    else {
                        resolve({
                            type: isInsert ? 'INSERT' : isUpdate ? 'UPDATE' : 'DELETE',
                            changes: this.changes,
                            lastID: this.lastID
                        });
                    }
                });
            });

            res.json(result);
        } else {
            // Other queries (CREATE, DROP, ALTER, etc.)
            const result = await new Promise((resolve, reject) => {
                dbInstance.run(query, [], function(err) {
                    if (err) reject(err);
                    else {
                        resolve({
                            type: 'OTHER',
                            changes: this.changes,
                            lastID: this.lastID
                        });
                    }
                });
            });

            res.json(result);
        }
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk delete rows
app.post('/api/db/:database/table/:tableName/delete', async (req, res) => {
    try {
        const { database, tableName } = req.params;
        const { rowIds, primaryKey } = req.body;

        if (!rowIds || !Array.isArray(rowIds) || rowIds.length === 0) {
            return res.status(400).json({ error: 'rowIds array is required and must not be empty' });
        }

        if (!primaryKey || typeof primaryKey !== 'string') {
            return res.status(400).json({ error: 'primaryKey is required' });
        }

        let dbInstance = null;

        if (database === 'users') {
            dbInstance = await getUsersDbInstance();
        } else if (database === 'sprites') {
            dbInstance = await getSpritesDbInstance();
        } else {
            return res.status(400).json({ error: 'Invalid database name' });
        }

        if (!dbInstance) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        // Build DELETE query with WHERE IN clause
        // Use parameterized query to prevent SQL injection
        const placeholders = rowIds.map(() => '?').join(',');
        const query = `DELETE FROM ${escapeIdentifier(tableName)} WHERE ${escapeIdentifier(primaryKey)} IN (${placeholders})`;

        const result = await new Promise((resolve, reject) => {
            dbInstance.run(query, rowIds, function(err) {
                if (err) reject(err);
                else {
                    resolve({
                        changes: this.changes,
                        deleted: this.changes
                    });
                }
            });
        });

        res.json(result);
    } catch (error) {
        console.error('Error deleting rows:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update single cell (phpMyAdmin-style inline edit)
app.post('/api/db/:database/table/:tableName/update-cell', async (req, res) => {
    try {
        const { database, tableName } = req.params;
        const { primaryKey, primaryKeyValue, column, value } = req.body;

        if (!primaryKey || primaryKeyValue === undefined || primaryKeyValue === null) {
            return res.status(400).json({ error: 'primaryKey and primaryKeyValue are required' });
        }
        if (!column || typeof column !== 'string') {
            return res.status(400).json({ error: 'column is required' });
        }

        let dbInstance = null;
        if (database === 'users') {
            dbInstance = await getUsersDbInstance();
        } else if (database === 'sprites') {
            dbInstance = await getSpritesDbInstance();
        } else {
            return res.status(400).json({ error: 'Invalid database name' });
        }
        if (!dbInstance) {
            return res.status(500).json({ error: 'Database connection not available' });
        }

        const query = `UPDATE ${escapeIdentifier(tableName)} SET ${escapeIdentifier(column)} = ? WHERE ${escapeIdentifier(primaryKey)} = ?`;
        await new Promise((resolve, reject) => {
            dbInstance.run(query, [value, primaryKeyValue], function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating cell:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to escape SQLite identifiers (basic protection)
function escapeIdentifier(identifier) {
    // Remove any dangerous characters
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error('Invalid identifier');
    }
    return `"${identifier}"`;
}

// Helper to get users database instance
// Note: This requires exposing the internal db connection from database.js
// We'll need to modify database.js or use a workaround
let usersDbInstance = null;
let spritesDbInstance = null;

async function getUsersDbInstance() {
    if (usersDbInstance) return usersDbInstance;
    
    // Create our own connection to users.db
    const dbPath = path.join(__dirname, 'users.db');
    
    return new Promise((resolve, reject) => {
        usersDbInstance = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else resolve(usersDbInstance);
        });
    });
}

async function getSpritesDbInstance() {
    if (spritesDbInstance) return spritesDbInstance;
    
    const spritesDbPath = path.join(__dirname, 'sprites.db');
    
    return new Promise((resolve, reject) => {
        spritesDbInstance = new sqlite3.Database(spritesDbPath, (err) => {
            if (err) reject(err);
            else resolve(spritesDbInstance);
        });
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Admin server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(ADMIN_PORT, '0.0.0.0', () => {
    console.log(`✅ Database Admin Server running on http://0.0.0.0:${ADMIN_PORT}`);
    console.log(`   Access the admin interface at: http://localhost:${ADMIN_PORT}`);
    console.log(`   Note: Make sure the main server has initialized the databases first.`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${ADMIN_PORT} is already in use. Please stop the other process or change ADMIN_PORT in admin-server.js`);
    } else {
        console.error('❌ Failed to start admin server:', err);
    }
    process.exit(1);
});
