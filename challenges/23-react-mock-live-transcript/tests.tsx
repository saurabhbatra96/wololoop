// Tests for 23 - Mock: Live Transcript.

import { act } from "react";
import { Transcript } from "./your_code";
/** @stage 2 */
import { LiveTranscript } from "./your_code";

type TestLine = { id: string; speaker: "me" | "them"; name?: string; text: string; at: string };

const line = (id: string, speaker: "me" | "them", text: string, at: string, name?: string): TestLine =>
  ({ id, speaker, text, at: "2026-10-01T" + at + "Z", ...(name ? { name } : {}) });

const MEETING = Object.freeze([
  line("l3", "them", "We spent $100,000 on yoghurt.", "09:31:00", "Raisin Patel"),
  line("l1", "me", "Shall we start?", "09:30:00"),
  line("l6", "me", "Greek only then.", "09:33:00"),
  line("l2", "me", "The yoghurt budget first.", "09:30:05"),
  line("l4", "them", "And made $150,000 (ok) back.", "09:31:10", "Fig"),
  line("l5", "them", "Agreed.", "09:32:00"),
]);

const groups = () => screen.queryAllByRole("article").map((a) => [
  a.querySelector("h3")?.textContent,
  a.querySelector("time")?.textContent,
  Array.from(a.querySelectorAll("p")).map((p) => p.textContent),
]);

/** A source whose subscribers you drive by hand. */
function fakeSource() {
  const subs: { meetingId: string; onLine: (l: TestLine) => void; active: boolean }[] = [];
  const source = {
    subscribe(meetingId: string, onLine: (l: TestLine) => void) {
      const sub = { meetingId, onLine, active: true };
      subs.push(sub);
      return () => { sub.active = false; };
    },
  };
  const emit = (l: TestLine, sub = subs[subs.length - 1]) => act(() => sub.onLine(l));
  return { source, subs, emit };
}

// ------------------------------------------------------------------ part 1

test(1, "groups consecutive lines by speaker, in time order", () => {
  render(<Transcript lines={MEETING as TestLine[]} />);
  assertEqual(groups(), [
    ["You", "09:30", ["Shall we start?", "The yoghurt budget first."]],
    ["Raisin Patel", "09:31", ["We spent $100,000 on yoghurt."]],
    ["Fig", "09:31", ["And made $150,000 (ok) back."]],
    ["Them", "09:32", ["Agreed."]],
    ["You", "09:33", ["Greek only then."]],
  ]);
});

test(1, "labels and times use h3 and time elements", () => {
  render(<Transcript lines={[line("a", "them", "Hi", "14:05:59", "Fig")]} />);
  screen.getByRole("heading", { name: "Fig" });
  assertEqual(document.querySelector("article time")?.textContent, "14:05");
});

test(1, "sorting doesn't touch the props", () => {
  render(<Transcript lines={MEETING as TestLine[]} />); // frozen: an in-place sort would throw
  assertEqual(MEETING[0].id, "l3");
});

test(1, "an empty transcript is waiting", () => {
  render(<Transcript lines={[]} />);
  screen.getByText("Waiting for someone to speak…");
  assertEqual(screen.queryAllByRole("article").length, 0);
});

// ------------------------------------------------------------------ part 2

test(2, "subscribes once, and new lines appear", () => {
  const s = fakeSource();
  render(<LiveTranscript meetingId="m1" source={s.source} />);
  assertEqual(s.subs.map((x) => x.meetingId), ["m1"]);
  s.emit(line("l1", "me", "Hello", "09:30:00"));
  s.emit(line("l2", "me", "Anyone there?", "09:30:05"));
  s.emit(line("l3", "them", "Yes", "09:30:09", "Fig"));
  assertEqual(groups().map((g) => g[2]), [["Hello", "Anyone there?"], ["Yes"]]);
  assertEqual(s.subs.length, 1, "subscribed again on re-render");
});

test(2, "redelivered lines show once", () => {
  const s = fakeSource();
  render(<LiveTranscript meetingId="m1" source={s.source} />);
  const hello = line("l1", "me", "Hello", "09:30:00");
  s.emit(hello);
  s.emit(hello);
  s.emit({ ...hello });
  assertEqual(screen.getAllByText("Hello").length, 1);
});

test(2, "unmounting unsubscribes", () => {
  const s = fakeSource();
  const view = render(<LiveTranscript meetingId="m1" source={s.source} />);
  view.unmount();
  assertEqual(s.subs[0].active, false);
});

