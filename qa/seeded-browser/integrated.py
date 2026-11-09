"""B096 local-only Chromium smoke across real FitnessPilot preview screens.

Runs exclusively in disposable Playwright contexts on a localhost static checkout.
Offline/service-worker upgrade testing is deliberately deferred (owner KIV B098).
No personal browser profile, public Pages URL, server upload, or real records.
"""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import threading

from fixture import FOOD_KEY, WORKOUT_KEY, LAST_DAY, create_fixtures, validate_fixture
from verify import QuietHandler, check_repo, get_store, set_seed


SYNTHETIC_CSV = (
    "day,workout,exercise,muscle,sets,rep_min,rep_max,rest_seconds\n"
    "Wed,Synthetic Browser Imported,Synthetic Cable Row,Back,1,8,12,90\n"
)
PASSPHRASE = "Synthetic browser-only recovery passphrase 2026!"


def go(page, section):
    page.locator('nav.bottom-tabs button[data-page="' + section + '"]').click()


def upload_bytes(page, selector, filename, payload, mime="application/json"):
    page.locator(selector).set_input_files({
        "name": filename, "mimeType": mime, "buffer": payload
    })


def assert_absent(page):
    assert page.evaluate("localStorage.getItem(arguments[0])", WORKOUT_KEY) is None
    assert page.evaluate("localStorage.getItem(arguments[0])", FOOD_KEY) is None


