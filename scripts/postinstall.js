#!/usr/bin/env node

/**
 * Post-install script for RUS Creator
 *
 * Purpose:
 *  - Automatically installs missing runtime dependencies (ffi-napi, ref-napi, debug, ms, node-gyp-build).
 *  - Rebuilds native modules for Electron only on Windows.
 *  - Skips rebuilds on non-Windows platforms.
 */

const { platform } = require('os')
const fs = require('fs')
const { execSync } = require('child_process')

const REQUIRED_MODULES = [
  'ffi-napi',
  'ref-napi',
  'ref-struct-napi',
  'debug',
  'ms',
  'node-gyp-build'
]

/**
 * Step 1️⃣ : Check and install missing modules
 */
console.log('[postinstall] Checking for missing dependencies...')

for (const mod of REQUIRED_MODULES) {
  try {
    require.resolve(mod)
  } catch {
    console.log(`⚠️ Missing module: ${mod} — installing...`)
    try {
      execSync(`pnpm add ${mod} -w`, { stdio: 'inherit' })
      console.log(`✅ Installed: ${mod}`)
    } catch (e) {
      console.error(`❌ Failed to install ${mod}:`, e.message)
    }
  }
}

console.log('[postinstall] Dependency check complete.')

/**
 * Step 2️⃣ : Platform-specific native rebuild (Windows only)
 */
if (platform() === 'win32') {
  console.log('[postinstall] Windows detected → Checking native module rebuild.')

  try {
    const hasFFI = fs.existsSync('./node_modules/ffi-napi')
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
