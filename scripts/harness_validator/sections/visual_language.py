# ─────────────────────────────────────────────────────────────
# Visual language / design harness gates.
# These keep spec/visual-language.json, docs/design/canon.md and
# docs/design/visual-reference.html from drifting apart, and catch
# the exact anti-patterns that slipped past review last round
# (4-level self-assess drift, sizeless inline SVGs, legacy tokens).
# ─────────────────────────────────────────────────────────────
import re

vl_path = SPEC / "visual-language.json"
canon_path = ROOT / "docs" / "design" / "canon.md"
vref_path = ROOT / "docs" / "design" / "visual-reference.html"
storyboard_html_path = ROOT / "docs" / "design" / "storyboards" / "learning-space-motion-prototype-v1.html"
storyboard_md_path = ROOT / "docs" / "design" / "storyboards" / "learning-space-motion-prototype-v1.md"

if not vl_path.exists():
    errors.append("missing spec/visual-language.json")
elif not canon_path.exists():
    errors.append("missing docs/design/canon.md")
elif not vref_path.exists():
    errors.append("missing docs/design/visual-reference.html")
elif not storyboard_html_path.exists():
    errors.append("missing docs/design/storyboards/learning-space-motion-prototype-v1.html")
elif not storyboard_md_path.exists():
    errors.append("missing docs/design/storyboards/learning-space-motion-prototype-v1.md")
