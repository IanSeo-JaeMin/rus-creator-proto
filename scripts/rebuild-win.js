#!/usr/bin/env node

// Rebuild native modules for Electron on Windows
// This script must be run on Windows

const { spawn } = require('child_process');
const process = require('process');

if (process.platform !== 'win32') {
  console.error('ERROR: This script must be run on Windows.');
  console.error('Native modules (ffi-napi) must be built on Windows for the Windows build.');
  console.error('Please run `npm run build:win` on a Windows machine.');
  process.exit(1);
}

console.log('Rebuilding native modules for Electron on Windows...');

const electronBuilder = spawn('npx', ['electron-builder', 'install-app-deps'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

electronBuilder.on('close', (code) => {
  if (code !== 0) {
    console.error('ERROR: Failed to rebuild native dependencies for Electron.');
    console.error('Please ensure you have all build tools installed:');
    console.error('  - Visual Studio Build Tools');
    console.error('  - Python (for node-gyp)');
    console.error('  - Node.js development headers');
    process.exit(1);
  } else {
    console.log('Successfully rebuilt native modules for Electron.');
  }
});

