# Tests for 04 - CRM Lead Deduplication.

def _lead(lead_id, email=None, phone=None, name=None, company=None,
          source="import", updated_at="2026-01-01T00:00:00"):
    return {"lead_id": lead_id, "email": email, "phone": phone, "name": name,
            "company": company, "source": source, "updated_at": updated_at}


PRIORITY = ["salesforce", "webform", "import"]


# ------------------------------------------------------------------ part 1

@stage(1)
def test_email_case_and_whitespace():
    """addresses are lowercased and trimmed"""
    assert_eq(normalize_email("  Dana.Reed@Example.COM "), "dana.reed@example.com")


@stage(1)
def test_email_plus_tag_is_dropped():
    """+tag routing is the same mailbox"""
    assert_eq(normalize_email("dana+crm2026@example.com"), "dana@example.com")


@stage(1)
def test_gmail_dots_are_ignored():
    """gmail ignores dots; other providers do not"""
    assert_eq(normalize_email("d.a.n.a@gmail.com"), "dana@gmail.com")
    assert_eq(normalize_email("d.a.n.a@example.com"), "d.a.n.a@example.com")


@stage(1)
def test_googlemail_is_gmail():
    """the legacy domain is the same mailbox"""
    assert_eq(normalize_email("Dana.Reed+x@googlemail.com"), "danareed@gmail.com")


@stage(1)
def test_unusable_emails_are_none():
    """blank or malformed input has no canonical form"""
    assert_eq([normalize_email(v) for v in (None, "", "   ", "not-an-email", "@example.com")],
              [None, None, None, None, None])


@stage(1)
def test_phone_strips_formatting():
    """punctuation and spacing are noise"""
    assert_eq(normalize_phone("+1 (415) 555-0142"), "4155550142")
    assert_eq(normalize_phone("415.555.0142"), "4155550142")


@stage(1)
def test_phone_rejects_wrong_lengths():
    """anything that isn't a ten digit national number is None"""
    assert_eq([normalize_phone(v) for v in (None, "", "555-0142", "+44 20 7946 0958")],
              [None, None, None, None])


@stage(1)
def test_group_by_email():
    """leads collapse onto their canonical address, in input order"""
    leads = [_lead("L1", email="Dana.Reed@example.com"),
             _lead("L2", email="dana.reed+sales@EXAMPLE.com"),
             _lead("L3", email="other@example.com"),
             _lead("L4", email="")]
    assert_eq(group_by_email(leads),
              {"dana.reed@example.com": ["L1", "L2"], "other@example.com": ["L3"]})


# ------------------------------------------------------------------ part 2

@stage(2)
def test_singletons_are_their_own_cluster():
    """everyone appears exactly once"""
    leads = [_lead("L1", email="a@x.com"), _lead("L2", email="b@x.com")]
    assert_eq(cluster_leads(leads), [["L1"], ["L2"]])


@stage(2)
def test_clusters_on_shared_email():
    """same mailbox, same person"""
    leads = [_lead("L1", email="dana@x.com"), _lead("L2", email="DANA@x.com")]
    assert_eq(cluster_leads(leads), [["L1", "L2"]])


@stage(2)
def test_clusters_on_shared_phone():
    """same number, same person"""
    leads = [_lead("L1", phone="(415) 555-0142"), _lead("L2", phone="+1 415 555 0142")]
    assert_eq(cluster_leads(leads), [["L1", "L2"]])


@stage(2)
def test_linking_is_transitive():
    """A shares an email with B, B shares a phone with C, so all three are one"""
    leads = [_lead("L1", email="dana@x.com"),
             _lead("L2", email="dana@x.com", phone="4155550142"),
             _lead("L3", phone="415-555-0142")]
    assert_eq(cluster_leads(leads), [["L1", "L2", "L3"]])


@stage(2)
def test_long_transitive_chain():
    """the chain holds however long it gets, in any input order"""
    leads = [_lead("L4", phone="4155550003"),
             _lead("L1", email="a@x.com"),
             _lead("L3", email="b@x.com", phone="4155550003"),
             _lead("L2", email="a@x.com", phone="4155550002"),
             _lead("L5", email="b@x.com", phone="4155550002", company="Acme"),
             _lead("L6", email="b@x.com")]
    assert_eq(cluster_leads(leads), [["L1", "L2", "L3", "L4", "L5", "L6"]])


@stage(2)
def test_missing_identifiers_do_not_link():
    """two leads with no email and no phone are not the same person"""
    leads = [_lead("L1", name="Dana"), _lead("L2", name="Dana")]
    assert_eq(cluster_leads(leads), [["L1"], ["L2"]])


