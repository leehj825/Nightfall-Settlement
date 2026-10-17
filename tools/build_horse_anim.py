#!/usr/bin/env python3
"""Builds js/horse_anim.js: walk and gallop animation for the classic (box) horse, taken from a rigged horse .glb (owner-made animation pack).

usage: python3 tools/build_horse_anim.py Lowpolyhorseanimationspack.glb

The classic horse is a hierarchy of rigid boxes on 12 joints (see src/game/04c-horse.js): body, neck, head, tail and two parts per leg (U upper, L lower). Each joint is placed at one bone of the .glb skeleton and takes the rotation of one bone (BONES below).
All joints rest with an identity orientation in the model frame (x forward, y up, z to the horse's right), so the animation is retargeted by world-space rotation deltas:
  delta(bone, t) = world rotation at t * world rotation at rest^-1  (in the .glb frame), turned into the model frame; a joint's local rotation = parent delta^-1 * its delta.
Clips: 'horse walk attack 1' (a walk cycle, 1.08 s) -> walk; 'horse runcycle new' (a gallop, 0.625 s) -> run. The hips also move (bob) - stored as a translation delta.
Output: HORSE_ANIM = { bones: [[name, parentIndex]...], rest: [[x,y,z]...] (world, model frame), clips: { walk: { dur, n, q: [...], p: [...] }, run: {...} } }."""
import sys, os, json, struct
import numpy as np

def load(path):
    d = open(path, 'rb').read(); l = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + l]); off = 20 + l; bl = struct.unpack('<I', d[off:off + 4])[0]; blob = d[off + 8:off + 8 + bl]
    CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}; NN = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NN[a['type']]
        return np.frombuffer(blob, np.dtype(CT[a['componentType']]), a['count'] * n, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, n).astype(np.float64)
    return j, acc

def qmat(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def mq(m):
    t = np.trace(m)
    if t > 0: s = np.sqrt(t + 1) * 2; q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, s / 4]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]: s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2; q = [s / 4, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]: s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2; q = [(m[0, 1] + m[1, 0]) / s, s / 4, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else: s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2; q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, s / 4, (m[1, 0] - m[0, 1]) / s]
    q = np.array(q); q /= np.linalg.norm(q); return q if q[3] >= 0 else -q
def slerp(a, b, t):
    d = a @ b
    if d < 0: b = -b; d = -d
    if d > 0.9995: r = a + (b - a) * t; return r / np.linalg.norm(r)
    th = np.arccos(d); return (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)

def swing(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = a @ b
    if c < -0.9999: return -np.eye(3) + 2 * np.outer(a, a)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + K + K @ K / (1 + c)

BONES = [('body', None, 'spine.004', ('spine.002', 'spine.005')), ('neck', 'body', 'neck.001', ('neck.001', 'skull')), ('head', 'neck', 'skull', 'skull'), ('tail', 'body', 'tail.001', 'tail.001')]       # (name, parent, pivot bone, rotation: a bone, or a pair (from, to) of bones whose direction the part follows) in the glb
for side in 'LR':
    BONES += [('f%sU' % side, 'body', 'forearm.' + side, ('forearm.' + side, 'forefoot.' + side)), ('f%sL' % side, 'f%sU' % side, 'forefoot.' + side, ('forefoot.' + side, 'f_hoof.' + side)),
              ('h%sU' % side, 'body', 'thigh.' + side, ('thigh.' + side, 'hind_foot.' + side)), ('h%sL' % side, 'h%sU' % side, 'hind_foot.' + side, ('hind_foot.' + side, 'r_hoof.' + side))]
P = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], float)          # glb (x right, y up, z forward) -> model (x forward, y up, z right)
SHIFT = 0.05                                                      # the saddle spot (glb z = -0.05) becomes x = 0

