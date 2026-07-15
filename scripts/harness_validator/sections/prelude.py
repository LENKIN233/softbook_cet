from __future__ import annotations


REQUIRED_SPEC_FILES = (
    "requirement-memory.json",
    "account-sync-contract.json",
    "platform-contract.json",
    "product-core.json",
    "membership.json",
    "repo-delivery-contract.json",
    "interactions.json",
    "doc-manifest.json",
    "authority-map.json",
    "agent-harness.json",
    "harness-architecture.json",
    "agent-run-record.json",
    "evals.json",
    "perturbation-audit.json",
)


def validate(context) -> None:
    for name in REQUIRED_SPEC_FILES:
        context.load(name)
