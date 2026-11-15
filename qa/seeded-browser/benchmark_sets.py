"""B103: operator-timed, isolated 30-set FitnessPilot UI benchmark.

Only loads a disposable localhost FitnessPilot checkout with fictional data.
Writes one new evidence report; does not alter the source, a real browser, or Pages.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading

BENCHMARK_DAY = '2026-11-09'  # Monday, avoids dependence on the system clock.
KEY = 'fitnesspilot.preview.v101.v1'
TEMPLATE = 'b103-fictional-30-set-plan'
TARGET = {'kg': 10, 'reps': 10, 'rpe': 7}
EXERCISES = 10
SETS_PER_EXERCISE = 3


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def synthetic_workout():
    return {
        'version': 1,
        'templates': [{
            'id': TEMPLATE, 'name': 'B103 synthetic logging benchmark', 'day': 0,
            'exercises': [{
                'name': f'Synthetic press {i + 1:02d}', 'muscle': 'Chest',
                'sets': SETS_PER_EXERCISE, 'min': 8, 'max': 12, 'rest': 90,
            } for i in range(EXERCISES)],
        }],
        'assignments': {'0': TEMPLATE}, 'logs': [], 'metrics': [],
        'reminder': {'hour': 18, 'minute': 30, 'lead': 0},
    }


def score_workout(state):
    """Score identity/completeness, not just an inflated count of logs."""
    if not isinstance(state, dict) or not isinstance(state.get('logs'), list):
        raise ValueError('Saved state is missing a logs array.')
    expected = {(exercise, set_number) for exercise in range(EXERCISES)
                for set_number in range(1, SETS_PER_EXERCISE + 1)}
    seen = {}
    for row in state['logs']:
        if row.get('templateId') != TEMPLATE or row.get('date') != BENCHMARK_DAY:
            continue
        key = (row.get('exerciseIndex'), row.get('set'))
        if key in seen:
            raise ValueError('Duplicate saved set identity in benchmark state.')
        seen[key] = row
    missing = sorted(expected - seen.keys())
    extras = sorted(seen.keys() - expected)
    mismatched = [list(k) for k in sorted(expected & seen.keys())
                  if any(seen[k].get(field) != want for field, want in TARGET.items())]
    return {'expected_sets': len(expected), 'saved_sets': len(expected & seen.keys()),
            'missing_sets': [list(k) for k in missing], 'extra_sets': [list(k) for k in extras],
            'mismatched_sets': mismatched}


INSTRUMENT = r"""() => {
  const KEY = 'fitnesspilot.preview.v101.v1';
  const idOf = row => `${row.date}|${row.templateId}|${row.exerciseIndex}|${row.set}`;
  const stats = {started: null, pointerTaps: 0, keyboardKeys: 0,
                 savedSubmissions: 0, correctedSavedSets: 0};
  window.__b103 = stats;
  document.addEventListener('pointerdown', event => {
    if (!event.isTrusted) return;
    if (stats.started === null) stats.started = performance.now();
    stats.pointerTaps++;
  }, true);
  document.addEventListener('keydown', event => {
    if (!event.isTrusted) return;
    if (stats.started === null) stats.started = performance.now();
    stats.keyboardKeys++;
  }, true);
  document.addEventListener('submit', event => {
    if (event.target?.id === 'sets-form') stats.savedSubmissions++;
  }, true);
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    const relevant = key === KEY && this === window.localStorage;
    let before = null;
    if (relevant) try { before = JSON.parse(this.getItem(key)).logs || []; } catch {}
    const result = original.apply(this, arguments);
    if (relevant && before) {
      try {
        const old = new Map(before.map(row => [idOf(row), row]));
        const after = JSON.parse(value).logs || [];
        for (const row of after) {
          const previous = old.get(idOf(row));
          if (previous && JSON.stringify(previous) !== JSON.stringify(row))
            stats.correctedSavedSets++;
        }
      } catch { /* The app remains authoritative; report mismatches separately. */ }
    }
    return result;
  };
}"""


def check_source(root):
    required = ['package.json', 'preview-v101/index.html',
                'preview-v101/app.js', 'preview-v101/core.js']
    for rel in required:
        if not (root / rel).is_file():
            raise ValueError('Missing expected FitnessPilot file: ' + rel)
    pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
    if pkg.get('scripts', {}).get('test') != 'node --test tests/*.test.mjs':
        raise ValueError('Unexpected FitnessPilot checkout; npm test contract differs.')


def run(root, output, mode, chromium=None):
    from playwright.sync_api import sync_playwright

    check_source(root)
    if output.exists():
        raise ValueError('Evidence folder already exists: ' + str(output))
    if not output.parent.is_dir():
        raise ValueError('Evidence parent directory does not exist: ' + str(output.parent))
    output.mkdir()  # Prevent silent overwrite of prior evidence.
    report = {'result': 'FAIL', 'mode': mode, 'date': BENCHMARK_DAY,
              'target': 'disposable-localhost', 'fixture': 'synthetic', 'expected': 30}
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            kwargs = {'headless': False}
            if chromium:
                kwargs['executable_path'] = str(chromium)
            browser = playwright.chromium.launch(**kwargs)
            try:
                with browser.new_context(viewport={'width': 390, 'height': 844},
                                         service_workers='block') as context:
                    page = context.new_page()
                    page.goto(f'http://127.0.0.1:{server.server_port}/preview-v101/',
                              wait_until='domcontentloaded')
                    page.locator('nav.bottom-tabs').wait_for()
                    page.evaluate('(payload) => localStorage.setItem(payload.key, JSON.stringify(payload.state))',
                                  {'key': KEY, 'state': synthetic_workout()})
                    page.reload(wait_until='domcontentloaded')
                    page.locator('nav.bottom-tabs button[data-page="train"]').click()
                    page.locator('#active-date').fill(BENCHMARK_DAY)
                    page.locator('#active-date').dispatch_event('change')
                    page.locator('#active-workout').select_option(TEMPLATE)
                    if mode == 'focus':
                        page.locator('button[data-action="focus-toggle"]').click()
                    page.locator('#sets-form').wait_for()
                    page.evaluate(INSTRUMENT)
                    print('B103 BENCHMARK: 10 synthetic exercises, 3 sets each (30 total).', flush=True)
                    print('For every set enter exactly 10 kg, 10 reps and RPE 7.', flush=True)
                    print('Use the normal UI. Corrections are allowed. No real records are present.', flush=True)
                    print('The stopwatch and click counter begin at your FIRST browser interaction.', flush=True)
                    input('Press ENTER in this terminal AFTER you finish or abandon the 30 sets: ')
                    data = page.evaluate('''() => ({
                      state: JSON.parse(localStorage.getItem('fitnesspilot.preview.v101.v1')),
                      stats: window.__b103,
                      finished: performance.now()
                    })''')
                    scored = score_workout(data['state'])
                    stats = data['stats']
                    elapsed = None if stats['started'] is None else round(
                        (data['finished'] - stats['started']) / 1000, 2)
                    report.update(scored)
                    report.update({'duration_seconds': elapsed,
                                   'pointer_taps': stats['pointerTaps'],
                                   'keyboard_keys': stats['keyboardKeys'],
                                   'save_attempts': stats['savedSubmissions'],
                                   'corrected_saved_sets': stats['correctedSavedSets'],
                                   'result': 'PASS' if not scored['missing_sets']
                                   and not scored['extra_sets'] and not scored['mismatched_sets']
                                   and elapsed is not None else 'FAIL'})
            finally:
                browser.close()
    except Exception as exc:
        report['error'] = type(exc).__name__ + ': ' + str(exc)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
        (output / 'report.json').write_text(json.dumps(report, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', type=Path, required=True,
                        help='Existing read-only FitnessPilot checkout')
    parser.add_argument('--output', type=Path, required=True,
                        help='NEW folder for the report; never overwritten')
    parser.add_argument('--mode', choices=['focus', 'standard'], required=True,
                        help='Which existing Train logging UI to measure')
    parser.add_argument('--chromium', type=Path,
                        help='Optional Playwright-compatible Chromium binary')
    args = parser.parse_args()
    root, output = args.repo_root.expanduser().resolve(), args.output.expanduser().resolve()
    try:
        report = run(root, output, args.mode, args.chromium)
    except (OSError, ValueError) as exc:
        parser.exit(2, 'B103 CONFIG ERROR: ' + str(exc) + '\n')
    print(json.dumps(report, indent=2, sort_keys=True))
    if report['result'] != 'PASS':
        parser.exit(1, 'B103 did not complete cleanly. Inspect the report and correct the workflow.\n')


if __name__ == '__main__':
    main()
