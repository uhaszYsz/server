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
                    filename TEXT NOT NULL,
                    folder_path TEXT NOT NULL DEFAULT '',
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
export function createSprite(filename, uploadedBy, fileSize, base64Data, folderPath = '') {
    return new Promise((resolve, reject) => {
        const uploadedAt = Date.now();
        // Ensure folder_path starts with username/ or is empty for root
        const normalizedFolderPath = folderPath || '';
        spritesDb.run(
            'INSERT INTO sprites (filename, folder_path, uploaded_by, uploaded_at, file_size, data) VALUES (?, ?, ?, ?, ?, ?)',
            [filename, normalizedFolderPath, uploadedBy, uploadedAt, fileSize, base64Data],
            function(err) {
                if (err) {
                    console.error(`[createSprite] Database error:`, err);
                    reject(err);
                } else {
                    console.log(`[createSprite] Sprite saved: id=${this.lastID}, filename=${filename}, folderPath=${normalizedFolderPath}`);
                    resolve({ id: this.lastID, filename, folderPath: normalizedFolderPath, uploadedBy, uploadedAt, fileSize });
                }
            }
        );
    });
}

// Get sprites with pagination
export function getSprites(page = 1, pageSize = 120, uploadedBy = null, folderPath = null) {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * pageSize;
        let query, params;
        
        // Special case: folderPath === 'ROOT' means get root sprites (folder_path is empty string)
        let folderCondition;
        let folderParam = [];
        if (folderPath === 'ROOT') {
            folderCondition = 'folder_path = ?';
            folderParam = [''];
        } else if (folderPath !== null) {
            folderCondition = 'folder_path = ?';
            folderParam = [folderPath];
        } else {
            folderCondition = '1=1';
        }
        
        if (uploadedBy) {
            query = `SELECT id, filename, folder_path, uploaded_by, uploaded_at, file_size, data FROM sprites WHERE uploaded_by = ? AND ${folderCondition} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`;
            params = [uploadedBy, ...folderParam, pageSize, offset];
        } else {
            query = `SELECT id, filename, folder_path, uploaded_by, uploaded_at, file_size, data FROM sprites WHERE ${folderCondition} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`;
            params = [...folderParam, pageSize, offset];
        }
        
        spritesDb.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Get sprite count
export function getSpriteCount(uploadedBy = null, folderPath = null) {
    return new Promise((resolve, reject) => {
        let query, params;
        
        // Special case: folderPath === 'ROOT' means get root sprites (folder_path is empty string)
        let folderCondition;
        let folderParam = [];
        if (folderPath === 'ROOT') {
            folderCondition = 'folder_path = ?';
            folderParam = [''];
        } else if (folderPath !== null) {
            folderCondition = 'folder_path = ?';
            folderParam = [folderPath];
        } else {
            folderCondition = '1=1';
        }
        
        if (uploadedBy) {
            query = `SELECT COUNT(*) as count FROM sprites WHERE uploaded_by = ? AND ${folderCondition}`;
            params = [uploadedBy, ...folderParam];
        } else {
            query = `SELECT COUNT(*) as count FROM sprites WHERE ${folderCondition}`;
            params = folderParam;
        }
        
        spritesDb.get(query, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// Get sprite by filename and folder path
export function getSpriteByFilename(filename, folderPath = '') {
    return new Promise((resolve, reject) => {
        spritesDb.get('SELECT * FROM sprites WHERE filename = ? AND folder_path = ?', [filename, folderPath], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Get all folder paths (distinct folder_path values)
export function getAllFolderPaths() {
    return new Promise((resolve, reject) => {
        spritesDb.all('SELECT DISTINCT folder_path, uploaded_by FROM sprites ORDER BY folder_path', [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Get subfolders in a given folder path
export function getSubfolders(parentPath = '') {
    return new Promise((resolve, reject) => {
        // Get all folder paths that start with parentPath + '/'
        const searchPath = parentPath ? `${parentPath}/` : '';
        spritesDb.all(
            `SELECT DISTINCT folder_path, uploaded_by 
             FROM sprites 
             WHERE folder_path LIKE ? AND folder_path != ?
             ORDER BY folder_path`,
            [`${searchPath}%`, parentPath],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Extract immediate subfolders (one level deep)
                    const subfolders = new Set();
                    const pathLength = parentPath ? parentPath.split('/').length + 1 : 1;
                    
                    (rows || []).forEach(row => {
                        const parts = row.folder_path.split('/');
                        if (parts.length >= pathLength) {
                            const subfolderPath = parts.slice(0, pathLength).join('/');
                            subfolders.add(subfolderPath);
                        }
                    });
                    
                    resolve(Array.from(subfolders).map(path => {
                        // Find uploaded_by for this folder (use first match)
                        const folderRow = rows.find(r => r.folder_path.startsWith(path));
                        return {
                            folder_path: path,
                            uploaded_by: folderRow ? folderRow.uploaded_by : ''
                        };
                    }));
                }
            }
        );
    });
}

// Delete sprite by filename and folder path
export function deleteSprite(filename, folderPath = '') {
    return new Promise((resolve, reject) => {
        spritesDb.run('DELETE FROM sprites WHERE filename = ? AND folder_path = ?', [filename, folderPath || ''], function(err) {
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

