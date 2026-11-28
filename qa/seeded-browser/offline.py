"""B098 disposable browser checks for offline shell and cache-name upgrades.

Imported by integrated.py. No standalone runner, no filesystem mutation.
"""
import re
from pathlib import Path

from fixture import WORKOUT_KEY, FOOD_KEY
from verify import QuietHandler, get_store, set_seed


UPGRADE_SUFFIX = "-b098-upgrade"
RELEASE_SCOPE = "/release-fixture/"
RELEASE_CACHE = "fitnesspilot-release-fixture-"

# Two genuinely incompatible module interfaces, served at immutable release URLs.
RELEASE_MODULES = {
    "a": {
        "main.js": "import {describe} from './core.js'; document.querySelector('output').textContent=describe(); "
                   "window.readLazy=async()=> (await import('./lazy.js')).oldDetail();",
        "core.js": "export const describe=()=> 'A: legacy interface';",
        "lazy.js": "export const oldDetail=()=> 'A: lazy detail';",
    },
    "b": {
        "main.js": "import {format} from './core.js'; document.querySelector('output').textContent=format({version:'B'}); "
                   "window.readLazy=async()=> (await import('./lazy.js')).newDetail();",
        "core.js": "export const format=({version})=>version+': canonical interface';",
        "lazy.js": "export const newDetail=()=> 'B: lazy detail';",
    },
}


def release_shell(release):
    return ('<!doctype html><html lang="en"><meta charset="utf-8"><title>Release fixture</title>'
            '<output>Loading</output><script type="module" src="' + RELEASE_SCOPE +
            release + '/main.js"></script></html>')


def release_worker(release):
    # A stable entry point selects a complete release; immutable asset paths never fall back
    # to a different release. Retain A for already-open clients in this bounded experiment.
    return """const VERSION = '@release@', PREFIX = '@cache@';
const ROOT = '@scope@', CACHE = PREFIX + VERSION;
const assets = ['index.html','main.js','core.js','lazy.js'].map(f=>ROOT+VERSION+'/'+f);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  try {await (await caches.open(CACHE)).addAll(assets);}
  catch(error){await caches.delete(CACHE);throw error;}
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(ROOT))return;
  event.respondWith((async()=>{
    if(url.pathname===ROOT+'index.html'){
      return (await caches.open(CACHE)).match(ROOT+VERSION+'/index.html').then(r=>r||Response.error());
    }
    const release=url.pathname.slice(ROOT.length).split('/')[0];
    if(!['a','b'].includes(release))return Response.error();
    const cache=await caches.open(PREFIX+release);
    return (await cache.match(event.request))||Response.error();
  })());
});
""".replace("@release@", release).replace("@cache@", RELEASE_CACHE).replace("@scope@", RELEASE_SCOPE)


class UpgradeHandler(QuietHandler):
    """Serve a test-only new SW cache name from memory, without changing source."""
    use_upgrade = False
    release = "a"
    release_missing = False

    def serve_release(self, path):
        relative = path[len(RELEASE_SCOPE):]
        mime = "text/javascript"
        if relative == "sw.js":
            body = release_worker(self.release)
        elif relative == "index.html":
            body, mime = release_shell(self.release), "text/html"
        else:
            release, _, filename = relative.partition("/")
            if release not in RELEASE_MODULES:
                self.send_error(404)
                return
            if release == "b" and filename == "lazy.js" and self.release_missing:
                self.send_error(503, "Synthetic incomplete release")
                return
            if filename == "index.html":
                body, mime = release_shell(release), "text/html"
            elif filename in RELEASE_MODULES[release]:
                body = RELEASE_MODULES[release][filename]
            else:
                self.send_error(404)
                return
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith(RELEASE_SCOPE):
            self.serve_release(path)
            return
        if self.use_upgrade and self.path.split("?", 1)[0] == "/preview-v101/sw.js":
            source = (Path(self.directory) / "preview-v101/sw.js").read_text("utf-8")
            pattern = r"(?m)^(const CACHE = ')([^']+)(';)"
            replacement = lambda m: m.group(1) + m.group(2) + UPGRADE_SUFFIX + m.group(3)
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
            old_cache = original[0]
            new_cache = old_cache + UPGRADE_SUFFIX
            old_controller = page.evaluate_handle("() => navigator.serviceWorker.controller")
            UpgradeHandler.use_upgrade = True
            page.evaluate("""async () => {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration) throw Error('No service-worker registration');
                await registration.update();
            }""")
            page.wait_for_function(
                """async ({oldController, oldCache, newCache}) => {
                    const controller = navigator.serviceWorker.controller;
                    if (!controller || controller === oldController || controller.state !== 'activated') {
                        return false;
                    }
                    const names = await caches.keys();
                    return names.includes(newCache) && !names.includes(oldCache);
                }""",
                arg={"oldController": old_controller, "oldCache": old_cache, "newCache": new_cache},
            )
            assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
            assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]

            context.set_offline(True)
            try:
                response = page.reload(wait_until="domcontentloaded")
                assert response is not None and response.from_service_worker, (
                    "Expected offline navigation to be served by the replacement service worker."
                )
                page.locator("nav.bottom-tabs button[data-page='train']").wait_for()
                assert get_store(page, WORKOUT_KEY) == fixtures[WORKOUT_KEY]
                assert get_store(page, FOOD_KEY) == fixtures[FOOD_KEY]
            finally:
                context.set_offline(False)
            findings.append("Replacement service worker reopens the app offline and preserves both stores.")
    finally:
        UpgradeHandler.use_upgrade = False
    return findings


