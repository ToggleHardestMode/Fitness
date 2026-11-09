"""B097: screenshot and accessibility smoke for FitnessPilot's real mobile CSS.

New disposable Chromium contexts and synthetic stores only. Online layout testing;
service-worker/offline scenarios (B098) remain deliberately untested.
"""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading

from fixture import FOOD_KEY, WORKOUT_KEY, LAST_DAY, create_fixtures, validate_fixture
from verify import QuietHandler, check_repo, get_store, set_seed


WIDTHS = (320, 390, 428)
PAGES_ORIGIN = "https://togglehardestmode.github.io/Fitness/preview-v101"


def inspect_layout(page):
    """Inspect the computed CSS layout, not a screenshot-sized approximation."""
    return page.evaluate("""() => {
      const width = document.documentElement.clientWidth;
      const scroll = Math.max(document.documentElement.scrollWidth,
                              document.body?.scrollWidth || 0);
      const controls = [...document.querySelectorAll(
        'button, a[href], input:not([type=hidden]):not([type=file]), select, textarea'
      )].filter(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 &&
               s.display !== 'none' && s.visibility !== 'hidden' &&
               !el.closest('[hidden], [aria-hidden=true]');
      });
      const describe = el => {
        const r = el.getBoundingClientRect();
        return {element: el.tagName.toLowerCase(), id: el.id || null,
                label: (el.getAttribute('aria-label') || el.innerText ||
                        el.getAttribute('name') || '').trim().slice(0, 75),
                left: Math.round(r.left), right: Math.round(r.right),
                width: Math.round(r.width), height: Math.round(r.height)};
      };
      const nav = [...document.querySelectorAll('nav.bottom-tabs [data-page]')]
        .filter(el => el.getBoundingClientRect().width > 0);
      const overlaps = [];
      for(let i = 0; i < nav.length; i++) {
        for(let j = i + 1; j < nav.length; j++) {
          const a = nav[i].getBoundingClientRect();
          const b = nav[j].getBoundingClientRect();
          if(Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
             Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)
            overlaps.push([nav[i].dataset.page, nav[j].dataset.page]);
        }
      }
      return {
        clientWidth: width,
        scrollWidth: scroll,
        overflowPixels: Math.max(0, scroll - width),
        stylesheets: document.styleSheets.length,
        clippedControls: controls.filter(el => {
          const r = el.getBoundingClientRect();
          return r.left < -2 || r.right > width + 2;
        }).slice(0, 20).map(describe),
        smallTouchTargets: controls.filter(el => {
          const r = el.getBoundingClientRect();
          return r.width < 40 || r.height < 40;
        }).slice(0, 20).map(describe),
        navOverlaps: overlaps
      };
    }""")


def capture(page, label, width, directory, controls):
    problems = []
    # Capture evidence before actionability checks scroll the page.
    screenshot = f"{width}-{label}.png"
    page.screenshot(path=str(directory / screenshot),
                    full_page=True, animations="disabled")
    for selector in controls:
        locator = page.locator(selector).first
        try:
            locator.wait_for(state="visible", timeout=8000)
            locator.click(trial=True, timeout=8000)
            box = locator.bounding_box()
            if box and (box["x"] < -2 or box["x"] + box["width"] > width + 2):
                problems.append("Critical control clipped: " + selector)
        except Exception as error:
            problems.append("Critical control inaccessible: " + selector +
                            " (" + type(error).__name__ + ")")

    layout = inspect_layout(page)
    if layout["stylesheets"] == 0:
        problems.append("No CSS stylesheets were loaded.")
    if layout["overflowPixels"] > 2:
        problems.append("Horizontal document overflow: " +
                        str(layout["overflowPixels"]) + " CSS pixels.")
    if layout["navOverlaps"]:
        problems.append("Primary mobile navigation buttons overlap.")

    return {"width": width, "screen": label, "screenshot": screenshot,
            "computedLayout": layout, "problems": problems}


def navigate_section(page, name):
    """Try the real pointer first; preserve failures even if keyboard succeeds.

    Keyboard fallback is for collecting diagnostic screenshots only. It must
    NEVER convert a blocked touch-navigation button into a passing result.
    """
    tab = page.locator("nav.bottom-tabs button[data-page='" + name + "']")
    # The main page initially displays Dashboard. Do not click its active tab
    # just to capture a screenshot; capture() tests its touch actionability.
    if tab.get_attribute("aria-current") == "page":
        return []
    problems = []
    try:
        tab.click(timeout=4000)
    except Exception as error:
        blocker = tab.evaluate("""el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width/2,
                                                r.top + r.height/2);
          return hit ? hit.tagName.toLowerCase() + '.' +
                 (hit.getAttribute('class') || '').slice(0, 90) : 'none';
        }""")
        problems.append("Bottom navigation touch click blocked for " + name +
                        " (" + type(error).__name__ + ", hit=" + blocker + ").")
        # Real keyboard navigation allows inspection of the remaining pages,
        # but the pointer problem above still forces overall FAIL.
        tab.focus()
        tab.press("Enter", timeout=5000)
    page.locator("nav.bottom-tabs button[data-page='" + name +
                 "'][aria-current='page']").wait_for(state="visible", timeout=5000)
    return problems


def load(page, url, selector):
    page.goto(url, wait_until="load", timeout=45000)
    page.locator(selector).wait_for(state="visible", timeout=15000)
    page.evaluate("() => document.fonts.ready.then(() => true)")


