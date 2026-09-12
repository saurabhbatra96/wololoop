#!/usr/bin/env python3
"""Run every challenge's reference solution against its tests, headlessly.

This is the same harness the browser uses, so a green run here means the pad
will be green too. It also checks that each starter.py *fails*, because a stage
that passes before you write anything is a broken stage.

    python3 tools/verify.py            # everything
    python3 tools/verify.py 01 03      # just these
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HARNESS = (ROOT / "runtime" / "harness.py").read_text()

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"


def run_case(challenge, code_source, label):
    namespace = {"__name__": "__test__"}
    exec(compile(HARNESS, "<harness>", "exec"), namespace)
    try:
        exec(compile(code_source, "your_code.py", "exec"), namespace)
    except Exception as exc:
        return {"tests": [], "stages": [], "passed": 0, "total": 0,
                "load_error": "%s: %s" % (label, exc)}
    exec(compile((challenge / "tests.py").read_text(), "tests.py", "exec"), namespace)
    return namespace["_harness_run"]()


def verify(challenge):
    name = challenge.name
    failures = []

    result = run_case(challenge, (challenge / "solution.py").read_text(), "solution")
    if result.get("load_error"):
        failures.append("solution failed to load: " + result["load_error"])
    else:
        for test in result["tests"]:
            if test["status"] != "pass":
                failures.append(
                    "solution / part %d / %s [%s]\n%s"
                    % (test["stage"], test["name"], test["status"],
                       "\n".join("      " + l for l in test["message"].splitlines()[:8]))
                )

    starter = run_case(challenge, (challenge / "starter.py").read_text(), "starter")
    if not starter.get("load_error"):
        stage_one = [t for t in starter["tests"] if t["stage"] == 1]
        if stage_one and all(t["status"] == "pass" for t in stage_one):
            failures.append("starter.py already passes part 1 - the stage has no teeth")

    stages = result.get("stages", [])
    if failures:
        print("%s%-34s FAIL%s" % (RED, name, RESET))
        for line in failures:
            print("    " + line)
    else:
        summary = " ".join("p%d:%d" % (s["stage"], s["total"]) for s in stages)
        print("%s%-34s ok%s  %s%d tests (%s)%s"
              % (GREEN, name, RESET, DIM, result["total"], summary, RESET))
    return not failures


def main():
    wanted = sys.argv[1:]
    challenges = sorted(p for p in (ROOT / "challenges").iterdir() if (p / "tests.py").exists())
    if wanted:
        challenges = [c for c in challenges if any(c.name.startswith(w) for w in wanted)]
    if not challenges:
        print("no challenges matched")
        return 1

    ok = all([verify(c) for c in challenges])
    print()
    print(("%sall %d green%s" % (GREEN, len(challenges), RESET)) if ok
          else ("%ssome challenges failed%s" % (RED, RESET)))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
