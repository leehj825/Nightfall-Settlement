#!/usr/bin/env python3
"""Inline css/style.css and js/*.js into index.html -> dist/nightfall-single.html (one file, no build step needed to play)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf8')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + (root / m.group(1)).read_text(encoding='utf8') + '</style>', html)
html = re.sub(r'<script src="((?:js)/[^"]+)"></script>', lambda m: '<script>\n' + (root / m.group(1)).read_text(encoding='utf8') + '\n</script>', html)
out = root / 'dist' / 'nightfall-single.html'
out.write_text(html, encoding='utf8')
print(f'wrote {out} ({len(html) // 1024} KB)')
