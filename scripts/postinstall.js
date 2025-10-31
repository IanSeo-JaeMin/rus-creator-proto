#!/usr/bin/env node

/**
 * Post-install script for RUS Creator
 *
 * - 자동으로 Electron 버전과 ABI 버전을 감지
 * - ffi-napi, ref-napi, ref-struct-napi 모듈 rebuild
 * - Windows에서만 실행
 */

const fs = require('fs')
const { execSync } = require('child_process')
const { platform } = require('os')
const path = require('path')

const ROOT = process.cwd()
const PKG_PATH = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'))

// Electron 버전 자동 감지
const ELECTRON_VERSION =
  (pkg.devDependencies && pkg.devDependencies.electron) ||
  (pkg.dependencies && pkg.dependencies.electron) ||
  '28.2.2'

// Node ABI 버전 자동 감지
const ABI_VERSION = process.versions.modules || 'unknown'

const REQUIRED_MODULES = [
  'ffi-napi',
  'ref-napi',
  'ref-struct-napi',
  'debug',
  'ms',
  'node-gyp-build'
]

console.log('\n[postinstall] === Dependency & Native Module Check Start ===\n')
console.log(`[postinstall] Electron version: ${ELECTRON_VERSION}`)
console.log(`[postinstall] Detected ABI version: ${ABI_VERSION}\n`)

// Step 1️⃣ : 누락된 모듈 확인 및 설치
for (const mod of REQUIRED_MODULES) {
  try {
    require.resolve(mod)
    console.log(`✅ ${mod} found.`)
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

console.log('\n[postinstall] Dependency check complete.\n')

// Step 2️⃣ : Windows 환경에서만 rebuild 실행
if (platform() === 'win32') {
  console.log(`[postinstall] Windows detected → rebuilding native modules...\n`)

  try {
    // const rebuildCmd = `npx electron-rebuild -f -w ffi-napi,ref-napi,ref-struct-napi --version ${ELECTRON_VERSION} --arch x64`
    const abiVersion = execSync('npx electron --abi').toString().trim()
    const rebuildCmd = `npx electron-rebuild -f -w ffi-napi,ref-napi,ref-struct-napi --version ${ELECTRON_VERSION} --arch x64 --force-abi ${abiVersion}`

    console.log(`[postinstall] Running: ${rebuildCmd}\n`)
    execSync(rebuildCmd, { stdio: 'inherit' })
    console.log(`\n✅ Native modules rebuilt successfully for Electron ${ELECTRON_VERSION}\n`)
  } catch (err) {
    console.error('\n❌ Failed to rebuild native modules for Electron.\n')
    console.error(err.message)
    console.error('\nPlease ensure the following are installed:')
    console.error('  1️⃣ Visual Studio Build Tools (Desktop development with C++)')
    console.error('  2️⃣ Python 3.x added to PATH')
    console.error('  3️⃣ node-gyp headers installed automatically')
  }
} else {
  console.log('[postinstall] Non-Windows platform → skipping rebuild.\n')
}

console.log('[postinstall] === Postinstall Completed ===\n')
