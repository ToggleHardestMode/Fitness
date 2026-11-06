"""Deterministic fictional FitnessPilot v1 browser-storage fixtures (no personal data)."""
from datetime import date, timedelta
import json

FOOD_KEY = "fitnesspilot.preview.v101.foodDiary.v1"
WORKOUT_KEY = "fitnesspilot.preview.v101.v1"
LAST_DAY = "2026-10-28"


def create_fixtures():
    start = date(2026, 10, 1)
    meals = []
    metrics = []
    for offset in range(28):
        day = (start + timedelta(days=offset)).isoformat()
        meals.append({
            "id": f"fixture-meal-{offset:03}", "date": day,
            "name": f"Synthetic rice bowl {offset:02}", "occasion": "meal",
            "servings": 2, "kcal": 300, "protein": 20, "carbs": 40, "fat": 5,
        })
        meals.append({
            "id": f"fixture-water-{offset:03}", "date": day,
            "name": "Synthetic water", "occasion": "drink", "servings": 1,
            "kcal": 0, "protein": 0, "carbs": 0, "fat": 0,
        })
        if offset % 7 == 6:
            meals.append({
                "id": f"fixture-unknown-{offset:03}", "date": day,
                "name": "Synthetic unlabeled snack", "occasion": "snack", "servings": 1,
                "kcal": None, "protein": None, "carbs": None, "fat": None,
            })
        metrics.append({
            "date": day, "weight": round(88.0 - offset * 0.02, 2),
            "calories": 2050, "protein": 145, "sleep": 7, "recovery": 4,
        })

    workout = {
        "version": 1,
        "templates": [{
            "id": "fixture-upper-001", "name": "Synthetic upper-body workout",
            "day": 0, "exercises": [{
                "name": "Synthetic seated press", "muscle": "Chest",
                "sets": 2, "min": 8, "max": 12, "rest": 90,
            }],
        }],
        "assignments": {"0": "fixture-upper-001"},
        "logs": [{
            "id": "fixture-set-001", "date": "2026-10-26",
            "templateId": "fixture-upper-001", "exerciseIndex": 0,
            "set": 1, "kg": 10, "reps": 10, "rpe": 7,
            "rest": 90, "notes": "synthetic QA only", "tempo": "",
        }],
        "metrics": metrics,
        "reminder": {"hour": 18, "minute": 30, "lead": 0},
        "symptomLogs": [],
    }
    food = {"version": 1, "entries": meals}
    return {FOOD_KEY: food, WORKOUT_KEY: workout}


def expected_last_day():
    return {"date": LAST_DAY, "count": 3, "kcal": 600,
            "protein": 40, "carbs": 80, "fat": 10, "unknown": 1}


def validate_fixture(fixtures):
    assert set(fixtures) == {FOOD_KEY, WORKOUT_KEY}
    diary = fixtures[FOOD_KEY]
    workout = fixtures[WORKOUT_KEY]
    assert diary["version"] == workout["version"] == 1
    assert len(diary["entries"]) == 60  # 56 known entries + 4 unknown snacks
    assert len({e["id"] for e in diary["entries"]}) == 60
    assert len(workout["metrics"]) == 28
    assert len(workout["logs"]) == 1
    last = [e for e in diary["entries"] if e["date"] == LAST_DAY]
    expected = expected_last_day()
    assert len(last) == expected["count"]
    for nutrient in ["kcal", "protein", "carbs", "fat"]:
        known = sum(e[nutrient] * e["servings"] for e in last if e[nutrient] is not None)
        assert known == expected[nutrient]
        assert sum(e[nutrient] is None for e in last) == expected["unknown"]
    assert any(e["kcal"] == 0 for e in last)  # Genuine recorded zero is NOT missing.
    assert json.loads(json.dumps(fixtures)) == fixtures
    return {"food_entries": len(diary["entries"]), "metric_days": len(workout["metrics"]),
            "workout_logs": len(workout["logs"]), "last_day": expected}


if __name__ == "__main__":
    print(json.dumps(validate_fixture(create_fixtures()), sort_keys=True))
