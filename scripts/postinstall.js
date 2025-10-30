#!/usr/bin/env node

// Only rebuild native dependencies on Windows
// macOS has compatibility issues with ffi-napi and Electron 38.4.0
if (process.platform === 'win32') {
  const { spawn } = require('child_process');
  const electronBuilder = spawn('npx', ['electron-builder', 'install-app-deps'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });

  electronBuilder.on('close', (code) => {
    if (code !== 0) {
      console.error('ERROR: Failed to rebuild native dependencies for Electron.');
      console.error('');
      console.error('To fix this issue, please install Visual Studio Build Tools:');
      console.error('1. Download from: https://visualstudio.microsoft.com/downloads/');
      console.error('2. Install "Desktop development with C++" workload');
      console.error('   OR install "Build Tools for Visual Studio" with C++ tools');
      console.error('');
      console.error('After installing, run: npm run rebuild:win');
      process.exit(1); // Fail the installation to alert the user
    }
  });
} else {
  console.log('Skipping native dependencies rebuild (ffi-napi is Windows-only)');
}
