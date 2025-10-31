#!/usr/bin/env node

/**
 * Post-install script for RUS Creator
 *
 * - Helper EXE 빌드 (Windows에서만)
 * - 개발 의존성 확인
 */

const { execSync } = require('child_process')
const { platform } = require('os')
const { existsSync } = require('fs')
const path = require('path')

const ROOT = process.cwd()

console.log('\n[postinstall] === Postinstall Start ===\n')

// Windows 환경에서만 Helper 빌드
if (platform() === 'win32') {
  const helperExe = path.join(ROOT, 'resources', 'helper', 'Embedder.exe')
  
  if (!existsSync(helperExe)) {
    console.log('[postinstall] Helper EXE not found. Building helper...\n')
    try {
      execSync('node scripts/build-helper.js', { stdio: 'inherit', cwd: ROOT })
      console.log('\n✅ Helper EXE built successfully\n')
    } catch (error) {
      console.warn('\n⚠️ Failed to build helper EXE. You can build it manually with: pnpm build:helper\n')
      console.warn('This is not critical if you are just installing dependencies.\n')
    }
  } else {
    console.log('✅ Helper EXE already exists\n')
  }
} else {
  console.log('[postinstall] Non-Windows platform → skipping helper build.\n')
}

console.log('[postinstall] === Postinstall Completed ===\n')
