#!/usr/bin/env python3
"""Builds js/leader_parts.js: the leader model made of separate parts (rigid segments) bound to the game's stick-man skeleton.

usage:
  python3 tools/build_leader_parts.py leader3.glb [texture-size] [lift]
(a .glb file holds the parts and the base colour texture)
  (lift = optional brightening of the colour texture, 1.0 = as is, 1.6 = noticeably lighter; the original is very dark)

Every FBX mesh ("tripo_part_N") keeps its own geometry. Each part is bound to ONE bone (weight 255): the bone that the part belongs to by the
same rules as tools/build_models.py (distance to the bone segments, arms/legs by side, hands to the forearm), summed over the part's vertices.
So the animation moves whole segments (a sleeve, a boot, a shoulder pad) instead of blending by the area around a bone.
The animation matches because js/rig.js moves the stick-man's joints to the model's joints (LEADER_JOINTS).
The model is used with Settings > Leader model, or ?leader=1 (see js/rig.js). Output: LEADER_PARTS = same layout as CHAR_MODELS entries plus 'parts' (name, bone, vertex range)."""
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

# height warp (metres): model height -> classic stick-man height. knee, hip, shoulder, neck, head top (the head keeps its size and is only moved up)
# arms and shoulder pieces are lifted by this much (metres); keep LEADER_JOINTS.shY in js/rig.js = 1.60 + ARM_UP (leader3)
ARM_UP = 0.10
# the legs were too short: model height -> new height (knee 0.38 -> 0.45, hip 0.80 -> 0.92, everything above is moved up 12 cm; the leader is 1.92 m tall).
# keep LEADER_JOINTS (hipY, kneeDY, neckY, shY) in js/rig.js in step with these numbers
LEG_WARP = ([0, 0.37, 0.81, 1.40, 1.80], [0, 0.48, 0.99, 1.60, 1.97])        # leader3: knee, hip, shoulder, top

# the body (torso, skirt, belt) is warped on its own so the skirt hem stays high and more of the thigh shows below it
BODY_WARP = ([0, 0.57, 0.81, 1.40, 1.80], [0, 0.80, 0.99, 1.60, 1.97])

def is_skirt(v):
    """The two long pelvis guards (the chain skirt, parts 1 and 2): centre at hip height, near the middle, tall."""
    c = (v.max(axis=0) + v.min(axis=0)) / 2
    return 0.70 <= c[1] < 0.86 and abs(c[0]) < 0.24 and (v.max(axis=0) - v.min(axis=0))[1] > 0.30

def is_torso(v):
    """leader3: the one big part that holds chest, belly, pelvis and skirt."""
    return len(v) > 3000

def assign(v):
    """One bone for a whole part, from the part's centre (metres, feet at y=0, model facing +z, x<0 is the rig's L side). Rules fitted to the skeleton in tools/build_models.py."""
    c = (v.max(axis=0) + v.min(axis=0)) / 2; x, y = c[0], c[1]; ax = abs(x); side = 'L' if x < 0 else 'R'
    if len(v) < 100 and 0.5 <= y < 1.0: return 'hips'                                          # leader3: the small belt buckle
    if y >= 1.58 and ax < 0.15: return 'head'
    if ax >= 0.24 and y >= 0.5: return ('shoulder' if y >= 1.12 else 'elbow') + side         # upper arm and pauldron -> shoulder; forearm, bracer, hand -> elbow
    if y >= 1.3 and ax >= 0.12: return 'shoulder' + side                                       # shoulder pads follow the arm
    if is_skirt(v): return 'hips'                                                              # the chain skirt: pelvis bone, plus a soft share of the thigh bone at the front (see skirt weights)
    if y < 0.86 and ax >= 0.05: return ('hip' if y >= 0.42 else 'knee') + side                # thigh -> hip; shin, boot -> knee
    if y < 0.7: return 'hips'
    if 0.70 <= y < 1.0 and ax < 0.24: return 'hips'                                           # pelvis guards, belt, pouches
    return 'spine'

