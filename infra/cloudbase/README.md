# Tencent CloudBase Dev Environment

Referenced specs: `spec/account-sync-contract.json`, `spec/platform-contract.json`, `spec/runtime-boundaries.json`.

`product_truth`: remote learning must still enforce phone-code login before learning, shared membership entitlement, daily-level progress sync, and physical-space state sync.

`implementation_hypothesis`: CloudBase is the current free/low-cost China-friendly staging runtime. It is not the final production architecture. Keep the public mobile contract as standard REST under `/v1/*`, isolate CloudBase NoSQL/function details behind a service adapter, and preserve a future migration path to Docker + PostgreSQL on the formal work server.

## Current Environment

- Cloud provider: Tencent CloudBase
- Environment ID: `test-d2gzcyxr9f7e80972`
- Alias: `test`
- Region: `ap-shanghai`
- Package: `体验版`
- Status at setup: `NORMAL`
- Billing cycle observed at setup: `2026-04-30` to `2026-05-31`
- Credits observed at setup: `3000` total, `0` used

## Local CLI

CloudBase CLI is installed globally through npm:

```bash
npm install -g @cloudbase/cli
tcb login --flow device
tcb env use test-d2gzcyxr9f7e80972
```

Status checks:

```bash
infra/cloudbase/check-dev.sh
```

## Intended First Backend Slice

Deploy one HTTP cloud function that exposes the existing mobile remote contract:

```text
POST /v1/auth/request-code
POST /v1/auth/verify-code
GET  /v1/learning/card-source?track=cet4|cet6
GET  /v1/membership/entitlement
POST /v1/membership/start-trial
POST /v1/membership/purchase
POST /v1/membership/dismiss-recovery
POST /v1/progress/daily-sync
POST /v1/learning/state-sync
POST /v1/space/state-sync
```

For the development environment, SMS should use a whitelist/fixed-code adapter first. Real SMS provider integration should remain an adapter and must not change the mobile REST contract.

