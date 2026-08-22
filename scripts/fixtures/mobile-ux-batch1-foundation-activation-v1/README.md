# Mobile UX Batch 1 foundation activation test vectors

These files are test-only, non-authoritative fixtures. They carry no product,
visual, implementation, release, or governance authority.

`exact_bytes.mjs` and the `*.gz.base64` payloads store gzip-compressed exact bytes for
the pinned historical v1 subject, the five reviewed v2 schema-subject files, and
the four planned but unmaterialized PR-B artifacts (policy, resolved-requirement
schema, foundation decision, and foundation run record). Tests inflate them
locally so CI never depends on an unmerged branch, an external Git object, or a
surviving pull-request ref.

The PR-B payload copies are deliberately stored only under this noncanonical
fixture prefix. They do not activate governance and grant no authority. Their
canonical paths must remain absent from PR-A so the later PR-B can introduce
them as immutable Git additions.

The production validator must continue to obtain live historical evidence from
GitHub and fail closed when it cannot be reverified. These vectors exist only
for deterministic unit and integration tests.
