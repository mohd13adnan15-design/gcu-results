from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


SCRIPT_PATH = Path(__file__).resolve().parent / "build_grade_card_docx.py"
SPEC = importlib.util.spec_from_file_location("build_grade_card_docx", SCRIPT_PATH)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class GradeCardTemplateTests(unittest.TestCase):
    def test_document_xml_is_hard_coded_word_content_with_only_small_asset_images(self) -> None:
        xml = builder.build_document_xml()

        self.assertIn("GARDEN CITY", xml)
        self.assertIn("UNIVERSITY", xml)
        self.assertIn("COURSE CODE", xml)
        self.assertIn("SEMESTER GRADE POINT AVERAGE", xml)
        self.assertIn("<w:drawing>", xml)
        self.assertNotIn("GCU Grade Card Template", xml)
        self.assertNotIn("grade-card-template.png", xml)

    def test_builder_uses_only_whitelisted_small_assets_not_full_page_template(self) -> None:
        source = SCRIPT_PATH.read_text(encoding="utf-8")

        self.assertNotIn("TEMPLATE_IMAGE_PATH", source)
        self.assertNotIn("grade-card-template.png", source)
        self.assertIn("gcu-qr.png", source)
        self.assertIn("gcu-monogram.png", source)
        self.assertIn("gcu-seal.png", source)
        self.assertIn("gcu-footer-signature-center.png", source)
        self.assertIn("gcu-footer-signature-right.png", source)


if __name__ == "__main__":
    unittest.main()
