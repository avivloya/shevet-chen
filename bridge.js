/* Shevet Chen: connects the app to Firebase (sign-in + database).
   The app was first built as a claude.ai Artifact. It talks to a small
   `window.claude.use('db' | 'user')` API, which this file recreates on top of
   Firebase Auth and Cloud Firestore, so the app code itself stays the same. */
(function () {
  var cfg = window.FIREBASE_CONFIG;
  var configured = cfg && cfg.apiKey && cfg.apiKey.indexOf('PASTE') !== 0;

  /* ---------- small UI helpers for the sign-in screen ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#fbGate{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;background:#f7f5f0;font-family:Nunito,Rubik,system-ui,sans-serif;font-weight:500;color:#17211c;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 24px) 24px calc(env(safe-area-inset-bottom,0px) + 20px)}' +
    '#fbGate .box{width:100%;max-width:360px;margin:auto 0;display:flex;flex-direction:column}' +
    '#fbGate .lg{align-self:center;color:#111;margin:4vh 0 6px}#fbGate .lg svg{width:min(62vw,230px);height:auto;display:block}' +
    '#fbGate .lg svg [fill="currentColor"]{stroke:currentColor;stroke-width:1.4;paint-order:stroke}' +
    '#fbGate .hi{text-align:center;font-size:1.02rem;color:#68736d;margin:0 0 30px}' +
    '#fbGate button{font:inherit;cursor:pointer;border-radius:14px;padding:14px 18px;width:100%;border:0;background:#2f6b52;color:#fff;font-weight:700;font-size:1rem;transition:transform .12s,opacity .15s}' +
    '#fbGate button:active{transform:scale(.97)}' +
    '#fbGate button.gbtn{background:#fff;color:#17211c;box-shadow:0 1px 2px rgba(20,30,25,.06),0 4px 14px rgba(20,30,25,.06);display:flex;align-items:center;justify-content:center;gap:10px}' +
    '#fbGate button.gbtn svg{width:18px;height:18px;flex:none}' +
    '#fbGate .or{display:flex;align-items:center;gap:12px;color:#8a938e;font-size:.82rem;margin:22px 0 14px}#fbGate .or:before,#fbGate .or:after{content:"";flex:1;height:1px;background:#e3e1da}' +
    '#fbGate .fields{background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(20,30,25,.06),0 4px 14px rgba(20,30,25,.06);overflow:hidden;margin-bottom:12px}' +
    '#fbGate input{font:inherit;font-size:16px;width:100%;box-sizing:border-box;border:0!important;border-radius:0!important;box-shadow:none!important;padding:15px 16px;margin:0;background:transparent!important;color:#17211c;outline:none;display:block}' +
    '#fbGate input+input{border-top:1px solid #ecebe6!important}#fbGate input::placeholder{color:#9aa29d}' +
    '#fbGate .err{color:#c0507a;font-size:.88rem;min-height:1.3em;margin-top:12px;text-align:center}' +
    '#fbGate .links{display:flex;justify-content:center;gap:6px 18px;flex-wrap:wrap;margin-top:6px}' +
    '#fbGate .link{background:none;color:#2f6b52;width:auto;padding:6px 2px;font-weight:600;font-size:.9rem}#fbGate .link.muted{color:#8a938e;font-weight:500}' +
    '#fbGate .foot{text-align:center;color:#a3aaa5;font-size:.75rem;margin-top:28px;letter-spacing:.02em}' +
    '#fbSignOut:not(.set-row){font:inherit;cursor:pointer;border-radius:999px;padding:6px 14px;border:1px solid #e9e1d6;background:#fff;color:#b4436c;font-size:.85rem}' +
    /* Cheny shows only once its helper address is set in firebase-config.js */
    (window.CHENY_URL ? '' : '#chenyBtn,#chenyPanel{display:none!important}');
  document.head.appendChild(css);

  var HE = (function () { try { return (localStorage.getItem('shachbag-lang') || 'en') === 'he'; } catch (e) { return false; } })();
  var T = HE ? {
    google: 'המשך עם Google', or: 'או עם אימייל', mail: 'אימייל', pass: 'סיסמה (6 תווים לפחות)', signIn: 'כניסה', create: 'יצירת חשבון',
    toUp: 'חדשים כאן? יצירת חשבון', toIn: 'כבר יש לכם חשבון? כניסה', forgot: 'שכחתי סיסמה', typeMail: 'כתבו קודם את האימייל.',
    resetSent: 'שלחנו קישור לאיפוס לאימייל.', signOut: 'יציאה', sub: 'תנועת הצופים · שכב״ג', name: 'שבט חן', hi: 'היכנסו כדי להמשיך', foot: 'שבט חן · תנועת הצופים'
  } : {
    google: 'Continue with Google', or: 'or with email', mail: 'Email', pass: 'Password (6+ characters)', signIn: 'Sign in', create: 'Create account',
    toUp: 'New here? Create an account', toIn: 'Already have an account? Sign in', forgot: 'Forgot password', typeMail: 'Type your email first.',
    resetSent: 'Check your email for a reset link.', signOut: 'Sign out', sub: 'Tzofim · Shachbag', name: 'Shevet Chen', hi: 'Sign in to continue', foot: 'Shevet Chen · Tzofim'
  };
  function gate(html) {
    var g = document.getElementById('fbGate');
    if (!g) { g = document.createElement('div'); g.id = 'fbGate'; (document.body || document.documentElement).appendChild(g); }
    g.dir = HE ? 'rtl' : 'ltr';
    g.innerHTML = '<div class="box"><div class="lg" role="img" aria-label="' + T.name + '"></div><p class="hi">' + T.hi + '</p>' + html + '<div class="foot">' + T.foot + '</div></div>';
    var put = function () { var box = g.querySelector('.lg'), src = document.querySelector('#logo svg, .logo-img svg'); if (!box || box.firstChild) return !!src; if (src) { var c = src.cloneNode(true); c.removeAttribute('id'); box.appendChild(c); } return !!src; };
    if (!put()) { document.addEventListener('DOMContentLoaded', put); setTimeout(put, 300); }
    return g;
  }
  function onReady(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }

  if (!configured) {
    window.claude = undefined;
    onReady(function () {
      gate('<p>This site isn’t connected to its database yet.</p><p class="sub">Paste your Firebase settings into <b>firebase-config.js</b> (see README).</p>');
    });
    return;
  }

  firebase.initializeApp(cfg);
  var auth = firebase.auth();
  // Stay signed in across refreshes, updates and app restarts.
  try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {}); } catch (e) {}
  var fs = firebase.firestore();
  if (cfg.emulator) { auth.useEmulator('http://127.0.0.1:9099'); fs.useEmulator('127.0.0.1', 8080); } // local testing only

  /* ---------- database wrapper ----------
     Same calls the app already uses (collection, doc, where, orderBy, limit,
     onSnapshot, add, set, update, delete). If the server refuses a read
     (someone not approved yet), the app gets an empty result instead of an error. */
  var EMPTY = { docs: [], exists: false, data: function () { return undefined; }, metadata: { fromCache: false } };
  function wrap(ref) {
    var w = Object.create(ref);
    ['where', 'orderBy', 'limit', 'collection', 'doc'].forEach(function (m) {
      if (typeof ref[m] === 'function') w[m] = function () { return wrap(ref[m].apply(ref, arguments)); };
    });
    w.onSnapshot = function (next, err) {
      // includeMetadataChanges: the app waits for a server-confirmed result before it hides "Connecting…"
      return ref.onSnapshot({ includeMetadataChanges: true }, next, function (e) {
        if (e && e.code === 'permission-denied') next(EMPTY);
        else if (err) err(e);
      });
    };
    ['add', 'set', 'update', 'delete', 'get'].forEach(function (m) {
      if (typeof ref[m] === 'function') w[m] = function () { return ref[m].apply(ref, arguments); };
    });
    if ('id' in ref) w.id = ref.id;
    return w;
  }
  var db = { collection: function (p) { return wrap(fs.collection(p)); }, doc: function (p) { return wrap(fs.doc(p)); } };

  /* ---------- sign-in ---------- */
  var signedIn = new Promise(function (resolve) {
    var resolved = false;
    auth.onAuthStateChanged(function (u) {
      if (u) {
        var g = document.getElementById('fbGate'); if (g) g.remove();
        if (!resolved) { resolved = true; resolve(u); }
        else location.reload();
      } else if (resolved) {
        location.reload();
      } else {
        onReady(showSignIn);
      }
    });
  });

  function showSignIn() {
    var mode = 'in';
    function draw() {
      var g = gate(
        '<button class="gbtn" id="fbGoogle" type="button"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>' + T.google + '</span></button>' +
        '<div class="or">' + T.or + '</div>' +
        '<form id="fbEmail"><div class="fields"><input id="fbMail" type="email" autocomplete="email" placeholder="' + T.mail + '" required>' +
        '<input id="fbPass" type="password" autocomplete="' + (mode === 'in' ? 'current' : 'new') + '-password" placeholder="' + T.pass + '" minlength="6" required></div>' +
        '<button type="submit">' + (mode === 'in' ? T.signIn : T.create) + '</button></form>' +
        '<div class="err" id="fbErr" role="alert"></div>' +
        '<div class="links"><button class="link" id="fbSwitch" type="button">' + (mode === 'in' ? T.toUp : T.toIn) + '</button>' +
        (mode === 'in' ? '<button class="link muted" id="fbReset" type="button">' + T.forgot + '</button>' : '') + '</div>');
      var MSG = {
        'auth/invalid-credential': HE ? 'האימייל או הסיסמה לא נכונים. אין לך חשבון עדיין? לחצו על "יצירת חשבון" למטה.' : 'Wrong email or password. No account yet? Tap "Create an account" below first.',
        'auth/invalid-login-credentials': HE ? 'האימייל או הסיסמה לא נכונים. אין לך חשבון עדיין? לחצו על "יצירת חשבון" למטה.' : 'Wrong email or password. No account yet? Tap "Create an account" below first.',
        'auth/user-not-found': HE ? 'אין חשבון עם האימייל הזה. לחצו על "יצירת חשבון" למטה.' : 'No account with that email. Tap "Create an account" below.',
        'auth/wrong-password': HE ? 'הסיסמה לא נכונה.' : 'That password is wrong.',
        'auth/email-already-in-use': HE ? 'כבר יש חשבון עם האימייל הזה. היכנסו במקום.' : 'There is already an account with that email. Sign in instead.',
        'auth/weak-password': HE ? 'הסיסמה צריכה לפחות 6 תווים.' : 'The password needs at least 6 characters.',
        'auth/invalid-email': HE ? 'האימייל לא תקין.' : 'That email doesn\u2019t look right.',
        'auth/popup-closed-by-user': HE ? 'החלון נסגר לפני שסיימתם. נסו שוב.' : 'The Google window closed before you finished. Try again.',
        'auth/cancelled-popup-request': '',
        'auth/unauthorized-domain': HE ? 'האתר הזה עוד לא מאושר ב־Firebase (Authorized domains).' : 'This site isn\u2019t allowed yet in Firebase (Authentication > Settings > Authorized domains).',
        'auth/operation-not-allowed': HE ? 'שיטת הכניסה הזו לא מופעלת ב־Firebase (Authentication > Sign-in method).' : 'This sign-in method isn\u2019t turned on in Firebase (Authentication > Sign-in method).',
        'auth/network-request-failed': HE ? 'אין חיבור לאינטרנט. נסו שוב.' : 'No internet connection. Try again.',
        'auth/too-many-requests': HE ? 'יותר מדי ניסיונות. חכו כמה דקות.' : 'Too many tries. Wait a few minutes.'
      };
      var err = function (e) { var c = e && e.code, m = c && MSG[c] != null ? MSG[c] : (e && e.message || String(e)).replace(/^Firebase:\s*/, ''); document.getElementById('fbErr').textContent = m + (c && MSG[c] == null ? '' : '') ; if (c) console.warn('auth error', c); };
      g.querySelector('#fbGoogle').onclick = function () {
        auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
          else err(e);
        });
      };
      g.querySelector('#fbEmail').onsubmit = function (ev) {
        ev.preventDefault();
        var m = document.getElementById('fbMail').value.trim(), p = document.getElementById('fbPass').value;
        (mode === 'in' ? auth.signInWithEmailAndPassword(m, p) : auth.createUserWithEmailAndPassword(m, p)).catch(err);
      };
      g.querySelector('#fbSwitch').onclick = function () { mode = mode === 'in' ? 'up' : 'in'; draw(); };
      var r = g.querySelector('#fbReset');
      if (r) r.onclick = function () {
        var m = document.getElementById('fbMail').value.trim();
        if (!m) { err(T.typeMail); return; }
        auth.sendPasswordResetEmail(m).then(function () { err(T.resetSent); }, err);
      };
    }
    draw();
  }

  function displayName(u) { return u.displayName || (u.email ? u.email.split('@')[0] : 'Someone'); }

  /* ---------- owner: the first person to sign in after setup ---------- */
  var ownerP = signedIn.then(function (u) {
    var ref = fs.doc('settings/owner');
    return ref.get().then(function (s) {
      if (s.exists) { var mine = s.data().uid === u.uid; if (mine) topUp(); return mine; }
      return ref.set({ uid: u.uid, claimedAt: Date.now() }).then(function () { seed(); return true; }, function () { return false; });
    }).catch(function () { return false; });
  });

  /* owner only, once per seed version: add any starting machsan items / group needs that are missing,
     and the calendar if it is empty. Never overwrites what is already there. */
  var SEED_V = 3;
  function topUp() {
    var flag = fs.doc('settings/seeded');
    flag.get().then(function (f) {
      if (f.exists && (f.data().v || 0) >= SEED_V) return;
      return fetch('seed.json?v=' + SEED_V).then(function (r) { return r.json(); }).then(function (data) {
        var cols = ['machsan', 'mxNeeds', 'events'];
        return Promise.all(cols.map(function (c) { return fs.collection(c).get(); })).then(function (snaps) {
          var writes = [];
          cols.forEach(function (c, i) {
            var have = {}; snaps[i].docs.forEach(function (d) { have[d.id] = 1; });
            Object.keys(data[c] || {}).forEach(function (id) { if (!have[id]) writes.push([c + '/' + id, data[c][id]]); });
          });
          return fs.doc('settings/access').get().then(function (acc) {
            if (!acc.exists && data.settings && data.settings.access) writes.push(['settings/access', data.settings.access]);
            var chain = Promise.resolve();
            for (var k = 0; k < writes.length; k += 400) (function (part) {
              chain = chain.then(function () { var b = fs.batch(); part.forEach(function (w) { b.set(fs.doc(w[0]), w[1]); }); return b.commit(); });
            })(writes.slice(k, k + 400));
            return chain.then(function () { console.info('Added ' + writes.length + ' starting items'); return flag.set({ v: SEED_V, at: Date.now() }); });
          });
        });
      });
    }).catch(function (e) { console.warn('Top-up skipped', e); });
  }

  /* copy the starting data (machsan, calendar, group needs, access) the first time */
  function seed() {
    fetch('seed.json').then(function (r) { return r.json(); }).then(function (data) {
      var writes = [];
      Object.keys(data).forEach(function (col) {
        Object.keys(data[col]).forEach(function (id) { writes.push([col + '/' + id, data[col][id]]); });
      });
      var chain = Promise.resolve();
      for (var i = 0; i < writes.length; i += 400) (function (part) {
        chain = chain.then(function () { var b = fs.batch(); part.forEach(function (w) { b.set(fs.doc(w[0]), w[1]); }); return b.commit(); });
      })(writes.slice(i, i + 400));
      return chain;
    }).catch(function (e) { console.warn('Seeding skipped', e); });
  }

  /* reload when this person's approval changes, so the server lets them in */
  signedIn.then(function (u) {
    var last;
    fs.doc('approvals/' + u.uid).onSnapshot(function (s) {
      var st = s.exists ? (s.data().status + '|' + s.data().portal) : '';
      if (last !== undefined && st !== last) location.reload();
      last = st;
    }, function () {});
    fs.doc('users/' + u.uid).set({ name: displayName(u), updatedAt: Date.now() }, { merge: true }).catch(function () {});
    onReady(function () {
      var btn = document.createElement('button');
      btn.id = 'fbSignOut'; btn.type = 'button'; btn.textContent = T.signOut;
      btn.onclick = function () { auth.signOut(); };
      var acct = document.getElementById('setAcct'), back = document.getElementById('settingsBack');
      if (acct) { btn.className = 'set-row warn'; acct.appendChild(btn); }
      else if (back && back.parentNode) back.parentNode.insertBefore(btn, back);
    });
  });

  var user = {
    me: function () { return signedIn.then(function (u) { return { id: u.uid, name: displayName(u), first: u.displayName || '' }; }); },
    isOwner: function () { return ownerP; },
    canEdit: function () { return ownerP; },
    profiles: function (ids) {
      return signedIn.then(function (u) {
        return Promise.all(ids.map(function (id) {
          return fs.doc('users/' + id).get().then(function (s) { return [id, s.exists ? s.data().name : '']; }, function () { return [id, '']; });
        })).then(function (rows) {
          var o = {}; rows.forEach(function (r) { if (r[1]) o[r[0]] = { name: r[1], isMe: r[0] === u.uid }; }); return o;
        });
      });
    }
  };

  /* ---------- Notifications (Web Push through the helper worker) ---------- */
  var PT = HE ? {
    ask: 'לקבל התראות?', askSub: 'נעדכן אתכם על הודעות חן, צ׳אט הקבוצה, אירועים, משימות ובקשות מהמחסן.', on: 'הפעלה', later: 'לא עכשיו',
    title: 'התראות', state: 'מצב', isOn: 'פועלות', isOff: 'כבויות', blocked: 'כבויות בהגדרות האייפון', turnOn: 'הפעלה',
    needHome: 'כדי לקבל התראות, פתחו את האפליקציה מהאייקון במסך הבית.',
    announce: 'הודעות חן', chat: 'צ׳אט הקבוצה', event: 'אירועים חדשים', task: 'משימות חדשות', machsan: 'בקשות מהמחסן'
  } : {
    ask: 'Turn on notifications?', askSub: 'Get a heads-up for Chen Announcements, your group chat, new events, to-dos and machsan requests.', on: 'Turn on', later: 'Not now',
    title: 'Notifications', state: 'Status', isOn: 'On', isOff: 'Off', blocked: 'Off in iPhone Settings', turnOn: 'Turn on',
    needHome: 'To get notifications, open the app from its home-screen icon.',
    announce: 'Chen Announcements', chat: 'Group chat', event: 'New events', task: 'New to-dos', machsan: 'Machsan requests'
  };
  var P_TYPES = ['announce', 'chat', 'event', 'task', 'machsan'], P_PREFS = 'shevet-push-prefs', P_LATER = 'shevet-push-later';
  function pushBase() { return window.CHENY_URL ? String(window.CHENY_URL).replace(/\/+$/, '') : ''; }
  function pushOk() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function pushPerm() { return pushOk() ? Notification.permission : 'unsupported'; }
  function pushPrefs() { try { return JSON.parse(localStorage.getItem(P_PREFS) || '{}') || {}; } catch (e) { return {}; } }
  function pushCall(path, body) {
    var u = auth.currentUser; if (!u || !pushBase()) return Promise.reject(new Error('off'));
    return u.getIdToken().then(function (tok) {
      return fetch(pushBase() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body || {}) });
    }).then(function (r) { return r.json(); });
  }
  var swReg = null;
  function swReady() {
    if (swReg) return Promise.resolve(swReg);
    return navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (r) { swReg = r; return navigator.serviceWorker.ready; });
  }
  function pushSync() {
    if (!pushBase()) return Promise.resolve(null);
    var perm = pushPerm(), body = { perm: perm, prefs: pushPrefs(), lang: HE ? 'he' : 'en' };
    if (perm !== 'granted') return pushCall('/push/subscribe', body).catch(function () {});
    return swReady().then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        if (s) return s;
        return fetch(pushBase() + '/push/key').then(function (r) { return r.json(); }).then(function (k) {
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(k.key) });
        });
      });
    }).then(function (s) { body.sub = s.toJSON(); return pushCall('/push/subscribe', body); })
      .catch(function (e) { console.warn('Notifications', e); });
  }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function pushAsk() { return Notification.requestPermission().then(function () { return pushSync(); }); }

  // Tell the helper when something new is posted, so it can notify the right people.
  var notifyBatches = {};
  function hookNotify(colName, ref) {
    var add = ref.add;
    ref.add = function (data) {
      return add.apply(ref, arguments).then(function (doc) {
        try {
          var b = data && data.batchId;
          if (colName === 'machsanReq' && b) { if (notifyBatches[b]) return doc; notifyBatches[b] = 1; }
          if (pushBase()) pushCall('/push/notify', { path: colName + '/' + doc.id }).catch(function () {});
        } catch (e) {}
        return doc;
      });
    };
    return ref;
  }
  var baseCollection = db.collection;
  db.collection = function (p) {
    var w = baseCollection(p);
    return ['broadcasts', 'events', 'tasks', 'machsanReq'].indexOf(p) >= 0 ? hookNotify(p, w) : w;
  };

  var pushCss = document.createElement('style');
  pushCss.textContent =
    '#pushAsk{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9980;max-width:440px;margin:0 auto;background:#fff;border-radius:22px;box-shadow:0 12px 34px rgba(0,0,0,.16);padding:16px 18px;color:#1e3a2f}' +
    '#pushAsk b{display:block;font-size:1.02rem}#pushAsk p{margin:4px 0 12px;color:#6f8178;font-size:.9rem;line-height:1.45}#pushAsk .row{display:flex;gap:8px}' +
    '#pushAsk button{font:inherit;cursor:pointer;border-radius:999px;padding:9px 18px;border:1px solid #e9e1d6;background:#fff;color:#1e3a2f;font-weight:600}#pushAsk button.go{background:#2f6b52;border-color:#2f6b52;color:#fff}' +
    '#setPush .set-row{cursor:default}#setPush .set-row.tap{cursor:pointer}#setPush .sw{margin-inline-start:auto;position:relative;width:46px;height:28px;flex:none}' +
    '#setPush .sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}#setPush .sw i{position:absolute;inset:0;border-radius:999px;background:#d9dcd8;transition:background .2s}' +
    '#setPush .sw i:after{content:"";position:absolute;top:3px;inset-inline-start:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}' +
    '#setPush .sw input:checked+i{background:#2f6b52}#setPush .sw input:checked+i:after{transform:translateX(18px)}[dir=rtl] #setPush .sw input:checked+i:after{transform:translateX(-18px)}' +
    '#setPushHead{font-size:.78rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6f8178;margin:18px 4px 8px}#setPush .pv{margin-inline-start:auto;color:#6f8178}';
  document.head.appendChild(pushCss);

  function drawPushSettings() {
    var acct = document.getElementById('setAcct'); if (!acct || !pushBase()) return;
    var box = document.getElementById('setPush');
    if (!box) {
      var h = document.createElement('div'); h.id = 'setPushHead'; h.textContent = PT.title;
      box = document.createElement('div'); box.id = 'setPush'; box.className = 'set-list';
      acct.parentNode.insertBefore(h, acct.nextSibling); h.parentNode.insertBefore(box, h.nextSibling);
    }
    var perm = pushPerm(), pf = pushPrefs();
    var st = perm === 'granted' ? PT.isOn : perm === 'denied' ? PT.blocked : perm === 'unsupported' ? PT.needHome : PT.isOff;
    box.innerHTML = '<div class="set-row' + (perm === 'default' ? ' tap' : '') + '" id="pushState"><span>' + PT.state + '</span><span class="pv">' + st + '</span>' +
      (perm === 'default' ? '<button type="button" class="btn sm primary" id="pushOn" style="margin-inline-start:10px">' + PT.turnOn + '</button>' : '') + '</div>' +
      (perm === 'granted' ? P_TYPES.map(function (k) {
        return '<label class="set-row"><span>' + PT[k] + '</span><span class="sw"><input type="checkbox" data-ptype="' + k + '"' + (pf[k] === false ? '' : ' checked') + '><i></i></span></label>';
      }).join('') : '');
    var on = document.getElementById('pushOn'); if (on) on.onclick = function () { pushAsk().then(drawPushSettings); };
    box.querySelectorAll('[data-ptype]').forEach(function (c) {
      c.onchange = function () { var p = pushPrefs(); p[c.dataset.ptype] = c.checked; try { localStorage.setItem(P_PREFS, JSON.stringify(p)); } catch (e) {} pushSync(); };
    });
  }

  // Merakzim: who has notifications off (the app shows this on the People page)
  window.shevetPushStatus = function () { return pushCall('/push/status', {}); };

  signedIn.then(function () {
    if (!pushBase()) return;
    onReady(function () {
      pushSync();
      setInterval(function () { if (document.getElementById('setAcct') && !document.getElementById('setPush')) drawPushSettings(); }, 800);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) { pushSync(); var b = document.getElementById('setPush'); if (b) drawPushSettings(); } });
      // One-time friendly ask (only in the home-screen app, where iPhones allow notifications)
      if (pushPerm() !== 'default') return;
      var later = 0; try { later = +localStorage.getItem(P_LATER) || 0; } catch (e) {}
      if (Date.now() - later < 3 * 864e5) return;
      setTimeout(function () {
        if (document.getElementById('fbGate') || document.getElementById('fidLock') || document.getElementById('fidAsk') || document.getElementById('tourCard') || document.getElementById('pushAsk')) return;
        var a = document.createElement('div'); a.id = 'pushAsk'; a.dir = HE ? 'rtl' : 'ltr';
        a.innerHTML = '<b>' + PT.ask + '</b><p>' + PT.askSub + '</p><div class="row"><button type="button" class="go" id="pushYes">' + PT.on + '</button><button type="button" id="pushNo">' + PT.later + '</button></div>';
        document.body.appendChild(a);
        document.getElementById('pushNo').onclick = function () { try { localStorage.setItem(P_LATER, String(Date.now())); } catch (e) {} a.remove(); };
        document.getElementById('pushYes').onclick = function () { a.remove(); pushAsk(); };
      }, 9000);
    });
  });

  /* ---------- Face ID lock (a lock screen on this device, not a sign-in) ---------- */
  var FID_KEY = 'shevet-faceid', FID_ASKED = 'shevet-faceid-asked';
  var FT = HE ? {
    ask: 'לפתוח את שבט חן עם Face ID?', askSub: 'בפעם הבאה שתפתחו את האפליקציה, הטלפון יבדוק שזה אתם.', on: 'להפעיל', later: 'לא עכשיו',
    unlock: 'פתיחה עם Face ID', other: 'כניסה בדרך אחרת', failed: 'לא הצליח. נסו שוב.', setting: 'נעילה עם Face ID', isOn: 'פועל', isOff: 'כבוי', done: 'Face ID הופעל.'
  } : {
    ask: 'Use Face ID to open Shevet Chen?', askSub: 'Next time you open the app, your phone checks it’s you.', on: 'Turn on', later: 'Not now',
    unlock: 'Unlock with Face ID', other: 'Sign in another way', failed: 'That didn’t work. Try again.', setting: 'Face ID lock', isOn: 'On', isOff: 'Off', done: 'Face ID is on.'
  };
  function fidGet() { try { return JSON.parse(localStorage.getItem(FID_KEY) || 'null'); } catch (e) { return null; } }
  function fidSet(v) { try { if (v) localStorage.setItem(FID_KEY, JSON.stringify(v)); else localStorage.removeItem(FID_KEY); } catch (e) {} }
  function rnd(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function fidAvailable() {
    return window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }) : Promise.resolve(false);
  }
  function fidCreate(u) {
    return navigator.credentials.create({ publicKey: {
      rp: { name: 'Shevet Chen' },
      user: { id: new TextEncoder().encode(u.uid).slice(0, 64), name: u.email || u.uid, displayName: u.displayName || u.email || 'Shevet Chen' },
      challenge: rnd(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none'
    } }).then(function (c) { fidSet({ uid: u.uid, id: b64(c.rawId) }); });
  }
  function fidCheck(f) {
    return navigator.credentials.get({ publicKey: {
      challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64(f.id) }], userVerification: 'required', timeout: 60000
    } });
  }
  var fidCss = document.createElement('style');
  fidCss.textContent =
    '#fidLock{position:fixed;inset:0;z-index:9990;background:#faf7f2;color:#111;display:flex;align-items:center;justify-content:center;transition:opacity .35s ease;font-family:inherit;-webkit-user-select:none;user-select:none}' +
    '#fidLock.out{opacity:0;pointer-events:none}#fidLock svg [fill="currentColor"]{stroke:currentColor;stroke-width:1.6;paint-order:stroke}' +
    '#fidLock .lg svg{width:min(62vw,300px);height:auto;display:block;transition:transform .35s cubic-bezier(.3,1.4,.6,1)}#fidLock.ok .lg svg{transform:scale(1.06)}' +
    '#fidLock .acts{position:absolute;left:0;right:0;bottom:calc(40px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transform:translateY(8px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}' +
    '#fidLock.need .acts{opacity:1;transform:none;pointer-events:auto}' +
    '#fidLock button{font:inherit;cursor:pointer;border-radius:999px;padding:12px 22px;border:0;background:#2f6b52;color:#fff;font-weight:600;min-width:220px}' +
    '#fidLock .alt{background:none;color:#6f8178;font-weight:400;padding:6px;min-width:0}#fidLock .msg{color:#b4436c;font-size:.9rem;min-height:1.2em}' +
    '#fidAsk{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9980;max-width:440px;margin:0 auto;background:#fff;border:1px solid #e9e1d6;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.14);padding:16px 18px;color:#1e3a2f}' +
    '#fidAsk b{display:block;font-size:1rem}#fidAsk p{margin:4px 0 12px;color:#6f8178;font-size:.88rem}#fidAsk .row{display:flex;gap:8px}' +
    '#fidAsk button{font:inherit;cursor:pointer;border-radius:999px;padding:9px 18px;border:1px solid #e9e1d6;background:#fff;color:#1e3a2f}#fidAsk button.go{background:#2f6b52;border-color:#2f6b52;color:#fff}' +
    '#fbFaceId:not(.set-row){font:inherit;cursor:pointer;border-radius:999px;padding:6px 14px;border:1px solid #e9e1d6;background:#fff;color:#2f6b52;font-size:.85rem;margin-inline-end:8px}';
  document.head.appendChild(fidCss);

  // Lock at start if this device has Face ID turned on.
  // A refresh (pull-down, auto-update) in the same session doesn't lock again; opening the app fresh does.
  var fidFresh = false; try { fidFresh = sessionStorage.getItem('shevet-fid-ok') === '1'; } catch (e) {}
  var fidLocked = !!fidGet() && !!window.PublicKeyCredential && !fidFresh;
  if (fidLocked) onReady(function () {
    var f = fidGet(), box = document.createElement('div');
    box.id = 'fidLock'; box.dir = HE ? 'rtl' : 'ltr';
    var lg = document.querySelector('#logo svg');
    box.innerHTML = '<div class="lg"></div><div class="acts"><div class="msg" id="fidMsg" role="alert"></div><button type="button" id="fidGo">' + FT.unlock + '</button><button type="button" class="alt" id="fidOther">' + FT.other + '</button></div>';
    if (lg) box.querySelector('.lg').appendChild(lg.cloneNode(true));
    document.body.appendChild(box);
    var busy = false, needT = 0;
    function open() {
      fidLocked = false; clearTimeout(needT); try { sessionStorage.setItem('shevet-fid-ok', '1'); } catch (e) {}
      var sp = document.getElementById('splash'); if (sp) sp.remove();
      document.documentElement.classList.add('app-in');
      box.classList.remove('need'); box.classList.add('ok');
      setTimeout(function () { box.classList.add('out'); }, 160);
      setTimeout(function () { box.remove(); }, 560);
    }
    function go() {
      if (busy) return; busy = true;
      document.getElementById('fidMsg').textContent = '';
      clearTimeout(needT); needT = setTimeout(function () { box.classList.add('need'); }, 2500);
      fidCheck(f).then(function () { busy = false; open(); }, function (e) {
        busy = false; clearTimeout(needT);
        if (e && e.name !== 'NotAllowedError') console.warn('Face ID', e);
        document.getElementById('fidMsg').textContent = e && e.name === 'NotAllowedError' ? '' : FT.failed;
        box.classList.add('need');
      });
    }
    document.getElementById('fidGo').onclick = go;
    document.getElementById('fidOther').onclick = function () { fidSet(null); auth.signOut().then(function () { location.reload(); }); };
    // Ask for Face ID right away (the iPhone shows its own passkey sheet; a web app can't skip it).
    // If the phone wants a tap first, a tap anywhere on this screen tries again.
    box.addEventListener('click', function (ev) { if (ev.target.closest('#fidOther') || ev.target.closest('#fidGo')) return; go(); });
    setTimeout(go, 30);
  });

  signedIn.then(function (u) {
    var f = fidGet();
    if (f && f.uid !== u.uid) { fidSet(null); var lk = document.getElementById('fidLock'); if (lk) lk.remove(); }
    fidAvailable().then(function (ok) {
      if (!ok) return;
      onReady(function () {
        // Settings toggle, next to Sign out
        setTimeout(function () {
          var so = document.getElementById('fbSignOut'); if (!so || document.getElementById('fbFaceId')) return;
          var t = document.createElement('button'); t.id = 'fbFaceId'; t.type = 'button'; if (so.classList.contains('set-row')) t.className = 'set-row';
          var draw = function () { t.textContent = FT.setting + ': ' + (fidGet() ? FT.isOn : FT.isOff); };
          draw();
          t.onclick = function () { if (fidGet()) { fidSet(null); draw(); } else fidCreate(u).then(draw, function () {}); };
          so.parentNode.insertBefore(t, so);
        }, 500);
        // One-time offer
        var asked = false; try { asked = !!localStorage.getItem(FID_ASKED); } catch (e) {}
        if (fidGet() || asked) return;
        setTimeout(function () {
          if (document.getElementById('fbGate')) return;
          var a = document.createElement('div'); a.id = 'fidAsk'; a.dir = HE ? 'rtl' : 'ltr';
          a.innerHTML = '<b>' + FT.ask + '</b><p>' + FT.askSub + '</p><div class="row"><button type="button" class="go" id="fidYes">' + FT.on + '</button><button type="button" id="fidNo">' + FT.later + '</button></div>';
          document.body.appendChild(a);
          var close = function () { try { localStorage.setItem(FID_ASKED, '1'); } catch (e) {} a.remove(); };
          document.getElementById('fidNo').onclick = close;
          document.getElementById('fidYes').onclick = function () { fidCreate(u).then(function () { close(); var d = document.getElementById('fbFaceId'); if (d) d.textContent = FT.setting + ': ' + FT.isOn; }, function () {}); };
        }, 4000);
      });
    });
  });

  /* Cheny: send the conversation to the helper, which keeps the AI key secret */
  function chenySample(input, opts) {
    opts = opts || {};
    var u = auth.currentUser;
    if (!u) return Promise.reject(new Error(HE ? 'צריך להתחבר.' : 'Please sign in.'));
    return u.getIdToken().then(function (tok) {
      return fetch(window.CHENY_URL, {
        method: 'POST', signal: opts.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ messages: input })
      });
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || ('Error ' + res.status)); });
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '', text = '', stop = '';
      function line(l) {
        if (l.indexOf('data:') !== 0) return;
        var ev; try { ev = JSON.parse(l.slice(5)); } catch (e) { return; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { text += ev.delta.text; if (opts.onText) opts.onText({ text: text }); }
        else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'Cheny had a problem.');
      }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { if (buf) line(buf.trim()); if (stop === 'refusal' && !text) text = HE ? 'אני לא יכולה לעזור עם זה.' : 'I can\u2019t help with that one.'; return { text: text }; }
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split('\n'); buf = parts.pop();
          parts.forEach(function (l) { line(l.trim()); });
          return pump();
        });
      }
      return pump();
    });
  }

  window.claude = {
    use: function (what) {
      if (what === 'db') return signedIn.then(function () { return db; });
      if (what === 'user') return signedIn.then(function () { return user; });
      if (what === 'sample') return Promise.resolve(window.CHENY_URL ? chenySample : null);
      return Promise.reject(new Error(what + ' is not available on this site'));
    }
  };
})();
