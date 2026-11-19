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
    '#fbGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:#f6f1e8;font-family:Heebo,system-ui,sans-serif;color:#1e3a2f}' +
    '#fbGate .box{background:#fff;border:1px solid #e9e1d6;border-radius:20px;padding:32px 28px;max-width:380px;width:100%;box-shadow:0 1px 2px rgba(30,58,47,.04),0 8px 24px rgba(30,58,47,.06);text-align:center}' +
    '#fbGate .logo{display:inline-block;background:#2f6b52;color:#fff;border-radius:999px;padding:7px 18px;font-family:"Frank Ruhl Libre",Georgia,serif;font-size:1.25rem;margin-bottom:6px}' +
    '#fbGate .sub{color:#6f8178;font-size:.85rem;margin-bottom:22px}' +
    '#fbGate button{font:inherit;cursor:pointer;border-radius:999px;padding:11px 18px;width:100%;border:1px solid #e9e1d6;background:#fff;color:#1e3a2f;margin-top:8px}' +
    '#fbGate button.primary{background:#2f6b52;border-color:#2f6b52;color:#fff}' +
    '#fbGate input{font:inherit;width:100%;box-sizing:border-box;border:1px solid #e9e1d6;border-radius:12px;padding:10px 12px;margin-top:8px;background:#fbf8f3;color:#1e3a2f}' +
    '#fbGate .or{color:#6f8178;font-size:.8rem;margin:16px 0 4px}' +
    '#fbGate .err{color:#b4436c;font-size:.85rem;min-height:1.2em;margin-top:10px}' +
    '#fbGate .link{background:none;border:0;color:#b4436c;text-decoration:underline;width:auto;padding:4px;margin-top:6px;font-size:.85rem}' +
    '#fbSignOut:not(.set-row){font:inherit;cursor:pointer;border-radius:999px;padding:6px 14px;border:1px solid #e9e1d6;background:#fff;color:#b4436c;font-size:.85rem}' +
    /* Cheny shows only once its helper address is set in firebase-config.js */
    (window.CHENY_URL ? '' : '#chenyBtn,#chenyPanel{display:none!important}');
  document.head.appendChild(css);

  var HE = (function () { try { return (localStorage.getItem('shachbag-lang') || 'en') === 'he'; } catch (e) { return false; } })();
  var T = HE ? {
    google: 'המשך עם Google', or: 'או עם אימייל', mail: 'אימייל', pass: 'סיסמה (6 תווים לפחות)', signIn: 'כניסה', create: 'יצירת חשבון',
    toUp: 'חדשים כאן? יצירת חשבון', toIn: 'כבר יש לכם חשבון? כניסה', forgot: 'שכחתי סיסמה', typeMail: 'כתבו קודם את האימייל.',
    resetSent: 'שלחנו קישור לאיפוס לאימייל.', signOut: 'יציאה', sub: 'תנועת הצופים · שכב״ג', name: 'שבט חן'
  } : {
    google: 'Continue with Google', or: 'or with email', mail: 'Email', pass: 'Password (6+ characters)', signIn: 'Sign in', create: 'Create account',
    toUp: 'New here? Create an account', toIn: 'Already have an account? Sign in', forgot: 'Forgot password', typeMail: 'Type your email first.',
    resetSent: 'Check your email for a reset link.', signOut: 'Sign out', sub: 'Tzofim · Shachbag', name: 'Shevet Chen'
  };
  function gate(html) {
    var g = document.getElementById('fbGate');
    if (!g) { g = document.createElement('div'); g.id = 'fbGate'; (document.body || document.documentElement).appendChild(g); }
    g.dir = HE ? 'rtl' : 'ltr';
    g.innerHTML = '<div class="box"><div class="logo">' + T.name + '</div><div class="sub">' + T.sub + '</div>' + html + '</div>';
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
        '<button class="primary" id="fbGoogle" type="button">' + T.google + '</button>' +
        '<div class="or">' + T.or + '</div>' +
        '<form id="fbEmail"><input id="fbMail" type="email" autocomplete="email" placeholder="' + T.mail + '" required>' +
        '<input id="fbPass" type="password" autocomplete="' + (mode === 'in' ? 'current' : 'new') + '-password" placeholder="' + T.pass + '" minlength="6" required>' +
        '<button type="submit">' + (mode === 'in' ? T.signIn : T.create) + '</button></form>' +
        '<button class="link" id="fbSwitch" type="button">' + (mode === 'in' ? T.toUp : T.toIn) + '</button>' +
        (mode === 'in' ? '<button class="link" id="fbReset" type="button">' + T.forgot + '</button>' : '') +
        '<div class="err" id="fbErr" role="alert"></div>');
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
    '#fidLock{position:fixed;inset:0;z-index:9990;background:#faf7f2;color:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;transition:opacity .4s ease;font-family:inherit}' +
    '#fidLock.out{opacity:0;pointer-events:none}#fidLock svg [fill="currentColor"]{stroke:currentColor;stroke-width:1.6;paint-order:stroke}#fidLock .lg svg{width:min(56vw,260px);height:auto}' +
    '#fidLock button{font:inherit;cursor:pointer;border-radius:999px;padding:12px 22px;border:0;background:#2f6b52;color:#fff;font-weight:600;min-width:220px}' +
    '#fidLock .alt{background:none;color:#6f8178;font-weight:400;padding:6px;min-width:0}#fidLock .msg{color:#b4436c;font-size:.9rem;min-height:1.2em}' +
    '#fidAsk{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9980;max-width:440px;margin:0 auto;background:#fff;border:1px solid #e9e1d6;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.14);padding:16px 18px;color:#1e3a2f}' +
    '#fidAsk b{display:block;font-size:1rem}#fidAsk p{margin:4px 0 12px;color:#6f8178;font-size:.88rem}#fidAsk .row{display:flex;gap:8px}' +
    '#fidAsk button{font:inherit;cursor:pointer;border-radius:999px;padding:9px 18px;border:1px solid #e9e1d6;background:#fff;color:#1e3a2f}#fidAsk button.go{background:#2f6b52;border-color:#2f6b52;color:#fff}' +
    '#fbFaceId:not(.set-row){font:inherit;cursor:pointer;border-radius:999px;padding:6px 14px;border:1px solid #e9e1d6;background:#fff;color:#2f6b52;font-size:.85rem;margin-inline-end:8px}';
  document.head.appendChild(fidCss);

  // Lock at start if this device has Face ID turned on.
  var fidLocked = !!fidGet() && !!window.PublicKeyCredential;
  if (fidLocked) onReady(function () {
    var f = fidGet(), box = document.createElement('div');
    box.id = 'fidLock'; box.dir = HE ? 'rtl' : 'ltr';
    var lg = document.querySelector('#logo svg');
    box.innerHTML = '<div class="lg"></div><button type="button" id="fidGo">' + FT.unlock + '</button><div class="msg" id="fidMsg" role="alert"></div><button type="button" class="alt" id="fidOther">' + FT.other + '</button>';
    if (lg) box.querySelector('.lg').appendChild(lg.cloneNode(true));
    document.body.appendChild(box);
    function open() { fidLocked = false; box.classList.add('out'); setTimeout(function () { box.remove(); }, 450); }
    function go() {
      document.getElementById('fidMsg').textContent = '';
      fidCheck(f).then(open, function (e) { if (e && e.name !== 'NotAllowedError') console.warn('Face ID', e); document.getElementById('fidMsg').textContent = e && e.name === 'NotAllowedError' ? '' : FT.failed; });
    }
    document.getElementById('fidGo').onclick = go;
    document.getElementById('fidOther').onclick = function () { fidSet(null); auth.signOut().then(function () { location.reload(); }); };
    // iOS shows its own blue "Continue" sheet if Face ID starts without a tap, so wait for
    // one tap (anywhere on the screen) and go straight to the face scan.
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    box.addEventListener('click', function (ev) { if (ev.target.closest('#fidOther') || ev.target.closest('#fidGo')) return; go(); });
    if (!ios) setTimeout(go, 900);
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
