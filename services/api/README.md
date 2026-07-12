# Softbook production API

This TypeScript service is the production successor to the development-only
CloudBase `/v1` function. It currently provides the first `/v2` contracts:

- expiring SMS challenges without plaintext phone or code storage;
- opaque 15-minute access tokens and rotating 30-day refresh sessions;
- session revocation, logout and queued in-app account deletion;
- authenticated canonical bootstrap reads;
- idempotent `learning-events.v2` ingestion;
- fail-closed `content-release.v1` manifest reads;
- liveness and PostgreSQL readiness probes.

Run locally with PostgreSQL:

```bash
npm ci
npm run build
npm run migrate
npm start
```

`NODE_ENV=production` rejects the development SMS provider, wildcard CORS and
non-PostgreSQL database URLs. Secrets must come from the runtime secret store;
the tracked `.env.example` contains names only.

This foundation does not yet claim a production scheduler, signed COS download
URLs, payment verification, subscription webhooks or entitlement reconciliation.
Those capabilities remain red in `docs/release/launch-readiness.v1.json`.
