import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {isAbsolute, parse, relative, resolve, sep} from 'node:path';

export function readPrivateOperatorCommandBytes(
  inputPath,
  {
    beforeRead = null,
    createError = message => new Error(message),
    git = execFileSync,
    headMaterialProbe = null,
    repositoryRoot,
  },
) {
  const fail = message => {
    throw createError(message);
  };
  const resolvedPath = resolve(inputPath);
  const canonicalRepositoryRoot = requireRealPath(repositoryRoot, fail);
  const checkedHead = readHead(canonicalRepositoryRoot, git, fail);
  assertNoSymlinkComponents(resolvedPath, fail);
  const canonicalPath = requireRealPath(resolvedPath, fail);
  if (isWithin(canonicalRepositoryRoot, canonicalPath)) {
    fail(
      'operator command must be outside the repository and cannot be tracked at HEAD.',
    );
  }

  let descriptor;
  try {
    descriptor = openSync(
      resolvedPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
  } catch {
    fail(
      'operator command must be an existing regular non-symlink file outside the repository.',
    );
  }

  try {
    const before = fstatSync(descriptor, {bigint: true});
    assertOpenedRegularFile(before, fail);
    assertPathStillOwnsDescriptor(resolvedPath, before, fail);
    if (typeof beforeRead === 'function') beforeRead(resolvedPath);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, {bigint: true});
    assertStableOpenedFile(before, after, bytes, fail);
    assertNoSymlinkComponents(resolvedPath, fail);
    assertPathStillOwnsDescriptor(resolvedPath, after, fail);
    const snapshot =
      typeof headMaterialProbe === 'function'
        ? headMaterialProbe({
            bytes: Buffer.from(bytes),
            checkedHead,
            repositoryRoot: canonicalRepositoryRoot,
          })
        : readHeadMaterialSnapshot(
            canonicalRepositoryRoot,
            checkedHead,
            git,
            fail,
          );
    rejectTrackedHeadMaterial(
      bytes,
      canonicalRepositoryRoot,
      snapshot,
      git,
      fail,
    );
    if (readHead(canonicalRepositoryRoot, git, fail) !== checkedHead) {
      fail('repository HEAD changed while operator command bytes were checked.');
    }
    return {bytes, checkedHead};
  } finally {
    closeSync(descriptor);
  }
}

function assertNoSymlinkComponents(absolutePath, fail) {
  const parsed = parse(absolutePath);
  let current = parsed.root;
  const segments = absolutePath
    .slice(parsed.root.length)
    .split(sep)
    .filter(Boolean);
  for (const segment of segments) {
    current = resolve(current, segment);
    let stat;
    try {
      stat = lstatSync(current, {bigint: true});
    } catch {
      fail(
        'operator command must be an existing regular non-symlink file outside the repository.',
      );
    }
    if (stat.isSymbolicLink()) {
      fail('operator command path components must not be symbolic links.');
    }
  }
}

function assertOpenedRegularFile(stat, fail) {
  if (!stat.isFile()) {
    fail('operator command must be an opened regular file.');
  }
  if (stat.nlink !== 1n) {
    fail('operator command must not be a hard link.');
  }
}

function assertPathStillOwnsDescriptor(path, descriptorStat, fail) {
  let pathStat;
  try {
    pathStat = lstatSync(path, {bigint: true});
  } catch {
    fail('operator command path changed while it was being validated.');
  }
  if (
    pathStat.isSymbolicLink() ||
    pathStat.dev !== descriptorStat.dev ||
    pathStat.ino !== descriptorStat.ino
  ) {
    fail('operator command path changed while it was being validated.');
  }
}

function assertStableOpenedFile(before, after, bytes, fail) {
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    after.size !== BigInt(bytes.length)
  ) {
    fail('operator command bytes changed while they were being read.');
  }
}

function readHeadMaterialSnapshot(repositoryRoot, checkedHead, git, fail) {
  let output;
  try {
    output = git(
      'git',
      ['ls-tree', '-r', '-z', '--full-tree', checkedHead],
      {cwd: repositoryRoot, encoding: 'utf8'},
    );
  } catch {
    fail('operator command could not be checked against exact HEAD.');
  }
  const entries = [];
  for (const record of output.split('\0')) {
    if (!record) continue;
    const match = /^(\d{6}) (blob|commit) ([0-9a-f]+)\t/.exec(record);
    if (!match) fail('exact HEAD tree contains an unsupported entry.');
    entries.push({mode: match[1], oid: match[3], type: match[2]});
  }
  const blobIds = [...new Set(
    entries.filter(entry => entry.type === 'blob').map(entry => entry.oid),
  )];
  const lfsPointers = readLfsPointers(
    repositoryRoot,
    blobIds,
    git,
    fail,
  );
  return {entries, lfsPointers};
}

