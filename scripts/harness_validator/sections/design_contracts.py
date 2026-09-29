from __future__ import annotations


def validate(context) -> None:
    """Retain the metadata boundary without locking prose or design procedure.

    Actual leakage regressions run in design_metadata_regressions and
    mobile_metadata_regressions. This only checks the policy declaration.
    """
    visual = context.load("visual-language.json")
    leakage = visual.get("product_truth", {}).get("user_visible_metadata_leakage_is_blocker", {})
    context.check_equal(
        "user-visible metadata leakage policy", "delivery_blocker", leakage.get("violation_is"),
    )
    quarantine = "docs/design/design-quarantine.md"
    if quarantine not in leakage.get("binding", []):
        context.errors.append("visual language metadata policy must bind its quarantine owner")
    if not (context.root / quarantine).is_file():
        context.errors.append("missing design metadata quarantine owner")
