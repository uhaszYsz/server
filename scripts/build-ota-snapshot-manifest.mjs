#!/usr/bin/env node
/**
 * Build ota-manifest-snapshot.json for server.js — same exclusions + git blob hashes as shipped APK / extract.
 *
 * Example:
 *   node server/scripts/build-ota-snapshot-manifest.mjs "C:/Users/tengo/Desktop/www"
 *   Writes: server/ota-manifest-snapshot.json (override OUT second arg).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');

/** Keep in sync with server/server.js */
const OTA_EXCLUDE_PREFIXES = [
    'sprites/bosses/',
    'lib/dragonBones',
    'lib/pixi.min',
    'ui/dragonbones',
    'apk_tools/'
];

const OTA_MANIFEST_SKIP_FILES = new Set(['runner.apk']);

function gitBlobSha(content) {
    const header = `blob ${content.length}\0`;
    const blob = Buffer.concat([Buffer.from(header, 'utf8'), content]);
    return crypto.createHash('sha1').update(blob).digest('hex');
}

function shouldSkip(rel) {
    const n = rel.replace(/\\/g, '/');
    if (OTA_MANIFEST_SKIP_FILES.has(n)) return true;
    if (OTA_EXCLUDE_PREFIXES.some((ex) => n.startsWith(ex))) return true;
    return false;
}

function walkDir(dir, baseDir, out) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.relative(baseDir, full).replace(/\\/g, '/');
        if (e.isDirectory()) {
            walkDir(full, baseDir, out);
        } else if (e.isFile()) {
            if (shouldSkip(rel)) continue;
            const content = fs.readFileSync(full);
            out[rel] = { hash: gitBlobSha(content), size: content.length };
        }
    }
}

const wwwArg = process.argv[2];
const outArg = process.argv[3];
if (!wwwArg) {
    console.error('Usage: node build-ota-snapshot-manifest.mjs <path-to-www-folder> [out.json]');
    process.exit(1);
}

const wwwDir = path.resolve(wwwArg);
if (!fs.existsSync(wwwDir) || !fs.statSync(wwwDir).isDirectory()) {
    console.error('Not a directory:', wwwDir);
    process.exit(1);
}

const manifest = {};
walkDir(wwwDir, wwwDir, manifest);

const outPath = outArg
    ? path.resolve(outArg)
    : path.join(SERVER_DIR, 'ota-manifest-snapshot.json');

fs.writeFileSync(outPath, JSON.stringify(manifest, null, 0), 'utf8');
console.log(`Wrote ${Object.keys(manifest).length} entries -> ${outPath}`);
