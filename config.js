(() => {
  'use strict';
  const runtime = window.CH_RUNTIME || {};
  const isFile = location.protocol === 'file:';
  const mode = runtime.mode || (isFile ? 'demo' : 'demo');
  window.CH = window.CH || {};
  window.CH.Config = Object.freeze({
    brand: {
      shortName: '澄翰顧問',
      legalName: '澄翰顧問股份有限公司',
      positioning: '企業主的第二決策團隊',
      contactEmail: runtime.contactEmail || 'service@example.com',
      privacyEmail: runtime.privacyEmail || 'privacy@example.com'
    },
    versions: {
      app: '2.0.0-beta.1',
      questions: '1.0.0-mvp',
      scoring: '2.0.0',
      consent: '2.0.0-draft',
      report: '2.0.0'
    },
    mode,
    api: {
      assessmentEndpoint: runtime.assessmentEndpoint || '',
      contactEndpoint: runtime.contactEndpoint || runtime.assessmentEndpoint || '',
      analyticsEndpoint: runtime.analyticsEndpoint || '',
      timeoutMs: 12000
    },
    features: {
      analytics: runtime.analytics === true,
      autoSubmitAssessment: runtime.autoSubmitAssessment !== false,
      showMemberPoints: true,
      allowOffline: true
    },
    storage: {
      stateKey: 'chenhan-health-check-state-v2',
      legacyStateKey: 'chenhan-health-check-state-v1',
      requestKey: 'chenhan-health-check-requests-v2',
      outboxKey: 'chenhan-health-check-outbox-v2',
      analyticsKey: 'chenhan-health-check-analytics-v2',
      submittedKey: 'chenhan-health-check-submitted-v2'
    },
    limits: {
      minQuestions: 35,
      maxQuestions: 55,
      text: 1000,
      companyName: 100,
      personName: 50,
      phone: 30,
      email: 150
    },
    domains: ['法律風險', '財務風險', '成長動能', '智權與政府補助', '資產風險'],
    domainWeights: {
      '法律風險': .25,
      '財務風險': .25,
      '成長動能': .15,
      '智權與政府補助': .15,
      '資產風險': .20
    }
  });
})();
