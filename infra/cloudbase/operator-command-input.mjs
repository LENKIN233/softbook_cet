import {lstatSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';

export function requirePrivateOperatorCommandPath(
  inputPath,
  {createError = message => new Error(message), repositoryRoot},
) {
  const resolvedPath = resolve(inputPath);
  let stat;
  let canonicalPath;
  let canonicalRepositoryRoot;
  try {
    stat = lstatSync(resolvedPath);
    canonicalPath = realpathSync(resolvedPath);
    canonicalRepositoryRoot = realpathSync(repositoryRoot);
  } catch {
    throw createError(
      'operator command must be an existing regular non-symlink file outside the repository.',
    );
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw createError(
      'operator command must be an existing regular non-symlink file outside the repository.',
    );
  }
  const repositoryRelative = relative(canonicalRepositoryRoot, canonicalPath);
  const insideRepository =
    repositoryRelative === '' ||
    (!repositoryRelative.startsWith(`..${sep}`) &&
      repositoryRelative !== '..' &&
      !isAbsolute(repositoryRelative));
  if (insideRepository) {
    throw createError(
      'operator command must be outside the repository and cannot be tracked at HEAD.',
    );
  }
  return resolvedPath;
}
