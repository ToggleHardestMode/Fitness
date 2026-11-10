"""Regression tests for the nonmutating B102 iPhone QA browser harness."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from qa_checklist_smoke import IDS, SENTINELS, check_checkout, new_output, validate_download


def fake_report():
    rows = [{"id": ident, "title": ident, "status": "not-run", "note": ""} for ident in IDS]
    for i, status in enumerate(("pass", "fail", "blocked")):
        rows[i]["status"] = status
    rows[0]["note"] = "Synthetic QA note only"
    return {"schema": "fitnesspilot-qa-v1", "previewVersion": "V15.26.12",
            "checkedAt": "2026-11-09T10:00:00.000Z", "results": rows,
            "counts": {"pass": 1, "fail": 1, "blocked": 1, "not-run": 7}}


class ChecklistSmokeTests(unittest.TestCase):
    def test_expected_report_passes(self):
        self.assertEqual(validate_download(fake_report())["cases"], 10)

    def test_duplicate_or_missing_cases_rejected(self):
        data = fake_report()
        data["results"][-1]["id"] = "timer"
        with self.assertRaisesRegex(ValueError, "duplicate|reordered"):
            validate_download(data)

    def test_counts_cannot_be_faked(self):
        data = fake_report()
        data["counts"]["pass"] = 10
        with self.assertRaisesRegex(ValueError, "counts disagree"):
            validate_download(data)

    def test_browser_data_cannot_leak_into_report(self):
        data = fake_report()
        data["results"][0]["title"] = next(iter(SENTINELS.values()))
        with self.assertRaisesRegex(ValueError, "leaked browser storage"):
            validate_download(data)

    def test_no_overwrite_of_prior_evidence(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "evidence"
            new_output(path)
            with self.assertRaisesRegex(ValueError, "already exists"):
                new_output(path)

    def test_checkout_rejects_missing_files(self):
        with TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "package.json"):
                check_checkout(Path(directory))


if __name__ == "__main__":
    unittest.main()
