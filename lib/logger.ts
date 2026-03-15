export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogFields = Record<string, unknown>

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function normalizeLevel(value: unknown, fallback: LogLevel): LogLevel {
  const candidate = String(value || '').trim().toLowerCase()
  if (candidate === 'debug' || candidate === 'info' || candidate === 'warn' || candidate === 'error') {
    return candidate
  }
  return fallback
}

function defaultLevel(): LogLevel {
  const fromEnv = normalizeLevel(process.env.LOG_LEVEL, 'info')
  if (process.env.LOG_LEVEL) return fromEnv
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

export function sanitizeLogFields(fields?: LogFields): LogFields | undefined {
  if (!fields || typeof fields !== 'object') return undefined

  const allowedKeyPattern = /(id|count|size|length|status|stage|reason|code|type|source|attempt|duration|ms|url|origin|domain|provider|confidence|cached|success|error|warning|token|cost)/i
  const output: LogFields = {}

  for (const [key, value] of Object.entries(fields)) {
    if (!allowedKeyPattern.test(key)) continue

    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value
      continue
    }

    if (Array.isArray(value)) {
      output[key] = value.length
      continue
    }

    if (typeof value === 'object') {
      output[key] = Object.keys(value).length
    }
  }

  return Object.keys(output).length > 0 ? output : undefined
}

export function createLogger(scope: string, options: { level?: LogLevel } = {}) {
  let activeLevel = normalizeLevel(options.level, defaultLevel())

  function write(level: LogLevel, message: string, fields?: LogFields) {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[activeLevel]) return

    const prefix = `[${scope}] ${message}`
    const payload = sanitizeLogFields(fields)

    if (level === 'error') {
      console.error(prefix, payload ?? '')
      return
    }

    if (level === 'warn') {
      console.warn(prefix, payload ?? '')
      return
    }

    console.log(prefix, payload ?? '')
  }

  return {
    setLevel(nextLevel: LogLevel) {
      activeLevel = normalizeLevel(nextLevel, activeLevel)
    },
    debug(message: string, fields?: LogFields) {
      write('debug', message, fields)
    },
    info(message: string, fields?: LogFields) {
      write('info', message, fields)
    },
    warn(message: string, fields?: LogFields) {
      write('warn', message, fields)
    },
    error(message: string, fields?: LogFields) {
      write('error', message, fields)
    },
  }
}
