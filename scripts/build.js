import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Restore root index.html from template before Vite reads it
console.log('Restoring index.html from index.template.html...');
fs.copyFileSync(
  path.join(rootDir, 'index.template.html'),
  path.join(rootDir, 'index.html')
);

// 2. Run Vite build
console.log('Running vite build...');
execSync('npx vite build', { stdio: 'inherit', cwd: rootDir });

// 3. Sync dist assets to root assets for static root hosting compatibility
console.log('Syncing dist to root...');
const distAssets = path.join(rootDir, 'dist', 'assets');
const rootAssets = path.join(rootDir, 'assets');

if (!fs.existsSync(rootAssets)) {
  fs.mkdirSync(rootAssets, { recursive: true });
}

// Clean old files in root assets
const existingRootAssets = fs.readdirSync(rootAssets);
for (const f of existingRootAssets) {
  fs.unlinkSync(path.join(rootAssets, f));
}

// Copy new dist assets
const newDistAssets = fs.readdirSync(distAssets);
for (const f of newDistAssets) {
  fs.copyFileSync(path.join(distAssets, f), path.join(rootAssets, f));
}

// Copy dist/index.html to root index.html for static root hosting
fs.copyFileSync(
  path.join(rootDir, 'dist', 'index.html'),
  path.join(rootDir, 'index.html')
);

// Copy _headers to dist and root
if (fs.existsSync(path.join(rootDir, 'public', '_headers'))) {
  fs.copyFileSync(
    path.join(rootDir, 'public', '_headers'),
    path.join(rootDir, 'dist', '_headers')
  );
  fs.copyFileSync(
    path.join(rootDir, 'public', '_headers'),
    path.join(rootDir, '_headers')
  );
}

console.log('Build & sync completed successfully!');
