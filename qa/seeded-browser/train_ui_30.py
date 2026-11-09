"""B103: save 30 fictional workout sets through the actual FitnessPilot Train UI.

Uses disposable localhost and fresh Chromium contexts only. Never uses a real profile,
website data, or the GitHub Pages origin. Automated UI time is not human timing.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading

from benchmark_sets import BENCHMARK_DAY, KEY, TEMPLATE, check_source, score_workout

FIXTURE_PATH = Path('qa/seeded-browser/fixtures/b103_30_complete.json')
EXPECTED_COUNT = 30


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def reference_fixture(root):
    source = root / FIXTURE_PATH
    if not source.is_file():
        raise ValueError(f'Missing B103 synthetic reference fixture: {source}')
    fixture = json.loads(source.read_text(encoding='utf-8'))
    if len(fixture.get('templates', [])) != 1 or len(fixture['templates'][0].get('exercises', [])) != 10:
        raise ValueError('B103 reference fixture must contain 10 exercises in one workout.')
    if len(fixture.get('logs', [])) != EXPECTED_COUNT or score_workout(fixture)['saved_sets'] != EXPECTED_COUNT:
        raise ValueError('B103 reference fixture does not contain exactly 30 valid sets.')
    if fixture['templates'][0]['id'] != TEMPLATE or any(
        row['templateId'] != TEMPLATE or row['date'] != BENCHMARK_DAY for row in fixture['logs']
    ):
        raise ValueError('B103 reference fixture identity/date does not match the benchmark.')
    return fixture


def equivalent(saved, fixture):
    """Check all persisted fields while allowing the app to generate unique log IDs."""
    if not isinstance(saved, dict) or not isinstance(saved.get('logs'), list):
        raise ValueError('Browser state has no saved log list.')
    if len(saved['logs']) != EXPECTED_COUNT:
        raise ValueError(f'Expected 30 saved sets, found {len(saved["logs"])}.')
    if len({row.get('id') for row in saved['logs']}) != EXPECTED_COUNT:
        raise ValueError('Saved set IDs are missing or duplicated.')
    scored = score_workout(saved)  # Also rejects duplicate date/template/exercise/set identities.
    if scored['missing_sets'] or scored['extra_sets'] or scored['mismatched_sets']:
        raise ValueError('Saved set identities or kg/reps/RPE differ from the reference fixture.')
    expected = {(row['exerciseIndex'], row['set']): row for row in fixture['logs']}
    for row in saved['logs']:
        key = (row['exerciseIndex'], row['set'])
        want = expected[key]
        for field, value in want.items():
            if field != 'id' and row.get(field) != value:
                raise ValueError(f'Set {key} has incorrect {field}.')
    for field in ('templates', 'assignments', 'metrics', 'reminder', 'version'):
        if saved.get(field) != fixture.get(field):
            raise ValueError(f'Saving Train sets unexpectedly changed {field}.')
    return scored


def stored_state(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)



def run_mode(browser, origin, fixture, mode):
    errors = []
    with browser.new_context(viewport={'width': 390, 'height': 844},
                             service_workers='block') as context:
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin + '/preview-v101/', wait_until='domcontentloaded')
        page.locator('nav.bottom-tabs').wait_for()
        if page.evaluate('(key) => localStorage.getItem(key)', KEY) is not None:
            raise AssertionError('Disposable browser context unexpectedly contains saved data.')
        empty = {**fixture, 'logs': []}
        page.evaluate('([key, state]) => localStorage.setItem(key, JSON.stringify(state))',
                      [KEY, empty])
        page.reload(wait_until='domcontentloaded')
        page.locator('nav.bottom-tabs button[data-page="train"]').click()
        page.locator('#active-date').fill(BENCHMARK_DAY)
        page.locator('#active-date').dispatch_event('change')
        page.locator('#active-workout').select_option(TEMPLATE)
        if mode == 'focus':
            page.locator('button[data-action="focus-toggle"]').click()
            if page.locator('button[data-action="focus-toggle"]').get_attribute('aria-pressed') != 'true':
                raise AssertionError('Train did not enter Focus Mode.')
        if stored_state(page)['logs']:
            raise AssertionError('UI setup unexpectedly inserted saved sets.')

        saves = 0
        for exercise in range(10):
            if mode == 'standard':
                page.locator(f'button[data-exercise="{exercise}"]').click()
                form = page.locator('#sets-form')
                for set_index in range(3):
                    form.locator(f'input[name="kg{set_index}"]').fill('10')
                    form.locator(f'input[name="reps{set_index}"]').fill('10')
                    form.locator(f'input[name="rpe{set_index}"]').fill('7')
                    form.locator(f'input[name="done{set_index}"]').check()
                form.locator('button[type="submit"]').click()
                saves += 1
                wanted = (exercise + 1) * 3
                if len(stored_state(page)['logs']) != wanted:
                    raise AssertionError(f'Standard save {exercise + 1} did not persist {wanted} sets.')
            else:
                for set_index in range(3):
                    form = page.locator('#sets-form')
                    # Focus Mode promises to advance to the next unsaved set.
                    if f'Set {set_index + 1} of 3' not in form.locator('.v152-focus-header').inner_text():
                        raise AssertionError(f'Focus Mode did not navigate to set {set_index + 1}.')
                    if page.locator('.codex-log-panel .card-head h2').inner_text().strip() != \
                            fixture['templates'][0]['exercises'][exercise]['name']:
                        raise AssertionError(f'Focus Mode did not navigate to exercise {exercise + 1}.')
                    form.locator(f'input[name="kg{set_index}"]').fill('10')
                    form.locator(f'input[name="reps{set_index}"]').fill('10')
                    form.locator(f'input[name="rpe{set_index}"]').fill('7')
                    form.locator('button[type="submit"]').click()
                    saves += 1
                    wanted = exercise * 3 + set_index + 1
                    if len(stored_state(page)['logs']) != wanted:
                        raise AssertionError(f'Focus save {wanted} did not persist the expected set.')
        before_reload = stored_state(page)
        scored = equivalent(before_reload, fixture)
        ids = {(row['exerciseIndex'], row['set']): row['id'] for row in before_reload['logs']}
        page.reload(wait_until='domcontentloaded')
        page.locator('nav.bottom-tabs button[data-page="train"]').click()
        page.locator('#active-date').fill(BENCHMARK_DAY)
        page.locator('#active-date').dispatch_event('change')
        page.locator('#active-workout').select_option(TEMPLATE)
        after_reload = stored_state(page)
        if after_reload != before_reload:
            raise AssertionError('Saved records changed across browser reload.')
        if ids != {(row['exerciseIndex'], row['set']): row['id'] for row in after_reload['logs']}:
            raise AssertionError('Set identities were rewritten on reload.')
        if errors:
            raise AssertionError('Browser JavaScript errors: ' + '; '.join(errors[:3]))
        equivalent(after_reload, fixture)
        return {'result': 'PASS', 'mode': mode, 'ui_save_actions': saves,
                'persisted_sets': scored['saved_sets'], 'reloaded_sets': len(after_reload['logs']),
                'missing_sets': scored['missing_sets'], 'extra_sets': scored['extra_sets'],
                'mismatched_sets': scored['mismatched_sets'], 'browser_errors': errors}


def run(root, output, mode='both', chromium=None):
    from playwright.sync_api import sync_playwright
    check_source(root)
    fixture = reference_fixture(root)
    if output.exists():
        raise ValueError('Evidence folder already exists: ' + str(output))
    if not output.parent.is_dir():
        raise ValueError('Evidence parent directory does not exist: ' + str(output.parent))
    if mode not in ('both', 'focus', 'standard'):
        raise ValueError('Mode must be both, focus, or standard.')
    output.mkdir()
    report = {'result': 'FAIL', 'target': 'disposable-localhost', 'source': 'B103 synthetic 30-set fixture',
              'browser': 'Playwright Chromium', 'modes': [], 'human_benchmark': 'NOT RUN'}
    server = None
    thread = None
    try:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f'http://127.0.0.1:{server.server_port}'
        with sync_playwright() as playwright:
            kwargs = {'headless': True}
            if chromium is not None:
                kwargs['executable_path'] = str(chromium)
            browser = playwright.chromium.launch(**kwargs)
            try:
                for label in (('standard', 'focus') if mode == 'both' else (mode,)):
                    report['active_mode'] = label
                    report['modes'].append(run_mode(browser, origin, fixture, label))
                    del report['active_mode']
            finally:
                browser.close()
        report['result'] = 'PASS'
    except Exception as error:
        report['error'] = type(error).__name__ + ': ' + str(error)
    finally:
        if server:
            server.shutdown()
            server.server_close()
        if thread:
            thread.join(timeout=3)
        (output / 'report.json').write_text(json.dumps(report, sort_keys=True, indent=2) + '\n',
                                            encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', type=Path, required=True,
                        help='Fitness checkout containing qa/seeded-browser fixtures and preview-v101')
    parser.add_argument('--output', type=Path, required=True,
                        help='New directory for report.json; never overwrites existing evidence')
    parser.add_argument('--mode', choices=('both', 'focus', 'standard'), default='both')
    parser.add_argument('--chromium', type=Path, help='Optional compatible Chromium executable')
    args = parser.parse_args()
    try:
        result = run(args.repo_root.expanduser().resolve(),
                     args.output.expanduser().resolve(), args.mode, args.chromium)
    except (ValueError, OSError) as error:
        parser.exit(2, 'B103 CONFIG ERROR: ' + str(error) + '\n')
    print(json.dumps(result, sort_keys=True, indent=2))
    if result['result'] != 'PASS':
        parser.exit(1, 'B103 Train UI check failed; inspect report.json.\n')


if __name__ == '__main__':
    main()
