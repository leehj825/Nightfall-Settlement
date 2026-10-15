#!/usr/bin/env node
// Dumps every mesh of an FBX file (one mesh = one "part") as plain JSON: world-space positions/normals/uvs/indices, Y up.
//   node tools/dump_fbx_parts.js <three-r128-dir> <file.fbx> <out.json>
// <three-r128-dir> = a folder with three@0.128 (build/three.js, examples/js/loaders/FBXLoader.js, examples/js/libs/fflate.min.js), as for retarget_mixamo.js.
// Used by tools/build_leader_parts.py to build js/leader_parts.js.
const fs = require('fs'), path = require('path'), vm = require('vm');
const [T, file, out] = process.argv.slice(2);
if (!T || !file || !out) { console.error('usage: dump_fbx_parts.js <three-dir> <file.fbx> <out.json>'); process.exit(1); }
global.THREE = require(path.join(T, 'build/three.js')); global.window = global; global.self = global;
global.fflate = (() => { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(path.join(T, 'examples/js/libs/fflate.min.js'), 'utf8') + '\n;return module.exports;')(m, m.exports); return m.exports; })();
vm.runInThisContext(fs.readFileSync(path.join(T, 'examples/js/loaders/FBXLoader.js'), 'utf8'));
THREE.TextureLoader.prototype.load = function (u, ok) { const t = new THREE.Texture(); if (ok) ok(t); return t; };       // textures are handled by the Python step
const b = fs.readFileSync(file), root = new THREE.FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
root.rotation.set(0, 0, 0); root.updateMatrixWorld(true);                                                     // the FBX root turns the model 90 degrees (Z up); we want the model's own Y-up axes
const parts = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
root.traverse(n => {
  if (!n.isMesh) return; const g = n.geometry, p = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv; nm.getNormalMatrix(n.matrixWorld);
  const P = [], N = [], U = [];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld); P.push(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)); v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)); if (uv) U.push(+uv.getX(i).toFixed(5), +uv.getY(i).toFixed(5)); }
  const idx = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
  parts.push({ name: n.name, pos: P, nor: N, uv: U, idx });
});
fs.writeFileSync(out, JSON.stringify({ parts }));
console.log('parts', parts.length, 'verts', parts.reduce((a, q) => a + q.pos.length / 3, 0), 'tris', parts.reduce((a, q) => a + q.idx.length / 3, 0));
