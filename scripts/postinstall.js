#!/usr/bin/env node

/**
 * Post-install script for RUS Creator
 *
 * ✅ 개선사항:
 *  - 모든 관련 네이티브 모듈(ffi-napi, ref-napi, ref-struct-napi)을 한 번에 rebuild
 *  - Electron 버전을 package.json에서 자동 감지
 *  - 누락된 런타임 의존성(debug, ms, node-gyp-build 등) 자동 설치
 *  - Windows 환경에서만 rebuild 수행
 *  - CI/CD 환경에서도 안정적으로 종료
 */

const fs = require('fs');
const { execSync } = require('child_process');
const { platform } = require('os');
const path = require('path');

const ROOT = process.cwd();
const PKG_PATH = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));

// Electron 버전 자동 감지
const ELECTRON_VERSION =
  (pkg.devDependencies && pkg.devDependencies.electron) ||
  (pkg.dependencies && pkg.dependencies.electron) ||
  '28.2.2';

const REQUIRED_MODULES = [
  'ffi-napi',
  'ref-napi',
  'ref-struct-napi',
  'debug',
  'ms',
  'node-gyp-build'
];

console.log('\n[postinstall] === Dependency & Native Module Check Start ===\n');

/**
 * Step 1️⃣ : 누락된 모듈 자동 설치
 */
for (const mod of REQUIRED_MODULES) {
  try {
    require.resolve(mod);
    console.log(`✅ ${mod} found.`);
  } catch {
    console.log(`⚠️ Missing module: ${mod} — installing...`);
    try {
      execSync(`pnpm add ${mod} -w`, { stdio: 'inherit' });
      console.log(`✅ Installed: ${mod}`);
    } catch (e) {
      console.error(`❌ Failed to install ${mod}:`, e.message);
    }
  }
}

console.log('\n[postinstall] Dependency check complete.\n');

/**
 * Step 2️⃣ : Windows 환경에서만 네이티브 rebuild
 */
if (platform() === 'win32') {
  console.log(`[postinstall] Windows detected → Electron ${ELECTRON_VERSION} rebuild process starting...\n`);

  const hasFFI = fs.existsSync(path.join(ROOT, 'node_modules/ffi-napi'));
  if (!hasFFI) {
    console.log('[postinstall] ffi-napi not found — skipping native rebuild.');
    process.exit(0);
  }

  try {
    const rebuildCmd = `npx electron-rebuild -f -w ffi-napi,ref-napi,ref-struct-napi --version ${ELECTRON_VERSION}`;
    console.log(`[postinstall] Running: ${rebuildCmd}\n`);

    execSync(rebuildCmd, { stdio: 'inherit' });
    console.log(`\n✅ Native modules rebuilt successfully for Electron ${ELECTRON_VERSION}\n`);
  } catch (err) {
    console.error('\n❌ Failed to rebuild native modules for Electron.\n');
    console.error(err.message);
    console.error('\nPlease ensure the following are installed:');
    console.error('  1️⃣ Visual Studio Build Tools (Desktop development with C++)');
    console.error('  2️⃣ Python 3.x added to PATH');
    console.error('  3️⃣ node-gyp headers installed automatically');
    console.error('\nThen run manually: pnpm run rebuild:win\n');
    // 실패해도 install 전체를 중단하지 않음
    process.exit(0);
  }
} else {
  console.log('[postinstall] Non-Windows platform → Skipping native module rebuild.\n');
}

console.log('[postinstall] === Postinstall Completed ===\n');
