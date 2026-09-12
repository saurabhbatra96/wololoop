# 07 - Clickstream Sessionisation

EVENTS = [
    {"event_id": "e1", "user_id": "u1", "ts": "2026-05-01T10:00:00", "page": "/home"},
    {"event_id": "e2", "user_id": "u1", "ts": "2026-05-01T10:05:00", "page": "/pricing"},
    {"event_id": "e3", "user_id": "u1", "ts": "2026-05-01T10:40:00", "page": "/home"},
]


def sessionize(events, gap_seconds=1800):
    """{user_id: [[event_id, ...], ...]} - one inner list per session."""
    raise NotImplementedError("sessionize")


if __name__ == "__main__":
    print(sessionize(EVENTS))
