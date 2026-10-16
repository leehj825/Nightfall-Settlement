#!/usr/bin/env python3
"""Builds js/leader_parts.js: the leader model with its own skeleton (a Mixamo-style .glb with skin weights) mapped onto the game's stick-man bones.

usage:
  python3 tools/build_leader_parts.py leader_skeleton.glb [texture-size] [lift]

The .glb carries the meshes, the base colour texture, a 65-joint skeleton (T-pose, with fingers and clavicles) and per-vertex weights (4 joints). The weights are kept;
the joints are merged into the game's bones: Hips -> hips; Spine, Spine1, Spine2 -> spine; Neck, Head -> head; Shoulder (clavicle) -> clavL/clavR (skin-only bones, index 11, 12);
Arm -> shoulder; ForeArm, Hand, fingers -> elbow (the fingers move with the forearm); UpLeg -> hip; Leg, Foot, Toe -> knee. Mixamo "Left" is +x, the game's L is -x, so the sides are swapped.
The model is in T-pose: the arms are posed 72 degrees down about the shoulder at build time (linear blend skinning with the arm weights) to match the rig's rest pose.
The joint positions (after posing and scaling) are written to the output ('joints') and js/rig.js moves the stick-man's bones there (LEADER_JOINTS).
Output: LEADER_PARTS = same layout as CHAR_MODELS entries plus 'joints'."""
import sys, os, json, io, base64, struct
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import build_models as BM

HEIGHT = 1.8 * 1.08                  # metres
ARM_DOWN = np.radians(72)
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NN = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def bone_of(name):
    """game bone index (0-10 = BM.BONES, 11/12 = clavL/clavR) for a Mixamo joint name."""
    n = name.replace('mixamorig:', ''); side = None
    for pre, sd in (('Left', 'R'), ('Right', 'L')):                      # Mixamo Left = +x = the game's R
        if n.startswith(pre): side = sd; n = n[len(pre):]
    if n == 'Hips': return BM.BONES.index('hips')
    if n.startswith('Spine'): return BM.BONES.index('spine')
    if n in ('Neck', 'Head', 'HeadTop_End'): return BM.BONES.index('head')
    if n == 'Shoulder': return 11 if side == 'L' else 12
    if n == 'Arm': return BM.BONES.index('shoulder' + side)
    if n == 'UpLeg': return BM.BONES.index('hip' + side)
    if n in ('Leg', 'Foot', 'ToeBase', 'Toe_End'): return BM.BONES.index('knee' + side)
    return BM.BONES.index('elbow' + side)                                  # ForeArm, Hand, fingers

