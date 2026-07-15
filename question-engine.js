(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config } = window.CH;

  const EXTRA_RULES = [
    { when: a => severity(a['L-GOV-05']) >= 3, add: ['L-GOV-01', 'L-GOV-03', 'L-CON-05', 'L-DIS-03'] },
    { when: a => severity(a['L-LAB-05']) >= 3, add: ['L-LAB-01', 'L-LAB-03', 'L-LAB-04'] },
    { when: a => severity(a['L-DIS-01']) >= 3, add: ['L-DIS-03', 'L-DIS-05'] },
    { when: a => severity(a['L-DAT-03']) >= 3, add: ['L-DAT-02', 'L-DAT-04'] },
    { when: a => severity(a['F-CSH-01']) >= 3 || severity(a['F-CSH-05']) >= 3, add: ['F-CSH-02', 'F-CSH-03', 'F-CSH-04', 'F-FIN-04'] },
    { when: a => severity(a['G-CUS-01']) >= 3, add: ['G-CUS-02', 'G-CUS-04'] },
    { when: a => severity(a['I-BRD-01']) >= 3 || severity(a['I-BRD-02']) >= 3, add: ['I-BRD-05'] },
    { when: a => severity(a['A-OWN-01']) >= 3, add: ['A-OWN-02', 'A-OWN-04', 'A-OWN-05'] },
    { when: a => severity(a['A-REA-01']) >= 3 || severity(a['A-REA-03']) >= 3, add: ['A-REA-02', 'A-REA-04'] }
  ];

  const PROFILE_EXTRA = [
    { when: p => ['yes', 'planning'].includes(p.crossBorder), add: ['F-TAX-02', 'I-BRD-03', 'L-DAT-04'] },
    { when: p => p.subsidyNeed === 'executing', add: ['I-SUB-03', 'I-SUB-05', 'I-RND-02', 'I-RND-03'] },
    { when: p => Number(p.employeeCount || 0) >= 30, add: ['L-LAB-01', 'L-LAB-03', 'G-PPL-01', 'L-DAT-02'] },
    { when: p => ['own', 'both'].includes(p.realEstate), add: ['A-REA-02', 'A-REA-04', 'A-REA-05'] },
    { when: p => p.hasPrivateLoan === 'yes', add: ['F-FIN-02', 'F-FIN-03', 'A-COL-01'] }
  ];

  const FALLBACK_IDS = [
    'L-CON-03', 'L-COM-03', 'L-DIS-02', 'F-ACC-03', 'F-CSH-02', 'F-TAX-01',
    'G-STR-02', 'G-SAL-01', 'G-OPS-02', 'I-SEC-02', 'I-COP-05', 'A-INS-05',
    'A-SUC-02', 'F-CTL-01', 'L-DAT-01'
  ];

  function severity(answer) {
    if (!answer || answer.special === 'na') return -1;
    if (answer.special === 'unknown') return 2.5;
    return Number(answer.severity ?? -1);
  }

  function isAnswered(answer) {
    if (!answer) return false;
    if (answer.special) return true;
    if (Array.isArray(answer.values)) return answer.values.length > 0;
    return Boolean(answer.value);
  }

  function conditionMatches(conditions = [], state = {}) {
    if (!conditions?.length) return true;
    return conditions.every(c => {
      const value = c.source === 'profile' ? state.profile?.[c.field] : state.answers?.[c.field];
      const normalized = value && typeof value === 'object' ? (value.value ?? value.severity ?? value.special) : value;
      if (c.op === 'eq') return String(normalized) === String(c.value);
      if (c.op === 'neq') return String(normalized) !== String(c.value);
      if (c.op === 'gt') return Number(normalized) > Number(c.value);
      if (c.op === 'gte') return Number(normalized) >= Number(c.value);
      if (c.op === 'lt') return Number(normalized) < Number(c.value);
      if (c.op === 'in') return (c.value || []).map(String).includes(String(normalized));
      return true;
    });
  }

  function getApplicableQuestions(data, state) {
    const all = data.questions || [];
    const byId = Object.fromEntries(all.map(q => [q.id, q]));
    const selected = new Set(all.filter(q => q.mvp && conditionMatches(q.show_if, state)).map(q => q.id));
    PROFILE_EXTRA.forEach(rule => { if (rule.when(state.profile || {})) rule.add.forEach(id => { const q = byId[id]; if (q && conditionMatches(q.show_if, state)) selected.add(id); }); });
    EXTRA_RULES.forEach(rule => { if (rule.when(state.answers || {})) rule.add.forEach(id => { const q = byId[id]; if (q && conditionMatches(q.show_if, state)) selected.add(id); }); });
    for (const id of FALLBACK_IDS) {
      if (selected.size >= Config.limits.minQuestions) break;
      const q = byId[id]; if (q && conditionMatches(q.show_if, state)) selected.add(id);
    }
    Object.keys(state.answers || {}).forEach(id => { const q = byId[id]; if (q && conditionMatches(q.show_if, state)) selected.add(id); });
    return all.filter(q => selected.has(q.id)).slice(0, Config.limits.maxQuestions);
  }

  function answerLabel(answer) {
    if (!answer) return '';
    if (answer.special) return answer.label || (answer.special === 'na' ? '目前不適用' : '不確定／需要確認');
    if (Array.isArray(answer.labels)) return answer.labels.join('、');
    return answer.label || '';
  }

  window.CH.QuestionEngine = { getApplicableQuestions, conditionMatches, isAnswered, severity, answerLabel };
})();
