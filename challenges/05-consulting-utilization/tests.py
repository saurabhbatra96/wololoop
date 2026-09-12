# Tests for 05 - Consulting Utilisation and Staffing.

def _entry(entry_id, consultant, start, end, billable=True, project="P1"):
    return {"entry_id": entry_id, "consultant": consultant, "project": project,
            "billable": billable, "start": start, "end": end}


CONSULTANTS = {
    "amara": {"skills": ["data", "strategy"], "max_concurrent": 2},
    "bo":    {"skills": ["data"], "max_concurrent": 1},
    "chen":  {"skills": ["strategy"], "max_concurrent": 2},
}


def _request(request_id, skill, start, end):
    return {"request_id": request_id, "skill": skill, "start": start, "end": end}


# ------------------------------------------------------------------ part 1

@stage(1)
def test_single_billable_day():
    """eight billable hours is a fifth of a week"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T17:00:00")]
    assert_eq(weekly_utilization(entries), {("amara", "2026-03-02"): 0.2})


@stage(1)
def test_non_billable_time_does_not_count():
    """internal work still puts the consultant in the report, at zero"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:00:00",
                      billable=False, project="internal")]
    assert_eq(weekly_utilization(entries), {("amara", "2026-03-02"): 0.0})


@stage(1)
def test_hours_accumulate_across_the_week():
    """three eight hour days"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T17:00:00"),
               _entry("E2", "amara", "2026-03-03T09:00:00", "2026-03-03T17:00:00"),
               _entry("E3", "amara", "2026-03-04T09:00:00", "2026-03-04T17:00:00")]
    assert_eq(weekly_utilization(entries), {("amara", "2026-03-02"): 0.6})


@stage(1)
def test_sunday_belongs_to_the_week_that_started_monday():
    """weeks start Monday, not Sunday"""
    entries = [_entry("E1", "amara", "2026-03-08T09:00:00", "2026-03-08T13:00:00")]
    assert_eq(weekly_utilization(entries), {("amara", "2026-03-02"): 0.1})


@stage(1)
def test_weeks_are_separate():
    """the same consultant in two weeks gets two rows"""
    entries = [_entry("E1", "amara", "2026-03-06T09:00:00", "2026-03-06T17:00:00"),
               _entry("E2", "amara", "2026-03-09T09:00:00", "2026-03-09T17:00:00")]
    assert_eq(weekly_utilization(entries),
              {("amara", "2026-03-02"): 0.2, ("amara", "2026-03-09"): 0.2})


@stage(1)
def test_consultants_are_separate():
    """one row per consultant per week"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T17:00:00"),
               _entry("E2", "bo", "2026-03-02T09:00:00", "2026-03-02T13:00:00")]
    assert_eq(weekly_utilization(entries),
              {("amara", "2026-03-02"): 0.2, ("bo", "2026-03-02"): 0.1})


@stage(1)
def test_partial_hours_round_to_three_places():
    """three hours twenty minutes is 0.083 of a week"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:20:00")]
    assert_eq(weekly_utilization(entries), {("amara", "2026-03-02"): 0.083})


@stage(1)
def test_empty_timesheet():
    """nothing in, nothing out"""
    assert_eq(weekly_utilization([]), {})


# ------------------------------------------------------------------ part 2

@stage(2)
def test_no_conflicts_in_a_clean_week():
    """sequential bookings are fine"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:00:00"),
               _entry("E2", "amara", "2026-03-02T13:00:00", "2026-03-02T17:00:00")]
    assert_eq(find_conflicts(entries), [])


@stage(2)
def test_simple_overlap():
    """two entries claiming the same hour"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:00:00"),
               _entry("E2", "amara", "2026-03-02T11:00:00", "2026-03-02T15:00:00")]
    assert_eq(find_conflicts(entries), [("E1", "E2")])


@stage(2)
def test_touching_endpoints_are_not_a_conflict():
    """a booking that ends exactly when the next begins is legal"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:00:00"),
               _entry("E2", "amara", "2026-03-02T12:00:00", "2026-03-02T15:00:00")]
    assert_eq(find_conflicts(entries), [])


@stage(2)
def test_fully_contained_entry():
    """a short entry buried inside a long one still conflicts"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T18:00:00"),
               _entry("E2", "amara", "2026-03-02T11:00:00", "2026-03-02T12:00:00")]
    assert_eq(find_conflicts(entries), [("E1", "E2")])


@stage(2)
def test_different_consultants_never_conflict():
    """two people can work the same hour"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T18:00:00"),
               _entry("E2", "bo", "2026-03-02T09:00:00", "2026-03-02T18:00:00")]
    assert_eq(find_conflicts(entries), [])


@stage(2)
def test_three_way_overlap_reports_every_pair():
    """three entries on one hour is three conflicts, not one"""
    entries = [_entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:00:00"),
               _entry("E2", "amara", "2026-03-02T10:00:00", "2026-03-02T13:00:00"),
               _entry("E3", "amara", "2026-03-02T11:00:00", "2026-03-02T11:30:00")]
    assert_eq(find_conflicts(entries), [("E1", "E2"), ("E1", "E3"), ("E2", "E3")])


