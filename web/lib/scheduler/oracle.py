import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[3] / "backend"
sys.path.insert(0, str(BACKEND))

from models import ScheduleRequest  # noqa: E402
from scheduler import generate_schedule  # noqa: E402


def generate(payload: dict) -> dict:
    request = ScheduleRequest.model_validate(payload)
    return generate_schedule(request).model_dump(mode="json")


def main() -> None:
    payload = json.load(sys.stdin)
    json.dump(generate(payload), sys.stdout)


if __name__ == "__main__":
    main()
