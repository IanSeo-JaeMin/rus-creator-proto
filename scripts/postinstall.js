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
      console.warn('Warning: Failed to rebuild native dependencies. This may be expected on non-Windows platforms.');
      process.exit(0); // Don't fail the installation
    }
  });
} else {
  console.log('Skipping native dependencies rebuild (ffi-napi is Windows-only)');
}
