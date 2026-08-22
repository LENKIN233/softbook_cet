#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  githubApiRequest,
  readVerifiedGitHubApprovalEvent,
  readVerifiedGitHubArtifact,
  readVerifiedGitHubCommitPullRequestAssociation,
  readVerifiedGitHubCurrentRunApproval,
  readVerifiedGitHubPullRequestMerge,
} from './lib/mobile_ux_batch1_github_event_reader.mjs';

const REPOSITORY = 'LENKIN233/softbook_cet';
const OBSERVED_AT = '2026-08-10T00:00:00Z';

function fixtureBodies() {
  return {
    [`/repos/${REPOSITORY}`]: {
      id: 1216764160,
      full_name: REPOSITORY,
    },
    [`/repos/${REPOSITORY}/pulls/484`]: {
      number: 484,
      base: {
        ref: 'main',
        sha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
        repo: {id: 1216764160},
      },
      head: {
        ref: 'cross/mobile-ux-architecture-v5',
        sha: '641d33c7ccb320f2e410718129e895993ce425ad',
        repo: {id: 1216764160},
      },
    },
    [`/repos/${REPOSITORY}/actions/runs/31326457854`]: {
      id: 31326457854,
      run_attempt: 1,
      workflow_id: 315520763,
      event: 'pull_request_target',
      path: '.github/workflows/formal-approval.yml',
      head_branch: 'cross/mobile-ux-architecture-v5',
      head_sha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      head_repository: {id: 1216764160},
      conclusion: 'success',
      repository: {id: 1216764160},
      pull_requests: [
        {
          number: 484,
          base: {
            ref: 'main',
            sha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
            repo: {id: 1216764160},
          },
          head: {
            ref: 'cross/mobile-ux-architecture-v5',
            sha: '641d33c7ccb320f2e410718129e895993ce425ad',
            repo: {id: 1216764160},
          },
        },
      ],
    },
    [`/repos/${REPOSITORY}/actions/workflows/315520763`]: {
      id: 315520763,
      path: '.github/workflows/formal-approval.yml',
      state: 'active',
    },
    [`/repos/${REPOSITORY}/deployments/5821110397`]: {
      id: 5821110397,
      sha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      environment: 'formal-product-owner-approval',
    },
    [`/repos/${REPOSITORY}/deployments/5821110397/statuses?per_page=100`]: [
      {
        id: 16583562263,
        state: 'inactive',
        created_at: '2026-08-09T19:18:53Z',
        environment: 'formal-product-owner-approval',
      },
      {
        id: 16581211785,
        state: 'success',
        created_at: '2026-08-09T17:30:24Z',
        environment: 'formal-product-owner-approval',
      },
      {
        id: 16581211015,
        state: 'in_progress',
        created_at: '2026-08-09T17:30:22Z',
        environment: 'formal-product-owner-approval',
      },
      {
        id: 16581209993,
        state: 'queued',
        created_at: '2026-08-09T17:30:20Z',
        environment: 'formal-product-owner-approval',
      },
      {
        id: 16581160470,
        state: 'waiting',
        created_at: '2026-08-09T17:28:06Z',
        environment: 'formal-product-owner-approval',
      },
    ],
    [`/repos/${REPOSITORY}/environments/formal-product-owner-approval`]: {
      id: 18348068326,
      name: 'formal-product-owner-approval',
      can_admins_bypass: false,
      protection_rules: [
        {
          type: 'required_reviewers',
          reviewers: [{type: 'User', reviewer: {id: 113219944, login: 'LENKIN233'}}],
        },
      ],
    },
    [`/repos/${REPOSITORY}/actions/runs/31326457854/approvals`]: [
      {
        state: 'approved',
        comment: 'approve generic_sensitive PR #484 head 8f4f82b35b660d9a775d6551e530fe6703c3ac54',
        environments: [{id: 18348068326, name: 'formal-product-owner-approval'}],
        user: {id: 113219944, login: 'LENKIN233'},
      },
    ],
  };
}

function fixtureApi(mutator = null) {
  const bodies = fixtureBodies();
  if (mutator) mutator(bodies);
  return async (relativePath) => {
    if (!Object.hasOwn(bodies, relativePath)) throw new Error(`unexpected fixture path ${relativePath}`);
    return {body: structuredClone(bodies[relativePath]), observedAt: OBSERVED_AT};
  };
}

