// Copies the web game into www/ (the folder Capacitor packs into the Android app). Only runtime files are copied.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.json']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'vendor', 'icons', 'audio']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true, filter: (s) => !/anims_lib\.js$/.test(s) });
if (process.env.NF_RELEASE === '1') {                                // release: strip the developer features (?debug=1 tools, window.__nf, the title-screen Debug start, the Model field button)
  const need = (cond, what) => { if (!cond) throw new Error('release strip failed: ' + what); };
  let g = fs.readFileSync(path.join(out, 'js', 'game.js'), 'utf8'); const n0 = (g.match(/\/\[\?&\]debug\/\.test\(location\.search\)/g) || []).length; need(n0 >= 3, 'debug checks in game.js (found ' + n0 + ')');
  g = g.replace(/\/\[\?&\]debug\/\.test\(location\.search\)/g, 'false').replace(/\/\[\?&\]load\/\.test\(location\.search\)/g, 'false'); fs.writeFileSync(path.join(out, 'js', 'game.js'), g);
  let h = fs.readFileSync(path.join(out, 'index.html'), 'utf8'); need(h.includes('<details class="dbgStart">') && /id="setModelField"/.test(h), 'debug elements in index.html');
  h = h.replace('<details class="dbgStart">', '<details class="dbgStart" style="display:none">').replace(/(<button[^>]*id="setModelField")/, '$1 style="display:none"'); fs.writeFileSync(path.join(out, 'index.html'), h);
  console.log('release build: developer features removed');
}
fs.writeFileSync(path.join(out, 'js', 'ads_env.js'), `window.NF_ADS_MODE = '${process.env.NF_ADS === 'real' ? 'real' : 'test'}';\n`);       // release builds set NF_ADS=real
console.log('www/ ready:', fs.readdirSync(out).join(', '));
