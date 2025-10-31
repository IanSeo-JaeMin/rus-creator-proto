import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  embedWindow: (args: { viewName: string; appPath: string }) =>
    ipcRenderer.invoke('app:embed-window', args),
  updateGeometry: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.send('app:update-geometry', bounds),
  hideAllWindows: () => ipcRenderer.invoke('app:hide-all-windows'),
  checkExecutable: (args: { category: string; submenu: string }) =>
    ipcRenderer.invoke('app:check-executable', args),
  getConfig: () => ipcRenderer.invoke('app:get-config'),
  setDownloadPath: (path: string | null) => ipcRenderer.invoke('app:set-download-path', path),
  selectFolder: () => ipcRenderer.invoke('app:select-folder'),
  selectFile: () => ipcRenderer.invoke('app:select-file'),
  setReconPath: (args: { submenu: string; path: string }) =>
    ipcRenderer.invoke('app:set-recon-path', args),
  setDeformationPath: (args: { submenu: string; path: string }) =>
    ipcRenderer.invoke('app:set-deformation-path', args),
  resetConfig: () => ipcRenderer.invoke('app:reset-config'),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('app:show-item-in-folder', filePath),
  cancelDownload: (downloadId: string) => ipcRenderer.invoke('app:cancel-download', downloadId),
  // BrowserView APIs
  createBrowserView: (args: { viewName: string; url: string }) =>
    ipcRenderer.invoke('app:create-browser-view', args),
  showBrowserView: (args: { viewName: string }) =>
    ipcRenderer.invoke('app:show-browser-view', args),
  hideBrowserView: (args: { viewName: string }) =>
    ipcRenderer.invoke('app:hide-browser-view', args),
  getBrowserViewURL: (args: { viewName: string }) =>
    ipcRenderer.invoke('app:get-browser-view-url', args)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
