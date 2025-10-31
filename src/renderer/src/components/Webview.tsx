import React from 'react'

// The webview tag is not a standard HTML element, so we need to declare it for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src: string
          style?: React.CSSProperties
          ref?: React.Ref<HTMLElement>
        },
        HTMLElement
      >
    }
  }
}

interface WebviewProps {
  src: string
  viewName?: string
  style?: React.CSSProperties
  onLoad?: () => void
}

const Webview: React.FC<WebviewProps> = React.memo(({ src, viewName, style, onLoad }) => {
  const webviewRef = React.useRef<HTMLElement>(null)
  const srcSetRef = React.useRef(false)

  React.useEffect(() => {
    const webview = webviewRef.current as any
    if (!webview) {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Webview ref is null`)
      return undefined
    }

    console.log(`[Webview${viewName ? `:${viewName}` : ''}] ========== Webview element found, setting up... ==========`)
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Webview element:`, webview)
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Webview tagName:`, webview.tagName)
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Webview src attribute:`, webview.src)
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Webview style:`, webview.style)
    
    // Check if webview has getURL method
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Has getURL:`, typeof (webview as any).getURL === 'function')
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Has addEventListener:`, typeof webview.addEventListener === 'function')
    
    // List all available methods
    const methods = Object.getOwnPropertyNames(webview).filter(name => typeof (webview as any)[name] === 'function')
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] Available methods:`, methods.slice(0, 20)) // First 20 methods
    
    // Only set src once to prevent reloading
    // This ensures webview maintains its state (login, navigation, etc.)
    if (!srcSetRef.current && src) {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Setting src once: ${src}`)
      try {
        webview.src = src
        srcSetRef.current = true
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Src set successfully. Current src:`, webview.src)
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error setting src:`, e)
      }
    } else if (srcSetRef.current) {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Src already set, not reloading: ${src}`)
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Current src attribute:`, webview.src)
    }

    // Helper function to get URL safely
    const getURL = (): string => {
      try {
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL called`)
        if (!webview) {
          console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL: webview is null`)
          return 'null'
        }
        
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL: checking method exists`)
        const hasGetURL = typeof (webview as any).getURL === 'function'
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL: has method:`, hasGetURL)
        
        if (hasGetURL) {
          const url = (webview as any).getURL()
          console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL: returned:`, url)
          return url
        }
        
        // Try alternative methods
        if ((webview as any).src) {
          console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL: using src attribute:`, (webview as any).src)
          return (webview as any).src
        }
        
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] getURL: no method available`)
        return 'unknown'
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error in getURL:`, e)
        return 'error'
      }
    }

    const handleLoad = (): void => {
      try {
        const currentUrl = getURL()
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] did-finish-load event fired`)
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Current URL: ${currentUrl}`)
        
        // Special logging for WorkList
        if (viewName === 'WorkList') {
          console.log(`[WorkList] === did-finish-load ===`)
          console.log(`[WorkList] URL: ${currentUrl}`)
          console.log(`[WorkList] Source: ${src}`)
        }
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error getting URL:`, e)
      }
      
      if (onLoad) {
        onLoad()
      }
    }

    const handleNavigate = (event: any): void => {
      try {
        const url = event?.url || getURL() || 'unknown'
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] did-navigate event fired`)
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Event URL: ${event?.url || 'none'}`)
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Navigated to: ${url}`)
        
        // Special logging for WorkList
        if (viewName === 'WorkList') {
          console.log(`[WorkList] === did-navigate ===`)
          console.log(`[WorkList] URL: ${url}`)
          console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
        }
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error in navigate handler:`, e)
      }
    }

    const handleNavigateInPage = (event: any): void => {
      try {
        const url = event?.url || getURL() || 'unknown'
        const isMainFrame = event?.isMainFrame !== false
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] did-navigate-in-page event fired (isMainFrame: ${isMainFrame})`)
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Event URL: ${event?.url || 'none'}`)
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Navigated in-page to: ${url}`)
        
        // Special logging for WorkList
        if (viewName === 'WorkList') {
          console.log(`[WorkList] === did-navigate-in-page ===`)
          console.log(`[WorkList] URL: ${url}`)
          console.log(`[WorkList] isMainFrame: ${isMainFrame}`)
          console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
        }
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error in navigate-in-page handler:`, e)
      }
    }

    const handleDomReady = (): void => {
      try {
        const currentUrl = getURL()
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] dom-ready event fired`)
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] DOM ready, URL: ${currentUrl}`)
        
        // Special logging for WorkList
        if (viewName === 'WorkList') {
          console.log(`[WorkList] === dom-ready ===`)
          console.log(`[WorkList] URL: ${currentUrl}`)
        }
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error in dom-ready handler:`, e)
      }
    }

    // Attach event listeners immediately (before dom-ready)
    // Electron webview events can be attached early
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] ========== Attaching event listeners immediately ==========`)
    
    try {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Adding did-finish-load listener`)
      webview.addEventListener('did-finish-load', handleLoad)
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] did-finish-load listener added`)
    } catch (e) {
      console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error adding did-finish-load listener:`, e)
    }
    
    try {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Adding did-navigate listener`)
      webview.addEventListener('did-navigate', handleNavigate)
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] did-navigate listener added`)
    } catch (e) {
      console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error adding did-navigate listener:`, e)
    }
    
    try {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Adding did-navigate-in-page listener`)
      webview.addEventListener('did-navigate-in-page', handleNavigateInPage)
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] did-navigate-in-page listener added`)
    } catch (e) {
      console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error adding did-navigate-in-page listener:`, e)
    }
    
    try {
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] Adding dom-ready listener`)
      webview.addEventListener('dom-ready', handleDomReady)
      console.log(`[Webview${viewName ? `:${viewName}` : ''}] dom-ready listener added`)
    } catch (e) {
      console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error adding dom-ready listener:`, e)
    }
    
    console.log(`[Webview${viewName ? `:${viewName}` : ''}] ========== All event listeners attached ==========`)
    
    // Also try to get URL after a delay to check if webview is already loaded
    const checkUrlInterval = setInterval(() => {
      try {
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] ========== Periodic URL check ==========`)
        const currentUrl = getURL()
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] Periodic URL check result: ${currentUrl}`)
        
        // Always log for debugging, even if unknown
        console.log(`[Webview${viewName ? `:${viewName}` : ''}] URL: ${currentUrl} (type: ${typeof currentUrl})`)
        
        if (viewName === 'WorkList') {
          console.log(`[WorkList] === Periodic URL check ===`)
          console.log(`[WorkList] URL: ${currentUrl}`)
          console.log(`[WorkList] URL type: ${typeof currentUrl}`)
          console.log(`[WorkList] Timestamp: ${new Date().toISOString()}`)
        }
        
        // Also try to get URL via webContents if available
        try {
          if ((webview as any).getWebContents) {
            const webContents = (webview as any).getWebContents()
            if (webContents && typeof webContents.getURL === 'function') {
              const wcUrl = webContents.getURL()
              console.log(`[Webview${viewName ? `:${viewName}` : ''}] URL via webContents: ${wcUrl}`)
              
              if (viewName === 'WorkList') {
                console.log(`[WorkList] === URL via webContents ===`)
                console.log(`[WorkList] URL: ${wcUrl}`)
              }
            }
          }
        } catch (e) {
          // getWebContents might not be available
        }
      } catch (e) {
        console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error in periodic check:`, e)
      }
    }, 1000) // Check every second

    // Also check if it's already loaded
    const checkLoaded = (): void => {
      try {
        if ((webview as any).isLoading && typeof (webview as any).isLoading === 'function') {
          const isLoading = (webview as any).isLoading()
          console.log(`[Webview${viewName ? `:${viewName}` : ''}] isLoading(): ${isLoading}`)
          
          if (!isLoading) {
            const currentUrl = getURL()
            console.log(`[Webview${viewName ? `:${viewName}` : ''}] Already loaded, URL: ${currentUrl}`)
            
            if (viewName === 'WorkList') {
              console.log(`[WorkList] === Already loaded check ===`)
              console.log(`[WorkList] URL: ${currentUrl}`)
            }
          }
        }
      } catch (e) {
        // isLoading might not be available
      }
    }

    // Check immediately and after a delay
    checkLoaded()
    const checkTimeout = setTimeout(checkLoaded, 500)

    return () => {
      clearInterval(checkUrlInterval)
      clearTimeout(checkTimeout)
      if (webview) {
        try {
          webview.removeEventListener('did-finish-load', handleLoad)
          webview.removeEventListener('did-navigate', handleNavigate)
          webview.removeEventListener('did-navigate-in-page', handleNavigateInPage)
          webview.removeEventListener('dom-ready', handleDomReady)
        } catch (e) {
          console.error(`[Webview${viewName ? `:${viewName}` : ''}] Error removing listeners:`, e)
        }
      }
    }
  }, [onLoad, src, viewName]) // src in dependencies but we only set it once

  return (
    <webview
      ref={webviewRef}
      style={{ width: '100%', height: '100%', border: 'none', ...style }}
      // DO NOT set src here - it causes reload. Set it in useEffect only once.
    ></webview>
  )
}, (prevProps, nextProps) => {
  // Only re-render if src actually changes
  // For same view, src should be same, so component won't re-render
  const srcChanged = prevProps.src !== nextProps.src
  const viewNameChanged = prevProps.viewName !== nextProps.viewName
  console.log(`[Webview${nextProps.viewName ? `:${nextProps.viewName}` : ''}] Memo check - src changed: ${srcChanged}, viewName changed: ${viewNameChanged}`)
  console.log(`[Webview${nextProps.viewName ? `:${nextProps.viewName}` : ''}] Memo check - prev src: ${prevProps.src}, next src: ${nextProps.src}`)
  
  // Special logging for WorkList
  if (nextProps.viewName === 'WorkList' || prevProps.viewName === 'WorkList') {
    console.log(`[WorkList] === Memo check ===`)
    console.log(`[WorkList] src changed: ${srcChanged}`)
    console.log(`[WorkList] viewName changed: ${viewNameChanged}`)
    console.log(`[WorkList] prev src: ${prevProps.src}`)
    console.log(`[WorkList] next src: ${nextProps.src}`)
  }
  
  return !srcChanged
})

export default Webview
