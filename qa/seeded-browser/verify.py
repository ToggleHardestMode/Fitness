"""Run seeded Food Diary QA against a LOCAL Fitness source checkout.

Only operates in disposable Playwright browser contexts served on localhost.
Never touches the operator's Brave profile, real storage, GitHub, or production.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading

from fixture import FOOD_KEY, WORKOUT_KEY, LAST_DAY, create_fixtures, expected_last_day, validate_fixture


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def check_repo(root):
    required = (
        'package.json',
        'preview-v101/food-diary.html',
        'preview-v101/food-diary.js',
        'preview-v101/food-diary-core.js',
        'preview-v101/sg-food-lookup.js',
        'preview-v101/sg-food-references.js',
        'preview-v101/app.js',
    )
    for rel in required:
        if not (root / rel).is_file():
            raise ValueError('Expected local Fitness repository file is missing: ' + str(root / rel))
    p = json.loads((root / 'package.json').read_text('utf-8'))
    if p.get('scripts', {}).get('test') != 'node --test tests/*.test.mjs':
        raise ValueError('Unexpected Fitness package.json test contract; verify repository identity.')


def set_seed(page, data):
    payload = {key: json.dumps(value, separators=(',', ':')) for key, value in data.items()}
    page.evaluate('items => {for (const [key,value] of Object.entries(items)) localStorage.setItem(key,value)}', payload)


def get_store(page, key):
    raw = page.evaluate('(key) => localStorage.getItem(key)', key)
    if raw is None:
        raise AssertionError('Missing expected browser storage key: ' + key)
    return json.loads(raw)


def select_day(page, day):
    field = page.locator('#fd-date')
    field.fill(day)
    field.dispatch_event('change')


def check_day(page):
    want = expected_last_day()
    select_day(page, LAST_DAY)
    assert page.locator('#fd-count').inner_text() == '3 food/drink entries'
    for k in ('kcal', 'protein', 'carbs', 'fat'):
        displayed = page.locator('#fd-total-' + k).inner_text()
        unit = 'kcal' if k == 'kcal' else 'g'
        assert displayed == f'≥ {want[k]} {unit} · 1 unknown', (k, displayed)
    assert page.locator('#fd-list .fd-entry').count() == 3


def test_local_app(repo, chromium_binary=None, headed=False):
    from playwright.sync_api import sync_playwright

    check_repo(repo)
    dataset = create_fixtures()
    expected = validate_fixture(dataset)
    handler = partial(QuietHandler, directory=str(repo))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/preview-v101/food-diary.html'
    findings = []

    try:
        with sync_playwright() as playwright:
            kwargs = {'headless': not headed}
            if chromium_binary:
                kwargs['executable_path'] = str(chromium_binary)
            browser = playwright.chromium.launch(**kwargs)
            try:
                with browser.new_context(accept_downloads=True, service_workers='block',
                                         viewport={'width': 390, 'height': 844}) as ctx:
                    page = ctx.new_page()
                    page.goto(url, wait_until='domcontentloaded')
                    page.locator('#fd-form').wait_for()
                    set_seed(page, dataset)
                    page.reload(wait_until='domcontentloaded')
                    page.locator('#fd-list .fd-entry').first.wait_for()
                    check_day(page)
                    findings.append('Loaded 60 seeded Food Diary entries and verified exact 28-Oct partial nutrient totals (unknown != zero).')

                    original_workout = get_store(page, WORKOUT_KEY)
                    original_diary = get_store(page, FOOD_KEY)
                    repeat = page.locator('#fd-recent .fd-recent-entry').first
                    assert repeat.count() == 1, 'No recent food available to repeat.'
                    repeat.get_by_role('button', name='Repeat on this day').click()
                    assert page.locator('#fd-count').inner_text() == '4 food/drink entries'
                    copied = get_store(page, FOOD_KEY)
                    assert len(copied['entries']) == len(original_diary['entries']) + 1
                    assert copied['entries'][:len(original_diary['entries'])] == original_diary['entries']
                    assert get_store(page, WORKOUT_KEY) == original_workout
                    findings.append('Repeating a previous food created one new entry without changing historical food or workout data.')

                    with page.expect_download() as event:
                        page.locator('#fd-export').click()
                    download = event.value
                    assert download.suggested_filename == 'fitnesspilot-food-diary-v1.json'
                    backup_bytes = Path(download.path()).read_bytes()
                    assert json.loads(backup_bytes) == copied
                    findings.append('Exported browser-generated Food Diary JSON and compared it to the saved seeded-plus-repeated data.')

                    # Restoring into a nonempty diary must be rejected without modifying anything.
                    page.locator('#fd-import').set_input_files({
                        'name': download.suggested_filename, 'mimeType': 'application/json',
                        'buffer': backup_bytes,
                    })
                    page.get_by_text('Restore only works with an empty diary', exact=False).wait_for()
                    assert get_store(page, FOOD_KEY) == copied
                    findings.append('Restore to nonempty Food Diary rejected; existing entries unchanged.')

                # Fresh disposable browser context: zero prior food entries; no real user state.
                with browser.new_context(accept_downloads=True, service_workers='block',
                                         viewport={'width': 390, 'height': 844}) as clean:
                    fresh = clean.new_page()
                    fresh.goto(url, wait_until='domcontentloaded')
                    fresh.locator('#fd-form').wait_for()
                    set_seed(fresh, {WORKOUT_KEY: dataset[WORKOUT_KEY]})
                    fresh.reload(wait_until='domcontentloaded')
                    assert get_store(fresh, WORKOUT_KEY) == dataset[WORKOUT_KEY]
                    assert fresh.locator('#fd-count').inner_text() == '0 food/drink entries'
                    fresh.on('dialog', lambda dialog: dialog.accept())
                    fresh.locator('#fd-import').set_input_files({
                        'name': download.suggested_filename, 'mimeType': 'application/json',
                        'buffer': backup_bytes,
                    })
                    fresh.get_by_text('Diary restored from backup', exact=False).wait_for()
                    assert get_store(fresh, FOOD_KEY) == copied
                    assert get_store(fresh, WORKOUT_KEY) == dataset[WORKOUT_KEY]
                    fresh.reload(wait_until='domcontentloaded')
                    fresh.locator('#fd-form').wait_for()
                    assert get_store(fresh, FOOD_KEY) == copied
                    select_day(fresh, LAST_DAY)
                    assert fresh.locator('#fd-count').inner_text() == '4 food/drink entries'
                    findings.append('Restored downloaded backup into separate empty browser context; workout state unchanged and diary survived reload.')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)

    return {'result': 'PASS', 'browser': 'Playwright Chromium',
            'repo_root': str(repo), 'fixture': expected, 'checks': findings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', required=True, type=Path,
                        help='Existing read-only local checkout containing preview-v101/')
    parser.add_argument('--chromium', type=Path, help='Optional Playwright-compatible Chromium executable')
    parser.add_argument('--headed', action='store_true', help='Show separate test Chromium window')
    args = parser.parse_args()
    root = args.repo_root.expanduser().resolve()
    if not root.is_dir():
        parser.error('--repo-root is not a directory: ' + str(root))
    try:
        report = test_local_app(root, args.chromium, args.headed)
        print(json.dumps(report, indent=2, sort_keys=True))
    except (AssertionError, ValueError, RuntimeError) as exc:
        parser.exit(1, 'QA FAILED: ' + str(exc) + '\n')


if __name__ == '__main__':
    main()
