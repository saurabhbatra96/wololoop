# Tests for 09 - Incident Alert Correlation.

def _events(spec):
    """spec: [(minute, service, errors, other_events), ...] -> flat event list."""
    events = []
    for minute, service, errors, others in spec:
        for _ in range(errors):
            events.append({"ts": "2026-07-01T" + minute + ":00", "service": service,
                           "level": "error"})
        for _ in range(others):
            events.append({"ts": "2026-07-01T" + minute + ":30", "service": service,
                           "level": "info"})
    return events


def _m(minute):
    return "2026-07-01T" + minute


DEPS = {"web": ["api"], "api": ["db"], "db": [], "cache": [], "worker": ["db"]}


# ------------------------------------------------------------------ part 1

@stage(1)
def test_rate_for_one_minute():
    """two errors out of ten"""
    assert_eq(error_rates(_events([("10:00", "api", 2, 8)])),
              {("api", _m("10:00")): 0.2})


@stage(1)
def test_all_errors():
    """a completely broken minute"""
    assert_eq(error_rates(_events([("10:00", "api", 5, 0)])),
              {("api", _m("10:00")): 1.0})


@stage(1)
def test_no_errors():
    """a healthy minute still appears in the report"""
    assert_eq(error_rates(_events([("10:00", "api", 0, 5)])),
              {("api", _m("10:00")): 0.0})


@stage(1)
def test_non_error_levels_are_denominator_only():
    """warnings count as traffic, not as failures"""
    events = _events([("10:00", "api", 1, 0)])
    events.append({"ts": _m("10:00") + ":10", "service": "api", "level": "warn"})
    assert_eq(error_rates(events), {("api", _m("10:00")): 0.5})


@stage(1)
def test_minutes_are_separate():
    """the bucket is the minute, not the hour"""
    assert_eq(error_rates(_events([("10:00", "api", 1, 1), ("10:01", "api", 0, 2)])),
              {("api", _m("10:00")): 0.5, ("api", _m("10:01")): 0.0})


@stage(1)
def test_services_are_separate():
    """one bad service does not drag another down"""
    assert_eq(error_rates(_events([("10:00", "api", 1, 1), ("10:00", "db", 0, 4)])),
              {("api", _m("10:00")): 0.5, ("db", _m("10:00")): 0.0})


@stage(1)
def test_rate_is_rounded_to_three_places():
    """one in three"""
    assert_eq(error_rates(_events([("10:00", "api", 1, 2)])),
              {("api", _m("10:00")): 0.333})


@stage(1)
def test_no_events():
    """quiet night"""
    assert_eq(error_rates([]), {})


# ------------------------------------------------------------------ part 2

