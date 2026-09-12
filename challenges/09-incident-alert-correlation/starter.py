# 09 - Incident Alert Correlation

EVENTS = [
    {"ts": "2026-07-01T10:00:04", "service": "api", "level": "info"},
    {"ts": "2026-07-01T10:00:31", "service": "api", "level": "error"},
    {"ts": "2026-07-01T10:01:12", "service": "api", "level": "error"},
]


def error_rates(events):
    """{(service, "YYYY-MM-DDTHH:MM"): errors / total}, rounded to 3dp."""
    raise NotImplementedError("error_rates")


if __name__ == "__main__":
    print(error_rates(EVENTS))
