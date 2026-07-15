# Production-readiness rubric — the "no human needs to touch this again" bar

A goal is closed only when it clears the rows for its type. This operationalizes "don't advance until it's actually right." Every row is pass/fail on observable evidence, not opinion. Cite the evidence next to each row in the goal's ledger entry (or the worker's return).

## Engineering goals ([codex])
| # | Check | How to verify (evidence) |
|---|---|---|
| E1 | DoD met | The goal's stated check re-run, real output quoted (input → observed output) |
| E2 | Tests green (not flaky) | Test command output: N passed / 0 failed (name the command). A test that failed then passed on a re-run with NO code change is a flake, not a pass — require a root-cause change or two consecutive greens before closing |
| E3 | Builds / typechecks clean | Build or typecheck exit 0, no new errors |
| E4 | No stub in the shipped path | grep the changed files for TODO / FIXME / `throw new Error("not implemented")` / placeholder returns — none on the live path |
| E5 | Errors handled at real boundaries | External input / API / IO failure paths handled (not swallowed, not fabricated); no error handling invented for cases that can't occur |
| E6 | No secrets / no destructive side effects | No keys/tokens committed; no files/data/DBs deleted or truncated, no row-level/bulk data destruction (`DELETE FROM`, mass `UPDATE`, data-rewrite migration), no destructive git, no real sends/deploys/payments unless the goal explicitly authorizes them AND a human approved. For a destructive-capable (incl. transitive) goal, the evidence is a **before/after state audit the orchestrator read** — `git status`/a file manifest diff and, where relevant, an egress/command audit — NOT just a green test log (a passing test does not prove nothing was deleted or sent). A destructive capability must have run as its own isolated, gated goal — not bundled here (principle 9) |
| E7 | Working code protected | Existing working code changed only within scope, with stated reason; no opportunistic refactor. The Codex worker ran with the allow/deny guardrail and did not widen "implement X" into deleting/resetting Y |
| E8 | Docs/types synced | Public signatures, config, and any user-facing docs updated to match the change |
| E9 | Model fit — under-tiering blocks, over-tiering is audit-only | **Enforced (a real failure):** a HIGH-blast-radius goal (security/data/payment/irreversible-migration) must NOT have run on a tier below its Sol floor — but this is caught **before dispatch** (planner/reviewer), never a reason to fail-close a goal that already passed every product check. **Audit-only (never a BLOCK):** running a higher tier than needed is logged as cost telemetry, not a completeness failure — do not re-run a passing goal on a cheaper tier (that adds risk for no completeness gain). Record the tier used + any escalation |

## Creative / marketing goals ([claude])
These rows are judgement calls, so they are scored by a **fresh-context reviewer, never by the context that wrote the deliverable** (an author does not pass their own creative work).

| # | Check | How to verify (evidence) |
|---|---|---|
| C1 | Audience + intent explicit | The piece names who it is for and what action it drives |
| C2 | Every claim supported | No fabricated stat, testimonial, or capability; each concrete claim traces to a real source or is removed |
| C3 | One clear CTA | A single primary next action, unambiguous |
| C4 | Voice + structure fit | Matches the brand voice and the required structure (e.g. hook → empathy → solution → proof → CTA) |
| C5 | No AI tells | No generic filler, no hedging boilerplate, no "as an AI"; reads as written by a person who knows the domain |
| C6 | Deliverable gate passed | The host's marketing/doc acceptance gate (e.g. fable_check) returns PASS, or its UNCHECKED items are surfaced to the user, not silently assumed |

## Both
| # | Check |
|---|---|
| B1 | The evidence is first-party (a check that actually ran), not a worker's unverified assertion |
| B2 | Anything that could not be verified is labelled "unverified" in the ledger — never inferred to pass |
