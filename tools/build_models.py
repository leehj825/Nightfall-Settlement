#!/usr/bin/env python3
"""Turns the character OBJ models into js/models.js: compact skinned meshes bound to the game's stick-man skeleton.

usage: python3 tools/build_models.py <models-dir>
<models-dir> holds one folder per model (e.g. Leader/Leader.obj + Leader_basecolor.jpg ...), see MODELS below.
Each mesh is scaled to the rig (height 1.8), skinned by distance to the rig's bone segments (soft weights, 4 influences)
and written as base64 typed arrays + a 512px base-colour texture."""
import sys, os, glob, base64, io, json
import numpy as np
from PIL import Image

MODELS = {            # key -> folder
    'soldierSword': 'Soldier_sword', 'soldierBow': 'Soldier_bow', 'leader': 'Leader',
    'citizenMale': 'Citizon_male', 'citizenFemale': 'Citizon_female', 'bandit1': 'Bandit1', 'bandit2': 'Bandit2',
}
BONES = ['hips', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR']
HEIGHT = 1.8
# rig rest pose (matches js/rig.js buildStickman with W = 1): bone -> (segment start, segment end, radius)
SEG = {
    'hips': ((0, 0.86, 0), (0, 0.99, 0), 0.20), 'spine': ((0, 0.99, 0), (0, 1.56, 0), 0.23), 'head': ((0, 1.58, 0), (0, 1.92, 0), 0.15),
    'shoulderL': ((-0.34, 1.53, 0), (-0.34, 1.23, 0), 0.085), 'elbowL': ((-0.34, 1.23, 0), (-0.34, 0.78, 0), 0.08),
    'shoulderR': ((0.34, 1.53, 0), (0.34, 1.23, 0), 0.085), 'elbowR': ((0.34, 1.23, 0), (0.34, 0.78, 0), 0.08),
    'hipL': ((-0.14, 0.86, 0), (-0.14, 0.41, 0), 0.115), 'kneeL': ((-0.14, 0.41, 0), (-0.14, -0.05, 0), 0.09),
    'hipR': ((0.14, 0.86, 0), (0.14, 0.41, 0), 0.115), 'kneeR': ((0.14, 0.41, 0), (0.14, -0.05, 0), 0.09),
}

def parse_obj(path):
    P, T, N, F = [], [], [], []
    for line in open(path, errors='ignore'):
        if line.startswith('v '): P.append(list(map(float, line.split()[1:4])))
        elif line.startswith('vt '): T.append(list(map(float, line.split()[1:3])))
        elif line.startswith('vn '): N.append(list(map(float, line.split()[1:4])))
        elif line.startswith('f '):
            tri = [tuple(int(x) - 1 if x else 0 for x in c.split('/')) for c in line.split()[1:]]
            for i in range(1, len(tri) - 1): F.append((tri[0], tri[i], tri[i + 1]))
    # unify (v, vt, vn) triples
    key, pos, uv, nor, idx = {}, [], [], [], []
    for tri in F:
        for c in tri:
            if c not in key:
                key[c] = len(pos); pos.append(P[c[0]]); uv.append(T[c[1]] if len(c) > 1 and T else [0, 0]); nor.append(N[c[2]] if len(c) > 2 and N else [0, 1, 0])
            idx.append(key[c])
    return np.array(pos), np.array(uv), np.array(nor), np.array(idx, dtype=np.uint16 if len(pos) < 65535 else np.uint32)

def seg_dist(p, a, b):
    a, b = np.array(a, float), np.array(b, float); ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)

def skin(pos):
    D = np.stack([seg_dist(pos, *SEG[b][:2]) / SEG[b][2] for b in BONES], axis=1)       # distance in "bone radii"
    W = np.exp(-(D ** 2) * 1.6)
    # 발과 발 앞쪽은 무릎(정강이) 뼈에 붙인다
    foot = pos[:, 1] < 0.12
    for j, b in enumerate(BONES):
        if b.startswith('knee'): W[foot & ((pos[:, 0] < 0) == (b == 'kneeL')), j] += 3.0
    top4 = np.argsort(-W, axis=1)[:, :4]; w = np.take_along_axis(W, top4, axis=1); w = w / np.maximum(w.sum(axis=1, keepdims=True), 1e-9)
    return top4.astype(np.uint8), np.round(w * 255).astype(np.uint8)

