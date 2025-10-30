import { ElectronAPI } from '@electron-toolkit/preload'

interface AppConfig {
  downloadPath: string | null
  reconPaths: Record<string, string>
  deformationPaths: Record<string, string>
}

interface ICustomAPI {
  embedWindow: (args: {
    viewName: string
    appPath: string
  }) => Promise<{ success: boolean; message: string }>
  updateGeometry: (bounds: { x: number; y: number; width: number; height: number }) => void
  checkExecutable: (args: {
    category: string
    submenu: string
  }) => Promise<{ exists: boolean; path: string | null }>
  getConfig: () => Promise<AppConfig>
  setDownloadPath: (path: string | null) => Promise<{ success: boolean }>
  selectFolder: () => Promise<{ success: boolean; path: string | null }>
  selectFile: () => Promise<{ success: boolean; path: string | null }>
  setReconPath: (args: { submenu: string; path: string }) => Promise<{ success: boolean }>
  setDeformationPath: (args: { submenu: string; path: string }) => Promise<{ success: boolean }>
  resetConfig: () => Promise<{ success: boolean }>
  showItemInFolder: (filePath: string) => Promise<{ success: boolean }>
  cancelDownload: (downloadId: string) => Promise<{ success: boolean; message?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ICustomAPI
  }
}
