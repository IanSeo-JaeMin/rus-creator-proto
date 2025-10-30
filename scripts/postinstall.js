#!/usr/bin/env node

/**
 * Post-install script for RUS Creator
 *
 * Purpose:
 *  - Ensures ffi-napi native modules are rebuilt only on Windows.
 *  - Skips rebuild on macOS/Linux since ffi-napi is not required there.
 *  - Avoids redundant electron-builder calls (which cause long install times).
 */

const { platform } = require('os')

if (platform() === 'win32') {
  console.log('[postinstall] Windows detected → Checking native module rebuild.')

  const { execSync } = require('child_process')
  try {
    // Only rebuild if ffi-napi actually exists (avoids redundant runs)
    const hasFFI = require('fs').existsSync('./node_modules/ffi-napi')
    if (hasFFI) {
      console.log('[postinstall] ffi-napi detected. Running electron-rebuild...')
      execSync('npx electron-rebuild -f -w ffi-napi --version 28.2.2', {
        stdio: 'inherit'
      })
      console.log('[postinstall] ffi-napi rebuilt successfully.')
    } else {
      console.log('[postinstall] ffi-napi not found — skipping rebuild.')
    }
  } catch (err) {
    console.error('❌ Failed to rebuild ffi-napi for Electron.')
    console.error(err.message)
    console.error('\nPlease ensure Visual Studio Build Tools are installed:\n')
    console.error('1️⃣ Install from: https://visualstudio.microsoft.com/downloads/')
    console.error('2️⃣ Select "Desktop development with C++" workload')
    console.error('\nThen run: pnpm run rebuild:win')
    process.exit(1)
  }
} else {
  console.log('[postinstall] Non-Windows platform → Skipping native module rebuild.')
}