def main():
    src = sys.argv[1]; parts, tex = load_glb(src); tex = io.BytesIO(tex); rest = sys.argv[2:]
    size = int(rest[0]) if len(rest) > 0 else 1024; lift = float(rest[1]) if len(rest) > 1 else 1.0
    P, N, U, I, owner, names = [], [], [], [], [], []
    for k, p in enumerate(parts):
        pos, nor, uv, idx = weld(p); base = sum(len(a) for a in P)
        P.append(pos); N.append(nor); U.append(uv); I.append(idx + base); owner.append(np.full(len(pos), k)); names.append(p['name'])
    pos = np.concatenate(P); nor = np.concatenate(N); uv = np.concatenate(U); idx = np.concatenate(I); owner = np.concatenate(owner)
    s = BM.HEIGHT / (pos[:, 1].max() - pos[:, 1].min()); pos = (pos - [0, pos[:, 1].min(), 0]) * s
    pos[:, 0] -= (pos[:, 0].max() + pos[:, 0].min()) / 2; pos[:, 2] -= (pos[:, 2].max() + pos[:, 2].min()) / 2
    bone_of = np.zeros(len(parts), int)
    for k in range(len(parts)): bone_of[k] = BM.BONES.index(assign(pos[owner == k]))
    si = np.zeros((len(pos), 4), np.uint8); sw = np.zeros((len(pos), 4), np.uint8)
    si[:, 0] = bone_of[owner]; sw[:, 0] = 255
    tor = np.isin(owner, [k for k in range(len(parts)) if is_torso(pos[owner == k])])                      # leader3: one big torso part (chest, belly, pelvis, skirt): soft weights by height -> hips below the waist, spine above, head at the collar, the front of the skirt also follows the thigh
    if tor.any():
        y, z, x = pos[tor, 1], pos[tor, 2], pos[tor, 0]; sm = lambda a, b, t: (lambda u: u * u * (3 - 2 * u))(np.clip((t - a) / (b - a), 0, 1))
        wh = 1 - sm(0.86, 1.06, y); wd = 0.5 * sm(1.50, 1.62, y)
        h = np.clip((0.80 - y) / 0.23, 0, 1); wt = np.maximum(np.clip((z + 0.02) / 0.12, 0, 1) * np.clip(np.abs(x) / 0.08, 0.35, 1), 0.85 * np.clip((np.abs(x) - 0.10) / 0.10, 0, 1) * np.clip((z + 0.12) / 0.12, 0, 1)) * h ** 0.8 * wh      # front and side panels follow the thigh, the back stays on the pelvis
        W = np.zeros((tor.sum(), 4)); I = np.zeros((tor.sum(), 4), np.uint8)
        I[:, 0] = BM.BONES.index('hips'); I[:, 1] = BM.BONES.index('spine'); I[:, 2] = BM.BONES.index('head')
        I[:, 3] = np.where(x < 0, BM.BONES.index('hipL'), BM.BONES.index('hipR'))
        W[:, 3] = wt; W[:, 0] = wh - wt; W[:, 2] = wd; W[:, 1] = 1 - wh - wd
        W = np.clip(W, 0, None); W /= W.sum(1, keepdims=True); q = np.round(W * 255).astype(np.int32); q[:, 0] += 255 - q.sum(1)
        si[tor] = I; sw[tor] = q.astype(np.uint8)
    im = Image.open(tex).convert('RGB').resize((size, size), Image.LANCZOS)
    if lift != 1.0: im = Image.fromarray((255 * (np.asarray(im, float) / 255) ** (1 / lift)).astype(np.uint8))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=84, optimize=True)
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    arm = np.isin(bone_of[owner], [BM.BONES.index(n) for n in ('shoulderL', 'shoulderR', 'elbowL', 'elbowR')])
    for k in range(len(parts)):                                                                                # the collar pads next to the neck stay with the body (not lifted with the arms)
        v = pos[owner == k]; c = (v.max(axis=0) + v.min(axis=0)) / 2
        if BM.BONES[bone_of[k]].startswith('shoulder') and abs(c[0]) < 0.22 and c[1] >= 1.3: arm[owner == k] = False         # arms and shoulder pieces sit a bit higher, next to the neck (the animation was made for higher shoulders)
    legp = np.isin(bone_of[owner], [BM.BONES.index(n) for n in ('hipL', 'hipR', 'kneeL', 'kneeR')])
    pos[:, 1] = np.where(legp, np.interp(pos[:, 1], LEG_WARP[0], LEG_WARP[1]), np.interp(pos[:, 1], BODY_WARP[0], BODY_WARP[1])); pos[arm, 1] += ARM_UP
    nn = nor / np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
    info = [{'name': names[k], 'bone': BM.BONES[bone_of[k]], 'verts': int((owner == k).sum())} for k in range(len(parts))]
    out = {'n': len(pos), 'pos': b64(np.round(pos * 10000).astype(np.int16)), 'uv': b64(np.round(uv * 65535).astype(np.uint16)), 'nor': b64(np.round(nn * 127).astype(np.int8)),
           'idx': b64(idx.astype(np.uint16 if len(pos) < 65535 else np.uint32)), 'idx32': len(pos) >= 65535, 'si': b64(si), 'sw': b64(sw),
           'tex': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), 'parts': info}
    js = '// Generated by tools/build_leader_parts.py - the leader built from separate rigid parts (owner-made model). Loaded only with ?leader=1. Do not edit by hand.\nconst LEADER_PARTS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    dst = os.path.join(os.path.dirname(__file__), '..', 'js', 'leader_parts.js'); open(dst, 'w').write(js)
    cnt = {}
    for k in range(len(parts)): cnt[BM.BONES[bone_of[k]]] = cnt.get(BM.BONES[bone_of[k]], 0) + 1
    print('verts', len(pos), 'tris', len(idx) // 3, 'tex %d KB' % (len(buf.getvalue()) // 1024), 'js %d KB' % (len(js) // 1024), 'scale %.4f' % s); print('parts per bone', cnt)

if __name__ == '__main__': main()
