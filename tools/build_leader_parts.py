#!/usr/bin/env python3
"""Builds js/leader_parts.js: the leader model (owner-made, simple clothes) skinned automatically to the game's stick-man skeleton.

usage:
  python3 tools/build_leader_parts.py leader4.glb [texture-size] [lift]
(a .glb file holds the meshes and the base colour texture; lift = optional brightening of the colour texture, 1.0 = as is)

The model is a few big meshes (legs+pelvis, torso+upper arms, forearms, head). It is scaled to HEIGHT and every vertex gets smooth weights
(up to 4 bones) from its distance to the bone segments of the model's own A-pose skeleton (the JOINTS table below; keep LEADER_JOINTS in js/rig.js in step).
Left/right limbs never mix except at the centre line. The animation fits because js/rig.js moves the stick-man's joints to the same points.
Output: LEADER_PARTS = same layout as CHAR_MODELS entries plus 'parts' (name, bone, vertex count)."""
import sys, os, json, io, base64, struct
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import build_models as BM

GLTF_COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
GLTF_N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def load_glb(path):
    """Reads a .glb (no libraries): every mesh node -> one part (positions with the node transform applied, normals, uvs, indices) and the base colour image bytes."""
    d = open(path, 'rb').read(); cl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + cl]); off = 20 + cl; bl = struct.unpack('<I', d[off:off + 4])[0]; blob = d[off + 8:off + 8 + bl]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = GLTF_N[a['type']]; dt = np.dtype(GLTF_COMP[a['componentType']]); start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0) or n * dt.itemsize
        if stride == n * dt.itemsize: arr = np.frombuffer(blob, dt, a['count'] * n, start).reshape(-1, n)
        else: arr = np.stack([np.frombuffer(blob, dt, n, start + k * stride) for k in range(a['count'])])
        return arr.astype(np.float64) if dt.kind == 'f' else arr.astype(np.int64)
    def quat(q):
        x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    def world(i, M):
        n = j['nodes'][i]; T = np.eye(4)
        if 'matrix' in n: T = np.array(n['matrix']).reshape(4, 4).T
        else:
            R = quat(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1])); T[:3, :3] = R; T[:3, 3] = n.get('translation', [0, 0, 0])
        M = M @ T; out = []
        if 'mesh' in n: out.append((n.get('name', 'part%d' % i), n['mesh'], M))
        for c in n.get('children', []): out += world(c, M)
        return out
    parts = []
    for r in j['scenes'][0]['nodes']:
        for name, mi, M in world(r, np.eye(4)):
            for pr in j['meshes'][mi]['primitives']:
                P = acc(pr['attributes']['POSITION']); N = acc(pr['attributes']['NORMAL']); U = acc(pr['attributes']['TEXCOORD_0']).copy(); U[:, 1] = 1 - U[:, 1]       # glTF uv v points down; the game uses v up
                I = acc(pr['indices']).ravel() if 'indices' in pr else np.arange(len(P))
                P = P @ M[:3, :3].T + M[:3, 3]; N = N @ np.linalg.inv(M[:3, :3]); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
                parts.append({'name': name, 'pos': P.ravel().tolist(), 'nor': N.ravel().tolist(), 'uv': U.ravel().tolist(), 'idx': I.tolist()})
    mat = j['materials'][0]['pbrMetallicRoughness']; im = j['images'][j['textures'][mat['baseColorTexture']['index']]['source']]; bv = j['bufferViews'][im['bufferView']]
    return parts, blob[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]

def weld(p):
    pos = np.array(p['pos'], float).reshape(-1, 3); nor = np.array(p['nor'], float).reshape(-1, 3); uv = np.array(p['uv'], float).reshape(-1, 2); idx = np.array(p['idx'], int)
    key = {}; remap = np.zeros(len(pos), int); keep = []
    q = np.round(np.concatenate([pos, nor * 100, uv * 10000], axis=1), 3)
    for i, row in enumerate(map(tuple, q)):
        j = key.get(row)
        if j is None: j = key[row] = len(keep); keep.append(i)
        remap[i] = j
    keep = np.array(keep)
    return pos[keep], nor[keep], uv[keep], remap[idx]