function currentRunApi(mutator = null) {
  const bodies = fixtureBodies();
  const headSha = bodies[`/repos/${REPOSITORY}/actions/runs/31326457854`].head_sha;
  bodies[`/repos/${REPOSITORY}/pulls/484`].head.sha = headSha;
  bodies[`/repos/${REPOSITORY}/actions/runs/31326457854`].pull_requests[0].head.sha = headSha;
  if (mutator) mutator(bodies);
  return async (relativePath) => {
    if (!Object.hasOwn(bodies, relativePath)) throw new Error(`unexpected fixture path ${relativePath}`);
    return {body: structuredClone(bodies[relativePath]), observedAt: OBSERVED_AT};
  };
}

function mergedDeletedBranchApi(mutator = null, observedAtByPath = {}) {
  const bodies = fixtureBodies();
  const pullPath = `/repos/${REPOSITORY}/pulls/484`;
  const runPath = `/repos/${REPOSITORY}/actions/runs/31326457854`;
  const pullRequest = bodies[pullPath];
  const workflowRun = bodies[runPath];
  pullRequest.state = 'closed';
  pullRequest.merged = true;
  pullRequest.merged_at = '2026-08-09T20:10:00Z';
  pullRequest.merge_commit_sha = 'b423d8ffb9271f0618229605797e708919eebdea';
  pullRequest.head.sha = workflowRun.head_sha;
  workflowRun.pull_requests = [];
  const associationPath =
    `/repos/${REPOSITORY}/commits/${workflowRun.head_sha}/pulls?per_page=100`;
  const headAssociation = structuredClone(pullRequest);
  delete headAssociation.merged;
  bodies[associationPath] = [headAssociation];
  if (mutator) mutator(bodies, {pullPath, runPath, associationPath});
  return async (relativePath) => {
    if (!Object.hasOwn(bodies, relativePath)) throw new Error(`unexpected fixture path ${relativePath}`);
    return {
      body: structuredClone(bodies[relativePath]),
      observedAt: observedAtByPath[relativePath] ?? OBSERVED_AT,
    };
  };
}

test('historical approval remains verifiable after the live pull-request head advances', async () => {
  const result = await readVerifiedGitHubApprovalEvent({
    pullRequestNumber: 484,
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    deploymentId: 5821110397,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    api: fixtureApi(),
  });

  assert.equal(result.event.approval_target_head_sha, '8f4f82b35b660d9a775d6551e530fe6703c3ac54');
  assert.equal(result.event.deployment_waiting_status_id, 16581160470);
  assert.equal(result.event.deployment_success_status_id, 16581211785);
  assert.equal(result.event.validity_anchor_at, '2026-08-09T17:28:06Z');
  assert.deepEqual(result.observation.later_inactive_status_ids, [16583562263]);
  assert.equal(result.provider_observed_at, OBSERVED_AT);
  assert.match(result.authority_event_sha256, /^[0-9a-f]{64}$/);
});

test('historical approval remains verifiable after merge auto-deletes the head branch', async () => {
  const associationPath =
    `/repos/${REPOSITORY}/commits/8f4f82b35b660d9a775d6551e530fe6703c3ac54/pulls?per_page=100`;
  const associationObservedAt = '2026-08-10T00:00:02Z';
  const result = await readVerifiedGitHubApprovalEvent({
    pullRequestNumber: 484,
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    deploymentId: 5821110397,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    api: mergedDeletedBranchApi(null, {[associationPath]: associationObservedAt}),
  });

  assert.equal(result.event.pull_request_number, 484);
  assert.equal(result.event.pull_request_base_sha, '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47');
  assert.equal(result.event.approval_target_head_sha, '8f4f82b35b660d9a775d6551e530fe6703c3ac54');
  assert.equal(result.provider_observed_at, associationObservedAt);

  const inlineResult = await readVerifiedGitHubApprovalEvent({
    pullRequestNumber: 484,
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    deploymentId: 5821110397,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    api: mergedDeletedBranchApi((bodies, {runPath, associationPath: path}) => {
      bodies[runPath].pull_requests = [structuredClone(bodies[path][0])];
    }),
  });
  assert.deepEqual(result.event, inlineResult.event);
  assert.equal(result.authority_event_sha256, inlineResult.authority_event_sha256);
});

test('historical approval binds caller-provided base and approved head before fallback', async (t) => {
  const options = {
    pullRequestNumber: 484,
    pullRequestBaseSha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    deploymentId: 5821110397,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
  };
  await t.test('base SHA mismatch', async () => {
    await assert.rejects(
      readVerifiedGitHubApprovalEvent({
        ...options,
        pullRequestBaseSha: 'a'.repeat(40),
        api: mergedDeletedBranchApi(),
      }),
      /expected approval subject identity mismatch/,
    );
  });
  await t.test('approved head mismatch', async () => {
    await assert.rejects(
      readVerifiedGitHubApprovalEvent({
        ...options,
        approvalTargetHeadSha: 'a'.repeat(40),
        api: mergedDeletedBranchApi(),
      }),
      /expected approval subject identity mismatch/,
    );
  });
});

