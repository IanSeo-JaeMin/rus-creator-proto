import type { ChildProcess } from 'child_process'
import { logger } from './logger'

// Define a common interface for the manager for type safety
export interface IWindowManager {
  updateBounds: (newBounds: { x: number; y: number; width: number; height: number }) => void
  embedWindow: (viewName: string, appPath: string, parentHwnd: Buffer) => void
  showEmbeddedWindow: (viewName: string) => void
  cleanup: () => void
}

// Initialize with stub implementation as default
let manager: IWindowManager = {
  updateBounds: () => {},
  embedWindow: () => {},
  showEmbeddedWindow: () => {},
  cleanup: () => {}
}

// This manager is intended for Windows only.
if (process.platform !== 'win32') {
  // On non-Windows platforms, we provide stub functions to prevent crashes.
  console.warn('WindowManager is designed for Windows only. Functions will be stubbed.')

  manager = {
    updateBounds: () => {},
    embedWindow: () => {},
    showEmbeddedWindow: () => {},
    cleanup: () => {}
  }
} else {
  // On Windows, we try to load native modules and implement the real logic.
  // If native modules fail to load, fall back to stub functions.
  let ffi: any
  let ref: any
  let user32: any
  let nativeModulesAvailable = false

  try {
    logger.info('Attempting to load ffi-napi...')
    ffi = require('ffi-napi')
    logger.info('ffi-napi loaded successfully')
    
    logger.info('Attempting to load ref-napi...')
    ref = require('ref-napi')
    logger.info('ref-napi loaded successfully')

    // --- FFI Definitions for Windows API ---
    // HWND is a pointer (void pointer type)
    logger.info('Creating HWNDType...')
    const HWNDType = ref.types.void
    logger.info('HWNDType created')

    logger.info('Creating user32 library...')
    user32 = new ffi.Library('user32', {
      FindWindowA: [HWNDType, ['string', 'string']],
      EnumWindows: ['int', ['pointer', 'long']],
      GetWindowTextA: ['int', [HWNDType, 'pointer', 'int']],
      SetParent: [HWNDType, [HWNDType, HWNDType]],
      MoveWindow: ['bool', [HWNDType, 'int', 'int', 'int', 'int', 'bool']],
      ShowWindow: ['bool', [HWNDType, 'int']],
      SetWindowLongA: ['long', [HWNDType, 'int', 'long']],
      GetWindowLongA: ['long', [HWNDType, 'int']],
      IsWindowVisible: ['int', [HWNDType]]
    })
    logger.info('user32 library created successfully')

    nativeModulesAvailable = true
    logger.info('Native modules (ffi-napi, ref-napi) loaded successfully.')
  } catch (error: any) {
    logger.error('Failed to load native modules (ffi-napi, ref-napi)')
    logger.error('Error type:', error?.constructor?.name || typeof error)
    logger.error('Error message:', error?.message || String(error))
    logger.error('Error stack:', error?.stack || 'No stack trace')
    logger.error('Error code:', error?.code || 'No error code')
    
    // Additional diagnostics for DLL loading errors
    if (error?.message?.includes('native callback') || error?.message?.includes('dlopen')) {
      logger.error('=== DLL Loading Error Diagnostics ===')
      const { existsSync, readdirSync } = require('fs')
      const { join } = require('path')
      const { app } = require('electron')
      const isDev = require('@electron-toolkit/utils').is.dev
      
      let moduleBasePath: string
      if (isDev) {
        moduleBasePath = join(__dirname, '../../node_modules')
      } else {
        const appPath = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath()
        if (appPath.includes('resources')) {
          moduleBasePath = join(appPath, '..', 'app.asar.unpacked', 'node_modules')
        } else {
          moduleBasePath = join(appPath, 'node_modules')
        }
      }
      
      const ffiNapiPath = join(moduleBasePath, 'ffi-napi')
      logger.error(`Checking ffi-napi at: ${ffiNapiPath}`)
      logger.error(`ffi-napi directory exists: ${existsSync(ffiNapiPath)}`)
      
      if (existsSync(ffiNapiPath)) {
        try {
          const files = readdirSync(ffiNapiPath)
          logger.error(`ffi-napi contents: ${files.join(', ')}`)
          
          // Look for .node files
          const nodeFiles = files.filter((f: string) => f.endsWith('.node'))
          logger.error(`Found .node files: ${nodeFiles.join(', ')}`)
        } catch (err) {
          logger.error(`Error reading ffi-napi directory: ${err}`)
        }
      }
      
      logger.error('=== Solution ===')
      logger.error('Native modules were not built for this Electron version.')
      logger.error('Please run the following commands on Windows:')
      logger.error('1. Navigate to the application installation directory')
      logger.error('2. Run: npx electron-builder install-app-deps')
      logger.error('3. Restart the application')
      logger.error('=====================================')
    }
    
    if (error?.code === 'MODULE_NOT_FOUND') {
      logger.error('MODULE_NOT_FOUND - checking module paths...')
      const { existsSync } = require('fs')
      const { join } = require('path')
      const { app } = require('electron')
      const isDev = require('@electron-toolkit/utils').is.dev
      
      let modulePath: string
      if (isDev) {
        modulePath = join(__dirname, '../../node_modules/ffi-napi')
      } else {
        // Check multiple possible paths
        const appPath = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath()
        modulePath = join(appPath, 'node_modules', 'ffi-napi')
      }
      logger.error(`Looking for ffi-napi at: ${modulePath}`)
      logger.error(`ffi-napi exists: ${existsSync(modulePath)}`)
    }
    logger.warn(
      'Window embedding functionality will be disabled. Falling back to stub implementation.'
    )
    nativeModulesAvailable = false

    // Assign stub manager if native modules are not available
    manager = {
      updateBounds: () => {},
      embedWindow: (viewName: string, appPath: string, _parentHwnd: Buffer) => {
        logger.error(
          `[STUB] Window embedding is disabled: native modules not available. viewName: ${viewName}, appPath: ${appPath}`
        )
        console.warn('Window embedding is disabled: native modules not available')
      },
      showEmbeddedWindow: () => {
        console.warn('Window embedding is disabled: native modules not available')
      },
      cleanup: () => {}
    }
  }

  // Only proceed with real implementation if native modules are available
  if (nativeModulesAvailable) {
    const { spawn } = require('child_process')

    // --- Constants ---
    const SW_HIDE = 0
    const SW_SHOW = 5
    const GWL_STYLE = -16
    const WS_CAPTION = 0x00c00000
    const WS_THICKFRAME = 0x00040000
    const WS_POPUP = 0x80000000

    // --- Module State ---
    let latestBounds = { x: 0, y: 0, width: 800, height: 600 }
    const embeddedWindows = new Map<string, { process: ChildProcess; hwnd: Buffer | null }>()

    // Window title search patterns for different views
    // Format: [keyword1, keyword2, ...] - all keywords must be present in the window title
    const windowTitlePatterns: Record<string, string[]> = {
      Stomach: ['Stomach', 'Service', 'Batch'],
      Kidney: ['Kidney', 'Service', 'Batch'], // Will match "Kidney Service Batch v2.1.1"
      Lung: ['Lung', 'Service', 'Batch'],
      Liver: ['Liver', 'Service', 'Batch'],
      Colon: ['Colon', 'Service', 'Batch'],
      Recon: ['Recon', 'Application'],
      '3D Modeling': ['Blender'],
      Pneumo: ['Pneumo', 'App'],
      'Pneumo Editor': ['Pneumo', 'Editor'],
      'hu3D Maker': ['hu3D', 'Maker']
    }

    // --- Private Functions ---
    function findWindowByPattern(searchTerms: string[]): Buffer | null {
      // First, try exact title matches with common patterns
      const exactPatterns = [
        searchTerms[0] + ' Service ' + searchTerms[2] + ' v', // "Kidney Service Batch v"
        searchTerms.join(' Service Batch'), // "Kidney Service Batch"
        searchTerms.join(' - '), // "Kidney - Service - Batch"
        searchTerms.join(' ') // "Kidney Service Batch"
      ]

      for (const pattern of exactPatterns) {
        try {
          const hwnd = user32.FindWindowA(null, pattern)
          if (hwnd && hwnd.length > 0 && user32.IsWindowVisible(hwnd)) {
            logger.info(`Found window with exact pattern: "${pattern}"`)
            return hwnd
          }
        } catch (err) {
          continue
        }
      }

      // If exact match fails, enumerate all windows and check titles
      let foundHwnd: Buffer | null = null
      const maxLength = 256
      const buffer = Buffer.alloc(maxLength)

      // Create callback for EnumWindows
      // EnumWindows callback signature: BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam);
      const EnumProc = ffi.Callback(
        'int',
        [ref.types.void, 'long'],
        function (hwnd: Buffer, _lParam: number): number {
          if (!hwnd || hwnd.length === 0) {
            return 1 // Continue enumeration
          }

          try {
            // Check if window is visible
            if (user32.IsWindowVisible(hwnd) === 1) {
              // Get window title
              buffer.fill(0) // Clear buffer
              const length = user32.GetWindowTextA(hwnd, buffer, maxLength)
              if (length > 0) {
                const windowTitle = buffer.toString('utf8', 0, length)

                // Check if window title contains all search terms (case-insensitive)
                const titleLower = windowTitle.toLowerCase()
                const allTermsFound = searchTerms.every((term) =>
                  titleLower.includes(term.toLowerCase())
                )

                if (allTermsFound) {
                  logger.info(
                    `Found matching window: "${windowTitle}" for terms: ${searchTerms.join(', ')}`
                  )
                  foundHwnd = hwnd
                  return 0 // Stop enumeration
                }
              }
            }
          } catch {
            // Continue enumeration on error
          }

          return 1 // Continue enumeration
        }
      )

      // Enumerate all windows
      try {
        user32.EnumWindows(EnumProc, 0)
      } catch (err) {
        logger.error('Error enumerating windows:', err)
      }

      if (foundHwnd) {
        return foundHwnd
      }

      // Fallback: try individual terms
      for (const term of searchTerms) {
        try {
          const hwnd = user32.FindWindowA(null, term)
          if (hwnd && hwnd.length > 0 && user32.IsWindowVisible(hwnd) === 1) {
            logger.debug(`Found window with term: ${term}`)
            return hwnd
          }
        } catch (err) {
          continue
        }
      }

      logger.debug(`No window found with any patterns for: ${searchTerms.join(', ')}`)
      return null
    }

    function findWindow(viewName: string, callback: (hwnd: Buffer) => void) {
      const searchTerms = windowTitlePatterns[viewName]
      if (!searchTerms || searchTerms.length === 0) {
        logger.error(`No window search pattern defined for ${viewName}`)
        return
      }

      logger.info(`Searching for window: ${viewName} with patterns: ${searchTerms.join(', ')}`)

      let attempts = 0
      const maxAttempts = 40 // Try for 20 seconds (40 * 500ms) - increased for slower apps
      const interval = setInterval(() => {
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          logger.error(
            `Could not find window for ${viewName} after ${maxAttempts} attempts. Searched for: ${searchTerms.join(', ')}`
          )
          return
        }

        const hwnd = findWindowByPattern(searchTerms)

        if (hwnd && hwnd.length > 0) {
          clearInterval(interval)
          logger.info(`Found window for ${viewName}, HWND: ${hwnd.toString('hex')}`)
          callback(hwnd)
        } else {
          attempts++
          if (attempts % 10 === 0) {
            logger.debug(`Still searching for ${viewName}... (attempt ${attempts}/${maxAttempts})`)
          }
        }
      }, 500)
    }

    // --- Public API Implementation ---
    function updateBounds(newBounds: {
      x: number
      y: number
      width: number
      height: number
    }): void {
      latestBounds = newBounds
    }

    function embedWindow(viewName: string, appPath: string, parentHwnd: Buffer): void {
      logger.info(`[embedWindow] Function called with viewName: ${viewName}, appPath: ${appPath}`)
      logger.info(`[embedWindow] Native modules available: ${nativeModulesAvailable}`)
      logger.info(`[embedWindow] parentHwnd valid: ${parentHwnd && parentHwnd.length > 0}`)

      if (embeddedWindows.has(viewName)) {
        logger.info(`Window already embedded for ${viewName}, showing it`)
        showEmbeddedWindow(viewName)
        return
      }

      try {
        logger.info(`Starting application: ${appPath} for ${viewName}`)

        // Check if file exists before spawning
        const { existsSync } = require('fs')
        if (!existsSync(appPath)) {
          logger.error(`Executable file does not exist: ${appPath}`)
          return
        }

        logger.info(`Executable file exists: ${appPath}`)

        // Get the directory of the executable as working directory
        const path = require('path')
        const executableDir = path.dirname(appPath)
        logger.info(`Executable directory: ${executableDir}`)
        logger.info(`File path verified, spawning process...`)

        // Determine if it's a batch file
        const isBatch =
          appPath.toLowerCase().endsWith('.bat') || appPath.toLowerCase().endsWith('.cmd')

        const spawnOptions: any = {
          cwd: executableDir, // Set working directory to executable's directory
          detached: false, // Keep attached to wait for window
          stdio: isBatch ? 'inherit' : 'ignore' // Show batch file output for debugging
        }

        // Use shell for batch files, but not for .exe files
        if (isBatch) {
          spawnOptions.shell = true
        }

        logger.debug(`Spawn options:`, JSON.stringify(spawnOptions))

        // For .exe files, use absolute path
        const command = appPath
        logger.info(`Spawning: ${command}`)

        const appProcess = spawn(command, [], spawnOptions)

        logger.info(`Process spawned with PID: ${appProcess.pid}`)

        appProcess.on('error', (err) => {
          logger.error(`Failed to start ${appPath}:`, err)
          logger.error(`Error details:`, err.message)
          if (err.stack) {
            logger.error(`Stack trace:`, err.stack)
          }
          logger.error(`Error code:`, (err as NodeJS.ErrnoException).code)
          logger.error(`Error syscall:`, (err as NodeJS.ErrnoException).syscall)
          embeddedWindows.delete(viewName)
        })

        appProcess.on('exit', (code) => {
          logger.info(`Application exited with code ${code} for ${viewName}`)
          embeddedWindows.delete(viewName)
        })

        appProcess.on('spawn', () => {
          logger.info(`Process spawned successfully for ${viewName}`)
        })

        const entry: { process: ChildProcess; hwnd: Buffer | null } = {
          process: appProcess,
          hwnd: null
        }
        embeddedWindows.set(viewName, entry)

        logger.info(`Waiting for window to appear for ${viewName}...`)
        findWindow(viewName, (hwnd) => {
          if (!hwnd || hwnd.length === 0) {
            logger.error(`Invalid HWND received for ${viewName}`)
            return
          }

          entry.hwnd = hwnd
          logger.info(`Found window for ${viewName}, embedding...`)

          try {
            // Set parent window
            user32.SetParent(hwnd, parentHwnd)

            // Modify window style to remove title bar and border
            const style = user32.GetWindowLongA(hwnd, GWL_STYLE)
            user32.SetWindowLongA(
              hwnd,
              GWL_STYLE,
              (style & ~WS_CAPTION & ~WS_THICKFRAME) | WS_POPUP
            )

            // Hide initially
            user32.ShowWindow(hwnd, SW_HIDE)

            logger.info(`Window embedded successfully for ${viewName}`)
            showEmbeddedWindow(viewName)
          } catch (error) {
            logger.error(`Error during embed operations for ${viewName}:`, error)
          }
        })
      } catch (error) {
        logger.error(`Error spawning or embedding ${viewName}:`, error)
      }
    }

    function showEmbeddedWindow(viewName: string): void {
      for (const [key, win] of embeddedWindows.entries()) {
        if (win.hwnd && key !== viewName) {
          user32.ShowWindow(win.hwnd, SW_HIDE)
        }
      }

      const target = embeddedWindows.get(viewName)
      if (target && target.hwnd) {
        user32.ShowWindow(target.hwnd, SW_SHOW)
        user32.MoveWindow(
          target.hwnd,
          Math.round(latestBounds.x),
          Math.round(latestBounds.y),
          Math.round(latestBounds.width),
          Math.round(latestBounds.height),
          true
        )
      }
    }

    function cleanup(): void {
      for (const win of embeddedWindows.values()) {
        spawn('taskkill', ['/pid', win.process.pid!.toString(), '/f', '/t'])
      }
    }

    // Assign the real implementation to the manager
    manager = {
      updateBounds,
      embedWindow,
      showEmbeddedWindow,
      cleanup
    }
  }
}

// Export the manager as a default export
export default manager