def check_coherent_release(browser, base, errors):
    """Real SW install/activation with incompatible fixture modules; no live SW edits."""
    origin = base.rsplit("/", 1)[0]
    entry = origin + RELEASE_SCOPE + "index.html"
    UpgradeHandler.release = "a"
    UpgradeHandler.release_missing = False
    try:
        with browser.new_context(service_workers="allow") as context:
            old = context.new_page()
            old.on("pageerror", lambda exc: errors.append(str(exc)))
            old.goto(entry, wait_until="domcontentloaded")
            old.get_by_text("A: legacy interface", exact=True).wait_for()
            old.evaluate("async () => {await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready;}")
            old.wait_for_function("navigator.serviceWorker.controller?.state==='activated'")
            # Synthetic marker only, not the application storage keys.
            old.evaluate("localStorage.setItem('fitnesspilot-release-fixture-marker','preserved')")
            cache_a = RELEASE_CACHE + "a"
            cache_b = RELEASE_CACHE + "b"
            assert cache_a in old.evaluate("caches.keys()")
            UpgradeHandler.release = "b"
            UpgradeHandler.release_missing = True
            # Observe actual installation failure before repairing the synthetic release.
            state = old.evaluate("""async () => {
              const registration=await navigator.serviceWorker.getRegistration();
              const terminal=new Promise((resolve,reject)=>{
                const timer=setTimeout(()=>reject(Error('Failed install not observed')),20000);
                registration.addEventListener('updatefound',()=>{
                  const worker=registration.installing;
                  if(!worker){clearTimeout(timer);reject(Error('Missing installing worker'));return;}
                  const check=()=>{
                    if(['redundant','activated'].includes(worker.state)){clearTimeout(timer);resolve(worker.state);}
                  };
                  worker.addEventListener('statechange',check);check();
                },{once:true});
              });
              await registration.update();
              return terminal;
            }""")
            assert state == "redundant", "Incomplete release activated."
            assert cache_b not in old.evaluate("caches.keys()"), "Failed release retained a partial cache."
            current = context.new_page()
            current.on("pageerror", lambda exc: errors.append(str(exc)))
            current.goto(entry, wait_until="domcontentloaded")
            current.get_by_text("A: legacy interface", exact=True).wait_for()
            assert old.locator("output").inner_text() == "A: legacy interface"
            # The server now contains the complete immutable B release.
            UpgradeHandler.release_missing = False
            old_controller = old.evaluate_handle("navigator.serviceWorker.controller")
            old.evaluate("async () => (await navigator.serviceWorker.getRegistration()).update()")
            old.wait_for_function("""async ({previous,cache})=>{
              const controller=navigator.serviceWorker.controller;
              return controller&&controller!==previous&&controller.state==='activated'&&(await caches.keys()).includes(cache);
            }""", arg={"previous": old_controller, "cache": cache_b})
            assert cache_a in old.evaluate("caches.keys()"), "Previous release cache removed."
            current.reload(wait_until="domcontentloaded")
            current.get_by_text("B: canonical interface", exact=True).wait_for()
            context.set_offline(True)
            try:
                # First lazy module load on the old tab occurs AFTER upgrade and OFFLINE.
                assert old.evaluate("window.readLazy()") == "A: lazy detail"
                response = current.reload(wait_until="domcontentloaded")
                assert response is not None and response.from_service_worker
                current.get_by_text("B: canonical interface", exact=True).wait_for()
                assert current.evaluate("window.readLazy()") == "B: lazy detail"
                assert current.evaluate("localStorage.getItem('fitnesspilot-release-fixture-marker')") == "preserved"
                assert old.locator("output").inner_text() == "A: legacy interface"
            finally:
                context.set_offline(False)
    finally:
        UpgradeHandler.release = "a"
        UpgradeHandler.release_missing = False
    return ["Immutable release fixture: incomplete install refused; A retained; complete B activated; "
            "old A lazy import and B reload offline; fixture marker preserved."]