test('historical empty-association fallback rejects ambiguous or mismatched merge lineage', async (t) => {
  const options = {
    pullRequestNumber: 484,
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    deploymentId: 5821110397,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
  };
  const cases = [
    ['missing workflow association array', (bodies, {runPath}) => {
      delete bodies[runPath].pull_requests;
    }],
    ['open pull request', (bodies, {pullPath}) => {
      bodies[pullPath].state = 'open';
      bodies[pullPath].merged = false;
    }],
    ['invalid merged timestamp', (bodies, {pullPath}) => {
      bodies[pullPath].merged_at = '2026-02-30T00:10:00Z';
    }],
    ['future merged timestamp', (bodies, {pullPath}) => {
      bodies[pullPath].merged_at = '2026-08-10T00:00:01Z';
    }],
    ['malformed direct merge commit', (bodies, {pullPath}) => {
      bodies[pullPath].merge_commit_sha = 'not-a-commit';
    }],
    ['zero head associations', (bodies, {associationPath}) => {
      bodies[associationPath] = [];
    }],
    ['multiple head associations', (bodies, {associationPath}) => {
      bodies[associationPath].push(structuredClone(bodies[associationPath][0]));
    }],
    ['wrong pull request number', (bodies, {associationPath}) => {
      bodies[associationPath][0].number = 999;
    }],
    ['fork head repository', (bodies, {associationPath}) => {
      bodies[associationPath][0].head.repo.id = 42;
    }],
    ['fork base repository', (bodies, {associationPath}) => {
      bodies[associationPath][0].base.repo.id = 42;
    }],
    ['association is not closed', (bodies, {associationPath}) => {
      bodies[associationPath][0].state = 'open';
    }],
    ['association merged timestamp drift', (bodies, {associationPath}) => {
      bodies[associationPath][0].merged_at = '2026-08-09T20:11:00Z';
    }],
    ['wrong base ref', (bodies, {associationPath}) => {
      bodies[associationPath][0].base.ref = 'release';
    }],
    ['wrong base SHA', (bodies, {associationPath}) => {
      bodies[associationPath][0].base.sha = 'a'.repeat(40);
    }],
    ['wrong head ref', (bodies, {associationPath}) => {
      bodies[associationPath][0].head.ref = 'other-head';
    }],
    ['wrong head SHA', (bodies, {associationPath}) => {
      bodies[associationPath][0].head.sha = 'a'.repeat(40);
    }],
    ['wrong merge commit', (bodies, {associationPath}) => {
      bodies[associationPath][0].merge_commit_sha = 'a'.repeat(40);
    }],
    ['workflow head branch drift', (bodies, {runPath}) => {
      bodies[runPath].head_branch = 'other-head';
    }],
    ['workflow head repository drift', (bodies, {runPath}) => {
      bodies[runPath].head_repository.id = 42;
    }],
    ['pull request final head drift', (bodies, {pullPath}) => {
      bodies[pullPath].head.sha = 'a'.repeat(40);
    }],
  ];
  for (const [label, mutate] of cases) {
    await t.test(label, async () => {
      await assert.rejects(
        readVerifiedGitHubApprovalEvent({...options, api: mergedDeletedBranchApi(mutate)}),
        /associat|merged final-head pull request|merged historical/,
      );
    });
  }
});

test('approval review rejection fails closed', async () => {
  const api = fixtureApi((bodies) => {
    bodies[`/repos/${REPOSITORY}/actions/runs/31326457854/approvals`][0].state = 'rejected';
  });
  await assert.rejects(
    readVerifiedGitHubApprovalEvent({
      pullRequestNumber: 484,
      approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      workflowRunId: 31326457854,
      deploymentId: 5821110397,
      origin: 'git@github.com:LENKIN233/softbook_cet.git',
      api,
    }),
    /revoked or rejected/,
  );
});

test('historical approval rejects a whitespace-only scope comment', async () => {
  const api = fixtureApi((bodies) => {
    bodies[`/repos/${REPOSITORY}/actions/runs/31326457854/approvals`][0].comment = ' \t\n ';
  });
  await assert.rejects(
    readVerifiedGitHubApprovalEvent({
      pullRequestNumber: 484,
      approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      workflowRunId: 31326457854,
      deploymentId: 5821110397,
      origin: 'https://github.com/LENKIN233/softbook_cet.git',
      api,
    }),
    /non-whitespace scope text/,
  );
});

