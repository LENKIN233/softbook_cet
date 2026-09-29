import copy
import unittest
from pathlib import Path

from harness_validator.context import ReadOnlyContext
from harness_validator.sections.product_contract_mirrors import validate


ROOT = Path(__file__).resolve().parents[1]


class ProductContext(ReadOnlyContext):
    def __init__(self, overrides):
        super().__init__(root=ROOT, mode="local", section="product_contract_mirrors")
        self.overrides = overrides

    def load(self, name):
        if name in self.overrides:
            return copy.deepcopy(self.overrides[name])
        return super().load(name)


class ProductContractMirrorTests(unittest.TestCase):
    def setUp(self):
        self.context = ProductContext({})
        self.product = self.context.load("product-core.json")

    def findings(self, overrides):
        context = ProductContext(overrides)
        validate(context)
        return context.errors

    def test_meaning_preserving_product_promise_can_be_reworded(self):
        self.product["product_promise"] = "帮助中国大学生用可信、低负担的单卡练习备考 CET4/CET6。"
        self.assertEqual([], self.findings({"product-core.json": self.product}))

    def test_single_card_owner_cannot_disagree_with_preserved_user_intent(self):
        self.product["learning_experience"]["single_card_flow"] = False
        self.assertTrue(any("single-card" in item for item in self.findings({"product-core.json": self.product})))

    def test_space_owner_cannot_disagree_with_preserved_user_intent(self):
        self.product["physical_space"]["is_core_differentiator"] = False
        self.assertTrue(any("physical space" in item for item in self.findings({"product-core.json": self.product})))

    def test_core_interaction_removal_is_still_rejected(self):
        interactions = self.context.load("interactions.json")
        interactions["interactions"] = [item for item in interactions["interactions"] if item["id"] != "flip"]
        self.assertTrue(any("missing core interaction: flip" in item for item in self.findings({"interactions.json": interactions})))

    def test_platform_removal_is_still_rejected(self):
        platform = self.context.load("platform-contract.json")
        platform["release_targets"]["web"] = False
        self.assertTrue(any("platform release targets" in item for item in self.findings({"platform-contract.json": platform})))

    def test_formal_media_trust_boundary_is_still_rejected(self):
        media = self.context.load("trusted-media-run-receipt.json")
        media["producer"]["signer_workflow"] = "untrusted/repository/.github/workflows/review.yml"
        self.assertTrue(any("trusted media receipt fixed workflow" in item for item in self.findings({"trusted-media-run-receipt.json": media})))


if __name__ == "__main__":
    unittest.main()
