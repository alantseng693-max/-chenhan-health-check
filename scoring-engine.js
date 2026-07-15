(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config, Utils, QuestionEngine } = window.CH;

  const ALERT_CATALOG = {
    shareholder_conflict: { title: '股東或經營權衝突', level: 'red', advisors: ['律師', '高階決策顧問'], time: '4營業小時內', message: '目前訊號可能影響公司決策與營運，建議由專人優先確認。' },
    litigation: { title: '訴訟、調查或程序期限', level: 'red', advisors: ['律師'], time: '2～4營業小時內', message: '涉及程序或期限，系統不直接判斷，建議安排律師確認。' },
    labor: { title: '重大勞資事件', level: 'red', advisors: ['律師', '人資顧問'], time: '4營業小時內', message: '可能影響員工權益與營運，建議優先處理。' },
    liquidity: { title: '資金安全水位不足', level: 'red', advisors: ['財務顧問', '會計師', '律師'], time: '4營業小時內', message: '目前現金訊號可能影響持續營運，建議立即盤點。' },
    tax: { title: '欠稅或重大帳務異常', level: 'red', advisors: ['會計師', '律師'], time: '4營業小時內', message: '可能涉及稅務或資產限制，需由專業人員確認。' },
    contract: { title: '重要交易缺乏書面依據', level: 'orange', advisors: ['律師'], time: '1營業日內', message: '交易條件與證據可能不足，建議近期確認。' },
    ip: { title: '品牌或智權爭議', level: 'red', advisors: ['智權顧問', '律師'], time: '4營業小時內', message: '涉及權利期限或下架風險，建議由智權專業確認。' },
    property: { title: '重大資產產權不清', level: 'red', advisors: ['地政士', '律師'], time: '4營業小時內', message: '可能影響資產使用或處分，系統不直接下結論。' },
    nominee: { title: '借名或代持風險', level: 'red', advisors: ['律師', '地政士', '會計師'], time: '4營業小時內', message: '資產權利可能受第三人事件影響，建議優先處理。' },
    private_loan: { title: '高風險民間借款', level: 'red', advisors: ['律師', '財務顧問'], time: '2～4營業小時內', message: '可能涉及高成本或財產風險，請立即由專人確認。' },
    mixed_funds: { title: '公司與個人資金界線不清', level: 'orange', advisors: ['會計師', '律師'], time: '1營業日內', message: '公司與個人資金界線可能不清，建議進行帳務與責任盤點。' },
    concentration: { title: '營收來源高度集中', level: 'orange', advisors: ['財務顧問', '商業顧問'], time: '1營業日內', message: '營收來源集中，建議建立替代方案。' },
    regulated: { title: '特許或受管制業務待確認', level: 'red', advisors: ['律師', '產業顧問'], time: '2～4營業小時內', message: '可能涉及主管機關或受管制業務，系統停止一般性判斷。' },
    succession: { title: '傳承或決策權真空', level: 'red', advisors: ['律師', '會計師', '高階決策顧問'], time: '4營業小時內', message: '可能出現決策與權利真空，建議由跨領域團隊確認。' },
    data_incident: { title: '資料外洩或資訊事件', level: 'red', advisors: ['資安顧問', '律師'], time: '立即至4營業小時內', message: '資料事件可能持續擴大，建議先控制影響範圍並由專業人員確認。' },
    fraud: { title: '不明支出或舞弊跡象', level: 'red', advisors: ['會計師', '律師', '內控顧問'], time: '4營業小時內', message: '目前訊號可能涉及資金或權限異常，建議保留紀錄並由專業人員確認。' }
  };

  const ADVISOR_PREP = {
    '律師': ['重要合約與往來訊息', '已收到的通知、函文或程序期限', '股東、員工或交易相關紀錄'],
    '會計師': ['近6個月基本帳務與報表', '稅務通知、借款及股東往來資料', '主要收入、成本與憑證'],
    '財務顧問': ['13週收付款預估', '應收、應付與借款清單', '可動用現金及每月固定支出'],
    '地政士': ['近期謄本或權利資料', '買賣、租賃、借名或擔保契約', '付款與出資證明'],
    '智權顧問': ['品牌、標誌、技術與作品清單', '申請、授權或委外契約', '侵權通知與使用時間紀錄'],
    '政府補助顧問': ['申請計畫與核定文件', '預算、核銷與里程碑資料', '研發成果與人力配置'],
    '資安顧問': ['事件時間軸與受影響系統', '帳號權限及存取紀錄', '備份、雲端與供應商資料'],
    '人資顧問': ['勞動契約、出勤與薪資紀錄', '投保、離職與申訴資料', '工作規則或人事制度'],
    '高階決策顧問': ['主要決策爭點與目標', '股東或管理團隊立場', '可接受的時程與限制']
  };

  const POINTS = {
    '律師': 1000, '會計師': 700, '地政士': 300, '智權顧問': 200, '政府補助顧問': 200,
    '財務顧問': 600, '一般財務顧問': 200, '高階決策顧問': 600, '人資顧問': 600,
    '資安顧問': 600, '商業顧問': 400, '產業顧問': 600, '內控顧問': 600
  };

  function sizeCoefficient(profile) {
    const emp = Number(profile.employeeCount || 0);
    let c = emp >= 100 ? 1.15 : emp >= 30 ? 1.10 : emp >= 10 ? 1.05 : 1;
    if (profile.revenueRange === 'over100m') c = Math.max(c, 1.15);
    else if (profile.revenueRange === '50m-100m') c = Math.max(c, 1.10);
    return c;
  }

  function industryCoefficient(industry) {
    return ({ finance: 1.15, health: 1.12, construction: 1.10, manufacturing: 1.08, food: 1.08, technology: 1.05 }[industry] || 1);
  }

  function detectAlert(q, answer, score = {}) {
    const s = QuestionEngine.severity(answer);
    if (s < 0) return null;
    let key = null;
    if (q.id === 'L-GOV-05' && s >= 4) key = 'shareholder_conflict';
    else if (q.id === 'L-DIS-01' && s >= 4) key = 'litigation';
    else if (q.id === 'L-LAB-05' && s >= 4) key = 'labor';
    else if ((q.id === 'F-CSH-01' && s >= 5) || (q.id === 'F-CSH-05' && s >= 5)) key = 'liquidity';
    else if (q.id === 'F-TAX-03' && s >= 5) key = 'tax';
    else if (q.id === 'F-FIN-02' && s >= 4) key = 'private_loan';
    else if (q.id === 'L-GOV-04' && s >= 4) key = 'mixed_funds';
    else if (q.id === 'G-CUS-01' && s >= 4) key = 'concentration';
    else if (q.id === 'L-COM-01' && s >= 4) key = 'regulated';
    else if (q.id === 'L-DAT-03' && s >= 4) key = 'data_incident';
    else if (q.id === 'F-CTL-05' && s >= 4) key = 'fraud';
    else if (q.id === 'A-OWN-01' && s >= 4) key = 'nominee';
    else if (['A-REA-01', 'A-REA-03', 'A-OWN-04'].includes(q.id) && s >= 4) key = 'property';
    else if (q.id === 'A-SUC-01' && s >= 4) key = 'succession';
    else if (['L-CON-01', 'L-CON-03'].includes(q.id) && s >= 4) key = 'contract';
    else if (['I-BRD-05', 'L-CON-04'].includes(q.id) && s >= 4) key = 'ip';
    else if (q.red_flag && s >= 4) key = q.domain === '資產風險' ? 'property' : q.domain === '智權與政府補助' ? 'ip' : q.domain === '財務風險' ? 'liquidity' : 'litigation';
    else if (q.orange_flag && s >= 3) key = q.domain === '成長動能' ? 'concentration' : 'contract';
    if (!key) return null;
    return { key, questionId: q.id, source: q.question, score: Utils.round(score.risk || 0), ...ALERT_CATALOG[key] };
  }

  function scoreQuestion(q, answer, state) {
    const severity = QuestionEngine.severity(answer);
    if (severity < 0) return { risk: null, urgencyScore: 0, impactScore: 0 };
    const ratio = Utils.clamp(severity / 5, 0, 1);
    const likelihood = severity * 20;
    const impactScore = q.impact * 20 * ratio;
    const urgencyScore = q.urgency * 20 * ratio;
    const controlGap = (q.type === 'single_choice' || q.category.includes('制度') || q.category.includes('管理')) ? severity * 20 : severity * 16;
    let risk = likelihood * .25 + impactScore * .30 + urgencyScore * .25 + controlGap * .20;
    const happened = severity >= 4 && (q.manual_review || q.red_flag || /發生|目前|是否有|已收到|正在/.test(q.question));
    if (happened) risk *= 1.15;
    risk *= sizeCoefficient(state.profile || {});
    risk *= industryCoefficient(state.profile?.industry);
    const alert = detectAlert(q, answer, { risk, urgencyScore, impactScore });
    if (alert?.level === 'red') risk = Math.max(85, risk);
    if (alert?.level === 'orange') risk = Math.min(100, risk + 10);
    return {
      risk: Utils.round(Math.min(100, risk)), urgencyScore: Utils.round(urgencyScore), impactScore: Utils.round(impactScore),
      likelihood: Utils.round(likelihood), controlGap: Utils.round(controlGap), happened
    };
  }

  function dedupeAlerts(alerts) {
    const map = new Map();
    alerts.forEach(a => { const current = map.get(a.key); if (!current || a.score > current.score) map.set(a.key, a); });
    return [...map.values()].sort((a, b) => (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1) || b.score - a.score);
  }

  function confidence(questions, state) {
    const applicable = questions.length || 1;
    const answered = questions.filter(q => QuestionEngine.isAnswered(state.answers[q.id])).length;
    const unknown = questions.filter(q => state.answers[q.id]?.special === 'unknown').length;
    let consistency = 100;
    if (state.profile.hasEmployees === 'no' && Number(state.profile.employeeCount) > 0) consistency -= 20;
    const completeness = answered / applicable * 100;
    const evidence = Math.max(45, 100 - unknown / applicable * 70);
    return Utils.round(completeness * .50 + consistency * .20 + evidence * .15 + 100 * .15);
  }

  function buildServices(overall, domainScores, topThree, alerts) {
    const list = [];
    if (alerts.some(a => a.level === 'red')) list.push({ level: '緊急人工處理', reason: '已出現重大警示，需先由人工確認期限、範圍與安全事項。', handle: '安排專人優先聯繫與專業分診。', confirm: '是', billing: '先確認範圍，再決定點數或另案。' });
    if (overall < 25 && !alerts.length) list.push({ level: '自行改善清單', reason: '目前未見明顯重大訊號，可先維持制度並補強少數缺口。', handle: '提供自我檢核與年度追蹤日期。', confirm: '否', billing: '不使用點數。' });
    if (topThree.some(x => x.risk >= 25 && x.risk < 50)) list.push({ level: '文件或工具包', reason: '部分問題屬於可標準化的制度或文件缺口。', handle: '提供適用邊界、清單與版本化文件。', confirm: '視文件內容', billing: '文件兌換或另行取得。' });
    if (Object.values(domainScores).some(v => v !== null && v >= 40)) list.push({ level: '單次顧問諮詢', reason: '至少一個面向需要由專業人員確認背景與實際文件。', handle: '針對最高優先事項進行30～60分鐘盤點。', confirm: '是', billing: '顧問專業時間可使用點數。' });
    if (Object.values(domainScores).filter(v => v !== null && v >= 50).length >= 2) list.push({ level: '跨領域聯合諮詢', reason: '同一問題可能同時影響法律、財務、智權或資產。', handle: '指定主責顧問，整合跨專業摘要。', confirm: '是', billing: '諮詢用點數，執行工作另案。' });
    if (topThree.filter(x => x.risk >= 35).length >= 3) list.push({ level: '企業會員', reason: '有多項持續管理需求，適合透過單一窗口分階段追蹤。', handle: '建立90日改善順序、點數與再次健檢。', confirm: '是', billing: '依會員制度使用點數。' });
    if (topThree.some(x => x.risk >= 70 || (x.q.manual_review && x.happened))) list.push({ level: '專案服務', reason: '部分事項可能超過單次說明，涉及文件製作、談判、申請或執行。', handle: '先定義範圍、成果、時程與報價。', confirm: '是', billing: '前期盤點可用點數，執行另立專案。' });
    list.push({ level: '年度追蹤健檢', reason: '風險與企業條件會隨人員、交易與資金變化。', handle: '建議90日或12個月後再次健檢。', confirm: '否', billing: '依會員或追蹤方案。' });
    return list.slice(0, 6);
  }

  function buildPoints(advisors, topThree, profile) {
    const available = Number(profile.availablePoints || 0);
    const candidates = Utils.unique(topThree.flatMap(x => x.q.advisor_types)).filter(Boolean);
    const first = candidates[0] || advisors[0] || '財務顧問';
    const second = candidates[1] || advisors[1] || '律師';
    const third = candidates[2] || advisors[2] || '會計師';
    const base = a => POINTS[a] || 600;
    const minimum = [{ advisor: first, points: base(first), purpose: '確認最高優先事項' }];
    const standard = [...minimum, { advisor: second, points: base(second), purpose: '處理第二項跨域問題' }];
    if (![first, second].includes(third)) standard.push({ advisor: third, points: base(third), purpose: '補充第三項專業盤點' });
    const fit = (items, cap) => { const result = []; let sum = 0; for (const item of items) { if (sum + item.points <= cap || !result.length) { result.push(item); sum += item.points; } } return result; };
    return {
      available,
      minimum: { items: fit(minimum, Math.floor(available * .4) || Infinity), limit: '不超過可用點數40%' },
      standard: { items: fit(standard, Math.floor(available * .8) || Infinity), limit: '不超過可用點數80%，保留20%供追問' },
      complete: { items: standard, limit: '點數只涵蓋諮詢與盤點；文件、申請、談判或執行另案' }
    };
  }

  function calculate(data, state, questions) {
    const scored = []; const alerts = [];
    questions.forEach(q => {
      const answer = state.answers[q.id];
      if (!QuestionEngine.isAnswered(answer) || answer.special === 'na') return;
      const score = scoreQuestion(q, answer, state);
      scored.push({ q, a: answer, ...score });
      const alert = detectAlert(q, answer, score); if (alert) alerts.push(alert);
    });
    const uniqueAlerts = dedupeAlerts(alerts);
    const weights = data.domain_weights || Config.domainWeights;
    const domainScores = {};
    Config.domains.forEach(domain => {
      const rows = scored.filter(x => x.q.domain === domain);
      domainScores[domain] = rows.length ? Utils.round(rows.reduce((s, x) => s + x.risk * (x.q.weight || 1), 0) / rows.reduce((s, x) => s + (x.q.weight || 1), 0)) : null;
    });
    let weighted = 0, weightTotal = 0;
    Config.domains.forEach(d => { if (domainScores[d] !== null) { weighted += domainScores[d] * weights[d]; weightTotal += weights[d]; } });
    const overall = weightTotal ? Utils.round(weighted / weightTotal) : 0;
    let health = Utils.round(100 - overall);
    if (uniqueAlerts.some(a => a.level === 'red')) health = Math.min(49, health);
    const status = health >= 80 ? 'green' : health >= 65 ? 'yellow' : health >= 50 ? 'orange' : 'red';
    const priority = scored.map(x => ({ ...x, priority: Utils.round(x.risk * .45 + x.urgencyScore * .35 + x.impactScore * .20 + (detectAlert(x.q, x.a, x)?.level === 'red' ? 100 : 0)) })).sort((a, b) => b.priority - a.priority).slice(0, 8);
    const topThree = priority.slice(0, 3);
    const strengths = scored.filter(x => x.risk <= 24).sort((a, b) => a.risk - b.risk).slice(0, 3);
    const advisors = Utils.unique([...uniqueAlerts.flatMap(a => a.advisors), ...topThree.flatMap(x => x.q.advisor_types || [])]).slice(0, 8);
    const prep = Utils.unique(advisors.flatMap(a => ADVISOR_PREP[a] || [])).slice(0, 8);
    return {
      assessmentId: state.assessmentId,
      generatedAt: Utils.now(),
      versions: { app: Config.versions.app, questions: data.version || Config.versions.questions, scoring: Config.versions.scoring, report: Config.versions.report },
      overall, health, status, domainScores, alerts: uniqueAlerts, topThree, priority, strengths,
      confidence: confidence(questions, state), advisors, prep,
      services: buildServices(overall, domainScores, topThree, uniqueAlerts),
      points: buildPoints(advisors, topThree, state.profile || {}), questionCount: questions.length
    };
  }

  window.CH.ScoringEngine = { calculate, scoreQuestion, detectAlert, ALERT_CATALOG, ADVISOR_PREP };
})();