else:
    vl = json.loads(vl_path.read_text(encoding="utf-8"))
    canon_text = canon_path.read_text(encoding="utf-8")
    vref_text = vref_path.read_text(encoding="utf-8")
    storyboard_html = storyboard_html_path.read_text(encoding="utf-8")
    storyboard_md = storyboard_md_path.read_text(encoding="utf-8")

    # 1. Library identity must have exactly the 7 required libraries with
    #    matching keys between product_truth and implementation_hypothesis.
    required_libs = {"listening", "reading", "cloze", "writing", "translation", "vocabulary", "grammar"}
    lib_hex = vl["implementation_hypothesis"]["palette"]["library_identity_hex_defaults"]
    if set(lib_hex.keys()) != required_libs:
        errors.append(
            f"visual-language.json library_identity_hex_defaults keys {sorted(lib_hex.keys())} "
            f"must equal {sorted(required_libs)}"
        )

    # 2. Self-assess must be exactly 2 levels with named keys — catches
    #    the exact drift we just fixed (4-level 掌握/知道/不确定/忘了).
    sa_hex = vl["implementation_hypothesis"]["palette"]["self_assess_hex_defaults"]
    sa_keys = {k for k in sa_hex.keys() if not k.startswith("_")}
    if sa_keys != {"confident", "review"}:
        errors.append(
            f"visual-language.json self_assess_hex_defaults must be exactly "
            f"{{'confident','review'}}, got {sorted(sa_keys)}"
        )

    # 2b. Accepted motion storyboard must not render flip self-assess
    #     as the current library accent. It should prove AP-23 directly.
    storyboard_lower = storyboard_html.lower()
    for snippet in [
        f"--confident: {sa_hex['confident'].lower()}",
        f"--review: {sa_hex['review'].lower()}",
        'class="pill confident"',
        'class="pill review"',
        "@media (prefers-reduced-motion: reduce)",
        "front / back crossfade",
        'class="reduced-actions"',
    ]:
        if snippet not in storyboard_lower:
            errors.append(
                "learning-space-motion-prototype-v1.html missing storyboard proof snippet: "
                + snippet
            )
    for snippet in [
        "`有把握` = mint",
        "`再回看` = amber",
        "explicit fallback states",
    ]:
        if snippet not in storyboard_md:
            errors.append(
                "learning-space-motion-prototype-v1.md missing storyboard proof snippet: "
                + snippet
            )

    # 3. Mirror gate: the 7 library hexes + 2 self-assess hexes must appear
    #    verbatim in canon.md. This is the small product_truth subset —
    #    other tokens (neutrals, glass, typography) stay tunable.
    locked_hexes = list(lib_hex.values()) + [sa_hex[k] for k in sa_keys]
    canon_upper = canon_text.upper()
    for h in locked_hexes:
        if h.upper() not in canon_upper:
            errors.append(f"canon.md missing locked token hex {h} (visual-language.json)")

    # 4. Removed self-assess CSS vars must not reappear in the rendered anchor.
    #    (--fb-prof / --fb-forgot were renamed to --ok / --err; --fb-know / --fb-unsure removed.)
    legacy_vars = ["--fb-know", "--fb-unsure", "--fb-prof", "--fb-forgot"]
    for tok in legacy_vars:
        # POSITIVE-region scoping: allow tokens inside an explicit NEGATIVE block.
        scrubbed = re.sub(
            r"<!--\s*NEGATIVE\s*-->.*?<!--\s*/NEGATIVE\s*-->",
            "",
            vref_text,
            flags=re.DOTALL,
        )
        if tok in scrubbed:
            errors.append(
                f"visual-reference.html still references removed token {tok}; "
                "either delete the usage or move it into a <!-- NEGATIVE --> block"
            )

    # 5. Inline <svg> elements in the positive region must have explicit
    #    width/height OR a sized parent class (.sb / .tab / .ico sized via selector).
    #    Catches the exact 'SVG ate the row' bug that shipped last turn.
    positive_html = re.sub(
        r"<!--\s*NEGATIVE\s*-->.*?<!--\s*/NEGATIVE\s*-->",
        "",
        vref_text,
        flags=re.DOTALL,
    )
    svg_tags = re.findall(r"<svg\b[^>]*>", positive_html)
    for tag in svg_tags:
        # Skip svgs that declare explicit dimensions.
        if re.search(r'\bwidth\s*=', tag) and re.search(r'\bheight\s*=', tag):
            continue
        # Skip svgs carrying a class whose CSS rule sets width/height.
        # Known sized classes: sb, tab, ico (.sb svg / .tab svg / svg.ico all set explicit dimensions).
        if re.search(r'class\s*=\s*"[^"]*\b(sb|tab|ico)\b', tag):
            continue
        errors.append(
            f"visual-reference.html has an <svg> without width/height and no sized parent class: {tag[:80]}…"
        )

    # 6. Forbidden design patterns: restricted to POSITIVE regions only.
    #    NEGATIVE/Don't-gallery blocks are exempt by design.
    for rule in vl.get("implementation_hypothesis", {}).get("forbidden_design_patterns", {}).get("tokens", []):
        if re.search(rule["pattern"], positive_html, flags=re.IGNORECASE):
            errors.append(
                f"visual-reference.html POSITIVE region hits forbidden pattern "
                f"{rule['id']} ({rule['reason']}): /{rule['pattern']}/"
            )

    # 7. Interaction silhouettes must cover exactly the 5 core interactions.
    required_silhouettes = {"flip", "multiple_choice", "lock", "elimination", "swipe"}
    sil = vl.get("implementation_hypothesis", {}).get("interaction_silhouettes", {})
    sil_keys = {k for k in sil.keys() if not k.startswith("_")}
    if sil_keys != required_silhouettes:
        errors.append(
            f"visual-language.json interaction_silhouettes must cover exactly "
            f"{sorted(required_silhouettes)}, got {sorted(sil_keys)}"
        )

    # 8. Design review checklist must expose both universal and conditional groups.
    chk = vl.get("implementation_hypothesis", {}).get("design_review_checklist", {})
    if not chk.get("universal") or not chk.get("conditional"):
        errors.append("visual-language.json design_review_checklist missing universal or conditional groups")

    # 9. User-facing UI must not be implemented directly from current RN code
    #    or taste; it needs a design artifact before implementation.
    ui_gate_truth = vl.get("product_truth", {}).get("user_facing_ui_requires_design_artifact", {})
    if ui_gate_truth.get("violation_is") != "delivery_blocker":
        errors.append("visual-language.json user_facing_ui_requires_design_artifact must be a delivery_blocker")
    accepted_artifacts = ui_gate_truth.get("accepted_artifacts", [])
    for artifact in [
        "docs/design/visual-reference.html",
        "docs/design/canon.md",
        "docs/design/interaction-motion/*.md",
        "docs/design/physical-space/*.md",
        "docs/design/mocks/*.md",
        "docs/design/storyboards/*.md",
        "linked_external_design_file",
    ]:
        if artifact not in accepted_artifacts:
            errors.append(f"visual-language.json user_facing_ui_requires_design_artifact missing accepted artifact {artifact}")
    if "task_local_design_brief_answering_design_review_checklist" in accepted_artifacts:
        errors.append("visual-language.json must not accept task-local design briefs as implementation authority")

    ui_gate_impl = vl.get("implementation_hypothesis", {}).get("design_artifact_gate", {})
    impl_accepted_artifacts = ui_gate_impl.get("accepted_artifacts", [])
    if "task_local_design_brief_answering_design_review_checklist" in impl_accepted_artifacts:
        errors.append("visual-language.json design_artifact_gate must not accept task-local design briefs as implementation authority")
    check_equal(
        "visual-language design_artifact_gate required_before",
        "implementation_that_changes_user_facing_UI",
        ui_gate_impl.get("required_before"),
    )
    check_equal(
        "visual-language design_artifact_gate pull_request_must_state",
        "design_artifact_source_implementation_mapping_and_design_review_checklist",
        ui_gate_impl.get("pull_request_must_state"),
    )
    if "task_local_design_brief_for_implementation_pr" not in ui_gate_impl.get("not_accepted_as_design_authority", []):
        errors.append("visual-language.json design_artifact_gate must reject task-local briefs as implementation authority")

    vl_ap09 = find_by_id(vl.get("anti_patterns", []), "VL-AP-09")
    if vl_ap09:
        check_equal(
            "VL-AP-09 name",
            "implementing_user_facing_UI_without_design_artifact",
            vl_ap09["name"],
        )
        check_equal(
            "VL-AP-09 correction",
            "create_or_reference_accepted_design_artifact_before_RN_or_other_user_facing_implementation",
            vl_ap09["correction"],
        )
