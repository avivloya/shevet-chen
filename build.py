"""Builds index.html from app.html (the app as written for claude.ai).
Run: python3 build.py"""
src = open('app.html', encoding='utf-8').read()
import time, json as _j
BUILD = time.strftime('%Y%m%d%H%M%S', time.gmtime())
open('version.json', 'w').write(_j.dumps({'build': BUILD}) + '\n')
# The home-screen app can hold on to an old copy. On open (and when brought back), it asks
# version.json (never cached) and reloads itself with a fresh URL if a newer build exists.
UPDATE = """<script>window.SHEVET_BUILD='%s';(function(){function chk(){fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(v){if(!v||!v.build||v.build===window.SHEVET_BUILD)return;var k='shevet-upd-'+v.build;try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1')}catch(e){}location.replace(location.pathname+'?v='+v.build+location.hash)}).catch(function(){})}chk();document.addEventListener('visibilitychange',function(){if(!document.hidden)chk()})})();</script>""" % BUILD
head0 = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#f6f1e8">
<title>Shevet Chen</title>
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=1">
<link rel="icon" type="image/png" href="icon-192.png?v=1">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Shevet Chen">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js?v=3"></script>
<script src="bridge.js?v=7"></script>
</head>
<body>
'''
head = head0.replace('?v=3"', '?v=' + BUILD + '"').replace('?v=7"', '?v=' + BUILD + '"').replace('<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js">', UPDATE + '\n<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js">', 1)
open('index.html', 'w', encoding='utf-8').write(head + src + '\n</body>\n</html>\n')
print('index.html written')

import json
_mx = json.load(open('seed.json', encoding='utf-8'))['machsan']
preview_items = 'window.PREVIEW_ITEMS = ' + json.dumps([dict(v, id=k) for k, v in sorted(_mx.items())], ensure_ascii=False) + ';\n'
# Public preview with a pretend phone-number sign-in and example data (nothing is saved).
demo_head = head0.replace("""<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js?v=3"></script>
<script src="bridge.js?v=7"></script>""", '<script>\n' + preview_items + open('demo.js', encoding='utf-8').read() + '\n</script>')  # inlined so phones never use an old cached copy
open('demo.html', 'w', encoding='utf-8').write(demo_head + src + '\n</body>\n</html>\n')
print('demo.html written')
