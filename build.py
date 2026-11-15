"""Builds index.html from app.html (the app as written for claude.ai).
Run: python3 build.py"""
src = open('app.html', encoding='utf-8').read()
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
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
<script src="firebase-config.js?v=2"></script>
<script src="bridge.js?v=4"></script>
</head>
<body>
'''
open('index.html', 'w', encoding='utf-8').write(head + src + '\n</body>\n</html>\n')
print('index.html written')

import json
_mx = json.load(open('seed.json', encoding='utf-8'))['machsan']
preview_items = 'window.PREVIEW_ITEMS = ' + json.dumps([dict(v, id=k) for k, v in sorted(_mx.items())], ensure_ascii=False) + ';\n'
# Public preview with a pretend phone-number sign-in and example data (nothing is saved).
demo_head = head.replace("""<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js?v=2"></script>
<script src="bridge.js?v=4"></script>""", '<script>\n' + preview_items + open('demo.js', encoding='utf-8').read() + '\n</script>')  # inlined so phones never use an old cached copy
open('demo.html', 'w', encoding='utf-8').write(demo_head + src + '\n</body>\n</html>\n')
print('demo.html written')
