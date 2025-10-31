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
      return undefined
    }

    // Only set src once to prevent reloading
    // This ensures webview maintains its state (login, navigation, etc.)
    if (!srcSetRef.current && src) {
      try {
        webview.src = src
        srcSetRef.current = true
      } catch (e) {
        // Silent error - src may already be set
      }
    }

    // Helper function to get URL safely
    const getURL = (): string => {
      try {
        if (!webview) {
          return 'null'
        }

        const hasGetURL = typeof (webview as any).getURL === 'function'

        if (hasGetURL) {
          const url = (webview as any).getURL()
          return url
        }

        // Try alternative methods
        if ((webview as any).src) {
          return (webview as any).src
        }

        return 'unknown'
      } catch (e) {
        // Silent error - return default
        return 'unknown'
      }
    }

    const handleLoad = (): void => {
      try {
        getURL()
      } catch (e) {
        // Silent error - URL tracking failures are not critical
      }

      if (onLoad) {
        onLoad()
      }
    }

    const handleNavigate = (_event: any): void => {
      try {
        getURL()
      } catch (e) {
        // Silent error - URL tracking failures are not critical
      }
    }

    const handleNavigateInPage = (_event: any): void => {
      try {
        getURL()
      } catch (e) {
        // Silent error - URL tracking failures are not critical
      }
    }

    const handleDomReady = (): void => {
      try {
        getURL()
      } catch (e) {
        // Silent error - URL tracking failures are not critical
      }
    }

    // Attach event listeners immediately (before dom-ready)
    // Electron webview events can be attached early

    try {
      webview.addEventListener('did-finish-load', handleLoad)
    } catch (e) {
      // Silent error - listener may already be attached
    }

    try {
      webview.addEventListener('did-navigate', handleNavigate)
    } catch (e) {
      // Silent error - listener may already be attached
    }

    try {
      webview.addEventListener('did-navigate-in-page', handleNavigateInPage)
    } catch (e) {
      // Silent error - listener may already be attached
    }

    try {
      webview.addEventListener('dom-ready', handleDomReady)
    } catch (e) {
      // Silent error - listener may already be attached
    }

    return () => {
      if (webview) {
        try {
          webview.removeEventListener('did-finish-load', handleLoad)
          webview.removeEventListener('did-navigate', handleNavigate)
          webview.removeEventListener('did-navigate-in-page', handleNavigateInPage)
          webview.removeEventListener('dom-ready', handleDomReady)
        } catch (e) {
          // Silent error - listener removal failures are not critical
        }
      }
    }
  }, [onLoad, src, viewName])

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
  return !srcChanged
})

export default Webview
