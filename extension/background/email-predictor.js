/* eslint-disable no-console */
/**
 * Lightweight AI prediction helper for extension background usage.
 * This module is optional and can be used by the main service worker
 * to request person-level ranked email candidates from /api/predict-email.
 */

const EMAIL_PREDICTOR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_PREDICTOR_CACHE_PREFIX = 'prediction_';

async function predictEmail(contactData, options = {}) {
  const apiBaseUrl = String(options.apiBaseUrl || '').trim();
  const authToken = String(options.authToken || '').trim();
  if (!apiBaseUrl) {
    throw new Error('predictEmail requires apiBaseUrl');
  }

  const firstName = String(contactData?.firstName || '').trim();
  const lastName = String(contactData?.lastName || '').trim();
  const companyName = String(contactData?.companyName || '').trim();
  const companyDomain = String(contactData?.companyDomain || '').trim().toLowerCase();

  if (!firstName || !companyDomain) {
    throw new Error('predictEmail requires firstName and companyDomain');
  }

  const cached = await getCachedPrediction(companyDomain, firstName, lastName);
  if (cached && isCacheFresh(cached.timestamp)) {
    return {
      success: true,
      source: 'cache',
      prediction: cached.data?.prediction || cached.data || null,
      metadata: cached.data?.metadata || null,
      cost: cached.data?.debug?.estimatedCost || 0,
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/predict-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName,
        lastName,
        companyName,
        companyDomain,
        role: String(contactData?.role || '').trim() || undefined,
        linkedinUrl: String(contactData?.linkedinUrl || '').trim() || undefined,
      }),
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      const status = response.status;
      const error = new Error(payload?.error || `Email prediction failed: ${status}`);
      error.status = status;
      throw error;
    }

    await cachePrediction(companyDomain, firstName, lastName, payload);

    return {
      success: true,
      source: 'ai',
      prediction: payload.prediction || null,
      metadata: payload.metadata || null,
      cost: payload?.debug?.estimatedCost || 0,
    };
  } catch (error) {
    console.warn('[AI Predictor] predictEmail failed, returning heuristic fallback:', error);
    return {
      success: false,
      source: 'heuristic',
      error: error?.message || 'Prediction failed',
      prediction: generateHeuristicPatterns({
        firstName,
        lastName,
        companyDomain,
      }),
    };
  }
}

function generateHeuristicPatterns(contactData) {
  const first = String(contactData?.firstName || '').trim().toLowerCase();
  const last = String(contactData?.lastName || '').trim().toLowerCase();
  const domain = String(contactData?.companyDomain || '').trim().toLowerCase();
  const firstInitial = first[0] || '';

  return {
    patterns: [
      {
        email: `${first}.${last}@${domain}`,
        pattern: 'first.last',
        confidence: 55,
        reasoning: 'Most common heuristic fallback.',
      },
      {
        email: `${first}${last}@${domain}`,
        pattern: 'firstlast',
        confidence: 45,
        reasoning: 'Common heuristic alternative.',
      },
      {
        email: `${first}@${domain}`,
        pattern: 'first',
        confidence: 35,
        reasoning: 'Frequent at small companies.',
      },
      {
        email: `${firstInitial}${last}@${domain}`,
        pattern: 'flast',
        confidence: 25,
        reasoning: 'Initial + last-name fallback.',
      },
    ],
    topRecommendation: `${first}.${last}@${domain}`,
    recommendationReasoning: 'Fallback recommendation using common global patterns.',
  };
}

async function cachePrediction(domain, firstName, lastName, data) {
  const cacheKey = getPredictionCacheKey(domain, firstName, lastName);
  await chrome.storage.local.set({
    [cacheKey]: {
      data,
      timestamp: Date.now(),
    },
  });
}

async function getCachedPrediction(domain, firstName, lastName) {
  const cacheKey = getPredictionCacheKey(domain, firstName, lastName);
  const stored = await chrome.storage.local.get([cacheKey]);
  return stored?.[cacheKey] || null;
}

function getPredictionCacheKey(domain, firstName, lastName) {
  return `${EMAIL_PREDICTOR_CACHE_PREFIX}${String(domain || '').toLowerCase()}_${String(firstName || '').toLowerCase()}_${String(lastName || '').toLowerCase()}`;
}

function isCacheFresh(timestamp) {
  const ts = Number(timestamp || 0);
  return Number.isFinite(ts) && Date.now() - ts < EMAIL_PREDICTOR_CACHE_TTL_MS;
}

if (typeof self !== 'undefined') {
  self.predictEmail = predictEmail;
  self.generateHeuristicPatterns = generateHeuristicPatterns;
}
