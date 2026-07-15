(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config } = window.CH;

  function validateQuestionBank(data) {
    const errors = [];
    if (!data || !Array.isArray(data.questions)) errors.push('questions 必須是陣列');
    const ids = new Set();
    const domains = new Set(Config.domains);
    for (const q of data?.questions || []) {
      if (!q.id) errors.push('存在沒有 id 的題目');
      else if (ids.has(q.id)) errors.push(`題目 ID 重複：${q.id}`);
      else ids.add(q.id);
      if (!domains.has(q.domain)) errors.push(`未知面向：${q.id} / ${q.domain}`);
      if (!q.question || !Array.isArray(q.options) || !q.options.length) errors.push(`題目格式不完整：${q.id}`);
      for (const c of q.show_if || []) {
        if (c.source === 'answer' && c.field && !ids.has(c.field) && !(data.questions || []).some(x => x.id === c.field)) {
          errors.push(`跳題引用不存在：${q.id} -> ${c.field}`);
        }
      }
    }
    return { ok: errors.length === 0, errors, count: ids.size };
  }

  async function load() {
    let data = window.QUESTION_BANK_DATA || null;
    let source = data ? 'inline' : 'none';
    if (location.protocol !== 'file:') {
      try {
        const response = await fetch('data/questions.json', { cache: 'no-store' });
        if (response.ok) { data = await response.json(); source = 'json'; }
      } catch (_) { /* offline fallback */ }
    }
    const validation = validateQuestionBank(data);
    if (!validation.ok) {
      const error = new Error(`題庫驗證失敗：${validation.errors.slice(0, 4).join('；')}`);
      error.validation = validation;
      throw error;
    }
    return { data, source, validation };
  }

  window.CH.DataLoader = { load, validateQuestionBank };
})();
