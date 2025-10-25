import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { IpcBridge } from '../ipc-bridge'

interface TerminalViewProps {
  onTargetChange: (target: string) => void
  onCwdChange: (cwd: string) => void
}

function TerminalView({ onTargetChange, onCwdChange }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    // Initialize xterm.js
    const terminal = new Terminal({
      cols: 120,
      rows: 30,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff'
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2
    })

    terminal.open(terminalRef.current)
    xtermRef.current = terminal

    // Set up terminal output listener
    const cleanup = IpcBridge.onTerminalChunk((chunk) => {
      terminal.write(chunk.text)
      
      // Simple parsing to detect directory changes and targets
      // This is a basic implementation - could be enhanced
      const text = chunk.text
      
      // Detect directory changes (Windows & Unix)
      const cwdMatch = text.match(/^[A-Z]:\\[^>]*>|^[^$]*\$/) 
      if (cwdMatch) {
        // Extract path from prompt
        const promptText = cwdMatch[0]
        if (promptText.includes(':\\')) {
          // Windows path
          const pathMatch = promptText.match(/([A-Z]:\\[^>]*)/)
          if (pathMatch) {
            onCwdChange(pathMatch[1])
          }
        } else {
          // Unix path - would need more sophisticated parsing
          // For now, just update that we're in a Unix environment
          onTargetChange('local')
        }
      }
      
      // Detect SSH connections
      if (text.includes('ssh ') || text.includes('Connecting to')) {
        // Extract SSH target if possible
        const sshMatch = text.match(/ssh\s+(?:-[^\s]+\s+)*([^\s@]+@[^\s]+)/)
        if (sshMatch) {
          onTargetChange(`ssh://${sshMatch[1]}`)
        }
      }
    })

    // Handle terminal input (for future enhancement)
    terminal.onData((data: string) => {
      // For now, terminal input is handled by the backend
      // This could be enhanced to support direct terminal interaction
      console.log('Terminal input:', data)
    })

    return () => {
      cleanup()
      terminal.dispose()
    }
  }, [onTargetChange, onCwdChange])

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      if (xtermRef.current && terminalRef.current) {
        const rect = terminalRef.current.getBoundingClientRect()
        const cols = Math.floor(rect.width / 9) // Approximate character width
        const rows = Math.floor(rect.height / 17) // Approximate line height
        xtermRef.current.resize(cols, rows)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="terminal-view">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <div className="terminal-controls">
          <button className="terminal-button clear">Clear</button>
          <button className="terminal-button new">New</button>
        </div>
      </div>
      <div 
        ref={terminalRef} 
        className="terminal-container"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}

export default TerminalView