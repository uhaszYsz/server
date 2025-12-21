// spritesDatabase.js
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const spritesDbPath = path.join(__dirname, 'sprites.db');

let spritesDb = null;

// Initialize sprites database
export function initSpritesDatabase() {
    return new Promise((resolve, reject) => {
        spritesDb = new sqlite3.Database(spritesDbPath, (err) => {
            if (err) {
                reject(err);
                return;
            }
            console.log('✅ Connected to sprites SQLite database');
            
            // Create sprites table
            spritesDb.run(`
                CREATE TABLE IF NOT EXISTS sprites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL UNIQUE,
                    uploaded_by TEXT NOT NULL,
                    uploaded_at INTEGER NOT NULL,
                    file_size INTEGER NOT NULL,
                    data TEXT NOT NULL
                )
            `, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log('✅ Sprites table initialized');
                resolve();
            });
        });
    });
}

// Create a sprite entry with base64 data
export function createSprite(filename, uploadedBy, fileSize, base64Data) {
    return new Promise((resolve, reject) => {
        const uploadedAt = Date.now();
        spritesDb.run(
            'INSERT INTO sprites (filename, uploaded_by, uploaded_at, file_size, data) VALUES (?, ?, ?, ?, ?)',
            [filename, uploadedBy, uploadedAt, fileSize, base64Data],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, filename, uploadedBy, uploadedAt, fileSize });
                }
            }
        );
    });
}

// Get sprites with pagination
export function getSprites(page = 1, pageSize = 120) {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * pageSize;
        spritesDb.all(
            'SELECT id, filename, uploaded_by, uploaded_at, file_size, data FROM sprites ORDER BY uploaded_at DESC LIMIT ? OFFSET ?',
            [pageSize, offset],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
}

// Get sprite count
export function getSpriteCount() {
    return new Promise((resolve, reject) => {
        spritesDb.get('SELECT COUNT(*) as count FROM sprites', [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// Get sprite by filename
export function getSpriteByFilename(filename) {
    return new Promise((resolve, reject) => {
        spritesDb.get('SELECT * FROM sprites WHERE filename = ?', [filename], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Delete sprite
export function deleteSprite(filename) {
    return new Promise((resolve, reject) => {
        spritesDb.run('DELETE FROM sprites WHERE filename = ?', [filename], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

// Close sprites database connection
export function closeSpritesDatabase() {
    return new Promise((resolve, reject) => {
        if (spritesDb) {
            spritesDb.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Sprites database connection closed');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