HEIGHT = 1.8
# joints in metres at HEIGHT (feet at y = 0, model facing +z, x < 0 is the rig's L side): measured from the model's A-pose
JOINTS = {'shX': 0.20, 'shY': 1.38, 'elX': 0.11, 'elDY': 0.34, 'hipX': 0.11, 'hipY': 0.88, 'kneeDY': 0.41, 'neckY': 1.45, 'wristX': 0.20, 'wristY': 1.04, 'ankleY': 0.09, 'headTop': 1.8}
# the model is in T-pose; these are its T-pose joints (shoulder, elbow, wrist along x). The arms are posed down at build time (see pose_arms) to the rig's rest pose
TPOSE = {'sh': 0.20, 'el': 0.56, 'wr': 0.88, 'y': 1.375}
ARM_DOWN = np.radians(72)
SIGMA = 0.045

def segments():
    """bone -> (point A, point B, radius): the bone's segment and how far from it the surface still counts as 'inside' it."""
    J = JOINTS; seg = {'hips': ((0, J['hipY'] - 0.12, 0), (0, J['hipY'] + 0.07, 0), 0.17), 'spine': ((0, J['hipY'] + 0.07, 0), (0, J['neckY'] - 0.06, 0), 0.17), 'head': ((0, J['neckY'], 0), (0, J['headTop'] - 0.12, 0), 0.10)}
    for side, sx in (('L', -1), ('R', 1)):
        sh = (sx * TPOSE['sh'], TPOSE['y'], 0); el = (sx * TPOSE['el'], TPOSE['y'], 0); wr = (sx * TPOSE['wr'], TPOSE['y'], 0)
        hp = (sx * J['hipX'], J['hipY'], 0); kn = (sx * J['hipX'], J['hipY'] - J['kneeDY'], 0); an = (sx * J['hipX'], J['ankleY'], 0.02)
        seg['clav' + side] = ((sx * 0.05, 1.40, 0), (sx * 0.20, 1.40, 0), 0.05); seg['shoulder' + side] = (sh, el, 0.075); seg['elbow' + side] = (el, wr, 0.07); seg['hip' + side] = (hp, kn, 0.10); seg['knee' + side] = (kn, an, 0.08)
    return seg

def point_seg(p, a, b):
    a = np.array(a, float); b = np.array(b, float); ab = b - a; L = np.linalg.norm(ab); u = ab / L; s = (p - a) @ u; t = np.clip(s / L, 0, 1)
    rad = np.linalg.norm(p - (a + np.outer(s, u)), axis=1); ax = np.maximum(0, np.maximum(-s, s - L)); return rad, ax, t

CLAV = {'clavL': 11, 'clavR': 12}                                # skin-only collar bones (after the 11 classic ones)
def bone_index(n): return CLAV[n] if n in CLAV else BM.BONES.index(n)

def skin(pos):
    """smooth weights for every vertex: exp(-(max(0, distance - radius) / SIGMA)^2) over the allowed bones; the 4 strongest, normalised."""
    seg = segments(); names = list(seg); W = np.zeros((len(pos), len(names)))
    for k, n in enumerate(names):
        a, b, r = seg[n]; rad, ax, t = point_seg(pos, a, b); limb = n[:-1] in ('shoulder', 'elbow', 'hip', 'knee')
        W[:, k] = np.exp(-(np.maximum(0, rad - r) / SIGMA) ** 2 - ((ax / 0.04) ** 2 if limb else (ax / SIGMA) ** 2)) + 1e-6
        if n.startswith('clav'): W[:, k] *= 0.6 * (pos[:, 1] > 1.28)
        if n[-1] in 'LR' and n not in ('hips',):                                                       # a limb only moves vertices on its own side (and a little across the centre line)
            side = -1 if n[-1] == 'L' else 1; W[:, k] *= np.where(pos[:, 0] * side >= -0.015, 1, np.exp(-((np.abs(pos[:, 0]) - 0.015) / 0.03) ** 2))
    top = np.argsort(-W, axis=1)[:, :4]; w = np.take_along_axis(W, top, 1); w /= w.sum(1, keepdims=True)
    si = np.array([[bone_index(names[j]) for j in row] for row in top], np.uint8); sw = np.round(w * 255).astype(np.int32); sw[:, 0] += 255 - sw.sum(1)
    return si, sw.astype(np.uint8)

