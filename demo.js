/* Shevet Chen preview: phone-number sign-in screen + example data.
   Nothing is saved and no real text message is sent. It shows people how the app works. */
(function () {
  var HE = (function () { try { return (localStorage.getItem('shachbag-lang') || 'he') === 'he'; } catch (e) { return true; } })();
  var T = HE ? {
    name: 'שבט חן', sub: 'תנועת הצופים · שכב״ג', phone: 'מספר טלפון', send: 'שליחת קוד', code: 'קוד בן 6 ספרות',
    sent: 'שלחנו קוד ב־SMS אל ', enter: 'כניסה', back: 'מספר אחר', note: 'תצוגה מקדימה: כל קוד עובד, ולא נשלחת הודעה באמת.',
    badPhone: 'נא להזין מספר טלפון תקין.', badCode: 'נא להזין 6 ספרות.'
  } : {
    name: 'Shevet Chen', sub: 'Tzofim · Shachbag', phone: 'Phone number', send: 'Send code', code: '6-digit code',
    sent: 'We texted a code to ', enter: 'Sign in', back: 'Use another number', note: 'Preview: any code works and no real text is sent.',
    badPhone: 'Please enter a valid phone number.', badCode: 'Please enter 6 digits.'
  };
  var css = document.createElement('style');
  css.textContent =
    '#pGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:#f6f1e8;font-family:Heebo,system-ui,sans-serif;color:#1e3a2f}' +
    '#pGate .box{background:#fff;border:1px solid #e9e1d6;border-radius:20px;padding:32px 28px;max-width:380px;width:100%;box-sizing:border-box;box-shadow:0 1px 2px rgba(30,58,47,.04),0 8px 24px rgba(30,58,47,.06);text-align:center}' +
    '#pGate .logo{display:inline-block;background:#2f6b52;color:#fff;border-radius:999px;padding:7px 18px;font-family:"Frank Ruhl Libre",Georgia,serif;font-size:1.25rem;margin-bottom:6px}' +
    '#pGate .sub{color:#6f8178;font-size:.85rem;margin-bottom:22px}' +
    '#pGate input{font:inherit;font-size:1.05rem;width:100%;box-sizing:border-box;border:1px solid #e9e1d6;border-radius:12px;padding:12px 14px;background:#fbf8f3;color:#1e3a2f;text-align:center;letter-spacing:.04em}' +
    '#pGate button{font:inherit;cursor:pointer;border-radius:999px;padding:12px 18px;width:100%;border:1px solid #2f6b52;background:#2f6b52;color:#fff;margin-top:12px}' +
    '#pGate .link{background:none;border:0;color:#b4436c;text-decoration:underline;width:auto;padding:4px;margin-top:8px;font-size:.85rem}' +
    '#pGate .pmsg{color:#6f8178;font-size:.9rem;margin-bottom:12px}' +
    '#pGate .err{color:#b4436c;font-size:.85rem;min-height:1.2em;margin-top:10px}' +
    '#pGate .note{color:#6f8178;font-size:.75rem;margin-top:18px;border-top:1px solid #e9e1d6;padding-top:12px}' +
    '#loadBanner,#chenyBtn,#chenyPanel,#demoWrap{display:none!important}';
  document.head.appendChild(css);

  function signedIn() { try { return sessionStorage.getItem('preview-in') === '1'; } catch (e) { return false; } }
  function enterApp() {
    try { sessionStorage.setItem('preview-in', '1'); } catch (e) {}
    var g = document.getElementById('pGate'); if (g) g.remove();
  }
  function startDemo() {
    var d = document.getElementById('demoToggle');
    if (d && !d.checked) d.click();
  }
  function gate() {
    var g = document.createElement('div'); g.id = 'pGate'; g.dir = HE ? 'rtl' : 'ltr';
    document.body.appendChild(g);
    var phone = '';
    function head() { return '<div class="box"><div class="logo">' + T.name + '</div><div class="sub">' + T.sub + '</div>'; }
    function stepPhone() {
      g.innerHTML = head() + '<form id="pf"><input id="pPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="' + T.phone + '" value="' + phone + '">' +
        '<button type="submit">' + T.send + '</button></form><div class="err" id="pErr" role="alert"></div><div class="note">' + T.note + '</div></div>';
      var inp = g.querySelector('#pPhone'); inp.focus();
      g.querySelector('#pf').onsubmit = function (ev) {
        ev.preventDefault(); var v = inp.value.trim();
        if (v.replace(/\D/g, '').length < 7) { g.querySelector('#pErr').textContent = T.badPhone; return; }
        phone = v; stepCode();
      };
    }
    function stepCode() {
      g.innerHTML = head() + '<div class="pmsg">' + T.sent + '<span dir="ltr">' + phone.replace(/</g, '') + '</span></div>' +
        '<form id="cf"><input id="pCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="' + T.code + '">' +
        '<button type="submit">' + T.enter + '</button></form><button class="link" id="pBack" type="button">' + T.back + '</button>' +
        '<div class="err" id="pErr" role="alert"></div><div class="note">' + T.note + '</div></div>';
      var inp = g.querySelector('#pCode'); inp.focus();
      g.querySelector('#pBack').onclick = stepPhone;
      g.querySelector('#cf').onsubmit = function (ev) {
        ev.preventDefault();
        if (!/^\d{6}$/.test(inp.value.trim())) { g.querySelector('#pErr').textContent = T.badCode; return; }
        enterApp();
      };
    }
    stepPhone();
  }
  window.addEventListener('DOMContentLoaded', function () {
    startDemo();
    if (!signedIn()) gate();
  });
})();
