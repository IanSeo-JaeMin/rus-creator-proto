import { BrowserView, BrowserWindow } from 'electron'
import { logger } from './logger'

interface BrowserViewInfo {
  browserView: BrowserView
  viewName: string
  url: string
  isVisible: boolean
}

class BrowserViewManager {
  private browserViews: Map<string, BrowserViewInfo> = new Map()
  private mainWindow: BrowserWindow | null = null
  private currentBounds: { x: number; y: number; width: number; height: number } = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  createBrowserView(viewName: string, url: string): boolean {
    try {
      // 이미 존재하면 생성하지 않음
      if (this.browserViews.has(viewName)) {
        logger.debug(`BrowserView for ${viewName} already exists`)
        return true
      }

      if (!this.mainWindow) {
        logger.error('Main window not set for BrowserView manager')
        return false
      }

      const browserView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false
        }
      })

      // Load URL
      browserView.webContents.loadURL(url)

      // Track navigation events for logging
      browserView.webContents.on('did-finish-load', () => {
        const currentUrl = browserView.webContents.getURL()
        logger.debug(`BrowserView ${viewName} finished loading: ${currentUrl}`)
      })

      browserView.webContents.on('did-navigate', (_event, navigationUrl) => {
        logger.debug(`BrowserView ${viewName} navigated to: ${navigationUrl}`)
      })

      this.browserViews.set(viewName, {
        browserView,
        viewName,
        url,
        isVisible: false
      })

      logger.info(`BrowserView created for ${viewName} with URL: ${url}`)
      return true
    } catch (error) {
      logger.error(`Failed to create BrowserView for ${viewName}:`, error)
      return false
    }
  }

  showBrowserView(viewName: string): boolean {
    try {
      if (!this.mainWindow) {
        logger.error('Main window not set for BrowserView manager')
        return false
      }

      const viewInfo = this.browserViews.get(viewName)
      if (!viewInfo) {
        logger.warn(`BrowserView for ${viewName} not found`)
        return false
      }

      // Hide all other browser views
      for (const [key, info] of this.browserViews.entries()) {
        if (key !== viewName && info.isVisible) {
          this.mainWindow.removeBrowserView(info.browserView)
          info.isVisible = false
        }
      }

      // Show the requested browser view
      this.mainWindow.addBrowserView(viewInfo.browserView)
      viewInfo.isVisible = true

      // Update bounds
      this.updateBrowserViewBounds(viewName)

      logger.info(`BrowserView ${viewName} shown`)
      return true
    } catch (error) {
      logger.error(`Failed to show BrowserView for ${viewName}:`, error)
      return false
    }
  }

  hideBrowserView(viewName: string): boolean {
    try {
      if (!this.mainWindow) {
        logger.error('Main window not set for BrowserView manager')
        return false
      }

      const viewInfo = this.browserViews.get(viewName)
      if (!viewInfo || !viewInfo.isVisible) {
        return true // Already hidden
      }

      this.mainWindow.removeBrowserView(viewInfo.browserView)
      viewInfo.isVisible = false

      logger.info(`BrowserView ${viewName} hidden`)
      return true
    } catch (error) {
      logger.error(`Failed to hide BrowserView for ${viewName}:`, error)
      return false
    }
  }

  updateBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.currentBounds = bounds

    // Update bounds for all visible browser views
    for (const [viewName, info] of this.browserViews.entries()) {
      if (info.isVisible) {
        this.updateBrowserViewBounds(viewName)
      }
    }
  }

  private updateBrowserViewBounds(viewName: string): void {
    try {
      const viewInfo = this.browserViews.get(viewName)
      if (!viewInfo || !viewInfo.isVisible || !this.mainWindow) {
        return
      }

      viewInfo.browserView.setBounds({
        x: this.currentBounds.x,
        y: this.currentBounds.y,
        width: this.currentBounds.width,
        height: this.currentBounds.height
      })

      logger.debug(
        `BrowserView ${viewName} bounds updated: ${this.currentBounds.x}, ${this.currentBounds.y}, ${this.currentBounds.width}x${this.currentBounds.height}`
      )
    } catch (error) {
      logger.error(`Failed to update bounds for BrowserView ${viewName}:`, error)
    }
  }

  getBrowserViewURL(viewName: string): string | null {
    try {
      const viewInfo = this.browserViews.get(viewName)
      if (!viewInfo) {
        return null
      }

      return viewInfo.browserView.webContents.getURL()
    } catch (error) {
      logger.error(`Failed to get URL for BrowserView ${viewName}:`, error)
      return null
    }
  }

  cleanup(): void {
    logger.info('Cleaning up BrowserView manager...')

    if (this.mainWindow) {
      // Remove all browser views from main window
      for (const [viewName, info] of this.browserViews.entries()) {
        try {
          if (info.isVisible) {
            this.mainWindow!.removeBrowserView(info.browserView)
          }
          // BrowserView will be automatically destroyed when removed from window
        } catch (error) {
          logger.error(`Error cleaning up BrowserView ${viewName}:`, error)
        }
      }
    }

    this.browserViews.clear()
    this.mainWindow = null
    logger.info('BrowserView manager cleaned up')
  }
}

// Export singleton instance
const browserViewManager = new BrowserViewManager()
export default browserViewManager
