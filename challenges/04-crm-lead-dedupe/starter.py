# 04 - CRM Lead Deduplication


def normalize_email(raw):
    """Canonical form of an email address, or None if unusable."""
    raise NotImplementedError("normalize_email")


def normalize_phone(raw):
    """Ten digit national number as a string, or None."""
    raise NotImplementedError("normalize_phone")


def group_by_email(leads):
    """{canonical_email: [lead_id, ...]}, in input order."""
    raise NotImplementedError("group_by_email")


if __name__ == "__main__":
    print(normalize_email("First.Last+newsletter@GoogleMail.com"))
    print(normalize_phone("+1 (415) 555-0142"))
