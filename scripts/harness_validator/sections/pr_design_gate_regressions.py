from __future__ import annotations


def validate(context) -> None:
    """Reproduce the old false rejections and ceremonial false acceptance.

    These checks test a declaration validator. They intentionally do not claim
    the HTML fixtures are usable: runtime observation remains the UX judge.
    """
    gate = context.load_validator_module("scripts/validate_pr_design_gate.py")

    def expect(label, body, files, allowed):
        failures = gate.validate(body, files)
        if bool(failures) == allowed:
            context.errors.append(f"{label}: unexpected declaration result {failures}")

    observed = """## 验证

在 Web 320px 视口完成错误验证码重试，再输入正确验证码进入学习。
iOS 与 Android 本轮未运行，不能据此声称原生体验通过。
"""
    space = "apps/mobile/src/space/SpaceSurface.tsx"
    for path in [
        "apps/mobile/App.tsx", "apps/web/src/App.tsx", "apps/web/src/App.css",
        "apps/mobile/src/visual/tokens.ts", "apps/mobile/src/visual/studio.ts",
        "docs/design/mocks/new-space-navigation-v2.html",
    ]:
        expect(f"missing validation for {path}", "", [path], False)
        expect(f"natural validation for {path}", observed, [path], True)

    expect("new Space design is not limited to old filenames", observed + """
- Design artifact: docs/design/decisions/space-focused-navigation-v2.md
- Physical space artifact: docs/design/physical-space/space-focused-navigation-v2.md
""", [space], True)
    expect("direct implementation needs no separate design artifact", observed, [space], True)
    expect("explicit unverified scope is a valid declaration", """## 验证范围
仅完成代码检查；尚未运行设备。键盘遮挡是否改善仍未验证，交由相应风险审查决定是否可交付。
""", ["apps/mobile/App.tsx"], True)
    expect("short inline declaration", "验证：Chrome 里完成登录，Android 尚未运行。", [space], True)
    expect("descriptive link preserves visible observations", """## 验证
[Chrome 320px 下错误验证码重试后登录成功；Android 本轮未运行](https://example.test/run/123)
""", [space], True)
    expect("setext validation heading", """验证
----
Chrome 320px 下错误验证码重试后登录成功；Android 本轮未运行。
""", [space], True)
    expect("nested headings retain observations", """## Testing
### Web
Logged in at a narrow viewport and returned to the current card.
### Android
Not run; no native behavior claim.
## Changes
Removed repeated description.
""", [space], True)

    for placeholder in ["", "- Passed", "- N/A", "- [ ]", "<!-- TODO run app -->", "---", "* * *", "___"]:
        expect("empty or generic declaration", "## 验证\n" + placeholder, [space], False)
    expect("headings inside example are not declarations", "```md\n## 验证\n运行通过。\n```", [space], False)
    expect("design link alone is not task validation", "## 验证\nhttps://example.invalid/not-a-design", [space], False)
    expect("bare URL label remains a reference", "## 验证\n[https://example.invalid/not-a-design](https://example.invalid/not-a-design)", [space], False)
    expect("placeholder link label is not validation", "## 验证\n[Passed](https://example.invalid/not-a-design)", [space], False)
    expect("old keyword ritual is not task validation", """
- Design artifact: https://example.invalid/not-a-design
- Physical space artifact: https://example.invalid/not-a-design
- Implementation mapping: apps/mobile/src/space/SpaceSurface.tsx
- Unimplemented design gaps: No known gaps.
- Universal Q1-Q4: Q1 current library; Q2 focal; Q3 silhouette; Q4 forbidden.
- Conditional Q5-Q6: Q5 phone; Q6 learning.
- AP-22: AP-22.
- AP-23: AP-23.
""", [space], False)
    expect("test-only changes need no experience record", "", [
        "apps/mobile/__tests__/App.test.tsx", "apps/web/src/App.test.tsx",
        "apps/mobile/acceptance/controlledPilotAuthorizedPayload.acceptance.tsx",
    ], True)

    # Old scanner rejected the fluid grid and external tokens, but accepted the
    # clipped button and incorrectly mapped colors after keyword comments.
    # None can now receive an automated UX verdict from its source spelling.
    samples = {
        "fluid-grid": '<meta name="viewport"><style>.phone{width:min(100%,393px)}.options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(12rem,100%),1fr))}</style>',
        "clipped-button": '<style>.phone{width:393px;overflow-x: hidden}.child{width:900px}@media(max-width:393px){.phone{width:100%}}</style><button class="child">Continue</button>',
        "fixed-actions": '<style>.actions{position:fixed;bottom:0;width:100%}</style>',
        "reordered-fixed-actions": '<style>.actions{width:100%;bottom:0;position:fixed}</style>',
        "external-tokens": '<link rel="stylesheet" href="tokens.css"><button class="confident">有把握</button><button class="review">再回看</button>',
        "misleading-color-comment": '<!-- mint amber --><button style="color:red">有把握</button><button style="color:green">再回看</button>',
    }
    with context.temporary_directory(prefix="experience-record-probes-") as fixture_root:
        fixture_mocks = context.fixture_path(fixture_root / "docs/design/mocks")
        fixture_mocks.mkdir(parents=True)
        gate.ROOT = fixture_root
        for label, html in samples.items():
            artifact = context.fixture_path(fixture_mocks / f"{label}.html")
            artifact.write_text(html, encoding="utf-8")
            expect(label + " requires a declared scope", "", [f"docs/design/mocks/{label}.html"], False)
            expect(label + " can be declared unverified", "## 验证\n草稿尚未渲染；不能判断裁切、颜色语义或操作是否可用。", [f"docs/design/mocks/{label}.html"], True)

    card = ["apps/mobile/src/learning/localCardRecords.ts"]
    expect("content handoff remains required", observed, card, False)
    expect("local content authorship is not a handoff", """
- Card content handoff: local softbook_cet edit
- Card content validation: dry-run import
""", card, False)
    expect("card make handoff remains accepted", """
- Card content handoff: external_workspace:/Users/lenkin/programing/card make PR #12 exported payload.
- Card content validation: dry-run import and catalog_audit_result recorded.
""", card, True)

    cli = context.run_validator(
        "scripts/validate_pr_design_gate.py", "--changed-file", "apps/web/src/App.css",
        env={"PR_BODY": observed},
    )
    if cli.returncode != 0 or "declaration only, not UX acceptance" not in cli.stdout:
        context.errors.append("experience record CLI must explicitly distinguish a record from UX acceptance")
