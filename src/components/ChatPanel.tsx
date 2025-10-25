import React, { useEffect, useState } from 'react'

/** ===== window.ai 전역 타입 선언 (이 파일에서만 적용) ===== */
declare global {
  interface Window {
    ai: {
      request: (channel: string, ...args: any[]) => Promise<any>;
      on?: (channel: string, listener: (payload: any) => void) => () => void;
      off?: (channel: string, listener: (payload: any) => void) => void;
      list?: () => { invoke: string[]; events: string[] };
    };
  }
}
// 모듈로 인식시키기 위한 공백 export
export {}

interface CommandHistoryItem {
  id: string
  command: string
  timestamp: string
  exitCode?: number
}

interface LlmSuggestion {
  id: string
  title: string
  commands: string[]
}

export default function ChatPanel() {
  const [history, setHistory] = useState<CommandHistoryItem[]>([])
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<LlmSuggestion[]>([])

  /** 초기 진입 시 최근 히스토리 5개 로드 */
  useEffect(() => {
    (async () => {
      try {
        const recent = await window.ai.request('history:recent', 5)
        setHistory(Array.isArray(recent) ? recent : [])
      } catch (err) {
        console.error('Failed to load history:', err)
      }
    })()
  }, [])

  /** LLM 제안 수신 리스너 */
  useEffect(() => {
    if (!window.ai.on) return

    const handleLlmSuggestion = (suggestion: LlmSuggestion) => {
      console.log('[LLM_SUGGESTION]', suggestion)
      setOutput(prev => [...prev, `[AI] ${suggestion.title || 'Suggestion received'}`])
      setAiSuggestions(prev => [...prev.slice(-4), suggestion]) // Keep last 5
    }

    const cleanup = window.ai.on('llm:suggestion', handleLlmSuggestion)
    return cleanup
  }, [])

  /** 명령 실행 (로컬 PowerShell) */
  const handleRun = async () => {
    const cmd = input.trim()
    if (!cmd) return

    const id = 'ui-' + Date.now()
    setOutput(prev => [...prev, `> ${cmd}`])

    try {
      await window.ai.request('run', { id, target: 'local', cwd: null, cmd, mode: 'raw' })
      const recent = await window.ai.request('history:recent', 5)
      setHistory(Array.isArray(recent) ? recent : [])
    } catch (e) {
      setOutput(prev => [...prev, `ERROR: ${(e as any)?.message ?? e}`])
    } finally {
      setInput('')
    }
  }

  /** ===== 스타일 (엄격한 React.CSSProperties 타입 사용) ===== */
  const s = {
    container: {
      display: 'flex',
      flexDirection: 'column' as React.CSSProperties['flexDirection'],
      height: '100%',
      background: '#1e1e1e',
      color: '#eee'
    } satisfies React.CSSProperties,

    historyBox: {
      borderBottom: '1px solid #333',
      padding: '8px 12px',
      background: '#252525'
    } satisfies React.CSSProperties,

    historyTitle: {
      fontWeight: 600,
      marginBottom: 4
    } satisfies React.CSSProperties,

    historyItem: {
      cursor: 'pointer',
      padding: '2px 0',
      fontSize: 13,
      color: '#ccc'
    } satisfies React.CSSProperties,

    body: {
      flex: 1,
      overflow: 'auto',
      padding: '10px 12px',
      fontFamily: 'Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13 as React.CSSProperties['fontSize']
    } satisfies React.CSSProperties,

    inputSection: {
      borderTop: '1px solid #2a2a2a',
      padding: '10px 12px'
    } satisfies React.CSSProperties,

    inputForm: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 8,
      alignItems: 'center'
    } satisfies React.CSSProperties,

    textarea: {
      resize: 'vertical' as React.CSSProperties['resize'],
      minHeight: 56,
      maxHeight: 160,
      background: '#2a2a2a',
      color: '#eee',
      border: 'none',
      padding: '8px',
      borderRadius: 4
    } satisfies React.CSSProperties,

    runButton: {
      background: '#007acc',
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      padding: '8px 16px',
      cursor: 'pointer'
    } satisfies React.CSSProperties,

    aiSuggestionsBox: {
      borderTop: '1px solid #333',
      padding: '8px 12px',
      background: '#2a2a2a',
      maxHeight: '150px',
      overflow: 'auto'
    } satisfies React.CSSProperties,

    aiTitle: {
      fontWeight: 600,
      marginBottom: 8,
      color: '#9f7aea'
    } satisfies React.CSSProperties,

    aiSuggestion: {
      marginBottom: 8,
      padding: '6px 8px',
      background: '#333',
      borderRadius: 4,
      borderLeft: '3px solid #9f7aea'
    } satisfies React.CSSProperties,

    aiSuggestionTitle: {
      fontSize: 12,
      color: '#ccc',
      marginBottom: 4
    } satisfies React.CSSProperties,

    aiCommand: {
      cursor: 'pointer',
      padding: '2px 4px',
      margin: '2px 0',
      background: '#1e1e1e',
      borderRadius: 3,
      fontSize: 12,
      fontFamily: 'Consolas, monospace',
      color: '#d7ba7d',
      border: '1px solid #444'
    } satisfies React.CSSProperties
  }

  return (
    <div style={s.container}>
      {/* === 히스토리 패널 === */}
      <div style={s.historyBox}>
        <div style={s.historyTitle}>Recent Commands</div>
        {history.length === 0 ? (
          <div style={{ color: '#666', fontSize: 12 }}>No history yet</div>
        ) : (
          history.map(item => (
            <div
              key={item.id}
              style={s.historyItem}
              onClick={() => setInput(item.command)}
              title={`Exit ${item.exitCode ?? '-'} | ${item.timestamp}`}
            >
              {item.command}
            </div>
          ))
        )}
      </div>

      {/* === 출력 영역 === */}
      <div style={s.body}>
        {output.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* === AI 제안 영역 === */}
      {aiSuggestions.length > 0 && (
        <div style={s.aiSuggestionsBox}>
          <div style={s.aiTitle}>AI Suggestions</div>
          {aiSuggestions.map((suggestion, index) => (
            <div key={suggestion.id || index} style={s.aiSuggestion}>
              <div style={s.aiSuggestionTitle}>{suggestion.title}</div>
              {suggestion.commands?.map((command, cmdIndex) => (
                <div
                  key={cmdIndex}
                  style={s.aiCommand}
                  onClick={() => setInput(command)}
                  title="Click to copy to input"
                >
                  {command}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* === 입력창 === */}
      <div style={s.inputSection}>
        <form
          style={s.inputForm}
          onSubmit={e => {
            e.preventDefault()
            handleRun()
          }}
        >
          <textarea
            style={s.textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter command and press Run (Ctrl+Enter to submit in future enhancements)"
          />
          <button style={s.runButton} type="submit">
            Run
          </button>
        </form>
      </div>
    </div>
  )
}