def smoke(repo, chromium_binary=None, headed=False):
    from playwright.sync_api import sync_playwright

    check_repo(repo)
    if not (repo / "preview-v101/encrypted-backup.html").is_file():
        raise ValueError("Expected B110 preview vault is missing.")
    fixtures = create_fixtures()
    validate_fixture(fixtures)

    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(QuietHandler, directory=str(repo))
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}/preview-v101"
    findings = []
    errors = []

    try:
        with sync_playwright() as playwright:
            kwargs = {"headless": not headed}
            if chromium_binary is not None:
                kwargs["executable_path"] = str(chromium_binary)
            browser = playwright.chromium.launch(**kwargs)
            try:
                with browser.new_context(
                    accept_downloads=True,
                    service_workers="block",
                    viewport={"width": 390, "height": 844},
                ) as context:
                    page = context.new_page()
                    page.set_default_timeout(15000)
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    page.goto(base + "/index.html", wait_until="domcontentloaded")
                    page.locator("nav.bottom-tabs button[data-page='plan']").wait_for()
                    set_seed(page, fixtures)
                    page.reload(wait_until="domcontentloaded")
                    page.locator("nav.bottom-tabs button[data-page='plan']").wait_for()
                    assert "FITNESSPILOT V" in page.locator(".preview-banner").inner_text()
                    assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    findings.append("Main app loaded two separate fictional stores without changing either.")

                    # Plan must be an explicit save, never a silent assignment rewrite.
                    go(page, "plan")
                    page.locator("#schedule-form").wait_for()
                    before = get_store(page, WORKOUT_KEY)
                    page.locator("#day2").select_option("fixture-upper-001")
                    assert get_store(page, WORKOUT_KEY) == before
                    page.locator("#schedule-form button[type=submit]").click()
                    planned = get_store(page, WORKOUT_KEY)
                    assert planned["assignments"]["2"] == "fixture-upper-001"
                    assert planned["logs"] == before["logs"]
                    findings.append("Plan changes only the explicitly saved weekday assignment; existing sets remain.")

                    # CSV import previews first and adds only a new template.
                    before = get_store(page, WORKOUT_KEY)
                    upload_bytes(page, "#csv-file", "synthetic.csv",
                                 SYNTHETIC_CSV.encode(), "text/csv")
                    page.locator("[data-action='confirm-csv']").wait_for()
                    assert get_store(page, WORKOUT_KEY) == before
                    page.locator("[data-action='confirm-csv']").click()
                    imported = get_store(page, WORKOUT_KEY)
                    assert len(imported["templates"]) == len(before["templates"]) + 1
                    assert imported["logs"] == before["logs"]
                    assert imported["assignments"] == before["assignments"]
                    assert any(t["name"] == "Synthetic Browser Imported"
                               for t in imported["templates"])
                    findings.append("CSV import stayed read-only until confirmation; only one synthetic template added.")

                    # Save one actual synthetic working set, then update it without duplicating.
                    go(page, "train")
                    page.locator("#active-date").fill("2026-10-29")
                    page.locator("#active-date").dispatch_event("change")
                    page.locator("#active-workout").select_option("fixture-upper-001")
                    form = page.locator("#sets-form")
                    form.locator("input[name=kg0]").fill("14")
                    form.locator("input[name=reps0]").fill("10")
                    form.locator("input[name=rpe0]").fill("7")
                    form.locator("input[name=done0]").check()
                    old = get_store(page, WORKOUT_KEY)
                    form.locator("button[type=submit]").click()
                    saved = get_store(page, WORKOUT_KEY)
                    assert len(saved["logs"]) == len(old["logs"]) + 1
                    new_log = [l for l in saved["logs"] if l["date"] == "2026-10-29"]
                    assert len(new_log) == 1
                    assert (new_log[0]["kg"], new_log[0]["reps"], new_log[0]["rpe"]) == (14, 10, 7)
                    assert any(l == old["logs"][0] for l in saved["logs"])
                    original_id = new_log[0]["id"]
                    page.locator("#sets-form button[type=submit]").click()
                    again = get_store(page, WORKOUT_KEY)
                    assert len(again["logs"]) == len(saved["logs"])
                    assert next(l["id"] for l in again["logs"] if l["date"] == "2026-10-29") == original_id
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    findings.append("Train saves one synthetic working set and re-save does not create duplicates.")

                    # Countdown remains active when the operator switches pages.
                    before_timer = get_store(page, WORKOUT_KEY)
                    page.locator("#fp-rest-toggle").click()
                    page.locator("[data-rest-seconds='60']").click()
                    assert "running" in (page.locator("#fp-rest-toggle").get_attribute("class") or "")
                    go(page, "plan")
                    assert "running" in (page.locator("#fp-rest-toggle").get_attribute("class") or "")
                    page.locator("#fp-rest-toggle").click()
                    page.locator("#fp-rest-stop").click()
                    assert "running" not in (page.locator("#fp-rest-toggle").get_attribute("class") or "")
                    assert get_store(page, WORKOUT_KEY) == before_timer
                    findings.append("Timer runs across Plan navigation and stops without mutating saved sets.")

                    # Tools export must be exactly the currently saved workout JSON.
                    go(page, "tools")
                    before_export = get_store(page, WORKOUT_KEY)
                    with page.expect_download() as event:
                        page.locator("[data-action='backup-export']").click()
                    download = event.value
                    assert download.suggested_filename.endswith(".json")
                    backup_bytes = Path(download.path()).read_bytes()
                    assert json.loads(backup_bytes) == before_export
                    upload_bytes(page, "#backup-check-file",
                                 download.suggested_filename, backup_bytes)
                    page.get_by_text("Last checked workout backup: today.", exact=False).wait_for()
                    assert get_store(page, WORKOUT_KEY) == before_export
                    upload_bytes(page, "#backup-file",
                                 download.suggested_filename, backup_bytes)
                    page.locator("[data-action='restore-cancel']").wait_for()
                    assert get_store(page, WORKOUT_KEY) == before_export
                    page.locator("[data-action='restore-cancel']").click()
                    findings.append("Workout export matches saved data; checked-file preview never restores over records.")

                    # B110: one authenticated download containing both stores.
                    expected_workout = get_store(page, WORKOUT_KEY)
                    expected_food = get_store(page, FOOD_KEY)
                    page.goto(base + "/encrypted-backup.html", wait_until="domcontentloaded")
                    page.locator("#export-pass").fill(PASSPHRASE)
                    page.locator("#export-confirm").fill(PASSPHRASE)
                    with page.expect_download() as event:
                        page.locator("#export-button").click()
                    encrypted = Path(event.value.path()).read_bytes()
                    assert b"Synthetic Upper" not in encrypted
                    assert b"Synthetic Snack" not in encrypted
                    assert get_store(page, WORKOUT_KEY) == expected_workout
                    assert get_store(page, FOOD_KEY) == expected_food

                    # Fresh context holds zero entries. Wrong and tampered files reject.
                    with browser.new_context(
                        accept_downloads=True,
                        service_workers="block",
                        viewport={"width": 390, "height": 844},
                    ) as clean:
                        fresh = clean.new_page()
                        fresh.set_default_timeout(15000)
                        fresh.on("pageerror", lambda exc: errors.append(str(exc)))
                        fresh.goto(base + "/encrypted-backup.html",
                                   wait_until="domcontentloaded")
                        assert_absent(fresh)
                        upload_bytes(fresh, "#restore-file", "encrypted.json", encrypted)
                        fresh.locator("#restore-pass").fill("Incorrect synthetic passphrase 2026!")
                        fresh.locator("#restore-word").fill("RESTORE BOTH")
                        fresh.locator("#restore-button").click()
                        fresh.get_by_text("Wrong passphrase or corrupted encrypted backup.").wait_for()
                        assert_absent(fresh)

                        changed = json.loads(encrypted)
                        cipher = changed["data"]
                        changed["data"] = ("A" if cipher[0] != "A" else "B") + cipher[1:]
                        upload_bytes(fresh, "#restore-file", "corrupted.json",
                                     json.dumps(changed).encode())
                        fresh.locator("#restore-pass").fill(PASSPHRASE)
                        fresh.locator("#restore-word").fill("RESTORE BOTH")
                        fresh.locator("#restore-button").click()
                        fresh.get_by_text("Wrong passphrase or corrupted encrypted backup.").wait_for()
                        assert_absent(fresh)
                        findings.append("Wrong passphrase and authenticated-ciphertext tamper reject without writes.")

                        upload_bytes(fresh, "#restore-file", "encrypted.json", encrypted)
                        fresh.locator("#restore-pass").fill(PASSPHRASE)
                        fresh.locator("#restore-word").fill("RESTORE BOTH")
                        fresh.on("dialog", lambda dialog: dialog.accept())
                        fresh.locator("#restore-button").click()
                        fresh.get_by_text("Both stores restored.", exact=False).wait_for()
                        assert get_store(fresh, WORKOUT_KEY) == expected_workout
                        assert get_store(fresh, FOOD_KEY) == expected_food
                        fresh.goto(base + "/food-diary.html",
                                   wait_until="domcontentloaded")
                        fresh.locator("#fd-form").wait_for()
                        fresh.locator("#fd-date").fill(LAST_DAY)
                        fresh.locator("#fd-date").dispatch_event("change")
                        assert fresh.locator("#fd-count").inner_text() == "3 food/drink entries"
                        fresh.goto(base + "/index.html", wait_until="domcontentloaded")
                        fresh.locator("nav.bottom-tabs button[data-page='train']").wait_for()
                        assert get_store(fresh, WORKOUT_KEY) == expected_workout
                        assert get_store(fresh, FOOD_KEY) == expected_food
                        findings.append("Two-store encrypted restore in separate clean browser preserved exact records after reload.")

                assert not errors, "Browser JavaScript errors: " + " | ".join(errors[:5])
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)

    return {"result": "PASS", "browser": "isolated Playwright Chromium",
            "checks": findings, "offline": "DEFERRED B098 by owner"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True,
                        help="Existing local Fitness checkout, read only")
    parser.add_argument("--chromium", type=Path, default=None,
                        help="Optional Playwright-compatible browser executable")
    parser.add_argument("--headed", action="store_true",
                        help="Show only the disposable browser")
    args = parser.parse_args()
    root = args.repo_root.expanduser().resolve()
    if not root.is_dir():
        parser.error("--repo-root is not an existing directory: " + str(root))
    try:
        report = smoke(root, args.chromium, args.headed)
    except (AssertionError, RuntimeError, ValueError) as error:
        parser.exit(1, "B096 BROWSER SMOKE FAILED: " + str(error) + "\n")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
