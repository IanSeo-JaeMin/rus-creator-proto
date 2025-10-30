#!/usr/bin/env node

/**
 * Rebuild native modules for Electron on Windows
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { platform } = require('os');

if (platform() !== 'win32') {
  console.log('Skipping rebuild: not on Windows.');
  process.exit(0);
}

console.log('🔧 Rebuilding native modules for Electron...');

const modules = ['ffi-napi', 'ref-napi', 'ref-struct-napi'];
const electronVersion = '28.2.2';
const nodeModulesPath = path.join(process.cwd(), 'node_modules');

for (const mod of modules) {
  const modPath = path.join(nodeModulesPath, mod);
  if (!fs.existsSync(modPath)) {
    console.log(`⚠️ ${mod} not found, skipping.`);
    continue;
  }

  console.log(`🔹 Rebuilding ${mod} for Electron ${electronVersion}...`);

  const result = spawnSync(
    'npx',
    ['electron-rebuild', '-f', '-w', mod, '--version', electronVersion],
    { stdio: 'inherit', shell: true }
  );

  if (result.status !== 0) {
    console.error(`❌ Failed to rebuild ${mod}`);
  } else {
    console.log(`✅ Successfully rebuilt ${mod}`);
  }
}

console.log('\n✅ All native modules rebuilt successfully.\n');
