(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config, Utils, Storage, DataLoader, QuestionEngine, ScoringEngine, Api, Analytics, Charts } = window.CH;

  let state = Storage.load();
  let questionData = null;
  let allQuestions = [];
  let byId = {};
  let toastTimer = null;
  let lastQuestionCount = 0;

  const app = document.getElementById('app');
  const autosaveStatus = document.getElementById('autosaveStatus');
  const modalRoot = document.getElementById('modalRoot');
  const toast = document.getElementById('toast');
  const globalError = document.getElementById('globalError');

  document.getElementById('brandHome')?.addEventListener('click', () => navigate('home'));
  document.getElementById('clearDataHeader')?.addEventListener('click', confirmClearData);
  document.getElementById('globalErrorClose')?.addEventListener('click', () => { globalError.hidden = true; });
  window.addEventListener('error', event => showGlobalError('系統發生未預期錯誤，已保留目前進度。', event.error));
  window.addEventListener('unhandledrejection', event => showGlobalError('部分功能暫時無法完成，已保留目前進度。', event.reason));
  window.addEventListener('online', () => Api.retryOutbox().then(r => { if (r.sent) showToast(`已重新送出 ${r.sent} 筆暫存資料。`); }));

  init();

  async function init() {
    try {
      const loaded = await DataLoader.load();
      questionData = loaded.data;
      allQuestions = questionData.questions || [];
      byId = Object.fromEntries(allQuestions.map(q => [q.id, q]));
      state.questionVersion = questionData.version || Config.versions.questions;
      updateMeta();
      render();
      Analytics.track('health_check_view', { source: loaded.source }, state);
      if (location.protocol !== 'file:') Api.retryOutbox();
    } catch (error) {
      showGlobalError('題庫載入或驗證失敗，暫時無法開始健檢。', error, true);
      renderLoadFailure(error);
    }
  }

  function updateMeta() {
    document.title = `企業健檢｜${Config.brand.shortName}`;
    document.querySelectorAll('[data-brand]').forEach(el => { el.textContent = Config.brand.shortName; });
    const canonical = document.getElementById('canonicalUrl');
    if (canonical && location.protocol.startsWith('http')) canonical.href = `${location.origin}${location.pathname}`;
  }

  function showGlobalError(message, error, persistent = false) {
    console.error(error || message);
    if (!globalError) return;
    globalError.hidden = false;
    globalError.querySelector('[data-error-message]')?.replaceChildren(document.createTextNode(message));
    if (!persistent) setTimeout(() => { globalError.hidden = true; }, 7000);
  }

  function renderLoadFailure(error) {
    app.innerHTML = `<section class="error-state"><p class="eyebrow">系統載入失敗</p><h1>目前無法載入企業健檢</h1><p>${Utils.escapeHTML(error?.message || '請稍後再試。')}</p><div class="form-actions"><button class="btn btn-primary" id="reloadPage" type="button">重新載入</button></div></section>`;
    document.getElementById('reloadPage').addEventListener('click', () => location.reload());
  }

  function save(message = '已自動儲存') {
    try {
      Storage.save(state);
      autosaveStatus.textContent = message;
      setTimeout(() => { autosaveStatus.textContent = ''; }, 1800);
    } catch (error) {
      autosaveStatus.textContent = '無法儲存';
      showGlobalError('瀏覽器無法儲存進度，請匯出資料後再離開。', error);
    }
  }

  function navigate(view) {
    state.view = view; save(); render(); focusMain();
  }

  function focusMain(selector = '#main') {
    requestAnimationFrame(() => document.querySelector(selector)?.focus({ preventScroll: false }));
  }

  function render() {
    const renderers = { home: renderHome, consent: renderConsent, profile: renderProfile, quiz: renderQuiz, report: renderReport, review: renderReview };
    (renderers[state.view] || renderHome)();
  }

  function renderHome() {
    const canResume = state.startedAt && Object.keys(state.answers || {}).length > 0 && !state.completedAt;
    app.innerHTML = `
      <section class="hero" aria-labelledby="heroTitle">
        <div class="hero-content">
          <p class="eyebrow">企業經營風險健檢</p>
          <h1 id="heroTitle">用10分鐘，找出企業目前最需要優先處理的問題</h1>
          <p class="hero-lead">從法律、財務、成長、智權與資產五個面向，初步盤點企業經營風險與專業需求。系統只做風險提示與分診，不直接下專業結論。</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="startBtn" type="button">開始健檢</button>
            ${canResume ? '<button class="btn btn-secondary" id="resumeBtn" type="button">繼續上次填答</button>' : ''}
          </div>
          <div class="hero-meta"><span>約10～15分鐘</span><span>動態35～55題</span><span>可隨時暫存</span></div>
        </div>
        <div class="hero-side" aria-label="完成健檢可獲得的內容">
          <div class="hero-side-card"><strong>五大面向結果</strong><span>快速看懂目前需要注意的位置</span></div>
          <div class="hero-side-card"><strong>三項優先事項</strong><span>依影響與急迫程度排序</span></div>
          <div class="hero-side-card"><strong>專業分診建議</strong><span>知道下一步該找誰、準備什麼</span></div>
        </div>
      </section>
      <section class="section" aria-labelledby="domainPreviewTitle">
        <div class="section-heading"><div><p class="eyebrow">五大面向</p><h2 id="domainPreviewTitle">不是只看風險，也看企業下一步</h2></div><p>依企業背景動態出題，不適用的內容不會出現。</p></div>
        <div class="domain-preview">${Config.domains.map((d, i) => `<article><span>0${i + 1}</span><strong>${d}</strong></article>`).join('')}</div>
      </section>
      <section class="section" aria-labelledby="valueTitle">
        <div class="section-heading"><div><p class="eyebrow">不是一般問卷</p><h2 id="valueTitle">先盤點，再分診，最後追蹤</h2></div><p>重大警示不會被平均分數掩蓋，也不會用恐嚇式文字推銷服務。</p></div>
        <div class="grid grid-3">
          <article class="card"><span class="badge">01</span><h3>先看背景</h3><p>依產業、規模、員工、融資、智權與資產狀況決定適用題目。</p></article>
          <article class="card"><span class="badge">02</span><h3>再排優先</h3><p>將風險、影響、急迫與制度缺口轉為可理解的改善順序。</p></article>
          <article class="card"><span class="badge">03</span><h3>最後接專業</h3><p>提供顧問類型、準備資料與服務方式，由人工確認專業邊界。</p></article>
        </div>
      </section>
      <section class="section" aria-labelledby="demoTitle">
        <div class="section-heading"><div><p class="eyebrow">展示模式</p><h2 id="demoTitle">快速查看三種企業結果</h2></div><p>展示資料為虛構案例，不會送出到公司端。</p></div>
        <div class="grid grid-3">
          ${demoCard('startup', '小型新創企業', '制度仍在建立，但目前無重大警示。', '低至中度風險')}
          ${demoCard('growth', '成長型企業', '有員工、股東與融資需求，需要跨面向改善。', '中度風險')}
          ${demoCard('critical', '重大警示企業', '資金與資產訊號需要人工優先確認。', '紅色警示')}
        </div>
      </section>`;
    document.getElementById('startBtn').addEventListener('click', () => {
      state = Storage.defaultState(); state.view = 'consent'; state.startedAt = Utils.now(); save(); render(); focusMain();
      Analytics.track('health_check_start', {}, state);
    });
    document.getElementById('resumeBtn')?.addEventListener('click', () => navigate(state.profile?.companyName ? 'quiz' : 'profile'));
    document.querySelectorAll('[data-demo]').forEach(btn => btn.addEventListener('click', () => loadDemo(btn.dataset.demo)));
  }

  function demoCard(key, title, text, badge) {
    return `<article class="card demo-card"><span class="badge">${badge}</span><h3>${title}</h3><p>${text}</p><button class="btn btn-secondary" data-demo="${key}" type="button">查看示範報告</button></article>`;
  }

  function renderConsent() {
    const publicMode = Config.mode !== 'demo' && location.protocol !== 'file:';
    app.innerHTML = `<div class="step-shell">
      <header class="page-header"><p class="eyebrow">開始前說明</p><h1>健檢用途與資料同意</h1><p>請先確認使用邊界與資料處理方式。</p></header>
      <div class="notice"><strong>這不是專業鑑定</strong>系統依你提供的資料整理可能需要注意的事項，結果不構成法律、會計、稅務、投資或其他專業意見。</div>
      <form id="consentForm" class="form-card" novalidate>
        <div class="consent-list">
          ${checkCard('privacy', '個資蒐集與利用告知', `我已閱讀<a href="privacy.html" target="_blank" rel="noopener">隱私權政策草稿</a>，了解資料用於健檢、分診、報告與我同意的後續聯繫。`, true)}
          ${checkCard('disclaimer', '健檢免責與專業界線', `我已閱讀<a href="disclaimer.html" target="_blank" rel="noopener">健檢免責聲明</a>，了解系統不直接判定違法、逃漏稅或保證任何結果。`, true)}
          ${checkCard('storage', publicMode ? '資料提交與本機備份' : '本機儲存說明', publicMode ? '我了解完成健檢後，資料會送至公司設定的測試端點；送出失敗時會暫存在目前瀏覽器，稍後可重試。' : '目前為離線／展示模式，資料只儲存在此瀏覽器，不會自動送至公司端。', true)}
          ${checkCard('analytics', '匿名使用改善（選填）', '同意記錄開始、完成與按鈕點擊等事件，用於改善流程；不勾選仍可完成健檢。', false)}
        </div>
        <div id="consentError" class="inline-error" role="alert" hidden>請完成前三項必要勾選後再繼續。</div>
        <div class="form-actions"><button class="btn btn-secondary" type="button" id="backHome">返回首頁</button><button class="btn btn-primary" type="submit">同意並開始</button></div>
      </form></div>`;
    document.getElementById('backHome').addEventListener('click', () => navigate('home'));
    document.getElementById('consentForm').addEventListener('submit', event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget);
      const consent = { privacy: fd.has('privacy'), disclaimer: fd.has('disclaimer'), storage: fd.has('storage'), analytics: fd.has('analytics'), acceptedAt: Utils.now(), version: Config.versions.consent };
      if (!consent.privacy || !consent.disclaimer || !consent.storage) { document.getElementById('consentError').hidden = false; return; }
      state.consent = consent; state.view = 'profile'; save(); Analytics.track('consent_complete', {}, state); render(); focusMain();
    });
  }

  function checkCard(name, title, body, required) {
    return `<label class="check-card"><input type="checkbox" name="${name}" ${state.consent?.[name] ? 'checked' : ''}><span><strong>${title}${required ? '（必須）' : ''}</strong>${body}</span></label>`;
  }

  function renderProfile() {
    const p = state.profile || {};
    app.innerHTML = `<div class="step-shell">
      <header class="page-header"><p class="eyebrow">企業基本資料</p><h1>先了解企業背景</h1><p>資料只用於決定適用題目、分數修正與後續分診；不要求精確負債、銀行帳號或權利文件。</p></header>
      <form id="profileForm" class="form-card" novalidate>
        <section class="form-section"><h2>聯絡與企業資料</h2><div class="form-grid">
          ${inputField('companyName', '公司或品牌名稱', p.companyName, 'text', true, '', '', Config.limits.companyName)}
          ${inputField('contactName', '聯絡人姓名', p.contactName, 'text', true, '', '', Config.limits.personName)}
          ${inputField('jobTitle', '職稱', p.jobTitle, 'text', false, '', '', 50)}
          ${inputField('phone', '手機', p.phone, 'tel', true, '', '', Config.limits.phone)}
          ${inputField('email', '電子郵件', p.email, 'email', true, '', '', Config.limits.email)}
          ${selectField('industry', '產業類別', p.industry, [['service','專業／企業服務'],['retail','零售／電商'],['manufacturing','製造業'],['construction','營建／不動產'],['technology','科技／軟體'],['food','餐飲／食品'],['health','健康／照護'],['finance','金融相關'],['other','其他']], true)}
          ${selectField('yearsEstablished', '公司成立年限', p.yearsEstablished, [['0-1','未滿1年'],['1-3','1～3年'],['4-7','4～7年'],['8-15','8～15年'],['16+','16年以上']], true)}
          ${selectField('orgType', '公司組織型態', p.orgType, [['company','公司'],['firm','商號／行號'],['partnership','合夥'],['association','協會／非營利'],['preparing','籌備中'],['other','其他']], true)}
          ${inputField('employeeCount', '員工人數', p.employeeCount ?? '', 'number', true, '包含正職、兼職及固定排班人員。', '0')}
          ${selectField('revenueRange', '年營業額區間', p.revenueRange, [['under5m','500萬元以下'],['5m-20m','500萬～2,000萬元'],['20m-50m','2,000萬～5,000萬元'],['50m-100m','5,000萬～1億元'],['over100m','1億元以上'],['unknown','不確定'],['skip','暫不回答']], true)}
          ${inputField('shareholderCount', '股東或合夥人人數', p.shareholderCount ?? 1, 'number', true, '包含實際參與出資或決策的人。', '1')}
        </div></section>
        <section class="form-section"><h2>經營條件</h2><div class="form-grid">
          ${selectField('hasEmployees','是否有聘僱員工',p.hasEmployees,[['yes','有'],['no','沒有']],true)}
          ${selectField('realEstate','是否持有或使用企業不動產',p.realEstate,[['none','都沒有'],['rent','租用營業場所'],['own','持有自有不動產'],['both','同時租用與持有'],['unknown','不確定']],true)}
          ${selectField('hasFinancing','是否有銀行融資或借款',p.hasFinancing,[['no','沒有'],['yes','目前有'],['planning','近期有融資需求'],['unknown','不確定'],['skip','暫不回答']],true)}
          ${selectField('hasPrivateLoan','是否有民間借款',p.hasPrivateLoan,[['no','沒有'],['yes','目前有'],['unknown','不確定'],['skip','暫不回答']],true)}
          ${selectField('hasIP','是否有品牌、商標、技術、內容或營業秘密',p.hasIP,[['yes','有'],['no','目前沒有'],['unknown','不確定']],true)}
          ${selectField('subsidyNeed','政府補助需求',p.subsidyNeed,[['none','目前沒有'],['planning','準備申請'],['executing','補助計畫執行中'],['unknown','不確定']],true)}
          ${selectField('crossBorder','是否有跨境交易',p.crossBorder,[['no','沒有'],['yes','有'],['planning','規劃中'],['unknown','不確定']],true)}
          ${selectField('fixedAdvisors','是否有固定合作顧問',p.fixedAdvisors,[['none','沒有'],['lawyer','有律師'],['accountant','有會計師'],['multiple','有多種顧問'],['skip','暫不回答']],false)}
          ${selectField('memberStatus','是否為澄翰企業會員',p.memberStatus,[['no','不是／不確定'],['yes','是']],true)}
          <div class="field" id="pointsField" ${p.memberStatus === 'yes' ? '' : 'hidden'}><label for="availablePoints">目前可用點數</label><input id="availablePoints" name="availablePoints" type="number" min="0" value="${Utils.escapeAttr(p.availablePoints ?? 4800)}"><small>僅用於展示點數配置，不等同現金報價。</small></div>
        </div></section>
        <section class="form-section"><h2>目前關注與未來目標</h2>
          <fieldset class="field field-full"><legend class="required">目前最困擾的問題（最多三項）</legend><div class="choice-grid">
            ${['合約與收款','股東與決策','員工與勞資','現金流與融資','稅務與帳務','客戶與成長','品牌與智權','補助與研發','不動產與資產','接班與傳承'].map(x => `<label class="choice-card"><input type="checkbox" name="concerns" value="${x}" ${(p.concerns || []).includes(x) ? 'checked' : ''}><span>${x}</span></label>`).join('')}
          </div><small id="concernHint">已選 ${(p.concerns || []).length}/3</small></fieldset>
          <div class="form-grid" style="margin-top:18px">
            <div class="field field-full"><label class="required" for="goals">未來一至三年的主要目標</label><textarea id="goals" name="goals" maxlength="${Config.limits.text}" required placeholder="例如：擴大營收、引進投資人、改善現金流、建立接班制度。">${Utils.escapeHTML(p.goals || '')}</textarea></div>
            ${selectField('alternativeDecisionSupport','其他決策輔助需求',p.alternativeDecisionSupport,[['none','目前沒有'],['strategy','策略與高階決策討論'],['traditional','希望了解八字／命理／風水等主觀參考']],false,'此選項不納入五大健康分數，也不得取代專業判斷。')}
          </div>
        </section>
        <div id="profileError" class="inline-error" role="alert" hidden>請完成必填欄位，並確認電子郵件與手機格式。</div>
        <div class="form-actions"><button class="btn btn-secondary" type="button" id="backConsent">上一步</button><button class="btn btn-primary" type="submit">進入五大面向健檢</button></div>
      </form></div>`;
    bindProfile();
  }

  function inputField(name, label, value, type='text', required=false, help='', min='', maxLength='') {
    return `<div class="field"><label class="${required ? 'required' : ''}" for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${required ? 'required' : ''} ${min !== '' ? `min="${min}"` : ''} ${maxLength ? `maxlength="${maxLength}"` : ''} value="${Utils.escapeAttr(value ?? '')}">${help ? `<small>${help}</small>` : ''}<span class="field-error" id="${name}Error"></span></div>`;
  }

  function selectField(name, label, value, options, required=false, help='') {
    return `<div class="field"><label class="${required ? 'required' : ''}" for="${name}">${label}</label><select id="${name}" name="${name}" ${required ? 'required' : ''}><option value="">請選擇</option>${options.map(([v, l]) => `<option value="${v}" ${String(value) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>${help ? `<small>${help}</small>` : ''}<span class="field-error" id="${name}Error"></span></div>`;
  }

  function bindProfile() {
    const form = document.getElementById('profileForm');
    form.elements.memberStatus.addEventListener('change', () => { document.getElementById('pointsField').hidden = form.elements.memberStatus.value !== 'yes'; });
    const concernBoxes = [...form.querySelectorAll('input[name="concerns"]')];
    concernBoxes.forEach(box => box.addEventListener('change', () => {
      const selected = concernBoxes.filter(x => x.checked);
      if (selected.length > 3) { box.checked = false; showToast('目前最困擾的問題最多選三項。'); }
      document.getElementById('concernHint').textContent = `已選 ${concernBoxes.filter(x => x.checked).length}/3`;
    }));
    document.getElementById('backConsent').addEventListener('click', () => navigate('consent'));
    form.addEventListener('submit', event => {
      event.preventDefault(); clearInvalid(form);
      const fd = new FormData(form); const profile = Object.fromEntries(fd.entries()); profile.concerns = fd.getAll('concerns');
      profile.employeeCount = Number(profile.employeeCount || 0); profile.shareholderCount = Number(profile.shareholderCount || 1); profile.availablePoints = Number(profile.availablePoints || 0);
      ['companyName','contactName','jobTitle','phone','email','goals'].forEach(k => profile[k] = Utils.sanitizeText(profile[k], Config.limits.text));
      const required = ['companyName','contactName','phone','email','industry','yearsEstablished','orgType','employeeCount','revenueRange','shareholderCount','hasEmployees','realEstate','hasFinancing','hasPrivateLoan','hasIP','crossBorder','subsidyNeed','memberStatus','goals'];
      const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || ''); const phoneOK = /^[0-9+()\-\s]{8,30}$/.test(profile.phone || '');
      const invalid = required.filter(k => profile[k] === '' || profile[k] === undefined || profile[k] === null);
      if (!emailOK) invalid.push('email'); if (!phoneOK) invalid.push('phone'); if (!profile.concerns.length || profile.concerns.length > 3) invalid.push('concerns');
      if (invalid.length) { document.getElementById('profileError').hidden = false; markInvalid(form, invalid); return; }
      if (profile.employeeCount > 0) profile.hasEmployees = 'yes'; if (profile.employeeCount === 0 && profile.hasEmployees === 'yes') profile.employeeCount = 1;
      state.profile = profile; state.view = 'quiz'; state.currentIndex = 0; state.startedAt = state.startedAt || Utils.now(); state.completedAt = null; state.report = null;
      save(); Analytics.track('profile_complete', { industry: profile.industry }, state); render(); focusMain();
    });
  }

  function clearInvalid(form) { form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid')); document.getElementById('profileError').hidden = true; }
  function markInvalid(form, names) { names.forEach(k => form.elements[k]?.setAttribute('aria-invalid', 'true')); (form.querySelector('[aria-invalid="true"]') || form.querySelector('input[name="concerns"]'))?.focus(); }

  function applicable() { return QuestionEngine.getApplicableQuestions(questionData, state); }

  function renderQuiz() {
    const questions = applicable(); if (!questions.length) { showToast('目前沒有可用題目。'); navigate('profile'); return; }
    state.currentIndex = Math.max(0, Math.min(state.currentIndex, questions.length - 1));
    const q = questions[state.currentIndex]; const answer = state.answers[q.id];
    const answered = questions.filter(x => QuestionEngine.isAnswered(state.answers[x.id])).length;
    const progress = Math.round(answered / questions.length * 100);
    const domainQuestions = questions.filter(x => x.domain === q.domain); const domainAnswered = domainQuestions.filter(x => QuestionEngine.isAnswered(state.answers[x.id])).length;
    if (lastQuestionCount && lastQuestionCount !== questions.length) showToast(`依回答更新為 ${questions.length} 題適用題目。`); lastQuestionCount = questions.length;
    app.innerHTML = `<div class="quiz-layout">
      <aside class="quiz-sidebar" aria-label="填答進度"><div><div class="progress-ring" style="--progress:${progress}%"><strong>${progress}%</strong></div><div class="progress-meta">已完成 ${answered}／${questions.length} 題</div></div>
        <div class="domain-progress"><span>${Utils.escapeHTML(q.domain)}進度</span><strong>${domainAnswered}/${domainQuestions.length}</strong></div>
        <ul class="domain-list">${Config.domains.map(d => { const ds = questions.filter(x => x.domain === d); const da = ds.filter(x => QuestionEngine.isAnswered(state.answers[x.id])); return `<li class="${d === q.domain ? 'active' : ''}"><span>${d}</span><span>${da.length}/${ds.length}</span></li>`; }).join('')}</ul></aside>
      <section class="question-area"><div class="question-topline"><span class="question-domain">${Utils.escapeHTML(q.domain)}｜${Utils.escapeHTML(q.category)}</span><span class="question-count">第 ${state.currentIndex + 1} 題，共 ${questions.length} 題</span></div>
        <article class="question-card"><h1>${Utils.escapeHTML(q.question)}</h1><p class="question-description">${Utils.escapeHTML(q.description || '請依目前實際情況回答。')}</p>
          <div class="options" role="${q.type === 'multi_choice' ? 'group' : 'radiogroup'}" aria-label="回答選項">${q.options.map((opt, index) => optionHTML(q, opt, index, answer)).join('')}</div>
          <div class="special-options">${q.allow_unknown !== false ? specialOptionHTML('unknown', '不確定／需要確認', answer) : ''}${q.allow_na ? specialOptionHTML('na', '目前不適用', answer) : ''}</div>
          <details class="question-why"><summary>為什麼要問這題？</summary><p>${Utils.escapeHTML(q.why || q.risk_name)}</p></details>
          <div id="questionError" class="inline-error" role="alert" hidden>請先選擇一個答案。</div></article>
        <div class="quiz-actions"><div class="quiz-actions-group"><button class="btn btn-secondary" type="button" id="prevQuestion" ${state.currentIndex === 0 ? 'disabled' : ''}>上一步</button><button class="btn btn-link" type="button" id="saveExit">暫存離開</button></div>
          <div class="quiz-actions-group"><button class="btn btn-secondary" type="button" id="reviewNow">檢視答案</button><button class="btn btn-primary" type="button" id="nextQuestion" ${QuestionEngine.isAnswered(answer) ? '' : 'disabled'}>${state.currentIndex === questions.length - 1 ? '完成並查看報告' : '下一步'}</button></div></div>
      </section></div>`;
    bindQuiz(q);
  }

  function optionHTML(q, opt, index, answer) {
    const selected = q.type === 'multi_choice' ? (answer?.values || []).includes(opt.value) : answer?.value === opt.value && !answer?.special;
    return `<button class="option-button ${selected ? 'selected' : ''}" type="button" role="${q.type === 'multi_choice' ? 'checkbox' : 'radio'}" aria-checked="${selected}" data-option="${Utils.escapeAttr(opt.value)}"><span class="option-index">${String.fromCharCode(65 + index)}</span><span>${Utils.escapeHTML(opt.label)}</span></button>`;
  }
  function specialOptionHTML(value, label, answer) { const selected = answer?.special === value; return `<button class="option-button ${selected ? 'selected' : ''}" type="button" role="radio" aria-checked="${selected}" data-special="${value}"><span>${label}</span></button>`; }

  function bindQuiz(q) {
    document.querySelectorAll('[data-option]').forEach(btn => btn.addEventListener('click', () => selectOption(q, btn.dataset.option)));
    document.querySelectorAll('[data-special]').forEach(btn => btn.addEventListener('click', () => { state.answers[q.id] = { special: btn.dataset.special, label: btn.dataset.special === 'unknown' ? '不確定／需要確認' : '目前不適用', severity: btn.dataset.special === 'unknown' ? 2.5 : null, answeredAt: Utils.now() }; save(); render(); }));
    document.getElementById('prevQuestion').addEventListener('click', () => { state.currentIndex--; save(); render(); focusMain(); });
    document.getElementById('saveExit').addEventListener('click', () => { save('進度已暫存'); state.view = 'home'; save(); render(); focusMain(); showToast('已暫存，可從首頁繼續填答。'); Analytics.track('assessment_abandon', { answered: Object.keys(state.answers).length }, state); });
    document.getElementById('reviewNow').addEventListener('click', () => navigate('review'));
    document.getElementById('nextQuestion').addEventListener('click', () => {
      if (!QuestionEngine.isAnswered(state.answers[q.id])) { document.getElementById('questionError').hidden = false; return; }
      const updated = applicable(); const idx = updated.findIndex(x => x.id === q.id);
      if (idx >= updated.length - 1) finishAssessment(); else { state.currentIndex = idx + 1; save(); render(); focusMain(); }
    });
  }

  function selectOption(q, value) {
    const option = q.options.find(o => o.value === value); if (!option) return;
    if (q.type === 'multi_choice') {
      const current = state.answers[q.id]?.values || []; const values = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      const options = values.map(v => q.options.find(o => o.value === v)).filter(Boolean);
      state.answers[q.id] = { values, labels: options.map(o => o.label), severity: options.length ? Math.max(...options.map(o => Number(o.severity || 0))) : null, special: null, answeredAt: Utils.now() };
    } else state.answers[q.id] = { value, label: option.label, severity: option.severity, special: null, answeredAt: Utils.now() };
    save(); render();
  }

  async function finishAssessment() {
    const questions = applicable(); const unanswered = questions.findIndex(q => !QuestionEngine.isAnswered(state.answers[q.id]));
    if (unanswered >= 0) { state.currentIndex = unanswered; save(); render(); focusMain(); showToast('還有適用題目尚未作答。'); return; }
    state.completedAt = Utils.now(); state.report = ScoringEngine.calculate(questionData, state, questions); state.view = 'report'; state.submission = { status: 'pending', lastAttemptAt: Utils.now() }; save(); render(); focusMain();
    Analytics.track('assessment_complete', { health: state.report.health, alerts: state.report.alerts.length }, state);
    if (Config.features.autoSubmitAssessment && !state.demo) submitAssessment();
  }

  function buildAssessmentPayload() {
    return {
      type: 'assessment', assessmentId: state.assessmentId,
      versions: { app: Config.versions.app, questions: state.questionVersion, scoring: Config.versions.scoring, consent: Config.versions.consent, report: Config.versions.report },
      profile: state.profile, answers: state.answers, report: state.report,
      consent: state.consent, startedAt: state.startedAt, completedAt: state.completedAt,
      source: { ...state.source, currentUrl: location.href, device: Utils.deviceType(), language: navigator.language },
      submittedAt: Utils.now()
    };
  }

  async function submitAssessment() {
    state.submission = { status: 'sending', lastAttemptAt: Utils.now() }; save(); updateSubmissionStatus();
    const result = await Api.submitAssessment(buildAssessmentPayload());
    state.submission = result.localOnly ? { status: 'local_only', lastAttemptAt: Utils.now() } : result.ok ? { status: 'submitted', lastAttemptAt: Utils.now() } : { status: 'queued', lastAttemptAt: Utils.now(), error: result.error };
    save(); updateSubmissionStatus();
  }

  function renderReport() {
    const r = state.report || ScoringEngine.calculate(questionData, state, applicable()); state.report = r;
    const statusText = { green: '綠燈｜目前狀況穩定', yellow: '黃燈｜有可預防的管理缺口', orange: '橙燈｜建議近期由專業人員確認', red: '紅燈｜存在需要優先處理的訊號' }[r.status];
    const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + (r.alerts.some(a => a.level === 'red') ? 30 : r.overall >= 40 ? 90 : 365));
    app.innerHTML = `<header class="page-header report-title"><p class="eyebrow">企業健檢摘要報告</p><h1>${Utils.escapeHTML(state.profile.companyName || '企業')}的目前經營訊號</h1><p>健檢編號 ${Utils.escapeHTML(state.assessmentId)}｜完成 ${r.questionCount} 題｜${Utils.formatDate(r.generatedAt)}</p></header>
      <div id="submissionStatus" class="submission-status"></div>
      <section class="report-header"><div class="score-card"><p class="eyebrow">企業健康指數</p><div class="score-number"><strong>${r.health}</strong><span>／100</span></div><span class="light-label status-${r.status}">${statusText}</span><p>資料可信度 ${r.confidence}／100。${r.alerts.length ? '重大警示另行顯示，不會被平均分數掩蓋。' : '目前未觸發紅色重大警示，仍應依優先事項逐步改善。'}</p></div><div class="radar-card"><h2>五大面向風險圖</h2>${Charts.radarSVG(r.domainScores)}</div></section>
      <div class="report-meta"><span>問卷 ${Utils.escapeHTML(r.versions.questions)}</span><span>評分 ${Utils.escapeHTML(r.versions.scoring)}</span><span>報告 ${Utils.escapeHTML(r.versions.report)}</span></div>
      <div class="report-actions"><button class="btn btn-dark" id="bookReport" type="button">預約健檢說明</button><button class="btn btn-secondary" id="contactReport" type="button">由專人聯繫</button><button class="btn btn-secondary" id="fullReport" type="button">取得完整版報告</button><button class="btn btn-secondary" id="memberInfo" type="button">了解企業會員</button><button class="btn btn-secondary" id="reviewAnswers" type="button">重新檢視答案</button></div>
      ${renderAlerts(r.alerts)}
      <section class="section"><div class="section-heading"><div><p class="eyebrow">五大面向</p><h2>風險分數</h2></div><p>分數越高，表示越需要進一步處理；不適用題目不納入分母。</p></div><div class="card domain-bars">${Config.domains.map(d => domainBar(d, r.domainScores[d])).join('')}</div></section>
      <section class="section"><div class="section-heading"><div><p class="eyebrow">先處理什麼</p><h2>三項最優先事項</h2></div><p>依風險、急迫與影響範圍排序。</p></div><div class="priority-list">${r.topThree.map(priorityCard).join('')}</div></section>
      <section class="section grid grid-2"><article class="card"><h3>目前已具備的優勢</h3>${r.strengths.length ? `<ul class="clean-list">${r.strengths.map(x => `<li>${Utils.escapeHTML(x.q.question)}：${Utils.escapeHTML(QuestionEngine.answerLabel(x.a))}</li>`).join('')}</ul>` : '<p>目前資料不足以辨識明確優勢。</p>'}</article><article class="card"><h3>需要進一步確認</h3><ul class="clean-list">${r.topThree.map(x => `<li>${Utils.escapeHTML(x.q.risk_name)}｜建議 ${Utils.escapeHTML((x.q.advisor_types || []).join('、') || '專業顧問')} 確認</li>`).join('')}</ul></article></section>
      <section class="section grid grid-2"><article class="card"><h3>建議顧問類型</h3><div class="tag-list">${r.advisors.map(a => `<span class="tag">${Utils.escapeHTML(a)}</span>`).join('') || '<span class="tag">企業顧問</span>'}</div><p>顧問分配仍需經人工分診與利益衝突確認。</p></article><article class="card"><h3>建議先準備的資料</h3><ul class="clean-list">${r.prep.map(x => `<li>${Utils.escapeHTML(x)}</li>`).join('') || '<li>企業基本資料與目前最關心的問題</li>'}</ul></article></section>
      <section class="section" id="services"><div class="section-heading"><div><p class="eyebrow">下一步</p><h2>後續服務建議</h2></div><p>每項建議都對應健檢訊號，不只依總分推銷。</p></div><div class="service-grid">${r.services.map(serviceCard).join('')}</div></section>
      ${state.profile.memberStatus === 'yes' && Config.features.showMemberPoints ? renderPoints(r.points) : ''}
      ${state.profile.alternativeDecisionSupport === 'traditional' ? `<section class="section"><article class="card"><h3>其他決策輔助需求</h3><p>此需求不納入企業健康指數，也不得取代法律、財務、地政、會計或其他專業判斷。</p></article></section>` : ''}
      <section class="section grid grid-2"><article class="card"><h3>建議處理時間</h3><p>${r.alerts.some(a => a.level === 'red') ? '重大警示建議優先完成人工確認；一般改善事項於30日內建立計畫。' : r.overall >= 40 ? '建議於1～5個營業日內安排說明，並於90日內追蹤改善。' : '可先依改善清單處理，並於年度檢查時重新盤點。'}</p></article><article class="card"><h3>下次健檢建議日期</h3><p>${Utils.formatDate(nextDate.toISOString())}</p></article></section>
      <section class="section"><div class="report-actions"><button class="btn btn-secondary" id="exportJson" type="button">匯出JSON</button><button class="btn btn-secondary" id="copySummary" type="button">複製健檢摘要</button><button class="btn btn-secondary" id="printReport" type="button">列印／儲存PDF</button><button class="btn btn-danger" id="restartAssessment" type="button">重新開始健檢</button></div></section>
      <div class="disclaimer"><strong>免責聲明：</strong>本健檢僅供風險盤點與專業分診參考，不構成法律、會計、稅務、投資、不動產、資安或其他專業意見。</div>`;
    bindReportActions(r); updateSubmissionStatus(); Analytics.track('report_view', { health: r.health }, state);
  }

  function updateSubmissionStatus() {
    const el = document.getElementById('submissionStatus'); if (!el) return;
    const map = {
      not_submitted: ['', ''], pending: ['準備提交健檢結果', '系統正在整理資料。'], sending: ['正在提交', '請不要關閉頁面。'],
      submitted: ['已安全送出測試資料', '公司端可依健檢編號進行後續分診。'],
      local_only: ['目前為展示模式', '結果只儲存在本機，不會送到公司端。'],
      queued: ['資料已暫存，等待重試', '網路或端點暫時無法使用，資料仍保留在瀏覽器。']
    };
    const [title, text] = map[state.submission?.status] || map.not_submitted;
    el.innerHTML = title ? `<strong>${title}</strong><span>${text}</span>${state.submission.status === 'queued' ? '<button class="btn btn-small" id="retrySubmit" type="button">再次提交</button>' : ''}` : '';
    document.getElementById('retrySubmit')?.addEventListener('click', submitAssessment);
  }

  function renderAlerts(alerts) {
    if (!alerts.length) return '';
    const hasRed = alerts.some(a => a.level === 'red');
    return `<section class="alert-panel ${hasRed ? 'red' : 'orange'}" aria-label="重大警示"><h2>${hasRed ? '需要人工優先確認' : '近期需要確認的事項'}</h2><p>你的回答中有部分情況需要由專業人員進一步確認。系統暫不直接做出判斷。</p><div class="alert-list">${alerts.map(a => `<div class="alert-item"><strong>${Utils.escapeHTML(a.title)}｜${Utils.escapeHTML(a.time)}</strong><span>${Utils.escapeHTML(a.message)}</span><div class="tag-list">${a.advisors.map(x => `<span class="tag">${Utils.escapeHTML(x)}</span>`).join('')}</div></div>`).join('')}</div></section>`;
  }
  function domainBar(domain, score) { const value = score === null ? 0 : score; return `<div class="domain-row"><strong>${domain}</strong><div class="bar" aria-label="${domain}風險分數 ${score === null ? '不適用' : score}"><span style="width:${value}%"></span></div><em>${score === null ? 'NA' : score}</em></div>`; }
  function priorityCard(x) { return `<article class="priority-card"><div><h3>${Utils.escapeHTML(x.q.risk_name)}</h3><p>${Utils.escapeHTML(x.q.question)}<br>你的回答：${Utils.escapeHTML(QuestionEngine.answerLabel(x.a))}<br>建議：${Utils.escapeHTML((x.q.advisor_types || []).join('、') || '專業顧問')}｜${Utils.escapeHTML((x.q.service_types || [])[0] || '人工確認')}</p></div><span class="priority-score">優先分數 ${x.priority}</span></article>`; }
  function serviceCard(s) { return `<article class="service-card"><span class="badge">${Utils.escapeHTML(s.level)}</span><h3>${Utils.escapeHTML(s.level)}</h3><p>${Utils.escapeHTML(s.reason)}</p><div class="service-meta"><span><strong>預計處理：</strong>${Utils.escapeHTML(s.handle)}</span><span><strong>人工確認：</strong>${Utils.escapeHTML(s.confirm)}</span><span><strong>服務方式：</strong>${Utils.escapeHTML(s.billing)}</span></div></article>`; }
  function renderPoints(points) { const row = (name, plan) => `<tr><th>${name}</th><td>${plan.items.map(i => `${Utils.escapeHTML(i.advisor)} ${i.points}點｜${Utils.escapeHTML(i.purpose)}`).join('<br>') || '由人工依可用點數調整'}</td><td>${Utils.escapeHTML(plan.limit)}</td></tr>`; return `<section class="section"><div class="section-heading"><div><p class="eyebrow">會員點數</p><h2>三種配置建議</h2></div><p>目前可用點數：${points.available}。點數配置是服務安排建議，不等同現金或最終報價。</p></div><div class="card table-wrap"><table class="points-table"><thead><tr><th>方案</th><th>建議安排</th><th>原則</th></tr></thead><tbody>${row('最低建議', points.minimum)}${row('標準建議', points.standard)}${row('完整改善', points.complete)}</tbody></table></div></section>`; }

  function bindReportActions(r) {
    document.getElementById('bookReport').addEventListener('click', () => openContactModal('預約健檢說明'));
    document.getElementById('contactReport').addEventListener('click', () => openContactModal('由專人聯繫'));
    document.getElementById('fullReport').addEventListener('click', () => openContactModal('取得完整版報告'));
    document.getElementById('memberInfo').addEventListener('click', () => { document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }); Analytics.track('membership_click', {}, state); });
    document.getElementById('reviewAnswers').addEventListener('click', () => navigate('review'));
    document.getElementById('exportJson').addEventListener('click', exportJSON);
    document.getElementById('copySummary').addEventListener('click', async () => { await Utils.copyText(buildSummary(r)); showToast('健檢摘要已複製。'); });
    document.getElementById('printReport').addEventListener('click', () => { Analytics.track('report_print', {}, state); window.print(); });
    document.getElementById('restartAssessment').addEventListener('click', confirmRestart);
  }

  function renderReview() {
    const questions = applicable();
    app.innerHTML = `<div class="step-shell"><header class="page-header"><p class="eyebrow">答案檢視</p><h1>重新檢視已填答案</h1><p>修改後，適用題數與報告會重新計算。</p></header><div class="review-list">${questions.map((q, i) => `<article class="review-item"><div><span class="pill">${Utils.escapeHTML(q.domain)}</span><h3>${Utils.escapeHTML(q.question)}</h3><p>${Utils.escapeHTML(QuestionEngine.answerLabel(state.answers[q.id]) || '尚未作答')}</p></div><button class="btn btn-secondary" data-edit="${i}" type="button">修改</button></article>`).join('')}</div><div class="form-actions"><button class="btn btn-secondary" id="backReportOrQuiz" type="button">返回</button><button class="btn btn-primary" id="recalculate" type="button">${state.completedAt ? '重新計算報告' : '繼續填答'}</button></div></div>`;
    document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => { state.currentIndex = Number(btn.dataset.edit); state.view = 'quiz'; save(); render(); focusMain(); }));
    document.getElementById('backReportOrQuiz').addEventListener('click', () => navigate(state.completedAt ? 'report' : 'quiz'));
    document.getElementById('recalculate').addEventListener('click', () => { if (state.completedAt) { state.report = ScoringEngine.calculate(questionData, state, applicable()); state.submission = { status: 'pending', lastAttemptAt: null }; save(); navigate('report'); if (!state.demo) submitAssessment(); } else navigate('quiz'); });
  }

  function openContactModal(intent) {
    Analytics.track('contact_click', { intent }, state);
    modalRoot.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><p class="eyebrow">健檢編號 ${Utils.escapeHTML(state.assessmentId)}</p><h2 id="modalTitle">${Utils.escapeHTML(intent)}</h2></div><button class="modal-close" type="button" aria-label="關閉">×</button></div>
      <p>${Config.mode === 'demo' ? '目前為展示模式，需求只會暫存在瀏覽器。' : '送出後，公司可依健檢編號與你聯繫。'}</p>
      <form id="contactForm" novalidate><div class="form-grid">
        ${inputField('requestName','聯絡人',state.profile.contactName || '','text',true,'','',50)}${inputField('requestPhone','手機',state.profile.phone || '','tel',true,'','',30)}${inputField('requestEmail','電子郵件',state.profile.email || '','email',true,'','',150)}
        ${selectField('preferredTime','方便聯繫時段','',[['morning','平日上午'],['afternoon','平日下午'],['evening','平日晚上'],['any','皆可']],true)}
        <div class="field field-full"><label for="requestIssue">最希望先處理的問題</label><input id="requestIssue" name="requestIssue" maxlength="200" value="${Utils.escapeAttr(state.report?.topThree?.[0]?.q?.risk_name || '')}"></div>
        <div class="field field-full"><label for="requestNote">補充說明</label><textarea id="requestNote" name="requestNote" maxlength="1000" placeholder="例如：希望先了解現金流與股東協議。"></textarea></div>
        <div class="honeypot" aria-hidden="true"><label>網站<input name="website" tabindex="-1" autocomplete="off"></label></div>
        <label class="check-card field-full"><input type="checkbox" name="contactConsent"><span><strong>同意聯繫</strong>我同意澄翰顧問依本次需求，以電話或電子郵件與我聯繫。</span></label>
      </div><div id="contactError" class="inline-error" role="alert" hidden></div><div class="form-actions"><button class="btn btn-secondary modal-cancel" type="button">取消</button><button class="btn btn-primary" id="submitContact" type="submit">送出需求</button></div></form></section></div>`;
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('.modal-close').addEventListener('click', close); modalRoot.querySelector('.modal-cancel').addEventListener('click', close);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
    modalRoot.querySelector('#contactForm').addEventListener('submit', async e => {
      e.preventDefault(); const fd = new FormData(e.currentTarget); const err = document.getElementById('contactError');
      if (fd.get('website')) { close(); return; }
      if (!fd.has('contactConsent') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fd.get('requestEmail') || '') || !/^[0-9+()\-\s]{8,30}$/.test(fd.get('requestPhone') || '')) { err.textContent = '請確認聯絡資料並勾選同意聯繫。'; err.hidden = false; return; }
      const button = document.getElementById('submitContact'); button.disabled = true; button.textContent = '送出中…';
      const payload = { type: 'contact', id: Utils.uuid(), assessmentId: state.assessmentId, intent, company: state.profile.companyName, name: Utils.sanitizeText(fd.get('requestName'), 50), phone: Utils.sanitizeText(fd.get('requestPhone'), 30), email: Utils.sanitizeText(fd.get('requestEmail'), 150), preferredTime: fd.get('preferredTime'), issue: Utils.sanitizeText(fd.get('requestIssue'), 200), note: Utils.sanitizeText(fd.get('requestNote'), 1000), consentAt: Utils.now(), source: state.source };
      Storage.append(Config.storage.requestKey, payload); const result = await Api.submitContactRequest(payload);
      close(); showToast(result.localOnly ? '需求已儲存在本機展示資料。' : result.ok ? '需求已送出，我們會依你提供的方式聯繫。' : '需求已暫存，系統會在連線恢復後重試。'); Analytics.track('contact_submit', { intent, queued: !!result.queued }, state);
    });
    modalRoot.querySelector('input')?.focus();
  }

  function loadDemo(kind) {
    const demo = window.CH_DEMO_DATA?.[kind]; if (!demo) return;
    state = Storage.defaultState(); state.demo = kind; state.consent = { privacy:true, disclaimer:true, storage:true, analytics:false, acceptedAt:Utils.now() }; state.profile = Utils.deepClone(demo.profile); state.startedAt = Utils.now();
    const fill = () => applicable().forEach(q => { const target = demo.special?.[q.id] ?? demo.defaultSeverity; const option = nearestOption(q, target); if (option) state.answers[q.id] = { value:option.value,label:option.label,severity:option.severity,special:null,answeredAt:Utils.now() }; });
    fill(); fill(); state.completedAt = Utils.now(); state.report = ScoringEngine.calculate(questionData, state, applicable()); state.view = 'report'; state.submission = { status:'local_only', lastAttemptAt:null }; save(); render(); focusMain();
  }
  function nearestOption(q, target) { return [...q.options].filter(o => o.severity !== null && o.severity !== undefined).sort((a, b) => Math.abs(a.severity - target) - Math.abs(b.severity - target))[0]; }

  function exportJSON() {
    const payload = { exportedAt: Utils.now(), questionnaireVersion: state.questionVersion, appVersion: Config.versions.app, assessment: buildAssessmentPayload(), contactRequests: Storage.list(Config.storage.requestKey) };
    Utils.downloadJSON(payload, `企業健檢_${Utils.safeFileName(state.profile.companyName)}_${new Date().toISOString().slice(0, 10)}.json`); showToast('JSON已匯出。'); Analytics.track('json_export', {}, state);
  }
  function buildSummary(r) { return `${state.profile.companyName || '企業'}｜企業健康指數 ${r.health}/100\n健檢編號：${state.assessmentId}\n${r.alerts.length ? `重大警示：${r.alerts.map(a => a.title).join('、')}\n` : ''}前三優先：\n${r.topThree.map((x, i) => `${i + 1}. ${x.q.risk_name}（${QuestionEngine.answerLabel(x.a)}）`).join('\n')}\n建議顧問：${r.advisors.join('、') || '人工分診'}\n本摘要僅供初步風險盤點與專業分診參考。`; }

  function confirmRestart() { if (!confirm('重新開始會清除目前答案與報告，但保留已送出的聯絡需求。確定繼續？')) return; const profile = state.profile; state = Storage.defaultState(); state.profile = profile; save('已重新開始'); render(); focusMain(); }
  function confirmClearData() { if (!confirm('將清除本瀏覽器內的企業資料、答案、報告、暫存提交與聯繫需求。確定繼續？')) return; Storage.clear(); state = Storage.defaultState(); render(); focusMain(); showToast('本機資料已清除。'); }
  function showToast(message) { toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3000); }
})();
