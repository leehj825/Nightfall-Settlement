#!/usr/bin/env python3
"""Concatenate src/game/*.js (in file-name order) into js/game.js.

game.js is one big IIFE whose sections share closure state, so the source is split into numbered parts for readability and
joined here; the generated js/game.js is committed so the game, the PWA and the Android build need no extra step.
Edit the parts in src/game/, then run:  python3 tools/build_game.py     (--check verifies js/game.js is up to date)"""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
parts = sorted((root / 'src' / 'game').glob('*.js'))
out = ''.join(p.read_text(encoding='utf8') for p in parts)
target = root / 'js' / 'game.js'
if '--check' in sys.argv:
    sys.exit(0 if target.read_text(encoding='utf8') == out else 'js/game.js is out of date - run tools/build_game.py')
target.write_text(out, encoding='utf8')
print(f'wrote {target} from {len(parts)} parts ({len(out.splitlines())} lines)')
