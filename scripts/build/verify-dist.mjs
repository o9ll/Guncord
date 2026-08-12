// verify-dist.mjs - Verifie dist/desktop avant de zipper
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const distDir = path.join(rootDir, 'dist', 'desktop');

const REQUIRED_FILES = ['patcher.js', 'renderer.js', 'preload.js', 'node.exe', 'ffmpeg.exe'];
const REQUIRED_DIRS = [
    'server', 'server/node_modules',
    'server/node_modules/@babel',
    'server/node_modules/@babel/runtime',
    'server/node_modules/@babel/runtime/helpers',
];
const REQUIRED_MODULE_FILES = [
    'server/node_modules/@babel/runtime/helpers/asyncToGenerator.js',
    'server/node_modules/@babel/runtime/helpers/interopRequireDefault.js',
];

let errors = 0;
console.log('[verify] Checking dist/desktop integrity...');

for (const f of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(distDir, f.replace(/\//g, path.sep)))) {
        console.error('[verify] MISSING FILE: ' + f); errors++;
    }
}
for (const d of REQUIRED_DIRS) {
    const full = path.join(distDir, d.replace(/\//g, path.sep));
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
        console.error('[verify] MISSING DIR: ' + d); errors++;
    }
}
for (const f of REQUIRED_MODULE_FILES) {
    if (!fs.existsSync(path.join(distDir, f.replace(/\//g, path.sep)))) {
        console.error('[verify] MISSING MODULE: ' + f); errors++;
    }
}

const helpersDir = path.join(distDir, 'server', 'node_modules', '@babel', 'runtime', 'helpers');
if (fs.existsSync(helpersDir)) {
    const count = fs.readdirSync(helpersDir).filter(f => f.endsWith('.js')).length;
    if (count < 50) {
        console.error('[verify] @babel/runtime/helpers too sparse: ' + count + ' .js files (expected 100+)'); errors++;
    } else {
        console.log('[verify] @babel/runtime/helpers OK: ' + count + ' files');
    }
}

if (errors === 0) {
    console.log('[verify] All checks passed. Safe to zip.');
    process.exit(0);
} else {
    console.error('[verify] ' + errors + ' problem(s) found. Run: cd server && npm install');
    process.exit(1);
}
