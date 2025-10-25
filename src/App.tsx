import { useState, Suspense, lazy } from 'react'

// 컴포넌트들을 동적 import로 지연 로딩
const TerminalView = lazy(() => import('./components/TerminalView'))
const ChatPanel = lazy(() => import('./components/ChatPanel'))

function App() {
  const [currentTarget, setCurrentTarget] = useState('local')
  const [currentCwd, setCurrentCwd] = useState('D:\\git\\ai-terminal')

  const handleTargetChange = (target: string) => {
    setCurrentTarget(target)
  }

  const handleCwdChange = (cwd: string) => {
    setCurrentCwd(cwd)
  }

  return (
    <div className="app">
      <div className="app-header">
        <h1>AI Terminal</h1>
        <div className="status-bar">
          <span className="target">Target: {currentTarget}</span>
          <span className="cwd">CWD: {currentCwd}</span>
        </div>
      </div>
      
      <div className="app-content">
        <div className="left-panel">
          <Suspense fallback={<div className="loading-panel">Loading Terminal...</div>}>
            <TerminalView 
              onTargetChange={handleTargetChange}
              onCwdChange={handleCwdChange}
            />
          </Suspense>
        </div>
        
        <div className="right-panel">
          <Suspense fallback={<div className="loading-panel">Loading Chat Panel...</div>}>
            <ChatPanel />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default App