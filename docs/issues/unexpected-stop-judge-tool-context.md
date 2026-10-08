# Unexpected-stop judge cannot verify completion claims — pass tool-call context into the judgment state

## Problem

The smart unexpected-stop judge answers `NO` (not a stop) for messages that
promise future work, because it judges the bare message text with no evidence
of what actually ran. Two observed false-NO verdicts:

1. `Both queued: cmake first, then the self-healing fallback.` — "queued"
   means scheduled, not executed, and `isUnexpectedStopCandidate` already
   guarantees no tool call followed. The judge pattern-matched past-tense
   phrasing to the `NO` example `"The fix is done and tests pass"`.
2. `One clarification before I rewire — resetting \`origin/main\` is
   destructive:` — a deferred promise ("I will rewire after X") plus a
   truncation colon. The judge cited the `NO` example `"Should I do that
   for you?"` ("questions are never stops") and talked itself out of the
   truncation signal it had already noticed.

## Root cause

`classifyUnexpectedStop` sends only the message text to the judge:

```ts
// packages/coding-agent/src/session/unexpected-stop-classifier.ts
const { answers } = await judge.judge(
  { state: { message: text }, questions: { stopped: UNEXPECTED_STOP_QUESTION } },
  { signal: deps.signal },
);
```

"Both queued" is *verifiable* (queued but nothing ran ⇒ YES), yet the judge
must guess from phrasing alone. Every such case becomes a prompt-engineering
exercise instead of a fact lookup.

## Proposed solution

Extend the judged state beyond `{ message }` with tool-call evidence from the
turn, so completion claims are checkable. Sketch (open to revision):

- Add a field such as `toolCallsSinceMessage: number` or short tool-call
  summaries (names + timestamps) for the current turn, supplied by the
  `TurnRecoveryHost` at the `#handleUnexpectedAssistantStop` call site
  (`packages/coding-agent/src/session/turn-recovery.ts`).
- Extend the `NoulQuestion` state schema and the instructions with a rule
  like: "a message claiming queued/scheduled/done work with zero following
  tool calls is an unexpected stop."
- Keep the question short and bulleted: the criteria comment in
  `unexpected-stop-classifier.ts` notes prose costs ~3 points of recall on
  the 1.2B on-device judge models (`lfm2-1.2b` / `qwen2.5-1.5b`), so any
  wording change needs recall re-measurement on those models.

## Acceptance criteria

- [ ] Both messages above classify `YES` through the real judge path.
- [ ] Genuine completions with preceding tool calls (e.g. "The fix is done
      and tests pass." after test runs) still classify `NO`.
- [ ] Recall re-measured on the 1.2B tiny judges; no regression vs. baseline.
- [ ] Per-judgment token cost noted in the PR (context adds tokens to every
      smart classification).

## Alternatives already shipped (not this issue)

- Deterministic truncation-suffix pre-check (`:` / `...` / `…` ⇒ nudge
  without consulting the judge, all modes) — covers case 2 mechanically.
- `NoulQuestion` criteria rewrite: YES examples for queued/deferred-promise
  phrasing, and the `"Should I do that for you?"` NO example narrowed to
  questions with no promised action — covers case 1 by example.

## Notes

- Deliberately deferred: the two fixes above are smaller, deterministic, and
  need no schema or plumbing changes. This issue is the principled long-term
  fix for the whole "claims completion, did nothing" class.
- Related: PR #14993 (judge verdict budget 4s → 60s + abort-linked wait).
