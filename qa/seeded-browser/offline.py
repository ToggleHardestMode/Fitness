"""B098 disposable browser checks for offline shell and cache-name upgrades.

Imported by integrated.py. No standalone runner, no filesystem mutation.
"""
import re
from pathlib import Path

from fixture import WORKOUT_KEY, FOOD_KEY
from verify import QuietHandler, get_store, set_seed


class UpgradeHandler(QuietHandler):
    """Serve a test-only new SW cache name from memory, without changing source."""
    use_upgrade = False

    def do_GET(self):
        if self.use_upgrade and self.path.split("?", 1)[0] == "/preview-v101/sw.js":
            source = (Path(self.directory) / "preview-v101/sw.js").read_text("utf-8")
            pattern = r"(?m)^(const CACHE = ')([^']+)(';)"
            replacement = lambda m: m.group(1) + m.group(2) + "-b098-upgrade" + m.group(3)
            changed, count = re.subn(pattern, replacement, source, count=1)
            if count != 1:
                raise RuntimeError("Cannot identify the current preview service-worker cache.")
            data = changed.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


def check_offline_upgrade(browser, base, fixtures, errors):
    """Exercise the real SW in a fresh local browser origin and compare both stores."""
    findings = []
    UpgradeHandler.use_upgrade = False
    try:
        with browser.new_context(
            accept_downloads=True, service_workers="allow",
            viewport={"width": 390, "height": 844},
        ) as context:
            page = context.new_page()
            page.set_default_timeout(30000)
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(base + "/index.html", wait_until="domcontentloaded")
            page.locator("nav.bottom-tabs button[data-page='train']").wait_for()
            set_seed(page, fixtures)
            page.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("navigator.serviceWorker.controller !== null")
            assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
            assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
            cache_names = page.evaluate("async () => caches.keys()")
            original = [name for name in cache_names if name.startswith("fitnesspilot-preview-")]
            assert len(original) == 1, "Expected exactly one installed preview cache."
            context.set_offline(True)
            try:
                page.reload(wait_until="domcontentloaded")
                page.locator("nav.bottom-tabs button[data-page='train']").wait_for()
                assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
                assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
            finally:
                context.set_offline(False)
            findings.append("Real service worker reopens cached app while offline and preserves two stores.")

            # The test server changes only the served SW script's cache literal.
            UpgradeHandler.use_upgrade = True
            page.evaluate("""async () => {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) throw Error('No service-worker registration');
                await registration.update();
            }""")
            page.wait_for_function("""async () => (await caches.keys()).some(
                name => name.endsWith('-b098-upgrade'))""")
            cache_names = page.evaluate("async () => caches.keys()")
            assert any(name.endswith("-b098-upgrade") for name in cache_names)
            assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
            assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
            page.reload(wait_until="domcontentloaded")
            page.locator("nav.bottom-tabs button[data-page='train']").wait_for()
            assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
            assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
            findings.append("In-memory service-worker cache-name change preserves localStorage and opens the app.")
    finally:
        UpgradeHandler.use_upgrade = False
    return findings
