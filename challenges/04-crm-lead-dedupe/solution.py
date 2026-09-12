"""Reference solution - 04 CRM Lead Deduplication.

Entity resolution in three moves that generalise well beyond CRM:

  1. Normalise every identifier to a canonical form before comparing anything.
  2. Link records that share any canonical identifier - and because linking is
     transitive (A~B on email, B~C on phone means A~C), use union-find rather
     than a pile of pairwise sets.
  3. Merge each cluster into one record with an explicit precedence rule, and
     keep provenance so someone can answer "where did this phone number come
     from?" six months later.
"""

import re

GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


# ---------------------------------------------------------------- part 1

def normalize_email(raw):
    """Canonical email, or None if there isn't a usable one."""
    if not raw or not raw.strip():
        return None
    value = raw.strip().lower()
    if "@" not in value:
        return None
    local, _, domain = value.rpartition("@")
    local = local.split("+", 1)[0]
    if domain in GMAIL_DOMAINS:
        domain = "gmail.com"
        local = local.replace(".", "")
    if not local or not domain:
        return None
    return local + "@" + domain


def normalize_phone(raw):
    """Ten digit national number, or None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits if len(digits) == 10 else None


def group_by_email(leads):
    """{canonical_email: [lead_id, ...]} in input order, skipping unusable ones."""
    groups = {}
    for lead in leads:
        email = normalize_email(lead.get("email"))
        if email is None:
            continue
        groups.setdefault(email, []).append(lead["lead_id"])
    return groups


# ---------------------------------------------------------------- part 2

class _Union:
    def __init__(self):
        self.parent = {}

    def add(self, item):
        self.parent.setdefault(item, item)

    def find(self, item):
        root = item
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[item] != root:      # path compression
            self.parent[item], item = root, self.parent[item]
        return root

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def cluster_leads(leads):
    """Clusters of lead_ids linked by any shared email or phone, transitively."""
    union = _Union()
    first_seen = {}

    for lead in leads:
        lead_id = lead["lead_id"]
        union.add(lead_id)
        for kind, value in (("email", normalize_email(lead.get("email"))),
                            ("phone", normalize_phone(lead.get("phone")))):
            if value is None:
                continue
            key = (kind, value)
            if key in first_seen:
                union.union(first_seen[key], lead_id)
            else:
                first_seen[key] = lead_id

    clusters = {}
    for lead in leads:
        clusters.setdefault(union.find(lead["lead_id"]), []).append(lead["lead_id"])

    return sorted((sorted(members) for members in clusters.values()), key=lambda c: c[0])


# ---------------------------------------------------------------- part 3

FIELDS = ("name", "email", "phone", "company")


def _blank(value):
    return value is None or not str(value).strip()


def golden_records(leads, source_priority):
    """One merged record per cluster, with per-field provenance."""
    by_id = {lead["lead_id"]: lead for lead in leads}
    rank = {source: index for index, source in enumerate(source_priority)}

    records = []
    for cluster in cluster_leads(leads):
        record = {"lead_ids": cluster, "provenance": {}}

        for field in FIELDS:
            candidates = [by_id[lead_id] for lead_id in cluster
                          if not _blank(by_id[lead_id].get(field))]
            if not candidates:
                record[field] = None
                continue

            # Python's sort is stable, so layering cheapest-last gives us
            # "source rank asc, then updated_at desc, then lead_id asc"
            # without inventing a reverse-comparing wrapper.
            candidates.sort(key=lambda lead: lead["lead_id"])
            candidates.sort(key=lambda lead: lead.get("updated_at", ""), reverse=True)
            winner = min(candidates, key=lambda lead: rank.get(lead.get("source"), len(rank)))

            if field == "email":
                record[field] = normalize_email(winner[field])
            elif field == "phone":
                record[field] = normalize_phone(winner[field])
            else:
                record[field] = str(winner[field]).strip()
            record["provenance"][field] = winner["lead_id"]

        records.append(record)
    return records