def pose_arms(pos, nor, si, sw):
    """T-pose -> the rig's rest pose: every vertex follows the arm rotation (about the shoulder joint, 72 degrees down) by its shoulder+elbow weight (linear blend skinning)."""
    names = list(segments()); out = pos.copy(); on = nor.copy()
    for side, sx in (('L', -1), ('R', 1)):
        wa = np.zeros(len(pos))
        for k in range(4):
            for bn in ('shoulder' + side, 'elbow' + side): wa += np.where(si[:, k] == BM.BONES.index(bn), sw[:, k] / 255.0, 0)
        a = -sx * ARM_DOWN; c, s_ = np.cos(a), np.sin(a); R = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]]); S = np.array([sx * TPOSE['sh'], TPOSE['y'], 0])
        rp = (pos - S) @ R.T + S; rn = nor @ R.T
        out += wa[:, None] * (rp - pos); on += wa[:, None] * (rn - nor)
    # shoulder joint sits where the arm now starts: move so the rig's joints (J) match: arm pivot S -> (shX, shY)
    return out, on / np.maximum(np.linalg.norm(on, axis=1, keepdims=True), 1e-9)

def main():
    src = sys.argv[1]; parts, tex = load_glb(src); tex = io.BytesIO(tex); rest = sys.argv[2:]
    size = int(rest[0]) if len(rest) > 0 else 1024; lift = float(rest[1]) if len(rest) > 1 else 1.0
    P, N, U, I, owner, names = [], [], [], [], [], []
    for k, p in enumerate(parts):
        pos, nor, uv, idx = weld(p); base = sum(len(a) for a in P)
        P.append(pos); N.append(nor); U.append(uv); I.append(idx + base); owner.append(np.full(len(pos), k)); names.append(p['name'])
    pos = np.concatenate(P); nor = np.concatenate(N); uv = np.concatenate(U); idx = np.concatenate(I); owner = np.concatenate(owner)
    s = HEIGHT / (pos[:, 1].max() - pos[:, 1].min()); pos = (pos - [0, pos[:, 1].min(), 0]) * s
    pos[:, 0] -= (pos[:, 0].max() + pos[:, 0].min()) / 2; pos[:, 2] -= (pos[:, 2].max() + pos[:, 2].min()) / 2
    si, sw = skin(pos); pos, nor = pose_arms(pos, nor, si, sw)
    arm = np.isin(si[:, 0], [BM.BONES.index(n) for n in ('shoulderL', 'shoulderR', 'elbowL', 'elbowR')])
    im = Image.open(tex).convert('RGB').resize((size, size), Image.LANCZOS)
    if lift != 1.0: im = Image.fromarray((255 * (np.asarray(im, float) / 255) ** (1 / lift)).astype(np.uint8))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=84, optimize=True)
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    nn = nor / np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
    info = [{'name': names[k], 'bone': BM.BONES[min(10, int(np.bincount(si[owner == k][:, 0]).argmax()))], 'verts': int((owner == k).sum())} for k in range(len(parts))]
    out = {'n': len(pos), 'pos': b64(np.round(pos * 10000).astype(np.int16)), 'uv': b64(np.round(uv * 65535).astype(np.uint16)), 'nor': b64(np.round(nn * 127).astype(np.int8)),
           'idx': b64(idx.astype(np.uint16 if len(pos) < 65535 else np.uint32)), 'idx32': len(pos) >= 65535, 'si': b64(si), 'sw': b64(sw),
           'tex': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), 'parts': info}
    js = '// Generated by tools/build_leader_parts.py - the leader model (owner-made, simple clothes), smooth skinned to the stick-man skeleton. Loaded only when Settings > Leader model = New model. Do not edit by hand.\nconst LEADER_PARTS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    dst = os.path.join(os.path.dirname(__file__), '..', 'js', 'leader_parts.js'); open(dst, 'w').write(js)
    print('verts', len(pos), 'tris', len(idx) // 3, 'tex %d KB' % (len(buf.getvalue()) // 1024), 'js %d KB' % (len(js) // 1024), 'scale %.4f' % s)

if __name__ == '__main__': main()
