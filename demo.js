/* Shevet Chen preview: logo intro, language choice, pretend phone-number sign-in, then the app
   with example data. Nothing is saved and no real text message is sent. */
window.SHEVET_PREVIEW = true;
(function () {
  var TXT = {
    he: { name: 'שבט חן', sub: 'תנועת הצופים · שכב״ג', phone: 'מספר טלפון', send: 'שליחת קוד', code: 'קוד בן 6 ספרות',
      sent: 'שלחנו קוד ב־SMS אל ', enter: 'כניסה', back: 'מספר אחר', note: 'תצוגה מקדימה: כל קוד עובד, ולא נשלחת הודעה באמת.',
      badPhone: 'נא להזין מספר טלפון תקין.', badCode: 'נא להזין 6 ספרות.', title: 'כניסה עם הטלפון' },
    en: { name: 'Shevet Chen', sub: 'Tzofim · Shachbag', phone: 'Phone number', send: 'Send code', code: '6-digit code',
      sent: 'We texted a code to ', enter: 'Sign in', back: 'Use another number', note: 'Preview: any code works and no real text is sent.',
      badPhone: 'Please enter a valid phone number.', badCode: 'Please enter 6 digits.', title: 'Sign in with your phone' }
  };
  var lang = 'en', T = TXT.en;
  var css = document.createElement('style');
  css.textContent =
    '#pGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:#f6f1e8;font-family:Heebo,system-ui,sans-serif;color:#1e3a2f;transition:opacity .5s ease}' +
    '#pGate.out{opacity:0;pointer-events:none}' +
    '#pGate .box{background:#fff;border:1px solid #e9e1d6;border-radius:20px;padding:32px 28px;max-width:380px;width:100%;box-sizing:border-box;box-shadow:0 1px 2px rgba(30,58,47,.04),0 8px 24px rgba(30,58,47,.06);text-align:center;animation:pIn .45s ease both}' +
    '#pGate .logo{display:inline-block;background:#2f6b52;border-radius:999px;padding:7px 18px;font-family:"Frank Ruhl Libre",Georgia,serif;font-size:1.25rem;margin-bottom:6px;white-space:nowrap}' +
    '#pGate .c0{color:#fff}#pGate .c1{color:#f3c9d6}#pGate .c2{color:#9fd3b6}' +
    '#pGate .sub{color:#6f8178;font-size:.85rem;margin-bottom:22px}' +
    '#pGate h2{font-family:"Frank Ruhl Libre",Georgia,serif;font-weight:500;font-size:1.35rem;margin:0 0 16px}' +
    '#pGate input{font:inherit;font-size:1.05rem;width:100%;box-sizing:border-box;border:1px solid #e9e1d6;border-radius:12px;padding:12px 14px;background:#fbf8f3;color:#1e3a2f;text-align:center;letter-spacing:.04em}' +
    '#pGate button{font:inherit;cursor:pointer;border-radius:999px;padding:12px 18px;width:100%;border:1px solid #2f6b52;background:#2f6b52;color:#fff;margin-top:12px}' +
    '#pGate button.ghost{background:#fff;color:#1e3a2f;border-color:#e9e1d6}' +
    '#pGate .link{background:none;border:0;color:#b4436c;text-decoration:underline;width:auto;padding:4px;margin-top:8px;font-size:.85rem}' +
    '#pGate .pmsg{color:#6f8178;font-size:.9rem;margin-bottom:12px}' +
    '#pGate .err{color:#b4436c;font-size:.85rem;min-height:1.2em;margin-top:10px}' +
    '#pGate .note{color:#6f8178;font-size:.75rem;margin-top:18px;border-top:1px solid #e9e1d6;padding-top:12px}' +
    /* intro: big logo pops in, holds, then fades away */
    '#pSplash{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f6f1e8;transition:opacity .6s ease}' +
    '#pSplash.out{opacity:0;pointer-events:none}' +
    '#pSplash .logo{background:#2f6b52;border-radius:999px;padding:14px 36px;font-family:"Frank Ruhl Libre",Georgia,serif;font-size:clamp(2rem,9vw,3.2rem);font-weight:500;white-space:nowrap;animation:pPop .8s cubic-bezier(.2,.8,.2,1) both}' +
    '#pSplash .c0{color:#fff}#pSplash .c1{color:#f3c9d6}#pSplash .c2{color:#9fd3b6}' +
    '#pSplash .sub{color:#6f8178;font-family:Heebo,system-ui,sans-serif;font-size:.95rem;letter-spacing:.08em;animation:pIn .6s .35s ease both}' +
    '@keyframes pPop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}' +
    '@keyframes pIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){#pSplash .logo,#pSplash .sub,#pGate .box{animation:none}#pSplash,#pGate{transition:none}}' +
    /* preview: merakzim's Home shows grade portals only, not the peilim ones */
    '.group-btn:not(.mine)[data-group^="rashatz|"],.group-btn:not(.mine)[data-group^="peil|"]{display:none!important}' +
    '#loadBanner,#chenyBtn,#chenyPanel,#demoWrap{display:none!important}';
  document.head.appendChild(css);

  function logo(name) {
    var i = 0;
    return Array.from(name).map(function (c) { return c === ' ' ? '&nbsp;' : '<span class="c' + (i++ % 3) + '">' + c + '</span>'; }).join('');
  }
  function signedIn() { try { return sessionStorage.getItem('preview-in') === '1'; } catch (e) { return false; } }
  function setLang(l) {
    lang = l; T = TXT[l];
    try { localStorage.setItem('shachbag-lang', l); } catch (e) {}
    var b = document.querySelector('[data-lang="' + l + '"]');
    if (b) b.click();
  }
  function startDemo() { var d = document.getElementById('demoToggle'); if (d && !d.checked) d.click(); }

  function splash(next) {
    var s = document.createElement('div'); s.id = 'pSplash'; s.dir = 'ltr';
    s.innerHTML = '<div class="logo">' + logo('Shevet Chen') + '</div><div class="sub">Tzofim · Shachbag</div>';
    document.body.appendChild(s);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      next();
      s.classList.add('out');
      setTimeout(function () { s.remove(); }, 700);
    }, reduce ? 900 : 1900);
  }

  function gate() {
    var g = document.createElement('div'); g.id = 'pGate';
    document.body.appendChild(g);
    var phone = '';
    function head() { return '<div class="box"><div class="logo">' + logo(T.name) + '</div><div class="sub">' + T.sub + '</div>'; }
    function stepLang() {
      g.dir = 'ltr';
      g.innerHTML = '<div class="box"><div class="logo">' + logo('Shevet Chen') + '</div><div class="sub">Tzofim · Shachbag</div>' +
        '<h2>Choose your language</h2>' +
        '<button type="button" data-pl="en">English</button><button type="button" class="ghost" data-pl="he" lang="he">עברית · Hebrew</button></div>';
      g.querySelectorAll('[data-pl]').forEach(function (b) { b.onclick = function () { setLang(b.dataset.pl); stepPhone(); }; });
    }
    function stepPhone() {
      g.dir = lang === 'he' ? 'rtl' : 'ltr';
      g.innerHTML = head() + '<h2>' + T.title + '</h2><form id="pf"><input id="pPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="' + T.phone + '" value="' + phone + '">' +
        '<button type="submit">' + T.send + '</button></form><div class="err" id="pErr" role="alert"></div><div class="note">' + T.note + '</div></div>';
      var inp = g.querySelector('#pPhone'); inp.focus();
      g.querySelector('#pf').onsubmit = function (ev) {
        ev.preventDefault(); var v = inp.value.trim();
        if (v.replace(/\D/g, '').length < 7) { g.querySelector('#pErr').textContent = T.badPhone; return; }
        phone = v.replace(/[<>"]/g, ''); stepCode();
      };
    }
    function stepCode() {
      g.innerHTML = head() + '<div class="pmsg">' + T.sent + '<span dir="ltr">' + phone + '</span></div>' +
        '<form id="cf"><input id="pCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="' + T.code + '">' +
        '<button type="submit">' + T.enter + '</button></form><button class="link" id="pBack" type="button">' + T.back + '</button>' +
        '<div class="err" id="pErr" role="alert"></div><div class="note">' + T.note + '</div></div>';
      var inp = g.querySelector('#pCode'); inp.focus();
      g.querySelector('#pBack').onclick = stepPhone;
      g.querySelector('#cf').onsubmit = function (ev) {
        ev.preventDefault();
        if (!/^\d{6}$/.test(inp.value.trim())) { g.querySelector('#pErr').textContent = T.badCode; return; }
        try { sessionStorage.setItem('preview-in', '1'); } catch (e) {}
        g.classList.add('out'); setTimeout(function () { g.remove(); }, 550);
      };
    }
    stepLang();
  }

  window.addEventListener('DOMContentLoaded', function () {
    startDemo();
    splash(gate); // always start from the intro, so every visit shows the full flow
  });
})();
