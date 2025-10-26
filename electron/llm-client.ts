import type { SnapshotReady, LlmSuggestion, GroupedLlmSuggestion } from '../types/messages'
import { LlmContextManager } from './llm-context'
import { LlmCache } from './llm-cache'

export class LlmClient {
  private apiUrl: string
  private apiKey?: string
  private model: string
  private contextManager: LlmContextManager
  private cache: LlmCache

  constructor(apiUrl?: string, apiKey?: string, model?: string) {
    this.apiUrl = apiUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    this.apiKey = apiKey || process.env.OPENAI_API_KEY
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
    this.contextManager = new LlmContextManager()
    this.cache = new LlmCache()
  }

  async sendSnapshot(snapshot: SnapshotReady, context?: string): Promise<GroupedLlmSuggestion> {
    try {
      // Add snapshot to context
      this.contextManager.addSnapshot(snapshot)
      
      // Check cache first
      const contextForLlm = context || this.contextManager.getContextForLlm()
      const cacheKey = this.cache.generateKey(snapshot.tail, contextForLlm)
      
      const cached = this.cache.get(cacheKey)
      if (cached) {
        console.log('LLM: Using cached suggestion')
        return cached
      }

      // Check if API key is available
      if (!this.apiKey) {
        console.warn('No OpenAI API key found, using mock suggestions')
        const mockSuggestion = this.getMockSuggestion(snapshot)
        this.cache.set(cacheKey, mockSuggestion)
        return mockSuggestion
      }
      
      // Try real API call
      const response = await this.callLlmApi(snapshot)
      const suggestion = this.parseLlmResponse(response, snapshot.id)
      
      // Cache the result
      this.cache.set(cacheKey, suggestion)
      return suggestion
      
    } catch (error) {
      console.error('LLM API call failed:', error)
      const mockSuggestion = this.getMockSuggestion(snapshot)
      return mockSuggestion
    }
  }

  addCommandExecution(commandId: string, command: string, output: string, exitCode?: number) {
    this.contextManager.addCommandExecution(commandId, command, output, exitCode)
  }

  getContextManager(): LlmContextManager {
    return this.contextManager
  }

  getCacheStats() {
    return this.cache.getStats()
  }

  /** 사용자 질문을 GPT에게 전달하고 실행할 명령어 받기 */
  async convertUserQuestion(userInput: string, context?: string): Promise<{ command: string; explanation: string } | null> {
    try {
      if (!this.apiKey) {
        console.warn('No OpenAI API key found, using fallback conversion')
        return this.fallbackConversion(userInput)
      }

      const prompt = this.buildQuestionPrompt(userInput, context || '')
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }

      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant for Windows PowerShell terminal operations. Convert user questions into PowerShell commands. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      }

