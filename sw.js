/* Shevet Chen service worker.
   1) Offline: keeps a copy of the app (page, scripts, fonts, icons) so it still opens with no signal.
      The app itself and its scripts are always fetched fresh first; the saved copy is only used
      when the network is down or very slow. version.json is never saved.
   2) Notifications (Web Push). */
var CACHE = 'shevet-offline-v1';
var CDN = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'unpkg.com'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(['./', 'bridge.js', 'firebase-config.js', 'icon-192.png', 'logo.png', 'manifest.webmanifest']).catch(function () {});
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('shevet-offline-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(key, res) {
  if (!res || !(res.ok || res.type === 'opaque')) return;
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { c.put(key, copy); }).catch(function () {});
}
// Fresh from the network; if it fails or takes longer than `ms`, use the saved copy.
function fresh(req, key, ms) {
  var net = fetch(req).then(function (r) { put(key, r); return r; });
  return new Promise(function (resolve, reject) {
    var done = false, saved = function () {
      return caches.match(key, { ignoreSearch: true }).then(function (m) { return m || (req.mode === 'navigate' ? caches.match('./', { ignoreSearch: true }) : null); });
    };
    var t = setTimeout(function () { saved().then(function (m) { if (m && !done) { done = true; resolve(m); } }); }, ms);
    net.then(function (r) { if (!done) { done = true; clearTimeout(t); resolve(r); } }, function (err) {
      clearTimeout(t);
      saved().then(function (m) { if (done) return; done = true; m ? resolve(m) : reject(err); });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (/version\.json$/.test(u.pathname)) return;
    var key = new Request(u.origin + u.pathname);
    e.respondWith(fresh(req, key, req.mode === 'navigate' ? 4000 : 5000));
    return;
  }
  if (CDN.indexOf(u.hostname) >= 0) {
    // Versioned libraries and fonts: saved copy first, network only the first time.
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { put(req, r); return r; });
    }));
  }
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Shevet Chen', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) { cs[i].navigate ? cs[i].navigate(url).catch(function () {}) : 0; return cs[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
