"""Builds index.html from app.html (the app as written for claude.ai).
Run: python3 build.py"""
src = open('app.html', encoding='utf-8').read()
head = '''<!doctype html>
<html lang="he">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f6f1e8">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="bridge.js"></script>
</head>
<body>
'''
open('index.html', 'w', encoding='utf-8').write(head + src + '\n</body>\n</html>\n')
print('index.html written')
