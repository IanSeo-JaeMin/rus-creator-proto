import { useState, useEffect } from 'react'

interface SettingsProps {
  onClose: () => void
  onConfigChange?: () => void
}

const Settings: React.FC<SettingsProps> = ({ onClose, onConfigChange }) => {
  const [downloadPath, setDownloadPath] = useState<string | null>(null)
  const [reconPaths, setReconPaths] = useState<Record<string, string>>({})
  const [deformationPaths, setDeformationPaths] = useState<Record<string, string>>({})
  const [modeling3dPath, setModeling3dPath] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async (): Promise<void> => {
    try {
      const config = await window.api.getConfig()
      setDownloadPath(config.downloadPath)
      setReconPaths(config.reconPaths || {})
      setDeformationPaths(config.deformationPaths || {})
      setModeling3dPath(config.modeling3dPath || null)
    } catch (error) {
      // Silent error
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectDownloadPath = async (): Promise<void> => {
    try {
      const result = await window.api.selectFolder()
      if (result.success && result.path) {
        await window.api.setDownloadPath(result.path)
        setDownloadPath(result.path)
      }
    } catch (error) {
      // Silent error
    }
  }

  const handleResetDownloadPath = async (): Promise<void> => {
    try {
      await window.api.setDownloadPath(null)
      setDownloadPath(null)
    } catch (error) {
      // Silent error
    }
  }

  const handleSelectReconPath = async (submenu: string): Promise<void> => {
    try {
      const result = await window.api.selectFile()
      if (result.success && result.path) {
        await window.api.setReconPath({ submenu, path: result.path })
        setReconPaths({ ...reconPaths, [submenu]: result.path })
        onConfigChange?.()
      }
    } catch (error) {
      // Silent error
    }
  }

  const handleResetReconPath = async (submenu: string): Promise<void> => {
    try {
      await window.api.setReconPath({ submenu, path: '' })
      const updated = { ...reconPaths }
      delete updated[submenu]
      setReconPaths(updated)
      onConfigChange?.()
    } catch (error) {
      // Silent error
    }
  }

  const handleSelectDeformationPath = async (submenu: string): Promise<void> => {
    try {
      const result = await window.api.selectFolder()
      if (result.success && result.path) {
        await window.api.setDeformationPath({ submenu, path: result.path })
        setDeformationPaths({ ...deformationPaths, [submenu]: result.path })
        onConfigChange?.()
      }
    } catch (error) {
      // Silent error
    }
  }

  const handleResetDeformationPath = async (submenu: string): Promise<void> => {
    try {
      await window.api.setDeformationPath({ submenu, path: '' })
      const updated = { ...deformationPaths }
      delete updated[submenu]
      setDeformationPaths(updated)
      onConfigChange?.()
    } catch (error) {
      // Silent error
    }
  }

  const handleSelect3dModelingPath = async (): Promise<void> => {
    try {
      const result = await window.api.selectFile()
      if (result.success && result.path) {
        await window.api.set3dModelingPath(result.path)
        setModeling3dPath(result.path)
        onConfigChange?.()
      }
    } catch (error) {
      // Silent error
    }
  }

  const handleReset3dModelingPath = async (): Promise<void> => {
    try {
      await window.api.set3dModelingPath(null)
      setModeling3dPath(null)
      onConfigChange?.()
    } catch (error) {
      // Silent error
    }
  }

  const handleResetAll = async (): Promise<void> => {
    try {
      await window.api.resetConfig()
      setDownloadPath(null)
      setReconPaths({})
      setDeformationPaths({})
      setModeling3dPath(null)
      onConfigChange?.()
    } catch (error) {
      // Silent error
    }
  }

  const settingsContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    padding: '20px',
    overflow: 'auto'
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '30px',
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#fff'
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#333'
  }

  const itemStyle: React.CSSProperties = {
    marginBottom: '15px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px'
  }

  const itemTitleStyle: React.CSSProperties = {
    fontWeight: 'bold',
    marginBottom: '5px'
  }

  const pathStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#666',
    wordBreak: 'break-all',
    marginBottom: '8px'
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    marginRight: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontSize: '14px'
  }

  const buttonPrimaryStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#0066cc',
    color: '#fff',
    borderColor: '#0066cc'
  }

  const closeButtonStyle: React.CSSProperties = {
    position: 'sticky',
    top: '10px',
    float: 'right',
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  }

  const reconSubmenus = ['Stomach', 'Kidney', 'Lung', 'Liver', 'Colon']
  const deformationSubmenus = ['Pneumo Editor', 'hu3D Maker']

  if (isLoading) {
    return (
      <div style={settingsContainerStyle}>
        <div>로딩 중...</div>
      </div>
    )
  }

  return (
    <div style={settingsContainerStyle}>
      <button onClick={onClose} style={closeButtonStyle}>
        닫기
      </button>

      <h1 style={{ marginBottom: '20px' }}>설정</h1>

      {/* Download Path Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>다운로드 경로</div>
        <div style={pathStyle}>{downloadPath || '기본 경로 (실행파일 경로/downloads)'}</div>
        <div>
          <button onClick={handleSelectDownloadPath} style={buttonPrimaryStyle}>
            경로 변경
          </button>
          {downloadPath && (
            <button onClick={handleResetDownloadPath} style={buttonStyle}>
              기본값으로 재설정
            </button>
          )}
        </div>
      </div>

      {/* RECON Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>RECON 실행파일 경로</div>
        {reconSubmenus.map((submenu) => (
          <div key={submenu} style={itemStyle}>
            <div style={itemTitleStyle}>{submenu}</div>
            <div style={pathStyle}>
              {reconPaths[submenu] || '기본 경로 (external/recon/' + submenu.toLowerCase() + '/)'}
            </div>
            <div>
              <button onClick={() => handleSelectReconPath(submenu)} style={buttonPrimaryStyle}>
                경로 변경
              </button>
              {reconPaths[submenu] && (
                <button onClick={() => handleResetReconPath(submenu)} style={buttonStyle}>
                  기본값으로 재설정
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Deformation Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Deformation 실행파일 경로</div>
        {deformationSubmenus.map((submenu) => {
          const folderName = submenu.toLowerCase().replace(/\s+/g, '-')
          return (
            <div key={submenu} style={itemStyle}>
              <div style={itemTitleStyle}>{submenu}</div>
              <div style={pathStyle}>
                {deformationPaths[submenu] ||
                  '기본 경로 (external/deformation/' + folderName + '/)'}
              </div>
              <div>
                <button
                  onClick={() => handleSelectDeformationPath(submenu)}
                  style={buttonPrimaryStyle}
                >
                  경로 변경
                </button>
                {deformationPaths[submenu] && (
                  <button onClick={() => handleResetDeformationPath(submenu)} style={buttonStyle}>
                    기본값으로 재설정
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 3D Modeling Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>3D Modeling 실행파일 경로</div>
        <div style={itemStyle}>
          <div style={itemTitleStyle}>3D Modeling</div>
          <div style={pathStyle}>
            {modeling3dPath || '경로가 설정되지 않았습니다'}
          </div>
          <div>
            <button onClick={handleSelect3dModelingPath} style={buttonPrimaryStyle}>
              경로 선택
            </button>
            {modeling3dPath && (
              <button onClick={handleReset3dModelingPath} style={buttonStyle}>
                경로 제거
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reset All */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>전체 설정 초기화</div>
        <div style={pathStyle}>모든 설정을 기본값으로 재설정합니다.</div>
        <button onClick={handleResetAll} style={buttonPrimaryStyle}>
          전체 설정 초기화
        </button>
      </div>
    </div>
  )
}

export default Settings