test('historical approval rejects noncanonical injected provider observation time', async (t) => {
  for (const invalidObservedAt of [
    '2026-02-30T00:00:00Z',
    '2026-08-10T00:00:00.001Z',
  ]) {
    await t.test(invalidObservedAt, async () => {
      const baseApi = fixtureApi();
      const api = async (relativePath) => {
        const response = await baseApi(relativePath);
        return {...response, observedAt: invalidObservedAt};
      };
      await assert.rejects(
        readVerifiedGitHubApprovalEvent({
          pullRequestNumber: 484,
          approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
          workflowRunId: 31326457854,
          deploymentId: 5821110397,
          origin: 'https://github.com/LENKIN233/softbook_cet.git',
          api,
        }),
        /not canonical UTC second precision/,
      );
    });
  }
});

test('current-run protected approval binds exact PR, run attempt, environment, and reviewer', async () => {
  const result = await readVerifiedGitHubCurrentRunApproval({
    pullRequestNumber: 484,
    pullRequestBaseSha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    workflowRunAttempt: 1,
    decisionClass: 'generic_sensitive',
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    api: currentRunApi(),
  });
  assert.equal(result.workflow_run_id, 31326457854);
  assert.equal(result.run_attempt, 1);
  assert.equal(result.approval_target_head_sha, '8f4f82b35b660d9a775d6551e530fe6703c3ac54');
  assert.match(result.approval_review_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.provider_observed_at, OBSERVED_AT);
});

