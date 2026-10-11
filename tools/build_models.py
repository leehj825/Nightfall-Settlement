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

def hand_mask(pos, tri):
    """허리 아래로 내려온 손·손가락: 바깥쪽 확실한 팔 정점에서 메시 연결을 따라 번지게 해서 찾는다 (손끝이 허벅지·치마 옆에 닿아 있어도 다리 뼈에 끌려가지 않게)."""
    key = {}; vid = np.array([key.setdefault(tuple(q), len(key)) for q in np.round(pos, 4)]); n = len(key)
    e = np.concatenate([vid[tri][:, [0, 1]], vid[tri][:, [1, 2]], vid[tri][:, [2, 0]]]); P = np.zeros((n, 3)); P[vid] = pos
    adj = [[] for _ in range(n)]
    for a, b in e: adj[a].append(b); adj[b].append(a)
    ok = (P[:, 1] < 1.0) & (P[:, 1] > 0.45) & (np.abs(P[:, 0]) > 0.15)
    seen = (np.abs(P[:, 0]) > 0.33) & ok; stack = list(np.where(seen)[0])
    while stack:
        a = stack.pop()
        for b in adj[a]:
            if ok[b] and not seen[b]: seen[b] = True; stack.append(b)
    return seen[vid]

def skin(pos, tri=None):
    flat = pos * [1, 1, 0]                                                         # 팔은 앞뒤(z)로 치우친 모델이 많아서, 팔 뼈까지의 거리는 z를 무시하고 잰다
    D = np.stack([seg_dist(flat if b.startswith(('shoulder', 'elbow')) else pos, *SEG[b][:2]) / SEG[b][2] for b in BONES], axis=1)       # distance in "bone radii"
    W = np.exp(-(D ** 2) * 5.0)
    x, y = pos[:, 0], pos[:, 1]; ax = np.abs(x)
    # 옷이 팔을 따라 늘어나지 않도록: 몸통 안쪽(|x| < 0.25)은 팔 뼈의 영향을 받지 않고, 바깥(> 0.30)만 팔을 따른다. 반대쪽 팔 뼈도 끊는다
    T = 0.30 - 0.06 * np.clip((1.36 - y) / 0.16, 0, 1)             # 어깨 아래에서는 몸통이 더 좁다: 소매·팔꿈치 안쪽이 몸통에 붙어 굳지 않게 경계를 안쪽으로 당긴다
    T = np.where(y < 0.9, np.minimum(T, 0.20), T)                  # 손 높이(허리 아래): 몸통과 거의 붙어 있어도 손은 팔을 따른다
    inner = np.clip((T - ax) / 0.05, 0, 1)
    for j, b in enumerate(BONES):
        if b.startswith(('shoulder', 'elbow')):
            left = b.endswith('L'); W[:, j] *= (1 - inner) * (((x < 0) == left) | (ax < 0.02))
    # 치마·앞치마·긴 옷자락이 다리를 따라 찢어지지 않도록: 허리 아래 중앙부는 골반 뼈가 대부분을 맡는다
    skirt = ((y > 0.42) & (y < 0.98)) * np.clip(1 - ax / 0.16, 0, 1)
    for j, b in enumerate(BONES):
        if b.startswith(('hip', 'knee')) and b not in ('hips',): W[:, j] *= (1 - 0.85 * skirt)
        if b == 'hips': W[:, j] += 1.2 * skirt
    # 손·손가락(허리 높이, 몸통 바깥)은 다리 뼈에 끌려가지 않게: 다리 뼈는 바깥쪽에서 끊고, 손은 팔꿈치(아래팔) 뼈에 붙인다
    hand = hand_mask(pos, tri) if tri is not None else (y < 0.9) & (y > 0.5) & (ax > 0.27)
    for j, b in enumerate(BONES):
        if b.startswith(('hip', 'knee')) and b != 'hips': W[:, j] *= np.where((y > 0.3), np.clip((0.33 - ax) / 0.04, 0, 1), 1)
    for j, b in enumerate(BONES):
        if b.startswith('elbow'):
            sel = hand & ((x < 0) == b.endswith('L')); W[sel, :] = 0; W[sel, j] = 1.0
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
    parts = {'sword': [], 'spear': [], 'bow': [], 'shield': []}
    for tis in comp.values():
        p = pos[np.unique(tri[tis].ravel())]; cx, cy = (p[:, 0].min() + p[:, 0].max()) / 2, (p[:, 1].min() + p[:, 1].max()) / 2
        if cx > 0.31: parts['bow'] += tis
        elif cx > 0.2 and p[:, 1].max() > 0.9: parts['spear'] += tis
        elif cy > 0.7: parts['sword'] += tis                       # 칼 (y 0.6~0.69 의 가늘고 긴 칼집은 쓰지 않는다)
        elif cy < 0.5 and len(tis) > 1500: parts['shield'] += tis  # 둥근 방패
    def rot(v, kind):                                              # 모델 좌표 -> 장비 좌표 (회전만, 반전 없음)
        x, y, z = v[:, 0], v[:, 1], v[:, 2]
        if kind == 'sword': return np.stack([-(y - 0.795), x + 0.38, z], axis=1)           # 칼날 +x -> +y, 손잡이 중간이 원점
        if kind == 'spear': return np.stack([x - 0.255, y - 0.23, z], axis=1)
        if kind == 'shield': return np.stack([x + 0.21, y - 0.225, z], axis=1)                # 원판은 xy 평면, 가운데 징은 +z
        return np.stack([z, x - 0.40, y - 0.45], axis=1)                                    # 활: 긴 축 y -> z, 시위 쪽(+x) -> +y
    scale = {'sword': 1.7, 'spear': 2.58, 'bow': 1.15, 'shield': 1.5}
    for kind, tis in parts.items():
        vs, inv = np.unique(tri[tis].ravel(), return_inverse=True)
        P = rot(pos[vs], kind) * scale[kind]; N = rot(nor[vs], kind); I = inv.astype(np.uint16)
        out['w_' + kind] = {'n': len(vs), 'pos': b64(np.round(P * 10000).astype(np.int16)), 'uv': b64(np.round(uv[vs] * 65535).astype(np.uint16)),
                            'nor': b64(np.round(N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9) * 127).astype(np.int8)), 'idx': b64(I), 'idx32': False}
        print('weapon', kind.ljust(6), len(vs), 'verts', len(tis), 'tris', 'extent', (P.max(axis=0) - P.min(axis=0)).round(2))
    im = Image.open(tex).convert('RGB').resize((512, 512), Image.LANCZOS); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=82)
    out['w_tex'] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

