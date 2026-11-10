"""B102: exercise the iPhone QA checklist in disposable localhost Chromium.

This tests rendering, status selections, JSON download, reset-on-reload and
non-mutation of synthetic storage sentinels. It does not test real iPhone Safari.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading

VERSION = "V15.26.12"
IDS = ("version", "plan", "set", "focus", "repeat", "safety",
       "backup", "restore", "timer", "history")
EXPECTED_COUNTS = {"pass": 1, "fail": 1, "blocked": 1, "not-run": 7}
SENTINELS = {
    "fitnesspilot.preview.v101.v1": "b102-fictional-workout-sentinel",
    "fitnesspilot.preview.v101.foodDiary.v1": "b102-fictional-food-sentinel",
}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def check_checkout(root):
    for path in ("package.json", "preview-v101/index.html", "preview-v101/qa.html",
                 "preview-v101/qa.css", "preview-v101/qa-checklist.js"):
        if not (root / path).is_file():
            raise ValueError("Missing FitnessPilot source file: " + path)
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
    if pkg.get("scripts", {}).get("test") != "node --test tests/*.test.mjs":
        raise ValueError("Unexpected FitnessPilot package.json test command")
    main = (root / "preview-v101/index.html").read_text(encoding="utf-8")
    if f"FITNESSPILOT {VERSION} PREVIEW" not in main:
        raise ValueError(f"Expected preview banner {VERSION} not found in checkout")


def new_output(path):
    if path.exists():
        raise ValueError("Evidence folder already exists: " + str(path))
    if not path.parent.is_dir():
        raise ValueError("Evidence parent folder does not exist: " + str(path.parent))
    path.mkdir()


def validate_download(report):
    if not isinstance(report, dict) or report.get("schema") != "fitnesspilot-qa-v1":
        raise ValueError("QA report schema is not fitnesspilot-qa-v1")
    if report.get("previewVersion") != VERSION:
        raise ValueError("QA report preview version is wrong")
    rows = report.get("results")
    if not isinstance(rows, list) or len(rows) != len(IDS):
        raise ValueError("QA report must contain ten case results")
    if [r.get("id") for r in rows if isinstance(r, dict)] != list(IDS):
        raise ValueError("QA report has missing, duplicate or reordered cases")
    expected = dict(EXPECTED_COUNTS)
    seen = {"pass": 0, "fail": 0, "blocked": 0, "not-run": 0}
    for row in rows:
        if row.get("status") not in seen:
            raise ValueError("QA report has an invalid test status")
        if not isinstance(row.get("note"), str) or len(row["note"]) > 400:
            raise ValueError("QA report contains invalid case notes")
        seen[row["status"]] += 1
    if report.get("counts") != expected or seen != expected:
        raise ValueError("QA report status counts disagree with the selected cases")
    if rows[0]["note"] != "Synthetic QA note only":
        raise ValueError("QA report lost the synthetic note")
    if not isinstance(report.get("checkedAt"), str) or not report["checkedAt"].endswith("Z"):
        raise ValueError("QA report lacks ISO timestamp")
    serialized = json.dumps(report)
    if any(value in serialized for value in SENTINELS.values()):
        raise ValueError("QA report leaked browser storage data")
    return {"cases": len(rows), "counts": expected, "version": VERSION}


def smoke(root, output, chromium=None, headed=False):
    from playwright.sync_api import sync_playwright

    check_checkout(root)
    new_output(output)
    outcome = {"result": "FAIL", "target": "disposable-localhost",
               "browser": "Playwright Chromium", "test": "B102 QA checklist UI"}
    server = None
    thread = None
    try:
        server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(QuietHandler, directory=str(root)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/preview-v101/qa.html"
        with sync_playwright() as playwright:
            kw = {"headless": not headed}
            if chromium is not None:
                kw["executable_path"] = str(chromium)
            browser = playwright.chromium.launch(**kw)
            try:
                with browser.new_context(accept_downloads=True, service_workers="block",
                                         viewport={"width": 390, "height": 844}) as context:
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    response = page.goto(url, wait_until="domcontentloaded")
                    assert response is not None and response.status == 200, "QA page HTTP status not 200"
                    cases = page.locator("#checks .check")
                    page.locator("#checks .check select").first.wait_for()
                    assert cases.count() == 10, "QA page did not render ten controls"
                    assert "V15.26.12" in page.title(), "QA page title has wrong version"
                    assert page.locator("header a.action").get_attribute("href") == "./?v=152612", "Preview link mismatch"
                    assert "10 Not run" in page.locator("#counts").inner_text(), "Initial counts are wrong"
                    page.evaluate("payload => {for(const [k,v] of Object.entries(payload)) localStorage.setItem(k,v)}", SENTINELS)
                    choices = page.locator("#checks .check select")
                    choices.nth(0).select_option("pass")
                    choices.nth(1).select_option("fail")
                    choices.nth(2).select_option("blocked")
                    page.locator("#checks .check textarea").first.fill("Synthetic QA note only")
                    assert "1 Pass" in page.locator("#counts").inner_text()
                    assert "1 Fail" in page.locator("#counts").inner_text()
                    assert "1 Blocked" in page.locator("#counts").inner_text()
                    with page.expect_download() as event:
                        page.locator("#download-report").click()
                    download = event.value
                    assert download.suggested_filename == "fitnesspilot-v152612-qa.json", "Downloaded filename mismatch"
                    payload = json.loads(Path(download.path()).read_text(encoding="utf-8"))
                    checked = validate_download(payload)
                    assert page.evaluate("payload => Object.fromEntries(Object.keys(payload).map(k => [k, localStorage.getItem(k)]))", SENTINELS) == SENTINELS, "Checklist mutated either app storage key"
                    page.reload(wait_until="domcontentloaded")
                    page.locator("#checks .check select").first.wait_for()
                    assert "0 Pass" in page.locator("#counts").inner_text(), "QA selections persisted unexpectedly"
                    assert "10 Not run" in page.locator("#counts").inner_text(), "QA reload did not reset marks"
                    assert page.evaluate("payload => Object.fromEntries(Object.keys(payload).map(k => [k, localStorage.getItem(k)]))", SENTINELS) == SENTINELS, "Reload mutated browser storage"
                    assert not errors, "Browser JavaScript errors: " + " | ".join(errors[:4])
                    outcome.update({"result": "PASS", "cases_rendered": 10,
                                    "report_validated": checked, "storage_unchanged": True,
                                    "reload_clears_marks": True, "browser_errors": []})
            finally:
                browser.close()
    except Exception as error:
        outcome["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()
        if thread is not None:
            thread.join(timeout=3)
        (output / "report.json").write_text(json.dumps(outcome, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return outcome


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chromium", type=Path, default=None)
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()
    try:
        result = smoke(args.repo_root.expanduser().resolve(),
                       args.output.expanduser().resolve(), args.chromium, args.headed)
    except (ValueError, OSError) as error:
        parser.exit(2, f"B102 input error: {error}\n")
    print(json.dumps(result, indent=2, sort_keys=True))
    if result["result"] != "PASS":
        parser.exit(1, "B102 QA page smoke FAIL — see report.json\n")


if __name__ == "__main__":
    main()
