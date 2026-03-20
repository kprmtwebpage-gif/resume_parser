// KPRMT Skill Interceptor - runs in MAIN world at document_start
// 1) Intercepts LinkedIn Voyager API responses → captures skill names
// 2) Acts as an API proxy for the content script (ISOLATED world)
//    — this is how SignalHire fetches ALL skills/experience without blocking.
//    MAIN world fetch = same origin + same cookies as LinkedIn's own SPA.
(function () {
  if (window.__kprmt_intercept_installed) return;
  window.__kprmt_intercept_installed = true;

  var _seen = {};
  var _csrfToken = null; // Captured from LinkedIn's own API requests

  function storeSkill(name) {
    var t = (name || '').trim();
    if (!t || t.length <= 1 || t.length >= 80) return;
    if (/^\d+$/.test(t)) return;
    var lc = t.toLowerCase();
    if (lc.indexOf('endorsement') !== -1 || lc.indexOf('endorsed by') !== -1) return;
    if (lc.indexOf('show all') !== -1 || lc.indexOf('see all') !== -1) return;
    if (_seen[lc]) return;
    _seen[lc] = true;
    var current = [];
    try { current = JSON.parse(document.documentElement.dataset.kprmtSkills || '[]'); } catch(e) {}
    current.push(t);
    document.documentElement.dataset.kprmtSkills = JSON.stringify(current);
    document.documentElement.dataset.kprmtSkillsReady = String(current.length);
  }

  function walk(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) walk(obj[i], depth + 1);
      return;
    }
    var rawUrn = obj.entityUrn;
    var urn = (typeof rawUrn === 'string' ? rawUrn : '').toLowerCase();
    var rawType = obj['$type'] || obj['_type'] || '';
    var type = (typeof rawType === 'string' ? rawType : '').toLowerCase();
    var hasSkillContext = urn.indexOf('skill') !== -1 || type.indexOf('skill') !== -1;

    if (hasSkillContext) {
      if (typeof obj.name === 'string') storeSkill(obj.name);
      if (typeof obj.localizedName === 'string') storeSkill(obj.localizedName);
      if (obj.title && typeof obj.title.text === 'string') storeSkill(obj.title.text);
      var ec = obj.components && obj.components.entityComponent;
      if (ec && ec.title && typeof ec.title.text === 'string') storeSkill(ec.title.text);
    }
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; k++) {
      var v = obj[keys[k]];
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  }

  function processResponse(text) {
    try {
      var data = JSON.parse(text);
      walk(data, 0);
    } catch(e) {}
  }

  // ── Helper: extract CSRF token from fetch init headers ─────────────
  function captureCsrf(init) {
    if (!init || !init.headers) return;
    try {
      var h = init.headers;
      var csrf = null;
      if (h instanceof Headers) { csrf = h.get('csrf-token'); }
      else if (typeof h === 'object' && !Array.isArray(h)) { csrf = h['csrf-token'] || h['Csrf-Token']; }
      if (csrf && typeof csrf === 'string' && csrf.length > 5) _csrfToken = csrf;
    } catch(e) {}
  }

  // ── Intercept window.fetch ──────────────────────────────────────────
  var _origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = (typeof input === 'string' ? input : (input && input.url)) || '';
    // Capture CSRF token from LinkedIn's own outgoing API headers
    captureCsrf(init);
    var promise = _origFetch.apply(this, arguments);
    if (url.indexOf('/voyager/api/') !== -1 &&
        (url.indexOf('skill') !== -1 || url.indexOf('Skill') !== -1 ||
         url.indexOf('profile') !== -1 || url.indexOf('Profile') !== -1)) {
      promise.then(function (resp) {
        return resp.clone().text();
      }).then(function (text) {
        processResponse(text);
      }).catch(function () {});
    }
    return promise;
  };

  // ── Intercept XMLHttpRequest (capture CSRF + intercept responses) ──
  var _origOpen = XMLHttpRequest.prototype.open;
  var _origSend = XMLHttpRequest.prototype.send;
  var _origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._kprmt_url = url || '';
    return _origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (typeof name === 'string' && name.toLowerCase() === 'csrf-token' &&
        typeof value === 'string' && value.length > 5) {
      _csrfToken = value;
    }
    return _origSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    var self = this;
    if (self._kprmt_url && self._kprmt_url.indexOf('/voyager/api/') !== -1 &&
        (self._kprmt_url.indexOf('skill') !== -1 || self._kprmt_url.indexOf('Skill') !== -1 ||
         self._kprmt_url.indexOf('profile') !== -1 || self._kprmt_url.indexOf('Profile') !== -1)) {
      self.addEventListener('load', function() {
        try {
          if (self.responseType === '' || self.responseType === 'text') {
            if (self.responseText) processResponse(self.responseText);
          }
        } catch(e) {}
      });
    }
    return _origSend.apply(this, arguments);
  };

  // ── Helper: find CSRF token from page if not captured yet ──────────
  function findCsrfToken() {
    if (_csrfToken) return _csrfToken;
    // Try meta tag
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) { _csrfToken = meta.content; return _csrfToken; }
    // Try inline scripts
    var scripts = document.querySelectorAll('script:not([src])');
    for (var i = 0; i < scripts.length; i++) {
      var m = scripts[i].textContent.match(/"csrfToken"\s*:\s*"([^"]+)"/);
      if (m) { _csrfToken = m[1]; return _csrfToken; }
    }
    // Try JSESSIONID from document.cookie (non-HttpOnly variant)
    var cookies = document.cookie.split(';');
    for (var j = 0; j < cookies.length; j++) {
      var c = cookies[j].trim();
      if (c.indexOf('JSESSIONID=') === 0) {
        _csrfToken = 'ajax:' + c.substring(11).replace(/"/g, '');
        return _csrfToken;
      }
    }
    return null;
  }

})();
