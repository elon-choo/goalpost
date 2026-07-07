---
description: RUN mode — load the newest ledger and drain its goals hands-off, delegating engineering to Codex and creative work to Claude, stopping only at human-decision gates.
argument-hint: [ledger path] [--stage N]
---

# /goalpost:run — hands-off autonomous execution from the ledger

Enter the **goalpost** skill's RUN mode. `$ARGUMENTS` may name a specific ledger path and/or `--stage N` to bound the run; if empty, auto-select the newest ledger.

Follow the skill's RUN procedure exactly:
1. Run the preflight; confirm the `mcp__codex__codex` tool is actually available (if not, declare the Claude-only degraded mode).
2. Auto-select the active ledger among goalpost-generated `LEDGER*.md` (`Generator: goalpost`) by newest `Created:` header (tie-break filename timestamp → mtime); integrity-check it (has `▶ NEXT`, status codes, ≥1 goal) and claim it with a `Session-claim` line — if a fresh claim by another session exists, report the conflict and stop. Declare path + completion % + stop conditions + budget in one line. If `▶ NEXT` is a `[~]` goal, use the claim/`Last updated` timestamp + a repo scan for partial artifacts as the backstop (treat liveness as opportunistic, not guaranteed): fresh → wait; stale → re-fire without a strike after the artifact scan.
3. If the host supports it, set a heartbeat (ScheduleWakeup safety net; offer CronCreate that resumes only on a stale claim). If ScheduleWakeup/CronCreate are unavailable, say so and run without a heartbeat.
4. Loop one goal at a time: re-read ledger + refresh claim → check budget → fire the goal under the goal-execution contract (`${CLAUDE_PLUGIN_ROOT}/commands/goal.md`) → verify the DoD with first-party evidence (distinguish DoD-fail / infra-error / flake) → update the ledger → move the pointer (only when its `depends:` are all `[x]`). 3 DoD-strikes → HUMAN_GATE; infra errors don't count.
5. At each stage boundary run in order: `G x.9` integration + review GO → `G x.10` generate next-stage detail → `G x.9.5` independent transition review (vets the generated DoDs). A NO-GO, a weakening DoD change, `codex-down`, `review-unavailable`, or budget reached is a HUMAN_GATE.
6. Report only at a stage completion, a HUMAN_GATE, or full completion — not per goal.

Unless the user said "to the end" or named a stage count, honour `--stage N` or stop at the first HUMAN_GATE and report.
