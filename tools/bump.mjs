// Version in sw.js und js/store.js gleichzeitig erhöhen:  node tools/bump.mjs [patch|minor|major]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const swPath = `${root}sw.js`;
const storePath = `${root}js/store.js`;
const kind = process.argv[2] || 'patch';

const sw = readFileSync(swPath, 'utf8');
const [maj, min, pat] = sw.match(/const VERSION = '(\d+)\.(\d+)\.(\d+)'/).slice(1).map(Number);
const next = kind === 'major' ? `${maj + 1}.0.0` : kind === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

writeFileSync(swPath, sw.replace(/const VERSION = '[\d.]+'/, `const VERSION = '${next}'`));
writeFileSync(storePath, readFileSync(storePath, 'utf8').replace(/export const VERSION = '[\d.]+'/, `export const VERSION = '${next}'`));
console.log(`Version -> ${next}`);