      const apiEndpoint = `${this.apiUrl}/chat/completions`
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        return this.fallbackConversion(userInput)
      }

      // JSON 파싱
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return this.fallbackConversion(userInput)
      }

      const parsed = JSON.parse(jsonMatch[0])
      return {
        command: parsed.command || '',
        explanation: parsed.explanation || ''
      }
    } catch (error) {
      console.error('Failed to convert user question:', error)
      return this.fallbackConversion(userInput)
    }
  }

  private buildQuestionPrompt(userInput: string, context: string): string {
    return `
User question: "${userInput}"

${context ? `Context:\n${context}\n` : ''}

Convert this question into a PowerShell command. Consider:
- The user is on Windows with PowerShell
- Provide the most appropriate PowerShell cmdlet or command
- Make it safe and informative

Respond with ONLY valid JSON in this format:
{
  "command": "the PowerShell command to execute",
  "explanation": "brief explanation of what the command does"
}

Examples:
- "디스크 용량은?" → {"command": "Get-PSDrive -PSProvider FileSystem", "explanation": "Shows disk space for all drives"}
- "파일 목록 보여줘" → {"command": "Get-ChildItem", "explanation": "Lists files and folders"}
`.trim()
  }

  private fallbackConversion(userInput: string): { command: string; explanation: string } | null {
    const lower = userInput.toLowerCase().trim()
    
    // 간단한 한글 명령어 매핑
    if (lower.includes('파일') && (lower.includes('목록') || lower.includes('리스트') || lower.includes('보여'))) {
      return { command: 'Get-ChildItem', explanation: '파일 목록을 표시합니다' }
    }
    if (lower.includes('디스크') && (lower.includes('용량') || lower.includes('남은') || lower.includes('공간'))) {
      return { command: 'Get-PSDrive -PSProvider FileSystem', explanation: '디스크 용량을 표시합니다' }
    }
    
    return null
  }

  private async callLlmApi(snapshot: SnapshotReady): Promise<any> {
    const prompt = this.buildPrompt(snapshot)
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant helping with terminal operations. Analyze the terminal output and suggest helpful commands or explanations. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    }

    const apiEndpoint = `${this.apiUrl}/chat/completions`
    console.log(`Calling LLM API: ${apiEndpoint}`)

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  private buildPrompt(snapshot: SnapshotReady): string {
    return `
Terminal Output Analysis:

Trigger: ${snapshot.trigger}
Command ID: ${snapshot.id}
Exit Code: ${snapshot.summary.exitCode ?? 'N/A'}
Duration: ${snapshot.summary.elapsedMs}ms
Bytes: ${snapshot.summary.bytes}

Terminal Output:
\`\`\`
${snapshot.tail}
\`\`\`

Based on this terminal output, please provide:
1. A brief title summarizing what happened
2. Up to 3 helpful PowerShell commands that might be useful next

Respond with ONLY valid JSON in this exact format:
{
  "title": "Brief description",
  "commands": ["command1", "command2", "command3"]
}
`.trim()
  }

  private parseLlmResponse(response: any, commandId: string): GroupedLlmSuggestion {
    try {
      const content = response.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in LLM response')
      }

      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        // If no JSON found, try parsing the entire content
        const parsed = JSON.parse(content.trim())
        return this.convertToGroupedSuggestion(commandId, parsed.title || 'LLM Suggestion', parsed.commands || [])
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return this.convertToGroupedSuggestion(commandId, parsed.title || 'LLM Suggestion', parsed.commands || [])
    } catch (error) {
      console.error('Failed to parse LLM response:', error)
      console.error('Response content:', response.choices?.[0]?.message?.content)
      return this.convertToGroupedSuggestion(commandId, 'Analysis Complete', [])
    }
  }

  private getMockSuggestion(snapshot: SnapshotReady): GroupedLlmSuggestion {
    const suggestions = this.generateMockSuggestions(snapshot)
    
    return {
      id: snapshot.id,
      title: suggestions.title,
      suggestions: suggestions.groupedCommands
    }
  }

  private convertToGroupedSuggestion(id: string, title: string, commands: string[]): GroupedLlmSuggestion {
    // Intelligently distribute commands into groups
    const suggestions = {
      next_steps: [] as string[],
      error_resolution: [] as string[],
      information_gathering: [] as string[]
    }

    commands.forEach((cmd, index) => {
      if (cmd.includes('sudo') || cmd.includes('chmod') || cmd.includes('fix') || cmd.includes('resolve')) {
        suggestions.error_resolution.push(cmd)
      } else if (cmd.includes('ls') || cmd.includes('pwd') || cmd.includes('which') || cmd.includes('find') || cmd.includes('grep')) {
        suggestions.information_gathering.push(cmd)
      } else {
        suggestions.next_steps.push(cmd)
      }
    })

    // Ensure each group has at least one command if any commands exist
    if (commands.length > 0 && suggestions.next_steps.length === 0) {
      suggestions.next_steps.push(commands[0])
    }

    return {
      id,
      title,
      suggestions
    }
  }

  private generateMockSuggestions(snapshot: SnapshotReady): { title: string; groupedCommands: { next_steps: string[]; error_resolution: string[]; information_gathering: string[] } } {
    const tail = snapshot.tail.toLowerCase()
    
    // Analyze common scenarios and provide relevant Windows PowerShell suggestions
    if (snapshot.trigger === 'onError') {
      if (tail.includes('permission denied') || tail.includes('access denied')) {
        return {
          title: '권한 오류 해결',
          groupedCommands: {
            error_resolution: ['Get-Acl .', 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser'],
            information_gathering: ['whoami', 'Get-Location', 'Get-ChildItem -Force'],
            next_steps: ['Set-Location ..']
          }
        }
      } else if (tail.includes('command not found') || tail.includes('not recognized')) {
        return {
          title: '명령어를 찾을 수 없음',
          groupedCommands: {
            error_resolution: ['Get-Command *keyword*', 'Get-Alias | Where-Object Name -like "*keyword*"'],
            information_gathering: ['$env:PATH', 'Get-Module -ListAvailable'],
            next_steps: ['Get-Help']
          }
        }
      } else if (tail.includes('no such file') || tail.includes('cannot find')) {
        return {
          title: '파일을 찾을 수 없음',
          groupedCommands: {
            error_resolution: ['Get-ChildItem -Recurse -Name "*filename*"', 'New-Item -ItemType File -Name "filename"'],
            information_gathering: ['Get-ChildItem -Force', 'Get-Location'],
            next_steps: ['New-Item -ItemType Directory -Name "newdir"']
          }
        }
      }
      
      return {
        title: '오류 발생',
        groupedCommands: {
          error_resolution: ['$LASTEXITCODE', 'Get-Error'],
          information_gathering: ['Get-History | Select-Object -Last 5', 'Get-Location'],
          next_steps: ['Get-ChildItem']
        }
      }
    }
    
    if (snapshot.trigger === 'onExit') {
      if (snapshot.summary.exitCode === 0) {
        return {
          title: '명령어 실행 완료',
          groupedCommands: {
            next_steps: ['Get-ChildItem', 'git status'],
            information_gathering: ['Get-Location', 'Write-Host "성공!"'],
            error_resolution: []
          }
        }
      } else {
        return {
          title: `명령어 실행 실패 (종료 코드: ${snapshot.summary.exitCode})`,
          groupedCommands: {
            error_resolution: ['$LASTEXITCODE', 'Get-History | Select-Object -Last 3'],
            information_gathering: ['Get-ChildItem', 'Get-Location'],
            next_steps: ['Get-Help']
          }
        }
      }
    }
    
    if (snapshot.trigger === 'onPrompt') {
      return {
        title: '다음 명령어 대기 중',
        groupedCommands: {
          next_steps: ['Get-ChildItem', 'Get-Location'],
          information_gathering: ['Get-History | Select-Object -Last 5', 'whoami'],
          error_resolution: []
        }
      }
    }
    
    if (snapshot.trigger === 'onTimeout') {
      return {
        title: '명령어 실행 중 (시간 초과)',
        groupedCommands: {
          error_resolution: ['Get-Process | Where-Object Name -like "*process*"', 'Get-Job'],
          information_gathering: ['Get-ComputerInfo', 'Get-Date'],
          next_steps: ['Wait-Job']
        }
      }
    }
    
    if (snapshot.trigger === 'onVolume') {
      return {
        title: '대용량 출력 감지',
        groupedCommands: {
          next_steps: ['Get-Content filename | Select-Object -Last 20', 'Get-Content filename | Out-GridView'],
          information_gathering: ['(Get-Content filename).Count', 'Get-Content filename | Select-Object -First 10'],
          error_resolution: []
        }
      }
    }
    
    return {
      title: '터미널 활동',
      groupedCommands: {
        next_steps: ['Get-ChildItem', 'Get-Location'],
        information_gathering: ['whoami', 'Get-Date'],
        error_resolution: []
      }
    }
  }
}