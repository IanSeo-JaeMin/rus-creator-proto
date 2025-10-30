import React from 'react'

// The webview tag is not a standard HTML element, so we need to declare it for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src: string
          style?: React.CSSProperties
        },
        HTMLElement
      >
    }
  }
}

interface WebviewProps {
  src: string
  style?: React.CSSProperties
}

const Webview: React.FC<WebviewProps> = ({ src, style }) => {
  return (
    <webview
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', ...style }}
    ></webview>
  )
}

export default Webview
