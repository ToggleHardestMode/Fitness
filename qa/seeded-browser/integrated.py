"""B096 local-only Chromium smoke across real FitnessPilot preview screens.

Runs exclusively in disposable Playwright contexts on a localhost static checkout.
Offline reload and service-worker cache-name upgrades run in a separate disposable context.
No personal browser profile, public Pages URL, server upload, or real records.
"""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import threading

from fixture import FOOD_KEY, WORKOUT_KEY, LAST_DAY, create_fixtures, validate_fixture
from verify import check_repo, get_store, select_day, set_seed
from offline import UpgradeHandler, check_offline_upgrade
from train_ui_30 import reference_fixture, run_mode


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
    assert page.evaluate("(key) => localStorage.getItem(key)", WORKOUT_KEY) is None
    assert page.evaluate("(key) => localStorage.getItem(key)", FOOD_KEY) is None


def check_food_csv(context, base, errors):
    from playwright.sync_api import expect

    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(base + "/food-diary.html", wait_until="domcontentloaded")
    select_day(page, "2030-01-03")
    csv = (
        "date,name,occasion,servings,kcal,protein,carbs,fat\n"
        "2030-01-02,Synthetic lunch,meal,1,300,20,40,6\n"
        "2030-01-01,Synthetic lunch,meal,1,220,18,30,3\n"
    )
    upload_bytes(page, "#fd-csv-file", "food.csv", csv.encode(), "text/csv")
    preview = page.locator("#fd-csv-preview")
    expect(preview).to_contain_text("2 dates (2030-01-01 to 2030-01-02)")
    assert_absent(page)
    select_day(page, "2030-01-02")
    preview.get_by_role("button", name="Import 2 food entries").click()
    expect(page.locator("#fd-total-kcal")).to_have_text("300 kcal")
    select_day(page, "2030-01-01")
    expect(page.locator("#fd-total-kcal")).to_have_text("220 kcal")
    saved = get_store(page, FOOD_KEY)

    upload_bytes(page, "#fd-csv-file", "food.csv", csv.encode(), "text/csv")
    expect(preview).to_contain_text("All rows already match saved entries.")
    assert get_store(page, FOOD_KEY) == saved

    correction = csv.replace(",220,", ",250,")
    upload_bytes(page, "#fd-csv-file", "corrected.csv", correction.encode(), "text/csv")
    expect(preview).to_contain_text("2030-01-01 · Correct: Synthetic lunch")
    expect(preview).to_contain_text("220 → 250")
    apply = preview.get_by_role("button", name="Add 0 · Correct 1")
    page.once("dialog", lambda dialog: dialog.dismiss())
    apply.click()
    assert get_store(page, FOOD_KEY) == saved
    page.once("dialog", lambda dialog: dialog.accept())
    apply.click()
    expect(page.locator("#fd-total-kcal")).to_have_text("250 kcal")
    assert get_store(page, FOOD_KEY)["entries"][0] == saved["entries"][0]
    assert page.evaluate("(key) => localStorage.getItem(key)", WORKOUT_KEY) is None


