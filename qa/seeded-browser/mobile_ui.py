"""B097: screenshot and accessibility smoke for FitnessPilot's real mobile CSS.

New disposable Chromium contexts and synthetic stores only. Online layout testing;
service-worker/offline scenarios (B098) remain deliberately untested.
"""
import argparse
from base64 import b64encode
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import re
import threading

from playwright.sync_api import Error as PlaywrightError, sync_playwright

from fixture import FOOD_KEY, WORKOUT_KEY, LAST_DAY, create_fixtures, validate_fixture
from verify import QuietHandler, check_repo, get_store, set_seed


WIDTHS = (320, 390, 428)
PAGES_ORIGIN = "https://togglehardestmode.github.io/Fitness/preview-v101"
APP_SCREENS = ("dashboard", "train", "plan", "tools")
SCREENS = (*APP_SCREENS, "food-diary", "backup-vault")
VERSION_PATTERN = r"FITNESSPILOT (V\d+\.\d+\.\d+) PREVIEW"
COMPARISON_VERSION = "V0.00.00"
CAPTURE_FLAGS = [
    "--disable-gpu",
    "--disable-skia-runtime-opts",
    "--run-all-compositor-stages-before-draw",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
]


def inspect_layout(page):
    """Inspect the computed CSS layout, not a screenshot-sized approximation."""
    return page.evaluate("""() => {
      const width = document.documentElement.clientWidth;
      const scroll = Math.max(document.documentElement.scrollWidth,
                              document.body?.scrollWidth || 0);
      const describeElement = el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return {
          element: el.tagName.toLowerCase(),
          id: el.id || null,
          className: typeof el.className === 'string'
            ? el.className.slice(0, 110) : (el.getAttribute('class') || '').slice(0, 110),
          left: Math.round(r.left), right: Math.round(r.right),
          width: Math.round(r.width),
          scrollWidth: el.scrollWidth || 0, clientWidth: el.clientWidth || 0,
          position: s.position, overflowX: s.overflowX,
          minWidth: s.minWidth, zIndex: s.zIndex
        };
      };
      const candidateElements = [...document.body.querySelectorAll('*')]
        .filter(el => {
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return s.display !== 'none' && r.width > 0 && r.height > 0 &&
                 (r.right > width + 2 || r.left < -2 ||
                  (el.scrollWidth > el.clientWidth + 2 &&
                   !['hidden','clip','scroll','auto'].includes(s.overflowX)));
        })
        .map(describeElement).sort((a, b) => b.right - a.right).slice(0, 40);
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
      const tabTargets = nav.map(el => {
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2,
              y = r.top + r.height / 2;
        const hit = x >= 0 && x < window.innerWidth && y >= 0 &&
                    y < window.innerHeight ? document.elementFromPoint(x,y) : null;
        return {
          page: el.getAttribute('data-page'),
          tab: describeElement(el),
          hit: hit ? describeElement(hit) : null,
          hitInsideTab: Boolean(hit && (hit === el || el.contains(hit)))
        };
      });
      const layoutRoots = ['html','body','.shell','#main','.bottom-tabs',
                           '#main .sj-journey','#main .sj-svg-chart']
        .map(sel => {
          const element = document.querySelector(sel);
          return element ? {selector:sel,...describeElement(element)} : null;
        }).filter(Boolean);
      return {
        clientWidth: width,
        innerWidth: window.innerWidth,
        visualViewportWidth: window.visualViewport?.width ?? null,
        scrollWidth: scroll,
        layoutRoots,
        overflowCandidates: candidateElements,
        bottomNavHitTargets: tabTargets,
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


def capture(page, label, width, directory, controls, version=None):
    problems = []
    # Capture evidence before actionability checks scroll the page.
    screenshot = f"{width}-{label}.png"
    page.evaluate("""async () => {
        window.scrollTo(0, 0);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }""")
    page.screenshot(path=str(directory / screenshot),
                    full_page=True, animations="disabled")
    if version is not None:
        banner = page.locator(".preview-banner")
        original = banner.text_content()
        prefix = f"FITNESSPILOT {version} PREVIEW"
        assert original is not None and original.count(prefix) == 1
        assert banner.evaluate("(el) => el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE"), (
            "Cannot normalize the preview version without changing banner markup."
        )
        comparison = original.replace(prefix, f"FITNESSPILOT {COMPARISON_VERSION} PREVIEW")
        banner.evaluate("(el, text) => { el.firstChild.nodeValue = text; }", comparison)
        try:
            page.screenshot(path=str(directory / "same-version" / screenshot),
                            full_page=True, animations="disabled")
        finally:
            banner.evaluate("(el, text) => { el.firstChild.nodeValue = text; }", original)
    for selector in controls:
        locator = page.locator(selector).first
        try:
            locator.wait_for(state="visible", timeout=8000)
            locator.click(trial=True, timeout=8000)
            box = locator.bounding_box()
            if box and (box["x"] < -2 or box["x"] + box["width"] > width + 2):
                problems.append("Critical control clipped: " + selector)
        except PlaywrightError as error:
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
    except PlaywrightError as error:
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


def run(root, destination, target, headed=False, chromium_binary=None, compare_versions=False):
    check_repo(root)
    validate_fixture(create_fixtures())
    banner = (root / "preview-v101/index.html").read_text("utf-8")
    version = re.search(VERSION_PATTERN, banner)
    if not version:
        raise ValueError("Expected preview version banner was not found.")
    if destination.exists():
        raise ValueError("Output already exists; choose a NEW directory: " + str(destination))
    if not destination.parent.is_dir():
        raise ValueError("Output parent directory is missing: " + str(destination.parent))

    destination.mkdir()
    if compare_versions:
        (destination / "same-version").mkdir()
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
            options = {"headless": not headed, "args": CAPTURE_FLAGS}
            if chromium_binary is not None:
                options["executable_path"] = str(chromium_binary)
            browser = playwright.chromium.launch(**options)
            try:
                for width in WIDTHS:
                    with browser.new_context(
                        viewport={"width": width, "height": 844},
                        timezone_id="Asia/Singapore", locale="en-SG", reduced_motion="reduce",
                        device_scale_factor=1,
                        is_mobile=True, has_touch=True,
                        service_workers="block",
                    ) as context:
                        page = context.new_page()
                        page.clock.set_fixed_time(LAST_DAY + "T12:00:00+08:00")
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
                                page, section, width, destination, important,
                                version.group(1) if compare_versions else None,
                            )
                            screen["problems"].extend(navigation_problems)
                            report["screens"].append(screen)

                        load(page, origin + "/food-diary.html", "#fd-form")
                        page.locator("#fd-date").fill(LAST_DAY)
                        page.locator("#fd-date").dispatch_event("change")
                        page.locator("#fd-date").blur()
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
        complete = len(report["screens"]) == len(WIDTHS) * len(SCREENS)
        report["result"] = "PASS" if complete and not failed and not report["browserErrors"] else "FAIL"
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


def compare_screens(baseline_dir, current_dir, headed=False, chromium_binary=None, screens=SCREENS):
    """Count unequal RGBA pixels, including pixels outside either image's bounds."""
    options = {"headless": not headed}
    if chromium_binary is not None:
        options["executable_path"] = str(chromium_binary)
    results = []
    with sync_playwright() as playwright, playwright.chromium.launch(**options) as browser:
        page = browser.new_page()
        for width in WIDTHS:
            for screen in screens:
                name = f"{width}-{screen}.png"
                paths = (baseline_dir / name, current_dir / name)
                if not all(path.is_file() for path in paths):
                    raise ValueError("Missing screenshot pair: " + name)
                encoded = [b64encode(path.read_bytes()).decode("ascii") for path in paths]
                comparison = page.evaluate("""async images => {
                    async function pixels(png) {
                        const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
                        const image = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
                        const canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;
                        const context = canvas.getContext('2d');
                        context.drawImage(image, 0, 0);
                        return context.getImageData(0, 0, canvas.width, canvas.height);
                    }
                    const [base, current] = await Promise.all(images.map(pixels));
                    const width = Math.min(base.width, current.width);
                    const height = Math.min(base.height, current.height);
                    let changedPixels = base.width * base.height + current.width * current.height -
                                        2 * width * height;
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const a = (y * base.width + x) * 4;
                            const b = (y * current.width + x) * 4;
                            if (base.data[a] !== current.data[b] ||
                                base.data[a + 1] !== current.data[b + 1] ||
                                base.data[a + 2] !== current.data[b + 2] ||
                                base.data[a + 3] !== current.data[b + 3]) changedPixels++;
                        }
                    }
                    return {changedPixels, baselineSize: [base.width, base.height],
                            currentSize: [current.width, current.height]};
                }""", encoded)
                results.append({"screen": screen, "width": width, **comparison})
    return results


def compare(root, baseline, destination, headed, chromium, require_unchanged):
    check_repo(root)
    check_repo(baseline)
    destination.mkdir()
    baseline_dir, current_dir = destination / "main", destination / "candidate"
    report = {"result": "FAIL", "baseline": str(baseline), "candidate": str(root), "screens": []}
    try:
        main_result = run(baseline, baseline_dir, "local", headed, chromium, compare_versions=True)
        current_result = run(root, current_dir, "local", headed, chromium, compare_versions=True)
        report["mainResult"] = main_result["result"]
        report["candidateResult"] = current_result["result"]
        report["mainError"] = main_result.get("error")
        report["candidateError"] = current_result.get("error")
        if len(main_result["screens"]) != len(WIDTHS) * len(SCREENS) or (
            len(current_result["screens"]) != len(WIDTHS) * len(SCREENS)
        ):
            raise ValueError("Incomplete capture; see main and candidate reports.")
        layouts = {
            key: {(row["screen"], row["width"]): row for row in capture["screens"]}
            for key, capture in (("main", main_result), ("candidate", current_result))
        }
        same_version = {
            (row["screen"], row["width"]): row["changedPixels"]
            for row in compare_screens(baseline_dir / "same-version", current_dir / "same-version",
                                       headed, chromium, screens=APP_SCREENS)
        }
        report["comparisonVersion"] = COMPARISON_VERSION
        for screen in compare_screens(baseline_dir, current_dir, headed, chromium):
            key = (screen["screen"], screen["width"])
            screen["sameVersionChangedPixels"] = same_version.get(key, screen["changedPixels"])
            for key, layout in layouts.items():
                match = layout[screen["screen"], screen["width"]]
                screen[key + "Overflow"] = match["computedLayout"]["overflowPixels"]
                screen[key + "ClippedControls"] = match["computedLayout"]["clippedControls"]
                screen[key + "Problems"] = match["problems"]
            report["screens"].append(screen)
        unchanged = all(row["sameVersionChangedPixels"] == 0 for row in report["screens"])
        if main_result["result"] == current_result["result"] == "PASS":
            if unchanged or not require_unchanged:
                report["result"] = "PASS"
            else:
                report["error"] = "Expected zero changed pixels after normalizing the version label."
    except (PlaywrightError, ValueError, OSError) as error:
        report["error"] = f"{type(error).__name__}: {error}"
    finally:
        (destination / "comparison.json").write_text(
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
    parser.add_argument("--baseline-root", type=Path, help="Main source checkout for pixel comparison")
    parser.add_argument("--require-unchanged", action="store_true",
                        help="Fail if pixels differ after comparing with the same preview version label")
    parser.add_argument("--chromium", type=Path, help="Optional Chromium executable")
    parser.add_argument("--headed", action="store_true",
                        help="Show the disposable test browser")
    args = parser.parse_args()
    root = args.repo_root.expanduser().resolve()
    if not root.is_dir():
        parser.error("--repo-root is not an existing directory: " + str(root))
    if args.baseline_root and args.target != "local":
        parser.error("--baseline-root compares two localhost checkouts")
    if args.require_unchanged and args.baseline_root is None:
        parser.error("--require-unchanged needs --baseline-root")
    if args.baseline_root:
        try:
            report = compare(root, args.baseline_root.expanduser().resolve(),
                             args.output.expanduser().resolve(), args.headed, args.chromium,
                             args.require_unchanged)
        except (ValueError, OSError) as error:
            parser.exit(1, "B124 CONFIG ERROR: " + str(error) + "\n")
        print(json.dumps(report, indent=2))
        if report["result"] != "PASS":
            parser.exit(1, "B124 comparison failed; inspect the screenshot artifact.\n")
        return
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
        "diagnostic": [
            {
                "screen": s["screen"], "width": s["width"],
                "roots": s["computedLayout"]["layoutRoots"],
                "overflowCandidates": s["computedLayout"]["overflowCandidates"][:12],
                "bottomNavHitTargets": s["computedLayout"]["bottomNavHitTargets"]
            }
            for s in report["screens"]
            if s["screen"] == "dashboard" and s["width"] in (320, 390)
        ],
        "browserErrors": report["browserErrors"],
        "error": report.get("error"), "output": str(args.output)
    }, indent=2))
    if report["result"] != "PASS":
        parser.exit(1, "B097 layout check failed; inspect report.json and PNGs.\n")


if __name__ == "__main__":
    main()
