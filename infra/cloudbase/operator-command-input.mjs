import {execFileSync} from 'node:child_process';
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
    repositoryRoot,
  },
) {
  const fail = message => {
    throw createError(message);
  };
  const resolvedPath = resolve(inputPath);
  const canonicalRepositoryRoot = requireRealPath(repositoryRoot, fail);
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
    rejectExactHeadBlob(bytes, canonicalRepositoryRoot, fail);
    return bytes;
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

function rejectExactHeadBlob(bytes, repositoryRoot, fail) {
  let output;
  let blobId;
  try {
    output = execFileSync(
      'git',
      ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
      {cwd: repositoryRoot, encoding: 'utf8'},
    );
    blobId = execFileSync('git', ['hash-object', '--stdin'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      input: bytes,
    }).trim();
  } catch {
    fail('operator command could not be checked against exact HEAD.');
  }
  const regularBlobIds = new Set();
  for (const record of output.split('\0')) {
    if (!record) continue;
    const match = /^(100644|100755) blob ([0-9a-f]+)\t/.exec(record);
    if (match) regularBlobIds.add(match[2]);
  }
  if (regularBlobIds.has(blobId)) {
    fail(
      'operator command bytes must not equal any exact HEAD tracked regular blob.',
    );
  }
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