test(2, "a new meeting: unsubscribe, clear, resubscribe, ignore the old one", () => {
  const s = fakeSource();
  const view = render(<LiveTranscript meetingId="m1" source={s.source} />);
  const old = s.subs[0];
  s.emit(line("l1", "me", "From meeting one", "09:30:00"), old);
  view.rerender(<LiveTranscript meetingId="m2" source={s.source} />);
  assertEqual([old.active, s.subs.length, s.subs[1]?.meetingId], [false, 2, "m2"]);
  assertEqual(screen.queryByText("From meeting one"), null);
  s.emit(line("x1", "me", "A stray old line", "09:31:00"), old);
  s.emit(line("n1", "them", "From meeting two", "10:00:00", "Fig"), s.subs[1]);
  assertEqual(screen.queryByText("A stray old line"), null);
  screen.getByText("From meeting two");
});

test(2, "Pause holds lines back and counts them; Resume shows them", async () => {
  const s = fakeSource();
  render(<LiveTranscript meetingId="m1" source={s.source} />);
  s.emit(line("l1", "me", "Before the pause", "09:30:00"));
  await user.click(screen.getByRole("button", { name: "Pause" }));
  s.emit(line("l2", "them", "During one", "09:30:10", "Fig"));
  s.emit(line("l3", "them", "During two", "09:30:20", "Fig"));
  s.emit(line("l4", "me", "During three", "09:30:30"));
  screen.getByRole("button", { name: "Resume (3 new)" });
  assertEqual(screen.queryByText("During one"), null);
  assertEqual(s.subs[0].active, true, "pausing must not unsubscribe");
  await user.click(screen.getByRole("button", { name: "Resume (3 new)" }));
  assertEqual(groups().map((g) => g[2]).flat(), ["Before the pause", "During one", "During two", "During three"]);
  screen.getByRole("button", { name: "Pause" });
});

// ------------------------------------------------------------------ part 3

/** @stage 3 */
function liveWith(lines: readonly TestLine[]) {
  const s = fakeSource();
  render(<LiveTranscript meetingId="m1" source={s.source} />);
  for (const l of lines) s.emit(l);
  return s;
}

const marks = () => Array.from(document.querySelectorAll("mark")).map((m) => m.textContent);

test(3, "search highlights every match and counts them", async () => {
  liveWith(MEETING);
  await user.type(screen.getByLabelText("Search transcript"), "YOGHURT");
  assertEqual(marks(), ["yoghurt", "yoghurt"]);
  screen.getByText("2 matches");
  screen.getByText("Shall we start?"); // lines without a match still show
});

test(3, "one match is singular; an empty box shows no count", async () => {
  liveWith(MEETING);
  const box = screen.getByLabelText("Search transcript");
  await user.type(box, "agreed");
  screen.getByText("1 match");
  await user.clear(box);
  assertEqual([marks(), screen.queryByText(/match/)], [[], null]);
});

test(3, "the query is plain text, not a regex", async () => {
  liveWith(MEETING);
  const box = screen.getByLabelText("Search transcript");
  await user.type(box, "(ok)");
  assertEqual(marks(), ["(ok)"]);
  await user.clear(box);
  await user.type(box, "$1");
  assertEqual(marks(), ["$1", "$1"]);
});

test(3, "transcript text is never parsed as HTML", async () => {
  liveWith([line("h1", "them", "Type <b>bold</b> please", "09:30:00", "Fig")]);
  await user.type(screen.getByLabelText("Search transcript"), "bold");
  assertEqual(document.querySelectorAll("article b").length, 0);
  screen.getByText((/<b>/));
});

test(3, "speaker filter buttons, Everyone first", async () => {
  liveWith(MEETING);
  const pressed = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);
  assertEqual(pressed(), ["Everyone"]);
  await user.click(screen.getByRole("button", { name: "You" }));
  assertEqual(pressed(), ["You"]);
  assertEqual(groups().map((g) => g[0]), ["You"]);
  assertEqual(groups()[0][2], ["Shall we start?", "The yoghurt budget first.", "Greek only then."]);
});

test(3, "filtering happens before grouping", async () => {
  liveWith([
    line("a", "them", "One", "09:30:00", "Fig"),
    line("b", "me", "Interrupting", "09:30:05"),
    line("c", "them", "Two", "09:30:10", "Fig"),
  ]);
  await user.click(screen.getByRole("button", { name: "Them" }));
  assertEqual(groups(), [["Fig", "09:30", ["One", "Two"]]]);
});

test(3, "search counts only what the filter shows", async () => {
  liveWith(MEETING);
  await user.click(screen.getByRole("button", { name: "Them" }));
  await user.type(screen.getByLabelText("Search transcript"), "yoghurt");
  screen.getByText("1 match");
});
