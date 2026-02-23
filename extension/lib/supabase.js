/* eslint-disable no-console */
(function initExtensionSupabaseAuth(globalScope) {
  const SUPABASE_URL = 'https://bgknhoxicrxgqzraregj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Wh5SfZ81Qd4acYcMPtXEkQ_E0IvwP2B';
  const BRIDGE_KEY = 'ellynSupabaseAuthBridge';

  function buildStorageKey(url) {
    try {
      const hostname = new URL(url).hostname;
      const projectRef = hostname.split('.')[0];
      if (!projectRef) return 'supabase.auth.token';
      return `sb-${projectRef}-auth-token`;
    } catch {
      return 'supabase.auth.token';
    }
  }

  function createChromeStorageAdapter() {
    return {
      async getItem(key) {
        try {
          const result = await chrome.storage.local.get([key]);
          const value = result?.[key];
          return typeof value === 'string' ? value : null;
        } catch {
          return null;
        }
      },
      async setItem(key, value) {
        await chrome.storage.local.set({
          [key]: String(value),
        });
      },
      async removeItem(key) {
        await chrome.storage.local.remove([key]);
      },
    };
  }

  if (!globalScope?.supabase?.createClient) {
    console.warn('[Extension] Supabase UMD client not available.');
    globalScope[BRIDGE_KEY] = null;
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Extension] Missing Supabase configuration for extension auth bridge.');
    globalScope[BRIDGE_KEY] = null;
    return;
  }

  const storageKey = buildStorageKey(SUPABASE_URL);
  const storage = createChromeStorageAdapter();
  const client = globalScope.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage,
      storageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function setSession(session) {
    const accessToken = String(session?.access_token || '').trim();
    const refreshToken = String(session?.refresh_token || '').trim();

    if (!accessToken || !refreshToken) {
      throw new Error('Invalid session payload');
    }

    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data?.session || null;
  }

  async function clearSession() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function getAccessToken() {
    const session = await getSession();
    return typeof session?.access_token === 'string' ? session.access_token : '';
  }

  async function hasStoredSession() {
    const raw = await storage.getItem(storageKey);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.access_token === 'string' && parsed.access_token.length > 0;
    } catch {
      return false;
    }
  }

  globalScope[BRIDGE_KEY] = {
    client,
    storageKey,
    getSession,
    setSession,
    clearSession,
    getAccessToken,
    hasStoredSession,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
