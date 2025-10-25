import { useState, useEffect } from 'react'
import TerminalView from './components/TerminalView'
import ChatPanel from './components/ChatPanel'
import { IpcBridge } from './ipc-bridge'
import type { SnapshotReady, LlmSuggestion, ErrorMessage } from '../types/messages'

function App() {
  const [currentTarget, setCurrentTarget] = useState('local')
  const [currentCwd, setCurrentCwd] = useState('D:\\git\\ai-terminal')
  const [snapshots, setSnapshots] = useState<SnapshotReady[]>([])
  const [suggestions, setSuggestions] = useState<LlmSuggestion[]>([])
  const [errors, setErrors] = useState<ErrorMessage[]>([])
  const [isExecuting, setIsExecuting] = useState(false)

  useEffect(() => {
    // Set up IPC listeners
    const cleanupFunctions = [
      IpcBridge.onSnapshotReady((snapshot) => {
        setSnapshots(prev => [...prev.slice(-9), snapshot]) // Keep last 10
      }),
      
      IpcBridge.onLlmSuggestion((suggestion) => {
        setSuggestions(prev => [...prev.slice(-4), suggestion]) // Keep last 5
      }),
      
      IpcBridge.onError((error) => {
        setErrors(prev => [...prev.slice(-9), error]) // Keep last 10
        console.error('IPC Error:', error)
      })
    ]

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [])

  const handleRunCommand = async (command: string, target?: string) => {
    try {
      setIsExecuting(true)
      
      const request = {
        id: `cmd-${Date.now()}`,
        target: target || currentTarget,
        cwd: currentCwd,
        cmd: command,
        mode: 'normal' as const
      }

      // Update current target if provided
      if (target) {
        setCurrentTarget(target)
      }

      const result = await IpcBridge.runCommand(request)
      if (!result.success) {
        console.error('Command failed:', result.error)
        setErrors(prev => [...prev.slice(-9), {
          id: request.id,
          message: result.error || 'Unknown error'
        }])
      }
    } catch (error) {
      console.error('Failed to run command:', error)
      setErrors(prev => [...prev.slice(-9), {
        id: `error-${Date.now()}`,
        message: error instanceof Error ? error.message : 'Unknown error'
      }])
    } finally {
      setIsExecuting(false)
    }
  }

  // Listen for command completion to update execution state
  useEffect(() => {
    const cleanup = IpcBridge.onSnapshotReady((snapshot) => {
      setSnapshots(prev => [...prev.slice(-9), snapshot]) // Keep last 10
      
      // If this snapshot indicates command completion, stop executing
      if (snapshot.trigger === 'onExit' || snapshot.trigger === 'onError') {
        setIsExecuting(false)
      }
    })

    return cleanup
  }, [])

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
          <TerminalView 
            onTargetChange={handleTargetChange}
            onCwdChange={handleCwdChange}
          />
        </div>
        
        <div className="right-panel">
          <ChatPanel 
            onRunCommand={handleRunCommand}
            snapshots={snapshots}
            suggestions={suggestions}
            errors={errors}
            isExecuting={isExecuting}
          />
        </div>
      </div>
    </div>
  )
}

export default App