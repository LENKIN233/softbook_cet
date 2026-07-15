from __future__ import annotations


def validate(context) -> None:
    ROOT = context.root
    errors = context.errors
    check_equal = context.check_equal
    find_by_id = context.find_by_id
    anchor_texts = context.anchor_texts
    literal_source_anchors = context.literal_source_anchors
    req = context.load("requirement-memory.json")
    auth = context.load("account-sync-contract.json")
    platform = context.load("platform-contract.json")
    product = context.load("product-core.json")
    interactions = context.load("interactions.json")
    manifest = context.load("doc-manifest.json")
    authority = context.load("authority-map.json")
    evals = context.load("evals.json")
    perturbation_audit = context.load("perturbation-audit.json")

    # Manifest targets exist.
    for doc in manifest["active_documents"]:
        rel = doc["path"]
        if not (ROOT / rel).exists():
            errors.append(f"manifest missing active document target: {rel}")

    for rel in manifest["active_specs"]:
        if not (ROOT / rel).exists():
            errors.append(f"manifest missing target: {rel}")

    # Migration artifacts should not stay active.
    for legacy in ["spec/legacy-map.json", "spec/legacy-triage.json"]:
        if legacy in manifest["active_specs"]:
            errors.append(f"legacy artifact still active: {legacy}")

    if "spec/repo-delivery-contract.json" not in manifest["active_specs"]:
        errors.append("manifest missing active spec: spec/repo-delivery-contract.json")

    # Authority owners must exist.
    for domain, meta in authority["domains"].items():
        for key in ["owner", "related_owner"]:
            if key in meta and not (ROOT / meta[key]).exists():
                errors.append(f"authority-map missing {key} target for {domain}: {meta[key]}")
        for mirror in meta.get("mirrors", []):
            if not (ROOT / mirror).exists():
                errors.append(f"authority-map missing mirror target for {domain}: {mirror}")


    # Literal source anchors must remain verbatim across raw memory, owner specs, evals, and drift guards.
    check_equal(
        "requirement-memory source anchor login_gate",
        literal_source_anchors["login_gate"],
        req["source_anchors"]["authentication"]["login_gate"],
    )
    check_equal(
        "requirement-memory source anchor primary_login_method",
        literal_source_anchors["primary_login_method"],
        req["source_anchors"]["authentication"]["primary_login_method"],
    )
    check_equal(
        "requirement-memory source anchor purchase_authority",
        literal_source_anchors["purchase_authority"],
        req["source_anchors"]["commerce"]["purchase_authority"],
    )
    check_equal(
        "requirement-memory source anchor top_level_navigation",
        literal_source_anchors["top_level_navigation"],
        req["source_anchors"]["navigation"]["top_level_information_architecture"],
    )
    check_equal(
        "requirement-memory source anchor audio_presentation_policy",
        literal_source_anchors["audio_presentation_policy"],
        req["source_anchors"]["audio"]["presentation_policy"],
    )
    check_equal(
        "requirement-memory source anchor default_learning_path",
        literal_source_anchors["default_learning_path"],
        req["source_anchors"]["learning_path"]["default_strategy"],
    )

    check_equal(
        "account-sync source anchor login_gate",
        literal_source_anchors["login_gate"],
        auth["source_anchors"]["login_gate"],
    )
    check_equal(
        "account-sync source anchor primary_login_method",
        literal_source_anchors["primary_login_method"],
        auth["source_anchors"]["primary_login_method"],
    )
    check_equal(
        "account-sync source anchor purchase_authority",
        literal_source_anchors["purchase_authority"],
        auth["source_anchors"]["purchase_authority"],
    )
    check_equal(
        "platform-contract source anchor top_level_navigation",
        literal_source_anchors["top_level_navigation"],
        platform["source_anchors"]["top_level_information_architecture"],
    )
    check_equal(
        "interactions source anchor audio_presentation_policy",
        literal_source_anchors["audio_presentation_policy"],
        interactions["source_anchors"]["audio_presentation_policy"],
    )
    check_equal(
        "product-core source anchor default_learning_path",
        literal_source_anchors["default_learning_path"],
        product["source_anchors"]["default_learning_path"],
    )

    hr13 = find_by_id(evals["regressions"], "HR-13")
    if hr13:
        check_equal(
            "HR-13 must_preserve_source_anchors",
            anchor_texts("login_gate"),
            hr13["must_preserve_source_anchors"],
        )

    hr14 = find_by_id(evals["regressions"], "HR-14")
    if hr14:
        check_equal(
            "HR-14 must_preserve_source_anchors",
            anchor_texts("primary_login_method", "purchase_authority"),
            hr14["must_preserve_source_anchors"],
        )

    hr15 = find_by_id(evals["regressions"], "HR-15")
    if hr15:
        check_equal(
            "HR-15 must_preserve_source_anchors",
            anchor_texts("top_level_navigation"),
            hr15["must_preserve_source_anchors"],
        )

    hr16 = find_by_id(evals["regressions"], "HR-16")
    if hr16:
        check_equal(
            "HR-16 must_preserve_source_anchors",
            anchor_texts("audio_presentation_policy"),
            hr16["must_preserve_source_anchors"],
        )

    hr17 = find_by_id(evals["regressions"], "HR-17")
    if hr17:
        check_equal(
            "HR-17 must_preserve_source_anchors",
            anchor_texts(
                "login_gate",
                "primary_login_method",
                "purchase_authority",
                "top_level_navigation",
                "audio_presentation_policy",
                "default_learning_path",
            ),
            hr17["must_preserve_source_anchors"],
        )

    hr18 = find_by_id(evals["regressions"], "HR-18")
    if hr18:
        check_equal(
            "HR-18 must_preserve_source_anchors",
            anchor_texts("default_learning_path"),
            hr18["must_preserve_source_anchors"],
        )

    gt08 = find_by_id(evals["golden_tasks"], "GT-08")
    if gt08:
        check_equal(
            "GT-08 must_preserve_source_anchors",
            anchor_texts("top_level_navigation"),
            gt08["must_preserve_source_anchors"],
        )

    gt09 = find_by_id(evals["golden_tasks"], "GT-09")
    if gt09:
        check_equal(
            "GT-09 must_preserve_source_anchors",
            anchor_texts("purchase_authority"),
            gt09["must_preserve_source_anchors"],
        )

    gt10 = find_by_id(evals["golden_tasks"], "GT-10")
    if gt10:
        check_equal(
            "GT-10 must_preserve_source_anchors",
            anchor_texts("login_gate"),
            gt10["must_preserve_source_anchors"],
        )

    gt11 = find_by_id(evals["golden_tasks"], "GT-11")
    if gt11:
        check_equal(
            "GT-11 must_preserve_source_anchors",
            anchor_texts("login_gate", "primary_login_method", "purchase_authority"),
            gt11["must_preserve_source_anchors"],
        )

    gt12 = find_by_id(evals["golden_tasks"], "GT-12")
    if gt12:
        check_equal(
            "GT-12 must_preserve_source_anchors",
            anchor_texts(
                "login_gate",
                "primary_login_method",
                "purchase_authority",
                "top_level_navigation",
                "audio_presentation_policy",
                "default_learning_path",
            ),
            gt12["must_preserve_source_anchors"],
        )

    gt13 = find_by_id(evals["golden_tasks"], "GT-13")
    if gt13:
        check_equal(
            "GT-13 must_preserve_source_anchors",
            anchor_texts("default_learning_path"),
            gt13["must_preserve_source_anchors"],
        )

    p15 = find_by_id(perturbation_audit["perturbations"], "P-15")
    if p15:
        check_equal(
            "P-15 must_preserve_source_anchors",
            anchor_texts("purchase_authority"),
            p15["must_preserve_source_anchors"],
        )

    p18 = find_by_id(perturbation_audit["perturbations"], "P-18")
    if p18:
        check_equal(
            "P-18 must_preserve_source_anchors",
            anchor_texts("login_gate"),
            p18["must_preserve_source_anchors"],
        )

    p19 = find_by_id(perturbation_audit["perturbations"], "P-19")
    if p19:
        check_equal(
            "P-19 must_preserve_source_anchors",
            anchor_texts("primary_login_method"),
            p19["must_preserve_source_anchors"],
        )

    p20 = find_by_id(perturbation_audit["perturbations"], "P-20")
    if p20:
        check_equal(
            "P-20 must_preserve_source_anchors",
            anchor_texts("top_level_navigation"),
            p20["must_preserve_source_anchors"],
        )

    p21 = find_by_id(perturbation_audit["perturbations"], "P-21")
    if p21:
        check_equal(
            "P-21 must_preserve_source_anchors",
            anchor_texts("audio_presentation_policy"),
            p21["must_preserve_source_anchors"],
        )

    p22 = find_by_id(perturbation_audit["perturbations"], "P-22")
    if p22:
        check_equal(
            "P-22 must_preserve_source_anchors",
            anchor_texts("default_learning_path"),
            p22["must_preserve_source_anchors"],
        )

    check_equal(
        "perturbation audit required_literal_source_anchors",
        anchor_texts(
            "login_gate",
            "primary_login_method",
            "purchase_authority",
            "top_level_navigation",
            "audio_presentation_policy",
            "default_learning_path",
        ),
        perturbation_audit["audit_summary"]["restatement_capability_after_perturbation"][
            "required_literal_source_anchors"
        ],
    )
