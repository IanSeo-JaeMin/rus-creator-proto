import { app, shell, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, statSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import windowManager from './windowManager'
import browserViewManager from './browserViewManager'
import { logger } from './logger'

interface AppConfig {
  downloadPath: string | null
  reconPaths: Record<string, string>
  deformationPaths: Record<string, string>
  modeling3dPath: string | null
}

const defaultConfig: AppConfig = {
  downloadPath: null,
  reconPaths: {},
  deformationPaths: {},
  modeling3dPath: null
}

let appConfig: AppConfig = { ...defaultConfig }

// Track active downloads for cancellation
const activeDownloads = new Map<string, Electron.DownloadItem>()

// Get config file path
function getConfigPath(): string {
  return join(app.getPath('userData'), 'rus-creator-config.json')
}

// Load configuration from file
function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  try {
    if (existsSync(configPath)) {
      const data = readFileSync(configPath, 'utf-8')
      logger.debug('Loading config from:', configPath)
      appConfig = { ...defaultConfig, ...JSON.parse(data) }
      logger.info('Configuration loaded successfully')
    } else {
      logger.info('No config file found, using defaults')
    }
  } catch (error) {
    logger.error('Failed to load config:', error)
  }
  return appConfig
}

// Save configuration to file
function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save config:', error)
  }
}

// Get app installation path
function getAppInstallPath(): string {
  if (is.dev) {
    return join(__dirname, '../../')
  } else {
    let appPath = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath()
    if (appPath.includes('resources') || appPath.endsWith('app')) {
      appPath = join(appPath, '..')
    }
    return appPath
  }
}

// Initialize required directories (external, downloads, and subdirectories)
function initializeDirectories(): void {
  const appPath = getAppInstallPath()
  const reconSubmenus = ['Stomach', 'Kidney', 'Lung', 'Liver', 'Colon']
  const deformationSubmenus = ['Pneumo Editor', 'hu3D Maker']

  // Create downloads folder
  const downloadsPath = join(appPath, 'downloads')
  if (!existsSync(downloadsPath)) {
    mkdirSync(downloadsPath, { recursive: true })
    logger.info(`Created downloads directory: ${downloadsPath}`)
  }

  // Create external folder structure
  const externalPath = join(appPath, 'external')
  if (!existsSync(externalPath)) {
    mkdirSync(externalPath, { recursive: true })
    logger.info(`Created external directory: ${externalPath}`)
  }

  // Create recon subdirectories
  const reconPath = join(externalPath, 'recon')
  if (!existsSync(reconPath)) {
    mkdirSync(reconPath, { recursive: true })
    logger.info(`Created recon directory: ${reconPath}`)
  }

  for (const submenu of reconSubmenus) {
    const submenuPath = join(reconPath, submenu)
    if (!existsSync(submenuPath)) {
      mkdirSync(submenuPath, { recursive: true })
      logger.info(`Created recon subdirectory: ${submenuPath}`)
    }
  }

  // Create deformation subdirectories
  const deformationPath = join(externalPath, 'deformation')
  if (!existsSync(deformationPath)) {
    mkdirSync(deformationPath, { recursive: true })
    logger.info(`Created deformation directory: ${deformationPath}`)
  }

  for (const submenu of deformationSubmenus) {
    const folderName = submenu.toLowerCase().replace(/\s+/g, '-')
    const submenuPath = join(deformationPath, folderName)
    if (!existsSync(submenuPath)) {
      mkdirSync(submenuPath, { recursive: true })
      logger.info(`Created deformation subdirectory: ${submenuPath}`)
    }
  }
}

// Get download path
function getDownloadPath(): string {
  if (appConfig.downloadPath) {
    return appConfig.downloadPath
  }

  // Default: downloads folder in executable directory
  const appPath = getAppInstallPath()
  const downloadsPath = join(appPath, 'downloads')

  // Create directory if it doesn't exist
  if (!existsSync(downloadsPath)) {
    mkdirSync(downloadsPath, { recursive: true })
  }

  return downloadsPath
}

