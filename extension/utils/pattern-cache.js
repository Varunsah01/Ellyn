/* eslint-disable no-console */
/**
 * Pattern Cache for Ellyn Email Finder
 * IndexedDB-first with chrome.storage fallback.
 */

const DB_NAME = 'ellyn_email_finder';
const DB_VERSION = 1;
const PATTERN_STORE = 'patterns';
const LOOKUP_STORE = 'lookups';

const VERIFIED_BY_VALUES = new Set(['abstract_api', 'user_feedback', 'heuristic']);
const FEEDBACK_VALUES = new Set(['worked', 'failed', null]);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

class PatternCache {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.useStorageFallback = false;
    this.fallbackKeys = {
      patterns: 'ellyn_pattern_cache_patterns',
      lookups: 'ellyn_pattern_cache_lookups',
    };
    this.memoryFallback = {
      patterns: {},
      lookups: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initInternal();
    return this.initPromise;
  }

  async _initInternal() {
    this.log('Initializing PatternCache');

    if (!this.isIndexedDbAvailable()) {
      this.useStorageFallback = true;
      this.log('IndexedDB unavailable, using storage fallback');
      return this;
    }

    try {
      this.db = await this.openDatabase();
      this.useStorageFallback = false;
      this.log('IndexedDB initialized successfully');
    } catch (error) {
      this.useStorageFallback = true;
      this.log('IndexedDB init failed, using storage fallback', this.serializeError(error));
    }

    return this;
  }

