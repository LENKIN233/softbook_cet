import assert from 'node:assert/strict';
import test from 'node:test';

import {validateModelReviewBody} from './validate_model_review.mjs';

const HEAD = 'a'.repeat(40);

test('exact dual-perturbation review passes', () => {
  assert.deepEqual(validateModelReviewBody(validBody(), HEAD), []);
});

test('missing, stale-head, duplicate-run and blocking reviews fail closed', () => {
  assert.match(validateModelReviewBody('', HEAD).join(';'), /missing/);
  assert.match(
    validateModelReviewBody(validBody().replace(HEAD, 'b'.repeat(40)), HEAD).join(';'),
    /head_sha/,
  );
  assert.match(
    validateModelReviewBody(
      validBody().replace(
        '11919e16-3d6f-43ab-a532-705dc0403fa7',
        'e01514e3-4900-42be-a78e-840aace55825',
      ),
      HEAD,
    ).join(';'),
    /distinct UUID/,
  );
  assert.match(
    validateModelReviewBody(
      validBody().replace('"blocking_findings": []', '"blocking_findings": ["P1"]'),
      HEAD,
    ).join(';'),
    /blocking_findings/,
  );
  assert.match(
    validateModelReviewBody(
      validBody().replace('"runs": [', '"runs": [null,'),
      HEAD,
    ).join(';'),
    /exactly two perturbation runs/,
  );
});

function validBody() {
  return `## Model review

\`\`\`json
{
  "schema_version": "single-task-dual-perturbation-review.v1",
  "head_sha": "${HEAD}",
  "policy": "spec/machine-acceptance.json",
  "runs": [
    {
      "principal": "agent:codex",
      "model": "gpt-5.6-sol",
      "run_id": "e01514e3-4900-42be-a78e-840aace55825",
      "perturbation_id": "assumption_inversion",
      "reviewed_at": "2026-08-30T10:20:10+08:00",
      "capabilities": ["exact_diff_review"],
      "decision": "passed",
      "blocking_findings": []
    },
    {
      "principal": "agent:codex",
      "model": "gpt-5.6-sol",
      "run_id": "11919e16-3d6f-43ab-a532-705dc0403fa7",
      "perturbation_id": "failure_projection",
      "reviewed_at": "2026-08-30T10:20:11+08:00",
      "capabilities": ["exact_diff_review"],
      "decision": "passed",
      "blocking_findings": []
    }
  ],
  "status": "passed",
  "summary": "Exact-diff review passed."
}
\`\`\`
`;
}
