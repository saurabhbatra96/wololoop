"""PyCoderPad test harness.

This is exec'd into the *same* namespace as your solution, so the tests can
call your functions by name exactly like a single-file CoderPad session.

You never import this. You just get three names for free:

    @stage(n)          mark a test as belonging to Part n
    assert_eq(got, want[, msg])    equality check with a readable diff
    assert_close(got, want[, tol]) float comparison
"""

import pprint
import sys
import time
import traceback

_TESTS = []
_HARNESS_FILES = ("<harness>",)


def stage(n):
    """Decorator: tag a test function with the part it belongs to."""

    def deco(fn):
        fn._stage = n
        _TESTS.append(fn)
        return fn

    return deco


def _fmt(value, limit=600):
    try:
        text = pprint.pformat(value, width=74, sort_dicts=True)
    except Exception:
        text = repr(value)
    if len(text) > limit:
        text = text[:limit] + "\n  ...(truncated)"
    return text


def _indent(text, pad="    "):
    return "\n".join(pad + line for line in text.splitlines())


def assert_eq(got, want, msg=""):
    """Assert got == want, raising a diff that is actually readable."""
    if got == want:
        return
    parts = []
    if msg:
        parts.append(msg)
    parts.append("expected:\n" + _indent(_fmt(want)))
    parts.append("     got:\n" + _indent(_fmt(got)))

    if isinstance(got, dict) and isinstance(want, dict):
        missing = sorted(k for k in want if k not in got)
        extra = sorted(k for k in got if k not in want)
        changed = sorted(k for k in want if k in got and got[k] != want[k])
        detail = []
        if missing:
            detail.append("  keys you did not return: %s" % _fmt(missing, 200))
        if extra:
            detail.append("  keys that should not be there: %s" % _fmt(extra, 200))
        for key in changed[:5]:
            detail.append("  at %r: expected %r, got %r" % (key, want[key], got[key]))
        if detail:
            parts.append("differences:\n" + "\n".join(detail))

    if isinstance(got, list) and isinstance(want, list):
        if len(got) != len(want):
            parts.append("length: expected %d, got %d" % (len(want), len(got)))
        else:
            for i, (g, w) in enumerate(zip(got, want)):
                if g != w:
                    parts.append("first difference at index %d: expected %r, got %r" % (i, w, g))
                    break

    raise AssertionError("\n".join(parts))


def assert_close(got, want, tol=1e-9, msg=""):
    """Assert two floats are within tol of each other."""
    if abs(got - want) <= tol:
        return
    raise AssertionError((msg + "\n" if msg else "") + "expected %r +/- %g, got %r" % (want, tol, got))


def _clean_traceback():
    etype, exc, tb = sys.exc_info()
    frames = [f for f in traceback.extract_tb(tb) if f.filename not in _HARNESS_FILES]
    body = "".join(traceback.format_list(frames))
    body += "".join(traceback.format_exception_only(etype, exc))
    return body.strip()


def _test_name(fn):
    doc = (fn.__doc__ or "").strip()
    if doc:
        return doc.splitlines()[0].strip()
    return fn.__name__.replace("test_", "").replace("_", " ")


def _harness_run(stages=None):
    """Run registered tests, optionally filtered to a set of stages."""
    results = []
    for fn in _TESTS:
        st = getattr(fn, "_stage", 1)
        if stages is not None and st not in stages:
            continue
        started = time.time()
        try:
            fn()
            status, message = "pass", ""
        except NotImplementedError as exc:
            status = "todo"
            message = "not implemented yet" + (": %s" % exc if str(exc) else "")
        except AssertionError as exc:
            status = "fail"
            message = str(exc) or "assertion failed"
        except Exception:
            status = "error"
            message = _clean_traceback()
        results.append(
            {
                "name": _test_name(fn),
                "func": fn.__name__,
                "stage": st,
                "status": status,
                "message": message,
                "ms": int((time.time() - started) * 1000),
            }
        )

    by_stage = {}
    for r in results:
        bucket = by_stage.setdefault(r["stage"], {"stage": r["stage"], "total": 0, "passed": 0})
        bucket["total"] += 1
        if r["status"] == "pass":
            bucket["passed"] += 1
    for bucket in by_stage.values():
        bucket["all_passed"] = bucket["total"] > 0 and bucket["passed"] == bucket["total"]

    return {
        "tests": results,
        "stages": [by_stage[k] for k in sorted(by_stage)],
        "passed": sum(1 for r in results if r["status"] == "pass"),
        "total": len(results),
    }
