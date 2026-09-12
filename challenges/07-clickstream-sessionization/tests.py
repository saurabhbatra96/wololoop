# Tests for 07 - Clickstream Sessionisation.

def _ev(event_id, user, ts, page="/home"):
    return {"event_id": event_id, "user_id": user, "ts": ts, "page": page}


FUNNEL = ["/home", "/pricing", "/checkout"]


# ------------------------------------------------------------------ part 1

@stage(1)
def test_one_session():
    """clicks a few minutes apart are one visit"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u1", "2026-05-01T10:05:00")]
    assert_eq(sessionize(events), {"u1": [["e1", "e2"]]})


@stage(1)
def test_gap_starts_a_new_session():
    """thirty-five minutes of nothing ends the visit"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u1", "2026-05-01T10:35:00")]
    assert_eq(sessionize(events), {"u1": [["e1"], ["e2"]]})


@stage(1)
def test_gap_boundary_is_inclusive():
    """exactly thirty minutes counts as inactive"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u1", "2026-05-01T10:30:00")]
    assert_eq(sessionize(events), {"u1": [["e1"], ["e2"]]})


@stage(1)
def test_gap_is_measured_from_the_last_event():
    """a long visit with short gaps never splits"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u1", "2026-05-01T10:25:00"),
              _ev("e3", "u1", "2026-05-01T10:50:00")]
    assert_eq(sessionize(events), {"u1": [["e1", "e2", "e3"]]},
              "the gap is from the previous event, not the start of the session")


@stage(1)
def test_users_are_independent():
    """two people browsing at once are two sets of sessions"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u2", "2026-05-01T10:01:00")]
    assert_eq(sessionize(events), {"u1": [["e1"]], "u2": [["e2"]]})


@stage(1)
def test_events_arrive_out_of_order():
    """the pipeline does not deliver in timestamp order"""
    events = [_ev("e3", "u1", "2026-05-01T10:40:00"),
              _ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u1", "2026-05-01T10:05:00")]
    assert_eq(sessionize(events), {"u1": [["e1", "e2"], ["e3"]]})


@stage(1)
def test_custom_gap():
    """the window is a parameter, not a constant"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00"),
              _ev("e2", "u1", "2026-05-01T10:05:00")]
    assert_eq(sessionize(events, gap_seconds=60), {"u1": [["e1"], ["e2"]]})


@stage(1)
def test_no_events():
    """empty in, empty out"""
    assert_eq(sessionize([]), {})


# ------------------------------------------------------------------ part 2

@stage(2)
def test_full_conversion():
    """one session walks the whole funnel"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/pricing"),
              _ev("e3", "u1", "2026-05-01T10:02:00", "/checkout")]
    assert_eq(funnel_counts(events, FUNNEL), [1, 1, 1])


@stage(2)
def test_drop_off():
    """they looked at pricing and left"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/pricing")]
    assert_eq(funnel_counts(events, FUNNEL), [1, 1, 0])


@stage(2)
def test_steps_may_be_separated():
    """other pages in between do not break the funnel"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/blog"),
              _ev("e3", "u1", "2026-05-01T10:02:00", "/pricing"),
              _ev("e4", "u1", "2026-05-01T10:03:00", "/faq"),
              _ev("e5", "u1", "2026-05-01T10:04:00", "/checkout")]
    assert_eq(funnel_counts(events, FUNNEL), [1, 1, 1])


@stage(2)
def test_order_matters():
    """checkout before pricing is not a conversion"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/checkout"),
              _ev("e3", "u1", "2026-05-01T10:02:00", "/pricing")]
    assert_eq(funnel_counts(events, FUNNEL), [1, 1, 0])


@stage(2)
def test_funnel_does_not_span_sessions():
    """coming back tomorrow starts the funnel again"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/pricing"),
              _ev("e3", "u1", "2026-05-02T10:00:00", "/checkout")]
    assert_eq(funnel_counts(events, FUNNEL), [1, 1, 0])


@stage(2)
def test_sessions_are_counted_not_users():
    """one user, two sessions, two entries at the top of the funnel"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T12:00:00", "/home")]
    assert_eq(funnel_counts(events, FUNNEL), [2, 0, 0])


@stage(2)
def test_session_that_never_enters_the_funnel():
    """a visit that misses step one counts nowhere"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/blog"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/pricing")]
    assert_eq(funnel_counts(events, FUNNEL), [0, 0, 0])


@stage(2)
def test_repeated_step_does_not_double_count():
    """refreshing the pricing page is not two conversions"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/pricing"),
              _ev("e3", "u1", "2026-05-01T10:02:00", "/pricing")]
    assert_eq(funnel_counts(events, FUNNEL), [1, 1, 0])


@stage(2)
def test_empty_funnel():
    """no steps, no counts"""
    assert_eq(funnel_counts([_ev("e1", "u1", "2026-05-01T10:00:00")], []), [])


# ------------------------------------------------------------------ part 3

@stage(3)
def test_counts_sessions_not_views():
    """three views in one session is reach of one"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/home"),
              _ev("e3", "u1", "2026-05-01T10:02:00", "/home")]
    assert_eq(top_pages_by_reach(events, 3), [("/home", 1)])


@stage(3)
def test_reach_across_sessions():
    """the same page in two sessions counts twice"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T12:00:00", "/home"),
              _ev("e3", "u2", "2026-05-01T10:00:00", "/pricing")]
    assert_eq(top_pages_by_reach(events, 2), [("/home", 2), ("/pricing", 1)])


@stage(3)
def test_only_the_top_n():
    """the report is a leaderboard, not a dump"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/a"),
              _ev("e2", "u1", "2026-05-01T10:01:00", "/b"),
              _ev("e3", "u2", "2026-05-01T10:00:00", "/b"),
              _ev("e4", "u3", "2026-05-01T10:00:00", "/c")]
    assert_eq(top_pages_by_reach(events, 1), [("/b", 2)])


@stage(3)
def test_ties_break_alphabetically():
    """equal reach, lowest page path first"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/zebra"),
              _ev("e2", "u2", "2026-05-01T10:00:00", "/apple"),
              _ev("e3", "u3", "2026-05-01T10:00:00", "/mango")]
    assert_eq(top_pages_by_reach(events, 2), [("/apple", 1), ("/mango", 1)])


@stage(3)
def test_n_larger_than_the_catalogue():
    """asking for ten when there are two"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/a"),
              _ev("e2", "u2", "2026-05-01T10:00:00", "/b")]
    assert_eq(len(top_pages_by_reach(events, 10)), 2)


@stage(3)
def test_n_of_zero():
    """a leaderboard of nothing"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/a")]
    assert_eq(top_pages_by_reach(events, 0), [])


@stage(3)
def test_reach_respects_the_gap_parameter():
    """a tighter gap splits sessions and raises reach"""
    events = [_ev("e1", "u1", "2026-05-01T10:00:00", "/home"),
              _ev("e2", "u1", "2026-05-01T10:05:00", "/home")]
    assert_eq(top_pages_by_reach(events, 1, gap_seconds=60), [("/home", 2)])


@stage(3)
def test_no_events_no_leaderboard():
    """nothing to rank"""
    assert_eq(top_pages_by_reach([], 5), [])