def load(path):
    d = open(path, 'rb').read(); cl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + cl]); off = 20 + cl; bl = struct.unpack('<I', d[off:off + 4])[0]; blob = d[off + 8:off + 8 + bl]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NN[a['type']]; dt = np.dtype(CT[a['componentType']]); st = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        arr = np.frombuffer(blob, dt, a['count'] * n, st).reshape(-1, n)
        return arr.astype(np.float64) if dt.kind == 'f' else arr.astype(np.int64)
    sk = j['skins'][0]; ibm = acc(sk['inverseBindMatrices']).reshape(-1, 4, 4); names = [j['nodes'][x]['name'] for x in sk['joints']]
    jpos = {n.replace('mixamorig:', ''): np.linalg.inv(ibm[k].T)[:3, 3] for k, n in enumerate(names)}
    jmap = np.array([bone_of(n) for n in names])
    P, N, U, I, SI, SW = [], [], [], [], [], []; base = 0
    for m in j['meshes']:
        pr = m['primitives'][0]; a = pr['attributes']; p = acc(a['POSITION']); P.append(p); N.append(acc(a['NORMAL'])); u = acc(a['TEXCOORD_0']).copy(); u[:, 1] = 1 - u[:, 1]; U.append(u)
        I.append(acc(pr['indices']).ravel() + base); base += len(p); SI.append(acc(a['JOINTS_0'])); SW.append(acc(a['WEIGHTS_0']))
    mat = j['materials'][0]['pbrMetallicRoughness']; im = j['images'][j['textures'][mat['baseColorTexture']['index']]['source']]; bv = j['bufferViews'][im['bufferView']]
    tex = blob[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    return [np.concatenate(x) for x in (P, N, U, I, SI, SW)], jmap, jpos, tex

def main():
    (pos, nor, uv, idx, ji, jw), jmap, jp, tex = load(sys.argv[1]); rest = sys.argv[2:]
    size = int(rest[0]) if len(rest) > 0 else 1024; lift = float(rest[1]) if len(rest) > 1 else 1.0
    # merge the 4 joint influences into game bones (sum the weights of joints that map to the same bone)
    gb = jmap[ji]; si = np.zeros((len(pos), 4), np.int64); sw = np.zeros((len(pos), 4))
    for v in range(len(pos)):
        acc = {}
        for k in range(4):
            if jw[v, k] > 0: acc[gb[v, k]] = acc.get(gb[v, k], 0) + jw[v, k]
        for k, (b, w) in enumerate(sorted(acc.items(), key=lambda e: -e[1])[:4]): si[v, k] = b; sw[v, k] = w
    sw /= np.maximum(sw.sum(1, keepdims=True), 1e-9)
    s = HEIGHT / (pos[:, 1].max() - pos[:, 1].min()); y0 = pos[:, 1].min(); X = lambda p: (np.array(p) - [0, y0, 0]) * s
    J = {k: X(v) for k, v in jp.items()}
    # T-pose -> rest pose: the arm weights rotate the vertices about the shoulder (Mixamo 'Arm' joint)
    pos = X(pos); out = pos.copy(); on = nor.copy()
    for side, mixside, sx in (('L', 'Right', -1), ('R', 'Left', 1)):
        wa = np.zeros(len(pos))
        for k in range(4): wa += np.where(np.isin(si[:, k], [BM.BONES.index('shoulder' + side), BM.BONES.index('elbow' + side)]), sw[:, k], 0)
        a = -sx * ARM_DOWN; c, sn = np.cos(a), np.sin(a); R = np.array([[c, -sn, 0], [sn, c, 0], [0, 0, 1]]); S = J[mixside + 'Arm']
        out += wa[:, None] * (((pos - S) @ R.T + S) - pos); on += wa[:, None] * (nor @ R.T - nor)
    pos = out; nor = on / np.maximum(np.linalg.norm(on, axis=1, keepdims=True), 1e-9)
    def rot(p, side, sx):                                                                      # joint position after the arm pose
        a = -sx * ARM_DOWN; c, sn = np.cos(a), np.sin(a); S = J[side + 'Arm']; return (np.array(p) - S) @ np.array([[c, -sn, 0], [sn, c, 0], [0, 0, 1]]).T + S
    sh = J['LeftArm']; el = rot(J['LeftForeArm'], 'Left', 1); wr = rot(J['LeftHand'], 'Left', 1); ud = (wr - el) / np.linalg.norm(wr - el); fist = wr + ud * 0.05 - el
    hp = J['LeftUpLeg']; kn = J['LeftLeg']; cv = J['LeftShoulder']
    joints = {'shX': sh[0], 'shY': sh[1], 'elX': el[0] - sh[0], 'elDY': sh[1] - el[1], 'hipX': hp[0], 'hipY': hp[1], 'kneeX': kn[0] - hp[0], 'kneeDY': hp[1] - kn[1], 'neckY': J['Neck'][1], 'clX': cv[0], 'fistX': fist[0], 'fistY': fist[1]}
    joints = {k: round(float(v), 4) for k, v in joints.items()}
    im = Image.open(io.BytesIO(tex)).convert('RGB').resize((size, size), Image.LANCZOS)
    if lift != 1.0: im = Image.fromarray((255 * (np.asarray(im, float) / 255) ** (1 / lift)).astype(np.uint8))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=84, optimize=True)
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    q = np.round(sw * 255).astype(np.int32); q[:, 0] += 255 - q.sum(1)
    o = {'n': len(pos), 'pos': b64(np.round(pos * 10000).astype(np.int16)), 'uv': b64(np.round(uv * 65535).astype(np.uint16)), 'nor': b64(np.round(nor * 127).astype(np.int8)),
         'idx': b64(idx.astype(np.uint16 if len(pos) < 65535 else np.uint32)), 'idx32': len(pos) >= 65535, 'si': b64(si.astype(np.uint8)), 'sw': b64(q.astype(np.uint8)),
         'tex': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), 'joints': joints}
    js = '// Generated by tools/build_leader_parts.py - the leader model with its own skeleton weights mapped to the stick-man bones. Loaded only when Settings > Leader model = New model. Do not edit by hand.\nconst LEADER_PARTS = ' + json.dumps(o, separators=(',', ':')) + ';\n'
    open(os.path.join(os.path.dirname(__file__), '..', 'js', 'leader_parts.js'), 'w').write(js)
    print('verts', len(pos), 'tris', len(idx) // 3, 'tex %d KB' % (len(buf.getvalue()) // 1024), 'js %d KB' % (len(js) // 1024), 'scale %.4f' % s); print(joints)

if __name__ == '__main__': main()
