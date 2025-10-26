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
    if (!terminalRef.current) return;

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
    });

    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    // Set up terminal output listener
    const cleanup = IpcBridge.onTerminalChunk((chunk) => {
      if (chunk?.text) {
        // xterm.js는 자동으로 UTF-8 처리하므로 직접 write
        terminal.write(chunk.text);
      }
      const text = chunk.text;
      const cwdMatch = text.match(/^[A-Z]:\\[^>]*>|^[^$]*\$/);
      if (cwdMatch) {
        const promptText = cwdMatch[0];
        if (promptText.includes(':\\')) {
          const pathMatch = promptText.match(/([A-Z]:\\[^>]*)/);
          if (pathMatch) {
            onCwdChange(pathMatch[1]);
          }
        } else {
          onTargetChange('local');
        }
      }
      if (text.includes('ssh ') || text.includes('Connecting to')) {
        const sshMatch = text.match(/ssh\s+(?:-[^\s]+\s+)*([^\s@]+@[^\s]+)/);
        if (sshMatch) {
          onTargetChange(`ssh://${sshMatch[1]}`);
        }
      }
    });
    return cleanup;
  }, [onTargetChange, onCwdChange]);


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

    // Initial fit
    setTimeout(handleResize, 100)
    
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
  );
}

export default TerminalView;