def run(root, destination, target, headed=False, chromium_binary=None):
    from playwright.sync_api import sync_playwright

    check_repo(root)
    validate_fixture(create_fixtures())
    banner = (root / "preview-v101/index.html").read_text("utf-8")
    version = re.search(r"FITNESSPILOT (V\d+\.\d+\.\d+) PREVIEW", banner)
    if not version:
        raise ValueError("Expected preview version banner was not found.")
    if destination.exists():
        raise ValueError("Output already exists; choose a NEW directory: " + str(destination))
    if not destination.parent.is_dir():
        raise ValueError("Output parent directory is missing: " + str(destination.parent))

    destination.mkdir()
    report = {"result": "FAIL", "target": target, "version": version.group(1),
              "widths": list(WIDTHS), "screens": [],
              "browserErrors": [], "offline": "DEFERRED B098 (service workers blocked)",
              "fixture": "synthetic only"}
    server = None
    try:
        if target == "local":
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0), partial(QuietHandler, directory=str(root))
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            origin = f"http://127.0.0.1:{server.server_port}/preview-v101"
        else:
            origin = PAGES_ORIGIN

        with sync_playwright() as playwright:
            options = {"headless": not headed}
            if chromium_binary is not None:
                options["executable_path"] = str(chromium_binary)
            browser = playwright.chromium.launch(**options)
            try:
                for width in WIDTHS:
                    with browser.new_context(
                        viewport={"width": width, "height": 844},
                        device_scale_factor=1,
                        is_mobile=True, has_touch=True,
                        service_workers="block",
                    ) as context:
                        page = context.new_page()
                        page.set_default_timeout(15000)
                        page.on("pageerror", lambda exc: report["browserErrors"].append(str(exc)))
                        load(page, origin + "/index.html",
                             "nav.bottom-tabs button[data-page='plan']")
                        assert version.group(1) in page.locator(".preview-banner").inner_text(), (
                            "Served preview version differs from the checked-out source."
                        )
                        fixtures = create_fixtures()
                        set_seed(page, fixtures)
                        page.reload(wait_until="load")
                        page.evaluate("() => document.fonts.ready.then(() => true)")
                        assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
                        assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]

                        sections = [
                            ("dashboard", ["nav.bottom-tabs button[data-page='dashboard']"]),
                            ("train", ["#active-workout", "#sets-form button[type=submit]"]),
                            ("plan", ["#schedule-form button[type=submit]"]),
                            ("tools", ["a[href='./encrypted-backup.html']"]),
                        ]
                        for section, important in sections:
                            navigation_problems = navigate_section(page, section)
                            if section == "train":
                                page.locator("#active-workout").select_option(
                                    "fixture-upper-001"
                                )
                                page.locator("#sets-form").wait_for()
                            screen = capture(
                                page, section, width, destination, important
                            )
                            screen["problems"].extend(navigation_problems)
                            report["screens"].append(screen)

                        load(page, origin + "/food-diary.html", "#fd-form")
                        page.locator("#fd-date").fill(LAST_DAY)
                        page.locator("#fd-date").dispatch_event("change")
                        assert page.locator("#fd-count").inner_text() == "3 food/drink entries"
                        report["screens"].append(capture(
                            page, "food-diary", width, destination,
                            ["#fd-date", "#fd-save", "#fd-export"]
                        ))

                        load(page, origin + "/encrypted-backup.html", "#export-button")
                        report["screens"].append(capture(
                            page, "backup-vault", width, destination,
                            ["#export-button", "#restore-button", "#restore-file"]
                        ))
                        assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
                        assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
            finally:
                browser.close()

        failed = [s for s in report["screens"] if s["problems"]]
        report["result"] = "FAIL" if failed or report["browserErrors"] else "PASS"
    except Exception as error:
        report["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)
        (destination / "report.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True,
                        help="Existing local Fitness source checkout")
    parser.add_argument("--output", type=Path, required=True,
                        help="New, non-existing output folder for 18 screenshots and report")
    parser.add_argument("--target", choices=("local", "pages"), default="local",
                        help="Disposable localhost server or official served Pages preview")
    parser.add_argument("--chromium", type=Path, help="Optional Chromium executable")
    parser.add_argument("--headed", action="store_true",
                        help="Show the disposable test browser")
    args = parser.parse_args()
    root = args.repo_root.expanduser().resolve()
    if not root.is_dir():
        parser.error("--repo-root is not an existing directory: " + str(root))
    try:
        report = run(root, args.output.expanduser().resolve(),
                     args.target, args.headed, args.chromium)
    except (ValueError, OSError) as error:
        parser.exit(1, "B097 CONFIG ERROR: " + str(error) + "\n")
    print(json.dumps({
        "result": report["result"], "target": report["target"],
        "version": report["version"], "screenshots": len(report["screens"]),
        "problems": [s["screen"] + "@" + str(s["width"]) + "px: " + problem
                     for s in report["screens"] for problem in s["problems"]],
        "browserErrors": report["browserErrors"],
        "error": report.get("error"), "output": str(args.output)
    }, indent=2))
    if report["result"] != "PASS":
        parser.exit(1, "B097 layout check failed; inspect report.json and PNGs.\n")


if __name__ == "__main__":
    main()
