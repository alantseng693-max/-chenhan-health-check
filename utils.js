(() => {
  'use strict';
  window.CH = window.CH || {};
  const Utils = {
    uuid() {
      if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
      return `ch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },
    now() { return new Date().toISOString(); },
    round(n) { return Math.round((Number(n) || 0) * 10) / 10; },
    clamp(n, min, max) { return Math.max(min, Math.min(max, Number(n) || 0)); },
    unique(arr) { return [...new Set((arr || []).filter(Boolean))]; },
    escapeHTML(value) {
      return String(value ?? '').replace(/[&<>'"]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[c]));
    },
    escapeAttr(value) { return Utils.escapeHTML(value).replace(/`/g, '&#96;'); },
    sanitizeText(value, max = 1000) {
      return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
    },
    formatDate(iso) {
      if (!iso) return '—';
      return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
    },
    safeFileName(value) { return String(value || '報告').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50); },
    downloadJSON(payload, name) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    },
    async copyText(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (_) {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
        ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
      }
    },
    parseUTM() {
      const params = new URLSearchParams(location.search);
      const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      return Object.fromEntries(keys.map(k => [k, Utils.sanitizeText(params.get(k) || '', 200)]));
    },
    deviceType() {
      const w = Math.min(screen.width || innerWidth, innerWidth || 9999);
      return w < 600 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    },
    debounce(fn, delay = 250) {
      let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    },
    deepClone(value) { return JSON.parse(JSON.stringify(value)); },
    getPath(obj, path) { return String(path).split('.').reduce((v, k) => v?.[k], obj); }
  };
  window.CH.Utils = Utils;
})();
