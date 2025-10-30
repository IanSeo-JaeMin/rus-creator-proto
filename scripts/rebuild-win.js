#!/usr/bin/env node

/**
 * Rebuild native modules for Electron on Windows
 *
 * Target Environment:
 *   - Electron 28.2.2 (Node 18.x)
 *   - ffi-napi 4.0.3
 *
 * Purpose:
 *   - Rebuild only native modules that need ABI alignment (ffi-napi, ref-napi, ref-struct-napi)
 *   - Skip redundant rebuilds and avoid dependency resolution issues
 *   - Provide clear feedback when Visual Studio Build Tools are missing
 */

const { spawnSync } = require('child_process')
const { platform, cwd } = require('process')

if (platform !== 'win32') {
  console.error('❌ ERROR: This script must be run on Windows.')
  console.error('Native modules must be built on a Windows system for correct ABI linkage.')
  console.error('Run `pnpm run build:win` on a Windows machine.')
  process.exit(1)
}

console.log('🔧 Rebuilding native modules for Electron (Windows)...\n')

try {
  // Run electron-rebuild only for specific native modules
  const result = spawnSync(
    'npx',
    ['electron-rebuild', '-f', '-w', 'ffi-napi,ref-napi,ref-struct-napi', '--version', '28.2.2'],
    {
      stdio: 'inherit',
      shell: true,
      cwd: cwd()
    }
  )

  if (result.status !== 0) {
    throw new Error('electron-rebuild exited with a non-zero code')
  }

  console.log('\n✅ Successfully rebuilt ffi-napi native modules for Electron 28.2.2.\n')
} catch (error) {
  console.error('\n❌ Failed to rebuild native dependencies for Electron.\n')
  console.error('Check the following items:')
  console.error('  1️⃣ Visual Studio Build Tools (Desktop development with C++)')
  console.error('  2️⃣ Python 3.x (added to PATH)')
  console.error('  3️⃣ Node.js headers (auto-installed by node-gyp)')
  console.error('\nThen run: pnpm run rebuild:win')
  process.exit(1)
}
