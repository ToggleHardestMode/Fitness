"""B103 regression checks on disposable synthetic saved-state fixtures."""
import unittest
from benchmark_sets import (BENCHMARK_DAY, EXERCISES, SETS_PER_EXERCISE,
                            TARGET, TEMPLATE, score_workout, synthetic_workout)


class BenchmarkChecks(unittest.TestCase):
    def make_logs(self):
        return [dict(id=f'fake-{i}-{s}', date=BENCHMARK_DAY, templateId=TEMPLATE,
                     exerciseIndex=i, set=s, **TARGET)
                for i in range(EXERCISES) for s in range(1, SETS_PER_EXERCISE + 1)]

    def test_synthetic_fixture_exactly_thirty_and_valid_shape(self):
        state = synthetic_workout()
        self.assertEqual(sum(e['sets'] for e in state['templates'][0]['exercises']), 30)
        self.assertEqual(state['logs'], [])
        self.assertEqual(state['templates'][0]['id'], TEMPLATE)

    def test_complete_and_correct_passes(self):
        result = score_workout({'logs': self.make_logs()})
        self.assertEqual(result['saved_sets'], 30)
        self.assertEqual(result['missing_sets'], [])
        self.assertEqual(result['mismatched_sets'], [])

    def test_missing_wrong_and_extra_sets_not_silently_passed(self):
        logs = self.make_logs()
        logs.pop(0)
        logs[1]['kg'] = 12
        logs.append(dict(id='extra',date=BENCHMARK_DAY,templateId=TEMPLATE,
                         exerciseIndex=20,set=1,**TARGET))
        result = score_workout({'logs': logs})
        self.assertEqual(result['saved_sets'], 29)
        self.assertEqual(result['missing_sets'], [[0,1]])
        self.assertEqual(result['mismatched_sets'], [[0,3]])
        self.assertEqual(result['extra_sets'], [[20,1]])

    def test_other_plan_date_not_counted_and_duplicates_rejected(self):
        a = self.make_logs()
        a.append(dict(id='other',date='2026-11-08',templateId=TEMPLATE,
                      exerciseIndex=0,set=1,**TARGET))
        self.assertEqual(score_workout({'logs': a})['saved_sets'], 30)
        a.append(dict(a[0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            score_workout({'logs': a})

    def test_missing_log_array_rejected(self):
        with self.assertRaisesRegex(ValueError, 'logs array'):
            score_workout({})


if __name__ == '__main__':
    unittest.main()
