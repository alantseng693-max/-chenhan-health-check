(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config, Utils, Storage } = window.CH;

  async function post(endpoint, payload) {
    if (!endpoint) throw new Error('API_ENDPOINT_NOT_CONFIGURED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Config.api.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const text = await response.text();
      try { return text ? JSON.parse(text) : { ok: true }; } catch (_) { return { ok: true, raw: text }; }
    } finally { clearTimeout(timer); }
  }

  function queue(kind, payload, reason) {
    const item = { id: Utils.uuid(), kind, payload, reason: String(reason?.message || reason || 'offline'), queuedAt: Utils.now(), attempts: 0 };
    Storage.queue(item); return item;
  }

  async function submit(kind, payload, endpoint) {
    if (Config.mode === 'demo' || !endpoint) {
      queue(kind, payload, 'demo_mode');
      return { ok: true, localOnly: true, queued: true };
    }
    try {
      const result = await post(endpoint, payload);
      return { ok: true, localOnly: false, result };
    } catch (error) {
      queue(kind, payload, error);
      return { ok: false, queued: true, error: error.message };
    }
  }

  async function submitAssessment(payload) {
    if (Storage.wasSubmitted(payload.assessmentId)) return { ok: true, duplicate: true };
    const result = await submit('assessment', payload, Config.api.assessmentEndpoint);
    if (result.ok && !result.queued) Storage.markSubmitted(payload.assessmentId);
    return result;
  }

  async function submitContactRequest(payload) {
    return submit('contact', payload, Config.api.contactEndpoint);
  }

  async function retryOutbox() {
    if (Config.mode === 'demo') return { sent: 0, remaining: Storage.getOutbox().length };
    const current = Storage.getOutbox(); const remaining = []; let sent = 0;
    for (const item of current) {
      const endpoint = item.kind === 'contact' ? Config.api.contactEndpoint : item.kind === 'assessment' ? Config.api.assessmentEndpoint : Config.api.analyticsEndpoint;
      try { await post(endpoint, item.payload); sent++; if (item.kind === 'assessment') Storage.markSubmitted(item.payload.assessmentId); }
      catch (error) { remaining.push({ ...item, attempts: (item.attempts || 0) + 1, lastError: error.message, lastAttemptAt: Utils.now() }); }
    }
    Storage.setOutbox(remaining); return { sent, remaining: remaining.length };
  }

  window.CH.Api = { submitAssessment, submitContactRequest, retryOutbox, post };
})();
