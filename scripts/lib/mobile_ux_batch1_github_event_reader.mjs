import {
  TRUSTED_IDENTITY,
  computeApprovalReviewDigest,
  projectGitHubApprovalEvent,
  sha256Hex,
  validateRepositoryIdentity,
} from './mobile_ux_batch1_governance_contract.mjs';

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const RFC3339_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function fail(message) {
  throw new Error(message);
}

function asPositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) fail(`${label} must be a positive integer`);
  return number;
}

function canonicalProviderDate(value, label) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) fail(`${label} must be a valid provider Date header`);
  if (typeof value !== 'string' || date.toUTCString() !== value) {
    fail(`${label} must be one canonical IMF-fixdate provider Date header`);
  }
  return date.toISOString().replace('.000Z', 'Z');
}

function assertObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function assertCommitSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    fail(`${label} must be a lowercase full Git SHA`);
  }
}

function assertRepositoryPath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    fail(`${label} must be a normalized repository-relative path`);
  }
}

function requireExactAssociation(workflowRun, pullRequest, pullRequestNumber, repositoryId) {
  if (!Array.isArray(workflowRun.pull_requests)) {
    fail('workflow run pull_requests association is missing');
  }
  if (workflowRun.pull_requests.length !== 1) {
    fail('workflow run must contain exactly one canonical pull-request association');
  }
  const association = workflowRun.pull_requests[0];
  if (
    association?.number !== pullRequestNumber ||
    association?.base?.repo?.id !== repositoryId ||
    association?.head?.repo?.id !== repositoryId ||
    association?.base?.ref !== 'main' ||
    association?.base?.ref !== pullRequest.base?.ref ||
    association?.base?.sha !== pullRequest.base?.sha ||
    association?.head?.ref !== pullRequest.head?.ref ||
    association?.head?.sha !== pullRequest.head?.sha
  ) {
    fail('workflow run must contain exactly one canonical pull-request association');
  }
  return association;
}

function requireExactHistoricalHeadAssociation(associations, pullRequest, repositoryId) {
  if (!Array.isArray(associations) || associations.length !== 1) {
    fail('merged approval head must resolve to exactly one associated pull request');
  }
  const association = assertObject(
    associations[0],
    'merged approval head pull-request association',
  );
  if (
    association.number !== pullRequest.number ||
    association.state !== 'closed' ||
    association.merged_at !== pullRequest.merged_at ||
    association.merge_commit_sha !== pullRequest.merge_commit_sha ||
    association.base?.repo?.id !== repositoryId ||
    association.base?.ref !== pullRequest.base?.ref ||
    association.base?.sha !== pullRequest.base?.sha ||
    association.head?.repo?.id !== repositoryId ||
    association.head?.ref !== pullRequest.head?.ref ||
    association.head?.sha !== pullRequest.head?.sha
  ) {
    fail('merged approval head association does not match the exact pull request');
  }
  return association;
}

async function resolveHistoricalPullRequestAssociation({
  workflowRun,
  pullRequest,
  pullRequestNumber,
  repositoryId,
  repository,
  read,
  responses,
}) {
  if (!Array.isArray(workflowRun.pull_requests)) {
    fail('workflow run pull_requests association is missing');
  }
  if (workflowRun.pull_requests.length === 1) {
    return requireExactAssociation(
      workflowRun,
      pullRequest,
      pullRequestNumber,
      repositoryId,
    );
  }
  if (workflowRun.pull_requests.length !== 0) {
    fail('workflow run must contain at most one canonical pull-request association');
  }

  assertCommitSha(workflowRun.head_sha, 'merged historical workflow run head SHA');
  assertCommitSha(pullRequest.head?.sha, 'merged historical pull request head SHA');
  assertCommitSha(pullRequest.merge_commit_sha, 'merged historical pull request merge SHA');
  if (
    pullRequest.state !== 'closed' ||
    pullRequest.merged !== true ||
    typeof pullRequest.merged_at !== 'string' ||
    !RFC3339_SECOND_RE.test(pullRequest.merged_at) ||
    !Number.isFinite(Date.parse(pullRequest.merged_at)) ||
    new Date(pullRequest.merged_at).toISOString().replace('.000Z', 'Z') !==
      pullRequest.merged_at ||
    pullRequest.head.sha !== workflowRun.head_sha ||
    typeof pullRequest.head?.ref !== 'string' ||
    pullRequest.head.ref.length === 0 ||
    pullRequest.head.ref !== workflowRun.head_branch ||
    workflowRun.head_repository?.id !== repositoryId ||
    Date.parse(pullRequest.merged_at) > Date.parse(responses.pullRequest.observedAt)
  ) {
    fail(
      'empty workflow association is valid only for one exact merged final-head pull request',
    );
  }

  const associationPath =
    `/repos/${repository}/commits/${workflowRun.head_sha}/pulls?per_page=100`;
  const associationResponse = await read(associationPath);
  responses.historicalHeadAssociations = associationResponse;
  requireExactHistoricalHeadAssociation(
    associationResponse.body,
    pullRequest,
    repositoryId,
  );
  return {
    number: pullRequest.number,
    base: {
      ref: pullRequest.base.ref,
      sha: pullRequest.base.sha,
      repo: {id: pullRequest.base.repo.id},
    },
    head: {
      ref: pullRequest.head.ref,
      sha: pullRequest.head.sha,
      repo: {id: pullRequest.head.repo.id},
    },
  };
}

