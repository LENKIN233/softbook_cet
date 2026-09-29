import copy
import json
import unittest
from pathlib import Path

from harness_validator.sections.visual_language import validate


ROOT = Path(__file__).resolve().parents[1]


class Context:
    def __init__(self, visual):
        self.visual = visual
        self.errors = []

    def load(self, name):
        return self.visual

    def check_equal(self, label, expected, actual):
        if expected != actual:
            self.errors.append(label)


class VisualLanguageTests(unittest.TestCase):
    def setUp(self):
        self.visual = json.loads((ROOT / "spec/visual-language.json").read_text())

    def errors(self, visual):
        context = Context(visual)
        validate(context)
        return context.errors

    def test_color_and_layout_improvements_do_not_require_old_mock_or_prose(self):
        visual = copy.deepcopy(self.visual)
        visual["implementation_hypothesis"]["palette"]["self_assess_hex_defaults"]["confident"] = "#147957"
        visual["implementation_hypothesis"]["interaction_silhouettes"]["multiple_choice"]["shape"] = "Readable single-column options at large text sizes"
        self.assertEqual([], self.errors(visual))

    def test_removing_a_library_identity_is_still_rejected(self):
        del self.visual["implementation_hypothesis"]["palette"]["library_identity_hex_defaults"]["reading"]
        self.assertIn("visual baseline library coverage", self.errors(self.visual))

    def test_adding_four_level_self_assessment_is_still_rejected(self):
        self.visual["implementation_hypothesis"]["palette"]["self_assess_hex_defaults"]["unsure"] = "#999999"
        self.assertIn("visual baseline two self-assess states", self.errors(self.visual))

    def test_erasing_an_interaction_is_still_rejected(self):
        del self.visual["implementation_hypothesis"]["interaction_silhouettes"]["swipe"]
        self.assertIn("visual baseline interaction coverage", self.errors(self.visual))


if __name__ == "__main__":
    unittest.main()
