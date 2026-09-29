from __future__ import annotations

import re


def validate(context) -> None:
    """Validate semantic coverage of defaults, not the quality of a rendered UI.

    Color values, HTML shape, historical storyboards and copied prose are not
    product proofs. Runtime experience checks own readability and operability.
    """
    visual = context.load("visual-language.json")
    defaults = visual.get("implementation_hypothesis", {})
    palette = defaults.get("palette", {})
    required_libraries = {
        "listening", "reading", "cloze", "writing", "translation", "vocabulary", "grammar",
    }
    library_colors = palette.get("library_identity_hex_defaults", {})
    context.check_equal(
        "visual baseline library coverage", required_libraries, set(library_colors),
    )
    self_assess = {
        key: value for key, value in palette.get("self_assess_hex_defaults", {}).items()
        if not key.startswith("_")
    }
    context.check_equal(
        "visual baseline two self-assess states", {"confident", "review"}, set(self_assess),
    )
    for key, value in {**library_colors, **self_assess}.items():
        if not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            context.errors.append(f"visual baseline {key} must have a valid hex color")

    interactions = {
        key for key in defaults.get("interaction_silhouettes", {})
        if not key.startswith("_")
    }
    context.check_equal(
        "visual baseline interaction coverage",
        {"flip", "multiple_choice", "lock", "elimination", "swipe"}, interactions,
    )
