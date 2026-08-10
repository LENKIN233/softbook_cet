import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const FIXTURE_ROOT = path.dirname(fileURLToPath(import.meta.url));

export const EXACT_BYTE_FIXTURES = Object.freeze({
  'spec/mobile-ux-batch1-governance.json': Object.freeze({
    source: 'planned_unmaterialized_pr_b',
    byte_length: 43426,
    raw_sha256: '176dd5bf4dec4fafd0ab171c6276f410e525a97d3b8b42185277994d6203be2c',
    compressed_file: 'pr-b-governance-policy.json.gz.base64',
  }),
  'spec/mobile-ux-batch1-resolved-requirement.schema.json': Object.freeze({
    source: 'planned_unmaterialized_pr_b',
    byte_length: 10444,
    raw_sha256: '3f292ce02155ab511f4d76c49de3586fff0083b3e95ed94561eeb871ea65d50b',
    compressed_file: 'pr-b-resolved-requirement.schema.json.gz.base64',
  }),
  'docs/design/decisions/mobile-ux-batch1-governance-foundation-v1.md': Object.freeze({
    source: 'planned_unmaterialized_pr_b',
    byte_length: 25374,
    raw_sha256: '4289f0881533a754418a5641678fcd1288eaa1d98353fd964344daef0bd85926',
    compressed_file: 'pr-b-foundation-decision.md.gz.base64',
  }),
  'docs/agent-runs/2026-08-10-mobile-ux-batch1-governance-foundation-v1.md': Object.freeze({
    source: 'planned_unmaterialized_pr_b',
    byte_length: 5424,
    raw_sha256: '7a5390fa4a862e622c723d9b73507da02eb9043b40e1e8568d637a241a4530c5',
    compressed_file: 'pr-b-foundation-run-record.md.gz.base64',
  }),
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v1.json': Object.freeze({
    source_commit: '8f4f82b35b660d9a775d6551e530fe6703c3ac54',
    byte_length: 25900,
    raw_sha256: 'f51f8fc849edacc9e22517266468caff1333d6d12c1a3265cf9a85eec381c982',
    compressed_file: 'historical-registry-set.v1.json.gz.base64',
  }),
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v2.proposal.json': Object.freeze({
    source_commit: '641d33c7ccb320f2e410718129e895993ce425ad',
    byte_length: 463209,
    raw_sha256: '58966c8df9e9f5a5a7f6711a048317b78a2300d3a003e1dd6bdd238c0e928c03',
    compressed_file: 'registry-set.v2.proposal.json.gz.base64',
  }),
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-ba.registry.v2.proposal.json': Object.freeze({
    source_commit: '641d33c7ccb320f2e410718129e895993ce425ad',
    byte_length: 203095,
    raw_sha256: '247ff9d3de23e31f3e37e35e9a53fd0fe1edc24bc2d93ca4468a5a2571338491',
    compressed_file: 'cp-ba.registry.v2.proposal.json.gz.base64',
  }),
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-cs.registry.v2.proposal.json': Object.freeze({
    source_commit: '641d33c7ccb320f2e410718129e895993ce425ad',
    byte_length: 345511,
    raw_sha256: '8819358f978a1c573067d468531744b2fd900864d3317542e741bffae2f2bdfa',
    compressed_file: 'cp-cs.registry.v2.proposal.json.gz.base64',
  }),
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-web.registry.v2.proposal.json': Object.freeze({
    source_commit: '641d33c7ccb320f2e410718129e895993ce425ad',
    byte_length: 218680,
    raw_sha256: 'cc0b4aa3f73b36318d00e28f1514115f10dec78fd21c8948f1c3030d2699da60',
    compressed_file: 'cp-web.registry.v2.proposal.json.gz.base64',
  }),
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/manifest-schema-catalog.v1.json': Object.freeze({
    source_commit: '641d33c7ccb320f2e410718129e895993ce425ad',
    byte_length: 126140,
    raw_sha256: '814088a2b709e0d31a5a1d96d3bc29e17dc47849fdcd44f1785162d452ac5b1b',
    compressed_file: 'manifest-schema-catalog.v1.json.gz.base64',
  }),
});

export function decodeExactFixturePayload(encoded, fixture, label = 'exact-byte fixture') {
  if (typeof encoded !== 'string' || fixture === null || typeof fixture !== 'object') {
    throw new Error(`${label} payload or metadata is malformed`);
  }
  const canonicalBase64 = encoded.replace(/\s+/gu, '');
  if (
    canonicalBase64.length === 0 ||
    canonicalBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(canonicalBase64)
  ) {
    throw new Error(`${label} is not canonical base64`);
  }
  const compressed = Buffer.from(canonicalBase64, 'base64');
  if (compressed.toString('base64') !== canonicalBase64) {
    throw new Error(`${label} base64 round-trip drift`);
  }
  let bytes;
  try {
    bytes = Buffer.from(gunzipSync(compressed, {maxOutputLength: 1024 * 1024}));
  } catch (error) {
    throw new Error(`${label} gzip payload is invalid`, {cause: error});
  }
  if (bytes.length !== fixture.byte_length) {
    throw new Error(`${label} byte length drift`);
  }
  const rawSha256 = createHash('sha256').update(bytes).digest('hex');
  if (rawSha256 !== fixture.raw_sha256) {
    throw new Error(`${label} raw SHA-256 drift`);
  }
  return bytes;
}

export function exactFixtureBytes(relativePath) {
  const fixture = EXACT_BYTE_FIXTURES[relativePath];
  if (!fixture) throw new Error(`unknown Mobile UX Batch 1 exact-byte fixture: ${relativePath}`);
  const encoded = fs.readFileSync(path.join(FIXTURE_ROOT, fixture.compressed_file), 'utf8');
  return decodeExactFixturePayload(encoded, fixture, relativePath);
}
