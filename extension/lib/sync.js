/* eslint-disable no-console */
(function initContactSyncBridge(globalScope) {
  const BRIDGE_KEY = 'ellynContactSync';
  const AUTH_SOURCE_ORIGIN_KEY = 'ellyn_auth_origin';
  const IS_DEV =
    typeof process !== 'undefined' &&
    process?.env?.NODE_ENV === 'development';
  const DEFAULT_EXTENSION_API_ORIGINS = [
    'http://localhost:3000',
    'https://www.useellyn.com',
    'https://app.ellyn.ai',
    'https://app.ellyn.app',
  ];

  function getAuthBridge() {
    const bridge = globalScope?.ellynSupabaseAuthBridge;
    if (!bridge || typeof bridge !== 'object') return null;
    return bridge;
  }

  function debugSyncLog(...args) {
    if (!IS_DEV) return;
    console.log('[ELLYN SYNC]', ...args);
  }

  function getSupabaseClient() {
    const bridge = getAuthBridge();
    return bridge?.client || null;
  }

  async function getAccessTokenFromBridge() {
    const bridge = getAuthBridge();
    if (!bridge) return '';

    try {
      if (typeof bridge.getAccessToken === 'function') {
        const token = await bridge.getAccessToken();
        const normalizedToken = String(token || '').trim();
        if (normalizedToken) return normalizedToken;
      }
    } catch {
      // Ignore and continue fallback token lookups.
    }

    try {
      if (bridge.client?.auth?.getSession) {
        const { data } = await bridge.client.auth.getSession();
        const token = String(data?.session?.access_token || '').trim();
        if (token) return token;
      }
    } catch {
      // Ignore and report unauthenticated if token is unavailable.
    }

    return '';
  }

  function normalizeHttpOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
      const parsed = new URL(raw);
      if (!['https:', 'http:'].includes(parsed.protocol)) return '';
      return parsed.origin;
    } catch {
      return '';
    }
  }

  async function resolveFallbackApiOrigins() {
    const origins = [];
    const seen = new Set();

    const pushOrigin = (candidate) => {
      const normalized = normalizeHttpOrigin(candidate);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      origins.push(normalized);
    };

    try {
      const stored = await chrome.storage.local.get([AUTH_SOURCE_ORIGIN_KEY]);
      pushOrigin(stored?.[AUTH_SOURCE_ORIGIN_KEY]);
    } catch {
      // Ignore storage failures and rely on defaults.
    }

    DEFAULT_EXTENSION_API_ORIGINS.forEach((origin) => pushOrigin(origin));
    return origins;
  }

  function toNullableString(value) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  function toNullableNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value == null) return fallback;
    return Boolean(value);
  }

  function classifySyncError(error) {
    if (!error) return 'unknown';
    const status = Number(error?.status || error?.code || 0);
    const message = String(error?.message || '').toLowerCase();

    if (
      status === 401 ||
      status === 403 ||
      message.includes('not authenticated') ||
      message.includes('jwt') ||
      message.includes('token') ||
      message.includes('auth')
    ) {
      return 'auth';
    }

    if (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('abort') ||
      message.includes('temporarily unavailable') ||
      status === 408 ||
      status === 429 ||
      status >= 500
    ) {
      return 'network';
    }

    return 'unknown';
  }

  function classifyFallbackHttpStatus(status) {
    const numericStatus = Number(status);
    if (numericStatus === 401 || numericStatus === 403) {
      return 'auth';
    }
    if (numericStatus === 408 || numericStatus >= 500) {
      return 'network';
    }
    if (numericStatus === 429) {
      // Rate limit should fail fast and not be queued indefinitely.
      return 'unknown';
    }
    return 'unknown';
  }

  function buildContactUpsertPayload(contactData, userId) {
    const customFields =
      contactData?.customFields &&
      typeof contactData.customFields === 'object' &&
      !Array.isArray(contactData.customFields)
        ? contactData.customFields
        : {};

    return {
      user_id: userId,
      first_name: toNullableString(contactData?.firstName) || 'Unknown',
      last_name: toNullableString(contactData?.lastName) || 'Contact',
      company: toNullableString(contactData?.company) || 'Unknown',
      role: toNullableString(contactData?.designation) || toNullableString(contactData?.role),
      linkedin_url: toNullableString(contactData?.linkedinUrl),
      linkedin_headline: toNullableString(contactData?.headline),
      linkedin_photo_url: toNullableString(contactData?.photoUrl),
      inferred_email: toNullableString(contactData?.email),
      email_confidence: toNullableNumber(contactData?.emailConfidence),
      email_verified: toBoolean(contactData?.emailVerified, false),
      email_source: toNullableString(contactData?.emailSource),
      company_domain: toNullableString(contactData?.companyDomain),
      source: 'extension',
      status: 'new',
      tags: [],
      custom_fields: customFields,
    };
  }

  async function saveContactViaExtensionApi(contactData, accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) {
      return {
        data: null,
        error: { message: 'Not authenticated' },
        errorType: 'auth',
      };
    }

    const apiOrigins = await resolveFallbackApiOrigins();
    if (apiOrigins.length === 0) {
      return {
        data: null,
        error: { message: 'No extension API origin configured for fallback sync' },
        errorType: 'unknown',
      };
    }

    let lastResult = {
      data: null,
      error: { message: 'Extension API fallback failed' },
      errorType: 'network',
    };

    for (const origin of apiOrigins) {
      const endpoint = `${origin}/api/extension/sync-contact`;
      try {
        debugSyncLog('Attempting API fallback contact sync', { endpoint });
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactData),
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (response.ok) {
          debugSyncLog('Contact synced via API fallback', { endpoint });
          return {
            data: payload?.contact || payload?.data?.contact || payload?.data || payload || null,
            error: null,
            errorType: null,
          };
        }

        const errorMessage =
          String(payload?.error || '').trim() ||
          `Fallback sync failed with status ${response.status}`;
        const errorType = classifyFallbackHttpStatus(response.status);
        const result = {
          data: null,
          error: { message: errorMessage, status: response.status },
          errorType,
        };
        lastResult = result;
        debugSyncLog('API fallback sync failed', {
          endpoint,
          status: response.status,
          errorType,
          error: errorMessage,
        });

        // Non-route errors can still succeed on a different origin.
        if (response.status === 404 || response.status === 405 || response.status >= 500) {
          continue;
        }

        return result;
      } catch (error) {
        debugSyncLog('API fallback sync request failed', {
          endpoint,
          error: String(error?.message || 'Fallback sync request failed'),
        });
        lastResult = {
          data: null,
          error: { message: String(error?.message || 'Fallback sync request failed') },
          errorType: 'network',
        };
      }
    }

    return lastResult;
  }

  async function saveContactToSupabase(contactData) {
    const client = getSupabaseClient();
    const accessToken = await getAccessTokenFromBridge();
    debugSyncLog('Starting contact sync', {
      hasDirectClient: Boolean(client),
      hasAccessToken: Boolean(accessToken),
    });

    if (!client) {
      const fallbackResult = await saveContactViaExtensionApi(contactData, accessToken);
      if (!fallbackResult?.error) {
        void sendHeartbeat();
      }
      return fallbackResult;
    }

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError) {
      const errorType = classifySyncError(userError);
      if (errorType !== 'auth') {
        const fallbackResult = await saveContactViaExtensionApi(contactData, accessToken);
        if (!fallbackResult?.error) {
          return fallbackResult;
        }
      }
      return {
        data: null,
        error: userError,
        errorType,
      };
    }

    if (!user) {
      return {
        data: null,
        error: { message: 'Not authenticated' },
        errorType: 'auth',
      };
    }

    const payload = buildContactUpsertPayload(contactData, user.id);

    const { data, error } = await client
      .from('contacts')
      .upsert(payload, {
        onConflict: 'user_id,first_name,last_name,company',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      const errorType = classifySyncError(error);
      debugSyncLog('Direct Supabase sync failed', {
        errorType,
        error: String(error?.message || ''),
      });
      if (errorType !== 'auth') {
        const fallbackResult = await saveContactViaExtensionApi(contactData, accessToken);
        if (!fallbackResult?.error) {
          void sendHeartbeat();
          return fallbackResult;
        }
      }
      return {
        data: null,
        error,
        errorType,
      };
    }

    debugSyncLog('Contact saved via direct Supabase client');
    void sendHeartbeat();
    return {
      data,
      error: null,
      errorType: null,
    };
  }

  async function sendHeartbeat() {
    const client = getSupabaseClient();
    if (!client?.auth?.getUser || !client?.rpc) {
      return {
        ok: false,
        error: 'Supabase client unavailable',
      };
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user?.id) {
        debugSyncLog('Heartbeat skipped: user unavailable', {
          error: String(userError?.message || ''),
        });
        return {
          ok: false,
          error: userError?.message || 'Not authenticated',
        };
      }

      const { error } = await client.rpc('extension_heartbeat', {
        p_user_id: user.id,
      });

      if (error) {
        debugSyncLog('Heartbeat RPC failed', {
          error: String(error?.message || ''),
        });
        return {
          ok: false,
          error: error.message || 'Heartbeat failed',
        };
      }

      debugSyncLog('Heartbeat recorded', { userId: user.id });
      return {
        ok: true,
      };
    } catch (error) {
      debugSyncLog('Heartbeat request failed', {
        error: String(error?.message || 'Heartbeat failed'),
      });
      return {
        ok: false,
        error: String(error?.message || 'Heartbeat failed'),
      };
    }
  }

  globalScope[BRIDGE_KEY] = {
    saveContactToSupabase,
    sendHeartbeat,
    classifySyncError,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
