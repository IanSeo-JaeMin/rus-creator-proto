import type { ChildProcess } from 'child_process'
import { logger } from './logger'
import path from 'path'
import { app } from 'electron'
import { execSync } from 'child_process'
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
      // In packaged app, helper should be in resources/helper
      helperPath = path.join(process.resourcesPath, 'helper', 'Embedder.exe')
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
      return null
    }
  }

  // Execute helper EXE and return output
  function executeHelper(
    command: string,
    args: string[]
  ): Promise<{ success: boolean; output: string; hwnd?: string }> {
    return new Promise((resolve) => {
      const helperPath = getHelperPath()
      if (!helperPath) {
        resolve({ success: false, output: 'Helper EXE not found' })
        return
      }

      const fullArgs = [command, ...args]
      logger.info(`Executing helper: ${helperPath} ${fullArgs.join(' ')}`)

      try {
        const output = execSync(`"${helperPath}" ${fullArgs.map((a) => `"${a}"`).join(' ')}`, {
          encoding: 'utf-8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        const lines = output.trim().split('\n')
        const lastLine = lines[lines.length - 1]

        if (lastLine.startsWith('SUCCESS')) {
          const parts = lastLine.split(':')
          if (parts.length > 1) {
            resolve({ success: true, output: output, hwnd: parts[1] })
          } else {
            resolve({ success: true, output: output })
          }
        } else {
          resolve({ success: false, output: output })
        }
      } catch (error: any) {
        const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message
        logger.error(`Helper execution failed: ${errorOutput}`)
        resolve({ success: false, output: errorOutput })
      }
    })
  }

  // Window title search patterns for different views
  const windowTitlePatterns: Record<string, string[]> = {
    Stomach: ['Stomach', 'Service', 'Batch'],
    Kidney: ['Kidney', 'Service', 'Batch'],
    Lung: ['Lung', 'Service', 'Batch'],
    Liver: ['Liver', 'Service', 'Batch'],
    Colon: ['Colon', 'Service', 'Batch'],
    Recon: ['Recon', 'Application'],
    '3D Modeling': ['Blender'],
    Pneumo: ['Pneumo', 'App'],
    'Pneumo Editor': ['Pneumo', 'Editor'],
    'hu3D Maker': ['hu3D', 'Maker']
  }

  // Module State
  let latestBounds = { x: 0, y: 0, width: 800, height: 600 }
  const embeddedWindows = new Map<
    string,
    { process: ChildProcess; hwnd: string | null; helperAvailable: boolean }
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

      // Execute helper with embed command
      const result = await executeHelper('embed', [
        parentHwndInt.toString(),
        appPath,
        ...searchTerms
      ])

      if (!result.success) {
        logger.error(`Failed to embed window for ${viewName}: ${result.output}`)
        return
      }

      // Extract HWND from result
      const childHwnd = result.hwnd || null

      if (!childHwnd) {
        logger.error(`Failed to get child HWND for ${viewName}`)
        return
      }

      logger.info(`Window embedded successfully for ${viewName}, HWND: ${childHwnd}`)

      // Store the embedded window info
      // Note: We don't store the process here since helper spawns it
      embeddedWindows.set(viewName, {
        process: null as any, // Process is managed by helper
        hwnd: childHwnd,
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
        await executeHelper('hide', [win.hwnd])
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
    logger.info('Hiding all embedded windows...')
    for (const [viewName, win] of embeddedWindows.entries()) {
      if (win.hwnd) {
        await executeHelper('hide', [win.hwnd])
        logger.info(`Hidden window for ${viewName}`)
      }
    }
  }

  function cleanup(): void {
    logger.info('Cleaning up embedded windows...')
    for (const [viewName, win] of embeddedWindows.entries()) {
      if (win.process && !win.process.killed) {
        try {
          win.process.kill()
          logger.info(`Killed process for ${viewName}`)
        } catch (error) {
          logger.error(`Failed to kill process for ${viewName}:`, error)
        }
      }
    }
    embeddedWindows.clear()
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
