import { useState, useRef, useEffect } from 'react'
import type { SnapshotReady, LlmSuggestion, ErrorMessage } from '../../types/messages'
import { IpcBridge } from '../ipc-bridge'

interface ChatPanelProps {
  onRunCommand: (command: string, target?: string) => void
  snapshots: SnapshotReady[]
  suggestions: LlmSuggestion[]
  errors: ErrorMessage[]
  isExecuting?: boolean
}

interface Message {
  id: string
  type: 'user' | 'system' | 'suggestion' | 'error'
  content: string
  timestamp: Date
  commands?: string[]
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration: number
}

function ChatPanel({ onRunCommand, snapshots, suggestions, errors, isExecuting = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [target, setTarget] = useState('local')
  const [sshTarget, setSshTarget] = useState('')
  const [recentCommands, setRecentCommands] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Convert snapshots to messages and show toast
  useEffect(() => {
    const newMessages: Message[] = snapshots.map(snapshot => ({
      id: `snapshot-${snapshot.id}`,
      type: 'system',
      content: `[${snapshot.trigger}] ${snapshot.summary.exitCode !== undefined ? 
        `Exit code: ${snapshot.summary.exitCode}, ` : ''}${snapshot.summary.elapsedMs}ms, ${snapshot.summary.bytes} bytes`,
      timestamp: new Date(),
      commands: []
    }))

    setMessages((prev: Message[]) => [...prev, ...newMessages].slice(-50)) // Keep last 50 messages
    
    // Show toast for new snapshots
    if (newMessages.length > 0) {
      addToast('결과 저장됨', 'success', 2000)
    }
  }, [snapshots])

  // Convert suggestions to messages
  useEffect(() => {
    const newMessages: Message[] = suggestions.map(suggestion => ({
      id: `suggestion-${suggestion.id}`,
      type: 'suggestion',
      content: suggestion.title,
      timestamp: new Date(),
      commands: suggestion.commands
    }))

    setMessages((prev: Message[]) => [...prev, ...newMessages].slice(-50))
  }, [suggestions])

  // Convert errors to messages
  useEffect(() => {
    const newMessages: Message[] = errors.map(error => ({
      id: `error-${error.id}`,
      type: 'error',
      content: error.message,
      timestamp: new Date(),
      commands: []
    }))

    setMessages((prev: Message[]) => [...prev, ...newMessages].slice(-50))
  }, [errors])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load recent commands on mount
  useEffect(() => {
    loadRecentCommands()
  }, [])

  const addToast = (message: string, type: Toast['type'], duration: number = 3000) => {
    const id = `toast-${Date.now()}`
    const toast: Toast = { id, message, type, duration }
    
    setToasts(prev => [...prev, toast])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }

  const loadRecentCommands = async () => {
    try {
      const commands = await IpcBridge.getRecentCommands(10)
      setRecentCommands(commands)
    } catch (error) {
      console.error('Failed to load recent commands:', error)
    }
  }

  const handleHistoryCommand = (command: string) => {
    setInputValue(command)
    setShowHistory(false)
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'ArrowUp' && e.ctrlKey) {
      e.preventDefault()
      try {
        const previousCommand = await IpcBridge.getPreviousCommand(inputValue)
        if (previousCommand) {
          setInputValue(previousCommand)
        }
      } catch (error) {
        console.error('Failed to get previous command:', error)
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
      commands: []
    }

    setMessages((prev: Message[]) => [...prev, userMessage])

    // Check if the input contains code blocks or commands
    const codeBlocks = extractCodeBlocks(inputValue)
    if (codeBlocks.length > 0) {
      // Add system message with executable commands
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        type: 'system',
        content: `Found ${codeBlocks.length} command${codeBlocks.length > 1 ? 's' : ''}:`,
        timestamp: new Date(),
        commands: codeBlocks
      }
      setMessages((prev: Message[]) => [...prev, systemMessage])
    }

    setInputValue('')
  }

  const extractCodeBlocks = (text: string): string[] => {
    const codeBlockRegex = /```(?:bash|sh|powershell|cmd)?\n?([\s\S]*?)```/g
    const inlineCodeRegex = /`([^`]+)`/g
    const commands: string[] = []
    
    let match
    
    // Extract code blocks
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const code = match[1].trim()
      if (code) {
        commands.push(...code.split('\n').filter(line => line.trim()))
      }
    }
    
    // Extract inline code if no code blocks found
    if (commands.length === 0) {
      while ((match = inlineCodeRegex.exec(text)) !== null) {
        const code = match[1].trim()
        if (code && code.includes(' ') && !code.includes('@') && !code.includes('.')) {
          // Simple heuristic: if it contains spaces and isn't an email/filename, might be a command
          commands.push(code)
        }
      }
    }
    
    return commands
  }

  const handleRunCommandClick = (command: string) => {
    const executionTarget = target === 'ssh' ? `ssh://${sshTarget}` : undefined
    onRunCommand(command, executionTarget)
    
    // Add confirmation message
    const confirmMessage: Message = {
      id: `confirm-${Date.now()}`,
      type: 'system',
      content: `Executing on ${target === 'ssh' ? `SSH ${sshTarget}` : 'local'}: ${command}`,
      timestamp: new Date(),
      commands: []
    }
    setMessages((prev: Message[]) => [...prev, confirmMessage])
  }

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getMessageClassName = (type: Message['type']): string => {
    const baseClass = 'message'
    switch (type) {
      case 'user': return `${baseClass} message-user`
      case 'system': return `${baseClass} message-system`
      case 'suggestion': return `${baseClass} message-suggestion`
      case 'error': return `${baseClass} message-error`
      default: return baseClass
    }
  }

  return (
    <div className={`chat-panel ${isExpanded ? 'expanded' : ''}`}>
      <div className="chat-header">
        <h2>AI Assistant</h2>
        {isExecuting && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Executing...</span>
          </div>
        )}
        <button 
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '⬅' : '➡'}
        </button>
      </div>

      <div className="target-selector">
        <label>
          <strong>Target:</strong>
        </label>
        <div className="target-options">
          <label className="target-option">
            <input
              type="radio"
              name="target"
              value="local"
              checked={target === 'local'}
              onChange={(e) => setTarget(e.target.value)}
            />
            Local PowerShell
          </label>
          <label className="target-option">
            <input
              type="radio"
              name="target"
              value="ssh"
              checked={target === 'ssh'}
              onChange={(e) => setTarget(e.target.value)}
            />
            SSH Remote
          </label>
        </div>
        {target === 'ssh' && (
          <div className="ssh-input">
            <input
              type="text"
              placeholder="user@hostname"
              value={sshTarget}
              onChange={(e) => setSshTarget(e.target.value)}
              className="ssh-target-input"
            />
          </div>
        )}
      </div>
      
      <div className="chat-messages">
        {messages.map((message: Message) => (
          <div key={message.id} className={getMessageClassName(message.type)}>
            <div className="message-header">
              <span className="message-type">{message.type}</span>
              <span className="message-time">{formatTimestamp(message.timestamp)}</span>
            </div>
            <div className="message-content">
              {message.content}
            </div>
            {message.commands && message.commands.length > 0 && (
              <div className="message-commands">
                {message.commands.map((command, index) => (
                  <div key={index} className="command-item">
                    <code className="command-text">{command}</code>
                    <button 
                      className="run-button"
                      onClick={() => handleRunCommandClick(command)}
                      title={`Run on ${target === 'ssh' ? `SSH ${sshTarget}` : 'local'}`}
                      disabled={isExecuting || (target === 'ssh' && !sshTarget)}
                    >
                      ▶
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-section">
        <div className="input-controls">
          <button
            type="button"
            className="history-button"
            onClick={() => setShowHistory(!showHistory)}
            title="Command History (Ctrl+↑ for previous)"
          >
            📝
          </button>
          {showHistory && (
            <div className="history-dropdown">
              <div className="history-header">Recent Commands</div>
              {recentCommands.length > 0 ? (
                recentCommands.map((cmd, index) => (
                  <div 
                    key={index} 
                    className="history-item"
                    onClick={() => handleHistoryCommand(cmd.command)}
                  >
                    <div className="history-command">{cmd.command}</div>
                    <div className="history-meta">
                      {cmd.target} • {new Date(cmd.timestamp).toLocaleTimeString()}
                      {cmd.exitCode !== undefined && ` • exit ${cmd.exitCode}`}
                    </div>
                  </div>
                ))
              ) : (
                <div className="history-empty">No recent commands</div>
              )}
            </div>
          )}
        </div>
        
        <form className="chat-input" onSubmit={handleSubmit}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question or paste commands... (Ctrl+↑ for history)"
            rows={3}
            disabled={isExecuting}
            onKeyDown={handleKeyDown}
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim() || isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Send'}
          </button>
        </form>
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChatPanel