#!/usr/bin/env python3
"""Rebuild challenges/manifest.json from each challenge's meta.json."""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHALLENGES = ROOT / "challenges"


def main():
    entries = []
    for meta_path in sorted(CHALLENGES.glob("*/meta.json")):
        meta = json.loads(meta_path.read_text())
        entries.append(
            {
                "id": meta_path.parent.name,
                "title": meta["title"],
                "domain": meta["domain"],
                "language": meta.get("language", "python"),
                "minutes": meta["minutes"],
                "skills": meta.get("skills", []),
            }
        )
    out = CHALLENGES / "manifest.json"
    out.write_text(json.dumps({"challenges": entries}, indent=2) + "\n")
    print("wrote %s (%d challenges)" % (out.relative_to(ROOT), len(entries)))


if __name__ == "__main__":
    main()
