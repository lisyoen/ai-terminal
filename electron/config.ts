import { config as loadDotenv } from 'dotenv'

// Load environment variables from .env file
loadDotenv()

export const config = {
  // Shell configuration
  DEFAULT_SHELL: 'pwsh',
  LOCAL_PROMPT_TOKEN: 'PS',
  REMOTE_PROMPT_TOKEN: '__AI_PROMPT_REMOTE__',
  
  // Snapshot configuration
  TAIL_N: 80,
  QUIET_TIMEOUT: 10000, // 10 seconds
  MAX_BYTES_PER_STEP: 65536, // 64KB
  
  // Event markers
  EVENT_MARKERS: {
    START: '__AI_EVT__',
    END: '__AI_EVT__',
    SEPARATOR: ':'
  },
  
  // Auto-send policies
  AUTO_SEND_TRIGGERS: ['onExit', 'onError'] as Array<'onExit' | 'onError' | 'onPrompt' | 'onTimeout' | 'onVolume'>,
  
  // Error detection patterns
  ERROR_PATTERNS: [
    /error/i,
    /failed/i,
    /exception/i,
    /traceback/i,
    /fatal/i,
    /cannot/i,
    /permission denied/i,
    /command not found/i,
    /no such file/i
  ],
  
  // Secret patterns for redaction
  SECRET_PATTERNS: [
    /(?:password|pwd|pass)\s*[:=]\s*["']?(\S+)["']?/gi,
    /(?:token|key|secret)\s*[:=]\s*["']?(\S+)["']?/gi,
    /(?:api[_-]?key)\s*[:=]\s*["']?(\S+)["']?/gi,
    /(?:auth[_-]?token)\s*[:=]\s*["']?(\S+)["']?/gi,
    // SSH keys
    /-----BEGIN[^-]+PRIVATE KEY-----[\s\S]+?-----END[^-]+PRIVATE KEY-----/gi,
    // Common secret formats
    /[a-zA-Z0-9]{32,}/g // Generic long alphanumeric strings
  ],

  // Environment variables
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    NODE_ENV: process.env.NODE_ENV || 'development',
    VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173',
    LLM_CACHE_TTL: parseInt(process.env.LLM_CACHE_TTL || '300'),
    LLM_CONTEXT_DEPTH: parseInt(process.env.LLM_CONTEXT_DEPTH || '5')
  }
}