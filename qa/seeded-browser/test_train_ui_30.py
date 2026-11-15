import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from train_ui_30 import equivalent, reference_fixture, run

HERE = Path(__file__).resolve().parent


class TrainUiFixtureChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reference = json.loads((HERE / 'fixtures/b103_30_complete.json').read_text('utf-8'))

    def test_saved_ui_records_match_exact_reference_despite_generated_ids(self):
        saved = json.loads(json.dumps(self.reference))
        for index, row in enumerate(saved['logs']):
            row['id'] = f'generated-by-app-{index}'
        self.assertEqual(equivalent(saved, self.reference)['saved_sets'], 30)

    def test_missing_and_duplicate_records_are_rejected(self):
        missing = json.loads(json.dumps(self.reference))
        missing['logs'].pop()
        with self.assertRaisesRegex(ValueError, 'Expected 30 saved'):
            equivalent(missing, self.reference)
        doubled = json.loads(json.dumps(self.reference))
        doubled['logs'][-1] = dict(doubled['logs'][0], id='another-id')
        with self.assertRaisesRegex(ValueError, 'Duplicate saved set identity'):
            equivalent(doubled, self.reference)

    def test_wrong_metadata_and_changed_configuration_are_rejected(self):
        wrong = json.loads(json.dumps(self.reference))
        wrong['logs'][0]['rest'] = 120
        with self.assertRaisesRegex(ValueError, 'rest'):
            equivalent(wrong, self.reference)
        altered = json.loads(json.dumps(self.reference))
        altered['assignments'] = {}
        with self.assertRaisesRegex(ValueError, 'assignments'):
            equivalent(altered, self.reference)

    def test_missing_reference_fixture_is_rejected(self):
        with TemporaryDirectory() as root:
            with self.assertRaisesRegex(ValueError, 'Missing B103 synthetic'):
                reference_fixture(Path(root))

    def test_does_not_overwrite_existing_evidence(self):
        with TemporaryDirectory() as root:
            root = Path(root)
            (root / 'package.json').write_text('{"scripts":{"test":"node --test tests/*.test.mjs"}}')
            for rel in ['preview-v101/index.html', 'preview-v101/app.js', 'preview-v101/core.js']:
                p = root / rel
                p.parent.mkdir(exist_ok=True, parents=True)
                p.write_text('test fixture')
            p = root / 'qa/seeded-browser/fixtures/b103_30_complete.json'
            p.parent.mkdir(exist_ok=True, parents=True)
            p.write_text(json.dumps(self.reference))
            output = root / 'evidence'
            output.mkdir()
            (output / 'report.json').write_text('untouched')
            with self.assertRaisesRegex(ValueError, 'already exists'):
                run(root, output)
            self.assertEqual((output / 'report.json').read_text(), 'untouched')


if __name__ == '__main__':
    unittest.main()
