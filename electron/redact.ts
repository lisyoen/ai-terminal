import type { Redaction } from '../types/messages'
import { config } from './config'

export class Redactor {
  /**
   * Remove ANSI escape sequences and mask secrets in text
   */
  static redact(text: string): { clean: string; redactions: Redaction[] } {
    const redactions: Redaction[] = []
    
    // First pass: Remove ANSI escape sequences
    const { clean: ansiClean, redactions: ansiRedactions } = this.removeAnsi(text)
    redactions.push(...ansiRedactions)
    
    // Second pass: Mask secrets
    const { clean: secretClean, redactions: secretRedactions } = this.maskSecrets(ansiClean, redactions.length)
    redactions.push(...secretRedactions)
    
    return {
      clean: secretClean,
      redactions
    }
  }

  /**
   * Remove ANSI escape sequences
   */
  private static removeAnsi(text: string): { clean: string; redactions: Redaction[] } {
    const redactions: Redaction[] = []
    const ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]/g
    let match
    let offset = 0
    let clean = text

    while ((match = ansiPattern.exec(text)) !== null) {
      const redaction: Redaction = {
        type: 'ansi',
        original: match[0],
        masked: '',
        start: match.index - offset,
        end: match.index - offset + match[0].length
      }
      
      redactions.push(redaction)
      offset += match[0].length
    }

    // Remove all ANSI sequences
    clean = text.replace(ansiPattern, '')

    return { clean, redactions }
  }

  /**
   * Mask secrets in text
   */
  private static maskSecrets(text: string, startOffset = 0): { clean: string; redactions: Redaction[] } {
    const redactions: Redaction[] = []
    let clean = text

    for (const pattern of config.SECRET_PATTERNS) {
      let match
      pattern.lastIndex = 0 // Reset regex state
      
      while ((match = pattern.exec(text)) !== null) {
        const original = match[0]
        const masked = this.createMask(original)
        
        const redaction: Redaction = {
          type: 'secret',
          original,
          masked,
          start: match.index + startOffset,
          end: match.index + original.length + startOffset
        }
        
        redactions.push(redaction)
        
        // Replace in clean text
        clean = clean.replace(original, masked)
        
        // Prevent infinite loops with global patterns
        if (!pattern.global) break
      }
    }

    return { clean, redactions }
  }

  /**
   * Create a mask for sensitive data
   */
  private static createMask(original: string): string {
    if (original.length <= 4) {
      return '*'.repeat(original.length)
    }
    
    // Show first and last character, mask the middle
    const start = original.charAt(0)
    const end = original.charAt(original.length - 1)
    const middle = '*'.repeat(Math.max(3, original.length - 2))
    
    return `${start}${middle}${end}`
  }

  /**
   * Check if text contains potentially sensitive information
   */
  static containsSensitiveData(text: string): boolean {
    return config.SECRET_PATTERNS.some(pattern => {
      pattern.lastIndex = 0
      return pattern.test(text)
    })
  }

  /**
   * Apply redactions to recreate original text
   */
  static applyRedactions(clean: string, redactions: Redaction[]): string {
    let result = clean
    
    // Sort redactions by start position (descending) to avoid offset issues
    const sortedRedactions = redactions
      .filter(r => r.type === 'secret') // Only apply secret redactions for restoration
      .sort((a, b) => b.start - a.start)
    
    for (const redaction of sortedRedactions) {
      const before = result.substring(0, redaction.start)
      const after = result.substring(redaction.end)
      result = before + redaction.original + after
    }
    
    return result
  }
}