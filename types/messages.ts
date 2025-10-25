import { z } from 'zod'

// Base types
export const RunRequestSchema = z.object({
  id: z.string(),
  target: z.enum(['local', 'ssh']).or(z.string().regex(/^ssh:\/\/[\w\.-]+@[\w\.-]+(:\d+)?$/)),
  cwd: z.string().optional(),
  cmd: z.string(),
  mode: z.enum(['normal', 'dryrun', 'elevate']).optional().default('normal')
})

export const TerminalChunkSchema = z.object({
  id: z.string(),
  text: z.string()
})

export const SnapshotSummarySchema = z.object({
  exitCode: z.number().optional(),
  elapsedMs: z.number(),
  bytes: z.number()
})

export const RedactionSchema = z.object({
  type: z.enum(['secret', 'ansi']),
  original: z.string(),
  masked: z.string(),
  start: z.number(),
  end: z.number()
})

export const SnapshotReadySchema = z.object({
  id: z.string(),
  trigger: z.enum(['onExit', 'onError', 'onPrompt', 'onTimeout', 'onVolume']),
  summary: SnapshotSummarySchema,
  tail: z.string(),
  redactions: z.array(RedactionSchema)
})

export const LlmSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  commands: z.array(z.string())
})

export const ErrorSchema = z.object({
  id: z.string(),
  message: z.string()
})

// Type exports
export type RunRequest = z.infer<typeof RunRequestSchema>
export type TerminalChunk = z.infer<typeof TerminalChunkSchema>
export type SnapshotSummary = z.infer<typeof SnapshotSummarySchema>
export type Redaction = z.infer<typeof RedactionSchema>
export type SnapshotReady = z.infer<typeof SnapshotReadySchema>
export type LlmSuggestion = z.infer<typeof LlmSuggestionSchema>
export type ErrorMessage = z.infer<typeof ErrorSchema>

// IPC Channel names
export const IPC_CHANNELS = {
  RUN_COMMAND: 'run',
  TERMINAL_CHUNK: 'terminal:chunk',
  SNAPSHOT_READY: 'snapshot:ready',
  LLM_SUGGESTION: 'llm:suggestion',
  ERROR: 'error'
} as const

// Message validation utilities
export const validateMessage = {
  runRequest: (data: unknown): RunRequest => RunRequestSchema.parse(data),
  terminalChunk: (data: unknown): TerminalChunk => TerminalChunkSchema.parse(data),
  snapshotReady: (data: unknown): SnapshotReady => SnapshotReadySchema.parse(data),
  llmSuggestion: (data: unknown): LlmSuggestion => LlmSuggestionSchema.parse(data),
  error: (data: unknown): ErrorMessage => ErrorSchema.parse(data)
}