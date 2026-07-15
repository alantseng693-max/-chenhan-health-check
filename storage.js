(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config, Utils } = window.CH;

  function defaultState() {
    return {
      appVersion: Config.versions.app,
      questionVersion: Config.versions.questions,
      scoringVersion: Config.versions.scoring,
      consentVersion: Config.versions.consent,
      reportVersion: Config.versions.report,
      assessmentId: Utils.uuid(),
      view: 'home',
      consent: { privacy: false, disclaimer: false, storage: false, analytics: false },
      profile: {}, answers: {}, currentIndex: 0,
      startedAt: null, updatedAt: null, completedAt: null,
      report: null, demo: null, submission: { status: 'not_submitted', lastAttemptAt: null },
      source: { url: location.href, referrer: document.referrer || '', utm: Utils.parseUTM() },
      legacyBackup: null
    };
  }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function migrate(input) {
    const base = defaultState();
    if (!input || typeof input !== 'object') return base;
    const migrated = { ...base, ...input };
    migrated.consent = { ...base.consent, ...(input.consent || {}) };
    migrated.profile = input.profile || {};
    migrated.answers = input.answers || {};
    migrated.submission = { ...base.submission, ...(input.submission || {}) };
    migrated.appVersion = Config.versions.app;
    migrated.scoringVersion = Config.versions.scoring;
    migrated.consentVersion = Config.versions.consent;
    migrated.reportVersion = Config.versions.report;
    if (!migrated.assessmentId) migrated.assessmentId = Utils.uuid();
    return migrated;
  }

  function load() {
    const current = safeParse(localStorage.getItem(Config.storage.stateKey), null);
    if (current) return migrate(current);
    const legacy = safeParse(localStorage.getItem(Config.storage.legacyStateKey), null);
    if (legacy) {
      const state = migrate(legacy);
      state.legacyBackup = { importedAt: Utils.now(), version: legacy.version || 'v1', profile: legacy.profile || {}, answers: legacy.answers || {} };
      state.report = null;
      state.completedAt = null;
      state.view = Object.keys(state.answers).length ? 'quiz' : 'home';
      save(state);
      return state;
    }
    return defaultState();
  }

  function save(state) {
    state.updatedAt = Utils.now();
    localStorage.setItem(Config.storage.stateKey, JSON.stringify(state));
    return state;
  }

  function clear() {
    Object.values(Config.storage).forEach(k => localStorage.removeItem(k));
  }

  function list(key) { return safeParse(localStorage.getItem(key), []); }
  function setList(key, value) { localStorage.setItem(key, JSON.stringify(value || [])); }
  function append(key, item) { const items = list(key); items.push(item); setList(key, items); return item; }

  function queue(item) { return append(Config.storage.outboxKey, item); }
  function getOutbox() { return list(Config.storage.outboxKey); }
  function setOutbox(items) { setList(Config.storage.outboxKey, items); }

  function wasSubmitted(id) { return list(Config.storage.submittedKey).includes(id); }
  function markSubmitted(id) {
    const ids = Utils.unique([...list(Config.storage.submittedKey), id]).slice(-200);
    setList(Config.storage.submittedKey, ids);
  }

  window.CH.Storage = { defaultState, load, save, clear, list, setList, append, queue, getOutbox, setOutbox, wasSubmitted, markSubmitted };
})();
