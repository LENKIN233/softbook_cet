import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const forbidden = [
  'local-structured-card-source',
  '短对话里听到 however',
  'The committee postponed the vote',
];

const files = collectFiles(dist).filter(file => /\.(?:html|js|css)$/.test(file));
const findings = [];

for (const file of files) {
  const contents = fs.readFileSync(file, 'utf8');
  for (const sentinel of forbidden) {
    if (contents.includes(sentinel)) {
      findings.push(`${path.relative(root, file)} contains ${JSON.stringify(sentinel)}`);
    }
  }
}

if (findings.length > 0) {
  console.error('FAIL: production Web bundle contains development card content.');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('PASS: production Web bundle excludes development card content.');

function collectFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(target) : [target];
  });
}