function requiredReviewerIds(environment) {
  if (!Array.isArray(environment.protection_rules)) {
    fail('environment protection rules are missing');
  }
  const reviewerRules = environment.protection_rules.filter(
    (rule) => rule?.type === 'required_reviewers',
  );
  if (reviewerRules.length !== 1 || !Array.isArray(reviewerRules[0].reviewers)) {
    fail('environment must expose exactly one required-reviewers rule');
  }
  const ids = reviewerRules[0].reviewers.map((entry) => entry?.reviewer?.id);
  if (ids.some((id) => !Number.isSafeInteger(id))) {
    fail('environment required reviewer identity is malformed');
  }
  return [...ids].sort((left, right) => left - right);
}

function normalizeApprovalReviews(reviews) {
  if (!Array.isArray(reviews)) fail('approval reviews response must be an array');
  return reviews.map((review, index) => {
    assertObject(review, `approval review[${index}]`);
    if (!Array.isArray(review.environments)) {
      fail(`approval review[${index}] environments must be an array`);
    }
    return {
      state: review.state,
      comment: review.comment ?? '',
      environments: review.environments.map((environment) => ({
        id: environment?.id,
        name: environment?.name,
      })),
      user: {
        id: review.user?.id,
        login: review.user?.login,
      },
    };
  });
}

function normalizeDeploymentStatuses(statuses) {
  if (!Array.isArray(statuses)) fail('deployment statuses response must be an array');
  return statuses.map((status, index) => {
    assertObject(status, `deployment status[${index}]`);
    return {
      id: status.id,
      state: status.state,
      created_at: status.created_at,
      environment: status.environment,
    };
  });
}

