import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { baseSnapshot, event } from "../fixtures/scenarios.mjs";
import { prepare } from "../src/policy.mjs";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const script = `
const fs=require('node:fs');
const scheduler=require('../../infra/cloudbase/functions/softbook-api/learning-scheduler-v1.js');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const entries=new Map();
let sequence=0;
for(const e of input.events){
  const cardId=String(input.cards.findIndex(c=>c.id===e.cardId)+1).padStart(6,'0');
  const next=scheduler.advanceSchedulerEntry(entries.get(e.cardId),{
    acceptedAt:e.acceptedAt,serverSequence:++sequence,
    event:{event_id:e.id.padEnd(8,'_'),card_id:cardId,content_version:'sha256:'+ 'a'.repeat(64),
      answer_grade:e.answerGrade,used_hint:e.usedHint,used_peek:e.usedPeek}
  });
  entries.set(e.cardId,next);
}
process.stdout.write(JSON.stringify([...entries].map(([cardId,entry])=>({cardId,...entry.card}))));
`;

for (const name of ["initial failures", "mixed review history"])
  test(`FSRS state exactly matches production scheduler: ${name}`, () => {
    const snapshot = baseSnapshot();
    if (name === "mixed review history") {
      snapshot.now = "2026-10-10T00:00:00.000Z";
      for (let day = 20; day <= 29; day++)
        snapshot.events.push(
          event(`review_${day}`, day % 2 ? "error_a" : "error_b", {
            acceptedAt: `2026-09-${day}T08:00:00.000Z`,
            answerGrade: day % 4 === 0 ? "review_needed" : "passed",
            usedHint: day % 3 === 0,
            usedPeek: day % 5 === 0,
          })
        );
    }
    const production = JSON.parse(
      execFileSync(process.execPath, ["-e", script], {
        cwd: labRoot,
        input: JSON.stringify(snapshot),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_PATH: fileURLToPath(new URL("../node_modules", import.meta.url)),
        },
      })
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(prepare(snapshot).fsrsStates)),
      production
    );
  });
