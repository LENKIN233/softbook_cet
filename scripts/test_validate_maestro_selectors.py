#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import validate_maestro_selectors as validator


class MaestroSelectorTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.smoke = self.root / "apps/mobile/e2e/maestro"
        self.experience = self.root / "apps/mobile/e2e/experience"
        for name, value in (
            ("ROOT", self.root),
            ("DEFAULT_FLOW_DIR", self.smoke),
            ("EXPERIENCE_FLOW_DIR", self.experience),
        ):
            patch = mock.patch.object(validator, name, value, create=True)
            patch.start()
            self.addCleanup(patch.stop)
        self.write("apps/mobile/App.tsx", '''
<Button testID="learning-help-button" />
<View testID="learning-help-content" />
<Button testID={`learning-option-${optionIndex + 1}`} />
''')

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def run_checker(self, *args):
        output = io.StringIO()
        with mock.patch("sys.argv", ["validate_maestro_selectors.py", *args]):
            with contextlib.redirect_stdout(output):
                status = validator.main()
        return status, output.getvalue()

    def test_default_check_finds_removed_peek_in_experience_subflow(self):
        self.write("apps/mobile/e2e/maestro/smoke.yaml", "- assertVisible: {id: learning-help-button}\n")
        self.write("apps/mobile/e2e/experience/reading.yaml", "- runFlow: subflows/help.yml\n")
        removed = self.write("apps/mobile/e2e/experience/subflows/help.yml", "- tapOn:\n    id: learning-peek-button\n")
        status, output = self.run_checker()
        self.assertEqual(status, 1, output)
        self.assertIn(str(removed), output)
        self.assertIn("learning-peek-button", output)
        self.assertIn("not backed by", output)

    def test_one_click_help_is_valid_without_the_removed_peek_control(self):
        self.write("apps/mobile/e2e/experience/reading.yaml", '''
- tapOn:
    id: learning-help-button
- assertVisible:
    id: learning-help-content
- tapOn:
    id: learning-help-button
- assertNotVisible:
    id: learning-help-content
''')
        status, output = self.run_checker()
        self.assertEqual(status, 0, output)

    def test_experience_scroll_and_parameterized_option_match_source_template(self):
        flow = self.write("apps/mobile/e2e/experience/subflows/reading.yaml", '''
- scrollUntilVisible:
    element:
      id: learning-help-button
    direction: DOWN
- tapOn:
    id: learning-option-${WRONG_OPTION_INDEX}
- tapOn: {id: "learning-option-${WRONG_OPTION_INDEX}", optional: true}
- assertVisible:
    id: 'learning-option-${WRONG_OPTION_INDEX}'
''')
        references = validator.collect_id_references(flow)
        self.assertEqual([reference[2] for reference in references], [
            "learning-help-button",
            "learning-option-${WRONG_OPTION_INDEX}",
            "learning-option-${WRONG_OPTION_INDEX}",
            "learning-option-${WRONG_OPTION_INDEX}",
        ])
        status, output = self.run_checker("--file", str(flow))
        self.assertEqual(status, 0, output)

    def test_smoke_scroll_is_still_rejected(self):
        self.write("apps/mobile/e2e/maestro/nested/smoke.yaml", '''
- scrollUntilVisible:
    element:
      id: learning-help-button
    direction: DOWN
''')
        status, output = self.run_checker()
        self.assertEqual(status, 1, output)
        self.assertIn("forbidden in one-screen smoke flows", output)

    def test_parameter_does_not_allow_an_unknown_selector_family(self):
        flow = self.write("apps/mobile/e2e/experience/reading.yaml", '''
- tapOn:
    id: removed-option-${WRONG_OPTION_INDEX}
''')
        status, output = self.run_checker("--file", str(flow))
        self.assertEqual(status, 1, output)
        self.assertIn("removed-option-${WRONG_OPTION_INDEX}", output)
        self.assertIn("not backed by", output)

    def test_visible_text_selectors_remain_rejected_in_both_flow_directories(self):
        for directory in ("maestro", "experience"):
            with self.subTest(directory=directory):
                flow = self.write(f"apps/mobile/e2e/{directory}/text.yaml", '- tapOn: "看判断方法"\n')
                status, output = self.run_checker("--file", str(flow))
                self.assertEqual(status, 1, output)
                self.assertIn("must use a stable id selector", output)


if __name__ == "__main__":
    unittest.main()
