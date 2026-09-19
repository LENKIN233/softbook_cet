#!/usr/bin/env node
// Explicit live smoke only. This uses synthetic users/cards in the real product
// API and memory adapter; it neither connects CloudBase nor claims deployment.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../',import.meta.url));
const {setup}=require('../infra/cloudbase/functions/softbook-api/test/fixtures/jev-learning.js');
const {createJevLearningAdvisor}=require('../infra/cloudbase/functions/softbook-api/jev-learning-advisor.js');
if(!process.env.TYPESAFE_API_KEY?.trim()) throw new Error('TYPESAFE_API_KEY is required for an explicit live smoke.');
const telemetry=[];
const advisor=createJevLearningAdvisor({env:{SOFTBOOK_JEV_MODE:'rerank',TYPESAFE_API_KEY:process.env.TYPESAFE_API_KEY},observe:event=>telemetry.push(event)});
const runtime=await setup({advisor});
await runtime.prime();
const before=JSON.stringify([...runtime.store.snapshot().learningStates.values()]);
const selection=await runtime.read();
const after=JSON.stringify([...runtime.store.snapshot().learningStates.values()]);
const observed=telemetry.filter(t=>t.status==='evaluated');
const files=['index.js','learning-answer-evidence.js','learning-events-v2.js','learning-events-v2-store.js','learning-scheduler-v1.js','jev-learning-advisor.js'];
const sourceHashes={};
for(const name of files){
  const path=`infra/cloudbase/functions/softbook-api/${name}`;
  sourceHashes[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
}
const report={schemaVersion:'jev-product-smoke.v1',observedAt:new Date().toISOString(),
  environment:'local_memory_product_api',dataSource:'synthetic',model:'jev-1.13.0',mode:'rerank',
  sourceHashes,httpStatus:selection.statusCode,selectedCardId:selection.body.data?.selection?.card_id??null,
  expectedCardId:'052104',fsrsUnchanged:before===after,realCallsCompleted:observed.length,
  estimatedCostUsd:observed.reduce((sum,row)=>sum+row.estimatedCostUsd,0),telemetry,
  deployed:false,learningEffectVerified:false};
report.passed=report.httpStatus===200&&report.realCallsCompleted===1&&report.selectedCardId===report.expectedCardId&&report.fsrsUnchanged;
const out=resolve(root,'.tmp/jev-next/product-live.json');
await mkdir(resolve(root,'.tmp/jev-next'),{recursive:true});
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
console.log(`Report: ${out}`);
if(!report.passed)process.exitCode=2;
