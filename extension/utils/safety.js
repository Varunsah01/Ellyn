/**
 * Safety guardrails — in-memory rate limiter for email lookups.
 * Sliding window: 10 requests per 60 seconds.
 */

const SAFETY_CONFIG = { windowMs: 60000, maxRequests: 10 };
const _timestamps = [];

function isRateLimited() {
  const now = Date.now();
  while (_timestamps.length && _timestamps[0] < now - SAFETY_CONFIG.windowMs) {
    _timestamps.shift();
  }
  if (_timestamps.length >= SAFETY_CONFIG.maxRequests) {
    return { limited: true, retryAfterMs: SAFETY_CONFIG.windowMs - (now - _timestamps[0]) };
  }
  _timestamps.push(now);
  return { limited: false };
}

globalThis.safetyGuard = { isRateLimited };