@stage(2)
def test_alert_opens_when_the_rate_crosses():
    """90% errors trips the 50% threshold"""
    events = _events([("10:00", "api", 0, 10), ("10:01", "api", 9, 1)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq(alerts, [{"service": "api", "start": _m("10:01"), "end": None}])


@stage(2)
def test_alert_closes_when_the_rate_drops():
    """back under the leave threshold"""
    events = _events([("10:00", "api", 9, 1), ("10:01", "api", 0, 10)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq(alerts, [{"service": "api", "start": _m("10:00"), "end": _m("10:01")}])


@stage(2)
def test_hysteresis_holds_through_a_partial_recovery():
    """40% is below the enter threshold but above the leave threshold"""
    events = _events([("10:00", "api", 9, 1),
                      ("10:01", "api", 4, 6),
                      ("10:02", "api", 0, 10)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq(alerts, [{"service": "api", "start": _m("10:00"), "end": _m("10:02")}],
              "a single threshold would have closed and reopened this alert")


@stage(2)
def test_no_flapping_across_a_wobble():
    """one alert, not three"""
    events = _events([("10:00", "api", 9, 1), ("10:01", "api", 3, 7),
                      ("10:02", "api", 9, 1), ("10:03", "api", 3, 7),
                      ("10:04", "api", 0, 10)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq(len(alerts), 1)


@stage(2)
def test_window_smooths_a_single_spike():
    """one bad minute in a five minute window is not an incident"""
    events = _events([("10:00", "api", 0, 10), ("10:01", "api", 0, 10),
                      ("10:02", "api", 8, 2), ("10:03", "api", 0, 10),
                      ("10:04", "api", 0, 10)])
    assert_eq(detect_alerts(events, window_minutes=5, enter=0.5, leave=0.2), [])


@stage(2)
def test_alert_still_open_at_the_end_of_the_data():
    """we do not invent a recovery we did not see"""
    events = _events([("10:00", "api", 0, 10), ("10:01", "api", 9, 1)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq(alerts[0]["end"], None)


@stage(2)
def test_silent_minutes_have_no_error_rate():
    """no traffic is not an error rate, so the alert clears"""
    events = _events([("10:00", "api", 9, 1), ("10:02", "db", 0, 1)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq(alerts, [{"service": "api", "start": _m("10:00"), "end": _m("10:01")}])


@stage(2)
def test_services_alert_independently():
    """two services, two alerts, sorted by service then start"""
    events = _events([("10:00", "web", 9, 1), ("10:00", "api", 9, 1)])
    alerts = detect_alerts(events, window_minutes=1, enter=0.5, leave=0.2)
    assert_eq([a["service"] for a in alerts], ["api", "web"])


# ------------------------------------------------------------------ part 3

@stage(3)
def test_single_alert_is_its_own_incident():
    """nothing to correlate with"""
    assert_eq(correlate([{"service": "cache"}], DEPS),
              [{"services": ["cache"], "root_cause": "cache"}])


@stage(3)
def test_dependency_chain_is_one_incident():
    """web -> api -> db, all shouting, one page"""
    alerts = [{"service": "web"}, {"service": "api"}, {"service": "db"}]
    assert_eq(correlate(alerts, DEPS),
              [{"services": ["api", "db", "web"], "root_cause": "db"}])


@stage(3)
def test_root_cause_is_the_deepest_broken_service():
    """api depends on db and db is fine, so api is the root"""
    alerts = [{"service": "web"}, {"service": "api"}]
    assert_eq(correlate(alerts, DEPS),
              [{"services": ["api", "web"], "root_cause": "api"}])


@stage(3)
def test_unrelated_services_are_separate_incidents():
    """two pages, because they are two problems"""
    alerts = [{"service": "cache"}, {"service": "db"}]
    assert_eq(correlate(alerts, DEPS),
              [{"services": ["cache"], "root_cause": "cache"},
               {"services": ["db"], "root_cause": "db"}])


@stage(3)
def test_a_healthy_service_does_not_join_two_incidents():
    """web and db both depend on api, but api is fine"""
    alerts = [{"service": "web"}, {"service": "db"}]
    assert_eq([i["services"] for i in correlate(alerts, DEPS)], [["db"], ["web"]])


@stage(3)
def test_fan_out_from_one_root():
    """two services both broken because db is"""
    alerts = [{"service": "worker"}, {"service": "db"}, {"service": "api"}]
    assert_eq(correlate(alerts, DEPS),
              [{"services": ["api", "db", "worker"], "root_cause": "db"}])


@stage(3)
def test_duplicate_alerts_collapse():
    """the same service paging twice is still one service"""
    alerts = [{"service": "db"}, {"service": "db"}]
    assert_eq(correlate(alerts, DEPS), [{"services": ["db"], "root_cause": "db"}])


@stage(3)
def test_dependency_cycle_falls_back_to_a_name():
    """a cycle has no deepest service - pick one and stay deterministic"""
    deps = {"a": ["b"], "b": ["a"]}
    assert_eq(correlate([{"service": "a"}, {"service": "b"}], deps),
              [{"services": ["a", "b"], "root_cause": "a"}])


@stage(3)
def test_unknown_service_is_allowed():
    """a service with no entry in the dependency map has no dependencies"""
    assert_eq(correlate([{"service": "mystery"}], DEPS),
              [{"services": ["mystery"], "root_cause": "mystery"}])


@stage(3)
def test_no_alerts():
    """nothing is on fire"""
    assert_eq(correlate([], DEPS), [])