  isIndexedDbAvailable() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      return false;
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
          const db = request.result;
          const transaction = request.transaction;
          const oldVersion = Number(event.oldVersion || 0);
          this.runMigrations(db, transaction, oldVersion);
        } catch (error) {
          reject(error);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          this.log('Database version changed, closing old connection');
          db.close();
          this.db = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        this.log('IndexedDB open blocked by another connection');
      };
    });
  }

  runMigrations(db, transaction, oldVersion) {
    this.log('Running IndexedDB migrations', { oldVersion, newVersion: DB_VERSION });

    // Version 1 initial schema.
    if (oldVersion < 1) {
      const patternStore = db.objectStoreNames.contains(PATTERN_STORE)
        ? transaction.objectStore(PATTERN_STORE)
        : db.createObjectStore(PATTERN_STORE, { keyPath: 'domain' });

      this.ensureIndex(patternStore, 'confidence', 'confidence', { unique: false });
      this.ensureIndex(patternStore, 'timestamp', 'timestamp', { unique: false });
      this.ensureIndex(patternStore, 'lastValidated', 'lastValidated', { unique: false });
      this.ensureIndex(patternStore, 'successCount', 'successCount', { unique: false });

      const lookupStore = db.objectStoreNames.contains(LOOKUP_STORE)
        ? transaction.objectStore(LOOKUP_STORE)
        : db.createObjectStore(LOOKUP_STORE, { keyPath: 'id', autoIncrement: true });

      this.ensureIndex(lookupStore, 'timestamp', 'timestamp', { unique: false });
      this.ensureIndex(lookupStore, 'domain', 'domain', { unique: false });
      this.ensureIndex(lookupStore, 'profileUrl', 'profileUrl', { unique: false });
      this.ensureIndex(lookupStore, 'source', 'source', { unique: false });
      this.ensureIndex(lookupStore, 'userFeedback', 'userFeedback', { unique: false });
    }

    // Future migration placeholder:
    // if (oldVersion < 2) { ... }
  }

  ensureIndex(store, indexName, keyPath, options) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, options);
    }
  }

  async ensureReady() {
    if (!this.initPromise) {
      await this.init();
      return;
    }
    await this.initPromise;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async getPattern(domain) {
    await this.ensureReady();
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) return null;

    this.log('getPattern', { domain: normalizedDomain, mode: this.useStorageFallback ? 'fallback' : 'idb' });

    if (this.useStorageFallback) {
      return this.getPatternFallback(normalizedDomain);
    }

    try {
      const tx = this.db.transaction(PATTERN_STORE, 'readonly');
      const done = this.transactionDone(tx);
      const store = tx.objectStore(PATTERN_STORE);
      const result = await this.requestToPromise(store.get(normalizedDomain));
      await done;
      return result || null;
    } catch (error) {
      this.log('getPattern failed, using fallback', this.serializeError(error));
      return this.getPatternFallback(normalizedDomain);
    }
  }

  async savePattern(domain, patternData = {}) {
    await this.ensureReady();
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) return null;

    this.log('savePattern', { domain: normalizedDomain, mode: this.useStorageFallback ? 'fallback' : 'idb' });

    if (this.useStorageFallback) {
      return this.savePatternFallback(normalizedDomain, patternData);
    }

    try {
      const tx = this.db.transaction(PATTERN_STORE, 'readwrite');
      const done = this.transactionDone(tx);
      const store = tx.objectStore(PATTERN_STORE);
      const existing = await this.requestToPromise(store.get(normalizedDomain));
      const now = Date.now();

      const successIncrement = this.toSafeInt(patternData.successCount, existing ? 1 : 1);
      const failCount = this.toSafeInt(
        patternData.failCount,
        this.toSafeInt(existing?.failCount, 0)
      );

      const record = {
        domain: normalizedDomain,
        pattern: this.normalizePattern(patternData.pattern || existing?.pattern || ''),
        confidence: this.clampConfidence(
          this.toSafeNumber(patternData.confidence, existing?.confidence ?? 0.5)
        ),
        verified: this.toBoolean(patternData.verified, existing?.verified ?? false),
        verifiedBy: this.normalizeVerifiedBy(patternData.verifiedBy || existing?.verifiedBy || 'heuristic'),
        successCount: this.toSafeInt(existing?.successCount, 0) + successIncrement,
        failCount,
        timestamp: now,
        createdAt: this.toSafeInt(existing?.createdAt, this.toSafeInt(patternData.createdAt, now)),
        lastValidated: this.toSafeInt(
          patternData.lastValidated,
          this.toSafeInt(existing?.lastValidated, this.toBoolean(patternData.verified, false) ? now : 0)
        ),
      };

      await this.requestToPromise(store.put(record));
      await done;
      return record;
    } catch (error) {
      this.log('savePattern failed, using fallback', this.serializeError(error));
      return this.savePatternFallback(normalizedDomain, patternData);
    }
  }

  async updatePatternFeedback(domain, worked) {
    await this.ensureReady();
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) return null;

    const workedBool = worked === true;
    this.log('updatePatternFeedback', {
      domain: normalizedDomain,
      worked: workedBool,
      mode: this.useStorageFallback ? 'fallback' : 'idb',
    });

    if (this.useStorageFallback) {
      return this.updatePatternFeedbackFallback(normalizedDomain, workedBool);
    }

    try {
      const tx = this.db.transaction(PATTERN_STORE, 'readwrite');
      const done = this.transactionDone(tx);
      const store = tx.objectStore(PATTERN_STORE);
      const existing = await this.requestToPromise(store.get(normalizedDomain));
      if (!existing) {
        await done;
        return null;
      }

      const now = Date.now();
      const next = { ...existing };
      next.timestamp = now;

      if (workedBool) {
        next.successCount = this.toSafeInt(existing.successCount, 0) + 1;
        next.confidence = this.clampConfidence(this.toSafeNumber(existing.confidence, 0.5) + 0.05);
        next.lastValidated = now;
        next.verified = true;
      } else {
        next.failCount = this.toSafeInt(existing.failCount, 0) + 1;
        next.confidence = this.clampConfidence(this.toSafeNumber(existing.confidence, 0.5) - 0.15);
      }

      if (this.toSafeInt(next.failCount, 0) > 3) {
        await this.requestToPromise(store.delete(normalizedDomain));
        await done;
        return { deleted: true, domain: normalizedDomain };
      }

      await this.requestToPromise(store.put(next));
      await done;
      return next;
    } catch (error) {
      this.log('updatePatternFeedback failed, using fallback', this.serializeError(error));
      return this.updatePatternFeedbackFallback(normalizedDomain, workedBool);
    }
  }

  async recordLookup(lookupData = {}) {
    await this.ensureReady();
    const normalized = this.normalizeLookup(lookupData);
    this.log('recordLookup', {
      domain: normalized.domain,
      email: normalized.email,
      mode: this.useStorageFallback ? 'fallback' : 'idb',
    });

    if (this.useStorageFallback) {
      return this.recordLookupFallback(normalized);
    }

    try {
      const tx = this.db.transaction(LOOKUP_STORE, 'readwrite');
      const done = this.transactionDone(tx);
      const store = tx.objectStore(LOOKUP_STORE);
      const id = await this.requestToPromise(store.add(normalized));
      await done;
      return { ...normalized, id };
    } catch (error) {
      this.log('recordLookup failed, using fallback', this.serializeError(error));
      return this.recordLookupFallback(normalized);
    }
  }

  async getHistory(limit = 50) {
    await this.ensureReady();
    const safeLimit = Math.max(1, this.toSafeInt(limit, 50));

    this.log('getHistory', { limit: safeLimit, mode: this.useStorageFallback ? 'fallback' : 'idb' });

    if (this.useStorageFallback) {
      return this.getHistoryFallback(safeLimit);
    }

    try {
      const tx = this.db.transaction(LOOKUP_STORE, 'readonly');
      const done = this.transactionDone(tx);
      const store = tx.objectStore(LOOKUP_STORE);
      const index = store.index('timestamp');
      const result = [];

      await this.iterateCursor(index, null, 'prev', (cursor) => {
        result.push(cursor.value);
        if (result.length >= safeLimit) {
          return false;
        }
        return true;
      });

      await done;
      return result;
    } catch (error) {
      this.log('getHistory failed, using fallback', this.serializeError(error));
      return this.getHistoryFallback(safeLimit);
    }
  }

  async getPatternsNeedingValidation() {
    await this.ensureReady();
    const now = Date.now();
    const staleCutoff = now - THIRTY_DAYS_MS;

    this.log('getPatternsNeedingValidation', {
      mode: this.useStorageFallback ? 'fallback' : 'idb',
      staleCutoff,
    });

    if (this.useStorageFallback) {
      return this.getPatternsNeedingValidationFallback(staleCutoff);
    }

    try {
      const tx = this.db.transaction(PATTERN_STORE, 'readonly');
      const done = this.transactionDone(tx);
      const store = tx.objectStore(PATTERN_STORE);
      const result = [];

      await this.iterateCursor(store, null, 'next', (cursor) => {
        const pattern = cursor.value;
        const lastValidated = this.toSafeInt(pattern.lastValidated, 0);
        const successCount = this.toSafeInt(pattern.successCount, 0);
        const stale = lastValidated === 0 || lastValidated < staleCutoff;
        const periodic = successCount > 0 && successCount % 10 === 0;
        if (stale || periodic) {
          result.push(pattern);
        }
        return true;
      });

      await done;
      result.sort((a, b) => this.toSafeInt(a.lastValidated, 0) - this.toSafeInt(b.lastValidated, 0));
      return result;
    } catch (error) {
      this.log('getPatternsNeedingValidation failed, using fallback', this.serializeError(error));
      return this.getPatternsNeedingValidationFallback(staleCutoff);
    }
  }

  async cleanup() {
    await this.ensureReady();
    this.log('cleanup', { mode: this.useStorageFallback ? 'fallback' : 'idb' });

    if (this.useStorageFallback) {
      return this.cleanupFallback();
    }

    const lookupCutoff = Date.now() - NINETY_DAYS_MS;

    try {
      const tx = this.db.transaction([PATTERN_STORE, LOOKUP_STORE], 'readwrite');
      const done = this.transactionDone(tx);
      const patternStore = tx.objectStore(PATTERN_STORE);
      const lookupStore = tx.objectStore(LOOKUP_STORE);
      const lookupIndex = lookupStore.index('timestamp');

      let deletedLookups = 0;
      let deletedPatterns = 0;

      const lookupRange =
        typeof IDBKeyRange !== 'undefined'
          ? IDBKeyRange.upperBound(lookupCutoff)
          : null;

      await this.iterateCursor(lookupIndex, lookupRange, 'next', (cursor) => {
        cursor.delete();
        deletedLookups += 1;
        return true;
      });

      await this.iterateCursor(patternStore, null, 'next', (cursor) => {
        const confidence = this.toSafeNumber(cursor.value?.confidence, 0);
        if (confidence < 0.3) {
          cursor.delete();
          deletedPatterns += 1;
        }
        return true;
      });

      await done;
      return { deletedLookups, deletedPatterns };
    } catch (error) {
      this.log('cleanup failed, using fallback', this.serializeError(error));
      return this.cleanupFallback();
    }
  }

  async exportData() {
    await this.ensureReady();
    this.log('exportData', { mode: this.useStorageFallback ? 'fallback' : 'idb' });

    if (this.useStorageFallback) {
      const state = await this.readFallbackData();
      return {
        version: DB_VERSION,
        exportedAt: Date.now(),
        mode: 'fallback',
        patterns: Object.values(state.patterns || {}),
        lookups: Array.isArray(state.lookups) ? state.lookups : [],
      };
    }

    try {
      const tx = this.db.transaction([PATTERN_STORE, LOOKUP_STORE], 'readonly');
      const done = this.transactionDone(tx);
      const patternStore = tx.objectStore(PATTERN_STORE);
      const lookupStore = tx.objectStore(LOOKUP_STORE);

      const patterns = await this.requestToPromise(patternStore.getAll());
      const lookups = await this.requestToPromise(lookupStore.getAll());
      await done;

      return {
        version: DB_VERSION,
        exportedAt: Date.now(),
        mode: 'indexeddb',
        patterns: Array.isArray(patterns) ? patterns : [],
        lookups: Array.isArray(lookups) ? lookups : [],
      };
    } catch (error) {
      this.log('exportData failed, using fallback', this.serializeError(error));
      const state = await this.readFallbackData();
      return {
        version: DB_VERSION,
        exportedAt: Date.now(),
        mode: 'fallback',
        patterns: Object.values(state.patterns || {}),
        lookups: Array.isArray(state.lookups) ? state.lookups : [],
      };
    }
  }

  async importData(jsonData) {
    await this.ensureReady();
    this.log('importData', { mode: this.useStorageFallback ? 'fallback' : 'idb' });

    const parsed = this.normalizeImportData(jsonData);
    if (!parsed) {
      throw new Error('Invalid import payload');
    }

    if (this.useStorageFallback) {
      return this.importDataFallback(parsed);
    }

    try {
      const tx = this.db.transaction([PATTERN_STORE, LOOKUP_STORE], 'readwrite');
      const done = this.transactionDone(tx);
      const patternStore = tx.objectStore(PATTERN_STORE);
      const lookupStore = tx.objectStore(LOOKUP_STORE);

      for (const pattern of parsed.patterns) {
        patternStore.put(pattern);
      }

      for (const lookup of parsed.lookups) {
        const copy = { ...lookup };
        const hasNumericId = Number.isFinite(copy.id);
        if (!hasNumericId) {
          delete copy.id;
          lookupStore.add(copy);
        } else {
          lookupStore.put(copy);
        }
      }

      await done;
      return {
        importedPatterns: parsed.patterns.length,
        importedLookups: parsed.lookups.length,
      };
    } catch (error) {
      this.log('importData failed, using fallback', this.serializeError(error));
      return this.importDataFallback(parsed);
    }
  }

  // ---------------------------------------------------------------------------
  // IndexedDB Utilities
  // ---------------------------------------------------------------------------

  requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    });
  }

  iterateCursor(source, range, direction, onCursor) {
    return new Promise((resolve, reject) => {
      const request = source.openCursor(range, direction);

      request.onerror = () => reject(request.error || new Error('Failed to iterate cursor'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        try {
          const shouldContinue = onCursor(cursor);
          if (shouldContinue === false) {
            resolve();
            return;
          }
          cursor.continue();
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Fallback (chrome.storage / in-memory)
  // ---------------------------------------------------------------------------

  async getPatternFallback(domain) {
    const state = await this.readFallbackData();
    return state.patterns?.[domain] || null;
  }

  async savePatternFallback(domain, patternData) {
    const state = await this.readFallbackData();
    const now = Date.now();
    const existing = state.patterns?.[domain] || null;
    const successIncrement = this.toSafeInt(patternData.successCount, existing ? 1 : 1);

    const next = {
      domain,
      pattern: this.normalizePattern(patternData.pattern || existing?.pattern || ''),
      confidence: this.clampConfidence(
        this.toSafeNumber(patternData.confidence, this.toSafeNumber(existing?.confidence, 0.5))
      ),
      verified: this.toBoolean(patternData.verified, this.toBoolean(existing?.verified, false)),
      verifiedBy: this.normalizeVerifiedBy(patternData.verifiedBy || existing?.verifiedBy || 'heuristic'),
      successCount: this.toSafeInt(existing?.successCount, 0) + successIncrement,
      failCount: this.toSafeInt(patternData.failCount, this.toSafeInt(existing?.failCount, 0)),
      timestamp: now,
      createdAt: this.toSafeInt(existing?.createdAt, this.toSafeInt(patternData.createdAt, now)),
      lastValidated: this.toSafeInt(
        patternData.lastValidated,
        this.toSafeInt(existing?.lastValidated, this.toBoolean(patternData.verified, false) ? now : 0)
      ),
    };

    state.patterns[domain] = next;
    await this.writeFallbackData(state);
    return next;
  }

  async updatePatternFeedbackFallback(domain, worked) {
    const state = await this.readFallbackData();
    const existing = state.patterns?.[domain];
    if (!existing) return null;

    const now = Date.now();
    const next = { ...existing, timestamp: now };
    if (worked) {
      next.successCount = this.toSafeInt(next.successCount, 0) + 1;
      next.confidence = this.clampConfidence(this.toSafeNumber(next.confidence, 0.5) + 0.05);
      next.lastValidated = now;
      next.verified = true;
    } else {
      next.failCount = this.toSafeInt(next.failCount, 0) + 1;
      next.confidence = this.clampConfidence(this.toSafeNumber(next.confidence, 0.5) - 0.15);
    }

    if (this.toSafeInt(next.failCount, 0) > 3) {
      delete state.patterns[domain];
      await this.writeFallbackData(state);
      return { deleted: true, domain };
    }

    state.patterns[domain] = next;
    await this.writeFallbackData(state);
    return next;
  }

  async recordLookupFallback(lookup) {
    const state = await this.readFallbackData();
    const copy = { ...lookup, id: lookup.id || Date.now() + Math.floor(Math.random() * 1000) };
    state.lookups.push(copy);
    state.lookups.sort((a, b) => this.toSafeInt(b.timestamp, 0) - this.toSafeInt(a.timestamp, 0));

    // Keep fallback memory bounded.
    if (state.lookups.length > 5000) {
      state.lookups = state.lookups.slice(0, 5000);
    }

    await this.writeFallbackData(state);
    return copy;
  }

  async getHistoryFallback(limit) {
    const state = await this.readFallbackData();
    return [...state.lookups]
      .sort((a, b) => this.toSafeInt(b.timestamp, 0) - this.toSafeInt(a.timestamp, 0))
      .slice(0, limit);
  }

  async getPatternsNeedingValidationFallback(staleCutoff) {
    const state = await this.readFallbackData();
    return Object.values(state.patterns || {}).filter((pattern) => {
      const lastValidated = this.toSafeInt(pattern.lastValidated, 0);
      const successCount = this.toSafeInt(pattern.successCount, 0);
      const stale = lastValidated === 0 || lastValidated < staleCutoff;
      const periodic = successCount > 0 && successCount % 10 === 0;
      return stale || periodic;
    });
  }

  async cleanupFallback() {
    const state = await this.readFallbackData();
    const lookupCutoff = Date.now() - NINETY_DAYS_MS;
    const previousLookupCount = state.lookups.length;
    const previousPatternCount = Object.keys(state.patterns).length;

    state.lookups = state.lookups.filter(
      (item) => this.toSafeInt(item.timestamp, 0) >= lookupCutoff
    );

    for (const [domain, pattern] of Object.entries(state.patterns)) {
      const confidence = this.toSafeNumber(pattern.confidence, 0);
      if (confidence < 0.3) {
        delete state.patterns[domain];
      }
    }

    await this.writeFallbackData(state);

    return {
      deletedLookups: previousLookupCount - state.lookups.length,
      deletedPatterns: previousPatternCount - Object.keys(state.patterns).length,
    };
  }

  async importDataFallback(parsed) {
    const state = await this.readFallbackData();

    for (const pattern of parsed.patterns) {
      state.patterns[pattern.domain] = pattern;
    }

    for (const lookup of parsed.lookups) {
      state.lookups.push({
        ...lookup,
        id: Number.isFinite(lookup.id) ? lookup.id : Date.now() + Math.floor(Math.random() * 1000),
      });
    }

    state.lookups.sort((a, b) => this.toSafeInt(b.timestamp, 0) - this.toSafeInt(a.timestamp, 0));
    if (state.lookups.length > 5000) {
      state.lookups = state.lookups.slice(0, 5000);
    }

    await this.writeFallbackData(state);

    return {
      importedPatterns: parsed.patterns.length,
      importedLookups: parsed.lookups.length,
    };
  }

  async readFallbackData() {
    const hasChromeStorage =
      typeof chrome !== 'undefined' &&
      chrome?.storage?.local &&
      typeof chrome.storage.local.get === 'function' &&
      typeof chrome.storage.local.set === 'function';

    if (!hasChromeStorage) {
      return {
        patterns: { ...(this.memoryFallback.patterns || {}) },
        lookups: [...(this.memoryFallback.lookups || [])],
      };
    }

    const raw = await chrome.storage.local.get([
      this.fallbackKeys.patterns,
      this.fallbackKeys.lookups,
    ]);

    const patterns = raw?.[this.fallbackKeys.patterns];
    const lookups = raw?.[this.fallbackKeys.lookups];

    return {
      patterns: patterns && typeof patterns === 'object' ? patterns : {},
      lookups: Array.isArray(lookups) ? lookups : [],
    };
  }

  async writeFallbackData(state) {
    const hasChromeStorage =
      typeof chrome !== 'undefined' &&
      chrome?.storage?.local &&
      typeof chrome.storage.local.get === 'function' &&
      typeof chrome.storage.local.set === 'function';

    if (!hasChromeStorage) {
      this.memoryFallback = {
        patterns: { ...(state.patterns || {}) },
        lookups: Array.isArray(state.lookups) ? [...state.lookups] : [],
      };
      return;
    }

    await chrome.storage.local.set({
      [this.fallbackKeys.patterns]: state.patterns || {},
      [this.fallbackKeys.lookups]: Array.isArray(state.lookups) ? state.lookups : [],
    });
  }

  // ---------------------------------------------------------------------------
  // Shared normalizers / validators
  // ---------------------------------------------------------------------------

  normalizeDomain(domain) {
    if (typeof domain !== 'string') return '';
    const value = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0];

    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(value)) return '';
    return value;
  }

  normalizePattern(pattern) {
    const value = String(pattern || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    return value || 'first.last';
  }

  normalizeVerifiedBy(verifiedBy) {
    const candidate = String(verifiedBy || '').trim().toLowerCase();
    if (VERIFIED_BY_VALUES.has(candidate)) return candidate;
    return 'heuristic';
  }

  normalizeFeedback(value) {
    if (FEEDBACK_VALUES.has(value)) return value;
    return null;
  }

  normalizeLookup(lookupData) {
    return {
      id: Number.isFinite(lookupData?.id) ? Number(lookupData.id) : undefined,
      profileUrl: typeof lookupData?.profileUrl === 'string' ? lookupData.profileUrl.trim() : '',
      domain: this.normalizeDomain(lookupData?.domain || ''),
      email: typeof lookupData?.email === 'string' ? lookupData.email.trim().toLowerCase() : '',
      pattern: this.normalizePattern(lookupData?.pattern || ''),
      confidence: this.clampConfidence(this.toSafeNumber(lookupData?.confidence, 0)),
      source: typeof lookupData?.source === 'string' ? lookupData.source.trim() : 'unknown',
      cost: this.toSafeNumber(lookupData?.cost, 0),
      timestamp: this.toSafeInt(lookupData?.timestamp, Date.now()),
      userFeedback: this.normalizeFeedback(lookupData?.userFeedback),
    };
  }

  normalizeImportData(jsonData) {
    const payload =
      typeof jsonData === 'string'
        ? this.safeParseJson(jsonData)
        : jsonData;

    if (!payload || typeof payload !== 'object') return null;

    const rawPatterns = Array.isArray(payload.patterns) ? payload.patterns : [];
    const rawLookups = Array.isArray(payload.lookups) ? payload.lookups : [];

    const patterns = [];
    for (const item of rawPatterns) {
      const domain = this.normalizeDomain(item?.domain || '');
      if (!domain) continue;
      const now = Date.now();
      patterns.push({
        domain,
        pattern: this.normalizePattern(item?.pattern || ''),
        confidence: this.clampConfidence(this.toSafeNumber(item?.confidence, 0.5)),
        verified: this.toBoolean(item?.verified, false),
        verifiedBy: this.normalizeVerifiedBy(item?.verifiedBy || 'heuristic'),
        successCount: this.toSafeInt(item?.successCount, 0),
        failCount: this.toSafeInt(item?.failCount, 0),
        timestamp: this.toSafeInt(item?.timestamp, now),
        createdAt: this.toSafeInt(item?.createdAt, now),
        lastValidated: this.toSafeInt(item?.lastValidated, 0),
      });
    }

    const lookups = [];
    for (const item of rawLookups) {
      const lookup = this.normalizeLookup(item || {});
      lookups.push(lookup);
    }

    return { patterns, lookups };
  }

  safeParseJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  toSafeInt(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
  }

  toSafeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  clampConfidence(value) {
    return Math.max(0, Math.min(1, this.toSafeNumber(value, 0)));
  }

  toBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  serializeError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }
    return { message: String(error) };
  }

  log(message, data) {
    if (typeof data === 'undefined') {
      console.log(`[PatternCache] ${message}`);
      return;
    }
    console.log(`[PatternCache] ${message}`, data);
  }
}

const patternCache = new PatternCache();
patternCache.init().catch((error) => {
  console.error('[PatternCache] Auto-init failed:', error);
});

if (typeof globalThis !== 'undefined') {
  globalThis.PatternCache = patternCache;
}

if (typeof window !== 'undefined') {
  window.PatternCache = patternCache;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PatternCache,
    patternCache,
    DB_NAME,
    DB_VERSION,
    PATTERN_STORE,
    LOOKUP_STORE,
  };
}
