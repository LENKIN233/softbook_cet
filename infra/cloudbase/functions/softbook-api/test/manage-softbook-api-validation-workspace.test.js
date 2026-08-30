const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');

const repositoryRoot = path.resolve(__dirname, '../../../../../');

test('deployment validation workspace includes repository support modules', async t => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'softbook-cloudbase-validation-support-'),
  );
  t.after(() => fs.rmSync(temporaryRoot, {force: true, recursive: true}));

  const module = await import(
    pathToFileURL(path.join(repositoryRoot, 'infra/cloudbase/manage-softbook-api.mjs'))
  );
  const target = module.copyValidationSupportFiles(temporaryRoot);

  assert.equal(target, path.join(temporaryRoot, 'scripts'));
  for (const filename of [
    'launch_evidence_contract.mjs',
    'model_acceptance_contract.mjs',
    'strict_json.mjs',
  ]) {
    const copied = path.join(target, 'lib', filename);
    assert.equal(fs.statSync(copied).isFile(), true, filename);
    assert.deepEqual(
      fs.readFileSync(copied),
      fs.readFileSync(path.join(repositoryRoot, 'scripts', 'lib', filename)),
      filename,
    );
  }
  for (const filename of [
    'build_controlled_pilot_bundle.mjs',
    'run_audio_bundle_candidate_mobile_acceptance.mjs',
    'run_controlled_pilot_mobile_acceptance.mjs',
  ]) {
    const copied = path.join(target, filename);
    assert.equal(fs.statSync(copied).isFile(), true, filename);
    assert.deepEqual(
      fs.readFileSync(copied),
      fs.readFileSync(path.join(repositoryRoot, 'scripts', filename)),
      filename,
    );
  }
  for (const filename of ['box-catalog.json', 'membership.json']) {
    const copied = path.join(temporaryRoot, 'spec', filename);
    assert.equal(fs.statSync(copied).isFile(), true, filename);
    assert.deepEqual(
      fs.readFileSync(copied),
      fs.readFileSync(path.join(repositoryRoot, 'spec', filename)),
      filename,
    );
  }
});
