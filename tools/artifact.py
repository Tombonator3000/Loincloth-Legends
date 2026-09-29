"""Lag en Artifact-vennlig versjon av dist-single/index.html (uten doctype/html/head/body)."""
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
out = pathlib.Path(sys.argv[2])
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
title = re.search(r'<title>.*?</title>', head, re.S).group(0)
links = re.findall(r'<link[^>]*>', head)
styles = re.findall(r'<style[^>]*>.*?</style>', head, re.S)
scripts = re.findall(r'<script[^>]*>.*?</script>', head, re.S)
body_scripts = re.findall(r'<script[^>]*>.*?</script>', body, re.S)
body_rest = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.S).strip()
parts = [title, *links, *styles, body_rest, *scripts, *body_scripts]
out.write_text('\n'.join(parts) + '\n', encoding='utf-8')
print('wrote', out, len(out.read_bytes()), 'bytes; styles', len(styles), 'scripts', len(scripts) + len(body_scripts))