function rejectTrackedHeadMaterial(
  bytes,
  repositoryRoot,
  snapshot,
  git,
  fail,
) {
  if (!snapshot || !Array.isArray(snapshot.entries)) {
    fail('exact HEAD material snapshot is invalid.');
  }
  if (
    snapshot.entries.some(
      entry => entry?.mode === '160000' || entry?.type === 'commit',
    )
  ) {
    fail('exact HEAD contains a gitlink and cannot authorize operator apply.');
  }
  const blobIds = new Set(
    snapshot.entries
      .filter(entry => entry?.type === 'blob')
      .map(entry => entry.oid),
  );
  let commandBlobId;
  try {
    commandBlobId = git('git', ['hash-object', '--stdin'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      input: bytes,
    }).trim();
  } catch {
    fail('operator command could not be hashed as a Git blob.');
  }
  if (blobIds.has(commandBlobId)) {
    fail(
      'operator command bytes must not equal any exact HEAD tracked blob.',
    );
  }
  const commandSha256 = createHash('sha256').update(bytes).digest('hex');
  const lfsPointers = Array.isArray(snapshot.lfsPointers)
    ? snapshot.lfsPointers
    : [];
  if (
    lfsPointers.some(
      pointer =>
        pointer?.oid_sha256 === commandSha256 &&
        pointer?.size === bytes.length,
    )
  ) {
    fail('operator command bytes must not match exact HEAD LFS material.');
  }
}

function readLfsPointers(repositoryRoot, blobIds, git, fail) {
  if (blobIds.length === 0) return [];
  let checks;
  try {
    checks = git(
      'git',
      ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        input: `${blobIds.join('\n')}\n`,
      },
    );
  } catch {
    fail('exact HEAD blobs could not be inspected for LFS pointers.');
  }
  const candidateIds = checks
    .trim()
    .split('\n')
    .map(line => /^(\S+) blob (\d+)$/.exec(line))
    .filter(match => match && Number(match[2]) <= 1024)
    .map(match => match[1]);
  if (candidateIds.length === 0) return [];
  let batch;
  try {
    batch = git('git', ['cat-file', '--batch'], {
      cwd: repositoryRoot,
      encoding: null,
      input: `${candidateIds.join('\n')}\n`,
    });
  } catch {
    fail('exact HEAD LFS pointer candidates could not be read.');
  }
  return parseLfsBatch(Buffer.from(batch), fail);
}

function parseLfsBatch(batch, fail) {
  const pointers = [];
  let offset = 0;
  while (offset < batch.length) {
    const headerEnd = batch.indexOf(0x0a, offset);
    if (headerEnd < 0) fail('Git blob batch response is truncated.');
    const header = batch.subarray(offset, headerEnd).toString('utf8');
    const match = /^\S+ blob (\d+)$/.exec(header);
    if (!match) fail('Git blob batch response is invalid.');
    const size = Number(match[1]);
    const start = headerEnd + 1;
    const end = start + size;
    if (!Number.isSafeInteger(size) || end > batch.length) {
      fail('Git blob batch size is invalid.');
    }
    const content = batch.subarray(start, end);
    const pointer = parseLfsPointer(content, fail);
    if (pointer) pointers.push(pointer);
    offset = end;
    if (batch[offset] === 0x0a) offset += 1;
  }
  return pointers;
}

function parseLfsPointer(bytes, fail) {
  const text = bytes.toString('utf8');
  const marker = 'version https://git-lfs.github.com/spec/v1';
  if (!text.startsWith(marker)) return null;
  const match = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n?$/.exec(
    text,
  );
  if (!match) fail('exact HEAD contains a malformed LFS pointer.');
  const size = Number(match[2]);
  if (!Number.isSafeInteger(size) || size < 0) {
    fail('exact HEAD LFS pointer size is invalid.');
  }
  return {oid_sha256: match[1], size};
}

function readHead(repositoryRoot, git, fail) {
  let head;
  try {
    head = git('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    fail('repository HEAD could not be read for operator command binding.');
  }
  if (!/^[a-f0-9]{40,64}$/.test(head)) {
    fail('repository HEAD is invalid for operator command binding.');
  }
  return head;
}

function requireRealPath(path, fail) {
  try {
    return realpathSync(path);
  } catch {
    fail(
      'operator command must be an existing regular non-symlink file outside the repository.',
    );
  }
}

function isWithin(root, candidate) {
  const relativePath = relative(root, candidate);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== '..' &&
      !isAbsolute(relativePath))
  );
}
