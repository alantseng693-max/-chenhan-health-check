(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config, Utils, Storage } = window.CH;
  function track(name, properties = {}, state = null) {
    const allowed = state?.consent?.analytics === true;
    const event = {
      id: Utils.uuid(), name, at: Utils.now(), assessmentId: state?.assessmentId || null,
      properties: { ...properties, mode: Config.mode, device: Utils.deviceType(), path: location.pathname }
    };
    if (!allowed) return event;
    Storage.append(Config.storage.analyticsKey, event);
    if (Config.features.analytics && Config.api.analyticsEndpoint) {
      fetch(Config.api.analyticsEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event), keepalive: true
      }).catch(() => {});
    }
    return event;
  }
  window.CH.Analytics = { track };
})();
