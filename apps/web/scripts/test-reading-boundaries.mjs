import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

// Use the actual LearningSurface, styles and bundled cards. These failures are
// about clipped pixels and intercepted clicks, which jsdom cannot verify.
const root = fileURLToPath(new URL('..', import.meta.url));
const repository = resolve(root, '../..');
mkdirSync(resolve(repository, 'exports'), {recursive:true});
const fixture = mkdtempSync(resolve(repository, 'exports/web-reading-regression-'));
const executablePath = [process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', chromium.executablePath()].find(path => path && existsSync(path));
if (!executablePath) throw new Error('Install Chromium with: npx playwright-core install chromium');
const source = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LearningSurface} from '/@fs/${repository}/apps/web/src/App.tsx';
import {localLearningCardSource} from '/@fs/${repository}/apps/mobile/src/learning/localCardSource.ts';
import {createLearningCardState,evaluateLearningCard} from '/@fs/${repository}/apps/mobile/src/learning/sessionCore.ts';
import {installStudioTheme} from '/@fs/${repository}/apps/web/src/visualTheme.ts';
import '/@fs/${repository}/apps/web/src/styles.css';
installStudioTheme();
const query = new URLSearchParams(location.search);
const card = localLearningCardSource.loadCards(query.get('track')).find(card => card.interaction_id === query.get('kind'));
window.qaCard = card;
function Harness() {
 const [state,setState] = useState(() => createLearningCardState(card));
 const [result,setResult] = useState(null);
 return <div className="app-shell"><header className="mobile-header">软书</header>
  <LearningSurface motionIdentity={card.card_id} card={card} cardState={state} currentIndex={0} phase="learning" total={5}
   resolved={result} onState={setState} onResolve={next=>{if(next)setState(next);setResult(evaluateLearningCard(card,next??state));}}
   onContinue={()=>{setState(createLearningCardState(card));setResult(null);}} onOpenSpace={()=>{}} onFavorite={()=>{}}
   onPlayAudio={()=>{}} audioStatus="idle" busy={false} canMutateSpace={true} queuedResult={null}
   rejectedCompletion={false} retryBusy={false} serverSequenced={false} statusMessage="" syncStatus=""
   onReloadQueued={()=>{}} onRetryQueued={()=>{}} />
  <nav className="route-rail"><div className="route-list">{['学习','空间','统计','我的'].map(label=><button key={label} className="route">{label}</button>)}</div></nav>
 </div>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`;
writeFileSync(resolve(fixture, 'surface.tsx'), source);
writeFileSync(resolve(fixture, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="/surface.tsx"></script></body></html>');
const server = await createServer({root:fixture, configFile: resolve(root, 'vite.config.ts'),
  resolve:{alias:{'react-dom':resolve(root,'node_modules/react-dom')}},
  server: {host: '127.0.0.1', port: 0}, plugins: [{name: 'reading-boundary-fixture', enforce: 'pre',
    transform(code, id) {if (id === resolve(root, 'src/App.tsx')) return code + '\nexport {LearningSurface};';},
  }]});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch({executablePath, headless: true});
  for (const viewport of [{width:667,height:320},{width:320,height:480}]) {
    for (const track of ['cet4','cet6']) for (const kind of ['flip','multiple_choice','lock','elimination','swipe']) {
      const page = await browser.newPage({viewport, reducedMotion:'reduce'});
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(`${server.resolvedUrls.local[0]}?track=${track}&kind=${kind}`);
        await page.locator('.learning-card').waitFor();
        const body = page.locator('.paper-body');
        assert.ok(await body.evaluate(node => node.clientHeight >= 80), `${track}/${kind}: reading area collapsed`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const card = await page.evaluate(() => window.qaCard);
        if (kind === 'flip') {
          await page.getByRole('button',{name:'翻面看答案',exact:true}).click();
          await page.getByRole('button',{name:'有把握',exact:true}).click();
        } else if (kind === 'multiple_choice') {
          await page.getByRole('group',{name:'四选一选项'}).getByRole('button').last().click();
          await page.getByRole('button',{name:'提交答案',exact:true}).click();
        } else if (kind === 'lock') {
          for (const [index,slot] of card.lock_slots.entries()) await page.getByRole('group',{name:slot.label+'选项',exact:true}).getByRole('button',{name:card.answer_key.lock_pattern[index],exact:true}).click();
        } else if (kind === 'elimination') {
          for (const id of card.answer_key.correct_items) await page.getByRole('group',{name:/选择要删除/}).getByRole('button',{name:card.elimination_items.find(item=>item.id===id).text,exact:false}).click();
          await page.getByRole('button',{name:'提交答案',exact:true}).click();
        } else await page.getByRole('group',{name:'左右滑动判断'}).getByRole('button').last().click();
        await page.getByRole('button',{name:'下一张',exact:true}).waitFor();
        await body.evaluate(node => {node.scrollTop=node.scrollHeight;});
        assert.ok(await body.evaluate(node => node.scrollHeight-node.clientHeight-node.scrollTop < 2), 'answer bottom is unreachable');
        await page.getByRole('button',{name:'下一张',exact:true}).click();
        assert.deepEqual(errors, []);
        results.push({viewport,track,kind,card:card.card_id});
      } finally {await page.close();}
    }
  }
  console.log(JSON.stringify({passed:results.length,cases:results}));
} finally {await browser?.close(); await server.close(); rmSync(fixture,{recursive:true,force:true});}