def main():
    j, acc = load(sys.argv[1]); idx = {n.get('name'): i for i, n in enumerate(j['nodes'])}; nodes = j['nodes']; par = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): par[c] = i
    def world(pose):
        W = {}
        def w(i):
            if i in W: return W[i]
            n = nodes[i]; T, Q, S = pose.get(i, (n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1])))
            M = np.eye(4); M[:3, :3] = qmat(Q) * np.array(S); M[:3, 3] = T; W[i] = (w(par[i]) if i in par else np.eye(4)) @ M; return W[i]
        for i in range(len(nodes)): w(i)
        return W
    Wr = world({}); names = [b[0] for b in BONES]; pidx = [names.index(b[1]) if b[1] else -1 for b in BONES]; gi = [idx[b[2]] for b in BONES]; gr = [(idx[b[3]], None) if isinstance(b[3], str) else (idx[b[3][0]], idx[b[3][1]]) for b in BONES]; hip = idx['spine.002']
    toM = lambda p: (P @ np.asarray(p, float)) + np.array([SHIFT, 0, 0])
    rest = [toM(Wr[g][:3, 3]).round(4).tolist() for g in gi]
    def clip(name):
        ai = next(i for i, a in enumerate(j['animations']) if a['name'] == name); a = j['animations'][ai]; tr = {}
        for ch in a['channels']:
            s = a['samplers'][ch['sampler']]; tr[(ch['target']['node'], ch['target']['path'])] = (acc(s['input']).ravel(), acc(s['output']))
        t0 = min(v[0][0] for v in tr.values()); t1 = max(v[0][-1] for v in tr.values()); return tr, t0, t1
    def sample(k, t, quat):
        times, vals = k; t = min(max(t, times[0]), times[-1])
        if t >= times[-1]: return vals[-1]
        i = np.searchsorted(times, t, side='right') - 1; u = (t - times[i]) / (times[i + 1] - times[i])
        return slerp(vals[i], vals[i + 1], u) if quat else vals[i] * (1 - u) + vals[i + 1] * u
    out = {}
    for key, name, n in (('walk', 'horse walk attack 1', 26), ('run', 'horse runcycle new', 15)):
        tr, t0, t1 = clip(name); dur = t1 - t0; qs, ps, Ds = [], [], []                      # n frames over one cycle (the last frame equals the first, so it is left out)
        for f in range(n):
            t = t0 + dur * f / n; pose = {}
            for i, nd in enumerate(nodes):
                g = lambda p, d, q: sample(tr[(i, p)], t, q) if (i, p) in tr else d
                pose[i] = (g('translation', nd.get('translation', [0, 0, 0]), False), g('rotation', nd.get('rotation', [0, 0, 0, 1]), True), g('scale', nd.get('scale', [1, 1, 1]), False))
            W = world(pose); D = []
            for b in range(len(BONES)):
                g0, g1 = gr[b]
                if g1 is None:
                    Rw = W[g0][:3, :3]; Rr = Wr[g0][:3, :3]; Rw = Rw / np.linalg.norm(Rw, axis=0); Rr = Rr / np.linalg.norm(Rr, axis=0); D.append(P @ (Rw @ Rr.T) @ P.T)
                else:                                                                                       # follow the direction between two bones (swing only, no twist)
                    a0 = Wr[g1][:3, 3] - Wr[g0][:3, 3]; a1 = W[g1][:3, 3] - W[g0][:3, 3]
                    if (BONES[b][0][0] in 'fh' and len(BONES[b][0]) == 3) or BONES[b][0] == 'body':                                  # legs and the body pitch forward and back only: the angle in the side view (x forward, y up), no sideways swing
                        m0, m1 = P @ a0, P @ a1; d = np.arctan2(m1[1], m1[0]) - np.arctan2(m0[1], m0[0]); c, sn = np.cos(d), np.sin(d); D.append(np.array([[c, -sn, 0], [sn, c, 0], [0, 0, 1]]))
                    else: D.append(P @ swing(a0, a1) @ P.T)
            Ds.append(D); ps += (lambda dp: dp.round(4).tolist())(np.array([*(P @ (W[hip][:3, 3] - Wr[hip][:3, 3]))[:2], 0.0]))          # the back's bob; no sideways sway
        ang = lambda M: np.arctan2(M[1, 0], M[0, 0])                                                  # planar parts: the rotation angle about the side axis (+ = the foot swings forward)
        rot = lambda t: np.array([[np.cos(t), -np.sin(t), 0], [np.sin(t), np.cos(t), 0], [0, 0, 1]])
        lowers = [b for b in range(len(BONES)) if BONES[b][0][0] in 'fh' and len(BONES[b][0]) == 3 and BONES[b][0][2] == 'L']
        for b in lowers:                                                                              # the knee/hock bends only one way: front lower legs fold backward, hind lower legs forward (the owner's request); the fold the pack keeps all the time is taken off, so the leg can straighten
            rel = [abs(ang(D[b]) - ang(D[pidx[b]])) for D in Ds]; base = min(rel); sign = -1 if BONES[b][0][0] == 'f' else 1
            for D, r in zip(Ds, rel): D[b] = rot(ang(D[pidx[b]]) + sign * (r - base))
        HIND_BACK = {'walk': -6, 'run': -24}[key]                                                      # degrees: the hind legs (thigh + lower leg together) swing further back and less forward (the owner's request)
        for D in Ds:
            for b in range(len(BONES)):
                if BONES[b][0][0] == 'h' and len(BONES[b][0]) == 3: D[b] = rot(ang(D[b]) + np.radians(HIND_BACK))
        for D in Ds:
            for b in range(len(BONES)): loc = (D[pidx[b]].T @ D[b]) if pidx[b] >= 0 else D[b]; qs += mq(loc).round(4).tolist()
        out[key] = {'dur': round(float(dur), 4), 'n': n, 'q': qs, 'p': ps}
    o = {'bones': [[names[i], pidx[i]] for i in range(len(names))], 'rest': rest, 'clips': out}
    js = '// Generated by tools/build_horse_anim.py - walk and gallop for the classic horse (from the owner-made horse animation pack). Do not edit by hand.\nconst HORSE_ANIM = ' + json.dumps(o, separators=(',', ':')) + ';\n'
    open(os.path.join(os.path.dirname(__file__), '..', 'js', 'horse_anim.js'), 'w').write(js); print('bones', len(names), 'walk', out['walk']['dur'], 'run', out['run']['dur'], 'js %d KB' % (len(js) // 1024))
    for n_, r in zip(names, rest): print(n_, r)
main()
