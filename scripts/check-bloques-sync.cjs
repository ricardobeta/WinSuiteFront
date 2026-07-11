const fs = require('node:fs');
const path = require('node:path');

const frontend = path.resolve(__dirname, '..', '..');
const source = path.join(frontend, 'winsuite-bloques', 'src');
const targets = [
  path.join(frontend, 'winsuite', 'libs', 'bloques', 'src'),
  path.join(frontend, 'winsuite-sites', 'libs', 'bloques', 'src'),
];

function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? files(absolute, base) : [path.relative(base, absolute)];
  });
}

const differences = [];
for (const relative of files(source)) {
  const expected = fs.readFileSync(path.join(source, relative), 'utf8').replace(/\r\n/g, '\n');
  for (const target of targets) {
    const candidate = path.join(target, relative);
    const actual = fs.existsSync(candidate)
      ? fs.readFileSync(candidate, 'utf8').replace(/\r\n/g, '\n')
      : null;
    if (actual === null || expected !== actual) {
      differences.push(`${path.relative(frontend, target)} :: ${relative}`);
    }
  }
}

if (differences.length) {
  console.error('Las copias de @winsuite/bloques están desactualizadas:\n' + differences.join('\n'));
  process.exit(1);
}
console.log('Las tres copias de @winsuite/bloques están sincronizadas.');
