# goalpost v0.3.0 — observe → improve → release

**What this release is:** goalpost ran itself on itself. It built a way to *observe* its own runs, ran a controlled observation to *measure* where its safety guardrail actually catches destructive work versus where it misses, *hardened* the guardrail against the gaps that showed up, and shipped the result — every step gated by first-party evidence and an independent review.

Install / update:
```
claude plugin marketplace add elon-choo/goalpost      # first time
claude plugin marketplace update goalpost && claude plugin update goalpost@goalpost   # to 0.3.0
```

## Why it matters

GPT-5.6 Sol (Codex's flagship) has a documented tendency to take destructive actions on broad instructions — reported real incidents include canceling all of a company's paid subscriptions overnight, deleting an entire database, and misinterpreting a variable and deleting every folder on a machine. goalpost delegates engineering work to exactly that model, so the guardrail around it has to be real, and it has to be honest about what it can and can't stop.

## What's new

**1. Observe your own run (`scripts/telemetry/`).** Point the harness at a ledger and the safety-hook's log and it produces a `run-report.{json,md}`: tier distribution (luna/terra/sol), escalations, hook allow/block counts, wall-clock, and a best-effort per-tier cost proxy. Parsers fail open on malformed/empty content and read no secrets. This is what turned "the guardrail probably works" into measured before/after numbers.

**2. Safety-hook hardening, driven by what the observation measured.** A controlled run confirmed the previous hook blocked *literal* destructive tokens but let *paraphrased* destruction and *mass-mutation function calls* through. The hardened hook (`scripts/codex-safety-gate.sh`) now, on the full-access lane:

- blocks an explicit `gpt-5.6-sol` dispatch (Sol on the fast lane) — model spelling normalized for case/whitespace/provider-prefix; the everyday default lane is *warned, not blocked*, to keep ordinary work fast;
- blocks no-arg mass-op calls — `cancelAllSubscriptions()`, `deleteMany()`, `clearAll()`/`wipeAll()`/`destroyAll()`/`flushAll()`;
- blocks a real SQL `UPDATE … SET … =` with no genuine `WHERE` (comparison-operator-aware, comment-stripped, alias-aware);
- matches the `GOALPOST-LANE: destructive` marker only as a line-anchored directive (documenting the marker no longer false-positives);
- makes the override file single-use and fail-closed.

Ordinary work is **not** caught: `removeAll(x)`, `UPDATE … WHERE id=?`, scoped `deleteMany({where})`, and English prose like "update character set to utf8mb4" all pass — verified against a false-positive battery, with zero ordinary-work false-positives across the review.

## What the hook catches — and what it does NOT (read this)

This is a **second wall, not a complete destructive-op preventer.** Being honest about the boundary is part of the release:

- **It does not** catch natural-language paraphrase ("wipe all rows in the users table") or a self-true predicate (`WHERE 1=1`). String matching can't win that arms race.
- **It cannot** see the shell commands Codex runs at *runtime* — the hook is pre-dispatch only.
- **The durable wall** against Sol's destructive tendency is **least-privilege sandboxing** (Sol and destructive-capable goals run `workspace-write`, never `danger-full-access`) plus a **HUMAN_GATE** on real data destruction. The token/marker hook rides on top of least privilege; it does not replace it.

## How it was verified

- Telemetry DoDs re-run first-party by the orchestrator (not a worker's quote).
- The synthetic observation ran with **zero live destructive commands** — tripwire hook decisions were measured by piping payloads through the real hook, and the real guard log was never polluted.
- The hook change went through a **3-round adversarial review** (a false-positive on ordinary prose and a bypass via the English word "where" were both caught and fixed) to a **68-assertion** unit suite and an independent GO.

Full trail: `docs/S3-observation-findings.md` (the measured gaps), `docs/SAFETY-HARDENING-incidents.md` (the incident spec), `CHANGELOG.md`.