function createWindow(): void {
  logger.info('Creating browser window...')

  // Get the primary display size
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  logger.debug(`Display size: ${width}x${height}`)

  // Get preload script path
  const preloadPath = join(__dirname, '../preload/index.js')
  logger.debug(`Preload script path: ${preloadPath}`)
  logger.debug(`Preload script exists: ${existsSync(preloadPath)}`)

  // Get renderer HTML path
  const rendererPath = join(__dirname, '../renderer/index.html')
  logger.debug(`Renderer HTML path: ${rendererPath}`)
  logger.debug(`Renderer HTML exists: ${existsSync(rendererPath)}`)

  // Create the browser window.
  logger.info('Initializing BrowserWindow...')
  const mainWindow = new BrowserWindow({
    width,
    height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : { icon }),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      webviewTag: false, // BrowserView 사용하므로 webviewTag 불필요
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  logger.info('BrowserWindow created, ID:', mainWindow.id)

  // Set main window for BrowserView manager
  browserViewManager.setMainWindow(mainWindow)

  // Enable DevTools for debugging (always enabled for now)
  if (!is.dev) {
    mainWindow.webContents.openDevTools()
    logger.info('DevTools opened (production mode)')
  }

  mainWindow.on('ready-to-show', () => {
    logger.info('Window ready to show, displaying window...')
    mainWindow.show()
    logger.info('Window shown successfully')
  })

  mainWindow.on('show', () => {
    logger.info('Window show event fired')
  })

  mainWindow.on('closed', () => {
    logger.info('Window closed')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Set download path for session
  const downloadPath = getDownloadPath()
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    item.setSavePath(join(downloadPath, item.getFilename()))

    // Generate unique ID for this download
    const downloadId = `${item.getFilename()}-${Date.now()}`
    activeDownloads.set(downloadId, item)

    // Monitor download progress
    item.on('updated', (_event, state) => {
      if (state === 'interrupted') {
        console.log('Download interrupted for:', item.getFilename())
        activeDownloads.delete(downloadId)
        mainWindow.webContents.send('download-status', {
          filename: item.getFilename(),
          status: 'interrupted',
          downloadId
        })
      } else if (state === 'progressing') {
        const receivedBytes = item.getReceivedBytes()
        const totalBytes = item.getTotalBytes()
        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0

        mainWindow.webContents.send('download-status', {
          filename: item.getFilename(),
          status: 'progressing',
          receivedBytes,
          totalBytes,
          progress: Math.round(progress),
          downloadId
        })
      }
    })

    // Monitor download completion
    item.once('done', (_event, state) => {
      activeDownloads.delete(downloadId)

      if (state === 'completed') {
        console.log('Download completed:', item.getFilename())
        const filePath = item.getSavePath()
        mainWindow.webContents.send('download-status', {
          filename: item.getFilename(),
          status: 'completed',
          filePath
        })
      } else if (state === 'cancelled') {
        console.log('Download cancelled:', item.getFilename())
        mainWindow.webContents.send('download-status', {
          filename: item.getFilename(),
          status: 'cancelled'
        })
      } else {
        console.log('Download failed:', item.getFilename(), state)
        mainWindow.webContents.send('download-status', {
          filename: item.getFilename(),
          status: 'failed'
        })
      }
    })
  })

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Render process crashed:', details)
    logger.error('Reason:', details.reason, 'Exit code:', details.exitCode)
  })

  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Renderer process became unresponsive')
  })

  mainWindow.webContents.on('responsive', () => {
    logger.info('Renderer process became responsive again')
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error(`Failed to load page: ${errorCode} - ${errorDescription}`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Page loaded successfully')
  })

  mainWindow.webContents.on('dom-ready', () => {
    logger.info('DOM ready')
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    logger.info(`Loading URL (dev mode): ${url}`)
    mainWindow.loadURL(url).catch((error) => {
      logger.error('Failed to load URL:', error)
    })
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    logger.info(`Loading file: ${htmlPath}`)
    logger.debug(`File exists: ${existsSync(htmlPath)}`)
    mainWindow.loadFile(htmlPath).catch((error) => {
      logger.error('Failed to load file:', error)
    })
  }

  // --- Window Embedding IPC ---
  const parentHwnd = mainWindow.getNativeWindowHandle()

  ipcMain.on('app:update-geometry', (_event, bounds) => {
    windowManager.updateBounds(bounds)
    // Also update BrowserView bounds
    browserViewManager.updateBounds(bounds)
  })

  ipcMain.handle('app:hide-all-windows', async () => {
    try {
      await windowManager.hideAllWindows()
      
      // Bring Electron window to front to ensure menu is clickable
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus()
        mainWindow.show()
        logger.info('Electron window brought to front')
      }
      
      return { success: true, message: 'All embedded windows hidden.' }
    } catch (error) {
      logger.error('Failed to hide all windows:', error)
      return { success: false, message: `Failed to hide all windows: ${error}` }
    }
  })

  ipcMain.handle('app:embed-window', async (_event, { viewName, appPath }) => {
    try {
      logger.info(`IPC: embed-window request for ${viewName}, path: ${appPath}`)

      // Verify file exists
      if (!existsSync(appPath)) {
        logger.error(`Executable file does not exist: ${appPath}`)
        return { success: false, message: `Executable file not found: ${appPath}` }
      }

      if (process.platform === 'win32') {
        logger.info(`Calling windowManager.embedWindow for ${viewName}`)
        logger.info(`parentHwnd type: ${typeof parentHwnd}, value: ${parentHwnd?.toString('hex')}`)
        logger.info(`windowManager type: ${typeof windowManager}`)
        logger.info(`windowManager.embedWindow type: ${typeof windowManager.embedWindow}`)
        
        try {
          await windowManager.embedWindow(viewName, appPath, parentHwnd)
          logger.info(`windowManager.embedWindow call completed for ${viewName}`)
        } catch (error) {
          logger.error(`Error calling windowManager.embedWindow:`, error)
          throw error
        }
        
        return { success: true, message: `Embedding process started for ${viewName}.` }
      }
      return { success: false, message: 'Window embedding is only supported on Windows.' }
    } catch (error) {
      logger.error('Failed to embed window:', error)
      return { success: false, message: `Failed to embed window for ${viewName}: ${error}` }
    }
  })

  ipcMain.handle('app:check-executable', async (_event, { category, submenu }) => {
    try {
      // Check if path is set in config
      let executablePath: string | null = null

      if (category === 'recon' && appConfig.reconPaths[submenu]) {
        executablePath = appConfig.reconPaths[submenu]
      } else if (category === 'deformation' && appConfig.deformationPaths[submenu]) {
        executablePath = appConfig.deformationPaths[submenu]
      }

      // If custom path is set, check if it exists
      if (executablePath) {
        if (existsSync(executablePath)) {
          return { exists: true, path: executablePath }
        }
        return { exists: false, path: null }
      }

      // Default behavior: check in external folder
      // Get the directory where the app is running
      let appPath: string

      if (is.dev) {
        // Development: use project root (go up from out/main directory)
        appPath = join(__dirname, '../../')
      } else {
        // Production: use executable directory
        appPath = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath()
        // If app.getAppPath() returns resources/app or app, go up one level
        if (appPath.includes('resources') || appPath.endsWith('app')) {
          appPath = join(appPath, '..')
        }
      }

      const externalPath = join(appPath, 'external', category, submenu)

      if (!existsSync(externalPath)) {
        return { exists: false, path: null }
      }

      // Find executable files in the directory
      const files = readdirSync(externalPath)
      const executableFiles = files.filter((file) => {
        const fullPath = join(externalPath, file)
        const stats = statSync(fullPath)

        // Check if it's a file (not directory) and has executable extension
        if (stats.isFile()) {
          const ext = file.substring(file.lastIndexOf('.')).toLowerCase()
          return ['.exe', '.bat', '.cmd', '.ps1'].includes(ext)
        }
        return false
      })

      if (executableFiles.length > 0) {
        const executablePath = join(externalPath, executableFiles[0])
        return { exists: true, path: executablePath }
      }

      return { exists: false, path: null }
    } catch (error) {
      console.error('Failed to check executable:', error)
      return { exists: false, path: null }
    }
  })

  // Settings IPC handlers
  ipcMain.handle('app:get-config', async () => {
    return appConfig
  })

  ipcMain.handle('app:set-download-path', async (_event, path: string | null) => {
    appConfig.downloadPath = path
    saveConfig(appConfig)

    // Update download path for current session
    const newDownloadPath = getDownloadPath()
    // Remove old listeners and add new one
    mainWindow.webContents.session.removeAllListeners('will-download')
    mainWindow.webContents.session.on('will-download', (_event, item) => {
      item.setSavePath(join(newDownloadPath, item.getFilename()))

      // Monitor download progress
      item.on('updated', (_event, state) => {
        if (state === 'interrupted') {
          mainWindow.webContents.send('download-status', {
            filename: item.getFilename(),
            status: 'interrupted'
          })
        } else if (state === 'progressing') {
          const receivedBytes = item.getReceivedBytes()
          const totalBytes = item.getTotalBytes()
          const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0

          mainWindow.webContents.send('download-status', {
            filename: item.getFilename(),
            status: 'progressing',
            receivedBytes,
            totalBytes,
            progress: Math.round(progress)
          })
        }
      })

      // Monitor download completion
      item.once('done', (_event, state) => {
        if (state === 'completed') {
          const filePath = item.getSavePath()
          mainWindow.webContents.send('download-status', {
            filename: item.getFilename(),
            status: 'completed',
            filePath
          })
        } else if (state === 'cancelled') {
          mainWindow.webContents.send('download-status', {
            filename: item.getFilename(),
            status: 'cancelled'
          })
        } else {
          mainWindow.webContents.send('download-status', {
            filename: item.getFilename(),
            status: 'failed'
          })
        }
      })
    })

    return { success: true }
  })

  ipcMain.handle('app:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] }
    }
    return { success: false, path: null }
  })

  ipcMain.handle('app:select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Executable Files', extensions: ['exe', 'bat', 'cmd', 'ps1'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] }
    }
    return { success: false, path: null }
  })

  ipcMain.handle('app:set-recon-path', async (_event, { submenu, path }) => {
    appConfig.reconPaths[submenu] = path
    saveConfig(appConfig)
    return { success: true }
  })

  ipcMain.handle('app:set-deformation-path', async (_event, { submenu, path }) => {
    appConfig.deformationPaths[submenu] = path
    saveConfig(appConfig)
    return { success: true }
  })

  ipcMain.handle('app:set-3d-modeling-path', async (_event, path: string | null) => {
    appConfig.modeling3dPath = path
    saveConfig(appConfig)
    return { success: true }
  })

  ipcMain.handle('app:reset-config', async () => {
    appConfig = { ...defaultConfig }
    saveConfig(appConfig)
    return { success: true }
  })

  ipcMain.handle('app:show-item-in-folder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      console.error('Failed to show item in folder:', error)
      return { success: false }
    }
  })

  ipcMain.handle('app:cancel-download', async (_event, downloadId: string) => {
    const downloadItem = activeDownloads.get(downloadId)
    if (downloadItem) {
      downloadItem.cancel()
      activeDownloads.delete(downloadId)
      return { success: true }
    }
    return { success: false, message: 'Download not found' }
  })

  // --- BrowserView IPC ---
  ipcMain.handle('app:create-browser-view', async (_event, { viewName, url }) => {
    try {
      const success = browserViewManager.createBrowserView(viewName, url)
      return { success, message: success ? `BrowserView created for ${viewName}` : `Failed to create BrowserView for ${viewName}` }
    } catch (error) {
      logger.error(`Failed to create BrowserView for ${viewName}:`, error)
      return { success: false, message: `Error: ${error}` }
    }
  })

  ipcMain.handle('app:show-browser-view', async (_event, { viewName }) => {
    try {
      const success = browserViewManager.showBrowserView(viewName)
      return { success, message: success ? `BrowserView shown for ${viewName}` : `Failed to show BrowserView for ${viewName}` }
    } catch (error) {
      logger.error(`Failed to show BrowserView for ${viewName}:`, error)
      return { success: false, message: `Error: ${error}` }
    }
  })

  ipcMain.handle('app:hide-browser-view', async (_event, { viewName }) => {
    try {
      const success = browserViewManager.hideBrowserView(viewName)
      return { success, message: success ? `BrowserView hidden for ${viewName}` : `Failed to hide BrowserView for ${viewName}` }
    } catch (error) {
      logger.error(`Failed to hide BrowserView for ${viewName}:`, error)
      return { success: false, message: `Error: ${error}` }
    }
  })

  ipcMain.handle('app:get-browser-view-url', async (_event, { viewName }) => {
    try {
      const url = browserViewManager.getBrowserViewURL(viewName)
      return { success: true, url }
    } catch (error) {
      logger.error(`Failed to get URL for BrowserView ${viewName}:`, error)
      return { success: false, url: null }
    }
  })
  // --------------------------
}

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  logger.info('=== Application Starting ===')
  logger.info(`Platform: ${process.platform}`)
  logger.info(`Architecture: ${process.arch}`)
  logger.info(`Electron version: ${process.versions.electron}`)
  logger.info(`Node version: ${process.versions.node}`)
  logger.info(`App version: ${app.getVersion()}`)
  logger.info(`User data path: ${app.getPath('userData')}`)
  logger.info(`Log file: ${logger.getLogPath()}`)

  // Load configuration
  loadConfig()

  // Initialize required directories
  initializeDirectories()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  logger.debug('App user model ID set')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    logger.debug('Browser window created event, ID:', window.id)
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => {
    logger.debug('IPC ping received')
    console.log('pong')
  })

  createWindow()

  logger.info('=== Application Initialization Complete ===')

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform === 'win32') {
    windowManager.cleanup()
  }
  browserViewManager.cleanup()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
