#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../apps/web/node_modules/playwright-core/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'apps/web/public/favicon.svg'), 'utf8');
const roundSvg = svg.replace(
  '<rect width="1024" height="1024" fill="#242435"/>',
  '<circle cx="512" cy="512" r="512" fill="#242435"/>',
);
if (roundSvg === svg) throw new Error('The launcher background is missing.');

const chrome = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  chromium.executablePath(),
].find(path => path && existsSync(path));
if (!chrome) throw new Error('Chromium is required to render the brand vector.');

const iosRoot = join(root, 'apps/mobile/ios/SoftbookCET/Images.xcassets/AppIcon.appiconset');
const iosImages = [
  ['iphone', '20x20', '2x', 40],
  ['iphone', '20x20', '3x', 60],
  ['iphone', '29x29', '2x', 58],
  ['iphone', '29x29', '3x', 87],
  ['iphone', '40x40', '2x', 80],
  ['iphone', '40x40', '3x', 120],
  ['iphone', '60x60', '2x', 120],
  ['iphone', '60x60', '3x', 180],
  ['ios-marketing', '1024x1024', '1x', 1024],
].map(([idiom, size, scale, pixels]) => ({
  idiom,
  size,
  scale,
  pixels,
  filename: `AppIcon-${size.replace('x', '-')}-${scale}.png`,
}));

const androidSizes = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

const browser = await chromium.launch({executablePath: chrome, headless: true});
async function render(source, pixels, output, transparent = false) {
  mkdirSync(dirname(output), {recursive: true});
  const page = await browser.newPage({viewport: {width: pixels, height: pixels}, deviceScaleFactor: 1});
  try {
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style></head><body>${source}</body></html>`);
    await page.screenshot({path: output, omitBackground: transparent});
  } finally {
    await page.close();
  }
}

try {
  for (const image of iosImages) {
    await render(svg, image.pixels, join(iosRoot, image.filename));
  }
  writeFileSync(join(iosRoot, 'Contents.json'), `${JSON.stringify({
    images: iosImages.map(({idiom, size, scale, filename}) => ({filename, idiom, scale, size})),
    info: {author: 'xcode', version: 1},
  }, null, 2)}\n`);

  for (const [density, pixels] of androidSizes) {
    const directory = join(root, `apps/mobile/android/app/src/main/res/mipmap-${density}`);
    await render(svg, pixels, join(directory, 'ic_launcher.png'));
    await render(roundSvg, pixels, join(directory, 'ic_launcher_round.png'), true);
  }
  await render(svg, 180, join(root, 'apps/web/public/apple-touch-icon.png'));
} finally {
  await browser.close();
}

process.stdout.write('Rendered Softbook icons from apps/web/public/favicon.svg.\n');
