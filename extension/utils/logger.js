'use strict';

(function initEllynLogger(globalScope) {
  const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

  function normalizeLevel(value, fallback = 'info') {
    const candidate = String(value || '').trim().toLowerCase();
    return LEVELS[candidate] ? candidate : fallback;
  }

  function detectDefaultLevel() {
    const override = normalizeLevel(globalScope.ELLYN_LOG_LEVEL, '');
    if (override) return override;

    try {
      const fromStorage = normalizeLevel(globalScope.localStorage?.getItem('ellyn_log_level'), '');
      if (fromStorage) return fromStorage;
    } catch {
      // Ignore storage access errors.
    }

    return 'info';
  }

  function sanitizeFields(fields) {
    if (!fields || typeof fields !== 'object') return undefined;

    const allowedKeyPattern = /(id|count|size|length|status|stage|reason|code|type|source|tab|attempt|duration|ms|url|origin|domain|provider|confidence|cached|success|error|warning)/i;
    const output = {};

    for (const [key, value] of Object.entries(fields)) {
      if (!allowedKeyPattern.test(key)) continue;
      if (value == null) {
        output[key] = value;
        continue;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        output[key] = value;
        continue;
      }
      if (Array.isArray(value)) {
        output[key] = value.length;
        continue;
      }
      if (typeof value === 'object') {
        output[key] = Object.keys(value).length;
      }
    }

    return Object.keys(output).length ? output : undefined;
  }

  function createLogger(scope, options = {}) {
    let currentLevel = normalizeLevel(options.level, detectDefaultLevel());

    function write(level, message, fields) {
      const normalized = normalizeLevel(level, 'info');
      if (LEVELS[normalized] < LEVELS[currentLevel]) return;

      const payload = sanitizeFields(fields);
      const text = `[${scope}] ${message}`;
      if (normalized === 'error') {
        console.error(text, payload || '');
      } else if (normalized === 'warn') {
        console.warn(text, payload || '');
      } else {
        console.log(text, payload || '');
      }
    }

    return {
      setLevel(nextLevel) {
        currentLevel = normalizeLevel(nextLevel, currentLevel);
      },
      debug(message, fields) {
        write('debug', message, fields);
      },
      info(message, fields) {
        write('info', message, fields);
      },
      warn(message, fields) {
        write('warn', message, fields);
      },
      error(message, fields) {
        write('error', message, fields);
      },
    };
  }

  globalScope.EllynLogger = Object.freeze({
    createLogger,
    sanitizeFields,
  });
})(globalThis);
