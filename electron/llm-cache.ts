import type { GroupedLlmSuggestion } from '../types/messages'
import { config } from './config'

interface CacheEntry {
  key: string
  suggestion: GroupedLlmSuggestion
  timestamp: number
  hits: number
}

export class LlmCache {
  private cache: Map<string, CacheEntry> = new Map()
  private ttl: number

  constructor() {
    this.ttl = config.env.LLM_CACHE_TTL * 1000 // Convert seconds to milliseconds
    
    // Clean expired entries every minute
    setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  generateKey(tail: string, context?: string): string {
    // Create a hash-like key from tail and context
    const content = tail + (context || '')
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim()
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36)
  }

  get(key: string): GroupedLlmSuggestion | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hits++
    
    return entry.suggestion
  }

  set(key: string, suggestion: GroupedLlmSuggestion): void {
    const entry: CacheEntry = {
      key,
      suggestion,
      timestamp: Date.now(),
      hits: 0
    }

    this.cache.set(key, entry)
    
    // LRU eviction if cache gets too large
    if (this.cache.size > 100) {
      this.evictLeastRecentlyUsed()
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  clear(): void {
    this.cache.clear()
  }

  getStats(): {
    size: number
    ttl: number
    entries: Array<{
      key: string
      age: number
      hits: number
    }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      age: now - entry.timestamp,
      hits: entry.hits
    }))

    return {
      size: this.cache.size,
      ttl: this.ttl,
      entries
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
    
    if (keysToDelete.length > 0) {
      console.log(`LLM Cache: Cleaned up ${keysToDelete.length} expired entries`)
    }
  }

  private evictLeastRecentlyUsed(): void {
    // Find the entry with lowest hits and oldest timestamp
    let lruKey: string | null = null
    let lruScore = Infinity

    for (const [key, entry] of this.cache.entries()) {
      // Score based on hits and age (lower is worse)
      const ageScore = Date.now() - entry.timestamp
      const hitScore = entry.hits > 0 ? 1000000 / entry.hits : 1000000
      const score = hitScore + (ageScore / 1000) // Age in seconds
      
      if (score < lruScore) {
        lruScore = score
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
      console.log(`LLM Cache: Evicted LRU entry ${lruKey}`)
    }
  }
}