const fs = require('fs');
const path = require('path');

const builderPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@angular',
  'fire',
  'schematics',
  'deploy',
  'builder.js'
);

if (!fs.existsSync(builderPath)) {
  process.exit(0);
}

const source = fs.readFileSync(builderPath, 'utf8');
const broken = 'var hae=(0,Q.dirname)((0,VA.fileURLToPath)(Dae.url))';
const fixed = 'var hae=__dirname';

if (source.includes(fixed)) {
  process.exit(0);
}

if (!source.includes(broken)) {
  console.warn('[patch-angularfire-deploy] Expected AngularFire deploy builder pattern was not found.');
  process.exit(0);
}

fs.writeFileSync(builderPath, source.replace(broken, fixed));
console.log('[patch-angularfire-deploy] Patched AngularFire deploy builder for CommonJS execution.');
