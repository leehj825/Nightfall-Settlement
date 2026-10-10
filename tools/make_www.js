// Copies the web game into www/ (the folder Capacitor packs into the Android app). Only runtime files are copied.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.json']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'vendor', 'icons']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('www/ ready:', fs.readdirSync(out).join(', '));
