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

interface GroupedLlmSuggestion {
  id: string
  title: string
  suggestions: {
    next_steps: string[]
    error_resolution: string[]
    information_gathering: string[]
  }
}

export default function ChatPanel() {
  // 자동입력 실행 여부 플래그
  const [autoInputExecuted, setAutoInputExecuted] = useState(false);
  
  // 앱 시작 시 입력창 자동 채움 및 실행 (렌더링 후 1초 뒤 실행)
  const [history, setHistory] = useState<CommandHistoryItem[]>([])
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<GroupedLlmSuggestion[]>([])

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

    const handleLlmSuggestion = (suggestion: GroupedLlmSuggestion) => {
      console.log('[LLM_SUGGESTION]', suggestion)
      setOutput(prev => [...prev, `[AI] ${suggestion.title || 'Suggestion received'}`])
      setAiSuggestions(prev => [...prev.slice(-4), suggestion]) // Keep last 5
    }

    const cleanup = window.ai.on('llm:suggestion', handleLlmSuggestion)
    return cleanup
  }, [])

  /** 자동입력: 앱 시작 2초 후 입력창에 표시하고 실행 */
  useEffect(() => {
    // 이미 실행되었으면 스킵
    if (autoInputExecuted) {
      console.log('[자동입력] 이미 실행됨, 스킵');
      return;
    }
    
    console.log('[ChatPanel] 자동입력 타이머 설정 시작');
    
    const timer = setTimeout(() => {
      const testCmd = '파일 목록 보여줘';
      console.log('[자동입력] 타이머 작동! 입력창에 표시:', testCmd);
      
      // 입력창에 표시
      setInput(testCmd);
      console.log('[자동입력] setInput 호출 완료');
      
      // 2초 후 실행 (사용자가 볼 수 있도록)
      setTimeout(async () => {
        console.log('[자동입력] 명령 실행 시작');
        try {
          // 로그 먼저 남기기
          await window.ai.request('logUserInput', testCmd);
          console.log('[자동입력] 로그 기록 완료');
          
          // GPT를 통해 명령어 변환
          const llmResponse = await window.ai.request('llm:convert', {
            userInput: testCmd,
            context: 'PowerShell 명령 변환'
          });
          
          const id = 'auto-' + Date.now();
          
          if (llmResponse && llmResponse.command) {
            console.log('[자동입력] GPT 변환 완료:', llmResponse.command);
            await window.ai.request('run', { 
              id, 
              target: 'local', 
              cwd: null, 
              cmd: llmResponse.command, 
              mode: 'raw' 
            });
          } else {
            console.log('[자동입력] GPT 변환 실패, 원본 실행');
            await window.ai.request('run', { 
              id, 
              target: 'local', 
              cwd: null, 
              cmd: testCmd, 
              mode: 'raw' 
            });
          }
          console.log('[자동입력] run 요청 완료');
          
          // 히스토리 갱신
          const recent = await window.ai.request('history:recent', 5);
          setHistory(Array.isArray(recent) ? recent : []);
          console.log('[자동입력] 히스토리 갱신 완료');
          
          // 실행 후 입력창 비우기
          setInput('');
          setAutoInputExecuted(true);
          console.log('[자동입력] 전체 프로세스 완료!');
        } catch (err) {
          console.error('[자동입력] 실패:', err);
        }
      }, 2000);
    }, 2000);
    
    return () => {
      console.log('[자동입력] 타이머 정리');
      clearTimeout(timer);
    };
  }, [autoInputExecuted]);

  /** 명령 실행 (GPT를 통한 자연어 해석) */
    const handleRun = async (delayClear?: boolean) => {
      const cmd = input.trim()
      if (!cmd) return

      // 즉시 입력창 비우기 (반응성 향상)
      const commandToExecute = cmd;
      setInput('');

      // 입력 로그 전송: IPC가 반드시 전달되도록 await 사용
      try {
        if (window.ai) {
          await window.ai.request('logUserInput', commandToExecute)
        }
      } catch (logErr) {
        // 로그 전송 실패는 무시
      }

      const id = 'ui-' + Date.now()
      setOutput(prev => [...prev, `[사용자] ${commandToExecute}`])

      try {
        // GPT API를 통해 자연어를 PowerShell 명령으로 변환
        const llmResponse = await window.ai.request('llm:convert', {
          userInput: commandToExecute,
          context: 'PowerShell 명령 변환'
        });

        if (llmResponse && llmResponse.command) {
          const powershellCmd = llmResponse.command;
          const explanation = llmResponse.explanation || '';
          
          setOutput(prev => [...prev, `[AI] ${explanation}`])
          setOutput(prev => [...prev, `[실행] ${powershellCmd}`])
          
          await window.ai.request('run', { 
            id, 
            target: 'local', 
            cwd: null, 
            cmd: powershellCmd, 
            mode: 'raw' 
          })
        } else {
          // GPT 변환 실패 시 원본 명령어 그대로 실행 (이미 PowerShell 명령어인 경우)
          setOutput(prev => [...prev, `[실행] ${commandToExecute}`])
          await window.ai.request('run', { 
            id, 
            target: 'local', 
            cwd: null, 
            cmd: commandToExecute, 
            mode: 'raw' 
          })
        }

        const recent = await window.ai.request('history:recent', 5)
        setHistory(Array.isArray(recent) ? recent : [])
      } catch (e) {
        setOutput(prev => [...prev, `[오류] ${(e as any)?.message ?? e}`])
      }
      // 입력창은 이미 위에서 비웠으므로 finally 불필요
    }

  /** ===== 스타일 (엄격한 React.CSSProperties 타입 사용) ===== */
  const s = {
    container: {
      display: 'flex',
      flexDirection: 'column' as React.CSSProperties['flexDirection'],
      height: '100%',
      background: '#252526',
      color: '#d4d4d4'
    } satisfies React.CSSProperties,

    historyBox: {
      borderBottom: '1px solid #3e3e42',
      padding: '8px 12px',
      background: '#2d2d30'
    } satisfies React.CSSProperties,

    historyTitle: {
      fontWeight: 600,
      marginBottom: 4,
      color: '#ffffff',
      fontSize: 14
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
      borderTop: '1px solid #3e3e42',
      padding: '12px',
      background: '#2d2d30'
    } satisfies React.CSSProperties,

    inputForm: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 8,
      alignItems: 'center'
    } satisfies React.CSSProperties,

    textarea: {
      resize: 'vertical' as React.CSSProperties['resize'],
      minHeight: 40,
      maxHeight: 120,
      background: '#1e1e1e',
      color: '#d4d4d4',
      border: '1px solid #3e3e42',
      padding: '8px',
      borderRadius: 4,
      fontFamily: 'inherit',
      fontSize: 14,
      outline: 'none'
    } satisfies React.CSSProperties,

    runButton: {
      background: '#0e639c',
      color: '#ffffff',
      border: 'none',
      borderRadius: 4,
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: 14,
      alignSelf: 'flex-end' as React.CSSProperties['alignSelf']
    } satisfies React.CSSProperties,

    aiSuggestionsBox: {
      borderTop: '1px solid #3e3e42',
      padding: '8px 12px',
      background: '#2d2d30',
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
      border: '1px solid #444',
      flex: 1,
      marginRight: 4
    } satisfies React.CSSProperties,

    suggestionGroup: {
      marginBottom: 12
    } satisfies React.CSSProperties,

    groupTitle: {
      fontSize: 11,
      fontWeight: 600,
      color: '#9f7aea',
      marginBottom: 4,
      textTransform: 'uppercase' as React.CSSProperties['textTransform']
    } satisfies React.CSSProperties,

    commandGrid: {
      display: 'grid',
      gap: 4
    } satisfies React.CSSProperties,

    commandRow: {
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      gap: 4,
      alignItems: 'center'
    } satisfies React.CSSProperties,

    actionButton: {
      background: '#666',
      color: '#fff',
      border: 'none',
      borderRadius: 3,
      padding: '2px 6px',
      cursor: 'pointer',
      fontSize: 10,
      minWidth: 20,
      height: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    } satisfies React.CSSProperties
  }

  return (
    <div style={s.container}>
      {/* === 히스토리 패널 === */}
      <div style={s.historyBox}>
        <div style={s.historyTitle}>Recent Commands</div>
        {history.length === 0 ? (
          <div style={{ color: '#666', fontSize: 12 }}>파일 목록 보여줘</div>
        ) : (
          history.map(item => (
            <div
              key={item.id}
              style={s.historyItem}
              onClick={() => setInput(item.command)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#094771';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#ccc';
              }}
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
              
              {/* Next Steps Group */}
              {suggestion.suggestions.next_steps.length > 0 && (
                <div style={s.suggestionGroup}>
                  <div style={s.groupTitle}>🚀 Next Steps</div>
                  <div style={s.commandGrid}>
                    {suggestion.suggestions.next_steps.map((command, cmdIndex) => (
                      <div key={cmdIndex} style={s.commandRow}>
                        <div
                          style={s.aiCommand}
                          onClick={() => setInput(command)}
                          title="Click to copy to input"
                        >
                          {command}
                        </div>
                        <button
                          style={s.actionButton}
                          onClick={() => setInput(command)}
                          title="Copy to input"
                        >
                          📋
                        </button>
                        <button
                          style={{...s.actionButton, background: '#0e639c'}}
                          onClick={async () => {
                            setInput(command)
                            setTimeout(() => handleRun(), 100)
                          }}
                          title="Execute command"
                        >
                          ▶
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Resolution Group */}
              {suggestion.suggestions.error_resolution.length > 0 && (
                <div style={s.suggestionGroup}>
                  <div style={s.groupTitle}>🔧 Error Resolution</div>
                  <div style={s.commandGrid}>
                    {suggestion.suggestions.error_resolution.map((command, cmdIndex) => (
                      <div key={cmdIndex} style={s.commandRow}>
                        <div
                          style={s.aiCommand}
                          onClick={() => setInput(command)}
                          title="Click to copy to input"
                        >
                          {command}
                        </div>
                        <button
                          style={s.actionButton}
                          onClick={() => setInput(command)}
                          title="Copy to input"
                        >
                          📋
                        </button>
                        <button
                          style={{...s.actionButton, background: '#d73a49'}}
                          onClick={async () => {
                            setInput(command)
                            setTimeout(() => handleRun(), 100)
                          }}
                          title="Execute command"
                        >
                          ▶
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Information Gathering Group */}
              {suggestion.suggestions.information_gathering.length > 0 && (
                <div style={s.suggestionGroup}>
                  <div style={s.groupTitle}>🔍 Information Gathering</div>
                  <div style={s.commandGrid}>
                    {suggestion.suggestions.information_gathering.map((command, cmdIndex) => (
                      <div key={cmdIndex} style={s.commandRow}>
                        <div
                          style={s.aiCommand}
                          onClick={() => setInput(command)}
                          title="Click to copy to input"
                        >
                          {command}
                        </div>
                        <button
                          style={s.actionButton}
                          onClick={() => setInput(command)}
                          title="Copy to input"
                        >
                          📋
                        </button>
                        <button
                          style={{...s.actionButton, background: '#28a745'}}
                          onClick={async () => {
                            setInput(command)
                            setTimeout(() => handleRun(), 100)
                          }}
                          title="Execute command"
                        >
                          ▶
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            autoFocus
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleRun()
              }
            }}
            placeholder="Enter PowerShell command or ask AI for help..."
          />
          <button style={s.runButton} type="submit">
            Run
          </button>
        </form>
      </div>
    </div>
  )
}
