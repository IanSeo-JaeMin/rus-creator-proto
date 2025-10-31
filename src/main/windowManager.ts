import type { ChildProcess } from 'child_process'
import { logger } from './logger'
import path from 'path'
import { app } from 'electron'
import { spawnSync, execSync } from 'child_process'
import { existsSync } from 'fs'

// Define a common interface for the manager for type safety
export interface IWindowManager {
  updateBounds: (newBounds: { x: number; y: number; width: number; height: number }) => void
  embedWindow: (viewName: string, appPath: string, parentHwnd: Buffer) => void
  showEmbeddedWindow: (viewName: string) => void
  hideAllWindows: () => Promise<void>
  cleanup: () => void
}

// Initialize with stub implementation as default
let manager: IWindowManager = {
  updateBounds: () => {},
  embedWindow: () => {},
  showEmbeddedWindow: () => {},
  hideAllWindows: async () => {},
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
    hideAllWindows: async () => {},
    cleanup: () => {}
  }
} else {
  // Helper EXE path resolution
  function getHelperPath(): string | null {
    const isPackaged = app.isPackaged
    let helperPath: string

    if (isPackaged) {
      // In packaged app, asarUnpacked files are in app.asar.unpacked/resources/helper
      // process.resourcesPath points to the resources directory
      const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'helper', 'Embedder.exe')
      const directPath = path.join(process.resourcesPath, 'helper', 'Embedder.exe')
      
      // Try app.asar.unpacked path first (for asarUnpacked files)
      if (existsSync(unpackedPath)) {
        helperPath = unpackedPath
      } else if (existsSync(directPath)) {
        // Fallback to direct resources path
        helperPath = directPath
      } else {
        helperPath = unpackedPath // Use for error message
      }
    } else {
      // In development, check resources/helper first, then build output
      helperPath = path.join(__dirname, '..', '..', 'resources', 'helper', 'Embedder.exe')
      if (!existsSync(helperPath)) {
        helperPath = path.join(__dirname, '..', '..', 'helper', 'bin', 'Debug', 'net6.0', 'Embedder.exe')
      }
    }

    if (existsSync(helperPath)) {
      logger.info(`Helper EXE found at: ${helperPath}`)
      return helperPath
    } else {
      logger.error(`Helper EXE not found at: ${helperPath}`)
      // Also log alternative paths for debugging
      if (isPackaged) {
        logger.error(`Also checked: ${path.join(process.resourcesPath, 'helper', 'Embedder.exe')}`)
      }
      return null
    }
  }

  // Execute helper EXE and return output
  function executeHelper(
    command: string,
    args: string[],
    viewName?: string
  ): Promise<{ success: boolean; output: string; hwnd?: string; pid?: string }> {
    return new Promise((resolve) => {
      const helperPath = getHelperPath()
      if (!helperPath) {
        resolve({ success: false, output: 'Helper EXE not found' })
        return
      }

      const fullArgs = [command, ...args]
      logger.info(`Executing helper: ${helperPath} ${fullArgs.join(' ')}`)

      try {
        const result = spawnSync(helperPath, fullArgs, {
          encoding: 'utf-8',
          timeout: 60000, // Increase timeout to 60 seconds for slow-starting apps
          stdio: ['pipe', 'pipe', 'pipe']
        })

        if (result.error) {
          throw result.error
        }

        // Combine stdout and stderr
        const stdout = result.stdout || ''
        const stderr = result.stderr || ''
        const output = stdout + (stderr ? '\n' + stderr : '')
        
        // Check exit code
        if (result.status !== 0) {
          logger.error(`Helper exited with code ${result.status}`)
          logger.error(`Output: ${output}`)
          resolve({ success: false, output: output })
          return
        }

        // Log all output for debugging
        if (command === 'embed' && viewName) {
          logger.info(`Helper output for ${viewName}:`)
          logger.info(output)
        }

        const lines = output.trim().split('\n')
        const lastLine = lines[lines.length - 1]

        if (lastLine.startsWith('SUCCESS')) {
          const parts = lastLine.split(':')
          if (parts.length > 1) {
            const hwnd = parts[1].trim()
            const pid = parts.length > 2 ? parts[2].trim() : null
            logger.info(`Helper returned success with HWND: ${hwnd}, PID: ${pid || 'N/A'}`)
            resolve({ success: true, output: output, hwnd: hwnd, pid: pid })
          } else {
            logger.info(`Helper returned success without HWND`)
            resolve({ success: true, output: output })
          }
        } else {
          logger.error(`Helper returned failure. Last line: ${lastLine}`)
          logger.error(`Full output: ${output}`)
          resolve({ success: false, output: output })
        }
      } catch (error: any) {
        const errorOutput = error.message || (error.stdout?.toString() || '') + (error.stderr?.toString() || '')
        logger.error(`Helper execution failed: ${errorOutput}`)
        if (command === 'embed' && viewName) {
          logger.error(`Failed to embed window for: ${viewName}`)
        }
        logger.error(`Error details:`, error)
        resolve({ success: false, output: errorOutput })
      }
    })
  }

  // Window title search patterns for different views
  // Note: Search terms are matched case-insensitively
  const windowTitlePatterns: Record<string, string[]> = {
    Stomach: ['Stomach', 'Service', 'Batch'],
    Kidney: ['Kidney', 'Service', 'Batch'],
    Lung: ['Lung', 'Service', 'Batch'],
    Liver: ['Liver', 'Service', 'Batch'],
    Colon: ['Colon', 'Service', 'Batch'],
    Recon: ['Recon', 'Application'],
    '3D Modeling': ['Blender'], // Blender may have various titles like "Blender", "blender", etc.
    Pneumo: ['Pneumo', 'App'],
    'Pneumo Editor': ['Pneumo', 'Editor'],
    'hu3D Maker': ['hu3D', 'Maker']
  }

  // Module State
  let latestBounds = { x: 0, y: 0, width: 800, height: 600 }
  const embeddedWindows = new Map<
    string,
    { process: ChildProcess | null; hwnd: string | null; pid: string | null; helperAvailable: boolean }
  >()

  // Check if helper is available
  const helperPath = getHelperPath()
  const helperAvailable = helperPath !== null

  if (!helperAvailable) {
    logger.warn(
      'Helper EXE not found. Window embedding functionality will be disabled. Please build the helper first.'
    )
    logger.warn('Run: dotnet publish helper/Embedder.csproj -c Release -r win-x64')
  }

  // Public API Implementation
  function updateBounds(newBounds: { x: number; y: number; width: number; height: number }): void {
    latestBounds = newBounds
  }

  async function embedWindow(viewName: string, appPath: string, parentHwnd: Buffer): Promise<void> {
    logger.info(`[embedWindow] Function called with viewName: ${viewName}, appPath: ${appPath}`)
    logger.info(`[embedWindow] Helper available: ${helperAvailable}`)
    logger.info(`[embedWindow] parentHwnd valid: ${parentHwnd && parentHwnd.length > 0}`)

    if (!helperAvailable) {
      logger.error('[embedWindow] Helper EXE not available')
      return
    }

    if (embeddedWindows.has(viewName)) {
      logger.info(`Window already embedded for ${viewName}, showing it`)
      showEmbeddedWindow(viewName)
      return
    }

    try {
      // Check if file exists
      if (!existsSync(appPath)) {
        logger.error(`Executable file does not exist: ${appPath}`)
        return
      }

      logger.info(`Starting application: ${appPath} for ${viewName}`)

      // Get search terms for this view
      const searchTerms = windowTitlePatterns[viewName]
      if (!searchTerms || searchTerms.length === 0) {
        logger.error(`No window search pattern defined for ${viewName}`)
        return
      }

      // Get parent HWND as integer
      const parentHwndInt = parentHwnd.readInt32LE(0)

      logger.info(`Search terms for ${viewName}: ${searchTerms.join(', ')}`)
      
      // Execute helper with embed command
      const result = await executeHelper('embed', [
        parentHwndInt.toString(),
        appPath,
        ...searchTerms
      ], viewName)

      if (!result.success) {
        logger.error(`Failed to embed window for ${viewName}`)
        logger.error(`Helper output: ${result.output}`)
        logger.error(`Search terms used: ${searchTerms.join(', ')}`)
        logger.error(`This might mean:`)
        logger.error(`  1. The application window title doesn't match the search terms`)
        logger.error(`  2. The application took too long to start (>60 seconds)`)
        logger.error(`  3. The application window is not visible`)
        return
      }

      // Extract HWND and PID from result
      const childHwnd = result.hwnd || null
      const pid = result.pid || null

      if (!childHwnd) {
        logger.error(`Failed to get child HWND for ${viewName}`)
        logger.error(`Helper output: ${result.output}`)
        logger.error(`The helper succeeded but didn't return an HWND. This might be a helper bug.`)
        return
      }

      logger.info(`Window embedded successfully for ${viewName}, HWND: ${childHwnd}, PID: ${pid || 'N/A'}`)

      // Store the embedded window info with PID for cleanup
      embeddedWindows.set(viewName, {
        process: null, // Process is managed by helper, but we have PID
        hwnd: childHwnd,
        pid: pid,
        helperAvailable: true
      })

      // Show the embedded window
      showEmbeddedWindow(viewName)
    } catch (error) {
      logger.error(`Error embedding window for ${viewName}:`, error)
    }
  }

  async function showEmbeddedWindow(viewName: string): Promise<void> {
    const target = embeddedWindows.get(viewName)
    if (!target || !target.hwnd) {
      logger.warn(`No embedded window found for ${viewName}`)
      return
    }

    // Hide other windows
    for (const [key, win] of embeddedWindows.entries()) {
      if (win.hwnd && key !== viewName) {
        await executeHelper('hide', [win.hwnd], key)
      }
    }

    // Show target window
    const result = await executeHelper('show', [
      target.hwnd,
      latestBounds.x.toString(),
      latestBounds.y.toString(),
      latestBounds.width.toString(),
      latestBounds.height.toString()
    ])

    if (result.success) {
      logger.info(`Window shown successfully for ${viewName}`)
    } else {
      logger.error(`Failed to show window for ${viewName}: ${result.output}`)
    }
  }

  async function hideAllWindows(): Promise<void> {
    logger.debug('Hiding all embedded windows...')
    for (const [viewName, win] of embeddedWindows.entries()) {
      if (win.hwnd) {
        await executeHelper('hide', [win.hwnd])
        logger.debug(`Hidden window for ${viewName}`)
      }
    }
  }

  function cleanup(): void {
    logger.info('Cleaning up embedded windows...')
    for (const [viewName, win] of embeddedWindows.entries()) {
      // Try to kill the process using PID if available
      if (win.pid && helperAvailable) {
        try {
          logger.info(`Terminating process for ${viewName} (PID: ${win.pid})`)
          // Use taskkill on Windows to terminate the process
          if (process.platform === 'win32') {
            try {
              // Try graceful termination first
              execSync(`taskkill /PID ${win.pid} /T`, { stdio: 'ignore', timeout: 2000 })
              logger.info(`Terminated process ${win.pid} for ${viewName}`)
            } catch (error: any) {
              // If graceful termination fails, try force kill
              try {
                execSync(`taskkill /F /PID ${win.pid} /T`, { stdio: 'ignore', timeout: 2000 })
                logger.info(`Force killed process ${win.pid} for ${viewName}`)
              } catch (forceError) {
                logger.warn(`Failed to kill process ${win.pid} for ${viewName}:`, forceError)
              }
            }
          } else {
            // On other platforms, use kill command
            try {
              execSync(`kill ${win.pid}`, { stdio: 'ignore', timeout: 2000 })
              logger.info(`Terminated process ${win.pid} for ${viewName}`)
            } catch (error: any) {
              try {
                execSync(`kill -9 ${win.pid}`, { stdio: 'ignore', timeout: 2000 })
                logger.info(`Force killed process ${win.pid} for ${viewName}`)
              } catch (forceError) {
                logger.warn(`Failed to kill process ${win.pid} for ${viewName}:`, forceError)
              }
            }
          }
        } catch (error) {
          logger.error(`Error terminating process ${win.pid} for ${viewName}:`, error)
        }
      } else if (win.process && !win.process.killed) {
        // Fallback to process object if PID is not available
        try {
          if (process.platform === 'win32') {
            win.process.kill()
          } else {
            win.process.kill('SIGTERM')
          }
          logger.info(`Terminated process for ${viewName}`)
        } catch (error) {
          logger.error(`Failed to terminate process for ${viewName}:`, error)
        }
      }
      // Also try to hide the window using helper if available
      if (win.hwnd && helperAvailable) {
        executeHelper('hide', [win.hwnd]).catch(() => {
          // Silent error - process is being terminated anyway
        })
      }
    }
    embeddedWindows.clear()
    logger.info('Cleanup completed')
  }

  // Assign the real implementation to the manager
  manager = {
    updateBounds,
    embedWindow,
    showEmbeddedWindow,
    hideAllWindows,
    cleanup
  }
}

// Export the manager as a default export
export default manager
