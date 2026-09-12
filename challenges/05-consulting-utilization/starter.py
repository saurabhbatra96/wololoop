# 05 - Consulting Utilisation and Staffing

TIMESHEET = [
    {"entry_id": "E1", "consultant": "amara", "project": "P1", "billable": True,
     "start": "2026-03-02T09:00:00", "end": "2026-03-02T17:00:00"},
    {"entry_id": "E2", "consultant": "amara", "project": "internal", "billable": False,
     "start": "2026-03-03T09:00:00", "end": "2026-03-03T12:00:00"},
]


def weekly_utilization(entries):
    """{(consultant, week_start): utilisation}, week_start being the Monday."""
    raise NotImplementedError("weekly_utilization")


if __name__ == "__main__":
    print(weekly_utilization(TIMESHEET))