def tools(root, out):
    """Pickaxe_and_axe pack: pickaxe (tilted in the model) and axe -> upright, head along z (the swing plane), grip near the bottom."""
    folder = os.path.join(root, 'Tools'); obj = glob.glob(os.path.join(folder, '*.obj'))[0]; tex = glob.glob(os.path.join(folder, '*basecolor.jpg'))[0]
    pos, uv, nor, idx = parse_obj(obj); tri = idx.reshape(-1, 3).astype(int)
    key = {}; vid = np.array([key.setdefault(tuple(p), len(key)) for p in np.round(pos, 5)]); parent = list(range(len(key)))
    def f(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a, b, c in vid[tri]: parent[f(b)] = f(a); parent[f(c)] = f(a)
    comp = {}
    for ti, tr in enumerate(vid[tri]): comp.setdefault(f(tr[0]), []).append(ti)
    small, big = sorted(comp.values(), key=len)                # 곡괭이(작은 쪽) / 도끼
    for kind, tis in (('pick', small), ('axe', big)):
        vs, inv = np.unique(tri[tis].ravel(), return_inverse=True); P = pos[vs].copy(); N = nor[vs].copy()
        if kind == 'pick':                                      # 비스듬한 자루를 세운다 (자루 끝 = 가장 낮은 점, 머리 = 가장 먼 점 방향)
            low = P[np.argmin(P[:, 1])]; far = P[np.argmax(np.linalg.norm(P - low, axis=1))]; v = far - low; ang = np.arctan2(v[1], v[0]); rot = np.pi / 2 - ang
            c, s = np.cos(rot), np.sin(rot); R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]); P = P @ R.T; N = N @ R.T
        low_pts = P[P[:, 1] < P[:, 1].min() + 0.06]; bottom = low_pts.mean(axis=0); H = P[:, 1].max() - P[:, 1].min()
        P = P - [bottom[0], P[:, 1].min() + 0.27 * H, 0]                                        # 손잡이 위치(아래에서 27%)가 원점
        P = np.stack([P[:, 2], P[:, 1], -P[:, 0]], axis=1); N = np.stack([N[:, 2], N[:, 1], -N[:, 0]], axis=1)    # 머리 방향(x) -> z
        P = P * 1.15
        out['t_' + kind] = {'n': len(vs), 'pos': b64(np.round(P * 10000).astype(np.int16)), 'uv': b64(np.round(uv[vs] * 65535).astype(np.uint16)),
                            'nor': b64(np.round(N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9) * 127).astype(np.int8)), 'idx': b64(inv.astype(np.uint16)), 'idx32': False}
        print('tool', kind.ljust(5), len(vs), 'verts', 'extent', (P.max(axis=0) - P.min(axis=0)).round(2))
    im = Image.open(tex).convert('RGB').resize((512, 512), Image.LANCZOS); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=82)
    out['t_tex'] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()

def main():
    root = sys.argv[1]; out = {}
    for key, folder in MODELS.items():
        obj = glob.glob(os.path.join(root, folder, '*.obj'))[0]; tex = glob.glob(os.path.join(root, folder, '*basecolor.jpg'))[0]
        pos, uv, nor, idx = parse_obj(obj)
        s = HEIGHT / (pos[:, 1].max() - pos[:, 1].min()); pos = (pos - [0, pos[:, 1].min(), 0]) * s
        pos[:, 0] -= (pos[:, 0].max() + pos[:, 0].min()) / 2; pos[:, 2] -= (pos[:, 2].max() + pos[:, 2].min()) / 2
        si, sw = skin(pos, idx.reshape(-1, 3).astype(int))
        im = Image.open(tex).convert('RGB').resize((512, 512), Image.LANCZOS); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80)
        out[key] = {'n': len(pos), 'pos': b64(np.round(pos * 10000).astype(np.int16)), 'uv': b64(np.round(uv * 65535).astype(np.uint16)),
                    'nor': b64(np.round(nor / np.linalg.norm(nor, axis=1, keepdims=True) * 127).astype(np.int8)), 'idx': b64(idx), 'idx32': idx.dtype == np.uint32,
                    'si': b64(si), 'sw': b64(sw), 'tex': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()}
        print(key.ljust(14), len(pos), 'verts', len(idx) // 3, 'tris', 'scale %.2f' % s, 'tex %d KB' % (len(buf.getvalue()) // 1024))
    weapons(root, out); tools(root, out)
    js = '// Generated by tools/build_models.py - skinned character meshes (AI-generated models by the project owner). Do not edit by hand.\nconst CHAR_MODELS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    open(os.path.join(os.path.dirname(__file__), '..', 'js', 'models.js'), 'w').write(js)
    print('wrote js/models.js', len(js) // 1024, 'KB')

if __name__ == '__main__': main()
