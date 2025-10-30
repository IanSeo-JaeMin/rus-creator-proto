import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Webview from './components/Webview'
import Settings from './components/Settings'

const menuItems = ['WorkList', 'Dicom Editor', 'Recon', '3D Modeling', 'Deformation', 'Settings']

// RECON 하위 메뉴
const reconSubmenus = ['Stomach', 'Kidney', 'Lung', 'Liver', 'Colon']

// Deformation 하위 메뉴
const deformationSubmenus = ['Pneumo Editor', 'hu3D Maker']

// Placeholder URLs for web-based views
const viewUrls: Record<string, string> = {
  WorkList: 'http://192.168.16.10:30020',
  'Dicom Editor': 'http://192.168.16.21:5470'
}

// Placeholder paths for native applications
const nativeAppPaths: Record<string, string> = {
  '3D Modeling': 'C:\\Program Files\\Blender Foundation\\Blender 3.0\\blender.exe'
}

// Executable paths for RECON submenus
interface SubmenuExecutable {
  exists: boolean
  path: string | null
}

interface DownloadStatus {
  filename: string
  status: 'progressing' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
  progress?: number
  receivedBytes?: number
  totalBytes?: number
  filePath?: string
  downloadId?: string
}

function App(): React.ReactElement {
  const [isMenuVisible, setIsMenuVisible] = useState(true)
  const [activeView, setActiveView] = useState('WorkList')
  const [isReconExpanded, setIsReconExpanded] = useState(false)
  const [isDeformationExpanded, setIsDeformationExpanded] = useState(false)
  const [reconSubmenuStatus, setReconSubmenuStatus] = useState<Record<string, SubmenuExecutable>>(
    {}
  )
  const [deformationSubmenuStatus, setDeformationSubmenuStatus] = useState<
    Record<string, SubmenuExecutable>
  >({})
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleCloseSettings = (): void => {
    setActiveView('WorkList')
  }

  const handleConfigChange = (): void => {
    // Reload executable status when config changes
    checkReconSubmenus()
    checkDeformationSubmenus()
  }

  // Check executable files for RECON submenus
  const checkReconSubmenus = async (): Promise<void> => {
    const status: Record<string, SubmenuExecutable> = {}

    for (const submenu of reconSubmenus) {
      try {
        const result = await window.api.checkExecutable({ category: 'recon', submenu })
        status[submenu] = result
      } catch (error) {
        console.error(`Failed to check executable for ${submenu}:`, error)
        status[submenu] = { exists: false, path: null }
      }
    }

    setReconSubmenuStatus(status)
  }

  // Check executable files on mount
  useEffect(() => {
    checkReconSubmenus()
  }, [])

  // Listen for download status
  useEffect(() => {
    const handleDownloadStatus = (_event: unknown, status: DownloadStatus): void => {
      setDownloadStatus(status)

      // Auto-hide completed/failed status after 5 seconds
      if (status.status === 'completed' || status.status === 'failed') {
        setTimeout(() => {
          setDownloadStatus(null)
        }, 5000)
      }
    }

    // Use ipcRenderer.on with proper typing
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on(
        'download-status',
        handleDownloadStatus as (...args: unknown[]) => void
      )

      return () => {
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.removeAllListeners('download-status')
        }
      }
    }
    return () => {}
  }, [])

  // Check executable files for Deformation submenus
  const checkDeformationSubmenus = async (): Promise<void> => {
    const status: Record<string, SubmenuExecutable> = {}

    for (const submenu of deformationSubmenus) {
      try {
        // Convert "Pneumo Editor" to "pneumo-editor", "hu3D Maker" to "hu3d-maker"
        const folderName = submenu.toLowerCase().replace(/\s+/g, '-')
        const result = await window.api.checkExecutable({
          category: 'deformation',
          submenu: folderName
        })
        status[submenu] = result
      } catch (error) {
        console.error(`Failed to check executable for ${submenu}:`, error)
        status[submenu] = { exists: false, path: null }
      }
    }

    setDeformationSubmenuStatus(status)
  }

  // Check executable files on mount
  useEffect(() => {
    checkDeformationSubmenus()
  }, [])

  // Effect for handling native app embedding
  useEffect(() => {
    // Check if it's a RECON submenu
    if (reconSubmenuStatus[activeView]?.exists && reconSubmenuStatus[activeView].path) {
      const appPath = reconSubmenuStatus[activeView].path!
      console.log(`RECON submenu selected: ${activeView}`)
      console.log(`Executable path: ${appPath}`)
      console.log(`Status: exists=${reconSubmenuStatus[activeView].exists}, path=${appPath}`)
      console.log(`Requesting embed...`)
      
      window.api
        .embedWindow({ viewName: activeView, appPath })
        .then((result) => {
          console.log('Embed request result:', result)
          if (!result.success) {
            console.error('Embed failed:', result.message)
          }
        })
        .catch((error) => {
          console.error('Embed request failed:', error)
        })
      return
    }

    // Check if it's a Deformation submenu
    if (deformationSubmenuStatus[activeView]?.exists && deformationSubmenuStatus[activeView].path) {
      const appPath = deformationSubmenuStatus[activeView].path!
      console.log(`Deformation submenu selected: ${activeView}. Requesting embed...`)
      window.api
        .embedWindow({ viewName: activeView, appPath })
        .then((result) => {
          console.log('Embed request result:', result.message)
        })
        .catch((error) => {
          console.error('Embed request failed:', error)
        })
      return
    }

    // Check if it's a native app path
    const appPath = nativeAppPaths[activeView]
    if (appPath) {
      console.log(`Native view selected: ${activeView}. Requesting embed...`)
      window.api
        .embedWindow({ viewName: activeView, appPath })
        .then((result) => {
          console.log('Embed request result:', result.message)
        })
        .catch((error) => {
          console.error('Embed request failed:', error)
        })
    }
  }, [activeView, reconSubmenuStatus, deformationSubmenuStatus])

  // Effect for observing content area size and position
  useLayoutEffect(() => {
    const contentEl = contentRef.current
    if (!contentEl) return

    const resizeObserver = new ResizeObserver(() => {
      const bounds = contentEl.getBoundingClientRect()
      window.api.updateGeometry({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      })
    })

    resizeObserver.observe(contentEl)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const toggleMenu = (): void => {
    setIsMenuVisible(!isMenuVisible)
  }

  const appContainerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh'
  }

  const sideMenuStyle: React.CSSProperties = {
    width: '200px',
    borderRight: '1px solid #ccc',
    padding: '10px',
    transition: 'width 0.3s'
  }

  const mainContentStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px',
    display: 'flex',
    flexDirection: 'column'
  }

  const menuItemButtonStyle: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: '1px solid #ddd',
    padding: '8px',
    cursor: 'pointer',
    marginBottom: '5px'
  }

  const contentDisplayStyle: React.CSSProperties = {
    marginTop: '20px',
    flex: 1, // Make content area fill available space
    background: '#f0f0f0',
    position: 'relative'
  }

  const handleMenuClick = (item: string): void => {
    if (item === 'Recon') {
      setIsReconExpanded(!isReconExpanded)
      setIsDeformationExpanded(false)
    } else if (item === 'Deformation') {
      setIsDeformationExpanded(!isDeformationExpanded)
      setIsReconExpanded(false)
    } else {
      setActiveView(item)
      setIsReconExpanded(false)
      setIsDeformationExpanded(false)

      // Reload executable status when switching from Settings
      if (item !== 'Settings') {
        checkReconSubmenus()
        checkDeformationSubmenus()
      }
    }
  }

  const handleSubmenuClick = (submenu: string): void => {
    setActiveView(submenu)
  }

  const renderContent = (): React.ReactElement => {
    if (activeView === 'Settings') {
      return <Settings onClose={handleCloseSettings} onConfigChange={handleConfigChange} />
    }

    if (viewUrls[activeView]) {
      return <Webview src={viewUrls[activeView]} />
    }

    // Check if it's a RECON submenu that doesn't have an executable
    if (reconSubmenuStatus[activeView] && !reconSubmenuStatus[activeView].exists) {
      return (
        <div style={{ width: '100%', height: '100%', padding: '20px' }}>
          <h1>{activeView}</h1>
          <p>이 메뉴는 아직 실행 파일이 없습니다.</p>
          <p style={{ fontSize: '14px', color: '#666' }}>
            실행 파일을 external/recon/{activeView.toLowerCase()}/ 폴더에 추가해주세요.
          </p>
        </div>
      )
    }

    // Check if it's a Deformation submenu that doesn't have an executable
    if (deformationSubmenuStatus[activeView] && !deformationSubmenuStatus[activeView].exists) {
      const folderName = activeView.toLowerCase().replace(/\s+/g, '-')
      return (
        <div style={{ width: '100%', height: '100%', padding: '20px' }}>
          <h1>{activeView}</h1>
          <p>이 메뉴는 아직 실행 파일이 없습니다.</p>
          <p style={{ fontSize: '14px', color: '#666' }}>
            실행 파일을 external/deformation/{folderName}/ 폴더에 추가해주세요.
          </p>
        </div>
      )
    }

    // For native apps, render a container. The main process will embed the window.
    return (
      <div id="native-view-container" style={{ width: '100%', height: '100%' }}>
        <h1>{activeView}</h1>
        <p>Attempting to embed the native application...</p>
      </div>
    )
  }

  const submenuButtonStyle: React.CSSProperties = {
    ...menuItemButtonStyle,
    marginLeft: '20px',
    fontSize: '14px',
    opacity: 0.8
  }

  const downloadBarStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px 20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    minWidth: '300px',
    maxWidth: '400px',
    zIndex: 9999
  }

  const downloadTitleStyle: React.CSSProperties = {
    fontWeight: 'bold',
    marginBottom: '8px',
    fontSize: '14px'
  }

  const downloadProgressBarStyle: React.CSSProperties = {
    width: '100%',
    height: '6px',
    backgroundColor: '#e0e0e0',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px'
  }

  const downloadProgressFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: '#0066cc',
    transition: 'width 0.3s ease'
  }

  const downloadCloseButtonStyle: React.CSSProperties = {
    float: 'right',
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    marginTop: '-5px'
  }

  return (
    <div style={appContainerStyle}>
      {/* Download Status Bar */}
      {downloadStatus && (
        <div style={downloadBarStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={downloadTitleStyle}>
              {downloadStatus.status === 'progressing' && '다운로드 중...'}
              {downloadStatus.status === 'completed' && '✓ 다운로드 완료'}
              {downloadStatus.status === 'failed' && '✗ 다운로드 실패'}
              {downloadStatus.status === 'cancelled' && '다운로드 취소됨'}
              {downloadStatus.status === 'interrupted' && '다운로드 중단됨'}
            </div>
            <button
              style={downloadCloseButtonStyle}
              onClick={() => setDownloadStatus(null)}
              title="닫기"
            >
              ×
            </button>
          </div>
          <div
            style={{ fontSize: '13px', color: '#666', marginBottom: '8px', wordBreak: 'break-all' }}
          >
            {downloadStatus.filename}
          </div>
          {downloadStatus.status === 'progressing' && downloadStatus.progress !== undefined && (
            <>
              <div style={downloadProgressBarStyle}>
                <div
                  style={{
                    ...downloadProgressFillStyle,
                    width: `${downloadStatus.progress}%`
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {downloadStatus.progress}%
                {downloadStatus.receivedBytes &&
                  downloadStatus.totalBytes &&
                  ` (${(downloadStatus.receivedBytes / 1024 / 1024).toFixed(2)}MB / ${(downloadStatus.totalBytes / 1024 / 1024).toFixed(2)}MB)`}
              </div>
              {downloadStatus.downloadId && (
                <button
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    marginTop: '8px'
                  }}
                  onClick={async () => {
                    if (downloadStatus.downloadId) {
                      try {
                        await window.api.cancelDownload(downloadStatus.downloadId)
                      } catch (error) {
                        console.error('Failed to cancel download:', error)
                      }
                    }
                  }}
                >
                  취소
                </button>
              )}
            </>
          )}
          {downloadStatus.status === 'completed' && downloadStatus.filePath && (
            <button
              style={{
                padding: '6px 12px',
                backgroundColor: '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '5px'
              }}
              onClick={async () => {
                // Open folder with downloaded file
                const path = downloadStatus.filePath
                if (path) {
                  try {
                    await window.api.showItemInFolder(path)
                  } catch (error) {
                    console.error('Failed to open folder:', error)
                  }
                }
              }}
            >
              폴더 열기
            </button>
          )}
        </div>
      )}

      {isMenuVisible && (
        <nav style={sideMenuStyle}>
          <h2>RUS Creator</h2>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
            {menuItems.map((item) => (
              <li key={item}>
                <button
                  onClick={(): void => handleMenuClick(item)}
                  style={{
                    ...menuItemButtonStyle,
                    fontWeight: activeView === item ? 'bold' : 'normal'
                  }}
                >
                  {item}{' '}
                  {(item === 'Recon' && (isReconExpanded ? '▼' : '▶')) ||
                    (item === 'Deformation' && (isDeformationExpanded ? '▼' : '▶'))}
                </button>
                {item === 'Recon' && isReconExpanded && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {reconSubmenus.map((submenu) => {
                      const status = reconSubmenuStatus[submenu]
                      const isActive = activeView === submenu
                      const isEnabled = status?.exists ?? false

                      return (
                        <li key={submenu}>
                          <button
                            onClick={(): void => handleSubmenuClick(submenu)}
                            disabled={!isEnabled}
                            style={{
                              ...submenuButtonStyle,
                              fontWeight: isActive ? 'bold' : 'normal',
                              cursor: isEnabled ? 'pointer' : 'not-allowed',
                              opacity: isEnabled ? (isActive ? 1 : 0.8) : 0.4,
                              color: isActive ? '#0066cc' : 'inherit'
                            }}
                          >
                            {submenu} {isEnabled ? '✓' : ''}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {item === 'Deformation' && isDeformationExpanded && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {deformationSubmenus.map((submenu) => {
                      const status = deformationSubmenuStatus[submenu]
                      const isActive = activeView === submenu
                      const isEnabled = status?.exists ?? false

                      return (
                        <li key={submenu}>
                          <button
                            onClick={(): void => handleSubmenuClick(submenu)}
                            disabled={!isEnabled}
                            style={{
                              ...submenuButtonStyle,
                              fontWeight: isActive ? 'bold' : 'normal',
                              cursor: isEnabled ? 'pointer' : 'not-allowed',
                              opacity: isEnabled ? (isActive ? 1 : 0.8) : 0.4,
                              color: isActive ? '#0066cc' : 'inherit'
                            }}
                          >
                            {submenu} {isEnabled ? '✓' : ''}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
      <main style={mainContentStyle}>
        <button onClick={toggleMenu}>{isMenuVisible ? 'Hide Menu' : 'Show Menu'}</button>
        <div ref={contentRef} style={contentDisplayStyle}>
          {renderContent()}
        </div>
      </main>
    </div>
  )
}

export default App
