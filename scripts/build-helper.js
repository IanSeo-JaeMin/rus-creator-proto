#!/usr/bin/env node

/**
 * Build helper EXE script for RUS Creator
 * 
 * Builds the C# helper EXE that handles window embedding on Windows
 */

const { execSync, spawnSync } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')
const { platform } = require('os')

if (platform() !== 'win32') {
  console.log('⚠️  Helper EXE build is only supported on Windows')
  process.exit(0)
}

const ROOT = process.cwd()
const HELPER_DIR = path.join(ROOT, 'helper')
const HELPER_PROJECT = path.join(HELPER_DIR, 'Embedder.csproj')
const OUTPUT_DIR = path.join(ROOT, 'resources', 'helper')

console.log('\n[build-helper] === Building Helper EXE ===\n')

// Check if helper project exists
if (!existsSync(HELPER_PROJECT)) {
  console.error('❌ Helper project not found:', HELPER_PROJECT)
  process.exit(1)
}

console.log(`[build-helper] Helper project: ${HELPER_PROJECT}`)
console.log(`[build-helper] Output directory: ${OUTPUT_DIR}\n`)

try {
  // Check if dotnet is available
  try {
    const dotnetVersion = execSync('dotnet --version', { encoding: 'utf-8' }).trim()
    console.log(`[build-helper] Found .NET SDK: ${dotnetVersion}\n`)
  } catch (error) {
    console.error('❌ .NET SDK not found. Please install .NET SDK 6.0 or later.')
    console.error('   Download from: https://dotnet.microsoft.com/download')
    process.exit(1)
  }

  // Build the helper
  console.log('[build-helper] Building helper EXE...\n')
  const buildResult = spawnSync(
    'dotnet',
    ['publish', HELPER_PROJECT, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '-p:PublishSingleFile=true'],
    {
      stdio: 'inherit',
      shell: true,
      cwd: ROOT
    }
  )

  if (buildResult.status !== 0) {
    console.error('\n❌ Failed to build helper EXE')
    process.exit(1)
  }

  // Find the publish output directory
  // dotnet publish outputs can be in different locations
  const possiblePaths = [
    path.join(ROOT, 'resources', 'helper', 'net8.0', 'win-x64', 'publish'),
    path.join(HELPER_DIR, 'bin', 'Release', 'net8.0', 'win-x64', 'publish')
  ]

  let exePath = null
  for (const publishDir of possiblePaths) {
    const candidatePath = path.join(publishDir, 'Embedder.exe')
    if (existsSync(candidatePath)) {
      exePath = candidatePath
      break
    }
  }

  // Check if publish output exists
  if (!exePath || !existsSync(exePath)) {
    console.error(`❌ Built EXE not found in any expected location`)
    console.error(`   Searched paths:`)
    possiblePaths.forEach(p => console.error(`     - ${p}`))
    process.exit(1)
  }

  console.log(`\n✅ Helper EXE built successfully: ${exePath}`)
  console.log(`\n[build-helper] Copying to resources directory...`)

  // Create output directory
  const { mkdirSync, copyFileSync } = require('fs')
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Copy EXE to resources directory
  const destPath = path.join(OUTPUT_DIR, 'Embedder.exe')
  copyFileSync(exePath, destPath)
  console.log(`✅ Helper EXE copied to: ${destPath}`)

  console.log('\n[build-helper] === Build Complete ===\n')
} catch (error) {
  console.error('\n❌ Error building helper EXE:', error.message)
  process.exit(1)
}