@stage(2)
def test_conflicts_survive_shuffled_input():
    """the timesheet feed is not sorted"""
    entries = [_entry("E3", "amara", "2026-03-04T09:00:00", "2026-03-04T10:00:00"),
               _entry("E1", "amara", "2026-03-02T09:00:00", "2026-03-02T12:00:00"),
               _entry("E2", "amara", "2026-03-02T11:00:00", "2026-03-02T15:00:00")]
    assert_eq(find_conflicts(entries), [("E1", "E2")])


@stage(2)
def test_each_pair_reported_once_and_sorted():
    """pairs are ordered, and so is the list"""
    entries = [_entry("E9", "amara", "2026-03-02T09:00:00", "2026-03-02T18:00:00"),
               _entry("E2", "amara", "2026-03-02T10:00:00", "2026-03-02T11:00:00")]
    assert_eq(find_conflicts(entries), [("E2", "E9")])


# ------------------------------------------------------------------ part 3

@stage(3)
def test_assigns_a_qualified_consultant():
    """the only data person gets the data job"""
    requests = [_request("R1", "strategy", "2026-04-06", "2026-04-10")]
    result = assign({"chen": CONSULTANTS["chen"]}, requests)
    assert_eq(result, {"assignments": {"R1": "chen"}, "unassigned": []})


@stage(3)
def test_skill_is_required():
    """nobody on the bench can do it"""
    requests = [_request("R1", "legal", "2026-04-06", "2026-04-10")]
    assert_eq(assign(CONSULTANTS, requests),
              {"assignments": {}, "unassigned": ["R1"]})


@stage(3)
def test_respects_max_concurrent():
    """bo can only carry one engagement at a time"""
    consultants = {"bo": {"skills": ["data"], "max_concurrent": 1}}
    requests = [_request("R1", "data", "2026-04-06", "2026-04-17"),
                _request("R2", "data", "2026-04-08", "2026-04-20")]
    assert_eq(assign(consultants, requests),
              {"assignments": {"R1": "bo"}, "unassigned": ["R2"]})


@stage(3)
def test_sequential_requests_reuse_the_same_person():
    """once the first engagement ends, bo is free again"""
    consultants = {"bo": {"skills": ["data"], "max_concurrent": 1}}
    requests = [_request("R1", "data", "2026-04-06", "2026-04-10"),
                _request("R2", "data", "2026-04-10", "2026-04-17")]
    assert_eq(assign(consultants, requests),
              {"assignments": {"R1": "bo", "R2": "bo"}, "unassigned": []})


@stage(3)
def test_concurrent_engagements_up_to_the_limit():
    """amara can carry two at once"""
    consultants = {"amara": {"skills": ["data"], "max_concurrent": 2}}
    requests = [_request("R1", "data", "2026-04-06", "2026-04-20"),
                _request("R2", "data", "2026-04-07", "2026-04-20"),
                _request("R3", "data", "2026-04-08", "2026-04-20")]
    assert_eq(assign(consultants, requests),
              {"assignments": {"R1": "amara", "R2": "amara"}, "unassigned": ["R3"]})


@stage(3)
def test_load_is_spread_across_the_bench():
    """the second data job goes to the person who isn't already busy"""
    requests = [_request("R1", "data", "2026-04-06", "2026-04-10"),
                _request("R2", "data", "2026-04-13", "2026-04-17")]
    result = assign(CONSULTANTS, requests)
    assert_eq(sorted(result["assignments"].values()), ["amara", "bo"],
              "both were free and idle, so the work should not pile on one of them")


@stage(3)
def test_ties_break_alphabetically():
    """equal load, equal skill - lowest name wins so staffing is reproducible"""
    requests = [_request("R1", "data", "2026-04-06", "2026-04-10")]
    assert_eq(assign(CONSULTANTS, requests)["assignments"], {"R1": "amara"})


@stage(3)
def test_requests_are_processed_earliest_first():
    """arrival order in the list does not decide who gets staffed"""
    consultants = {"bo": {"skills": ["data"], "max_concurrent": 1}}
    requests = [_request("R2", "data", "2026-05-01", "2026-05-30"),
                _request("R1", "data", "2026-04-01", "2026-04-30")]
    assert_eq(assign(consultants, requests),
              {"assignments": {"R1": "bo", "R2": "bo"}, "unassigned": []})


@stage(3)
def test_unassigned_list_is_sorted():
    """deterministic output, even for the failures"""
    requests = [_request("R9", "legal", "2026-04-06", "2026-04-10"),
                _request("R3", "legal", "2026-04-06", "2026-04-10")]
    assert_eq(assign(CONSULTANTS, requests)["unassigned"], ["R3", "R9"])
