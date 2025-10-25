import type { SnapshotReady, LlmSuggestion } from '../types/messages'
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

  async sendSnapshot(snapshot: SnapshotReady, context?: string): Promise<LlmSuggestion> {
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

  private parseLlmResponse(response: any, commandId: string): LlmSuggestion {
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
        return {
          id: commandId,
          title: parsed.title || 'LLM Suggestion',
          commands: Array.isArray(parsed.commands) ? parsed.commands : []
        }
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        id: commandId,
        title: parsed.title || 'LLM Suggestion',
        commands: Array.isArray(parsed.commands) ? parsed.commands : []
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error)
      console.error('Response content:', response.choices?.[0]?.message?.content)
      return {
        id: commandId,
        title: 'Analysis Complete',
        commands: []
      }
    }
  }

  private getMockSuggestion(snapshot: SnapshotReady): LlmSuggestion {
    const suggestions = this.generateMockSuggestions(snapshot)
    
    return {
      id: snapshot.id,
      title: suggestions.title,
      commands: suggestions.commands
    }
  }

  private generateMockSuggestions(snapshot: SnapshotReady): { title: string; commands: string[] } {
    const tail = snapshot.tail.toLowerCase()
    
    // Analyze common scenarios and provide relevant suggestions
    if (snapshot.trigger === 'onError') {
      if (tail.includes('permission denied')) {
        return {
          title: 'Permission Denied Error',
          commands: ['sudo ls -la', 'chmod +x filename', 'whoami']
        }
      } else if (tail.includes('command not found')) {
        return {
          title: 'Command Not Found',
          commands: ['which commandname', 'type commandname', 'echo $PATH']
        }
      } else if (tail.includes('no such file')) {
        return {
          title: 'File Not Found',
          commands: ['ls -la', 'pwd', 'find . -name "filename"']
        }
      }
      
      return {
        title: 'Error Occurred',
        commands: ['echo $?', 'history | tail -5', 'pwd']
      }
    }
    
    if (snapshot.trigger === 'onExit') {
      if (snapshot.summary.exitCode === 0) {
        return {
          title: 'Command Completed Successfully',
          commands: ['ls -la', 'git status', 'echo "Next step?"']
        }
      } else {
        return {
          title: `Command Failed (Exit Code: ${snapshot.summary.exitCode})`,
          commands: ['echo $?', 'history | tail -3', 'ls -la']
        }
      }
    }
    
    if (snapshot.trigger === 'onPrompt') {
      return {
        title: 'Ready for Next Command',
        commands: ['ls', 'pwd', 'history | tail -5']
      }
    }
    
    if (snapshot.trigger === 'onTimeout') {
      return {
        title: 'Command Running (Timeout)',
        commands: ['ps aux | grep process', 'top', 'jobs']
      }
    }
    
    if (snapshot.trigger === 'onVolume') {
      return {
        title: 'Large Output Detected',
        commands: ['tail -20', 'wc -l', 'less filename']
      }
    }
    
    return {
      title: 'Terminal Activity',
      commands: ['ls', 'pwd', 'whoami']
    }
  }
}