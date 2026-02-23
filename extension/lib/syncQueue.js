/* eslint-disable no-console */
(function initContactSyncQueue(globalScope) {
  const BRIDGE_KEY = 'ellynContactSyncQueue';
  const SYNC_QUEUE_KEY = 'sync_queue';
  const SYNC_STATUS_KEY = 'sync_status';
  const SYNC_LOG_KEY = 'sync_log';
  const LAST_SYNC_AT_KEY = 'last_sync_at';
  const SYNC_QUEUE_ALARM_NAME = 'ellyn-contact-sync-queue';
  const MAX_SYNC_QUEUE_ITEMS = 500;
  const MAX_SYNC_LOG_ITEMS = 50;
  const BADGE_COLOR = '#eab308';
  const IS_DEV =
    typeof process !== 'undefined' &&
    process?.env?.NODE_ENV === 'development';

  let isProcessingQueue = false;

  async function storageGet(keys) {
    const data = await chrome.storage.local.get(keys);
    return data || {};
  }

  async function storageSet(payload) {
    await chrome.storage.local.set(payload);
  }

  function debugSyncLog(...args) {
    if (!IS_DEV) return;
    console.log('[ELLYN SYNC]', ...args);
  }

  function toErrorMessage(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    return String(error?.message || '');
  }

  function sanitizeContactData(contactData) {
    return {
      firstName: String(contactData?.firstName || '').trim(),
      lastName: String(contactData?.lastName || '').trim(),
      company: String(contactData?.company || '').trim(),
      designation: String(contactData?.designation || '').trim(),
      role: String(contactData?.role || '').trim(),
      linkedinUrl: String(contactData?.linkedinUrl || '').trim(),
      headline: String(contactData?.headline || '').trim(),
      photoUrl: String(contactData?.photoUrl || '').trim(),
      email: String(contactData?.email || '').trim(),
      emailConfidence: Number(contactData?.emailConfidence),
      emailVerified: contactData?.emailVerified === true,
      emailSource: String(contactData?.emailSource || '').trim(),
      companyDomain: String(contactData?.companyDomain || '').trim(),
    };
  }

  function resolveContactName(contactData) {
    const first = String(contactData?.firstName || '').trim();
    const last = String(contactData?.lastName || '').trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
    return 'Unknown Contact';
  }

  async function appendSyncLog(entry) {
    const stored = await storageGet([SYNC_LOG_KEY]);
    const currentLog = Array.isArray(stored?.[SYNC_LOG_KEY]) ? stored[SYNC_LOG_KEY] : [];
    const normalizedStatus = String(entry?.status || '').trim();
    const safeStatus =
      normalizedStatus === 'success' || normalizedStatus === 'queued'
        ? normalizedStatus
        : 'failed';
    const nextEntry = {
      timestamp: String(entry?.timestamp || new Date().toISOString()),
      contactName: String(entry?.contactName || 'Unknown Contact'),
      status: safeStatus,
      error: toErrorMessage(entry?.error) || undefined,
    };

    currentLog.unshift(nextEntry);
    await storageSet({
      [SYNC_LOG_KEY]: currentLog.slice(0, MAX_SYNC_LOG_ITEMS),
    });
  }

  async function markLastSyncAt(timestamp = new Date().toISOString()) {
    await storageSet({
      [LAST_SYNC_AT_KEY]: String(timestamp),
    });
  }

  function buildQueueFingerprint(contactData, localId = '') {
    const normalized = sanitizeContactData(contactData);
    const id = String(localId || '').trim();
    if (id) return `local:${id}`;
    return [
      normalized.firstName.toLowerCase(),
      normalized.lastName.toLowerCase(),
      normalized.company.toLowerCase(),
      normalized.email.toLowerCase(),
    ].join('|');
  }

  async function getQueue() {
    const stored = await storageGet([SYNC_QUEUE_KEY]);
    return Array.isArray(stored?.[SYNC_QUEUE_KEY]) ? stored[SYNC_QUEUE_KEY] : [];
  }

  async function setQueue(queue) {
    const nextQueue = Array.isArray(queue) ? queue.slice(0, MAX_SYNC_QUEUE_ITEMS) : [];
    await storageSet({ [SYNC_QUEUE_KEY]: nextQueue });
    return nextQueue;
  }

  async function getQueueCount() {
    const queue = await getQueue();
    return queue.length;
  }

  async function setBadgeCount(count) {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    try {
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      await chrome.action.setBadgeText({
        text: safeCount > 0 ? String(Math.min(99, safeCount)) : '',
      });
    } catch (error) {
      console.warn('[SyncQueue] Failed to update badge:', error);
    }
  }

  async function updateSyncStatus(status, extras = {}) {
    const stored = await storageGet([SYNC_STATUS_KEY]);
    const current = stored?.[SYNC_STATUS_KEY] && typeof stored[SYNC_STATUS_KEY] === 'object'
      ? stored[SYNC_STATUS_KEY]
      : {};

    const nextState = {
      ...current,
      ...extras,
      lastSyncStatus: String(status || '').trim() || current.lastSyncStatus || null,
      lastSyncAt: new Date().toISOString(),
    };

    await storageSet({ [SYNC_STATUS_KEY]: nextState });
    return nextState;
  }

  function getSyncBridge() {
    return globalScope?.ellynContactSync || null;
  }

  async function enqueueContact(contactData, options = {}) {
    const localId = String(options?.localId || '').trim();
    const queue = await getQueue();
    const fingerprint = buildQueueFingerprint(contactData, localId);

    const existingIndex = queue.findIndex((entry) => entry?.fingerprint === fingerprint);
    const nowIso = new Date().toISOString();
    const nextEntry = {
      id:
        String(options?.queueItemId || '').trim() ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      localId,
      fingerprint,
      contactData: sanitizeContactData(contactData),
      queuedAt: nowIso,
      lastAttemptAt: nowIso,
      attempts: Number(options?.attempts || 0),
      lastErrorType: 'network',
      lastErrorMessage: toErrorMessage(options?.error),
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = {
        ...queue[existingIndex],
        ...nextEntry,
        attempts: Number(queue[existingIndex]?.attempts || 0) + 1,
      };
    } else {
      queue.unshift(nextEntry);
    }

    const nextQueue = await setQueue(queue);
    await setBadgeCount(nextQueue.length);
    await updateSyncStatus('queued', {
      queueCount: nextQueue.length,
      lastErrorType: 'network',
      lastErrorMessage: toErrorMessage(options?.error),
    });
    await appendSyncLog({
      contactName: resolveContactName(contactData),
      status: 'queued',
      error: options?.error,
    });
    debugSyncLog('Queued contact for retry', {
      contactName: resolveContactName(contactData),
      queueCount: nextQueue.length,
    });
    return nextQueue.length;
  }

  async function dequeueByLocalId(localId) {
    const normalizedLocalId = String(localId || '').trim();
    if (!normalizedLocalId) {
      return getQueue();
    }
    const queue = await getQueue();
    const nextQueue = queue.filter((entry) => String(entry?.localId || '').trim() !== normalizedLocalId);
    if (nextQueue.length === queue.length) {
      return queue;
    }
    return setQueue(nextQueue);
  }

  async function saveOrQueueContact(contactData, options = {}) {
    const syncBridge = getSyncBridge();
    if (!syncBridge || typeof syncBridge.saveContactToSupabase !== 'function') {
      return {
        ok: false,
        status: 'failed',
        data: null,
        error: 'Supabase sync bridge unavailable',
        queueCount: await getQueueCount(),
      };
    }

    const result = await syncBridge.saveContactToSupabase(contactData);
    const queueCountBefore = await getQueueCount();

    if (!result?.error) {
      const localId = String(options?.localId || '').trim();
      if (localId) {
        await dequeueByLocalId(localId);
      }
      const queueCount = await getQueueCount();
      await setBadgeCount(queueCount);
      const nowIso = new Date().toISOString();
      await markLastSyncAt(nowIso);
      await updateSyncStatus('success', {
        queueCount,
        lastErrorType: null,
        lastErrorMessage: null,
      });
      await appendSyncLog({
        timestamp: nowIso,
        contactName: resolveContactName(contactData),
        status: 'success',
      });
      debugSyncLog('Contact synced successfully', {
        contactName: resolveContactName(contactData),
        queueCount,
      });
      return {
        ok: true,
        status: 'synced',
        data: result.data || null,
        error: null,
        queueCount,
      };
    }

    const errorType = String(result?.errorType || '').trim() || 'unknown';
    const errorMessage = toErrorMessage(result?.error);

    if (errorType === 'auth') {
      await setBadgeCount(queueCountBefore);
      await updateSyncStatus('auth_failed', {
        queueCount: queueCountBefore,
        lastErrorType: 'auth',
        lastErrorMessage: errorMessage || 'Authentication required',
      });
      await appendSyncLog({
        contactName: resolveContactName(contactData),
        status: 'failed',
        error: errorMessage || 'Authentication required',
      });
      debugSyncLog('Contact sync blocked by auth', {
        contactName: resolveContactName(contactData),
      });
      return {
        ok: false,
        status: 'auth_failed',
        data: null,
        error: errorMessage || 'Not authenticated',
        queueCount: queueCountBefore,
      };
    }

    if (errorType === 'network') {
      const queueCount = await enqueueContact(contactData, {
        localId: options?.localId,
        error: result.error,
      });
      return {
        ok: false,
        status: 'queued',
        queued: true,
        data: null,
        error: errorMessage || 'Queued for retry',
        queueCount,
      };
    }

    await setBadgeCount(queueCountBefore);
    await updateSyncStatus('failed', {
      queueCount: queueCountBefore,
      lastErrorType: errorType,
      lastErrorMessage: errorMessage || 'Sync failed',
    });
    await appendSyncLog({
      contactName: resolveContactName(contactData),
      status: 'failed',
      error: errorMessage || 'Sync failed',
    });
    debugSyncLog('Contact sync failed', {
      contactName: resolveContactName(contactData),
      errorType,
    });
    return {
      ok: false,
      status: 'failed',
      data: null,
      error: errorMessage || 'Sync failed',
      queueCount: queueCountBefore,
    };
  }

  async function processQueue() {
    if (isProcessingQueue) {
      return {
        ok: true,
        skipped: true,
        reason: 'already_processing',
      };
    }

    isProcessingQueue = true;
    try {
      const syncBridge = getSyncBridge();
      if (!syncBridge || typeof syncBridge.saveContactToSupabase !== 'function') {
        return {
          ok: false,
          skipped: true,
          reason: 'sync_bridge_unavailable',
        };
      }

      const queue = await getQueue();
      if (queue.length === 0) {
        await setBadgeCount(0);
        return {
          ok: true,
          processed: 0,
          synced: 0,
          queueCount: 0,
        };
      }

      const nextQueue = [];
      let processed = 0;
      let synced = 0;
      let authBlocked = false;
      let networkPending = false;

      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        processed += 1;

        const result = await syncBridge.saveContactToSupabase(item?.contactData || {});
        if (!result?.error) {
          synced += 1;
          await appendSyncLog({
            contactName: resolveContactName(item?.contactData),
            status: 'success',
          });
          continue;
        }

        const errorType = String(result?.errorType || '').trim() || 'unknown';
        const nextItem = {
          ...item,
          attempts: Number(item?.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastErrorType: errorType,
          lastErrorMessage: toErrorMessage(result?.error),
        };

        if (errorType === 'auth') {
          authBlocked = true;
          await appendSyncLog({
            contactName: resolveContactName(item?.contactData),
            status: 'failed',
            error: result?.error,
          });
          nextQueue.push(nextItem);
          nextQueue.push(...queue.slice(index + 1));
          break;
        }

        if (errorType === 'network') {
          networkPending = true;
          await appendSyncLog({
            contactName: resolveContactName(item?.contactData),
            status: 'queued',
            error: result?.error,
          });
          nextQueue.push(nextItem);
          continue;
        }

        // Keep unknown errors in queue for manual retry.
        await appendSyncLog({
          contactName: resolveContactName(item?.contactData),
          status: 'failed',
          error: result?.error,
        });
        nextQueue.push(nextItem);
      }

      const storedQueue = await setQueue(nextQueue);
      const queueCount = storedQueue.length;
      await setBadgeCount(queueCount);

      if (authBlocked) {
        await updateSyncStatus('auth_failed', {
          queueCount,
          lastErrorType: 'auth',
          lastErrorMessage: 'Authentication required to sync queued contacts',
        });
      } else if (queueCount > 0 || networkPending) {
        await updateSyncStatus('queued', {
          queueCount,
          lastErrorType: 'network',
        });
      } else if (synced > 0) {
        await markLastSyncAt();
        await updateSyncStatus('success', {
          queueCount: 0,
          lastErrorType: null,
          lastErrorMessage: null,
        });
      }

      return {
        ok: true,
        processed,
        synced,
        queueCount,
        authBlocked,
      };
    } catch (error) {
      console.warn('[SyncQueue] processQueue failed:', error);
      debugSyncLog('Queue processing failed', {
        error: toErrorMessage(error),
      });
      return {
        ok: false,
        error: toErrorMessage(error) || 'Queue processing failed',
      };
    } finally {
      isProcessingQueue = false;
    }
  }

  async function initialize() {
    const queueCount = await getQueueCount();
    await setBadgeCount(queueCount);

    if (chrome?.alarms?.create) {
      try {
        chrome.alarms.create(SYNC_QUEUE_ALARM_NAME, {
          periodInMinutes: 0.5,
        });
      } catch (error) {
        console.warn('[SyncQueue] Failed to create sync queue alarm:', error);
      }
    }
  }

  globalScope[BRIDGE_KEY] = {
    SYNC_QUEUE_KEY,
    SYNC_STATUS_KEY,
    SYNC_LOG_KEY,
    LAST_SYNC_AT_KEY,
    SYNC_QUEUE_ALARM_NAME,
    initialize,
    getQueue,
    getQueueCount,
    saveOrQueueContact,
    processQueue,
    setBadgeCount,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