@stage(2)
def test_invalid_identifiers_do_not_link():
    """a short phone number is not an identifier at all"""
    leads = [_lead("L1", phone="0142"), _lead("L2", phone="0142")]
    assert_eq(cluster_leads(leads), [["L1"], ["L2"]])


@stage(2)
def test_output_is_deterministic():
    """clusters and their members come back sorted"""
    leads = [_lead("L9", email="a@x.com"), _lead("L2", email="a@x.com"),
             _lead("L5", email="z@x.com")]
    assert_eq(cluster_leads(leads), [["L2", "L9"], ["L5"]])


# ------------------------------------------------------------------ part 3

@stage(3)
def test_one_record_per_cluster():
    """two leads, one person, one record"""
    leads = [_lead("L1", email="dana@x.com", name="Dana"),
             _lead("L2", email="dana@x.com", company="Acme")]
    records = golden_records(leads, PRIORITY)
    assert_eq(len(records), 1)
    assert_eq(records[0]["lead_ids"], ["L1", "L2"])


@stage(3)
def test_source_precedence_wins():
    """salesforce beats the webform even though the webform is newer"""
    leads = [_lead("L1", email="dana@x.com", name="Dana Reed",
                   source="salesforce", updated_at="2026-01-01T00:00:00"),
             _lead("L2", email="dana@x.com", name="dana",
                   source="webform", updated_at="2026-06-01T00:00:00")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq(record["name"], "Dana Reed")
    assert_eq(record["provenance"]["name"], "L1")


@stage(3)
def test_recency_breaks_source_ties():
    """same source, newest value wins"""
    leads = [_lead("L1", email="dana@x.com", company="Acme",
                   source="import", updated_at="2026-01-01T00:00:00"),
             _lead("L2", email="dana@x.com", company="Acme Corp",
                   source="import", updated_at="2026-06-01T00:00:00")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq(record["company"], "Acme Corp")
    assert_eq(record["provenance"]["company"], "L2")


@stage(3)
def test_blank_values_never_win():
    """a high priority record with an empty field does not blank the result"""
    leads = [_lead("L1", email="dana@x.com", company="   ", source="salesforce"),
             _lead("L2", email="dana@x.com", company="Acme", source="import")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq(record["company"], "Acme")
    assert_eq(record["provenance"]["company"], "L2")


@stage(3)
def test_fields_are_chosen_independently():
    """the golden record is assembled field by field, not copied from one lead"""
    leads = [_lead("L1", email="dana@x.com", name="Dana Reed", source="salesforce"),
             _lead("L2", email="dana@x.com", phone="4155550142", company="Acme",
                   source="webform")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq([record["name"], record["phone"], record["company"]],
              ["Dana Reed", "4155550142", "Acme"])
    assert_eq(record["provenance"], {"name": "L1", "email": "L1",
                                     "phone": "L2", "company": "L2"})


@stage(3)
def test_missing_field_is_none_with_no_provenance():
    """nothing to record means no claim about where it came from"""
    leads = [_lead("L1", email="dana@x.com")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq(record["phone"], None)
    assert_eq("phone" in record["provenance"], False)


@stage(3)
def test_merged_identifiers_are_canonical():
    """the surviving email and phone are stored normalised"""
    leads = [_lead("L1", email="Dana.Reed+crm@GoogleMail.com", phone="+1 (415) 555-0142")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq([record["email"], record["phone"]], ["danareed@gmail.com", "4155550142"])


@stage(3)
def test_unknown_sources_sort_last():
    """a source nobody configured is the least trustworthy thing in the cluster"""
    leads = [_lead("L1", email="dana@x.com", name="Dana", source="mystery_csv",
                   updated_at="2026-09-01T00:00:00"),
             _lead("L2", email="dana@x.com", name="Dana Reed", source="import",
                   updated_at="2026-01-01T00:00:00")]
    record = golden_records(leads, PRIORITY)[0]
    assert_eq(record["name"], "Dana Reed")


@stage(3)
def test_several_clusters_keep_their_order():
    """records come back in cluster order"""
    leads = [_lead("L1", email="a@x.com", name="A"),
             _lead("L2", email="b@x.com", name="B"),
             _lead("L3", email="a@x.com", phone="4155550142")]
    records = golden_records(leads, PRIORITY)
    assert_eq([r["lead_ids"] for r in records], [["L1", "L3"], ["L2"]])