def weapons(root, out):
    """medieval_weapons pack: one mesh with sword, scabbard, spear and bow side by side -> split by connected parts, each oriented the way js/rig.js holds it (long axis +Y, grip at the origin)."""
    folder = os.path.join(root, 'Weapons'); obj = glob.glob(os.path.join(folder, '*.obj'))[0]; tex = glob.glob(os.path.join(folder, '*basecolor.jpg'))[0]
    pos, uv, nor, idx = parse_obj(obj); tri = idx.reshape(-1, 3).astype(int)
    key = {}; vid = np.array([key.setdefault(tuple(p), len(key)) for p in np.round(pos, 5)]); parent = list(range(len(key)))
    def f(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a, b, c in vid[tri]: parent[f(b)] = f(a); parent[f(c)] = f(a)
    comp = {}
    for ti, tr in enumerate(vid[tri]): comp.setdefault(f(tr[0]), []).append(ti)
    parts = {'sword': [], 'spear': [], 'bow': []}
    for tis in comp.values():
        p = pos[np.unique(tri[tis].ravel())]; cx, cy = (p[:, 0].min() + p[:, 0].max()) / 2, (p[:, 1].min() + p[:, 1].max()) / 2
        if cx > 0.31: parts['bow'] += tis
        elif cx > 0.2 and p[:, 1].max() > 0.9: parts['spear'] += tis
        elif cy > 0.55: parts['sword'] += tis                      # (칼집은 쓰지 않는다)
    def rot(v, kind):                                              # 모델 좌표 -> 장비 좌표 (회전만, 반전 없음)
        x, y, z = v[:, 0], v[:, 1], v[:, 2]
        if kind == 'sword': return np.stack([-(y - 0.745), x + 0.38, z], axis=1)           # 칼날 +x -> +y, 손잡이 중간이 원점
        if kind == 'spear': return np.stack([x - 0.255, y - 0.23, z], axis=1)
        return np.stack([z, x - 0.40, y - 0.45], axis=1)                                    # 활: 긴 축 y -> z, 시위 쪽(+x) -> +y
    scale = {'sword': 1.7, 'spear': 2.58, 'bow': 1.15}
    for kind, tis in parts.items():
        vs, inv = np.unique(tri[tis].ravel(), return_inverse=True)
        P = rot(pos[vs], kind) * scale[kind]; N = rot(nor[vs], kind); I = inv.astype(np.uint16)
        out['w_' + kind] = {'n': len(vs), 'pos': b64(np.round(P * 10000).astype(np.int16)), 'uv': b64(np.round(uv[vs] * 65535).astype(np.uint16)),
                            'nor': b64(np.round(N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9) * 127).astype(np.int8)), 'idx': b64(I), 'idx32': False}
        print('weapon', kind.ljust(6), len(vs), 'verts', len(tis), 'tris', 'extent', (P.max(axis=0) - P.min(axis=0)).round(2))
    im = Image.open(tex).convert('RGB').resize((512, 512), Image.LANCZOS); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=82)
    out['w_tex'] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()

def main():
    root = sys.argv[1]; out = {}
    for key, folder in MODELS.items():
        obj = glob.glob(os.path.join(root, folder, '*.obj'))[0]; tex = glob.glob(os.path.join(root, folder, '*basecolor.jpg'))[0]
        pos, uv, nor, idx = parse_obj(obj)
        s = HEIGHT / (pos[:, 1].max() - pos[:, 1].min()); pos = (pos - [0, pos[:, 1].min(), 0]) * s
        pos[:, 0] -= (pos[:, 0].max() + pos[:, 0].min()) / 2; pos[:, 2] -= (pos[:, 2].max() + pos[:, 2].min()) / 2
        si, sw = skin(pos)
        im = Image.open(tex).convert('RGB').resize((512, 512), Image.LANCZOS); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80)
        out[key] = {'n': len(pos), 'pos': b64(np.round(pos * 10000).astype(np.int16)), 'uv': b64(np.round(uv * 65535).astype(np.uint16)),
                    'nor': b64(np.round(nor / np.linalg.norm(nor, axis=1, keepdims=True) * 127).astype(np.int8)), 'idx': b64(idx), 'idx32': idx.dtype == np.uint32,
                    'si': b64(si), 'sw': b64(sw), 'tex': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()}
        print(key.ljust(14), len(pos), 'verts', len(idx) // 3, 'tris', 'scale %.2f' % s, 'tex %d KB' % (len(buf.getvalue()) // 1024))
    weapons(root, out)
    js = '// Generated by tools/build_models.py - skinned character meshes (AI-generated models by the project owner). Do not edit by hand.\nconst CHAR_MODELS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    open(os.path.join(os.path.dirname(__file__), '..', 'js', 'models.js'), 'w').write(js)
    print('wrote js/models.js', len(js) // 1024, 'KB')

if __name__ == '__main__': main()