test('current-run protected approval fails closed on run or subject mismatch', async (t) => {
  const options = {
    pullRequestNumber: 484,
    pullRequestBaseSha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    workflowRunAttempt: 1,
    decisionClass: 'generic_sensitive',
    origin: 'git@github.com:LENKIN233/softbook_cet.git',
  };
  await t.test('run attempt mismatch', async () => {
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, workflowRunAttempt: 2, api: currentRunApi()}),
      /run.*attempt|workflow id, attempt/i,
    );
  });
  await t.test('attempt 2 cannot reuse the attempt 1 approved review', async () => {
    const api = currentRunApi((bodies) => {
      bodies[`/repos/${REPOSITORY}/actions/runs/31326457854`].run_attempt = 2;
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, workflowRunAttempt: 2, api}),
      /supports only workflow run attempt 1/,
    );
  });
  await t.test('live pull-request head mismatch', async () => {
    const api = currentRunApi((bodies) => {
      bodies[`/repos/${REPOSITORY}/pulls/484`].head.sha =
        '641d33c7ccb320f2e410718129e895993ce425ad';
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /exact same-repository main subject/,
    );
  });
  await t.test('workflow association head mismatch', async () => {
    const api = currentRunApi((bodies) => {
      bodies[`/repos/${REPOSITORY}/actions/runs/31326457854`].pull_requests[0].head.sha =
        '641d33c7ccb320f2e410718129e895993ce425ad';
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /canonical pull-request association|workflow id, attempt, event, path, repository, or PR association mismatch/,
    );
  });
  await t.test('an extra unrelated workflow association is rejected', async () => {
    const api = currentRunApi((bodies) => {
      bodies[`/repos/${REPOSITORY}/actions/runs/31326457854`].pull_requests.push({
        number: 999,
        base: {ref: 'main', sha: '1'.repeat(40), repo: {id: 1216764160}},
        head: {sha: '2'.repeat(40), repo: {id: 1216764160}},
      });
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /exactly one canonical pull-request association/,
    );
  });
  await t.test('an empty workflow association never falls back during current-run approval', async () => {
    const api = currentRunApi((bodies) => {
      bodies[`/repos/${REPOSITORY}/actions/runs/31326457854`].pull_requests = [];
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /exactly one canonical pull-request association/,
    );
  });
});

test('current-run protected approval fails closed on environment or approval-selection drift', async (t) => {
  const options = {
    pullRequestNumber: 484,
    pullRequestBaseSha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
    approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    workflowRunId: 31326457854,
    workflowRunAttempt: 1,
    decisionClass: 'generic_sensitive',
    origin: 'https://github.com/LENKIN233/softbook_cet',
  };
  const approvalPath = `/repos/${REPOSITORY}/actions/runs/31326457854/approvals`;
  await t.test('required reviewer set mismatch', async () => {
    const api = currentRunApi((bodies) => {
      bodies[`/repos/${REPOSITORY}/environments/formal-product-owner-approval`]
        .protection_rules[0].reviewers[0].reviewer.id = 7;
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /reviewer set mismatch/,
    );
  });
  await t.test('review environment mismatch leaves zero matching approvals', async () => {
    const api = currentRunApi((bodies) => {
      bodies[approvalPath][0].environments[0].id = 42;
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /exactly one approved required review/,
    );
  });
  await t.test('reviewer mismatch leaves zero matching approvals', async () => {
    const api = currentRunApi((bodies) => {
      bodies[approvalPath][0].user.id = 42;
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /exactly one approved required review/,
    );
  });
  await t.test('multiple exact approvals are rejected', async () => {
    const api = currentRunApi((bodies) => {
      bodies[approvalPath].push(structuredClone(bodies[approvalPath][0]));
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /exactly one approved required review/,
    );
  });
  await t.test('whitespace-only scope comment is rejected', async () => {
    const api = currentRunApi((bodies) => {
      bodies[approvalPath][0].comment = '\n\t ';
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /non-whitespace scope text/,
    );
  });
  for (const [label, comment] of [
    ['wrong decision class', 'approve batch1_subject_change PR #484 head 8f4f82b35b660d9a775d6551e530fe6703c3ac54'],
    ['wrong pull request', 'approve generic_sensitive PR #485 head 8f4f82b35b660d9a775d6551e530fe6703c3ac54'],
    ['wrong head', `approve generic_sensitive PR #484 head ${'a'.repeat(40)}`],
    ['extra whitespace', 'approve  generic_sensitive PR #484 head 8f4f82b35b660d9a775d6551e530fe6703c3ac54'],
  ]) {
    await t.test(`canonical subject scope rejects ${label}`, async () => {
      const api = currentRunApi((bodies) => {
        bodies[approvalPath][0].comment = comment;
      });
      await assert.rejects(
        readVerifiedGitHubCurrentRunApproval({...options, api}),
        /canonical decision subject scope/,
      );
    });
  }
  await t.test('matching rejection invalidates an approval', async () => {
    const api = currentRunApi((bodies) => {
      const rejected = structuredClone(bodies[approvalPath][0]);
      rejected.state = 'rejected';
      bodies[approvalPath].push(rejected);
    });
    await assert.rejects(
      readVerifiedGitHubCurrentRunApproval({...options, api}),
      /rejected or revoked/,
    );
  });
});

test('current-run approval rejects non-canonical provider observation time', async () => {
  const api = async (relativePath) => {
    const response = await currentRunApi()(relativePath);
    return {...response, observedAt: '2026-08-10T00:00:00.000Z'};
  };
  await assert.rejects(
    readVerifiedGitHubCurrentRunApproval({
      pullRequestNumber: 484,
      pullRequestBaseSha: '7960ebd29d0eec4a5139a38c7e5eb8bde00d6e47',
      approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      workflowRunId: 31326457854,
      workflowRunAttempt: 1,
      decisionClass: 'generic_sensitive',
      origin: 'https://github.com/LENKIN233/softbook_cet.git',
      api,
    }),
    /canonical UTC second precision/,
  );
});

test('missing exact waiting status and environment bypass drift fail closed', async () => {
  const missingWaiting = fixtureApi((bodies) => {
    const path = `/repos/${REPOSITORY}/deployments/5821110397/statuses?per_page=100`;
    bodies[path] = bodies[path].filter((status) => status.state !== 'waiting');
  });
  await assert.rejects(
    readVerifiedGitHubApprovalEvent({
      pullRequestNumber: 484,
      approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      workflowRunId: 31326457854,
      deploymentId: 5821110397,
      origin: 'https://github.com/LENKIN233/softbook_cet',
      api: missingWaiting,
    }),
    /exactly one waiting and one success/,
  );

  const bypassEnabled = fixtureApi((bodies) => {
    bodies[`/repos/${REPOSITORY}/environments/formal-product-owner-approval`].can_admins_bypass = true;
  });
  await assert.rejects(
    readVerifiedGitHubApprovalEvent({
      pullRequestNumber: 484,
      approvalTargetHeadSha: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
      workflowRunId: 31326457854,
      deploymentId: 5821110397,
      origin: 'https://github.com/LENKIN233/softbook_cet',
      api: bypassEnabled,
    }),
    /bypass policy mismatch/,
  );
});

test('GitHub HTTP reader rejects pagination and missing provider time', async () => {
  const makeResponse = ({date = 'Mon, 10 Aug 2026 00:00:00 GMT', link = ''} = {}) => ({
    ok: true,
    status: 200,
    headers: new Headers({date, link, 'content-length': '2'}),
    text: async () => '{}',
  });
  await assert.rejects(
    githubApiRequest('/repos/LENKIN233/softbook_cet', {
      token: 'fixture',
      fetchImpl: async () => makeResponse({link: '<https://api.github.test/page=2>; rel="next"'}),
    }),
    /paginated or truncated/,
  );
  await assert.rejects(
    githubApiRequest('/repos/LENKIN233/softbook_cet', {
      token: 'fixture',
      fetchImpl: async () => makeResponse({date: ''}),
    }),
    /lacks a trusted Date header/,
  );
  await assert.rejects(
    githubApiRequest('/repos/LENKIN233/softbook_cet', {
      token: 'fixture',
      fetchImpl: async () => makeResponse({date: 'Mon, 10 Aug 2026 00:00:00 +0000'}),
    }),
    /canonical IMF-fixdate/,
  );
});

test('remote Git artifact reader binds commit, complete tree, mode, size, and bytes', async () => {
  const commitSha = '8f4f82b35b660d9a775d6551e530fe6703c3ac54';
  const treeSha = '1111111111111111111111111111111111111111';
  const blobSha = '2222222222222222222222222222222222222222';
  const artifactPath = 'docs/design/example.json';
  const bytes = Buffer.from('{"exact":true}\n', 'utf8');
  const bodies = {
    [`/repos/${REPOSITORY}/git/commits/${commitSha}`]: {
      sha: commitSha,
      tree: {sha: treeSha},
    },
    [`/repos/${REPOSITORY}/git/trees/${treeSha}?recursive=1`]: {
      sha: treeSha,
      truncated: false,
      tree: [{path: artifactPath, mode: '100644', type: 'blob', sha: blobSha, size: bytes.length}],
    },
    [`/repos/${REPOSITORY}/git/blobs/${blobSha}`]: {
      sha: blobSha,
      size: bytes.length,
      encoding: 'base64',
      content: bytes.toString('base64'),
    },
  };
  const api = async (relativePath) => ({body: structuredClone(bodies[relativePath]), observedAt: OBSERVED_AT});
  const result = await readVerifiedGitHubArtifact({commitSha, artifactPath, api});
  assert.equal(result.record.git_mode, '100644');
  assert.equal(result.record.byte_length, bytes.length);
  assert.deepEqual(result.bytes, bytes);

  bodies[`/repos/${REPOSITORY}/git/trees/${treeSha}?recursive=1`].truncated = true;
  await assert.rejects(
    readVerifiedGitHubArtifact({commitSha, artifactPath, api}),
    /truncated/,
  );
});

function squashMergeApi(mutator = null) {
  const approvedHeadSha = 'e7b1b16211111111111111111111111111111111';
  const mergeCommitSha = '011547bb22222222222222222222222222222222';
  const baseSha = '5555555555555555555555555555555555555555';
  const treeSha = '799613e033333333333333333333333333333333';
  const tree = {
    sha: treeSha,
    truncated: false,
    tree: [
      {
        path: 'docs/design/decision.json',
        mode: '100644',
        type: 'blob',
        sha: '4444444444444444444444444444444444444444',
        size: 42,
      },
    ],
  };
  const bodies = {
    [`/repos/${REPOSITORY}`]: {id: 1216764160, full_name: REPOSITORY},
    [`/repos/${REPOSITORY}/pulls/478`]: {
      number: 478,
      state: 'closed',
      merged: true,
      merged_at: '2026-08-09T12:00:00Z',
      merge_commit_sha: mergeCommitSha,
      base: {
        ref: 'main',
        sha: baseSha,
        repo: {id: 1216764160},
      },
      head: {sha: approvedHeadSha, repo: {id: 1216764160}},
    },
    [`/repos/${REPOSITORY}/git/commits/${approvedHeadSha}`]: {
      sha: approvedHeadSha,
      tree: {sha: treeSha},
    },
    [`/repos/${REPOSITORY}/git/commits/${mergeCommitSha}`]: {
      sha: mergeCommitSha,
      tree: {sha: treeSha},
      parents: [{sha: baseSha}],
    },
    [`/repos/${REPOSITORY}/git/trees/${treeSha}?recursive=1`]: tree,
  };
  if (mutator) {
    mutator({bodies, approvedHeadSha, mergeCommitSha, baseSha, treeSha});
  }
  return {
    approvedHeadSha,
    mergeCommitSha,
    bodies,
    api: async (relativePath) => {
      if (!Object.hasOwn(bodies, relativePath)) throw new Error(`unexpected fixture path ${relativePath}`);
      return {body: structuredClone(bodies[relativePath]), observedAt: OBSERVED_AT};
    },
  };
}

test('pull-request merge reader accepts a real squash shape only when complete trees are equal', async () => {
  const fixture = squashMergeApi();
  const result = await readVerifiedGitHubPullRequestMerge({
    pullRequestNumber: 478,
    approvalTargetHeadSha: fixture.approvedHeadSha,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    api: fixture.api,
  });
  assert.equal(result.merge_commit_sha, fixture.mergeCommitSha);
  assert.notEqual(result.merge_commit_sha, result.approval_target_head_sha);
  assert.equal(result.complete_tree_sha, '799613e033333333333333333333333333333333');
});

test('pull-request merge reader rejects head, tree, timestamp, and one-parent squash-shape drift', async (t) => {
  await t.test('final head drift', async () => {
    const fixture = squashMergeApi(({bodies}) => {
      bodies[`/repos/${REPOSITORY}/pulls/478`].head.sha = '6666666666666666666666666666666666666666';
    });
    await assert.rejects(
      readVerifiedGitHubPullRequestMerge({
        pullRequestNumber: 478,
        approvalTargetHeadSha: fixture.approvedHeadSha,
        origin: 'git@github.com:LENKIN233/softbook_cet.git',
        api: fixture.api,
      }),
      /final head drifted/,
    );
  });

  await t.test('truncated tree', async () => {
    const fixture = squashMergeApi(({bodies, treeSha}) => {
      bodies[`/repos/${REPOSITORY}/git/trees/${treeSha}?recursive=1`].truncated = true;
    });
    await assert.rejects(
      readVerifiedGitHubPullRequestMerge({
        pullRequestNumber: 478,
        approvalTargetHeadSha: fixture.approvedHeadSha,
        origin: 'https://github.com/LENKIN233/softbook_cet',
        api: fixture.api,
      }),
      /truncated/,
    );
  });

  await t.test('unequal complete tree', async () => {
    const fixture = squashMergeApi(({bodies, mergeCommitSha}) => {
      const otherTreeSha = '7777777777777777777777777777777777777777';
      bodies[`/repos/${REPOSITORY}/git/commits/${mergeCommitSha}`].tree.sha = otherTreeSha;
      bodies[`/repos/${REPOSITORY}/git/trees/${otherTreeSha}?recursive=1`] = {
        sha: otherTreeSha,
        truncated: false,
        tree: [{
          path: 'docs/design/decision.json',
          mode: '100644',
          type: 'blob',
          sha: '8888888888888888888888888888888888888888',
          size: 43,
        }],
      };
    });
    await assert.rejects(
      readVerifiedGitHubPullRequestMerge({
        pullRequestNumber: 478,
        approvalTargetHeadSha: fixture.approvedHeadSha,
        origin: 'https://github.com/LENKIN233/softbook_cet',
        api: fixture.api,
      }),
      /not exactly equivalent/,
    );
  });

  await t.test('nonexistent merged_at calendar date', async () => {
    const fixture = squashMergeApi(({bodies}) => {
      bodies[`/repos/${REPOSITORY}/pulls/478`].merged_at = '2026-02-30T12:00:00Z';
    });
    await assert.rejects(
      readVerifiedGitHubPullRequestMerge({
        pullRequestNumber: 478,
        approvalTargetHeadSha: fixture.approvedHeadSha,
        origin: 'https://github.com/LENKIN233/softbook_cet',
        api: fixture.api,
      }),
      /merged_at is missing or malformed/,
    );
  });

  for (const [label, mutateParents, pattern] of [
    [
      'zero-parent merge commit',
      () => [],
      /must have exactly one parent/,
    ],
    [
      'two-parent merge commit',
      ({baseSha}) => [
        {sha: baseSha},
        {sha: '9999999999999999999999999999999999999999'},
      ],
      /must have exactly one parent/,
    ],
    [
      'wrong single parent',
      () => [{sha: '9999999999999999999999999999999999999999'}],
      /parent must equal the pull-request base SHA/,
    ],
  ]) {
    await t.test(label, async () => {
      const fixture = squashMergeApi(({
        bodies,
        mergeCommitSha,
        baseSha,
      }) => {
        bodies[
          `/repos/${REPOSITORY}/git/commits/${mergeCommitSha}`
        ].parents = mutateParents({baseSha});
      });
      await assert.rejects(
        readVerifiedGitHubPullRequestMerge({
          pullRequestNumber: 478,
          approvalTargetHeadSha: fixture.approvedHeadSha,
          origin: 'https://github.com/LENKIN233/softbook_cet',
          api: fixture.api,
        }),
        pattern,
      );
    });
  }
});

function commitAssociationFixture(mutator = null) {
  const fixture = squashMergeApi();
  const pull = structuredClone(fixture.bodies[`/repos/${REPOSITORY}/pulls/478`]);
  delete pull.merged;
  fixture.bodies[
    `/repos/${REPOSITORY}/commits/${fixture.mergeCommitSha}/pulls?per_page=100`
  ] = [pull];
  if (mutator) mutator({...fixture, pull});
  return fixture;
}

test('commit-associated PR reader binds one canonical merged squash landing', async () => {
  const fixture = commitAssociationFixture();
  const result = await readVerifiedGitHubCommitPullRequestAssociation({
    mergeCommitSha: fixture.mergeCommitSha,
    origin: 'https://github.com/LENKIN233/softbook_cet.git',
    api: fixture.api,
  });
  assert.equal(result.associated_pull_request_count, 1);
  assert.equal(result.pull_request_number, 478);
  assert.equal(result.merge_commit_sha, fixture.mergeCommitSha);
  assert.equal(result.approval_target_head_sha, fixture.approvedHeadSha);
  assert.equal(result.complete_tree_sha, '799613e033333333333333333333333333333333');
});

test('commit-associated PR reader fails closed on ambiguous or noncanonical associations', async (t) => {
  const associationPath = (fixture) =>
    `/repos/${REPOSITORY}/commits/${fixture.mergeCommitSha}/pulls?per_page=100`;
  for (const [name, mutate, pattern] of [
    ['none', ({fixture}) => {
      fixture.bodies[associationPath(fixture)] = [];
    }, /exactly one associated pull request/],
    ['multiple', ({fixture, pull}) => {
      fixture.bodies[associationPath(fixture)] = [pull, {...pull, number: 479}];
    }, /exactly one associated pull request/],
    ['fork head', ({pull}) => {
      pull.head.repo.id = 999;
    }, /canonical merged same-repository main/],
    ['wrong base', ({pull}) => {
      pull.base.ref = 'develop';
    }, /canonical merged same-repository main/],
    ['not merged', ({pull}) => {
      pull.merged = false;
    }, /canonical merged same-repository main/],
    ['wrong merge', ({pull}) => {
      pull.merge_commit_sha = '9'.repeat(40);
    }, /canonical merged same-repository main/],
    ['base SHA drift from direct pull request', ({pull}) => {
      pull.base.sha = '8'.repeat(40);
    }, /does not exactly materialize/],
    ['head SHA drift from direct pull request', ({pull}) => {
      pull.head.sha = '8'.repeat(40);
    }, /final head drifted/],
    ['merged timestamp drift from direct pull request', ({pull}) => {
      pull.merged_at = '2026-08-09T12:00:01Z';
    }, /does not exactly materialize/],
  ]) {
    await t.test(name, async () => {
      const fixture = commitAssociationFixture(({bodies, ...rest}) => {
        const pull = bodies[associationPath({mergeCommitSha: rest.mergeCommitSha})][0];
        mutate({fixture: {bodies, ...rest}, pull});
      });
      await assert.rejects(
        readVerifiedGitHubCommitPullRequestAssociation({
          mergeCommitSha: fixture.mergeCommitSha,
          origin: 'https://github.com/LENKIN233/softbook_cet.git',
          api: fixture.api,
        }),
        pattern,
      );
    });
  }

  await t.test('malformed wrapper observation', async () => {
    const fixture = commitAssociationFixture();
    const path = associationPath(fixture);
    const api = async (relativePath) => {
      if (relativePath === path) {
        return {body: fixture.bodies[path], observedAt: 'not-a-time'};
      }
      return fixture.api(relativePath);
    };
    await assert.rejects(
      readVerifiedGitHubCommitPullRequestAssociation({
        mergeCommitSha: fixture.mergeCommitSha,
        origin: 'https://github.com/LENKIN233/softbook_cet.git',
        api,
      }),
      /not canonical UTC second precision/,
    );
  });

  await t.test('nonexistent provider calendar date', async () => {
    const fixture = commitAssociationFixture();
    const path = associationPath(fixture);
    const api = async (relativePath) => {
      if (relativePath === path) {
        return {body: fixture.bodies[path], observedAt: '2026-02-30T00:00:00Z'};
      }
      return fixture.api(relativePath);
    };
    await assert.rejects(
      readVerifiedGitHubCommitPullRequestAssociation({
        mergeCommitSha: fixture.mergeCommitSha,
        origin: 'https://github.com/LENKIN233/softbook_cet.git',
        api,
      }),
      /not canonical UTC second precision/,
    );
  });
});