export async function githubApiRequest(relativePath, {
  token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof token !== 'string' || token.length === 0) fail('GITHUB_TOKEN or GH_TOKEN is required');
  if (typeof fetchImpl !== 'function') fail('a trusted fetch implementation is required');
  if (typeof relativePath !== 'string' || !relativePath.startsWith('/')) {
    fail('GitHub API path must be repository-relative and start with /');
  }
  const response = await fetchImpl(`https://api.github.com${relativePath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'softbook-cet-trusted-governance-validator',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
  });
  const providerDate = response.headers.get('date');
  const link = response.headers.get('link') ?? '';
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (response.status === 404) fail(`GitHub API record is no longer resolvable: ${relativePath}`);
  if (!response.ok) fail(`GitHub API request failed closed (${response.status}): ${relativePath}`);
  if (!providerDate) fail(`GitHub API response lacks a trusted Date header: ${relativePath}`);
  if (link.includes('rel="next"')) fail(`GitHub API response is paginated or truncated: ${relativePath}`);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    fail(`GitHub API response exceeds the trusted size limit: ${relativePath}`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    fail(`GitHub API response exceeds the trusted size limit: ${relativePath}`);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail(`GitHub API response is not valid JSON: ${relativePath}`);
  }
  return {body, observedAt: canonicalProviderDate(providerDate, relativePath)};
}

export async function readVerifiedGitHubApprovalEvent({
  repository = TRUSTED_IDENTITY.repository,
  pullRequestNumber,
  pullRequestBaseSha,
  approvalTargetHeadSha,
  workflowRunId,
  deploymentId,
  origin,
  api = githubApiRequest,
} = {}) {
  if (repository !== TRUSTED_IDENTITY.repository) fail('repository does not match trusted identity');
  const prNumber = asPositiveInteger(pullRequestNumber, 'pullRequestNumber');
  const runId = asPositiveInteger(workflowRunId, 'workflowRunId');
  const deploymentRecordId = asPositiveInteger(deploymentId, 'deploymentId');
  if (pullRequestBaseSha !== undefined) {
    assertCommitSha(pullRequestBaseSha, 'pullRequestBaseSha');
  }
  assertCommitSha(approvalTargetHeadSha, 'approvalTargetHeadSha');
  if (typeof api !== 'function') fail('GitHub API reader must be a function');

  const read = async (relativePath) => {
    const response = await api(relativePath);
    assertObject(response, `GitHub API wrapper response for ${relativePath}`);
    if (!Object.hasOwn(response, 'body') || !Object.hasOwn(response, 'observedAt')) {
      fail(`GitHub API wrapper response is incomplete for ${relativePath}`);
    }
    if (
      !RFC3339_SECOND_RE.test(response.observedAt) ||
      !Number.isFinite(Date.parse(response.observedAt)) ||
      new Date(response.observedAt).toISOString().replace('.000Z', 'Z') !==
        response.observedAt
    ) {
      fail(`GitHub API observedAt is not canonical UTC second precision for ${relativePath}`);
    }
    return response;
  };

  const paths = {
    repository: `/repos/${repository}`,
    pullRequest: `/repos/${repository}/pulls/${prNumber}`,
    workflowRun: `/repos/${repository}/actions/runs/${runId}`,
    workflow: `/repos/${repository}/actions/workflows/${TRUSTED_IDENTITY.workflowId}`,
    deployment: `/repos/${repository}/deployments/${deploymentRecordId}`,
    statuses: `/repos/${repository}/deployments/${deploymentRecordId}/statuses?per_page=100`,
    environment: `/repos/${repository}/environments/${TRUSTED_IDENTITY.environmentName}`,
    approvals: `/repos/${repository}/actions/runs/${runId}/approvals`,
  };
  const responses = Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([name, relativePath]) => [name, await read(relativePath)]),
    ),
  );

  const repositoryRecord = assertObject(responses.repository.body, 'repository record');
  const pullRequest = assertObject(responses.pullRequest.body, 'pull request record');
  const workflowRun = assertObject(responses.workflowRun.body, 'workflow run record');
  const workflow = assertObject(responses.workflow.body, 'workflow metadata');
  const deployment = assertObject(responses.deployment.body, 'deployment record');
  const environment = assertObject(responses.environment.body, 'environment record');

  if (repositoryRecord.id !== TRUSTED_IDENTITY.repositoryId || repositoryRecord.full_name !== repository) {
    fail('remote repository immutable identity mismatch');
  }
  if (
    pullRequest.number !== prNumber ||
    pullRequest.base?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    pullRequest.head?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    pullRequest.base?.ref !== 'main'
  ) {
    fail('remote pull request is not bound to the canonical same-repository main target');
  }
  if (
    workflow.id !== TRUSTED_IDENTITY.workflowId ||
    workflow.path !== TRUSTED_IDENTITY.workflowPath ||
    workflow.state !== 'active'
  ) {
    fail('remote workflow immutable identity or active state mismatch');
  }
  if (
    workflowRun.id !== runId ||
    workflowRun.workflow_id !== TRUSTED_IDENTITY.workflowId ||
    workflowRun.event !== 'pull_request_target' ||
    workflowRun.path !== TRUSTED_IDENTITY.workflowPath ||
    workflowRun.repository?.id !== TRUSTED_IDENTITY.repositoryId ||
    workflowRun.head_sha !== approvalTargetHeadSha ||
    (pullRequestBaseSha !== undefined && pullRequest.base?.sha !== pullRequestBaseSha)
  ) {
    fail('remote workflow run or expected approval subject identity mismatch');
  }
  const association = await resolveHistoricalPullRequestAssociation({
    workflowRun,
    pullRequest,
    pullRequestNumber: prNumber,
    repositoryId: TRUSTED_IDENTITY.repositoryId,
    repository,
    read,
    responses,
  });
  if (
    deployment.id !== deploymentRecordId ||
    deployment.sha !== workflowRun.head_sha ||
    deployment.environment !== TRUSTED_IDENTITY.environmentName
  ) {
    fail('remote deployment is not bound to the exact workflow approval target');
  }
  if (
    environment.id !== TRUSTED_IDENTITY.environmentId ||
    environment.name !== TRUSTED_IDENTITY.environmentName ||
    environment.can_admins_bypass !== false
  ) {
    fail('remote protected environment identity or bypass policy mismatch');
  }
  const reviewerIds = requiredReviewerIds(environment);
  if (
    reviewerIds.length !== 1 ||
    reviewerIds[0] !== TRUSTED_IDENTITY.reviewerDatabaseId
  ) {
    fail('remote protected environment reviewer set mismatch');
  }

  const evidence = {
    origin,
    repository: {
      id: repositoryRecord.id,
      full_name: repositoryRecord.full_name,
    },
    pull_request: {
      number: prNumber,
      base_ref: `refs/heads/${association.base.ref}`,
      base_sha: association.base.sha,
      base_repository_id: association.base.repo.id,
      head_repository_id: association.head.repo.id,
    },
    workflow_run: {
      id: workflowRun.id,
      run_attempt: workflowRun.run_attempt,
      workflow_id: workflowRun.workflow_id,
      event: workflowRun.event,
      path: workflowRun.path,
      head_sha: workflowRun.head_sha,
      conclusion: workflowRun.conclusion,
      repository_id: workflowRun.repository.id,
    },
    deployment: {
      id: deployment.id,
      sha: deployment.sha,
      environment_id: environment.id,
      environment_name: deployment.environment,
    },
    environment: {
      id: environment.id,
      name: environment.name,
      can_admins_bypass: environment.can_admins_bypass,
      required_reviewer_ids: reviewerIds,
    },
    approval_reviews: normalizeApprovalReviews(responses.approvals.body),
    deployment_statuses: normalizeDeploymentStatuses(responses.statuses.body),
  };
  const projection = projectGitHubApprovalEvent(evidence);
  const observedAt = Object.values(responses)
    .map((response) => response.observedAt)
    .sort()
    .at(-1);
  return Object.freeze({
    ...projection,
    provider_observed_at: observedAt,
    evidence,
  });
}

export async function readVerifiedGitHubCurrentRunApproval({
  repository = TRUSTED_IDENTITY.repository,
  pullRequestNumber,
  pullRequestBaseSha,
  approvalTargetHeadSha,
  workflowRunId,
  workflowRunAttempt,
  decisionClass,
  origin,
  api = githubApiRequest,
} = {}) {
  if (repository !== TRUSTED_IDENTITY.repository) fail('repository does not match trusted identity');
  validateRepositoryIdentity({
    repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    origin,
  });
  const prNumber = asPositiveInteger(pullRequestNumber, 'pullRequestNumber');
  const runId = asPositiveInteger(workflowRunId, 'workflowRunId');
  const runAttempt = asPositiveInteger(workflowRunAttempt, 'workflowRunAttempt');
  if (runAttempt !== 1) {
    fail('current-run approval v1 supports only workflow run attempt 1');
  }
  if (typeof decisionClass !== 'string' || !/^[a-z][a-z0-9_]*$/.test(decisionClass)) {
    fail('current-run approval decisionClass must be a canonical lowercase identifier');
  }
  assertCommitSha(pullRequestBaseSha, 'pullRequestBaseSha');
  assertCommitSha(approvalTargetHeadSha, 'approvalTargetHeadSha');
  if (typeof api !== 'function') fail('GitHub API reader must be a function');

  const read = async (relativePath) => {
    const response = await api(relativePath);
    assertObject(response, `GitHub API wrapper response for ${relativePath}`);
    if (!Object.hasOwn(response, 'body') || !Object.hasOwn(response, 'observedAt')) {
      fail(`GitHub API wrapper response is incomplete for ${relativePath}`);
    }
    if (
      !RFC3339_SECOND_RE.test(response.observedAt) ||
      !Number.isFinite(Date.parse(response.observedAt)) ||
      new Date(response.observedAt).toISOString().replace('.000Z', 'Z') !== response.observedAt
    ) {
      fail(`GitHub API observedAt is not canonical UTC second precision for ${relativePath}`);
    }
    return response;
  };

  const paths = {
    repository: `/repos/${repository}`,
    pullRequest: `/repos/${repository}/pulls/${prNumber}`,
    workflowRun: `/repos/${repository}/actions/runs/${runId}`,
    workflow: `/repos/${repository}/actions/workflows/${TRUSTED_IDENTITY.workflowId}`,
    environment: `/repos/${repository}/environments/${TRUSTED_IDENTITY.environmentName}`,
    approvals: `/repos/${repository}/actions/runs/${runId}/approvals`,
  };
  const responses = Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([name, relativePath]) => [name, await read(relativePath)]),
    ),
  );
  const repositoryRecord = assertObject(responses.repository.body, 'current-run repository record');
  const pullRequest = assertObject(responses.pullRequest.body, 'current-run pull request record');
  const workflowRun = assertObject(responses.workflowRun.body, 'current-run workflow record');
  const workflow = assertObject(responses.workflow.body, 'current-run workflow metadata');
  const environment = assertObject(responses.environment.body, 'current-run environment record');

  if (
    repositoryRecord.id !== TRUSTED_IDENTITY.repositoryId ||
    repositoryRecord.full_name !== TRUSTED_IDENTITY.repository
  ) {
    fail('current-run repository immutable identity mismatch');
  }
  if (
    pullRequest.number !== prNumber ||
    pullRequest.base?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    pullRequest.head?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    pullRequest.base?.ref !== 'main' ||
    pullRequest.base?.sha !== pullRequestBaseSha ||
    pullRequest.head?.sha !== approvalTargetHeadSha
  ) {
    fail('current-run pull request is not the exact same-repository main subject');
  }
  if (
    workflow.id !== TRUSTED_IDENTITY.workflowId ||
    workflow.path !== TRUSTED_IDENTITY.workflowPath ||
    workflow.state !== 'active'
  ) {
    fail('current-run workflow immutable identity or active state mismatch');
  }
  const association = requireExactAssociation(
    workflowRun,
    pullRequest,
    prNumber,
    TRUSTED_IDENTITY.repositoryId,
  );
  if (
    workflowRun.id !== runId ||
    workflowRun.run_attempt !== 1 ||
    workflowRun.run_attempt !== runAttempt ||
    workflowRun.workflow_id !== TRUSTED_IDENTITY.workflowId ||
    workflowRun.event !== 'pull_request_target' ||
    workflowRun.path !== TRUSTED_IDENTITY.workflowPath ||
    workflowRun.head_sha !== approvalTargetHeadSha ||
    workflowRun.repository?.id !== TRUSTED_IDENTITY.repositoryId ||
    association.base?.sha !== pullRequestBaseSha ||
    association.head?.sha !== approvalTargetHeadSha
  ) {
    fail('current-run workflow id, attempt, event, path, repository, or PR association mismatch');
  }
  if (
    environment.id !== TRUSTED_IDENTITY.environmentId ||
    environment.name !== TRUSTED_IDENTITY.environmentName ||
    environment.can_admins_bypass !== false
  ) {
    fail('current-run protected environment identity or bypass policy mismatch');
  }
  const reviewerIds = requiredReviewerIds(environment);
  if (
    reviewerIds.length !== 1 ||
    reviewerIds[0] !== TRUSTED_IDENTITY.reviewerDatabaseId
  ) {
    fail('current-run protected environment reviewer set mismatch');
  }

  const reviews = normalizeApprovalReviews(responses.approvals.body);
  const matching = [];
  const requiredComment =
    `approve ${decisionClass} PR #${prNumber} head ${approvalTargetHeadSha}`;
  for (const [index, review] of reviews.entries()) {
    if (!['approved', 'rejected'].includes(review.state)) {
      fail(`current-run approval review[${index}] state is unknown`);
    }
    if (typeof review.comment !== 'string' || review.comment.trim().length === 0) {
      fail(`current-run approval review[${index}] comment must contain non-whitespace scope text`);
    }
    if (review.environments.length !== 1) {
      fail(`current-run approval review[${index}] must bind exactly one environment`);
    }
    const reviewEnvironment = review.environments[0];
    const exactEnvironment =
      reviewEnvironment.id === TRUSTED_IDENTITY.environmentId &&
      reviewEnvironment.name === TRUSTED_IDENTITY.environmentName;
    const exactReviewer =
      review.user.id === TRUSTED_IDENTITY.reviewerDatabaseId &&
      review.user.login === TRUSTED_IDENTITY.reviewerLogin;
    if (exactEnvironment && exactReviewer) {
      if (review.comment !== requiredComment) {
        fail('current-run approval comment does not match the canonical decision subject scope');
      }
      matching.push(review);
    }
  }
  if (matching.some((review) => review.state === 'rejected')) {
    fail('current-run protected approval is rejected or revoked');
  }
  if (matching.length !== 1 || matching[0].state !== 'approved') {
    fail('current-run approval selection must resolve to exactly one approved required review');
  }
  const selected = matching[0];
  const reviewProjection = {
    state: selected.state,
    comment: selected.comment,
    environment_id: selected.environments[0].id,
    environment_name: selected.environments[0].name,
    reviewer_login: selected.user.login,
    reviewer_database_id: selected.user.id,
    reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
  };
  const providerObservedAt = Object.values(responses)
    .map((response) => response.observedAt)
    .sort()
    .at(-1);
  return Object.freeze({
    schema_version: 'mobile-ux-batch1-current-run-approval-verification.v1',
    repository: TRUSTED_IDENTITY.repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request: prNumber,
    pull_request_base_ref: TRUSTED_IDENTITY.protectedBaseRef,
    pull_request_base_sha: pullRequestBaseSha,
    approval_target_head_sha: approvalTargetHeadSha,
    workflow_path: TRUSTED_IDENTITY.workflowPath,
    workflow_id: TRUSTED_IDENTITY.workflowId,
    workflow_run_id: runId,
    run_attempt: runAttempt,
    decision_class: decisionClass,
    environment_id: TRUSTED_IDENTITY.environmentId,
    environment_name: TRUSTED_IDENTITY.environmentName,
    reviewer_immutable_id: TRUSTED_IDENTITY.reviewerImmutableId,
    approval_review_sha256: computeApprovalReviewDigest(reviewProjection),
    provider_observed_at: providerObservedAt,
  });
}

function normalizeCompleteTree(tree, expectedTreeSha, label) {
  assertObject(tree, label);
  if (tree.sha !== expectedTreeSha || tree.truncated !== false || !Array.isArray(tree.tree)) {
    fail(`${label} is mismatched, truncated, or malformed`);
  }
  if (tree.tree.length === 0) fail(`${label} must not be empty`);
  const seen = new Set();
  return tree.tree
    .map((entry, index) => {
      assertObject(entry, `${label}[${index}]`);
      assertRepositoryPath(entry.path, `${label}[${index}].path`);
      if (seen.has(entry.path)) fail(`${label} contains duplicate path ${entry.path}`);
      seen.add(entry.path);
      if (!['blob', 'tree', 'commit'].includes(entry.type)) {
        fail(`${label}[${index}].type is unknown`);
      }
      if (typeof entry.mode !== 'string' || !/^[0-7]{6}$/.test(entry.mode)) {
        fail(`${label}[${index}].mode is malformed`);
      }
      assertCommitSha(entry.sha, `${label}[${index}].sha`);
      if (entry.size !== undefined && (!Number.isSafeInteger(entry.size) || entry.size < 0)) {
        fail(`${label}[${index}].size is malformed`);
      }
      return {
        path: entry.path,
        mode: entry.mode,
        type: entry.type,
        sha: entry.sha,
        size: entry.size ?? null,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function readVerifiedGitHubPullRequestMerge({
  repository = TRUSTED_IDENTITY.repository,
  pullRequestNumber,
  approvalTargetHeadSha,
  origin,
  api = githubApiRequest,
} = {}) {
  if (repository !== TRUSTED_IDENTITY.repository) fail('repository does not match trusted identity');
  const prNumber = asPositiveInteger(pullRequestNumber, 'pullRequestNumber');
  if (approvalTargetHeadSha !== undefined) {
    assertCommitSha(approvalTargetHeadSha, 'approvalTargetHeadSha');
  }
  if (typeof api !== 'function') fail('GitHub API reader must be a function');
  validateRepositoryIdentity({
    repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    origin,
  });

  const read = async (relativePath) => {
    const response = await api(relativePath);
    assertObject(response, `GitHub API wrapper response for ${relativePath}`);
    if (!Object.hasOwn(response, 'body') || !Object.hasOwn(response, 'observedAt')) {
      fail(`GitHub API wrapper response is incomplete for ${relativePath}`);
    }
    if (!RFC3339_SECOND_RE.test(response.observedAt)) {
      fail(`GitHub API observedAt is not canonical UTC second precision for ${relativePath}`);
    }
    return response;
  };

  const repositoryResponse = await read(`/repos/${repository}`);
  const pullResponse = await read(`/repos/${repository}/pulls/${prNumber}`);
  const repositoryRecord = assertObject(repositoryResponse.body, 'repository record');
  const pullRequest = assertObject(pullResponse.body, 'pull request merge record');
  if (
    repositoryRecord.id !== TRUSTED_IDENTITY.repositoryId ||
    repositoryRecord.full_name !== repository
  ) {
    fail('remote repository immutable identity mismatch');
  }
  if (
    pullRequest.number !== prNumber ||
    pullRequest.base?.ref !== 'main' ||
    pullRequest.base?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    pullRequest.head?.repo?.id !== TRUSTED_IDENTITY.repositoryId
  ) {
    fail('merged pull request is not bound to the canonical same-repository main target');
  }
  assertCommitSha(pullRequest.base?.sha, 'merged pull request base SHA');
  assertCommitSha(pullRequest.head?.sha, 'merged pull request final head SHA');
  if (pullRequest.state !== 'closed' || pullRequest.merged !== true) {
    fail('pull request must be remotely closed and merged before its approval can be consumed');
  }
  if (
    approvalTargetHeadSha !== undefined &&
    pullRequest.head.sha !== approvalTargetHeadSha
  ) {
    fail('pull request final head drifted after the protected approval target');
  }
  const verifiedHeadSha = approvalTargetHeadSha ?? pullRequest.head.sha;
  assertCommitSha(pullRequest.merge_commit_sha, 'pull request merge commit SHA');
  if (
    typeof pullRequest.merged_at !== 'string' ||
    !RFC3339_SECOND_RE.test(pullRequest.merged_at) ||
    !Number.isFinite(Date.parse(pullRequest.merged_at)) ||
    new Date(pullRequest.merged_at).toISOString().replace('.000Z', 'Z') !==
      pullRequest.merged_at
  ) {
    fail('pull request merged_at is missing or malformed');
  }

  const approvedCommitPath = `/repos/${repository}/git/commits/${verifiedHeadSha}`;
  const mergeCommitPath = `/repos/${repository}/git/commits/${pullRequest.merge_commit_sha}`;
  const [approvedCommitResponse, mergeCommitResponse] = await Promise.all([
    read(approvedCommitPath),
    read(mergeCommitPath),
  ]);
  const approvedCommit = assertObject(approvedCommitResponse.body, 'approved-head Git commit');
  const mergeCommit = assertObject(mergeCommitResponse.body, 'merged Git commit');
  if (approvedCommit.sha !== verifiedHeadSha || typeof approvedCommit.tree?.sha !== 'string') {
    fail('approved-head Git commit does not bind the requested head and tree');
  }
  if (
    mergeCommit.sha !== pullRequest.merge_commit_sha ||
    typeof mergeCommit.tree?.sha !== 'string'
  ) {
    fail('merged Git commit does not bind the pull-request merge and tree');
  }
  if (!Array.isArray(mergeCommit.parents) || mergeCommit.parents.length !== 1) {
    fail('squash merge Git commit must have exactly one parent');
  }
  const mergeParent = assertObject(
    mergeCommit.parents[0],
    'squash merge Git commit parent',
  );
  assertCommitSha(mergeParent.sha, 'squash merge Git commit parent SHA');
  if (mergeParent.sha !== pullRequest.base.sha) {
    fail('squash merge Git commit parent must equal the pull-request base SHA');
  }
  assertCommitSha(approvedCommit.tree.sha, 'approved-head tree SHA');
  assertCommitSha(mergeCommit.tree.sha, 'merged tree SHA');

  const approvedTreePath =
    `/repos/${repository}/git/trees/${approvedCommit.tree.sha}?recursive=1`;
  const mergeTreePath = `/repos/${repository}/git/trees/${mergeCommit.tree.sha}?recursive=1`;
  const [approvedTreeResponse, mergeTreeResponse] = await Promise.all([
    read(approvedTreePath),
    read(mergeTreePath),
  ]);
  const approvedTree = normalizeCompleteTree(
    approvedTreeResponse.body,
    approvedCommit.tree.sha,
    'approved-head complete tree',
  );
  const mergedTree = normalizeCompleteTree(
    mergeTreeResponse.body,
    mergeCommit.tree.sha,
    'merged complete tree',
  );
  if (
    approvedCommit.tree.sha !== mergeCommit.tree.sha ||
    JSON.stringify(approvedTree) !== JSON.stringify(mergedTree)
  ) {
    fail('approved-head and merged pull-request trees are not exactly equivalent');
  }
  const providerObservedAt = [
    repositoryResponse,
    pullResponse,
    approvedCommitResponse,
    mergeCommitResponse,
    approvedTreeResponse,
    mergeTreeResponse,
  ].map((response) => response.observedAt).sort().at(-1);
  if (Date.parse(pullRequest.merged_at) > Date.parse(providerObservedAt)) {
    fail('pull request merged_at cannot be later than the trusted provider observation');
  }
  return Object.freeze({
    repository_full_name: repository,
    repository_id: TRUSTED_IDENTITY.repositoryId,
    pull_request_number: prNumber,
    pull_request_base_sha: pullRequest.base.sha,
    approval_target_head_sha: verifiedHeadSha,
    merge_commit_sha: pullRequest.merge_commit_sha,
    complete_tree_sha: mergeCommit.tree.sha,
    merged_at: pullRequest.merged_at,
    provider_observed_at: providerObservedAt,
  });
}

export async function readVerifiedGitHubCommitPullRequestAssociation({
  repository = TRUSTED_IDENTITY.repository,
  mergeCommitSha,
  origin,
  api = githubApiRequest,
} = {}) {
  if (repository !== TRUSTED_IDENTITY.repository) fail('repository does not match trusted identity');
  assertCommitSha(mergeCommitSha, 'mergeCommitSha');
  if (typeof api !== 'function') fail('GitHub API reader must be a function');

  const associationPath =
    `/repos/${repository}/commits/${mergeCommitSha}/pulls?per_page=100`;
  const associationResponse = await api(associationPath);
  assertObject(
    associationResponse,
    `GitHub API wrapper response for ${associationPath}`,
  );
  if (
    !Object.hasOwn(associationResponse, 'body') ||
    !Object.hasOwn(associationResponse, 'observedAt')
  ) {
    fail(`GitHub API wrapper response is incomplete for ${associationPath}`);
  }
  if (
    !RFC3339_SECOND_RE.test(associationResponse.observedAt) ||
    !Number.isFinite(Date.parse(associationResponse.observedAt)) ||
    new Date(associationResponse.observedAt).toISOString().replace('.000Z', 'Z') !==
      associationResponse.observedAt
  ) {
    fail(`GitHub API observedAt is not canonical UTC second precision for ${associationPath}`);
  }
  if (!Array.isArray(associationResponse.body)) {
    fail('commit-associated pull-request response must be an array');
  }
  if (associationResponse.body.length !== 1) {
    fail('merge commit must have exactly one associated pull request');
  }
  const association = assertObject(
    associationResponse.body[0],
    'commit-associated pull request',
  );
  const pullRequestNumber = asPositiveInteger(
    association.number,
    'commit-associated pull request number',
  );
  assertCommitSha(
    association.head?.sha,
    'commit-associated pull request final head SHA',
  );
  assertCommitSha(
    association.base?.sha,
    'commit-associated pull request base SHA',
  );
  if (
    association.base?.ref !== 'main' ||
    association.base?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    association.head?.repo?.id !== TRUSTED_IDENTITY.repositoryId ||
    association.state !== 'closed' ||
    (association.merged !== undefined && association.merged !== true) ||
    association.merge_commit_sha !== mergeCommitSha
  ) {
    fail('commit-associated pull request is not one canonical merged same-repository main pull request');
  }

  const landing = await readVerifiedGitHubPullRequestMerge({
    repository,
    pullRequestNumber,
    approvalTargetHeadSha: association.head.sha,
    origin,
    api,
  });
  if (
    landing.merge_commit_sha !== mergeCommitSha ||
    landing.pull_request_base_sha !== association.base.sha ||
    landing.approval_target_head_sha !== association.head.sha ||
    landing.merged_at !== association.merged_at
  ) {
    fail('commit-associated pull request does not exactly materialize the requested merge commit');
  }
  return Object.freeze({
    ...landing,
    associated_pull_request_count: 1,
    provider_observed_at: [
      associationResponse.observedAt,
      landing.provider_observed_at,
    ].sort().at(-1),
  });
}

export async function readVerifiedGitHubArtifact({
  repository = TRUSTED_IDENTITY.repository,
  commitSha,
  artifactPath,
  api = githubApiRequest,
} = {}) {
  if (repository !== TRUSTED_IDENTITY.repository) fail('repository does not match trusted identity');
  assertCommitSha(commitSha, 'artifact commitSha');
  assertRepositoryPath(artifactPath, 'artifactPath');
  if (typeof api !== 'function') fail('GitHub API reader must be a function');

  const read = async (relativePath) => {
    const response = await api(relativePath);
    assertObject(response, `GitHub API wrapper response for ${relativePath}`);
    if (!Object.hasOwn(response, 'body') || !Object.hasOwn(response, 'observedAt')) {
      fail(`GitHub API wrapper response is incomplete for ${relativePath}`);
    }
    if (!RFC3339_SECOND_RE.test(response.observedAt)) {
      fail(`GitHub API observedAt is not canonical UTC second precision for ${relativePath}`);
    }
    return response;
  };

  const commitResponse = await read(`/repos/${repository}/git/commits/${commitSha}`);
  const commit = assertObject(commitResponse.body, 'Git commit record');
  if (commit.sha !== commitSha || typeof commit.tree?.sha !== 'string') {
    fail('Git commit record does not bind the requested commit and tree');
  }
  assertCommitSha(commit.tree.sha, 'Git commit tree SHA');

  const treePath = `/repos/${repository}/git/trees/${commit.tree.sha}?recursive=1`;
  const treeResponse = await read(treePath);
  const tree = assertObject(treeResponse.body, 'Git tree record');
  if (tree.sha !== commit.tree.sha || tree.truncated !== false || !Array.isArray(tree.tree)) {
    fail('Git tree response is mismatched, truncated, or malformed');
  }
  const matches = tree.tree.filter((entry) => entry?.path === artifactPath);
  if (matches.length !== 1) fail('Git tree must contain exactly one requested artifact entry');
  const entry = matches[0];
  if (
    entry.type !== 'blob' ||
    entry.mode !== '100644' ||
    typeof entry.sha !== 'string' ||
    !Number.isSafeInteger(entry.size) ||
    entry.size < 1
  ) {
    fail('Git artifact must be one non-empty tracked 100644 blob');
  }
  assertCommitSha(entry.sha, 'Git blob SHA');

  const blobResponse = await read(`/repos/${repository}/git/blobs/${entry.sha}`);
  const blob = assertObject(blobResponse.body, 'Git blob record');
  if (
    blob.sha !== entry.sha ||
    blob.encoding !== 'base64' ||
    blob.size !== entry.size ||
    typeof blob.content !== 'string'
  ) {
    fail('Git blob response is mismatched or malformed');
  }
  const encoded = blob.content.replace(/\n/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    fail('Git blob content is not canonical base64');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== entry.size || bytes.toString('base64') !== encoded) {
    fail('Git blob decoded bytes do not match the exact remote size or encoding');
  }
  return Object.freeze({
    commit: commitSha,
    object_id: entry.sha,
    record: Object.freeze({
      path: artifactPath,
      git_mode: entry.mode,
      byte_length: bytes.length,
      raw_sha256: sha256Hex(bytes),
    }),
    bytes,
    provider_observed_at: [
      commitResponse.observedAt,
      treeResponse.observedAt,
      blobResponse.observedAt,
    ].sort().at(-1),
  });
}
