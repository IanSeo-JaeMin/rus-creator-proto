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
  const [isLoading, setIsLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
           // Log activeView change
           console.log(`[App] === activeView changed ===`)
           console.log(`[App] New activeView: ${activeView}`)
           console.log(`[App] Is WorkList: ${activeView === 'WorkList'}`)
           console.log(`[App] Is webview: ${!!viewUrls[activeView]}`)
           
           // Special logging for WorkList
           if (activeView === 'WorkList') {
             console.log(`[WorkList] === activeView changed to WorkList ===`)
             console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
             console.log(`[WorkList] URL should be: ${viewUrls['WorkList']}`)
             
             // Try to get current URL from webview after a delay
             setTimeout(() => {
               try {
                 const workListWebview = document.querySelector('webview[src*="30020"]') as any
                 if (workListWebview) {
                   const currentUrl = workListWebview.getURL ? workListWebview.getURL() : 'unknown'
                   console.log(`[WorkList] === URL check after view change ===`)
                   console.log(`[WorkList] URL: ${currentUrl}`)
                 } else {
                   console.log(`[WorkList] === Webview element not found ===`)
                 }
               } catch (e) {
                 console.error(`[WorkList] Error getting URL:`, e)
               }
             }, 500)
           }

           // Clear any existing timeout
           if (loadingTimeoutRef.current) {
             clearTimeout(loadingTimeoutRef.current)
             loadingTimeoutRef.current = null
           }

           // Always hide all embedded windows first when view changes
           // This prevents embedded windows from blocking menu interactions
           const hideWindows = async () => {
             try {
               const result = await window.api.hideAllWindows()
               console.log('[App] All embedded windows hidden:', result)
               
               // Special logging for WorkList
               if (activeView === 'WorkList') {
                 console.log(`[WorkList] === Embedded windows hidden, switching to WorkList ===`)
               }
             } catch (error) {
               console.error('[App] Failed to hide all windows:', error)
             }
           }

           // Start loading when view changes
           setIsLoading(true)

    // First, always hide all embedded windows
    hideWindows().then(() => {
      // Check if it's an embedded view (not webview)
      // Only embed if it's a valid embedded view
      
      // Check if it's a RECON submenu
      if (reconSubmenuStatus[activeView]?.exists && reconSubmenuStatus[activeView].path) {
        const appPath = reconSubmenuStatus[activeView].path!
        console.log(`RECON submenu selected: ${activeView}`)
        console.log(`Executable path: ${appPath}`)
        console.log(`Status: exists=${reconSubmenuStatus[activeView].exists}, path=${appPath}`)
        console.log(`Requesting embed...`)
        
        // Small delay to ensure windows are hidden before embedding new one
        setTimeout(() => {
          window.api
            .embedWindow({ viewName: activeView, appPath })
            .then((result) => {
              console.log('Embed request result:', result)
              if (!result.success) {
                console.error('Embed failed:', result.message)
              }
              // Stop loading after embed completes (give it a moment to show)
              setTimeout(() => setIsLoading(false), 300)
            })
            .catch((error) => {
              console.error('Embed request failed:', error)
              setIsLoading(false)
            })
        }, 100)
        return
      }

      // Check if it's a Deformation submenu
      if (deformationSubmenuStatus[activeView]?.exists && deformationSubmenuStatus[activeView].path) {
        const appPath = deformationSubmenuStatus[activeView].path!
        console.log(`Deformation submenu selected: ${activeView}. Requesting embed...`)
        
        // Small delay to ensure windows are hidden before embedding new one
        setTimeout(() => {
          window.api
            .embedWindow({ viewName: activeView, appPath })
            .then((result) => {
              console.log('Embed request result:', result.message)
              // Stop loading after embed completes
              setTimeout(() => setIsLoading(false), 300)
            })
            .catch((error) => {
              console.error('Embed request failed:', error)
              setIsLoading(false)
            })
        }, 100)
        return
      }

      // Check if it's a native app path
      const appPath = nativeAppPaths[activeView]
      if (appPath) {
        console.log(`Native view selected: ${activeView}. Requesting embed...`)
        
        // Small delay to ensure windows are hidden before embedding new one
        setTimeout(() => {
          window.api
            .embedWindow({ viewName: activeView, appPath })
            .then((result) => {
              console.log('Embed request result:', result.message)
              // Stop loading after embed completes
              setTimeout(() => setIsLoading(false), 300)
            })
            .catch((error) => {
              console.error('Embed request failed:', error)
              setIsLoading(false)
            })
        }, 100)
        return
      }

       // If it's not an embedded view (e.g., WorkList, Dicom Editor, Settings),
       // embedded windows should already be hidden by hideWindows() above
       console.log(`[App] View ${activeView} is not an embedded view. Embedded windows should be hidden.`)
       
       // Special logging for WorkList
       if (activeView === 'WorkList') {
         console.log(`[WorkList] === Not an embedded view, is webview ===`)
         console.log(`[WorkList] URL: ${viewUrls['WorkList']}`)
       }
       
       // For webviews, loading will stop when webview loads (handled by onLoad callback)
       // If webview was already loaded (switching back), stop loading immediately
       if (activeView === 'Settings' || !viewUrls[activeView]) {
         console.log(`[App] Stopping loading for non-webview view: ${activeView}`)
         setTimeout(() => {
           console.log('[App] Setting isLoading to false')
           setIsLoading(false)
         }, 100)
       } else {
         // For webviews, check if it's already loaded
         // Since we're now keeping webviews in DOM, they might already be loaded
         // Give a small delay to check if webview loads, then stop loading
         console.log(`[App] Webview detected for ${activeView}`)
         
         // Special logging for WorkList
         if (activeView === 'WorkList') {
           console.log(`[WorkList] === Webview detected, waiting for load ===`)
           console.log(`[WorkList] URL: ${viewUrls['WorkList']}`)
           console.log(`[WorkList] May already be loaded from previous visit`)
         }
         
         // Short timeout - if webview is already loaded (from previous visit), it won't fire did-finish-load again
         // So we stop loading after a short delay
         setTimeout(() => {
           console.log(`[App] Stopping loading for webview (may already be loaded): ${activeView}`)
           
           // Special logging for WorkList
           if (activeView === 'WorkList') {
             console.log(`[WorkList] === Stopping loading (short timeout) ===`)
             console.log(`[WorkList] Webview should be visible now`)
           }
           
           setIsLoading(false)
         }, 200)
         // Also set a longer timeout as fallback
         loadingTimeoutRef.current = setTimeout(() => {
           console.log(`[App] Webview load timeout reached, stopping loading: ${activeView}`)
           
           // Special logging for WorkList
           if (activeView === 'WorkList') {
             console.log(`[WorkList] === Load timeout reached ===`)
           }
           
           setIsLoading(false)
           loadingTimeoutRef.current = null
         }, 5000) // 5 second timeout as fallback
       }
    })

    // Cleanup function
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [activeView, reconSubmenuStatus, deformationSubmenuStatus])

  // Effect for observing content area size and position
  useLayoutEffect(() => {
    const contentEl = contentRef.current
    if (!contentEl) return

    const updateBounds = () => {
      const bounds = contentEl.getBoundingClientRect()
      
      // When using SetParent, coordinates are relative to parent window's client area
      // We need to convert screen coordinates to parent window client coordinates
      // For Electron, we send the screen coordinates and let the helper convert them
      // But actually, we should send content div position relative to the Electron window
      
      // Log bounds for debugging
      console.log('[App] Content bounds:', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        menuVisible: isMenuVisible
      })
      
      // Send bounds for content area only (excluding menu)
      // These are screen coordinates, but SetParent child windows use parent client coords
      window.api.updateGeometry({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height)
      })
    }

    // Initial update
    updateBounds()

    const resizeObserver = new ResizeObserver(() => {
      updateBounds()
    })

    resizeObserver.observe(contentEl)

    // Also update when window moves
    const handleResize = () => {
      setTimeout(updateBounds, 100) // Small delay to ensure layout is updated
    }
    window.addEventListener('resize', handleResize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [isMenuVisible])

  // Effect to periodically check WorkList webview URL
  useEffect(() => {
    if (activeView !== 'WorkList') {
      return
    }

    console.log(`[WorkList] === Starting periodic URL check ===`)

    const checkWorkListUrl = (): void => {
      try {
        console.log(`[WorkList] === Checking WorkList URL ===`)
        
        // Try to find WorkList webview by src attribute
        const workListWebview = document.querySelector('webview[src*="30020"]') as any
        console.log(`[WorkList] Found webview element:`, !!workListWebview)
        
        if (workListWebview) {
          console.log(`[WorkList] Webview element found`)
          console.log(`[WorkList] Webview tagName:`, workListWebview.tagName)
          console.log(`[WorkList] Webview src attribute:`, workListWebview.src)
          console.log(`[WorkList] Has getURL method:`, typeof workListWebview.getURL === 'function')
          
          // Try multiple ways to get URL
          let currentUrl = 'unknown'
          
          try {
            if (typeof workListWebview.getURL === 'function') {
              currentUrl = workListWebview.getURL()
              console.log(`[WorkList] URL via getURL(): ${currentUrl}`)
            } else {
              console.log(`[WorkList] getURL() method not available`)
              
              // Try src attribute
              if (workListWebview.src) {
                currentUrl = workListWebview.src
                console.log(`[WorkList] URL via src attribute: ${currentUrl}`)
              }
            }
          } catch (e) {
            console.error(`[WorkList] Error calling getURL():`, e)
            
            // Fallback to src attribute
            if (workListWebview.src) {
              currentUrl = workListWebview.src
              console.log(`[WorkList] URL via src attribute (fallback): ${currentUrl}`)
            }
          }
          
          console.log(`[WorkList] === Final URL check ===`)
          console.log(`[WorkList] URL: ${currentUrl}`)
          console.log(`[WorkList] URL type: ${typeof currentUrl}`)
          console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
          
          // Also try webContents if available
          try {
            if (typeof workListWebview.getWebContents === 'function') {
              const webContents = workListWebview.getWebContents()
              if (webContents && typeof webContents.getURL === 'function') {
                const wcUrl = webContents.getURL()
                console.log(`[WorkList] === URL via webContents ===`)
                console.log(`[WorkList] URL: ${wcUrl}`)
              }
            }
          } catch (e) {
            console.log(`[WorkList] webContents not available`)
          }
        } else {
          console.log(`[WorkList] === Webview element not found in DOM ===`)
          
          // Try to find any webview elements
          const allWebviews = document.querySelectorAll('webview')
          console.log(`[WorkList] Total webview elements in DOM: ${allWebviews.length}`)
          
          allWebviews.forEach((wv, idx) => {
            const wvAny = wv as any
            console.log(`[WorkList] Webview ${idx}: src=${wvAny.src}, hasGetURL=${typeof wvAny.getURL === 'function'}`)
          })
        }
      } catch (e) {
        console.error(`[WorkList] Error in periodic URL check:`, e)
        console.error(`[WorkList] Error stack:`, (e as Error).stack)
      }
    }

    // Check immediately
    console.log(`[WorkList] === Immediate URL check ===`)
    checkWorkListUrl()

    // Check every second while WorkList is active
    const intervalId = setInterval(() => {
      console.log(`[WorkList] === Scheduled URL check ===`)
      checkWorkListUrl()
    }, 1000)

    return () => {
      clearInterval(intervalId)
      console.log(`[WorkList] === Stopping periodic URL check ===`)
    }
  }, [activeView])

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
    transition: 'width 0.3s',
    position: 'relative',
    zIndex: 9999, // Ensure menu is always on top
    backgroundColor: '#fff', // Ensure menu has background
    pointerEvents: 'auto' // Ensure menu receives pointer events
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
    position: 'relative',
    overflow: 'hidden', // Clip content to this div
    isolation: 'isolate' // Create new stacking context
  }

  const handleMenuClick = async (item: string): Promise<void> => {
    // Immediately hide all embedded windows when menu is clicked
    // This ensures menu clicks work even if embedded window is on top
    try {
      await window.api.hideAllWindows()
      console.log('[App] Embedded windows hidden on menu click')
    } catch (error) {
      console.error('[App] Failed to hide windows on menu click:', error)
    }

    console.log(`[App] === Menu click: ${item} ===`)
    console.log(`[App] Previous activeView: ${activeView}`)
    console.log(`[App] New activeView: ${item}`)
    
    // Special logging when switching to/from WorkList
    if (activeView === 'WorkList' || item === 'WorkList') {
      console.log(`[WorkList] === Menu transition ===`)
      console.log(`[WorkList] From: ${activeView}`)
      console.log(`[WorkList] To: ${item}`)
      console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
    }

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

  const handleSubmenuClick = async (submenu: string): Promise<void> => {
    // Immediately hide all embedded windows when submenu is clicked
    try {
      await window.api.hideAllWindows()
      console.log('[App] Embedded windows hidden on submenu click')
    } catch (error) {
      console.error('[App] Failed to hide windows on submenu click:', error)
    }
    
    console.log(`[App] === Submenu click: ${submenu} ===`)
    console.log(`[App] Previous activeView: ${activeView}`)
    console.log(`[App] New activeView: ${submenu}`)
    
    // Special logging when switching from WorkList
    if (activeView === 'WorkList') {
      console.log(`[WorkList] === Switching away from WorkList ===`)
      console.log(`[WorkList] To: ${submenu}`)
      console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
    }
    
    setActiveView(submenu)
  }

  const renderContent = (): React.ReactElement => {
    // Show loading spinner during transitions
    if (isLoading) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            background: '#f0f0f0',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 10
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              border: '4px solid #e3e3e3',
              borderTop: '4px solid #0066cc',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )
    }

    if (activeView === 'Settings') {
      return <Settings onClose={handleCloseSettings} onConfigChange={handleConfigChange} />
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

    // For native apps, render an empty container. The main process will embed the window.
    // The embedded window will be shown by the main process, so we just need an empty container.
    if (reconSubmenuStatus[activeView]?.exists || deformationSubmenuStatus[activeView]?.exists || nativeAppPaths[activeView]) {
      return (
        <div id="native-view-container" style={{ width: '100%', height: '100%', background: 'transparent' }}>
          {/* Empty container - embedded window will be displayed here by the main process */}
        </div>
      )
    }

    // Render all webviews but only show the active one
    // This keeps webviews loaded when switching between menus
    // Use visibility instead of display to prevent webview reload
    return (
      <>
        {Object.entries(viewUrls).map(([viewName, url]) => (
          <div
            key={viewName}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              visibility: activeView === viewName ? 'visible' : 'hidden',
              display: activeView === viewName ? 'block' : 'block', // Always block, use visibility
              zIndex: activeView === viewName ? 1 : -1 // Bring active to front
            }}
          >
            <Webview
              key={viewName} // Use stable key to prevent remounting
              viewName={viewName}
              src={url}
              onLoad={() => {
                console.log(`[App] Webview onLoad callback called for ${viewName}`)
                // Only stop loading if this is the active view
                if (activeView === viewName && loadingTimeoutRef.current) {
                  clearTimeout(loadingTimeoutRef.current)
                  loadingTimeoutRef.current = null
                  setIsLoading(false)
                }
              }}
            />
          </div>
        ))}
      </>
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
                  onClick={(): void => {
                    handleMenuClick(item).catch((error) => {
                      console.error('Menu click error:', error)
                    })
                  }}
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
                            onClick={(): void => {
                              handleSubmenuClick(submenu).catch((error) => {
                                console.error('Submenu click error:', error)
                              })
                            }}
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
                            onClick={(): void => {
                              handleSubmenuClick(submenu).catch((error) => {
                                console.error('Submenu click error:', error)
                              })
                            }}
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