def check_iphone_qa(context, base, version, workout, food, errors):
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, expect

    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    try:
        page.goto(base + "/qa.html", wait_until="domcontentloaded")
        expect(page.locator("#preview-version")).to_have_text(version + " · main app banner")
        headings = page.locator("#checks h2").all_text_contents()
        check_ids = [f"O{i}" for i in range(1, 12)]
        assert [title.split(" · ", 1)[0] for title in headings] == check_ids
        expect(page.locator("#counts")).to_have_text("0 Pass · 0 Fail · 0 Blocked · 11 Not run")

        rows = page.locator("#checks article")
        rows.nth(0).locator("select").select_option("pass")
        rows.nth(0).locator("textarea").fill("Synthetic version check.")
        rows.nth(1).locator("select").select_option("fail")
        rows.nth(10).locator("select").select_option("blocked")
        expect(page.locator("#counts")).to_have_text("1 Pass · 1 Fail · 1 Blocked · 8 Not run")

        download = page.locator("#download-report")
        for width in (320, 390, 428):
            page.set_viewport_size({"width": width, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth") <= width
            download.click(trial=True)
        with page.expect_download() as event:
            download.click()
        report_file = event.value
        assert report_file.suggested_filename == f"fitnesspilot-{version.lower().replace('.', '')}-qa.json"
        report = json.loads(Path(report_file.path()).read_bytes())
        assert report["schema"] == "fitnesspilot-qa-v1"
        assert report["previewVersion"] == version
        assert [entry["id"] for entry in report["results"]] == check_ids
        assert report["counts"] == {"pass": 1, "fail": 1, "blocked": 1, "not-run": 8}
        assert [entry["status"] for entry in report["results"]] == [
            "pass", "fail", *(["not-run"] * 8), "blocked"
        ]
        assert report["results"][0]["note"] == "Synthetic version check."
        assert set(report) == {"schema", "previewVersion", "checkedAt", "results", "counts", "note"}
        assert get_store(page, WORKOUT_KEY) == workout
        assert get_store(page, FOOD_KEY) == food

        page.route(base + "/index.html", lambda route: route.fulfill(
            content_type="text/html", body="<!doctype html><title>Missing banner fixture</title>"
        ))
        page.reload(wait_until="load")
        expect(page.locator("#preview-version")).to_contain_text("Version unavailable")
        expect(page.locator("#counts")).to_have_text("0 Pass · 0 Fail · 0 Blocked · 11 Not run")
        try:
            with page.expect_download(timeout=1000):
                download.click()
        except PlaywrightTimeoutError:
            expect(page.locator("#export-status")).to_contain_text("Export failed")
        else:
            raise AssertionError("QA report downloaded without a preview banner")
        assert get_store(page, WORKOUT_KEY) == workout
        assert get_store(page, FOOD_KEY) == food
    finally:
        page.close()


def smoke(repo, chromium_binary=None, headed=False):
    from playwright.sync_api import sync_playwright

    check_repo(repo)
    if not (repo / "preview-v101/encrypted-backup.html").is_file():
        raise ValueError("Expected B110 preview vault is missing.")
    fixtures = create_fixtures()
    validate_fixture(fixtures)
    benchmark_fixture = reference_fixture(repo)

    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(UpgradeHandler, directory=str(repo))
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
                UpgradeHandler.use_upgrade = False
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

                    # Dashboard controls rerender the selected week without changing either store.
                    walker = page.locator("#main .fp-walker-banner")
                    assert walker.count() == 1
                    week_heading = page.locator(".section-label").filter(has_text="Selected training week")
                    current_week = week_heading.inner_text()
                    page.locator("[data-action='week-prev']").click()
                    assert week_heading.inner_text() != current_week
                    page.locator("[data-action='week-current']").click()
                    assert week_heading.inner_text() == current_week
                    assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    for section in ("train", "plan", "tools"):
                        go(page, section)
                        assert walker.count() == 0
                    go(page, "dashboard")
                    assert walker.count() == 1
                    findings.append("Dashboard week controls preserve both stores and the avatar stays on Dashboard.")

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

                    # Open the editor from the moved library, then cancel without writing either store.
                    library = page.locator(".codex-library-entry").filter(has_text="Synthetic upper-body workout")
                    library.locator("summary").click()
                    library.get_by_role("button", name="Customize").click()
                    editor = page.locator("#template-version-form")
                    assert editor.locator("input[name=name]").input_value() == "Synthetic seated press"
                    editor.get_by_role("button", name="Cancel", exact=True).click()
                    assert not editor.is_visible()
                    assert get_store(page, WORKOUT_KEY) == imported

                    # Exercise both paths through the Plan's V10.3 import preview and its CSV button.
                    program = page.locator("#v103-import")
                    preview_program = program.get_by_role("button", name="Preview V10.3 import")
                    with page.expect_download() as canonical:
                        program.get_by_role("button", name="Download canonical V10.3 CSV").click()
                    assert canonical.value.suggested_filename == "V10.3_Home_FitnessPilot_Import.csv"
                    assert Path(canonical.value.path()).read_text(encoding="utf-8").startswith("day,workout,exercise,")
                    preview_program.click()
                    pending = program.get_by_role("status")
                    assert pending.get_by_text("[PT Review]", exact=False).count() == 2
                    assert "4 templates" in pending.inner_text()
                    assert get_store(page, WORKOUT_KEY) == imported
                    pending.get_by_role("button", name="Cancel import").click()
                    assert not pending.is_visible()
                    assert get_store(page, WORKOUT_KEY) == imported
                    preview_program.click()
                    confirm = pending.get_by_role("button", name="Confirm and add V10.3 templates")
                    raw = page.evaluate("(key) => localStorage.getItem(key)", WORKOUT_KEY)
                    changed = raw + " "
                    page.evaluate("([key, value]) => localStorage.setItem(key, value)", [WORKOUT_KEY, changed])
                    confirm.click()
                    page.get_by_text("Saved workout data changed after your V10.3 preview. Preview it again.", exact=True).wait_for()
                    assert not pending.is_visible()
                    assert page.evaluate("(key) => localStorage.getItem(key)", WORKOUT_KEY) == changed
                    page.evaluate("([key, value]) => localStorage.setItem(key, value)", [WORKOUT_KEY, raw])
                    preview_program.click()
                    page.once("dialog", lambda dialog: dialog.dismiss())
                    confirm.click()
                    assert pending.is_visible()
                    assert get_store(page, WORKOUT_KEY) == imported
                    page.once("dialog", lambda dialog: dialog.accept())
                    confirm.click()
                    after_program = get_store(page, WORKOUT_KEY)
                    assert len(after_program["templates"]) == len(imported["templates"]) + 4
                    assert after_program["assignments"] == imported["assignments"]
                    assert after_program["logs"] == imported["logs"]
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    findings.append("Plan editor cancel and V10.3 download, preview, stale rejection, cancel and explicit import passed.")

                    # Save one actual synthetic working set, then update it without duplicating.
                    go(page, "train")
                    page.locator("#active-date").fill("2026-10-29")
                    page.locator("#active-date").dispatch_event("change")
                    page.locator("#active-workout").select_option("fixture-upper-001")
                    form = page.locator("#sets-form")

                    # Train still wires the workout guide and protects unsaved Focus edits.
                    before_focus = get_store(page, WORKOUT_KEY)
                    guide = page.locator('details[aria-label="Full workout next-session guide"]')
                    guide.locator("summary").first.click()
                    assert guide.get_by_role("rowheader", name="Synthetic seated press").is_visible()
                    assert "Nothing here is automatically saved" in guide.inner_text()
                    assert get_store(page, WORKOUT_KEY) == before_focus
                    toggle = page.locator("[data-action='focus-toggle']")
                    toggle.click()
                    assert toggle.get_attribute("aria-pressed") == "true"
                    kg = form.locator("input[name=kg0]")
                    default_kg = kg.input_value()
                    kg.fill("19")
                    with page.expect_event("dialog", predicate=lambda dialog: "Discard your unsaved set changes?" in dialog.message) as dismissed:
                        page.once("dialog", lambda dialog: dialog.dismiss())
                        go(page, "plan")
                    assert dismissed.value.type == "confirm"
                    assert kg.input_value() == "19"
                    with page.expect_event("dialog", predicate=lambda dialog: "Discard your unsaved set changes?" in dialog.message) as accepted:
                        page.once("dialog", lambda dialog: dialog.accept())
                        go(page, "plan")
                    assert accepted.value.type == "confirm"
                    assert page.locator("#schedule-form").is_visible()
                    go(page, "train")
                    assert kg.input_value() == default_kg
                    assert get_store(page, WORKOUT_KEY) == before_focus
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    toggle.click()
                    assert toggle.get_attribute("aria-pressed") == "false"
                    findings.append("Train guide is read-only, and canceling or accepting Focus discard preserves both stores.")

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
                    vault_status = page.locator("#storage-persistence-status[role='status']")
                    vault_status.filter(has_text="Persistent storage").wait_for()
                    with page.expect_popup() as qa_popup:
                        page.get_by_role("link", name="Open iPhone QA checklist").click()
                    qa_tab = qa_popup.value
                    qa_tab.wait_for_load_state("domcontentloaded")
                    assert qa_tab.url == base + "/qa.html"
                    qa_tab.locator("#checks article").first.wait_for()
                    qa_tab.close()
                    page.locator("[data-action='tracking-reset-apply']").click()
                    page.get_by_text("First download and check a matching current backup in Tools.", exact=True).wait_for()
                    with page.expect_download() as logbook:
                        page.get_by_role("button", name="Download full history (.csv)").click()
                    assert logbook.value.suggested_filename.startswith("FitnessPilot-workout-history-")
                    assert "Synthetic seated press" in Path(logbook.value.path()).read_text(encoding="utf-8")
                    with page.expect_download() as calendar:
                        page.get_by_role("button", name="Export Calendar reminders (.ics)").click()
                    assert calendar.value.suggested_filename.endswith(".ics")
                    assert "BEGIN:VEVENT" in Path(calendar.value.path()).read_text(encoding="utf-8")
                    assert get_store(page, WORKOUT_KEY) == before_export
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    findings.append("Tools QA link, persistence status, reset guard and read-only exports passed.")
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
                    page.locator("#tracking-reset-ack").check()
                    page.locator("#tracking-reset-word").fill("RESET LOGS")
                    with page.expect_event("dialog", predicate=lambda dialog: "Permanently remove" in dialog.message):
                        page.once("dialog", lambda dialog: dialog.dismiss())
                        page.locator("[data-action='tracking-reset-apply']").click()
                    assert get_store(page, WORKOUT_KEY) == before_export
                    assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
                    upload_bytes(page, "#backup-file",
                                 download.suggested_filename, backup_bytes)
                    page.locator("[data-action='restore-cancel']").wait_for()
                    assert get_store(page, WORKOUT_KEY) == before_export
                    page.locator("[data-action='restore-cancel']").click()
                    findings.append("Workout export matches saved data; checked-file preview never restores over records.")
                    # Plain workout JSON must restore from the actual file into a distinct clean profile.
                    with browser.new_context(
                        accept_downloads=True, service_workers="block",
                        viewport={"width": 390, "height": 844},
                    ) as clean_workout:
                        clean_page = clean_workout.new_page()
                        clean_page.set_default_timeout(15000)
                        clean_page.on("pageerror", lambda exc: errors.append(str(exc)))
                        clean_page.goto(base + "/index.html", wait_until="domcontentloaded")
                        clean_page.locator("nav.bottom-tabs button[data-page='tools']").wait_for()
                        assert clean_page.evaluate(
                            "(key) => localStorage.getItem(key)", WORKOUT_KEY
                        ) is None
                        go(clean_page, "tools")
                        upload_bytes(clean_page, "#backup-file",
                                     download.suggested_filename, backup_bytes)
                        clean_page.locator("[data-action='restore-confirm']").wait_for()
                        assert clean_page.evaluate(
                            "(key) => localStorage.getItem(key)", WORKOUT_KEY
                        ) is None
                        clean_page.locator("#restore-word").fill("REPLACE")
                        clean_page.on("dialog", lambda dialog: dialog.accept())
                        clean_page.locator("[data-action='restore-confirm']").click()
                        assert get_store(clean_page, WORKOUT_KEY) == before_export
                        clean_page.reload(wait_until="domcontentloaded")
                        assert get_store(clean_page, WORKOUT_KEY) == before_export
                    findings.append("Downloaded plain workout JSON restores identical records in a clean context.")


                    # B110: one authenticated download containing both stores.
                    expected_workout = get_store(page, WORKOUT_KEY)
                    expected_food = get_store(page, FOOD_KEY)
                    banner = page.locator(".preview-banner").inner_text().split()
                    assert banner[0] == "FITNESSPILOT" and banner[2] == "PREVIEW"
                    assert page.get_by_role("link", name="Open iPhone QA checklist").get_attribute("href") == "./qa.html"
                    check_iphone_qa(context, base, banner[1], expected_workout, expected_food, errors)
                    findings.append("iPhone QA renders O1–O11, downloads the banner version, and rejects export without it; both stores are unchanged.")
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

                with browser.new_context(service_workers="block", viewport={"width": 390, "height": 844}) as food_csv:
                    check_food_csv(food_csv, base, errors)
                    findings.append("Food CSV imported by row date without a backup; reimport and correction checks passed.")
                findings.extend(check_offline_upgrade(browser, base, fixtures, errors))
                assert not errors, "Browser JavaScript errors: " + " | ".join(errors[:5])
                train_baseline = [
                    run_mode(browser, base.removesuffix('/preview-v101'), benchmark_fixture, mode)
                    for mode in ('standard', 'focus')
                ]
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)

    return {"result": "PASS", "browser": "isolated Playwright Chromium",
            "checks": findings, "automated_30_set_baseline": train_baseline,
            "offline": "PASS in disposable Chromium: reload and cache-name upgrade; Safari not tested"}


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
